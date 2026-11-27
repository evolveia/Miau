import fs from 'node:fs';
import path from 'node:path';
import * as webpush from 'web-push';
import type { PushSubscription } from 'web-push';

export type CareNeedKey = 'hunger' | 'hygiene' | 'sleep';

export interface CareNotificationPrefsPayload {
  enabled: boolean;
  threshold: number;
  needs: Record<CareNeedKey, boolean>;
  quietHoursEnabled?: boolean;
  quietStart?: string;
  quietEnd?: string;
  tzOffsetMin?: number;
}

export interface PetCareStatsSnapshot {
  hunger: number;
  hygiene: number;
  sleep: number;
  isSleeping: boolean;
  capturedAtMs: number;
}

interface StoredSubscriptionRecord {
  endpoint: string;
  subscription: PushSubscription;
  ownerId: string;
  petName: string;
  prefs: CareNotificationPrefsPayload;
  stats: PetCareStatsSnapshot;
  appVisible: boolean;
  lastNotifiedAt: Record<CareNeedKey, number>;
  updatedAtMs: number;
}

function resolvePushStoreDir(): string {
  const candidates = [
    process.env.MIAU_PUSH_DATA_DIR?.trim(),
    path.resolve(process.cwd(), '.miau-data'),
    '/tmp/miau-push-data',
  ].filter((v): v is string => Boolean(v));

  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch {
      // Try next candidate
    }
  }
  return '/tmp';
}

const PUSH_STORE_DIR = resolvePushStoreDir();
const VAPID_STORE_PATH = path.join(PUSH_STORE_DIR, 'vapid-keys.json');
const SUBS_STORE_PATH = path.join(PUSH_STORE_DIR, 'push-subs.json');

function writeJsonAtomic(filePath: string, data: unknown): void {
  const tempPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tempPath, JSON.stringify(data), {
    encoding: 'utf-8',
    mode: 0o600,
  });
  fs.renameSync(tempPath, filePath);
}

