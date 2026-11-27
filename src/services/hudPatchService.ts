import { ACHIEVEMENTS } from '../constants';
import type { UserPetProfile } from '../types';

export function patchStatusBarsAndHeaderDom(
  root: HTMLElement,
  profile: Pick<
    UserPetProfile,
    'petName' | 'stats' | 'coins' | 'level' | 'unlockedAchievements'
  >
): void {
  const s = profile.stats;
  const entries: Array<[string, number]> = [
    ['hunger', s.hunger],
    ['hygiene', s.hygiene],
    ['fun', s.fun],
    ['sleep', s.sleep],
    ['happiness', s.happiness ?? 75],
  ];

  for (const [key, val] of entries) {
    const pct = Math.round(val);
    const isLow = pct < 30;
    const bar = root.querySelector(`#bar-${key}`) as HTMLElement | null;
    const txt = root.querySelector(`#pct-${key}`) as HTMLElement | null;
    const pill = root.querySelector(`#stat-pill-${key}`) as HTMLElement | null;
    const icon = root.querySelector(`#stat-icon-${key}`) as HTMLElement | null;

    if (bar) bar.style.width = `${pct}%`;
    if (txt) {
      txt.textContent = `${pct}%`;
      txt.classList.toggle('text-rose-600', isLow);
    }
    if (pill) pill.classList.toggle('status-alert-glow', isLow);
    if (icon) icon.classList.toggle('status-icon-alert', isLow);

    const compactTxt = root.querySelector(`#compact-pct-${key}`) as HTMLElement | null;
    const compactPill = root.querySelector(`#compact-stat-${key}`) as HTMLElement | null;
    if (compactTxt) {
      compactTxt.textContent = `${pct}%`;
      compactTxt.classList.toggle('text-rose-600', isLow);
    }
    if (compactPill) {
      compactPill.classList.toggle('status-alert-glow', isLow);
    }
  }

  const petName = (profile.petName || 'Miau').trim() || 'Miau';
  const hudPetNameEl = root.querySelector('#hud-pet-name');
  if (hudPetNameEl) {
    hudPetNameEl.textContent = `🐾 ${petName}`;
  }

  const coinsEl = root.querySelector('#miau-coins');
  if (coinsEl) {
    coinsEl.textContent = profile.coins.toLocaleString('pt-BR');
  }

  const levelEl = root.querySelector('#miau-level');
  if (levelEl) {
    levelEl.textContent = `Nível ${profile.level}`;
  }

  const achEl = root.querySelector('#achievements-count');
  if (achEl) {
    const count = profile.unlockedAchievements?.length || 0;
    achEl.textContent = `${count}/${ACHIEVEMENTS.length}`;
  }
}

export function patchSpeechBubbleDom(
  root: HTMLElement,
  speech: { meowPrefix: string; text: string }
): void {
  const prefixEl = root.querySelector('#speech-prefix');
  const textEl = root.querySelector('#speech-text');
  const compactTextEl = root.querySelector('#speech-text-compact');
  if (prefixEl) prefixEl.textContent = speech.meowPrefix;
  if (textEl) textEl.textContent = speech.text;
  if (compactTextEl) {
    compactTextEl.textContent = `${speech.meowPrefix} ${speech.text}`.trim();
  }
}
