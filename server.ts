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
  Type,
} from '@google/genai';
import {
  MINOR_REFUSAL_TEXT,
  MissingGeminiApiKeyError,
  buildCalibratedTranscriptionPrompt,
  buildMinorSafetyInstruction,
  getAIClient,
  getCachedTtsWav,
  getGeminiFallbackStatus,
  getMinorStrictSafetySettings,
  getRecommendedThinkingLevel,
  isCapabilityTemporarilyExhausted,
  isQuotaOrRecoverableModelError,
  isUnsafeTopicForMinor,
  markCapabilityDegraded,
  normalizeAudioMimeType,
  parseGeminiJsonSafely,
  probeSuperiorModelRecovery,
  runWithModelFallback,
  sendGeminiRouteError,
  setCachedTtsWav,
  shouldApplyMinorSafety,
  startSuperiorModelRecoveryMonitor,
} from './api/gemini/_shared.ts';
import {
  getVapidPublicKey,
  removePushSubscription,
  sendTestPush,
  startPushMonitor,
  syncPushSubscriptionState,
  upsertPushSubscription,
} from './api/push/pushManager.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const IS_PROD = process.env.NODE_ENV === 'production';

function parseCliArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  for (let i = 2; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (arg.startsWith(prefix)) return arg.slice(prefix.length).trim();
    if (arg === `--${name}` && i + 1 < process.argv.length) {
      return process.argv[i + 1].trim();
    }
  }
  return undefined;
}

function resolveServerPort(): number {
  const cliPort = Number(parseCliArg('port'));
  if (Number.isInteger(cliPort) && cliPort > 0 && cliPort <= 65535) {
    return cliPort;
  }
  const envPortRaw = process.env.PORT?.trim();
  const envPort = Number(envPortRaw);
  // In dev containers, PORT=8080 is often used by the reverse proxy (nginx -> 3000).
  if (!IS_PROD && envPort === 8080) {
    return 3000;
  }
  if (Number.isInteger(envPort) && envPort > 0 && envPort <= 65535) {
    return envPort;
  }
  return 3000;
}

