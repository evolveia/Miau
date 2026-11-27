export interface HoldVoiceButtonCallbacks {
  isRecording: () => boolean;
  isComparing: () => boolean;
  onStartRecording: () => Promise<boolean>;
  onStopAndCompare: () => Promise<void>;
  onHoldingStateChanged?: (holding: boolean) => void;
}

const HOLD_THRESHOLD_MS = 260;

/**
 * Binds press-and-hold (`pointerdown` + `pointerup`/`pointercancel`) with
 * quick-tap toggle fallback so kids can hold to speak ("Segure para Falar")
 * without re-rendering DOM mid-hold.
 */
export function bindHoldVoiceRecordButton(
  btn: HTMLElement | null,
  callbacks: HoldVoiceButtonCallbacks
): void {
  if (!btn) return;

  let pressedAtMs = 0;
  let holdingActive = false;
  let suppressNextClick = false;
  let releaseCleanup: (() => void) | null = null;

  const setVisualRecording = (recording: boolean, holdMode: boolean) => {
    btn.classList.remove(
      'bg-[#6e45a5]',
      'hover:bg-[#5c3691]',
      'bg-amber-500',
      'hover:bg-amber-600',
      'ring-2',
      'ring-amber-200'
    );
    if (recording) {
      btn.classList.add('bg-rose-500', 'hover:bg-rose-600', 'text-white', 'animate-pulse');
      btn.textContent = holdMode ? '🎙️ Solte para enviar' : '⏹️ Parar e Comparar';
    } else {
      btn.classList.remove('bg-rose-500', 'hover:bg-rose-600', 'animate-pulse');
      btn.classList.add('bg-[#6e45a5]', 'hover:bg-[#5c3691]', 'text-white');
    }
  };

  btn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  btn.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (callbacks.isComparing() || callbacks.isRecording() || holdingActive) return;

    e.preventDefault();
    holdingActive = true;
    pressedAtMs = Date.now();
    suppressNextClick = true;
    callbacks.onHoldingStateChanged?.(true);
    setVisualRecording(true, true);

    const startPromise = callbacks.onStartRecording();
    let released = false;

    const handleRelease = async () => {
      if (released) return;
      released = true;
      releaseCleanup?.();
      releaseCleanup = null;
      holdingActive = false;
      callbacks.onHoldingStateChanged?.(false);

      const started = await startPromise.catch(() => false);
      if (!started) return;

      const heldMs = Date.now() - pressedAtMs;
      if (heldMs >= HOLD_THRESHOLD_MS) {
        await callbacks.onStopAndCompare();
      } else {
        // Quick tap fallback: stay recording and show stop button
        setVisualRecording(true, false);
      }
    };

    const onPointerRelease = () => {
      void handleRelease();
    };

    releaseCleanup = () => {
      window.removeEventListener('pointerup', onPointerRelease);
      window.removeEventListener('pointercancel', onPointerRelease);
      window.removeEventListener('blur', onPointerRelease);
    };

    window.addEventListener('pointerup', onPointerRelease, { once: true });
    window.addEventListener('pointercancel', onPointerRelease, { once: true });
    window.addEventListener('blur', onPointerRelease, { once: true });
  });

  btn.addEventListener('click', () => {
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    if (callbacks.isComparing()) return;
    if (callbacks.isRecording()) {
      void callbacks.onStopAndCompare();
    } else {
      setVisualRecording(true, false);
      void callbacks.onStartRecording();
    }
  });
}
