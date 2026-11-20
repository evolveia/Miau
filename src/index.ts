import * as xb from 'xrblocks';
import { MiauAppUI } from './ui/MiauAppUI';
import { MiauXRScene } from './xr/MiauXRScene';

document.addEventListener('DOMContentLoaded', async () => {
  const appRoot = document.getElementById('app') || document.body;

  let ui: MiauAppUI;

  const xrScene = new MiauXRScene({
    onPet: () => ui.handlePetInteraction(),
    onFeed: () => ui.handleQuickFeed(),
    onClean: () => ui.handleQuickClean(),
    onExitXRMode: () => {
      document.body.classList.remove('xr-mode-active');
      if (xb.core.webXRSessionManager?.currentSession) {
        void xb.core.webXRSessionManager.endSession().catch(() => {});
      }
    },
  });

  const startSimulatorFallback = async () => {
    try {
      await xb.core.startSimulator();
      document.getElementById('XRButtonWrapper')?.remove();
    } catch (err) {
      console.warn('Não foi possível iniciar o simulador 3D:', err);
    }
  };

  ui = new MiauAppUI(appRoot, {
    syncState: (stats, equipped, speech) => {
      xrScene.syncState(stats, equipped, speech);
    },
    triggerBounce: () => {
      xrScene.triggerBounce();
    },
    enterXRMode: () => {
      document.body.classList.add('xr-mode-active');
      if (xb.core.simulatorRunning) {
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
        backBtn.addEventListener('click', () => {
          document.body.classList.remove('xr-mode-active');
        });
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
