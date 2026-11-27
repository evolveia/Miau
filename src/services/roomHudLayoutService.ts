import type { ActiveModal, PetStats } from '../types';
import { escapeHtml } from '../utils/html';

function renderStatPillHtml(
  key: string,
  label: string,
  value: number,
  emoji: string,
  barGrad: string,
  badgeBg: string,
  fullSpan = false
): string {
  const pct = Math.round(value);
  const isLow = pct < 30;
  return `
    <button
      id="stat-pill-${key}"
      data-stat="${key}"
      type="button"
      class="glass-pill rounded-full px-2 py-1 flex items-center gap-2 text-left cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform ${fullSpan ? 'col-span-2' : ''} ${isLow ? 'status-alert-glow' : ''}"
    >
      <div id="stat-icon-${key}" class="w-7 h-7 rounded-full ${badgeBg} border-2 border-white flex items-center justify-center text-sm shadow-sm shrink-0 ${isLow ? 'status-icon-alert' : ''}">${emoji}</div>
      <div class="flex-1 min-w-0 pr-1">
        <div class="flex items-center justify-between text-[11px] font-extrabold text-[#3b1f6e] leading-tight mb-0.5">
          <span>${label}</span>
          <span id="pct-${key}" class="${isLow ? 'text-rose-600' : ''}">${pct}%</span>
        </div>
        <div class="w-full h-1.5 bg-purple-100 rounded-full overflow-hidden">
          <div id="bar-${key}" class="h-full rounded-full bg-gradient-to-r ${barGrad} transition-all duration-300" style="width: ${pct}%"></div>
        </div>
      </div>
    </button>
  `;
}

