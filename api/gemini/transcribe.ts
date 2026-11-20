import {
  getAIClient,
  readJsonBody,
  sendJson,
  withRetry,
  type VercelRequest,
  type VercelResponse,
} from './_shared.js';

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
    const audioBase64 = body.audioBase64;
    const mimeType =
      typeof body.mimeType === 'string' ? body.mimeType : 'audio/webm';
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      sendJson(res, 400, { error: 'Áudio inválido.' });
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

    sendJson(res, 200, { transcript: (response.text ?? '').trim() });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Erro em /api/gemini/transcribe:', msg);
    sendJson(res, 500, { error: msg });
  }
}
