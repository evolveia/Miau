import { hapticService } from '../services/hapticService';
import { soundService } from '../services/soundService';
import type { MiniGameResult } from './MiniGames';

interface EscapeStageConfig {
  name: string;
  goalDist: number;
  baseSpeed: number;
  spawnInterval: number;
  hazardRate: number;
  skyTop: string;
  skyBottom: string;
  horizonColor: string;
  roadColor: string;
  shoulderColor: string;
  sunColor: string;
  stars: boolean;
}

interface RoadEntity {
  id: number;
  lane: 0 | 1 | 2;
  z: number; // 0 (horizon) -> 1 (player windshield)
  kind: 'cone' | 'box' | 'barrier' | 'coin' | 'turbo';
  hit?: boolean;
}

interface FloatingNotice {
  text: string;
  color: string;
  x: number;
  y: number;
  life: number;
}

function getEscapeStageConfig(stage: number): EscapeStageConfig {
  if (stage === 1) {
    return {
      name: 'Estrada Ensolarada',
      goalDist: 450,
      baseSpeed: 0.44,
      spawnInterval: 0.78,
      hazardRate: 0.56,
      skyTop: '#60a5fa',
      skyBottom: '#dbeafe',
      horizonColor: '#86efac',
      roadColor: '#334155',
      shoulderColor: '#cbd5e1',
      sunColor: '#fde047',
      stars: false,
    };
  }
  if (stage === 2) {
    return {
      name: 'Pôr do Sol Dourado',
      goalDist: 650,
      baseSpeed: 0.56,
      spawnInterval: 0.64,
      hazardRate: 0.62,
      skyTop: '#7c3aed',
      skyBottom: '#fb923c',
      horizonColor: '#fdba74',
      roadColor: '#292524',
      shoulderColor: '#fde68a',
      sunColor: '#fed7aa',
      stars: false,
    };
  }
  if (stage === 3) {
    return {
      name: 'Rodovia Neon Noturna',
      goalDist: 850,
      baseSpeed: 0.68,
      spawnInterval: 0.54,
      hazardRate: 0.66,
      skyTop: '#0f172a',
      skyBottom: '#4c1d95',
      horizonColor: '#a855f7',
      roadColor: '#1e1b4b',
      shoulderColor: '#38bdf8',
      sunColor: '#f472b6',
      stars: true,
    };
  }
  return {
    name: 'Autoestrada Cósmica',
    goalDist: 950 + (stage - 4) * 200,
    baseSpeed: Math.min(0.95, 0.76 + (stage - 4) * 0.06),
    spawnInterval: Math.max(0.36, 0.48 - (stage - 4) * 0.03),
    hazardRate: 0.68,
    skyTop: '#020617',
    skyBottom: '#312e81',
    horizonColor: '#22d3ee',
    roadColor: '#17153b',
    shoulderColor: '#e879f9',
    sunColor: '#c084fc',
    stars: true,
  };
}

