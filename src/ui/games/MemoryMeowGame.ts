import { hapticService } from '../../services/hapticService';
import { soundService } from '../../services/soundService';
import type { MiniGameResult } from '../MiniGames';

function formatTimer(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

interface MeowPad {
  id: number;
  emoji: string;
  label: string;
  pitch: number;
  bgCls: string;
  glowCls: string;
}

const ALL_MEOW_PADS: MeowPad[] = [
  {
    id: 0,
    emoji: '🐾',
    label: 'Dó',
    pitch: 0.85,
    bgCls: 'from-violet-400 to-purple-500',
    glowCls: 'ring-4 ring-yellow-300 scale-105 brightness-125',
  },
  {
    id: 1,
    emoji: '🐟',
    label: 'Ré',
    pitch: 1.0,
    bgCls: 'from-sky-400 to-cyan-500',
    glowCls: 'ring-4 ring-yellow-300 scale-105 brightness-125',
  },
  {
    id: 2,
    emoji: '🧶',
    label: 'Mi',
    pitch: 1.16,
    bgCls: 'from-pink-400 to-rose-500',
    glowCls: 'ring-4 ring-yellow-300 scale-105 brightness-125',
  },
  {
    id: 3,
    emoji: '👑',
    label: 'Fá',
    pitch: 1.32,
    bgCls: 'from-amber-400 to-orange-500',
    glowCls: 'ring-4 ring-yellow-300 scale-105 brightness-125',
  },
  {
    id: 4,
    emoji: '🎀',
    label: 'Sol',
    pitch: 1.48,
    bgCls: 'from-emerald-400 to-teal-500',
    glowCls: 'ring-4 ring-yellow-300 scale-105 brightness-125',
  },
  {
    id: 5,
    emoji: '🌙',
    label: 'Lá',
    pitch: 1.66,
    bgCls: 'from-indigo-400 to-blue-600',
    glowCls: 'ring-4 ring-yellow-300 scale-105 brightness-125',
  },
];

function getMemoryStageConfig(stage: number): {
  name: string;
  padCount: number;
  seqLen: number;
  rounds: number;
  stepMs: number;
} {
  if (stage === 1) {
    return {
      name: 'Coral Inicial',
      padCount: 4,
      seqLen: 3,
      rounds: 3,
      stepMs: 620,
    };
  }
  if (stage === 2) {
    return {
      name: 'Novos Timbres',
      padCount: 5,
      seqLen: 4,
      rounds: 3,
      stepMs: 540,
    };
  }
  if (stage === 3) {
    return {
      name: 'Ritmo Dinâmico',
      padCount: 6,
      seqLen: 6,
      rounds: 3,
      stepMs: 440,
    };
  }
  return {
    name: 'Maestro Felino',
    padCount: 6,
    seqLen: 7 + (stage - 4),
    rounds: 3,
    stepMs: Math.max(290, 390 - (stage - 4) * 20),
  };
}

export function mountMemoryGame(
  container: HTMLElement,
  onComplete: (result: MiniGameResult) => void,
  onClose: () => void,
  highScore = 0,
  onToggleMute?: () => boolean
): () => void {
  let stage = 1;
  let round = 1;
  let score = 0;
  let lives = 3;
  let elapsedSec = 0;
  let sequence: number[] = [];
  let userStep = 0;
  let isPlayingBack = true;
  let stopped = false;
  let activeTimers: number[] = [];

  const clearTimers = () => {
    activeTimers.forEach((t) => clearTimeout(t));
    activeTimers = [];
  };

  container.innerHTML = `
    <div class="flex-1 flex flex-col min-h-0 h-full relative">
      <div class="flex items-center justify-between mb-1.5 shrink-0">
        <div>
          <div class="flex items-center gap-2">
            <h3 class="font-display text-base font-bold text-[#3b1f6e]">Memória dos Miados 🐾</h3>
            <span id="mem-stage-badge" class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">Fase 1</span>
          </div>
          <p id="mem-stage-sub" class="text-[11px] text-[#6b4d9e] font-semibold">Ouça a sequência de miados e repita!</p>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button id="mem-mute" type="button" aria-pressed="${!soundService.enabled}" aria-label="${soundService.enabled ? 'Silenciar áudio' : 'Ativar áudio'}" class="w-8 h-8 rounded-full ${soundService.enabled ? 'bg-purple-100 text-purple-800' : 'bg-rose-100 text-rose-800'} font-bold flex items-center justify-center shrink-0">${soundService.enabled ? '🔊' : '🔇'}</button>
          <button id="mem-close" class="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold flex items-center justify-center hover:bg-purple-200 shrink-0">✕</button>
        </div>
      </div>

      <div class="grid grid-cols-4 gap-1.5 bg-purple-50 rounded-2xl px-2.5 py-1.5 mb-2 border border-purple-200 text-center">
        <div>
          <div class="text-[10px] font-bold text-[#6b4d9e]">Pontos</div>
          <div id="mem-score" class="text-xs font-extrabold text-amber-600">0</div>
        </div>
        <div>
          <div class="text-[10px] font-bold text-[#6b4d9e]">Rodada</div>
          <div id="mem-round" class="text-xs font-extrabold text-purple-700">1/3</div>
        </div>
        <div>
          <div class="text-[10px] font-bold text-[#6b4d9e]">Vidas</div>
          <div id="mem-lives" class="text-xs font-extrabold text-rose-600">❤️❤️❤️</div>
        </div>
        <div>
          <div class="text-[10px] font-bold text-[#6b4d9e]">Tempo</div>
          <div id="mem-time" class="text-xs font-extrabold text-emerald-700">00:00</div>
        </div>
      </div>

      <div id="mem-status" class="text-center text-xs font-extrabold text-[#4c2a85] bg-white/85 border border-purple-100 rounded-xl py-1.5 px-3 mb-2">
        🎵 Miau vai cantar... preste atenção!
      </div>

      <div id="mem-grid" class="grid grid-cols-2 gap-2.5 flex-1"></div>

      <div class="flex items-center justify-between gap-2 mt-2">
        <span class="text-[11px] font-bold text-[#6b4d9e]">Recorde: <strong>${highScore}</strong></span>
        <button id="mem-replay" type="button" class="px-3 py-1.5 rounded-full bg-purple-100 hover:bg-purple-200 text-[#4c2a85] text-xs font-extrabold transition">
          🔊 Ouvir de novo
        </button>
      </div>

      <div id="mem-overlay" class="hidden absolute inset-0 z-20 rounded-3xl bg-purple-950/55 flex items-center justify-center p-4"></div>
    </div>
  `;

  const stageBadge = container.querySelector('#mem-stage-badge') as HTMLElement;
  const stageSub = container.querySelector('#mem-stage-sub') as HTMLElement;
  const scoreEl = container.querySelector('#mem-score') as HTMLElement;
  const roundEl = container.querySelector('#mem-round') as HTMLElement;
  const livesEl = container.querySelector('#mem-lives') as HTMLElement;
  const timeEl = container.querySelector('#mem-time') as HTMLElement;
  const statusEl = container.querySelector('#mem-status') as HTMLElement;
  const grid = container.querySelector('#mem-grid') as HTMLDivElement;
  const replayBtn = container.querySelector('#mem-replay') as HTMLButtonElement;
  const overlayEl = container.querySelector('#mem-overlay') as HTMLDivElement;
  const muteBtn = container.querySelector('#mem-mute') as HTMLButtonElement | null;
  const closeBtn = container.querySelector('#mem-close') as HTMLButtonElement;

  muteBtn?.addEventListener('click', () => {
    const next = onToggleMute
      ? onToggleMute()
      : (() => {
          soundService.setEnabled(!soundService.enabled);
          return soundService.enabled;
        })();
    muteBtn.textContent = next ? '🔊' : '🔇';
    muteBtn.setAttribute('aria-pressed', String(!next));
    muteBtn.setAttribute('aria-label', next ? 'Silenciar áudio' : 'Ativar áudio');
    muteBtn.className = `w-8 h-8 rounded-full ${next ? 'bg-purple-100 text-purple-800' : 'bg-rose-100 text-rose-800'} font-bold flex items-center justify-center shrink-0`;
  });

  const padButtons: HTMLButtonElement[] = [];

  const updateHud = () => {
    const cfg = getMemoryStageConfig(stage);
    stageBadge.textContent = `Fase ${stage}`;
    stageSub.textContent = `${cfg.name} • ${cfg.seqLen} miados por rodada`;
    scoreEl.textContent = String(score);
    roundEl.textContent = `${round}/${cfg.rounds}`;
    livesEl.textContent = '❤️'.repeat(Math.max(0, lives)) || '💔';
  };

  const flashPad = (padId: number, durationMs = 340) => {
    const btn = padButtons[padId];
    const pad = ALL_MEOW_PADS[padId];
    if (!btn || !pad) return;
    soundService.playMeow(pad.pitch);
    const glowClasses = pad.glowCls.split(' ');
    btn.classList.add(...glowClasses);
    const t = window.setTimeout(() => {
      btn.classList.remove(...glowClasses);
    }, durationMs);
    activeTimers.push(t);
  };

  const playSequence = () => {
    if (stopped) return;
    clearTimers();
    isPlayingBack = true;
    userStep = 0;
    const cfg = getMemoryStageConfig(stage);
    statusEl.textContent = `🎵 Ouça os ${sequence.length} miados...`;
    replayBtn.disabled = true;

    sequence.forEach((padId, i) => {
      const t = window.setTimeout(() => {
        if (stopped) return;
        flashPad(padId, Math.max(220, cfg.stepMs - 140));
      }, 360 + i * cfg.stepMs);
      activeTimers.push(t);
    });

    const endT = window.setTimeout(() => {
      if (stopped) return;
      isPlayingBack = false;
      replayBtn.disabled = false;
      statusEl.textContent = `🐾 Sua vez! Toque ${sequence.length} notas (${userStep}/${sequence.length})`;
    }, 420 + sequence.length * cfg.stepMs);
    activeTimers.push(endT);
  };

  const buildPadsAndStartRound = () => {
    const cfg = getMemoryStageConfig(stage);
    const activePads = ALL_MEOW_PADS.slice(0, cfg.padCount);
    grid.className =
      cfg.padCount >= 5
        ? 'grid grid-cols-3 gap-2 flex-1'
        : 'grid grid-cols-2 gap-2.5 flex-1';
    grid.innerHTML = '';
    padButtons.length = 0;

    activePads.forEach((pad) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `rounded-2xl bg-gradient-to-br ${pad.bgCls} text-white border-2 border-white shadow-md flex flex-col items-center justify-center gap-0.5 py-3 transition-all active:scale-95`;
      btn.innerHTML = `
        <span class="text-2xl drop-shadow">${pad.emoji}</span>
        <span class="text-[11px] font-extrabold tracking-wide">${pad.label}</span>
      `;
      btn.addEventListener('click', () => handlePadTap(pad.id));
      padButtons[pad.id] = btn;
      grid.appendChild(btn);
    });

    const len = cfg.seqLen + (round - 1 >= 2 ? 1 : 0);
    sequence = Array.from({ length: len }, () =>
      Math.floor(Math.random() * cfg.padCount)
    );
    updateHud();
    playSequence();
  };

  const showStageModal = (mode: 'clear' | 'gameover') => {
    isPlayingBack = true;
    clearTimers();
    overlayEl.classList.remove('hidden');
    const nextStage = stage + 1;
    const nextCfg = getMemoryStageConfig(nextStage);
    overlayEl.innerHTML =
      mode === 'clear'
        ? `
      <div class="w-full max-w-[290px] bg-white rounded-3xl p-4 text-center shadow-2xl border-2 border-purple-200 flex flex-col gap-2.5">
        <div class="text-3xl">🎶</div>
        <h4 class="font-display text-lg font-bold text-[#3b1f6e]">Fase ${stage} Dominada!</h4>
        <p class="text-xs text-[#5e4294] font-semibold">Pontuação: <strong>${score} pts</strong>! Próxima: <strong>Fase ${nextStage} (${nextCfg.name})</strong></p>
        <button id="mem-next-stage" class="w-full py-2.5 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-display font-bold text-sm shadow hover:brightness-105">
          Avançar para Fase ${nextStage} ➡️
        </button>
        <button id="mem-finish-now" class="w-full py-2 rounded-2xl bg-amber-100 text-amber-900 font-extrabold text-xs hover:bg-amber-200">
          🪙 Resgatar Moedas Agora
        </button>
      </div>
    `
        : `
      <div class="w-full max-w-[290px] bg-white rounded-3xl p-4 text-center shadow-2xl border-2 border-purple-200 flex flex-col gap-2.5">
        <div class="text-3xl">😿</div>
        <h4 class="font-display text-lg font-bold text-[#3b1f6e]">Fim do Show Musical!</h4>
        <p class="text-xs text-[#5e4294] font-semibold">Você chegou à <strong>Fase ${stage}</strong> com <strong>${score} pts</strong>!</p>
        <button id="mem-finish-now" class="w-full py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-display font-bold text-sm shadow">
          🪙 Resgatar Recompensa
        </button>
      </div>
    `;

    overlayEl
      .querySelector('#mem-next-stage')
      ?.addEventListener('click', () => {
        overlayEl.classList.add('hidden');
        stage = nextStage;
        round = 1;
        lives = Math.min(3, lives + 1);
        buildPadsAndStartRound();
      });
    overlayEl
      .querySelector('#mem-finish-now')
      ?.addEventListener('click', () => {
        finishGame();
      });
  };

  const handlePadTap = (padId: number) => {
    if (stopped || isPlayingBack) return;
    flashPad(padId, 240);
    hapticService.tap();

    if (sequence[userStep] === padId) {
      userStep += 1;
      score += 12 + stage * 4;
      updateHud();

      if (userStep >= sequence.length) {
        isPlayingBack = true;
        score += 35 * stage;
        updateHud();
        soundService.playCoin();
        hapticService.coin();
        const cfg = getMemoryStageConfig(stage);
        if (round < cfg.rounds) {
          round += 1;
          statusEl.textContent = '✨ Perfeito! Preparando próxima sequência...';
          const t = window.setTimeout(() => buildPadsAndStartRound(), 750);
          activeTimers.push(t);
        } else {
          showStageModal('clear');
        }
      } else {
        statusEl.textContent = `🐾 Muito bem! (${userStep}/${sequence.length})`;
      }
    } else {
      lives -= 1;
      hapticService.warning();
      updateHud();
      if (lives <= 0) {
        showStageModal('gameover');
      } else {
        isPlayingBack = true;
        statusEl.textContent = '😿 Ops! Vamos ouvir a sequência de novo...';
        const t = window.setTimeout(() => playSequence(), 800);
        activeTimers.push(t);
      }
    }
  };

  replayBtn.addEventListener('click', () => {
    if (!isPlayingBack && !stopped) {
      playSequence();
    }
  });

  const timerId = window.setInterval(() => {
    if (stopped) return;
    elapsedSec += 1;
    timeEl.textContent = formatTimer(elapsedSec);
  }, 1000);

  const cleanup = () => {
    stopped = true;
    clearTimers();
    clearInterval(timerId);
  };

  const finishGame = () => {
    cleanup();
    const coinsEarned = Math.max(
      25,
      Math.round(score * 0.35) + (stage - 1) * 20
    );
    const funBoost = Math.min(40, 18 + stage * 5);
    const xpEarned = Math.max(18, 12 + stage * 9 + Math.round(score / 30));
    const performanceTier: 'gold' | 'silver' | 'bronze' =
      stage >= 3 || score >= 340
        ? 'gold'
        : stage >= 2 || score >= 160
          ? 'silver'
          : 'bronze';
    onComplete({
      gameId: 'memory',
      gameName: 'Memória dos Miados',
      score,
      stageReached: stage,
      durationSec: Math.max(1, elapsedSec),
      coinsEarned,
      funBoost,
      xpEarned,
      performanceTier,
      summaryText: `Fase ${stage} alcançada • ${score} pts`,
    });
  };

  closeBtn.addEventListener('click', () => {
    cleanup();
    onClose();
  });

  buildPadsAndStartRound();
  return cleanup;
}
