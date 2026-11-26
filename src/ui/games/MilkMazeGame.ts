import { hapticService } from '../../services/hapticService';
import { soundService } from '../../services/soundService';
import type { MiniGameResult } from '../MiniGames';

type MazeCell = '#' | '.';
type Dir = 'up' | 'down' | 'left' | 'right';

interface Point {
  x: number;
  y: number;
}

interface PatrolGuard {
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  axis: 'x' | 'y';
  speed: number;
}

interface MazeStageConfig {
  stage: number;
  cols: number;
  rows: number;
  parSec: number;
  fishCount: number;
  guardsCount: number;
  lanternMode: boolean;
}

function getMazeStageConfig(stage: number): MazeStageConfig {
  const dim = Math.min(21, 9 + (stage - 1) * 2);
  const oddDim = dim % 2 === 0 ? dim + 1 : dim;
  return {
    stage,
    cols: oddDim,
    rows: oddDim,
    parSec: 26 + stage * 8,
    fishCount: Math.min(6, 2 + Math.floor(stage / 2)),
    guardsCount: stage >= 3 ? Math.min(4, stage - 2) : 0,
    lanternMode: stage >= 5,
  };
}

function generateSolvableMaze(cols: number, rows: number): MazeCell[][] {
  const grid: MazeCell[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => '#' as MazeCell)
  );

  const stack: Point[] = [{ x: 1, y: 1 }];
  grid[1][1] = '.';

  const shuffle = <T>(arr: T[]): T[] => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  while (stack.length > 0) {
    const cur = stack[stack.length - 1];
    const dirs = shuffle([
      { dx: 0, dy: -2 },
      { dx: 2, dy: 0 },
      { dx: 0, dy: 2 },
      { dx: -2, dy: 0 },
    ]);
    let carved = false;
    for (const d of dirs) {
      const nx = cur.x + d.dx;
      const ny = cur.y + d.dy;
      if (nx > 0 && nx < cols - 1 && ny > 0 && ny < rows - 1 && grid[ny][nx] === '#') {
        grid[cur.y + d.dy / 2][cur.x + d.dx / 2] = '.';
        grid[ny][nx] = '.';
        stack.push({ x: nx, y: ny });
        carved = true;
        break;
      }
    }
    if (!carved) stack.pop();
  }

  // Adiciona alguns atalhos discretos em fases mais altas para tornar desvios dinâmicos
  const extraOpenings = Math.floor(cols / 5);
  for (let i = 0; i < extraOpenings; i++) {
    const rx = 2 + Math.floor(Math.random() * (cols - 4));
    const ry = 2 + Math.floor(Math.random() * (rows - 4));
    if (grid[ry][rx] === '#') {
      const openHoriz = grid[ry][rx - 1] === '.' && grid[ry][rx + 1] === '.';
      const openVert = grid[ry - 1][rx] === '.' && grid[ry + 1][rx] === '.';
      if (openHoriz || openVert) {
        grid[ry][rx] = '.';
      }
    }
  }

  return grid;
}

function bfsDistances(grid: MazeCell[][], start: Point): Map<string, number> {
  const rows = grid.length;
  const cols = grid[0].length;
  const dist = new Map<string, number>();
  const q: Point[] = [start];
  dist.set(`${start.x},${start.y}`, 0);

  while (q.length > 0) {
    const cur = q.shift()!;
    const d = dist.get(`${cur.x},${cur.y}`)!;
    const neighbors = [
      { x: cur.x + 1, y: cur.y },
      { x: cur.x - 1, y: cur.y },
      { x: cur.x, y: cur.y + 1 },
      { x: cur.x, y: cur.y - 1 },
    ];
    for (const n of neighbors) {
      if (
        n.x >= 0 &&
        n.x < cols &&
        n.y >= 0 &&
        n.y < rows &&
        grid[n.y][n.x] === '.' &&
        !dist.has(`${n.x},${n.y}`)
      ) {
        dist.set(`${n.x},${n.y}`, d + 1);
        q.push(n);
      }
    }
  }
  return dist;
}

