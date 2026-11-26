import { getTodayDateKey } from '../../constants';
import { notifyEducationProgressSaved } from '../../services/cloudProgressHooks';
import { miauSpeechService } from '../../services/miauSpeechService';
import { synthesizeMiauVoice } from '../../services/geminiClient';
import { soundService } from '../../services/soundService';
import {
  EARLY_LITERACY_UNITS,
  TRACKED_VOWELS,
  type LiteracyChallenge,
} from './data';

const STORAGE_PREFIX = 'miau_early_literacy_v1_';
const MAX_TTS_CACHE_ITEMS = 80;

export interface SpacedReviewItem {
  challengeId: string;
  unitId: string;
  targetKey: string;
  misses: number;
  lastPracticedMs: number;
}

export interface EarlyLiteracyProgress {
  ownerId: string;
  completedUnits: string[];
  unitBestStars: Record<string, number>;
  totalStars: number;
  streakDays: number;
  lastStudyDateKey: string;
  masteredVowels: Array<'A' | 'E' | 'I' | 'O' | 'U'>;
  masteredTargets: string[];
  unlockedStickers: string[];
  reviewQueue: Record<string, SpacedReviewItem>;
  freeExploreUnlocked: boolean;
  totalLessonsCompleted: number;
}

export type ReadingVerdict = 'positive' | 'medium' | 'negative';

export interface ReadingComparisonResult {
  verdict: ReadingVerdict;
  score: number; // 0..100
  spokenDisplay: string;
  expectedDisplay: string;
  feedbackText: string;
  feedbackAudioText: string;
  targetReplayAudioText: string;
}

export interface AudioEngineState {
  speaking: boolean;
  loading: boolean;
  activeText: string;
}

export function createDefaultLiteracyProgress(
  ownerId = 'guest'
): EarlyLiteracyProgress {
  return {
    ownerId,
    completedUnits: [],
    unitBestStars: {},
    totalStars: 0,
    streakDays: 0,
    lastStudyDateKey: '',
    masteredVowels: [],
    masteredTargets: [],
    unlockedStickers: [],
    reviewQueue: {},
    freeExploreUnlocked: false,
    totalLessonsCompleted: 0,
  };
}

export function loadEarlyLiteracyProgress(
  ownerId = 'guest'
): EarlyLiteracyProgress {
  const safeId = ownerId || 'guest';
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${safeId}`);
    if (!raw) return createDefaultLiteracyProgress(safeId);
    const parsed = JSON.parse(raw) as Partial<EarlyLiteracyProgress>;
    return {
      ...createDefaultLiteracyProgress(safeId),
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
      unlockedStickers: Array.isArray(parsed.unlockedStickers)
        ? parsed.unlockedStickers
        : [],
      reviewQueue: parsed.reviewQueue ?? {},
    };
  } catch {
    return createDefaultLiteracyProgress(safeId);
  }
}

export function saveEarlyLiteracyProgress(
  progress: EarlyLiteracyProgress
): void {
  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${progress.ownerId || 'guest'}`,
      JSON.stringify(progress)
    );
  } catch {
    // Ignore storage quota errors
  }
  notifyEducationProgressSaved(
    progress.ownerId || 'guest',
    'infantil_letras',
    progress
  );
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

export function isUnitUnlocked(
  progress: EarlyLiteracyProgress,
  unitIndex: number
): boolean {
  if (unitIndex <= 0 || progress.freeExploreUnlocked) return true;
  const prevUnit = EARLY_LITERACY_UNITS[unitIndex - 1];
  if (!prevUnit) return true;
  return progress.completedUnits.includes(prevUnit.id);
}

