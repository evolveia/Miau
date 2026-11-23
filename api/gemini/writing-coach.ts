import { Type } from '@google/genai';
import {
  getAIClient,
  getRecommendedThinkingLevel,
  handleCorsAndMethod,
  readJsonBody,
  runWithModelFallback,
  sendGeminiRouteError,
  sendJson,
  type VercelRequest,
  type VercelResponse,
} from './_shared.js';

interface WritingCoachBody {
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
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (!handleCorsAndMethod(req, res, 'POST')) {
    return;
  }

  try {
    const body = (await readJsonBody(req)) as WritingCoachBody;
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
      const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      sendJson(res, 200, {
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

    // mode === 'evaluate'
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
            maxOutputTokens: 220,
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
    const parsed = raw
      ? (JSON.parse(raw) as {
          verdict?: string;
          stars?: number;
          feedbackText?: string;
          audioScript?: string;
        })
      : {};

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

    sendJson(res, 200, {
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
}
