import fs from 'node:fs';
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

interface ChatTemporalInput {
  weekdayName?: string;
  isWeekend?: boolean;
  periodOfDay?: string;
  timeStr?: string;
}

interface ChatUserInput {
  firstName?: string;
  age?: number | null;
  schooling?: string;
  schoolingLabel?: string;
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
  temporalContext?: ChatTemporalInput;
  userContext?: ChatUserInput;
}): string {
  const name = context?.petName || 'Miau';
  const stats = context?.stats ?? {
    hunger: 60,
    hygiene: 90,
    fun: 50,
    sleep: 70,
    happiness: 75,
  };
  const lines = [
    `Você é ${name}, um gatinho virtual calico e melhor amigo carinhoso, empático, atencioso e bom ouvinte.`,
    `Fale sempre em Português do Brasil em 1 a 3 frases curtas, naturais e acolhedoras, como um amigo verdadeiro que quer saber como o tutor está se sentindo, como foi o dia dele e o que ele está vivendo.`,
    `Estado do pet: Fome ${Math.round(stats.hunger)}%, Higiene ${Math.round(stats.hygiene)}%, Diversão ${Math.round(stats.fun)}%, Sono ${Math.round(stats.sleep)}%, Felicidade ${Math.round(stats.happiness ?? 75)}%.`,
    `Visual: chapéu=${context?.equipped?.hat || 'nenhum'}, acessório=${context?.equipped?.accessory || 'nenhum'}.`,
  ];

  const t = context?.temporalContext;
  if (t?.weekdayName || t?.periodOfDay) {
    lines.push(
      `Contexto de momento: hoje é ${t.weekdayName || 'hoje'}${t.isWeekend ? ' (fim de semana)' : ''}, período: ${t.periodOfDay || 'dia'}${t.timeStr ? ` (${t.timeStr})` : ''}.`
    );
  }

  const u = context?.userContext;
  if (u && (u.firstName || u.age !== null || u.schoolingLabel)) {
    const parts: string[] = [];
    if (u.firstName) parts.push(`nome ${String(u.firstName).slice(0, 40)}`);
    if (typeof u.age === 'number' && u.age >= 0 && u.age <= 120) {
      parts.push(`${u.age} anos`);
    }
    if (u.schoolingLabel) {
      parts.push(`escolaridade: ${String(u.schoolingLabel).slice(0, 60)}`);
    }
    if (parts.length > 0) {
      lines.push(
        `Tutor(a): ${parts.join(', ')}. Adapte o tom com carinho para essa idade/fase (ex.: perguntar como estão os estudos em dia de aula, ou desejar bom descanso/lazer no fim de semana).`
      );
    }
  }

  lines.push(
    `Responda sempre de forma direta, atenciosa e acolhedora ao que o tutor perguntou ou compartilhou, sem fugir do assunto e sem ser repetitivo. Demonstre interesse genuíno pelo bem-estar do tutor e NUNCA fique insistindo para jogar bolinha se o assunto for outro. Se alguma métrica do pet estiver < 30%, mencione com muita suavidade apenas se couber naturalmente no assunto.`,
    `Retorne JSON: "meowPrefix" (ex: "Miau!", "Purrr~"), "text" (fala entre parênteses, ex: "(Oi! Como você está se sentindo hoje?)") e "mood" (happy|playful|hungry|sleepy|affectionate).`
  );
  return lines.join('\n');
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  app.use(express.json({ limit: '15mb' }));

  app.post('/api/gemini/chat', async (req, res) => {
    try {
      const {
        message,
        history = [],
        stats,
        equipped,
        petName,
        temporalContext,
        userContext,
      } = req.body ?? {};
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
              temporalContext,
              userContext,
            }),
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            maxOutputTokens: 180,
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
    const distIndexPath = path.join(distPath, 'index.html');
    let cachedIndexHtml: string | null = null;

    app.use(express.static(distPath, { index: false }));
    app.get('/{*splat}', (req, res) => {
      if (!cachedIndexHtml) {
        cachedIndexHtml = fs.readFileSync(distIndexPath, 'utf-8');
      }
      const envOrigin = process.env.APP_URL?.trim().replace(/\/+$/, '');
      const rawHost = String(
        req.headers['x-forwarded-host'] || req.headers.host || ''
      )
        .split(',')[0]
        .trim();
      const rawProto = String(
        req.headers['x-forwarded-proto'] || req.protocol || 'https'
      )
        .split(',')[0]
        .trim();
      const safeHost = /^[a-zA-Z0-9.-]+(:\d+)?$/.test(rawHost) ? rawHost : '';
      const safeProto = rawProto === 'http' || rawProto === 'https' ? rawProto : 'https';
      const isLocalHost =
        !safeHost ||
        safeHost.startsWith('localhost') ||
        safeHost.startsWith('127.0.0.1') ||
        safeHost.startsWith('0.0.0.0');
      const resolvedOrigin =
        envOrigin || (!isLocalHost ? `${safeProto}://${safeHost}` : '');
      const html = resolvedOrigin
        ? cachedIndexHtml.replace(
            '</head>',
            `    <link rel="canonical" href="${resolvedOrigin}/" />\n    <meta property="og:url" content="${resolvedOrigin}/" />\n  </head>`
          )
        : cachedIndexHtml;
      res.type('html').send(html);
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
            'Você é o Miau, um gatinho virtual e melhor amigo próximo do tutor, que fala em Português do Brasil. Demonstre interesse genuíno em saber como o tutor está se sentindo, pergunte sobre o dia dele com carinho e responda de forma leve, acolhedora e natural, começando às vezes com um "Miau!" ou "Purrr~" simpático.',
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
