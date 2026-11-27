import type { EquippedItems, MiauMood, MiauVisualEffect } from '../types';

export function renderMiauSvg(
  mood: MiauMood,
  equipped: EquippedItems,
  isSleeping: boolean,
  effect: MiauVisualEffect = 'none'
): string {
  const effectiveMood: MiauMood = isSleeping ? 'sleepy' : mood;
  const resolvedEffect: MiauVisualEffect =
    effect !== 'none'
      ? effect
      : effectiveMood === 'eating'
        ? 'chewing'
        : effectiveMood === 'bathing'
          ? 'bath_foam'
          : 'none';

  const eyesSvg =
    resolvedEffect === 'celebrating'
      ? `
        <g class="animate-miau-bounce">
          <path d="M126 146 Q137 131 148 146" fill="none" stroke="#1b1024" stroke-width="5.5" stroke-linecap="round"/>
          <path d="M192 146 Q203 131 214 146" fill="none" stroke="#1b1024" stroke-width="5.5" stroke-linecap="round"/>
          <polygon points="137,125 140,131 146,131 141,135 143,141 137,137 131,141 133,135 128,131 134,131" fill="#facc15" stroke="#1b1024" stroke-width="1.5"/>
          <polygon points="203,125 206,131 212,131 207,135 209,141 203,137 197,141 199,135 194,131 200,131" fill="#facc15" stroke="#1b1024" stroke-width="1.5"/>
        </g>
      `
      : resolvedEffect === 'yawning' || effectiveMood === 'sleepy'
        ? `
        <path d="M126 146 Q137 156 148 146" fill="none" stroke="#1b1024" stroke-width="5.5" stroke-linecap="round"/>
        <path d="M192 146 Q203 156 214 146" fill="none" stroke="#1b1024" stroke-width="5.5" stroke-linecap="round"/>
      `
        : resolvedEffect === 'bath_shake'
          ? `
        <path d="M125 138 L146 146 L125 153" fill="none" stroke="#1b1024" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M215 138 L194 146 L215 153" fill="none" stroke="#1b1024" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round"/>
      `
          : effectiveMood === 'affectionate' || resolvedEffect === 'bath_foam'
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

  if (resolvedEffect === 'yawning') {
    mouthSvg = `
      <ellipse cx="170" cy="180" rx="13" ry="15" fill="#6d232b" stroke="#1b1024" stroke-width="4"/>
      <ellipse cx="170" cy="187" rx="8" ry="6" fill="#f28b95"/>
    `;
  } else if (resolvedEffect === 'chewing' || effectiveMood === 'eating') {
    mouthSvg = `
      <g class="animate-miau-chew">
        <path d="M154 167 Q170 178 186 167" fill="none" stroke="#1b1024" stroke-width="4.5" stroke-linecap="round"/>
        <ellipse cx="170" cy="180" rx="9" ry="7.5" fill="#f28b95" stroke="#1b1024" stroke-width="3.5"/>
      </g>
    `;
  } else if (effectiveMood === 'hungry') {
    mouthSvg = `
      <path d="M156 167 Q163 174 170 166 Q177 174 184 167" fill="none" stroke="#1b1024" stroke-width="4.5" stroke-linecap="round"/>
      <ellipse cx="170" cy="180" rx="7" ry="6" fill="#6d232b" stroke="#1b1024" stroke-width="3.5"/>
    `;
  } else if (effectiveMood === 'sleepy') {
    mouthSvg = `
      <path d="M159 169 Q170 175 181 169" fill="none" stroke="#1b1024" stroke-width="4.5" stroke-linecap="round"/>
    `;
  }

  let effectOverlaySvg = '';
  let bodyAnimClass = 'animate-miau-breathe';
  if (resolvedEffect === 'chewing') {
    effectOverlaySvg = `
      <g class="animate-crumb-fall">
        <circle cx="152" cy="192" r="3.4" fill="#f59e0b" stroke="#1b1024" stroke-width="1.6"/>
        <circle cx="188" cy="195" r="2.8" fill="#fbbf24" stroke="#1b1024" stroke-width="1.4"/>
        <polygon points="164,199 169,197 167,203" fill="#f97316"/>
        <circle cx="178" cy="204" r="2.5" fill="#fde047"/>
      </g>
    `;
  } else if (resolvedEffect === 'bath_foam') {
    effectOverlaySvg = `
      <g opacity="0.95">
        <circle cx="116" cy="204" r="14" fill="#ecfeff" stroke="#67e8f9" stroke-width="3"/>
        <circle cx="134" cy="196" r="11" fill="#ffffff" stroke="#67e8f9" stroke-width="2.5"/>
        <circle cx="212" cy="206" r="13" fill="#ecfeff" stroke="#67e8f9" stroke-width="3"/>
        <circle cx="195" cy="196" r="10" fill="#ffffff" stroke="#67e8f9" stroke-width="2.5"/>
        <circle cx="152" cy="96" r="9" fill="#ffffff" stroke="#67e8f9" stroke-width="2.5"/>
        <circle cx="166" cy="90" r="11" fill="#ecfeff" stroke="#67e8f9" stroke-width="2.5"/>
        <circle cx="182" cy="97" r="8" fill="#ffffff" stroke="#67e8f9" stroke-width="2.5"/>
      </g>
    `;
  } else if (resolvedEffect === 'bath_shake') {
    bodyAnimClass = 'animate-miau-shake';
    effectOverlaySvg = `
      <g>
        <path d="M68 122 Q56 130 68 136 Q76 130 68 122 Z" fill="#38bdf8" stroke="#0284c7" stroke-width="2" class="animate-droplet-fly" style="--drop-x:-18px;--drop-y:-10px"/>
        <path d="M272 124 Q284 132 272 138 Q264 132 272 124 Z" fill="#38bdf8" stroke="#0284c7" stroke-width="2" class="animate-droplet-fly" style="--drop-x:18px;--drop-y:-12px"/>
        <path d="M84 82 Q74 90 84 96 Q92 90 84 82 Z" fill="#7dd3fc" stroke="#0284c7" stroke-width="2" class="animate-droplet-fly" style="--drop-x:-14px;--drop-y:-16px"/>
        <path d="M256 84 Q266 92 256 98 Q248 92 256 84 Z" fill="#7dd3fc" stroke="#0284c7" stroke-width="2" class="animate-droplet-fly" style="--drop-x:14px;--drop-y:-16px"/>
      </g>
    `;
  } else if (resolvedEffect === 'yawning') {
    bodyAnimClass = 'animate-miau-yawn';
    effectOverlaySvg = `
      <g class="animate-float-up" fill="#818cf8" font-family="Fredoka, sans-serif" font-weight="700">
        <text x="242" y="96" font-size="22">Z</text>
        <text x="260" y="78" font-size="17">z</text>
      </g>
    `;
  } else if (resolvedEffect === 'celebrating') {
    bodyAnimClass = 'animate-miau-celebrate';
    effectOverlaySvg = `
      <g class="animate-twinkle">
        <polygon points="74,98 78,108 88,108 80,114 83,124 74,118 65,124 68,114 60,108 70,108" fill="#facc15" stroke="#1b1024" stroke-width="2"/>
        <polygon points="266,94 270,104 280,104 272,110 275,120 266,114 257,120 260,110 252,104 262,104" fill="#f472b6" stroke="#1b1024" stroke-width="2"/>
        <circle cx="102" cy="70" r="5" fill="#38bdf8"/>
        <circle cx="238" cy="68" r="5" fill="#a855f7"/>
      </g>
    `;
  } else if (resolvedEffect === 'scratching') {
    bodyAnimClass = 'animate-miau-scratch';
    effectOverlaySvg = `
      <g stroke="#f97316" stroke-width="4" stroke-linecap="round">
        <line x1="60" y1="184" x2="78" y2="206"/>
        <line x1="70" y1="176" x2="88" y2="198"/>
        <line x1="80" y1="168" x2="98" y2="190"/>
      </g>
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
  } else if (equipped.hat === 'hat_jurassic') {
    hatSvg = `
      <g transform="translate(170, 62)">
        <ellipse cx="0" cy="14" rx="48" ry="11" fill="#a37a4c" stroke="#1b1024" stroke-width="4.8"/>
        <path d="M-28,12 C-26,-18 26,-18 28,12 Z" fill="#c2955e" stroke="#1b1024" stroke-width="4.8" stroke-linejoin="round"/>
        <path d="M-27,5 Q0,11 27,5" fill="none" stroke="#65a30d" stroke-width="5.5"/>
        <circle cx="0" cy="-2" r="7" fill="#facc15" stroke="#1b1024" stroke-width="2.8"/>
        <path d="M-3,-2 L0,-6 L3,-2 L0,2 Z" fill="#dc2626"/>
      </g>
    `;
  } else if (equipped.hat === 'hat_hogwarts') {
    hatSvg = `
      <g transform="translate(170, 56)">
        <ellipse cx="0" cy="20" rx="48" ry="11" fill="#78350f" stroke="#1b1024" stroke-width="4.8"/>
        <path d="M-30,18 C-24,-4 -12,-34 10,-44 C8,-26 22,-8 30,18 Z" fill="#92400e" stroke="#1b1024" stroke-width="4.8" stroke-linejoin="round"/>
        <path d="M-16,4 Q0,9 15,2" fill="none" stroke="#451a03" stroke-width="4" stroke-linecap="round"/>
        <path d="M-10,-10 Q3,-4 12,-12" fill="none" stroke="#451a03" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M-24,14 Q0,20 24,14" fill="none" stroke="#b91c1c" stroke-width="4.5"/>
        <rect x="-5" y="10" width="10" height="8" rx="2" fill="#facc15" stroke="#1b1024" stroke-width="2.4"/>
      </g>
    `;
  } else if (equipped.hat === 'hat_cyberpunk') {
    hatSvg = `
      <g transform="translate(170, 66)">
        <path d="M-48,16 C-44,-14 44,-14 48,16" fill="none" stroke="#0f172a" stroke-width="11" stroke-linecap="round"/>
        <path d="M-48,16 C-44,-14 44,-14 48,16" fill="none" stroke="#22d3ee" stroke-width="4" stroke-linecap="round"/>
        <rect x="-32" y="-12" width="64" height="16" rx="8" fill="#1e293b" stroke="#1b1024" stroke-width="4"/>
        <line x1="-22" y1="-4" x2="22" y2="-4" stroke="#f472b6" stroke-width="4.5" stroke-linecap="round"/>
        <circle cx="-46" cy="14" r="8" fill="#0f172a" stroke="#22d3ee" stroke-width="3"/>
        <circle cx="46" cy="14" r="8" fill="#0f172a" stroke="#f472b6" stroke-width="3"/>
      </g>
    `;
  } else if (equipped.hat === 'hat_city') {
    hatSvg = `
      <g transform="translate(170, 64)">
        <path d="M-36,14 C-34,-18 34,-18 36,14 Z" fill="#2563eb" stroke="#1b1024" stroke-width="4.8"/>
        <path d="M10,12 L52,18 C50,24 22,22 0,16 Z" fill="#1d4ed8" stroke="#1b1024" stroke-width="4.5" stroke-linejoin="round"/>
        <circle cx="0" cy="-12" r="4.5" fill="#facc15" stroke="#1b1024" stroke-width="2.5"/>
        <rect x="-12" y="-4" width="22" height="12" rx="4" fill="#facc15" stroke="#1b1024" stroke-width="2.5"/>
      </g>
    `;
  } else if (equipped.hat === 'hat_marvel') {
    hatSvg = `
      <g transform="translate(170, 62)">
        <path d="M-40,18 C-38,-20 38,-20 40,18 Q0,8 -40,18 Z" fill="#dc2626" stroke="#1b1024" stroke-width="4.8" stroke-linejoin="round"/>
        <path d="M-16,12 L-12,-14 L12,-14 L16,12 Z" fill="#facc15" stroke="#1b1024" stroke-width="3.5" stroke-linejoin="round"/>
        <polygon points="0,-9 3,-2 10,-2 4,2 6,9 0,5 -6,9 -4,2 -10,-2 -3,-2" fill="#ffffff" stroke="#1b1024" stroke-width="2"/>
      </g>
    `;
  } else if (equipped.hat === 'hat_dc') {
    hatSvg = `
      <g transform="translate(170, 66)">
        <path d="M-42,18 L-48,-24 L-22,2 C-8,-4 8,-4 22,2 L48,-24 L42,18 Q0,8 -42,18 Z" fill="#1e293b" stroke="#0f172a" stroke-width="4.8" stroke-linejoin="round"/>
        <path d="M-22,6 L-8,10 M22,6 L8,10" stroke="#94a3b8" stroke-width="3.5" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="12" ry="7" fill="#facc15" stroke="#1b1024" stroke-width="2.5"/>
        <path d="M-7,1 Q0,-4 7,1 Q2,3 0,0 Q-2,3 -7,1 Z" fill="#0f172a"/>
      </g>
    `;
  } else if (equipped.hat === 'hat_halloween') {
    hatSvg = `
      <g transform="translate(170, 60)">
        <path d="M-5,-20 Q0,-34 7,-26" fill="none" stroke="#15803d" stroke-width="6" stroke-linecap="round"/>
        <ellipse cx="0" cy="4" rx="36" ry="22" fill="#f97316" stroke="#1b1024" stroke-width="4.8"/>
        <ellipse cx="0" cy="4" rx="18" ry="22" fill="#fb923c" stroke="#1b1024" stroke-width="3"/>
        <polygon points="-16,-2 -10,-9 -5,-2" fill="#fef08a"/>
        <polygon points="16,-2 10,-9 5,-2" fill="#fef08a"/>
        <path d="M-12,8 Q0,16 12,8" fill="none" stroke="#fef08a" stroke-width="4" stroke-linecap="round"/>
      </g>
    `;
  } else if (equipped.hat === 'hat_natal') {
    hatSvg = `
      <g transform="translate(170, 60)">
        <path d="M-34,14 C-28,-24 8,-34 32,-18 C38,-14 42,-2 44,4 C28,2 22,8 28,14 Z" fill="#dc2626" stroke="#1b1024" stroke-width="4.8" stroke-linejoin="round"/>
        <rect x="-38" y="8" width="76" height="16" rx="8" fill="#ffffff" stroke="#1b1024" stroke-width="4.5"/>
        <circle cx="44" cy="4" r="10" fill="#ffffff" stroke="#1b1024" stroke-width="4"/>
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
  } else if (equipped.accessory === 'acc_marvel') {
    backCapeSvg = `
      <path d="M114 196 C78 214, 54 244, 62 270 C106 276, 234 276, 278 270 C286 244, 262 214, 226 196 Z" fill="#b91c1c" stroke="#1b1024" stroke-width="5.5" stroke-linejoin="round"/>
    `;
    frontClaspSvg = `
      <g transform="translate(170, 214)">
        <path d="M-48,-8 Q0,10 48,-8" fill="none" stroke="#facc15" stroke-width="6.5" stroke-linecap="round"/>
        <circle cx="0" cy="8" r="14" fill="#38bdf8" stroke="#1b1024" stroke-width="4"/>
        <circle cx="0" cy="8" r="7" fill="#e0f2fe"/>
      </g>
    `;
  } else if (equipped.accessory === 'acc_dc') {
    backCapeSvg = `
      <path d="M114 196 C78 214, 54 244, 60 270 Q95 256 125 270 Q170 256 215 270 Q245 256 280 270 C286 244, 262 214, 226 196 Z" fill="#0f172a" stroke="#1b1024" stroke-width="5" stroke-linejoin="round"/>
    `;
    frontClaspSvg = `
      <g transform="translate(170, 208)">
        <path d="M-50,-2 Q0,14 50,-2" fill="none" stroke="#facc15" stroke-width="8" stroke-linecap="round"/>
        <path d="M-50,-2 Q0,14 50,-2" fill="none" stroke="#1b1024" stroke-width="2.5" stroke-linecap="round"/>
        <ellipse cx="0" cy="8" rx="14" ry="8" fill="#facc15" stroke="#1b1024" stroke-width="3"/>
        <path d="M-8,9 Q0,3 8,9 Q2,12 0,8 Q-2,12 -8,9 Z" fill="#0f172a"/>
      </g>
    `;
  } else if (equipped.accessory === 'acc_halloween') {
    backCapeSvg = `
      <path d="M110 184 L88 158 L124 194 M230 184 L252 158 L216 194" fill="#7c3aed" stroke="#1b1024" stroke-width="4.8" stroke-linejoin="round"/>
      <path d="M112 194 C78 214, 58 244, 66 268 Q115 254 170 268 Q225 254 274 268 C282 244, 262 214, 228 194 Z" fill="#4c1d95" stroke="#1b1024" stroke-width="5.2" stroke-linejoin="round"/>
    `;
    frontClaspSvg = `
      <g transform="translate(170, 210)">
        <path d="M-4,0 L-26,-12 L-22,12 Z M4,0 L26,-12 L22,12 Z" fill="#1e1b4b" stroke="#1b1024" stroke-width="3.8" stroke-linejoin="round"/>
        <circle cx="0" cy="0" r="6" fill="#dc2626" stroke="#1b1024" stroke-width="3"/>
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
  } else if (equipped.accessory === 'acc_jurassic') {
    accSvg = `
      <g transform="translate(170, 206)">
        <path d="M-48,-4 Q0,16 48,-4" fill="none" stroke="#78350f" stroke-width="6.5" stroke-linecap="round"/>
        <polygon points="-12,4 -4,24 2,5" fill="#fef3c7" stroke="#1b1024" stroke-width="3.2" stroke-linejoin="round"/>
        <polygon points="-2,6 6,26 12,4" fill="#fef3c7" stroke="#1b1024" stroke-width="3.2" stroke-linejoin="round"/>
        <circle cx="0" cy="7" r="4" fill="#65a30d" stroke="#1b1024" stroke-width="2.5"/>
      </g>
    `;
  } else if (equipped.accessory === 'acc_hogwarts') {
    accSvg = `
      <g>
        <g transform="translate(170, 144)">
          <circle cx="-33" cy="0" r="16" fill="none" stroke="#1b1024" stroke-width="4"/>
          <circle cx="33" cy="0" r="16" fill="none" stroke="#1b1024" stroke-width="4"/>
          <line x1="-17" y1="-2" x2="17" y2="-2" stroke="#1b1024" stroke-width="4"/>
        </g>
        <g transform="translate(170, 206)">
          <path d="M-54,-6 Q0,14 54,-6 Q58,12 46,16 Q0,28 -46,16 Q-58,12 -54,-6 Z" fill="#b91c1c" stroke="#1b1024" stroke-width="4.5" stroke-linejoin="round"/>
          <rect x="14" y="10" width="22" height="32" rx="8" fill="#dc2626" stroke="#1b1024" stroke-width="4.5"/>
          <line x1="17" y1="20" x2="33" y2="20" stroke="#facc15" stroke-width="4.5"/>
          <line x1="17" y1="30" x2="33" y2="30" stroke="#facc15" stroke-width="4.5"/>
        </g>
      </g>
    `;
  } else if (equipped.accessory === 'acc_cyberpunk') {
    accSvg = `
      <g transform="translate(170, 144)">
        <path d="M-52,-12 L52,-12 L46,12 L10,12 L0,4 L-10,12 L-46,12 Z" fill="rgba(6, 182, 212, 0.72)" stroke="#1b1024" stroke-width="4" stroke-linejoin="round"/>
        <line x1="-38" y1="-3" x2="-12" y2="-3" stroke="#f472b6" stroke-width="4" stroke-linecap="round"/>
        <line x1="12" y1="-3" x2="38" y2="-3" stroke="#fef08a" stroke-width="4" stroke-linecap="round"/>
      </g>
    `;
  } else if (equipped.accessory === 'acc_city') {
    accSvg = `
      <g transform="translate(170, 206)">
        <path d="M-54,-10 Q0,16 54,-10" fill="none" stroke="#4f46e5" stroke-width="7.5" stroke-linecap="round"/>
        <rect x="-60" y="-22" width="16" height="24" rx="7" fill="#22d3ee" stroke="#1b1024" stroke-width="3.8"/>
        <rect x="44" y="-22" width="16" height="24" rx="7" fill="#22d3ee" stroke="#1b1024" stroke-width="3.8"/>
      </g>
    `;
  } else if (equipped.accessory === 'acc_natal') {
    accSvg = `
      <g transform="translate(170, 208)">
        <path d="M-48,-4 Q0,14 48,-4" fill="none" stroke="#16a34a" stroke-width="10" stroke-linecap="round"/>
        <path d="M-4,2 L-24,-10 L-20,10 Z M4,2 L24,-10 L20,10 Z" fill="#dc2626" stroke="#1b1024" stroke-width="3.5" stroke-linejoin="round"/>
        <circle cx="0" cy="8" r="10" fill="#facc15" stroke="#1b1024" stroke-width="3.8"/>
        <circle cx="0" cy="11" r="2.5" fill="#1b1024"/>
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

      <g class="${bodyAnimClass}">
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
      <!-- Visual Effects Overlay -->
      ${effectOverlaySvg}
    </svg>
  `;
}
