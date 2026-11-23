import { transcribeUserAudio } from '../../services/geminiClient';
import { hapticService } from '../../services/hapticService';
import { soundService } from '../../services/soundService';
import type { EquippedItems, MiauMood, UserHumanProfile } from '../../types';
import { escapeHtml } from '../../utils/html';
import { renderMiauSvg } from '../../ui/MiauIllustration';
import {
  EARLY_LITERACY_UNITS,
  TRACKED_VOWELS,
  type LiteracyChallenge,
  type LiteracyUnitDef,
} from './data';
import {
  completeLiteracyUnit,
  evaluateReadingAttempt,
  getPendingReviewChallenges,
  isUnitUnlocked,
  loadEarlyLiteracyProgress,
  phonicsAudioEngine,
  recordChallengeSpacedOutcome,
  saveEarlyLiteracyProgress,
  type EarlyLiteracyProgress,
  type ReadingComparisonResult,
} from './phonicsEngine';

export interface LearningModuleDeps {
  getOwnerId: () => string;
  getHumanProfile: () => UserHumanProfile;
  getEquipped: () => EquippedItems;
  isSoundEnabled: () => boolean;
  onToggleSoundMute: () => boolean;
  onGrantRewards: (coinsDelta: number, xpDelta: number) => void;
  onExitToLearnHub: () => void;
  onExitToMainMenu?: () => void;
  onRequestRerender: () => void;
  onToast: (msg: string) => void;
}

type ViewStage = 'trail' | 'lesson' | 'celebration';

interface LessonRuntimeState {
  unit: LiteracyUnitDef | null; // null = spaced review session
  queue: LiteracyChallenge[];
  cursor: number;
  isRetryItemFlags: boolean[];
  firstTryCleanFlags: Record<string, boolean>;
  inLessonRetriesQueued: Set<string>;
  currentAttemptHasError: boolean;
  stepSolved: boolean;
  filledWordLetter: string | null;
  lastFeedback: {
    kind: 'praise' | 'medium' | 'negative' | 'hint';
    text: string;
  } | null;
  readingComparison: ReadingComparisonResult | null;
  miauMood: MiauMood;
  isRecordingVoice: boolean;
  isComparingVoice: boolean;
  voiceStatusText: string;
  isSpeakingPrompt: boolean;
  isLoadingAudio: boolean;
  isTransitioningStep: boolean;
}

interface CelebrationRuntimeState {
  title: string;
  subtitle: string;
  stars: number;
  coinsEarned: number;
  xpEarned: number;
  stickerEmoji: string;
  stickerTitle: string;
  stickerVisualUrl?: string;
  newlyUnlockedSticker: boolean;
  nextUnitId: string | null;
}

export class LearningModuleController {
  private stage: ViewStage = 'trail';
  private lesson: LessonRuntimeState | null = null;
  private celebration: CelebrationRuntimeState | null = null;
  private isNavigatingLoading = false;
  private transitionTimer: number | null = null;
  private unsubscribeAudio: (() => void) | null = null;

  constructor(private deps: LearningModuleDeps) {
    this.unsubscribeAudio = phonicsAudioEngine.subscribeAudioState((state) => {
      if (!this.lesson) return;
      this.lesson.isSpeakingPrompt = state.speaking;
      this.lesson.isLoadingAudio = state.loading;
      const badgeEl = document.getElementById('el-miau-audio-badge');
      if (badgeEl) {
        if (state.loading) {
          badgeEl.textContent = '🐾 Preparando voz...';
          badgeEl.className =
            'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-[#5a3696] animate-pulse';
        } else if (state.speaking) {
          badgeEl.textContent = '🔊 Miau falando...';
          badgeEl.className =
            'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 animate-pulse';
        } else {
          badgeEl.textContent = '💬 Voz do Miau';
          badgeEl.className =
            'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/85 text-[#6b4d9e] border border-purple-100';
        }
      }
    });
  }

  public dispose(): void {
    this.clearTimers();
    this.cleanupAudioAndMic();
    this.unsubscribeAudio?.();
    this.unsubscribeAudio = null;
  }

  private clearTimers(): void {
    if (this.transitionTimer !== null) {
      window.clearTimeout(this.transitionTimer);
      this.transitionTimer = null;
    }
  }

  public resetToTrail(): void {
    this.clearTimers();
    this.cleanupAudioAndMic();
    this.isNavigatingLoading = false;
    this.stage = 'trail';
    this.lesson = null;
    this.celebration = null;
  }

  public cleanupAudioAndMic(): void {
    phonicsAudioEngine.stop();
    if (this.lesson?.isRecordingVoice) {
      this.lesson.isRecordingVoice = false;
      void soundService.stopRecording().catch(() => {});
    }
  }

  private getProgress(): EarlyLiteracyProgress {
    return loadEarlyLiteracyProgress(this.deps.getOwnerId());
  }

  private getCurrentActiveUnit(progress: EarlyLiteracyProgress): LiteracyUnitDef {
    const nextIncomplete = EARLY_LITERACY_UNITS.find(
      (unit, idx) =>
        isUnitUnlocked(progress, idx) &&
        !progress.completedUnits.includes(unit.id)
    );
    return (
      nextIncomplete ||
      EARLY_LITERACY_UNITS[EARLY_LITERACY_UNITS.length - 1]
    );
  }

  public render(): string {
    const progress = this.getProgress();
    if (this.isNavigatingLoading) {
      return this.renderLoadingCardHtml();
    }
    if (this.stage === 'lesson' && this.lesson) {
      return this.renderLessonHtml(this.lesson);
    }
    if (this.stage === 'celebration' && this.celebration) {
      return this.renderCelebrationHtml(this.celebration, progress);
    }
    return this.renderTrailHtml(progress);
  }

  private renderLoadingCardHtml(): string {
    return `
      <div class="flex-1 min-h-0 flex flex-col items-center justify-center p-3 text-center">
        <div class="rounded-2xl p-5 bg-white/95 border border-purple-200 shadow-md max-w-xs w-full flex flex-col items-center gap-3 animate-pulse">
          <div class="w-16 h-16">
            ${renderMiauSvg('playful', this.deps.getEquipped(), false)}
          </div>
          <div class="space-y-1">
            <h3 class="font-display text-base font-bold text-[#3b1f6e]">Preparando a lição...</h3>
            <p class="text-[11px] font-semibold text-[#6b4d9e] leading-snug">O Miau está organizando as letrinhas e sua voz fofinha!</p>
          </div>
          <div class="w-full h-2 rounded-full bg-purple-100 overflow-hidden">
            <div class="h-full w-2/3 rounded-full bg-gradient-to-r from-[#7b52b8] via-[#a855f7] to-[#ec4899]"></div>
          </div>
        </div>
      </div>
    `;
  }

  private renderSoundToggleButton(id: string): string {
    const enabled = this.deps.isSoundEnabled();
    return `
      <button
        id="${id}"
        type="button"
        aria-pressed="${String(!enabled)}"
        class="px-2.5 py-1 rounded-full text-[11px] font-extrabold border shadow-sm transition active:scale-95 shrink-0 ${
          enabled
            ? 'bg-white/95 border-purple-200 text-[#4c2a85] hover:bg-purple-50'
            : 'bg-rose-100 border-rose-300 text-rose-800 hover:bg-rose-200'
        }"
      >
        ${enabled ? '🔊 Som' : '🔇 Mudo'}
      </button>
    `;
  }

