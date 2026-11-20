import { hapticService } from '../services/hapticService';
import { soundService } from '../services/soundService';

export interface MiniGameResult {
  gameName: string;
  score: number;
  coinsEarned: number;
  funBoost: number;
  xpEarned: number;
  performanceTier: 'gold' | 'silver' | 'bronze';
  summaryText: string;
}

export function mountFishCatchGame(
  container: HTMLElement,
  onComplete: (result: MiniGameResult) => void,
  onClose: () => void
): () => void {
  let score = 0;
  let caughtCount = 0;
  let timeLeft = 22;
  let basketX = 50;
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

  container.innerHTML = `
    <div class="flex flex-col h-full">
      <div class="flex items-center justify-between mb-2">
        <div>
          <h3 class="font-display text-lg font-bold text-[#3b1f6e]">Caça aos Peixinhos 🐟</h3>
          <p class="text-xs text-[#6b4d9e]">Mova o Miau ou toque nos peixes! Evite botas velhas.</p>
        </div>
        <button id="mg-close" class="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold flex items-center justify-center hover:bg-purple-200">✕</button>
      </div>
      <div class="flex items-center justify-between bg-purple-50 rounded-2xl px-4 py-2 mb-2 border border-purple-200">
        <span class="text-sm font-bold text-amber-600">Pontos: <strong id="mg-score">0</strong></span>
        <span class="text-sm font-bold text-emerald-600">Pegos: <strong id="mg-caught">0</strong></span>
        <span class="text-sm font-bold text-purple-700">Tempo: <strong id="mg-time">${timeLeft}s</strong></span>
      </div>
      <div id="mg-stage" class="relative flex-1 min-h-[250px] rounded-3xl overflow-hidden bg-gradient-to-b from-sky-100 via-purple-100 to-purple-200 border-2 border-white shadow-inner touch-none cursor-crosshair">
        <div id="mg-basket" class="absolute bottom-3 -translate-x-1/2 text-4xl transition-transform duration-75 select-none pointer-events-none" style="left: 50%">🐱</div>
      </div>
    </div>
  `;

  const stage = container.querySelector('#mg-stage') as HTMLDivElement;
  const basket = container.querySelector('#mg-basket') as HTMLDivElement;
  const scoreEl = container.querySelector('#mg-score') as HTMLElement;
  const caughtEl = container.querySelector('#mg-caught') as HTMLElement;
  const timeEl = container.querySelector('#mg-time') as HTMLElement;
  const closeBtn = container.querySelector('#mg-close') as HTMLButtonElement;

  const updateBasket = (clientX: number) => {
    const rect = stage.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    basketX = Math.max(8, Math.min(92, pct));
    basket.style.left = `${basketX}%`;
  };

  stage.addEventListener('pointermove', (e) => updateBasket(e.clientX));
  stage.addEventListener('pointerdown', (e) => updateBasket(e.clientX));

  const collectItem = (item: FallingItem) => {
    score = Math.max(0, score + item.points);
    if (!item.isBad) {
      caughtCount += 1;
      soundService.playCoin();
      hapticService.coin();
    } else {
      soundService.playMeow(0.78);
      hapticService.warning();
    }
    scoreEl.textContent = String(score);
    caughtEl.textContent = String(caughtCount);
    item.el.remove();
    const idx = items.indexOf(item);
    if (idx >= 0) items.splice(idx, 1);
  };

  const spawnItem = () => {
    if (stopped) return;
    const roll = Math.random();
    const isBad = roll > 0.8;
    const isGold = roll < 0.18;
    const emoji = isBad ? '🥾' : isGold ? '🐠' : roll < 0.55 ? '🐟' : '🧶';
    const points = isBad ? -15 : isGold ? 25 : 12;

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
      speed: 26 + Math.random() * 20,
      emoji,
      points,
      isBad,
      el,
    };

    el.addEventListener('pointerdown', (ev) => {
      ev.stopPropagation();
      if (stopped) return;
      collectItem(item);
    });

    stage.appendChild(el);
    items.push(item);
  };

  const spawnTimer = window.setInterval(spawnItem, 600);
  const countdownTimer = window.setInterval(() => {
    timeLeft -= 1;
    timeEl.textContent = `${timeLeft}s`;
    if (timeLeft <= 0) {
      finishGame();
    }
  }, 1000);

  let lastFrame = performance.now();
  let rafId = 0;

  const tick = (now: number) => {
    if (stopped) return;
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;

    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      item.y += item.speed * dt;
      item.el.style.top = `${item.y}%`;

      if (item.y >= 80 && item.y <= 92 && Math.abs(item.x - basketX) < 13) {
        collectItem(item);
      } else if (item.y > 104) {
        item.el.remove();
        items.splice(i, 1);
      }
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  const cleanup = () => {
    stopped = true;
    clearInterval(spawnTimer);
    clearInterval(countdownTimer);
    cancelAnimationFrame(rafId);
  };

  const finishGame = () => {
    cleanup();
    const coinsEarned = Math.max(20, Math.round(score * 0.9));
    const funBoost = Math.min(35, 12 + Math.round(score / 12));
    const xpEarned = Math.max(14, Math.round(score / 6));
    const performanceTier: 'gold' | 'silver' | 'bronze' =
      score >= 160 ? 'gold' : score >= 85 ? 'silver' : 'bronze';
    onComplete({
      gameName: 'Caça aos Peixinhos',
      score,
      coinsEarned,
      funBoost,
      xpEarned,
      performanceTier,
      summaryText: `${score} pontos e ${caughtCount} itens pegos`,
    });
  };

  closeBtn.addEventListener('click', () => {
    cleanup();
    onClose();
  });

  return cleanup;
}

