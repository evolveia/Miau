import { isNightRoomBackground } from './roomThemeService';

const SCREEN_PREFS_STORAGE_KEY = 'miau_screen_prefs_v1';

let easyReadMemoryFlag = false;

export function isEasyReadEnabled(): boolean {
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(SCREEN_PREFS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { easyReadMode?: boolean };
        if (typeof parsed.easyReadMode === 'boolean') {
          easyReadMemoryFlag = parsed.easyReadMode;
          return parsed.easyReadMode;
        }
      }
    } catch {
      // Ignore storage errors
    }
  }
  return easyReadMemoryFlag;
}

export function setEasyReadEnabled(enabled: boolean): boolean {
  easyReadMemoryFlag = Boolean(enabled);
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(SCREEN_PREFS_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      parsed.easyReadMode = easyReadMemoryFlag;
      localStorage.setItem(SCREEN_PREFS_STORAGE_KEY, JSON.stringify(parsed));
    } catch {
      // Ignore storage errors
    }
  }
  syncEasyReadBodyClass(easyReadMemoryFlag);
  return easyReadMemoryFlag;
}

export function syncEasyReadBodyClass(enabled = isEasyReadEnabled()): void {
  if (typeof document === 'undefined') return;
  const shell = document.getElementById('miau-2d-shell');
  if (shell) {
    shell.classList.toggle('miau-easy-read', enabled);
  }
  document.body?.classList.toggle('miau-easy-read-active', enabled);
}

export function shouldUseNightModalTheme(
  backgroundId: string,
  isSleeping: boolean
): boolean {
  return isNightRoomBackground(backgroundId, isSleeping);
}

export function getEasyReadAudioSpeed(defaultSlow = false): boolean {
  return isEasyReadEnabled() ? true : defaultSlow;
}