  private renderTrailHtml(progress: EarlyLiteracyProgress): string {
    const firstName =
      this.deps.getHumanProfile().fullName.trim().split(/\s+/)[0] ||
      'Pequeno(a)';
    const pendingReviews = getPendingReviewChallenges(progress, 5);
    const completedCount = progress.completedUnits.length;
    const totalUnits = EARLY_LITERACY_UNITS.length;
    const trailPercent = Math.round((completedCount / totalUnits) * 100);
    const currentUnit = this.getCurrentActiveUnit(progress);

    return `
      <!-- Barra superior compacta em tela cheia -->
      <div class="flex items-center justify-between gap-1.5 mb-2 text-left shrink-0">
        <div class="flex items-center gap-1.5 min-w-0">
          <button
            id="btn-el-main-menu"
            type="button"
            class="px-2.5 py-1 rounded-full bg-white/95 border border-purple-200 text-[#4c2a85] font-extrabold text-[11px] shadow-sm hover:bg-purple-50 active:scale-95 transition shrink-0"
          >
            🏠 Menu
          </button>
          <button
            id="btn-el-back"
            type="button"
            class="px-2.5 py-1 rounded-full bg-purple-100/90 border border-purple-200 text-[#5a3696] font-extrabold text-[11px] hover:bg-purple-200/80 active:scale-95 transition shrink-0"
          >
            ← Trilhas
          </button>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          ${this.renderSoundToggleButton('btn-el-sound')}
          <button id="modal-close" type="button" class="w-7 h-7 rounded-full bg-white/95 border border-purple-200 text-purple-800 text-xs font-bold active:scale-95 transition shrink-0">✕</button>
        </div>
      </div>

      <!-- Cabeçalho & Progresso Geral -->
      <div class="rounded-2xl px-3 py-2.5 mb-2 bg-white/90 border border-purple-200/80 shadow-sm text-left shrink-0">
        <div class="flex items-center justify-between gap-2 mb-1.5">
          <div class="min-w-0">
            <h2 class="font-display text-sm sm:text-base font-bold text-[#3b1f6e] leading-tight">
              Vogais & Primeiras Palavras 🔤
            </h2>
            <p class="text-[10px] font-semibold text-[#6b4d9e] leading-tight">
              Educação Infantil • Voz do Miau & Leitura
            </p>
          </div>
          <span class="px-2 py-0.5 rounded-full bg-purple-100 text-[#5a3696] text-[10px] font-extrabold shrink-0">
            ${trailPercent}% da trilha
          </span>
        </div>
        <div class="w-full h-2 rounded-full bg-purple-100 border border-purple-200/70 overflow-hidden">
          <div
            class="h-full rounded-full bg-gradient-to-r from-[#7b52b8] via-[#a855f7] to-[#ec4899] transition-all duration-500"
            style="width: ${Math.max(6, trailPercent)}%"
          ></div>
        </div>
      </div>

      <div class="flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto miau-scroll pr-0.5 text-left">
        <!-- Unidade Atual em Destaque Compacto -->
        <div class="rounded-2xl p-2.5 sm:p-3 bg-gradient-to-br from-white via-[#f8f3ff] to-[#efe5ff] border border-[#9b72cf] shadow-sm flex items-center justify-between gap-2.5 flex-wrap">
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            <img
              src="${currentUnit.visualAssetUrl}"
              alt="${escapeHtml(currentUnit.title)}"
              class="w-11 h-11 sm:w-12 sm:h-12 rounded-xl shadow-sm shrink-0 bg-white object-cover"
            />
            <div class="min-w-0">
              <div class="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-purple-100 text-[#5a3696] mb-0.5">
                ✨ ${completedCount === totalUnits ? 'Trilha Completa!' : `Atual • Nível ${currentUnit.challengeLevel}`}
              </div>
              <h3 class="font-display text-xs sm:text-sm font-bold text-[#3b1f6e] leading-snug truncate">
                ${currentUnit.number}. ${escapeHtml(currentUnit.title)}
              </h3>
              <p class="text-[10px] font-semibold text-[#5e4294] leading-tight truncate">
                ${escapeHtml(currentUnit.keywords.slice(0, 4).join(' • '))}
              </p>
            </div>
          </div>
          <button
            id="btn-el-continue-current"
            type="button"
            data-el-start-unit="${currentUnit.id}"
            class="px-3.5 py-2 rounded-xl bg-[#6e45a5] hover:bg-[#5c3691] active:scale-95 text-white font-extrabold text-[11px] sm:text-xs shadow-sm transition shrink-0"
          >
            ${progress.completedUnits.includes(currentUnit.id) ? '🔁 Praticar' : '▶ Continuar'}
          </button>
        </div>

        <!-- Resumo de Progresso em Grade Compacta -->
        <div class="rounded-2xl p-2.5 sm:p-3 bg-white/90 border border-purple-100 shadow-sm flex flex-col gap-2">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <div class="w-10 h-10 shrink-0">
                ${renderMiauSvg('happy', this.deps.getEquipped(), false)}
              </div>
              <div class="min-w-0">
                <div class="text-[9px] font-extrabold uppercase tracking-wide text-[#6b4d9e]">Jornada de ${escapeHtml(firstName)}</div>
                <div class="font-display text-xs sm:text-sm font-bold text-[#3b1f6e] leading-tight truncate">
                  ${
                    completedCount === totalUnits
                      ? 'Parabéns! Pequeno Leitor! 🏅'
                      : 'Vamos descobrir sons com o Miau!'
                  }
                </div>
              </div>
            </div>
            <button
              id="btn-el-free-mode"
              type="button"
              class="px-2.5 py-1 rounded-full text-[10px] font-extrabold border active:scale-95 transition shrink-0 ${
                progress.freeExploreUnlocked
                  ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                  : 'bg-purple-50 border-purple-200 text-[#5a3696] hover:bg-purple-100'
              }"
            >
              ${progress.freeExploreUnlocked ? '🔓 Livre' : '🔓 Liberar'}
            </button>
          </div>

          <div class="grid grid-cols-4 gap-1.5">
            <div class="rounded-xl py-1.5 px-1 bg-purple-50 border border-purple-100 text-center">
              <div class="text-sm font-display font-bold text-[#4c2a85] leading-tight">${completedCount}/${totalUnits}</div>
              <div class="text-[9px] font-extrabold text-[#6b4d9e] uppercase">Unid.</div>
            </div>
            <div class="rounded-xl py-1.5 px-1 bg-amber-50 border border-amber-200 text-center">
              <div class="text-sm font-display font-bold text-amber-700 leading-tight">★ ${progress.totalStars}</div>
              <div class="text-[9px] font-extrabold text-amber-800 uppercase">Estrelas</div>
            </div>
            <div class="rounded-xl py-1.5 px-1 bg-pink-50 border border-pink-200 text-center">
              <div class="text-sm font-display font-bold text-pink-700 leading-tight">${progress.masteredVowels.length}/5</div>
              <div class="text-[9px] font-extrabold text-pink-800 uppercase">Vogais</div>
            </div>
            <div class="rounded-xl py-1.5 px-1 bg-sky-50 border border-sky-200 text-center">
              <div class="text-sm font-display font-bold text-sky-700 leading-tight">🔥 ${progress.streakDays}</div>
              <div class="text-[9px] font-extrabold text-sky-800 uppercase">Dias</div>
            </div>
          </div>

          <div class="flex items-center justify-between gap-2 pt-0.5">
            <span class="text-[10px] font-extrabold text-[#5a3696]">Vogais:</span>
            <div class="flex items-center gap-1">
              ${TRACKED_VOWELS.map((v) => {
                const mastered = progress.masteredVowels.includes(v);
                return `
                  <span class="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center font-display text-xs font-bold border transition ${
                    mastered
                      ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white border-emerald-500 shadow-sm'
                      : 'bg-purple-50 text-purple-300 border-purple-200'
                  }">
                    ${v}
                  </span>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- Revisão Espaçada Compacta -->
        ${
          pendingReviews.length > 0
            ? `
              <div class="rounded-2xl p-2.5 bg-gradient-to-r from-amber-50 via-orange-50 to-pink-50 border border-amber-200 shadow-sm flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0">
                  <div class="w-8 h-8 rounded-xl bg-white border border-amber-200 flex items-center justify-center text-base shrink-0">🔄</div>
                  <div class="min-w-0">
                    <div class="text-[11px] font-extrabold text-amber-900 leading-tight">Revisão com o Miau</div>
                    <div class="text-[10px] font-semibold text-amber-800 leading-tight truncate">
                      ${pendingReviews.length} ${pendingReviews.length === 1 ? 'som especial' : 'sons especiais'} para praticar!
                    </div>
                  </div>
                </div>
                <button
                  id="btn-el-start-review"
                  type="button"
                  class="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-extrabold text-[11px] shadow-sm transition shrink-0"
                >
                  ✨ Revisar
                </button>
              </div>
            `
            : ''
        }

