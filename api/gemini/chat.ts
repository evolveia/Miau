import { ThinkingLevel, Type } from '@google/genai';
import {
  getAIClient,
  readJsonBody,
  sendJson,
  withRetry,
  type VercelRequest,
  type VercelResponse,
} from './_shared.js';

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

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Método não permitido.' });
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

    if (!message || typeof message !== 'string') {
      sendJson(res, 400, { error: 'Mensagem inválida.' });
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
      sendJson(res, 502, { error: 'Gemini não retornou resposta.' });
      return;
    }

    const parsed = JSON.parse(raw) as {
      meowPrefix?: string;
      text?: string;
      mood?: string;
    };
    sendJson(res, 200, {
      meowPrefix: parsed.meowPrefix || 'Miau!',
      text: parsed.text || '(Oi, humano!)',
      mood: parsed.mood || 'happy',
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Erro em /api/gemini/chat:', msg);
    sendJson(res, 500, { error: msg });
  }
}
