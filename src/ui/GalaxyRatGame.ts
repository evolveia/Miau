import { hapticService } from '../services/hapticService';
import { soundService } from '../services/soundService';
import type { MiniGameResult } from './MiniGames';

interface GalaxyStageConfig {
  name: string;
  rows: number;
  cols: number;
  enemySpeed: number;
  fireRateSec: number;
  hasBoss: boolean;
  armoredChance: number;
}

interface AlienRat {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  isBoss: boolean;
  kind: 'scout' | 'armored' | 'boss';
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fromPlayer: boolean;
}

interface PowerUp {
  x: number;
  y: number;
  kind: 'double' | 'shield' | 'rapid' | 'coin';
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
}

function getGalaxyStageConfig(stage: number): GalaxyStageConfig {
  if (stage === 1) {
    return {
      name: 'Órbita Lunar',
      rows: 2,
      cols: 5,
      enemySpeed: 12,
      fireRateSec: 2.8,
      hasBoss: false,
      armoredChance: 0,
    };
  }
  if (stage === 2) {
    return {
      name: 'Cinturão de Asteroides',
      rows: 3,
      cols: 5,
      enemySpeed: 19,
      fireRateSec: 2.2,
      hasBoss: false,
      armoredChance: 0.3,
    };
  }
  if (stage === 3) {
    return {
      name: 'Nave-Mãe Queijo',
      rows: 2,
      cols: 5,
      enemySpeed: 26,
      fireRateSec: 1.65,
      hasBoss: true,
      armoredChance: 0.42,
    };
  }
  return {
    name: 'Galáxia Infinita',
    rows: Math.min(4, 2 + Math.floor((stage - 2) / 2)),
    cols: 6,
    enemySpeed: Math.min(54, 32 + (stage - 3) * 5),
    fireRateSec: Math.max(0.95, 1.4 - (stage - 3) * 0.08),
    hasBoss: true,
    armoredChance: 0.52,
  };
}

