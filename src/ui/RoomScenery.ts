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

  if (backgroundId === 'bg_jurassic' && !isSleeping) {
    return `
      <svg viewBox="0 0 440 420" preserveAspectRatio="xMidYMid slice" class="w-full h-full pointer-events-none select-none" xmlns="http://www.w3.org/2000/svg">
        <!-- Warm Jungle Sun & Distant Volcano -->
        <circle cx="92" cy="78" r="36" fill="#fde047" opacity="0.82"/>
        <polygon points="270,256 346,112 372,112 436,256" fill="#57534e" opacity="0.82"/>
        <ellipse cx="359" cy="112" rx="14" ry="5" fill="#ea580c"/>
        <circle cx="356" cy="86" r="14" fill="#d6d3d1" opacity="0.5"/>
        <circle cx="372" cy="68" r="18" fill="#e7e5e4" opacity="0.4"/>

        <!-- Cute Long-Neck Dino Silhouette -->
        <g transform="translate(308, 178)" fill="#3f6212" opacity="0.85">
          <ellipse cx="22" cy="54" rx="22" ry="12"/>
          <path d="M8,50 Q-4,16 6,-4 Q12,-8 18,-2 Q12,18 18,48 Z"/>
          <rect x="6" y="60" width="6" height="18" rx="3"/>
          <rect x="28" y="60" width="6" height="18" rx="3"/>
          <path d="M40,52 Q64,54 74,44" fill="none" stroke="#3f6212" stroke-width="6" stroke-linecap="round"/>
        </g>

        <!-- Jurassic Wooden Park Gate Pillar -->
        <g transform="translate(24, 156)">
          <rect x="0" y="18" width="16" height="92" rx="4" fill="#78350f"/>
          <rect x="64" y="18" width="16" height="92" rx="4" fill="#78350f"/>
          <path d="M-8,22 Q40,-6 88,22 L82,36 Q40,14 -2,36 Z" fill="#92400e"/>
          <circle cx="10" cy="46" r="5" fill="#f97316"/>
          <circle cx="70" cy="46" r="5" fill="#f97316"/>
        </g>

        <!-- Tropical Hills & Ferns -->
        <path d="M-20 264 Q120 226 260 258 T460 248 L460 420 L-20 420 Z" fill="#65a30d"/>
        <path d="M-20 296 Q150 272 310 294 T460 284 L460 420 L-20 420 Z" fill="#4d7c0f"/>
        <path d="M18 320 Q36 286 58 310 M38 322 Q54 276 74 304" fill="none" stroke="#bef264" stroke-width="5" stroke-linecap="round"/>
        <path d="M366 320 Q384 282 408 308 M384 322 Q402 276 420 302" fill="none" stroke="#bef264" stroke-width="5" stroke-linecap="round"/>
      </svg>
    `;
  }

  if (backgroundId === 'bg_hogwarts' && !isSleeping) {
    return `
      <svg viewBox="0 0 440 420" preserveAspectRatio="xMidYMid slice" class="w-full h-full pointer-events-none select-none" xmlns="http://www.w3.org/2000/svg">
        <!-- Starry Magic Sky & Full Moon -->
        <circle cx="88" cy="74" r="28" fill="#fef08a" opacity="0.88"/>
        <g fill="#fef9c3">
          <circle class="animate-twinkle" cx="164" cy="42" r="2.5"/>
          <circle class="animate-twinkle" style="animation-delay:0.5s" cx="256" cy="58" r="2.2"/>
          <circle class="animate-twinkle" style="animation-delay:1.1s" cx="388" cy="48" r="2.6"/>
          <circle class="animate-twinkle" style="animation-delay:0.8s" cx="44" cy="132" r="2"/>
        </g>

        <!-- Magic Castle Silhouette on Cliff -->
        <g fill="#31105f" opacity="0.9">
          <rect x="278" y="136" width="38" height="128"/>
          <polygon points="274,136 297,86 320,136"/>
          <rect x="316" y="156" width="52" height="108"/>
          <polygon points="326,156 342,110 358,156"/>
          <rect x="366" y="122" width="32" height="142"/>
          <polygon points="362,122 382,74 402,122"/>
          <!-- Glowing Warm Castle Windows -->
          <rect x="292" y="154" width="8" height="14" rx="4" fill="#fde047"/>
          <rect x="334" y="176" width="8" height="14" rx="4" fill="#fde047"/>
          <rect x="350" y="176" width="8" height="14" rx="4" fill="#fde047"/>
          <rect x="378" y="144" width="8" height="14" rx="4" fill="#fde047"/>
        </g>

        <!-- Floating Magic Candles -->
        <g transform="translate(52, 114)">
          <rect x="-3" y="0" width="6" height="18" rx="2" fill="#fffbeb"/>
          <ellipse cx="0" cy="-5" rx="3.5" ry="5.5" fill="#facc15"/>
        </g>
        <g transform="translate(114, 92)">
          <rect x="-3" y="0" width="6" height="16" rx="2" fill="#fffbeb"/>
          <ellipse cx="0" cy="-5" rx="3.5" ry="5.5" fill="#fb923c"/>
        </g>
        <g transform="translate(212, 74)">
          <rect x="-3" y="0" width="6" height="16" rx="2" fill="#fffbeb"/>
          <ellipse cx="0" cy="-5" rx="3.5" ry="5.5" fill="#facc15"/>
        </g>

        <path d="M-20 264 Q140 232 280 258 T460 248 L460 420 L-20 420 Z" fill="#3b0764" opacity="0.65"/>
      </svg>
    `;
  }

  if (backgroundId === 'bg_cyberpunk' && !isSleeping) {
    return `
      <svg viewBox="0 0 440 420" preserveAspectRatio="xMidYMid slice" class="w-full h-full pointer-events-none select-none" xmlns="http://www.w3.org/2000/svg">
        <!-- Cyber Neon Horizon Sun -->
        <circle cx="220" cy="140" r="64" fill="#f43f5e" opacity="0.35"/>
        <rect x="148" y="146" width="144" height="6" fill="#0f172a"/>
        <rect x="148" y="160" width="144" height="8" fill="#0f172a"/>

        <!-- Neon City Towers -->
        <g fill="#0f172a" opacity="0.92">
          <rect x="18" y="110" width="52" height="156" rx="3"/>
          <rect x="78" y="84" width="44" height="182" rx="3"/>
          <rect x="310" y="92" width="50" height="174" rx="3"/>
          <rect x="368" y="124" width="54" height="142" rx="3"/>
        </g>
        <!-- Neon Strips & Hologram Sign -->
        <line x1="28" y1="122" x2="28" y2="244" stroke="#22d3ee" stroke-width="3.5"/>
        <line x1="112" y1="96" x2="112" y2="244" stroke="#ec4899" stroke-width="3.5"/>
        <line x1="322" y1="104" x2="322" y2="244" stroke="#22d3ee" stroke-width="3.5"/>
        <rect x="376" y="140" width="38" height="24" rx="4" fill="#1e1b4b" stroke="#f472b6" stroke-width="2.5"/>
        <circle cx="395" cy="152" r="5" fill="#22d3ee"/>

        <!-- Perspective Neon Grid Floor -->
        <path d="M0 264 L440 264 L440 420 L0 420 Z" fill="#1e1b4b" opacity="0.88"/>
        <g stroke="#06b6d4" stroke-width="1.5" opacity="0.48">
          <line x1="0" y1="280" x2="440" y2="280"/>
          <line x1="0" y1="312" x2="440" y2="312"/>
          <line x1="0" y1="354" x2="440" y2="354"/>
          <line x1="220" y1="264" x2="20" y2="420"/>
          <line x1="220" y1="264" x2="130" y2="420"/>
          <line x1="220" y1="264" x2="310" y2="420"/>
          <line x1="220" y1="264" x2="420" y2="420"/>
        </g>
      </svg>
    `;
  }

  if (backgroundId === 'bg_city' && !isSleeping) {
    return `
      <svg viewBox="0 0 440 420" preserveAspectRatio="xMidYMid slice" class="w-full h-full pointer-events-none select-none" xmlns="http://www.w3.org/2000/svg">
        <!-- Sunny Urban Sky & Clouds -->
        <circle cx="364" cy="68" r="28" fill="#fde047"/>
        <g class="animate-cloud-drift" fill="#ffffff" opacity="0.9">
          <ellipse cx="90" cy="62" rx="34" ry="15"/>
          <circle cx="78" cy="52" r="14"/>
          <circle cx="100" cy="50" r="16"/>
        </g>

        <!-- Colorful City Buildings -->
        <rect x="24" y="132" width="56" height="134" rx="6" fill="#60a5fa"/>
        <rect x="86" y="102" width="60" height="164" rx="6" fill="#818cf8"/>
        <rect x="292" y="114" width="58" height="152" rx="6" fill="#38bdf8"/>
        <rect x="356" y="142" width="58" height="124" rx="6" fill="#a78bfa"/>
        <g fill="#fef9c3" opacity="0.9">
          <rect x="36" y="148" width="12" height="16" rx="2"/>
          <rect x="56" y="148" width="12" height="16" rx="2"/>
          <rect x="98" y="120" width="14" height="18" rx="2"/>
          <rect x="120" y="120" width="14" height="18" rx="2"/>
          <rect x="304" y="132" width="14" height="18" rx="2"/>
          <rect x="326" y="132" width="14" height="18" rx="2"/>
        </g>

        <!-- City Park Trees & Sidewalk -->
        <path d="M-20 264 L460 264 L460 420 L-20 420 Z" fill="#cbd5e1"/>
        <path d="M-20 264 L460 264 L460 282 L-20 282 Z" fill="#4ade80"/>
        <circle cx="52" cy="242" r="22" fill="#22c55e"/>
        <circle cx="388" cy="242" r="22" fill="#22c55e"/>
      </svg>
    `;
  }

  if (backgroundId === 'bg_marvel' && !isSleeping) {
    return `
      <svg viewBox="0 0 440 420" preserveAspectRatio="xMidYMid slice" class="w-full h-full pointer-events-none select-none" xmlns="http://www.w3.org/2000/svg">
        <!-- Heroic Sunset Aura -->
        <circle cx="220" cy="148" r="110" fill="#fb923c" opacity="0.28"/>

        <!-- Futuristic Hero Tower Silhouette -->
        <g fill="#1e293b" opacity="0.88">
          <path d="M294 264 L322 72 L364 96 L388 264 Z"/>
          <rect x="326" y="114" width="44" height="14" rx="4" fill="#38bdf8"/>
          <circle cx="348" cy="121" r="9" fill="#e0f2fe"/>
          <rect x="28" y="156" width="56" height="108" rx="4"/>
          <rect x="92" y="182" width="42" height="82" rx="4"/>
        </g>
        <!-- Hero Energy Streaks -->
        <path d="M30 88 L128 62" stroke="#facc15" stroke-width="4" stroke-linecap="round" opacity="0.72"/>
        <path d="M48 104 L112 86" stroke="#ef4444" stroke-width="3.5" stroke-linecap="round" opacity="0.72"/>

        <path d="M-20 264 L460 264 L460 420 L-20 420 Z" fill="#1e3a8a" opacity="0.55"/>
      </svg>
    `;
  }

  if (backgroundId === 'bg_dc' && !isSleeping) {
    return `
      <svg viewBox="0 0 440 420" preserveAspectRatio="xMidYMid slice" class="w-full h-full pointer-events-none select-none" xmlns="http://www.w3.org/2000/svg">
        <!-- Gotham Spotlight Beam & Full Moon -->
        <polygon points="74,264 292,52 368,108 112,264" fill="#fef08a" opacity="0.16"/>
        <circle cx="326" cy="82" r="36" fill="#fef08a" opacity="0.88"/>
        <path d="M312,84 Q326,70 340,84 Q330,90 326,82 Q322,90 312,84 Z" fill="#0f172a"/>

        <!-- Gothic Skyscrapers -->
        <g fill="#0f172a" opacity="0.92">
          <rect x="18" y="128" width="48" height="136"/>
          <polygon points="18,128 42,92 66,128"/>
          <rect x="74" y="148" width="44" height="116"/>
          <rect x="318" y="138" width="50" height="126"/>
          <rect x="374" y="116" width="48" height="148"/>
          <polygon points="374,116 398,80 422,116"/>
        </g>
        <g fill="#facc15" opacity="0.65">
          <rect x="32" y="148" width="8" height="12"/>
          <rect x="46" y="172" width="8" height="12"/>
          <rect x="392" y="140" width="8" height="12"/>
        </g>
        <path d="M-20 264 L460 264 L460 420 L-20 420 Z" fill="#020617" opacity="0.6"/>
      </svg>
    `;
  }

  if (backgroundId === 'bg_halloween' && !isSleeping) {
    return `
      <svg viewBox="0 0 440 420" preserveAspectRatio="xMidYMid slice" class="w-full h-full pointer-events-none select-none" xmlns="http://www.w3.org/2000/svg">
        <!-- Giant Spooky Moon -->
        <circle cx="342" cy="82" r="46" fill="#fed7aa" opacity="0.88"/>
        <!-- Flying Bats -->
        <path d="M62,74 Q74,62 84,74 Q94,62 106,74 Q92,78 84,72 Q76,78 62,74 Z" fill="#1e1b4b"/>
        <path d="M174,54 Q183,45 190,54 Q197,45 206,54 Q195,57 190,52 Q185,57 174,54 Z" fill="#1e1b4b"/>

        <!-- Haunted Hill & Cute Spooky House -->
        <g fill="#2e1065" opacity="0.9">
          <rect x="28" y="156" width="66" height="106"/>
          <polygon points="20,156 61,110 102,156"/>
          <rect x="44" y="174" width="12" height="16" rx="2" fill="#f97316"/>
          <rect x="66" y="174" width="12" height="16" rx="2" fill="#f97316"/>
        </g>

        <!-- Glowing Pumpkins on Grass -->
        <path d="M-20 264 Q140 238 280 260 T460 252 L460 420 L-20 420 Z" fill="#3b0764"/>
        <g transform="translate(370, 266)">
          <ellipse cx="0" cy="0" rx="22" ry="16" fill="#f97316"/>
          <polygon points="-9,-3 -5,-8 -1,-3" fill="#fef08a"/>
          <polygon points="9,-3 5,-8 1,-3" fill="#fef08a"/>
          <path d="M-8,5 Q0,11 8,5" fill="none" stroke="#fef08a" stroke-width="3" stroke-linecap="round"/>
        </g>
      </svg>
    `;
  }

  if (backgroundId === 'bg_natal' && !isSleeping) {
    return `
      <svg viewBox="0 0 440 420" preserveAspectRatio="xMidYMid slice" class="w-full h-full pointer-events-none select-none" xmlns="http://www.w3.org/2000/svg">
        <!-- Falling Snowflakes -->
        <g fill="#ffffff" opacity="0.88">
          <circle class="animate-twinkle" cx="48" cy="46" r="3.5"/>
          <circle class="animate-twinkle" style="animation-delay:0.4s" cx="122" cy="72" r="4"/>
          <circle class="animate-twinkle" style="animation-delay:0.8s" cx="204" cy="44" r="3"/>
          <circle class="animate-twinkle" style="animation-delay:1.2s" cx="272" cy="88" r="3.8"/>
          <circle class="animate-twinkle" style="animation-delay:0.6s" cx="388" cy="54" r="3.5"/>
          <circle class="animate-twinkle" style="animation-delay:1.5s" cx="164" cy="128" r="3"/>
        </g>

        <!-- Cozy Decorated Christmas Tree -->
        <g transform="translate(352, 168)">
          <rect x="-10" y="74" width="20" height="24" fill="#78350f"/>
          <polygon points="0,-64 -38,-8 38,-8" fill="#16a34a"/>
          <polygon points="0,-30 -48,32 48,32" fill="#15803d"/>
          <polygon points="0,8 -58,76 58,76" fill="#166534"/>
          <polygon points="0,-78 5,-66 17,-66 7,-59 11,-47 0,-54 -11,-47 -7,-59 -17,-66 -5,-66" fill="#facc15"/>
          <circle cx="-12" cy="-22" r="4.5" fill="#ef4444"/>
          <circle cx="14" cy="14" r="4.5" fill="#fde047"/>
          <circle cx="-18" cy="44" r="5" fill="#38bdf8"/>
          <circle cx="20" cy="54" r="5" fill="#f472b6"/>
        </g>

        <!-- Gifts & Snowy Floor -->
        <path d="M-20 264 Q140 242 280 260 T460 254 L460 420 L-20 420 Z" fill="#f8fafc"/>
        <g transform="translate(46, 242)">
          <rect x="0" y="0" width="32" height="28" rx="4" fill="#ef4444"/>
          <rect x="13" y="0" width="6" height="28" fill="#facc15"/>
          <rect x="0" y="11" width="32" height="6" fill="#facc15"/>
        </g>
        <g transform="translate(86, 250)">
          <rect x="0" y="0" width="26" height="22" rx="4" fill="#22c55e"/>
          <rect x="10" y="0" width="6" height="22" fill="#ffffff"/>
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
