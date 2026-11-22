import { hapticService } from '../../services/hapticService';
import { soundService } from '../../services/soundService';
import type { MiniGameResult } from '../MiniGames';

function formatTimer(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

interface FishStageConfig {
  name: string;
  goal: number;
  duration: number;
  spawnMs: number;
  minSpeed: number;
  maxSpeed: number;
  badChance: number;
  goldChance: number;
  comboEnabled: boolean;
}

function getFishStageConfig(stage: number): FishStageConfig {
  if (stage === 1) {
    return {
      name: 'Manhã Tranquila',
      goal: 8,
      duration: 36,
      spawnMs: 920,
      minSpeed: 12,
      maxSpeed: 18,
      badChance: 0.06,
      goldChance: 0.16,
      comboEnabled: false,
    };
  }
  if (stage === 2) {
    return {
      name: 'Brisa Suave',
      goal: 11,
      duration: 34,
      spawnMs: 740,
      minSpeed: 18,
      maxSpeed: 26,
      badChance: 0.14,
      goldChance: 0.22,
      comboEnabled: true,
    };
  }
  if (stage === 3) {
    return {
      name: 'Chuva de Petiscos',
      goal: 14,
      duration: 32,
      spawnMs: 580,
      minSpeed: 25,
      maxSpeed: 34,
      badChance: 0.2,
      goldChance: 0.26,
      comboEnabled: true,
    };
  }
  return {
    name: 'Modo Mestre Felino',
    goal: 16 + (stage - 4) * 3,
    duration: 32,
    spawnMs: Math.max(360, 500 - (stage - 4) * 28),
    minSpeed: Math.min(46, 30 + (stage - 4) * 3),
    maxSpeed: Math.min(60, 40 + (stage - 4) * 4),
    badChance: 0.24,
    goldChance: 0.28,
    comboEnabled: true,
  };
}

export function mountFishCatchGame(
  container: HTMLElement,
  onComplete: (result: MiniGameResult) => void,
  onClose: () => void,
  highScore = 0,
  onToggleMute?: () => boolean
): () => void {
  let stage = 1;
  let score = 0;
  let totalCaught = 0;
  let stageCaught = 0;
  let combo = 0;
  let maxCombo = 0;
  let timeLeft = getFishStageConfig(1).duration;
  let totalElapsedSec = 0;
  let basketX = 50;
  let paused = false;
  let stopped = false;

  interface FallingItem {
    id: number;
    x: number;
    y: number;
    speed: number;
    emoji: string;
    points: number;
    isBad: boolean;
    el: HTMLDivElement;
  }

  let nextId = 1;
  const items: FallingItem[] = [];
  let spawnTimer: number | null = null;

  container.innerHTML = `
    <div class="flex-1 flex flex-col min-h-0 h-full">
      <div class="flex items-center justify-between mb-1.5 shrink-0">
        <div>
          <div class="flex items-center gap-2">
            <h3 class="font-display text-base font-bold text-[#3b1f6e]">Caça aos Peixinhos 🐟</h3>
            <span id="mg-stage-badge" class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Fase 1</span>
          </div>
          <p id="mg-stage-sub" class="text-[11px] text-[#6b4d9e] font-semibold">Manhã Tranquila • Meta: 8 itens</p>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button id="mg-mute" type="button" aria-pressed="${!soundService.enabled}" aria-label="${soundService.enabled ? 'Silenciar áudio' : 'Ativar áudio'}" class="w-8 h-8 rounded-full ${soundService.enabled ? 'bg-purple-100 text-purple-800' : 'bg-rose-100 text-rose-800'} font-bold flex items-center justify-center shrink-0">${soundService.enabled ? '🔊' : '🔇'}</button>
          <button id="mg-close" class="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold flex items-center justify-center hover:bg-purple-200 shrink-0">✕</button>
        </div>
      </div>

      <div class="grid grid-cols-4 gap-1.5 bg-purple-50 rounded-2xl px-2.5 py-1.5 mb-2 border border-purple-200 text-center">
        <div>
          <div class="text-[10px] font-bold text-[#6b4d9e]">Pontos</div>
          <div id="mg-score" class="text-xs font-extrabold text-amber-600">0</div>
        </div>
        <div>
          <div class="text-[10px] font-bold text-[#6b4d9e]">Meta</div>
          <div id="mg-goal" class="text-xs font-extrabold text-emerald-600">0/8</div>
        </div>
        <div>
          <div class="text-[10px] font-bold text-[#6b4d9e]">Combo</div>
          <div id="mg-combo" class="text-xs font-extrabold text-fuchsia-600">x1</div>
        </div>
        <div>
          <div class="text-[10px] font-bold text-[#6b4d9e]">Tempo</div>
          <div id="mg-time" class="text-xs font-extrabold text-purple-700">${formatTimer(timeLeft)}</div>
        </div>
      </div>

      <div class="w-full h-1.5 bg-purple-100 rounded-full overflow-hidden mb-2">
        <div id="mg-progress-bar" class="h-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-150" style="width: 0%"></div>
      </div>

      <div id="mg-stage" class="relative flex-1 min-h-[250px] rounded-3xl overflow-hidden bg-gradient-to-b from-sky-100 via-purple-100 to-purple-200 border-2 border-white shadow-inner touch-none cursor-crosshair">
        <div class="absolute top-2 right-2.5 text-[10px] font-extrabold text-purple-700/75 bg-white/75 px-2 py-0.5 rounded-full pointer-events-none">
          Recorde: ${highScore}
        </div>
        <div id="mg-basket" class="absolute bottom-3 -translate-x-1/2 text-4xl transition-transform duration-75 select-none pointer-events-none" style="left: 50%">🐱</div>
        <div id="mg-overlay" class="hidden absolute inset-0 z-20 bg-purple-950/55 flex items-center justify-center p-4"></div>
      </div>
    </div>
  `;

  const stageEl = container.querySelector('#mg-stage') as HTMLDivElement;
  const basket = container.querySelector('#mg-basket') as HTMLDivElement;
  const overlayEl = container.querySelector('#mg-overlay') as HTMLDivElement;
  const stageBadge = container.querySelector('#mg-stage-badge') as HTMLElement;
  const stageSub = container.querySelector('#mg-stage-sub') as HTMLElement;
  const scoreEl = container.querySelector('#mg-score') as HTMLElement;
  const goalEl = container.querySelector('#mg-goal') as HTMLElement;
  const comboEl = container.querySelector('#mg-combo') as HTMLElement;
  const timeEl = container.querySelector('#mg-time') as HTMLElement;
  const progressBar = container.querySelector('#mg-progress-bar') as HTMLElement;
  const muteBtn = container.querySelector('#mg-mute') as HTMLButtonElement | null;
  const closeBtn = container.querySelector('#mg-close') as HTMLButtonElement;

  const updateHud = () => {
    const cfg = getFishStageConfig(stage);
    stageBadge.textContent = `Fase ${stage}`;
    stageSub.textContent = `${cfg.name} • Meta: ${cfg.goal} itens`;
    scoreEl.textContent = String(score);
    goalEl.textContent = `${Math.min(stageCaught, cfg.goal)}/${cfg.goal}`;
    const mult = cfg.comboEnabled ? Math.min(4, 1 + Math.floor(combo / 3)) : 1;
    comboEl.textContent = `x${mult}`;
    timeEl.textContent = formatTimer(timeLeft);
    const pct = Math.min(100, Math.round((stageCaught / cfg.goal) * 100));
    progressBar.style.width = `${pct}%`;
  };

  const clearFallingItems = () => {
    while (items.length > 0) {
      const it = items.pop();
      it?.el.remove();
    }
  };

  const updateBasket = (clientX: number) => {
    if (paused || stopped) return;
    const rect = stageEl.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    basketX = Math.max(8, Math.min(92, pct));
    basket.style.left = `${basketX}%`;
  };

  stageEl.addEventListener('pointermove', (e) => updateBasket(e.clientX));
  stageEl.addEventListener('pointerdown', (e) => {
    try {
      stageEl.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic events
    }
    updateBasket(e.clientX);
  });
  stageEl.addEventListener('pointercancel', () => {});

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

  const showFloatingPop = (
    x: number,
    y: number,
    text: string,
    colorCls: string
  ) => {
    const pop = document.createElement('div');
    pop.className = `absolute -translate-x-1/2 text-xs font-extrabold pointer-events-none animate-float-up ${colorCls}`;
    pop.style.left = `${x}%`;
    pop.style.top = `${Math.max(10, Math.min(82, y))}%`;
    pop.textContent = text;
    stageEl.appendChild(pop);
    window.setTimeout(() => pop.remove(), 800);
  };

  const showStageClearOverlay = () => {
    paused = true;
    clearFallingItems();
    soundService.playCoin();
    hapticService.achievement();
    const nextStage = stage + 1;
    const nextCfg = getFishStageConfig(nextStage);
    overlayEl.classList.remove('hidden');
    overlayEl.innerHTML = `
      <div class="w-full max-w-[290px] bg-white rounded-3xl p-4 text-center shadow-2xl border-2 border-purple-200 flex flex-col gap-2.5">
        <div class="text-3xl">🏆</div>
        <h4 class="font-display text-lg font-bold text-[#3b1f6e]">Fase ${stage} Concluída!</h4>
        <p class="text-xs text-[#5e4294] font-semibold">Você acumulou <strong>${score} pts</strong>! Próxima: <strong>Fase ${nextStage} (${nextCfg.name})</strong></p>
        <button id="mg-next-stage" class="w-full py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-display font-bold text-sm shadow hover:brightness-105">
          Avançar para Fase ${nextStage} ➡️
        </button>
        <button id="mg-finish-now" class="w-full py-2 rounded-2xl bg-amber-100 text-amber-900 font-extrabold text-xs hover:bg-amber-200">
          🪙 Resgatar Moedas Agora
        </button>
      </div>
    `;
    overlayEl.querySelector('#mg-next-stage')?.addEventListener('click', () => {
      overlayEl.classList.add('hidden');
      clearFallingItems();
      stage = nextStage;
      stageCaught = 0;
      const cfg = getFishStageConfig(stage);
      timeLeft = cfg.duration;
      lastFrame = performance.now();
      paused = false;
      restartSpawner(true);
      updateHud();
    });
    overlayEl.querySelector('#mg-finish-now')?.addEventListener('click', () => {
      finishGame();
    });
  };

  const collectItem = (item: FallingItem) => {
    const cfg = getFishStageConfig(stage);
    if (!item.isBad) {
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);
      const mult = cfg.comboEnabled ? Math.min(4, 1 + Math.floor(combo / 3)) : 1;
      const gained = item.points * mult;
      score += gained;
      totalCaught += 1;
      stageCaught += 1;
      soundService.playCoin();
      hapticService.coin();
      showFloatingPop(item.x, item.y, `+${gained}`, 'text-emerald-700');
    } else {
      combo = 0;
      score = Math.max(0, score + item.points);
      soundService.playMeow(0.78);
      hapticService.warning();
      showFloatingPop(item.x, item.y, `${item.points}`, 'text-rose-600');
    }
    item.el.remove();
    const idx = items.indexOf(item);
    if (idx >= 0) items.splice(idx, 1);
    updateHud();

    if (stageCaught >= cfg.goal && !paused) {
      showStageClearOverlay();
    }
  };

  const spawnItem = () => {
    if (stopped || paused) return;
    const cfg = getFishStageConfig(stage);
    const roll = Math.random();
    const isBad = roll < cfg.badChance;
    const isGold = !isBad && roll < cfg.badChance + cfg.goldChance;
    const badEmoji = stage >= 3 && Math.random() < 0.45 ? '🥫' : '🥾';
    const emoji = isBad
      ? badEmoji
      : isGold
        ? '🐠'
        : Math.random() < 0.65
          ? '🐟'
          : '🧶';
    const points = isBad ? -18 : isGold ? 28 : 12 + (stage - 1) * 2;

    const el = document.createElement('div');
    el.className = 'absolute -translate-x-1/2 text-2xl select-none cursor-pointer';
    const x = 10 + Math.random() * 80;
    el.style.left = `${x}%`;
    el.style.top = '-24px';
    el.textContent = emoji;

    const item: FallingItem = {
      id: nextId++,
      x,
      y: -5,
      speed: cfg.minSpeed + Math.random() * (cfg.maxSpeed - cfg.minSpeed),
      emoji,
      points,
      isBad,
      el,
    };

    el.addEventListener('pointerdown', (ev) => {
      ev.stopPropagation();
      if (stopped || paused) return;
      collectItem(item);
    });

    stageEl.appendChild(el);
    items.push(item);
  };

  const restartSpawner = (spawnImmediate = true) => {
    if (spawnTimer !== null) {
      clearInterval(spawnTimer);
      spawnTimer = null;
    }
    const cfg = getFishStageConfig(stage);
    if (spawnImmediate && !stopped && !paused) {
      spawnItem();
    }
    spawnTimer = window.setInterval(spawnItem, cfg.spawnMs);
  };

  restartSpawner(true);
  updateHud();

  const countdownTimer = window.setInterval(() => {
    if (stopped || paused) return;
    totalElapsedSec += 1;
    timeLeft -= 1;
    timeEl.textContent = formatTimer(timeLeft);
    if (timeLeft <= 0) {
      finishGame();
    }
  }, 1000);

  let lastFrame = performance.now();
  let rafId = 0;

  const tick = (now: number) => {
    if (stopped) return;
    const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;

    if (!paused) {
      for (let i = items.length - 1; i >= 0; i--) {
        if (stopped || paused) break;
        const item = items[i];
        if (!item) continue;
        item.y += item.speed * dt;
        item.el.style.top = `${item.y}%`;

        if (item.y >= 79 && item.y <= 92 && Math.abs(item.x - basketX) < 13) {
          collectItem(item);
          if (paused || stopped) break;
        } else if (item.y > 104) {
          if (!item.isBad) combo = 0;
          item.el.remove();
          const curIdx = items.indexOf(item);
          if (curIdx >= 0) items.splice(curIdx, 1);
        }
      }
    }
    if (!stopped) {
      rafId = requestAnimationFrame(tick);
    }
  };
  rafId = requestAnimationFrame(tick);

  const cleanup = () => {
    stopped = true;
    if (spawnTimer !== null) clearInterval(spawnTimer);
    clearInterval(countdownTimer);
    cancelAnimationFrame(rafId);
  };

  const finishGame = () => {
    cleanup();
    const stageBonus = (stage - 1) * 25;
    const coinsEarned = Math.max(20, Math.round(score * 0.45) + stageBonus);
    const funBoost = Math.min(40, 14 + stage * 5 + Math.round(score / 45));
    const xpEarned = Math.max(15, 10 + stage * 8 + Math.round(score / 25));
    const performanceTier: 'gold' | 'silver' | 'bronze' =
      stage >= 3 || score >= 320
        ? 'gold'
        : stage >= 2 || score >= 140
          ? 'silver'
          : 'bronze';
    onComplete({
      gameId: 'fish',
      gameName: 'Caça aos Peixinhos',
      score,
      stageReached: stage,
      durationSec: Math.max(1, totalElapsedSec),
      coinsEarned,
      funBoost,
      xpEarned,
      performanceTier,
      summaryText: `Fase ${stage} • ${score} pts • ${totalCaught} itens (combo máx x${Math.max(1, 1 + Math.floor(maxCombo / 3))})`,
    });
  };

  closeBtn.addEventListener('click', () => {
    cleanup();
    onClose();
  });

  return cleanup;
}
