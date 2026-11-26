import { getTodayDateKey } from '../../constants';
import { phonicsAudioEngine } from '../learning/phonicsEngine';
import {
  TRACKED_WRITING_CONSONANTS,
  TRACKED_WRITING_VOWELS,
  WRITING_CONSONANTS_UNITS,
  WRITING_GLYPHS,
  WRITING_UNITS,
  type MotorDifficulty,
  type NormalizedPoint,
  type WritingChallenge,
  type WritingUnitDef,
} from './data';

const WRITING_STORAGE_PREFIX = 'miau_writing_v1_';
const WRITING_CONSONANTS_STORAGE_PREFIX = 'miau_writing_consonants_v1_';

export const WRITING_DAILY_GOAL = 3;
export const WRITING_DAILY_BONUS = { coins: 50, xp: 40 };
export const WRITING_FIRST_LETTER_BONUS = { coins: 15, xp: 15 };
export const TRACKED_WRITING_WORDS: ReadonlyArray<string> = [
  'EI',
  'OI',
  'OVO',
  'UVA',
  'AI',
  'AU',
  'UI',
  'LUA',
  'SOL',
  'MIAU',
];

export interface WritingMedalDef {
  id: string;
  emoji: string;
  title: string;
  description: string;
}

export const WRITING_MEDALS: ReadonlyArray<WritingMedalDef> = [
  {
    id: 'medal_first_letter',
    emoji: '🥉',
    title: 'Primeira Letrinha',
    description: 'Completou sua primeira letra escrita com o dedo!',
  },
  {
    id: 'medal_daily_habit',
    emoji: '🔥',
    title: 'Hábito Diário',
    description: 'Bateu a meta diária de 3 letras ou palavras hoje!',
  },
  {
    id: 'medal_vowels_5',
    emoji: '🥇',
    title: 'Mestre das Vogais',
    description: 'Completou todas as 5 vogais (A, E, I, O e U)!',
  },
  {
    id: 'medal_gold_3stars',
    emoji: '💎',
    title: 'Traço de Ouro',
    description: 'Conquistou 3 estrelas perfeitas em uma letra!',
  },
  {
    id: 'medal_streak_3',
    emoji: '🌟',
    title: 'Estudante Fiel',
    description: 'Manteve uma sequência de 3 dias seguidos!',
  },
  {
    id: 'medal_words_hero',
    emoji: '🏆',
    title: 'Pequeno Escritor',
    description: 'Escreveu pelo menos 3 palavras fáceis!',
  },
];

export const CONSONANTS_WRITING_MEDALS: ReadonlyArray<WritingMedalDef> = [
  {
    id: 'medal_first_consonant',
    emoji: '🥉',
    title: 'Primeira Consoante',
    description: 'Completou sua primeira consoante escrita com o dedo!',
  },
  {
    id: 'medal_daily_habit',
    emoji: '🔥',
    title: 'Hábito Diário',
    description: 'Bateu a meta diária de 3 consoantes hoje!',
  },
  {
    id: 'medal_half_consonants',
    emoji: '🏅',
    title: 'Metade do Caminho',
    description: 'Já cobriu pelo menos 11 consoantes diferentes!',
  },
  {
    id: 'medal_all_consonants_21',
    emoji: '🥇',
    title: 'Mestre do B ao Z',
    description: 'Completou todas as 21 consoantes do alfabeto!',
  },
  {
    id: 'medal_gold_3stars',
    emoji: '💎',
    title: 'Traço de Ouro',
    description: 'Conquistou 3 estrelas perfeitas em uma consoante!',
  },
  {
    id: 'medal_streak_3',
    emoji: '🌟',
    title: 'Estudante Fiel',
    description: 'Manteve uma sequência de 3 dias seguidos!',
  },
];

export interface WritingTrackConfig {
  trackId: 'infantil_escrita' | 'infantil_escrita_consoantes';
  kind: 'vowels' | 'consonants';
  storagePrefix: string;
  domPrefix: string;
  headerTitle: string;
  headerSubtitle: string;
  trailSectionTitle: string;
  trackedLabel: string;
  trackedTargets: ReadonlyArray<string>;
  secondaryWords?: ReadonlyArray<string>;
  medals: ReadonlyArray<WritingMedalDef>;
  units: WritingUnitDef[];
  accentBarGradient: string;
  allDoneLabel: string;
  nextLessonLabel: string;
}

