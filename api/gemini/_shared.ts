import type { IncomingMessage, ServerResponse } from 'node:http';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export interface VercelRequest extends IncomingMessage {
  body?: unknown;
}

export interface VercelResponse extends ServerResponse {
  status?: (code: number) => VercelResponse;
  json?: (data: unknown) => void;
}

export type GeminiCapability = 'chat' | 'tts' | 'transcribe' | 'live';

export const GEMINI_MODEL_TIERS: Record<GeminiCapability, readonly string[]> = {
  chat: ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'],
  tts: ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'],
  transcribe: [
    'gemini-3.5-transcribe',
    'gemini-4-hydrogen',
    'gemini-3.1-flash-lite',
  ],
  live: ['gemini-3.8-live', 'gemini-3.8-live-extended-thinking'],
};

const SUPERIOR_RECOVERY_CHECK_MS = 45_000;
const MAX_SERVER_TTS_CACHE = 120;

interface CapabilityTierState {
  activeTierIndex: number;
  cooldownUntilMs: number;
  lastFallbackReason: string | null;
  lastSwitchAtMs: number | null;
  lastRecoveredAtMs: number | null;
  probeInFlight: boolean;
}

const capabilityStates = new Map<GeminiCapability, CapabilityTierState>();
const serverTtsCache = new Map<
  string,
  { audioBase64: string; mimeType: string; modelUsed: string }
>();
let recoveryMonitorTimer: ReturnType<typeof setInterval> | null = null;

function getCapabilityState(cap: GeminiCapability): CapabilityTierState {
  let state = capabilityStates.get(cap);
  if (!state) {
    state = {
      activeTierIndex: 0,
      cooldownUntilMs: 0,
      lastFallbackReason: null,
      lastSwitchAtMs: null,
      lastRecoveredAtMs: null,
      probeInFlight: false,
    };
    capabilityStates.set(cap, state);
  }
  return state;
}

export function isQuotaOrRecoverableModelError(error: unknown): boolean {
  if (
    error instanceof MissingGeminiApiKeyError ||
    error instanceof InvalidJsonBodyError
  ) {
    return false;
  }
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (
    msg.includes('api_key_invalid') ||
    msg.includes('permission_denied') ||
    msg.includes('"code":403')
  ) {
    return false;
  }
  return (
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('token') ||
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('overloaded') ||
    msg.includes('500') ||
    msg.includes('internal') ||
    msg.includes('404') ||
    msg.includes('not_found') ||
    msg.includes('timeout') ||
    msg.includes('econnreset')
  );
}

export function getRecommendedThinkingLevel(model: string): ThinkingLevel {
  return model === 'gemini-3.1-flash-lite'
    ? ThinkingLevel.MINIMAL
    : ThinkingLevel.LOW;
}

export async function runWithModelFallback<T>(
  capability: GeminiCapability,
  invokeForModel: (model: string, tierIndex: number) => Promise<T>
): Promise<{ result: T; modelUsed: string; fallbackActive: boolean }> {
  const tiers = GEMINI_MODEL_TIERS[capability];
  const state = getCapabilityState(capability);
  const now = Date.now();

  // If currently on an inferior model and cooldown elapsed, try superior tier 0 first
  const shouldProbeSuperior =
    state.activeTierIndex > 0 && now >= state.cooldownUntilMs;
  const startIndex = shouldProbeSuperior ? 0 : state.activeTierIndex;

  const candidateIndices: number[] = [];
  for (let i = startIndex; i < tiers.length; i++) {
    candidateIndices.push(i);
  }
  for (let i = 0; i < startIndex; i++) {
    if (!candidateIndices.includes(i)) {
      candidateIndices.push(i);
    }
  }

  let lastError: unknown = null;

  for (const idx of candidateIndices) {
    const model = tiers[idx];
    try {
      const result = await withRetry(() => invokeForModel(model, idx), 1);

      if (idx === 0 && state.activeTierIndex > 0) {
        state.activeTierIndex = 0;
        state.cooldownUntilMs = 0;
        state.lastFallbackReason = null;
        state.lastRecoveredAtMs = Date.now();
        console.info(
          `[GeminiFallback:${capability}] Modelo superior (${model}) recuperado! Retornando ao tier principal.`
        );
      } else if (idx > 0 && state.activeTierIndex !== idx) {
        state.activeTierIndex = idx;
        state.cooldownUntilMs = Date.now() + SUPERIOR_RECOVERY_CHECK_MS;
        state.lastSwitchAtMs = Date.now();
      }

      return {
        result,
        modelUsed: model,
        fallbackActive: idx > 0,
      };
    } catch (error) {
      lastError = error;
      if (!isQuotaOrRecoverableModelError(error)) {
        throw error;
      }
      const errMsg = error instanceof Error ? error.message : String(error);
      state.lastFallbackReason = errMsg.slice(0, 200);
      if (idx < tiers.length - 1) {
        const nextTier = idx + 1;
        state.activeTierIndex = nextTier;
        state.cooldownUntilMs = Date.now() + SUPERIOR_RECOVERY_CHECK_MS;
        state.lastSwitchAtMs = Date.now();
        console.warn(
          `[GeminiFallback:${capability}] Limite/indisponibilidade em ${model}. Alternando para modelo inferior (${tiers[nextTier]}).`
        );
      } else {
        state.cooldownUntilMs = Date.now() + SUPERIOR_RECOVERY_CHECK_MS;
      }
    }
  }

  throw lastError;
}

