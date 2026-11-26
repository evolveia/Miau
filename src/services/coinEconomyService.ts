import { ROUTINE_SCHEDULE, getTodayDateKey } from '../constants';
import type { PetStats, RoutineCategory, RoutineSlotDef } from '../types';

const ECONOMY_STORAGE_PREFIX = 'miau_coin_economy_v1_';

// Limites rígidos anti-farming para valorizar as atividades educativas e a rotina diária
export const PET_DAILY_COIN_CAP = 30;
export const PET_COIN_COOLDOWN_MS = 45_000;

export const BALL_DAILY_COIN_CAP = 40;
export const BALL_COIN_COOLDOWN_MS = 45_000;

export const MINIGAME_DAILY_COIN_CAP = 160;

interface DailyEconomyState {
  dateKey: string;
  petCoinsToday: number;
  lastPetCoinAtMs: number;
  ballCoinsToday: number;
  lastBallCoinAtMs: number;
  minigameCoinsToday: number;
}

export interface EconomyClaimResult {
  coinsGranted: number;
  remainingToday: number;
  cooldownRemainingSec: number;
  reason: 'granted' | 'cooldown' | 'daily_cap';
}

export interface CoinEconomySnapshot {
  petCoinsToday: number;
  petDailyCap: number;
  petCooldownSec: number;
  ballCoinsToday: number;
  ballDailyCap: number;
  ballCooldownSec: number;
  minigameCoinsToday: number;
  minigameDailyCap: number;
}

export interface OrganizedNeedTiming {
  category: RoutineCategory;
  title: string;
  emoji: string;
  currentValue: number;
  cadenceLabel: string;
  statusLabel: string;
  urgency: 'ok' | 'soon' | 'urgent';
  activeSlot: RoutineSlotDef | null;
  nextSlot: RoutineSlotDef | null;
  minutesUntilNext: number;
  completedCount: number;
  totalCount: number;
}

function getDefaultEconomyState(dateKey = getTodayDateKey()): DailyEconomyState {
  return {
    dateKey,
    petCoinsToday: 0,
    lastPetCoinAtMs: 0,
    ballCoinsToday: 0,
    lastBallCoinAtMs: 0,
    minigameCoinsToday: 0,
  };
}

function loadEconomyState(ownerId = 'guest'): DailyEconomyState {
  const safeId = ownerId || 'guest';
  const today = getTodayDateKey();
  try {
    const raw = localStorage.getItem(`${ECONOMY_STORAGE_PREFIX}${safeId}`);
    if (!raw) return getDefaultEconomyState(today);
    const parsed = JSON.parse(raw) as Partial<DailyEconomyState>;
    if (parsed.dateKey !== today) {
      return getDefaultEconomyState(today);
    }
    return {
      dateKey: today,
      petCoinsToday: Math.max(0, Math.round(Number(parsed.petCoinsToday) || 0)),
      lastPetCoinAtMs: Math.max(0, Number(parsed.lastPetCoinAtMs) || 0),
      ballCoinsToday: Math.max(0, Math.round(Number(parsed.ballCoinsToday) || 0)),
      lastBallCoinAtMs: Math.max(0, Number(parsed.lastBallCoinAtMs) || 0),
      minigameCoinsToday: Math.max(
        0,
        Math.round(Number(parsed.minigameCoinsToday) || 0)
      ),
    };
  } catch {
    return getDefaultEconomyState(today);
  }
}

