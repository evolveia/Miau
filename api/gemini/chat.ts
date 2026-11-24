import { Type } from '@google/genai';
import {
  MINOR_REFUSAL_TEXT,
  buildMinorSafetyInstruction,
  getAIClient,
  getMinorStrictSafetySettings,
  getRecommendedThinkingLevel,
  handleCorsAndMethod,
  isMinorAge,
  isUnsafeTopicForMinor,
  parseGeminiJsonSafely,
  readJsonBody,
  runWithModelFallback,
  sendGeminiRouteError,
  sendJson,
  type VercelRequest,
  type VercelResponse,
} from './_shared.js';

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

  const minorRule = buildMinorSafetyInstruction(u?.age);
  if (minorRule) {
    lines.push(minorRule);
  }

  lines.push(
    `Responda sempre de forma direta, atenciosa e acolhedora ao que o tutor perguntou ou compartilhou, sem fugir do assunto e sem ser repetitivo. Demonstre interesse genuíno pelo bem-estar do tutor e NUNCA fique insistindo para jogar bolinha se o assunto for outro. Se alguma métrica do pet estiver < 30%, mencione com muita suavidade apenas se couber naturalmente no assunto.`,
    `Retorne JSON: "meowPrefix" (ex: "Miau!", "Purrr~"), "text" (fala entre parênteses, ex: "(Oi! Como você está se sentindo hoje?)") e "mood" (happy|playful|hungry|sleepy|affectionate).`
  );

  return lines.join('\n');
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (!handleCorsAndMethod(req, res, 'POST')) {
    return;
  }

  try {
    const body = await readJsonBody(req);
    const message = body.message;
    const history = Array.isArray(body.history) ? body.history : [];
    const stats = body.stats as
      | {
          hunger: number;
          hygiene: number;
          fun: number;
          sleep: number;
          happiness?: number;
        }
      | undefined;
    const equipped = body.equipped as
      | { hat?: string; accessory?: string; background?: string }
      | undefined;
    const petName = typeof body.petName === 'string' ? body.petName : undefined;
    const temporalContext =
      body.temporalContext && typeof body.temporalContext === 'object'
        ? (body.temporalContext as ChatTemporalInput)
        : undefined;
    const userContext =
      body.userContext && typeof body.userContext === 'object'
        ? (body.userContext as ChatUserInput)
        : undefined;

    if (!message || typeof message !== 'string') {
      sendJson(res, 400, { error: 'Mensagem inválida.' });
      return;
    }

    const isMinor = isMinorAge(userContext?.age);
    if (isMinor && isUnsafeTopicForMinor(message)) {
      sendJson(res, 200, {
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
        .map((item: { sender?: string; text?: string }) => ({
          role: item.sender === 'user' ? 'user' : 'model',
          parts: [{ text: String(item.text || '') }],
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
            }),
            ...(isMinor ? { safetySettings: getMinorStrictSafetySettings() } : {}),
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
      sendJson(res, 200, {
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
        sendJson(res, 200, {
          meowPrefix: 'Miau!',
          text: MINOR_REFUSAL_TEXT,
          mood: 'happy',
          modelUsed,
          fallbackActive,
          safetyFiltered: true,
        });
        return;
      }
      sendJson(res, 502, { error: 'Gemini não retornou resposta.' });
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
      sendJson(res, 200, {
        meowPrefix: 'Miau!',
        text: MINOR_REFUSAL_TEXT,
        mood: 'happy',
        modelUsed,
        fallbackActive,
        safetyFiltered: true,
      });
      return;
    }
    sendJson(res, 200, {
      meowPrefix: parsed?.meowPrefix || 'Miau!',
      text: replyText,
      mood: parsed?.mood || 'happy',
      modelUsed,
      fallbackActive,
    });
  } catch (error) {
    sendGeminiRouteError(res, '/api/gemini/chat', error);
  }
}
