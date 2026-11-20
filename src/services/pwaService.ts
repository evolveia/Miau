interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type CameraPermissionState =
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'unsupported'
  | 'unknown';

class PWAService {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private listeners = new Set<() => void>();
  public isInstalled = false;
  public isIOS = false;
  public isOnline =
    typeof navigator !== 'undefined' ? navigator.onLine : true;

  constructor() {
    if (typeof window === 'undefined') return;

    this.isInstalled =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;

    const ua = window.navigator.userAgent.toLowerCase();
    this.isIOS =
      /iphone|ipad|ipod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.notify();
    });

    window.addEventListener('appinstalled', () => {
      this.isInstalled = true;
      this.deferredPrompt = null;
      this.notify();
    });

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notify();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notify();
    });
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((cb) => cb());
  }

  public canPromptInstall(): boolean {
    return Boolean(this.deferredPrompt);
  }

  public async promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!this.deferredPrompt) return 'unavailable';
    await this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      this.isInstalled = true;
      this.deferredPrompt = null;
      this.notify();
    }
    return outcome;
  }

  public async getCameraPermissionState(): Promise<CameraPermissionState> {
    if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
    if (!navigator.permissions?.query) return 'unknown';
    try {
      const status = await navigator.permissions.query({
        name: 'camera' as PermissionName,
      });
      return status.state as CameraPermissionState;
    } catch {
      return 'unknown';
    }
  }

  public async requestCameraAuthorization(): Promise<
    'granted' | 'denied' | 'unsupported'
  > {
    if (!navigator.mediaDevices?.getUserMedia) {
      return 'unsupported';
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      stream.getTracks().forEach((track) => track.stop());
      return 'granted';
    } catch {
      return 'denied';
    }
  }
}

export const pwaService = new PWAService();
