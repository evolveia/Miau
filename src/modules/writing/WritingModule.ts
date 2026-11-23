import {
  requestWritingEvaluation,
  requestWritingTeach,
} from '../../services/geminiClient';
import { hapticService } from '../../services/hapticService';
import { soundService } from '../../services/soundService';
import type { EquippedItems, MiauMood, UserHumanProfile } from '../../types';
import { escapeHtml } from '../../utils/html';
import { renderMiauSvg } from '../../ui/MiauIllustration';
import {
  TRACKED_WRITING_VOWELS,
  WRITING_UNITS,
  type MotorDifficulty,
  type WritingChallenge,
  type WritingUnitDef,
} from './data';
import {
  buildStrokeCueSummary,
  completeWritingUnit,
  evaluateHandwritingTrace,
  getMotorGuideWidths,
  isWritingUnitUnlocked,
  layoutTargetStrokes,
  loadWritingProgress,
  recordWritingStepSolved,
  resamplePolyline,
  saveWritingProgress,
  writingAudioEngine,
  type CanvasPoint,
  type TargetCanvasLayout,
  type WritingProgress,
} from './writingEngine';

export interface WritingModuleDeps {
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

type WritingStage = 'trail' | 'lesson' | 'celebration';

interface WritingLessonState {
  unit: WritingUnitDef;
  cursor: number;
  motorOverride: MotorDifficulty;
  userStrokes: CanvasPoint[][];
  activeStroke: CanvasPoint[] | null;
  coachTip: string;
  coachMood: MiauMood;
  isAiTeaching: boolean;
  isEvaluating: boolean;
  isDemoAnimating: boolean;
  lastEval: {
    verdict: 'positive' | 'medium' | 'retry';
    stars: number;
    coveragePct: number;
    precisionPct: number;
    feedbackText: string;
  } | null;
  stepSolved: boolean;
  stepStars: number[];
}

interface WritingCelebrationState {
  unitTitle: string;
  stars: number;
  coinsEarned: number;
  xpEarned: number;
  nextUnitId: string | null;
}

export class WritingModuleController {
  private stage: WritingStage = 'trail';
  private lesson: WritingLessonState | null = null;
  private celebration: WritingCelebrationState | null = null;
  private canvasEl: HTMLCanvasElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private demoRafId: number | null = null;
  private demoProgress = 0; // 0..1 across all strokes
  private currentLayout: TargetCanvasLayout | null = null;
  private canvasCssWidth = 320;
  private canvasCssHeight = 250;
  private teachCache = new Map<string, { coachTip: string; audioScript: string }>();
  private unsubscribeAudio: (() => void) | null = null;

  constructor(private deps: WritingModuleDeps) {
    this.unsubscribeAudio = writingAudioEngine.subscribeAudioState((state) => {
      const badge = document.getElementById('wr-miau-audio-badge');
      if (!badge) return;
      if (state.loading) {
        badge.textContent = '🐾 Preparando voz...';
        badge.className =
          'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-[#5a3696] animate-pulse';
      } else if (state.speaking) {
        badge.textContent = '🔊 Miau ensinando...';
        badge.className =
          'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 animate-pulse';
      } else {
        badge.textContent = '✍️ Voz do Miau';
        badge.className =
          'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/90 text-[#6b4d9e] border border-purple-100';
      }
    });
  }

  public dispose(): void {
    this.stopCanvasResources();
    writingAudioEngine.stop();
    this.unsubscribeAudio?.();
    this.unsubscribeAudio = null;
  }

  public resetToTrail(): void {
    this.stopCanvasResources();
    writingAudioEngine.stop();
    this.stage = 'trail';
    this.lesson = null;
    this.celebration = null;
  }

