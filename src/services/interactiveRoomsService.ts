import { FOOD_ITEMS } from '../constants';
import type { HouseRoomId } from '../types';
import { escapeHtml } from '../utils/html';

export interface HouseRoomDef {
  id: HouseRoomId;
  label: string;
  shortLabel: string;
  emoji: string;
  subtitle: string;
  backdropTintClass: string;
}

export const HOUSE_ROOMS: HouseRoomDef[] = [
  {
    id: 'living',
    label: 'Sala de Estar',
    shortLabel: 'Sala',
    emoji: '🛋️',
    subtitle: 'Carinho, conversa e relaxamento',
    backdropTintClass: '',
  },
  {
    id: 'kitchen',
    label: 'Cozinha',
    shortLabel: 'Cozinha',
    emoji: '🍽️',
    subtitle: 'Geladeira e tigela para comer',
    backdropTintClass: 'bg-amber-200/15',
  },
  {
    id: 'bathroom',
    label: 'Banheiro',
    shortLabel: 'Banho',
    emoji: '🛁',
    subtitle: 'Esfregue o dedo para ensaboar e enxaguar',
    backdropTintClass: 'bg-cyan-200/18',
  },
  {
    id: 'bedroom',
    label: 'Quarto',
    shortLabel: 'Quarto',
    emoji: '🛏️',
    subtitle: 'Abajur, caminha e música de ninar',
    backdropTintClass: 'bg-indigo-900/15',
  },
  {
    id: 'playroom',
    label: 'Sala de Brincar',
    shortLabel: 'Brincar',
    emoji: '🧶',
    subtitle: 'Arranhador, bolinha e caixa de brinquedos',
    backdropTintClass: 'bg-pink-200/15',
  },
];

export function getHouseRoomDef(roomId: HouseRoomId): HouseRoomDef {
  return HOUSE_ROOMS.find((r) => r.id === roomId) || HOUSE_ROOMS[0];
}

export function advanceBathFoamProgress(
  currentPct: number,
  pointerDeltaPx: number
): number {
  const safeCurrent = Math.max(0, Math.min(100, currentPct));
  if (pointerDeltaPx <= 0) return safeCurrent;
  const gain = Math.min(18, pointerDeltaPx * 0.24);
  return Math.min(100, Math.round((safeCurrent + gain) * 10) / 10);
}

export function renderRoomSwitcherHtml(
  activeRoom: HouseRoomId,
  isNight: boolean
): string {
  return `
    <div id="room-switcher-bar" class="relative z-20 px-3 pt-1 pb-0.5 flex items-center justify-center gap-1.5 overflow-x-auto miau-scroll shrink-0">
      ${HOUSE_ROOMS.map((room) => {
        const active = room.id === activeRoom;
        return `
          <button
            type="button"
            data-room-switch="${room.id}"
            aria-pressed="${active}"
            class="min-h-[34px] px-2.5 py-1 rounded-full text-[11px] font-extrabold border flex items-center gap-1 whitespace-nowrap transition active:scale-95 shrink-0 ${
              active
                ? 'bg-[#6e45a5] text-white border-white shadow-md scale-[1.03]'
                : isNight
                  ? 'bg-[#2a1f52]/85 text-purple-100 border-purple-400/35 hover:bg-[#382a6b]'
                  : 'glass-pill text-[#4c2a85] hover:bg-white'
            }"
          >
            <span>${room.emoji}</span>
            <span>${escapeHtml(room.shortLabel)}</span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

