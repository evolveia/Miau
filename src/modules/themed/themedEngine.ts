import { getTodayDateKey } from '../../constants';
import {
  phonicsAudioEngine,
  type ReadingComparisonResult,
} from '../learning/phonicsEngine';
import type {
  ThemedChallenge,
  ThemedModuleConfig,
} from './types';

export interface ThemedReviewItem {
  challengeId: string;
  unitId: string;
  targetKey: string;
  misses: number;
  lastPracticedMs: number;
}

export interface ThemedProgress {
  ownerId: string;
  completedUnits: string[];
  unitBestStars: Record<string, number>;
  totalStars: number;
  streakDays: number;
  lastStudyDateKey: string;
  masteredTags: string[];
  masteredTargets: string[];
  unlockedStickers: string[];
  reviewQueue: Record<string, ThemedReviewItem>;
  freeExploreUnlocked: boolean;
  totalLessonsCompleted: number;
}

export const themedAudioEngine = phonicsAudioEngine;

export function createDefaultThemedProgress(
  ownerId = 'guest'
): ThemedProgress {
  return {
    ownerId,
    completedUnits: [],
    unitBestStars: {},
    totalStars: 0,
    streakDays: 0,
    lastStudyDateKey: '',
    masteredTags: [],
    masteredTargets: [],
    unlockedStickers: [],
    reviewQueue: {},
    freeExploreUnlocked: false,
    totalLessonsCompleted: 0,
  };
}

export function loadThemedProgress(
  config: ThemedModuleConfig,
  ownerId = 'guest'
): ThemedProgress {
  const safeId = ownerId || 'guest';
  try {
    const raw = localStorage.getItem(`${config.storagePrefix}${safeId}`);
    if (!raw) return createDefaultThemedProgress(safeId);
    const parsed = JSON.parse(raw) as Partial<ThemedProgress>;
    return {
      ...createDefaultThemedProgress(safeId),
      ...parsed,
      ownerId: safeId,
      completedUnits: Array.isArray(parsed.completedUnits)
        ? parsed.completedUnits
        : [],
      unitBestStars: parsed.unitBestStars ?? {},
      masteredTags: Array.isArray(parsed.masteredTags)
        ? parsed.masteredTags
        : [],
      masteredTargets: Array.isArray(parsed.masteredTargets)
        ? parsed.masteredTargets
        : [],
      unlockedStickers: Array.isArray(parsed.unlockedStickers)
        ? parsed.unlockedStickers
        : [],
      reviewQueue: parsed.reviewQueue ?? {},
    };
  } catch {
    return createDefaultThemedProgress(safeId);
  }
}

export function saveThemedProgress(
  config: ThemedModuleConfig,
  progress: ThemedProgress
): void {
  try {
    localStorage.setItem(
      `${config.storagePrefix}${progress.ownerId || 'guest'}`,
      JSON.stringify(progress)
    );
  } catch {
    // Ignore storage quota errors
  }
}

function getPreviousDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function isThemedUnitUnlocked(
  config: ThemedModuleConfig,
  progress: ThemedProgress,
  unitIndex: number
): boolean {
  if (unitIndex <= 0 || progress.freeExploreUnlocked) return true;
  const prevUnit = config.units[unitIndex - 1];
  if (!prevUnit) return true;
  return progress.completedUnits.includes(prevUnit.id);
}

export function recordThemedSpacedOutcome(
  config: ThemedModuleConfig,
  progress: ThemedProgress,
  challenge: ThemedChallenge,
  solvedWithoutHintOrError: boolean
): ThemedProgress {
  const next: ThemedProgress = {
    ...progress,
    masteredTags: [...progress.masteredTags],
    masteredTargets: [...progress.masteredTargets],
    reviewQueue: { ...progress.reviewQueue },
  };

  if (solvedWithoutHintOrError) {
    if (!next.masteredTargets.includes(challenge.targetKey)) {
      next.masteredTargets.push(challenge.targetKey);
    }
    if (
      challenge.masteryTag &&
      !next.masteredTags.includes(challenge.masteryTag)
    ) {
      next.masteredTags.push(challenge.masteryTag);
    }
    const existing = next.reviewQueue[challenge.id];
    if (existing) {
      if (existing.misses <= 1) {
        delete next.reviewQueue[challenge.id];
      } else {
        next.reviewQueue[challenge.id] = {
          ...existing,
          misses: existing.misses - 1,
          lastPracticedMs: Date.now(),
        };
      }
    }
  } else {
    const prevMisses = next.reviewQueue[challenge.id]?.misses ?? 0;
    next.reviewQueue[challenge.id] = {
      challengeId: challenge.id,
      unitId: challenge.unitId,
      targetKey: challenge.targetKey,
      misses: Math.min(5, prevMisses + 1),
      lastPracticedMs: Date.now(),
    };
  }

  saveThemedProgress(config, next);
  return next;
}