function formatTimer(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export function mountGalaxyRatGame(
  container: HTMLElement,
  onComplete: (result: MiniGameResult) => void,
  onClose: () => void,
  highScore = 0,
  onToggleMute?: () => boolean
): () => void {
  let stage = 1;
  let score = 0;
  let coinsCollected = 0;
  let lives = 3;
  let totalElapsedSec = 0;
  let autoFire = true;
  let firingHeld = false;
  let paused = false;
  let ended = false;
  let rafId = 0;
  let lastFrameMs = performance.now();

  let width = 340;
  let height = 275;
  let shipX = width / 2;
  let targetShipX = width / 2;
  let moveDir = 0; // -1, 0, 1 for buttons/keyboard
  let fireCooldown = 0;
  let enemyFireCooldown = 1.4;
  let enemyDir = 1;
  let doubleShotTimer = 0;
  let rapidFireTimer = 0;
  let shieldTimer = 0;
  let invulnTimer = 0;
  let nextId = 1;

  let rats: AlienRat[] = [];
  let bullets: Bullet[] = [];
  let powerUps: PowerUp[] = [];
  let particles: Particle[] = [];

  const stars = Array.from({ length: 34 }, (_, i) => ({
    x: ((i * 67) % 340) / 340,
    y: ((i * 43) % 275) / 275,
    size: i % 4 === 0 ? 2.2 : 1.3,
    speed: 0.04 + (i % 5) * 0.025,
  }));

  container.innerHTML = `
    <div class="flex-1 flex flex-col gap-2 min-h-0 h-full select-none">
      <div class="flex items-center justify-between gap-2 shrink-0">
        <div class="min-w-0">
          <div class="flex items-center gap-1.5">
            <h3 class="font-display text-base font-bold text-[#3b1f6e] truncate">Miau Galáxia vs. Ratos ETs 🚀</h3>
            <span id="gr-stage-badge" class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 shrink-0">Fase 1</span>
          </div>
          <p id="gr-stage-sub" class="text-[11px] font-semibold text-[#6b4d9e] truncate">Órbita Lunar • Recorde: ${highScore}</p>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button id="gr-mute" type="button" aria-pressed="${!soundService.enabled}" aria-label="${soundService.enabled ? 'Silenciar áudio' : 'Ativar áudio'}" class="w-8 h-8 rounded-full ${soundService.enabled ? 'bg-purple-100 text-purple-800' : 'bg-rose-100 text-rose-800'} font-bold text-sm flex items-center justify-center shrink-0">${soundService.enabled ? '🔊' : '🔇'}</button>
          <button id="gr-close" type="button" class="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold text-sm shrink-0">✕</button>
        </div>
      </div>

      <div class="grid grid-cols-4 gap-1 bg-white/85 rounded-2xl px-2.5 py-1.5 text-[11px] font-extrabold text-[#4c2a85] border border-purple-100 shadow-sm shrink-0">
        <div>Pontos: <span id="gr-score" class="text-purple-700">0</span></div>
        <div class="text-center">Ratos: <span id="gr-enemies" class="text-emerald-700">10</span></div>
        <div class="text-center" id="gr-lives">❤️❤️❤️</div>
        <div class="text-right">⏱️ <span id="gr-time">00:00</span></div>
      </div>

      <div id="gr-canvas-wrap" class="relative flex-1 min-h-[240px] w-full rounded-3xl overflow-hidden border-2 border-white shadow-inner bg-[#0c0a24] touch-none">
        <canvas id="gr-canvas" class="w-full h-full block"></canvas>
        <div id="gr-overlay" class="hidden absolute inset-0 bg-[#0d0929]/88 flex flex-col items-center justify-center p-4 text-center z-10">
          <div id="gr-ov-emoji" class="text-4xl mb-1">🛸</div>
          <h4 id="gr-ov-title" class="font-display text-xl font-bold text-white">Onda Derrotada!</h4>
          <p id="gr-ov-desc" class="text-xs font-semibold text-indigo-100 mt-1 mb-3"></p>
          <div id="gr-ov-actions" class="flex flex-col gap-2 w-full max-w-[230px]"></div>
        </div>
      </div>

      <div class="grid grid-cols-4 gap-1.5 shrink-0">
        <button id="gr-btn-left" type="button" class="py-2 rounded-2xl bg-white/95 border border-purple-200 text-[#3b1f6e] font-display font-bold text-sm shadow-sm active:scale-95 transition touch-none">⬅️</button>
        <button id="gr-btn-fire" type="button" class="py-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white font-display font-bold text-xs shadow-sm active:scale-95 transition touch-none">🔫 Atirar</button>
        <button id="gr-btn-auto" type="button" class="py-2 rounded-2xl bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-[11px] shadow-sm active:scale-95 transition">Auto: ON</button>
        <button id="gr-btn-right" type="button" class="py-2 rounded-2xl bg-white/95 border border-purple-200 text-[#3b1f6e] font-display font-bold text-sm shadow-sm active:scale-95 transition touch-none">➡️</button>
      </div>
    </div>
  `;

  const canvas = container.querySelector('#gr-canvas') as HTMLCanvasElement;
  const wrap = container.querySelector('#gr-canvas-wrap') as HTMLElement;
  const ctx = canvas.getContext('2d');
  const stageBadgeEl = container.querySelector('#gr-stage-badge') as HTMLElement;
  const stageSubEl = container.querySelector('#gr-stage-sub') as HTMLElement;
  const scoreEl = container.querySelector('#gr-score') as HTMLElement;
  const enemiesEl = container.querySelector('#gr-enemies') as HTMLElement;
  const livesEl = container.querySelector('#gr-lives') as HTMLElement;
  const timeEl = container.querySelector('#gr-time') as HTMLElement;
  const autoBtn = container.querySelector('#gr-btn-auto') as HTMLButtonElement;
  const muteBtn = container.querySelector('#gr-mute') as HTMLButtonElement | null;
  const overlayEl = container.querySelector('#gr-overlay') as HTMLElement;
  const ovEmojiEl = container.querySelector('#gr-ov-emoji') as HTMLElement;
  const ovTitleEl = container.querySelector('#gr-ov-title') as HTMLElement;
  const ovDescEl = container.querySelector('#gr-ov-desc') as HTMLElement;
  const ovActionsEl = container.querySelector('#gr-ov-actions') as HTMLElement;

  const resizeCanvas = () => {
    const rect = wrap.getBoundingClientRect();
    width = Math.max(260, Math.round(rect.width || 340));
    height = Math.max(220, Math.round(rect.height || 275));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    shipX = Math.max(24, Math.min(width - 24, shipX));
    targetShipX = Math.max(24, Math.min(width - 24, targetShipX));
    for (const r of rats) {
      r.x = Math.max(r.w / 2 + 8, Math.min(width - r.w / 2 - 8, r.x));
    }
  };
  resizeCanvas();
  const resizeObserver =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => resizeCanvas())
      : null;
  resizeObserver?.observe(wrap);

  const spawnWave = (st: number) => {
    const cfg = getGalaxyStageConfig(st);
    rats = [];
    bullets = [];
    powerUps = [];
    enemyDir = 1;

    if (cfg.hasBoss) {
      const bossHp = 10 + (st - 3) * 5;
      rats.push({
        id: nextId++,
        x: width / 2,
        y: 38,
        w: 62,
        h: 30,
        hp: bossHp,
        maxHp: bossHp,
        isBoss: true,
        kind: 'boss',
      });
    }

    const topOffset = cfg.hasBoss ? 72 : 34;
    const usableW = Math.max(180, width - 56);
    const stepX = usableW / Math.max(1, cfg.cols - 1);

    for (let r = 0; r < cfg.rows; r++) {
      for (let c = 0; c < cfg.cols; c++) {
        const armored = Math.random() < cfg.armoredChance;
        rats.push({
          id: nextId++,
          x: 28 + c * stepX,
          y: topOffset + r * 30,
          w: 28,
          h: 20,
          hp: armored ? 2 : 1,
          maxHp: armored ? 2 : 1,
          isBoss: false,
          kind: armored ? 'armored' : 'scout',
        });
      }
    }
  };

  const updateHud = () => {
    const cfg = getGalaxyStageConfig(stage);
    stageBadgeEl.textContent = `Fase ${stage}`;
    stageSubEl.textContent = `${cfg.name} • Recorde: ${Math.max(highScore, score)}`;
    scoreEl.textContent = String(score);
    enemiesEl.textContent = String(rats.length);
    livesEl.textContent = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(Math.max(0, 3 - lives));
    timeEl.textContent = formatTimer(totalElapsedSec);
  };

  const spawnExplosion = (x: number, y: number, color: string, count = 10) => {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 90;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        color,
        life: 0.45 + Math.random() * 0.25,
      });
    }
  };

  const firePlayerLaser = () => {
    if (paused || ended || fireCooldown > 0) return;
    fireCooldown = rapidFireTimer > 0 ? 0.14 : 0.27;
    if (doubleShotTimer > 0) {
      bullets.push({ x: shipX - 9, y: height - 42, vx: -15, vy: -340, fromPlayer: true });
      bullets.push({ x: shipX + 9, y: height - 42, vx: 15, vy: -340, fromPlayer: true });
    } else {
      bullets.push({ x: shipX, y: height - 44, vx: 0, vy: -350, fromPlayer: true });
    }
    soundService.playMeow(1.45);
  };

  const finishGame = () => {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(rafId);
    const coinsEarned = Math.max(
      14,
      coinsCollected * 5 + Math.round(score / 18) + (stage - 1) * 18
    );
    const funBoost = Math.min(44, 16 + stage * 5);
    const xpEarned = Math.min(64, 15 + Math.round(score / 22) + stage * 6);
    const tier: MiniGameResult['performanceTier'] =
      stage >= 3 || score >= 480
        ? 'gold'
        : stage >= 2 || score >= 240
          ? 'silver'
          : 'bronze';
    onComplete({
      gameId: 'galaxy',
      gameName: 'Miau Galáxia vs. Ratos ETs',
      score,
      stageReached: stage,
      durationSec: Math.max(1, Math.round(totalElapsedSec)),
      coinsEarned,
      funBoost,
      xpEarned,
      performanceTier: tier,
      summaryText: `Fase ${stage} • ${score} pts em ${formatTimer(totalElapsedSec)}`,
    });
  };

  const showWaveClearOverlay = () => {
    paused = true;
    soundService.playCoin();
    hapticService.achievement();
    ovEmojiEl.textContent = '🚀';
    ovTitleEl.textContent = `Fase ${stage} Vencida!`;
    ovDescEl.textContent = `Todos os Ratos ETs foram repelidos! Pontos: ${score}`;
    ovActionsEl.innerHTML = `
      <button id="gr-next-stage" type="button" class="w-full py-2.5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 text-white font-display font-bold text-sm shadow-lg active:scale-95 transition">
        Avançar para Fase ${stage + 1} ➡️
      </button>
      <button id="gr-claim" type="button" class="w-full py-2 rounded-full bg-white/90 text-[#3b1f6e] font-bold text-xs shadow active:scale-95 transition">
        🪙 Resgatar Moedas e Sair
      </button>
    `;
    overlayEl.classList.remove('hidden');

    overlayEl.querySelector('#gr-next-stage')?.addEventListener('click', () => {
      stage += 1;
      spawnWave(stage);
      paused = false;
      overlayEl.classList.add('hidden');
      lastFrameMs = performance.now();
      updateHud();
    });
    overlayEl.querySelector('#gr-claim')?.addEventListener('click', finishGame);
  };

  const showGameOverOverlay = () => {
    paused = true;
    hapticService.warning();
    ovEmojiEl.textContent = '🛸';
    ovTitleEl.textContent = 'Nave Danificada!';
    ovDescEl.textContent = `Os Ratos ETs avançaram na Fase ${stage} • ${score} pontos`;
    ovActionsEl.innerHTML = `
      <button id="gr-claim-over" type="button" class="w-full py-2.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-display font-bold text-sm shadow-lg active:scale-95 transition">
        🪙 Resgatar Moedas
      </button>
    `;
    overlayEl.classList.remove('hidden');
    overlayEl.querySelector('#gr-claim-over')?.addEventListener('click', finishGame);
  };

  const drawScene = () => {
    if (!ctx) return;

    // 1. Deep space background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#07051a');
    bgGrad.addColorStop(1, '#1e1647');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Scrolling stars
    for (const s of stars) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(s.x * width, s.y * height, s.size, s.size);
    }

    // 2. Alien Rat UFOs
    for (const r of rats) {
      ctx.save();
      ctx.translate(r.x, r.y);
      if (r.isBoss) {
        // Boss Giant Cheese Saucer
        ctx.fillStyle = '#c084fc';
        ctx.beginPath();
        ctx.ellipse(0, 6, 30, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#a3e635';
        ctx.strokeStyle = '#3b1f6e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, -4, 15, Math.PI, 0);
        ctx.fill();
        ctx.stroke();
        // Boss rat ears & angry eyes
        ctx.fillStyle = '#bef264';
        ctx.beginPath();
        ctx.arc(-11, -14, 6, 0, Math.PI * 2);
        ctx.arc(11, -14, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(-5, -5, 2.5, 0, Math.PI * 2);
        ctx.arc(5, -5, 2.5, 0, Math.PI * 2);
        ctx.fill();
        // HP bar
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(-24, -25, 48, 4);
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(-24, -25, 48 * (r.hp / r.maxHp), 4);
      } else {
        // UFO saucer base
        ctx.fillStyle = r.kind === 'armored' ? '#cbd5e1' : '#38bdf8';
        ctx.beginPath();
        ctx.ellipse(0, 4, 13, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Glass dome + green alien rat head
        ctx.fillStyle = r.kind === 'armored' ? '#facc15' : '#84cc16';
        ctx.beginPath();
        ctx.arc(0, -1, 8, Math.PI, 0);
        ctx.fill();
        // Mouse ears
        ctx.beginPath();
        ctx.arc(-6, -8, 3.6, 0, Math.PI * 2);
        ctx.arc(6, -8, 3.6, 0, Math.PI * 2);
        ctx.fill();
        // Eyes
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(-2.8, -2, 1.4, 0, Math.PI * 2);
        ctx.arc(2.8, -2, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 3. Falling Power-ups
    for (const p of powerUps) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle =
        p.kind === 'coin'
          ? '#facc15'
          : p.kind === 'shield'
            ? '#38bdf8'
            : p.kind === 'double'
              ? '#f472b6'
              : '#fb923c';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const icon = p.kind === 'coin' ? '$' : p.kind === 'shield' ? '🛡' : p.kind === 'double' ? '⚡' : '🔥';
      ctx.fillText(icon, 0, 0.5);
      ctx.restore();
    }

    // 4. Bullets
    for (const b of bullets) {
      ctx.fillStyle = b.fromPlayer ? '#67e8f9' : '#fb7185';
      ctx.fillRect(b.x - 2, b.y - 6, 4, 12);
    }

    // 5. Particles
    for (const pt of particles) {
      ctx.globalAlpha = Math.max(0, pt.life * 1.6);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    // 6. Miau Starfighter at bottom
    const sy = height - 26;
    if (!(invulnTimer > 0 && Math.floor(invulnTimer * 14) % 2 === 0)) {
      ctx.save();
      ctx.translate(shipX, sy);

      // Shield bubble
      if (shieldTimer > 0) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 24, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Thruster flame
      ctx.fillStyle = rapidFireTimer > 0 ? '#fde047' : '#fb923c';
      ctx.beginPath();
      ctx.moveTo(-6, 14);
      ctx.lineTo(0, 22 + Math.random() * 5);
      ctx.lineTo(6, 14);
      ctx.closePath();
      ctx.fill();

      // Wings & Hull
      ctx.fillStyle = '#e879f9';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(20, 12);
      ctx.lineTo(7, 10);
      ctx.lineTo(4, 15);
      ctx.lineTo(-4, 15);
      ctx.lineTo(-7, 10);
      ctx.lineTo(-20, 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Cat-ear cockpit canopy with mini Miau face
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f59e42';
      ctx.beginPath();
      ctx.arc(3.5, -2.5, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2d1b4e';
      ctx.beginPath();
      ctx.arc(-2.5, 0, 1.3, 0, Math.PI * 2);
      ctx.arc(2.5, 0, 1.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - lastFrameMs) / 1000);
    lastFrameMs = now;

    if (!paused && !ended) {
      const cfg = getGalaxyStageConfig(stage);
      totalElapsedSec += dt;
      if (fireCooldown > 0) fireCooldown -= dt;
      if (doubleShotTimer > 0) doubleShotTimer = Math.max(0, doubleShotTimer - dt);
      if (rapidFireTimer > 0) rapidFireTimer = Math.max(0, rapidFireTimer - dt);
      if (shieldTimer > 0) shieldTimer = Math.max(0, shieldTimer - dt);
      if (invulnTimer > 0) invulnTimer = Math.max(0, invulnTimer - dt);

      // Stars scroll
      for (const s of stars) {
        s.y = (s.y + s.speed * dt) % 1;
      }

      // Move ship smoothly
      if (moveDir !== 0) {
        targetShipX = Math.max(24, Math.min(width - 24, targetShipX + moveDir * 240 * dt));
      }
      shipX += (targetShipX - shipX) * Math.min(1, dt * 16);

      if (autoFire || firingHeld) {
        firePlayerLaser();
      }

      // Move Alien Rats horizontally & bounce down
      let hitEdge = false;
      for (const r of rats) {
        r.x += enemyDir * cfg.enemySpeed * dt;
        if (r.x > width - r.w / 2 - 8 || r.x < r.w / 2 + 8) {
          hitEdge = true;
        }
      }
      if (hitEdge) {
        enemyDir *= -1;
        const dropStep = stage === 1 ? 6 : stage === 2 ? 8 : 10;
        for (const r of rats) {
          r.y += dropStep;
          r.x = Math.max(r.w / 2 + 8, Math.min(width - r.w / 2 - 8, r.x));
          if (r.y >= height - 48) {
            lives = 0;
            updateHud();
            drawScene();
            showGameOverOverlay();
            return;
          }
        }
      }

      // Enemy firing
      enemyFireCooldown -= dt;
      if (enemyFireCooldown <= 0 && rats.length > 0) {
        enemyFireCooldown = cfg.fireRateSec * (0.75 + Math.random() * 0.5);
        const shooter = rats[Math.floor(Math.random() * rats.length)];
        bullets.push({
          x: shooter.x,
          y: shooter.y + shooter.h / 2,
          vx: 0,
          vy: 82 + stage * 12,
          fromPlayer: false,
        });
      }

      // Move bullets & check collisions
      const remainingBullets: Bullet[] = [];
      for (const b of bullets) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.y < -15 || b.y > height + 15) continue;

        if (b.fromPlayer) {
          let hitRat = false;
          for (let i = rats.length - 1; i >= 0; i--) {
            const r = rats[i];
            if (Math.abs(b.x - r.x) < r.w / 2 + 5 && Math.abs(b.y - r.y) < r.h / 2 + 6) {
              hitRat = true;
              r.hp -= 1;
              if (r.hp <= 0) {
                score += r.isBoss ? 150 : r.kind === 'armored' ? 35 : 20;
                spawnExplosion(r.x, r.y, r.isBoss ? '#c084fc' : '#a3e635', r.isBoss ? 22 : 10);
                hapticService.tap();
                soundService.playCoin();
                if (Math.random() < 0.24 || r.isBoss) {
                  const kinds: PowerUp['kind'][] = ['coin', 'double', 'shield', 'rapid'];
                  powerUps.push({
                    x: r.x,
                    y: r.y,
                    kind: kinds[Math.floor(Math.random() * kinds.length)],
                  });
                }
                rats.splice(i, 1);
              } else {
                spawnExplosion(b.x, b.y, '#fde047', 4);
              }
              break;
            }
          }
          if (!hitRat) remainingBullets.push(b);
        } else {
          // Enemy bolt vs player ship
          if (Math.abs(b.x - shipX) < 16 && Math.abs(b.y - (height - 26)) < 16) {
            if (shieldTimer > 0) {
              shieldTimer = 0;
              spawnExplosion(shipX, height - 26, '#38bdf8', 10);
              hapticService.tap();
            } else if (invulnTimer <= 0) {
              lives -= 1;
              invulnTimer = 1.4;
              spawnExplosion(shipX, height - 26, '#fb7185', 14);
              soundService.playMeow(0.75);
              hapticService.warning();
              if (lives <= 0) {
                updateHud();
                drawScene();
                showGameOverOverlay();
                return;
              }
            }
          } else {
            remainingBullets.push(b);
          }
        }
      }
      bullets = remainingBullets;

      // Move power-ups & collect
      const remainingPowerUps: PowerUp[] = [];
      for (const p of powerUps) {
        p.y += 95 * dt;
        if (Math.abs(p.x - shipX) < 22 && Math.abs(p.y - (height - 26)) < 20) {
          soundService.playCoin();
          hapticService.coin();
          if (p.kind === 'coin') {
            coinsCollected += 2;
            score += 30;
          } else if (p.kind === 'double') {
            doubleShotTimer = 6.5;
          } else if (p.kind === 'shield') {
            shieldTimer = 8.0;
          } else {
            rapidFireTimer = 6.0;
          }
          spawnExplosion(p.x, p.y, '#fde047', 8);
        } else if (p.y < height + 15) {
          remainingPowerUps.push(p);
        }
      }
      powerUps = remainingPowerUps;

      // Update particles
      for (const pt of particles) {
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.life -= dt;
      }
      particles = particles.filter((pt) => pt.life > 0);

      updateHud();

      if (rats.length === 0) {
        score += 70 * stage;
        updateHud();
        drawScene();
        showWaveClearOverlay();
        rafId = requestAnimationFrame(loop);
        return;
      }
    }

    drawScene();
    rafId = requestAnimationFrame(loop);
  };

  let dragging = false;
  const moveToPointer = (clientX: number) => {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    targetShipX = Math.max(24, Math.min(width - 24, x));
  };

  const onPointerDown = (e: PointerEvent) => {
    dragging = true;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic events
    }
    moveToPointer(e.clientX);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging) return;
    moveToPointer(e.clientX);
  };
  const onPointerUp = () => {
    dragging = false;
  };
  const resetInputs = () => {
    dragging = false;
    moveDir = 0;
    firingHeld = false;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      moveDir = -1;
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      moveDir = 1;
    } else if (e.key === ' ') {
      e.preventDefault();
      firingHeld = true;
      firePlayerLaser();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (
      (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') &&
      moveDir === -1
    ) {
      moveDir = 0;
    } else if (
      (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') &&
      moveDir === 1
    ) {
      moveDir = 0;
    } else if (e.key === ' ') {
      firingHeld = false;
    }
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointercancel', resetInputs);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('blur', resetInputs);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('resize', resizeCanvas);

  const leftBtn = container.querySelector('#gr-btn-left') as HTMLButtonElement | null;
  const rightBtn = container.querySelector('#gr-btn-right') as HTMLButtonElement | null;
  const fireBtn = container.querySelector('#gr-btn-fire') as HTMLButtonElement | null;

  const setMoveLeft = (e: PointerEvent) => {
    e.preventDefault();
    moveDir = -1;
  };
  const setMoveRight = (e: PointerEvent) => {
    e.preventDefault();
    moveDir = 1;
  };
  const clearMove = () => {
    moveDir = 0;
  };
  const startFireHold = (e: PointerEvent) => {
    e.preventDefault();
    firingHeld = true;
    firePlayerLaser();
  };
  const stopFireHold = () => {
    firingHeld = false;
  };

  leftBtn?.addEventListener('pointerdown', setMoveLeft);
  leftBtn?.addEventListener('pointerup', clearMove);
  leftBtn?.addEventListener('pointercancel', clearMove);
  leftBtn?.addEventListener('pointerleave', clearMove);
  rightBtn?.addEventListener('pointerdown', setMoveRight);
  rightBtn?.addEventListener('pointerup', clearMove);
  rightBtn?.addEventListener('pointercancel', clearMove);
  rightBtn?.addEventListener('pointerleave', clearMove);

  fireBtn?.addEventListener('pointerdown', startFireHold);
  fireBtn?.addEventListener('pointerup', stopFireHold);
  fireBtn?.addEventListener('pointercancel', stopFireHold);
  fireBtn?.addEventListener('pointerleave', stopFireHold);

  autoBtn?.addEventListener('click', () => {
    autoFire = !autoFire;
    autoBtn.textContent = autoFire ? 'Auto: ON' : 'Auto: OFF';
    autoBtn.className = autoFire
      ? 'py-2 rounded-2xl bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-[11px] shadow-sm active:scale-95 transition'
      : 'py-2 rounded-2xl bg-slate-100 border border-slate-300 text-slate-700 font-bold text-[11px] shadow-sm active:scale-95 transition';
  });

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
    muteBtn.className = `w-8 h-8 rounded-full ${next ? 'bg-purple-100 text-purple-800' : 'bg-rose-100 text-rose-800'} font-bold text-sm flex items-center justify-center shrink-0`;
  });

  container.querySelector('#gr-close')?.addEventListener('click', () => {
    ended = true;
    cancelAnimationFrame(rafId);
    onClose();
  });

  spawnWave(1);
  updateHud();
  rafId = requestAnimationFrame(loop);

  return () => {
    ended = true;
    cancelAnimationFrame(rafId);
    resizeObserver?.disconnect();
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointercancel', resetInputs);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('blur', resetInputs);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('resize', resizeCanvas);
  };
}