function saveEconomyState(ownerId: string, state: DailyEconomyState): void {
  try {
    localStorage.setItem(
      `${ECONOMY_STORAGE_PREFIX}${ownerId || 'guest'}`,
      JSON.stringify(state)
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function claimPetCoins(
  ownerId: string,
  requestedCoins: number,
  nowMs = Date.now()
): EconomyClaimResult {
  const state = loadEconomyState(ownerId);
  if (state.petCoinsToday >= PET_DAILY_COIN_CAP) {
    return {
      coinsGranted: 0,
      remainingToday: 0,
      cooldownRemainingSec: 0,
      reason: 'daily_cap',
    };
  }
  const elapsed = nowMs - state.lastPetCoinAtMs;
  if (state.lastPetCoinAtMs > 0 && elapsed < PET_COIN_COOLDOWN_MS) {
    return {
      coinsGranted: 0,
      remainingToday: Math.max(0, PET_DAILY_COIN_CAP - state.petCoinsToday),
      cooldownRemainingSec: Math.ceil((PET_COIN_COOLDOWN_MS - elapsed) / 1000),
      reason: 'cooldown',
    };
  }
  const remaining = PET_DAILY_COIN_CAP - state.petCoinsToday;
  const coinsGranted = Math.max(0, Math.min(requestedCoins, remaining));
  if (coinsGranted > 0) {
    state.petCoinsToday += coinsGranted;
    state.lastPetCoinAtMs = nowMs;
    saveEconomyState(ownerId, state);
  }
  return {
    coinsGranted,
    remainingToday: Math.max(0, PET_DAILY_COIN_CAP - state.petCoinsToday),
    cooldownRemainingSec: 0,
    reason: 'granted',
  };
}

export function claimBallCoins(
  ownerId: string,
  requestedCoins: number,
  nowMs = Date.now()
): EconomyClaimResult {
  const state = loadEconomyState(ownerId);
  if (state.ballCoinsToday >= BALL_DAILY_COIN_CAP) {
    return {
      coinsGranted: 0,
      remainingToday: 0,
      cooldownRemainingSec: 0,
      reason: 'daily_cap',
    };
  }
  const elapsed = nowMs - state.lastBallCoinAtMs;
  if (state.lastBallCoinAtMs > 0 && elapsed < BALL_COIN_COOLDOWN_MS) {
    return {
      coinsGranted: 0,
      remainingToday: Math.max(0, BALL_DAILY_COIN_CAP - state.ballCoinsToday),
      cooldownRemainingSec: Math.ceil((BALL_COIN_COOLDOWN_MS - elapsed) / 1000),
      reason: 'cooldown',
    };
  }
  const remaining = BALL_DAILY_COIN_CAP - state.ballCoinsToday;
  const coinsGranted = Math.max(0, Math.min(requestedCoins, remaining));
  if (coinsGranted > 0) {
    state.ballCoinsToday += coinsGranted;
    state.lastBallCoinAtMs = nowMs;
    saveEconomyState(ownerId, state);
  }
  return {
    coinsGranted,
    remainingToday: Math.max(0, BALL_DAILY_COIN_CAP - state.ballCoinsToday),
    cooldownRemainingSec: 0,
    reason: 'granted',
  };
}

export function claimMinigameCoins(
  ownerId: string,
  requestedCoins: number
): EconomyClaimResult {
  const state = loadEconomyState(ownerId);
  const remaining = Math.max(
    0,
    MINIGAME_DAILY_COIN_CAP - state.minigameCoinsToday
  );
  if (remaining <= 0) {
    return {
      coinsGranted: 0,
      remainingToday: 0,
      cooldownRemainingSec: 0,
      reason: 'daily_cap',
    };
  }
  const coinsGranted = Math.max(0, Math.min(requestedCoins, remaining));
  state.minigameCoinsToday += coinsGranted;
  saveEconomyState(ownerId, state);
  return {
    coinsGranted,
    remainingToday: Math.max(
      0,
      MINIGAME_DAILY_COIN_CAP - state.minigameCoinsToday
    ),
    cooldownRemainingSec: 0,
    reason: 'granted',
  };
}

export function getCoinEconomySnapshot(
  ownerId: string,
  nowMs = Date.now()
): CoinEconomySnapshot {
  const state = loadEconomyState(ownerId);
  const petRemainingMs = Math.max(
    0,
    PET_COIN_COOLDOWN_MS - (nowMs - state.lastPetCoinAtMs)
  );
  const ballRemainingMs = Math.max(
    0,
    BALL_COIN_COOLDOWN_MS - (nowMs - state.lastBallCoinAtMs)
  );
  return {
    petCoinsToday: state.petCoinsToday,
    petDailyCap: PET_DAILY_COIN_CAP,
    petCooldownSec: state.lastPetCoinAtMs > 0 ? Math.ceil(petRemainingMs / 1000) : 0,
    ballCoinsToday: state.ballCoinsToday,
    ballDailyCap: BALL_DAILY_COIN_CAP,
    ballCooldownSec:
      state.lastBallCoinAtMs > 0 ? Math.ceil(ballRemainingMs / 1000) : 0,
    minigameCoinsToday: state.minigameCoinsToday,
    minigameDailyCap: MINIGAME_DAILY_COIN_CAP,
  };
}

export function formatMinutesCountdown(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h${String(rem).padStart(2, '0')}`;
}

export function getOrganizedCareSchedule(
  stats: PetStats,
  completedSlots: string[],
  isSleeping: boolean,
  now = new Date()
): OrganizedNeedTiming[] {
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const isInWindow = (slot: RoutineSlotDef): boolean => {
    const targetMins = slot.targetHour * 60 + slot.targetMinute;
    const rawDiff = Math.abs(nowMins - targetMins);
    const circularDiff = Math.min(rawDiff, 1440 - rawDiff);
    return circularDiff <= slot.windowMinutes;
  };

  const buildCategoryTiming = (
    category: RoutineCategory,
    title: string,
    emoji: string,
    currentValue: number,
    cadenceLabel: string
  ): OrganizedNeedTiming => {
    const slots = ROUTINE_SCHEDULE.filter((s) => s.category === category);
    const pendingSlots = slots.filter((s) => !completedSlots.includes(s.id));
    const activeSlot = pendingSlots.find((s) => isInWindow(s)) ?? null;

    let nextSlot: RoutineSlotDef | null = null;
    let minDiff = Infinity;
    for (const s of pendingSlots) {
      const targetMins = s.targetHour * 60 + s.targetMinute;
      const diff = (targetMins - nowMins + 1440) % 1440;
      if (diff < minDiff) {
        minDiff = diff;
        nextSlot = s;
      }
    }

    let statusLabel = '';
    let urgency: 'ok' | 'soon' | 'urgent' = 'ok';
    if (category === 'sleep' && isSleeping) {
      statusLabel = 'Dormindo e recuperando energia 💤';
      urgency = 'ok';
    } else if (currentValue < 30) {
      statusLabel = activeSlot
        ? `Hora de cuidar agora! (${activeSlot.timeLabel})`
        : 'Precisa de atenção em breve!';
      urgency = 'urgent';
    } else if (activeSlot) {
      statusLabel = `Na janela agora: ${activeSlot.label} (${activeSlot.timeLabel})`;
      urgency = 'soon';
    } else if (nextSlot) {
      statusLabel = `Próximo: ${nextSlot.label} em ${formatMinutesCountdown(minDiff)}`;
      urgency = 'ok';
    } else {
      statusLabel = 'Todos os horários de hoje concluídos ✓';
      urgency = 'ok';
    }

    return {
      category,
      title,
      emoji,
      currentValue: Math.round(currentValue),
      cadenceLabel,
      statusLabel,
      urgency,
      activeSlot,
      nextSlot,
      minutesUntilNext: Number.isFinite(minDiff) ? minDiff : 0,
      completedCount: slots.length - pendingSlots.length,
      totalCount: slots.length,
    };
  };

  return [
    buildCategoryTiming(
      'food',
      'Fome',
      '🐟',
      stats.hunger,
      '4 refeições/dia • reduz a cada ~35s'
    ),
    buildCategoryTiming(
      'bath',
      'Banho e Higiene',
      '🛁',
      stats.hygiene,
      '2 banhos/dia • reduz mais devagar (~105s)'
    ),
    buildCategoryTiming(
      'sleep',
      'Sono e Descanso',
      '🌙',
      stats.sleep,
      '3 descansos/dia • reduz moderado (~70s)'
    ),
  ];
}