export function completeThemedUnit(
  config: ThemedModuleConfig,
  progress: ThemedProgress,
  unitId: string,
  starsEarned: number
): { updated: ThemedProgress; newlyUnlockedSticker: boolean } {
  const unit = config.units.find((u) => u.id === unitId);
  const clampedStars = Math.max(1, Math.min(3, starsEarned));
  const todayKey = getTodayDateKey();
  const prevDayKey = getPreviousDateKey(todayKey);

  let nextStreak = progress.streakDays;
  if (progress.lastStudyDateKey === todayKey) {
    nextStreak = Math.max(1, progress.streakDays);
  } else if (progress.lastStudyDateKey === prevDayKey) {
    nextStreak = progress.streakDays + 1;
  } else {
    nextStreak = 1;
  }

  const completedUnits = progress.completedUnits.includes(unitId)
    ? [...progress.completedUnits]
    : [...progress.completedUnits, unitId];

  const prevStars = progress.unitBestStars[unitId] ?? 0;
  const bestStars = Math.max(prevStars, clampedStars);
  const unitBestStars = {
    ...progress.unitBestStars,
    [unitId]: bestStars,
  };
  const totalStars = Object.values(unitBestStars).reduce((a, b) => a + b, 0);

  const unlockedStickers = [...progress.unlockedStickers];
  let newlyUnlockedSticker = false;
  if (unit && !unlockedStickers.includes(unit.sticker.id)) {
    unlockedStickers.push(unit.sticker.id);
    newlyUnlockedSticker = true;
  }

  const masteredTags = [...progress.masteredTags];
  if (unit) {
    for (const ch of unit.challenges) {
      if (ch.masteryTag && !masteredTags.includes(ch.masteryTag)) {
        masteredTags.push(ch.masteryTag);
      }
    }
  }

  const updated: ThemedProgress = {
    ...progress,
    completedUnits,
    unitBestStars,
    totalStars,
    streakDays: nextStreak,
    lastStudyDateKey: todayKey,
    masteredTags,
    unlockedStickers,
    totalLessonsCompleted: progress.totalLessonsCompleted + 1,
  };
  saveThemedProgress(config, updated);
  return { updated, newlyUnlockedSticker };
}

export function getPendingThemedReviewChallenges(
  config: ThemedModuleConfig,
  progress: ThemedProgress,
  limit = 5
): ThemedChallenge[] {
  const entries = Object.values(progress.reviewQueue).sort(
    (a, b) => b.misses - a.misses || a.lastPracticedMs - b.lastPracticedMs
  );
  const allChallenges = config.units.flatMap((u) => u.challenges);
  const result: ThemedChallenge[] = [];
  for (const item of entries) {
    const found = allChallenges.find((c) => c.id === item.challengeId);
    if (found) result.push(found);
    if (result.length >= limit) break;
  }
  return result;
}

// ---------- PT-BR Speech Recognition Calibration ----------

