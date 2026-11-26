import { hapticService } from '../../services/hapticService';
import { soundService } from '../../services/soundService';
import type { MiniGameResult } from '../MiniGames';

// Labirinto clássico 28x31:
// 240 pastilhas comuns (.) + 4 super-pastilhas (o) = 244 itens coletáveis exatos por fase!
const MAZE_TEMPLATE: ReadonlyArray<string> = [
  '############################',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#o####.#####.##.#####.####o#',
  '#.####.#####.##.#####.####.#',
  '#..........................#',
  '#.####.##.########.##.####.#',
  '#.####.##.########.##.####.#',
  '#......##....##....##......#',
  '######.##### ## #####.######',
  '     #.##### ## #####.#     ',
  '     #.##          ##.#     ',
  '     #.## ###--### ##.#     ',
  '######.## #======# ##.######',
  '      .   #======#   .      ',
  '######.## #======# ##.######',
  '     #.## ######## ##.#     ',
  '     #.##          ##.#     ',
  '     #.## ######## ##.#     ',
  '######.## ######## ##.######',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#.####.#####.##.#####.####.#',
  '#o..##.......  .......##..o#',
  '###.##.##.########.##.##.###',
  '###.##.##.########.##.##.###',
  '#......##....##....##......#',
  '#.##########.##.##########.#',
  '#.##########.##.##########.#',
  '#..........................#',
  '############################',
];

const COLS = 28;
const ROWS = 31;

type TileType = '#' | '.' | 'o' | ' ' | '-' | '=';
type DirName = 'up' | 'down' | 'left' | 'right';

interface Vec2 {
  x: number;
  y: number;
}

const DIR_VECTORS: Record<DirName, Vec2> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE_DIR: Record<DirName, DirName> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

type DogId = 'blinky' | 'pinky' | 'inky' | 'clyde';

interface DogEnemy {
  id: DogId;
  name: string;
  color: string;
  x: number;
  y: number;
  dir: DirName;
  scatterTarget: Vec2;
  inHouse: boolean;
  releaseTimer: number;
  eatenReturning: boolean;
}

interface PacStageConfig {
  stage: number;
  miauSpeed: number;
  dogSpeed: number;
  frightenedSec: number;
  scatterSec: number;
  chaseSec: number;
  frightenedSpeed: number;
  fruitEmoji: string;
  fruitPoints: number;
}

function getPacStageConfig(stage: number): PacStageConfig {
  const fruits = ['🍓', '🍒', '🐟', '🍣', '🏆'];
  const fruitPts = [100, 200, 300, 500, 800];
  const idx = Math.min(fruits.length - 1, stage - 1);
  return {
    stage,
    miauSpeed: Math.min(8.4, 6.2 + (stage - 1) * 0.25),
    dogSpeed: Math.min(8.2, 5.15 + (stage - 1) * 0.45),
    frightenedSec: Math.max(3.2, 8.0 - (stage - 1) * 0.75),
    scatterSec: Math.max(3.0, 6.5 - (stage - 1) * 0.55),
    chaseSec: Math.min(24, 16 + (stage - 1) * 2.5),
    frightenedSpeed: Math.min(5.0, 3.4 + (stage - 1) * 0.2),
    fruitEmoji: fruits[idx],
    fruitPoints: fruitPts[idx],
  };
}