export function mountMilkMazeGame(
  container: HTMLElement,
  onComplete: (result: MiniGameResult) => void,
  onClose: () => void,
  highScore = 0,
  onToggleMute?: () => boolean
): () => void {
  let stopped = false;
  let paused = false;
  let stage = 1;
  let score = 0;
  let hearts = 3;
  let totalDurationSec = 0;
  let stageElapsedSec = 0;
  let movesCount = 0;
  let parSteps = 12;

  let cfg = getMazeStageConfig(1);
  let grid: MazeCell[][] = [];
  let player: Point = { x: 1, y: 1 };
  let goal: Point = { x: cfg.cols - 2, y: cfg.rows - 2 };
  let fishes: Point[] = [];
  let fishesCollectedStage = 0;
  let guards: PatrolGuard[] = [];
  let hurtInvuln = 0;

  container.innerHTML = `
    <div class="flex-1 flex flex-col min-h-0 h-full select-none">
      <div class="flex items-center justify-between mb-1.5 shrink-0">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h3 class="font-display text-base font-bold text-[#3b1f6e] truncate">Labirinto do Leitinho 🥛</h3>
            <span id="mz-stage-badge" class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 shrink-0">Fase 1 (${cfg.cols}×${cfg.rows})</span>
          </div>
          <p id="mz-sub" class="text-[11px] text-[#6b4d9e] font-semibold truncate">Guie o Miau até o pratinho de leite no canto inferior direito!</p>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button id="mg-mute" type="button" aria-pressed="${!soundService.enabled}" class="w-8 h-8 rounded-full ${soundService.enabled ? 'bg-purple-100 text-purple-800' : 'bg-rose-100 text-rose-800'} font-bold flex items-center justify-center shrink-0">${soundService.enabled ? '🔊' : '🔇'}</button>
          <button id="mg-close" type="button" class="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold flex items-center justify-center hover:bg-purple-200 shrink-0">✕</button>
        </div>
      </div>

      <div class="grid grid-cols-4 gap-1.5 bg-purple-50 rounded-2xl px-2.5 py-1.5 mb-2 border border-purple-200 text-center shrink-0">
        <div>
          <div class="text-[10px] font-bold text-[#6b4d9e]">Pontos</div>
          <div id="mz-score" class="text-xs font-extrabold text-amber-600">0</div>
        </div>
        <div>
          <div class="text-[10px] font-bold text-[#6b4d9e]">Peixes</div>
          <div id="mz-fish" class="text-xs font-extrabold text-emerald-600">0/${cfg.fishCount}</div>
        </div>
        <div>
          <div class="text-[10px] font-bold text-[#6b4d9e]">Escudos</div>
          <div id="mz-hearts" class="text-xs font-extrabold text-rose-600">❤️❤️❤️</div>
        </div>
        <div>
          <div class="text-[10px] font-bold text-[#6b4d9e]">Tempo</div>
          <div id="mz-time" class="text-xs font-extrabold text-purple-700">${cfg.parSec}s</div>
        </div>
      </div>

      <div id="mz-board-wrap" class="relative flex-1 min-h-[210px] rounded-2xl overflow-hidden bg-gradient-to-br from-[#ede9fe] via-[#f5f3ff] to-[#e0f2fe] border-2 border-white shadow-inner flex items-center justify-center touch-none">
        <canvas id="mz-canvas" class="block max-w-full max-h-full"></canvas>
        <div class="absolute top-1.5 right-2 text-[10px] font-extrabold text-purple-800 bg-white/85 px-2 py-0.5 rounded-full pointer-events-none">
          Recorde: ${highScore}
        </div>
        <div id="mz-overlay" class="hidden absolute inset-0 z-20 bg-purple-950/65 flex items-center justify-center p-4"></div>
      </div>

      <div class="mt-2 flex items-center justify-between gap-3 shrink-0">
        <div class="text-[10px] font-bold text-[#5e4294] leading-tight hidden sm:block max-w-[205px]">
          Use <b>Setas / WASD</b>, deslize o dedo ou toque nas setas para levar o Miau ao 🥛!
        </div>
        <div class="mx-auto sm:mx-0 grid grid-cols-3 gap-1 w-[150px] shrink-0">
          <div></div>
          <button data-mz-dir="up" type="button" class="h-9 rounded-xl bg-[#6e45a5] active:scale-95 text-white font-extrabold text-sm shadow">▲</button>
          <div></div>
          <button data-mz-dir="left" type="button" class="h-9 rounded-xl bg-[#6e45a5] active:scale-95 text-white font-extrabold text-sm shadow">◀</button>
          <button data-mz-dir="down" type="button" class="h-9 rounded-xl bg-[#6e45a5] active:scale-95 text-white font-extrabold text-sm shadow">▼</button>
          <button data-mz-dir="right" type="button" class="h-9 rounded-xl bg-[#6e45a5] active:scale-95 text-white font-extrabold text-sm shadow">▶</button>
        </div>
      </div>
    </div>
  `;

  const scoreEl = container.querySelector('#mz-score') as HTMLElement;
  const fishEl = container.querySelector('#mz-fish') as HTMLElement;
  const heartsEl = container.querySelector('#mz-hearts') as HTMLElement;
  const timeEl = container.querySelector('#mz-time') as HTMLElement;
  const badgeEl = container.querySelector('#mz-stage-badge') as HTMLElement;
  const subEl = container.querySelector('#mz-sub') as HTMLElement;
  const boardWrap = container.querySelector('#mz-board-wrap') as HTMLDivElement;
  const canvas = container.querySelector('#mz-canvas') as HTMLCanvasElement;
  const overlayEl = container.querySelector('#mz-overlay') as HTMLDivElement;
  const ctx = canvas.getContext('2d')!;

  const updateHud = () => {
    scoreEl.textContent = String(score);
    fishEl.textContent = `${fishesCollectedStage}/${cfg.fishCount}`;
    heartsEl.textContent = hearts > 0 ? '❤️'.repeat(hearts) : '💔';
    const left = Math.max(0, Math.ceil(cfg.parSec - stageElapsedSec));
    timeEl.textContent = `${left}s`;
    timeEl.className =
      left <= 8
        ? 'text-xs font-extrabold text-rose-600 animate-pulse'
        : 'text-xs font-extrabold text-purple-700';
    badgeEl.textContent = `Fase ${stage} (${cfg.cols}×${cfg.rows})`;
  };

  const setupStage = (nextStage: number) => {
    stage = nextStage;
    cfg = getMazeStageConfig(stage);
    grid = generateSolvableMaze(cfg.cols, cfg.rows);
    player = { x: 1, y: 1 };
    goal = { x: cfg.cols - 2, y: cfg.rows - 2 };
    grid[goal.y][goal.x] = '.';
    stageElapsedSec = 0;
    movesCount = 0;
    fishesCollectedStage = 0;
    hurtInvuln = 0;

    const dists = bfsDistances(grid, player);
    parSteps = dists.get(`${goal.x},${goal.y}`) ?? cfg.cols * 2;

    // Espalhar peixinhos bônus em células abertas
    const openCells: Point[] = [];
    for (let y = 1; y < cfg.rows - 1; y++) {
      for (let x = 1; x < cfg.cols - 1; x++) {
        if (
          grid[y][x] === '.' &&
          !(x === player.x && y === player.y) &&
          !(x === goal.x && y === goal.y)
        ) {
          openCells.push({ x, y });
        }
      }
    }
    fishes = [];
    const pool = [...openCells].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(cfg.fishCount, pool.length); i++) {
      fishes.push(pool[i]);
    }

    // Cachorros sentinelas a partir da Fase 3
    guards = [];
    const guardCandidates = openCells.filter(
      (p) => Math.hypot(p.x - 1, p.y - 1) > 3.5 && Math.hypot(p.x - goal.x, p.y - goal.y) > 2
    );
    for (let g = 0; g < cfg.guardsCount && guardCandidates.length > 0; g++) {
      const pick =
        guardCandidates[Math.floor((g + 0.5) * (guardCandidates.length / cfg.guardsCount))];
      const canHoriz =
        grid[pick.y]?.[pick.x + 1] === '.' || grid[pick.y]?.[pick.x - 1] === '.';
      guards.push({
        x: pick.x,
        y: pick.y,
        dirX: canHoriz ? 1 : 0,
        dirY: canHoriz ? 0 : 1,
        axis: canHoriz ? 'x' : 'y',
        speed: Math.min(3.8, 1.85 + (stage - 3) * 0.45),
      });
    }

    if (cfg.lanternMode) {
      subEl.textContent = `Fase ${stage}: Lanterna mágica! Descubra o caminho até o 🥛!`;
    } else if (cfg.guardsCount > 0) {
      subEl.textContent = `Fase ${stage}: Desvie dos cachorrinhos sentinelas até o leitinho 🥛!`;
    } else {
      subEl.textContent = `Fase ${stage}: Pegue os peixinhos 🐟 e chegue ao leitinho 🥛!`;
    }

    updateHud();
  };

  const finishGame = () => {
    if (stopped) return;
    stopped = true;
    cleanupListeners();
    const tier: MiniGameResult['performanceTier'] =
      stage >= 4 || score >= 900
        ? 'gold'
        : stage >= 2 || score >= 350
          ? 'silver'
          : 'bronze';
    const coinsEarned = Math.max(
      6,
      Math.min(70, Math.round(score / 45) + stage * 5)
    );
    const funBoost = Math.min(35, 14 + stage * 4);
    const xpEarned = Math.min(70, 15 + stage * 9 + Math.round(score / 80));
    onComplete({
      gameId: 'maze',
      gameName: 'Labirinto do Leitinho',
      score,
      stageReached: stage,
      durationSec: Math.max(1, Math.round(totalDurationSec)),
      coinsEarned,
      funBoost,
      xpEarned,
      performanceTier: tier,
      summaryText: `${score} pts • Fase ${stage}`,
    });
  };

  const showOverlay = (html: string) => {
    overlayEl.innerHTML = html;
    overlayEl.classList.remove('hidden');
  };

  const hideOverlay = () => {
    overlayEl.classList.add('hidden');
    overlayEl.innerHTML = '';
  };

  const tryMove = (dir: Dir) => {
    if (paused || stopped) return;
    const delta: Record<Dir, Point> = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };
    const nx = player.x + delta[dir].x;
    const ny = player.y + delta[dir].y;
    if (nx < 0 || nx >= cfg.cols || ny < 0 || ny >= cfg.rows) return;
    if (grid[ny][nx] === '#') {
      hapticService.tap();
      return;
    }
    player.x = nx;
    player.y = ny;
    movesCount += 1;
    soundService.playMeow(1.55);

    // Coletar peixinho
    const fishIdx = fishes.findIndex((f) => f.x === player.x && f.y === player.y);
    if (fishIdx >= 0) {
      fishes.splice(fishIdx, 1);
      fishesCollectedStage += 1;
      score += 45;
      soundService.playCoin();
      hapticService.coin();
      updateHud();
    }

    // Chegou ao pratinho de leite!
    if (player.x === goal.x && player.y === goal.y) {
      paused = true;
      const remainingSec = Math.max(0, Math.ceil(cfg.parSec - stageElapsedSec));
      const efficiencyBonus = movesCount <= parSteps + 6 ? 60 : 20;
      const stageBonus = 120 + stage * 45 + remainingSec * 4 + efficiencyBonus;
      score += stageBonus;
      soundService.playCoin();
      hapticService.achievement();
      updateHud();
      showOverlay(`
        <div class="bg-white rounded-3xl p-5 max-w-xs w-full text-center shadow-2xl border-2 border-emerald-400">
          <div class="text-4xl mb-2">🥛😺✨</div>
          <h4 class="font-display text-lg font-bold text-[#3b1f6e]">Miau bebeu o leitinho!</h4>
          <p class="text-xs font-semibold text-[#6b4d9e] mt-1">Fase ${stage} concluída! +${stageBonus} pontos (bônus de tempo e eficiência).</p>
          <div class="flex gap-2 mt-3">
            <button id="mz-next-btn" type="button" class="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-extrabold text-xs shadow">
              Fase ${stage + 1} ▶
            </button>
            <button id="mz-quit-btn" type="button" class="px-3 py-2.5 rounded-2xl bg-purple-100 text-[#4c2a85] font-extrabold text-xs">
              Finalizar
            </button>
          </div>
        </div>
      `);
      overlayEl.querySelector('#mz-next-btn')?.addEventListener('click', () => {
        hideOverlay();
        paused = false;
        setupStage(stage + 1);
      });
      overlayEl
        .querySelector('#mz-quit-btn')
        ?.addEventListener('click', finishGame);
    }
  };

  const handleGuardHit = () => {
    if (hurtInvuln > 0) return;
    hearts -= 1;
    hurtInvuln = 1.4;
    soundService.playMeow(0.72);
    hapticService.warning();
    updateHud();
    if (hearts <= 0) {
      paused = true;
      showOverlay(`
        <div class="bg-white rounded-3xl p-5 max-w-xs w-full text-center shadow-2xl border-2 border-rose-300">
          <div class="text-4xl mb-2">🐶💔</div>
          <h4 class="font-display text-lg font-bold text-[#3b1f6e]">Fim da Corrida!</h4>
          <p class="text-xs font-semibold text-[#6b4d9e] mt-1">Você alcançou a Fase ${stage} com ${score} pontos!</p>
          <button id="mz-end-btn" type="button" class="mt-3 w-full py-2.5 rounded-2xl bg-gradient-to-r from-[#6e45a5] to-[#9b5de5] text-white font-extrabold text-xs shadow">
            Receber Recompensa 🪙
          </button>
        </div>
      `);
      overlayEl
        .querySelector('#mz-end-btn')
        ?.addEventListener('click', finishGame);
    } else {
      player = { x: 1, y: 1 };
    }
  };

  const handleTimeUp = () => {
    paused = true;
    soundService.playMeow(0.72);
    hapticService.warning();
    showOverlay(`
      <div class="bg-white rounded-3xl p-5 max-w-xs w-full text-center shadow-2xl border-2 border-amber-300">
        <div class="text-4xl mb-2">⏰🥛</div>
        <h4 class="font-display text-lg font-bold text-[#3b1f6e]">Tempo Esgotado!</h4>
        <p class="text-xs font-semibold text-[#6b4d9e] mt-1">O Miau parou na Fase ${stage} com ${score} pontos.</p>
        <button id="mz-timeout-btn" type="button" class="mt-3 w-full py-2.5 rounded-2xl bg-gradient-to-r from-[#6e45a5] to-[#9b5de5] text-white font-extrabold text-xs shadow">
          Finalizar & Ganhar Moedas 🪙
        </button>
      </div>
    `);
    overlayEl
      .querySelector('#mz-timeout-btn')
      ?.addEventListener('click', finishGame);
  };

  const resizeCanvas = () => {
    const rect = boardWrap.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const size = Math.max(200, Math.floor(Math.min(rect.width, rect.height)));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    canvas.width = Math.floor(size * dpr);
    canvas.height = Math.floor(size * dpr);
  };

  const drawScene = () => {
    const size = canvas.width;
    const cellPx = size / cfg.cols;

    ctx.fillStyle = '#faf5ff';
    ctx.fillRect(0, 0, size, size);

    for (let y = 0; y < cfg.rows; y++) {
      for (let x = 0; x < cfg.cols; x++) {
        const px = x * cellPx;
        const py = y * cellPx;
        if (grid[y][x] === '#') {
          ctx.fillStyle = '#5b21b6';
          ctx.fillRect(px, py, cellPx + 0.5, cellPx + 0.5);
          ctx.fillStyle = '#7c3aed';
          ctx.fillRect(px + 1, py + 1, cellPx - 2, cellPx * 0.25);
        } else {
          ctx.fillStyle = '#f5f3ff';
          ctx.fillRect(px, py, cellPx, cellPx);
        }
      }
    }

    // Pratinho de Leite (Goal)
    ctx.font = `${Math.round(cellPx * 0.78)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🥛', (goal.x + 0.5) * cellPx, (goal.y + 0.5) * cellPx);

    // Peixinhos bônus
    for (const f of fishes) {
      ctx.fillText('🐟', (f.x + 0.5) * cellPx, (f.y + 0.5) * cellPx);
    }

    // Cachorros sentinelas
    for (const g of guards) {
      ctx.fillText('🐶', (g.x + 0.5) * cellPx, (g.y + 0.5) * cellPx);
    }

    // Miau
    const blinkHide = hurtInvuln > 0 && Math.floor(performance.now() / 100) % 2 === 0;
    if (!blinkHide) {
      ctx.fillText('🐱', (player.x + 0.5) * cellPx, (player.y + 0.5) * cellPx);
    }

    // Modo lanterna nas fases 5+
    if (cfg.lanternMode) {
      const cx = (player.x + 0.5) * cellPx;
      const cy = (player.y + 0.5) * cellPx;
      const radius = cellPx * 3.4;
      const grad = ctx.createRadialGradient(cx, cy, cellPx * 0.9, cx, cy, radius);
      grad.addColorStop(0, 'rgba(15, 23, 42, 0)');
      grad.addColorStop(1, 'rgba(15, 23, 42, 0.78)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    }
  };

  let rafId = 0;
  let lastTime = performance.now();

  const tick = (now: number) => {
    if (stopped) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;

    if (!paused) {
      totalDurationSec += dt;
      stageElapsedSec += dt;
      if (hurtInvuln > 0) hurtInvuln = Math.max(0, hurtInvuln - dt);

      // Patrulha dos cachorros sentinelas
      for (const g of guards) {
        const nx = g.x + g.dirX * g.speed * dt;
        const ny = g.y + g.dirY * g.speed * dt;
        const checkX = Math.round(nx + g.dirX * 0.35);
        const checkY = Math.round(ny + g.dirY * 0.35);
        if (
          checkX >= 1 &&
          checkX < cfg.cols - 1 &&
          checkY >= 1 &&
          checkY < cfg.rows - 1 &&
          grid[checkY][checkX] === '.'
        ) {
          g.x = nx;
          g.y = ny;
        } else {
          g.dirX = -g.dirX;
          g.dirY = -g.dirY;
        }
        if (Math.hypot(g.x - player.x, g.y - player.y) < 0.6) {
          handleGuardHit();
        }
      }

      updateHud();
      if (stageElapsedSec >= cfg.parSec) {
        handleTimeUp();
      }
    }

    drawScene();
    rafId = window.requestAnimationFrame(tick);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (key === 'arrowup' || key === 'w') {
      e.preventDefault();
      tryMove('up');
    } else if (key === 'arrowdown' || key === 's') {
      e.preventDefault();
      tryMove('down');
    } else if (key === 'arrowleft' || key === 'a') {
      e.preventDefault();
      tryMove('left');
    } else if (key === 'arrowright' || key === 'd') {
      e.preventDefault();
      tryMove('right');
    }
  };

  let touchStartX = 0;
  let touchStartY = 0;
  const handleTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    touchStartX = t.clientX;
    touchStartY = t.clientY;
  };
  const handleTouchEnd = (e: TouchEvent) => {
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    if (Math.hypot(dx, dy) < 18) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      tryMove(dx > 0 ? 'right' : 'left');
    } else {
      tryMove(dy > 0 ? 'down' : 'up');
    }
  };

  const dpadButtons = Array.from(
    container.querySelectorAll('[data-mz-dir]')
  ) as HTMLButtonElement[];
  const dpadCleanups = dpadButtons.map((btn) => {
    const fn = () => {
      const d = btn.getAttribute('data-mz-dir') as Dir | null;
      if (d) tryMove(d);
    };
    btn.addEventListener('pointerdown', fn);
    return () => btn.removeEventListener('pointerdown', fn);
  });

  const muteBtn = container.querySelector('#mg-mute') as HTMLButtonElement;
  const handleMuteClick = () => {
    const enabled = onToggleMute
      ? onToggleMute()
      : (() => {
          const next = !soundService.enabled;
          soundService.setEnabled(next);
          return next;
        })();
    muteBtn.textContent = enabled ? '🔊' : '🔇';
    muteBtn.setAttribute('aria-pressed', String(!enabled));
    muteBtn.className = `w-8 h-8 rounded-full ${enabled ? 'bg-purple-100 text-purple-800' : 'bg-rose-100 text-rose-800'} font-bold flex items-center justify-center shrink-0`;
  };
  const closeBtn = container.querySelector('#mg-close') as HTMLButtonElement;
  const handleCloseClick = () => {
    stopped = true;
    cleanupListeners();
    onClose();
  };

  const resizeObs = new ResizeObserver(() => resizeCanvas());
  resizeObs.observe(boardWrap);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('resize', resizeCanvas);
  boardWrap.addEventListener('touchstart', handleTouchStart, { passive: true });
  boardWrap.addEventListener('touchend', handleTouchEnd, { passive: true });
  muteBtn.addEventListener('click', handleMuteClick);
  closeBtn.addEventListener('click', handleCloseClick);

  const cleanupListeners = () => {
    if (rafId) window.cancelAnimationFrame(rafId);
    resizeObs.disconnect();
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('resize', resizeCanvas);
    boardWrap.removeEventListener('touchstart', handleTouchStart);
    boardWrap.removeEventListener('touchend', handleTouchEnd);
    muteBtn.removeEventListener('click', handleMuteClick);
    closeBtn.removeEventListener('click', handleCloseClick);
    dpadCleanups.forEach((off) => off());
  };

  setupStage(1);
  resizeCanvas();
  rafId = window.requestAnimationFrame(tick);

  return () => {
    stopped = true;
    cleanupListeners();
  };
}
