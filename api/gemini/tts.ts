import {
  getAIClient,
  handleCorsAndMethod,
  readJsonBody,
  sendGeminiRouteError,
  sendJson,
  withRetry,
  type VercelRequest,
  type VercelResponse,
} from './_shared.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (!handleCorsAndMethod(req, res, 'POST')) {
    return;
  }

  try {
    const body = await readJsonBody(req);
    const text = body.text;
    if (!text || typeof text !== 'string') {
      sendJson(res, 400, { error: 'Texto inválido para síntese de voz.' });
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
      sendJson(res, 502, {
        error: 'Não foi possível gerar o áudio do Miau.',
      });
      return;
    }

    sendJson(res, 200, { audioBase64: base64Audio, mimeType: 'audio/wav' });
  } catch (error) {
    sendGeminiRouteError(res, '/api/gemini/tts', error);
  }
}