export function recordChallengeSpacedOutcome(
  progress: EarlyLiteracyProgress,
  challenge: LiteracyChallenge,
  solvedWithoutHintOrError: boolean
): EarlyLiteracyProgress {
  const next: EarlyLiteracyProgress = {
    ...progress,
    masteredVowels: [...progress.masteredVowels],
    masteredTargets: [...progress.masteredTargets],
    reviewQueue: { ...progress.reviewQueue },
  };

  if (solvedWithoutHintOrError) {
    if (!next.masteredTargets.includes(challenge.targetKey)) {
      next.masteredTargets.push(challenge.targetKey);
    }
    if (
      challenge.vowelTag &&
      TRACKED_VOWELS.includes(challenge.vowelTag) &&
      !next.masteredVowels.includes(challenge.vowelTag)
    ) {
      next.masteredVowels.push(challenge.vowelTag);
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

  saveEarlyLiteracyProgress(next);
  return next;
}

export function completeLiteracyUnit(
  progress: EarlyLiteracyProgress,
  unitId: string,
  starsEarned: number
): { updated: EarlyLiteracyProgress; newlyUnlockedSticker: boolean } {
  const unit = EARLY_LITERACY_UNITS.find((u) => u.id === unitId);
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

  const updated: EarlyLiteracyProgress = {
    ...progress,
    completedUnits,
    unitBestStars,
    totalStars,
    streakDays: nextStreak,
    lastStudyDateKey: todayKey,
    unlockedStickers,
    totalLessonsCompleted: progress.totalLessonsCompleted + 1,
  };
  saveEarlyLiteracyProgress(updated);
  return { updated, newlyUnlockedSticker };
}

export function getPendingReviewChallenges(
  progress: EarlyLiteracyProgress,
  limit = 5
): LiteracyChallenge[] {
  const entries = Object.values(progress.reviewQueue).sort(
    (a, b) => b.misses - a.misses || a.lastPracticedMs - b.lastPracticedMs
  );
  const allChallenges = EARLY_LITERACY_UNITS.flatMap((u) => u.challenges);
  const result: LiteracyChallenge[] = [];
  for (const item of entries) {
    const found = allChallenges.find((c) => c.id === item.challengeId);
    if (found) result.push(found);
    if (result.length >= limit) break;
  }
  return result;
}

// ---------- Pronunciation Comparison (Levenshtein + PT-BR Phonetics) ----------

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

const PT_VOWEL_ALIASES: Record<string, string[]> = {
  a: ['a', 'ah', 'aa', 'ha', 'an'],
  e: ['e', 'eh', 'ee', 'he'],
  i: ['i', 'ih', 'ii', 'hi', 'y'],
  o: ['o', 'oh', 'oo', 'ho'],
  u: ['u', 'uh', 'uu', 'hu'],
};

function toPtPhoneticSkeleton(raw: string, targetRaw = ''): string {
  const norm = collapseElongatedChars(normalizePt(raw));
  const targetNorm = collapseElongatedChars(normalizePt(targetRaw));
  let s = stripSpokenWrapperPhrases(norm, targetNorm);

  // Common Brazilian Portuguese allophones and child speech variations
  s = s
    .replace(/qu([ei])/g, 'k$1')
    .replace(/qu([ao])/g, 'kw$1')
    .replace(/c([ei])/g, 's$1')
    .replace(/c/g, 'k')
    .replace(/ç/g, 's')
    .replace(/ss/g, 's')
    .replace(/ch/g, 'x')
    .replace(/rr/g, 'r')
    .replace(/lh/g, 'li')
    .replace(/nh/g, 'ni')
    .replace(/g([ei])/g, 'j$1')
    .replace(/\bh([aeiou])\b/g, '$1')
    .replace(/\b([aeiou])h+\b/g, '$1')
    .replace(/\bh/g, '')
    .replace(/y/g, 'i')
    .replace(/w/g, 'u')
    .replace(/([a-z])l\b/g, '$1u') // e.g., Sol ~ Sou
    .replace(/ou/g, 'o')
    .replace(/ei/g, 'e')
    .replace(/\bmiau+\b/g, 'miau')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
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
  const dist = levenshteinDistance(a, b);
  return Math.max(0, 1 - dist / maxLen);
}

function computeBestCandidateScore(spokenRaw: string, candidateRaw: string): number {
  const rawSpokenNorm = collapseElongatedChars(normalizePt(spokenRaw));
  const targetNorm = collapseElongatedChars(normalizePt(candidateRaw));
  const spokenNorm = stripSpokenWrapperPhrases(rawSpokenNorm, targetNorm);
  if (!spokenNorm || !targetNorm) return 0;

  if (spokenNorm === targetNorm || rawSpokenNorm === targetNorm) return 1;

  const spokenTokensRaw = spokenNorm.split(' ').filter(Boolean);
  if (targetNorm.length <= 2) {
    if (spokenTokensRaw.includes(targetNorm)) return 0.96;
  } else if (spokenNorm.includes(targetNorm)) {
    return 0.96;
  }

  const spokenPhon = toPtPhoneticSkeleton(spokenRaw, candidateRaw);
  const targetPhon = toPtPhoneticSkeleton(candidateRaw, candidateRaw);
  if (spokenPhon && targetPhon && spokenPhon === targetPhon) return 0.95;

  const directSim = stringSimilarity(spokenNorm, targetNorm);
  const phonSim = stringSimilarity(spokenPhon, targetPhon);

  // Compare token-level matches if multi-word phrase
  const spokenTokens = spokenPhon.split(' ').filter(Boolean);
  const targetTokens = targetPhon.split(' ').filter(Boolean);
  let tokenMatchSum = 0;
  for (const tTok of targetTokens) {
    let bestTok = 0;
    for (const sTok of spokenTokens) {
      bestTok = Math.max(bestTok, stringSimilarity(sTok, tTok));
    }
    tokenMatchSum += bestTok;
  }
  const tokenCoverage =
    targetTokens.length > 0 ? tokenMatchSum / targetTokens.length : 0;

  // Penalize long unrelated gibberish slightly against short targets
  const lengthRatio =
    Math.min(spokenNorm.length, targetNorm.length) /
    Math.max(spokenNorm.length, targetNorm.length);
  const adjustedCoverage = tokenCoverage * (0.65 + 0.35 * lengthRatio);

  return Math.max(directSim, phonSim, adjustedCoverage);
}

export function evaluateReadingAttempt(
  spokenTranscript: string,
  challenge: LiteracyChallenge
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
      feedbackText: `O Miau ainda não conseguiu ouvir você falando "${expectedDisplay}". Chegue pertinho do microfone, ouça o exemplo e clique para falar novamente!`,
      feedbackAudioText: `O Miau ainda não conseguiu te ouvir. Escute bem: ${expectedDisplay}. Agora clique no microfone e fale junto comigo!`,
      targetReplayAudioText: expectedDisplay,
    };
  }

  const baseNorm = normalizePt(expectedDisplay);
  const vowelAliases = PT_VOWEL_ALIASES[baseNorm] || [];
  const candidates = Array.from(
    new Set([
      expectedDisplay,
      ...(challenge.speakAcceptedVariants || []),
      ...vowelAliases,
    ])
  );

  let bestScore = 0;
  for (const cand of candidates) {
    bestScore = Math.max(bestScore, computeBestCandidateScore(spokenClean, cand));
  }
  const pct = Math.round(bestScore * 100);

  if (pct >= 68) {
    return {
      verdict: 'positive',
      score: pct,
      spokenDisplay: spokenClean,
      expectedDisplay,
      feedbackText: `Incrível! Você pronunciou "${spokenClean}" bem parecido com "${expectedDisplay}" (${pct}%)!`,
      feedbackAudioText: `Miau!! Ficou ótimo! Você falou ${expectedDisplay} certinho!`,
      targetReplayAudioText: expectedDisplay,
    };
  }

  if (pct >= 35) {
    return {
      verdict: 'medium',
      score: pct,
      spokenDisplay: spokenClean,
      expectedDisplay,
      feedbackText: `Quase igual! O Miau ouviu "${spokenClean}" (${pct}%). Ouça o Miau falando "${expectedDisplay}" e clique em "Falar Novamente" para comparar até ficar igual!`,
      feedbackAudioText: `Quase lá! Ouça como o Miau fala: ${expectedDisplay}. Agora clique em falar novamente para deixar bem parecido!`,
      targetReplayAudioText: expectedDisplay,
    };
  }

  return {
    verdict: 'negative',
    score: pct,
    spokenDisplay: spokenClean,
    expectedDisplay,
    feedbackText: `Ainda não ficou parecido com "${expectedDisplay}" (o Miau ouviu "${spokenClean}"). Ouça o som do Miau e toque no microfone para tentar ler novamente!`,
    feedbackAudioText: `Hmm, ainda não ficou parecido. Escute com carinho a palavra: ${expectedDisplay}. Clique no microfone e tente falar mais uma vez!`,
    targetReplayAudioText: expectedDisplay,
  };
}