export function isValidPushEndpoint(rawEndpoint: unknown): rawEndpoint is string {
  if (typeof rawEndpoint !== 'string' || rawEndpoint.length > 2048) return false;
  try {
    const parsed = new URL(rawEndpoint);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (
      !host ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// Intervalos equivalentes ao decay loop de MiauAppUI (em ms por 1 ponto perdido)
const DECAY_MS_PER_POINT: Record<CareNeedKey, number> = {
  hunger: 35_000,
  sleep: 70_000,
  hygiene: 105_000,
};

const NEED_RENOTIFY_COOLDOWN_MS = 30 * 60 * 1000;

interface VapidKeys {
  publicKey: string;
  privateKey: string;
  subject: string;
}

let cachedVapidKeys: VapidKeys | null = null;
let monitorTimer: ReturnType<typeof setInterval> | null = null;
const subscriptions = new Map<string, StoredSubscriptionRecord>();

function loadOrCreateVapidKeys(): VapidKeys {
  if (cachedVapidKeys) return cachedVapidKeys;

  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:suporte@miau.app';
  const envPublic = process.env.VAPID_PUBLIC_KEY?.trim();
  const envPrivate = process.env.VAPID_PRIVATE_KEY?.trim();

  if (envPublic && envPrivate) {
    cachedVapidKeys = {
      publicKey: envPublic,
      privateKey: envPrivate,
      subject,
    };
    webpush.setVapidDetails(
      subject,
      cachedVapidKeys.publicKey,
      cachedVapidKeys.privateKey
    );
    return cachedVapidKeys;
  }

  const legacyVapidPath = '/tmp/miau-vapid-keys.json';
  for (const candidatePath of [VAPID_STORE_PATH, legacyVapidPath]) {
    try {
      if (fs.existsSync(candidatePath)) {
        const parsed = JSON.parse(
          fs.readFileSync(candidatePath, 'utf-8')
        ) as Partial<VapidKeys>;
        if (parsed.publicKey && parsed.privateKey) {
          cachedVapidKeys = {
            publicKey: parsed.publicKey,
            privateKey: parsed.privateKey,
            subject,
          };
          webpush.setVapidDetails(
            subject,
            cachedVapidKeys.publicKey,
            cachedVapidKeys.privateKey
          );
          if (candidatePath !== VAPID_STORE_PATH) {
            try {
              writeJsonAtomic(VAPID_STORE_PATH, cachedVapidKeys);
            } catch {
              // Non-fatal
            }
          }
          return cachedVapidKeys;
        }
      }
    } catch {
      // Generate fresh keys below
    }
  }

  const generated = webpush.generateVAPIDKeys();
  cachedVapidKeys = {
    publicKey: generated.publicKey,
    privateKey: generated.privateKey,
    subject,
  };
  try {
    writeJsonAtomic(VAPID_STORE_PATH, cachedVapidKeys);
  } catch {
    // Non-fatal in read-only filesystems
  }
  webpush.setVapidDetails(
    subject,
    cachedVapidKeys.publicKey,
    cachedVapidKeys.privateKey
  );
  return cachedVapidKeys;
}

function loadSubscriptionsFromDisk(): void {
  if (subscriptions.size > 0) return;
  const legacySubsPath = '/tmp/miau-push-subs.json';
  for (const candidatePath of [SUBS_STORE_PATH, legacySubsPath]) {
    try {
      if (!fs.existsSync(candidatePath)) continue;
      const raw = JSON.parse(
        fs.readFileSync(candidatePath, 'utf-8')
      ) as StoredSubscriptionRecord[];
      if (Array.isArray(raw) && raw.length > 0) {
        for (const rec of raw) {
          if (rec?.endpoint && rec.subscription?.endpoint) {
            subscriptions.set(rec.endpoint, rec);
          }
        }
        if (candidatePath !== SUBS_STORE_PATH) {
          saveSubscriptionsToDisk();
        }
        return;
      }
    } catch {
      // Ignore corrupted store
    }
  }
}

function saveSubscriptionsToDisk(): void {
  try {
    writeJsonAtomic(SUBS_STORE_PATH, Array.from(subscriptions.values()));
  } catch {
    // Non-fatal
  }
}

export function getVapidPublicKey(): string {
  return loadOrCreateVapidKeys().publicKey;
}

export function buildCareNotificationPayload(
  need: CareNeedKey,
  petName: string,
  levelPct: number
) {
  const safeName = (petName || 'Miau').slice(0, 32);
  const pct = Math.max(0, Math.min(100, Math.round(levelPct)));

  if (need === 'hunger') {
    return {
      title: `🐟 ${safeName} está com muita fome (${pct}%)!`,
      body: `A barrinha de comida do ${safeName} está bem baixinha. Volte ao app para dar um petisco gostoso!`,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: 'miau-need-hunger',
      renotify: true,
      requireInteraction: false,
      need: 'hunger',
      action: 'feed',
      url: '/?miauAction=feed',
      actions: [
        { action: 'feed', title: '🐟 Alimentar agora' },
        { action: 'open', title: 'Abrir Miau' },
      ],
    };
  }

  if (need === 'hygiene') {
    return {
      title: `🛁 Hora do banho do ${safeName} (${pct}%)!`,
      body: `${safeName} precisa de água fresquinha e sabonete para ficar cheiroso! Venha cuidar dele.`,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: 'miau-need-hygiene',
      renotify: true,
      requireInteraction: false,
      need: 'hygiene',
      action: 'clean',
      url: '/?miauAction=clean',
      actions: [
        { action: 'clean', title: '🛁 Dar banho' },
        { action: 'open', title: 'Abrir Miau' },
      ],
    };
  }

  return {
    title: `🌙 ${safeName} está com muito sono (${pct}%)!`,
    body: `${safeName} está bocejando e precisa tirar uma soneca quentinha. Volte para colocá-lo na caminha!`,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: 'miau-need-sleep',
    renotify: true,
    requireInteraction: false,
    need: 'sleep',
    action: 'sleep',
    url: '/?miauAction=sleep',
    actions: [
      { action: 'sleep', title: '🌙 Colocar para dormir' },
      { action: 'open', title: 'Abrir Miau' },
    ],
  };
}

function clampThreshold(val: unknown): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return 25;
  return Math.max(10, Math.min(45, Math.round(num)));
}

function sanitizeStats(raw: Partial<PetCareStatsSnapshot> | undefined): PetCareStatsSnapshot {
  const clampStat = (v: unknown, def: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : def;
  };
  return {
    hunger: clampStat(raw?.hunger, 80),
    hygiene: clampStat(raw?.hygiene, 90),
    sleep: clampStat(raw?.sleep, 80),
    isSleeping: Boolean(raw?.isSleeping),
    capturedAtMs: Date.now(),
  };
}

const HH_MM_RX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function sanitizeHhMm(val: unknown, fallback: string): string {
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  return HH_MM_RX.test(trimmed) ? trimmed : fallback;
}

export function isPushPrefsInQuietHours(
  prefs: Partial<CareNotificationPrefsPayload> | undefined,
  nowMs = Date.now()
): boolean {
  if (!prefs?.quietHoursEnabled) return false;
  const startMatch = HH_MM_RX.exec(sanitizeHhMm(prefs.quietStart, '22:00'));
  const endMatch = HH_MM_RX.exec(sanitizeHhMm(prefs.quietEnd, '07:00'));
  if (!startMatch || !endMatch) return false;
  const startMin = Number(startMatch[1]) * 60 + Number(startMatch[2]);
  const endMin = Number(endMatch[1]) * 60 + Number(endMatch[2]);
  if (startMin === endMin) return false;
  const tzOffsetMin =
    typeof prefs.tzOffsetMin === 'number' &&
    Number.isFinite(prefs.tzOffsetMin) &&
    Math.abs(prefs.tzOffsetMin) <= 840
      ? Math.round(prefs.tzOffsetMin)
      : 0;
  const localDate = new Date(nowMs - tzOffsetMin * 60_000);
  const curMin = localDate.getUTCHours() * 60 + localDate.getUTCMinutes();
  if (startMin < endMin) {
    return curMin >= startMin && curMin < endMin;
  }
  return curMin >= startMin || curMin < endMin;
}

function sanitizePrefs(
  raw: Partial<CareNotificationPrefsPayload> | undefined
): CareNotificationPrefsPayload {
  const tzRaw = Number(raw?.tzOffsetMin);
  const tzOffsetMin =
    Number.isFinite(tzRaw) && Math.abs(tzRaw) <= 840 ? Math.round(tzRaw) : 0;
  return {
    enabled: raw?.enabled !== false,
    threshold: clampThreshold(raw?.threshold),
    needs: {
      hunger: raw?.needs?.hunger !== false,
      hygiene: raw?.needs?.hygiene !== false,
      sleep: raw?.needs?.sleep !== false,
    },
    quietHoursEnabled: Boolean(raw?.quietHoursEnabled),
    quietStart: sanitizeHhMm(raw?.quietStart, '22:00'),
    quietEnd: sanitizeHhMm(raw?.quietEnd, '07:00'),
    tzOffsetMin,
  };
}

export function upsertPushSubscription(params: {
  subscription: PushSubscription;
  ownerId?: string;
  petName?: string;
  prefs?: Partial<CareNotificationPrefsPayload>;
  stats?: Partial<PetCareStatsSnapshot>;
  appVisible?: boolean;
}): boolean {
  loadOrCreateVapidKeys();
  loadSubscriptionsFromDisk();
  const endpoint = params.subscription?.endpoint;
  if (!isValidPushEndpoint(endpoint)) return false;

  const existing = subscriptions.get(endpoint);
  subscriptions.set(endpoint, {
    endpoint,
    subscription: params.subscription,
    ownerId: String(params.ownerId || existing?.ownerId || 'guest').slice(0, 80),
    petName: String(params.petName || existing?.petName || 'Miau').slice(0, 32),
    prefs: sanitizePrefs(params.prefs ?? existing?.prefs),
    stats: sanitizeStats(params.stats ?? existing?.stats),
    appVisible: params.appVisible ?? true,
    lastNotifiedAt: existing?.lastNotifiedAt ?? {
      hunger: 0,
      hygiene: 0,
      sleep: 0,
    },
    updatedAtMs: Date.now(),
  });
  saveSubscriptionsToDisk();
  return true;
}

export function syncPushSubscriptionState(params: {
  endpoint: string;
  petName?: string;
  prefs?: Partial<CareNotificationPrefsPayload>;
  stats?: Partial<PetCareStatsSnapshot>;
  appVisible?: boolean;
  notifiedNeed?: CareNeedKey;
}): boolean {
  if (!isValidPushEndpoint(params.endpoint)) return false;
  loadSubscriptionsFromDisk();
  const record = subscriptions.get(params.endpoint);
  if (!record) return false;

  if (params.petName) {
    record.petName = String(params.petName).slice(0, 32);
  }
  if (params.prefs) {
    record.prefs = sanitizePrefs(params.prefs);
  }
  if (params.stats) {
    const nextStats = sanitizeStats(params.stats);
    const threshold = record.prefs.threshold;
    if (nextStats.hunger >= threshold + 15) record.lastNotifiedAt.hunger = 0;
    if (nextStats.hygiene >= threshold + 15) record.lastNotifiedAt.hygiene = 0;
    if (nextStats.sleep >= threshold + 15) record.lastNotifiedAt.sleep = 0;
    record.stats = nextStats;
  }
  if (typeof params.appVisible === 'boolean') {
    record.appVisible = params.appVisible;
  }
  if (params.notifiedNeed && params.notifiedNeed in record.lastNotifiedAt) {
    record.lastNotifiedAt[params.notifiedNeed] = Date.now();
  }
  record.updatedAtMs = Date.now();
  saveSubscriptionsToDisk();
  return true;
}

export function removePushSubscription(endpoint: string): void {
  loadSubscriptionsFromDisk();
  if (subscriptions.delete(endpoint)) {
    saveSubscriptionsToDisk();
  }
}

export async function sendTestPush(
  endpoint: string,
  petName = 'Miau'
): Promise<{ sent: boolean; reason?: string }> {
  loadOrCreateVapidKeys();
  loadSubscriptionsFromDisk();
  const record = subscriptions.get(endpoint);
  if (!record) {
    return { sent: false, reason: 'Inscrição push não encontrada no servidor.' };
  }
  const safeName = String(petName || record.petName || 'Miau').slice(0, 32);
  const payload = {
    title: `🐾 ${safeName}: Notificações Push ativadas!`,
    body: `Quando a fome, o banho ou o sono do ${safeName} ficarem baixos, vamos avisar você aqui!`,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: 'miau-push-test',
    renotify: true,
    need: 'care',
    action: 'open',
    url: '/',
    actions: [{ action: 'open', title: 'Cuidar do Miau 🐾' }],
  };
  try {
    await webpush.sendNotification(record.subscription, JSON.stringify(payload));
    return { sent: true };
  } catch (err) {
    const statusCode = (err as { statusCode?: number })?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      subscriptions.delete(endpoint);
      saveSubscriptionsToDisk();
    }
    return {
      sent: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

function estimateNeedLevelAt(
  record: StoredSubscriptionRecord,
  need: CareNeedKey,
  nowMs: number
): number {
  const base = record.stats[need];
  if (record.stats.isSleeping) {
    if (need === 'sleep') return Math.min(100, base + (nowMs - record.stats.capturedAtMs) / 10_000);
    return base;
  }
  const elapsedMs = Math.max(0, nowMs - record.stats.capturedAtMs);
  const lostPoints = Math.floor(elapsedMs / DECAY_MS_PER_POINT[need]);
  const floorVal = need === 'hygiene' ? 8 : 5;
  return Math.max(floorVal, base - lostPoints);
}

async function runCarePushSweep(): Promise<void> {
  if (subscriptions.size === 0) return;
  loadOrCreateVapidKeys();
  const now = Date.now();
  let mutated = false;

  for (const [endpoint, record] of subscriptions.entries()) {
    if (!record.prefs.enabled) continue;
    if (isPushPrefsInQuietHours(record.prefs, now)) continue;
    // Se a aba estava visível muito recentemente (< 40s), o cliente cuida dos alertas locais sem duplicar push
    if (record.appVisible && now - record.updatedAtMs < 40_000) {
      continue;
    }

    const order: CareNeedKey[] = ['hunger', 'hygiene', 'sleep'];
    for (const need of order) {
      if (!record.prefs.needs[need]) continue;
      if (need === 'sleep' && record.stats.isSleeping) continue;
      const estimated = estimateNeedLevelAt(record, need, now);
      if (estimated > record.prefs.threshold) continue;
      if (now - record.lastNotifiedAt[need] < NEED_RENOTIFY_COOLDOWN_MS) continue;

      record.lastNotifiedAt[need] = now;
      mutated = true;

      const payload = buildCareNotificationPayload(
        need,
        record.petName,
        estimated
      );
      try {
        await webpush.sendNotification(
          record.subscription,
          JSON.stringify(payload)
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          subscriptions.delete(endpoint);
        }
      }
      // Envia no máximo 1 notificação por varredura por usuário para não sobrecarregar
      break;
    }
  }

  if (mutated) {
    saveSubscriptionsToDisk();
  }
}

export function startPushMonitor(): void {
  loadOrCreateVapidKeys();
  loadSubscriptionsFromDisk();
  if (monitorTimer) return;
  monitorTimer = setInterval(() => {
    void runCarePushSweep();
  }, 15_000);
}
