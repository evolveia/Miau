import { hapticService } from '../../services/hapticService';
import { pwaService, type CameraPermissionState } from '../../services/pwaService';
import type { ChatMessage, ScreenVisibilityPrefs } from '../../types';
import { escapeHtml } from '../../utils/html';

export function renderChatHistoryItemsHtml(
  messages: ChatMessage[],
  isThinking = false
): string {
  const items = messages
    .map((m, idx) => {
      const isUser = m.sender === 'user';
      return `
        <div class="flex ${isUser ? 'justify-end' : 'justify-start'}">
          <div class="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-snug shadow-sm ${
            isUser
              ? 'bg-[#6e45a5] text-white rounded-br-sm'
              : 'bg-white/95 text-[#3b1f6e] border border-purple-100 rounded-bl-sm'
          }">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                ${m.meowPrefix ? `<strong class="block font-display text-[13px] mb-0.5">${escapeHtml(m.meowPrefix)}</strong>` : ''}
                <span class="break-words">${escapeHtml(m.text)}</span>
              </div>
              ${
                !isUser
                  ? `<button
                      type="button"
                      data-speak-msg="${idx}"
                      aria-label="Ouvir esta mensagem do Miau"
                      class="w-7 h-7 rounded-full bg-purple-100 hover:bg-purple-200 text-[#4c2a85] flex items-center justify-center text-xs shrink-0 transition"
                    >🔊</button>`
                  : ''
              }
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  if (isThinking) {
    return `${items}
      <div class="flex justify-start">
        <div class="rounded-2xl rounded-bl-sm px-3.5 py-2 text-xs font-semibold bg-white/85 text-[#6b4d9e] border border-purple-100 animate-pulse">
          💭 Miau está ouvindo e preparando a resposta em áudio e texto...
        </div>
      </div>
    `;
  }
  return items;
}

const FRIEND_QUICK_PROMPTS = [
  { label: 'Estou bem! 😊', text: 'Estou bem hoje! E você, Miau?' },
  { label: 'Dia corrido 😅', text: 'Meu dia foi bem corrido hoje, quero bater um papo!' },
  { label: 'Tô cansado(a) 😴', text: 'Estou um pouco cansado hoje, preciso de uma companhia amiga.' },
  { label: 'Novidades ✨', text: 'Quero te contar como estou me sentindo e algumas novidades!' },
];

export function renderChatModalHtml(params: {
  petName: string;
  liveStatus: string;
  hasLiveSession: boolean;
  liveTranscript: string;
  messages: ChatMessage[];
  soundEnabled: boolean;
  isRecordingMic?: boolean;
  isThinking?: boolean;
}): string {
  return `
    <div class="flex items-center justify-between gap-2 mb-2.5 shrink-0">
      <div class="flex items-center gap-2 min-w-0">
        <button data-modal-close type="button" class="px-3 py-1.5 rounded-full bg-white/90 border border-purple-200 text-[#4c2a85] font-extrabold text-xs shadow-sm hover:bg-purple-50 transition shrink-0">← Voltar</button>
        <div class="min-w-0">
          <h2 class="font-display text-lg font-bold text-[#3b1f6e] truncate">Papo Amigo com ${escapeHtml(params.petName)} 💬</h2>
          <p class="text-[11px] font-semibold text-[#6b4d9e] truncate">Seu amigo quer saber como você está • Áudio e Texto</p>
        </div>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <button
          id="btn-chat-mute"
          type="button"
          aria-pressed="${!params.soundEnabled}"
          aria-label="${params.soundEnabled ? 'Silenciar áudio' : 'Ativar áudio'}"
          class="px-3 py-1.5 rounded-full text-xs font-extrabold shadow-sm border transition ${
            params.soundEnabled
              ? 'bg-white/95 border-purple-200 text-[#4c2a85] hover:bg-purple-50'
              : 'bg-rose-100 border-rose-300 text-rose-800 hover:bg-rose-200'
          }"
        >
          ${params.soundEnabled ? '🔊 Som' : '🔇 Mudo'}
        </button>
        <button id="modal-close" type="button" class="w-9 h-9 rounded-full bg-white/90 border border-purple-200 text-purple-800 font-bold">✕</button>
      </div>
    </div>

    <div class="mb-2 bg-white/85 border border-purple-200 rounded-2xl p-2.5 flex items-center justify-between gap-2 shrink-0">
      <div class="min-w-0">
        <div class="text-xs font-extrabold text-[#4c2a85]">Conversa Direta por Voz (Ao Vivo)</div>
        <div id="live-status-text" class="text-[11px] text-[#6b4d9e] truncate">${escapeHtml(params.liveStatus || 'Ligue a voz ao vivo ou use o microfone abaixo!')}</div>
      </div>
      <button id="btn-live-toggle" class="px-3 py-1.5 rounded-full text-xs font-extrabold text-white shrink-0 ${params.hasLiveSession ? 'bg-rose-500 animate-pulse' : 'bg-[#6e45a5]'}">
        ${params.hasLiveSession ? '⏹️ Parar' : '🎙️ Ligar Voz'}
      </button>
    </div>

    ${
      params.liveTranscript
        ? `<div class="mb-2 bg-white/90 rounded-xl p-2.5 text-xs text-[#3b1f6e] border border-purple-100 max-h-24 overflow-y-auto miau-scroll whitespace-pre-line shrink-0">${escapeHtml(params.liveTranscript)}</div>`
        : ''
    }

    <div id="chat-history-list" class="flex-1 min-h-0 overflow-y-auto miau-scroll flex flex-col gap-2.5 pr-1 mb-2 bg-white/45 rounded-2xl p-3 border border-white/60">
      ${renderChatHistoryItemsHtml(params.messages, Boolean(params.isThinking))}
    </div>

    <div class="flex gap-1.5 overflow-x-auto pb-1.5 mb-1.5 shrink-0 miau-scroll">
      ${FRIEND_QUICK_PROMPTS.map(
        (p) =>
          `<button type="button" data-chat-quick="${escapeHtml(p.text)}" class="px-2.5 py-1 rounded-full bg-white/85 hover:bg-white border border-purple-200 text-[#4c2a85] text-[11px] font-bold whitespace-nowrap shrink-0 transition">${p.label}</button>`
      ).join('')}
    </div>

    <form id="modal-chat-form" class="flex items-center gap-1.5 bg-white rounded-full p-1.5 pl-3.5 border border-purple-200 shadow-sm shrink-0">
      <input id="modal-chat-input" type="text" placeholder="Fale por áudio ou conte como você está..." class="flex-1 text-sm font-semibold text-[#3b1f6e] bg-transparent focus:outline-none min-w-0" />
      <button
        id="btn-modal-mic"
        type="button"
        aria-label="${params.isRecordingMic ? 'Parar e enviar áudio' : 'Gravar mensagem de áudio'}"
        class="w-9 h-9 rounded-full ${params.isRecordingMic ? 'bg-rose-500 animate-pulse' : 'bg-[#7b52b8]'} text-white flex items-center justify-center shadow hover:brightness-110 transition shrink-0"
      >
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>
        </svg>
      </button>
      <button type="submit" class="px-4 py-2 rounded-full bg-[#6e45a5] text-white text-xs font-extrabold shrink-0">Enviar</button>
    </form>
  `;
}

function renderToggleRow(
  screenPrefs: ScreenVisibilityPrefs,
  key: keyof ScreenVisibilityPrefs,
  title: string,
  subtitle: string
): string {
  const enabled = screenPrefs[key];
  return `
    <div class="flex items-center justify-between gap-2 py-1 border-t border-purple-50 first:border-t-0">
      <div class="min-w-0">
        <div class="text-xs font-bold text-[#3b1f6e] truncate">${title}</div>
        <div class="text-[10px] text-[#7a60a8] truncate">${subtitle}</div>
      </div>
      <button
        type="button"
        data-screen-pref="${key}"
        aria-pressed="${enabled}"
        class="w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${enabled ? 'bg-emerald-500' : 'bg-slate-300'}"
      >
        <div class="w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}"></div>
      </button>
    </div>
  `;
}

export function renderSettingsModalHtml(params: {
  screenPrefs: ScreenVisibilityPrefs;
  soundEnabled: boolean;
  cameraPermission: CameraPermissionState;
}): string {
  const camLabel =
    params.cameraPermission === 'granted'
      ? 'Autorizada'
      : params.cameraPermission === 'denied'
        ? 'Bloqueada'
        : params.cameraPermission === 'unsupported'
          ? 'Indisponível'
          : 'Pendente';
  const camBadgeCls =
    params.cameraPermission === 'granted'
      ? 'bg-emerald-100 text-emerald-700'
      : params.cameraPermission === 'denied'
        ? 'bg-rose-100 text-rose-700'
        : 'bg-amber-100 text-amber-800';

  return `
    <div class="flex items-center justify-between mb-3 shrink-0">
      <div class="flex items-center gap-2">
        <button id="btn-settings-back" type="button" class="px-3 py-1.5 rounded-full bg-white/90 border border-purple-200 text-purple-800 font-bold text-xs">← Voltar</button>
        <h2 class="font-display text-xl font-bold text-[#3b1f6e]">Configurações ⚙️</h2>
      </div>
      <button id="modal-close" type="button" class="w-9 h-9 rounded-full bg-white/90 border border-purple-200 text-purple-800 font-bold">✕</button>
    </div>

    <div class="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto miau-scroll pr-1">
      <div class="bg-white/85 rounded-2xl p-3 border border-purple-100 flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-extrabold uppercase tracking-wide text-[#6b4d9e]">Tela Principal (Sala)</span>
          <div class="flex gap-1.5">
            <button id="btn-preset-full" type="button" class="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-purple-100 text-[#4c2a85] hover:bg-purple-200">✨ Tudo</button>
            <button id="btn-preset-clean" type="button" class="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 hover:bg-emerald-200">🧘 Limpo</button>
          </div>
        </div>

        ${renderToggleRow(params.screenPrefs, 'showStatusBars', '📊 Barras de Status', 'Fome, Higiene, Diversão, Sono e Felicidade')}
        ${renderToggleRow(params.screenPrefs, 'showStatusBadges', '🏆 Atalhos do Topo', 'Conquistas, Soneca e Nível')}
        ${renderToggleRow(params.screenPrefs, 'showSpeechAndChat', '💬 Balão de Fala e Chat', 'Caixa de conversa rápida na Sala')}
        ${renderToggleRow(params.screenPrefs, 'showCoinsBadge', '🪙 Moedas no Cabeçalho', 'Mostrar saldo de moedas no topo')}
      </div>

      <div class="bg-white/85 rounded-2xl p-3 border border-purple-100 flex flex-col gap-2.5">
        <span class="text-xs font-extrabold uppercase tracking-wide text-[#6b4d9e]">Áudio e Câmera (AR)</span>

        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-[#3b1f6e]">🔊 Sons e Voz do Miau</span>
          <button id="btn-toggle-sound" class="px-3 py-1 rounded-full text-xs font-extrabold ${params.soundEnabled ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-700'}">
            ${params.soundEnabled ? 'Ativado' : 'Mudo'}
          </button>
        </div>

        <div class="flex items-center justify-between pt-1 border-t border-purple-100">
          <div class="min-w-0">
            <div class="text-xs font-bold text-[#3b1f6e]">📳 Vibração Tátil</div>
            <div class="text-[10px] text-[#7a60a8]">Feedback ao fazer carinho e cuidar do Miau</div>
          </div>
          <button id="btn-toggle-haptics" class="px-3 py-1 rounded-full text-xs font-extrabold shrink-0 ${hapticService.enabled ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-700'}">
            ${hapticService.enabled ? 'Ativada' : 'Desativada'}
          </button>
        </div>

        <div class="flex items-center justify-between gap-2 pt-1 border-t border-purple-100">
          <div class="min-w-0">
            <div class="text-xs font-bold text-[#3b1f6e]">📷 Câmera (Realidade Aumentada)</div>
            <span class="inline-block mt-0.5 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${camBadgeCls}">${camLabel}</span>
          </div>
          <button id="btn-auth-camera" class="px-3 py-1.5 rounded-full bg-sky-500 text-white text-xs font-extrabold shadow-sm hover:brightness-110 shrink-0">
            ${params.cameraPermission === 'granted' ? 'Revalidar' : 'Autorizar'}
          </button>
        </div>
      </div>

      ${
        !pwaService.isInstalled
          ? `<button id="btn-settings-install" class="w-full py-2.5 px-3.5 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-700 text-white font-display font-bold text-sm shadow flex items-center justify-center gap-2 hover:brightness-110 transition">
               📲 Instalar Aplicativo Miau
             </button>`
          : `<div class="text-center text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-2xl py-2">
               ✅ Aplicativo instalado no dispositivo
             </div>`
      }
    </div>
  `;
}

export function renderSupportModalHtml(
  supportDraft: string,
  waHref: string
): string {
  return `
    <div class="flex items-center justify-between gap-2 mb-3 shrink-0">
      <div class="flex items-center gap-2 min-w-0">
        <button data-modal-close type="button" class="px-3 py-1.5 rounded-full bg-white/90 border border-purple-200 text-[#4c2a85] font-extrabold text-xs shadow-sm hover:bg-purple-50 transition shrink-0">← Voltar</button>
        <div class="min-w-0">
          <h2 class="font-display text-xl font-bold text-[#3b1f6e] truncate">Suporte Miau 💬</h2>
          <p class="text-[11px] font-semibold text-[#6b4d9e] truncate">Envie sua dúvida direto para o WhatsApp +55 91 99615-6672</p>
        </div>
      </div>
      <button id="modal-close" type="button" class="w-9 h-9 rounded-full bg-white/90 border border-purple-200 text-purple-800 font-bold shrink-0">✕</button>
    </div>

    <div class="flex-1 min-h-0 flex flex-col overflow-y-auto miau-scroll pr-1 max-w-xl mx-auto w-full">

    <div class="flex flex-wrap gap-1.5 mb-2.5">
      ${[
        'Dúvida sobre o jogo',
        'Problema técnico',
        'Sugestão de recurso',
        'Minha conta / moedas',
      ]
        .map(
          (topic) =>
            `<button type="button" data-support-topic="${topic}" class="px-2.5 py-1 rounded-full bg-purple-100/80 hover:bg-purple-200 text-[#4c2a85] text-[11px] font-bold transition">${topic}</button>`
        )
        .join('')}
    </div>

    <textarea
      id="support-message-input"
      rows="4"
      placeholder="Escreva aqui sua pergunta ou dúvida sobre o Miau..."
      class="w-full rounded-2xl bg-white/95 border border-purple-200 p-3 text-xs font-semibold text-[#3b1f6e] placeholder-[#947ebe] focus:outline-none focus:border-purple-500 resize-none mb-3"
    >${escapeHtml(supportDraft)}</textarea>

    <div class="flex flex-col gap-2">
      <a
        id="btn-send-whatsapp"
        href="${waHref}"
        target="_blank"
        rel="noopener noreferrer"
        class="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-display font-bold text-sm shadow-md flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.99] transition text-center"
      >
        📲 Enviar no WhatsApp (+55 91 99615-6672)
      </a>
      <button
        id="btn-copy-support"
        type="button"
        class="w-full py-2.5 rounded-2xl bg-white/85 border border-purple-200 text-[#4c2a85] text-xs font-extrabold hover:bg-white transition"
      >
        📋 Copiar Pergunta
      </button>
    </div>
    </div>
  `;
}

export function renderInstallGuideModalHtml(): string {
  return `
    <div class="fixed inset-0 z-50 bg-purple-950/45 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="w-full max-w-sm glass-card rounded-3xl p-5 text-[#3b1f6e] shadow-2xl">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-display text-lg font-bold">📲 Instalar o App Miau</h2>
          <button id="close-install-guide" class="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold">✕</button>
        </div>
        ${
          pwaService.isIOS
            ? `
              <ol class="text-xs leading-relaxed text-[#4c2a85] flex flex-col gap-2 bg-white/80 rounded-2xl p-3.5 border border-purple-100">
                <li><strong>1.</strong> Toque no botão <strong>Compartilhar</strong> (ícone de quadrado com seta ↑) na barra do Safari.</li>
                <li><strong>2.</strong> Role para baixo e toque em <strong>Adicionar à Tela de Início</strong>.</li>
                <li><strong>3.</strong> Confirme tocando em <strong>Adicionar</strong>!</li>
              </ol>
            `
            : `
              <ol class="text-xs leading-relaxed text-[#4c2a85] flex flex-col gap-2 bg-white/80 rounded-2xl p-3.5 border border-purple-100">
                <li><strong>1.</strong> Toque no menu do navegador (⋮ ou ícone na barra de endereço).</li>
                <li><strong>2.</strong> Selecione <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.</li>
                <li><strong>3.</strong> O Miau abrirá como aplicativo independente com câmera e áudio integrados!</li>
              </ol>
            `
        }
      </div>
    </div>
  `;
}
