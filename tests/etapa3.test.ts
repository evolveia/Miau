import assert from 'node:assert/strict';
import test, { beforeEach, describe } from 'node:test';

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
import { EDUCATION_MODULES_BY_SCHOOLING } from '../src/data/educationModules';
import { EARLY_LITERACY_UNITS } from '../src/data/earlyLiteracyData';
import { shouldApplyMinorSafety as shouldApplyMinorSafetyClient } from '../src/data/minorSafety';
import {
  buildMinorSafetyInstruction,
  shouldApplyMinorSafety as shouldApplyMinorSafetyServer,
} from '../api/gemini/_shared';
import { isPushPrefsInQuietHours } from '../api/push/pushManager';
import { CONSONANT_UNITS } from '../src/modules/consonants/data';
import { saveEarlyLiteracyProgress } from '../src/modules/learning/phonicsEngine';
import { COMIDAS_BEBIDAS_CONFIG } from '../src/modules/themed/comidasBebidasData';
import { FUND1_CIENCIAS_CONFIG } from '../src/modules/themed/fund1CienciasData';
import { FUND1_LEITURA_CONFIG } from '../src/modules/themed/fund1LeituraData';
import { FUND1_MATEMATICA_CONFIG } from '../src/modules/themed/fund1MatematicaData';
import { FUND2_CIENCIAS_CONFIG } from '../src/modules/themed/fund2CienciasData';
import { FUND2_HISTORIA_CONFIG } from '../src/modules/themed/fund2HistoriaData';
import { FUND2_LOGICA_CONFIG } from '../src/modules/themed/fund2LogicaData';
import { saveThemedProgress } from '../src/modules/themed/themedEngine';
import { VALID_CLOUD_EDUCATION_TRACKS } from '../src/services/cloudProgressModel';
import {
  clearParentalPin,
  createDefaultParentalControlConfig,
  generateAdultMathChallenge,
  getScreenLimitStatus,
  getWeeklySummary,
  hashParentalPin,
  isTimeWindowActive,
  isWithinQuietHours,
  mergeParentalControlConfigs,
  recordActiveSeconds,
  recordCompletedLesson,
  saveParentalControlConfig,
  setParentalPin,
  unlockScreenLimitTemporarily,
  verifyParentalPin,
} from '../src/services/parentalControlService';
import {
  buildEducationProgressReport,
  getStrongestAndWeakestModules,
} from '../src/services/progressReportService';
import {
  buildSmartReviewSession,
  daysSinceDateKey,
  markSmartReviewCompleted,
} from '../src/services/smartReviewService';

beforeEach(() => {
  memoryStorage.clear();
});

