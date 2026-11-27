import type {
  ChatMessage,
  ChatTemporalContext,
  ChatUserContext,
  EquippedItems,
  MiauMood,
  PetStats,
} from '../types';

export interface MiauChatResponse {
  meowPrefix: string;
  text: string;
  mood: MiauMood;
  modelUsed?: string;
  fallbackActive?: boolean;
}

export interface MiauVoiceResponse {
  audioBase64: string | null;
  mimeType: string | null;
  modelUsed?: string;
  fallbackActive?: boolean;
  textOnlyFallback?: boolean;
}

let pendingRecoveryProbeTimer: number | null = null;

export function scheduleSuperiorModelRecoveryCheck(fallbackActive?: boolean): void {
  if (!fallbackActive || typeof window === 'undefined') return;
  if (pendingRecoveryProbeTimer !== null) return;
  pendingRecoveryProbeTimer = window.setTimeout(() => {
    pendingRecoveryProbeTimer = null;
    void fetch('/api/gemini/status?probe=1').catch(() => {});
  }, 46_000);
}

export class GeminiApiError extends Error {
  public readonly code?: string;
  public readonly status: number;

  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.name = 'GeminiApiError';
    this.status = status;
    this.code = code;
  }
}

interface ParsedApiResult<T> {
  data: T | null;
  rawText: string;
  isJson: boolean;
}

async function parseJsonSafely<T>(res: Response): Promise<ParsedApiResult<T>> {
  const rawText = await res.text();
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { data: null, rawText, isJson: false };
  }
  const contentType = res.headers.get('content-type') || '';
  const looksLikeJson =
    contentType.includes('application/json') ||
    trimmed.startsWith('{') ||
    trimmed.startsWith('[');
  if (!looksLikeJson) {
    return { data: null, rawText, isJson: false };
  }
  try {
    return { data: JSON.parse(trimmed) as T, rawText, isJson: true };
  } catch {
    return { data: null, rawText, isJson: false };
  }
}

function sanitizeApiErrorMessage(rawMessage: string, status: number): string {
  const lower = rawMessage.toLowerCase();
  if (
    lower.includes('"code":503') ||
    lower.includes('"code": 503') ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    status === 503
  ) {
    return 'Os servidores de IA estão com alta demanda temporária agora. Tente novamente em alguns segundos!';
  }
  if (
    lower.includes('"code":429') ||
    lower.includes('"code": 429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    status === 429
  ) {
    return 'Limite temporário de requisições da IA atingido. Aguarde alguns instantes para o restabelecimento automático!';
  }
  return rawMessage;
}

function buildFriendlyHttpError(
  status: number,
  parsed: ParsedApiResult<{ error?: string; code?: string }>,
  fallbackMessage: string
): GeminiApiError {
  const apiError = parsed.data?.error?.trim();
  const code = parsed.data?.code;
  if (apiError) {
    return new GeminiApiError(
      sanitizeApiErrorMessage(apiError, status),
      status,
      code
    );
  }
  if (status === 502 || status === 503 || status === 504) {
    return new GeminiApiError(
      'O servidor de IA está momentaneamente sobrecarregado. Tente novamente em alguns segundos!',
      status,
      'MODEL_UNAVAILABLE'
    );
  }
  if (status === 404 || !parsed.isJson) {
    return new GeminiApiError(
      'Não foi possível conectar ao servidor de IA (/api/gemini). Verifique se o backend e a chave GEMINI_API_KEY estão ativos.',
      status,
      'ENDPOINT_UNAVAILABLE'
    );
  }
  return new GeminiApiError(`${fallbackMessage} (HTTP ${status})`, status, code);
}

async function fetchWithTransientRetry(
  url: string,
  init: RequestInit,
  retries = 1,
  timeoutMs = 11_000
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      window.clearTimeout(timer);
      const isRetryableHttp = res.status === 502 || res.status === 503 || res.status === 504;
      if (!isRetryableHttp || attempt === retries) {
        return res;
      }
      // Clone/check if MISSING_GEMINI_API_KEY so we don't pointlessly retry config errors
      try {
        const peek = await res.clone().json() as { code?: string };
        if (peek?.code === 'MISSING_GEMINI_API_KEY') {
          return res;
        }
      } catch {
        // Not JSON, proceed with retry
      }
    } catch (err) {
      window.clearTimeout(timer);
      lastErr = err;
      if (attempt === retries) throw err;
    }
    await new Promise((r) => setTimeout(r, 320 * (attempt + 1)));
  }
  throw lastErr;
}