  private stopCanvasResources(): void {
    if (this.demoRafId !== null) {
      window.cancelAnimationFrame(this.demoRafId);
      this.demoRafId = null;
    }
    if (this.lesson) {
      this.lesson.isDemoAnimating = false;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.canvasEl = null;
  }

  private getProgress(): WritingProgress {
    return loadWritingProgress(this.deps.getOwnerId());
  }

  private getCurrentUnit(progress: WritingProgress): WritingUnitDef {
    const next = WRITING_UNITS.find(
      (u, idx) =>
        isWritingUnitUnlocked(progress, idx) &&
        !progress.completedUnits.includes(u.id)
    );
    return next || WRITING_UNITS[WRITING_UNITS.length - 1];
  }

  public render(): string {
    const progress = this.getProgress();
    if (this.stage === 'lesson' && this.lesson) {
      return this.renderLessonHtml(this.lesson);
    }
    if (this.stage === 'celebration' && this.celebration) {
      return this.renderCelebrationHtml(this.celebration);
    }
    return this.renderTrailHtml(progress);
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

  private renderTrailHtml(progress: WritingProgress): string {
    const firstName =
      this.deps.getHumanProfile().fullName.trim().split(/\s+/)[0] ||
      'Pequeno(a)';
    const completedCount = progress.completedUnits.length;
    const totalUnits = WRITING_UNITS.length;
    const pct = Math.round((completedCount / totalUnits) * 100);
    const activeUnit = this.getCurrentUnit(progress);

    return `
      <div class="flex items-center justify-between gap-1.5 mb-2 text-left shrink-0">
        <div class="flex items-center gap-1.5 min-w-0">
          <button
            id="btn-wr-main-menu"
            type="button"
            class="px-2.5 py-1 rounded-full bg-white/95 border border-purple-200 text-[#4c2a85] font-extrabold text-[11px] shadow-sm hover:bg-purple-50 active:scale-95 transition shrink-0"
          >
            🏠 Menu
          </button>
          <button
            id="btn-wr-back"
            type="button"
            class="px-2.5 py-1 rounded-full bg-purple-100/90 border border-purple-200 text-[#5a3696] font-extrabold text-[11px] hover:bg-purple-200/80 active:scale-95 transition shrink-0"
          >
            ← Trilhas
          </button>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          ${this.renderSoundToggleButton('btn-wr-sound')}
          <button id="modal-close" type="button" class="w-7 h-7 rounded-full bg-white/95 border border-purple-200 text-purple-800 text-xs font-bold active:scale-95 transition shrink-0">✕</button>
        </div>
      </div>

      <div class="rounded-2xl px-3 py-2.5 mb-2 bg-white/90 border border-purple-200/80 shadow-sm text-left shrink-0">
        <div class="flex items-center justify-between gap-2 mb-1.5">
          <div class="min-w-0">
            <h2 class="font-display text-sm sm:text-base font-bold text-[#3b1f6e] leading-tight">
              Vamos Escrever ✍️
            </h2>
            <p class="text-[10px] font-semibold text-[#6b4d9e] leading-tight">
              IA ensina o traçado + prática com o dedo na tela
            </p>
          </div>
          <span class="px-2 py-0.5 rounded-full bg-purple-100 text-[#5a3696] text-[10px] font-extrabold shrink-0">
            ${pct}% concluído
          </span>
        </div>
        <div class="w-full h-2 rounded-full bg-purple-100 border border-purple-200/70 overflow-hidden">
          <div
            class="h-full rounded-full bg-gradient-to-r from-[#7b52b8] via-[#a855f7] to-[#ec4899] transition-all duration-500"
            style="width: ${Math.max(6, pct)}%"
          ></div>
        </div>
      </div>

      <div class="flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto miau-scroll pr-0.5 text-left">
        <!-- Unidade em Destaque -->
        <div class="rounded-2xl p-2.5 sm:p-3 bg-gradient-to-br from-white via-[#f8f3ff] to-[#efe5ff] border border-[#9b72cf] shadow-sm flex items-center justify-between gap-2.5 flex-wrap">
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            <div class="w-11 h-11 rounded-xl bg-gradient-to-br ${activeUnit.accentGradient} border border-white shadow-inner flex items-center justify-center text-2xl shrink-0">
              ${activeUnit.emoji}
            </div>
            <div class="min-w-0">
              <div class="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-purple-100 text-[#5a3696] mb-0.5">
                ✍️ ${completedCount === totalUnits ? 'Módulo Completo!' : 'Próxima Aula de Escrita'}
              </div>
              <h3 class="font-display text-xs sm:text-sm font-bold text-[#3b1f6e] leading-snug truncate">
                ${activeUnit.number}. ${escapeHtml(activeUnit.title)}
              </h3>
              <p class="text-[10px] font-semibold text-[#5e4294] leading-tight truncate">
                ${escapeHtml(activeUnit.focusLabel)}
              </p>
            </div>
          </div>
          <button
            type="button"
            data-wr-start-unit="${activeUnit.id}"
            class="px-3.5 py-2 rounded-xl bg-[#6e45a5] hover:bg-[#5c3691] active:scale-95 text-white font-extrabold text-[11px] sm:text-xs shadow-sm transition shrink-0"
          >
            ${progress.completedUnits.includes(activeUnit.id) ? '🔁 Treinar' : '▶ Começar'}
          </button>
        </div>

        <!-- Painel de Coordenação Motora & Vogais -->
        <div class="rounded-2xl p-2.5 sm:p-3 bg-white/90 border border-purple-100 shadow-sm flex flex-col gap-2">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <div class="w-10 h-10 shrink-0">
                ${renderMiauSvg('playful', this.deps.getEquipped(), false)}
              </div>
              <div class="min-w-0">
                <div class="text-[9px] font-extrabold uppercase tracking-wide text-[#6b4d9e]">Caderno de ${escapeHtml(firstName)}</div>
                <div class="font-display text-xs sm:text-sm font-bold text-[#3b1f6e] leading-tight truncate">
                  Cubra com o dedo do largo ao fino!
                </div>
              </div>
            </div>
            <button
              id="btn-wr-free-mode"
              type="button"
              class="px-2.5 py-1 rounded-full text-[10px] font-extrabold border active:scale-95 transition shrink-0 ${
                progress.freeExploreUnlocked
                  ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                  : 'bg-purple-50 border-purple-200 text-[#5a3696] hover:bg-purple-100'
              }"
            >
              ${progress.freeExploreUnlocked ? '🔓 Todas Abertas' : '🔓 Liberar Todas'}
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
              <div class="text-sm font-display font-bold text-sky-700 leading-tight">${progress.totalPracticesCompleted}</div>
              <div class="text-[9px] font-extrabold text-sky-800 uppercase">Traços</div>
            </div>
          </div>

          <div class="flex items-center justify-between gap-2 pt-0.5">
            <span class="text-[10px] font-extrabold text-[#5a3696]">Vogais escritas:</span>
            <div class="flex items-center gap-1">
              ${TRACKED_WRITING_VOWELS.map((v) => {
                const done = progress.masteredVowels.includes(v);
                return `
                  <span class="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center font-display text-xs font-bold border transition ${
                    done
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

        <!-- Trilha das 7 Unidades -->
        <div class="flex flex-col gap-1.5 pb-1">
          <div class="text-[10px] font-extrabold uppercase tracking-wide text-[#5a3696] px-1">
            Trilha de Coordenação Motora & Escrita (${totalUnits} Unidades)
          </div>
          ${WRITING_UNITS.map((unit, idx) => {
            const unlocked = isWritingUnitUnlocked(progress, idx);
            const completed = progress.completedUnits.includes(unit.id);
            const stars = progress.unitBestStars[unit.id] ?? 0;
            const isNext = unit.id === activeUnit.id && !completed;
            const previewTargets = unit.challenges
              .map((c) => c.targetText)
              .filter((v, i, arr) => arr.indexOf(v) === i)
              .join(' • ');

            return `
              <div class="rounded-2xl p-2.5 border transition-all ${
                isNext
                  ? 'bg-white border-[#7b52b8] shadow-sm ring-1 ring-[#9b72cf]/40'
                  : unlocked
                    ? 'bg-white/95 border-purple-100 shadow-sm hover:border-purple-300'
                    : 'bg-white/60 border-purple-100/80 opacity-80'
              }">
                <div class="flex items-center gap-2.5">
                  <div class="w-11 h-11 rounded-xl bg-gradient-to-br ${unit.accentGradient} border border-white shadow-inner flex flex-col items-center justify-center shrink-0">
                    ${
                      unlocked
                        ? `<span class="text-xl leading-none">${unit.emoji}</span>`
                        : `<span class="text-base leading-none">🔒</span><span class="text-[8px] font-extrabold text-[#4c2a85]">Un.${unit.number}</span>`
                    }
                  </div>

                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1 flex-wrap">
                      <span class="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-purple-100 text-[#5a3696]">
                        Un. ${unit.number} • ${escapeHtml(previewTargets)}
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
                    <div class="mt-1 flex items-center gap-1.5 text-[9px] font-bold text-[#6b4d9e]">
                      <span>✍️ ${unit.challenges.length} etapas</span>
                      <span>•</span>
                      <span>🪙 +${unit.coinReward}</span>
                    </div>
                  </div>

                  <div class="shrink-0">
                    ${
                      unlocked
                        ? `<button
                             type="button"
                             data-wr-start-unit="${unit.id}"
                             class="px-3 py-1.5 rounded-xl font-extrabold text-[11px] shadow-sm active:scale-95 transition ${
                               completed
                                 ? 'bg-purple-100 hover:bg-purple-200 text-[#4c2a85]'
                                 : 'bg-[#6e45a5] hover:bg-[#5c3691] text-white'
                             }"
                           >
                             ${completed ? '🔁 Refazer' : '▶ Abrir'}
                           </button>`
                        : `<span class="inline-block px-2.5 py-1 rounded-xl bg-purple-50 text-purple-400 text-[10px] font-extrabold border border-purple-100">Bloq.</span>`
                    }
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  private renderLessonHtml(lesson: WritingLessonState): string {
    const ch = lesson.unit.challenges[lesson.cursor];
    const total = lesson.unit.challenges.length;
    const pct = Math.round(
      ((lesson.cursor + (lesson.stepSolved ? 1 : 0)) / total) * 100
    );
    const motorLabel =
      lesson.motorOverride === 'fino'
        ? 'Fino (Precisão)'
        : lesson.motorOverride === 'medio'
          ? 'Médio'
          : 'Largo (Fácil)';

    const audioState = writingAudioEngine.getState();

    return `
      <!-- Cabeçalho de Aula Compacto -->
      <div class="flex items-center justify-between gap-1.5 mb-2 text-left shrink-0">
        <div class="flex items-center gap-1 shrink-0">
          <button id="btn-wr-exit-lesson" type="button" class="px-2.5 py-1 rounded-full bg-white/95 border border-purple-200 text-purple-800 font-extrabold text-[11px] shadow-sm hover:bg-purple-50 active:scale-95 transition shrink-0">← Trilha</button>
          <button id="btn-wr-lesson-menu" type="button" class="px-2 py-1 rounded-full bg-purple-100/90 border border-purple-200 text-[#5a3696] font-extrabold text-[11px] hover:bg-purple-200/80 active:scale-95 transition shrink-0">🏠</button>
        </div>
        <div class="flex-1 min-w-0 px-1">
          <div class="flex items-center justify-between text-[10px] font-extrabold text-[#4c2a85] mb-0.5 gap-1">
            <span class="truncate">Un. ${lesson.unit.number}: ${escapeHtml(ch.displayBadge)}</span>
            <span class="shrink-0">${lesson.cursor + 1}/${total}</span>
          </div>
          <div class="w-full h-2 rounded-full bg-white/80 border border-purple-200 overflow-hidden">
            <div
              class="h-full rounded-full bg-gradient-to-r from-[#7b52b8] via-[#a855f7] to-[#ec4899] transition-all duration-300"
              style="width: ${Math.max(10, pct)}%"
            ></div>
          </div>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          ${this.renderSoundToggleButton('btn-wr-lesson-sound')}
          <button id="modal-close" type="button" class="w-7 h-7 rounded-full bg-white/95 border border-purple-200 text-purple-800 text-xs font-bold active:scale-95 transition shrink-0">✕</button>
        </div>
      </div>

      <div class="flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto miau-scroll pr-0.5 text-left">
        <!-- Professor Miau IA Card -->
        <div class="rounded-2xl p-2.5 bg-white/95 border border-purple-200 shadow-sm flex items-start gap-2.5 shrink-0">
          <div class="w-11 h-11 shrink-0 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center p-0.5">
            ${renderMiauSvg(lesson.coachMood, this.deps.getEquipped(), false)}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-1.5 flex-wrap mb-0.5">
              <span class="text-[10px] font-extrabold uppercase tracking-wide text-[#5a3696]">
                ${ch.emoji} ${escapeHtml(ch.title)}
              </span>
              <span
                id="wr-miau-audio-badge"
                class="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/90 text-[#6b4d9e] border border-purple-100"
              >
                ${
                  audioState.loading
                    ? '🐾 Preparando voz...'
                    : audioState.speaking
                      ? '🔊 Miau ensinando...'
                      : '✍️ Voz do Miau'
                }
              </span>
            </div>
            <p id="wr-coach-tip" class="text-[11px] sm:text-xs font-semibold text-[#3b1f6e] leading-snug">
              ${escapeHtml(lesson.coachTip || ch.teachScript)}
            </p>
            <div class="mt-1.5 flex items-center gap-1.5 flex-wrap">
              <button
                id="btn-wr-ai-teach"
                type="button"
                ${lesson.isAiTeaching ? 'disabled' : ''}
                class="px-2.5 py-1 rounded-full bg-purple-100 hover:bg-purple-200 text-[#4c2a85] font-extrabold text-[10px] active:scale-95 transition disabled:opacity-60"
              >
                ${lesson.isAiTeaching ? '🐾 Pensando...' : '🤖 IA Ensinar'}
              </button>
              <button
                id="btn-wr-demo-anim"
                type="button"
                class="px-2.5 py-1 rounded-full bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-extrabold text-[10px] active:scale-95 transition"
              >
                ${lesson.isDemoAnimating ? '✨ Mostrando...' : '🎬 Ver Traçado'}
              </button>
              <span class="text-[10px] font-bold text-[#6b4d9e] ml-auto">
                Guia: ${escapeHtml(motorLabel)}
              </span>
            </div>
          </div>
        </div>

        <!-- Seletor de Coordenação Motora Fina + Área de Desenho com o Dedo -->
        <div class="rounded-2xl p-2.5 bg-white/95 border-2 border-[#b99ce8] shadow-md flex flex-col gap-2 shrink-0">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <span class="text-[10px] font-extrabold text-[#5a3696]">
              ✍️ Cubra "${escapeHtml(ch.targetText)}" com o dedo seguindo os números:
            </span>
            <div class="flex items-center gap-1">
              {LEVEL_BTNS}
            </div>
          </div>

          <div
            id="wr-canvas-wrap"
            class="relative w-full h-[220px] sm:h-[260px] rounded-2xl overflow-hidden bg-gradient-to-b from-[#fdfaff] via-[#ffffff] to-[#f8f3ff] border border-purple-200 shadow-inner select-none"
            style="touch-action: none;"
          >
            <canvas
              id="wr-canvas"
              class="block w-full h-full cursor-crosshair"
              style="touch-action: none;"
            ></canvas>
          </div>

          <!-- Botões de Ação do Traçado -->
          <div class="flex items-center gap-2 flex-wrap">
            <button
              id="btn-wr-clear"
              type="button"
              class="px-3 py-2 rounded-xl bg-purple-100 hover:bg-purple-200 text-[#4c2a85] font-extrabold text-xs active:scale-95 transition shrink-0"
            >
              🧹 Limpar
            </button>
            <button
              id="btn-wr-verify"
              type="button"
              ${lesson.isEvaluating ? 'disabled' : ''}
              class="flex-1 min-w-[140px] py-2 px-4 rounded-xl bg-gradient-to-r from-[#6e45a5] to-[#9b5de5] hover:opacity-95 text-white font-extrabold text-xs sm:text-sm shadow-sm active:scale-95 transition disabled:opacity-60"
            >
              ${lesson.isEvaluating ? '🐾 Miau olhando...' : '✨ Verificar com IA'}
            </button>
            ${
              lesson.stepSolved
                ? `<button
                     id="btn-wr-next"
                     type="button"
                     class="py-2 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-95 text-white font-extrabold text-xs sm:text-sm shadow-sm active:scale-95 transition shrink-0"
                   >
                     ${lesson.cursor + 1 >= total ? 'Finalizar 🏅' : 'Próximo ➜'}
                   </button>`
                : ''
            }
          </div>
        </div>

        <!-- Feedback da IA / Coordenação -->
        ${
          lesson.lastEval
            ? `
              <div class="rounded-2xl p-2.5 border shadow-sm flex items-start gap-2.5 shrink-0 ${
                lesson.lastEval.verdict === 'positive'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : lesson.lastEval.verdict === 'medium'
                    ? 'bg-amber-50 border-amber-300 text-amber-950'
                    : 'bg-rose-50 border-rose-300 text-rose-950'
              }">
                <div class="text-xl leading-none shrink-0 mt-0.5">
                  ${
                    lesson.lastEval.verdict === 'positive'
                      ? '🌟'
                      : lesson.lastEval.verdict === 'medium'
                        ? '💪'
                        : '🐾'
                  }
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-2 flex-wrap mb-0.5">
                    <span class="text-xs font-extrabold">
                      ${'★'.repeat(lesson.lastEval.stars)}${'☆'.repeat(3 - lesson.lastEval.stars)}
                      ${
                        lesson.lastEval.verdict === 'positive'
                          ? ' Traçado Aprovado!'
                          : lesson.lastEval.verdict === 'medium'
                            ? ' Quase Perfeito!'
                            : ' Vamos Tentar de Novo!'
                      }
                    </span>
                    <span class="text-[10px] font-bold opacity-85">
                      Cobertura ${lesson.lastEval.coveragePct}% • Firmeza ${lesson.lastEval.precisionPct}%
                    </span>
                  </div>
                  <p class="text-[11px] font-semibold leading-snug">
                    ${escapeHtml(lesson.lastEval.feedbackText)}
                  </p>
                </div>
              </div>
            `
            : `
              <div class="rounded-xl px-3 py-2 bg-white/80 border border-purple-100 text-[10px] font-semibold text-[#5e4294] shrink-0">
                💡 ${escapeHtml(ch.contextHint)}
              </div>
            `
        }
      </div>
    `.replace(
      '{LEVEL_BTNS}',
      (['largo', 'medio', 'fino'] as const)
        .map((lvl) => {
          const active = lesson.motorOverride === lvl;
          const label =
            lvl === 'largo' ? 'Largo' : lvl === 'medio' ? 'Médio' : 'Fino';
          return `
            <button
              type="button"
              data-wr-motor="${lvl}"
              class="px-2 py-0.5 rounded-full text-[10px] font-extrabold border transition active:scale-95 ${
                active
                  ? 'bg-[#6e45a5] text-white border-[#6e45a5]'
                  : 'bg-purple-50 text-[#5a3696] border-purple-200 hover:bg-purple-100'
              }"
            >
              ${label}
            </button>
          `;
        })
        .join('')
    );
  }

  private renderCelebrationHtml(celeb: WritingCelebrationState): string {
    return `
      <div class="flex items-center justify-between gap-1.5 mb-2 text-left shrink-0">
        <button id="btn-wr-celeb-trail" type="button" class="px-2.5 py-1 rounded-full bg-white/95 border border-purple-200 text-purple-800 font-extrabold text-[11px] shadow-sm active:scale-95 transition">← Trilha</button>
        <div class="flex items-center gap-1.5">
          ${this.renderSoundToggleButton('btn-wr-celeb-sound')}
          <button id="modal-close" type="button" class="w-7 h-7 rounded-full bg-white/95 border border-purple-200 text-purple-800 text-xs font-bold">✕</button>
        </div>
      </div>

      <div class="flex-1 min-h-0 flex flex-col items-center justify-center p-2 text-center">
        <div class="rounded-3xl p-5 bg-white/95 border-2 border-[#a882e3] shadow-lg max-w-sm w-full flex flex-col items-center gap-3">
          <div class="w-20 h-20">
            ${renderMiauSvg('affectionate', this.deps.getEquipped(), false)}
          </div>
          <div class="text-2xl text-amber-500 tracking-widest leading-none">
            ${'★'.repeat(celeb.stars)}${'☆'.repeat(3 - celeb.stars)}
          </div>
          <div class="space-y-1">
            <h3 class="font-display text-lg font-bold text-[#3b1f6e] leading-tight">
              ${escapeHtml(celeb.unitTitle)}
            </h3>
            <p class="text-xs font-semibold text-[#5e4294]">
              Sua coordenação motora fina está ficando incrível!
            </p>
          </div>
          <div class="flex items-center justify-center gap-2 w-full">
            <span class="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-extrabold">
              🪙 +${celeb.coinsEarned} moedas
            </span>
            <span class="px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-[#5a3696] text-xs font-extrabold">
              ✨ +${celeb.xpEarned} XP
            </span>
          </div>
          <div class="flex items-center gap-2 w-full pt-1">
            <button
              id="btn-wr-celeb-back"
              type="button"
              class="flex-1 py-2.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-[#4c2a85] font-extrabold text-xs active:scale-95 transition"
            >
              Ver Trilha
            </button>
            ${
              celeb.nextUnitId
                ? `<button
                     id="btn-wr-celeb-next"
                     type="button"
                     data-wr-next-unit="${celeb.nextUnitId}"
                     class="flex-1 py-2.5 rounded-xl bg-[#6e45a5] hover:bg-[#5c3691] text-white font-extrabold text-xs shadow-sm active:scale-95 transition"
                   >
                     Próxima Unidade ➜
                   </button>`
                : ''
            }
          </div>
        </div>
      </div>
    `;
  }

  public bind(root: HTMLElement): void {
    this.stopCanvasResources();

    // Trail bindings
    root
      .querySelector('#btn-wr-main-menu')
      ?.addEventListener('click', () => {
        this.resetToTrail();
        this.deps.onExitToMainMenu?.();
      });
    root.querySelector('#btn-wr-back')?.addEventListener('click', () => {
      this.resetToTrail();
      this.deps.onExitToLearnHub();
    });
    root
      .querySelector('#btn-wr-sound')
      ?.addEventListener('click', () => this.handleSoundToggle());
    root
      .querySelector('#btn-wr-free-mode')
      ?.addEventListener('click', () => {
        const progress = this.getProgress();
        progress.freeExploreUnlocked = !progress.freeExploreUnlocked;
        saveWritingProgress(progress);
        this.deps.onToast(
          progress.freeExploreUnlocked
            ? 'Todas as unidades de escrita liberadas!'
            : 'Modo progressivo restaurado.'
        );
        this.deps.onRequestRerender();
      });

    root.querySelectorAll('[data-wr-start-unit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const unitId = btn.getAttribute('data-wr-start-unit');
        if (unitId) this.startUnit(unitId);
      });
    });

    // Lesson bindings
    root
      .querySelector('#btn-wr-exit-lesson')
      ?.addEventListener('click', () => {
        this.resetToTrail();
        this.deps.onRequestRerender();
      });
    root
      .querySelector('#btn-wr-lesson-menu')
      ?.addEventListener('click', () => {
        this.resetToTrail();
        this.deps.onExitToMainMenu?.();
      });
    root
      .querySelector('#btn-wr-lesson-sound')
      ?.addEventListener('click', () => this.handleSoundToggle());
    root
      .querySelector('#btn-wr-ai-teach')
      ?.addEventListener('click', () => {
        void this.triggerAiTeach(true);
      });
    root
      .querySelector('#btn-wr-demo-anim')
      ?.addEventListener('click', () => {
        this.startStrokeDemoAnimation(true);
      });
    root.querySelector('#btn-wr-clear')?.addEventListener('click', () => {
      if (!this.lesson) return;
      this.lesson.userStrokes = [];
      this.lesson.activeStroke = null;
      this.lesson.lastEval = null;
      this.redrawCanvas();
      this.deps.onRequestRerender();
    });
    root.querySelector('#btn-wr-verify')?.addEventListener('click', () => {
      void this.verifyTrace();
    });
    root.querySelector('#btn-wr-next')?.addEventListener('click', () => {
      this.advanceLessonStep();
    });

    root.querySelectorAll('[data-wr-motor]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lvl = btn.getAttribute('data-wr-motor') as MotorDifficulty | null;
        if (!lvl || !this.lesson) return;
        this.lesson.motorOverride = lvl;
        this.lesson.lastEval = null;
        this.deps.onRequestRerender();
      });
    });

    // Celebration bindings
    root
      .querySelector('#btn-wr-celeb-trail')
      ?.addEventListener('click', () => {
        this.resetToTrail();
        this.deps.onRequestRerender();
      });
    root
      .querySelector('#btn-wr-celeb-back')
      ?.addEventListener('click', () => {
        this.resetToTrail();
        this.deps.onRequestRerender();
      });
    root
      .querySelector('#btn-wr-celeb-sound')
      ?.addEventListener('click', () => this.handleSoundToggle());
    root
      .querySelector('#btn-wr-celeb-next')
      ?.addEventListener('click', (e) => {
        const nextId = (e.currentTarget as HTMLElement).getAttribute(
          'data-wr-next-unit'
        );
        if (nextId) this.startUnit(nextId);
      });

    if (this.stage === 'lesson' && this.lesson) {
      this.mountCanvas(root);
    }
  }

  private handleSoundToggle(): void {
    const enabled = this.deps.onToggleSoundMute();
    if (!enabled) {
      writingAudioEngine.stop();
    }
    this.deps.onToast(enabled ? 'Som do Miau ativado!' : 'Modo silencioso ativado.');
    this.deps.onRequestRerender();
  }

  private startUnit(unitId: string): void {
    const unit = WRITING_UNITS.find((u) => u.id === unitId);
    if (!unit || unit.challenges.length === 0) return;

    writingAudioEngine.stop();
    const firstChallenge = unit.challenges[0];
    this.stage = 'lesson';
    this.lesson = {
      unit,
      cursor: 0,
      motorOverride: firstChallenge.motorLevel,
      userStrokes: [],
      activeStroke: null,
      coachTip: firstChallenge.teachScript,
      coachMood: 'playful',
      isAiTeaching: false,
      isEvaluating: false,
      isDemoAnimating: false,
      lastEval: null,
      stepSolved: false,
      stepStars: [],
    };
    this.deps.onRequestRerender();

    // Auto-start AI explanation + animated stroke demonstration when step begins
    window.setTimeout(() => {
      if (this.stage === 'lesson' && this.lesson?.unit.id === unitId) {
        this.startStrokeDemoAnimation(false);
        void this.triggerAiTeach(false);
      }
    }, 180);
  }

  private advanceLessonStep(): void {
    if (!this.lesson) return;
    const nextIdx = this.lesson.cursor + 1;
    if (nextIdx >= this.lesson.unit.challenges.length) {
      this.finishUnit();
      return;
    }

    const nextCh = this.lesson.unit.challenges[nextIdx];
    this.lesson.cursor = nextIdx;
    this.lesson.motorOverride = nextCh.motorLevel;
    this.lesson.userStrokes = [];
    this.lesson.activeStroke = null;
    this.lesson.lastEval = null;
    this.lesson.stepSolved = false;
    this.lesson.coachTip = nextCh.teachScript;
    this.lesson.coachMood = 'playful';
    this.deps.onRequestRerender();

    window.setTimeout(() => {
      if (this.stage === 'lesson' && this.lesson?.cursor === nextIdx) {
        this.startStrokeDemoAnimation(false);
        void this.triggerAiTeach(false);
      }
    }, 180);
  }

  private finishUnit(): void {
    if (!this.lesson) return;
    this.stopCanvasResources();
    const unit = this.lesson.unit;
    const avgStars =
      this.lesson.stepStars.length > 0
        ? Math.round(
            this.lesson.stepStars.reduce((a, b) => a + b, 0) /
              this.lesson.stepStars.length
          )
        : 2;
    const stars = Math.max(1, Math.min(3, avgStars));

    const prev = this.getProgress();
    completeWritingUnit(prev, unit.id, stars);

    this.deps.onGrantRewards(unit.coinReward, unit.xpReward);
    soundService.playCoin();
    hapticService.levelUp();

    const idx = WRITING_UNITS.findIndex((u) => u.id === unit.id);
    const nextUnit =
      idx >= 0 && idx + 1 < WRITING_UNITS.length ? WRITING_UNITS[idx + 1] : null;

    this.stage = 'celebration';
    this.celebration = {
      unitTitle: unit.title,
      stars,
      coinsEarned: unit.coinReward,
      xpEarned: unit.xpReward,
      nextUnitId: nextUnit?.id ?? null,
    };
    this.lesson = null;
    this.deps.onRequestRerender();

    void writingAudioEngine.speak(
      `Miau! Parabéns! Você completou ${unit.title} e ganhou ${unit.coinReward} moedas!`,
      { slow: false }
    );
  }

  private async triggerAiTeach(forceSpeech: boolean): Promise<void> {
    if (!this.lesson) return;
    const ch = this.lesson.unit.challenges[this.lesson.cursor];
    const cacheKey = `${ch.id}:${this.lesson.motorOverride}`;
    const firstName =
      this.deps.getHumanProfile().fullName.trim().split(/\s+/)[0] ||
      'pequeno(a)';

    const cached = this.teachCache.get(cacheKey);
    if (cached) {
      this.lesson.coachTip = cached.coachTip;
      this.lesson.coachMood = 'happy';
      const tipEl = document.getElementById('wr-coach-tip');
      if (tipEl) {
        tipEl.textContent = cached.coachTip;
      } else {
        this.deps.onRequestRerender();
      }
      if (forceSpeech || this.deps.isSoundEnabled()) {
        void writingAudioEngine.speak(cached.audioScript, { slow: true });
      }
      return;
    }

    this.lesson.isAiTeaching = true;
    const teachBtnLoading = document.getElementById('btn-wr-ai-teach') as HTMLButtonElement | null;
    if (teachBtnLoading) {
      teachBtnLoading.disabled = true;
      teachBtnLoading.textContent = '🐾 Pensando...';
    }

    let coachTip = ch.teachScript;
    let audioScript = ch.teachScript;

    try {
      const aiRes = await requestWritingTeach({
        targetText: ch.targetText,
        studentName: firstName,
        motorLevel: this.lesson.motorOverride,
        strokeHints: buildStrokeCueSummary(ch.targetText),
      });
      if (aiRes.coachTip) coachTip = aiRes.coachTip;
      if (aiRes.audioScript) audioScript = aiRes.audioScript;
      this.teachCache.set(cacheKey, { coachTip, audioScript });
    } catch {
      // Seamless local fallback if AI endpoint unavailable
      this.teachCache.set(cacheKey, { coachTip, audioScript });
    }

    if (!this.lesson || this.lesson.unit.challenges[this.lesson.cursor]?.id !== ch.id) {
      return;
    }
    this.lesson.isAiTeaching = false;
    this.lesson.coachTip = coachTip;
    this.lesson.coachMood = 'happy';

    const tipEl = document.getElementById('wr-coach-tip');
    const teachBtnDone = document.getElementById('btn-wr-ai-teach') as HTMLButtonElement | null;
    if (tipEl) {
      tipEl.textContent = coachTip;
    }
    if (teachBtnDone) {
      teachBtnDone.disabled = false;
      teachBtnDone.textContent = '🤖 IA Ensinar';
    }
    if (!tipEl) {
      this.deps.onRequestRerender();
    }

    if (this.deps.isSoundEnabled()) {
      void writingAudioEngine.speak(audioScript, { slow: true });
    }
  }

  private mountCanvas(root: HTMLElement): void {
    const wrap = root.querySelector('#wr-canvas-wrap') as HTMLElement | null;
    const canvas = root.querySelector('#wr-canvas') as HTMLCanvasElement | null;
    if (!wrap || !canvas) return;

    this.canvasEl = canvas;

    const syncSize = () => {
      if (!this.canvasEl || !this.lesson) return;
      const rect = wrap.getBoundingClientRect();
      const cssW = Math.max(220, Math.round(rect.width));
      const cssH = Math.max(180, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      this.canvasCssWidth = cssW;
      this.canvasCssHeight = cssH;
      this.canvasEl.width = Math.round(cssW * dpr);
      this.canvasEl.height = Math.round(cssH * dpr);

      const ch = this.lesson.unit.challenges[this.lesson.cursor];
      this.currentLayout = layoutTargetStrokes(ch.targetText, cssW, cssH);
      this.redrawCanvas();
    };

    syncSize();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => syncSize());
      this.resizeObserver.observe(wrap);
    }

    const getCanvasPoint = (e: PointerEvent): CanvasPoint => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    canvas.addEventListener('pointerdown', (e: PointerEvent) => {
      if (!this.lesson || this.lesson.isEvaluating) return;
      e.preventDefault();
      if (this.lesson.isDemoAnimating) {
        this.lesson.isDemoAnimating = false;
        if (this.demoRafId !== null) {
          window.cancelAnimationFrame(this.demoRafId);
          this.demoRafId = null;
        }
      }
      canvas.setPointerCapture?.(e.pointerId);
      const pt = getCanvasPoint(e);
      this.lesson.activeStroke = [pt];
      this.lesson.userStrokes.push(this.lesson.activeStroke);
      this.redrawCanvas();
    });

    canvas.addEventListener('pointermove', (e: PointerEvent) => {
      if (!this.lesson || !this.lesson.activeStroke) return;
      e.preventDefault();
      const pt = getCanvasPoint(e);
      const stroke = this.lesson.activeStroke;
      const last = stroke[stroke.length - 1];
      if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) >= 2.2) {
        stroke.push(pt);
        this.redrawCanvas();
      }
    });

    const endStroke = (e: PointerEvent) => {
      if (!this.lesson || !this.lesson.activeStroke) return;
      e.preventDefault();
      this.lesson.activeStroke = null;
      if (canvas.hasPointerCapture?.(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
      this.redrawCanvas();
    };

    canvas.addEventListener('pointerup', endStroke);
    canvas.addEventListener('pointercancel', endStroke);
  }

  private startStrokeDemoAnimation(withVoice: boolean): void {
    if (!this.lesson) return;
    if (this.demoRafId !== null) {
      window.cancelAnimationFrame(this.demoRafId);
      this.demoRafId = null;
    }

    const ch = this.lesson.unit.challenges[this.lesson.cursor];
    if (withVoice && this.deps.isSoundEnabled()) {
      void writingAudioEngine.speak(ch.teachScript, { slow: true });
    }

    this.lesson.isDemoAnimating = true;
    this.demoProgress = 0;
    const strokeCount = Math.max(1, this.currentLayout?.strokes.length ?? 1);
    const totalDurationMs = Math.min(4800, strokeCount * 1150 + 400);
    const startTs = performance.now();

    const tick = (now: number) => {
      if (!this.lesson || !this.lesson.isDemoAnimating) {
        this.demoRafId = null;
        return;
      }
      const elapsed = now - startTs;
      this.demoProgress = Math.min(1, elapsed / totalDurationMs);
      this.redrawCanvas();

      if (this.demoProgress < 1) {
        this.demoRafId = window.requestAnimationFrame(tick);
      } else {
        this.demoRafId = null;
        this.lesson.isDemoAnimating = false;
        this.redrawCanvas();
        const btn = document.getElementById('btn-wr-demo-anim');
        if (btn) btn.textContent = '🎬 Ver Traçado';
      }
    };

    const btn = document.getElementById('btn-wr-demo-anim');
    if (btn) btn.textContent = '✨ Mostrando...';
    this.demoRafId = window.requestAnimationFrame(tick);
  }

  private redrawCanvas(): void {
    const canvas = this.canvasEl;
    const lesson = this.lesson;
    if (!canvas || !lesson) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = this.canvasCssWidth;
    const h = this.canvasCssHeight;
    const dpr = canvas.width / Math.max(1, w);

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // 1. Notebook ruled guidelines (top, dashed center, baseline)
    const topLine = h * 0.14;
    const midLine = h * 0.5;
    const baseLine = h * 0.86;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.18)';
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(16, topLine);
    ctx.lineTo(w - 16, topLine);
    ctx.moveTo(16, baseLine);
    ctx.lineTo(w - 16, baseLine);
    ctx.stroke();

    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.22)';
    ctx.beginPath();
    ctx.moveTo(16, midLine);
    ctx.lineTo(w - 16, midLine);
    ctx.stroke();
    ctx.setLineDash([]);

    const layout =
      this.currentLayout ||
      layoutTargetStrokes(
        lesson.unit.challenges[lesson.cursor].targetText,
        w,
        h
      );
    const widths = getMotorGuideWidths(lesson.motorOverride, layout.minCanvasDim);

    // 2. Soft pastel corridor + dashed inner guide
    for (const st of layout.strokes) {
      if (st.points.length < 2) continue;

      // Soft ribbon corridor
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = widths.corridorWidth;
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.14)';
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(st.points[0].x, st.points[0].y);
      for (let i = 1; i < st.points.length; i++) {
        ctx.lineTo(st.points[i].x, st.points[i].y);
      }
      ctx.stroke();

      // Dotted center guide
      ctx.lineWidth = widths.dashWidth;
      ctx.strokeStyle = 'rgba(109, 40, 217, 0.42)';
      ctx.setLineDash([7, 8]);
      ctx.beginPath();
      ctx.moveTo(st.points[0].x, st.points[0].y);
      for (let i = 1; i < st.points.length; i++) {
        ctx.lineTo(st.points[i].x, st.points[i].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 3. Numbered start anchors on each stroke
    for (const st of layout.strokes) {
      const start = st.points[0];
      if (!start) continue;
      ctx.fillStyle = '#7c3aed';
      ctx.beginPath();
      ctx.arc(start.x, start.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(st.orderIndex), start.x, start.y + 0.5);
    }

    // 4. Animated Miau teaching demonstration overlay
    if (lesson.isDemoAnimating && layout.strokes.length > 0) {
      const totalStrokes = layout.strokes.length;
      const scaled = this.demoProgress * totalStrokes;
      const currentStrokeIdx = Math.min(totalStrokes - 1, Math.floor(scaled));
      const localT = scaled - currentStrokeIdx;

      for (let sIdx = 0; sIdx <= currentStrokeIdx; sIdx++) {
        const st = layout.strokes[sIdx];
        const samples = resamplePolyline(st.points, 4);
        if (samples.length < 2) continue;
        const limitIdx =
          sIdx < currentStrokeIdx
            ? samples.length - 1
            : Math.max(1, Math.floor(localT * (samples.length - 1)));

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = widths.inkWidth * 0.9;
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.65)';
        ctx.beginPath();
        ctx.moveTo(samples[0].x, samples[0].y);
        for (let p = 1; p <= limitIdx; p++) {
          ctx.lineTo(samples[p].x, samples[p].y);
        }
        ctx.stroke();

        if (sIdx === currentStrokeIdx) {
          const tip = samples[limitIdx];
          ctx.fillStyle = '#ec4899';
          ctx.beginPath();
          ctx.arc(tip.x, tip.y, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.font = '13px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🐾', tip.x, tip.y - 16);
        }
      }
    }

    // 5. Child's finger ink strokes (smooth quadratic curves)
    const inkGrad = ctx.createLinearGradient(0, 0, w, h);
    inkGrad.addColorStop(0, '#6d28d9');
    inkGrad.addColorStop(0.55, '#a855f7');
    inkGrad.addColorStop(1, '#ec4899');

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = widths.inkWidth;
    ctx.strokeStyle = inkGrad;
    ctx.shadowColor = 'rgba(168, 85, 247, 0.32)';
    ctx.shadowBlur = 4;

    for (const stroke of lesson.userStrokes) {
      if (stroke.length === 0) continue;
      if (stroke.length === 1) {
        ctx.fillStyle = '#7c3aed';
        ctx.beginPath();
        ctx.arc(stroke[0].x, stroke[0].y, widths.inkWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length - 1; i++) {
        const midX = (stroke[i].x + stroke[i + 1].x) / 2;
        const midY = (stroke[i].y + stroke[i + 1].y) / 2;
        ctx.quadraticCurveTo(stroke[i].x, stroke[i].y, midX, midY);
      }
      const last = stroke[stroke.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    }

    ctx.restore();
  }

  private async verifyTrace(): Promise<void> {
    if (!this.lesson || this.lesson.isEvaluating) return;
    const ch = this.lesson.unit.challenges[this.lesson.cursor];
    const layout =
      this.currentLayout ||
      layoutTargetStrokes(ch.targetText, this.canvasCssWidth, this.canvasCssHeight);

    const geom = evaluateHandwritingTrace(
      this.lesson.userStrokes,
      layout,
      ch.targetText,
      this.lesson.motorOverride
    );

    if (this.lesson.userStrokes.length === 0 || geom.coveragePct === 0) {
      this.lesson.lastEval = {
        verdict: geom.verdict,
        stars: geom.stars,
        coveragePct: geom.coveragePct,
        precisionPct: geom.precisionPct,
        feedbackText: geom.feedbackText,
      };
      this.lesson.coachMood = 'playful';
      this.deps.onRequestRerender();
      if (this.deps.isSoundEnabled()) {
        void writingAudioEngine.speak(geom.audioScript, { slow: false });
      }
      return;
    }

    this.lesson.isEvaluating = true;
    this.deps.onRequestRerender();

    let verdict = geom.verdict;
    let stars = geom.stars;
    let feedbackText = geom.feedbackText;
    let audioScript = geom.audioScript;

    // Ask Gemini Vision to analyze the actual finger-traced canvas alongside geometric score
    if (this.canvasEl) {
      try {
        const snapshotDataUrl = this.canvasEl.toDataURL('image/png');
        const firstName =
          this.deps.getHumanProfile().fullName.trim().split(/\s+/)[0] ||
          'pequeno(a)';
        const aiEval = await requestWritingEvaluation({
          targetText: ch.targetText,
          studentName: firstName,
          motorLevel: this.lesson.motorOverride,
          imageBase64: snapshotDataUrl,
          mimeType: 'image/png',
          coveragePct: geom.coveragePct,
          precisionPct: geom.precisionPct,
          strokeCount: this.lesson.userStrokes.length,
        });

        // Trust strong geometric guard against empty scribbles while embracing AI coaching
        if (geom.coveragePct < 30) {
          verdict = 'retry';
          stars = 0;
        } else {
          verdict = aiEval.verdict;
          stars = aiEval.stars;
        }
        if (aiEval.feedbackText) feedbackText = aiEval.feedbackText;
        if (aiEval.audioScript) audioScript = aiEval.audioScript;
      } catch {
        // Fallback smoothly to geometric evaluation
      }
    }

    if (!this.lesson || this.lesson.unit.challenges[this.lesson.cursor]?.id !== ch.id) {
      return;
    }

    this.lesson.isEvaluating = false;
    this.lesson.lastEval = {
      verdict,
      stars,
      coveragePct: geom.coveragePct,
      precisionPct: geom.precisionPct,
      feedbackText,
    };

    if (verdict === 'positive') {
      this.lesson.stepSolved = true;
      this.lesson.stepStars[this.lesson.cursor] = Math.max(1, stars);
      this.lesson.coachMood = 'affectionate';
      recordWritingStepSolved(this.getProgress(), ch);
      this.deps.onGrantRewards(8, 10);
      soundService.playCoin();
      hapticService.tap();
    } else if (verdict === 'medium') {
      this.lesson.stepSolved = true;
      this.lesson.stepStars[this.lesson.cursor] = Math.max(1, stars);
      this.lesson.coachMood = 'happy';
      recordWritingStepSolved(this.getProgress(), ch);
      this.deps.onGrantRewards(4, 6);
      soundService.playBubble();
    } else {
      this.lesson.coachMood = 'playful';
      soundService.playBubble();
    }

    this.deps.onRequestRerender();
    if (this.deps.isSoundEnabled()) {
      void writingAudioEngine.speak(audioScript, { slow: false });
    }
  }
}