describe('Etapa 3.1 - Módulos Ativos de Fundamental I e II', () => {
  test('activates all 6 Fundamental I & II tracks in educationModules registry and cloud tracks', () => {
    const expectedIds = [
      'fund1_leitura',
      'fund1_matematica',
      'fund1_ciencias',
      'fund2_logica',
      'fund2_ciencias',
      'fund2_historia',
    ] as const;

    for (const id of expectedIds) {
      assert.ok(VALID_CLOUD_EDUCATION_TRACKS.includes(id));
    }

    const f1 = EDUCATION_MODULES_BY_SCHOOLING.fundamental_1;
    const f2 = EDUCATION_MODULES_BY_SCHOOLING.fundamental_2;

    for (const id of ['fund1_leitura', 'fund1_matematica', 'fund1_ciencias']) {
      const mod = f1.find((m) => m.id === id);
      assert.ok(mod, `Module ${id} should appear in fundamental_1`);
      assert.match(mod.statusLabel, /^Disponível agora/);
    }

    for (const id of ['fund2_logica', 'fund2_ciencias', 'fund2_historia']) {
      const mod = f2.find((m) => m.id === id);
      assert.ok(mod, `Module ${id} should appear in fundamental_2`);
      assert.match(mod.statusLabel, /^Disponível agora/);
    }

    assert.ok(FUND1_LEITURA_CONFIG.units.length >= 3);
    assert.ok(FUND1_MATEMATICA_CONFIG.units.length >= 3);
    assert.ok(FUND1_CIENCIAS_CONFIG.units.length >= 3);
    assert.ok(FUND2_LOGICA_CONFIG.units.length >= 3);
    assert.ok(FUND2_CIENCIAS_CONFIG.units.length >= 3);
    assert.ok(FUND2_HISTORIA_CONFIG.units.length >= 3);
  });

  test('computes strongest and needs-reinforcement modules across all 15 tracks', () => {
    const owner = 'etapa3-progress-owner';
    saveThemedProgress(FUND1_LEITURA_CONFIG, {
      ownerId: owner,
      completedUnits: FUND1_LEITURA_CONFIG.units.map((u) => u.id),
      unitBestStars: Object.fromEntries(
        FUND1_LEITURA_CONFIG.units.map((u) => [u.id, 3])
      ),
      totalStars: FUND1_LEITURA_CONFIG.units.length * 3,
      streakDays: 3,
      lastStudyDateKey: getTodayDateKey(),
      masteredTags: FUND1_LEITURA_CONFIG.masteryItems,
      masteredTargets: [],
      unlockedStickers: [],
      reviewQueue: {},
      freeExploreUnlocked: true,
      totalLessonsCompleted: 6,
    });

    saveThemedProgress(FUND1_MATEMATICA_CONFIG, {
      ownerId: owner,
      completedUnits: [FUND1_MATEMATICA_CONFIG.units[0].id],
      unitBestStars: { [FUND1_MATEMATICA_CONFIG.units[0].id]: 1 },
      totalStars: 1,
      streakDays: 1,
      lastStudyDateKey: getTodayDateKey(),
      masteredTags: [],
      masteredTargets: [],
      unlockedStickers: [],
      reviewQueue: {},
      freeExploreUnlocked: false,
      totalLessonsCompleted: 1,
    });

    const report = buildEducationProgressReport(owner);
    assert.equal(report.modules.length, 15);

    const insights = getStrongestAndWeakestModules(report);
    assert.equal(insights.strongest[0]?.trackId, 'fund1_leitura');
    assert.ok(
      insights.needsReinforcement.some((m) => m.trackId === 'fund1_matematica')
    );
  });
});

describe('Etapa 3.2 - Revisão Inteligente (Treino do Dia com o Miau)', () => {
  test('calculates elapsed calendar days accurately', () => {
    assert.equal(daysSinceDateKey('2026-11-20', '2026-11-27'), 7);
    assert.equal(daysSinceDateKey('2026-11-27', '2026-11-27'), 0);
    assert.equal(daysSinceDateKey('invalid', '2026-11-27'), 0);
  });

  test('prioritizes <3 stars and >5 days stale units and tracks daily bonus completion', () => {
    const owner = 'etapa3-smart-review';
    saveEarlyLiteracyProgress({
      ownerId: owner,
      completedUnits: [EARLY_LITERACY_UNITS[0].id, EARLY_LITERACY_UNITS[1].id],
      unitBestStars: {
        [EARLY_LITERACY_UNITS[0].id]: 2,
        [EARLY_LITERACY_UNITS[1].id]: 3,
      },
      totalStars: 5,
      streakDays: 2,
      lastStudyDateKey: '2026-11-18',
      masteredVowels: ['A'],
      masteredTargets: ['Abelha'],
      unlockedStickers: [],
      reviewQueue: {},
      freeExploreUnlocked: false,
      totalLessonsCompleted: 3,
    });

    const session = buildSmartReviewSession({
      ownerId: owner,
      schooling: 'educacao_infantil',
      nowDateKey: '2026-11-27',
      desiredCount: 4,
    });

    assert.equal(session.questions.length, 4);
    assert.ok(
      session.questions.some(
        (q) => q.reasonTag === 'low_stars' || q.reasonTag === 'stale_5d'
      )
    );
    assert.equal(session.completedToday, false);

    const firstDone = markSmartReviewCompleted(owner, 4, 4, '2026-11-27');
    assert.equal(firstDone.isFirstCompletionToday, true);
    assert.equal(firstDone.coinsReward, 35);

    const replayDone = markSmartReviewCompleted(owner, 3, 4, '2026-11-27');
    assert.equal(replayDone.isFirstCompletionToday, false);
    assert.equal(replayDone.coinsReward, 8);
  });
});

