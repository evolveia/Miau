import {
  MINOR_REFUSAL_TEXT,
  buildCalibratedTranscriptionPrompt,
  getAIClient,
  getRecommendedThinkingLevel,
  handleCorsAndMethod,
  isUnsafeTopicForMinor,
  normalizeAudioMimeType,
  readJsonBody,
  runWithModelFallback,
  sendGeminiRouteError,
  sendJson,
  shouldApplyMinorSafety,
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
    const rawAudio = body.audioBase64;
    const mimeType = normalizeAudioMimeType(
      typeof body.mimeType === 'string' ? body.mimeType : 'audio/webm'
    );
    const mode = typeof body.mode === 'string' ? body.mode : 'conversation';
    const expectedPhrase =
      typeof body.expectedPhrase === 'string' ? body.expectedPhrase : '';
    const hintKeywords = body.hintKeywords;
    const rawUserAge = body.userAge;
    const userAge =
      typeof rawUserAge === 'number' && Number.isFinite(rawUserAge)
        ? rawUserAge
        : null;
    const strictFilter = Boolean(body.strictFilter);

    if (!rawAudio || typeof rawAudio !== 'string') {
      sendJson(res, 400, { error: 'Áudio inválido.' });
      return;
    }

    const audioBase64 = rawAudio.includes(',')
      ? rawAudio.split(',').slice(1).join(',')
      : rawAudio;

    const promptText = buildCalibratedTranscriptionPrompt({
      mode,
      expectedPhrase,
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
      mode === 'conversation' &&
      shouldApplyMinorSafety(userAge, strictFilter) &&
      isUnsafeTopicForMinor(cleanedTranscript);

    sendJson(res, 200, {
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
}
