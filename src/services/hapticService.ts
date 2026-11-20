const HAPTICS_STORAGE_KEY = 'miau_haptics_v1';

class HapticService {
  private _enabled = true;

  constructor() {
    try {
      const saved = localStorage.getItem(HAPTICS_STORAGE_KEY);
      if (saved === 'false') {
        this._enabled = false;
      }
    } catch {
      // Ignore storage access errors
    }
  }

  public get isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.vibrate === 'function'
    );
  }

  public get enabled(): boolean {
    return this._enabled;
  }

  public set enabled(value: boolean) {
    this._enabled = value;
    try {
      localStorage.setItem(HAPTICS_STORAGE_KEY, String(value));
    } catch {
      // Ignore storage access errors
    }
    if (!value) {
      this.stop();
    }
  }

  public vibrate(pattern: number | number[]): boolean {
    if (!this._enabled || !this.isSupported) return false;
    try {
      return navigator.vibrate(pattern);
    } catch {
      return false;
    }
  }

  public stop(): void {
    if (!this.isSupported) return;
    try {
      navigator.vibrate(0);
    } catch {
      // Ignore errors
    }
  }

  /** Crisp single pulse for UI taps & navigation */
  public tap(): void {
    this.vibrate(14);
  }

  /** Gentle rhythmic purr when petting or cuddling Miau */
  public purr(): void {
    this.vibrate([28, 42, 48, 42, 28]);
  }

  /** Playful crunch pattern when feeding Miau */
  public chomp(): void {
    this.vibrate([22, 32, 28]);
  }

  /** Light bubbly pulses during bath & sponge rubs */
  public bubbles(): void {
    this.vibrate([12, 24, 12, 24, 16]);
  }

  /** Energetic bounce for playtime, camera snap, and wake-up */
  public play(): void {
    this.vibrate([18, 28, 38]);
  }

  /** Reward / coin / chat reply chime */
  public coin(): void {
    this.vibrate([18, 30, 42]);
  }

  /** Celebratory burst when unlocking an achievement */
  public achievement(): void {
    this.vibrate([35, 45, 65, 45, 95]);
  }

  /** Fanfare vibration when reaching a new level */
  public levelUp(): void {
    this.vibrate([45, 50, 75, 50, 120]);
  }

  /** Distinct double buzz for low stats, bad item hit, or insufficient coins */
  public warning(): void {
    this.vibrate([45, 38, 45]);
  }
}

export const hapticService = new HapticService();