export function renderRoomInteractiveOverlayHtml(params: {
  activeRoom: HouseRoomId;
  petName: string;
  isSleeping: boolean;
  isNight: boolean;
  fridgeOpen: boolean;
  bathFoamPct: number;
  lullabyPlaying: boolean;
  coins: number;
}): string {
  const room = getHouseRoomDef(params.activeRoom);

  if (params.activeRoom === 'kitchen') {
    const quickFoods = FOOD_ITEMS.slice(0, 6);
    return `
      <!-- Kitchen Floor Props -->
      <div class="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-amber-900/12 to-transparent z-0"></div>

      ${
        params.fridgeOpen
          ? `
            <div id="kitchen-fridge-drawer" class="absolute inset-x-3 bottom-20 z-30 glass-card rounded-3xl p-3 shadow-xl border-2 border-amber-200 animate-miau-bounce">
              <div class="flex items-center justify-between gap-2 mb-2">
                <div class="text-xs font-extrabold text-[#3b1f6e]">🧊 Geladeira da Cozinha • 🪙 ${params.coins}</div>
                <div class="flex items-center gap-1.5">
                  <button id="btn-room-all-foods" type="button" class="px-2.5 py-1 rounded-full bg-purple-100 text-[#4c2a85] text-[10px] font-extrabold hover:bg-purple-200">Ver Cardápio</button>
                  <button id="btn-room-close-fridge" type="button" class="w-7 h-7 rounded-full bg-white text-[#4c2a85] text-xs font-bold border border-purple-200">✕</button>
                </div>
              </div>
              <div class="grid grid-cols-3 gap-1.5">
                ${quickFoods
                  .map(
                    (f) => `
                    <button
                      type="button"
                      data-food="${f.id}"
                      class="rounded-2xl p-2 bg-white/95 hover:bg-amber-50 border border-amber-200 flex flex-col items-center gap-0.5 text-center active:scale-95 transition shadow-xs"
                    >
                      <span class="text-2xl leading-none">${f.emoji}</span>
                      <span class="text-[10px] font-extrabold text-[#3b1f6e] truncate w-full">${escapeHtml(f.name)}</span>
                      <span class="text-[9px] font-bold ${f.cost === 0 ? 'text-emerald-700' : 'text-amber-700'}">${f.cost === 0 ? 'Grátis' : `🪙 ${f.cost}`}</span>
                    </button>
                  `
                  )
                  .join('')}
              </div>
            </div>
          `
          : ''
      }

      <!-- Fridge (Left) & Food Bowl (Right) -->
      <button
        id="btn-room-fridge"
        type="button"
        aria-label="Abrir geladeira para escolher comida"
        class="absolute left-3 sm:left-5 bottom-3 z-20 glass-pill rounded-2xl px-3 py-2 flex items-center gap-2 border-2 border-sky-200 hover:scale-105 active:scale-95 transition shadow-md"
      >
        <span class="text-2xl sm:text-3xl leading-none">🧊</span>
        <div class="text-left leading-tight">
          <div class="text-[11px] font-extrabold text-[#3b1f6e]">Geladeira</div>
          <div class="text-[9px] font-bold text-sky-700">Escolher comida</div>
        </div>
      </button>

      <button
        id="btn-room-bowl"
        type="button"
        aria-label="Servir petisco na tigela de comida"
        class="absolute right-3 sm:right-5 bottom-3 z-20 glass-pill rounded-2xl px-3 py-2 flex items-center gap-2 border-2 border-amber-300 hover:scale-105 active:scale-95 transition shadow-md"
      >
        <span class="text-2xl sm:text-3xl leading-none">🥣</span>
        <div class="text-left leading-tight">
          <div class="text-[11px] font-extrabold text-[#3b1f6e]">Tigela</div>
          <div class="text-[9px] font-bold text-amber-700">Comer agora</div>
        </div>
      </button>
    `;
  }

  if (params.activeRoom === 'bathroom') {
    const foam = Math.round(params.bathFoamPct);
    const hasFoam = foam >= 25;
    return `
      <!-- Soft Bathtub Rim SVG behind feet -->
      <div class="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center z-0 opacity-90">
        <svg viewBox="0 0 320 90" class="w-[295px] sm:w-[330px] h-20 drop-shadow-md">
          <path d="M24 22 H296 C296 66 250 84 160 84 C70 84 24 66 24 22 Z" fill="rgba(224, 247, 255, 0.85)" stroke="#0891b2" stroke-width="4"/>
          <rect x="14" y="14" width="292" height="16" rx="8" fill="#ffffff" stroke="#0891b2" stroke-width="4"/>
          <circle cx="80" cy="22" r="9" fill="#cffafe" opacity="0.9"/>
          <circle cx="242" cy="20" r="11" fill="#cffafe" opacity="0.9"/>
          <circle cx="160" cy="24" r="7" fill="#e0f2fe" opacity="0.9"/>
        </svg>
      </div>

      <!-- Top Foam Meter -->
      <div class="absolute top-2 left-1/2 -translate-x-1/2 z-20 glass-pill px-3.5 py-1.5 rounded-full flex items-center gap-2 shadow-sm max-w-[92%]">
        <span class="text-sm">🧽</span>
        <div class="w-28 sm:w-36">
          <div class="flex items-center justify-between text-[10px] font-extrabold text-cyan-900">
            <span>Espuma</span>
            <span id="bath-foam-pct">${foam}%</span>
          </div>
          <div class="w-full h-1.5 bg-cyan-100 rounded-full overflow-hidden">
            <div id="bath-foam-bar" class="h-full rounded-full bg-gradient-to-r from-cyan-400 to-sky-500 transition-all duration-150" style="width:${foam}%"></div>
          </div>
        </div>
        <span class="text-[10px] font-bold text-cyan-800 hidden sm:inline">Esfregue o dedo!</span>
      </div>

      <!-- Soap Sponge Quick Boost & Showerhead Rinse -->
      <button
        id="btn-room-soap"
        type="button"
        aria-label="Ensaboar o bichinho"
        class="absolute left-3 sm:left-5 bottom-3 z-20 glass-pill rounded-2xl px-3 py-2 flex items-center gap-2 border-2 border-cyan-200 hover:scale-105 active:scale-95 transition shadow-md"
      >
        <span class="text-2xl leading-none">🫧</span>
        <div class="text-left leading-tight">
          <div class="text-[11px] font-extrabold text-[#3b1f6e]">Sabonete</div>
          <div class="text-[9px] font-bold text-cyan-700">Esfregar dedo</div>
        </div>
      </button>

      <button
        id="btn-room-showerhead"
        type="button"
        aria-label="Enxaguar com o chuveirinho"
        class="absolute right-3 sm:right-5 bottom-3 z-20 rounded-2xl px-3 py-2 flex items-center gap-2 border-2 transition shadow-md hover:scale-105 active:scale-95 ${
          hasFoam
            ? 'bg-gradient-to-r from-cyan-500 to-sky-500 text-white border-white ring-2 ring-cyan-300 animate-pulse'
            : 'glass-pill border-sky-200 text-[#3b1f6e]'
        }"
      >
        <span class="text-2xl leading-none">🚿</span>
        <div class="text-left leading-tight">
          <div class="text-[11px] font-extrabold">Chuveirinho</div>
          <div class="text-[9px] font-bold ${hasFoam ? 'text-cyan-50' : 'text-sky-700'}">Enxaguar agora</div>
        </div>
      </button>
    `;
  }

  if (params.activeRoom === 'bedroom') {
    return `
      <!-- Cozy Cat Cushion / Bed SVG -->
      <div class="pointer-events-none absolute inset-x-0 bottom-7 flex justify-center z-0 opacity-95">
        <svg viewBox="0 0 320 72" class="w-[290px] sm:w-[325px] h-16 drop-shadow-md">
          <ellipse cx="160" cy="44" rx="138" ry="24" fill="${params.isSleeping ? '#4338ca' : '#a855f7'}" stroke="#312e81" stroke-width="4"/>
          <ellipse cx="160" cy="40" rx="112" ry="15" fill="${params.isSleeping ? '#6366f1' : '#e9d5ff'}" opacity="0.9"/>
        </svg>
      </div>

      <button
        id="btn-room-lamp"
        type="button"
        aria-pressed="${!params.isSleeping}"
        aria-label="${params.isSleeping ? 'Acender abajur e acordar' : 'Apagar abajur para dormir'}"
        class="absolute left-3 sm:left-5 bottom-3 z-20 rounded-2xl px-3 py-2 flex items-center gap-2 border-2 transition shadow-md hover:scale-105 active:scale-95 ${
          params.isSleeping
            ? 'bg-indigo-900/90 text-amber-200 border-indigo-400'
            : 'glass-pill border-amber-300 text-[#3b1f6e]'
        }"
      >
        <span class="text-2xl leading-none">${params.isSleeping ? '🪔' : '💡'}</span>
        <div class="text-left leading-tight">
          <div class="text-[11px] font-extrabold">${params.isSleeping ? 'Abajur Apagado' : 'Abajur Aceso'}</div>
          <div class="text-[9px] font-bold opacity-85">${params.isSleeping ? 'Toque p/ acordar' : 'Toque p/ dormir'}</div>
        </div>
      </button>

      <button
        id="btn-room-lullaby"
        type="button"
        aria-pressed="${params.lullabyPlaying}"
        aria-label="Tocar ou pausar música de ninar"
        class="absolute right-3 sm:right-5 bottom-3 z-20 rounded-2xl px-3 py-2 flex items-center gap-2 border-2 transition shadow-md hover:scale-105 active:scale-95 ${
          params.lullabyPlaying
            ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-white ring-2 ring-indigo-300'
            : 'glass-pill border-indigo-200 text-[#3b1f6e]'
        }"
      >
        <span class="text-2xl leading-none">${params.lullabyPlaying ? '🎶' : '🎵'}</span>
        <div class="text-left leading-tight">
          <div class="text-[11px] font-extrabold">Ninar</div>
          <div class="text-[9px] font-bold opacity-85">${params.lullabyPlaying ? 'Tocando...' : 'Canção suave'}</div>
        </div>
      </button>
    `;
  }

  if (params.activeRoom === 'playroom') {
    return `
      <!-- Scratching Post (Left) -->
      <button
        id="btn-room-scratcher"
        type="button"
        aria-label="Usar o arranhador do Miau"
        class="absolute left-3 sm:left-5 bottom-3 z-20 glass-pill rounded-2xl px-3 py-2 flex items-center gap-2 border-2 border-orange-200 hover:scale-105 active:scale-95 transition shadow-md"
      >
        <span class="text-2xl leading-none">🪵</span>
        <div class="text-left leading-tight">
          <div class="text-[11px] font-extrabold text-[#3b1f6e]">Arranhador</div>
          <div class="text-[9px] font-bold text-orange-700">Afiar garras!</div>
        </div>
      </button>

      <!-- Toy Box (Bottom Center-Left so ball fits on right) -->
      <button
        id="btn-room-toybox"
        type="button"
        aria-label="Abrir caixa de brinquedos e minijogos"
        class="absolute left-1/2 -translate-x-1/2 bottom-3 z-20 glass-pill rounded-2xl px-3.5 py-2 flex items-center gap-2 border-2 border-pink-300 hover:scale-105 active:scale-95 transition shadow-md"
      >
        <span class="text-2xl leading-none">🧸</span>
        <div class="text-left leading-tight">
          <div class="text-[11px] font-extrabold text-[#3b1f6e]">Brinquedos</div>
          <div class="text-[9px] font-bold text-pink-700">Abrir jogos</div>
        </div>
      </button>
    `;
  }

  // Living Room default subtle room hint if needed (non-intrusive)
  return `
    <div class="pointer-events-none absolute top-2 left-3 z-10 text-[10px] font-bold ${params.isNight ? 'text-purple-200/75' : 'text-[#5b468f]/70'} easy-read-hide">
      ${room.emoji} ${escapeHtml(room.subtitle)}
    </div>
  `;
}
