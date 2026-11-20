import { registerSW } from 'virtual:pwa-register';
import * as xb from 'xrblocks';
import { MiauAppUI } from './ui/MiauAppUI';
import { MiauXRScene } from './xr/MiauXRScene';

registerSW({
  immediate: true,
  onRegisterError(error) {
    console.warn('Falha ao registrar Service Worker PWA:', error);
  },
});

function createXRHud(
  scene: MiauXRScene,
  onExit: () => void
): { updateGyroUi: () => void; showStatus: (msg: string) => void } {
  const existing = document.getElementById('miau-xr-hud');
  if (existing) existing.remove();

  const hud = document.createElement('div');
  hud.id = 'miau-xr-hud';
  hud.className =
    'fixed inset-0 z-[50] pointer-events-none flex flex-col justify-between p-3 sm:p-4';
  hud.innerHTML = `
    <div class="flex flex-col gap-2">
      <div class="flex flex-wrap items-center justify-between gap-2 pointer-events-auto">
        <button
          id="xr-hud-exit"
          type="button"
          class="px-3.5 py-2 rounded-full bg-[#2d1b4e]/90 text-white border border-white/30 text-xs font-extrabold shadow-lg hover:bg-[#3b1f6e] active:scale-95 transition"
        >
          ← Voltar 2D
        </button>

        <div class="flex items-center gap-2">
          <button
            id="xr-hud-gyro"
            type="button"
            class="px-3.5 py-2 rounded-full bg-[#2d1b4e]/90 text-white border border-white/30 text-xs font-extrabold shadow-lg hover:bg-[#3b1f6e] active:scale-95 transition"
          >
            🧭 Giroscópio: Off
          </button>
          <button
            id="xr-hud-recenter"
            type="button"
            class="px-3 py-2 rounded-full bg-white/95 text-[#2d1b4e] border border-white text-xs font-extrabold shadow-lg hover:bg-white active:scale-95 transition"
            title="Centralizar visão no Miau"
          >
            🎯 Centralizar
          </button>
        </div>
      </div>

      <div class="self-center px-3 py-1 rounded-full bg-[#2d1b4e]/75 text-white/95 border border-white/20 text-[10px] sm:text-[11px] font-semibold text-center">
        Arraste 360° para girar • Pinça para zoom • Toque no Miau, brinquedos ou tapete
      </div>

      <div
        id="xr-hud-status"
        class="self-center px-3.5 py-1.5 rounded-full bg-black/75 text-white text-[11px] font-bold opacity-0 transition-opacity duration-300"
      ></div>
    </div>

    <div class="flex items-end justify-between gap-2">
      <!-- Quick 3D Care & Play Dock (Left-aligned) -->
      <div class="pointer-events-auto flex flex-col gap-1.5 items-start max-w-[235px]">
        <div class="flex flex-wrap gap-1.5">
          <button id="xr-act-ball" type="button" class="px-3 py-2 rounded-2xl bg-sky-500/95 text-white text-xs font-extrabold shadow-lg border border-white/30 active:scale-95 transition">
            ⚽ Bolinha
          </button>
          <button id="xr-act-pet" type="button" class="px-3 py-2 rounded-2xl bg-pink-500/95 text-white text-xs font-extrabold shadow-lg border border-white/30 active:scale-95 transition">
            💖 Carinho
          </button>
          <button id="xr-act-feed" type="button" class="px-3 py-2 rounded-2xl bg-amber-500/95 text-white text-xs font-extrabold shadow-lg border border-white/30 active:scale-95 transition">
            🐟 Comida
          </button>
          <button id="xr-act-clean" type="button" class="px-3 py-2 rounded-2xl bg-cyan-500/95 text-white text-xs font-extrabold shadow-lg border border-white/30 active:scale-95 transition">
            🫧 Banho
          </button>
          <button id="xr-act-meow" type="button" class="px-3 py-2 rounded-2xl bg-violet-600/95 text-white text-xs font-extrabold shadow-lg border border-white/30 active:scale-95 transition">
            😺 Miar
          </button>
        </div>
      </div>

      <!-- Right Controls: Zoom + 360° Virtual Analog Joystick -->
      <div class="pointer-events-auto flex items-end gap-2 shrink-0">
        <div class="flex flex-col gap-1.5">
          <button id="xr-zoom-in" type="button" class="w-9 h-9 rounded-full bg-[#2d1b4e]/85 text-white font-extrabold text-base border border-white/30 shadow-md active:scale-90 transition" title="Aproximar">+</button>
          <button id="xr-zoom-out" type="button" class="w-9 h-9 rounded-full bg-[#2d1b4e]/85 text-white font-extrabold text-base border border-white/30 shadow-md active:scale-90 transition" title="Afastar">−</button>
        </div>

        <div
          id="xr-joystick-pad"
          class="relative w-24 h-24 rounded-full bg-[#2d1b4e]/80 border-2 border-white/35 shadow-xl flex items-center justify-center touch-none select-none"
          title="Arraste para caminhar pela sala 3D"
        >
          <span class="absolute top-1.5 text-[9px] font-bold text-white/60 pointer-events-none">▲</span>
          <span class="absolute bottom-1.5 text-[9px] font-bold text-white/60 pointer-events-none">▼</span>
          <span class="absolute left-2 text-[9px] font-bold text-white/60 pointer-events-none">◀</span>
          <span class="absolute right-2 text-[9px] font-bold text-white/60 pointer-events-none">▶</span>
          <div
            id="xr-joystick-knob"
            class="w-10 h-10 rounded-full bg-gradient-to-br from-purple-300 to-violet-500 border-2 border-white shadow-md pointer-events-none"
          ></div>
        </div>
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
    }, 2600);
  };

  const updateGyroUi = () => {
    if (!gyroBtn) return;
    const active = scene.isGyroscopeEnabled();
    gyroBtn.textContent = active ? '🧭 Giroscópio: Ativo' : '🧭 Giroscópio: Off';
    gyroBtn.classList.toggle('bg-emerald-600/90', active);
    gyroBtn.classList.toggle('bg-[#2d1b4e]/90', !active);
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

  // Quick 3D Care & Play buttons
  hud.querySelector('#xr-act-ball')?.addEventListener('click', () => {
    scene.throwBall();
  });
  hud.querySelector('#xr-act-pet')?.addEventListener('click', () => {
    scene.triggerPetFromScene();
  });
  hud.querySelector('#xr-act-feed')?.addEventListener('click', () => {
    scene.triggerFeedFromScene();
  });
  hud.querySelector('#xr-act-clean')?.addEventListener('click', () => {
    scene.triggerCleanFromScene();
  });
  hud.querySelector('#xr-act-meow')?.addEventListener('click', () => {
    scene.triggerMeowFromScene();
  });

  hud.querySelector('#xr-zoom-in')?.addEventListener('click', () => {
    scene.zoomBy(-0.28);
  });
  hud.querySelector('#xr-zoom-out')?.addEventListener('click', () => {
    scene.zoomBy(0.28);
  });

  // Smooth 360° Virtual Thumbstick
  const pad = hud.querySelector('#xr-joystick-pad') as HTMLElement | null;
  const knob = hud.querySelector('#xr-joystick-knob') as HTMLElement | null;
  let stickPointerId: number | null = null;
  const maxRadius = 28;

  const updateStick = (clientX: number, clientY: number) => {
    if (!pad || !knob) return;
    const rect = pad.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    scene.setMoveInput(-dy / maxRadius, dx / maxRadius);
  };

  const resetStick = () => {
    stickPointerId = null;
    if (knob) knob.style.transform = 'translate(0px, 0px)';
    scene.setMoveInput(0, 0);
  };

  pad?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    stickPointerId = e.pointerId;
    pad.setPointerCapture?.(e.pointerId);
    updateStick(e.clientX, e.clientY);
  });

  pad?.addEventListener('pointermove', (e) => {
    if (stickPointerId !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    updateStick(e.clientX, e.clientY);
  });

  pad?.addEventListener('pointerup', (e) => {
    if (stickPointerId !== e.pointerId) return;
    pad.releasePointerCapture?.(e.pointerId);
    resetStick();
  });

  pad?.addEventListener('pointercancel', resetStick);

  return { updateGyroUi, showStatus };
}

document.addEventListener('DOMContentLoaded', async () => {
  const appRoot = document.getElementById('app') || document.body;

  let ui: MiauAppUI;
  let xrScene!: MiauXRScene;
  let hudControls: {
    updateGyroUi: () => void;
    showStatus: (msg: string) => void;
  } | null = null;

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
    onPlay: (source) => ui.handleQuickPlay(source),
    onMeow: () => ui.handleMeowInteraction(),
    onToggleSleep: () => ui.handleToggleSleepFromXR(),
    onExitXRMode: exitXRMode,
    onActionFeedback: (msg) => hudControls?.showStatus(msg),
  });

  hudControls = createXRHud(xrScene, exitXRMode);

  const startSimulatorFallback = async () => {
    try {
      await xb.core.startSimulator();
      document.getElementById('XRButtonWrapper')?.remove();
      xb.core.simulator?.userInterface?.hideUiElements?.();
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
      xb.core.simulator?.userInterface?.hideUiElements?.();
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
