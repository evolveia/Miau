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
    const rawAudio = body.audioBase64;
    const mimeType =
      typeof body.mimeType === 'string' ? body.mimeType : 'audio/webm';
    if (!rawAudio || typeof rawAudio !== 'string') {
      sendJson(res, 400, { error: 'Áudio inválido.' });
      return;
    }

    const audioBase64 = rawAudio.includes(',')
      ? rawAudio.split(',').slice(1).join(',')
      : rawAudio;

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

    sendJson(res, 200, { transcript: (response.text ?? '').trim() });
  } catch (error) {
    sendGeminiRouteError(res, '/api/gemini/transcribe', error);
  }
}
