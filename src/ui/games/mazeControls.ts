import { hapticService } from '../../services/hapticService';

export type MazeDirection = 'up' | 'down' | 'left' | 'right';

export const MAZE_DIR_VECTORS: Record<MazeDirection, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const MAZE_OPPOSITE_DIR: Record<MazeDirection, MazeDirection> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

/**
 * Pure next-turn buffer (Pac-Man style):
 * Stores an upcoming desired turn so swiping/pressing slightly before a maze
 * corner automatically executes the turn at the very next open intersection.
 */
export class TurnBufferQueue {
  private currentDir: MazeDirection;
  private bufferedDir: MazeDirection | null = null;
  private bufferedAtMs = 0;

  constructor(
    initialDir: MazeDirection = 'right',
    private readonly ttlMs = 1400
  ) {
    this.currentDir = initialDir;
  }

  public getCurrentDirection(): MazeDirection {
    return this.currentDir;
  }

  public getBufferedDirection(nowMs = Date.now()): MazeDirection | null {
    if (!this.bufferedDir) return null;
    if (nowMs - this.bufferedAtMs > this.ttlMs) {
      this.bufferedDir = null;
      return null;
    }
    return this.bufferedDir;
  }

  public setCurrentDirection(dir: MazeDirection): void {
    this.currentDir = dir;
    if (this.bufferedDir === dir) {
      this.bufferedDir = null;
    }
  }

  public enqueue(dir: MazeDirection, nowMs = Date.now()): void {
    if (dir === this.currentDir) {
      this.bufferedDir = null;
      return;
    }
    this.bufferedDir = dir;
    this.bufferedAtMs = nowMs;
  }

  public reset(initialDir: MazeDirection): void {
    this.currentDir = initialDir;
    this.bufferedDir = null;
    this.bufferedAtMs = 0;
  }

  /**
   * Resolves whether the actor should reverse immediately or take a buffered
   * perpendicular turn when aligned with an open corner/intersection.
   */
  public resolveTurn(
    canMove: (dir: MazeDirection) => boolean,
    isAlignedForCornerTurn: boolean,
    nowMs = Date.now()
  ): { dir: MazeDirection; turned: boolean } {
    const queued = this.getBufferedDirection(nowMs);
    if (!queued || queued === this.currentDir) {
      return { dir: this.currentDir, turned: false };
    }

    // Reversão 180° é imediata no corredor desde que a célula oposta esteja livre.
    if (queued === MAZE_OPPOSITE_DIR[this.currentDir] && canMove(queued)) {
      this.currentDir = queued;
      this.bufferedDir = null;
      return { dir: queued, turned: true };
    }

    // Curva de 90° em esquina: executa assim que estiver alinhado e o caminho abrir.
    if (isAlignedForCornerTurn && canMove(queued)) {
      this.currentDir = queued;
      this.bufferedDir = null;
      return { dir: queued, turned: true };
    }

    return { dir: this.currentDir, turned: false };
  }
}

export function detectSwipeDirection(
  dx: number,
  dy: number,
  thresholdPx = 16
): MazeDirection | null {
  if (Math.hypot(dx, dy) < thresholdPx) return null;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy > 0 ? 'down' : 'up';
}

export interface FloatingDpadPosition {
  left: number;
  top: number;
}

export function clampFloatingDpadPosition(
  pos: FloatingDpadPosition,
  containerRect: { width: number; height: number },
  padSize: { width: number; height: number },
  margin = 8
): FloatingDpadPosition {
  const maxLeft = Math.max(margin, containerRect.width - padSize.width - margin);
  const maxTop = Math.max(margin, containerRect.height - padSize.height - margin);
  return {
    left: Math.round(Math.max(margin, Math.min(maxLeft, pos.left))),
    top: Math.round(Math.max(margin, Math.min(maxTop, pos.top))),
  };
}

