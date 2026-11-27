import { getTodayDateKey } from '../constants';

export type ScreenLimitOption = 0 | 15 | 30 | 45 | 60 | 90;

export const SCREEN_LIMIT_OPTIONS: ScreenLimitOption[] = [0, 15, 30, 45, 60, 90];

export interface ParentalControlConfig {
  ownerId: string;
  pinHash: string;
  dailyScreenLimitMin: number;
  quietHoursEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  strictAiFilter: boolean;
  dailyMinutesByDate: Record<string, number>;
  dailyLessonsByDate: Record<string, number>;
  screenLockBypassDateKey: string;
  screenLockBypassUntilMs: number;
  updatedAtMs: number;
}

export interface AdultMathChallenge {
  question: string;
  answer: number;
}

export interface WeeklyDaySummary {
  dateKey: string;
  weekdayLabel: string;
  minutes: number;
  lessons: number;
}

export interface WeeklySummary {
  days: WeeklyDaySummary[];
  totalMinutes: number;
  totalLessons: number;
  todayMinutes: number;
  todayLessons: number;
}

export interface ScreenLimitStatus {
  limitMinutes: number;
  usedMinutes: number;
  remainingMinutes: number;
  locked: boolean;
  bypassActive: boolean;
}

const STORAGE_PREFIX = 'miau_parental_control_v1_';
const SECONDS_ACC_PREFIX = 'miau_parental_sec_acc_v1_';
const DATE_KEY_RX = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM_RX = /^([01]\d|2[0-3]):([0-5]\d)$/;

let parentalSaveListener:
  | ((ownerId: string, config: ParentalControlConfig) => void)
  | null = null;

export function registerParentalSaveListener(
  listener: ((ownerId: string, config: ParentalControlConfig) => void) | null
): void {
  parentalSaveListener = listener;
}

export function createDefaultParentalControlConfig(
  ownerId = 'guest'
): ParentalControlConfig {
  return {
    ownerId: ownerId || 'guest',
    pinHash: '',
    dailyScreenLimitMin: 0,
    quietHoursEnabled: false,
    quietStart: '22:00',
    quietEnd: '07:00',
    strictAiFilter: false,
    dailyMinutesByDate: {},
    dailyLessonsByDate: {},
    screenLockBypassDateKey: '',
    screenLockBypassUntilMs: 0,
    updatedAtMs: 0,
  };
}

function sanitizeHhMm(val: unknown, fallback: string): string {
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  return HH_MM_RX.test(trimmed) ? trimmed : fallback;
}

function sanitizeDailyCounterMap(
  raw: unknown,
  maxVal: number
): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {};
  const entries = Object.entries(raw as Record<string, unknown>)
    .filter(([k, v]) => DATE_KEY_RX.test(k) && typeof v === 'number' && Number.isFinite(v))
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 14);
  const out: Record<string, number> = {};
  for (const [k, v] of entries) {
    out[k] = Math.max(0, Math.min(maxVal, Math.round(Number(v))));
  }
  return out;
}