export function renderCollapsibleStatusSectionHtml(params: {
  showStatusBars: boolean;
  showStatusBadges: boolean;
  collapsed: boolean;
  stats: PetStats;
  unlockedCount: number;
  totalAchievements: number;
  routineDone: number;
  routineTotal: number;
  activeRoutineCount: number;
  isSleeping: boolean;
  level: number;
}): string {
  if (!params.showStatusBars && !params.showStatusBadges) {
    return '';
  }

  const s = params.stats;
  const miniStats: Array<{
    key: keyof PetStats;
    emoji: string;
    label: string;
    val: number;
  }> = [
    { key: 'hunger', emoji: '🐟', label: 'Fome', val: s.hunger },
    { key: 'hygiene', emoji: '🧼', label: 'Higiene', val: s.hygiene },
    { key: 'fun', emoji: '🧶', label: 'Diversão', val: s.fun },
    { key: 'sleep', emoji: '🌙', label: 'Sono', val: s.sleep },
    {
      key: 'happiness',
      emoji: '💖',
      label: 'Felicidade',
      val: s.happiness ?? 75,
    },
  ];

  if (params.collapsed) {
    return `
      <section class="relative z-20 px-3 pt-1">
        <div id="status-collapsed-bar" class="glass-pill rounded-full px-2 py-1 flex items-center justify-between gap-1 shadow-sm">
          ${
            params.showStatusBars
              ? `<div class="flex items-center gap-1 overflow-x-auto miau-scroll min-w-0 flex-1">
                  ${miniStats
                    .map((item) => {
                      const pct = Math.round(item.val);
                      const isLow = pct < 30;
                      return `
                        <button
                          id="compact-stat-${item.key}"
                          data-stat="${item.key}"
                          type="button"
                          title="${item.label}: ${pct}%"
                          aria-label="${item.label}: ${pct} por cento"
                          class="px-1.5 py-0.5 rounded-full bg-white/75 border border-purple-100 text-[10px] font-extrabold text-[#3b1f6e] flex items-center gap-0.5 shrink-0 hover:bg-white active:scale-95 transition ${isLow ? 'status-alert-glow' : ''}"
                        >
                          <span>${item.emoji}</span>
                          <span id="compact-pct-${item.key}" class="${isLow ? 'text-rose-600' : ''}">${pct}%</span>
                        </button>
                      `;
                    })
                    .join('')}
                </div>`
              : `<div class="flex items-center gap-1.5 min-w-0 flex-1 px-1 text-[11px] font-extrabold text-[#3b1f6e] truncate">
                   <span>🏆 ${params.unlockedCount}/${params.totalAchievements}</span>
                   <span>•</span>
                   <span>Nível ${params.level}</span>
                 </div>`
          }
          <button
            id="btn-toggle-status-panel"
            type="button"
            aria-expanded="false"
            aria-label="Expandir barras de status e atalhos"
            class="px-2.5 py-1 rounded-full bg-[#6e45a5] text-white text-[10px] font-extrabold flex items-center gap-1 shrink-0 shadow-xs hover:brightness-110 active:scale-95 transition"
          >
            <span>Status</span>
            <span>▼</span>
          </button>
        </div>
      </section>
    `;
  }

  return `
    <section class="relative z-20 px-3.5 pt-1">
      ${
        params.showStatusBars
          ? `<div class="grid grid-cols-2 gap-1.5">
              ${renderStatPillHtml('hunger', 'Fome', s.hunger, '🐟', 'from-amber-400 to-orange-500', 'bg-orange-300')}
              ${renderStatPillHtml('hygiene', 'Higiene', s.hygiene, '🧼', 'from-cyan-400 to-emerald-400', 'bg-teal-300')}
              ${renderStatPillHtml('fun', 'Diversão', s.fun, '🧶', 'from-fuchsia-400 to-pink-500', 'bg-fuchsia-300')}
              ${renderStatPillHtml('sleep', 'Sono', s.sleep, '🌙', 'from-indigo-400 to-purple-500', 'bg-indigo-300')}
              ${renderStatPillHtml('happiness', 'Felicidade', s.happiness ?? 75, '💖', 'from-rose-400 to-pink-500', 'bg-rose-300', true)}
            </div>`
          : ''
      }
      <div class="flex justify-between items-center gap-1.5 ${params.showStatusBars ? 'mt-1.5' : ''}">
        ${
          params.showStatusBadges
            ? `<div class="flex items-center gap-1 flex-wrap min-w-0">
                <button id="btn-achievements" type="button" class="glass-pill px-2 py-1 rounded-full text-[11px] font-extrabold text-[#4c2a85] flex items-center gap-1 hover:scale-105 transition">
                  <span>🏆</span>
                  <span id="achievements-count">${params.unlockedCount}/${params.totalAchievements}</span>
                </button>
                <button id="btn-routine" type="button" class="glass-pill px-2 py-1 rounded-full text-[11px] font-extrabold text-[#4c2a85] flex items-center gap-1 hover:scale-105 transition ${params.activeRoutineCount > 0 ? 'ring-2 ring-amber-400' : ''}">
                  <span>📅</span>
                  <span>${params.routineDone}/${params.routineTotal}</span>
                </button>
                <button id="btn-sleep-toggle" type="button" class="glass-pill px-2 py-1 rounded-full text-[11px] font-bold text-[#4c2a85] flex items-center gap-1 hover:scale-105 transition">
                  ${params.isSleeping ? '☀️ Acordar' : '🌙 Soneca'}
                </button>
                <div id="miau-level" class="glass-pill px-2.5 py-1 rounded-full text-[11px] font-extrabold text-[#3b1f6e]">
                  Nv.${params.level}
                </div>
              </div>`
            : `<div class="text-[11px] font-extrabold text-[#3b1f6e]/75 px-1">Status do bichinho</div>`
        }
        <button
          id="btn-toggle-status-panel"
          type="button"
          aria-expanded="true"
          aria-label="Recolher barras de status"
          class="glass-pill px-2.5 py-1 rounded-full text-[10px] font-extrabold text-[#4c2a85] flex items-center gap-1 shrink-0 hover:bg-white active:scale-95 transition"
        >
          <span>Recolher</span>
          <span>▲</span>
        </button>
      </div>
    </section>
  `;
}

