import assert from 'node:assert/strict';
import test, { beforeEach, describe } from 'node:test';

// Polyfill lightweight in-memory localStorage for pure Node test runs
const memoryStorage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    get length() {
      return memoryStorage.size;
    },
    clear() {
      memoryStorage.clear();
    },
    getItem(key: string) {
      return memoryStorage.has(key) ? memoryStorage.get(key)! : null;
    },
    key(index: number) {
      return Array.from(memoryStorage.keys())[index] ?? null;
    },
    removeItem(key: string) {
      memoryStorage.delete(key);
    },
    setItem(key: string, value: string) {
      memoryStorage.set(key, String(value));
    },
  } satisfies Storage,
  configurable: true,
});

import { getTodayDateKey } from '../src/constants';
import {
  registerCloudProgressListeners,
  type CloudSyncTrackId,
  type DailyEconomyPayload,
} from '../src/services/cloudProgressHooks';
import {
  VALID_CLOUD_EDUCATION_TRACKS,
  mergeDailyEconomyPayloads,
  mergeEducationTrackSnapshots,
  normalizeDailyEconomyPayload,
  normalizeEducationTrackSnapshot,
} from '../src/services/cloudProgressModel';
import {
  BALL_COIN_COOLDOWN_MS,
  BALL_DAILY_COIN_CAP,
  MINIGAME_DAILY_COIN_CAP,
  PET_COIN_COOLDOWN_MS,
  PET_DAILY_COIN_CAP,
  claimBallCoins,
  claimMinigameCoins,
  claimPetCoins,
  getCoinEconomySnapshot,
} from '../src/services/coinEconomyService';
import { buildEducationProgressReport } from '../src/services/progressReportService';
import {
  getRoomThemeClasses,
  isNightRoomBackground,
} from '../src/services/roomThemeService';
import { saveEarlyLiteracyProgress } from '../src/modules/learning/phonicsEngine';
import { CORES_FORMAS_CONFIG } from '../src/modules/themed/coresFormasData';
import { saveThemedProgress } from '../src/modules/themed/themedEngine';
import {
  getVapidPublicKey,
  isValidPushEndpoint,
} from '../api/push/pushManager';

beforeEach(() => {
  memoryStorage.clear();
});

describe('Etapa 1 - Room Theme Service', () => {
  test('identifies night backgrounds and sleeping override', () => {
    assert.equal(isNightRoomBackground('bg_night', false), true);
    assert.equal(isNightRoomBackground('bg_space', false), true);
    assert.equal(isNightRoomBackground('bg_cyberpunk', false), true);
    assert.equal(isNightRoomBackground('bg_sunny', false), false);
    assert.equal(isNightRoomBackground('bg_sunny', true), true);
  });

  test('returns tailored theme classes per background and sleep state', () => {
    const sleepingTheme = getRoomThemeClasses('bg_sunny', true);
    assert.equal(sleepingTheme.showFloor, true);
    assert.equal(sleepingTheme.useWallpaper, false);
    assert.match(sleepingTheme.wall, /281e4f/);

    const peachTheme = getRoomThemeClasses('bg_peach', false);
    assert.equal(peachTheme.useWallpaper, true);
    assert.equal(peachTheme.showFloor, true);

    const sunnyTheme = getRoomThemeClasses('bg_sunny', false);
    assert.equal(sunnyTheme.showFloor, false);
    assert.equal(sunnyTheme.useWallpaper, false);

    const defaultTheme = getRoomThemeClasses('unknown_bg', false);
    assert.equal(defaultTheme.useWallpaper, true);
    assert.equal(defaultTheme.showFloor, true);
  });
});

