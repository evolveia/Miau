import { getTodayDateKey } from '../constants';
import { EARLY_LITERACY_UNITS } from '../data/earlyLiteracyData';
import { CONSONANT_UNITS } from '../modules/consonants/data';
import { loadConsonantsProgress } from '../modules/consonants/consonantsEngine';
import type { LiteracyChallenge } from '../modules/learning/data';
import { loadEarlyLiteracyProgress } from '../modules/learning/phonicsEngine';
import { ADICAO_SUBTRACAO_CONFIG } from '../modules/themed/adicaoSubtracaoData';
import { ANIMAIS_NATUREZA_CONFIG } from '../modules/themed/animaisNaturezaData';
import { COMIDAS_BEBIDAS_CONFIG } from '../modules/themed/comidasBebidasData';
import { CORES_FORMAS_CONFIG } from '../modules/themed/coresFormasData';
import { FUND1_CIENCIAS_CONFIG } from '../modules/themed/fund1CienciasData';
import { FUND1_LEITURA_CONFIG } from '../modules/themed/fund1LeituraData';
import { FUND1_MATEMATICA_CONFIG } from '../modules/themed/fund1MatematicaData';
import { FUND2_CIENCIAS_CONFIG } from '../modules/themed/fund2CienciasData';
import { FUND2_HISTORIA_CONFIG } from '../modules/themed/fund2HistoriaData';
import { FUND2_LOGICA_CONFIG } from '../modules/themed/fund2LogicaData';
import { LOGICA_MATEMATICA_CONFIG } from '../modules/themed/logicaMatematicaData';
import { loadThemedProgress } from '../modules/themed/themedEngine';
import type { ThemedChallenge, ThemedModuleConfig } from '../modules/themed/types';
import {
  WRITING_CONSONANTS_UNITS,
  WRITING_UNITS,
} from '../modules/writing/data';
import {
  CONSONANTS_WRITING_CONFIG,
  VOWELS_WRITING_CONFIG,
  loadWritingProgress,
} from '../modules/writing/writingEngine';
import type { EducationTrackId, SchoolingLevel } from '../types';

const SMART_REVIEW_STORAGE_PREFIX = 'miau_smart_review_daily_v1_';

export type SmartReviewReasonTag =
  | 'review_queue'
  | 'low_stars'
  | 'stale_5d'
  | 'recommended';

export interface SmartReviewOption {
  id: string;
  label: string;
  emoji?: string;
}

export interface SmartReviewQuestion {
  id: string;
  trackId: EducationTrackId;
  trackTitle: string;
  trackEmoji: string;
  unitTitle: string;
  reasonTag: SmartReviewReasonTag;
  reasonLabel: string;
  instruction: string;
  audioText: string;
  hintText: string;
  praiseText: string;
  visualAssetUrl?: string;
  visualEmoji?: string;
  options: SmartReviewOption[];
  correctOptionId: string;
}

export interface SmartReviewSession {
  dateKey: string;
  questions: SmartReviewQuestion[];
  completedToday: boolean;
  lastScoreToday: number;
  lastTotalToday: number;
  summaryReason: string;
}

interface SmartReviewDailyStorage {
  dateKey: string;
  completed: boolean;
  lastScore: number;
  lastTotal: number;
  sessionsToday: number;
}

interface ThemedTrackMeta {
  config: ThemedModuleConfig;
  title: string;
  emoji: string;
  schooling: SchoolingLevel;
}

const ALL_THEMED_TRACKS: ThemedTrackMeta[] = [
  { config: CORES_FORMAS_CONFIG, title: 'Cores, Formas e Contagem', emoji: '🎨', schooling: 'educacao_infantil' },
  { config: ADICAO_SUBTRACAO_CONFIG, title: 'Somar e Subtrair com o Miau', emoji: '➕', schooling: 'educacao_infantil' },
  { config: LOGICA_MATEMATICA_CONFIG, title: 'Comparação, Dobro e Probleminhas', emoji: '🧮', schooling: 'educacao_infantil' },
  { config: ANIMAIS_NATUREZA_CONFIG, title: 'Animais e Natureza', emoji: '🦋', schooling: 'educacao_infantil' },
  { config: COMIDAS_BEBIDAS_CONFIG, title: 'Comidas e Bebidas', emoji: '🍓', schooling: 'educacao_infantil' },
  { config: FUND1_LEITURA_CONFIG, title: 'Leitura Mágica e Interpretação', emoji: '📖', schooling: 'fundamental_1' },
  { config: FUND1_MATEMATICA_CONFIG, title: 'Tabuada e Desafios de Soma', emoji: '🧮', schooling: 'fundamental_1' },
  { config: FUND1_CIENCIAS_CONFIG, title: 'Planeta Terra e Biomas do Brasil', emoji: '🌎', schooling: 'fundamental_1' },
  { config: FUND2_LOGICA_CONFIG, title: 'Lógica, Frações e Equações', emoji: '📐', schooling: 'fundamental_2' },
  { config: FUND2_CIENCIAS_CONFIG, title: 'Corpo Humano, Energia e Universo', emoji: '🔬', schooling: 'fundamental_2' },
  { config: FUND2_HISTORIA_CONFIG, title: 'História, Cultura e Cidadania', emoji: '🏛️', schooling: 'fundamental_2' },
];