// ---------- Miau Cute Voice + Speed Control + Cache Engine ----------

interface CachedAudioClip {
  audioBase64: string;
  mimeType: string;
}

class PhonicsAudioEngine {
  private speechSeq = 0;
  private ttsCache = new Map<string, CachedAudioClip>();
  private inFlightSyntheses = new Map<string, Promise<CachedAudioClip | null>>();
  private listeners = new Set<(state: AudioEngineState) => void>();
  private state: AudioEngineState = {
    speaking: false,
    loading: false,
    activeText: '',
  };

  public getState(): AudioEngineState {
    return { ...this.state };
  }

  public subscribeAudioState(
    listener: (state: AudioEngineState) => void
  ): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitState(partial: Partial<AudioEngineState>): void {
    this.state = { ...this.state, ...partial };
    const snap = this.getState();
    this.listeners.forEach((fn) => fn(snap));
  }

  public stop(): void {
    this.speechSeq += 1;
    miauSpeechService.cancel();
    soundService.stopAllAudio();
    this.emitState({ speaking: false, loading: false, activeText: '' });
  }

  public playSuccessFeedback(): void {
    if (!soundService.enabled) return;
    soundService.playCoin();
  }

  public playGentleHintFeedback(): void {
    if (!soundService.enabled) return;
    soundService.playBubble();
  }