describe('Etapa 3.3 - Desafios de Fala e Pronúncia (speak_repeat)', () => {
  test('includes speak_repeat challenges in Vogais, Consoantes, and Comidas e Bebidas', () => {
    const vowelSpeak = EARLY_LITERACY_UNITS.flatMap((u) => u.challenges).filter(
      (c) => c.type === 'speak_repeat'
    );
    const consonantSpeak = CONSONANT_UNITS.flatMap((u) => u.challenges).filter(
      (c) => c.type === 'speak_repeat'
    );
    const foodSpeak = COMIDAS_BEBIDAS_CONFIG.units
      .flatMap((u) => u.challenges)
      .filter((c) => c.type === 'speak_repeat');

    assert.ok(vowelSpeak.length >= 2);
    assert.ok(consonantSpeak.length >= 2);
    assert.ok(foodSpeak.length >= 2);

    for (const ch of [...vowelSpeak, ...consonantSpeak, ...foodSpeak]) {
      assert.ok(Array.isArray(ch.keywords) && ch.keywords.length >= 1);
      assert.ok(typeof ch.instruction === 'string' && ch.instruction.length > 0);
    }
  });
});

describe('Etapa 3.4 - Controle Parental, Horário Silencioso e Filtro de IA', () => {
  test('hashes, verifies, updates, and clears 4-digit PIN cleanly', () => {
    const owner = 'parent-pin-owner';
    const invalid = setParentalPin(owner, '12');
    assert.equal(invalid.ok, false);

    const saved = setParentalPin(owner, '4829');
    assert.equal(saved.ok, true);
    assert.ok(saved.config.pinHash.startsWith('pin1_'));
    assert.equal(saved.config.pinHash, hashParentalPin('4829'));
    assert.equal(verifyParentalPin('4829', saved.config.pinHash), true);
    assert.equal(verifyParentalPin('0000', saved.config.pinHash), false);

    const cleared = clearParentalPin(owner);
    assert.equal(cleared.pinHash, '');
  });

  test('generates deterministic adult math challenges from seed', () => {
    const c1 = generateAdultMathChallenge(42);
    const c2 = generateAdultMathChallenge(42);
    assert.deepEqual(c1, c2);
    assert.match(c1.question, /\(\d+ × \d+\) \+ \d+\?/);
    assert.ok(c1.answer >= 27);
  });

  test('evaluates overnight and daytime quiet hours for local client and Web Push server', () => {
    assert.equal(isTimeWindowActive(true, '22:00', '07:00', 23 * 60 + 30), true);
    assert.equal(isTimeWindowActive(true, '22:00', '07:00', 6 * 60 + 15), true);
    assert.equal(isTimeWindowActive(true, '22:00', '07:00', 14 * 60), false);
    assert.equal(isTimeWindowActive(false, '22:00', '07:00', 23 * 60), false);

    const cfg = {
      ...createDefaultParentalControlConfig('quiet-owner'),
      quietHoursEnabled: true,
      quietStart: '22:00',
      quietEnd: '07:00',
    };
    const lateNight = new Date(2026, 10, 27, 23, 15);
    const afternoon = new Date(2026, 10, 27, 15, 0);
    assert.equal(isWithinQuietHours(cfg, lateNight), true);
    assert.equal(isWithinQuietHours(cfg, afternoon), false);

    // Server helper uses UTC timestamp + client tzOffsetMin (UTC-3 => 180)
    const utcFor2315Brt = Date.UTC(2026, 10, 28, 2, 15);
    const utcFor1500Brt = Date.UTC(2026, 10, 27, 18, 0);
    const serverPrefs = {
      enabled: true,
      hunger: true,
      hygiene: true,
      sleep: true,
      threshold: 35,
      quietHoursEnabled: true,
      quietStart: '22:00',
      quietEnd: '07:00',
      tzOffsetMin: 180,
    };
    assert.equal(isPushPrefsInQuietHours(serverPrefs, utcFor2315Brt), true);
    assert.equal(isPushPrefsInQuietHours(serverPrefs, utcFor1500Brt), false);
  });

  test('tracks daily active minutes, enforces lock, bypasses temporarily, and builds 7-day summary', () => {
    const owner = 'screen-limit-owner';
    const fixedNow = new Date(2026, 10, 27, 12, 0).getTime();

    saveParentalControlConfig({
      ...createDefaultParentalControlConfig(owner),
      dailyScreenLimitMin: 15,
    });

    for (let i = 0; i < 30; i += 1) {
      recordActiveSeconds(owner, 30, fixedNow);
    }

    const after15 = recordCompletedLesson(owner, 2, fixedNow);
    const lockedStatus = getScreenLimitStatus(after15, fixedNow);
    assert.equal(lockedStatus.usedMinutes, 15);
    assert.equal(lockedStatus.locked, true);
    assert.equal(lockedStatus.remainingMinutes, 0);

    const summary = getWeeklySummary(after15, fixedNow);
    assert.equal(summary.days.length, 7);
    assert.equal(summary.todayMinutes, 15);
    assert.equal(summary.todayLessons, 2);

    const unlocked30 = unlockScreenLimitTemporarily(owner, 30, fixedNow);
    const bypassStatus = getScreenLimitStatus(unlocked30, fixedNow + 5 * 60_000);
    assert.equal(bypassStatus.locked, false);
    assert.equal(bypassStatus.bypassActive, true);
  });

  test('merges local and remote parental configs preserving max counters and newest settings', () => {
    const today = '2026-11-27';
    const local = {
      ...createDefaultParentalControlConfig('u1'),
      dailyScreenLimitMin: 30,
      dailyMinutesByDate: { [today]: 12 },
      dailyLessonsByDate: { [today]: 2 },
      updatedAtMs: 1000,
    };
    const remote = {
      ...createDefaultParentalControlConfig('u1'),
      dailyScreenLimitMin: 45,
      strictAiFilter: true,
      dailyMinutesByDate: { [today]: 8, '2026-11-26': 20 },
      dailyLessonsByDate: { [today]: 4 },
      updatedAtMs: 2000,
    };

    const merged = mergeParentalControlConfigs(local, remote);
    assert.equal(merged.dailyScreenLimitMin, 45);
    assert.equal(merged.strictAiFilter, true);
    assert.equal(merged.dailyMinutesByDate[today], 12);
    assert.equal(merged.dailyMinutesByDate['2026-11-26'], 20);
    assert.equal(merged.dailyLessonsByDate[today], 4);
  });

  test('applies strict AI safety filter for adults when enabled', () => {
    assert.equal(shouldApplyMinorSafetyClient(30, false), false);
    assert.equal(shouldApplyMinorSafetyClient(30, true), true);
    assert.equal(shouldApplyMinorSafetyClient(8, false), true);

    assert.equal(shouldApplyMinorSafetyServer(30, false), false);
    assert.equal(shouldApplyMinorSafetyServer(30, true), true);

    const adultStrictPrompt = buildMinorSafetyInstruction(30, true);
    assert.match(adultStrictPrompt, /FILTRO ESTRITO ATIVADO PELOS RESPONSÁVEIS/);
    assert.equal(buildMinorSafetyInstruction(30, false), '');
  });
});