export async function askMiau(params: {
  message: string;
  history: ChatMessage[];
  stats: PetStats;
  equipped: EquippedItems;
  petName: string;
  temporalContext?: ChatTemporalContext;
  userContext?: ChatUserContext;
  strictFilter?: boolean;
}): Promise<MiauChatResponse> {
  let res: Response;
  try {
    res = await fetchWithTransientRetry('/api/gemini/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: params.message,
        history: params.history.map((m) => ({
          sender: m.sender,
          text: `${m.meowPrefix} ${m.text}`.trim(),
        })),
        stats: params.stats,
        equipped: params.equipped,
        petName: params.petName,
        temporalContext: params.temporalContext,
        userContext: params.userContext,
        strictFilter: Boolean(params.strictFilter),
      }),
    });
  } catch {
    throw new GeminiApiError(
      'Sem conexão com o servidor de IA no momento. Tente novamente em instantes!',
      0,
      'NETWORK_ERROR'
    );
  }

  const parsed = await parseJsonSafely<{
    meowPrefix?: string;
    text?: string;
    mood?: MiauMood;
    modelUsed?: string;
    fallbackActive?: boolean;
    error?: string;
    code?: string;
  }>(res);

  if (!res.ok || !parsed.data) {
    const err = buildFriendlyHttpError(
      res.status,
      parsed,
      'Erro ao conversar com o Miau.'
    );
    if (res.status === 503 || err.code === 'MODEL_UNAVAILABLE' || err.code === 'QUOTA_EXHAUSTED') {
      scheduleSuperiorModelRecoveryCheck(true);
    }
    throw err;
  }

  scheduleSuperiorModelRecoveryCheck(parsed.data.fallbackActive);

  return {
    meowPrefix: parsed.data.meowPrefix || 'Miau!',
    text: parsed.data.text || '(Oi, humano!)',
    mood: (parsed.data.mood || 'happy') as MiauMood,
    modelUsed: parsed.data.modelUsed,
    fallbackActive: parsed.data.fallbackActive,
  };
}

export async function synthesizeMiauVoice(
  text: string
): Promise<MiauVoiceResponse> {
  let res: Response;
  try {
    res = await fetchWithTransientRetry(
      '/api/gemini/tts',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      },
      0,
      8_500
    );
  } catch {
    scheduleSuperiorModelRecoveryCheck(true);
    return {
      audioBase64: null,
      mimeType: null,
      textOnlyFallback: true,
      fallbackActive: true,
    };
  }

  const parsed = await parseJsonSafely<{
    audioBase64?: string | null;
    mimeType?: string | null;
    modelUsed?: string;
    fallbackActive?: boolean;
    textOnlyFallback?: boolean;
    error?: string;
    code?: string;
  }>(res);

  if (!res.ok || !parsed.data) {
    const err = buildFriendlyHttpError(
      res.status,
      parsed,
      'Erro ao gerar voz do Miau.'
    );
    if (
      err.code === 'MISSING_GEMINI_API_KEY' ||
      err.code === 'API_KEY_INVALID' ||
      err.code === 'PERMISSION_DENIED'
    ) {
      throw err;
    }
    scheduleSuperiorModelRecoveryCheck(true);
    return {
      audioBase64: null,
      mimeType: null,
      textOnlyFallback: true,
      fallbackActive: true,
    };
  }

  const isTextOnly =
    Boolean(parsed.data.textOnlyFallback) || !parsed.data.audioBase64;
  scheduleSuperiorModelRecoveryCheck(
    Boolean(parsed.data.fallbackActive) || isTextOnly
  );

  return {
    audioBase64: parsed.data.audioBase64 ?? null,
    mimeType: parsed.data.mimeType ?? null,
    modelUsed: parsed.data.modelUsed,
    fallbackActive: parsed.data.fallbackActive,
    textOnlyFallback: isTextOnly,
  };
}

export interface TranscribeCalibrationOptions {
  mode?: 'conversation' | 'study';
  expectedPhrase?: string;
  hintKeywords?: string[];
  userAge?: number | null;
  strictFilter?: boolean;
}

export interface TranscribeDetailedResult {
  transcript: string;
  safetyBlocked?: boolean;
  safeReply?: string;
}

