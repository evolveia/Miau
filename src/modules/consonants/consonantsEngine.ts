import { getTodayDateKey } from '../../constants';
import {
  phonicsAudioEngine,
  type ReadingComparisonResult,
} from '../learning/phonicsEngine';
import {
  CONSONANT_UNITS,
  TRACKED_CONSONANTS,
  type ConsonantChallenge,
  type TrackedConsonant,
} from './data';

const STORAGE_PREFIX = 'miau_consonants_v1_';

export interface ConsonantReviewItem {
  challengeId: string;
  unitId: string;
  targetKey: string;
  misses: number;
  lastPracticedMs: number;
}

export interface ConsonantsProgress {
  ownerId: string;
  completedUnits: string[];
  unitBestStars: Record<string, number>;
  totalStars: number;
  streakDays: number;
  lastStudyDateKey: string;
  masteredConsonants: TrackedConsonant[];
  masteredTargets: string[];
  unlockedStickers: string[];
  reviewQueue: Record<string, ConsonantReviewItem>;
  freeExploreUnlocked: boolean;
  totalLessonsCompleted: number;
}

export const consonantsAudioEngine = phonicsAudioEngine;

export function createDefaultConsonantsProgress(
  ownerId = 'guest'
): ConsonantsProgress {
  return {
    ownerId,
    completedUnits: [],
    unitBestStars: {},
    totalStars: 0,
    streakDays: 0,
    lastStudyDateKey: '',
    masteredConsonants: [],
    masteredTargets: [],
    unlockedStickers: [],
    reviewQueue: {},
    freeExploreUnlocked: false,
    totalLessonsCompleted: 0,
  };
}

export function loadConsonantsProgress(ownerId = 'guest'): ConsonantsProgress {
  const safeId = ownerId || 'guest';
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${safeId}`);
    if (!raw) return createDefaultConsonantsProgress(safeId);
    const parsed = JSON.parse(raw) as Partial<ConsonantsProgress>;
    return {
      ...createDefaultConsonantsProgress(safeId),
      ...parsed,
      ownerId: safeId,
      completedUnits: Array.isArray(parsed.completedUnits)
        ? parsed.completedUnits
        : [],
      unitBestStars: parsed.unitBestStars ?? {},
      masteredConsonants: Array.isArray(parsed.masteredConsonants)
        ? parsed.masteredConsonants
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
    return createDefaultConsonantsProgress(safeId);
  }
}

export function saveConsonantsProgress(progress: ConsonantsProgress): void {
  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${progress.ownerId || 'guest'}`,
      JSON.stringify(progress)
    );
  } catch {
    // Ignore storage errors
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

export function isConsonantUnitUnlocked(
  progress: ConsonantsProgress,
  unitIndex: number
): boolean {
  if (unitIndex <= 0 || progress.freeExploreUnlocked) return true;
  const prevUnit = CONSONANT_UNITS[unitIndex - 1];
  if (!prevUnit) return true;
  return progress.completedUnits.includes(prevUnit.id);
}

export function recordConsonantSpacedOutcome(
  progress: ConsonantsProgress,
  challenge: ConsonantChallenge,
  solvedWithoutHintOrError: boolean
): ConsonantsProgress {
  const next: ConsonantsProgress = {
    ...progress,
    masteredConsonants: [...progress.masteredConsonants],
    masteredTargets: [...progress.masteredTargets],
    reviewQueue: { ...progress.reviewQueue },
  };

  if (solvedWithoutHintOrError) {
    if (!next.masteredTargets.includes(challenge.targetKey)) {
      next.masteredTargets.push(challenge.targetKey);
    }
    if (
      TRACKED_CONSONANTS.includes(challenge.consonantTag) &&
      !next.masteredConsonants.includes(challenge.consonantTag)
    ) {
      next.masteredConsonants.push(challenge.consonantTag);
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

  saveConsonantsProgress(next);
  return next;
}

export function completeConsonantUnit(
  progress: ConsonantsProgress,
  unitId: string,
  starsEarned: number
): { updated: ConsonantsProgress; newlyUnlockedSticker: boolean } {
  const unit = CONSONANT_UNITS.find((u) => u.id === unitId);
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

  const masteredConsonants = [...progress.masteredConsonants];
  if (unit) {
    for (const c of unit.consonantsFocus) {
      if (!masteredConsonants.includes(c)) {
        masteredConsonants.push(c);
      }
    }
  }

  const updated: ConsonantsProgress = {
    ...progress,
    completedUnits,
    unitBestStars,
    totalStars,
    streakDays: nextStreak,
    lastStudyDateKey: todayKey,
    masteredConsonants,
    unlockedStickers,
    totalLessonsCompleted: progress.totalLessonsCompleted + 1,
  };
  saveConsonantsProgress(updated);
  return { updated, newlyUnlockedSticker };
}

export function getPendingConsonantReviewChallenges(
  progress: ConsonantsProgress,
  limit = 5
): ConsonantChallenge[] {
  const entries = Object.values(progress.reviewQueue).sort(
    (a, b) => b.misses - a.misses || a.lastPracticedMs - b.lastPracticedMs
  );
  const allChallenges = CONSONANT_UNITS.flatMap((u) => u.challenges);
  const result: ConsonantChallenge[] = [];
  for (const item of entries) {
    const found = allChallenges.find((c) => c.id === item.challengeId);
    if (found) result.push(found);
    if (result.length >= limit) break;
  }
  return result;
}

// ---------- Pronunciation Comparison (PT-BR Consonant Words) ----------

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
    .replace(/\b(eu falei|eu disse|a palavra|a letra|e a letra|eh a letra|letra)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped || norm;
}

const PT_CONSONANT_NAMES: Record<string, string[]> = {
  b: ['b', 'be', 'bi'],
  c: ['c', 'ce', 'se'],
  d: ['d', 'de', 'di'],
  f: ['f', 'efe', 'efi'],
  g: ['g', 'ge', 'je'],
  h: ['h', 'aga'],
  j: ['j', 'jota'],
  k: ['k', 'ka', 'ca'],
  l: ['l', 'ele', 'eli'],
  m: ['m', 'eme', 'emi'],
  n: ['n', 'ene', 'eni'],
  p: ['p', 'pe', 'pi'],
  q: ['q', 'que', 'ke'],
  r: ['r', 'erre', 'eri'],
  s: ['s', 'esse', 'esi'],
  t: ['t', 'te', 'ti'],
  v: ['v', 've', 'vi'],
  w: ['w', 'dablio', 'dabliu'],
  x: ['x', 'xis'],
  y: ['y', 'ipsilon'],
  z: ['z', 'ze', 'zi'],
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

export function evaluateConsonantReadingAttempt(
  spokenTranscript: string,
  challenge: ConsonantChallenge
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
  const letterAliases = PT_CONSONANT_NAMES[baseNorm] || [];
  const candidates = Array.from(
    new Set([
      expectedDisplay,
      ...(challenge.speakAcceptedVariants || []),
      ...letterAliases,
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
  if (pct >= 68) {
    return {
      verdict: 'positive',
      score: pct,
      spokenDisplay: spokenClean,
      expectedDisplay,
      feedbackText: `Excelente! Você pronunciou "${spokenClean}" bem parecido com "${expectedDisplay}" (${pct}%)!`,
      feedbackAudioText: `Miau!! Muito bem! Você falou ${expectedDisplay} direitinho!`,
      targetReplayAudioText: expectedDisplay,
    };
  }

  if (pct >= 35) {
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
