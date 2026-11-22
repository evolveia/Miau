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

    resetTransforms();

    let targetDx = -110;
    let targetDy = -36;
    if (sprite && characterWrapEl) {
      const ballRect = sprite.getBoundingClientRect();
      const catRect = characterWrapEl.getBoundingClientRect();
      if (ballRect.width > 0 && catRect.width > 0) {
        const ballCx = ballRect.left + ballRect.width / 2;
        const ballCy = ballRect.top + ballRect.height / 2;
        const catTargetX = catRect.left + catRect.width * 0.56;
        const catTargetY = catRect.top + catRect.height * 0.62;
        targetDx = catTargetX - ballCx;
        targetDy = catTargetY - ballCy;
      }
    }

    const start = performance.now();
    const durationMs = 960;
    const hitT = 0.56;

    const tick = (now: number) => {
      if (disposed) return;
      const t = Math.min(1, (now - start) / durationMs);

      let curX = 0;
      let curY = 0;
      if (t <= hitT) {
        const p = t / hitT;
        const easeOut = 1 - Math.pow(1 - p, 2);
        curX = targetDx * easeOut;
        const arcLift = Math.sin(p * Math.PI) * 95;
        curY = targetDy * easeOut - arcLift;
      } else {
        const p = (t - hitT) / (1 - hitT);
        const easeInOut = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        curX = targetDx * (1 - easeInOut);
        const reboundArc = Math.sin(p * Math.PI) * 52;
        curY = targetDy * (1 - easeInOut) - reboundArc;
      }

      const rot = t * 540;
      const scale = 1 + Math.sin(t * Math.PI) * 0.16;

      if (sprite) {
        sprite.style.transform = `translate(${curX.toFixed(1)}px, ${curY.toFixed(1)}px) rotate(${rot.toFixed(1)}deg) scale(${scale.toFixed(3)})`;
      }
      if (shadow) {
        const liftFactor = Math.max(0, -curY);
        const sScale = Math.max(0.45, 1 - liftFactor / 210);
        shadow.style.transform = `translateX(${curX.toFixed(1)}px) scale(${sScale.toFixed(3)})`;
      }
      if (characterWrapEl) {
        // Miau leans toward the ball and hops happily when catching it
        const approach = Math.sin(t * Math.PI);
        const catDx = (targetDx < 0 ? 1 : -1) * approach * Math.min(48, Math.abs(targetDx) * 0.22);
        const catHop = Math.abs(Math.sin(t * Math.PI * 2)) * 22;
        characterWrapEl.style.transition = 'none';
        characterWrapEl.style.transform = `translate(${catDx.toFixed(1)}px, ${(-catHop).toFixed(1)}px) rotate(${(Math.sin(t * Math.PI * 2) * 5).toFixed(2)}deg)`;
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
