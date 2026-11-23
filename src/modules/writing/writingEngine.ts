import { getTodayDateKey } from '../../constants';
import { phonicsAudioEngine } from '../learning/phonicsEngine';
import {
  TRACKED_WRITING_VOWELS,
  WRITING_GLYPHS,
  WRITING_UNITS,
  type MotorDifficulty,
  type NormalizedPoint,
  type WritingChallenge,
} from './data';

const WRITING_STORAGE_PREFIX = 'miau_writing_v1_';

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
  lastStudyDateKey: string;
  masteredVowels: Array<'A' | 'E' | 'I' | 'O' | 'U'>;
  masteredTargets: string[];
  freeExploreUnlocked: boolean;
  totalPracticesCompleted: number;
}

export function createDefaultWritingProgress(
  ownerId = 'guest'
): WritingProgress {
  return {
    ownerId,
    completedUnits: [],
    unitBestStars: {},
    totalStars: 0,
    streakDays: 0,
    lastStudyDateKey: '',
    masteredVowels: [],
    masteredTargets: [],
    freeExploreUnlocked: false,
    totalPracticesCompleted: 0,
  };
}

export function loadWritingProgress(ownerId = 'guest'): WritingProgress {
  const safeId = ownerId || 'guest';
  try {
    const raw = localStorage.getItem(`${WRITING_STORAGE_PREFIX}${safeId}`);
    if (!raw) return createDefaultWritingProgress(safeId);
    const parsed = JSON.parse(raw) as Partial<WritingProgress>;
    return {
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
      masteredTargets: Array.isArray(parsed.masteredTargets)
        ? parsed.masteredTargets
        : [],
    };
  } catch {
    return createDefaultWritingProgress(safeId);
  }
}

export function saveWritingProgress(progress: WritingProgress): void {
  try {
    localStorage.setItem(
      `${WRITING_STORAGE_PREFIX}${progress.ownerId || 'guest'}`,
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
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function isWritingUnitUnlocked(
  progress: WritingProgress,
  unitIndex: number
): boolean {
  if (unitIndex <= 0 || progress.freeExploreUnlocked) return true;
  const prev = WRITING_UNITS[unitIndex - 1];
  if (!prev) return true;
  return progress.completedUnits.includes(prev.id);
}

export function recordWritingStepSolved(
  progress: WritingProgress,
  challenge: WritingChallenge
): WritingProgress {
  const next: WritingProgress = {
    ...progress,
    masteredVowels: [...progress.masteredVowels],
    masteredTargets: [...progress.masteredTargets],
  };

  if (!next.masteredTargets.includes(challenge.targetText)) {
    next.masteredTargets.push(challenge.targetText);
  }
  if (
    challenge.vowelTag &&
    TRACKED_WRITING_VOWELS.includes(challenge.vowelTag) &&
    !next.masteredVowels.includes(challenge.vowelTag)
  ) {
    next.masteredVowels.push(challenge.vowelTag);
  }
  next.totalPracticesCompleted += 1;
  saveWritingProgress(next);
  return next;
}

export function completeWritingUnit(
  progress: WritingProgress,
  unitId: string,
  starsEarned: number
): WritingProgress {
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
  const unitBestStars = {
    ...progress.unitBestStars,
    [unitId]: Math.max(prevStars, clampedStars),
  };
  const totalStars = Object.values(unitBestStars).reduce((a, b) => a + b, 0);

  const updated: WritingProgress = {
    ...progress,
    completedUnits,
    unitBestStars,
    totalStars,
    streakDays: nextStreak,
    lastStudyDateKey: todayKey,
  };
  saveWritingProgress(updated);
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
