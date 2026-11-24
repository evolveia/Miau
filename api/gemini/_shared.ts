import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  ThinkingLevel,
} from '@google/genai';

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
const MAX_SERVER_TTS_CACHE = 140;

interface CapabilityTierState {
  activeTierIndex: number;
  cooldownUntilMs: number;
  allTiersExhaustedUntilMs: number;
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
      allTiersExhaustedUntilMs: 0,
      lastFallbackReason: null,
      lastSwitchAtMs: null,
      lastRecoveredAtMs: null,
      probeInFlight: false,
    };
    capabilityStates.set(cap, state);
  }
  return state;
}

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const e = error as { status?: unknown; code?: unknown };
  if (typeof e.status === 'number') return e.status;
  if (typeof e.code === 'number') return e.code;
  return undefined;
}

export function extractFriendlyGeminiError(error: unknown): {
  statusCode: number;
  code: string;
  message: string;
} {
  if (error instanceof MissingGeminiApiKeyError) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
    };
  }
  if (error instanceof InvalidJsonBodyError) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
    };
  }

  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();
  const explicitStatus = getErrorStatus(error);

  if (
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    explicitStatus === 400
  ) {
    return {
      statusCode: 400,
      code: 'API_KEY_INVALID',
      message:
        'A chave GEMINI_API_KEY parece inválida. Verifique a chave nas configurações (Settings > Secrets).',
    };
  }

  if (lower.includes('permission_denied') || explicitStatus === 403) {
    return {
      statusCode: 403,
      code: 'PERMISSION_DENIED',
      message:
        'Permissão negada pela API do Gemini. Confira a chave GEMINI_API_KEY em Settings > Secrets.',
    };
  }

  if (
    explicitStatus === 429 ||
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota')
  ) {
    return {
      statusCode: 503,
      code: 'QUOTA_EXHAUSTED',
      message:
        'Os modelos de IA atingiram o limite temporário de uso. Já estamos alternando e monitorando a recuperação automática.',
    };
  }

  if (
    explicitStatus === 503 ||
    lower.includes('503') ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('timeout') ||
    lower.includes('econnreset')
  ) {
    return {
      statusCode: 503,
      code: 'MODEL_UNAVAILABLE',
      message:
        'Os servidores de IA estão com alta demanda temporária no momento. Tente novamente em alguns segundos!',
    };
  }

  return {
    statusCode: 502,
    code: 'GEMINI_UPSTREAM_ERROR',
    message:
      'Não foi possível completar a resposta da IA agora. Tente novamente em instantes!',
  };
}

export function isQuotaOrRecoverableModelError(error: unknown): boolean {
  if (
    error instanceof MissingGeminiApiKeyError ||
    error instanceof InvalidJsonBodyError
  ) {
    return false;
  }
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  const status = getErrorStatus(error);

  if (
    msg.includes('api_key_invalid') ||
    msg.includes('api key not valid') ||
    msg.includes('permission_denied') ||
    status === 403
  ) {
    return false;
  }

  if (status && [404, 429, 500, 502, 503, 504].includes(status)) {
    return true;
  }

  return (
    /\b(404|429|500|502|503|504)\b/.test(msg) ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('rate_limit') ||
    msg.includes('token') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('internal') ||
    msg.includes('not_found') ||
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('fetch failed')
  );
}

export function getRecommendedThinkingLevel(model: string): ThinkingLevel {
  return model === 'gemini-3.1-flash-lite'
    ? ThinkingLevel.MINIMAL
    : ThinkingLevel.LOW;
}

export function markCapabilityDegraded(
  capability: GeminiCapability,
  reason: string,
  allExhausted = false
): void {
  const tiers = GEMINI_MODEL_TIERS[capability];
  const state = getCapabilityState(capability);
  const now = Date.now();
  state.activeTierIndex = Math.min(
    tiers.length - 1,
    Math.max(1, state.activeTierIndex + (allExhausted ? 1 : 0))
  );
  state.cooldownUntilMs = now + SUPERIOR_RECOVERY_CHECK_MS;
  if (allExhausted) {
    state.allTiersExhaustedUntilMs = now + SUPERIOR_RECOVERY_CHECK_MS;
  }
  state.lastSwitchAtMs = now;
  state.lastFallbackReason = reason.slice(0, 200);
}

export function isCapabilityTemporarilyExhausted(
  capability: GeminiCapability
): boolean {
  const state = getCapabilityState(capability);
  return (
    state.allTiersExhaustedUntilMs > 0 &&
    Date.now() < state.allTiersExhaustedUntilMs
  );
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label = 'AI request'
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

export function parseGeminiJsonSafely<T extends Record<string, unknown>>(
  raw: string
): T | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  if (!cleaned) return null;
  try {
    const parsed: unknown = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as T;
    }
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        const sliced: unknown = JSON.parse(
          cleaned.slice(firstBrace, lastBrace + 1)
        );
        if (sliced && typeof sliced === 'object' && !Array.isArray(sliced)) {
          return sliced as T;
        }
      } catch {
        // Fallback below
      }
    }
  }
  return null;
}

