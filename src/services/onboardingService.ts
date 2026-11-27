import { escapeHtml } from '../utils/html';

const ONBOARDING_STORAGE_PREFIX = 'miau_onboarding_v1_';

export type OnboardingStep = 1 | 2 | 3;

const memoryCompleted = new Set<string>();

export function hasCompletedOnboarding(ownerId: string): boolean {
  const cleanId = ownerId || 'guest';
  if (memoryCompleted.has(cleanId)) return true;
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(`${ONBOARDING_STORAGE_PREFIX}${cleanId}`) === 'done';
  } catch {
    return false;
  }
}

export function markOnboardingCompleted(ownerId: string): void {
  const cleanId = ownerId || 'guest';
  memoryCompleted.add(cleanId);
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(`${ONBOARDING_STORAGE_PREFIX}${cleanId}`, 'done');
  } catch {
    // Ignore storage quota errors
  }
}

export function resetOnboarding(ownerId: string): void {
  const cleanId = ownerId || 'guest';
  memoryCompleted.delete(cleanId);
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(`${ONBOARDING_STORAGE_PREFIX}${cleanId}`);
  } catch {
    // Ignore storage errors
  }
}

export function renderOnboardingOverlayHtml(params: {
  step: OnboardingStep;
  petName: string;
  step2ActionDone: boolean;
  isNight: boolean;
}): string {
  const cleanName = (params.petName || 'Miau').trim() || 'Miau';
  const cardBg = params.isNight
    ? 'bg-[#211844]/95 border-purple-400/50 text-white'
    : 'bg-white/95 border-purple-200 text-[#2d1b4e]';
  const mutedText = params.isNight ? 'text-purple-200' : 'text-[#5b468f]';

  let stepBody = '';
  if (params.step === 1) {
    stepBody = `
      <div class="text-center mb-3">
        <div class="text-4xl mb-1">🐾</div>
        <h3 class="font-display text-xl font-bold leading-tight">Escolha o nome do seu bichinho!</h3>
        <p class="text-xs font-semibold ${mutedText} mt-1">
          Esse nome vai aparecer no topo da sala e nas conversas com você.
        </p>
      </div>
      <form id="onboarding-name-form" class="flex flex-col gap-2.5">
        <input
          id="onboarding-pet-name-input"
          type="text"
          maxlength="32"
          value="${escapeHtml(cleanName)}"
          placeholder="Ex: Miau, Pipoca, Mingau..."
          aria-label="Nome do seu bichinho"
          class="w-full rounded-2xl px-4 py-3 text-base font-extrabold border-2 ${
            params.isNight
              ? 'bg-[#171033] border-purple-400 text-white placeholder-purple-300'
              : 'bg-purple-50 border-purple-200 text-[#3b1f6e]'
          } focus:outline-none focus:border-[#7b52b8]"
        />
        <button
          id="btn-onboarding-save-name"
          type="submit"
          class="min-h-[48px] w-full rounded-2xl bg-gradient-to-r from-[#6e45a5] to-[#9b5de5] text-white font-display font-bold text-base shadow-md hover:brightness-110 active:scale-95 transition"
        >
          Salvar Nome e Continuar →
        </button>
      </form>
    `;
  } else if (params.step === 2) {
    stepBody = `
      <div class="text-center mb-3">
        <div class="text-4xl mb-1">${params.step2ActionDone ? '🥰' : '🐟'}</div>
        <h3 class="font-display text-xl font-bold leading-tight">Cuide de ${escapeHtml(cleanName)}!</h3>
        <p class="text-xs font-semibold ${mutedText} mt-1">
          Experimente fazer um carinho ou dar um petisco gostoso agora mesmo.
        </p>
      </div>
      <div class="grid grid-cols-2 gap-2.5 mb-3">
        <button
          id="btn-onboarding-pet"
          type="button"
          class="min-h-[60px] rounded-2xl p-2.5 bg-gradient-to-br from-pink-500 to-rose-500 text-white font-extrabold text-sm shadow-md active:scale-95 transition flex flex-col items-center justify-center gap-0.5"
        >
          <span class="text-xl">💖</span>
          <span>Fazer Carinho</span>
        </button>
        <button
          id="btn-onboarding-treat"
          type="button"
          class="min-h-[60px] rounded-2xl p-2.5 bg-gradient-to-br from-amber-400 to-orange-500 text-white font-extrabold text-sm shadow-md active:scale-95 transition flex flex-col items-center justify-center gap-0.5"
        >
          <span class="text-xl">🐟</span>
          <span>Dar Petisco</span>
        </button>
      </div>
      ${
        params.step2ActionDone
          ? `<div class="mb-2.5 rounded-xl px-3 py-2 text-xs font-extrabold text-center ${
              params.isNight
                ? 'bg-emerald-900/60 text-emerald-200 border border-emerald-500/40'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            }">✨ Que legal! ${escapeHtml(cleanName)} adorou seu cuidado!</div>`
          : ''
      }
      <button
        id="btn-onboarding-next-2"
        type="button"
        class="min-h-[46px] w-full rounded-2xl bg-[#6e45a5] text-white font-display font-bold text-base shadow-md hover:brightness-110 active:scale-95 transition"
      >
        Próximo Passo →
      </button>
    `;
  } else {
    stepBody = `
      <div class="text-center mb-3">
        <div class="text-4xl mb-1">🎓</div>
        <h3 class="font-display text-xl font-bold leading-tight">Conheça o "Vamos Aprender"!</h3>
        <p class="text-xs font-semibold ${mutedText} mt-1">
          Complete lições de letras, números, pintura e sons para ganhar moedas e comprar acessórios incríveis para ${escapeHtml(cleanName)}!
        </p>
      </div>
      <div class="flex flex-col gap-2">
        <button
          id="btn-onboarding-open-learn"
          type="button"
          class="min-h-[50px] w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-display font-bold text-base shadow-md hover:brightness-110 active:scale-95 transition"
        >
          🎓 Ir para Vamos Aprender!
        </button>
        <button
          id="btn-onboarding-finish"
          type="button"
          class="min-h-[44px] w-full rounded-2xl border ${
            params.isNight
              ? 'bg-[#2f2459] border-purple-400/50 text-purple-100'
              : 'bg-purple-50 border-purple-200 text-[#4c2a85]'
          } font-extrabold text-sm hover:brightness-105 active:scale-95 transition"
        >
          ✅ Explorar a Casa Agora
        </button>
      </div>
    `;
  }

  return `
    <div id="onboarding-overlay" class="fixed inset-0 z-40 bg-[#1a1036]/55 backdrop-blur-xs flex items-center justify-center p-4">
      <div class="w-full max-w-sm rounded-3xl border-2 p-5 shadow-2xl ${cardBg}">
        <div class="flex items-center justify-between gap-2 mb-3">
          <div class="flex items-center gap-1.5">
            ${([1, 2, 3] as OnboardingStep[])
              .map(
                (n) => `<span class="h-2 rounded-full transition-all ${
                  n === params.step
                    ? 'w-7 bg-[#8b5cf6]'
                    : n < params.step
                      ? 'w-3 bg-emerald-400'
                      : 'w-3 bg-purple-300/40'
                }"></span>`
              )
              .join('')}
            <span class="text-[11px] font-extrabold ${mutedText} ml-1">Passo ${params.step} de 3</span>
          </div>
          <button
            id="btn-onboarding-skip"
            type="button"
            class="px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
              params.isNight
                ? 'bg-white/10 text-purple-200 hover:bg-white/20'
                : 'bg-purple-100 text-[#4c2a85] hover:bg-purple-200'
            }"
          >
            Pular
          </button>
        </div>
        ${stepBody}
      </div>
    </div>
  `;
}
