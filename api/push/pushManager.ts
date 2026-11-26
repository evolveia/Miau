import fs from 'node:fs';
import * as webpush from 'web-push';
import type { PushSubscription } from 'web-push';

export type CareNeedKey = 'hunger' | 'hygiene' | 'sleep';

export interface CareNotificationPrefsPayload {
  enabled: boolean;
  threshold: number;
  needs: Record<CareNeedKey, boolean>;
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

const VAPID_STORE_PATH = '/tmp/miau-vapid-keys.json';
const SUBS_STORE_PATH = '/tmp/miau-push-subs.json';

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

  const subject = 'mailto:suporte@miau.app';

  try {
    if (fs.existsSync(VAPID_STORE_PATH)) {
      const parsed = JSON.parse(
        fs.readFileSync(VAPID_STORE_PATH, 'utf-8')
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
        return cachedVapidKeys;
      }
    }
  } catch {
    // Generate fresh keys below
  }

  const generated = webpush.generateVAPIDKeys();
  cachedVapidKeys = {
    publicKey: generated.publicKey,
    privateKey: generated.privateKey,
    subject,
  };
  try {
    fs.writeFileSync(VAPID_STORE_PATH, JSON.stringify(cachedVapidKeys), 'utf-8');
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
  try {
    if (!fs.existsSync(SUBS_STORE_PATH)) return;
    const raw = JSON.parse(
      fs.readFileSync(SUBS_STORE_PATH, 'utf-8')
    ) as StoredSubscriptionRecord[];
    if (Array.isArray(raw)) {
      for (const rec of raw) {
        if (rec?.endpoint && rec.subscription?.endpoint) {
          subscriptions.set(rec.endpoint, rec);
        }
      }
    }
  } catch {
    // Ignore corrupted temp store
  }
}

function saveSubscriptionsToDisk(): void {
  try {
    fs.writeFileSync(
      SUBS_STORE_PATH,
      JSON.stringify(Array.from(subscriptions.values())),
      'utf-8'
    );
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

function sanitizePrefs(
  raw: Partial<CareNotificationPrefsPayload> | undefined
): CareNotificationPrefsPayload {
  return {
    enabled: raw?.enabled !== false,
    threshold: clampThreshold(raw?.threshold),
    needs: {
      hunger: raw?.needs?.hunger !== false,
      hygiene: raw?.needs?.hygiene !== false,
      sleep: raw?.needs?.sleep !== false,
    },
  };
}

export function upsertPushSubscription(params: {
  subscription: PushSubscription;
  ownerId?: string;
  petName?: string;
  prefs?: Partial<CareNotificationPrefsPayload>;
  stats?: Partial<PetCareStatsSnapshot>;
  appVisible?: boolean;
}): void {
  loadOrCreateVapidKeys();
  loadSubscriptionsFromDisk();
  const endpoint = params.subscription?.endpoint;
  if (!endpoint) return;

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
}

export function syncPushSubscriptionState(params: {
  endpoint: string;
  petName?: string;
  prefs?: Partial<CareNotificationPrefsPayload>;
  stats?: Partial<PetCareStatsSnapshot>;
  appVisible?: boolean;
  notifiedNeed?: CareNeedKey;
}): boolean {
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
