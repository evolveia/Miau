import { getTodayDateKey } from '../constants';
import type { DailyMissionId, DailyMissionItem, DailyMissionsSnapshot } from '../types';

const STORAGE_PREFIX = 'miau_daily_missions_v1_';
const ALL_COMPLETED_BONUS_COINS = 30;
const memoryFallbackStore = new Map<string, string>();

const MATH_TRACK_IDS = new Set<string>([
  'infantil_cores_numeros',
  'infantil_soma_subtracao',
  'infantil_matematica_desafios',
  'fund1_matematica',
  'fund2_logica',
]);

export function isMathEducationTrack(trackId: string): boolean {
  return MATH_TRACK_IDS.has(trackId);
}

function readStorage(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {
    // ignore storage errors
  }
  return memoryFallbackStore.get(key) ?? null;
}

function writeStorage(key: string, value: string): void {
  memoryFallbackStore.set(key, value);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {
    // ignore storage quota errors
  }
}

export function getPreviousDateKey(dateKey: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return dateKey;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const d = new Date(Date.UTC(year, month, day - 1));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function createDefaultDailyMissions(): DailyMissionItem[] {
  return [
    {
      id: 'daily_math_lesson',
      title: 'Complete 1 lição de matemática',
      description: 'Conclua uma unidade ou revisão de matemática e lógica.',
      emoji: '🧮',
      coinReward: 35,
      xpReward: 25,
      target: 1,
      progress: 0,
      completed: false,
      completedAtMs: null,
    },
    {
      id: 'daily_bath',
      title: 'Dê banho no bichinho',
      description: 'Use a esponja, o chuveirinho ou o banho completo no Miau.',
      emoji: '🛁',
      coinReward: 25,
      xpReward: 18,
      target: 1,
      progress: 0,
      completed: false,
      completedAtMs: null,
    },
    {
      id: 'daily_pacmiau_500',
      title: 'Faça 500 pontos no Pac-Miau',
      description: 'Alcance 500+ pontos em uma partida de Pac-Miau.',
      emoji: '🟡',
      coinReward: 40,
      xpReward: 30,
      target: 500,
      progress: 0,
      completed: false,
      completedAtMs: null,
    },
  ];
}

function normalizeDailyMissions(
  raw: Partial<DailyMissionsSnapshot> | null,
  ownerId: string,
  todayKey: string
): DailyMissionsSnapshot {
  const yesterdayKey = getPreviousDateKey(todayKey);
  const rawLastActive =
    typeof raw?.lastActiveDateKey === 'string' ? raw.lastActiveDateKey : '';
  const prevStreak = Math.max(0, Math.round(Number(raw?.currentStreak) || 0));
  const bestStreak = Math.max(
    prevStreak,
    Math.round(Number(raw?.bestStreak) || 0)
  );

  // Mantém a sequência se o último dia ativo foi hoje ou ontem; caso contrário zera.
  const streakStillValid =
    rawLastActive === todayKey || rawLastActive === yesterdayKey;
  const normalizedStreak = streakStillValid ? prevStreak : 0;

  if (!raw || raw.dateKey !== todayKey) {
    return {
      ownerId,
      dateKey: todayKey,
      missions: createDefaultDailyMissions(),
      allCompletedBonusClaimed: false,
      allCompletedBonusCoins: ALL_COMPLETED_BONUS_COINS,
      currentStreak: normalizedStreak,
      bestStreak,
      lastActiveDateKey: rawLastActive,
      lastStreakBonusDateKey:
        typeof raw?.lastStreakBonusDateKey === 'string'
          ? raw.lastStreakBonusDateKey
          : '',
    };
  }

  const defaults = createDefaultDailyMissions();
  const byId = new Map<string, DailyMissionItem>();
  if (Array.isArray(raw.missions)) {
    for (const item of raw.missions) {
      if (item && typeof item.id === 'string') {
        byId.set(item.id, item);
      }
    }
  }

  const missions = defaults.map((def) => {
    const saved = byId.get(def.id);
    if (!saved) return def;
    const progress = Math.max(
      0,
      Math.min(def.target, Math.round(Number(saved.progress) || 0))
    );
    const completed = Boolean(saved.completed) || progress >= def.target;
    return {
      ...def,
      progress: completed ? def.target : progress,
      completed,
      completedAtMs:
        typeof saved.completedAtMs === 'number' ? saved.completedAtMs : null,
    };
  });

  return {
    ownerId,
    dateKey: todayKey,
    missions,
    allCompletedBonusClaimed: Boolean(raw.allCompletedBonusClaimed),
    allCompletedBonusCoins: ALL_COMPLETED_BONUS_COINS,
    currentStreak: normalizedStreak,
    bestStreak,
    lastActiveDateKey: rawLastActive,
    lastStreakBonusDateKey:
      typeof raw.lastStreakBonusDateKey === 'string'
        ? raw.lastStreakBonusDateKey
        : '',
  };
}

export function loadDailyMissionsSnapshot(
  ownerId: string,
  nowDate = new Date()
): DailyMissionsSnapshot {
  const cleanOwner = (ownerId || 'guest').trim() || 'guest';
  const todayKey = getTodayDateKey(nowDate);
  const rawStr = readStorage(`${STORAGE_PREFIX}${cleanOwner}`);
  let parsed: Partial<DailyMissionsSnapshot> | null = null;
  if (rawStr) {
    try {
      parsed = JSON.parse(rawStr) as Partial<DailyMissionsSnapshot>;
    } catch {
      parsed = null;
    }
  }
  const snap = normalizeDailyMissions(parsed, cleanOwner, todayKey);
  writeStorage(`${STORAGE_PREFIX}${cleanOwner}`, JSON.stringify(snap));
  return snap;
}

export function saveDailyMissionsSnapshot(
  snap: DailyMissionsSnapshot
): DailyMissionsSnapshot {
  const cleanOwner = (snap.ownerId || 'guest').trim() || 'guest';
  writeStorage(`${STORAGE_PREFIX}${cleanOwner}`, JSON.stringify(snap));
  return snap;
}

export type DailyMissionEvent =
  | { type: 'math_lesson'; trackId?: string }
  | { type: 'bath' }
  | { type: 'pacmiau_score'; score: number };

export interface DailyMissionUpdateResult {
  snapshot: DailyMissionsSnapshot;
  newlyCompleted: DailyMissionItem[];
  coinsAwarded: number;
  xpAwarded: number;
  allCompletedBonusCoins: number;
  streakAdvanced: boolean;
  streakBonusCoins: number;
}

export function recordDailyMissionEvent(
  ownerId: string,
  event: DailyMissionEvent,
  nowDate = new Date()
): DailyMissionUpdateResult {
  const snap = loadDailyMissionsSnapshot(ownerId, nowDate);
  const todayKey = getTodayDateKey(nowDate);
  const yesterdayKey = getPreviousDateKey(todayKey);
  const nowMs = nowDate.getTime();

  let targetMissionId: DailyMissionId | null = null;
  let candidateProgress = 0;

  if (event.type === 'math_lesson') {
    if (!event.trackId || isMathEducationTrack(event.trackId)) {
      targetMissionId = 'daily_math_lesson';
      candidateProgress = 1;
    }
  } else if (event.type === 'bath') {
    targetMissionId = 'daily_bath';
    candidateProgress = 1;
  } else if (event.type === 'pacmiau_score') {
    targetMissionId = 'daily_pacmiau_500';
    candidateProgress = Math.max(0, Math.round(event.score));
  }

  const newlyCompleted: DailyMissionItem[] = [];
  let coinsAwarded = 0;
  let xpAwarded = 0;
  let changed = false;

  if (targetMissionId) {
    snap.missions = snap.missions.map((mission) => {
      if (mission.id !== targetMissionId || mission.completed) {
        return mission;
      }
      const nextProgress = Math.min(
        mission.target,
        Math.max(mission.progress, candidateProgress)
      );
      const justCompleted = nextProgress >= mission.target;
      if (nextProgress !== mission.progress || justCompleted) {
        changed = true;
      }
      const updated: DailyMissionItem = {
        ...mission,
        progress: nextProgress,
        completed: justCompleted,
        completedAtMs: justCompleted ? nowMs : null,
      };
      if (justCompleted) {
        newlyCompleted.push(updated);
        coinsAwarded += updated.coinReward;
        xpAwarded += updated.xpReward;
      }
      return updated;
    });
  }

  let streakAdvanced = false;
  let streakBonusCoins = 0;

  if (newlyCompleted.length > 0 && snap.lastActiveDateKey !== todayKey) {
    if (snap.lastActiveDateKey === yesterdayKey) {
      snap.currentStreak = Math.max(1, snap.currentStreak + 1);
    } else {
      snap.currentStreak = 1;
    }
    snap.bestStreak = Math.max(snap.bestStreak, snap.currentStreak);
    snap.lastActiveDateKey = todayKey;
    streakAdvanced = true;
    changed = true;

    if (
      snap.currentStreak >= 2 &&
      snap.lastStreakBonusDateKey !== todayKey
    ) {
      streakBonusCoins = Math.min(40, snap.currentStreak * 5);
      snap.lastStreakBonusDateKey = todayKey;
      coinsAwarded += streakBonusCoins;
    }
  }

  let allCompletedBonusCoins = 0;
  const allCompleted = snap.missions.every((m) => m.completed);
  if (allCompleted && !snap.allCompletedBonusClaimed) {
    snap.allCompletedBonusClaimed = true;
    allCompletedBonusCoins = snap.allCompletedBonusCoins;
    coinsAwarded += allCompletedBonusCoins;
    xpAwarded += 20;
    changed = true;
  }

  if (changed) {
    saveDailyMissionsSnapshot(snap);
  }

  return {
    snapshot: snap,
    newlyCompleted,
    coinsAwarded,
    xpAwarded,
    allCompletedBonusCoins,
    streakAdvanced,
    streakBonusCoins,
  };
}
