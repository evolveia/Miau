export function renderPreloaderHtml(progress: number): string {
  const clamped = Math.max(0, Math.min(100, Math.round(progress)));
  const dashOffset = 289 - (289 * clamped) / 100;
  return `
    <div
      class="w-full h-full miau-wallpaper flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style="background-color: transparent;"
    >
      <div
        class="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[155%] h-[36.5%] min-h-[210px] rounded-b-[100%] overflow-hidden"
        style="background: linear-gradient(180deg, #4b2184 0%, #552694 100%);"
      >
        <div
          class="w-full h-full miau-wallpaper opacity-95"
          style="filter: brightness(1.45) saturate(1.15);"
        ></div>
      </div>

      <div class="relative z-10 flex flex-col items-center pt-[8vh]">
        <div class="relative w-36 h-36 rounded-full bg-[#efe7ff]/95 shadow-[0_12px_30px_rgba(76,42,133,0.18)] flex items-center justify-center">
          <svg class="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" stroke="rgba(167,139,250,0.28)" stroke-width="5.5" fill="none"/>
            <circle
              id="preloader-ring"
              cx="50"
              cy="50"
              r="46"
              stroke="#7b48b5"
              stroke-width="5.5"
              stroke-linecap="round"
              fill="none"
              stroke-dasharray="289"
              stroke-dashoffset="${dashOffset}"
              style="transition: stroke-dashoffset 90ms linear"
            />
          </svg>
          <svg viewBox="0 0 80 80" class="w-[68px] h-[68px]">
            <path d="M26 52 C26 40, 54 40, 54 52 C54 61, 46 66, 40 66 C34 66, 26 61, 26 52 Z" fill="#f7c8c0" stroke="#3b1f6e" stroke-width="3.5"/>
            <ellipse cx="22" cy="34" rx="6.5" ry="8" fill="#f7c8c0" stroke="#3b1f6e" stroke-width="3.2" transform="rotate(-14 22 34)"/>
            <ellipse cx="34" cy="25" rx="6.5" ry="8.5" fill="#f7c8c0" stroke="#3b1f6e" stroke-width="3.2"/>
            <ellipse cx="47" cy="25" rx="6.5" ry="8.5" fill="#f7c8c0" stroke="#3b1f6e" stroke-width="3.2"/>
            <ellipse cx="58" cy="34" rx="6.5" ry="8" fill="#f7c8c0" stroke="#3b1f6e" stroke-width="3.2" transform="rotate(14 58 34)"/>
            <path d="M33 52 Q40 46 47 52 Q45 59 40 59 Q35 59 33 52 Z" fill="#f2929c"/>
          </svg>
        </div>
        <div class="mt-5 text-center">
          <h1 class="font-display text-[3.1rem] leading-none font-bold text-[#4c2a85] tracking-tight">Miau</h1>
          <div id="preloader-pct" class="mt-2.5 text-sm font-extrabold text-[#6e45a5] tracking-wide">${clamped}%</div>
        </div>
      </div>
    </div>
  `;
}

export function updatePreloaderProgressDom(
  root: HTMLElement,
  progress: number
): void {
  const clamped = Math.max(0, Math.min(100, Math.round(progress)));
  const pctEl = root.querySelector('#preloader-pct');
  const ringEl = root.querySelector('#preloader-ring') as SVGCircleElement | null;
  if (pctEl) pctEl.textContent = `${clamped}%`;
  if (ringEl) {
    const dash = 289 - (289 * clamped) / 100;
    ringEl.style.strokeDashoffset = String(dash);
  }
}
