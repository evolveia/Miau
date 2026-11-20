import type { ChatMessage, EquippedItems, MiauMood, PetStats } from '../types';

export interface MiauChatResponse {
  meowPrefix: string;
  text: string;
  mood: MiauMood;
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

function buildFriendlyHttpError(
  status: number,
  parsed: ParsedApiResult<{ error?: string; code?: string }>,
  fallbackMessage: string
): GeminiApiError {
  const apiError = parsed.data?.error?.trim();
  const code = parsed.data?.code;
  if (apiError) {
    return new GeminiApiError(apiError, status, code);
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

export async function askMiau(params: {
  message: string;
  history: ChatMessage[];
  stats: PetStats;
  equipped: EquippedItems;
  petName: string;
}): Promise<MiauChatResponse> {
  let res: Response;
  try {
    res = await fetch('/api/gemini/chat', {
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
    error?: string;
    code?: string;
  }>(res);

  if (!res.ok || !parsed.data) {
    throw buildFriendlyHttpError(
      res.status,
      parsed,
      'Erro ao conversar com o Miau.'
    );
  }

  return {
    meowPrefix: parsed.data.meowPrefix || 'Miau!',
    text: parsed.data.text || '(Oi, humano!)',
    mood: (parsed.data.mood || 'happy') as MiauMood,
  };
}

export async function synthesizeMiauVoice(
  text: string
): Promise<{ audioBase64: string; mimeType: string }> {
  let res: Response;
  try {
    res = await fetch('/api/gemini/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch {
    throw new GeminiApiError(
      'Serviço de voz indisponível sem conexão.',
      0,
      'NETWORK_ERROR'
    );
  }

  const parsed = await parseJsonSafely<{
    audioBase64?: string;
    mimeType?: string;
    error?: string;
    code?: string;
  }>(res);

  if (!res.ok || !parsed.data?.audioBase64) {
    throw buildFriendlyHttpError(
      res.status,
      parsed,
      'Erro ao gerar voz do Miau.'
    );
  }

  return {
    audioBase64: parsed.data.audioBase64,
    mimeType: parsed.data.mimeType || 'audio/wav',
  };
}

export async function transcribeUserAudio(
  audioBase64: string,
  mimeType: string
): Promise<string> {
  let res: Response;
  try {
    res = await fetch('/api/gemini/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64, mimeType }),
    });
  } catch {
    throw new GeminiApiError(
      'Transcrição de voz indisponível sem conexão.',
      0,
      'NETWORK_ERROR'
    );
  }

  const parsed = await parseJsonSafely<{
    transcript?: string;
    error?: string;
    code?: string;
  }>(res);

  if (!res.ok || !parsed.data) {
    throw buildFriendlyHttpError(
      res.status,
      parsed,
      'Erro ao transcrever áudio.'
    );
  }

  return parsed.data.transcript || '';
}
