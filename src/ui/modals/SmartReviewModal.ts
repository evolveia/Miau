import { renderMiauSvg } from '../MiauIllustration';
import { phonicsAudioEngine } from '../../modules/learning/phonicsEngine';
import { hapticService } from '../../services/hapticService';
import type { SmartReviewQuestion, SmartReviewSession } from '../../services/smartReviewService';
import { soundService } from '../../services/soundService';
import type { EquippedItems } from '../../types';
import { escapeHtml } from '../../utils/html';

export interface SmartReviewModalState {
  session: SmartReviewSession;
  cursor: number;
  selectedOptionId: string | null;
  stepSolved: boolean;
  hadWrongOnCurrent: boolean;
  firstTryCorrectCount: number;
  feedbackText: string;
  feedbackKind: 'idle' | 'hint' | 'praise';
  finished: boolean;
  coinsEarned: number;
  xpEarned: number;
  isFirstCompletionToday: boolean;
}

export function createInitialSmartReviewState(
  session: SmartReviewSession
): SmartReviewModalState {
  return {
    session,
    cursor: 0,
    selectedOptionId: null,
    stepSolved: false,
    hadWrongOnCurrent: false,
    firstTryCorrectCount: 0,
    feedbackText: '',
    feedbackKind: 'idle',
    finished: false,
    coinsEarned: 0,
    xpEarned: 0,
    isFirstCompletionToday: !session.completedToday,
  };
}

