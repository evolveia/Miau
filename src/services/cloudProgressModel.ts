import type { CloudSyncTrackId, DailyEconomyPayload } from './cloudProgressHooks';

export const VALID_CLOUD_EDUCATION_TRACKS: ReadonlyArray<CloudSyncTrackId> = [
  'infantil_letras',
  'infantil_escrita',
  'infantil_escrita_consoantes',
  'infantil_consoantes',
  'infantil_cores_numeros',
  'infantil_soma_subtracao',
  'infantil_matematica_desafios',
  'infantil_natureza',
  'infantil_comidas_bebidas',
  'fund1_leitura',
  'fund1_matematica',
  'fund1_ciencias',
  'fund2_logica',
  'fund2_ciencias',
  'fund2_historia',
];

export interface CloudEducationTrackSnapshot {
  ownerId: string;
  trackId: CloudSyncTrackId;
  completedUnits: string[];
  unitBestStars: Record<string, number>;
  letterBestStars: Record<string, number>;
  totalStars: number;
  streakDays: number;
  bestStreakDays: number;
  lastStudyDateKey: string;
  masteredPrimary: string[];
  masteredTargets: string[];
  unlockedStickers: string[];
  freeExploreUnlocked: boolean;
  totalLessonsCompleted: number;
  dailyDateKey: string;
  dailyStepsCount: number;
  dailyCompletedTargets: string[];
  dailyBonusClaimedDateKey: string;
}

function clampInt(val: unknown, min: number, max: number, fallback = min): number {
  const n = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function uniqueStringList(
  raw: unknown,
  maxItems: number,
  maxLen: number
): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim().slice(0, maxLen);
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= maxItems) break;
  }
  return out;
}

function sanitizeStarsMap(
  raw: unknown,
  maxKeys: number,
  maxKeyLen: number
): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, number> = {};
  let count = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const cleanKey = k.trim().slice(0, maxKeyLen);
    if (!cleanKey) continue;
    out[cleanKey] = clampInt(v, 0, 3, 0);
    count += 1;
    if (count >= maxKeys) break;
  }
  return out;
}

function sanitizeDateKey(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : '';
}

export function normalizeEducationTrackSnapshot(
  ownerId: string,
  trackId: CloudSyncTrackId,
  raw: unknown
): CloudEducationTrackSnapshot {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const primaryRaw =
    Array.isArray(src.masteredPrimary)
      ? src.masteredPrimary
      : trackId === 'infantil_letras' || trackId === 'infantil_escrita'
        ? src.masteredVowels
        : trackId === 'infantil_consoantes' ||
            trackId === 'infantil_escrita_consoantes'
          ? src.masteredConsonants
          : src.masteredTags;

  const stickersRaw = Array.isArray(src.unlockedStickers)
    ? src.unlockedStickers
    : src.unlockedMedals;

  const lessonsRaw =
    typeof src.totalLessonsCompleted === 'number'
      ? src.totalLessonsCompleted
      : src.totalPracticesCompleted;

  const unitBestStars = sanitizeStarsMap(src.unitBestStars, 30, 48);
  const letterBestStars = sanitizeStarsMap(src.letterBestStars, 60, 32);
  const computedUnitStars = Object.values(unitBestStars).reduce((a, b) => a + b, 0);
  const streakDays = clampInt(src.streakDays, 0, 10000, 0);

  return {
    ownerId: ownerId.slice(0, 128),
    trackId,
    completedUnits: uniqueStringList(src.completedUnits, 30, 48),
    unitBestStars,
    letterBestStars,
    totalStars: clampInt(src.totalStars, computedUnitStars, 500, computedUnitStars),
    streakDays,
    bestStreakDays: clampInt(src.bestStreakDays, streakDays, 10000, streakDays),
    lastStudyDateKey: sanitizeDateKey(src.lastStudyDateKey),
    masteredPrimary: uniqueStringList(primaryRaw, 40, 48),
    masteredTargets: uniqueStringList(src.masteredTargets, 150, 48),
    unlockedStickers: uniqueStringList(stickersRaw, 60, 64),
    freeExploreUnlocked: Boolean(src.freeExploreUnlocked),
    totalLessonsCompleted: clampInt(lessonsRaw, 0, 1000000, 0),
    dailyDateKey: sanitizeDateKey(src.dailyDateKey),
    dailyStepsCount: clampInt(src.dailyStepsCount, 0, 1000, 0),
    dailyCompletedTargets: uniqueStringList(src.dailyCompletedTargets, 60, 32),
    dailyBonusClaimedDateKey: sanitizeDateKey(src.dailyBonusClaimedDateKey),
  };
}

function mergeStringArrays(a: string[], b: string[], maxItems: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of [...a, ...b]) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
    if (out.length >= maxItems) break;
  }
  return out;
}

function mergeMaxStarsMap(
  a: Record<string, number>,
  b: Record<string, number>,
  maxKeys: number
): Record<string, number> {
  const out: Record<string, number> = {};
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).slice(
    0,
    maxKeys
  );
  for (const key of keys) {
    out[key] = Math.max(a[key] ?? 0, b[key] ?? 0);
  }
  return out;
}