export function attachFullScreenMazeSwipe(
  targetEl: HTMLElement,
  onDirection: (dir: MazeDirection) => void,
  options?: {
    thresholdPx?: number;
    shouldIgnoreTarget?: (target: EventTarget | null) => boolean;
    isPaused?: () => boolean;
  }
): () => void {
  const thresholdPx = options?.thresholdPx ?? 16;
  let startX = 0;
  let startY = 0;
  let tracking = false;

  const onTouchStart = (e: TouchEvent) => {
    if (options?.shouldIgnoreTarget?.(e.target)) return;
    const t = e.touches[0];
    if (!t) return;
    startX = t.clientX;
    startY = t.clientY;
    tracking = true;
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!tracking || options?.isPaused?.()) return;
    const t = e.touches[0];
    if (!t) return;
    const dir = detectSwipeDirection(
      t.clientX - startX,
      t.clientY - startY,
      thresholdPx
    );
    if (!dir) return;
    onDirection(dir);
    // Reseta âncora para permitir curvas encadeadas sem tirar o dedo da tela.
    startX = t.clientX;
    startY = t.clientY;
  };

  const onTouchEnd = () => {
    tracking = false;
  };

  targetEl.addEventListener('touchstart', onTouchStart, { passive: true });
  targetEl.addEventListener('touchmove', onTouchMove, { passive: true });
  targetEl.addEventListener('touchend', onTouchEnd, { passive: true });
  targetEl.addEventListener('touchcancel', onTouchEnd, { passive: true });

  return () => {
    targetEl.removeEventListener('touchstart', onTouchStart);
    targetEl.removeEventListener('touchmove', onTouchMove);
    targetEl.removeEventListener('touchend', onTouchEnd);
    targetEl.removeEventListener('touchcancel', onTouchEnd);
  };
}