export function daysSinceDateKey(dateKey: string, nowDateKey: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !/^\d{4}-\d{2}-\d{2}$/.test(nowDateKey)) {
    return 0;
  }
  const [y1, m1, d1] = dateKey.split('-').map(Number);
  const [y2, m2, d2] = nowDateKey.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.max(0, Math.round((t2 - t1) / 86_400_000));
}

function getReasonLabel(tag: SmartReviewReasonTag, detail?: string): string {
  switch (tag) {
    case 'review_queue':
      return '🔄 Foco em erro recente';
    case 'low_stars':
      return detail ? `⭐ Reforçar (${detail})` : '⭐ Menos de 3 estrelas';
    case 'stale_5d':
      return detail ? `📅 ${detail}` : '📅 +5 dias sem revisar';
    default:
      return '✨ Treino sugerido';
  }
}

function convertStandardChallengeToQuestion(
  trackId: EducationTrackId,
  trackTitle: string,
  trackEmoji: string,
  unitTitle: string,
  reasonTag: SmartReviewReasonTag,
  reasonDetail: string | undefined,
  ch: Pick<
    LiteracyChallenge | ThemedChallenge,
    | 'id'
    | 'type'
    | 'instruction'
    | 'audioNormalText'
    | 'hintText'
    | 'praiseText'
    | 'visualAssetUrl'
    | 'options'
    | 'correctOptionId'
    | 'wordSegments'
    | 'missingAnswer'
    | 'letterBank'
  > & {
    letterChoices?: string[];
    correctLetter?: string;
    choiceBadges?: string[];
    correctBadge?: string;
    speakVisualEmoji?: string;
  }
): SmartReviewQuestion | null {
  const base = {
    id: `sr_${trackId}_${ch.id}`,
    trackId,
    trackTitle,
    trackEmoji,
    unitTitle,
    reasonTag,
    reasonLabel: getReasonLabel(reasonTag, reasonDetail),
    audioText: ch.audioNormalText || ch.instruction,
    hintText: ch.hintText,
    praiseText: ch.praiseText,
    visualAssetUrl: ch.visualAssetUrl,
    visualEmoji: ch.speakVisualEmoji || trackEmoji,
  };

  if (
    (ch.type === 'listen_pick' || ch.type === 'rhyme_fun') &&
    ch.options &&
    ch.options.length >= 2 &&
    ch.correctOptionId
  ) {
    return {
      ...base,
      instruction: ch.instruction,
      options: ch.options.map((o) => ({
        id: o.id,
        label: o.label,
        emoji: o.emoji,
      })),
      correctOptionId: ch.correctOptionId,
    };
  }

  if (
    ch.type === 'sound_to_letter' &&
    ch.letterChoices &&
    ch.letterChoices.length >= 2 &&
    ch.correctLetter
  ) {
    return {
      ...base,
      instruction: ch.instruction,
      options: ch.letterChoices.map((l) => ({
        id: l,
        label: l,
        emoji: '🔤',
      })),
      correctOptionId: ch.correctLetter,
    };
  }

  if (
    ch.type === 'sound_to_badge' &&
    ch.choiceBadges &&
    ch.choiceBadges.length >= 2 &&
    ch.correctBadge
  ) {
    return {
      ...base,
      instruction: ch.instruction,
      options: ch.choiceBadges.map((b) => ({
        id: b,
        label: b,
      })),
      correctOptionId: ch.correctBadge,
    };
  }

  if (
    ch.type === 'complete_word' &&
    ch.letterBank &&
    ch.letterBank.length >= 2 &&
    ch.missingAnswer
  ) {
    const wordHint = (ch.wordSegments || [])
      .map((seg) => (seg === null ? '___' : seg))
      .join(' ');
    return {
      ...base,
      instruction: `${ch.instruction}${wordHint ? ` (${wordHint})` : ''}`,
      options: ch.letterBank.map((token) => ({
        id: token,
        label: token,
        emoji: '🧩',
      })),
      correctOptionId: ch.missingAnswer,
    };
  }

  return null;
}