// 100ms silent 8kHz mono PCM WAV used exclusively for lightweight transcribe quota recovery probes
const SILENT_PROBE_WAV_BASE64 = (() => {
  const sampleCount = 800;
  const dataSize = sampleCount * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(8000, 24);
  buf.writeUInt32LE(16000, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  return buf.toString('base64');
})();

export async function probeSuperiorModelRecovery(
  ai: GoogleGenAI,
  capability: Exclude<GeminiCapability, 'live'>
): Promise<boolean> {
  const state = getCapabilityState(capability);
  if (state.activeTierIndex === 0 || state.probeInFlight) return false;
  if (Date.now() < state.cooldownUntilMs) return false;

  const superiorModel = GEMINI_MODEL_TIERS[capability][0];
  state.probeInFlight = true;
  try {
    if (capability === 'tts') {
      await ai.models.generateContent({
        model: superiorModel,
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Oi' }],
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
      });
    } else if (capability === 'transcribe') {
      await ai.models.generateContent({
        model: superiorModel,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'audio/wav',
                data: SILENT_PROBE_WAV_BASE64,
              },
            },
            {
              text: 'Transcreva apenas se houver fala.',
            },
          ],
        },
      });
    } else {
      await ai.models.generateContent({
        model: superiorModel,
        contents: 'ok',
        config: {
          thinkingConfig: { thinkingLevel: getRecommendedThinkingLevel(superiorModel) },
          maxOutputTokens: 4,
        },
      });
    }

    state.activeTierIndex = 0;
    state.cooldownUntilMs = 0;
    state.lastFallbackReason = null;
    state.lastRecoveredAtMs = Date.now();
    console.info(
      `[GeminiFallback:${capability}] Consulta periódica confirmou retorno dos tokens de ${superiorModel}.`
    );
    return true;
  } catch {
    state.cooldownUntilMs = Date.now() + SUPERIOR_RECOVERY_CHECK_MS;
    return false;
  } finally {
    state.probeInFlight = false;
  }
}

export function startSuperiorModelRecoveryMonitor(
  clientFactory: () => GoogleGenAI
): void {
  if (recoveryMonitorTimer) return;
  recoveryMonitorTimer = setInterval(() => {
    const degraded: Array<Exclude<GeminiCapability, 'live'>> = [];
    (['chat', 'tts', 'transcribe'] as const).forEach((cap) => {
      const s = getCapabilityState(cap);
      if (s.activeTierIndex > 0 && Date.now() >= s.cooldownUntilMs) {
        degraded.push(cap);
      }
    });
    if (degraded.length === 0) return;

    let ai: GoogleGenAI;
    try {
      ai = clientFactory();
    } catch {
      return;
    }
    for (const cap of degraded) {
      void probeSuperiorModelRecovery(ai, cap);
    }
  }, SUPERIOR_RECOVERY_CHECK_MS);
  if (typeof recoveryMonitorTimer.unref === 'function') {
    recoveryMonitorTimer.unref();
  }
}

export function getGeminiFallbackStatus(): Record<
  GeminiCapability,
  {
    activeModel: string;
    superiorModel: string;
    fallbackActive: boolean;
    nextProbeAtMs: number;
    lastRecoveredAtMs: number | null;
    lastFallbackReason: string | null;
  }
