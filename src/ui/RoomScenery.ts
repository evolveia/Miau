export function renderRoomScenerySvg(
  backgroundId: string,
  isSleeping: boolean
): string {
  if (backgroundId === 'bg_sunny' && !isSleeping) {
    return `
      <svg viewBox="0 0 440 420" preserveAspectRatio="xMidYMid slice" class="w-full h-full pointer-events-none select-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="sunny-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#fef08a" stop-opacity="0.95"/>
            <stop offset="55%" stop-color="#fde047" stop-opacity="0.4"/>
            <stop offset="100%" stop-color="#fde047" stop-opacity="0"/>
          </radialGradient>
        </defs>

        <!-- Sun Aura & Rays -->
        <circle cx="352" cy="72" r="74" fill="url(#sunny-glow)" class="animate-sun-pulse"/>
        <g stroke="#fde047" stroke-width="5" stroke-linecap="round" opacity="0.88">
          <line x1="352" y1="22" x2="352" y2="8"/>
          <line x1="352" y1="122" x2="352" y2="136"/>
          <line x1="302" y1="72" x2="288" y2="72"/>
          <line x1="402" y1="72" x2="416" y2="72"/>
          <line x1="316" y1="36" x2="306" y2="26"/>
          <line x1="388" y1="108" x2="398" y2="118"/>
          <line x1="388" y1="36" x2="398" y2="26"/>
          <line x1="316" y1="108" x2="306" y2="118"/>
        </g>
        <circle cx="352" cy="72" r="32" fill="#facc15" stroke="#fef08a" stroke-width="4"/>

        <!-- Drifting Fluffy Clouds -->
        <g class="animate-cloud-drift" opacity="0.94">
          <g transform="translate(54, 48)">
            <ellipse cx="32" cy="24" rx="30" ry="16" fill="#ffffff"/>
            <circle cx="18" cy="18" r="15" fill="#ffffff"/>
            <circle cx="38" cy="14" r="18" fill="#ffffff"/>
            <circle cx="52" cy="22" r="13" fill="#ffffff"/>
          </g>
          <g transform="translate(198, 84) scale(0.82)">
            <ellipse cx="32" cy="24" rx="30" ry="16" fill="#ffffff"/>
            <circle cx="18" cy="18" r="15" fill="#ffffff"/>
            <circle cx="38" cy="14" r="18" fill="#ffffff"/>
            <circle cx="52" cy="22" r="13" fill="#ffffff"/>
          </g>
        </g>

        <!-- Distant Rolling Hills -->
        <path d="M-20 260 Q110 218 235 256 T460 248 L460 320 L-20 320 Z" fill="#86efac" opacity="0.72"/>
        <path d="M-20 272 Q155 236 300 264 T460 260 L460 340 L-20 340 Z" fill="#4ade80"/>

        <!-- Cartoon Leafy Tree on Left -->
        <g transform="translate(18, 92)">
          <ellipse cx="62" cy="184" rx="44" ry="11" fill="#16a34a" opacity="0.32"/>
          <path d="M50 182 Q54 140 50 102 L72 102 Q68 140 74 182 Z" fill="#92400e" stroke="#451a03" stroke-width="3.5" stroke-linejoin="round"/>
          <path d="M56 128 Q38 112 30 98" fill="none" stroke="#92400e" stroke-width="8" stroke-linecap="round"/>
          <path d="M68 122 Q86 106 94 94" fill="none" stroke="#92400e" stroke-width="7" stroke-linecap="round"/>
          <circle cx="36" cy="84" r="30" fill="#22c55e" stroke="#15803d" stroke-width="3.5"/>
          <circle cx="86" cy="84" r="28" fill="#22c55e" stroke="#15803d" stroke-width="3.5"/>
          <circle cx="62" cy="54" r="34" fill="#4ade80" stroke="#15803d" stroke-width="3.5"/>
          <circle cx="54" cy="78" r="26" fill="#4ade80"/>
          <circle cx="44" cy="54" r="5" fill="#fb7185"/>
          <circle cx="78" cy="74" r="4.5" fill="#fb7185"/>
          <circle cx="34" cy="92" r="4.5" fill="#fde047"/>
        </g>

        <!-- Foreground Meadow Grass & Little Flowers -->
        <path d="M-20 278 Q120 260 245 276 T460 272 L460 420 L-20 420 Z" fill="#22c55e"/>
        <path d="M-20 302 Q140 286 280 300 T460 295 L460 420 L-20 420 Z" fill="#16a34a" opacity="0.45"/>

        <g stroke="#15803d" stroke-width="3" stroke-linecap="round" fill="none">
          <path d="M44 338 L40 326 M48 338 L52 325"/>
          <path d="M368 310 L364 298 M372 310 L377 297"/>
          <path d="M392 360 L388 348 M396 360 L402 349"/>
        </g>
        <g transform="translate(362, 286)">
          <circle cx="0" cy="-6" r="4" fill="#ffffff"/>
          <circle cx="6" cy="0" r="4" fill="#ffffff"/>
          <circle cx="0" cy="6" r="4" fill="#ffffff"/>
          <circle cx="-6" cy="0" r="4" fill="#ffffff"/>
          <circle cx="0" cy="0" r="3.5" fill="#facc15"/>
        </g>
        <g transform="translate(86, 354) scale(0.9)">
          <circle cx="0" cy="-6" r="4" fill="#fbcfe8"/>
          <circle cx="6" cy="0" r="4" fill="#fbcfe8"/>
          <circle cx="0" cy="6" r="4" fill="#fbcfe8"/>
          <circle cx="-6" cy="0" r="4" fill="#fbcfe8"/>
          <circle cx="0" cy="0" r="3.5" fill="#fde047"/>
        </g>
      </svg>
    `;
  }

  if (backgroundId === 'bg_pastel_garden' && !isSleeping) {
    return `
      <svg viewBox="0 0 440 420" preserveAspectRatio="xMidYMid slice" class="w-full h-full pointer-events-none select-none" xmlns="http://www.w3.org/2000/svg">
        <!-- Soft Rainbow Arch -->
        <path d="M30 220 A190 165 0 0 1 410 220" fill="none" stroke="#fbcfe8" stroke-width="14" opacity="0.45"/>
        <path d="M44 220 A176 151 0 0 1 396 220" fill="none" stroke="#fde68a" stroke-width="12" opacity="0.45"/>
        <path d="M58 220 A162 137 0 0 1 382 220" fill="none" stroke="#bae6fd" stroke-width="10" opacity="0.45"/>

        <!-- Pastel Clouds -->
        <g class="animate-cloud-drift" opacity="0.88" fill="#ffffff">
          <g transform="translate(46, 34)">
            <ellipse cx="32" cy="20" rx="28" ry="13"/>
            <circle cx="18" cy="14" r="13"/>
            <circle cx="38" cy="11" r="15"/>
          </g>
          <g transform="translate(278, 56) scale(0.85)">
            <ellipse cx="32" cy="20" rx="28" ry="13"/>
            <circle cx="18" cy="14" r="13"/>
            <circle cx="38" cy="11" r="15"/>
          </g>
        </g>

        <!-- Pastel Hills & Meadow -->
        <path d="M-20 264 Q120 222 240 256 T460 248 L460 420 L-20 420 Z" fill="#bbf7d0"/>
        <path d="M-20 292 Q150 268 300 290 T460 282 L460 420 L-20 420 Z" fill="#86efac"/>

        <!-- Flower Bushes & Tulips -->
        <g transform="translate(52, 260)">
          <line x1="0" y1="36" x2="0" y2="8" stroke="#16a34a" stroke-width="3.5" stroke-linecap="round"/>
          <path d="M-10,8 Q-10,-8 0,2 Q10,-8 10,8 Q0,16 -10,8 Z" fill="#f472b6" stroke="#db2777" stroke-width="2"/>
        </g>
        <g transform="translate(88, 278)">
          <line x1="0" y1="32" x2="0" y2="6" stroke="#16a34a" stroke-width="3" stroke-linecap="round"/>
          <circle cx="0" cy="-4" r="6" fill="#c084fc"/>
          <circle cx="7" cy="2" r="6" fill="#c084fc"/>
          <circle cx="-7" cy="2" r="6" fill="#c084fc"/>
          <circle cx="0" cy="6" r="6" fill="#c084fc"/>
          <circle cx="0" cy="1" r="4" fill="#fde047"/>
        </g>
        <g transform="translate(362, 258)">
          <line x1="0" y1="40" x2="0" y2="8" stroke="#16a34a" stroke-width="3.5" stroke-linecap="round"/>
          <circle cx="0" cy="-6" r="7" fill="#fbcfe8"/>
          <circle cx="8" cy="0" r="7" fill="#fbcfe8"/>
          <circle cx="0" cy="6" r="7" fill="#fbcfe8"/>
          <circle cx="-8" cy="0" r="7" fill="#fbcfe8"/>
          <circle cx="0" cy="0" r="4.5" fill="#facc15"/>
        </g>
        <g transform="translate(394, 290)">
          <line x1="0" y1="34" x2="0" y2="8" stroke="#16a34a" stroke-width="3" stroke-linecap="round"/>
          <path d="M-9,8 Q-9,-7 0,2 Q9,-7 9,8 Q0,15 -9,8 Z" fill="#fb923c"/>
        </g>

        <!-- Butterflies -->
        <g class="animate-twinkle" transform="translate(96, 152)">
          <ellipse cx="-6" cy="-3" rx="6" ry="4" fill="#f472b6" transform="rotate(-20 -6 -3)"/>
          <ellipse cx="6" cy="-3" rx="6" ry="4" fill="#f472b6" transform="rotate(20 6 -3)"/>
          <ellipse cx="0" cy="0" rx="1.8" ry="6" fill="#4c2a85"/>
        </g>
        <g class="animate-twinkle" style="animation-delay:0.9s" transform="translate(338, 138)">
          <ellipse cx="-6" cy="-3" rx="6" ry="4" fill="#a78bfa" transform="rotate(-20 -6 -3)"/>
          <ellipse cx="6" cy="-3" rx="6" ry="4" fill="#a78bfa" transform="rotate(20 6 -3)"/>
          <ellipse cx="0" cy="0" rx="1.8" ry="6" fill="#4c2a85"/>
        </g>
      </svg>
    `;
  }

  if (backgroundId === 'bg_space' && !isSleeping) {
    return `
      <svg viewBox="0 0 440 420" preserveAspectRatio="xMidYMid slice" class="w-full h-full pointer-events-none select-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="nebula-pink" cx="30%" cy="28%" r="50%">
            <stop offset="0%" stop-color="#c084fc" stop-opacity="0.45"/>
            <stop offset="60%" stop-color="#6366f1" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="#1e1b4b" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="nebula-cyan" cx="76%" cy="34%" r="46%">
            <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.38"/>
            <stop offset="100%" stop-color="#1e1b4b" stop-opacity="0"/>
          </radialGradient>
        </defs>

        <rect width="440" height="300" fill="url(#nebula-pink)"/>
        <rect width="440" height="300" fill="url(#nebula-cyan)"/>

        <!-- Ringed Pastel Planet -->
        <g transform="translate(344, 82) rotate(-14)">
          <ellipse cx="0" cy="0" rx="54" ry="13" fill="none" stroke="#fde68a" stroke-width="6" opacity="0.72"/>
          <circle cx="0" cy="0" r="28" fill="#a78bfa"/>
          <path d="M-24 -6 Q0 4 24 -6" fill="none" stroke="#c4b5fd" stroke-width="5" opacity="0.75"/>
          <path d="M-54 0 A54 13 0 0 0 54 0" fill="none" stroke="#fde68a" stroke-width="6" opacity="0.85"/>
        </g>

        <!-- Distant Planet -->
        <circle cx="64" cy="96" r="18" fill="#fb7185" opacity="0.82"/>
        <circle cx="58" cy="91" r="6" fill="#fda4af" opacity="0.7"/>

        <!-- Twinkling Space Stars -->
        <g fill="#ffffff">
          <circle class="animate-twinkle" cx="32" cy="46" r="2"/>
          <circle class="animate-twinkle" style="animation-delay:0.4s" cx="122" cy="36" r="2.5"/>
          <circle class="animate-twinkle" style="animation-delay:0.9s" cx="212" cy="54" r="2.2"/>
          <circle class="animate-twinkle" style="animation-delay:1.4s" cx="268" cy="116" r="2"/>
          <circle class="animate-twinkle" style="animation-delay:0.7s" cx="144" cy="136" r="2.4"/>
          <circle class="animate-twinkle" style="animation-delay:1.8s" cx="394" cy="154" r="2.3"/>
          <path class="animate-twinkle" d="M88 158 L91 165 L98 168 L91 171 L88 178 L85 171 L78 168 L85 165 Z" fill="#bae6fd"/>
          <path class="animate-twinkle" style="animation-delay:1.1s" d="M262 32 L264 38 L270 40 L264 42 L262 48 L260 42 L254 40 L260 38 Z" fill="#fef08a"/>
        </g>

        <!-- Futuristic Station Window Trim & Floor Deck -->
        <path d="M-10 250 Q220 222 450 250 L450 264 Q220 236 -10 264 Z" fill="#6366f1" opacity="0.45"/>
        <ellipse cx="220" cy="340" rx="170" ry="34" fill="#4338ca" opacity="0.45"/>
      </svg>
    `;
  }

  if (backgroundId === 'bg_night' || isSleeping) {
    return `
      <svg viewBox="0 0 440 420" preserveAspectRatio="xMidYMid slice" class="w-full h-full pointer-events-none select-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="moon-aura" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#fef08a" stop-opacity="0.72"/>
            <stop offset="55%" stop-color="#fde047" stop-opacity="0.22"/>
            <stop offset="100%" stop-color="#fde047" stop-opacity="0"/>
          </radialGradient>
        </defs>

        <!-- Glowing Moon -->
        <circle cx="348" cy="74" r="68" fill="url(#moon-aura)"/>
        <g transform="translate(348, 74)">
          <circle cx="0" cy="0" r="31" fill="#fef08a"/>
          <circle cx="12" cy="-7" r="25" fill="#3e2d72"/>
          <circle cx="-11" cy="8" r="4.5" fill="#fde047" opacity="0.65"/>
          <circle cx="-14" cy="-9" r="3" fill="#fde047" opacity="0.55"/>
        </g>

        <!-- Twinkling Stars -->
        <g fill="#fef9c3">
          <path class="animate-twinkle" d="M54 44 L57 52 L65 55 L57 58 L54 66 L51 58 L43 55 L51 52 Z"/>
          <path class="animate-twinkle" style="animation-delay:0.6s" d="M148 30 L150 36 L156 38 L150 40 L148 46 L146 40 L140 38 L146 36 Z"/>
          <path class="animate-twinkle" style="animation-delay:1.1s" d="M244 54 L247 61 L254 64 L247 67 L244 74 L241 67 L234 64 L241 61 Z"/>
          <path class="animate-twinkle" style="animation-delay:0.35s" d="M98 110 L100 116 L106 118 L100 120 L98 126 L96 120 L90 118 L96 116 Z"/>
          <path class="animate-twinkle" style="animation-delay:1.5s" d="M398 134 L400 139 L405 141 L400 143 L398 148 L396 143 L391 141 L396 139 Z"/>
          <path class="animate-twinkle" style="animation-delay:0.9s" d="M286 122 L288 127 L293 129 L288 131 L286 136 L284 131 L279 129 L284 127 Z"/>

          <circle class="animate-twinkle" cx="32" cy="96" r="2.2"/>
          <circle class="animate-twinkle" style="animation-delay:0.4s" cx="118" cy="64" r="2.6"/>
          <circle class="animate-twinkle" style="animation-delay:0.8s" cx="192" cy="86" r="2"/>
          <circle class="animate-twinkle" style="animation-delay:1.2s" cx="276" cy="36" r="2.4"/>
          <circle class="animate-twinkle" style="animation-delay:1.6s" cx="412" cy="48" r="2.2"/>
          <circle class="animate-twinkle" style="animation-delay:0.5s" cx="164" cy="142" r="2.1"/>
          <circle class="animate-twinkle" style="animation-delay:1.3s" cx="62" cy="162" r="2.3"/>
          <circle class="animate-twinkle" style="animation-delay:1.9s" cx="332" cy="162" r="2.2"/>
        </g>

        <!-- Night Clouds -->
        <g class="animate-cloud-drift" opacity="0.28" fill="#c4b5fd">
          <g transform="translate(30, 128)">
            <ellipse cx="36" cy="20" rx="34" ry="13"/>
            <circle cx="20" cy="14" r="14"/>
            <circle cx="42" cy="11" r="16"/>
          </g>
          <g transform="translate(268, 152) scale(0.9)">
            <ellipse cx="36" cy="20" rx="34" ry="13"/>
            <circle cx="20" cy="14" r="14"/>
            <circle cx="42" cy="11" r="16"/>
          </g>
        </g>

        <path d="M-20 264 Q120 232 250 258 T460 252 L460 300 L-20 300 Z" fill="#312261" opacity="0.55"/>
      </svg>
    `;
  }

  if (backgroundId === 'bg_peach') {
    return `
      <svg viewBox="0 0 440 420" preserveAspectRatio="xMidYMid slice" class="w-full h-full pointer-events-none select-none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="336" cy="96" r="46" fill="#fed7aa" opacity="0.72"/>
        <circle cx="336" cy="96" r="28" fill="#fb923c" opacity="0.55"/>
        <g class="animate-cloud-drift" opacity="0.72" fill="#fff7ed">
          <g transform="translate(46, 62)">
            <ellipse cx="34" cy="20" rx="32" ry="14"/>
            <circle cx="22" cy="14" r="13"/>
            <circle cx="42" cy="12" r="15"/>
          </g>
          <g transform="translate(230, 118) scale(0.8)">
            <ellipse cx="34" cy="20" rx="32" ry="14"/>
            <circle cx="22" cy="14" r="13"/>
            <circle cx="42" cy="12" r="15"/>
          </g>
        </g>
      </svg>
    `;
  }

  // Default: Quarto Lilás Aconchegante (bg_lilac) with cozy window, soft light & plush cushion bed
  return `
    <svg viewBox="0 0 440 420" preserveAspectRatio="xMidYMid slice" class="w-full h-full pointer-events-none select-none" xmlns="http://www.w3.org/2000/svg">
      <!-- Window with soft daylight -->
      <g transform="translate(284, 34)">
        <rect x="0" y="0" width="114" height="122" rx="18" fill="#e0f2fe" stroke="#ffffff" stroke-width="6"/>
        <circle cx="84" cy="34" r="15" fill="#fef08a" opacity="0.88"/>
        <line x1="57" y1="0" x2="57" y2="122" stroke="#ffffff" stroke-width="5"/>
        <line x1="0" y1="61" x2="114" y2="61" stroke="#ffffff" stroke-width="5"/>
        <path d="M0 0 Q18 60 8 122 L0 122 Z" fill="#ddd6fe" opacity="0.75"/>
        <path d="M114 0 Q96 60 106 122 L114 122 Z" fill="#ddd6fe" opacity="0.75"/>
      </g>

      <!-- Soft diagonal window light -->
      <polygon points="284,156 398,156 330,290 190,290" fill="#ffffff" opacity="0.16"/>

      <!-- Cute framed paw picture on left wall -->
      <g transform="translate(36, 54)">
        <rect x="0" y="0" width="66" height="72" rx="12" fill="#faf5ff" stroke="#ffffff" stroke-width="4"/>
        <circle cx="33" cy="40" r="11" fill="#c084fc" opacity="0.55"/>
        <circle cx="21" cy="27" r="4.5" fill="#c084fc" opacity="0.55"/>
        <circle cx="33" cy="23" r="4.5" fill="#c084fc" opacity="0.55"/>
        <circle cx="45" cy="27" r="4.5" fill="#c084fc" opacity="0.55"/>
      </g>

      <!-- Cozy Cat Cushion / Bed on Floor Left -->
      <g transform="translate(26, 236)">
        <ellipse cx="48" cy="28" rx="46" ry="15" fill="#a78bfa" opacity="0.45"/>
        <ellipse cx="48" cy="22" rx="44" ry="16" fill="#f3e8ff" stroke="#c084fc" stroke-width="4"/>
        <ellipse cx="48" cy="20" rx="30" ry="10" fill="#ddd6fe"/>
      </g>

      <!-- Soft Round Lilac Rug beneath Miau -->
      <ellipse cx="220" cy="300" rx="142" ry="30" fill="#e9d5ff" opacity="0.52" stroke="#ffffff" stroke-width="3" stroke-opacity="0.6"/>
    </svg>
  `;
}