export function mountFloatingDpad(
  hostEl: HTMLElement,
  options: {
    storageKey: string;
    onDirection: (dir: MazeDirection) => void;
    theme?: 'neon' | 'pastel';
    repeatMs?: number;
  }
): () => void {
  const isNeon = options.theme === 'neon';
  const padEl = document.createElement('div');
  padEl.setAttribute('data-floating-dpad', 'true');
  padEl.className = `absolute z-15 rounded-2xl p-1.5 border shadow-xl select-none touch-none backdrop-blur-md transition-opacity ${
    isNeon
      ? 'bg-slate-900/75 border-blue-400/50 text-white'
      : 'bg-white/85 border-purple-300/90 text-[#3b1f6e]'
  }`;
  padEl.style.width = '136px';

  const btnCls = isNeon
    ? 'h-9 rounded-xl bg-blue-600/85 hover:bg-blue-500 active:scale-90 text-white font-extrabold text-sm shadow-sm flex items-center justify-center'
    : 'h-9 rounded-xl bg-[#6e45a5] hover:bg-[#5c3691] active:scale-90 text-white font-extrabold text-sm shadow-sm flex items-center justify-center';

  padEl.innerHTML = `
    <div class="flex items-center justify-between gap-1 mb-1 px-0.5">
      <button
        type="button"
        data-dpad-drag="true"
        title="Arraste para reposicionar o controle"
        class="flex-1 flex items-center gap-1 text-[9px] font-extrabold tracking-wide cursor-grab active:cursor-grabbing py-0.5 px-1 rounded-lg ${
          isNeon ? 'bg-slate-800/80 text-blue-200' : 'bg-purple-100/90 text-[#5a3696]'
        }"
      >
        <span>⋮⋮</span>
        <span>Mover</span>
      </button>
      <button
        type="button"
        data-dpad-reset="true"
        title="Centralizar embaixo"
        class="w-5 h-5 rounded-md text-[10px] font-extrabold flex items-center justify-center ${
          isNeon ? 'bg-slate-800/80 text-blue-200 hover:bg-slate-700' : 'bg-purple-100 text-[#5a3696] hover:bg-purple-200'
        }"
      >⌖</button>
      <button
        type="button"
        data-dpad-collapse="true"
        title="Recolher ou expandir D-pad"
        class="w-5 h-5 rounded-md text-[10px] font-extrabold flex items-center justify-center ${
          isNeon ? 'bg-slate-800/80 text-blue-200 hover:bg-slate-700' : 'bg-purple-100 text-[#5a3696] hover:bg-purple-200'
        }"
      >▾</button>
    </div>
    <div data-dpad-grid="true" class="grid grid-cols-3 gap-1">
      <div></div>
      <button data-dpad-dir="up" type="button" class="${btnCls}" aria-label="Cima">▲</button>
      <div></div>
      <button data-dpad-dir="left" type="button" class="${btnCls}" aria-label="Esquerda">◀</button>
      <button data-dpad-dir="down" type="button" class="${btnCls}" aria-label="Baixo">▼</button>
      <button data-dpad-dir="right" type="button" class="${btnCls}" aria-label="Direita">▶</button>
    </div>
  `;

  hostEl.appendChild(padEl);

  const getDefaultPosition = (): FloatingDpadPosition => {
    const rect = hostEl.getBoundingClientRect();
    const w = padEl.offsetWidth || 136;
    const h = padEl.offsetHeight || 110;
    return clampFloatingDpadPosition(
      { left: rect.width - w - 10, top: rect.height - h - 10 },
      rect,
      { width: w, height: h },
      8
    );
  };

  let currentPos: FloatingDpadPosition = getDefaultPosition();
  try {
    const saved = localStorage.getItem(options.storageKey);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<FloatingDpadPosition>;
      if (typeof parsed.left === 'number' && typeof parsed.top === 'number') {
        const rect = hostEl.getBoundingClientRect();
        currentPos = clampFloatingDpadPosition(
          { left: parsed.left, top: parsed.top },
          rect,
          { width: padEl.offsetWidth || 136, height: padEl.offsetHeight || 110 },
          8
        );
      }
    }
  } catch {
    // ignore storage errors
  }

  const applyPos = (pos: FloatingDpadPosition, persist = false) => {
    const rect = hostEl.getBoundingClientRect();
    const clamped =
      rect.width > 0 && rect.height > 0
        ? clampFloatingDpadPosition(
            pos,
            rect,
            {
              width: padEl.offsetWidth || 136,
              height: padEl.offsetHeight || 110,
            },
            8
          )
        : pos;
    currentPos = clamped;
    padEl.style.left = `${clamped.left}px`;
    padEl.style.top = `${clamped.top}px`;
    if (persist) {
      try {
        localStorage.setItem(options.storageKey, JSON.stringify(clamped));
      } catch {
        // ignore storage errors
      }
    }
  };

  applyPos(currentPos, false);

  const dragHandle = padEl.querySelector('[data-dpad-drag]') as HTMLElement;
  const resetBtn = padEl.querySelector('[data-dpad-reset]') as HTMLElement;
  const collapseBtn = padEl.querySelector('[data-dpad-collapse]') as HTMLElement;
  const gridEl = padEl.querySelector('[data-dpad-grid]') as HTMLElement;

  let collapsed = false;
  let dragging = false;
  let dragStartPointer = { x: 0, y: 0 };
  let dragStartPos = { left: 0, top: 0 };

  const onDragStart = (e: PointerEvent) => {
    e.stopPropagation();
    dragging = true;
    dragStartPointer = { x: e.clientX, y: e.clientY };
    dragStartPos = { ...currentPos };
    dragHandle.setPointerCapture?.(e.pointerId);
  };

  const onDragMove = (e: PointerEvent) => {
    if (!dragging) return;
    e.stopPropagation();
    const dx = e.clientX - dragStartPointer.x;
    const dy = e.clientY - dragStartPointer.y;
    applyPos({ left: dragStartPos.left + dx, top: dragStartPos.top + dy }, false);
  };

  const onDragEnd = (e: PointerEvent) => {
    if (!dragging) return;
    e.stopPropagation();
    dragging = false;
    applyPos(currentPos, true);
  };

  const onResetClick = (e: Event) => {
    e.stopPropagation();
    hapticService.tap();
    applyPos(getDefaultPosition(), true);
  };

  const onCollapseClick = (e: Event) => {
    e.stopPropagation();
    hapticService.tap();
    collapsed = !collapsed;
    gridEl.classList.toggle('hidden', collapsed);
    collapseBtn.textContent = collapsed ? '▴' : '▾';
    applyPos(currentPos, false);
  };

  dragHandle.addEventListener('pointerdown', onDragStart);
  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('pointerup', onDragEnd);
  window.addEventListener('pointercancel', onDragEnd);
  resetBtn.addEventListener('click', onResetClick);
  collapseBtn.addEventListener('click', onCollapseClick);

  let repeatTimer: number | null = null;
  const stopRepeat = () => {
    if (repeatTimer !== null) {
      window.clearInterval(repeatTimer);
      repeatTimer = null;
    }
  };

  const dirButtons = Array.from(
    padEl.querySelectorAll('[data-dpad-dir]')
  ) as HTMLButtonElement[];
  const dirCleanups = dirButtons.map((btn) => {
    const onDown = (e: PointerEvent) => {
      e.stopPropagation();
      const dir = btn.getAttribute('data-dpad-dir') as MazeDirection | null;
      if (!dir) return;
      hapticService.tap();
      options.onDirection(dir);
      if (options.repeatMs && options.repeatMs > 0) {
        stopRepeat();
        repeatTimer = window.setInterval(() => {
          options.onDirection(dir);
        }, options.repeatMs);
      }
    };
    btn.addEventListener('pointerdown', onDown);
    btn.addEventListener('pointerup', stopRepeat);
    btn.addEventListener('pointerleave', stopRepeat);
    btn.addEventListener('pointercancel', stopRepeat);
    return () => {
      btn.removeEventListener('pointerdown', onDown);
      btn.removeEventListener('pointerup', stopRepeat);
      btn.removeEventListener('pointerleave', stopRepeat);
      btn.removeEventListener('pointercancel', stopRepeat);
    };
  });

  const resizeObs = new ResizeObserver(() => applyPos(currentPos, false));
  resizeObs.observe(hostEl);

  return () => {
    stopRepeat();
    resizeObs.disconnect();
    dragHandle.removeEventListener('pointerdown', onDragStart);
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragEnd);
    window.removeEventListener('pointercancel', onDragEnd);
    resetBtn.removeEventListener('click', onResetClick);
    collapseBtn.removeEventListener('click', onCollapseClick);
    dirCleanups.forEach((off) => off());
    padEl.remove();
  };
}