function formatTimer(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export function mountEscapeRunGame(
  container: HTMLElement,
  onComplete: (result: MiniGameResult) => void,
  onClose: () => void,
  highScore = 0
): () => void {
  let stage = 1;
  let score = 0;
  let coinsCollected = 0;
  let lives = 3;
  let stageDist = 0;
  let totalElapsedSec = 0;
  let playerLane: 0 | 1 | 2 = 1;
  let visualLaneX = 0; // -1 (left), 0 (center), 1 (right)
  let wheelAngle = 0;
  let targetWheelAngle = 0;
  let turboTimer = 0;
  let invulnTimer = 0;
  let shakeTimer = 0;
  let miauMoodTimer = 0;
  let miauExpr: 'happy' | 'oops' | 'turbo' = 'happy';
  let roadScroll = 0;
  let spawnAccum = 0;
  let nextId = 1;
  let paused = false;
  let ended = false;
  let rafId = 0;
  let lastFrameMs = performance.now();

  let entities: RoadEntity[] = [];
  let notices: FloatingNotice[] = [];

  container.innerHTML = `
    <div class="flex flex-col gap-2 select-none">
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0">
          <div class="flex items-center gap-1.5">
            <h3 class="font-display text-base font-bold text-[#3b1f6e] truncate">Miau Escape Run 🚗</h3>
            <span id="er-stage-badge" class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 shrink-0">Fase 1</span>
          </div>
          <p id="er-stage-sub" class="text-[11px] font-semibold text-[#6b4d9e] truncate">Estrada Ensolarada • Recorde: ${highScore}</p>
        </div>
        <button id="er-close" type="button" class="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold text-sm shrink-0">✕</button>
      </div>

      <div class="grid grid-cols-4 gap-1 bg-white/85 rounded-2xl px-2.5 py-1.5 text-[11px] font-extrabold text-[#4c2a85] border border-purple-100 shadow-sm">
        <div>Pontos: <span id="er-score" class="text-purple-700">0</span></div>
        <div class="text-center">Meta: <span id="er-dist" class="text-sky-700">0/450m</span></div>
        <div class="text-center" id="er-lives">❤️❤️❤️</div>
        <div class="text-right">⏱️ <span id="er-time">00:00</span></div>
      </div>

      <div class="w-full h-1.5 bg-purple-100 rounded-full overflow-hidden">
        <div id="er-goal-bar" class="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-fuchsia-500 transition-all duration-150" style="width: 0%"></div>
      </div>

      <div id="er-canvas-wrap" class="relative w-full h-[270px] rounded-3xl overflow-hidden border-2 border-white shadow-inner bg-slate-900 touch-none">
        <canvas id="er-canvas" class="w-full h-full block"></canvas>
        <div id="er-overlay" class="hidden absolute inset-0 bg-[#1e1038]/85 flex flex-col items-center justify-center p-4 text-center z-10">
          <div id="er-ov-emoji" class="text-4xl mb-1">🏁</div>
          <h4 id="er-ov-title" class="font-display text-xl font-bold text-white">Fase Concluída!</h4>
          <p id="er-ov-desc" class="text-xs font-semibold text-purple-100 mt-1 mb-3"></p>
          <div id="er-ov-actions" class="flex flex-col gap-2 w-full max-w-[230px]"></div>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-2">
        <button id="er-btn-left" type="button" class="py-2.5 rounded-2xl bg-white/95 border border-purple-200 text-[#3b1f6e] font-display font-bold text-base shadow-sm active:scale-95 transition">⬅️ Esq</button>
        <button id="er-btn-turbo" type="button" class="py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-display font-bold text-xs shadow-sm active:scale-95 transition">⚡ Turbo</button>
        <button id="er-btn-right" type="button" class="py-2.5 rounded-2xl bg-white/95 border border-purple-200 text-[#3b1f6e] font-display font-bold text-base shadow-sm active:scale-95 transition">Dir ➡️</button>
      </div>
    </div>
  `;

  const canvas = container.querySelector('#er-canvas') as HTMLCanvasElement;
  const wrap = container.querySelector('#er-canvas-wrap') as HTMLElement;
  const ctx = canvas.getContext('2d');
  const stageBadgeEl = container.querySelector('#er-stage-badge') as HTMLElement;
  const stageSubEl = container.querySelector('#er-stage-sub') as HTMLElement;
  const scoreEl = container.querySelector('#er-score') as HTMLElement;
  const distEl = container.querySelector('#er-dist') as HTMLElement;
  const livesEl = container.querySelector('#er-lives') as HTMLElement;
  const timeEl = container.querySelector('#er-time') as HTMLElement;
  const goalBarEl = container.querySelector('#er-goal-bar') as HTMLElement;
  const overlayEl = container.querySelector('#er-overlay') as HTMLElement;
  const ovEmojiEl = container.querySelector('#er-ov-emoji') as HTMLElement;
  const ovTitleEl = container.querySelector('#er-ov-title') as HTMLElement;
  const ovDescEl = container.querySelector('#er-ov-desc') as HTMLElement;
  const ovActionsEl = container.querySelector('#er-ov-actions') as HTMLElement;

  let width = 340;
  let height = 270;

  const resizeCanvas = () => {
    const rect = wrap.getBoundingClientRect();
    width = Math.max(260, Math.round(rect.width || 340));
    height = Math.max(220, Math.round(rect.height || 270));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resizeCanvas();

  const updateHud = () => {
    const cfg = getEscapeStageConfig(stage);
    stageBadgeEl.textContent = `Fase ${stage}`;
    stageSubEl.textContent = `${cfg.name} • Recorde: ${Math.max(highScore, score)}`;
    scoreEl.textContent = String(score);
    distEl.textContent = `${Math.floor(stageDist)}/${cfg.goalDist}m`;
    livesEl.textContent = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(Math.max(0, 3 - lives));
    timeEl.textContent = formatTimer(totalElapsedSec);
    const pct = Math.min(100, Math.round((stageDist / cfg.goalDist) * 100));
    goalBarEl.style.width = `${pct}%`;
  };

  const steer = (dir: -1 | 1) => {
    if (paused || ended) return;
    const next = Math.max(0, Math.min(2, playerLane + dir)) as 0 | 1 | 2;
    if (next !== playerLane) {
      playerLane = next;
      targetWheelAngle = dir * 0.55;
      soundService.playMeow(dir > 0 ? 1.25 : 1.12);
      hapticService.tap();
    }
  };

  const activateManualBoost = () => {
    if (paused || ended) return;
    if (turboTimer > 0) return;
    turboTimer = 2.0;
    miauExpr = 'turbo';
    miauMoodTimer = 2.0;
    soundService.playCoin();
    hapticService.play();
    notices.push({
      text: '⚡ TURBO!',
      color: '#fde047',
      x: width / 2,
      y: height * 0.48,
      life: 0.9,
    });
  };

  const addNotice = (text: string, color: string, x: number, y: number) => {
    notices.push({ text, color, x, y, life: 0.95 });
  };

  const spawnEntity = (cfg: EscapeStageConfig) => {
    const lane = Math.floor(Math.random() * 3) as 0 | 1 | 2;
    const roll = Math.random();
    let kind: RoadEntity['kind'] = 'coin';
    if (roll < cfg.hazardRate) {
      const hRoll = Math.random();
      kind = hRoll < 0.42 ? 'cone' : hRoll < 0.78 ? 'box' : 'barrier';
    } else if (roll > 0.91) {
      kind = 'turbo';
    } else {
      kind = 'coin';
    }
    entities.push({ id: nextId++, lane, z: 0.04, kind });
  };

  const finishGame = () => {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(rafId);
    const coinsEarned = Math.max(
      14,
      coinsCollected * 4 + Math.round(score / 18) + (stage - 1) * 15
    );
    const funBoost = Math.min(42, 16 + stage * 5);
    const xpEarned = Math.min(60, 14 + Math.round(score / 25) + stage * 6);
    const tier: MiniGameResult['performanceTier'] =
      stage >= 3 || score >= 450
        ? 'gold'
        : stage >= 2 || score >= 220
          ? 'silver'
          : 'bronze';
    onComplete({
      gameId: 'escape',
      gameName: 'Miau Escape Run',
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

  const showStageClearOverlay = () => {
    paused = true;
    soundService.playCoin();
    hapticService.achievement();
    ovEmojiEl.textContent = '🏁';
    ovTitleEl.textContent = `Fase ${stage} Concluída!`;
    ovDescEl.textContent = `Miau acelerou com estilo! Pontos: ${score} • Moedas coletadas: ${coinsCollected}`;
    ovActionsEl.innerHTML = `
      <button id="er-next-stage" type="button" class="w-full py-2.5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 text-white font-display font-bold text-sm shadow-lg active:scale-95 transition">
        Avançar para Fase ${stage + 1} ➡️
      </button>
      <button id="er-claim" type="button" class="w-full py-2 rounded-full bg-white/90 text-[#3b1f6e] font-bold text-xs shadow active:scale-95 transition">
        🪙 Resgatar Moedas e Sair
      </button>
    `;
    overlayEl.classList.remove('hidden');

    overlayEl.querySelector('#er-next-stage')?.addEventListener('click', () => {
      stage += 1;
      stageDist = 0;
      entities = [];
      turboTimer = 0;
      invulnTimer = 1.0;
      paused = false;
      overlayEl.classList.add('hidden');
      lastFrameMs = performance.now();
      updateHud();
    });
    overlayEl.querySelector('#er-claim')?.addEventListener('click', finishGame);
  };

  const showGameOverOverlay = () => {
    paused = true;
    hapticService.warning();
    ovEmojiEl.textContent = '😿';
    ovTitleEl.textContent = 'Fim da Corrida!';
    ovDescEl.textContent = `Chegou à Fase ${stage} • ${score} pontos em ${formatTimer(totalElapsedSec)}`;
    ovActionsEl.innerHTML = `
      <button id="er-claim-over" type="button" class="w-full py-2.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-display font-bold text-sm shadow-lg active:scale-95 transition">
        🪙 Resgatar Moedas
      </button>
    `;
    overlayEl.classList.remove('hidden');
    overlayEl.querySelector('#er-claim-over')?.addEventListener('click', finishGame);
  };

  const drawScene = () => {
    if (!ctx) return;
    const cfg = getEscapeStageConfig(stage);
    const horizonY = height * 0.37;
    const dashTop = height * 0.72;

    const shakeX = shakeTimer > 0 ? (Math.random() - 0.5) * 9 : 0;
    const shakeY = shakeTimer > 0 ? (Math.random() - 0.5) * 7 : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);

    // 1. Sky through windshield
    const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
    skyGrad.addColorStop(0, cfg.skyTop);
    skyGrad.addColorStop(1, cfg.skyBottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(-10, -10, width + 20, horizonY + 14);

    if (cfg.stars) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 24; i++) {
        const sx = ((i * 73 + roadScroll * 8) % (width - 10)) + 5;
        const sy = (i * 29) % Math.max(20, horizonY - 14);
        ctx.fillRect(sx, sy, i % 3 === 0 ? 2.5 : 1.5, i % 3 === 0 ? 2.5 : 1.5);
      }
    }

    // Sun/Moon
    ctx.fillStyle = cfg.sunColor;
    ctx.beginPath();
    ctx.arc(width * 0.76 - visualLaneX * 14, horizonY - 26, 20, 0, Math.PI * 2);
    ctx.fill();

    // Distant hills
    ctx.fillStyle = cfg.horizonColor;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.quadraticCurveTo(width * 0.25, horizonY - 22, width * 0.5, horizonY - 6);
    ctx.quadraticCurveTo(width * 0.78, horizonY - 24, width, horizonY - 2);
    ctx.lineTo(width, dashTop + 10);
    ctx.lineTo(0, dashTop + 10);
    ctx.closePath();
    ctx.fill();

    // 2. Ground & 3-Lane Perspective Road
    const roadTopW = width * 0.17;
    const roadBotW = width * 1.15;
    const vpX = width * 0.5 - visualLaneX * 26;

    ctx.fillStyle = cfg.roadColor;
    ctx.beginPath();
    ctx.moveTo(vpX - roadTopW / 2, horizonY);
    ctx.lineTo(vpX + roadTopW / 2, horizonY);
    ctx.lineTo(width * 0.5 + roadBotW / 2 - visualLaneX * 70, dashTop + 16);
    ctx.lineTo(width * 0.5 - roadBotW / 2 - visualLaneX * 70, dashTop + 16);
    ctx.closePath();
    ctx.fill();

    // Road shoulders / edge lines
    ctx.strokeStyle = cfg.shoulderColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(vpX - roadTopW / 2, horizonY);
    ctx.lineTo(width * 0.5 - roadBotW / 2 - visualLaneX * 70, dashTop + 16);
    ctx.moveTo(vpX + roadTopW / 2, horizonY);
    ctx.lineTo(width * 0.5 + roadBotW / 2 - visualLaneX * 70, dashTop + 16);
    ctx.stroke();

    // Scrolling dashed lane dividers (between lane 0|1 and 1|2)
    for (let s = 0; s < 7; s++) {
      const t0 = ((s / 7 + roadScroll) % 1);
      const t1 = Math.min(1, t0 + 0.065);
      const p0 = t0 * t0;
      const p1 = t1 * t1;
      const y0 = horizonY + p0 * (dashTop + 12 - horizonY);
      const y1 = horizonY + p1 * (dashTop + 12 - horizonY);
      const half0 = (roadTopW / 2) + p0 * (roadBotW / 2 - roadTopW / 2);
      const half1 = (roadTopW / 2) + p1 * (roadBotW / 2 - roadTopW / 2);
      const cx0 = vpX + p0 * (width * 0.5 - visualLaneX * 70 - vpX);
      const cx1 = vpX + p1 * (width * 0.5 - visualLaneX * 70 - vpX);

      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 1.5 + p0 * 3.5;
      for (const laneEdge of [-1 / 3, 1 / 3]) {
        ctx.beginPath();
        ctx.moveTo(cx0 + half0 * laneEdge, y0);
        ctx.lineTo(cx1 + half1 * laneEdge, y1);
        ctx.stroke();
      }
    }

    // 3. Draw oncoming road entities sorted back-to-front
    const sorted = [...entities].sort((a, b) => a.z - b.z);
    for (const ent of sorted) {
      if (ent.hit) continue;
      const p = ent.z * ent.z;
      const ey = horizonY + p * (dashTop - horizonY);
      const halfW = (roadTopW / 2) + p * (roadBotW / 2 - roadTopW / 2);
      const cx = vpX + p * (width * 0.5 - visualLaneX * 70 - vpX);
      const laneOffset = (ent.lane - 1) * (2 / 3) * halfW;
      const ex = cx + laneOffset;
      const scale = 0.22 + p * 1.15;

      ctx.save();
      ctx.translate(ex, ey);
      ctx.scale(scale, scale);

      if (ent.kind === 'cone') {
        // Traffic cone
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.moveTo(-14, 12);
        ctx.lineTo(14, 12);
        ctx.lineTo(4, -22);
        ctx.lineTo(-4, -22);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-8, -7, 16, 6);
        ctx.fillStyle = '#c2410c';
        ctx.fillRect(-17, 11, 34, 5);
      } else if (ent.kind === 'box') {
        // Wooden crate
        ctx.fillStyle = '#d97706';
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 3;
        ctx.fillRect(-18, -20, 36, 32);
        ctx.strokeRect(-18, -20, 36, 32);
        ctx.beginPath();
        ctx.moveTo(-18, -20);
        ctx.lineTo(18, 12);
        ctx.moveTo(18, -20);
        ctx.lineTo(-18, 12);
        ctx.stroke();
      } else if (ent.kind === 'barrier') {
        // Striped road barrier
        ctx.fillStyle = '#ef4444';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.fillRect(-24, -14, 48, 20);
        ctx.strokeRect(-24, -14, 48, 20);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-14, -14, 8, 20);
        ctx.fillRect(6, -14, 8, 20);
      } else if (ent.kind === 'coin') {
        // Spinning golden coin
        const pulse = 0.8 + 0.2 * Math.sin(totalElapsedSec * 9 + ent.id);
        ctx.scale(pulse, 1);
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#a16207';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, -6, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#854d0e';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', 0, -5);
      } else if (ent.kind === 'turbo') {
        // Turbo lightning orb
        ctx.fillStyle = '#38bdf8';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, -6, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚡', 0, -5);
      }
      ctx.restore();
    }

    // 4. Speed lines when turbo active
    if (turboTimer > 0) {
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 8; i++) {
        const lx = ((i * 59 + roadScroll * 120) % width);
        ctx.beginPath();
        ctx.moveTo(lx, 12);
        ctx.lineTo(lx + (lx < width / 2 ? -18 : 18), dashTop - 8);
        ctx.stroke();
      }
    }

    // 5. Windshield frame & Car Hood / Dashboard (1st-person cockpit)
    ctx.strokeStyle = 'rgba(30, 27, 75, 0.6)';
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, width, height);

    // Dashboard panel
    const dashGrad = ctx.createLinearGradient(0, dashTop, 0, height);
    dashGrad.addColorStop(0, '#4c2a85');
    dashGrad.addColorStop(1, '#261447');
    ctx.fillStyle = dashGrad;
    ctx.beginPath();
    ctx.moveTo(0, dashTop + 12);
    ctx.quadraticCurveTo(width * 0.5, dashTop - 16, width, dashTop + 12);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    // Dashboard highlight rim
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, dashTop + 12);
    ctx.quadraticCurveTo(width * 0.5, dashTop - 16, width, dashTop + 12);
    ctx.stroke();

    // Speedometer dial on right side of dash
    const speedoX = width * 0.8;
    const speedoY = dashTop + 38;
    ctx.fillStyle = '#1e1038';
    ctx.strokeStyle = '#c4b5fd';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(speedoX, speedoY, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = turboTimer > 0 ? '#fde047' : '#67e8f9';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const kmh = Math.round((cfg.baseSpeed * (turboTimer > 0 ? 1.75 : 1)) * 180);
    ctx.fillText(`${kmh}`, speedoX, speedoY - 2);
    ctx.fillStyle = '#ddd6fe';
    ctx.font = 'bold 7px sans-serif';
    ctx.fillText('KM/H', speedoX, speedoY + 9);

    // Steering Wheel (left/center cockpit)
    const wheelX = width * 0.5;
    const wheelY = height - 22;
    const wheelR = 38;
    ctx.save();
    ctx.translate(wheelX, wheelY);
    ctx.rotate(wheelAngle);
    ctx.strokeStyle = '#1f1638';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(0, 0, wheelR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#e879f9';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, wheelR, -Math.PI * 0.8, -Math.PI * 0.2);
    ctx.stroke();
    // Spokes
    ctx.strokeStyle = '#3b2863';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-wheelR + 4, 0);
    ctx.lineTo(wheelR - 4, 0);
    ctx.moveTo(0, 0);
    ctx.lineTo(0, wheelR - 4);
    ctx.stroke();
    // Center paw emblem on wheel
    ctx.fillStyle = '#7c3aed';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fbcfe8';
    ctx.beginPath();
    ctx.arc(0, 1, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 6. Cute Miau Driver sitting on dashboard/behind wheel reacting to steering & hits!
    const miauX = width * 0.26 + visualLaneX * 8;
    const miauY = dashTop + 14 + Math.sin(totalElapsedSec * 7) * 1.8;
    ctx.save();
    ctx.translate(miauX, miauY);
    ctx.rotate(wheelAngle * 0.25);
    // White head
    ctx.fillStyle = invulnTimer > 0 && Math.floor(invulnTimer * 12) % 2 === 0 ? '#fecaca' : '#ffffff';
    ctx.strokeStyle = '#3b1f6e';
    ctx.lineWidth = 2.6;
    // Left ear
    ctx.beginPath();
    ctx.moveTo(-20, -8);
    ctx.lineTo(-22, -26);
    ctx.lineTo(-6, -18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Right ear (orange calico patch)
    ctx.fillStyle = '#f59e42';
    ctx.beginPath();
    ctx.moveTo(20, -8);
    ctx.lineTo(22, -26);
    ctx.lineTo(6, -18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Head base
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, 0, 24, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Orange forehead patch
    ctx.fillStyle = '#f59e42';
    ctx.beginPath();
    ctx.ellipse(12, -8, 10, 8, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#2d1b4e';
    if (miauExpr === 'oops') {
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('>', -9, 1);
      ctx.fillText('<', 9, 1);
    } else if (miauExpr === 'turbo') {
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★', -9, 1);
      ctx.fillText('★', 9, 1);
    } else {
      ctx.beginPath();
      ctx.arc(-9, -2, 3.2, 0, Math.PI * 2);
      ctx.arc(9, -2, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-10, -3.2, 1.1, 0, Math.PI * 2);
      ctx.arc(8, -3.2, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    // Nose & smile
    ctx.fillStyle = '#fb7185';
    ctx.beginPath();
    ctx.arc(0, 4, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Cute paws gripping dash edge
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#3b1f6e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(-14, 18, 6.5, 5, 0, 0, Math.PI * 2);
    ctx.ellipse(14, 18, 6.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 7. Floating notices
    for (const n of notices) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, n.life * 1.4);
      ctx.fillStyle = n.color;
      ctx.font = 'bold 14px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(n.text, n.x, n.y);
      ctx.restore();
    }

    ctx.restore();
  };

  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - lastFrameMs) / 1000);
    lastFrameMs = now;

    if (!paused && !ended) {
      const cfg = getEscapeStageConfig(stage);
      totalElapsedSec += dt;
      if (turboTimer > 0) turboTimer = Math.max(0, turboTimer - dt);
      if (invulnTimer > 0) invulnTimer = Math.max(0, invulnTimer - dt);
      if (shakeTimer > 0) shakeTimer = Math.max(0, shakeTimer - dt);
      if (miauMoodTimer > 0) {
        miauMoodTimer = Math.max(0, miauMoodTimer - dt);
        if (miauMoodTimer <= 0) miauExpr = 'happy';
      }

      const speedMult = turboTimer > 0 ? 1.65 : 1;
      const speed = cfg.baseSpeed * speedMult;
      roadScroll = (roadScroll + dt * speed * 2.4) % 1;
      stageDist += dt * speed * 62;
      score += Math.round(dt * 12 * speedMult);

      const targetX = playerLane - 1;
      visualLaneX += (targetX - visualLaneX) * Math.min(1, dt * 12);
      wheelAngle += (targetWheelAngle - wheelAngle) * Math.min(1, dt * 10);
      targetWheelAngle *= Math.pow(0.08, dt);

      spawnAccum += dt * (turboTimer > 0 ? 1.35 : 1);
      if (spawnAccum >= cfg.spawnInterval) {
        spawnAccum = 0;
        spawnEntity(cfg);
      }

      for (const ent of entities) {
        ent.z += dt * speed * 0.92;
        if (!ent.hit && ent.z >= 0.86 && ent.z <= 1.03 && ent.lane === playerLane) {
          ent.hit = true;
          const hitX = width * 0.5 + (ent.lane - 1) * 70;
          const hitY = height * 0.62;
          if (ent.kind === 'coin') {
            coinsCollected += 1;
            score += 20;
            soundService.playCoin();
            hapticService.coin();
            addNotice('+20 🪙', '#fde047', hitX, hitY);
          } else if (ent.kind === 'turbo') {
            turboTimer = 2.6;
            score += 35;
            miauExpr = 'turbo';
            miauMoodTimer = 2.6;
            soundService.playCoin();
            hapticService.play();
            addNotice('⚡ TURBO!', '#38bdf8', hitX, hitY);
          } else if (invulnTimer <= 0 && turboTimer <= 0) {
            lives -= 1;
            invulnTimer = 1.25;
            shakeTimer = 0.35;
            miauExpr = 'oops';
            miauMoodTimer = 1.0;
            soundService.playMeow(0.75);
            hapticService.warning();
            addNotice('Ai! -1 ❤️', '#fb7185', hitX, hitY);
            if (lives <= 0) {
              updateHud();
              drawScene();
              showGameOverOverlay();
              return;
            }
          } else if (turboTimer > 0) {
            score += 15;
            addNotice('💥 ESMAGOU!', '#fde047', hitX, hitY);
          }
        }
      }

      entities = entities.filter((e) => !e.hit && e.z < 1.08);
      for (const n of notices) {
        n.y -= dt * 38;
        n.life -= dt;
      }
      notices = notices.filter((n) => n.life > 0);

      updateHud();

      if (stageDist >= cfg.goalDist) {
        stageDist = cfg.goalDist;
        score += 80 * stage;
        updateHud();
        drawScene();
        showStageClearOverlay();
        rafId = requestAnimationFrame(loop);
        return;
      }
    }

    drawScene();
    rafId = requestAnimationFrame(loop);
  };

  // Touch swipe & tap on canvas
  let pointerStartX: number | null = null;
  const onPointerDown = (e: PointerEvent) => {
    pointerStartX = e.clientX;
  };
  const onPointerUp = (e: PointerEvent) => {
    if (pointerStartX === null) return;
    const dx = e.clientX - pointerStartX;
    pointerStartX = null;
    if (Math.abs(dx) > 22) {
      steer(dx > 0 ? 1 : -1);
    } else {
      const rect = canvas.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      steer(relX < rect.width / 2 ? -1 : 1);
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      steer(-1);
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      steer(1);
    } else if (e.key === ' ' || e.key === 'ArrowUp') {
      e.preventDefault();
      activateManualBoost();
    }
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', resizeCanvas);

  container.querySelector('#er-btn-left')?.addEventListener('click', () => steer(-1));
  container.querySelector('#er-btn-right')?.addEventListener('click', () => steer(1));
  container.querySelector('#er-btn-turbo')?.addEventListener('click', activateManualBoost);
  container.querySelector('#er-close')?.addEventListener('click', () => {
    ended = true;
    cancelAnimationFrame(rafId);
    onClose();
  });

  updateHud();
  rafId = requestAnimationFrame(loop);

  return () => {
    ended = true;
    cancelAnimationFrame(rafId);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('resize', resizeCanvas);
  };
}
