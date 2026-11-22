export interface InteractiveBallController {
  dispose: () => void;
}

export function mountInteractiveBall(
  stageEl: HTMLElement,
  characterWrapEl: HTMLElement | null,
  onCatchBall: () => void
): InteractiveBallController {
  const existing = stageEl.querySelector('#miau-interactive-ball');
  existing?.remove();

  const ballBtn = document.createElement('button');
  ballBtn.id = 'miau-interactive-ball';
  ballBtn.type = 'button';
  ballBtn.setAttribute('aria-label', 'Jogar bolinha para o Miau');
  ballBtn.className =
    'absolute bottom-4 right-5 sm:right-8 z-20 w-16 h-16 flex flex-col items-center justify-center select-none touch-none cursor-pointer group focus:outline-none';
  ballBtn.innerHTML = `
    <div id="miau-ball-shadow" class="absolute -bottom-0.5 w-11 h-2.5 rounded-full bg-[#4c2a85]/25 blur-[2px] transition-transform duration-150"></div>
    <div id="miau-ball-sprite" class="relative w-12 h-12 rounded-full transition-transform duration-150 group-hover:scale-110 active:scale-95 drop-shadow-[0_6px_10px_rgba(76,42,133,0.28)]">
      <svg viewBox="0 0 64 64" class="w-full h-full">
        <defs>
          <radialGradient id="miauBallGrad" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#fff7ed"/>
            <stop offset="45%" stop-color="#fdba74"/>
            <stop offset="100%" stop-color="#ec4899"/>
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="28" fill="url(#miauBallGrad)" stroke="#3b1f6e" stroke-width="3.5"/>
        <path d="M12 19 Q32 32 52 19" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity="0.85"/>
        <path d="M12 45 Q32 32 52 45" fill="none" stroke="#a855f7" stroke-width="4" stroke-linecap="round" opacity="0.75"/>
        <circle cx="23" cy="21" r="4" fill="#ffffff" opacity="0.8"/>
      </svg>
    </div>
    <span class="mt-0.5 px-2 py-0.5 rounded-full bg-white/85 border border-purple-200 text-[9px] font-extrabold text-[#4c2a85] shadow-sm pointer-events-none">Bolinha</span>
  `;

  stageEl.appendChild(ballBtn);

  let animating = false;
  let rafId = 0;
  let disposed = false;

  const sprite = ballBtn.querySelector('#miau-ball-sprite') as HTMLElement | null;
  const shadow = ballBtn.querySelector('#miau-ball-shadow') as HTMLElement | null;

  const resetTransforms = () => {
    if (sprite) sprite.style.transform = '';
    if (shadow) shadow.style.transform = '';
    if (characterWrapEl) {
      characterWrapEl.style.transition = 'transform 220ms ease-out';
      characterWrapEl.style.transform = '';
    }
  };

  const handleThrow = (ev: Event) => {
    ev.stopPropagation();
    if (disposed || animating) return;
    animating = true;

    const start = performance.now();
    const durationMs = 920;

    const tick = (now: number) => {
      if (disposed) return;
      const t = Math.min(1, (now - start) / durationMs);

      // Parabolic bounce arc toward center stage then back
      const arcX = -Math.sin(t * Math.PI) * 92;
      const bounce1 = t < 0.55 ? Math.sin((t / 0.55) * Math.PI) * 115 : Math.sin(((t - 0.55) / 0.45) * Math.PI) * 42;
      const rot = t * 540;

      if (sprite) {
        sprite.style.transform = `translate(${arcX}px, ${-bounce1}px) rotate(${rot}deg) scale(${1 + Math.sin(t * Math.PI) * 0.16})`;
      }
      if (shadow) {
        const sScale = Math.max(0.45, 1 - bounce1 / 170);
        shadow.style.transform = `translateX(${arcX}px) scale(${sScale})`;
      }
      if (characterWrapEl) {
        // Miau dashes happily toward the ball and hops
        const catX = Math.sin(t * Math.PI) * 34;
        const catHop = Math.abs(Math.sin(t * Math.PI * 2)) * 22;
        characterWrapEl.style.transition = 'none';
        characterWrapEl.style.transform = `translate(${catX}px, ${-catHop}px) rotate(${Math.sin(t * Math.PI * 2) * 5}deg)`;
      }

      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        animating = false;
        resetTransforms();
        onCatchBall();
      }
    };

    rafId = requestAnimationFrame(tick);
  };

  ballBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  ballBtn.addEventListener('click', handleThrow);

  return {
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      resetTransforms();
      ballBtn.removeEventListener('click', handleThrow);
      ballBtn.remove();
    },
  };
}