export async function transcribeUserAudioDetailed(
  audioBase64: string,
  mimeType: string,
  calibration?: TranscribeCalibrationOptions
): Promise<TranscribeDetailedResult> {
  const cleanMime = (mimeType || 'audio/webm').split(';')[0].trim() || 'audio/webm';
  let res: Response;
  try {
    res = await fetchWithTransientRetry(
      '/api/gemini/transcribe',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64,
          mimeType: cleanMime,
          mode: calibration?.mode || 'conversation',
          expectedPhrase: calibration?.expectedPhrase,
          hintKeywords: calibration?.hintKeywords,
          userAge: calibration?.userAge ?? null,
          strictFilter: Boolean(calibration?.strictFilter),
        }),
      },
      1,
      12_000
    );
  } catch {
    throw new GeminiApiError(
      'Transcrição de voz indisponível sem conexão. Você pode continuar digitando por texto!',
      0,
      'NETWORK_ERROR'
    );
  }

  const parsed = await parseJsonSafely<{
    transcript?: string;
    safetyBlocked?: boolean;
    safeReply?: string;
    fallbackActive?: boolean;
    error?: string;
    code?: string;
  }>(res);

  if (!res.ok || !parsed.data) {
    const err = buildFriendlyHttpError(
      res.status,
      parsed,
      'Erro ao transcrever áudio.'
    );
    if (res.status === 503 || err.code === 'MODEL_UNAVAILABLE' || err.code === 'QUOTA_EXHAUSTED') {
      scheduleSuperiorModelRecoveryCheck(true);
    }
    throw err;
  }

  scheduleSuperiorModelRecoveryCheck(parsed.data.fallbackActive);

  return {
    transcript: parsed.data.transcript || '',
    safetyBlocked: Boolean(parsed.data.safetyBlocked),
    safeReply: parsed.data.safeReply,
  };
}

export async function transcribeUserAudio(
  audioBase64: string,
  mimeType: string,
  calibration?: TranscribeCalibrationOptions
): Promise<string> {
  const res = await transcribeUserAudioDetailed(audioBase64, mimeType, calibration);
  return res.transcript;
}

export interface WritingTeachResponse {
  coachTip: string;
  audioScript: string;
}

export interface WritingEvaluateResponse {
  verdict: 'positive' | 'medium' | 'retry';
  stars: number;
  feedbackText: string;
  audioScript: string;
}

export async function requestWritingTeach(params: {
  targetText: string;
  studentName: string;
  motorLevel: 'largo' | 'medio' | 'fino';
  strokeHints: string[];
}): Promise<WritingTeachResponse> {
  const res = await fetchWithTransientRetry('/api/gemini/writing-coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'teach',
      ...params,
    }),
  });
  const parsed = await parseJsonSafely<{
    coachTip?: string;
    audioScript?: string;
    fallbackActive?: boolean;
    error?: string;
    code?: string;
  }>(res);
  if (!res.ok || !parsed.data) {
    throw buildFriendlyHttpError(
      res.status,
      parsed,
      'Não foi possível carregar a explicação da IA.'
    );
  }
  scheduleSuperiorModelRecoveryCheck(parsed.data.fallbackActive);
  return {
    coachTip: parsed.data.coachTip || '',
    audioScript: parsed.data.audioScript || '',
  };
}

export async function requestWritingEvaluation(params: {
  targetText: string;
  studentName: string;
  motorLevel: 'largo' | 'medio' | 'fino';
  imageBase64: string;
  mimeType?: string;
  coveragePct: number;
  precisionPct: number;
  strokeCount: number;
}): Promise<WritingEvaluateResponse> {
  const res = await fetchWithTransientRetry('/api/gemini/writing-coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'evaluate',
      ...params,
    }),
  });
  const parsed = await parseJsonSafely<{
    verdict?: 'positive' | 'medium' | 'retry';
    stars?: number;
    feedbackText?: string;
    audioScript?: string;
    fallbackActive?: boolean;
    error?: string;
    code?: string;
  }>(res);
  if (!res.ok || !parsed.data) {
    throw buildFriendlyHttpError(
      res.status,
      parsed,
      'Não foi possível avaliar o traçado com a IA.'
    );
  }
  scheduleSuperiorModelRecoveryCheck(parsed.data.fallbackActive);
  return {
    verdict: parsed.data.verdict || 'medium',
    stars: typeof parsed.data.stars === 'number' ? parsed.data.stars : 1,
    feedbackText: parsed.data.feedbackText || '',
    audioScript: parsed.data.audioScript || '',
  };
}
