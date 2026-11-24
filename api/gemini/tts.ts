import {
  getAIClient,
  getCachedTtsWav,
  handleCorsAndMethod,
  isCapabilityTemporarilyExhausted,
  isQuotaOrRecoverableModelError,
  readJsonBody,
  runWithModelFallback,
  sendGeminiRouteError,
  sendJson,
  setCachedTtsWav,
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
    const cached = getCachedTtsWav(cleanText);
    if (cached) {
      sendJson(res, 200, {
        audioBase64: cached.audioBase64,
        mimeType: cached.mimeType,
        modelUsed: cached.modelUsed,
        cached: true,
      });
      return;
    }

    // Validate API key upfront so missing-key is never masked
    const ai = getAIClient();

    if (isCapabilityTemporarilyExhausted('tts')) {
      sendJson(res, 200, {
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
        sendJson(res, 200, {
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

      sendJson(res, 200, {
        audioBase64: base64Audio,
        mimeType: 'audio/wav',
        modelUsed,
        fallbackActive,
        textOnlyFallback: false,
      });
    } catch (ttsErr) {
      if (isQuotaOrRecoverableModelError(ttsErr)) {
        sendJson(res, 200, {
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
}
