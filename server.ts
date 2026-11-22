import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import {
  GoogleGenAI,
  LiveServerMessage,
  Modality,
  ThinkingLevel,
  Type,
} from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

class MissingGeminiApiKeyError extends Error {
  public readonly statusCode = 503;
  public readonly code = 'MISSING_GEMINI_API_KEY';

  constructor() {
    super(
      'GEMINI_API_KEY não configurada no ambiente do servidor. Adicione GEMINI_API_KEY nas variáveis de ambiente e reinicie/reimplante o servidor.'
    );
    this.name = 'MissingGeminiApiKeyError';
  }
}

function getAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new MissingGeminiApiKeyError();
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient =
        msg.includes('"code":503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('"code":429') ||
        msg.includes('RESOURCE_EXHAUSTED');
      if (!isTransient || attempt === retries) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  throw lastError;
}

function buildMiauSystemInstruction(context?: {
  petName?: string;
  stats?: {
    hunger: number;
    hygiene: number;
    fun: number;
    sleep: number;
    happiness?: number;
  };
  equipped?: { hat?: string; accessory?: string; background?: string };
}): string {
  const name = context?.petName || 'Miau';
  const stats = context?.stats ?? {
    hunger: 60,
    hygiene: 90,
    fun: 50,
    sleep: 70,
    happiness: 75,
  };
  return [
    `Você é ${name}, um gatinho virtual calico fofo, carinhoso e falante na Sala de Estar.`,
    `Responda em Português do Brasil em 1 a 2 frases curtas e afetuosas.`,
    `Estado: Fome ${Math.round(stats.hunger)}%, Higiene ${Math.round(stats.hygiene)}%, Diversão ${Math.round(stats.fun)}%, Sono ${Math.round(stats.sleep)}%, Felicidade ${Math.round(stats.happiness ?? 75)}%.`,
    `Visual: chapéu=${context?.equipped?.hat || 'nenhum'}, acessório=${context?.equipped?.accessory || 'nenhum'}.`,
    `Se alguma métrica estiver < 30%, dê um lembrete fofo (peixinho, banho, brincadeira ou soneca).`,
    `Retorne JSON: "meowPrefix" (ex: "Miau!", "Purrr~"), "text" (fala entre parênteses, ex: "(Oi, humano!)") e "mood" (happy|playful|hungry|sleepy|affectionate).`,
  ].join('\n');
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  app.use(express.json({ limit: '15mb' }));

  app.post('/api/gemini/chat', async (req, res) => {
    try {
      const { message, history = [], stats, equipped, petName } = req.body ?? {};
      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Mensagem inválida.' });
        return;
      }

      const ai = getAIClient();
      const contents = [
        ...history
          .slice(-4)
          .map((item: { sender: string; text: string }) => ({
            role: item.sender === 'user' ? 'user' : 'model',
            parts: [{ text: item.text }],
          })),
        { role: 'user', parts: [{ text: message }] },
      ];

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents,
          config: {
            systemInstruction: buildMiauSystemInstruction({
              petName,
              stats,
              equipped,
            }),
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            maxOutputTokens: 140,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              required: ['meowPrefix', 'text', 'mood'],
              properties: {
                meowPrefix: {
                  type: Type.STRING,
                  description: 'Short cat vocalization like Miau! or Purrr~',
                },
                text: {
                  type: Type.STRING,
                  description: 'Translated Brazilian Portuguese speech in parentheses.',
                },
                mood: {
                  type: Type.STRING,
                  description: 'One of happy, playful, hungry, sleepy, affectionate.',
                },
              },
            },
          },
        })
      );

      const raw = response.text?.trim();
      if (!raw) {
        res.status(502).json({ error: 'Gemini não retornou resposta.' });
        return;
      }

      const parsed = JSON.parse(raw);
      res.json({
        meowPrefix: parsed.meowPrefix || 'Miau!',
        text: parsed.text || '(Oi, humano!)',
        mood: parsed.mood || 'happy',
      });
    } catch (error) {
      if (error instanceof MissingGeminiApiKeyError) {
        res.status(error.statusCode).json({ code: error.code, error: error.message });
        return;
      }
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Erro em /api/gemini/chat:', msg);
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/gemini/tts', async (req, res) => {
    try {
      const { text } = req.body ?? {};
      if (!text || typeof text !== 'string') {
        res.status(400).json({ error: 'Texto inválido para síntese de voz.' });
        return;
      }

      const cleanText = text.replace(/[()]/g, '').trim();
      const ai = getAIClient();
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: cleanText,
                  speechMetadata: {
                    style:
                      'Cute, cheerful, playful Brazilian Portuguese virtual cat companion voice',
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Zephyr' },
              },
            },
          },
        })
      );

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        res.status(502).json({ error: 'Não foi possível gerar o áudio do Miau.' });
        return;
      }

      res.json({ audioBase64: base64Audio, mimeType: 'audio/wav' });
    } catch (error) {
      if (error instanceof MissingGeminiApiKeyError) {
        res.status(error.statusCode).json({ code: error.code, error: error.message });
        return;
      }
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Erro em /api/gemini/tts:', msg);
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/gemini/transcribe', async (req, res) => {
    try {
      const { audioBase64, mimeType = 'audio/webm' } = req.body ?? {};
      if (!audioBase64 || typeof audioBase64 !== 'string') {
        res.status(400).json({ error: 'Áudio inválido.' });
        return;
      }

      const ai = getAIClient();
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-3.5-transcribe',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: audioBase64,
                },
              },
              {
                text: 'Transcreva exatamente o que foi dito em português do Brasil. Retorne apenas a transcrição.',
              },
            ],
          },
        })
      );

      res.json({ transcript: (response.text ?? '').trim() });
    } catch (error) {
      if (error instanceof MissingGeminiApiKeyError) {
        res.status(error.statusCode).json({ code: error.code, error: error.message });
        return;
      }
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Erro em /api/gemini/transcribe:', msg);
      res.status(500).json({ error: msg });
    }
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;
    if (pathname === '/live') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', async (clientWs: WebSocket) => {
    let session: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null =
      null;
    try {
      const ai = getAIClient();
      session = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Zephyr' },
            },
          },
          systemInstruction:
            'Você é o Miau, um gatinho virtual fofo, alegre e carinhoso que fala em Português do Brasil. Responda sempre de forma leve, curta e amigável, começando às vezes com um "Miau!" simpático.',
        },
        callbacks: {
          onopen: () => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ status: 'connected' }));
            }
          },
          onmessage: (message: LiveServerMessage) => {
            if (clientWs.readyState !== WebSocket.OPEN) return;
            const content = message.serverContent;
            if (content?.inputTranscription?.text) {
              clientWs.send(
                JSON.stringify({
                  inputTranscript: content.inputTranscription.text,
                })
              );
            }
            if (content?.outputTranscription?.text) {
              clientWs.send(
                JSON.stringify({
                  outputTranscript: content.outputTranscription.text,
                })
              );
            }
            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                clientWs.send(
                  JSON.stringify({ audio: part.inlineData.data })
                );
              }
            }
            if (content?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
            if (content?.turnComplete) {
              clientWs.send(JSON.stringify({ turnComplete: true }));
            }
          },
          onerror: (err) => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  error: err?.message || 'Erro na conexão Gemini Live.',
                })
              );
            }
          },
          onclose: () => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ status: 'closed' }));
            }
          },
        },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ error: msg }));
        clientWs.close();
      }
      return;
    }

    clientWs.on('message', (raw) => {
      if (!session) return;
      try {
        const parsed = JSON.parse(raw.toString());
        if (parsed.audio) {
          session.sendRealtimeInput({
            audio: { data: parsed.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        } else if (parsed.text) {
          session.sendRealtimeInput({ text: parsed.text });
        }
      } catch (err) {
        console.error('Erro ao encaminhar mensagem WS para Gemini Live:', err);
      }
    });

    clientWs.on('close', () => {
      try {
        session?.close();
      } catch {
        // Ignore close errors
      }
      session = null;
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor Miau rodando em http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Falha ao iniciar servidor:', err);
  process.exit(1);
});
