/* Service Worker para Notificações Push e Lembretes em Segundo Plano do Miau */

const CARE_CACHE_NAME = 'miau-care-snapshot-v1';
const CARE_CACHE_URL = '/__miau_care_snapshot__.json';
const DECAY_MS_PER_POINT = {
  hunger: 35000,
  sleep: 70000,
  hygiene: 105000,
};
const NEED_RENOTIFY_COOLDOWN_MS = 30 * 60 * 1000;
const scheduledCareTimers = new Map();

function buildNotificationOptions(payload) {
  const data = payload || {};
  return {
    body:
      data.body ||
      'O Miau está sentindo sua falta! Volte ao app para cuidar do seu bichinho.',
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-192x192.png',
    tag: data.tag || 'miau-care-alert',
    renotify: Boolean(data.renotify),
    vibrate: data.vibrate || [160, 80, 180],
    requireInteraction: Boolean(data.requireInteraction),
    data: {
      need: data.need || 'care',
      action: data.action || 'open',
      url: data.url || '/',
    },
    actions: Array.isArray(data.actions) ? data.actions : [],
  };
}

function buildNeedAlert(need, petName, levelPct) {
  const safeName = String(petName || 'Miau').slice(0, 32);
  const pct = Math.max(0, Math.min(100, Math.round(levelPct)));

  if (need === 'hunger') {
    return {
      title: `🐟 ${safeName} está com muita fome (${pct}%)!`,
      payload: {
        body: `A barrinha de comida do ${safeName} está bem baixinha. Volte ao app para dar um petisco gostoso!`,
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
      title: `🛁 Hora do banho do ${safeName} (${pct}%)!`,
      payload: {
        body: `${safeName} precisa de água fresquinha e sabonete para ficar cheiroso! Venha cuidar dele.`,
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
      body: `${safeName} está bocejando e precisa tirar uma soneca quentinha. Volte para colocá-lo na caminha!`,
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

async function saveCareSnapshotToCache(snapshot) {
  try {
    const cache = await caches.open(CARE_CACHE_NAME);
    await cache.put(
      CARE_CACHE_URL,
      new Response(JSON.stringify(snapshot), {
        headers: { 'Content-Type': 'application/json' },
      })
    );
  } catch {
    // Ignore storage errors
  }
}

async function loadCareSnapshotFromCache() {
  try {
    const cache = await caches.open(CARE_CACHE_NAME);
    const resp = await cache.match(CARE_CACHE_URL);
    if (!resp) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

async function evaluateSavedSnapshotAndNotify() {
  const snap = await loadCareSnapshotFromCache();
  if (!snap || !snap.prefs || !snap.prefs.enabled || !snap.stats) return;

  const now = Date.now();
  const capturedAtMs = Number(snap.capturedAtMs) || now;
  const elapsedMs = Math.max(0, now - capturedAtMs);
  const threshold = Number(snap.prefs.threshold) || 25;
  const lastNotifiedAt = snap.lastNotifiedAt || {
    hunger: 0,
    hygiene: 0,
    sleep: 0,
  };

  for (const need of ['hunger', 'hygiene', 'sleep']) {
    if (snap.prefs.needs && snap.prefs.needs[need] === false) continue;
    if (need === 'sleep' && snap.stats.isSleeping) continue;
    const base = Number(snap.stats[need] ?? 100);
    const lost = snap.stats.isSleeping
      ? 0
      : Math.floor(elapsedMs / DECAY_MS_PER_POINT[need]);
    const floorVal = need === 'hygiene' ? 8 : 5;
    const estimated = Math.max(floorVal, base - lost);
    if (estimated > threshold) continue;
    if (now - Number(lastNotifiedAt[need] || 0) < NEED_RENOTIFY_COOLDOWN_MS) {
      continue;
    }

    lastNotifiedAt[need] = now;
    snap.lastNotifiedAt = lastNotifiedAt;
    await saveCareSnapshotToCache(snap);
    const alert = buildNeedAlert(need, snap.petName, estimated);
    await self.registration.showNotification(
      alert.title,
      buildNotificationOptions(alert.payload)
    );
    break;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }
  const title = payload.title || 'Miau precisa de você! 🐾';
  const options = buildNotificationOptions(payload);
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'miau-care-check') {
    event.waitUntil(evaluateSavedSnapshotAndNotify());
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'miau-care-sync') {
    event.waitUntil(evaluateSavedSnapshotAndNotify());
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const action =
    event.action && event.action !== 'dismiss'
      ? event.action
      : data.action || 'open';
  const need = data.need || 'care';
  const targetUrl =
    action && action !== 'open'
      ? `/?miauAction=${encodeURIComponent(action)}`
      : data.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            client.postMessage({
              type: 'MIAU_NOTIFICATION_ACTION',
              action,
              need,
            });
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      })
  );
});

self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'MIAU_SHOW_NOTIFICATION' && msg.payload) {
    const title = msg.payload.title || 'Miau precisa de você! 🐾';
    event.waitUntil(
      self.registration.showNotification(
        title,
        buildNotificationOptions(msg.payload)
      )
    );
    return;
  }

  if (msg.type === 'MIAU_SAVE_CARE_SNAPSHOT' && msg.snapshot) {
    event.waitUntil(saveCareSnapshotToCache(msg.snapshot));
    return;
  }

  if (msg.type === 'MIAU_CLEAR_SCHEDULED_REMINDERS') {
    for (const id of scheduledCareTimers.values()) {
      clearTimeout(id);
    }
    scheduledCareTimers.clear();
    return;
  }

  if (
    msg.type === 'MIAU_SCHEDULE_CARE_REMINDERS' &&
    Array.isArray(msg.reminders)
  ) {
    for (const id of scheduledCareTimers.values()) {
      clearTimeout(id);
    }
    scheduledCareTimers.clear();

    for (const reminder of msg.reminders) {
      if (!reminder || !reminder.need || typeof reminder.delayMs !== 'number') {
        continue;
      }
      const delay = Math.max(5000, Math.min(reminder.delayMs, 6 * 60 * 60 * 1000));
      const timerId = setTimeout(() => {
        scheduledCareTimers.delete(reminder.need);
        void self.registration.showNotification(
          reminder.title || 'Miau precisa de carinho! 🐾',
          buildNotificationOptions(reminder.payload)
        );
      }, delay);
      scheduledCareTimers.set(reminder.need, timerId);
    }
  }
});