export function normalizeParentalControlConfig(
  ownerId: string,
  raw?: Partial<ParentalControlConfig> | null
): ParentalControlConfig {
  const safeOwner = (ownerId || raw?.ownerId || 'guest').slice(0, 128);
  const defaults = createDefaultParentalControlConfig(safeOwner);
  const limitRaw = Number(raw?.dailyScreenLimitMin ?? 0);
  const dailyScreenLimitMin = Number.isFinite(limitRaw)
    ? Math.max(0, Math.min(480, Math.round(limitRaw)))
    : 0;
  const bypassDate =
    typeof raw?.screenLockBypassDateKey === 'string' &&
    DATE_KEY_RX.test(raw.screenLockBypassDateKey.trim())
      ? raw.screenLockBypassDateKey.trim()
      : '';
  const bypassUntilRaw = Number(raw?.screenLockBypassUntilMs ?? 0);
  const screenLockBypassUntilMs =
    Number.isFinite(bypassUntilRaw) && bypassUntilRaw > 0
      ? Math.min(9_999_999_999_999, Math.round(bypassUntilRaw))
      : 0;

  return {
    ownerId: safeOwner,
    pinHash:
      typeof raw?.pinHash === 'string' ? raw.pinHash.trim().slice(0, 64) : '',
    dailyScreenLimitMin,
    quietHoursEnabled: Boolean(raw?.quietHoursEnabled),
    quietStart: sanitizeHhMm(raw?.quietStart, defaults.quietStart),
    quietEnd: sanitizeHhMm(raw?.quietEnd, defaults.quietEnd),
    strictAiFilter: Boolean(raw?.strictAiFilter),
    dailyMinutesByDate: sanitizeDailyCounterMap(raw?.dailyMinutesByDate, 1440),
    dailyLessonsByDate: sanitizeDailyCounterMap(raw?.dailyLessonsByDate, 1000),
    screenLockBypassDateKey: bypassDate,
    screenLockBypassUntilMs,
    updatedAtMs:
      typeof raw?.updatedAtMs === 'number' && Number.isFinite(raw.updatedAtMs)
        ? raw.updatedAtMs
        : 0,
  };
}

export function mergeParentalControlConfigs(
  local: ParentalControlConfig,
  remote: ParentalControlConfig | null
): ParentalControlConfig {
  if (!remote) return normalizeParentalControlConfig(local.ownerId, local);

  const mergedMinutes: Record<string, number> = { ...local.dailyMinutesByDate };
  for (const [k, v] of Object.entries(remote.dailyMinutesByDate)) {
    mergedMinutes[k] = Math.max(mergedMinutes[k] || 0, v);
  }

  const mergedLessons: Record<string, number> = { ...local.dailyLessonsByDate };
  for (const [k, v] of Object.entries(remote.dailyLessonsByDate)) {
    mergedLessons[k] = Math.max(mergedLessons[k] || 0, v);
  }

  const remoteNewer = (remote.updatedAtMs || 0) > (local.updatedAtMs || 0);
  const primary = remoteNewer ? remote : local;

  return normalizeParentalControlConfig(local.ownerId, {
    ...primary,
    dailyMinutesByDate: sanitizeDailyCounterMap(mergedMinutes, 1440),
    dailyLessonsByDate: sanitizeDailyCounterMap(mergedLessons, 1000),
    screenLockBypassUntilMs: Math.max(
      local.screenLockBypassUntilMs || 0,
      remote.screenLockBypassUntilMs || 0
    ),
    screenLockBypassDateKey:
      local.screenLockBypassDateKey >= remote.screenLockBypassDateKey
        ? local.screenLockBypassDateKey
        : remote.screenLockBypassDateKey,
    updatedAtMs: Math.max(local.updatedAtMs || 0, remote.updatedAtMs || 0),
  });
}

export function loadParentalControlConfig(
  ownerId = 'guest'
): ParentalControlConfig {
  const safeOwner = ownerId || 'guest';
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${safeOwner}`);
    if (!raw) return createDefaultParentalControlConfig(safeOwner);
    const parsed = JSON.parse(raw) as Partial<ParentalControlConfig>;
    return normalizeParentalControlConfig(safeOwner, parsed);
  } catch {
    return createDefaultParentalControlConfig(safeOwner);
  }
}

export function saveParentalControlConfig(
  config: ParentalControlConfig,
  options?: { notifyListener?: boolean }
): ParentalControlConfig {
  const normalized = normalizeParentalControlConfig(config.ownerId, {
    ...config,
    updatedAtMs: Date.now(),
  });
  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${normalized.ownerId}`,
      JSON.stringify(normalized)
    );
  } catch {
    // Ignore storage errors
  }
  if (options?.notifyListener !== false) {
    parentalSaveListener?.(normalized.ownerId, normalized);
  }
  return normalized;
}