> {
  const buildEntry = (cap: GeminiCapability) => {
    const tiers = GEMINI_MODEL_TIERS[cap];
    const s = getCapabilityState(cap);
    return {
      activeModel: tiers[s.activeTierIndex] ?? tiers[0],
      superiorModel: tiers[0],
      fallbackActive: s.activeTierIndex > 0,
      nextProbeAtMs: s.cooldownUntilMs,
      lastRecoveredAtMs: s.lastRecoveredAtMs,
      lastFallbackReason: s.lastFallbackReason,
    };
  };
  return {
    chat: buildEntry('chat'),
    tts: buildEntry('tts'),
    transcribe: buildEntry('transcribe'),
    live: buildEntry('live'),
  };
}

export function getCachedTtsWav(
  text: string
): { audioBase64: string; mimeType: string; modelUsed: string } | null {
  const key = text.trim().toLowerCase();
  return serverTtsCache.get(key) ?? null;
}

export function setCachedTtsWav(
  text: string,
  value: { audioBase64: string; mimeType: string; modelUsed: string }
): void {
  const key = text.trim().toLowerCase();
  if (!key) return;
  if (serverTtsCache.size >= MAX_SERVER_TTS_CACHE) {
    const oldest = serverTtsCache.keys().next().value;
    if (oldest) serverTtsCache.delete(oldest);
  }
  serverTtsCache.set(key, value);
}

export class MissingGeminiApiKeyError extends Error {
  public readonly statusCode = 503;
  public readonly code = 'MISSING_GEMINI_API_KEY';

  constructor() {
    super(
      'GEMINI_API_KEY não configurada no ambiente do servidor. Adicione GEMINI_API_KEY nas Environment Variables e reinicie/reimplante o servidor.'
    );
    this.name = 'MissingGeminiApiKeyError';
  }
}

export class InvalidJsonBodyError extends Error {
  public readonly statusCode = 400;
  public readonly code = 'INVALID_JSON_BODY';

  constructor() {
    super('Corpo da requisição JSON inválido.');
    this.name = 'InvalidJsonBodyError';
  }
}

export function getAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new MissingGeminiApiKeyError();
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient =
        msg.includes('"code":503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('"code":429') ||
        msg.includes('RESOURCE_EXHAUSTED');
      if (!isTransient || attempt === retries) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 450 * (attempt + 1)));
    }
  }
  throw lastError;
}

export function handleCorsAndMethod(
  req: VercelRequest,
  res: VercelResponse,
  allowedMethod = 'POST'
): boolean {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Allow', `${allowedMethod}, OPTIONS`);
    res.end();
    return false;
  }
  if (req.method !== allowedMethod) {
    sendJson(res, 405, { error: 'Método não permitido.' });
    return false;
  }
  return true;
}

function parseJsonObject(raw: string): Record<string, unknown> {
  if (!raw.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new InvalidJsonBodyError();
    }
    return parsed as Record<string, unknown>;
  } catch (err) {
    if (err instanceof InvalidJsonBodyError) throw err;
    throw new InvalidJsonBodyError();
  }
}

export async function readJsonBody(
  req: VercelRequest
): Promise<Record<string, unknown>> {
  if (Buffer.isBuffer(req.body)) {
    return parseJsonObject(req.body.toString('utf8'));
  }
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    return req.body as Record<string, unknown>;
  }
  if (typeof req.body === 'string') {
    return parseJsonObject(req.body);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return parseJsonObject(Buffer.concat(chunks).toString('utf8'));
}

export function sendJson(
  res: VercelResponse,
  statusCode: number,
  payload: unknown
): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export function sendGeminiRouteError(
  res: VercelResponse,
  routeLabel: string,
  error: unknown
): void {
  if (error instanceof MissingGeminiApiKeyError) {
    console.warn(`Configuração pendente em ${routeLabel}:`, error.message);
    sendJson(res, error.statusCode, {
      code: error.code,
      error: error.message,
    });
    return;
  }
  if (error instanceof InvalidJsonBodyError) {
    sendJson(res, error.statusCode, {
      code: error.code,
      error: error.message,
    });
    return;
  }
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`Erro em ${routeLabel}:`, msg);
  sendJson(res, 500, { error: msg });
}