export function renderSmartReviewModalHtml(params: {
  state: SmartReviewModalState;
  equipped: EquippedItems;
  petName: string;
}): string {
  const { state, equipped, petName } = params;
  const { session } = state;

  if (session.questions.length === 0) {
    return `
      <div class="flex items-center justify-between gap-2 mb-3 shrink-0">
        <button id="btn-sr-back" type="button" class="min-h-[40px] px-3.5 py-2 rounded-full bg-white/95 border border-purple-200 text-purple-800 font-extrabold text-xs shadow-xs hover:bg-purple-50 transition">← Voltar</button>
        <button id="modal-close" type="button" class="w-10 h-10 rounded-full bg-white/95 border border-purple-200 text-purple-800 font-bold text-sm shadow-xs">✕</button>
      </div>
      <div class="flex-1 flex flex-col items-center justify-center text-center gap-3 p-4">
        <div class="text-5xl">🧠</div>
        <h2 class="font-display text-xl font-bold text-[#3b1f6e]">Treino do Dia pronto em breve!</h2>
        <p class="text-sm font-semibold text-[#6b4d9e] max-w-sm">Comece qualquer unidade educativa para o ${escapeHtml(petName)} montar seu treino personalizado.</p>
      </div>
    `;
  }

  if (state.finished) {
    const total = session.questions.length;
    const pct = total > 0 ? Math.round((state.firstTryCorrectCount / total) * 100) : 100;
    return `
      <div class="flex items-center justify-between gap-2 mb-3 shrink-0">
        <button id="btn-sr-back" type="button" class="min-h-[40px] px-3.5 py-2 rounded-full bg-white/95 border border-purple-200 text-purple-800 font-extrabold text-xs shadow-xs hover:bg-purple-50 transition">← Voltar</button>
        <button id="modal-close" type="button" class="w-10 h-10 rounded-full bg-white/95 border border-purple-200 text-purple-800 font-bold text-sm shadow-xs">✕</button>
      </div>

      <div class="flex-1 min-h-0 flex flex-col items-center justify-center p-2 text-center">
        <div class="rounded-3xl p-5 sm:p-6 bg-white/95 border-2 border-[#a882e3] shadow-lg max-w-md w-full flex flex-col items-center gap-3.5">
          <div class="w-24 h-24">
            ${renderMiauSvg('affectionate', equipped, false, 'celebrating')}
          </div>
          <div>
            <span class="inline-block text-[11px] font-extrabold uppercase tracking-wide px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 mb-1.5">
              🧠 Revisão Inteligente Concluída
            </span>
            <h2 class="font-display text-2xl font-bold text-[#3b1f6e] leading-tight">
              Parabéns! Memória em dia!
            </h2>
            <p class="text-xs sm:text-sm font-semibold text-[#6b4d9e] mt-1">
              Você acertou ${state.firstTryCorrectCount} de ${total} desafios de primeira (${pct}%).
            </p>
          </div>

          <div class="grid grid-cols-2 gap-2.5 w-full">
            <div class="rounded-2xl p-3 bg-amber-50 border border-amber-200">
              <div class="font-display text-xl font-bold text-amber-700">+${state.coinsEarned} 🪙</div>
              <div class="text-[10px] font-extrabold uppercase text-amber-800">
                ${state.isFirstCompletionToday ? 'Bônus Diário' : 'Bônus Extra'}
              </div>
            </div>
            <div class="rounded-2xl p-3 bg-purple-50 border border-purple-200">
              <div class="font-display text-xl font-bold text-[#5a3696]">+${state.xpEarned} ✨</div>
              <div class="text-[10px] font-extrabold uppercase text-[#6b4d9e]">XP Ganho</div>
            </div>
          </div>

          <div class="flex gap-2.5 w-full pt-1">
            <button
              id="btn-sr-replay"
              type="button"
              class="flex-1 min-h-[44px] py-2.5 rounded-2xl bg-purple-100 hover:bg-purple-200 text-[#4c2a85] font-extrabold text-xs sm:text-sm transition"
            >
              🔁 Novo Treino
            </button>
            <button
              id="btn-sr-finish-back"
              type="button"
              class="flex-1 min-h-[44px] py-2.5 rounded-2xl bg-[#6e45a5] hover:bg-[#5c3691] text-white font-extrabold text-xs sm:text-sm shadow-sm transition"
            >
              ✓ Concluir
            </button>
          </div>
        </div>
      </div>
    `;
  }

  const q: SmartReviewQuestion = session.questions[state.cursor];
  const total = session.questions.length;
  const pct = Math.round(((state.cursor + (state.stepSolved ? 1 : 0)) / total) * 100);

  return `
    <div class="flex items-center justify-between gap-2 mb-2.5 shrink-0 text-left">
      <div class="flex items-center gap-2 min-w-0">
        <button id="btn-sr-back" type="button" class="min-h-[38px] px-3 py-1.5 rounded-full bg-white/95 border border-purple-200 text-purple-800 font-extrabold text-xs shadow-xs hover:bg-purple-50 transition shrink-0">← Voltar</button>
        <div class="min-w-0">
          <h2 class="font-display text-lg sm:text-xl font-bold text-[#3b1f6e] leading-tight truncate">🧠 Treino do Dia com ${escapeHtml(petName)}</h2>
          <p class="text-[11px] font-semibold text-[#6b4d9e] truncate">${escapeHtml(session.summaryReason)}</p>
        </div>
      </div>
      <button id="modal-close" type="button" class="w-9 h-9 rounded-full bg-white/95 border border-purple-200 text-purple-800 font-bold text-sm shadow-xs shrink-0">✕</button>
    </div>

    <!-- Progress Bar -->
    <div class="mb-3 shrink-0">
      <div class="flex items-center justify-between text-[11px] font-extrabold text-[#4c2a85] mb-1">
        <span>Desafio ${state.cursor + 1} de ${total}</span>
        <span>${q.trackEmoji} ${escapeHtml(q.trackTitle)}</span>
      </div>
      <div class="w-full h-2.5 rounded-full bg-white/85 border border-purple-200 overflow-hidden">
        <div class="h-full rounded-full bg-gradient-to-r from-[#7b52b8] via-[#ec4899] to-[#f59e0b] transition-all duration-300" style="width:${Math.max(10, pct)}%"></div>
      </div>
    </div>

    <div class="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto miau-scroll pr-0.5 text-left">
      <!-- Prompt Card -->
      <div class="rounded-2xl p-3.5 sm:p-4 bg-white/95 border border-purple-200 shadow-sm flex flex-col gap-2.5 shrink-0">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900">
              ${escapeHtml(q.reasonLabel)}
            </span>
            <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-[#5a3696]">
              ${escapeHtml(q.unitTitle)}
            </span>
          </div>
          <button
            id="btn-sr-listen"
            type="button"
            class="min-h-[36px] px-3 py-1.5 rounded-full bg-[#6e45a5] hover:bg-[#5c3691] text-white font-extrabold text-xs shadow-xs active:scale-95 transition"
          >
            🔊 Ouvir
          </button>
        </div>

        <div class="flex items-center gap-3">
          <div class="w-16 h-16 shrink-0">
            ${renderMiauSvg(state.stepSolved ? 'affectionate' : 'happy', equipped, false)}
          </div>
          <div class="flex-1 min-w-0 rounded-2xl px-3.5 py-2.5 bg-purple-50 border border-purple-100">
            <p class="font-display text-sm sm:text-base font-bold text-[#3b1f6e] leading-snug">
              ${escapeHtml(q.instruction)}
            </p>
          </div>
        </div>
      </div>

      <!-- Visual + Options -->
      <div class="rounded-3xl p-4 bg-white/95 border border-purple-100 shadow-sm flex-1 flex flex-col justify-center gap-3">
        ${
          q.visualAssetUrl
            ? `<div class="flex justify-center">
                 <img src="${q.visualAssetUrl}" alt="${escapeHtml(q.unitTitle)}" class="w-28 h-24 sm:w-36 sm:h-28 rounded-2xl bg-purple-50/70 border border-purple-100 object-contain shadow-xs p-1" />
               </div>`
            : ''
        }
        <div class="grid ${q.options.length === 4 ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'} gap-2.5">
          ${q.options
            .map((opt) => {
              const isSelected = state.selectedOptionId === opt.id;
              const isRight = state.stepSolved && opt.id === q.correctOptionId;
              const isWrong = isSelected && !state.stepSolved && opt.id !== q.correctOptionId;
              return `
                <button
                  type="button"
                  data-sr-option="${escapeHtml(opt.id)}"
                  ${state.stepSolved ? 'disabled' : ''}
                  class="min-h-[64px] rounded-2xl border-2 px-4 py-3 flex items-center justify-center gap-2.5 font-display text-sm sm:text-base font-bold transition active:scale-95 ${
                    isRight
                      ? 'bg-emerald-100 border-emerald-500 text-emerald-950 ring-2 ring-emerald-200 shadow-sm'
                      : isWrong
                        ? 'bg-rose-50 border-rose-300 text-rose-900'
                        : 'bg-purple-50/80 border-purple-200 text-[#3b1f6e] hover:border-[#6e45a5] hover:bg-purple-100/70'
                  }"
                >
                  ${opt.emoji ? `<span class="text-2xl leading-none shrink-0">${opt.emoji}</span>` : ''}
                  <span>${escapeHtml(opt.label)}</span>
                </button>
              `;
            })
            .join('')}
        </div>
      </div>

      <!-- Feedback Banner -->
      ${
        state.feedbackKind !== 'idle'
          ? `
            <div class="rounded-2xl p-3 border shadow-sm flex items-center justify-between gap-2.5 flex-wrap shrink-0 ${
              state.feedbackKind === 'praise'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-amber-50 border-amber-300 text-amber-950'
            }">
              <div class="flex items-center gap-2 flex-1 min-w-0">
                <span class="text-xl shrink-0">${state.feedbackKind === 'praise' ? '🌟' : '💡'}</span>
                <p class="text-xs sm:text-sm font-bold leading-snug">${escapeHtml(state.feedbackText)}</p>
              </div>
              ${
                state.stepSolved
                  ? `<button
                       id="btn-sr-next"
                       type="button"
                       class="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm shadow-xs transition shrink-0"
                     >
                       ${state.cursor + 1 >= total ? 'Finalizar 🏆' : 'Próximo →'}
                     </button>`
                  : ''
              }
            </div>
          `
          : ''
      }
    </div>
  `;
}