describe('Etapa 1 - Cloud Progress Normalization & Merge', () => {
  test('covers all 15 educational tracks in registry', () => {
    assert.equal(VALID_CLOUD_EDUCATION_TRACKS.length, 15);
    assert.equal(new Set(VALID_CLOUD_EDUCATION_TRACKS).size, 15);
  });

  test('normalizes legacy fields, clamps stars, and sanitizes date keys', () => {
    const normalized = normalizeEducationTrackSnapshot(
      'user-123',
      'infantil_escrita',
      {
        completedUnits: ['u1', 'u1', ' u2 ', ''],
        unitBestStars: { u1: 5, u2: -2 },
        letterBestStars: { A: 4, E: 2 },
        totalStars: 1,
        streakDays: 3,
        bestStreakDays: 1,
        lastStudyDateKey: '2026-11-26',
        masteredVowels: ['A', 'A', 'E'],
        masteredTargets: ['A', 'Abelha'],
        unlockedMedals: ['medal_1', 'medal_1'],
        freeExploreUnlocked: true,
        totalPracticesCompleted: 14,
        dailyDateKey: 'not-a-date',
        dailyStepsCount: 4,
        dailyCompletedTargets: ['A', 'E'],
        dailyBonusClaimedDateKey: '2026-11-26',
      }
    );

    assert.deepEqual(normalized.completedUnits, ['u1', 'u2']);
    assert.deepEqual(normalized.unitBestStars, { u1: 3, u2: 0 });
    assert.deepEqual(normalized.letterBestStars, { A: 3, E: 2 });
    assert.equal(normalized.totalStars, 3);
    assert.equal(normalized.bestStreakDays, 3);
    assert.deepEqual(normalized.masteredPrimary, ['A', 'E']);
    assert.deepEqual(normalized.unlockedStickers, ['medal_1']);
    assert.equal(normalized.totalLessonsCompleted, 14);
    assert.equal(normalized.dailyDateKey, '');
    assert.equal(normalized.dailyBonusClaimedDateKey, '2026-11-26');
  });

  test('merges local and remote track snapshots deterministically without losing progress', () => {
    const today = '2026-11-26';
    const local = normalizeEducationTrackSnapshot('uid1', 'infantil_letras', {
      completedUnits: ['u1'],
      unitBestStars: { u1: 2 },
      totalStars: 2,
      streakDays: 2,
      bestStreakDays: 4,
      lastStudyDateKey: today,
      masteredVowels: ['A'],
      masteredTargets: ['Abelha'],
      unlockedStickers: ['s1'],
      freeExploreUnlocked: false,
      totalLessonsCompleted: 5,
      dailyDateKey: today,
      dailyStepsCount: 2,
      dailyCompletedTargets: ['A', 'E'],
    });
    const remote = normalizeEducationTrackSnapshot('uid1', 'infantil_letras', {
      completedUnits: ['u1', 'u2'],
      unitBestStars: { u1: 3, u2: 2 },
      totalStars: 5,
      streakDays: 5,
      bestStreakDays: 5,
      lastStudyDateKey: today,
      masteredVowels: ['A', 'E', 'I'],
      masteredTargets: ['Elefante'],
      unlockedStickers: ['s2'],
      freeExploreUnlocked: true,
      totalLessonsCompleted: 9,
      dailyDateKey: '2026-11-25',
      dailyStepsCount: 4,
      dailyCompletedTargets: ['I', 'O', 'U', 'Uva'],
    });

    const merged = mergeEducationTrackSnapshots(local, remote, today);
    assert.deepEqual(merged.completedUnits, ['u1', 'u2']);
    assert.deepEqual(merged.unitBestStars, { u1: 3, u2: 2 });
    assert.equal(merged.totalStars, 5);
    assert.equal(merged.streakDays, 5);
    assert.equal(merged.bestStreakDays, 5);
    assert.deepEqual(merged.masteredPrimary, ['A', 'E', 'I']);
    assert.deepEqual(merged.masteredTargets, ['Abelha', 'Elefante']);
    assert.deepEqual(merged.unlockedStickers, ['s1', 's2']);
    assert.equal(merged.freeExploreUnlocked, true);
    assert.equal(merged.totalLessonsCompleted, 9);
    // Remote daily was yesterday, so only local today steps carry forward
    assert.equal(merged.dailyDateKey, today);
    assert.deepEqual(merged.dailyCompletedTargets, ['A', 'E']);
    assert.equal(merged.dailyStepsCount, 2);
  });

  test('merges daily economy payloads and resets stale dates', () => {
    const today = '2026-11-26';
    const localSameDay = normalizeDailyEconomyPayload(
      {
        dateKey: today,
        petCoinsToday: 15,
        lastPetCoinAtMs: 1000,
        ballCoinsToday: 20,
        lastBallCoinAtMs: 2000,
        minigameCoinsToday: 40,
      },
      today
    );
    const remoteSameDay = normalizeDailyEconomyPayload(
      {
        dateKey: today,
        petCoinsToday: 25,
        lastPetCoinAtMs: 1500,
        ballCoinsToday: 10,
        lastBallCoinAtMs: 1800,
        minigameCoinsToday: 85,
      },
      today
    );

    const mergedToday = mergeDailyEconomyPayloads(
      localSameDay,
      remoteSameDay,
      today
    );
    assert.equal(mergedToday.petCoinsToday, 25);
    assert.equal(mergedToday.ballCoinsToday, 20);
    assert.equal(mergedToday.minigameCoinsToday, 85);
    assert.equal(mergedToday.lastPetCoinAtMs, 1500);
    assert.equal(mergedToday.lastBallCoinAtMs, 2000);

    const staleLocal: DailyEconomyPayload = {
      ...localSameDay,
      dateKey: '2026-11-20',
    };
    const staleRemote: DailyEconomyPayload = {
      ...remoteSameDay,
      dateKey: '2026-11-21',
    };
    const resetMerged = mergeDailyEconomyPayloads(staleLocal, staleRemote, today);
    assert.equal(resetMerged.dateKey, today);
    assert.equal(resetMerged.petCoinsToday, 0);
    assert.equal(resetMerged.ballCoinsToday, 0);
    assert.equal(resetMerged.minigameCoinsToday, 0);
  });
});

