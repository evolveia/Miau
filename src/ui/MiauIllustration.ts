import type { EquippedItems, MiauMood } from '../types';

export function renderMiauSvg(
  mood: MiauMood,
  equipped: EquippedItems,
  isSleeping: boolean
): string {
  const effectiveMood: MiauMood = isSleeping ? 'sleepy' : mood;

  const eyesSvg =
    effectiveMood === 'sleepy'
      ? `
        <path d="M126 146 Q137 156 148 146" fill="none" stroke="#1b1024" stroke-width="5.5" stroke-linecap="round"/>
        <path d="M192 146 Q203 156 214 146" fill="none" stroke="#1b1024" stroke-width="5.5" stroke-linecap="round"/>
      `
      : effectiveMood === 'affectionate'
        ? `
        <path d="M126 148 Q137 134 148 148" fill="none" stroke="#1b1024" stroke-width="5.5" stroke-linecap="round"/>
        <path d="M192 148 Q203 134 214 148" fill="none" stroke="#1b1024" stroke-width="5.5" stroke-linecap="round"/>
      `
        : `
        <g class="animate-eye-blink">
          <circle cx="137" cy="144" r="12" fill="#1b1024"/>
          <circle cx="133" cy="139" r="4.2" fill="#ffffff"/>
          <circle cx="203" cy="144" r="12" fill="#1b1024"/>
          <circle cx="199" cy="139" r="4.2" fill="#ffffff"/>
        </g>
      `;

  let mouthSvg = `
    <path d="M153 166 Q161 174 170 165 Q179 174 187 166" fill="none" stroke="#1b1024" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M157 170 Q170 202 183 170 Z" fill="#6d232b" stroke="#1b1024" stroke-width="4" stroke-linejoin="round"/>
    <path d="M163 184 Q170 177 177 184 Q170 194 163 184 Z" fill="#f28b95"/>
  `;

  if (effectiveMood === 'hungry') {
    mouthSvg = `
      <path d="M156 167 Q163 174 170 166 Q177 174 184 167" fill="none" stroke="#1b1024" stroke-width="4.5" stroke-linecap="round"/>
      <ellipse cx="170" cy="180" rx="7" ry="6" fill="#6d232b" stroke="#1b1024" stroke-width="3.5"/>
    `;
  } else if (effectiveMood === 'sleepy') {
    mouthSvg = `
      <path d="M159 169 Q170 175 181 169" fill="none" stroke="#1b1024" stroke-width="4.5" stroke-linecap="round"/>
    `;
  } else if (effectiveMood === 'eating') {
    mouthSvg = `
      <path d="M154 167 Q170 178 186 167" fill="none" stroke="#1b1024" stroke-width="4.5" stroke-linecap="round"/>
      <circle cx="170" cy="180" r="8" fill="#f28b95" stroke="#1b1024" stroke-width="3.5"/>
    `;
  }

  let hatSvg = '';
  if (equipped.hat === 'hat_party') {
    hatSvg = `
      <g transform="translate(170, 62)">
        <polygon points="-24,18 0,-40 24,18" fill="#50b6e8" stroke="#1b1024" stroke-width="5" stroke-linejoin="round"/>
        <path d="M-15,2 L15,2" stroke="#fcd34d" stroke-width="4.5" stroke-linecap="round"/>
        <circle cx="-6" cy="-12" r="4" fill="#f472b6"/>
        <circle cx="8" cy="-4" r="3.5" fill="#fde047"/>
        <circle cx="0" cy="10" r="3.5" fill="#a78bfa"/>
        <polygon points="0,-52 4,-43 13,-43 6,-37 9,-28 0,-34 -9,-28 -6,-37 -13,-43 -4,-43" fill="#fde047" stroke="#1b1024" stroke-width="3.2" stroke-linejoin="round"/>
      </g>
    `;
  } else if (equipped.hat === 'hat_crown') {
    hatSvg = `
      <g transform="translate(170, 60)">
        <polygon points="-28,16 -32,-16 -12,-2 0,-24 12,-2 32,-16 28,16" fill="#facc15" stroke="#1b1024" stroke-width="5" stroke-linejoin="round"/>
        <circle cx="0" cy="-2" r="4.5" fill="#ec4899" stroke="#1b1024" stroke-width="2"/>
        <circle cx="-18" cy="4" r="3.5" fill="#38bdf8" stroke="#1b1024" stroke-width="2"/>
        <circle cx="18" cy="4" r="3.5" fill="#38bdf8" stroke="#1b1024" stroke-width="2"/>
      </g>
    `;
  } else if (equipped.hat === 'hat_wizard') {
    hatSvg = `
      <g transform="translate(170, 58)">
        <ellipse cx="0" cy="16" rx="44" ry="11" fill="#7c3aed" stroke="#1b1024" stroke-width="5"/>
        <polygon points="-24,14 4,-44 24,14" fill="#8b5cf6" stroke="#1b1024" stroke-width="5" stroke-linejoin="round"/>
        <path d="M-17,6 Q0,11 17,6" stroke="#fde047" stroke-width="5" fill="none"/>
        <circle cx="-2" cy="-16" r="4" fill="#fde047"/>
      </g>
    `;
  } else if (equipped.hat === 'hat_flower') {
    hatSvg = `
      <g transform="translate(170, 74)">
        <path d="M-40,12 Q0,-4 40,12" fill="none" stroke="#4ade80" stroke-width="5" stroke-linecap="round"/>
        <g transform="translate(-26, 2) scale(0.75)">
          <circle cx="0" cy="-11" r="8" fill="#fbcfe8" stroke="#1b1024" stroke-width="3.2"/>
          <circle cx="10" cy="-2" r="8" fill="#fbcfe8" stroke="#1b1024" stroke-width="3.2"/>
          <circle cx="6" cy="9" r="8" fill="#fbcfe8" stroke="#1b1024" stroke-width="3.2"/>
          <circle cx="-6" cy="9" r="8" fill="#fbcfe8" stroke="#1b1024" stroke-width="3.2"/>
          <circle cx="-10" cy="-2" r="8" fill="#fbcfe8" stroke="#1b1024" stroke-width="3.2"/>
          <circle cx="0" cy="1" r="6" fill="#fde047" stroke="#1b1024" stroke-width="3"/>
        </g>
        <g transform="translate(0, -4) scale(0.88)">
          <circle cx="0" cy="-11" r="8" fill="#f9a8d4" stroke="#1b1024" stroke-width="3.2"/>
          <circle cx="10" cy="-2" r="8" fill="#f9a8d4" stroke="#1b1024" stroke-width="3.2"/>
          <circle cx="6" cy="9" r="8" fill="#f9a8d4" stroke="#1b1024" stroke-width="3.2"/>
          <circle cx="-6" cy="9" r="8" fill="#f9a8d4" stroke="#1b1024" stroke-width="3.2"/>
          <circle cx="-10" cy="-2" r="8" fill="#f9a8d4" stroke="#1b1024" stroke-width="3.2"/>
          <circle cx="0" cy="1" r="6" fill="#fde047" stroke="#1b1024" stroke-width="3"/>
        </g>
        <g transform="translate(26, 2) scale(0.75)">
          <circle cx="0" cy="-11" r="8" fill="#fbcfe8" stroke="#1b1024" stroke-width="3.2"/>
          <circle cx="10" cy="-2" r="8" fill="#fbcfe8" stroke="#1b1024" stroke-width="3.2"/>
          <circle cx="6" cy="9" r="8" fill="#fbcfe8" stroke="#1b1024" stroke-width="3.2"/>
          <circle cx="-6" cy="9" r="8" fill="#fbcfe8" stroke="#1b1024" stroke-width="3.2"/>
          <circle cx="-10" cy="-2" r="8" fill="#fbcfe8" stroke="#1b1024" stroke-width="3.2"/>
          <circle cx="0" cy="1" r="6" fill="#fde047" stroke="#1b1024" stroke-width="3"/>
        </g>
      </g>
    `;
  } else if (equipped.hat === 'hat_beret') {
    hatSvg = `
      <g transform="translate(166, 62) rotate(-10)">
        <line x1="0" y1="-22" x2="-3" y2="-33" stroke="#1b1024" stroke-width="5" stroke-linecap="round"/>
        <path d="M-38,10 C-44,-16 42,-20 40,8 C38,20 -34,20 -38,10 Z" fill="#e11d48" stroke="#1b1024" stroke-width="4.8" stroke-linejoin="round"/>
        <path d="M-28,15 Q0,21 28,15" fill="none" stroke="#1b1024" stroke-width="5" stroke-linecap="round"/>
        <ellipse cx="-12" cy="-5" rx="11" ry="4" fill="#fb7185" opacity="0.65"/>
      </g>
    `;
  } else if (equipped.hat === 'hat_bunny') {
    hatSvg = `
      <g transform="translate(170, 74)">
        <path d="M-38,12 Q0,-6 38,12" fill="none" stroke="#f472b6" stroke-width="6.5" stroke-linecap="round"/>
        <g transform="translate(-20, -2) rotate(-12)">
          <ellipse cx="0" cy="-28" rx="13" ry="30" fill="#ffffff" stroke="#1b1024" stroke-width="4.8"/>
          <ellipse cx="0" cy="-26" rx="6.5" ry="20" fill="#fbcfe8"/>
        </g>
        <g transform="translate(20, -2) rotate(12)">
          <ellipse cx="0" cy="-28" rx="13" ry="30" fill="#ffffff" stroke="#1b1024" stroke-width="4.8"/>
          <ellipse cx="0" cy="-26" rx="6.5" ry="20" fill="#fbcfe8"/>
        </g>
      </g>
    `;
  } else if (equipped.hat === 'hat_pirate') {
    hatSvg = `
      <g transform="translate(170, 62)">
        <path d="M-46,16 Q-44,-14 0,-28 Q44,-14 46,16 Q0,6 -46,16 Z" fill="#312e81" stroke="#1b1024" stroke-width="4.8" stroke-linejoin="round"/>
        <path d="M-46,16 Q0,6 46,16" fill="none" stroke="#facc15" stroke-width="4.5" stroke-linecap="round"/>
        <circle cx="0" cy="-5" r="8.5" fill="#ffffff" stroke="#1b1024" stroke-width="2.5"/>
        <circle cx="-3" cy="-6" r="1.7" fill="#1b1024"/>
        <circle cx="3" cy="-6" r="1.7" fill="#1b1024"/>
        <line x1="-10" y1="3" x2="10" y2="-11" stroke="#ffffff" stroke-width="2.8" stroke-linecap="round"/>
        <line x1="10" y1="3" x2="-10" y2="-11" stroke="#ffffff" stroke-width="2.8" stroke-linecap="round"/>
      </g>
    `;
  } else if (equipped.hat === 'hat_astronaut') {
    hatSvg = `
      <g>
        <line x1="170" y1="54" x2="170" y2="34" stroke="#1b1024" stroke-width="4.5" stroke-linecap="round"/>
        <circle cx="170" cy="30" r="6" fill="#38bdf8" stroke="#1b1024" stroke-width="3.5"/>
        <ellipse cx="170" cy="144" rx="102" ry="90" fill="rgba(186, 230, 253, 0.24)" stroke="#60a5fa" stroke-width="5.5"/>
        <ellipse cx="170" cy="144" rx="97" ry="85" fill="none" stroke="#ffffff" stroke-width="2.5" opacity="0.65"/>
        <path d="M108 94 Q124 72 152 68" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" opacity="0.8"/>
        <circle cx="98" cy="108" r="4" fill="#ffffff" opacity="0.85"/>
      </g>
    `;
  }

  let backCapeSvg = '';
  let frontClaspSvg = '';
  if (equipped.accessory === 'acc_cape') {
    backCapeSvg = `
      <path d="M116 196 C82 214, 58 242, 64 268 C108 274, 232 274, 276 268 C282 242, 258 214, 224 196 Z" fill="#ef4444" stroke="#1b1024" stroke-width="5.5" stroke-linejoin="round"/>
      <path d="M126 206 C106 230, 96 250, 98 266" fill="none" stroke="#b91c1c" stroke-width="4" stroke-linecap="round" opacity="0.65"/>
      <path d="M214 206 C234 230, 244 250, 242 266" fill="none" stroke="#b91c1c" stroke-width="4" stroke-linecap="round" opacity="0.65"/>
    `;
    frontClaspSvg = `
      <g transform="translate(170, 206)">
        <path d="M-46,-2 Q0,14 46,-2" fill="none" stroke="#facc15" stroke-width="7.5" stroke-linecap="round"/>
        <path d="M-46,-2 Q0,14 46,-2" fill="none" stroke="#1b1024" stroke-width="2.8" stroke-linecap="round"/>
        <circle cx="-18" cy="6" r="7" fill="#facc15" stroke="#1b1024" stroke-width="3"/>
        <circle cx="18" cy="6" r="7" fill="#facc15" stroke="#1b1024" stroke-width="3"/>
      </g>
    `;
  }

  let accSvg = frontClaspSvg;
  if (equipped.accessory === 'acc_bowtie') {
    accSvg = `
      <g transform="translate(170, 212)">
        <path d="M-4,0 L-32,-16 Q-36,0 -32,16 Z" fill="#ef4444" stroke="#1b1024" stroke-width="4.5" stroke-linejoin="round"/>
        <path d="M4,0 L32,-16 Q36,0 32,16 Z" fill="#ef4444" stroke="#1b1024" stroke-width="4.5" stroke-linejoin="round"/>
        <circle cx="0" cy="0" r="9" fill="#dc2626" stroke="#1b1024" stroke-width="4.5"/>
      </g>
    `;
  } else if (equipped.accessory === 'acc_glasses') {
    accSvg = `
      <g transform="translate(170, 144)">
        <rect x="-48" y="-14" width="38" height="26" rx="10" fill="#1e1b4b" fill-opacity="0.88" stroke="#1b1024" stroke-width="4"/>
        <rect x="10" y="-14" width="38" height="26" rx="10" fill="#1e1b4b" fill-opacity="0.88" stroke="#1b1024" stroke-width="4"/>
        <line x1="-10" y1="-3" x2="10" y2="-3" stroke="#1b1024" stroke-width="4.5"/>
        <line x1="-42" y1="-7" x2="-30" y2="5" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.75"/>
        <line x1="16" y1="-7" x2="28" y2="5" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.75"/>
      </g>
    `;
  } else if (equipped.accessory === 'acc_scarf') {
    accSvg = `
      <g transform="translate(170, 206)">
        <path d="M-54,-6 Q0,14 54,-6 Q58,12 46,16 Q0,28 -46,16 Q-58,12 -54,-6 Z" fill="#a855f7" stroke="#1b1024" stroke-width="4.5" stroke-linejoin="round"/>
        <rect x="14" y="10" width="22" height="32" rx="8" fill="#c084fc" stroke="#1b1024" stroke-width="4.5"/>
        <line x1="17" y1="22" x2="33" y2="22" stroke="#f3e8ff" stroke-width="3"/>
      </g>
    `;
  } else if (equipped.accessory === 'acc_bell') {
    accSvg = `
      <g transform="translate(170, 204)">
        <path d="M-48,-4 Q0,14 48,-4" fill="none" stroke="#ec4899" stroke-width="11" stroke-linecap="round"/>
        <path d="M-48,-4 Q0,14 48,-4" fill="none" stroke="#1b1024" stroke-width="3.5" stroke-linecap="round"/>
        <circle cx="0" cy="14" r="12" fill="#facc15" stroke="#1b1024" stroke-width="4"/>
        <circle cx="0" cy="17" r="3" fill="#1b1024"/>
      </g>
    `;
  }

  return `
    <svg viewBox="0 0 340 300" class="w-full h-full drop-shadow-[0_14px_18px_rgba(76,42,133,0.18)]" xmlns="http://www.w3.org/2000/svg">
      <!-- Ground Shadow -->
      <ellipse cx="172" cy="264" rx="112" ry="18" fill="rgba(104, 62, 168, 0.24)" />

      <!-- Hero Cape Backdrop (when equipped) -->
      ${backCapeSvg}

      <!-- Tail -->
      <g class="animate-tail-wag">
        <path d="M84 222 C44 218, 36 168, 52 150 C60 140, 74 146, 70 158 C64 176, 68 198, 92 204" fill="#ffffff" stroke="#1b1024" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M52 150 C60 140, 74 146, 70 158 C68 164, 61 168, 52 165 C47 160, 48 154, 52 150 Z" fill="#e89438" stroke="#1b1024" stroke-width="4"/>
      </g>

      <!-- Main Body -->
      <defs>
        <clipPath id="miau-body-clip">
          <path d="M74 222 C68 188, 92 122, 112 86 C122 68, 138 68, 152 86 C164 82, 176 82, 188 86 C202 68, 218 68, 228 86 C248 122, 272 188, 266 222 C260 254, 218 264, 170 264 C122 264, 80 254, 74 222 Z"/>
        </clipPath>
      </defs>

      <g class="animate-miau-breathe">
        <g clip-path="url(#miau-body-clip)">
          <!-- Base white coat -->
          <rect x="60" y="60" width="225" height="215" fill="#ffffff"/>
          <!-- Left subtle lavender contour shade -->
          <path d="M70 140 C86 175, 92 232, 146 250 L70 264 Z" fill="#ece2f8"/>
          <!-- Calico orange patch: top-left edge -->
          <ellipse cx="105" cy="100" rx="18" ry="22" fill="#e89438"/>
          <!-- Calico orange patch: right ear & cheek -->
          <path d="M180 68 C215 68, 250 100, 256 146 C230 172, 184 166, 180 128 C178 106, 178 86, 180 68 Z" fill="#e89438"/>
          <!-- Calico orange patch: lower-right hip -->
          <ellipse cx="255" cy="212" rx="28" ry="34" fill="#e89438"/>
          <!-- Bottom soft shadow -->
          <path d="M72 238 Q170 258 268 238 L268 270 L72 270 Z" fill="#dfd2f2" opacity="0.65"/>
        </g>

        <!-- Body crisp cartoon outline -->
        <path d="M74 222 C68 188, 92 122, 112 86 C122 68, 138 68, 152 86 C164 82, 176 82, 188 86 C202 68, 218 68, 228 86 C248 122, 272 188, 266 222 C260 254, 218 264, 170 264 C122 264, 80 254, 74 222 Z" fill="none" stroke="#1b1024" stroke-width="6.5" stroke-linejoin="round"/>

        <!-- Rosy cheeks -->
        <ellipse cx="118" cy="162" rx="10" ry="6" fill="#f9a8d4" opacity="0.6"/>
        <ellipse cx="222" cy="162" rx="10" ry="6" fill="#f9a8d4" opacity="0.45"/>

        <!-- Eyes -->
        ${eyesSvg}

        <!-- Cute nose -->
        <ellipse cx="170" cy="157" rx="7" ry="4.8" fill="#1b1024"/>

        <!-- Mouth -->
        ${mouthSvg}

        <!-- Whiskers -->
        <g stroke="#1b1024" stroke-width="3.6" stroke-linecap="round">
          <line x1="94" y1="150" x2="117" y2="153"/>
          <line x1="92" y1="160" x2="116" y2="160"/>
          <line x1="96" y1="170" x2="118" y2="167"/>

          <line x1="246" y1="150" x2="223" y2="153"/>
          <line x1="248" y1="160" x2="224" y2="160"/>
          <line x1="244" y1="170" x2="222" y2="167"/>
        </g>

        <!-- Accessories & Hat -->
        ${accSvg}
        ${hatSvg}
      </g>
    </svg>
  `;
}