        <!-- Trilha Progressiva das 6 Unidades -->
        <div class="flex flex-col gap-1.5">
          <div class="text-[10px] font-extrabold uppercase tracking-wide text-[#5a3696] px-1">
            Caminho das Descobertas (6 Unidades)
          </div>
          ${EARLY_LITERACY_UNITS.map((unit, idx) => {
            const unlocked = isUnitUnlocked(progress, idx);
            const completed = progress.completedUnits.includes(unit.id);
            const stars = progress.unitBestStars[unit.id] ?? 0;
            const isNext = unit.id === currentUnit.id && !completed;

            return `
              <div class="rounded-2xl p-2.5 border transition-all duration-200 ${
                isNext
                  ? 'bg-white border-[#7b52b8] shadow-sm ring-1 ring-[#9b72cf]/40'
                  : unlocked
                    ? 'bg-white/95 border-purple-100 shadow-sm hover:border-purple-300'
                    : 'bg-white/60 border-purple-100/80 opacity-80'
              }">
                <div class="flex items-center gap-2.5">
                  <div class="w-11 h-11 rounded-xl bg-gradient-to-br ${unit.accentGradient} border border-white shadow-inner flex flex-col items-center justify-center shrink-0 overflow-hidden">
                    ${
                      unlocked
                        ? `<img src="${unit.visualAssetUrl}" alt="${escapeHtml(unit.title)}" class="w-11 h-11 object-cover" />`
                        : `<span class="text-lg leading-none">🔒</span><span class="text-[8px] font-extrabold text-[#4c2a85]">Un.${unit.number}</span>`
                    }
                  </div>

                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1 flex-wrap">
                      <span class="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-purple-100 text-[#5a3696]">
                        Un. ${unit.number} • ${escapeHtml(unit.themeLabel)}
                      </span>
                      ${
                        completed
                          ? `<span class="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`
                          : isNext
                            ? `<span class="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Próxima</span>`
                            : ''
                      }
                    </div>
                    <h3 class="font-display text-xs sm:text-sm font-bold text-[#3b1f6e] leading-tight mt-0.5 truncate">${escapeHtml(unit.title)}</h3>
                    <p class="text-[10px] font-semibold text-[#5e4294] leading-tight truncate">${escapeHtml(unit.subtitle)}</p>
                    <div class="mt-1 flex items-center flex-wrap gap-1.5 text-[9px] font-bold text-[#6b4d9e]">
                      <span>🧩 ${unit.challenges.length}</span>
                      <span>•</span>
                      <span>🪙 +${unit.coinReward}</span>
                      <span>•</span>
                      <span class="truncate">${unit.sticker.emoji} ${escapeHtml(unit.sticker.title)}</span>
                    </div>
                  </div>

                  <div class="shrink-0">
                    ${
                      unlocked
                        ? `
                          <button
                            type="button"
                            data-el-start-unit="${unit.id}"
                            class="px-3 py-1.5 rounded-xl font-extrabold text-[11px] shadow-sm active:scale-95 transition ${
                              completed
                                ? 'bg-purple-100 hover:bg-purple-200 text-[#4c2a85]'
                                : 'bg-[#6e45a5] hover:bg-[#5c3691] text-white'
                            }"
                          >
                            ${completed ? '🔁 Refazer' : '▶ Abrir'}
                          </button>
                        `
                        : `<span class="inline-block px-2.5 py-1 rounded-xl bg-purple-50 text-purple-400 text-[10px] font-extrabold border border-purple-100">Bloq.</span>`
                    }
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Estante Compacta de Adesivos -->
        <div class="rounded-2xl p-2.5 bg-white/90 border border-purple-100 shadow-sm mb-1">
          <div class="flex items-center justify-between gap-2 mb-1.5">
            <div class="text-[11px] font-extrabold text-[#3b1f6e]">🏅 Estante de Adesivos</div>
            <span class="text-[10px] font-extrabold text-[#6b4d9e]">${progress.unlockedStickers.length}/${EARLY_LITERACY_UNITS.length}</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            ${EARLY_LITERACY_UNITS.map((u) => {
              const hasSticker = progress.unlockedStickers.includes(u.sticker.id);
              return `
                <div class="rounded-xl p-2 border flex items-center gap-2 transition ${
                  hasSticker
                    ? u.sticker.colorClass
                    : 'bg-slate-50 border-slate-200 text-slate-400 opacity-75'
                }">
                  <img
                    src="${u.sticker.visualAssetUrl}"
                    alt="${escapeHtml(u.sticker.title)}"
                    class="w-8 h-8 rounded-lg shrink-0 ${hasSticker ? '' : 'grayscale opacity-50'}"
                  />
                  <div class="min-w-0">
                    <div class="text-[10px] font-extrabold leading-tight truncate">${escapeHtml(u.sticker.title)}</div>
                    <div class="text-[8px] font-semibold leading-tight truncate">${hasSticker ? 'Desbloqueado' : `Un. ${u.number}`}</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  private renderLessonHtml(lesson: LessonRuntimeState): string {
    const ch = lesson.queue[lesson.cursor];
    const isRetry = lesson.isRetryItemFlags[lesson.cursor] ?? false;
    const total = lesson.queue.length;
    const pct = Math.round(
      ((lesson.cursor + (lesson.stepSolved ? 1 : 0)) / total) * 100
    );
    const titleLabel = lesson.unit
      ? `Un. ${lesson.unit.number}: ${lesson.unit.title}`
      : 'Revisão com o Miau';

    return `
      <div class="flex items-center justify-between gap-1.5 mb-2 text-left shrink-0">
        <div class="flex items-center gap-1 shrink-0">
          <button id="btn-el-exit-lesson" type="button" class="px-2.5 py-1 rounded-full bg-white/95 border border-purple-200 text-purple-800 font-extrabold text-[11px] shadow-sm hover:bg-purple-50 active:scale-95 transition shrink-0">← Trilha</button>
          <button id="btn-el-lesson-menu" type="button" class="px-2 py-1 rounded-full bg-purple-100/90 border border-purple-200 text-[#5a3696] font-extrabold text-[11px] hover:bg-purple-200/80 active:scale-95 transition shrink-0">🏠</button>
        </div>
        <div class="flex-1 min-w-0 px-1">
          <div class="flex items-center justify-between text-[10px] font-extrabold text-[#4c2a85] mb-0.5 gap-1.5">
            <span class="truncate">${escapeHtml(titleLabel)}</span>
            <span class="shrink-0">${lesson.cursor + 1}/${total}</span>
          </div>
          <div class="w-full h-2 rounded-full bg-white/85 border border-purple-200 overflow-hidden">
            <div class="h-full rounded-full bg-gradient-to-r from-[#7b52b8] via-[#a855f7] to-[#ec4899] transition-all duration-300" style="width:${Math.max(8, pct)}%"></div>
          </div>
        </div>
        ${this.renderSoundToggleButton('btn-el-lesson-sound')}
      </div>

      <div class="flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto miau-scroll pr-0.5 text-left">
        <!-- Companheiro Miau + Voz Fofinha -->
        <div class="rounded-2xl p-2.5 sm:p-3 bg-white/95 border border-purple-100 shadow-sm flex flex-col gap-2 shrink-0">
          <div class="flex items-center justify-between gap-1.5 flex-wrap">
            <div class="flex items-center gap-1 flex-wrap">
              <span class="text-[9px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full bg-purple-100 text-[#5a3696]">
                ${escapeHtml(ch.badgeLabel)}
              </span>
              ${
                ch.storyContext
                  ? `<span class="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">${escapeHtml(ch.storyContext)}</span>`
                  : ''
              }
              ${
                isRetry
                  ? `<span class="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">🔄 Relembrar</span>`
                  : ''
              }
              <span id="el-miau-audio-badge" class="${
                lesson.isLoadingAudio
                  ? 'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-[#5a3696] animate-pulse'
                  : lesson.isSpeakingPrompt
                    ? 'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 animate-pulse'
                    : 'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/85 text-[#6b4d9e] border border-purple-100'
              }">
                ${
                  lesson.isLoadingAudio
                    ? '🐾 Preparando voz...'
                    : lesson.isSpeakingPrompt
                      ? '🔊 Miau falando...'
                      : '💬 Voz do Miau'
                }
              </span>
            </div>
            <div class="flex items-center gap-1">
              <button
                id="btn-el-listen-normal"
                type="button"
                class="px-2.5 py-1 rounded-full bg-[#6e45a5] hover:bg-[#5c3691] active:scale-95 text-white font-extrabold text-[11px] shadow-sm transition flex items-center gap-1 ${lesson.isSpeakingPrompt ? 'ring-2 ring-purple-300' : ''}"
              >
                🔊 Ouvir
              </button>
              <button
                id="btn-el-listen-slow"
                type="button"
                class="px-2.5 py-1 rounded-full bg-sky-100 hover:bg-sky-200 active:scale-95 text-sky-900 border border-sky-200 font-extrabold text-[11px] shadow-sm transition flex items-center gap-1"
              >
                🐢 Devagar
              </button>
            </div>
          </div>

          <div class="flex items-center gap-2.5">
            <div class="w-12 h-12 sm:w-14 sm:h-14 shrink-0 transition-transform duration-300 ${lesson.isSpeakingPrompt ? 'scale-105' : ''}">
              ${renderMiauSvg(lesson.miauMood, this.deps.getEquipped(), false)}
            </div>
            <div class="flex-1 min-w-0 rounded-xl px-3 py-2 bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100">
              <p class="font-display text-xs sm:text-sm font-bold text-[#3b1f6e] leading-snug">
                ${escapeHtml(ch.instruction)}
              </p>
            </div>
          </div>
        </div>

        <!-- Área Interativa do Desafio -->
        <div class="rounded-2xl p-3 bg-white/95 border border-purple-100 shadow-sm flex-1 flex flex-col justify-center gap-2.5 transition-all duration-200">
          ${this.renderExerciseBodyHtml(ch, lesson)}
        </div>

        <!-- Feedback Imediato -->
        ${this.renderFeedbackBannerHtml(ch, lesson)}
      </div>
    `;
  }

  private renderFeedbackBannerHtml(
    _ch: LiteracyChallenge,
    lesson: LessonRuntimeState
  ): string {
    if (!lesson.lastFeedback) return '';

    const kind = lesson.lastFeedback.kind;
    let wrapperStyle = 'bg-amber-50 border-amber-300 text-amber-950';
    let icon = '💡';
    if (kind === 'praise') {
      wrapperStyle = 'bg-emerald-50 border-emerald-300 text-emerald-950';
      icon = '🌟';
    } else if (kind === 'medium') {
      wrapperStyle = 'bg-amber-50 border-amber-400 text-amber-950';
      icon = '🔁';
    } else if (kind === 'negative') {
      wrapperStyle = 'bg-rose-50 border-rose-300 text-rose-950';
      icon = '🎙️';
    }

    return `
      <div class="rounded-2xl p-2.5 border shadow-sm flex items-center justify-between gap-2 flex-wrap shrink-0 ${wrapperStyle}">
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <span class="text-lg shrink-0">${icon}</span>
          <p class="text-xs font-bold leading-snug">${escapeHtml(lesson.lastFeedback.text)}</p>
        </div>
        ${
          lesson.stepSolved
            ? `
              <button
                id="btn-el-continue"
                type="button"
                class="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs shadow-sm transition shrink-0"
              >
                ${lesson.cursor + 1 >= lesson.queue.length ? 'Recompensa 🏆' : 'Continuar →'}
              </button>
            `
            : kind === 'medium' || kind === 'negative'
              ? `
                <button
                  id="btn-el-replay-word"
                  type="button"
                  class="px-3 py-1.5 rounded-xl bg-white border border-purple-300 text-[#4c2a85] font-extrabold text-[11px] shadow-sm hover:bg-purple-50 active:scale-95 transition shrink-0"
                >
                  🔊 Ouvir Palavra
                </button>
              `
              : `
                <button
                  id="btn-el-hint-audio"
                  type="button"
                  class="px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 font-extrabold text-[11px] shadow-sm hover:bg-amber-100 active:scale-95 transition shrink-0"
                >
                  🐢 Dica
                </button>
              `
        }
      </div>
    `;
  }

  private renderExerciseBodyHtml(
    ch: LiteracyChallenge,
    lesson: LessonRuntimeState
  ): string {
    if (ch.type === 'listen_pick' || ch.type === 'rhyme_fun') {
      const verseBlock = ch.anchorCard?.verseHtml
        ? `
          <div class="rounded-xl p-2.5 bg-gradient-to-br from-amber-50 to-pink-50 border border-amber-200 flex items-center gap-2.5">
            <span class="text-2xl shrink-0">${ch.anchorCard.emoji}</span>
            <div class="text-xs sm:text-sm font-bold text-[#3b1f6e] leading-snug">
              ${ch.anchorCard.verseHtml}
            </div>
          </div>
        `
        : '';

      const options = ch.options || [];
      return `
        ${verseBlock}
        <div class="grid ${options.length === 4 ? 'grid-cols-2' : 'grid-cols-3'} gap-2">
          ${options
            .map((opt) => {
              const isCorrect =
                lesson.stepSolved && opt.id === ch.correctOptionId;
              const prefix = opt.highlightPrefix || '';
              const restLabel = prefix
                ? opt.label.slice(prefix.length)
                : opt.label;
              return `
                <button
                  type="button"
                  data-el-option="${opt.id}"
                  ${lesson.stepSolved ? 'disabled' : ''}
                  class="rounded-2xl p-2.5 sm:p-3 border-2 flex flex-col items-center justify-center gap-1 transition-all duration-200 active:scale-95 ${
                    isCorrect
                      ? 'bg-emerald-100 border-emerald-500 ring-2 ring-emerald-200 shadow-sm'
                      : `${opt.accentClass || 'bg-purple-50 border-purple-200'} hover:border-[#6e45a5] hover:-translate-y-0.5 hover:shadow-sm`
                  }"
                >
                  <span class="text-3xl sm:text-4xl leading-none">${opt.emoji}</span>
                  <span class="font-display text-xs sm:text-sm font-bold text-[#3b1f6e] leading-tight">
                    ${
                      prefix
                        ? `<span class="text-[#d946ef] underline decoration-2">${escapeHtml(prefix)}</span>${escapeHtml(restLabel)}`
                        : escapeHtml(opt.label)
                    }
                  </span>
                </button>
              `;
            })
            .join('')}
        </div>
      `;
    }

    if (ch.type === 'sound_to_letter') {
      const choices = ch.letterChoices || [];
      return `
        <div class="flex flex-col items-center gap-3">
          ${
            ch.anchorCard
              ? `
                <div class="rounded-2xl px-3.5 py-2.5 bg-gradient-to-br from-sky-50 to-purple-50 border border-purple-200 flex items-center gap-3">
                  <img src="${ch.visualAssetUrl}" alt="${escapeHtml(ch.anchorCard.word)}" class="w-12 h-12 rounded-xl shadow-sm bg-white shrink-0" />
                  <div class="text-left">
                    <div class="text-[10px] font-extrabold uppercase tracking-wide text-[#6b4d9e]">Palavra</div>
                    <div class="font-display text-lg sm:text-xl font-bold text-[#3b1f6e] leading-tight">
                      ${escapeHtml(ch.anchorCard.word)}
                    </div>
                  </div>
                </div>
              `
              : ''
          }
          <div class="flex flex-wrap items-center justify-center gap-2 w-full">
            ${choices
              .map((letter) => {
                const isRight = lesson.stepSolved && letter === ch.correctLetter;
                return `
                  <button
                    type="button"
                    data-el-letter="${escapeHtml(letter)}"
                    ${lesson.stepSolved ? 'disabled' : ''}
                    class="min-w-[60px] sm:min-w-[70px] h-14 sm:h-16 px-4 rounded-2xl border-2 font-display text-xl sm:text-2xl font-bold transition-all duration-200 active:scale-95 hover:-translate-y-0.5 shadow-sm ${
                      isRight
                        ? 'bg-emerald-500 text-white border-emerald-600 ring-2 ring-emerald-200'
                        : 'bg-gradient-to-b from-white to-purple-50 text-[#3b1f6e] border-purple-300 hover:border-[#6e45a5] hover:bg-purple-100'
                    }"
                  >
                    ${escapeHtml(letter)}
                  </button>
                `;
              })
              .join('')}
          </div>
        </div>
      `;
    }

    if (ch.type === 'complete_word') {
      const segments = ch.wordSegments || [];
      const bank = ch.letterBank || [];
      const filled = lesson.filledWordLetter;

      return `
        <div class="flex flex-col items-center gap-3">
          ${
            ch.anchorCard
              ? `
                <div class="rounded-2xl px-3.5 py-2 bg-gradient-to-br from-amber-50 to-purple-50 border border-purple-200 flex items-center gap-2.5">
                  <img src="${ch.visualAssetUrl}" alt="${escapeHtml(ch.anchorCard.word)}" class="w-10 h-10 rounded-xl shadow-sm bg-white shrink-0" />
                  <span class="font-display text-base font-bold text-[#4c2a85]">${escapeHtml(ch.anchorCard.word)}</span>
                </div>
              `
              : ''
          }

          <div class="flex flex-wrap items-center justify-center gap-1.5">
            ${segments
              .map((seg, idx) => {
                const isMissing = seg === null && idx === ch.missingSlotIndex;
                if (!isMissing) {
                  return `
                    <div class="w-11 h-12 sm:w-12 sm:h-14 rounded-xl bg-purple-100 border border-purple-300 flex items-center justify-center font-display text-xl sm:text-2xl font-bold text-[#3b1f6e]">
                      ${escapeHtml(seg || '')}
                    </div>
                  `;
                }
                const displayChar = filled || '?';
                return `
                  <div
                    id="el-word-dropzone"
                    class="w-12 h-12 sm:w-14 sm:h-14 rounded-xl border-2 flex items-center justify-center font-display text-xl sm:text-2xl font-bold transition ${
                      lesson.stepSolved
                        ? 'bg-emerald-500 border-emerald-600 text-white ring-2 ring-emerald-200'
                        : 'bg-amber-50 border-dashed border-[#6e45a5] text-[#6e45a5] animate-pulse'
                    }"
                  >
                    ${escapeHtml(displayChar)}
                  </div>
                `;
              })
              .join('')}
          </div>

          <div class="text-[11px] font-bold text-[#6b4d9e]">
            Toque ou arraste a letra certa para o espaço!
          </div>

          <div class="flex flex-wrap items-center justify-center gap-2">
            ${bank
              .map((letter) => {
                const isRight = lesson.stepSolved && letter === ch.missingAnswer;
                return `
                  <button
                    type="button"
                    draggable="${!lesson.stepSolved}"
                    data-el-bank-letter="${escapeHtml(letter)}"
                    ${lesson.stepSolved ? 'disabled' : ''}
                    class="w-12 h-12 sm:w-14 sm:h-14 rounded-xl border-2 font-display text-xl sm:text-2xl font-bold shadow-sm transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-grab ${
                      isRight
                        ? 'bg-emerald-100 border-emerald-500 text-emerald-800'
                        : 'bg-white border-purple-300 text-[#3b1f6e] hover:bg-purple-50 hover:border-[#6e45a5]'
                    }"
                  >
                    ${escapeHtml(letter)}
                  </button>
                `;
              })
              .join('')}
          </div>
        </div>
      `;
    }

    // speak_repeat: Escuta + Comparação de Leitura com 3 níveis (Negativo / Mediano / Positivo)
    const cmp = lesson.readingComparison;
    const shouldRetryVoice =
      cmp && (cmp.verdict === 'negative' || cmp.verdict === 'medium');

    let comparisonHtml = '';
    if (cmp) {
      const verdictMeta =
        cmp.verdict === 'positive'
          ? {
              box: 'bg-emerald-50 border-emerald-300 text-emerald-950',
              bar: 'bg-emerald-500',
              badge: 'bg-emerald-200 text-emerald-900',
              label: `🌟 Parecida! (${cmp.score}%)`,
            }
          : cmp.verdict === 'medium'
            ? {
                box: 'bg-amber-50 border-amber-300 text-amber-950',
                bar: 'bg-amber-500',
                badge: 'bg-amber-200 text-amber-900',
                label: `🔁 Quase igual! (${cmp.score}%)`,
              }
            : {
                box: 'bg-rose-50 border-rose-300 text-rose-950',
                bar: 'bg-rose-500',
                badge: 'bg-rose-200 text-rose-900',
                label: `🎙️ Vamos tentar de novo (${cmp.score}%)`,
              };

      comparisonHtml = `
        <div class="w-full max-w-sm rounded-xl p-2.5 border ${verdictMeta.box} text-left flex flex-col gap-1.5">
          <div class="flex items-center justify-between gap-2">
            <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full ${verdictMeta.badge}">
              ${verdictMeta.label}
            </span>
          </div>
          <div class="grid grid-cols-2 gap-1.5 text-[11px]">
            <div class="rounded-lg p-1.5 bg-white/85 border border-black/5">
              <div class="text-[9px] font-extrabold uppercase opacity-70">Esperada</div>
              <div class="font-bold truncate">${escapeHtml(cmp.expectedDisplay)}</div>
            </div>
            <div class="rounded-lg p-1.5 bg-white/85 border border-black/5">
              <div class="text-[9px] font-extrabold uppercase opacity-70">O Miau ouviu</div>
              <div class="font-bold truncate">${escapeHtml(cmp.spokenDisplay)}</div>
            </div>
          </div>
          <div class="w-full h-1.5 rounded-full bg-white/90 overflow-hidden">
            <div class="h-full rounded-full ${verdictMeta.bar} transition-all duration-300" style="width:${Math.max(8, cmp.score)}%"></div>
          </div>
        </div>
      `;
    }

    return `
      <div class="flex flex-col items-center gap-2.5 text-center">
        <div class="rounded-2xl px-4 py-3 bg-gradient-to-br from-pink-50 via-purple-50 to-sky-50 border border-purple-200 flex flex-col items-center gap-2 max-w-sm w-full shadow-inner">
          <img
            src="${ch.visualAssetUrl}"
            alt="${escapeHtml(ch.speakVisualLabel || ch.speakTargetText || '')}"
            class="w-14 h-14 rounded-xl shadow-sm bg-white"
          />
          <div class="font-display text-lg sm:text-xl font-bold text-[#3b1f6e] leading-tight">
            ${escapeHtml(ch.speakVisualLabel || ch.speakTargetText || '')}
          </div>
          <button
            id="btn-el-target-word-audio"
            type="button"
            class="px-3 py-1 rounded-full bg-white hover:bg-purple-100 border border-purple-200 text-[#5a3696] font-extrabold text-[11px] shadow-sm active:scale-95 transition"
          >
            🔊 Ouvir palavra do Miau
          </button>
          ${
            lesson.voiceStatusText
              ? `<div class="text-[11px] font-bold text-[#5a3696] bg-white/90 px-2.5 py-0.5 rounded-full border border-purple-200">${escapeHtml(lesson.voiceStatusText)}</div>`
              : ''
          }
        </div>

        ${comparisonHtml}

        ${
          !lesson.stepSolved
            ? `
              <div class="flex flex-col items-center gap-2 w-full">
                <button
                  id="btn-el-voice-record"
                  type="button"
                  ${lesson.isComparingVoice ? 'disabled' : ''}
                  class="px-4 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm shadow-sm active:scale-95 transition flex items-center gap-1.5 ${
                    lesson.isComparingVoice
                      ? 'bg-purple-300 text-white cursor-wait'
                      : lesson.isRecordingVoice
                        ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse'
                        : shouldRetryVoice
                          ? 'bg-amber-500 hover:bg-amber-600 text-white ring-2 ring-amber-200'
                          : 'bg-[#6e45a5] hover:bg-[#5c3691] text-white'
                  }"
                >
                  ${
                    lesson.isComparingVoice
                      ? '⏳ Comparando pronúncia...'
                      : lesson.isRecordingVoice
                        ? '⏹️ Parar e Comparar'
                        : shouldRetryVoice
                          ? '🎤 Falar Novamente'
                          : '🎤 Falar no Microfone'
                  }
                </button>
                <button
                  id="btn-el-voice-skip"
                  type="button"
                  class="px-3 py-1 rounded-full bg-purple-50 hover:bg-purple-100 border border-purple-200 text-[#6b4d9e] font-bold text-[10px] transition"
                >
                  Pular microfone agora
                </button>
              </div>
            `
            : ''
        }
      </div>
    `;
  }

  private renderCelebrationHtml(
    cel: CelebrationRuntimeState,
    progress: EarlyLiteracyProgress
  ): string {
    return `
      <div class="flex items-center justify-between gap-1.5 mb-2 text-left shrink-0">
        <div class="flex items-center gap-1.5">
          <button id="btn-el-cel-trail" type="button" class="px-2.5 py-1 rounded-full bg-white/95 border border-purple-200 text-purple-800 font-extrabold text-[11px] shadow-sm active:scale-95 transition">← Trilha</button>
          <button id="btn-el-cel-menu" type="button" class="px-2.5 py-1 rounded-full bg-purple-100/90 border border-purple-200 text-[#5a3696] font-extrabold text-[11px] active:scale-95 transition">🏠 Menu</button>
        </div>
        <div class="flex items-center gap-1.5">
          ${this.renderSoundToggleButton('btn-el-cel-sound')}
          <button id="modal-close" type="button" class="w-7 h-7 rounded-full bg-white/95 border border-purple-200 text-purple-800 text-xs font-bold">✕</button>
        </div>
      </div>

      <div class="flex-1 min-h-0 flex flex-col items-center justify-center overflow-y-auto miau-scroll p-2 text-center">
        <div class="rounded-2xl p-4 sm:p-5 bg-white/95 border border-amber-200 shadow-md max-w-sm w-full flex flex-col items-center gap-2.5">
          <div class="w-16 h-16">
            ${renderMiauSvg('affectionate', this.deps.getEquipped(), false)}
          </div>
          <div class="text-2xl tracking-widest text-amber-400 leading-none">
            ${'★'.repeat(cel.stars)}${'☆'.repeat(3 - cel.stars)}
          </div>
          <div>
            <h2 class="font-display text-lg sm:text-xl font-bold text-[#3b1f6e]">${escapeHtml(cel.title)}</h2>
            <p class="text-xs font-semibold text-[#5e4294] mt-0.5">${escapeHtml(cel.subtitle)}</p>
          </div>

          <div class="flex items-center justify-center gap-2 w-full">
            <div class="flex-1 rounded-xl p-2 bg-amber-50 border border-amber-200">
              <div class="font-display text-base font-bold text-amber-700">+${cel.coinsEarned} 🪙</div>
              <div class="text-[9px] font-extrabold uppercase text-amber-800">Moedas</div>
            </div>
            <div class="flex-1 rounded-xl p-2 bg-purple-50 border border-purple-200">
              <div class="font-display text-base font-bold text-[#5a3696]">+${cel.xpEarned} ✨</div>
              <div class="text-[9px] font-extrabold uppercase text-[#6b4d9e]">XP</div>
            </div>
          </div>

          <div class="rounded-xl p-2.5 w-full bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-300 flex items-center gap-2.5 text-left">
            ${
              cel.stickerVisualUrl
                ? `<img src="${cel.stickerVisualUrl}" alt="${escapeHtml(cel.stickerTitle)}" class="w-10 h-10 rounded-lg shrink-0" />`
                : `<span class="text-2xl shrink-0">${cel.stickerEmoji}</span>`
            }
            <div class="min-w-0">
              <div class="text-[11px] font-extrabold text-amber-950">
                ${cel.newlyUnlockedSticker ? '🎉 Novo Adesivo!' : 'Adesivo da Unidade'}
              </div>
              <div class="text-[11px] font-bold text-amber-900 truncate">${escapeHtml(cel.stickerTitle)}</div>
              <div class="text-[9px] font-semibold text-amber-800">Ofensiva: 🔥 ${progress.streakDays} dia(s)</div>
            </div>
          </div>

          <div class="flex gap-2 w-full mt-0.5">
            <button
              id="btn-el-cel-back"
              type="button"
              class="flex-1 py-2.5 rounded-xl bg-purple-100 hover:bg-purple-200 active:scale-95 text-[#4c2a85] font-extrabold text-xs transition"
            >
              Ver Trilha
            </button>
            ${
              cel.nextUnitId
                ? `
                  <button
                    id="btn-el-cel-next"
                    type="button"
                    data-next-unit="${cel.nextUnitId}"
                    class="flex-1 py-2.5 rounded-xl bg-[#6e45a5] hover:bg-[#5c3691] active:scale-95 text-white font-extrabold text-xs shadow-sm transition"
                  >
                    Próxima →
                  </button>
                `
                : ''
            }
          </div>
        </div>
      </div>
    `;
  }

  public bind(root: HTMLElement): void {
    if (this.isNavigatingLoading) return;

    if (this.stage === 'trail') {
      root.querySelector('#btn-el-main-menu')?.addEventListener('click', () => {
        this.cleanupAudioAndMic();
        if (this.deps.onExitToMainMenu) {
          this.deps.onExitToMainMenu();
        } else {
          this.deps.onExitToLearnHub();
        }
      });
      root.querySelector('#btn-el-back')?.addEventListener('click', () => {
        this.cleanupAudioAndMic();
        this.deps.onExitToLearnHub();
      });
      root.querySelector('#btn-el-sound')?.addEventListener('click', () => {
        const enabled = this.deps.onToggleSoundMute();
        if (!enabled) phonicsAudioEngine.stop();
        this.deps.onRequestRerender();
      });
      root.querySelector('#btn-el-free-mode')?.addEventListener('click', () => {
        const current = this.getProgress();
        const updated: EarlyLiteracyProgress = {
          ...current,
          freeExploreUnlocked: !current.freeExploreUnlocked,
        };
        saveEarlyLiteracyProgress(updated);
        hapticService.tap();
        this.deps.onToast(
          updated.freeExploreUnlocked
            ? 'Modo Livre ativado: todas as 6 unidades abertas!'
            : 'Modo trilha progressiva restaurado.'
        );
        this.deps.onRequestRerender();
      });
      root
        .querySelector('#btn-el-start-review')
        ?.addEventListener('click', () => {
          const pending = getPendingReviewChallenges(this.getProgress(), 5);
          if (pending.length === 0) return;
          this.startLessonWithLoading(null, pending);
        });
      root.querySelectorAll('[data-el-start-unit]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const unitId = btn.getAttribute('data-el-start-unit');
          const unit = EARLY_LITERACY_UNITS.find((u) => u.id === unitId);
          if (unit) this.startLessonWithLoading(unit, unit.challenges);
        });
      });
      return;
    }

    if (this.stage === 'celebration') {
      root.querySelector('#btn-el-cel-menu')?.addEventListener('click', () => {
        this.resetToTrail();
        if (this.deps.onExitToMainMenu) {
          this.deps.onExitToMainMenu();
        } else {
          this.deps.onExitToLearnHub();
        }
      });
      root.querySelector('#btn-el-cel-trail')?.addEventListener('click', () => {
        this.resetToTrail();
        this.deps.onRequestRerender();
      });
      root.querySelector('#btn-el-cel-back')?.addEventListener('click', () => {
        this.resetToTrail();
        this.deps.onRequestRerender();
      });
      root
        .querySelector('#btn-el-cel-sound')
        ?.addEventListener('click', () => {
          const enabled = this.deps.onToggleSoundMute();
          if (!enabled) phonicsAudioEngine.stop();
          this.deps.onRequestRerender();
        });
      const nextBtn = root.querySelector('#btn-el-cel-next');
      nextBtn?.addEventListener('click', () => {
        const nextId = nextBtn.getAttribute('data-next-unit');
        const nextUnit = EARLY_LITERACY_UNITS.find((u) => u.id === nextId);
        if (nextUnit) this.startLessonWithLoading(nextUnit, nextUnit.challenges);
      });
      return;
    }

    // Lesson bindings
    const lesson = this.lesson;
    if (!lesson) return;
    const ch = lesson.queue[lesson.cursor];

    root.querySelector('#btn-el-exit-lesson')?.addEventListener('click', () => {
      this.resetToTrail();
      this.deps.onRequestRerender();
    });
    root.querySelector('#btn-el-lesson-menu')?.addEventListener('click', () => {
      this.resetToTrail();
      if (this.deps.onExitToMainMenu) {
        this.deps.onExitToMainMenu();
      } else {
        this.deps.onExitToLearnHub();
      }
    });
    root
      .querySelector('#btn-el-lesson-sound')
      ?.addEventListener('click', () => {
        const enabled = this.deps.onToggleSoundMute();
        if (!enabled) phonicsAudioEngine.stop();
        this.deps.onRequestRerender();
      });

    root
      .querySelector('#btn-el-listen-normal')
      ?.addEventListener('click', () => {
        void this.playPromptAudio(false);
      });
    root
      .querySelector('#btn-el-listen-slow')
      ?.addEventListener('click', () => {
        void this.playPromptAudio(true);
      });
    root
      .querySelector('#btn-el-hint-audio')
      ?.addEventListener('click', () => {
        void phonicsAudioEngine.speak(ch.hintAudioText, { slow: true });
      });
    root
      .querySelector('#btn-el-replay-word')
      ?.addEventListener('click', () => {
        const target =
          lesson.readingComparison?.targetReplayAudioText ||
          ch.speakTargetText ||
          ch.keywords[0] ||
          ch.audioSlowText;
        void phonicsAudioEngine.speakTargetWord(target, { slow: true });
      });
    root
      .querySelector('#btn-el-target-word-audio')
      ?.addEventListener('click', () => {
        const target = ch.speakTargetText || ch.keywords[0] || ch.audioNormalText;
        void phonicsAudioEngine.speakTargetWord(target, { slow: false });
      });

    root.querySelector('#btn-el-continue')?.addEventListener('click', () => {
      this.advanceLesson();
    });

    root.querySelectorAll('[data-el-option]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (lesson.stepSolved) return;
        const optId = btn.getAttribute('data-el-option');
        if (!optId) return;
        this.handleAnswerAttempt(optId === ch.correctOptionId);
      });
    });

    root.querySelectorAll('[data-el-letter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (lesson.stepSolved) return;
        const letter = btn.getAttribute('data-el-letter');
        if (!letter) return;
        this.handleAnswerAttempt(letter === ch.correctLetter);
      });
    });

    const dropzone = root.querySelector('#el-word-dropzone') as HTMLElement | null;
    if (dropzone) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('scale-105', 'bg-purple-100');
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('scale-105', 'bg-purple-100');
      });
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('scale-105', 'bg-purple-100');
        if (lesson.stepSolved) return;
        const dropped = e.dataTransfer?.getData('text/plain');
        if (!dropped) return;
        this.handleWordBlockChoice(dropped);
      });
    }

    root.querySelectorAll('[data-el-bank-letter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (lesson.stepSolved) return;
        const letter = btn.getAttribute('data-el-bank-letter');
        if (letter) this.handleWordBlockChoice(letter);
      });
      btn.addEventListener('dragstart', (e) => {
        const letter = btn.getAttribute('data-el-bank-letter') || '';
        (e as DragEvent).dataTransfer?.setData('text/plain', letter);
      });
    });

    root
      .querySelector('#btn-el-voice-record')
      ?.addEventListener('click', () => void this.handleVoiceRecordToggle());
    root.querySelector('#btn-el-voice-skip')?.addEventListener('click', () => {
      if (lesson.isRecordingVoice) {
        lesson.isRecordingVoice = false;
        void soundService.stopRecording().catch(() => {});
      }
      this.handleAnswerAttempt(true);
    });
  }

  private startLessonWithLoading(
    unit: LiteracyUnitDef | null,
    challenges: LiteracyChallenge[]
  ): void {
    this.clearTimers();
    this.cleanupAudioAndMic();
    this.isNavigatingLoading = true;
    hapticService.tap();
    this.deps.onRequestRerender();

    if (challenges[0]) {
      phonicsAudioEngine.prefetchChallengeAudio(challenges[0]);
    }

    this.transitionTimer = window.setTimeout(() => {
      this.transitionTimer = null;
      this.isNavigatingLoading = false;
      this.startLessonSession(unit, challenges);
    }, 240);
  }

  private startLessonSession(
    unit: LiteracyUnitDef | null,
    challenges: LiteracyChallenge[]
  ): void {
    this.cleanupAudioAndMic();
    this.stage = 'lesson';
    this.celebration = null;
    this.lesson = {
      unit,
      queue: [...challenges],
      cursor: 0,
      isRetryItemFlags: challenges.map(() => false),
      firstTryCleanFlags: {},
      inLessonRetriesQueued: new Set(),
      currentAttemptHasError: false,
      stepSolved: false,
      filledWordLetter: null,
      lastFeedback: null,
      readingComparison: null,
      miauMood: 'happy',
      isRecordingVoice: false,
      isComparingVoice: false,
      voiceStatusText: '',
      isSpeakingPrompt: false,
      isLoadingAudio: false,
      isTransitioningStep: false,
    };
    if (challenges[1]) {
      phonicsAudioEngine.prefetchChallengeAudio(challenges[1]);
    }
    this.deps.onRequestRerender();
    void this.playPromptAudio(false);
  }

  private async playPromptAudio(slow: boolean): Promise<void> {
    const lesson = this.lesson;
    if (!lesson) return;
    const ch = lesson.queue[lesson.cursor];
    const text = slow ? ch.audioSlowText : ch.audioNormalText;
    await phonicsAudioEngine.speak(text, { slow });
  }

  private handleWordBlockChoice(letter: string): void {
    const lesson = this.lesson;
    if (!lesson || lesson.stepSolved) return;
    const ch = lesson.queue[lesson.cursor];
    const isCorrect = letter === ch.missingAnswer;
    if (isCorrect) {
      lesson.filledWordLetter = letter;
    }
    this.handleAnswerAttempt(isCorrect);
  }

  private handleAnswerAttempt(isCorrect: boolean): void {
    const lesson = this.lesson;
    if (!lesson || lesson.stepSolved) return;
    const ch = lesson.queue[lesson.cursor];

    if (isCorrect) {
      hapticService.coin();
      phonicsAudioEngine.playSuccessFeedback();
      const firstTryClean = !lesson.currentAttemptHasError;
      if (!(ch.id in lesson.firstTryCleanFlags)) {
        lesson.firstTryCleanFlags[ch.id] = firstTryClean;
      }

      const currentProgress = this.getProgress();
      recordChallengeSpacedOutcome(
        currentProgress,
        ch,
        firstTryClean || (lesson.isRetryItemFlags[lesson.cursor] ?? false)
      );

      lesson.stepSolved = true;
      lesson.miauMood = 'affectionate';
      lesson.lastFeedback = {
        kind: 'praise',
        text: ch.praiseText,
      };
      this.deps.onRequestRerender();
      void phonicsAudioEngine.speak(ch.praiseText, { slow: false });
      return;
    }

    hapticService.tap();
    phonicsAudioEngine.playGentleHintFeedback();
    lesson.currentAttemptHasError = true;
    lesson.firstTryCleanFlags[ch.id] = false;
    lesson.miauMood = 'playful';
    lesson.lastFeedback = {
      kind: 'hint',
      text: ch.hintText,
    };

    const currentProgress = this.getProgress();
    recordChallengeSpacedOutcome(currentProgress, ch, false);

    if (!lesson.inLessonRetriesQueued.has(ch.id)) {
      lesson.inLessonRetriesQueued.add(ch.id);
      lesson.queue.push(ch);
      lesson.isRetryItemFlags.push(true);
    }

    this.deps.onRequestRerender();
    void phonicsAudioEngine.speak(ch.hintAudioText, { slow: true });
  }

  private async handleVoiceRecordToggle(): Promise<void> {
    const lesson = this.lesson;
    if (!lesson || lesson.stepSolved || lesson.isComparingVoice) return;
    const ch = lesson.queue[lesson.cursor];

    if (lesson.isRecordingVoice) {
      lesson.isRecordingVoice = false;
      lesson.isComparingVoice = true;
      lesson.voiceStatusText = 'Ouvindo e comparando sua pronúncia...';
      this.deps.onRequestRerender();
      try {
        const { audioBase64, mimeType } = await soundService.stopRecording();
        const transcript = await transcribeUserAudio(audioBase64, mimeType);
        const comparison = evaluateReadingAttempt(transcript, ch);

        lesson.isComparingVoice = false;
        lesson.readingComparison = comparison;

        if (comparison.verdict === 'positive') {
          lesson.voiceStatusText = `Muito bem! Você leu: "${comparison.spokenDisplay}" 🌟`;
          hapticService.coin();
          phonicsAudioEngine.playSuccessFeedback();

          const firstTryClean = !lesson.currentAttemptHasError;
          if (!(ch.id in lesson.firstTryCleanFlags)) {
            lesson.firstTryCleanFlags[ch.id] = firstTryClean;
          }
          recordChallengeSpacedOutcome(
            this.getProgress(),
            ch,
            firstTryClean || (lesson.isRetryItemFlags[lesson.cursor] ?? false)
          );

          lesson.stepSolved = true;
          lesson.miauMood = 'affectionate';
          lesson.lastFeedback = {
            kind: 'praise',
            text: comparison.feedbackText,
          };
          this.deps.onRequestRerender();
          void phonicsAudioEngine.speak(comparison.feedbackAudioText, {
            slow: false,
          });
          return;
        }

        // Feedback Mediano ou Negativo: reproduz a palavra com a voz do Miau e pede para falar novamente
        hapticService.tap();
        phonicsAudioEngine.playGentleHintFeedback();
        lesson.currentAttemptHasError = true;
        lesson.firstTryCleanFlags[ch.id] = false;
        recordChallengeSpacedOutcome(this.getProgress(), ch, false);

        if (comparison.verdict === 'medium') {
          lesson.voiceStatusText = 'Quase igual! Ouça a palavra e toque em "Falar Novamente"!';
          lesson.miauMood = 'playful';
          lesson.lastFeedback = {
            kind: 'medium',
            text: comparison.feedbackText,
          };
        } else {
          lesson.voiceStatusText = 'Vamos tentar de novo! Ouça o Miau e toque em "Falar Novamente"!';
          lesson.miauMood = 'sleepy';
          lesson.lastFeedback = {
            kind: 'negative',
            text: comparison.feedbackText,
          };
        }

        this.deps.onRequestRerender();
        await phonicsAudioEngine.speak(comparison.feedbackAudioText, {
          slow: false,
        });
        if (this.lesson === lesson && !lesson.stepSolved && !lesson.isRecordingVoice) {
          await phonicsAudioEngine.speakTargetWord(
            comparison.targetReplayAudioText,
            { slow: true }
          );
        }
      } catch {
        lesson.isComparingVoice = false;
        lesson.voiceStatusText =
          'Não foi possível analisar o áudio agora. Tente falar de novo ou use Pular!';
        this.deps.onRequestRerender();
      }
      return;
    }

    phonicsAudioEngine.stop();
    try {
      await soundService.startRecording();
      lesson.isRecordingVoice = true;
      lesson.voiceStatusText =
        'Gravando... leia em voz alta e toque para comparar!';
      this.deps.onRequestRerender();
    } catch {
      lesson.voiceStatusText =
        'Microfone não liberado. Libere o microfone ou toque em Pular!';
      this.deps.onRequestRerender();
    }
  }

  private advanceLesson(): void {
    const lesson = this.lesson;
    if (!lesson) return;
    this.cleanupAudioAndMic();

    if (lesson.cursor + 1 < lesson.queue.length) {
      lesson.cursor += 1;
      lesson.currentAttemptHasError = false;
      lesson.stepSolved = false;
      lesson.filledWordLetter = null;
      lesson.lastFeedback = null;
      lesson.readingComparison = null;
      lesson.miauMood = 'happy';
      lesson.voiceStatusText = '';
      lesson.isComparingVoice = false;

      const upcoming = lesson.queue[lesson.cursor + 1];
      if (upcoming) {
        phonicsAudioEngine.prefetchChallengeAudio(upcoming);
      }
      this.deps.onRequestRerender();
      void this.playPromptAudio(false);
      return;
    }

    const cleanCount = Object.values(lesson.firstTryCleanFlags).filter(
      Boolean
    ).length;
    const uniqueCount = Math.max(
      1,
      Object.keys(lesson.firstTryCleanFlags).length
    );
    const ratio = cleanCount / uniqueCount;
    const stars = ratio >= 0.85 ? 3 : ratio >= 0.55 ? 2 : 1;

    if (lesson.unit) {
      const unit = lesson.unit;
      const { newlyUnlockedSticker } = completeLiteracyUnit(
        this.getProgress(),
        unit.id,
        stars
      );
      this.deps.onGrantRewards(unit.coinReward, unit.xpReward);
      const unitIndex = EARLY_LITERACY_UNITS.findIndex((u) => u.id === unit.id);
      const nextUnit = EARLY_LITERACY_UNITS[unitIndex + 1] || null;

      this.celebration = {
        title: `Unidade ${unit.number} Concluída!`,
        subtitle: `Você arrasou em "${unit.title}"!`,
        stars,
        coinsEarned: unit.coinReward,
        xpEarned: unit.xpReward,
        stickerEmoji: unit.sticker.emoji,
        stickerTitle: unit.sticker.title,
        stickerVisualUrl: unit.sticker.visualAssetUrl,
        newlyUnlockedSticker,
        nextUnitId: nextUnit?.id || null,
      };
    } else {
      const reviewCoins = 30;
      const reviewXp = 25;
      this.deps.onGrantRewards(reviewCoins, reviewXp);
      this.celebration = {
        title: 'Revisão Espaçada Concluída!',
        subtitle: 'Seus sons e palavrinhas ficaram ainda mais fortes!',
        stars,
        coinsEarned: reviewCoins,
        xpEarned: reviewXp,
        stickerEmoji: '🔄',
        stickerTitle: 'Memória Afiada com o Miau',
        newlyUnlockedSticker: false,
        nextUnitId: null,
      };
    }

    this.stage = 'celebration';
    this.lesson = null;
    hapticService.achievement();
    phonicsAudioEngine.playSuccessFeedback();
    this.deps.onRequestRerender();
    if (this.celebration) {
      void phonicsAudioEngine.speak(
        `${this.celebration.title} ${this.celebration.subtitle}`,
        { slow: false }
      );
    }
  }
}