describe('Etapa 1 - Anti-Farming Daily Coin Economy', () => {
  test('enforces pet cooldown and daily cap', () => {
    const owner = 'test-pet-owner';
    const t0 = 1_700_000_000_000;

    const first = claimPetCoins(owner, 10, t0);
    assert.equal(first.reason, 'granted');
    assert.equal(first.coinsGranted, 10);
    assert.equal(first.remainingToday, PET_DAILY_COIN_CAP - 10);

    const tooSoon = claimPetCoins(owner, 10, t0 + 10_000);
    assert.equal(tooSoon.reason, 'cooldown');
    assert.equal(tooSoon.coinsGranted, 0);
    assert.ok(tooSoon.cooldownRemainingSec >= 34);

    const second = claimPetCoins(owner, 15, t0 + PET_COIN_COOLDOWN_MS + 100);
    assert.equal(second.reason, 'granted');
    assert.equal(second.coinsGranted, 15);
    assert.equal(second.remainingToday, 5);

    const thirdPartial = claimPetCoins(
      owner,
      10,
      t0 + PET_COIN_COOLDOWN_MS * 2 + 200
    );
    assert.equal(thirdPartial.reason, 'granted');
    assert.equal(thirdPartial.coinsGranted, 5);
    assert.equal(thirdPartial.remainingToday, 0);

    const capped = claimPetCoins(
      owner,
      10,
      t0 + PET_COIN_COOLDOWN_MS * 3 + 300
    );
    assert.equal(capped.reason, 'daily_cap');
    assert.equal(capped.coinsGranted, 0);
  });

  test('enforces ball cooldown and daily cap and exposes snapshot', () => {
    const owner = 'test-ball-owner';
    const t0 = 1_700_000_000_000;

    const r1 = claimBallCoins(owner, 25, t0);
    assert.equal(r1.coinsGranted, 25);

    const snapCooldown = getCoinEconomySnapshot(owner, t0 + 5_000);
    assert.equal(snapCooldown.ballCoinsToday, 25);
    assert.equal(snapCooldown.ballDailyCap, BALL_DAILY_COIN_CAP);
    assert.ok(snapCooldown.ballCooldownSec > 0);

    const r2 = claimBallCoins(owner, 30, t0 + BALL_COIN_COOLDOWN_MS);
    assert.equal(r2.coinsGranted, 15);
    assert.equal(r2.remainingToday, 0);

    const r3 = claimBallCoins(owner, 5, t0 + BALL_COIN_COOLDOWN_MS * 2);
    assert.equal(r3.reason, 'daily_cap');
  });

  test('enforces minigame daily cap and notifies cloud economy listener', () => {
    const owner = 'test-game-owner';
    const events: DailyEconomyPayload[] = [];
    registerCloudProgressListeners({
      onEconomySaved: (id, payload) => {
        if (id === owner) events.push(payload);
      },
    });

    const g1 = claimMinigameCoins(owner, 100);
    assert.equal(g1.coinsGranted, 100);
    assert.equal(g1.remainingToday, MINIGAME_DAILY_COIN_CAP - 100);

    const g2 = claimMinigameCoins(owner, 100);
    assert.equal(g2.coinsGranted, 60);
    assert.equal(g2.remainingToday, 0);

    const g3 = claimMinigameCoins(owner, 20);
    assert.equal(g3.reason, 'daily_cap');
    assert.equal(g3.coinsGranted, 0);
    assert.equal(events.length, 2);
    assert.equal(events[1].minigameCoinsToday, MINIGAME_DAILY_COIN_CAP);
  });

  test('resets daily counters automatically when stored dateKey is from yesterday', () => {
    const owner = 'test-reset-owner';
    localStorage.setItem(
      `miau_coin_economy_v1_${owner}`,
      JSON.stringify({
        dateKey: '1999-01-01',
        petCoinsToday: 30,
        lastPetCoinAtMs: Date.now(),
        ballCoinsToday: 40,
        lastBallCoinAtMs: Date.now(),
        minigameCoinsToday: 160,
      })
    );

    const snap = getCoinEconomySnapshot(owner);
    assert.equal(snap.petCoinsToday, 0);
    assert.equal(snap.ballCoinsToday, 0);
    assert.equal(snap.minigameCoinsToday, 0);

    const freshClaim = claimPetCoins(owner, 5);
    assert.equal(freshClaim.reason, 'granted');
    assert.equal(freshClaim.coinsGranted, 5);
  });
});

