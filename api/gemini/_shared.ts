import type { IncomingMessage, ServerResponse } from 'node:http';
import { GoogleGenAI } from '@google/genai';

export interface VercelRequest extends IncomingMessage {
  body?: unknown;
}

export interface VercelResponse extends ServerResponse {
  status?: (code: number) => VercelResponse;
  json?: (data: unknown) => void;
}

export class MissingGeminiApiKeyError extends Error {
  public readonly statusCode = 503;
  public readonly code = 'MISSING_GEMINI_API_KEY';

  constructor() {
    super(
      'GEMINI_API_KEY não configurada no ambiente do servidor. Adicione GEMINI_API_KEY nas Environment Variables da Vercel e faça um Redeploy.'
    );
    this.name = 'MissingGeminiApiKeyError';
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
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  throw lastError;
}

export async function readJsonBody(
  req: VercelRequest
): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object') {
    return req.body as Record<string, unknown>;
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body) as Record<string, unknown>;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
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
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`Erro em ${routeLabel}:`, msg);
  sendJson(res, 500, { error: msg });
}