export function renderCollapsibleSpeechAndChatHtml(params: {
  showSpeechAndChat: boolean;
  collapseSpeechBox: boolean;
  collapseChatBox: boolean;
  petName: string;
  meowPrefix: string;
  speechText: string;
  avatarUrl: string;
  isRecordingMic: boolean;
}): string {
  if (!params.showSpeechAndChat) {
    return '';
  }

  const cleanName = escapeHtml(params.petName);
  const fullCompactSpeech = `${params.meowPrefix} ${params.speechText}`.trim();

  // Both collapsed -> single sleek compact bar freeing maximum room height
  if (params.collapseSpeechBox && params.collapseChatBox) {
    return `
      <section class="relative z-20 px-3.5 pb-1.5 flex items-center justify-center gap-1.5">
        <button
          id="btn-toggle-speech-box"
          type="button"
          aria-expanded="false"
          aria-label="Expandir caixa de mensagem do gatinho"
          class="glass-pill flex-1 min-w-0 px-3 py-1.5 rounded-full flex items-center justify-center gap-1.5 text-[11px] font-extrabold text-[#3b1f6e] hover:bg-white active:scale-95 transition truncate"
        >
          <span>💬</span>
          <span class="truncate">Fala de ${cleanName}</span>
          <span>▼</span>
        </button>
        <button
          id="btn-speaker"
          type="button"
          aria-label="Ouvir voz de ${cleanName}"
          class="w-8 h-8 rounded-full bg-gradient-to-br from-[#7d52bd] to-[#5d3798] text-white flex items-center justify-center shrink-0 shadow-sm hover:scale-105 active:scale-95 transition"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
          </svg>
        </button>
        <button
          id="btn-toggle-chat-box"
          type="button"
          aria-expanded="false"
          aria-label="Expandir caixa de conversa"
          class="glass-pill flex-1 min-w-0 px-3 py-1.5 rounded-full flex items-center justify-center gap-1.5 text-[11px] font-extrabold text-[#3b1f6e] hover:bg-white active:scale-95 transition truncate"
        >
          <span>🎙️</span>
          <span class="truncate">Conversar</span>
          <span>▼</span>
        </button>
      </section>
    `;
  }

  const speechHtml = params.collapseSpeechBox
    ? `
      <div id="speech-collapsed-pill" class="glass-pill rounded-full px-2.5 py-1 flex items-center gap-2 shadow-sm">
        <button
          id="btn-toggle-speech-box"
          type="button"
          aria-expanded="false"
          aria-label="Expandir mensagem do gatinho"
          class="flex items-center gap-1.5 flex-1 min-w-0 text-left"
        >
          <span class="text-sm shrink-0">💬</span>
          <span id="speech-text-compact" class="text-[11px] font-bold text-[#3b1f6e] truncate">${escapeHtml(fullCompactSpeech)}</span>
          <span class="text-[10px] font-extrabold text-[#6e45a5] shrink-0">▼</span>
        </button>
        <button
          id="btn-speaker"
          type="button"
          aria-label="Ouvir voz de ${cleanName}"
          class="w-7 h-7 rounded-full bg-gradient-to-br from-[#7d52bd] to-[#5d3798] text-white flex items-center justify-center shrink-0 shadow-xs hover:scale-105 active:scale-95 transition"
        >
          <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
          </svg>
        </button>
      </div>
    `
    : `
      <div id="speech-bubble-card" class="relative glass-card rounded-[24px] p-2.5 sm:p-3 flex items-center gap-2.5 cursor-pointer hover:brightness-[1.02] transition">
        <div class="w-11 h-11 rounded-full overflow-hidden border-2 border-purple-200 bg-purple-100 shrink-0 shadow-sm">
          <img src="${params.avatarUrl}" alt="${cleanName}" referrerpolicy="no-referrer" class="w-full h-full object-cover" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-1">
            <div id="speech-prefix" class="font-display text-sm font-bold text-[#2d1b4e] truncate">${escapeHtml(params.meowPrefix)}</div>
            <button
              id="btn-toggle-speech-box"
              type="button"
              aria-expanded="true"
              aria-label="Recolher caixa de mensagem do gatinho"
              title="Recolher mensagem"
              class="px-2 py-0.5 rounded-full bg-purple-100/90 hover:bg-purple-200 text-[#4c2a85] text-[10px] font-extrabold shrink-0 transition"
            >
              ▲
            </button>
          </div>
          <div id="speech-text" class="text-xs sm:text-sm font-semibold text-[#473173] leading-snug break-words">${escapeHtml(params.speechText)}</div>
        </div>
        <button
          id="btn-speaker"
          type="button"
          aria-label="Ouvir voz de ${cleanName}"
          class="w-10 h-10 rounded-full bg-gradient-to-br from-[#7d52bd] to-[#5d3798] text-white flex items-center justify-center shrink-0 shadow-md hover:scale-105 active:scale-95 transition"
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
        </button>
      </div>
    `;

  const chatHtml = params.collapseChatBox
    ? `
      <div id="chat-collapsed-pill" class="flex items-center justify-center gap-1.5">
        <button
          id="btn-toggle-chat-box"
          type="button"
          aria-expanded="false"
          aria-label="Expandir caixa de conversa"
          class="glass-pill flex-1 px-3 py-1.5 rounded-full flex items-center justify-between gap-2 text-xs font-extrabold text-[#3b1f6e] hover:bg-white active:scale-95 transition"
        >
          <span>💬 Escrever ou falar com ${cleanName}</span>
          <span class="text-[10px] text-[#6e45a5]">▼</span>
        </button>
        <button
          id="btn-mic"
          type="button"
          style="touch-action:none"
          title="Segure para gravar e solte para enviar"
          aria-label="${params.isRecordingMic ? 'Solte para enviar áudio' : `Segure para gravar voz para ${cleanName}`}"
          class="w-9 h-9 rounded-full select-none ${params.isRecordingMic ? 'bg-rose-500 animate-pulse scale-110' : 'bg-[#7b52b8]'} text-white flex items-center justify-center shadow hover:brightness-110 transition shrink-0"
        >
          <svg class="w-4 h-4 pointer-events-none" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>
          </svg>
        </button>
      </div>
    `
    : `
      <form id="quick-chat-form" class="glass-pill rounded-full p-1.5 pl-3.5 flex items-center gap-1.5">
        <input
          id="quick-chat-input"
          type="text"
          placeholder="${params.isRecordingMic ? '🔴 Gravando... solte para enviar!' : `Fale com ${cleanName}...`}"
          class="flex-1 bg-transparent text-sm font-semibold text-[#3b1f6e] placeholder-[#8f79b5] focus:outline-none min-w-0"
        />
        <button
          id="btn-mic"
          type="button"
          style="touch-action:none"
          title="Segure para gravar e solte para enviar"
          aria-label="${params.isRecordingMic ? 'Solte para enviar áudio' : `Segure para gravar voz para ${cleanName}`}"
          class="w-9 h-9 rounded-full select-none ${params.isRecordingMic ? 'bg-rose-500 animate-pulse scale-110' : 'bg-[#7b52b8]'} text-white flex items-center justify-center shadow hover:brightness-110 transition shrink-0"
        >
          <svg class="w-4 h-4 pointer-events-none" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>
          </svg>
        </button>
        <button
          type="submit"
          aria-label="Enviar mensagem"
          class="w-9 h-9 rounded-full bg-gradient-to-br from-[#8c64cc] to-[#633ea1] text-white flex items-center justify-center shadow hover:brightness-110 transition shrink-0"
        >
          <svg class="w-4 h-4 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
        <button
          id="btn-toggle-chat-box"
          type="button"
          aria-expanded="true"
          aria-label="Recolher caixa de conversa"
          title="Recolher caixa de conversa"
          class="w-7 h-7 rounded-full bg-purple-100/90 hover:bg-purple-200 text-[#4c2a85] text-[10px] font-extrabold flex items-center justify-center shrink-0 transition"
        >
          ▲
        </button>
      </form>
    `;

  return `
    <section class="relative z-20 px-3.5 pb-1.5 flex flex-col gap-2">
      ${speechHtml}
      ${chatHtml}
    </section>
  `;
}