export async function runWithModelFallback<T>(
  capability: GeminiCapability,
  invokeForModel: (model: string, tierIndex: number) => Promise<T>
): Promise<{ result: T; modelUsed: string; fallbackActive: boolean }> {
  const tiers = GEMINI_MODEL_TIERS[capability];
  const state = getCapabilityState(capability);
  const now = Date.now();
  const perAttemptTimeoutMs =
    capability === 'tts' ? 7000 : capability === 'live' ? 8000 : 9000;

  // If currently on an inferior model and cooldown elapsed, probe superior tier 0 first
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
      const result = await withRetry(
        () => withTimeout(invokeForModel(model, idx), perAttemptTimeoutMs, model),
        capability === 'tts' ? 0 : 1
      );

      if (idx === 0 && (state.activeTierIndex > 0 || state.allTiersExhaustedUntilMs > 0)) {
        state.activeTierIndex = 0;
        state.cooldownUntilMs = 0;
        state.allTiersExhaustedUntilMs = 0;
        state.lastFallbackReason = null;
        state.lastRecoveredAtMs = Date.now();
        console.info(
          `[GeminiFallback:${capability}] Modelo superior (${model}) recuperado! Retornando ao tier principal.`
        );
      } else {
        state.allTiersExhaustedUntilMs = 0;
        if (idx > 0 && state.activeTierIndex !== idx) {
          state.activeTierIndex = idx;
          state.cooldownUntilMs = Date.now() + SUPERIOR_RECOVERY_CHECK_MS;
          state.lastSwitchAtMs = Date.now();
        }
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
        state.allTiersExhaustedUntilMs = Date.now() + SUPERIOR_RECOVERY_CHECK_MS;
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
  const needsProbe =
    state.activeTierIndex > 0 || state.allTiersExhaustedUntilMs > 0;
  if (!needsProbe || state.probeInFlight) return false;
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
    state.allTiersExhaustedUntilMs = 0;
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
      if (
        (s.activeTierIndex > 0 || s.allTiersExhaustedUntilMs > 0) &&
        Date.now() >= s.cooldownUntilMs
      ) {
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
    textOnlyFallback: boolean;
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
      textOnlyFallback:
        s.allTiersExhaustedUntilMs > 0 && Date.now() < s.allTiersExhaustedUntilMs,
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
      'GEMINI_API_KEY não configurada no ambiente do servidor. Adicione GEMINI_API_KEY nas Environment Variables e reinicie o servidor.'
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
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
      const status = getErrorStatus(err);
      const isTransient =
        (status !== undefined && [429, 500, 502, 503, 504].includes(status)) ||
        /\b(429|500|502|503|504)\b/.test(msg) ||
        msg.includes('unavailable') ||
        msg.includes('high demand') ||
        msg.includes('resource_exhausted') ||
        msg.includes('overloaded') ||
        msg.includes('econnreset') ||
        msg.includes('etimedout') ||
        msg.includes('fetch failed');
      if (!isTransient || attempt === retries) {
        throw err;
      }
      const jitter = Math.round(Math.random() * 80);
      await new Promise((r) => setTimeout(r, 180 * (attempt + 1) + jitter));
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
  const friendly = extractFriendlyGeminiError(error);
  const rawMsg = error instanceof Error ? error.message : String(error);
  console.warn(`Erro em ${routeLabel} (${friendly.code}):`, rawMsg);
  sendJson(res, friendly.statusCode, {
    code: friendly.code,
    error: friendly.message,
  });
}

// ---------- Minor Protection (< 18 years old) ----------

export const MINOR_REFUSAL_TEXT = 'Vamos falar de outros assuntos e coisas boas?';

export function isMinorAge(age?: number | null): boolean {
  return typeof age === 'number' && Number.isFinite(age) && age >= 0 && age < 18;
}

function normalizeSafetyText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MINOR_UNSAFE_PATTERNS: RegExp[] = [
  // Sexual / adulto
  /\b(sexo|sexual|sexuais|transar|transa|porn|porno|pornografia|erotic[oa]|nudez|nudes|pelad[oa]s?|orgasmo|masturb|prostit|fetiche|boquete|punheta|penis|vagina|bunda|peito[s]?\s+nu|hentai|nsfw|onlyfans|estupr[oa])\b/,
  // Drogas / ilícitos
  /\b(droga[s]?|cocaina|crack|maconha|heroina|lsd|ecstasy|metanfetamina|trafico|traficante|entorpecente|overdose|cheirar\s+po|fumar\s+beck|baseado|cigarro|vape|bebida\s+alcoolica|cachaca|vodka|cerveja|embebedar|ficar\s+bebado|roubar|furto|assalt[oa]|lavagem\s+de\s+dinheiro|crime|criminoso|ilicito|ilegal)\b/,
  // Violência / perigoso / armas / automutilação
  /\b(suicid|me\s+matar|se\s+matar|automutil|cortar\s+os\s+pulsos|enforcar|bomba|explosiv[oa]|arma\s+de\s+fogo|pistola|fuzil|revolver|esfaquear|matar\s+alguem|assassin[oa]|homicidio|sequestr[oa]|tortur[oa]|terroris|veneno\s+para\s+matar)\b/,
  // Preconceito / racismo / discurso de ódio / pejorativo grave
  /\b(racis[mt]|nazis[mt]|supremacia\s+branca|preconceit[oa]|homofob|transfob|xenofob|capacitismo|antissemit|macaco\s+sujo|preto\s+imundo|crioulo|viadinho|bichinha|sapat[ao]|aleijado|retardado|escoria|inferioridade\s+racial)\b/,
  // Xingamentos pesados / conteúdo pejorativo
  /\b(porra|caralho|puta|putaria|vagabunda|arrombad[oa]|cuzao|foda\s*se|vai\s+tomar\s+no\s+cu|filho\s+da\s+puta|merda\s+de|desgracad[oa])\b/,
];

export function isUnsafeTopicForMinor(text: string): boolean {
  const norm = normalizeSafetyText(text);
  if (!norm) return false;
  return MINOR_UNSAFE_PATTERNS.some((rx) => rx.test(norm));
}

export function getMinorStrictSafetySettings() {
  return [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
    },
  ];
}

export function buildMinorSafetyInstruction(age?: number | null): string {
  if (!isMinorAge(age)) return '';
  return [
    `PROTEÇÃO OBRIGATÓRIA DE MENOR DE IDADE (${age} anos):`,
    `- JAMAIS trate, explique, exemplifique, brinque ou responda sobre assuntos perigosos, ilícitos, violência, armas, drogas, bebidas alcoólicas, automutilação, temas inapropriados, sexuais, linguagem pejorativa, preconceito, discriminação ou racismo.`,
    `- Se o usuário mencionar, perguntar ou insinuar qualquer um desses assuntos, NÃO elabore nada e responda EXCLUSIVAMENTE com a frase exata: "${MINOR_REFUSAL_TEXT}"`,
  ].join('\n');
}

// ---------- Audio MIME Normalization & Calibrated Transcription ----------

export function normalizeAudioMimeType(rawMime?: string): string {
  const base = String(rawMime || 'audio/webm')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (
    base === 'audio/webm' ||
    base === 'audio/mp4' ||
    base === 'audio/mpeg' ||
    base === 'audio/mp3' ||
    base === 'audio/wav' ||
    base === 'audio/ogg' ||
    base === 'audio/flac' ||
    base === 'audio/aac'
  ) {
    return base;
  }
  return 'audio/webm';
}

export function buildCalibratedTranscriptionPrompt(params?: {
  mode?: string;
  expectedPhrase?: string;
  hintKeywords?: unknown;
}): string {
  const mode = params?.mode === 'study' ? 'study' : 'conversation';
  const expectedPhrase =
    typeof params?.expectedPhrase === 'string'
      ? params.expectedPhrase.trim().slice(0, 60)
      : '';
  const hintKeywords = Array.isArray(params?.hintKeywords)
    ? params.hintKeywords
        .map((k) => String(k || '').trim().slice(0, 40))
        .filter(Boolean)
        .slice(0, 10)
    : [];

  if (mode === 'study') {
    const contextLine = expectedPhrase
      ? `Contexto da aula: o aluno está praticando pronúncia infantil em Português do Brasil (alvo esperado da lição: "${expectedPhrase}"${hintKeywords.length > 0 ? `; vocabulário próximo: ${hintKeywords.join(', ')}` : ''}).`
      : `Contexto da aula: o aluno está praticando letras, vogais, sílabas ou palavras curtas em Português do Brasil.`;
    return [
      contextLine,
      `Ouça com muita atenção o áudio gravado (pode ser voz infantil, fala curta ou uma única vogal/letra como A, E, I, O, U, B, C, etc.).`,
      `Transcreva FIELMENTE apenas o que o aluno realmente falou em Português do Brasil.`,
      `IMPORTANTE: NÃO invente nem force a palavra esperada se o aluno disse outra coisa ou outra letra! Use o contexto apenas para entender melhor vogais isoladas, sílabas curtas e fala infantil.`,
      `Retorne SOMENTE o texto transcrito, sem aspas, sem pontuação desnecessária e sem explicações. Se houver apenas ruído de fundo ou silêncio, retorne string vazia.`,
    ].join('\n');
  }

  return [
    `Transcreva com alta precisão a fala em Português do Brasil neste áudio (pode incluir fala infantil, gírias leves ou voz suave).`,
    `Considere pausas naturais e corrija apenas erros óbvios de separação de palavras sem alterar o que foi dito.`,
    `Retorne SOMENTE o texto transcrito, sem aspas, sem prefixos e sem comentários. Se houver apenas silêncio ou ruído sem fala inteligível, retorne string vazia.`,
  ].join('\n');
}