export function mountMemoryGame(
  container: HTMLElement,
  onComplete: (result: MiniGameResult) => void,
  onClose: () => void
): () => void {
  const symbolPairs = [
    { emoji: '🐾', pitch: 0.85 },
    { emoji: '🐟', pitch: 1.0 },
    { emoji: '🧶', pitch: 1.12 },
    { emoji: '👑', pitch: 1.25 },
    { emoji: '🎀', pitch: 1.38 },
    { emoji: '🌙', pitch: 1.5 },
  ];
  const deck = [...symbolPairs, ...symbolPairs].sort(() => Math.random() - 0.5);
  let flipped: number[] = [];
  const matched = new Set<number>();
  let moves = 0;
  let mistakes = 0;
  let lock = false;

  container.innerHTML = `
    <div class="flex flex-col h-full">
      <div class="flex items-center justify-between mb-2">
        <div>
          <h3 class="font-display text-lg font-bold text-[#3b1f6e]">Memória dos Miados 🐾</h3>
          <p class="text-xs text-[#6b4d9e]">Ouça o miado musical de cada carta e combine os 6 pares!</p>
        </div>
        <button id="mem-close" class="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold flex items-center justify-center hover:bg-purple-200">✕</button>
      </div>
      <div class="flex items-center justify-between bg-purple-50 rounded-2xl px-4 py-2 mb-3 border border-purple-200">
        <span class="text-sm font-bold text-purple-700">Pares: <strong id="mem-pairs">0/6</strong></span>
        <span class="text-sm font-bold text-pink-600">Jogadas: <strong id="mem-moves">0</strong></span>
      </div>
      <div id="mem-grid" class="grid grid-cols-4 gap-2.5 flex-1"></div>
    </div>
  `;

  const grid = container.querySelector('#mem-grid') as HTMLDivElement;
  const pairsEl = container.querySelector('#mem-pairs') as HTMLElement;
  const movesEl = container.querySelector('#mem-moves') as HTMLElement;
  const closeBtn = container.querySelector('#mem-close') as HTMLButtonElement;

  const buttons: HTMLButtonElement[] = [];

  const renderCards = () => {
    buttons.forEach((btn, idx) => {
      const isOpen = flipped.includes(idx) || matched.has(idx);
      btn.textContent = isOpen ? deck[idx].emoji : '🔊';
      btn.className = isOpen
        ? 'h-16 rounded-2xl text-2xl font-bold bg-white border-2 border-purple-300 shadow-sm flex items-center justify-center transition-all scale-105'
        : 'h-16 rounded-2xl text-xl font-bold bg-gradient-to-br from-purple-400 to-fuchsia-400 text-white border-2 border-white/80 shadow-md flex items-center justify-center hover:scale-[1.03] transition-all';
    });
  };

  deck.forEach((card, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.addEventListener('click', () => {
      if (lock || flipped.includes(idx) || matched.has(idx)) return;
      soundService.playMeow(card.pitch);
      hapticService.tap();
      flipped.push(idx);
      renderCards();

      if (flipped.length === 2) {
        moves += 1;
        movesEl.textContent = String(moves);
        const [a, b] = flipped;
        if (deck[a].emoji === deck[b].emoji) {
          matched.add(a);
          matched.add(b);
          flipped = [];
          pairsEl.textContent = `${matched.size / 2}/6`;
          window.setTimeout(() => {
            soundService.playCoin();
            hapticService.coin();
          }, 140);
          renderCards();
          if (matched.size === deck.length) {
            window.setTimeout(() => {
              const coinsEarned = Math.max(45, 130 - mistakes * 8);
              const score = Math.max(50, 200 - mistakes * 15);
              const performanceTier: 'gold' | 'silver' | 'bronze' =
                moves <= 9 ? 'gold' : moves <= 13 ? 'silver' : 'bronze';
              onComplete({
                gameName: 'Memória dos Miados',
                score,
                coinsEarned,
                funBoost: 30,
                xpEarned: 26,
                performanceTier,
                summaryText: `6 pares encontrados em ${moves} jogadas`,
              });
            }, 420);
          }
        } else {
          mistakes += 1;
          lock = true;
          hapticService.warning();
          window.setTimeout(() => {
            flipped = [];
            lock = false;
            renderCards();
          }, 650);
        }
      }
    });
    buttons.push(btn);
    grid.appendChild(btn);
  });

  renderCards();

  closeBtn.addEventListener('click', onClose);
  return () => {
    lock = true;
  };
}
