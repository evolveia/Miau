import * as xb from 'xrblocks';
import { MiauAppUI } from './ui/MiauAppUI';
import { MiauXRScene } from './xr/MiauXRScene';

function createXRHud(
  scene: MiauXRScene,
  onExit: () => void
): { updateGyroUi: () => void } {
  const existing = document.getElementById('miau-xr-hud');
  if (existing) existing.remove();

  const hud = document.createElement('div');
  hud.id = 'miau-xr-hud';
  hud.className =
    'fixed inset-0 z-[50] pointer-events-none flex flex-col justify-between p-3 sm:p-4';
  hud.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-2 pointer-events-auto">
      <button
        id="xr-hud-exit"
        type="button"
        class="px-3.5 py-2 rounded-full bg-[#2d1b4e]/85 text-white border border-white/30 text-xs font-extrabold shadow-lg backdrop-blur-md hover:bg-[#3b1f6e] active:scale-95 transition"
      >
        ← Voltar 2D
      </button>

      <div class="flex items-center gap-2">
        <button
          id="xr-hud-gyro"
          type="button"
          class="px-3.5 py-2 rounded-full bg-[#2d1b4e]/85 text-white border border-white/30 text-xs font-extrabold shadow-lg backdrop-blur-md hover:bg-[#3b1f6e] active:scale-95 transition"
        >
          🧭 Giroscópio: Off
        </button>
        <button
          id="xr-hud-recenter"
          type="button"
          class="px-3 py-2 rounded-full bg-white/85 text-[#2d1b4e] border border-white text-xs font-extrabold shadow-lg backdrop-blur-md hover:bg-white active:scale-95 transition"
          title="Centralizar visão no Miau"
        >
          🎯 Centralizar
        </button>
      </div>
    </div>

    <div
      id="xr-hud-status"
      class="self-center px-3.5 py-1.5 rounded-full bg-black/65 text-white text-[11px] font-bold opacity-0 transition-opacity duration-300"
    ></div>

    <div class="flex items-end justify-between gap-3">
      <div class="px-3 py-1.5 rounded-2xl bg-[#2d1b4e]/75 text-white/90 border border-white/20 text-[11px] font-semibold backdrop-blur-md max-w-[210px] leading-snug">
        Toque nos objetos 3D, use as setas ou ative o <strong>Giroscópio</strong> para explorar!
      </div>

      <!-- Mobile Walk D-Pad -->
      <div class="pointer-events-auto grid grid-cols-3 gap-1.5 bg-[#2d1b4e]/70 p-2 rounded-2xl border border-white/25 backdrop-blur-md shadow-xl">
        <div></div>
        <button data-xrmove="fwd" type="button" class="w-10 h-10 rounded-xl bg-white/20 text-white font-extrabold text-sm active:bg-purple-400">▲</button>
        <div></div>
        <button data-xrmove="left" type="button" class="w-10 h-10 rounded-xl bg-white/20 text-white font-extrabold text-sm active:bg-purple-400">◀</button>
        <button data-xrmove="back" type="button" class="w-10 h-10 rounded-xl bg-white/20 text-white font-extrabold text-sm active:bg-purple-400">▼</button>
        <button data-xrmove="right" type="button" class="w-10 h-10 rounded-xl bg-white/20 text-white font-extrabold text-sm active:bg-purple-400">▶</button>
      </div>
    </div>
  `;
  document.body.appendChild(hud);

  const statusEl = hud.querySelector('#xr-hud-status') as HTMLElement | null;
  const gyroBtn = hud.querySelector('#xr-hud-gyro') as HTMLElement | null;
  let statusTimer: number | null = null;

  const showStatus = (msg: string) => {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.classList.remove('opacity-0');
    statusEl.classList.add('opacity-100');
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => {
      statusEl.classList.remove('opacity-100');
      statusEl.classList.add('opacity-0');
    }, 2800);
  };

  const updateGyroUi = () => {
    if (!gyroBtn) return;
    const active = scene.isGyroscopeEnabled();
    gyroBtn.textContent = active ? '🧭 Giroscópio: Ativo' : '🧭 Giroscópio: Off';
    gyroBtn.classList.toggle('bg-emerald-600/90', active);
    gyroBtn.classList.toggle('bg-[#2d1b4e]/85', !active);
  };

  hud.querySelector('#xr-hud-exit')?.addEventListener('click', () => {
    void scene.setGyroscopeEnabled(false);
    updateGyroUi();
    onExit();
  });

  gyroBtn?.addEventListener('click', async () => {
    const res = await scene.setGyroscopeEnabled(!scene.isGyroscopeEnabled());
    updateGyroUi();
    showStatus(res.message);
  });

  hud.querySelector('#xr-hud-recenter')?.addEventListener('click', () => {
    scene.resetCameraView();
    showStatus('Visão centralizada no Miau!');
  });

  const bindMoveBtn = (dir: string, fwd: number, right: number) => {
    const btn = hud.querySelector(`[data-xrmove="${dir}"]`);
    if (!btn) return;
    const start = (e: Event) => {
      e.preventDefault();
      scene.setMoveInput(fwd, right);
    };
    const stop = () => scene.setMoveInput(0, 0);
    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointercancel', stop);
    btn.addEventListener('pointerleave', stop);
  };
  bindMoveBtn('fwd', 1, 0);
  bindMoveBtn('back', -1, 0);
  bindMoveBtn('left', 0, -1);
  bindMoveBtn('right', 0, 1);

  return { updateGyroUi };
}

document.addEventListener('DOMContentLoaded', async () => {
  const appRoot = document.getElementById('app') || document.body;

  let ui: MiauAppUI;
  let xrScene!: MiauXRScene;
  let hudControls: { updateGyroUi: () => void } | null = null;

  const exitXRMode = () => {
    document.body.classList.remove('xr-mode-active');
    void xrScene?.setGyroscopeEnabled(false);
    xrScene?.setMoveInput(0, 0);
    hudControls?.updateGyroUi();
    xb.core.simulator?.userInterface?.hideUiElements?.();
    if (xb.core.webXRSessionManager?.currentSession) {
      void xb.core.webXRSessionManager.endSession().catch(() => {});
    }
  };

  xrScene = new MiauXRScene({
    onPet: () => ui.handlePetInteraction(),
    onFeed: () => ui.handleQuickFeed(),
    onClean: () => ui.handleQuickClean(),
    onPlay: () => ui.handleQuickPlay(),
    onToggleSleep: () => ui.handleToggleSleepFromXR(),
    onExitXRMode: exitXRMode,
  });

  hudControls = createXRHud(xrScene, exitXRMode);

  const startSimulatorFallback = async () => {
    try {
      await xb.core.startSimulator();
      document.getElementById('XRButtonWrapper')?.remove();
      xrScene.resetCameraView();
    } catch (err) {
      console.warn('Não foi possível iniciar o simulador 3D:', err);
    }
  };

  ui = new MiauAppUI(appRoot, {
    syncState: (stats, equipped, speech, isSleeping) => {
      xrScene.syncState(stats, equipped, speech, isSleeping);
    },
    triggerBounce: () => {
      xrScene.triggerBounce();
    },
    enterXRMode: () => {
      document.body.classList.add('xr-mode-active');
      xb.core.simulator?.userInterface?.showUiElements?.();
      if (xb.core.simulatorRunning) {
        xrScene.resetCameraView();
        return;
      }
      if (
        xb.core.webXRSessionManager &&
        xb.core.webXRSessionManager.isXRSupported() === false
      ) {
        void startSimulatorFallback();
        return;
      }
      const wrapper = document.getElementById('XRButtonWrapper');
      if (wrapper && !document.getElementById('miau-back-2d-btn')) {
        const backBtn = document.createElement('button');
        backBtn.id = 'miau-back-2d-btn';
        backBtn.type = 'button';
        backBtn.textContent = '← Voltar para a Sala 2D';
        backBtn.className =
          'px-5 py-2.5 rounded-full bg-white/90 text-[#3b1f6e] font-bold text-sm shadow-lg hover:bg-white transition';
        backBtn.addEventListener('click', exitXRMode);
        wrapper.appendChild(backBtn);
      }
    },
  });

  const options = new xb.Options();
  options.setAppTitle('Miau — Sala Espacial');
  options.setAppDescription(
    'Interaja com o Miau em 3D e Realidade Estendida.'
  );
  options.webxrOptionalFeatures = ['local-floor'];
  options.xrButton.showEnterSimulatorButton = true;
  options.xrButton.startText = 'Entrar em XR';
  options.xrButton.endText = 'Sair do XR';
  options.xrButton.invalidText = 'XR Indisponível';
  options.xrButton.startSimulatorText = 'Abrir Sala 3D (Simulador)';

  xb.add(xrScene);
  await xb.init(options);

  let vrSupported = false;
  if ('xr' in navigator && navigator.xr) {
    try {
      vrSupported = await navigator.xr.isSessionSupported('immersive-vr');
    } catch {
      vrSupported = false;
    }
  }

  interface InternalSessionManager {
    disposed?: boolean;
    xrModeSupported?: boolean;
    currentSession?: XRSession;
    waitingForXRSession?: boolean;
    getSessionOptions: () => XRSessionInit | undefined;
    startSession: () => void;
    onSessionStartedInternal?: (session: XRSession) => Promise<void>;
  }

  const manager = xb.core.webXRSessionManager as unknown as
    | InternalSessionManager
    | undefined;

  if (manager) {
    manager.startSession = () => {
      if (
        manager.disposed ||
        !manager.xrModeSupported ||
        manager.currentSession ||
        manager.waitingForXRSession
      ) {
        return;
      }
      manager.waitingForXRSession = true;
      const sessionOpts = manager.getSessionOptions() ?? {
        optionalFeatures: ['local-floor'],
      };

      const tryStart = async () => {
        if (!navigator.xr) {
          await startSimulatorFallback();
          return;
        }
        try {
          const arSession = await navigator.xr.requestSession(
            options.xrSessionMode,
            sessionOpts
          );
          await manager.onSessionStartedInternal?.(arSession);
          return;
        } catch {
          if (vrSupported) {
            try {
              const vrSession = await navigator.xr.requestSession(
                'immersive-vr',
                { optionalFeatures: ['local-floor'] }
              );
              await manager.onSessionStartedInternal?.(vrSession);
              return;
            } catch {
              // Fall through to simulator
            }
          }
        }
        await startSimulatorFallback();
      };

      void tryStart().finally(() => {
        manager.waitingForXRSession = false;
      });
    };
  }

  xb.core.webXRSessionManager?.addEventListener(
    xb.WebXRSessionEventType.SESSION_ERROR,
    () => {
      void startSimulatorFallback();
    }
  );
});