describe('Etapa 1 - Progress Report Aggregation & Cloud Save Hook', () => {
  test('aggregates 15 modules and emits cloud hook on local saves', () => {
    const owner = 'test-report-owner';
    const capturedTracks: CloudSyncTrackId[] = [];

    registerCloudProgressListeners({
      onEducationSaved: (id, trackId) => {
        if (id === owner) capturedTracks.push(trackId);
      },
    });

    const emptyReport = buildEducationProgressReport(owner);
    assert.equal(emptyReport.modules.length, 15);
    assert.equal(emptyReport.totalCompletedUnits, 0);
    assert.equal(emptyReport.overallPct, 0);

    saveEarlyLiteracyProgress({
      ownerId: owner,
      completedUnits: ['vogais_1'],
      unitBestStars: { vogais_1: 3 },
      totalStars: 3,
      streakDays: 2,
      lastStudyDateKey: getTodayDateKey(),
      masteredVowels: ['A', 'E'],
      masteredTargets: ['Abelha'],
      unlockedStickers: ['sticker_a'],
      reviewQueue: {},
      freeExploreUnlocked: false,
      totalLessonsCompleted: 4,
    });

    saveThemedProgress(CORES_FORMAS_CONFIG, {
      ownerId: owner,
      completedUnits: [CORES_FORMAS_CONFIG.units[0].id],
      unitBestStars: { [CORES_FORMAS_CONFIG.units[0].id]: 2 },
      totalStars: 2,
      streakDays: 1,
      lastStudyDateKey: getTodayDateKey(),
      masteredTags: ['Vermelho'],
      masteredTargets: ['Circulo'],
      unlockedStickers: [],
      reviewQueue: {},
      freeExploreUnlocked: false,
      totalLessonsCompleted: 3,
    });

    assert.deepEqual(capturedTracks, [
      'infantil_letras',
      'infantil_cores_numeros',
    ]);

    const updatedReport = buildEducationProgressReport(owner);
    assert.equal(updatedReport.totalCompletedUnits, 2);
    assert.equal(updatedReport.totalStars, 5);
    assert.equal(updatedReport.totalLessonsCompleted, 7);
    assert.equal(updatedReport.maxStreakDays, 2);
    assert.ok(updatedReport.overallPct > 0);
  });
});

describe('Etapa 1 - Zero-Config Web Push VAPID & Endpoint Security', () => {
  test('auto-generates valid base64url VAPID public key without env vars', () => {
    const publicKey = getVapidPublicKey();
    assert.equal(typeof publicKey, 'string');
    assert.ok(publicKey.length >= 64);
    assert.match(publicKey, /^[A-Za-z0-9_-]+$/);
  });

  test('accepts HTTPS push endpoints and rejects HTTP/loopback/private URLs', () => {
    assert.equal(
      isValidPushEndpoint('https://fcm.googleapis.com/fcm/send/abc123'),
      true
    );
    assert.equal(
      isValidPushEndpoint('https://web.push.apple.com/QBq123'),
      true
    );
    assert.equal(
      isValidPushEndpoint('http://fcm.googleapis.com/fcm/send/abc123'),
      false
    );
    assert.equal(isValidPushEndpoint('https://localhost/push'), false);
    assert.equal(isValidPushEndpoint('https://127.0.0.1/push'), false);
    assert.equal(isValidPushEndpoint('https://169.254.169.254/latest'), false);
    assert.equal(isValidPushEndpoint('not-a-url'), false);
  });
});