const PORT = resolveServerPort();
const HOST = parseCliArg('host') || process.env.HOST || '0.0.0.0';

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
  strictFilter?: boolean;
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

  const minorRule = buildMinorSafetyInstruction(u?.age, context?.strictFilter);
  if (minorRule) {
    lines.push(minorRule);
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
  startSuperiorModelRecoveryMonitor(getAIClient);
  startPushMonitor();

  app.get('/api/gemini/status', async (req, res) => {
    if (req.query?.probe === '1') {
      try {
        const status = getGeminiFallbackStatus();
        const degraded = (['chat', 'tts', 'transcribe'] as const).filter(
          (cap) => status[cap].fallbackActive || status[cap].textOnlyFallback
        );
        if (degraded.length > 0) {
          const ai = getAIClient();
          await Promise.allSettled(
            degraded.map((cap) => probeSuperiorModelRecovery(ai, cap))
          );
        }
      } catch {
        // Ignore probe failures and still return current status
      }
    }
    res.json(getGeminiFallbackStatus());
  });

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
        strictFilter: rawStrictFilter,
      } = req.body ?? {};
      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Mensagem inválida.' });
        return;
      }

      const strictFilter = Boolean(rawStrictFilter);
      const isMinor = shouldApplyMinorSafety(userContext?.age, strictFilter);
      if (isMinor && isUnsafeTopicForMinor(message)) {
        res.json({
          meowPrefix: 'Miau!',
          text: MINOR_REFUSAL_TEXT,
          mood: 'happy',
          safetyFiltered: true,
        });
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

      const { result: response, modelUsed, fallbackActive } =
        await runWithModelFallback('chat', (model) =>
          ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction: buildMiauSystemInstruction({
                petName,
                stats,
                equipped,
                temporalContext,
                userContext,
                strictFilter,
              }),
              ...(isMinor
                ? { safetySettings: getMinorStrictSafetySettings() }
                : {}),
              thinkingConfig: {
                thinkingLevel: getRecommendedThinkingLevel(model),
              },
              maxOutputTokens: 480,
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

      const finishReason = String(response.candidates?.[0]?.finishReason || '');
      if (
        isMinor &&
        (finishReason === 'SAFETY' ||
          finishReason === 'PROHIBITED_CONTENT' ||
          finishReason === 'BLOCKLIST')
      ) {
        res.json({
          meowPrefix: 'Miau!',
          text: MINOR_REFUSAL_TEXT,
          mood: 'happy',
          modelUsed,
          fallbackActive,
          safetyFiltered: true,
        });
        return;
      }

      const raw = response.text?.trim();
      if (!raw) {
        if (isMinor) {
          res.json({
            meowPrefix: 'Miau!',
            text: MINOR_REFUSAL_TEXT,
            mood: 'happy',
            modelUsed,
            fallbackActive,
            safetyFiltered: true,
          });
          return;
        }
        res.status(502).json({ error: 'Gemini não retornou resposta.' });
        return;
      }

      const parsed = parseGeminiJsonSafely<{
        meowPrefix?: string;
        text?: string;
        mood?: string;
      }>(raw);
      const cleanedFallback = raw.replace(/[{}"`]/g, '').trim();
      const replyText =
        parsed?.text ||
        (cleanedFallback ? `(${cleanedFallback.slice(0, 240)})` : '(Oi, humano!)');
      if (isMinor && isUnsafeTopicForMinor(replyText)) {
        res.json({
          meowPrefix: 'Miau!',
          text: MINOR_REFUSAL_TEXT,
          mood: 'happy',
          modelUsed,
          fallbackActive,
          safetyFiltered: true,
        });
        return;
      }
      res.json({
        meowPrefix: parsed?.meowPrefix || 'Miau!',
        text: replyText,
        mood: parsed?.mood || 'happy',
        modelUsed,
        fallbackActive,
      });
    } catch (error) {
      sendGeminiRouteError(res, '/api/gemini/chat', error);
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
      const cached = getCachedTtsWav(cleanText);
      if (cached) {
        res.json({
          audioBase64: cached.audioBase64,
          mimeType: cached.mimeType,
          modelUsed: cached.modelUsed,
          cached: true,
          textOnlyFallback: false,
        });
        return;
      }

      const ai = getAIClient();

      if (isCapabilityTemporarilyExhausted('tts')) {
        res.json({
          audioBase64: null,
          mimeType: null,
          textOnlyFallback: true,
          fallbackActive: true,
          reason: 'TOKENS_TTS_TEMPORARILY_EXHAUSTED',
        });
        return;
      }

      try {
        const { result: response, modelUsed, fallbackActive } =
          await runWithModelFallback('tts', (model) =>
            ai.models.generateContent({
              model,
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
          res.json({
            audioBase64: null,
            mimeType: null,
            textOnlyFallback: true,
            fallbackActive: true,
            reason: 'EMPTY_AUDIO_FALLBACK_TEXT',
          });
          return;
        }

        setCachedTtsWav(cleanText, {
          audioBase64: base64Audio,
          mimeType: 'audio/wav',
          modelUsed,
        });

        res.json({
          audioBase64: base64Audio,
          mimeType: 'audio/wav',
          modelUsed,
          fallbackActive,
          textOnlyFallback: false,
        });
      } catch (ttsErr) {
        if (isQuotaOrRecoverableModelError(ttsErr)) {
          res.json({
            audioBase64: null,
            mimeType: null,
            textOnlyFallback: true,
            fallbackActive: true,
            reason: 'TTS_EXHAUSTED_TEXT_ONLY',
          });
          return;
        }
        throw ttsErr;
      }
    } catch (error) {
      sendGeminiRouteError(res, '/api/gemini/tts', error);
    }
  });

  app.post('/api/gemini/transcribe', async (req, res) => {
    try {
      const {
        audioBase64: rawAudio,
        mimeType: rawMime = 'audio/webm',
        mode = 'conversation',
        expectedPhrase = '',
        hintKeywords,
        userAge: rawUserAge,
        strictFilter: rawStrictFilter,
      } = req.body ?? {};
      if (!rawAudio || typeof rawAudio !== 'string') {
        res.status(400).json({ error: 'Áudio inválido.' });
        return;
      }

      const userAge =
        typeof rawUserAge === 'number' && Number.isFinite(rawUserAge)
          ? rawUserAge
          : null;
      const mimeType = normalizeAudioMimeType(
        typeof rawMime === 'string' ? rawMime : 'audio/webm'
      );
      const audioBase64 = rawAudio.includes(',')
        ? rawAudio.split(',').slice(1).join(',')
        : rawAudio;
      const resolvedMode = typeof mode === 'string' ? mode : 'conversation';
      const promptText = buildCalibratedTranscriptionPrompt({
        mode: resolvedMode,
        expectedPhrase: typeof expectedPhrase === 'string' ? expectedPhrase : '',
        hintKeywords,
      });

      const ai = getAIClient();
      const { result: response, modelUsed, fallbackActive } =
        await runWithModelFallback('transcribe', (model) =>
          ai.models.generateContent({
            model,
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: audioBase64,
                  },
                },
                {
                  text: promptText,
                },
              ],
            },
            ...(model !== 'gemini-3.5-transcribe'
              ? {
                  config: {
                    thinkingConfig: {
                      thinkingLevel: getRecommendedThinkingLevel(model),
                    },
                    maxOutputTokens: 160,
                  },
                }
              : {}),
          })
        );

      const cleanedTranscript = (response.text ?? '')
        .trim()
        .replace(/^["'«»]+|["'«»]+$/g, '')
        .trim();

      const safetyBlocked =
        resolvedMode === 'conversation' &&
        shouldApplyMinorSafety(userAge, Boolean(rawStrictFilter)) &&
        isUnsafeTopicForMinor(cleanedTranscript);

      res.json({
        transcript: cleanedTranscript,
        modelUsed,
        fallbackActive,
        ...(safetyBlocked
          ? { safetyBlocked: true, safeReply: MINOR_REFUSAL_TEXT }
          : {}),
      });
    } catch (error) {
      sendGeminiRouteError(res, '/api/gemini/transcribe', error);
    }
  });

  app.post('/api/gemini/writing-coach', async (req, res) => {
    try {
      const body = (req.body ?? {}) as {
        mode?: 'teach' | 'evaluate';
        targetText?: string;
        studentName?: string;
        motorLevel?: 'largo' | 'medio' | 'fino';
        strokeHints?: string[];
        imageBase64?: string;
        mimeType?: string;
        coveragePct?: number;
        precisionPct?: number;
        strokeCount?: number;
      };
      const mode = body.mode === 'evaluate' ? 'evaluate' : 'teach';
      const targetText = String(body.targetText || 'A')
        .trim()
        .toUpperCase()
        .slice(0, 16);
      const studentName = String(body.studentName || 'pequeno(a)')
        .trim()
        .slice(0, 40);
      const motorLevel = body.motorLevel || 'largo';
      const strokeHints = Array.isArray(body.strokeHints)
        ? body.strokeHints.map((s) => String(s).slice(0, 140)).slice(0, 8)
        : [];

      const ai = getAIClient();

      if (mode === 'teach') {
        const motorLabel =
          motorLevel === 'fino'
            ? 'traço fino para treinar bastante firmeza nos dedinhos'
            : motorLevel === 'medio'
              ? 'traço médio com atenção nas curvas e linhas'
              : 'traço largo e bem fácil para soltar o dedinho';

        const prompt = [
          `Você é o Miau, um gatinho professor muito carinhoso e divertido de Educação Infantil no Brasil.`,
          `Ensine para a criança "${studentName}" como escrever "${targetText}" cobrindo com o dedinho na tela do celular (${motorLabel}).`,
          strokeHints.length > 0
            ? `Ordem real dos traços no exercício: ${strokeHints.join(' | ')}`
            : '',
          `Fale em Português do Brasil de forma lúdica, curtinha, acolhedora e muito clara para uma criança de 3 a 6 anos.`,
          `Retorne JSON com:`,
          `- coachTip: explicação amigável passo a passo para ler na tela (máximo 2 frases curtas).`,
          `- audioScript: texto fofo e calmo para o Miau falar em voz alta guiando o movimento do dedinho (sem emojis, máximo 220 caracteres).`,
        ]
          .filter(Boolean)
          .join('\n');

        const { result: response, modelUsed, fallbackActive } =
          await runWithModelFallback('chat', (model) =>
            ai.models.generateContent({
              model,
              contents: prompt,
              config: {
                thinkingConfig: {
                  thinkingLevel: getRecommendedThinkingLevel(model),
                },
                maxOutputTokens: 200,
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.OBJECT,
                  required: ['coachTip', 'audioScript'],
                  properties: {
                    coachTip: { type: Type.STRING },
                    audioScript: { type: Type.STRING },
                  },
                },
              },
            })
          );

        const raw = response.text?.trim();
        const parsed = (raw ? parseGeminiJsonSafely<Record<string, string>>(raw) : null) ?? {};
        res.json({
          coachTip:
            parsed.coachTip ||
            `Vamos cobrir "${targetText}" seguindo os pontinhos a partir do número 1!`,
          audioScript:
            parsed.audioScript ||
            `Miau! Vamos escrever ${targetText} juntos. Comece pelo número um e passe o dedinho devagar pelos pontinhos.`,
          modelUsed,
          fallbackActive,
        });
        return;
      }

      const coveragePct = Math.max(0, Math.min(100, Math.round(Number(body.coveragePct ?? 0))));
      const precisionPct = Math.max(0, Math.min(100, Math.round(Number(body.precisionPct ?? 0))));
      const strokeCount = Math.max(0, Math.min(50, Math.round(Number(body.strokeCount ?? 0))));
      const rawImage = typeof body.imageBase64 === 'string' ? body.imageBase64 : '';
      const strippedImage = rawImage.replace(/^data:[^;]+;base64,/i, '').trim();
      const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'image/png';

      const evalPrompt = [
        `Você é o Miau, professor gatinho carinhoso de coordenação motora fina e escrita infantil.`,
        `A criança "${studentName}" acabou de tentar cobrir com o dedo a escrita de "${targetText}".`,
        `Métricas geométricas do traçado sobre o guia: cobertura=${coveragePct}%, precisão dentro do caminho=${precisionPct}%, quantidade de traços=${strokeCount}.`,
        `Observe a imagem do traçado (onde o pontilhado claro é o guia e a linha roxa/rosa é o dedo da criança) junto com as métricas.`,
        `Classifique em:`,
        `- "positive" (3 ou 2 estrelas) se cobriu bem a forma da letra/palavra.`,
        `- "medium" (1 estrela) se já dá para reconhecer parte do traço, mas faltou cobrir um pedaço ou saiu um pouco da linha.`,
        `- "retry" (0 estrelas) se ainda quase não cobriu ou riscou fora da letra/palavra.`,
        `Responda em Português do Brasil, sempre carinhoso, construtivo e específico no que melhorar (ou comemorar!).`,
        `Retorne JSON com: verdict ("positive" | "medium" | "retry"), stars (0..3 inteiro), feedbackText (para mostrar na tela, até 2 frases curtas), audioScript (para o Miau falar com voz fofa, sem emojis, até 190 caracteres).`,
      ].join('\n');

      const parts: Array<
        | { text: string }
        | { inlineData: { mimeType: string; data: string } }
      > = [{ text: evalPrompt }];

      if (strippedImage.length > 32 && strippedImage.length < 2_500_000) {
        parts.unshift({
          inlineData: {
            mimeType,
            data: strippedImage,
          },
        });
      }

      const { result: response, modelUsed, fallbackActive } =
        await runWithModelFallback('chat', (model) =>
          ai.models.generateContent({
            model,
            contents: [{ role: 'user', parts }],
            config: {
              thinkingConfig: {
                thinkingLevel: getRecommendedThinkingLevel(model),
              },
              maxOutputTokens: 480,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                required: ['verdict', 'stars', 'feedbackText', 'audioScript'],
                properties: {
                  verdict: { type: Type.STRING },
                  stars: { type: Type.INTEGER },
                  feedbackText: { type: Type.STRING },
                  audioScript: { type: Type.STRING },
                },
              },
            },
          })
        );

      const raw = response.text?.trim();
      const parsed =
        (raw
          ? parseGeminiJsonSafely<{
              verdict?: string;
              stars?: number;
              feedbackText?: string;
              audioScript?: string;
            }>(raw)
          : null) ?? {};

      const verdict =
        parsed.verdict === 'positive' ||
        parsed.verdict === 'medium' ||
        parsed.verdict === 'retry'
          ? parsed.verdict
          : coveragePct >= 62 && precisionPct >= 52
            ? 'positive'
            : coveragePct >= 35
              ? 'medium'
              : 'retry';
      const stars = Math.max(
        0,
        Math.min(
          3,
          Math.round(
            typeof parsed.stars === 'number'
              ? parsed.stars
              : verdict === 'positive'
                ? coveragePct >= 82
                  ? 3
                  : 2
                : verdict === 'medium'
                  ? 1
                  : 0
          )
        )
      );

      res.json({
        verdict,
        stars,
        feedbackText:
          parsed.feedbackText ||
          `Você cobriu ${coveragePct}% de "${targetText}" com ${precisionPct}% de precisão!`,
        audioScript:
          parsed.audioScript ||
          `Miau! Muito bem, continue praticando o dedinho na letra ${targetText}!`,
        modelUsed,
        fallbackActive,
      });
    } catch (error) {
      sendGeminiRouteError(res, '/api/gemini/writing-coach', error);
    }
  });

  app.get('/api/push/vapid-public-key', (_req, res) => {
    try {
      res.json({ publicKey: getVapidPublicKey(), supported: true });
    } catch (error) {
      res.status(500).json({
        supported: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/push/subscribe', (req, res) => {
    const { subscription, ownerId, petName, prefs, stats, appVisible } =
      req.body ?? {};
    if (!subscription || typeof subscription.endpoint !== 'string') {
      res.status(400).json({ error: 'Inscrição push inválida.' });
      return;
    }
    const accepted = upsertPushSubscription({
      subscription,
      ownerId,
      petName,
      prefs,
      stats,
      appVisible,
    });
    if (!accepted) {
      res.status(400).json({ error: 'Endpoint de notificação push inválido.' });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/push/sync', (req, res) => {
    const { endpoint, petName, prefs, stats, appVisible, notifiedNeed } =
      req.body ?? {};
    if (!endpoint || typeof endpoint !== 'string') {
      res.status(400).json({ error: 'Endpoint obrigatório.' });
      return;
    }
    const found = syncPushSubscriptionState({
      endpoint,
      petName,
      prefs,
      stats,
      appVisible,
      notifiedNeed,
    });
    res.json({ ok: true, found });
  });

  app.post('/api/push/test', async (req, res) => {
    const { endpoint, petName } = req.body ?? {};
    if (!endpoint || typeof endpoint !== 'string') {
      res.status(400).json({ sent: false, reason: 'Endpoint ausente.' });
      return;
    }
    const result = await sendTestPush(endpoint, petName);
    res.json(result);
  });

  app.post('/api/push/unsubscribe', (req, res) => {
    const { endpoint } = req.body ?? {};
    if (endpoint && typeof endpoint === 'string') {
      removePushSubscription(endpoint);
    }
    res.json({ ok: true });
  });

  if (!IS_PROD) {
    const vitePromise = import('vite').then(({ createServer: createViteServer }) =>
      createViteServer({
        server: {
          middlewareMode: true,
          allowedHosts: true,
          hmr: false,
          ws: false,
        },
        appType: 'spa',
      })
    );
    vitePromise.catch((err) => {
      console.error('Erro ao inicializar Vite dev middleware:', err);
    });
    app.use((req, res, next) => {
      vitePromise
        .then((vite) => vite.middlewares(req, res, next))
        .catch(next);
    });
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

  wss.on('connection', async (clientWs: WebSocket, req: http.IncomingMessage) => {
    let session: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null =
      null;
    const reqUrl = new URL(req.url || '/live', 'http://localhost');
    const ageParam = reqUrl.searchParams.get('age');
    const parsedAge =
      ageParam !== null && ageParam !== '' && Number.isFinite(Number(ageParam))
        ? Number(ageParam)
        : null;
    const strictFilterLive = reqUrl.searchParams.get('strictFilter') === '1';
    const isMinorLive = shouldApplyMinorSafety(parsedAge, strictFilterLive);
    const liveSystemInstruction = [
      'Você é o Miau, um gatinho virtual e melhor amigo próximo do tutor, que fala em Português do Brasil. Demonstre interesse genuíno em saber como o tutor está se sentindo, pergunte sobre o dia dele com carinho e responda de forma leve, acolhedora e natural, começando às vezes com um "Miau!" ou "Purrr~" simpático.',
      buildMinorSafetyInstruction(parsedAge, strictFilterLive),
    ]
      .filter(Boolean)
      .join('\n');

    let minorTurnBlocked = false;

    try {
      const ai = getAIClient();
      const { result: connectedSession } = await runWithModelFallback(
        'live',
        (liveModel) =>
          ai.live.connect({
            model: liveModel,
            config: {
              responseModalities: [Modality.AUDIO],
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Zephyr' },
                },
              },
              systemInstruction: liveSystemInstruction,
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
                  const inText = content.inputTranscription.text;
                  if (isMinorLive && isUnsafeTopicForMinor(inText)) {
                    minorTurnBlocked = true;
                    clientWs.send(JSON.stringify({ interrupted: true }));
                    clientWs.send(
                      JSON.stringify({
                        outputTranscript: MINOR_REFUSAL_TEXT,
                        safetyFiltered: true,
                      })
                    );
                  } else {
                    clientWs.send(
                      JSON.stringify({
                        inputTranscript: inText,
                      })
                    );
                  }
                }
                if (content?.outputTranscription?.text) {
                  const outText = content.outputTranscription.text;
                  if (isMinorLive && (minorTurnBlocked || isUnsafeTopicForMinor(outText))) {
                    if (!minorTurnBlocked) {
                      minorTurnBlocked = true;
                      clientWs.send(JSON.stringify({ interrupted: true }));
                      clientWs.send(
                        JSON.stringify({
                          outputTranscript: MINOR_REFUSAL_TEXT,
                          safetyFiltered: true,
                        })
                      );
                    }
                  } else {
                    clientWs.send(
                      JSON.stringify({
                        outputTranscript: outText,
                      })
                    );
                  }
                }
                for (const part of content?.modelTurn?.parts ?? []) {
                  if (part.inlineData?.data && !minorTurnBlocked) {
                    clientWs.send(
                      JSON.stringify({ audio: part.inlineData.data })
                    );
                  }
                }
                if (content?.interrupted) {
                  clientWs.send(JSON.stringify({ interrupted: true }));
                }
                if (content?.turnComplete) {
                  minorTurnBlocked = false;
                  clientWs.send(JSON.stringify({ turnComplete: true }));
                }
              },
              onerror: (err) => {
                const rawErr = err?.message || 'Erro na conexão Gemini Live.';
                if (isQuotaOrRecoverableModelError(rawErr)) {
                  markCapabilityDegraded('live', rawErr, true);
                }
                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(
                    JSON.stringify({
                      error:
                        'A voz ao vivo está com alta demanda no momento. Você pode continuar conversando por texto ou 🎤!',
                      fallbackToTextChat: true,
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
          })
      );
      session = connectedSession;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (isQuotaOrRecoverableModelError(error)) {
        markCapabilityDegraded('live', msg, true);
      }
      if (clientWs.readyState === WebSocket.OPEN) {
        const friendlyMsg =
          error instanceof MissingGeminiApiKeyError
            ? error.message
            : 'Voz ao vivo temporariamente ocupada. Continue a conversa por texto ou áudio gravado (🎤)!';
        clientWs.send(
          JSON.stringify({ error: friendlyMsg, fallbackToTextChat: true })
        );
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

  server.on('error', (err) => {
    console.error(`Erro no servidor HTTP (${HOST}:${PORT}):`, err);
    process.exit(1);
  });

  server.listen(PORT, HOST, () => {
    console.log(`Servidor Miau rodando em http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Falha ao iniciar servidor:', err);
  process.exit(1);
});
