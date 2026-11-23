import {
  getAIClient,
  getGeminiFallbackStatus,
  handleCorsAndMethod,
  probeSuperiorModelRecovery,
  sendGeminiRouteError,
  sendJson,
  type VercelRequest,
  type VercelResponse,
} from './_shared.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (!handleCorsAndMethod(req, res, 'GET')) {
    return;
  }

  try {
    const shouldProbe = (req.url || '').includes('probe=1');
    if (shouldProbe) {
      const status = getGeminiFallbackStatus();
      const degraded = (['chat', 'tts', 'transcribe'] as const).filter(
        (cap) => status[cap].fallbackActive
      );
      if (degraded.length > 0) {
        const ai = getAIClient();
        await Promise.allSettled(
          degraded.map((cap) => probeSuperiorModelRecovery(ai, cap))
        );
      }
    }

    sendJson(res, 200, getGeminiFallbackStatus());
  } catch (error) {
    sendGeminiRouteError(res, '/api/gemini/status', error);
  }
}