export function getSmartReviewDailyState(
  ownerId = 'guest',
  dateKey = getTodayDateKey()
): SmartReviewDailyStorage {
  const safeOwner = ownerId || 'guest';
  try {
    const raw = localStorage.getItem(`${SMART_REVIEW_STORAGE_PREFIX}${safeOwner}`);
    if (!raw) {
      return {
        dateKey,
        completed: false,
        lastScore: 0,
        lastTotal: 0,
        sessionsToday: 0,
      };
    }
    const parsed = JSON.parse(raw) as Partial<SmartReviewDailyStorage>;
    if (parsed.dateKey !== dateKey) {
      return {
        dateKey,
        completed: false,
        lastScore: 0,
        lastTotal: 0,
        sessionsToday: 0,
      };
    }
    return {
      dateKey,
      completed: Boolean(parsed.completed),
      lastScore: Number(parsed.lastScore || 0),
      lastTotal: Number(parsed.lastTotal || 0),
      sessionsToday: Number(parsed.sessionsToday || 0),
    };
  } catch {
    return {
      dateKey,
      completed: false,
      lastScore: 0,
      lastTotal: 0,
      sessionsToday: 0,
    };
  }
}

export function markSmartReviewCompleted(
  ownerId: string,
  score: number,
  total: number,
  dateKey = getTodayDateKey()
): { isFirstCompletionToday: boolean; coinsReward: number; xpReward: number } {
  const safeOwner = ownerId || 'guest';
  const prev = getSmartReviewDailyState(safeOwner, dateKey);
  const isFirstCompletionToday = !prev.completed;
  const next: SmartReviewDailyStorage = {
    dateKey,
    completed: true,
    lastScore: score,
    lastTotal: total,
    sessionsToday: prev.sessionsToday + 1,
  };
  try {
    localStorage.setItem(
      `${SMART_REVIEW_STORAGE_PREFIX}${safeOwner}`,
      JSON.stringify(next)
    );
  } catch {
    // Ignore storage quota errors
  }
  return {
    isFirstCompletionToday,
    coinsReward: isFirstCompletionToday ? 35 : 8,
    xpReward: isFirstCompletionToday ? 30 : 8,
  };
}