function renderNavBtnHtml(
  modal: ActiveModal,
  label: string,
  grad: string,
  emoji: string,
  activeModal: ActiveModal,
  isCleaningMode: boolean
): string {
  const active =
    activeModal === modal || (modal === 'clean' && isCleaningMode);
  return `
    <button
      data-nav="${modal}"
      type="button"
      class="flex flex-col items-center gap-1 group"
    >
      <div class="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-b ${grad} border-2 border-white shadow-md flex items-center justify-center text-xl sm:text-2xl transition-transform group-hover:scale-105 group-active:scale-95 ${active ? 'ring-3 ring-purple-500 scale-105' : ''}">
        ${emoji}
      </div>
      <span class="text-[11px] font-extrabold text-[#3b1f6e] tracking-tight">${label}</span>
    </button>
  `;
}

export function renderCollapsibleBottomNavHtml(params: {
  collapsed: boolean;
  activeModal: ActiveModal;
  isCleaningMode: boolean;
}): string {
  if (params.collapsed) {
    return `
      <nav class="relative z-20 px-3 pb-2.5 pt-0.5 flex justify-center">
        <button
          id="btn-toggle-bottom-nav"
          type="button"
          aria-expanded="false"
          aria-label="Expandir menu de ações do rodapé"
          class="glass-pill px-4 py-1.5 rounded-full text-xs font-extrabold text-[#3b1f6e] flex items-center gap-2 shadow-md hover:bg-white active:scale-95 transition"
        >
          <span>🐾</span>
          <span>Ações do Miau</span>
          <span class="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-100 text-[#5a3696]">5 ▲</span>
        </button>
      </nav>
    `;
  }

  return `
    <nav class="relative z-20 px-3 pb-2.5 pt-0.5 flex flex-col items-center gap-1">
      <button
        id="btn-toggle-bottom-nav"
        type="button"
        aria-expanded="true"
        aria-label="Recolher menu de ações do rodapé"
        class="glass-pill px-3 py-0.5 rounded-full text-[10px] font-extrabold text-[#4c2a85] flex items-center gap-1 hover:bg-white active:scale-95 transition"
      >
        <span>Recolher ações</span>
        <span>▼</span>
      </button>
      <div class="w-full glass-card rounded-[26px] px-2 py-2 grid grid-cols-5 gap-1">
        ${renderNavBtnHtml('feed', 'Alimentar', 'from-amber-400 to-orange-500', '🐟', params.activeModal, params.isCleaningMode)}
        ${renderNavBtnHtml('clean', 'Limpar', 'from-cyan-400 to-sky-500', '✨', params.activeModal, params.isCleaningMode)}
        ${renderNavBtnHtml('games', 'Jogos', 'from-emerald-400 to-green-500', '🎮', params.activeModal, params.isCleaningMode)}
        ${renderNavBtnHtml('customize', 'Personalizar', 'from-pink-400 to-fuchsia-500', '👗', params.activeModal, params.isCleaningMode)}
        ${renderNavBtnHtml('chat', 'Conversar', 'from-violet-400 to-purple-600', '💬', params.activeModal, params.isCleaningMode)}
      </div>
    </nav>
  `;
}
