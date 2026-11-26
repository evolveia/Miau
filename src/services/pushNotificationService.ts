import { soundService } from './soundService';

export type CareNeedKey = 'hunger' | 'hygiene' | 'sleep';
export type PushPermissionState =
  | 'default'
  | 'granted'
  | 'denied'
  | 'unsupported';

export interface CarePushPreferences {
  enabled: boolean;
  threshold: number;
  needs: Record<CareNeedKey, boolean>;
  promptDismissedUntilMs: number;
}

export interface CareStatsInput {
  hunger: number;
  hygiene: number;
  sleep: number;
  isSleeping: boolean;
}

export type NotificationActionType = 'feed' | 'clean' | 'sleep' | 'open';
export type PushDeliveryMode = 'webpush' | 'browser' | 'inapp' | 'off';

const DEFAULT_APP_TITLE = 'Miau — Seu Bichinho Virtual Interativo com IA';
const PREFS_STORAGE_PREFIX = 'miau_push_prefs_v1_';
const ALERT_STATE_PREFIX = 'miau_push_alert_state_v1_';
const NEED_ALERT_COOLDOWN_MS = 10 * 60 * 1000;

const DECAY_MS_PER_POINT: Record<CareNeedKey, number> = {
  hunger: 35_000,
  sleep: 70_000,
  hygiene: 105_000,
};