export const VOWELS_WRITING_CONFIG: WritingTrackConfig = {
  trackId: 'infantil_escrita',
  kind: 'vowels',
  storagePrefix: WRITING_STORAGE_PREFIX,
  domPrefix: 'wr',
  headerTitle: 'Vamos Escrever ✍️',
  headerSubtitle: 'IA ensina o traçado + prática com o dedo na tela',
  trailSectionTitle: 'Trilha de Coordenação Motora e Escrita (7 Unidades)',
  trackedLabel: 'Vogais',
  trackedTargets: TRACKED_WRITING_VOWELS,
  secondaryWords: TRACKED_WRITING_WORDS,
  medals: WRITING_MEDALS,
  units: WRITING_UNITS,
  accentBarGradient: 'from-[#7b52b8] via-[#a855f7] to-[#ec4899]',
  allDoneLabel: 'Módulo Completo!',
  nextLessonLabel: 'Próxima Aula de Escrita',
};

export const CONSONANTS_WRITING_CONFIG: WritingTrackConfig = {
  trackId: 'infantil_escrita_consoantes',
  kind: 'consonants',
  storagePrefix: WRITING_CONSONANTS_STORAGE_PREFIX,
  domPrefix: 'wc',
  headerTitle: 'Escrevendo as Consoantes ✏️',
  headerSubtitle: 'Cubra todas as 21 consoantes do B ao Z em ordem alfabética',
  trailSectionTitle: 'Trilha das Consoantes do B ao Z (7 Unidades)',
  trackedLabel: 'Consoantes',
  trackedTargets: TRACKED_WRITING_CONSONANTS,
  medals: CONSONANTS_WRITING_MEDALS,
  units: WRITING_CONSONANTS_UNITS,
  accentBarGradient: 'from-[#4f46e5] via-[#7b52b8] to-[#ec4899]',
  allDoneLabel: 'Todas as Consoantes Completas!',
  nextLessonLabel: 'Próxima Aula de Consoantes',
};

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface LaidOutStroke {
  orderIndex: number; // 1-based global order across the whole word/letter
  char: string;
  cue: string;
  points: CanvasPoint[];
}