export function mergeEducationTrackSnapshots(
  local: CloudEducationTrackSnapshot,
  remote: CloudEducationTrackSnapshot,
  todayDateKey: string
): CloudEducationTrackSnapshot {
  const unitBestStars = mergeMaxStarsMap(local.unitBestStars, remote.unitBestStars, 30);
  const letterBestStars = mergeMaxStarsMap(
    local.letterBestStars,
    remote.letterBestStars,
    60
  );
  const recomputedUnitStars = Object.values(unitBestStars).reduce((s, v) => s + v, 0);
  const totalStars = Math.max(
    recomputedUnitStars,
    local.totalStars,
    remote.totalStars
  );

  const lastStudyDateKey =
    local.lastStudyDateKey >= remote.lastStudyDateKey
      ? local.lastStudyDateKey
      : remote.lastStudyDateKey;

  const sameStudyDay =
    local.lastStudyDateKey && local.lastStudyDateKey === remote.lastStudyDateKey;
  const streakDays = sameStudyDay
    ? Math.max(local.streakDays, remote.streakDays)
    : local.lastStudyDateKey === lastStudyDateKey
      ? local.streakDays
      : remote.streakDays;

  const dailyTodayLocal = local.dailyDateKey === todayDateKey;
  const dailyTodayRemote = remote.dailyDateKey === todayDateKey;
  const dailyCompletedTargets =
    dailyTodayLocal && dailyTodayRemote
      ? mergeStringArrays(
          local.dailyCompletedTargets,
          remote.dailyCompletedTargets,
          60
        )
      : dailyTodayLocal
        ? local.dailyCompletedTargets
        : dailyTodayRemote
          ? remote.dailyCompletedTargets
          : [];

  const dailyStepsCount =
    dailyTodayLocal && dailyTodayRemote
      ? Math.max(
          local.dailyStepsCount,
          remote.dailyStepsCount,
          dailyCompletedTargets.length
        )
      : dailyTodayLocal
        ? local.dailyStepsCount
        : dailyTodayRemote
          ? remote.dailyStepsCount
          : 0;

  const dailyBonusClaimedDateKey =
    local.dailyBonusClaimedDateKey === todayDateKey ||
    remote.dailyBonusClaimedDateKey === todayDateKey
      ? todayDateKey
      : local.dailyBonusClaimedDateKey >= remote.dailyBonusClaimedDateKey
        ? local.dailyBonusClaimedDateKey
        : remote.dailyBonusClaimedDateKey;

  return {
    ownerId: local.ownerId || remote.ownerId,
    trackId: local.trackId,
    completedUnits: mergeStringArrays(local.completedUnits, remote.completedUnits, 30),
    unitBestStars,
    letterBestStars,
    totalStars: Math.min(500, totalStars),
    streakDays,
    bestStreakDays: Math.max(
      streakDays,
      local.bestStreakDays,
      remote.bestStreakDays
    ),
    lastStudyDateKey,
    masteredPrimary: mergeStringArrays(
      local.masteredPrimary,
      remote.masteredPrimary,
      40
    ),
    masteredTargets: mergeStringArrays(
      local.masteredTargets,
      remote.masteredTargets,
      150
    ),
    unlockedStickers: mergeStringArrays(
      local.unlockedStickers,
      remote.unlockedStickers,
      60
    ),
    freeExploreUnlocked: local.freeExploreUnlocked || remote.freeExploreUnlocked,
    totalLessonsCompleted: Math.max(
      local.totalLessonsCompleted,
      remote.totalLessonsCompleted
    ),
    dailyDateKey: dailyTodayLocal || dailyTodayRemote ? todayDateKey : '',
    dailyStepsCount,
    dailyCompletedTargets,
    dailyBonusClaimedDateKey,
  };
}

export function normalizeDailyEconomyPayload(
  raw: unknown,
  fallbackDateKey: string
): DailyEconomyPayload {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const dateKey = sanitizeDateKey(src.dateKey) || fallbackDateKey;
  return {
    dateKey,
    petCoinsToday: clampInt(src.petCoinsToday, 0, 500, 0),
    lastPetCoinAtMs: clampInt(src.lastPetCoinAtMs, 0, 9999999999999, 0),
    ballCoinsToday: clampInt(src.ballCoinsToday, 0, 500, 0),
    lastBallCoinAtMs: clampInt(src.lastBallCoinAtMs, 0, 9999999999999, 0),
    minigameCoinsToday: clampInt(src.minigameCoinsToday, 0, 2000, 0),
  };
}

export function mergeDailyEconomyPayloads(
  local: DailyEconomyPayload,
  remote: DailyEconomyPayload,
  todayDateKey: string
): DailyEconomyPayload {
  const localIsToday = local.dateKey === todayDateKey;
  const remoteIsToday = remote.dateKey === todayDateKey;

  if (localIsToday && remoteIsToday) {
    return {
      dateKey: todayDateKey,
      petCoinsToday: Math.max(local.petCoinsToday, remote.petCoinsToday),
      lastPetCoinAtMs: Math.max(local.lastPetCoinAtMs, remote.lastPetCoinAtMs),
      ballCoinsToday: Math.max(local.ballCoinsToday, remote.ballCoinsToday),
      lastBallCoinAtMs: Math.max(local.lastBallCoinAtMs, remote.lastBallCoinAtMs),
      minigameCoinsToday: Math.max(local.minigameCoinsToday, remote.minigameCoinsToday),
    };
  }
  if (remoteIsToday) return remote;
  if (localIsToday) return local;
  return {
    dateKey: todayDateKey,
    petCoinsToday: 0,
    lastPetCoinAtMs: 0,
    ballCoinsToday: 0,
    lastBallCoinAtMs: 0,
    minigameCoinsToday: 0,
  };
}
