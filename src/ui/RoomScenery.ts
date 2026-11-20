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
          <!-- Tree Shadow -->
          <ellipse cx="62" cy="184" rx="44" ry="11" fill="#16a34a" opacity="0.32"/>
          <!-- Trunk & Branches -->
          <path d="M50 182 Q54 140 50 102 L72 102 Q68 140 74 182 Z" fill="#92400e" stroke="#451a03" stroke-width="3.5" stroke-linejoin="round"/>
          <path d="M56 128 Q38 112 30 98" fill="none" stroke="#92400e" stroke-width="8" stroke-linecap="round"/>
          <path d="M68 122 Q86 106 94 94" fill="none" stroke="#92400e" stroke-width="7" stroke-linecap="round"/>
          <!-- Lush Foliage Canopy -->
          <circle cx="36" cy="84" r="30" fill="#22c55e" stroke="#15803d" stroke-width="3.5"/>
          <circle cx="86" cy="84" r="28" fill="#22c55e" stroke="#15803d" stroke-width="3.5"/>
          <circle cx="62" cy="54" r="34" fill="#4ade80" stroke="#15803d" stroke-width="3.5"/>
          <circle cx="54" cy="78" r="26" fill="#4ade80"/>
          <!-- Cute Apples/Blossoms on Tree -->
          <circle cx="44" cy="54" r="5" fill="#fb7185"/>
          <circle cx="78" cy="74" r="4.5" fill="#fb7185"/>
          <circle cx="34" cy="92" r="4.5" fill="#fde047"/>
        </g>

        <!-- Foreground Meadow Grass & Little Flowers -->
        <path d="M-20 278 Q120 260 245 276 T460 272 L460 420 L-20 420 Z" fill="#22c55e"/>
        <path d="M-20 302 Q140 286 280 300 T460 295 L460 420 L-20 420 Z" fill="#16a34a" opacity="0.45"/>

        <!-- Grass Tufts & Flowers -->
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

        <!-- Dreamy Night Silhouette Hills -->
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

  return '';
}