export function renderPreGameRulesOverlayHtml(params: {
  title: string;
  subtitle: string;
  theme: 'neon' | 'pastel';
  objective: { icon: string; label: string; desc: string };
  scoring: { icon: string; label: string; desc: string };
  bonus: { icon: string; label: string; desc: string };
  startBtnId: string;
  startLabel?: string;
}): string {
  const isNeon = params.theme === 'neon';
  const cards = [params.objective, params.scoring, params.bonus];
  return `
    <div class="rounded-3xl p-4 sm:p-5 max-w-sm w-full text-center shadow-2xl border-2 ${
      isNeon
        ? 'bg-slate-950/95 border-blue-400 text-white'
        : 'bg-white border-purple-300 text-[#3b1f6e]'
    }">
      <h4 class="font-display text-lg font-bold ${isNeon ? 'text-amber-300' : 'text-[#3b1f6e]'}">${params.title}</h4>
      <p class="text-[11px] font-semibold mt-0.5 ${isNeon ? 'text-blue-200' : 'text-[#6b4d9e]'}">${params.subtitle}</p>
      <div class="grid grid-cols-3 gap-2 mt-3 text-center">
        ${cards
          .map(
            (card) => `
              <div class="rounded-2xl p-2 border flex flex-col items-center gap-1 ${
                isNeon
                  ? 'bg-slate-900/90 border-blue-500/40 text-blue-100'
                  : 'bg-purple-50 border-purple-200 text-[#3b1f6e]'
              }">
                <span class="text-2xl leading-none">${card.icon}</span>
                <span class="text-[10px] font-extrabold uppercase tracking-wide ${
                  isNeon ? 'text-cyan-300' : 'text-[#5a3696]'
                }">${card.label}</span>
                <span class="text-[10px] font-semibold leading-tight opacity-90">${card.desc}</span>
              </div>
            `
          )
          .join('')}
      </div>
      <div class="mt-2.5 text-[10px] font-semibold ${isNeon ? 'text-blue-200/85' : 'text-[#6b4d9e]'}">
        👆 Deslize na tela inteira com curva automática ou arraste o D-pad flutuante!
      </div>
      <button
        id="${params.startBtnId}"
        type="button"
        class="mt-3 w-full py-2.5 rounded-2xl font-extrabold text-xs shadow-md active:scale-95 transition ${
          isNeon
            ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950'
            : 'bg-gradient-to-r from-[#6e45a5] to-[#9b5de5] text-white'
        }"
      >
        ${params.startLabel || 'Começar! ▶'}
      </button>
    </div>
  `;
}