  private cleanText(text: string): string {
    return text.replace(/[()]/g, '').replace(/\s+/g, ' ').trim();
  }

  private setCacheClip(key: string, clip: CachedAudioClip): void {
    if (this.ttsCache.size >= MAX_TTS_CACHE_ITEMS) {
      const oldestKey = this.ttsCache.keys().next().value;
      if (oldestKey) this.ttsCache.delete(oldestKey);
    }
    this.ttsCache.set(key, clip);
  }

  private async fetchMiauTtsClip(
    cleanText: string
  ): Promise<CachedAudioClip | null> {
    const cached = this.ttsCache.get(cleanText);
    if (cached) return cached;

    const existingPromise = this.inFlightSyntheses.get(cleanText);
    if (existingPromise) return existingPromise;

    const promise = (async (): Promise<CachedAudioClip | null> => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await synthesizeMiauVoice(cleanText);
          if (res.textOnlyFallback || !res.audioBase64) {
            return null;
          }
          const clip: CachedAudioClip = {
            audioBase64: res.audioBase64,
            mimeType: res.mimeType || 'audio/wav',
          };
          this.setCacheClip(cleanText, clip);
          return clip;
        } catch {
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 300));
          }
        }
      }
      return null;
    })().finally(() => {
      this.inFlightSyntheses.delete(cleanText);
    });

    this.inFlightSyntheses.set(cleanText, promise);
    return promise;
  }

  public prefetchChallengeAudio(challenge: LiteracyChallenge): void {
    if (!soundService.enabled) return;
    const text = this.cleanText(challenge.audioNormalText);
    if (!text || this.ttsCache.has(text)) return;
    window.setTimeout(() => {
      if (soundService.enabled) {
        void this.fetchMiauTtsClip(text);
      }
    }, 900);
  }

  private async speakWithMiauTts(
    reqId: number,
    cleanText: string,
    slow: boolean,
    notify?: (speaking: boolean) => void
  ): Promise<boolean> {
    this.emitState({ loading: true, speaking: false, activeText: cleanText });
    const clip = await this.fetchMiauTtsClip(cleanText);
    if (reqId !== this.speechSeq || !soundService.enabled) {
      if (reqId === this.speechSeq) {
        this.emitState({ loading: false, speaking: false, activeText: '' });
      }
      notify?.(false);
      return true;
    }

    if (!clip) {
      this.emitState({ loading: false, speaking: false, activeText: '' });
      notify?.(false);
      return false;
    }

    const playbackRate = slow ? 0.78 : 1.0;

    try {
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          if (reqId === this.speechSeq) {
            this.emitState({ loading: false, speaking: false, activeText: '' });
            notify?.(false);
          }
          resolve();
        };

        void soundService
          .playBase64Wav(
            clip.audioBase64,
            clip.mimeType,
            () => {
              if (reqId === this.speechSeq && soundService.enabled) {
                this.emitState({
                  loading: false,
                  speaking: true,
                  activeText: cleanText,
                });
                notify?.(true);
              }
            },
            finish,
            playbackRate
          )
          .catch((err) => {
            if (!settled) {
              settled = true;
              reject(err);
            }
          });

        window.setTimeout(finish, slow ? 14000 : 11000);
      });
      return true;
    } catch {
      if (reqId === this.speechSeq) {
        this.emitState({ loading: false, speaking: false, activeText: '' });
      }
      notify?.(false);
      return false;
    }
  }

  public async speak(
    text: string,
    options?: {
      slow?: boolean;
      withLeadingMeow?: boolean;
      onStateChange?: (speaking: boolean) => void;
    }
  ): Promise<void> {
    const reqId = ++this.speechSeq;
    const slow = Boolean(options?.slow);
    const notify = options?.onStateChange;

    miauSpeechService.cancel();
    soundService.stopAllAudio();

    if (!soundService.enabled) {
      this.emitState({ loading: false, speaking: false, activeText: '' });
      notify?.(false);
      return;
    }

    const clean = this.cleanText(text);
    if (!clean) {
      this.emitState({ loading: false, speaking: false, activeText: '' });
      notify?.(false);
      return;
    }

    if (options?.withLeadingMeow) {
      soundService.playMeow(slow ? 0.98 : 1.08);
    }

    // Usa EXCLUSIVAMENTE a voz fofinha e amigável do Miau (sem voz robotizada)
    const playedWithMiau = await this.speakWithMiauTts(
      reqId,
      clean,
      slow,
      notify
    );

    if (!playedWithMiau && reqId === this.speechSeq && soundService.enabled) {
      // Sem voz robótica: apenas um miado fofo suave se estiver totalmente offline
      soundService.playMeow(slow ? 0.96 : 1.08);
      this.emitState({ loading: false, speaking: false, activeText: '' });
      notify?.(false);
    }
  }

  public async speakTargetWord(
    word: string,
    options?: { slow?: boolean; onStateChange?: (speaking: boolean) => void }
  ): Promise<void> {
    const slow = options?.slow ?? true;
    const cleanWord = this.cleanText(word);
    if (!cleanWord) return;
    await this.speak(cleanWord, {
      slow,
      onStateChange: options?.onStateChange,
    });
  }
}

export const phonicsAudioEngine = new PhonicsAudioEngine();