export function hashParentalPin(rawPin: string): string {
  const clean = rawPin.replace(/\D/g, '').slice(0, 4);
  if (clean.length !== 4) return '';
  const salted = `miau::parental::${clean}::v1`;
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b1;
  for (let i = 0; i < salted.length; i += 1) {
    const code = salted.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= code + i * 17;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return `pin1_${h1.toString(16).padStart(8, '0')}_${h2.toString(16).padStart(8, '0')}`;
}

export function verifyParentalPin(
  rawPin: string,
  storedHash: string
): boolean {
  if (!storedHash) return false;
  const candidate = hashParentalPin(rawPin);
  return Boolean(candidate) && candidate === storedHash;
}

export function setParentalPin(
  ownerId: string,
  rawPin: string
): { ok: boolean; config: ParentalControlConfig; error?: string } {
  const clean = rawPin.replace(/\D/g, '');
  if (clean.length !== 4) {
    return {
      ok: false,
      config: loadParentalControlConfig(ownerId),
      error: 'Digite exatamente 4 dígitos numéricos para o PIN.',
    };
  }
  const current = loadParentalControlConfig(ownerId);
  const updated = saveParentalControlConfig({
    ...current,
    pinHash: hashParentalPin(clean),
  });
  return { ok: true, config: updated };
}

export function clearParentalPin(ownerId: string): ParentalControlConfig {
  const current = loadParentalControlConfig(ownerId);
  return saveParentalControlConfig({
    ...current,
    pinHash: '',
  });
}

export function generateAdultMathChallenge(seed?: number): AdultMathChallenge {
  const r = (min: number, max: number, offset = 0): number => {
    if (typeof seed === 'number' && Number.isFinite(seed)) {
      const span = max - min + 1;
      return min + (Math.abs(Math.floor(seed + offset)) % span);
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };
  const a = r(6, 9, 1);
  const b = r(4, 9, 3);
  const c = r(3, 12, 7);
  return {
    question: `Quanto é (${a} × ${b}) + ${c}?`,
    answer: a * b + c,
  };
}

export function parseHhMmToMinutes(hhMm: string): number | null {
  const match = HH_MM_RX.exec(hhMm.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function isTimeWindowActive(
  enabled: boolean,
  startHhMm: string,
  endHhMm: string,
  currentMinutesOfDay: number
): boolean {
  if (!enabled) return false;
  const start = parseHhMmToMinutes(startHhMm);
  const end = parseHhMmToMinutes(endHhMm);
  if (start === null || end === null || start === end) return false;
  const cur = ((Math.floor(currentMinutesOfDay) % 1440) + 1440) % 1440;
  if (start < end) {
    return cur >= start && cur < end;
  }
  // Overnight window (e.g. 22:00 -> 07:00)
  return cur >= start || cur < end;
}

export function isWithinQuietHours(
  config: ParentalControlConfig,
  now: Date = new Date()
): boolean {
  const curMinutes = now.getHours() * 60 + now.getMinutes();
  return isTimeWindowActive(
    config.quietHoursEnabled,
    config.quietStart,
    config.quietEnd,
    curMinutes
  );
}

export function recordActiveSeconds(
  ownerId: string,
  seconds: number,
  nowMs = Date.now()
): { config: ParentalControlConfig; minutesAdded: number } {
  const safeOwner = ownerId || 'guest';
  const safeSeconds = Math.max(0, Math.min(300, Math.round(seconds)));
  const config = loadParentalControlConfig(safeOwner);
  if (safeSeconds <= 0) return { config, minutesAdded: 0 };

  const today = getTodayDateKey(new Date(nowMs));
  let accSeconds = 0;
  try {
    const raw = localStorage.getItem(`${SECONDS_ACC_PREFIX}${safeOwner}`);
    if (raw) {
      const parsed = JSON.parse(raw) as { dateKey?: string; seconds?: number };
      if (parsed.dateKey === today && typeof parsed.seconds === 'number') {
        accSeconds = Math.max(0, parsed.seconds);
      }
    }
  } catch {
    accSeconds = 0;
  }

  const totalSec = accSeconds + safeSeconds;
  const minutesAdded = Math.floor(totalSec / 60);
  const remSec = totalSec % 60;

  try {
    localStorage.setItem(
      `${SECONDS_ACC_PREFIX}${safeOwner}`,
      JSON.stringify({ dateKey: today, seconds: remSec })
    );
  } catch {
    // Ignore storage error
  }

  if (minutesAdded <= 0) {
    return { config, minutesAdded: 0 };
  }

  const nextMinutes = Math.min(
    1440,
    (config.dailyMinutesByDate[today] || 0) + minutesAdded
  );
  const updated = saveParentalControlConfig({
    ...config,
    dailyMinutesByDate: {
      ...config.dailyMinutesByDate,
      [today]: nextMinutes,
    },
  });
  return { config: updated, minutesAdded };
}

export function recordCompletedLesson(
  ownerId: string,
  count = 1,
  nowMs = Date.now()
): ParentalControlConfig {
  const safeOwner = ownerId || 'guest';
  const delta = Math.max(1, Math.min(20, Math.round(count)));
  const today = getTodayDateKey(new Date(nowMs));
  const config = loadParentalControlConfig(safeOwner);
  const nextCount = Math.min(1000, (config.dailyLessonsByDate[today] || 0) + delta);
  return saveParentalControlConfig({
    ...config,
    dailyLessonsByDate: {
      ...config.dailyLessonsByDate,
      [today]: nextCount,
    },
  });
}

const WEEKDAY_SHORT_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function getWeeklySummary(
  config: ParentalControlConfig,
  nowMs = Date.now()
): WeeklySummary {
  const days: WeeklyDaySummary[] = [];
  let totalMinutes = 0;
  let totalLessons = 0;

  for (let offset = 6; offset >= 0; offset -= 1) {
    const d = new Date(nowMs - offset * 24 * 60 * 60 * 1000);
    const dateKey = getTodayDateKey(d);
    const minutes = config.dailyMinutesByDate[dateKey] || 0;
    const lessons = config.dailyLessonsByDate[dateKey] || 0;
    totalMinutes += minutes;
    totalLessons += lessons;
    days.push({
      dateKey,
      weekdayLabel: offset === 0 ? 'Hoje' : WEEKDAY_SHORT_PT[d.getDay()],
      minutes,
      lessons,
    });
  }

  const today = days[days.length - 1];
  return {
    days,
    totalMinutes,
    totalLessons,
    todayMinutes: today?.minutes || 0,
    todayLessons: today?.lessons || 0,
  };
}

export function getScreenLimitStatus(
  config: ParentalControlConfig,
  nowMs = Date.now()
): ScreenLimitStatus {
  const limitMinutes = Math.max(0, config.dailyScreenLimitMin || 0);
  const today = getTodayDateKey(new Date(nowMs));
  const usedMinutes = config.dailyMinutesByDate[today] || 0;

  if (limitMinutes <= 0) {
    return {
      limitMinutes: 0,
      usedMinutes,
      remainingMinutes: Infinity,
      locked: false,
      bypassActive: false,
    };
  }

  const bypassActive =
    config.screenLockBypassDateKey === today ||
    config.screenLockBypassUntilMs > nowMs;
  const remainingMinutes = Math.max(0, limitMinutes - usedMinutes);
  const locked = !bypassActive && usedMinutes >= limitMinutes;

  return {
    limitMinutes,
    usedMinutes,
    remainingMinutes,
    locked,
    bypassActive,
  };
}

export function unlockScreenLimitTemporarily(
  ownerId: string,
  extraMinutes = 0,
  nowMs = Date.now()
): ParentalControlConfig {
  const current = loadParentalControlConfig(ownerId);
  const today = getTodayDateKey(new Date(nowMs));
  if (extraMinutes > 0) {
    return saveParentalControlConfig({
      ...current,
      screenLockBypassDateKey: '',
      screenLockBypassUntilMs: nowMs + extraMinutes * 60_000,
    });
  }
  return saveParentalControlConfig({
    ...current,
    screenLockBypassDateKey: today,
    screenLockBypassUntilMs: 0,
  });
}