export function bindSmartReviewModalEvents(
  root: HTMLElement,
  state: SmartReviewModalState,
  callbacks: {
    onBack: () => void;
    onRerender: () => void;
    onCompleteSession: (score: number, total: number) => {
      isFirstCompletionToday: boolean;
      coinsReward: number;
      xpReward: number;
    };
    onRestartSession: () => void;
  }
): void {
  root.querySelector('#btn-sr-back')?.addEventListener('click', () => {
    phonicsAudioEngine.stop();
    callbacks.onBack();
  });
  root.querySelector('#btn-sr-finish-back')?.addEventListener('click', () => {
    phonicsAudioEngine.stop();
    callbacks.onBack();
  });
  root.querySelector('#btn-sr-replay')?.addEventListener('click', () => {
    phonicsAudioEngine.stop();
    callbacks.onRestartSession();
  });

  if (state.finished || state.session.questions.length === 0) return;

  const q = state.session.questions[state.cursor];

  root.querySelector('#btn-sr-listen')?.addEventListener('click', () => {
    soundService.unlockAudio();
    hapticService.tap();
    void phonicsAudioEngine.speak(q.audioText, { slow: false });
  });

  root.querySelectorAll('[data-sr-option]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.stepSolved) return;
      const optId = btn.getAttribute('data-sr-option');
      if (!optId) return;
      state.selectedOptionId = optId;
      soundService.unlockAudio();

      if (optId === q.correctOptionId) {
        state.stepSolved = true;
        if (!state.hadWrongOnCurrent) {
          state.firstTryCorrectCount += 1;
        }
        state.feedbackKind = 'praise';
        state.feedbackText = q.praiseText;
        hapticService.coin();
        phonicsAudioEngine.playSuccessFeedback();
        callbacks.onRerender();
        void phonicsAudioEngine.speak(q.praiseText, { slow: false });
      } else {
        state.hadWrongOnCurrent = true;
        state.feedbackKind = 'hint';
        state.feedbackText = q.hintText;
        hapticService.warning();
        phonicsAudioEngine.playGentleHintFeedback();
        callbacks.onRerender();
      }
    });
  });

  root.querySelector('#btn-sr-next')?.addEventListener('click', () => {
    phonicsAudioEngine.stop();
    if (state.cursor + 1 < state.session.questions.length) {
      state.cursor += 1;
      state.selectedOptionId = null;
      state.stepSolved = false;
      state.hadWrongOnCurrent = false;
      state.feedbackText = '';
      state.feedbackKind = 'idle';
      callbacks.onRerender();
    } else {
      const result = callbacks.onCompleteSession(
        state.firstTryCorrectCount,
        state.session.questions.length
      );
      state.finished = true;
      state.coinsEarned = result.coinsReward;
      state.xpEarned = result.xpReward;
      state.isFirstCompletionToday = result.isFirstCompletionToday;
      hapticService.achievement();
      soundService.playCoin();
      callbacks.onRerender();
    }
  });
}