export function buildSmartReviewSession(params: {
  ownerId?: string;
  schooling?: SchoolingLevel | '';
  nowDateKey?: string;
  desiredCount?: number;
}): SmartReviewSession {
  const safeOwner = params.ownerId || 'guest';
  const nowDateKey = params.nowDateKey || getTodayDateKey();
  const desiredCount = Math.max(3, Math.min(5, params.desiredCount ?? 4));
  const daily = getSmartReviewDailyState(safeOwner, nowDateKey);

  const candidates: Array<{ priority: number; question: SmartReviewQuestion }> = [];
  const seenKeys = new Set<string>();

  const pushCandidate = (
    priority: number,
    question: SmartReviewQuestion | null
  ) => {
    if (!question) return;
    const dedupeKey = `${question.trackId}:${question.id}`;
    if (seenKeys.has(dedupeKey)) return;
    seenKeys.add(dedupeKey);
    candidates.push({ priority, question });
  };

  // 1. Vogais (Early Literacy)
  const literacy = loadEarlyLiteracyProgress(safeOwner);
  const literacyDays = literacy.lastStudyDateKey
    ? daysSinceDateKey(literacy.lastStudyDateKey, nowDateKey)
    : 0;
  for (const rev of Object.values(literacy.reviewQueue || {})) {
    const unit = EARLY_LITERACY_UNITS.find((u) => u.id === rev.unitId);
    const ch = unit?.challenges.find((c) => c.id === rev.challengeId);
    if (unit && ch) {
      pushCandidate(
        100 + rev.misses * 10,
        convertStandardChallengeToQuestion(
          'infantil_letras',
          'Vogais e Primeiras Palavras',
          '🔤',
          unit.title,
          'review_queue',
          undefined,
          ch
        )
      );
    }
  }
  for (const unit of EARLY_LITERACY_UNITS) {
    const stars = literacy.unitBestStars[unit.id] ?? 0;
    if (stars > 0 && stars < 3) {
      for (const ch of unit.challenges) {
        pushCandidate(
          80 - stars * 5,
          convertStandardChallengeToQuestion(
            'infantil_letras',
            'Vogais e Primeiras Palavras',
            '🔤',
            unit.title,
            'low_stars',
            `${stars}★`,
            ch
          )
        );
      }
    } else if (literacyDays > 5 && literacy.completedUnits.includes(unit.id)) {
      const ch = unit.challenges[0];
      if (ch) {
        pushCandidate(
          65,
          convertStandardChallengeToQuestion(
            'infantil_letras',
            'Vogais e Primeiras Palavras',
            '🔤',
            unit.title,
            'stale_5d',
            `${literacyDays}d sem rever`,
            ch
          )
        );
      }
    }
  }

  // 2. Consoantes
  const consonants = loadConsonantsProgress(safeOwner);
  const consonantsDays = consonants.lastStudyDateKey
    ? daysSinceDateKey(consonants.lastStudyDateKey, nowDateKey)
    : 0;
  for (const rev of Object.values(consonants.reviewQueue || {})) {
    const unit = CONSONANT_UNITS.find((u) => u.id === rev.unitId);
    const ch = unit?.challenges.find((c) => c.id === rev.challengeId);
    if (unit && ch) {
      pushCandidate(
        100 + rev.misses * 10,
        convertStandardChallengeToQuestion(
          'infantil_consoantes',
          'As Consoantes',
          '🧩',
          unit.title,
          'review_queue',
          undefined,
          ch
        )
      );
    }
  }
  for (const unit of CONSONANT_UNITS) {
    const stars = consonants.unitBestStars[unit.id] ?? 0;
    if (stars > 0 && stars < 3) {
      for (const ch of unit.challenges) {
        pushCandidate(
          78 - stars * 5,
          convertStandardChallengeToQuestion(
            'infantil_consoantes',
            'As Consoantes',
            '🧩',
            unit.title,
            'low_stars',
            `${stars}★`,
            ch
          )
        );
      }
    } else if (consonantsDays > 5 && consonants.completedUnits.includes(unit.id)) {
      const ch = unit.challenges[0];
      if (ch) {
        pushCandidate(
          62,
          convertStandardChallengeToQuestion(
            'infantil_consoantes',
            'As Consoantes',
            '🧩',
            unit.title,
            'stale_5d',
            `${consonantsDays}d sem rever`,
            ch
          )
        );
      }
    }
  }

  // 3. Escrita (Vogais e Consoantes com < 3 estrelas -> reforça reconhecimento fônico da letra)
  const writingConfigs = [
    {
      trackId: 'infantil_escrita' as EducationTrackId,
      title: 'Vamos Escrever',
      cfg: VOWELS_WRITING_CONFIG,
      units: WRITING_UNITS,
    },
    {
      trackId: 'infantil_escrita_consoantes' as EducationTrackId,
      title: 'Escrevendo as Consoantes',
      cfg: CONSONANTS_WRITING_CONFIG,
      units: WRITING_CONSONANTS_UNITS,
    },
  ];
  for (const w of writingConfigs) {
    const prog = loadWritingProgress(safeOwner, w.cfg);
    const weakLetters = Object.entries(prog.letterBestStars || {})
      .filter(([, s]) => s > 0 && s < 3)
      .map(([letter, s]) => ({ letter: letter.toUpperCase(), stars: s }));
    for (const weak of weakLetters) {
      // Find matching challenge in phonics/consonants or build a letter recognition question
      const allSourceUnits =
        w.trackId === 'infantil_escrita' ? EARLY_LITERACY_UNITS : CONSONANT_UNITS;
      const matchingUnit = allSourceUnits.find((u) =>
        u.keywords.some((k) => k.toUpperCase().startsWith(weak.letter))
      );
      const matchingCh = matchingUnit?.challenges.find(
        (c) => c.type !== 'speak_repeat'
      );
      if (matchingUnit && matchingCh) {
        pushCandidate(
          76 - weak.stars * 4,
          convertStandardChallengeToQuestion(
            w.trackId,
            w.title,
            '✍️',
            `Letra ${weak.letter}`,
            'low_stars',
            `${weak.stars}★ em escrita`,
            matchingCh
          )
        );
      }
    }
  }

  // 4. All 11 Themed Tracks (Infantil + Fundamental I + Fundamental II)
  for (const meta of ALL_THEMED_TRACKS) {
    const prog = loadThemedProgress(meta.config, safeOwner);
    const days = prog.lastStudyDateKey
      ? daysSinceDateKey(prog.lastStudyDateKey, nowDateKey)
      : 0;

    for (const rev of Object.values(prog.reviewQueue || {})) {
      const unit = meta.config.units.find((u) => u.id === rev.unitId);
      const ch = unit?.challenges.find((c) => c.id === rev.challengeId);
      if (unit && ch) {
        pushCandidate(
          100 + rev.misses * 10,
          convertStandardChallengeToQuestion(
            meta.config.trackId,
            meta.title,
            meta.emoji,
            unit.title,
            'review_queue',
            undefined,
            ch
          )
        );
      }
    }

    for (const unit of meta.config.units) {
      const stars = prog.unitBestStars[unit.id] ?? 0;
      if (stars > 0 && stars < 3) {
        for (const ch of unit.challenges) {
          pushCandidate(
            79 - stars * 5,
            convertStandardChallengeToQuestion(
              meta.config.trackId,
              meta.title,
              meta.emoji,
              unit.title,
              'low_stars',
              `${stars}★`,
              ch
            )
          );
        }
      } else if (days > 5 && prog.completedUnits.includes(unit.id)) {
        const ch = unit.challenges[0];
        if (ch) {
          pushCandidate(
            64,
            convertStandardChallengeToQuestion(
              meta.config.trackId,
              meta.title,
              meta.emoji,
              unit.title,
              'stale_5d',
              `${days}d sem rever`,
              ch
            )
          );
        }
      }
    }
  }

  // 5. Curated starter/fallback pool aligned with schooling so user always gets 3-5 challenges
  const targetSchooling: SchoolingLevel =
    params.schooling === 'fundamental_1' ||
    params.schooling === 'fundamental_2' ||
    params.schooling === 'educacao_infantil'
      ? params.schooling
      : 'educacao_infantil';

  const preferredThemed = ALL_THEMED_TRACKS.filter(
    (m) => m.schooling === targetSchooling
  );
  const secondaryThemed = ALL_THEMED_TRACKS.filter(
    (m) => m.schooling !== targetSchooling
  );

  for (const meta of [...preferredThemed, ...secondaryThemed]) {
    const boost = meta.schooling === targetSchooling ? 30 : 10;
    for (const unit of meta.config.units) {
      for (const ch of unit.challenges) {
        if (ch.type === 'speak_repeat') continue;
        pushCandidate(
          boost,
          convertStandardChallengeToQuestion(
            meta.config.trackId,
            meta.title,
            meta.emoji,
            unit.title,
            'recommended',
            undefined,
            ch
          )
        );
      }
    }
  }

  for (const unit of EARLY_LITERACY_UNITS.slice(0, 3)) {
    for (const ch of unit.challenges) {
      if (ch.type === 'speak_repeat') continue;
      pushCandidate(
        targetSchooling === 'educacao_infantil' ? 32 : 8,
        convertStandardChallengeToQuestion(
          'infantil_letras',
          'Vogais e Primeiras Palavras',
          '🔤',
          unit.title,
          'recommended',
          undefined,
          ch
        )
      );
    }
  }

  // Sort by priority desc while promoting variety across tracks
  candidates.sort((a, b) => b.priority - a.priority);

  const selected: SmartReviewQuestion[] = [];
  const usedTrackIds = new Set<EducationTrackId>();

  // Pass 1: maximize track diversity among top candidates
  for (const c of candidates) {
    if (selected.length >= desiredCount) break;
    if (!usedTrackIds.has(c.question.trackId)) {
      selected.push(c.question);
      usedTrackIds.add(c.question.trackId);
    }
  }
  // Pass 2: fill up to desiredCount
  for (const c of candidates) {
    if (selected.length >= desiredCount) break;
    if (!selected.some((q) => q.id === c.question.id)) {
      selected.push(c.question);
    }
  }

  const hasTargeted = selected.some((q) => q.reasonTag !== 'recommended');
  const summaryReason = hasTargeted
    ? 'Selecionado com base nas unidades com menos de 3★, erros recentes ou +5 dias sem revisão.'
    : 'Sessão diária adaptada ao seu nível para aquecer a memória com o Miau!';

  return {
    dateKey: nowDateKey,
    questions: selected.slice(0, desiredCount),
    completedToday: daily.completed,
    lastScoreToday: daily.lastScore,
    lastTotalToday: daily.lastTotal,
    summaryReason,
  };
}