function normalizePt(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function collapseElongatedChars(text: string): string {
  return text.replace(/(.)\1{2,}/g, '$1$1').replace(/\b([aeiou])\1+\b/g, '$1');
}

function stripSpokenWrapperPhrases(norm: string, targetNorm: string): string {
  if (norm === targetNorm) return norm;
  const stripped = norm
    .replace(
      /\b(eu falei|eu disse|a palavra|o numero|a cor|a forma|o animal|a fruta|e o|eh o|e a|eh a|sao)\b/g,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
  return stripped || norm;
}

const NUMBER_WORD_ALIASES: Record<string, string[]> = {
  '0': ['0', 'zero'],
  '1': ['1', 'um', 'uma'],
  '2': ['2', 'dois', 'duas'],
  '3': ['3', 'tres'],
  '4': ['4', 'quatro'],
  '5': ['5', 'cinco'],
  '6': ['6', 'seis', 'meia'],
  '7': ['7', 'sete'],
  '8': ['8', 'oito'],
  '9': ['9', 'nove'],
  '10': ['10', 'dez'],
  '11': ['11', 'onze'],
  '12': ['12', 'doze'],
  '13': ['13', 'treze'],
  '14': ['14', 'quatorze', 'catorze'],
  '15': ['15', 'quinze'],
  '16': ['16', 'dezesseis'],
  '17': ['17', 'dezessete'],
  '18': ['18', 'dezoito'],
  '19': ['19', 'dezenove'],
  '20': ['20', 'vinte'],
  zero: ['0', 'zero'],
  um: ['1', 'um'],
  dois: ['2', 'dois'],
  tres: ['3', 'tres'],
  quatro: ['4', 'quatro'],
  cinco: ['5', 'cinco'],
  seis: ['6', 'seis'],
  sete: ['7', 'sete'],
  oito: ['8', 'oito'],
  nove: ['9', 'nove'],
  dez: ['10', 'dez'],
  onze: ['11', 'onze'],
  doze: ['12', 'doze'],
  treze: ['13', 'treze'],
  quatorze: ['14', 'quatorze', 'catorze'],
  quinze: ['15', 'quinze'],
  dezesseis: ['16', 'dezesseis'],
  dezessete: ['17', 'dezessete'],
  dezoito: ['18', 'dezoito'],
  dezenove: ['19', 'dezenove'],
  vinte: ['20', 'vinte'],
  dobro: ['dobro', 'o dobro'],
  metade: ['metade', 'a metade'],
  igual: ['igual', 'iguais'],
};

function toPtPhoneticSkeleton(raw: string, targetRaw = ''): string {
  const norm = collapseElongatedChars(normalizePt(raw));
  const targetNorm = collapseElongatedChars(normalizePt(targetRaw));
  return stripSpokenWrapperPhrases(norm, targetNorm)
    .replace(/qu([ei])/g, 'k$1')
    .replace(/c([ei])/g, 's$1')
    .replace(/c/g, 'k')
    .replace(/ç/g, 's')
    .replace(/ch/g, 'x')
    .replace(/rr/g, 'r')
    .replace(/lh/g, 'li')
    .replace(/nh/g, 'ni')
    .replace(/([a-z])l\b/g, '$1u')
    .replace(/ou/g, 'o')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0)
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function stringSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return Math.max(0, 1 - levenshteinDistance(a, b) / maxLen);
}

export function evaluateThemedReadingAttempt(
  spokenTranscript: string,
  challenge: ThemedChallenge
): ReadingComparisonResult {
  const expectedDisplay =
    challenge.speakTargetText ||
    challenge.speakVisualLabel ||
    challenge.keywords[0] ||
    challenge.targetKey;
  const spokenClean = spokenTranscript.trim();
  const normalizedSpoken = normalizePt(spokenClean);

  if (!normalizedSpoken) {
    return {
      verdict: 'negative',
      score: 0,
      spokenDisplay: '(silêncio ou som baixinho)',
      expectedDisplay,
      feedbackText: `O Miau ainda não conseguiu ouvir "${expectedDisplay}". Chegue pertinho do microfone, ouça o som do Miau e tente novamente!`,
      feedbackAudioText: `O Miau ainda não conseguiu te ouvir. Escute bem: ${expectedDisplay}. Clique no microfone e fale comigo!`,
      targetReplayAudioText: expectedDisplay,
    };
  }

  const baseNorm = normalizePt(expectedDisplay);
  const numberAliases = NUMBER_WORD_ALIASES[baseNorm] || [];
  const candidates = Array.from(
    new Set([
      expectedDisplay,
      ...(challenge.speakAcceptedVariants || []),
      ...numberAliases,
    ])
  );

  let bestScore = 0;
  for (const cand of candidates) {
    const normCand = collapseElongatedChars(normalizePt(cand));
    const cleanedSpoken = stripSpokenWrapperPhrases(
      collapseElongatedChars(normalizedSpoken),
      normCand
    );
    if (
      cleanedSpoken === normCand ||
      normalizedSpoken === normCand ||
      (normCand.length >= 3 && cleanedSpoken.includes(normCand)) ||
      (normCand.length <= 2 && cleanedSpoken.split(' ').includes(normCand))
    ) {
      bestScore = Math.max(bestScore, 0.98);
      continue;
    }
    const directSim = stringSimilarity(cleanedSpoken, normCand);
    const phonSim = stringSimilarity(
      toPtPhoneticSkeleton(spokenClean, cand),
      toPtPhoneticSkeleton(cand, cand)
    );
    bestScore = Math.max(bestScore, directSim, phonSim);
  }

  const pct = Math.round(bestScore * 100);
  if (pct >= 66) {
    return {
      verdict: 'positive',
      score: pct,
      spokenDisplay: spokenClean,
      expectedDisplay,
      feedbackText: `Excelente! Você falou "${spokenClean}" bem parecido com "${expectedDisplay}" (${pct}%)!`,
      feedbackAudioText: `Miau!! Muito bem! Você falou ${expectedDisplay} direitinho!`,
      targetReplayAudioText: expectedDisplay,
    };
  }

  if (pct >= 34) {
    return {
      verdict: 'medium',
      score: pct,
      spokenDisplay: spokenClean,
      expectedDisplay,
      feedbackText: `Quase lá! O Miau ouviu "${spokenClean}" (${pct}%). Ouça "${expectedDisplay}" novamente e fale pertinho do microfone!`,
      feedbackAudioText: `Quase igual! Ouça o Miau falando: ${expectedDisplay}. Agora clique para falar de novo!`,
      targetReplayAudioText: expectedDisplay,
    };
  }

  return {
    verdict: 'negative',
    score: pct,
    spokenDisplay: spokenClean,
    expectedDisplay,
    feedbackText: `Ainda não ficou parecido com "${expectedDisplay}" (o Miau ouviu "${spokenClean}"). Escute a palavra e tente ler mais uma vez!`,
    feedbackAudioText: `Ainda não ficou parecido. Escute com carinho: ${expectedDisplay}. Agora tente falar mais uma vez!`,
    targetReplayAudioText: expectedDisplay,
  };
}