function defaultPrefs(): CarePushPreferences {
  return {
    enabled: false,
    threshold: 25,
    needs: {
      hunger: true,
      hygiene: true,
      sleep: true,
    },
    promptDismissedUntilMs: 0,
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function keysEqual(
  expected: Uint8Array,
  existingBuffer: ArrayBuffer | null | undefined
): boolean {
  if (!existingBuffer) return false;
  const existing = new Uint8Array(existingBuffer);
  if (expected.length !== existing.length) return false;
  for (let i = 0; i < expected.length; i += 1) {
    if (expected[i] !== existing[i]) return false;
  }
  return true;
}

function buildLocalCareNotification(
  need: CareNeedKey,
  petName: string,
  levelPct: number
): { title: string; payload: Record<string, unknown> } {
  const safeName = (petName || 'Miau').slice(0, 32);
  const pct = Math.max(0, Math.min(100, Math.round(levelPct)));

  if (need === 'hunger') {
    return {
      title: `🐟 ${safeName} está com muita fome (${pct}%)!`,
      payload: {
        body: `A comidinha do ${safeName} está bem baixa. Volte para alimentar seu bichinho!`,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: 'miau-need-hunger',
        renotify: true,
        need: 'hunger',
        action: 'feed',
        url: '/?miauAction=feed',
        actions: [
          { action: 'feed', title: '🐟 Alimentar agora' },
          { action: 'open', title: 'Abrir Miau' },
        ],
      },
    };
  }

  if (need === 'hygiene') {
    return {
      title: `🛁 ${safeName} precisa de banho (${pct}%)!`,
      payload: {
        body: `${safeName} está pedindo água fresquinha e sabonete. Venha dar banho nele!`,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: 'miau-need-hygiene',
        renotify: true,
        need: 'hygiene',
        action: 'clean',
        url: '/?miauAction=clean',
        actions: [
          { action: 'clean', title: '🛁 Dar banho' },
          { action: 'open', title: 'Abrir Miau' },
        ],
      },
    };
  }

  return {
    title: `🌙 ${safeName} está com muito sono (${pct}%)!`,
    payload: {
      body: `${safeName} está com olhinhos pesados. Volte ao app para colocá-lo para dormir!`,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: 'miau-need-sleep',
      renotify: true,
      need: 'sleep',
      action: 'sleep',
      url: '/?miauAction=sleep',
      actions: [
        { action: 'sleep', title: '🌙 Colocar para dormir' },
        { action: 'open', title: 'Abrir Miau' },
      ],
    },
  };
}

class PushNotificationService {
  private currentOwnerId = 'guest';
  private cachedSubscription: PushSubscription | null = null;
  private swRegistration: ServiceWorkerRegistration | null = null;
  private swListenerAttached = false;
  private actionHandler:
    | ((action: NotificationActionType, need: CareNeedKey | 'care') => void)
    | null = null;
  private lastAlertedAt: Record<CareNeedKey, number> = {
    hunger: 0,
    hygiene: 0,
    sleep: 0,
  };
  private alertLocked: Record<CareNeedKey, boolean> = {
    hunger: false,
    hygiene: false,
    sleep: false,
  };

  public isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator
    );
  }

  public isWebPushSupported(): boolean {
    return (
      this.isSupported() &&
      'PushManager' in window &&
      typeof PushManager !== 'undefined'
    );
  }

  public getPermission(): PushPermissionState {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission as PushPermissionState;
  }

  public hasActiveWebPushSubscription(): boolean {
    return Boolean(this.cachedSubscription?.endpoint);
  }

  public getDeliveryMode(ownerId = this.currentOwnerId): PushDeliveryMode {
    const prefs = this.getPrefs(ownerId);
    if (!prefs.enabled) return 'off';
    if (this.getPermission() === 'granted') {
      return this.hasActiveWebPushSubscription() ? 'webpush' : 'browser';
    }
    return 'inapp';
  }

  public setOwner(ownerId: string): void {
    const safeOwner = ownerId || 'guest';
    if (safeOwner !== this.currentOwnerId) {
      this.currentOwnerId = safeOwner;
      this.loadAlertState();
    }
  }

  public getPrefs(ownerId = this.currentOwnerId): CarePushPreferences {
    const safeOwner = ownerId || 'guest';
    try {
      const raw = localStorage.getItem(`${PREFS_STORAGE_PREFIX}${safeOwner}`);
      if (!raw) return defaultPrefs();
      const parsed = JSON.parse(raw) as Partial<CarePushPreferences>;
      return {
        enabled: Boolean(parsed.enabled),
        threshold:
          typeof parsed.threshold === 'number' &&
          parsed.threshold >= 10 &&
          parsed.threshold <= 45
            ? Math.round(parsed.threshold)
            : 25,
        needs: {
          hunger: parsed.needs?.hunger !== false,
          hygiene: parsed.needs?.hygiene !== false,
          sleep: parsed.needs?.sleep !== false,
        },
        promptDismissedUntilMs: Number(parsed.promptDismissedUntilMs) || 0,
      };
    } catch {
      return defaultPrefs();
    }
  }

  public savePrefs(
    prefs: CarePushPreferences,
    ownerId = this.currentOwnerId
  ): void {
    const safeOwner = ownerId || 'guest';
    try {
      localStorage.setItem(
        `${PREFS_STORAGE_PREFIX}${safeOwner}`,
        JSON.stringify(prefs)
      );
    } catch {
      // Ignore storage quota errors
    }
  }

  private loadAlertState(): void {
    try {
      const raw = localStorage.getItem(
        `${ALERT_STATE_PREFIX}${this.currentOwnerId}`
      );
      if (!raw) {
        this.lastAlertedAt = { hunger: 0, hygiene: 0, sleep: 0 };
        this.alertLocked = { hunger: false, hygiene: false, sleep: false };
        return;
      }
      const parsed = JSON.parse(raw) as {
        lastAlertedAt?: Partial<Record<CareNeedKey, number>>;
        alertLocked?: Partial<Record<CareNeedKey, boolean>>;
      };
      this.lastAlertedAt = {
        hunger: Number(parsed.lastAlertedAt?.hunger) || 0,
        hygiene: Number(parsed.lastAlertedAt?.hygiene) || 0,
        sleep: Number(parsed.lastAlertedAt?.sleep) || 0,
      };
      this.alertLocked = {
        hunger: Boolean(parsed.alertLocked?.hunger),
        hygiene: Boolean(parsed.alertLocked?.hygiene),
        sleep: Boolean(parsed.alertLocked?.sleep),
      };
    } catch {
      this.lastAlertedAt = { hunger: 0, hygiene: 0, sleep: 0 };
      this.alertLocked = { hunger: false, hygiene: false, sleep: false };
    }
  }

  private saveAlertState(): void {
    try {
      localStorage.setItem(
        `${ALERT_STATE_PREFIX}${this.currentOwnerId}`,
        JSON.stringify({
          lastAlertedAt: this.lastAlertedAt,
          alertLocked: this.alertLocked,
        })
      );
    } catch {
      // Ignore
    }
  }

  public dismissPromptTemporarily(days = 3): void {
    const prefs = this.getPrefs();
    prefs.promptDismissedUntilMs = Date.now() + days * 24 * 60 * 60 * 1000;
    this.savePrefs(prefs);
  }

  public shouldOfferRoomPrompt(): boolean {
    if (!this.isSupported()) return false;
    if (this.getPermission() === 'denied') return false;
    const prefs = this.getPrefs();
    if (prefs.enabled) return false;
    return Date.now() >= prefs.promptDismissedUntilMs;
  }

  public registerNotificationActionHandler(
    handler: (action: NotificationActionType, need: CareNeedKey | 'care') => void
  ): void {
    this.actionHandler = handler;
    if (
      !this.swListenerAttached &&
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator
    ) {
      this.swListenerAttached = true;
      navigator.serviceWorker.addEventListener('message', (event) => {
        const data = event.data as
          | {
              type?: string;
              action?: NotificationActionType;
              need?: CareNeedKey | 'care';
            }
          | undefined;
        if (data?.type === 'MIAU_NOTIFICATION_ACTION' && data.action) {
          this.actionHandler?.(data.action, data.need || 'care');
        }
      });
    }
  }

  public consumeInitialUrlAction(): NotificationActionType | null {
    if (typeof window === 'undefined') return null;
    try {
      const url = new URL(window.location.href);
      const action = url.searchParams.get('miauAction');
      if (
        action === 'feed' ||
        action === 'clean' ||
        action === 'sleep' ||
        action === 'open'
      ) {
        url.searchParams.delete('miauAction');
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
        return action;
      }
    } catch {
      // Ignore URL parse error
    }
    return null;
  }

  public async ensureServiceWorkerReady(): Promise<ServiceWorkerRegistration | null> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return null;
    }
    if (this.swRegistration) return this.swRegistration;

    try {
      const existing = await navigator.serviceWorker.getRegistration('/');
      if (existing) {
        this.swRegistration = existing;
      } else if (!import.meta.env.PROD) {
        this.swRegistration = await navigator.serviceWorker.register(
          '/miau-push-sw.js',
          { scope: '/' }
        );
      }

      const ready = await Promise.race<ServiceWorkerRegistration | null>([
        navigator.serviceWorker.ready,
        new Promise<ServiceWorkerRegistration | null>((resolve) =>
          window.setTimeout(() => resolve(this.swRegistration), 2200)
        ),
      ]);
      if (ready) {
        this.swRegistration = ready;
      }
      if (this.swRegistration) {
        void this.registerBackgroundCareSync(this.swRegistration);
      }
      return this.swRegistration;
    } catch {
      return null;
    }
  }

  private async registerBackgroundCareSync(
    reg: ServiceWorkerRegistration
  ): Promise<void> {
    const regWithSync = reg as ServiceWorkerRegistration & {
      periodicSync?: {
        register: (tag: string, options?: { minInterval: number }) => Promise<void>;
      };
      sync?: {
        register: (tag: string) => Promise<void>;
      };
    };
    try {
      if (regWithSync.periodicSync) {
        await regWithSync.periodicSync.register('miau-care-check', {
          minInterval: 15 * 60 * 1000,
        });
      }
    } catch {
      // Periodic Background Sync is optional and browser-gated
    }
    try {
      if (regWithSync.sync) {
        await regWithSync.sync.register('miau-care-sync');
      }
    } catch {
      // One-off Background Sync is optional
    }
  }

  public async syncCareSnapshotToServiceWorker(
    petName: string,
    stats: CareStatsInput
  ): Promise<void> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }
    const reg = await this.ensureServiceWorkerReady();
    const ctrl = reg?.active || navigator.serviceWorker.controller;
    if (!ctrl) return;
    const prefs = this.getPrefs();
    try {
      ctrl.postMessage({
        type: 'MIAU_SAVE_CARE_SNAPSHOT',
        snapshot: {
          ownerId: this.currentOwnerId,
          petName: (petName || 'Miau').slice(0, 32),
          prefs,
          stats: {
            hunger: stats.hunger,
            hygiene: stats.hygiene,
            sleep: stats.sleep,
            isSleeping: stats.isSleeping,
          },
          capturedAtMs: Date.now(),
          lastNotifiedAt: this.lastAlertedAt,
        },
      });
    } catch {
      // Ignore postMessage failures
    }
  }

  public getLowNeeds(
    stats: CareStatsInput,
    ownerId = this.currentOwnerId
  ): CareNeedKey[] {
    const prefs = this.getPrefs(ownerId);
    const order: CareNeedKey[] = ['hunger', 'hygiene', 'sleep'];
    return order.filter((need) => {
      if (!prefs.needs[need]) return false;
      if (need === 'sleep' && stats.isSleeping) return false;
      return stats[need] <= prefs.threshold;
    });
  }

  public updateAppBadgeAndTitle(
    petName: string,
    stats: CareStatsInput
  ): CareNeedKey[] {
    const prefs = this.getPrefs();
    const lowNeeds = prefs.enabled ? this.getLowNeeds(stats) : [];
    const count = lowNeeds.length;

    if (typeof navigator !== 'undefined') {
      const nav = navigator as Navigator & {
        setAppBadge?: (contents?: number) => Promise<void>;
        clearAppBadge?: () => Promise<void>;
      };
      try {
        if (count > 0 && typeof nav.setAppBadge === 'function') {
          void nav.setAppBadge(count);
        } else if (typeof nav.clearAppBadge === 'function') {
          void nav.clearAppBadge();
        }
      } catch {
        // Ignore unsupported App Badging API errors
      }
    }

    if (typeof document !== 'undefined') {
      if (count > 0) {
        const labels: Record<CareNeedKey, string> = {
          hunger: 'fome',
          hygiene: 'banho',
          sleep: 'sono',
        };
        const safeName = (petName || 'Miau').slice(0, 24);
        document.title = `🔔 (${count}) ${safeName} precisa de ${labels[lowNeeds[0]]}!`;
      } else {
        document.title = DEFAULT_APP_TITLE;
      }
    }

    return lowNeeds;
  }

  public async initializeRuntime(
    ownerId: string,
    petName: string,
    stats: CareStatsInput
  ): Promise<void> {
    this.setOwner(ownerId);
    const prefs = this.getPrefs(ownerId);
    this.updateAppBadgeAndTitle(petName, stats);

    const reg = await this.ensureServiceWorkerReady();
    if (reg && prefs.enabled) {
      void this.syncCareSnapshotToServiceWorker(petName, stats);
    }

    if (this.getPermission() !== 'granted' || !reg) return;

    try {
      if (this.isWebPushSupported()) {
        this.cachedSubscription = await reg.pushManager.getSubscription();
        if (prefs.enabled) {
          await this.subscribePushManager(reg, ownerId, petName, stats, prefs);
        }
      }
      if (prefs.enabled) {
        await this.syncWithServer(petName, stats, !document.hidden);
      }
    } catch {
      // Non-fatal: local SW & in-app notifications still work
    }
  }

  private async subscribePushManager(
    reg: ServiceWorkerRegistration,
    ownerId: string,
    petName: string,
    stats: CareStatsInput,
    prefs: CarePushPreferences
  ): Promise<PushSubscription | null> {
    if (!this.isWebPushSupported()) return null;
    try {
      const resp = await fetch('/api/push/vapid-public-key');
      if (!resp.ok) return null;
      const json = (await resp.json()) as {
        publicKey?: string;
        supported?: boolean;
      };
      if (!json.publicKey) return null;

      const keyBytes = urlBase64ToUint8Array(json.publicKey);
      let sub = await reg.pushManager.getSubscription();
      if (
        sub &&
        sub.options?.applicationServerKey &&
        !keysEqual(keyBytes, sub.options.applicationServerKey)
      ) {
        try {
          await sub.unsubscribe();
        } catch {
          // Ignore stale unsubscribe failures
        }
        sub = null;
      }

      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes as unknown as BufferSource,
        });
      }
      this.cachedSubscription = sub;
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          ownerId,
          petName,
          prefs,
          stats,
          appVisible: !document.hidden,
        }),
      });
      return sub;
    } catch {
      return null;
    }
  }

  public async enablePushNotifications(params: {
    ownerId: string;
    petName: string;
    stats: CareStatsInput;
  }): Promise<{
    permission: PushPermissionState;
    webPushActive: boolean;
    inAppActive: boolean;
  }> {
    this.setOwner(params.ownerId);
    const prefs = this.getPrefs();
    prefs.enabled = true;
    this.savePrefs(prefs);

    if (!this.isSupported()) {
      this.updateAppBadgeAndTitle(params.petName, params.stats);
      return {
        permission: 'unsupported',
        webPushActive: false,
        inAppActive: true,
      };
    }

    let permission = this.getPermission();
    if (permission === 'default') {
      try {
        permission = (await Notification.requestPermission()) as PushPermissionState;
      } catch {
        permission = 'denied';
      }
    }

    const reg = await this.ensureServiceWorkerReady();
    void this.syncCareSnapshotToServiceWorker(params.petName, params.stats);
    this.updateAppBadgeAndTitle(params.petName, params.stats);

    if (permission !== 'granted') {
      return { permission, webPushActive: false, inAppActive: true };
    }

    let webPushActive = false;
    if (reg) {
      const sub = await this.subscribePushManager(
        reg,
        params.ownerId,
        params.petName,
        params.stats,
        prefs
      );
      webPushActive = Boolean(sub?.endpoint);
      this.scheduleServiceWorkerFallbackReminders(params.petName, params.stats);
    }

    return { permission: 'granted', webPushActive, inAppActive: true };
  }

  public async disablePushNotifications(
    petName = 'Miau',
    stats?: CareStatsInput
  ): Promise<void> {
    const prefs = this.getPrefs();
    prefs.enabled = false;
    this.savePrefs(prefs);
    this.clearServiceWorkerFallbackReminders();
    if (stats) {
      this.updateAppBadgeAndTitle(petName, stats);
      void this.syncCareSnapshotToServiceWorker(petName, stats);
    } else if (typeof document !== 'undefined') {
      document.title = DEFAULT_APP_TITLE;
    }

    const sub = this.cachedSubscription;
    if (sub) {
      const endpoint = sub.endpoint;
      try {
        await sub.unsubscribe();
      } catch {
        // Ignore browser unsubscribe errors
      }
      this.cachedSubscription = null;
      try {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        });
      } catch {
        // Ignore network errors
      }
    }
  }

  public updateThreshold(
    threshold: number,
    petName: string,
    stats: CareStatsInput
  ): void {
    const prefs = this.getPrefs();
    prefs.threshold = Math.max(10, Math.min(45, Math.round(threshold)));
    this.savePrefs(prefs);
    this.alertLocked = { hunger: false, hygiene: false, sleep: false };
    this.saveAlertState();
    this.updateAppBadgeAndTitle(petName, stats);
    if (prefs.enabled) {
      void this.syncCareSnapshotToServiceWorker(petName, stats);
      if (this.getPermission() === 'granted') {
        this.scheduleServiceWorkerFallbackReminders(petName, stats);
        void this.syncWithServer(petName, stats, !document.hidden);
      }
    }
  }

  public toggleNeedEnabled(
    need: CareNeedKey,
    petName: string,
    stats: CareStatsInput
  ): boolean {
    const prefs = this.getPrefs();
    prefs.needs[need] = !prefs.needs[need];
    this.savePrefs(prefs);
    this.updateAppBadgeAndTitle(petName, stats);
    if (prefs.enabled) {
      void this.syncCareSnapshotToServiceWorker(petName, stats);
      if (this.getPermission() === 'granted') {
        this.scheduleServiceWorkerFallbackReminders(petName, stats);
        void this.syncWithServer(petName, stats, !document.hidden);
      }
    }
    return prefs.needs[need];
  }

  public async sendTestNotification(petName: string): Promise<{
    ok: boolean;
    via: 'webpush' | 'local' | 'inapp' | 'denied';
    message: string;
    previewTitle?: string;
    previewBody?: string;
  }> {
    const safeName = (petName || 'Miau').slice(0, 32);

    if (this.getPermission() !== 'granted') {
      const res = await this.enablePushNotifications({
        ownerId: this.currentOwnerId,
        petName: safeName,
        stats: { hunger: 80, hygiene: 90, sleep: 80, isSleeping: false },
      });
      if (res.permission !== 'granted') {
        return {
          ok: true,
          via: 'inapp',
          previewTitle: `🐾 ${safeName}: Lembretes no App ativos!`,
          previewBody: `Sem pop-up do sistema nesta janela, mas os alertas na barra, som e badge de cuidado do ${safeName} estão funcionando!`,
          message:
            'Alerta de teste exibido no app (modo sem pop-up do sistema)!',
        };
      }
    }

    if (this.cachedSubscription?.endpoint) {
      try {
        const resp = await fetch('/api/push/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: this.cachedSubscription.endpoint,
            petName: safeName,
          }),
        });
        if (resp.ok) {
          const data = (await resp.json()) as { sent?: boolean };
          if (data.sent) {
            return {
              ok: true,
              via: 'webpush',
              message: 'Notificação Push enviada pelo servidor!',
            };
          }
        }
      } catch {
        // Fallback to local SW notification below
      }
    }

    const shown = await this.showNotificationDirect(
      `🐾 ${safeName}: Notificações ativas!`,
      {
        body: `Quando a fome, o banho ou o sono do ${safeName} ficarem baixos, vamos avisar você!`,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: 'miau-push-test',
        renotify: true,
        need: 'care',
        action: 'open',
        url: '/',
        actions: [{ action: 'open', title: 'Cuidar do Miau 🐾' }],
      }
    );
    if (shown) {
      return {
        ok: true,
        via: 'local',
        message: 'Notificação de teste exibida com sucesso!',
      };
    }
    return {
      ok: true,
      via: 'inapp',
      previewTitle: `🐾 ${safeName}: Lembretes no App ativos!`,
      previewBody: `Avisaremos aqui sempre que a fome, o banho ou o sono do ${safeName} caírem!`,
      message: 'Alerta de teste exibido no app!',
    };
  }

  private async showNotificationDirect(
    title: string,
    payload: Record<string, unknown>
  ): Promise<boolean> {
    if (this.getPermission() !== 'granted') return false;
    const reg = await this.ensureServiceWorkerReady();
    if (reg) {
      try {
        if (reg.active) {
          reg.active.postMessage({
            type: 'MIAU_SHOW_NOTIFICATION',
            payload: { title, ...payload },
          });
          return true;
        }
        await reg.showNotification(title, payload as NotificationOptions);
        return true;
      } catch {
        // Try Notification constructor below
      }
    }
    try {
      const notif = new Notification(title, {
        body: String(payload.body || ''),
        icon: String(payload.icon || '/pwa-192x192.png'),
        tag: String(payload.tag || 'miau-care-alert'),
      });
      notif.onclick = () => {
        window.focus();
        const act = (payload.action as NotificationActionType) || 'open';
        const need = (payload.need as CareNeedKey | 'care') || 'care';
        this.actionHandler?.(act, need);
        notif.close();
      };
      return true;
    } catch {
      return false;
    }
  }

  public clearServiceWorkerFallbackReminders(): void {
    const ctrl =
      this.swRegistration?.active || navigator.serviceWorker?.controller;
    ctrl?.postMessage({ type: 'MIAU_CLEAR_SCHEDULED_REMINDERS' });
  }

  public scheduleServiceWorkerFallbackReminders(
    petName: string,
    stats: CareStatsInput
  ): void {
    const prefs = this.getPrefs();
    if (!prefs.enabled || this.getPermission() !== 'granted') {
      this.clearServiceWorkerFallbackReminders();
      return;
    }
    if (stats.isSleeping) {
      this.clearServiceWorkerFallbackReminders();
      return;
    }

    const ctrl =
      this.swRegistration?.active || navigator.serviceWorker?.controller;
    if (!ctrl) return;

    const reminders: Array<{
      need: CareNeedKey;
      delayMs: number;
      title: string;
      payload: Record<string, unknown>;
    }> = [];

    (['hunger', 'hygiene', 'sleep'] as CareNeedKey[]).forEach((need) => {
      if (!prefs.needs[need]) return;
      const current = stats[need];
      const deltaPoints = Math.max(1, current - prefs.threshold);
      const delayMs =
        current <= prefs.threshold
          ? 25_000
          : deltaPoints * DECAY_MS_PER_POINT[need];
      const msg = buildLocalCareNotification(
        need,
        petName,
        Math.min(current, prefs.threshold)
      );
      reminders.push({
        need,
        delayMs,
        title: msg.title,
        payload: msg.payload,
      });
    });

    ctrl.postMessage({
      type: 'MIAU_SCHEDULE_CARE_REMINDERS',
      reminders,
    });
  }

  public async evaluateAndNotifyLowNeeds(params: {
    ownerId: string;
    petName: string;
    stats: CareStatsInput;
    soundEnabled: boolean;
  }): Promise<CareNeedKey | null> {
    this.setOwner(params.ownerId);
    const prefs = this.getPrefs(params.ownerId);
    this.updateAppBadgeAndTitle(params.petName, params.stats);
    if (prefs.enabled) {
      void this.syncCareSnapshotToServiceWorker(params.petName, params.stats);
    }

    // Desbloqueia histerese quando a necessidade foi bem cuidada (+15% acima do limite)
    let stateChanged = false;
    (['hunger', 'hygiene', 'sleep'] as CareNeedKey[]).forEach((need) => {
      if (
        this.alertLocked[need] &&
        params.stats[need] >= prefs.threshold + 15
      ) {
        this.alertLocked[need] = false;
        stateChanged = true;
      }
    });
    if (stateChanged) this.saveAlertState();

    if (!prefs.enabled) {
      return null;
    }

    const now = Date.now();
    const order: CareNeedKey[] = ['hunger', 'hygiene', 'sleep'];
    const pendingNeed = order.find((need) => {
      if (!prefs.needs[need]) return false;
      if (need === 'sleep' && params.stats.isSleeping) return false;
      if (params.stats[need] > prefs.threshold) return false;
      if (this.alertLocked[need]) return false;
      if (now - this.lastAlertedAt[need] < NEED_ALERT_COOLDOWN_MS) return false;
      return true;
    });

    if (!pendingNeed) return null;

    this.alertLocked[pendingNeed] = true;
    this.lastAlertedAt[pendingNeed] = now;
    this.saveAlertState();

    let notified = false;
    if (this.getPermission() === 'granted') {
      const msg = buildLocalCareNotification(
        pendingNeed,
        params.petName,
        params.stats[pendingNeed]
      );
      notified = await this.showNotificationDirect(msg.title, msg.payload);
    } else {
      notified = true;
    }

    if (
      notified &&
      params.soundEnabled &&
      soundService.enabled &&
      !document.hidden
    ) {
      soundService.playMeow(1.08);
    }

    if (this.cachedSubscription?.endpoint) {
      void this.syncWithServer(
        params.petName,
        params.stats,
        !document.hidden,
        pendingNeed
      );
    }

    return pendingNeed;
  }

  public async syncWithServer(
    petName: string,
    stats: CareStatsInput,
    appVisible: boolean,
    notifiedNeed?: CareNeedKey
  ): Promise<void> {
    const endpoint = this.cachedSubscription?.endpoint;
    if (!endpoint) return;
    const prefs = this.getPrefs();
    try {
      await fetch('/api/push/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint,
          petName,
          prefs,
          stats,
          appVisible,
          notifiedNeed,
        }),
        keepalive: true,
      });
    } catch {
      // Ignore offline/network sync failures
    }
  }

  public syncWithServerOnHide(petName: string, stats: CareStatsInput): void {
    const prefs = this.getPrefs();
    this.updateAppBadgeAndTitle(petName, stats);
    if (prefs.enabled) {
      void this.syncCareSnapshotToServiceWorker(petName, stats);
      if (this.getPermission() === 'granted') {
        this.scheduleServiceWorkerFallbackReminders(petName, stats);
      }
    }
    const endpoint = this.cachedSubscription?.endpoint;
    if (!endpoint) return;
    const payload = JSON.stringify({
      endpoint,
      petName,
      prefs,
      stats,
      appVisible: false,
    });
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/api/push/sync', blob);
      return;
    }
    void this.syncWithServer(petName, stats, false);
  }
}

export const pushNotificationService = new PushNotificationService();