export interface TargetCanvasLayout {
  strokes: LaidOutStroke[];
  glyphBoxes: Array<{
    char: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  minCanvasDim: number;
}

export interface TraceEvaluationResult {
  verdict: 'positive' | 'medium' | 'retry';
  stars: number;
  coveragePct: number;
  precisionPct: number;
  combinedScore: number;
  feedbackText: string;
  audioScript: string;
}

export interface WritingProgress {
  ownerId: string;
  completedUnits: string[];
  unitBestStars: Record<string, number>;
  totalStars: number;
  streakDays: number;
  bestStreakDays: number;
  lastStudyDateKey: string;
  masteredVowels: Array<'A' | 'E' | 'I' | 'O' | 'U'>;
  masteredConsonants: string[];
  masteredTargets: string[];
  letterBestStars: Record<string, number>;
  dailyGoalTarget: number;
  dailyDateKey: string;
  dailyStepsCount: number;
  dailyCompletedTargets: string[];
  dailyBonusClaimedDateKey: string;
  unlockedMedals: string[];
  freeExploreUnlocked: boolean;
  totalPracticesCompleted: number;
}

export interface WritingStepRewardOutcome {
  progress: WritingProgress;
  isNewLetterMastered: boolean;
  dailyGoalJustCompleted: boolean;
  newlyUnlockedMedals: WritingMedalDef[];
  bonusCoins: number;
  bonusXp: number;
}

export function createDefaultWritingProgress(
  ownerId = 'guest'
): WritingProgress {
  const todayKey = getTodayDateKey();
  return {
    ownerId,
    completedUnits: [],
    unitBestStars: {},
    totalStars: 0,
    streakDays: 0,
    bestStreakDays: 0,
    lastStudyDateKey: '',
    masteredVowels: [],
    masteredConsonants: [],
    masteredTargets: [],
    letterBestStars: {},
    dailyGoalTarget: WRITING_DAILY_GOAL,
    dailyDateKey: todayKey,
    dailyStepsCount: 0,
    dailyCompletedTargets: [],
    dailyBonusClaimedDateKey: '',
    unlockedMedals: [],
    freeExploreUnlocked: false,
    totalPracticesCompleted: 0,
  };
}

function getPreviousDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function syncWritingDailyWindow(progress: WritingProgress): WritingProgress {
  const todayKey = getTodayDateKey();
  const prevDayKey = getPreviousDateKey(todayKey);
  const next = { ...progress };

  if (next.dailyDateKey !== todayKey) {
    next.dailyDateKey = todayKey;
    next.dailyStepsCount = 0;
    next.dailyCompletedTargets = [];
  }

  // Keep streak alive only if practiced today or yesterday
  if (
    next.lastStudyDateKey &&
    next.lastStudyDateKey !== todayKey &&
    next.lastStudyDateKey !== prevDayKey
  ) {
    next.streakDays = 0;
  }
  return next;
}

export function loadWritingProgress(
  ownerId = 'guest',
  config: WritingTrackConfig = VOWELS_WRITING_CONFIG
): WritingProgress {
  const safeId = ownerId || 'guest';
  try {
    const raw = localStorage.getItem(`${config.storagePrefix}${safeId}`);
    if (!raw) return createDefaultWritingProgress(safeId);
    const parsed = JSON.parse(raw) as Partial<WritingProgress>;
    const hydrated: WritingProgress = {
      ...createDefaultWritingProgress(safeId),
      ...parsed,
      ownerId: safeId,
      completedUnits: Array.isArray(parsed.completedUnits)
        ? parsed.completedUnits
        : [],
      unitBestStars: parsed.unitBestStars ?? {},
      masteredVowels: Array.isArray(parsed.masteredVowels)
        ? parsed.masteredVowels
        : [],
      masteredConsonants: Array.isArray(parsed.masteredConsonants)
        ? parsed.masteredConsonants
        : [],
      masteredTargets: Array.isArray(parsed.masteredTargets)
        ? parsed.masteredTargets
        : [],
      letterBestStars: parsed.letterBestStars ?? {},
      dailyGoalTarget: WRITING_DAILY_GOAL,
      dailyCompletedTargets: Array.isArray(parsed.dailyCompletedTargets)
        ? parsed.dailyCompletedTargets
        : [],
      unlockedMedals: Array.isArray(parsed.unlockedMedals)
        ? parsed.unlockedMedals
        : [],
      bestStreakDays: Math.max(
        parsed.bestStreakDays ?? 0,
        parsed.streakDays ?? 0
      ),
    };
    for (const target of hydrated.masteredTargets) {
      if (!hydrated.letterBestStars[target]) {
        hydrated.letterBestStars[target] = 2;
      }
    }
    return syncWritingDailyWindow(hydrated);
  } catch {
    return createDefaultWritingProgress(safeId);
  }
}

export function saveWritingProgress(
  progress: WritingProgress,
  config: WritingTrackConfig = VOWELS_WRITING_CONFIG
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

export function isWritingUnitUnlocked(
  progress: WritingProgress,
  unitIndex: number,
  config: WritingTrackConfig = VOWELS_WRITING_CONFIG
): boolean {
  if (unitIndex <= 0 || progress.freeExploreUnlocked) return true;
  const prev = config.units[unitIndex - 1];
  if (!prev) return true;
  return progress.completedUnits.includes(prev.id);
}

function evaluateWritingMedals(
  progress: WritingProgress,
  config: WritingTrackConfig = VOWELS_WRITING_CONFIG
): string[] {
  const earned = new Set(progress.unlockedMedals);

  if (config.kind === 'consonants') {
    if (
      progress.masteredTargets.length >= 1 ||
      progress.totalPracticesCompleted >= 1
    ) {
      earned.add('medal_first_consonant');
    }
    if (
      progress.dailyBonusClaimedDateKey === getTodayDateKey() ||
      progress.dailyStepsCount >= progress.dailyGoalTarget
    ) {
      earned.add('medal_daily_habit');
    }
    if (progress.masteredConsonants.length >= 11) {
      earned.add('medal_half_consonants');
    }
    if (
      TRACKED_WRITING_CONSONANTS.every(
        (c) =>
          progress.masteredConsonants.includes(c) ||
          progress.masteredTargets.includes(c)
      )
    ) {
      earned.add('medal_all_consonants_21');
    }
    if (
      Object.values(progress.letterBestStars).some((stars) => stars >= 3) ||
      Object.values(progress.unitBestStars).some((stars) => stars >= 3)
    ) {
      earned.add('medal_gold_3stars');
    }
    if (progress.streakDays >= 3 || progress.bestStreakDays >= 3) {
      earned.add('medal_streak_3');
    }
    return Array.from(earned);
  }

  if (
    progress.masteredTargets.length >= 1 ||
    progress.totalPracticesCompleted >= 1
  ) {
    earned.add('medal_first_letter');
  }
  if (
    progress.dailyBonusClaimedDateKey === getTodayDateKey() ||
    progress.dailyStepsCount >= progress.dailyGoalTarget
  ) {
    earned.add('medal_daily_habit');
  }
  if (
    TRACKED_WRITING_VOWELS.every((v) => progress.masteredVowels.includes(v))
  ) {
    earned.add('medal_vowels_5');
  }
  if (
    Object.values(progress.letterBestStars).some((stars) => stars >= 3) ||
    Object.values(progress.unitBestStars).some((stars) => stars >= 3)
  ) {
    earned.add('medal_gold_3stars');
  }
  if (progress.streakDays >= 3 || progress.bestStreakDays >= 3) {
    earned.add('medal_streak_3');
  }
  const wordsCompleted = TRACKED_WRITING_WORDS.filter((w) =>
    progress.masteredTargets.includes(w)
  ).length;
  if (wordsCompleted >= 3) {
    earned.add('medal_words_hero');
  }
  return Array.from(earned);
}

export function getWritingLetterStarsTotal(progress: WritingProgress): number {
  return Object.values(progress.letterBestStars).reduce((a, b) => a + b, 0);
}

export function recordWritingStepSolved(
  progress: WritingProgress,
  challenge: WritingChallenge,
  starsEarned = 2,
  config: WritingTrackConfig = VOWELS_WRITING_CONFIG
): WritingStepRewardOutcome {
  const synced = syncWritingDailyWindow(progress);
  const todayKey = getTodayDateKey();
  const prevDayKey = getPreviousDateKey(todayKey);
  const clampedStars = Math.max(1, Math.min(3, Math.round(starsEarned)));

  const next: WritingProgress = {
    ...synced,
    masteredVowels: [...synced.masteredVowels],
    masteredConsonants: [...synced.masteredConsonants],
    masteredTargets: [...synced.masteredTargets],
    letterBestStars: { ...synced.letterBestStars },
    dailyCompletedTargets: [...synced.dailyCompletedTargets],
    unlockedMedals: [...synced.unlockedMedals],
  };

  const isNewLetterMastered = !next.masteredTargets.includes(
    challenge.targetText
  );
  if (isNewLetterMastered) {
    next.masteredTargets.push(challenge.targetText);
  }

  const prevTargetStars = next.letterBestStars[challenge.targetText] ?? 0;
  next.letterBestStars[challenge.targetText] = Math.max(
    prevTargetStars,
    clampedStars
  );

  if (
    challenge.vowelTag &&
    TRACKED_WRITING_VOWELS.includes(challenge.vowelTag) &&
    !next.masteredVowels.includes(challenge.vowelTag)
  ) {
    next.masteredVowels.push(challenge.vowelTag);
  }

  if (
    challenge.consonantTag &&
    TRACKED_WRITING_CONSONANTS.includes(challenge.consonantTag) &&
    !next.masteredConsonants.includes(challenge.consonantTag)
  ) {
    next.masteredConsonants.push(challenge.consonantTag);
  }

  if (next.lastStudyDateKey === todayKey) {
    next.streakDays = Math.max(1, next.streakDays);
  } else if (next.lastStudyDateKey === prevDayKey) {
    next.streakDays = next.streakDays + 1;
  } else {
    next.streakDays = 1;
  }
  next.bestStreakDays = Math.max(next.bestStreakDays, next.streakDays);
  next.lastStudyDateKey = todayKey;

  next.dailyDateKey = todayKey;
  next.dailyStepsCount += 1;
  if (!next.dailyCompletedTargets.includes(challenge.targetText)) {
    next.dailyCompletedTargets.push(challenge.targetText);
  }
  next.totalPracticesCompleted += 1;

  let bonusCoins = 0;
  let bonusXp = 0;
  if (isNewLetterMastered) {
    bonusCoins += WRITING_FIRST_LETTER_BONUS.coins;
    bonusXp += WRITING_FIRST_LETTER_BONUS.xp;
  }

  let dailyGoalJustCompleted = false;
  if (
    next.dailyStepsCount >= next.dailyGoalTarget &&
    next.dailyBonusClaimedDateKey !== todayKey
  ) {
    next.dailyBonusClaimedDateKey = todayKey;
    dailyGoalJustCompleted = true;
    bonusCoins += WRITING_DAILY_BONUS.coins;
    bonusXp += WRITING_DAILY_BONUS.xp;
  }

  const prevMedalSet = new Set(next.unlockedMedals);
  next.unlockedMedals = evaluateWritingMedals(next, config);
  const newlyUnlockedMedals = config.medals.filter(
    (m) => next.unlockedMedals.includes(m.id) && !prevMedalSet.has(m.id)
  );

  saveWritingProgress(next, config);
  return {
    progress: next,
    isNewLetterMastered,
    dailyGoalJustCompleted,
    newlyUnlockedMedals,
    bonusCoins,
    bonusXp,
  };
}

export function completeWritingUnit(
  progress: WritingProgress,
  unitId: string,
  starsEarned: number,
  config: WritingTrackConfig = VOWELS_WRITING_CONFIG
): WritingProgress {
  const synced = syncWritingDailyWindow(progress);
  const clampedStars = Math.max(1, Math.min(3, starsEarned));
  const todayKey = getTodayDateKey();
  const prevDayKey = getPreviousDateKey(todayKey);

  let nextStreak = synced.streakDays;
  if (synced.lastStudyDateKey === todayKey) {
    nextStreak = Math.max(1, synced.streakDays);
  } else if (synced.lastStudyDateKey === prevDayKey) {
    nextStreak = synced.streakDays + 1;
  } else {
    nextStreak = 1;
  }

  const completedUnits = synced.completedUnits.includes(unitId)
    ? [...synced.completedUnits]
    : [...synced.completedUnits, unitId];
  const prevStars = synced.unitBestStars[unitId] ?? 0;
  const unitBestStars = {
    ...synced.unitBestStars,
    [unitId]: Math.max(prevStars, clampedStars),
  };
  const totalStars = Object.values(unitBestStars).reduce((a, b) => a + b, 0);

  const updated: WritingProgress = {
    ...synced,
    completedUnits,
    unitBestStars,
    totalStars,
    streakDays: nextStreak,
    bestStreakDays: Math.max(synced.bestStreakDays, nextStreak),
    lastStudyDateKey: todayKey,
  };
  updated.unlockedMedals = evaluateWritingMedals(updated, config);
  saveWritingProgress(updated, config);
  return updated;
}

// ---------- Canvas Geometry & Motor Evaluation ----------

export function getMotorGuideWidths(
  motorLevel: MotorDifficulty,
  minCanvasDim: number
): {
  corridorWidth: number;
  dashWidth: number;
  inkWidth: number;
  tolerancePx: number;
} {
  if (motorLevel === 'fino') {
    return {
      corridorWidth: Math.max(14, minCanvasDim * 0.055),
      dashWidth: Math.max(3, minCanvasDim * 0.012),
      inkWidth: Math.max(7, minCanvasDim * 0.026),
      tolerancePx: Math.max(16, minCanvasDim * 0.068),
    };
  }
  if (motorLevel === 'medio') {
    return {
      corridorWidth: Math.max(22, minCanvasDim * 0.085),
      dashWidth: Math.max(4, minCanvasDim * 0.016),
      inkWidth: Math.max(10, minCanvasDim * 0.036),
      tolerancePx: Math.max(21, minCanvasDim * 0.085),
    };
  }
  return {
    corridorWidth: Math.max(32, minCanvasDim * 0.12),
    dashWidth: Math.max(5, minCanvasDim * 0.02),
    inkWidth: Math.max(13, minCanvasDim * 0.048),
    tolerancePx: Math.max(26, minCanvasDim * 0.105),
  };
}

export function layoutTargetStrokes(
  targetText: string,
  canvasWidth: number,
  canvasHeight: number
): TargetCanvasLayout {
  const chars = targetText
    .trim()
    .toUpperCase()
    .split('')
    .filter((c) => Boolean(WRITING_GLYPHS[c]));

  if (chars.length === 0) {
    chars.push('A');
  }

  const padX = canvasWidth * 0.08;
  const padY = canvasHeight * 0.14;
  const usableW = Math.max(40, canvasWidth - padX * 2);
  const usableH = Math.max(40, canvasHeight - padY * 2);

  const gapRatio = chars.length === 1 ? 0 : 0.18;
  const sumAspect = chars.reduce(
    (sum, c) => sum + (WRITING_GLYPHS[c]?.aspectRatio ?? 0.8),
    0
  );
  const totalUnitWidth = sumAspect + gapRatio * Math.max(0, chars.length - 1);

  let glyphHeight = usableH * (chars.length === 1 ? 0.92 : 0.78);
  if (glyphHeight * totalUnitWidth > usableW) {
    glyphHeight = usableW / Math.max(0.5, totalUnitWidth);
  }
  const gapPx = glyphHeight * gapRatio;
  const totalContentWidth =
    glyphHeight * sumAspect + gapPx * Math.max(0, chars.length - 1);

  let cursorX = (canvasWidth - totalContentWidth) / 2;
  const topY = (canvasHeight - glyphHeight) / 2;

  const strokes: LaidOutStroke[] = [];
  const glyphBoxes: TargetCanvasLayout['glyphBoxes'] = [];
  let orderCounter = 1;

  for (const ch of chars) {
    const template = WRITING_GLYPHS[ch];
    const glyphWidth = glyphHeight * template.aspectRatio;
    glyphBoxes.push({
      char: ch,
      x: cursorX,
      y: topY,
      width: glyphWidth,
      height: glyphHeight,
    });

    for (const st of template.strokes) {
      const mapped = st.points.map((pt: NormalizedPoint) => ({
        x: cursorX + pt.x * glyphWidth,
        y: topY + pt.y * glyphHeight,
      }));
      strokes.push({
        orderIndex: orderCounter++,
        char: ch,
        cue: st.cue,
        points: mapped,
      });
    }
    cursorX += glyphWidth + gapPx;
  }

  return {
    strokes,
    glyphBoxes,
    minCanvasDim: Math.min(canvasWidth, canvasHeight),
  };
}

function distSq(a: CanvasPoint, b: CanvasPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function resamplePolyline(
  points: CanvasPoint[],
  stepPx = 5
): CanvasPoint[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [{ ...points[0] }];
  const out: CanvasPoint[] = [{ ...points[0] }];
  let leftover = 0;

  for (let i = 1; i < points.length; i++) {
    let prev = points[i - 1];
    const curr = points[i];
    let segLen = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    if (segLen < 0.001) continue;

    while (leftover + segLen >= stepPx) {
      const need = stepPx - leftover;
      const ratio = need / segLen;
      const nextPt = {
        x: prev.x + (curr.x - prev.x) * ratio,
        y: prev.y + (curr.y - prev.y) * ratio,
      };
      out.push(nextPt);
      prev = nextPt;
      segLen = Math.hypot(curr.x - prev.x, curr.y - prev.y);
      leftover = 0;
    }
    leftover += segLen;
  }
  const last = points[points.length - 1];
  if (Math.hypot(last.x - out[out.length - 1].x, last.y - out[out.length - 1].y) > 1.5) {
    out.push({ ...last });
  }
  return out;
}

export function evaluateHandwritingTrace(
  userStrokes: CanvasPoint[][],
  layout: TargetCanvasLayout,
  targetText: string,
  motorLevel: MotorDifficulty
): TraceEvaluationResult {
  const targetSamples: CanvasPoint[] = [];
  for (const st of layout.strokes) {
    targetSamples.push(...resamplePolyline(st.points, 5));
  }

  const userSamples: CanvasPoint[] = [];
  for (const stroke of userStrokes) {
    if (stroke.length === 1) {
      userSamples.push(stroke[0]);
    } else if (stroke.length > 1) {
      userSamples.push(...resamplePolyline(stroke, 5));
    }
  }

  if (userSamples.length < 5 || targetSamples.length === 0) {
    return {
      verdict: 'retry',
      stars: 0,
      coveragePct: 0,
      precisionPct: 0,
      combinedScore: 0,
      feedbackText: `Passe o dedinho sobre os pontinhos de "${targetText}" antes de verificar!`,
      audioScript: `Miau! Primeiro passe o dedinho cobrindo a letra ${targetText} lá do pontinho número um!`,
    };
  }

  const { tolerancePx } = getMotorGuideWidths(motorLevel, layout.minCanvasDim);
  const tolSq = tolerancePx * tolerancePx;
  const loosePrecisionSq = (tolerancePx * 1.25) * (tolerancePx * 1.25);

  let coveredTargetCount = 0;
  for (const tp of targetSamples) {
    let minD = Infinity;
    for (const up of userSamples) {
      const d = distSq(tp, up);
      if (d < minD) minD = d;
      if (d <= tolSq) break;
    }
    if (minD <= tolSq) coveredTargetCount++;
  }

  let onPathUserCount = 0;
  for (const up of userSamples) {
    let minD = Infinity;
    for (const tp of targetSamples) {
      const d = distSq(up, tp);
      if (d < minD) minD = d;
      if (d <= loosePrecisionSq) break;
    }
    if (minD <= loosePrecisionSq) onPathUserCount++;
  }

  const coveragePct = Math.round(
    (coveredTargetCount / targetSamples.length) * 100
  );
  const precisionPct = Math.round(
    (onPathUserCount / userSamples.length) * 100
  );
  const combinedScore = Math.round(coveragePct * 0.62 + precisionPct * 0.38);

  if (coveragePct >= 62 && precisionPct >= 48) {
    const stars = coveragePct >= 82 && precisionPct >= 68 ? 3 : 2;
    return {
      verdict: 'positive',
      stars,
      coveragePct,
      precisionPct,
      combinedScore,
      feedbackText:
        stars === 3
          ? `Perfeito! Seu traçado de "${targetText}" ficou lindo e bem firme (${coveragePct}% de cobertura)!`
          : `Muito bem! Você cobriu "${targetText}" direitinho! Que mãozinha caprichosa!`,
      audioScript:
        stars === 3
          ? `Miau! Parabéns! Você escreveu ${targetText} com perfeição e ganhou três estrelas!`
          : `Miau! Que legal! Você cobriu ${targetText} muito bem! Continue assim!`,
    };
  }

  if (coveragePct >= 34 && precisionPct >= 32) {
    return {
      verdict: 'medium',
      stars: 1,
      coveragePct,
      precisionPct,
      combinedScore,
      feedbackText: `Quase completo! Você cobriu ${coveragePct}% de "${targetText}". Complete todos os pontinhos com calma!`,
      audioScript: `Quase lá! Falta cobrir só mais um pedacinho da letra ${targetText}. Tente seguir todos os números!`,
    };
  }

  return {
    verdict: 'retry',
    stars: 0,
    coveragePct,
    precisionPct,
    combinedScore,
    feedbackText:
      precisionPct < 35
        ? `O dedo saiu um pouquinho do caminho de "${targetText}". Limpe e tente seguir devagar dentro do pontilhado!`
        : `Cubra toda a forma de "${targetText}" a partir do número 1 para o Miau ver direitinho!`,
    audioScript: `Vamos tentar mais uma vez devagarinho? Toque em limpar e siga a linha pontilhada de ${targetText}!`,
  };
}

export function buildStrokeCueSummary(targetText: string): string[] {
  const chars = targetText
    .trim()
    .toUpperCase()
    .split('')
    .filter((c) => Boolean(WRITING_GLYPHS[c]));
  const cues: string[] = [];
  for (const ch of chars) {
    const tpl = WRITING_GLYPHS[ch];
    if (!tpl) continue;
    if (chars.length > 1) {
      cues.push(`Letra ${ch}: ${tpl.overviewCue}`);
    } else {
      cues.push(...tpl.strokes.map((s) => s.cue));
    }
  }
  return cues;
}

export const writingAudioEngine = phonicsAudioEngine;