export function mountPacMiauGame(
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
  let lives = 3;
  let extraLifeAwarded = false;
  let totalDurationSec = 0;
  let pelletsRemaining = 0;
  let totalCoinsBonus = 0;

  let miauX = 13.5;
  let miauY = 23;
  let miauDir: DirName = 'left';
  let queuedDir: DirName = 'left';
  let mouthTimer = 0;

  let frightenedLeft = 0;
  let ratComboIndex = 0;
  let modeIsScatter = true;
  let modeTimer = getPacStageConfig(1).scatterSec;
  let stageResetFreeze = 0.9;

  let fruitActive = false;
  let fruitTimer = 0;
  let fruitSpawnCheck1 = false;
  let fruitSpawnCheck2 = false;

  let grid: TileType[][] = [];
  let dogs: DogEnemy[] = [];

  interface FloatingPopup {
    x: number;
    y: number;
    text: string;
    color: string;
    life: number;
  }
  const popups: FloatingPopup[] = [];

  container.innerHTML = `
    <div class="flex-1 flex flex-col min-h-0 h-full select-none">
      <div class="flex items-center justify-between mb-1.5 shrink-0">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h3 class="font-display text-base font-bold text-[#3b1f6e] truncate">Pac-Miau: Ratos e Cachorros 🐱</h3>
            <span id="pac-stage-badge" class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 shrink-0">Fase 1</span>
          </div>
          <p id="pac-status-sub" class="text-[11px] text-[#6b4d9e] font-semibold truncate">Coma as 244 bolinhas • Evite os cachorros • Pegue super-pílulas!</p>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button id="pac-pause" type="button" class="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold flex items-center justify-center hover:bg-purple-200 shrink-0">⏸</button>
          <button id="mg-mute" type="button" aria-pressed="${!soundService.enabled}" class="w-8 h-8 rounded-full ${soundService.enabled ? 'bg-purple-100 text-purple-800' : 'bg-rose-100 text-rose-800'} font-bold flex items-center justify-center shrink-0">${soundService.enabled ? '🔊' : '🔇'}</button>
          <button id="mg-close" type="button" class="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold flex items-center justify-center hover:bg-purple-200 shrink-0">✕</button>
        </div>
      </div>

      <div class="grid grid-cols-4 gap-1.5 bg-slate-950 rounded-2xl px-2.5 py-1.5 mb-2 border border-blue-500/60 text-center text-white shrink-0">
        <div>
          <div class="text-[10px] font-bold text-blue-300">Pontos</div>
          <div id="pac-score" class="text-xs font-extrabold text-amber-300">0</div>
        </div>
        <div>
          <div class="text-[10px] font-bold text-blue-300">Restam</div>
          <div id="pac-pellets" class="text-xs font-extrabold text-cyan-300">244</div>
        </div>
        <div>
          <div class="text-[10px] font-bold text-blue-300">Vidas</div>
          <div id="pac-lives" class="text-xs font-extrabold text-rose-300">🐱🐱🐱</div>
        </div>
        <div>
          <div class="text-[10px] font-bold text-blue-300">Modo</div>
          <div id="pac-mode" class="text-xs font-extrabold text-emerald-300">Caça</div>
        </div>
      </div>

      <div id="pac-board-wrap" class="relative flex-1 min-h-[210px] rounded-2xl overflow-hidden bg-black border-2 border-blue-500 shadow-[0_0_24px_rgba(37,99,235,0.45)] flex items-center justify-center touch-none">
        <canvas id="pac-canvas" class="block max-w-full max-h-full"></canvas>
        <div class="absolute top-1.5 right-2 text-[10px] font-extrabold text-blue-200/85 bg-slate-900/80 border border-blue-500/40 px-2 py-0.5 rounded-full pointer-events-none">
          Recorde: ${highScore}
        </div>
        <div id="pac-overlay" class="hidden absolute inset-0 z-20 bg-slate-950/80 flex items-center justify-center p-4"></div>
      </div>

      <!-- D-Pad Responsivo (Toque e Desktop) -->
      <div class="mt-2 flex items-center justify-between gap-3 shrink-0">
        <div class="text-[10px] font-bold text-[#5e4294] leading-tight hidden sm:block max-w-[190px]">
          Use as <b>Setas / WASD</b> ou deslize o dedo no labirinto. Bônus de vida extra aos 10.000 pts!
        </div>
        <div class="mx-auto sm:mx-0 grid grid-cols-3 gap-1 w-[150px] shrink-0">
          <div></div>
          <button data-pac-dir="up" type="button" class="h-9 rounded-xl bg-[#6e45a5] active:scale-95 text-white font-extrabold text-sm shadow">▲</button>
          <div></div>
          <button data-pac-dir="left" type="button" class="h-9 rounded-xl bg-[#6e45a5] active:scale-95 text-white font-extrabold text-sm shadow">◀</button>
          <button data-pac-dir="down" type="button" class="h-9 rounded-xl bg-[#6e45a5] active:scale-95 text-white font-extrabold text-sm shadow">▼</button>
          <button data-pac-dir="right" type="button" class="h-9 rounded-xl bg-[#6e45a5] active:scale-95 text-white font-extrabold text-sm shadow">▶</button>
        </div>
      </div>
    </div>
  `;

  const scoreEl = container.querySelector('#pac-score') as HTMLElement;
  const pelletsEl = container.querySelector('#pac-pellets') as HTMLElement;
  const livesEl = container.querySelector('#pac-lives') as HTMLElement;
  const modeEl = container.querySelector('#pac-mode') as HTMLElement;
  const stageBadgeEl = container.querySelector('#pac-stage-badge') as HTMLElement;
  const subEl = container.querySelector('#pac-status-sub') as HTMLElement;
  const pauseBtn = container.querySelector('#pac-pause') as HTMLButtonElement;
  const boardWrap = container.querySelector('#pac-board-wrap') as HTMLDivElement;
  const canvas = container.querySelector('#pac-canvas') as HTMLCanvasElement;
  const overlayEl = container.querySelector('#pac-overlay') as HTMLDivElement;
  const ctx = canvas.getContext('2d')!;

  const updateHud = () => {
    scoreEl.textContent = String(score);
    pelletsEl.textContent = String(pelletsRemaining);
    livesEl.textContent = lives > 0 ? '🐱'.repeat(Math.min(5, lives)) : '0';
    stageBadgeEl.textContent = `Fase ${stage}`;
    if (frightenedLeft > 0) {
      modeEl.textContent = `Ratos! ${Math.ceil(frightenedLeft)}s`;
      modeEl.className = 'text-xs font-extrabold text-sky-300 animate-pulse';
    } else if (modeIsScatter) {
      modeEl.textContent = 'Patrulha';
      modeEl.className = 'text-xs font-extrabold text-emerald-300';
    } else {
      modeEl.textContent = 'Perseguição!';
      modeEl.className = 'text-xs font-extrabold text-rose-300';
    }
  };

  const buildGridForStage = () => {
    grid = MAZE_TEMPLATE.map((row) => row.split('') as TileType[]);
    let count = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] === '.' || grid[r][c] === 'o') count++;
      }
    }
    pelletsRemaining = count;
    fruitActive = false;
    fruitTimer = 0;
    fruitSpawnCheck1 = false;
    fruitSpawnCheck2 = false;
  };

  const resetPositions = () => {
    miauX = 13.5;
    miauY = 23;
    miauDir = 'left';
    queuedDir = 'left';
    frightenedLeft = 0;
    ratComboIndex = 0;
    const cfg = getPacStageConfig(stage);
    modeIsScatter = true;
    modeTimer = cfg.scatterSec;
    stageResetFreeze = 0.85;

    const releaseScale = Math.max(0.35, 1 - (stage - 1) * 0.14);
    dogs = [
      {
        id: 'blinky',
        name: 'Blinky',
        color: '#ef4444',
        x: 13.5,
        y: 11,
        dir: 'left',
        scatterTarget: { x: COLS - 3, y: 0 },
        inHouse: false,
        releaseTimer: 0,
        eatenReturning: false,
      },
      {
        id: 'pinky',
        name: 'Pinky',
        color: '#f472b6',
        x: 13.5,
        y: 14,
        dir: 'up',
        scatterTarget: { x: 2, y: 0 },
        inHouse: true,
        releaseTimer: 1.5 * releaseScale,
        eatenReturning: false,
      },
      {
        id: 'inky',
        name: 'Inky',
        color: '#22d3ee',
        x: 11.5,
        y: 14,
        dir: 'up',
        scatterTarget: { x: COLS - 2, y: ROWS - 1 },
        inHouse: true,
        releaseTimer: 4.5 * releaseScale,
        eatenReturning: false,
      },
      {
        id: 'clyde',
        name: 'Clyde',
        color: '#fb923c',
        x: 15.5,
        y: 14,
        dir: 'up',
        scatterTarget: { x: 1, y: ROWS - 1 },
        inHouse: true,
        releaseTimer: 7.5 * releaseScale,
        eatenReturning: false,
      },
    ];
    updateHud();
  };

  const addScore = (pts: number) => {
    score += pts;
    if (!extraLifeAwarded && score >= 10_000) {
      extraLifeAwarded = true;
      lives += 1;
      soundService.playCoin();
      hapticService.achievement();
      popups.push({
        x: miauX,
        y: miauY - 0.8,
        text: '+1 VIDA EXTRA!',
        color: '#fde047',
        life: 1.8,
      });
    }
  };

  const isWalkableForMiau = (col: number, row: number): boolean => {
    if (row === 14 && (col < 0 || col >= COLS)) return true;
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;
    const t = grid[row][col];
    return t !== '#' && t !== '-' && t !== '=';
  };

  const isWalkableForDog = (
    col: number,
    row: number,
    dog: DogEnemy
  ): boolean => {
    if (row === 14 && (col < 0 || col >= COLS)) return true;
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;
    const t = grid[row][col];
    if (t === '#') return false;
    if (t === '-' || t === '=') {
      return dog.inHouse || dog.eatenReturning;
    }
    return true;
  };

  const wrapX = (x: number): number => {
    if (x < -0.5) return COLS - 0.5;
    if (x >= COLS - 0.5) return -0.5;
    return x;
  };

  const getDogTarget = (dog: DogEnemy): Vec2 => {
    if (dog.eatenReturning) {
      return { x: 13.5, y: 11 };
    }
    if (frightenedLeft > 0) {
      return {
        x: Math.floor(Math.random() * COLS),
        y: Math.floor(Math.random() * ROWS),
      };
    }
    if (modeIsScatter) {
      return dog.scatterTarget;
    }
    const mx = Math.round(miauX);
    const my = Math.round(miauY);
    const mv = DIR_VECTORS[miauDir];

    if (dog.id === 'blinky') {
      return { x: mx, y: my };
    }
    if (dog.id === 'pinky') {
      return { x: mx + mv.x * 4, y: my + mv.y * 4 };
    }
    if (dog.id === 'inky') {
      const blinky = dogs[0];
      const aheadX = mx + mv.x * 2;
      const aheadY = my + mv.y * 2;
      return {
        x: aheadX + (aheadX - Math.round(blinky.x)),
        y: aheadY + (aheadY - Math.round(blinky.y)),
      };
    }
    // Clyde: persegue de longe (> 8 casas), foge para o canto de perto (<= 8 casas)
    const dist = Math.hypot(dog.x - miauX, dog.y - miauY);
    return dist > 8 ? { x: mx, y: my } : dog.scatterTarget;
  };

  const chooseDogDirection = (dog: DogEnemy, tileX: number, tileY: number): DirName => {
    const dirs: DirName[] = ['up', 'left', 'down', 'right'];
    const target = getDogTarget(dog);
    const reverse = OPPOSITE_DIR[dog.dir];
    let bestDir: DirName | null = null;
    let bestScore = Infinity;

    for (const d of dirs) {
      if (d === reverse) continue;
      const nx = tileX + DIR_VECTORS[d].x;
      const ny = tileY + DIR_VECTORS[d].y;
      if (!isWalkableForDog(nx, ny, dog)) continue;
      if (frightenedLeft > 0 && !dog.eatenReturning) {
        const randScore = Math.random();
        if (randScore < bestScore) {
          bestScore = randScore;
          bestDir = d;
        }
      } else {
        const distSq = (nx - target.x) ** 2 + (ny - target.y) ** 2;
        if (distSq < bestScore) {
          bestScore = distSq;
          bestDir = d;
        }
      }
    }
    return bestDir ?? reverse;
  };

  const stepMiau = (dt: number, speed: number) => {
    const moveDist = speed * dt;
    const centerC = Math.round(miauX);
    const centerR = Math.round(miauY);
    const alignedX = Math.abs(miauX - centerC) <= 0.14;
    const alignedY = Math.abs(miauY - centerR) <= 0.14;

    if (queuedDir !== miauDir) {
      const qv = DIR_VECTORS[queuedDir];
      if (queuedDir === OPPOSITE_DIR[miauDir]) {
        miauDir = queuedDir;
      } else if (alignedX && alignedY) {
        if (isWalkableForMiau(centerC + qv.x, centerR + qv.y)) {
          miauX = centerC;
          miauY = centerR;
          miauDir = queuedDir;
        }
      }
    }

    const v = DIR_VECTORS[miauDir];
    const nextX = miauX + v.x * moveDist;
    const nextY = miauY + v.y * moveDist;

    if (v.x !== 0) {
      miauY += (centerR - miauY) * Math.min(1, dt * 16);
      const aheadCol = v.x > 0 ? Math.floor(nextX + 0.5) : Math.floor(nextX);
      if (isWalkableForMiau(aheadCol, centerR)) {
        miauX = wrapX(nextX);
      } else {
        miauX = centerC;
      }
    } else if (v.y !== 0) {
      miauX += (centerC - miauX) * Math.min(1, dt * 16);
      const aheadRow = v.y > 0 ? Math.floor(nextY + 0.5) : Math.floor(nextY);
      if (isWalkableForMiau(centerC, aheadRow)) {
        miauY = nextY;
      } else {
        miauY = centerR;
      }
    }

    // Coleta na casa atual
    const eatC = Math.round(miauX);
    const eatR = Math.round(miauY);
    if (eatR >= 0 && eatR < ROWS && eatC >= 0 && eatC < COLS) {
      const cell = grid[eatR][eatC];
      if (cell === '.') {
        grid[eatR][eatC] = ' ';
        pelletsRemaining = Math.max(0, pelletsRemaining - 1);
        addScore(10);
        soundService.playMeow(1.65);
      } else if (cell === 'o') {
        grid[eatR][eatC] = ' ';
        pelletsRemaining = Math.max(0, pelletsRemaining - 1);
        addScore(50);
        const cfg = getPacStageConfig(stage);
        frightenedLeft = cfg.frightenedSec;
        ratComboIndex = 0;
        for (const d of dogs) {
          if (!d.inHouse && !d.eatenReturning) {
            d.dir = OPPOSITE_DIR[d.dir];
          }
        }
        soundService.playCoin();
        hapticService.coin();
        popups.push({
          x: eatC,
          y: eatR - 0.4,
          text: 'Cachorros viraram Ratos!',
          color: '#38bdf8',
          life: 1.4,
        });
      }

      // Frutas bônus periódicas no centro
      const eatenCount = 244 - pelletsRemaining;
      if (
        (!fruitSpawnCheck1 && eatenCount >= 70) ||
        (!fruitSpawnCheck2 && eatenCount >= 170)
      ) {
        if (eatenCount >= 170) fruitSpawnCheck2 = true;
        else fruitSpawnCheck1 = true;
        fruitActive = true;
        fruitTimer = 10.0;
      }
      if (fruitActive && Math.hypot(miauX - 13.5, miauY - 17) < 0.65) {
        fruitActive = false;
        const cfg = getPacStageConfig(stage);
        addScore(cfg.fruitPoints);
        totalCoinsBonus += 5;
        soundService.playCoin();
        hapticService.coin();
        popups.push({
          x: 13.5,
          y: 16.4,
          text: `+${cfg.fruitPoints} ${cfg.fruitEmoji}`,
          color: '#fde047',
          life: 1.5,
        });
      }
    }
  };

  const stepDogs = (dt: number, cfg: PacStageConfig) => {
    for (const dog of dogs) {
      if (dog.inHouse) {
        dog.releaseTimer -= dt;
        if (dog.releaseTimer <= 0) {
          // Sair suavemente até a porta (13.5, 11)
          dog.x += (13.5 - dog.x) * Math.min(1, dt * 6);
          dog.y -= dt * 3.2;
          if (dog.y <= 11.05) {
            dog.y = 11;
            dog.x = 13;
            dog.inHouse = false;
            dog.dir = Math.random() < 0.5 ? 'left' : 'right';
          }
        } else {
          dog.y = 14 + Math.sin(performance.now() * 0.008 + dog.x) * 0.3;
        }
        continue;
      }

      if (dog.eatenReturning) {
        const dx = 13.5 - dog.x;
        const dy = 14 - dog.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.35) {
          dog.eatenReturning = false;
          dog.inHouse = true;
          dog.releaseTimer = 1.2;
          dog.x = 13.5;
          dog.y = 14;
        } else {
          const retSpeed = 9.0;
          dog.x += (dx / dist) * retSpeed * dt;
          dog.y += (dy / dist) * retSpeed * dt;
        }
        continue;
      }

      const spd = frightenedLeft > 0 ? cfg.frightenedSpeed : cfg.dogSpeed;
      const moveDist = spd * dt;
      const curC = Math.round(dog.x);
      const curR = Math.round(dog.y);

      const prevFracX = dog.x - curC;
      const prevFracY = dog.y - curR;
      const v = DIR_VECTORS[dog.dir];
      const nextX = dog.x + v.x * moveDist;
      const nextY = dog.y + v.y * moveDist;
      const nextFracX = nextX - curC;
      const nextFracY = nextY - curR;

      const crossedCenter =
        (v.x !== 0 && prevFracX * nextFracX <= 0) ||
        (v.y !== 0 && prevFracY * nextFracY <= 0) ||
        (Math.abs(nextX - curC) < 0.08 && Math.abs(nextY - curR) < 0.08);

      if (crossedCenter) {
        dog.x = curC;
        dog.y = curR;
        dog.dir = chooseDogDirection(dog, curC, curR);
        const nv = DIR_VECTORS[dog.dir];
        dog.x = wrapX(dog.x + nv.x * Math.min(0.25, moveDist * 0.5));
        dog.y += nv.y * Math.min(0.25, moveDist * 0.5);
      } else {
        const checkC = v.x > 0 ? Math.floor(nextX + 0.5) : Math.floor(nextX);
        const checkR = v.y > 0 ? Math.floor(nextY + 0.5) : Math.floor(nextY);
        if (
          (v.x !== 0 && isWalkableForDog(checkC, curR, dog)) ||
          (v.y !== 0 && isWalkableForDog(curC, checkR, dog))
        ) {
          dog.x = wrapX(nextX);
          dog.y = nextY;
        } else {
          dog.x = curC;
          dog.y = curR;
          dog.dir = chooseDogDirection(dog, curC, curR);
        }
      }
    }
  };

  const finishGame = () => {
    if (stopped) return;
    stopped = true;
    cleanupListeners();
    const tier: MiniGameResult['performanceTier'] =
      stage >= 3 || score >= 3500
        ? 'gold'
        : stage >= 2 || score >= 1400
          ? 'silver'
          : 'bronze';
    const baseCoins = Math.max(
      6,
      Math.min(75, Math.round(score / 110) + stage * 5 + totalCoinsBonus)
    );
    const funBoost = Math.min(35, 16 + stage * 4);
    const xpEarned = Math.min(75, 18 + stage * 10 + Math.round(score / 220));
    onComplete({
      gameId: 'pacmiau',
      gameName: 'Pac-Miau',
      score,
      stageReached: stage,
      durationSec: Math.max(1, Math.round(totalDurationSec)),
      coinsEarned: baseCoins,
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

  const handleMiauHitDog = () => {
    lives -= 1;
    soundService.playMeow(0.72);
    hapticService.warning();
    updateHud();
    if (lives <= 0) {
      paused = true;
      showOverlay(`
        <div class="bg-white rounded-3xl p-5 max-w-xs w-full text-center shadow-2xl border-2 border-blue-400">
          <div class="text-4xl mb-2">🐶🐱</div>
          <h4 class="font-display text-lg font-bold text-[#3b1f6e]">Fim de Jogo!</h4>
          <p class="text-xs font-semibold text-[#6b4d9e] mt-1">Os cachorrinhos pegaram o Miau na Fase ${stage}!</p>
          <div class="text-xl font-display font-bold text-amber-600 my-2">${score} pts</div>
          <button id="pac-finish-btn" type="button" class="w-full py-2.5 rounded-2xl bg-gradient-to-r from-[#6e45a5] to-[#9b5de5] text-white font-extrabold text-xs shadow">
            Receber Recompensa 🪙
          </button>
        </div>
      `);
      overlayEl
        .querySelector('#pac-finish-btn')
        ?.addEventListener('click', finishGame);
      return;
    }
    resetPositions();
    subEl.textContent = `Ops! Restam ${lives} vida(s). Continue firme!`;
  };

  const handleStageCleared = () => {
    paused = true;
    addScore(400 * stage);
    totalCoinsBonus += 8;
    soundService.playCoin();
    hapticService.achievement();
    showOverlay(`
      <div class="bg-white rounded-3xl p-5 max-w-xs w-full text-center shadow-2xl border-2 border-emerald-400">
        <div class="text-4xl mb-2">🏆✨</div>
        <h4 class="font-display text-lg font-bold text-[#3b1f6e]">Fase ${stage} Completa!</h4>
        <p class="text-xs font-semibold text-[#6b4d9e] mt-1">Todas as 244 bolinhas comidas! Próxima fase mais rápida!</p>
        <div class="flex gap-2 mt-3">
          <button id="pac-next-stage" type="button" class="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-extrabold text-xs shadow">
            Fase ${stage + 1} ▶
          </button>
          <button id="pac-stop-now" type="button" class="px-3 py-2.5 rounded-2xl bg-purple-100 text-[#4c2a85] font-extrabold text-xs">
            Sair
          </button>
        </div>
      </div>
    `);
    overlayEl
      .querySelector('#pac-next-stage')
      ?.addEventListener('click', () => {
        stage += 1;
        buildGridForStage();
        resetPositions();
        hideOverlay();
        paused = false;
        subEl.textContent = `Fase ${stage}: cachorros mais ágeis e pílula dura ${getPacStageConfig(stage).frightenedSec.toFixed(1)}s!`;
      });
    overlayEl
      .querySelector('#pac-stop-now')
      ?.addEventListener('click', finishGame);
  };

  const resizeCanvas = () => {
    const rect = boardWrap.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const aspect = COLS / ROWS;
    let drawW = rect.width;
    let drawH = drawW / aspect;
    if (drawH > rect.height) {
      drawH = rect.height;
      drawW = drawH * aspect;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${Math.floor(drawW)}px`;
    canvas.style.height = `${Math.floor(drawH)}px`;
    canvas.width = Math.max(280, Math.floor(drawW * dpr));
    canvas.height = Math.max(310, Math.floor(drawH * dpr));
  };

  const drawScene = () => {
    const w = canvas.width;
    const h = canvas.height;
    const tile = Math.min(w / COLS, h / ROWS);
    const nowSec = performance.now() / 1000;

    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, w, h);

    // Paredes azul neon + pastilhas brancas
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = grid[r][c];
        const px = c * tile;
        const py = r * tile;
        if (cell === '#') {
          ctx.fillStyle = '#091538';
          ctx.fillRect(px + 0.5, py + 0.5, tile - 1, tile - 1);
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = Math.max(1.5, tile * 0.14);
          ctx.strokeRect(
            px + tile * 0.16,
            py + tile * 0.16,
            tile * 0.68,
            tile * 0.68
          );
        } else if (cell === '-') {
          ctx.fillStyle = '#f9a8d4';
          ctx.fillRect(px, py + tile * 0.4, tile, tile * 0.22);
        } else if (cell === '.') {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(px + tile / 2, py + tile / 2, Math.max(1.8, tile * 0.14), 0, Math.PI * 2);
          ctx.fill();
        } else if (cell === 'o') {
          const pulse = 0.72 + Math.sin(nowSec * 7) * 0.28;
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(
            px + tile / 2,
            py + tile / 2,
            Math.max(3.6, tile * 0.32 * pulse),
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }
    }

    // Fruta bônus
    if (fruitActive) {
      const cfg = getPacStageConfig(stage);
      ctx.font = `${Math.round(tile * 0.92)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cfg.fruitEmoji, 14 * tile, 17.5 * tile);
    }

    // Protagonista Miau: disco amarelo com orelhinhas de gato + abertura triangular contínua!
    const mCx = (miauX + 0.5) * tile;
    const mCy = (miauY + 0.5) * tile;
    const mRadius = tile * 0.44;
    const dirAngles: Record<DirName, number> = {
      right: 0,
      down: Math.PI / 2,
      left: Math.PI,
      up: -Math.PI / 2,
    };
    const baseAngle = dirAngles[miauDir];
    const mouthHalf = 0.12 + ((Math.sin(mouthTimer * 18) + 1) / 2) * 0.48;

    ctx.save();
    ctx.translate(mCx, mCy);
    ctx.rotate(baseAngle);
    // Orelhinhas de gato do Miau na parte traseira superior
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(-mRadius * 0.45, -mRadius * 0.72);
    ctx.lineTo(-mRadius * 0.1, -mRadius * 1.18);
    ctx.lineTo(mRadius * 0.25, -mRadius * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-mRadius * 0.75, -mRadius * 0.45);
    ctx.lineTo(-mRadius * 0.92, -mRadius * 0.92);
    ctx.lineTo(-mRadius * 0.32, -mRadius * 0.65);
    ctx.closePath();
    ctx.fill();

    // Corpo amarelo Pac-Miau com boca triangular abrindo e fechando
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, mRadius, mouthHalf, Math.PI * 2 - mouthHalf);
    ctx.closePath();
    ctx.fill();

    // Olho esperto
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.arc(mRadius * 0.14, -mRadius * 0.42, Math.max(1.5, tile * 0.085), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Inimigos: 4 cachorros coloridos (ou ratos azuis/piscando quando assustados)
    for (const dog of dogs) {
      const gx = (dog.x + 0.5) * tile;
      const gy = (dog.y + 0.5) * tile;
      const r = tile * 0.43;

      if (dog.eatenReturning) {
        // Apenas olhinhos voltando à casinha
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(gx - r * 0.3, gy - r * 0.1, r * 0.22, 0, Math.PI * 2);
        ctx.arc(gx + r * 0.3, gy - r * 0.1, r * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.arc(gx - r * 0.3, gy - r * 0.1, r * 0.1, 0, Math.PI * 2);
        ctx.arc(gx + r * 0.3, gy - r * 0.1, r * 0.1, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      const isFrightened = frightenedLeft > 0;
      const isFlashing =
        isFrightened && frightenedLeft < 2.2 && Math.floor(nowSec * 9) % 2 === 0;
      const bodyColor = isFrightened
        ? isFlashing
          ? '#f8fafc'
          : '#2563eb'
        : dog.color;

      ctx.save();
      ctx.translate(gx, gy);
      if (isFrightened) {
        // Forma de Rato Assustado (orelhas redondas + rabinho)
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.arc(-r * 0.55, -r * 0.55, r * 0.36, 0, Math.PI * 2);
        ctx.arc(r * 0.55, -r * 0.55, r * 0.36, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
        ctx.fill();
        // Olhos assustados e bigodes
        ctx.fillStyle = isFlashing ? '#ef4444' : '#ffffff';
        ctx.beginPath();
        ctx.arc(-r * 0.28, -r * 0.12, r * 0.15, 0, Math.PI * 2);
        ctx.arc(r * 0.28, -r * 0.12, r * 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isFlashing ? '#ef4444' : '#fde047';
        ctx.lineWidth = Math.max(1, tile * 0.07);
        ctx.beginPath();
        ctx.moveTo(-r * 0.38, r * 0.32);
        ctx.lineTo(r * 0.38, r * 0.32);
        ctx.stroke();
      } else {
        // Cachorro colorido patrulhando (Blinky, Pinky, Inky, Clyde) com orelhas caídas e focinho
        ctx.fillStyle = bodyColor;
        // Orelhas caídas de cachorro
        ctx.beginPath();
        ctx.ellipse(-r * 0.72, -r * 0.1, r * 0.28, r * 0.55, 0.2, 0, Math.PI * 2);
        ctx.ellipse(r * 0.72, -r * 0.1, r * 0.28, r * 0.55, -0.2, 0, Math.PI * 2);
        ctx.fill();
        // Cabeça/corpo
        ctx.beginPath();
        ctx.arc(0, -r * 0.1, r * 0.82, Math.PI, 0);
        ctx.lineTo(r * 0.82, r * 0.78);
        ctx.lineTo(r * 0.4, r * 0.56);
        ctx.lineTo(0, r * 0.78);
        ctx.lineTo(-r * 0.4, r * 0.56);
        ctx.lineTo(-r * 0.82, r * 0.78);
        ctx.closePath();
        ctx.fill();

        // Olhinhos olhando na direção do movimento
        const dv = DIR_VECTORS[dog.dir];
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-r * 0.28, -r * 0.2, r * 0.22, 0, Math.PI * 2);
        ctx.arc(r * 0.28, -r * 0.2, r * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(-r * 0.28 + dv.x * r * 0.08, -r * 0.2 + dv.y * r * 0.08, r * 0.11, 0, Math.PI * 2);
        ctx.arc(r * 0.28 + dv.x * r * 0.08, -r * 0.2 + dv.y * r * 0.08, r * 0.11, 0, Math.PI * 2);
        ctx.fill();
        // Focinho
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(0, r * 0.14, r * 0.13, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Popups de pontuação flutuantes
    for (const p of popups) {
      ctx.fillStyle = p.color;
      ctx.font = `bold ${Math.max(11, Math.round(tile * 0.68))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(p.text, (p.x + 0.5) * tile, (p.y + 0.5) * tile);
    }
  };

  let rafId = 0;
  let lastTime = performance.now();

  const tick = (now: number) => {
    if (stopped) return;
    const rawDt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;

    if (!paused) {
      totalDurationSec += rawDt;
      mouthTimer += rawDt;
      if (stageResetFreeze > 0) {
        stageResetFreeze = Math.max(0, stageResetFreeze - rawDt);
      } else {
        const cfg = getPacStageConfig(stage);

        if (frightenedLeft > 0) {
          frightenedLeft = Math.max(0, frightenedLeft - rawDt);
        } else {
          modeTimer -= rawDt;
          if (modeTimer <= 0) {
            modeIsScatter = !modeIsScatter;
            modeTimer = modeIsScatter ? cfg.scatterSec : cfg.chaseSec;
            for (const d of dogs) {
              if (!d.inHouse && !d.eatenReturning) {
                d.dir = OPPOSITE_DIR[d.dir];
              }
            }
          }
        }

        if (fruitActive) {
          fruitTimer -= rawDt;
          if (fruitTimer <= 0) fruitActive = false;
        }

        stepMiau(rawDt, cfg.miauSpeed);
        stepDogs(rawDt, cfg);

        // Colisões com cachorros / ratos
        for (const dog of dogs) {
          if (dog.inHouse || dog.eatenReturning) continue;
          const dist = Math.hypot(dog.x - miauX, dog.y - miauY);
          if (dist < 0.72) {
            if (frightenedLeft > 0) {
              dog.eatenReturning = true;
              const ratPts = 200 * Math.pow(2, Math.min(3, ratComboIndex));
              ratComboIndex += 1;
              addScore(ratPts);
              soundService.playCoin();
              hapticService.coin();
              popups.push({
                x: dog.x,
                y: dog.y - 0.5,
                text: `+${ratPts} 🐭`,
                color: '#38bdf8',
                life: 1.3,
              });
            } else {
              handleMiauHitDog();
              break;
            }
          }
        }

        for (let i = popups.length - 1; i >= 0; i--) {
          popups[i].life -= rawDt;
          popups[i].y -= rawDt * 0.9;
          if (popups[i].life <= 0) popups.splice(i, 1);
        }

        updateHud();
        if (pelletsRemaining <= 0) {
          handleStageCleared();
        }
      }
    }

    drawScene();
    rafId = window.requestAnimationFrame(tick);
  };

  const setDirectionInput = (dir: DirName) => {
    queuedDir = dir;
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (key === 'arrowup' || key === 'w') {
      e.preventDefault();
      setDirectionInput('up');
    } else if (key === 'arrowdown' || key === 's') {
      e.preventDefault();
      setDirectionInput('down');
    } else if (key === 'arrowleft' || key === 'a') {
      e.preventDefault();
      setDirectionInput('left');
    } else if (key === 'arrowright' || key === 'd') {
      e.preventDefault();
      setDirectionInput('right');
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
  const handleTouchMove = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    if (Math.hypot(dx, dy) < 18) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      setDirectionInput(dx > 0 ? 'right' : 'left');
    } else {
      setDirectionInput(dy > 0 ? 'down' : 'up');
    }
    touchStartX = t.clientX;
    touchStartY = t.clientY;
  };

  const dpadButtons = Array.from(
    container.querySelectorAll('[data-pac-dir]')
  ) as HTMLButtonElement[];
  const dpadHandlers = dpadButtons.map((btn) => {
    const fn = () => {
      const d = btn.getAttribute('data-pac-dir') as DirName | null;
      if (d) {
        hapticService.tap();
        setDirectionInput(d);
      }
    };
    btn.addEventListener('pointerdown', fn);
    return () => btn.removeEventListener('pointerdown', fn);
  });

  const handlePauseToggle = () => {
    if (overlayEl.querySelector('#pac-next-stage, #pac-finish-btn')) return;
    paused = !paused;
    pauseBtn.textContent = paused ? '▶' : '⏸';
    if (paused) {
      showOverlay(`
        <div class="bg-white rounded-3xl p-5 max-w-xs w-full text-center shadow-2xl border-2 border-purple-300">
          <div class="text-3xl mb-1">⏸️</div>
          <h4 class="font-display text-lg font-bold text-[#3b1f6e]">Jogo Pausado</h4>
          <p class="text-xs font-semibold text-[#6b4d9e] mt-1">Respire e continue coletando bolinhas!</p>
          <div class="flex gap-2 mt-3">
            <button id="pac-resume-btn" type="button" class="flex-1 py-2.5 rounded-2xl bg-[#6e45a5] text-white font-extrabold text-xs">Continuar ▶</button>
            <button id="pac-exit-run-btn" type="button" class="px-3 py-2.5 rounded-2xl bg-rose-100 text-rose-700 font-extrabold text-xs">Encerrar</button>
          </div>
        </div>
      `);
      overlayEl
        .querySelector('#pac-resume-btn')
        ?.addEventListener('click', () => {
          paused = false;
          pauseBtn.textContent = '⏸';
          hideOverlay();
        });
      overlayEl
        .querySelector('#pac-exit-run-btn')
        ?.addEventListener('click', finishGame);
    } else {
      hideOverlay();
    }
  };

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
  boardWrap.addEventListener('touchmove', handleTouchMove, { passive: true });
  pauseBtn.addEventListener('click', handlePauseToggle);
  muteBtn.addEventListener('click', handleMuteClick);
  closeBtn.addEventListener('click', handleCloseClick);

  const cleanupListeners = () => {
    if (rafId) window.cancelAnimationFrame(rafId);
    resizeObs.disconnect();
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('resize', resizeCanvas);
    boardWrap.removeEventListener('touchstart', handleTouchStart);
    boardWrap.removeEventListener('touchmove', handleTouchMove);
    pauseBtn.removeEventListener('click', handlePauseToggle);
    muteBtn.removeEventListener('click', handleMuteClick);
    closeBtn.removeEventListener('click', handleCloseClick);
    dpadHandlers.forEach((off) => off());
  };

  buildGridForStage();
  resetPositions();
  resizeCanvas();
  rafId = window.requestAnimationFrame(tick);

  return () => {
    stopped = true;
    cleanupListeners();
  };
}
