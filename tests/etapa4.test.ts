import assert from 'node:assert/strict';
import test, { beforeEach, describe } from 'node:test';

const memoryStorage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    get length() {
      return memoryStorage.size;
    },
    clear() {
      memoryStorage.clear();
    },
    getItem(key: string) {
      return memoryStorage.has(key) ? memoryStorage.get(key)! : null;
    },
    key(index: number) {
      return Array.from(memoryStorage.keys())[index] ?? null;
    },
    removeItem(key: string) {
      memoryStorage.delete(key);
    },
    setItem(key: string, value: string) {
      memoryStorage.set(key, String(value));
    },
  } satisfies Storage,
  configurable: true,
});

import {
  SEED_RANKING_ENTRIES,
  SHOP_CONSUMABLES,
  SHOP_ITEMS,
  createDefaultProfile,
} from '../src/constants';
import {
  getPreviousDateKey,
  isMathEducationTrack,
  loadDailyMissionsSnapshot,
  recordDailyMissionEvent,
} from '../src/services/dailyMissionsService';
import {
  TurnBufferQueue,
  clampFloatingDpadPosition,
  detectSwipeDirection,
} from '../src/ui/games/mazeControls';
import {
  filterAndSortRankingEntries,
  renderCustomizeModalHtml,
  renderRankingModalHtml,
  renderRoutineModalHtml,
} from '../src/ui/modals/CareAndGamesModals';
import { renderMenuModalHtml } from '../src/ui/modals/MenuModal';
import { createEmptyHumanProfile } from '../src/services/userProfileService';

beforeEach(() => {
  memoryStorage.clear();
});

describe('Etapa 4.1 - Controles Mobile de Labirinto (Buffer de Curva, Swipe e D-pad Flutuante)', () => {
  test('TurnBufferQueue executa curva de 90° somente ao alinhar e abre reversão 180° imediata', () => {
    const queue = new TurnBufferQueue('right', 1200);
    queue.enqueue('up', 100);
    assert.equal(queue.getBufferedDirection(150), 'up');

    // Ainda fora da esquina: não vira
    const notAligned = queue.resolveTurn(() => true, false, 200);
    assert.deepEqual(notAligned, { dir: 'right', turned: false });
    assert.equal(queue.getBufferedDirection(200), 'up');

    // Caminho acima bloqueado mesmo alinhado: mantém no buffer
    const blockedCorner = queue.resolveTurn((d) => d !== 'up', true, 250);
    assert.deepEqual(blockedCorner, { dir: 'right', turned: false });
    assert.equal(queue.getBufferedDirection(250), 'up');

    // Esquina abriu e alinhou: executa a curva automaticamente e limpa o buffer
    const openCorner = queue.resolveTurn(() => true, true, 300);
    assert.deepEqual(openCorner, { dir: 'up', turned: true });
    assert.equal(queue.getBufferedDirection(300), null);

    // Reversão 180° funciona mesmo sem estar alinhado à esquina
    queue.enqueue('down', 400);
    const reverseRes = queue.resolveTurn(() => true, false, 450);
    assert.deepEqual(reverseRes, { dir: 'down', turned: true });
  });

  test('TurnBufferQueue expira intenção antiga após TTL', () => {
    const queue = new TurnBufferQueue('left', 500);
    queue.enqueue('up', 1000);
    assert.equal(queue.getBufferedDirection(1400), 'up');
    assert.equal(queue.getBufferedDirection(1600), null);
  });

  test('detectSwipeDirection identifica direções dominantes acima do limiar', () => {
    assert.equal(detectSwipeDirection(4, 5, 16), null);
    assert.equal(detectSwipeDirection(24, 6, 16), 'right');
    assert.equal(detectSwipeDirection(-30, 8, 16), 'left');
    assert.equal(detectSwipeDirection(4, -22, 16), 'up');
    assert.equal(detectSwipeDirection(5, 28, 16), 'down');
  });

  test('clampFloatingDpadPosition restringe D-pad aos limites da área do jogo', () => {
    const clampedMin = clampFloatingDpadPosition(
      { left: -40, top: -10 },
      { width: 320, height: 420 },
      { width: 112, height: 112 },
      8
    );
    assert.deepEqual(clampedMin, { left: 8, top: 8 });

    const clampedMax = clampFloatingDpadPosition(
      { left: 500, top: 600 },
      { width: 320, height: 420 },
      { width: 112, height: 112 },
      8
    );
    assert.deepEqual(clampedMax, { left: 200, top: 300 });
  });
});

describe('Etapa 4.2 - Loja 2.0 (Comidas Consumíveis e Pré-visualização Experimentar)', () => {
  test('SHOP_CONSUMABLES possui comidas variadas com custos e efeitos válidos', () => {
    assert.ok(SHOP_CONSUMABLES.length >= 4);
    const ids = new Set(SHOP_CONSUMABLES.map((c) => c.id));
    assert.equal(ids.size, SHOP_CONSUMABLES.length);
    for (const item of SHOP_CONSUMABLES) {
      assert.ok(item.price > 0);
      assert.ok(item.hungerBoost > 0);
      assert.ok(item.happinessBoost > 0);
      assert.ok(item.xpReward > 0);
      assert.ok(item.name.length > 2);
    }
  });

  test('renderCustomizeModalHtml exibe aba Comidas e botão Experimentar para itens não possuídos', () => {
    const profile = createDefaultProfile('tester');
    const hatTabHtml = renderCustomizeModalHtml(profile, 'hat', {
      previewEquipped: { hat: 'hat_crown' },
      mood: 'happy',
    });
    assert.match(hatTabHtml, /Experimentando/);
    assert.match(hatTabHtml, /data-shop-try-stop/);
    assert.match(hatTabHtml, /data-shop-try="/);
    assert.match(hatTabHtml, /🍽️ Comidas/);

    const unownedAccessory = SHOP_ITEMS.find(
      (i) => i.category === 'accessory' && !profile.ownedItems.includes(i.id)
    );
    assert.ok(unownedAccessory);

    const foodTabHtml = renderCustomizeModalHtml(profile, 'consumable');
    assert.match(foodTabHtml, /Salmão Assado/);
    assert.match(foodTabHtml, /Leite com Mel/);
    assert.match(foodTabHtml, /data-shop-consumable="cons_salmao_assado"/);
  });
});

describe('Etapa 4.3 - Missões Diárias, Sequência de Dias e Ranking Segmentado', () => {
  test('recordDailyMissionEvent conclui as 3 missões diárias, evita duplicidade e concede bônus 3/3', () => {
    const day1 = new Date('2026-11-28T10:00:00');
    const initial = loadDailyMissionsSnapshot('kid_1', day1);
    assert.equal(initial.missions.length, 3);
    assert.equal(initial.currentStreak, 0);

    // 1) Trilha de leitura NÃO conclui missão de matemática
    const nonMath = recordDailyMissionEvent(
      'kid_1',
      { type: 'math_lesson', trackId: 'fund1_leitura' },
      day1
    );
    assert.equal(nonMath.coinsAwarded, 0);
    assert.equal(isMathEducationTrack('fund1_matematica'), true);
    assert.equal(isMathEducationTrack('fund1_leitura'), false);

    // 2) Lição de matemática conclui missão 1 (+35 moedas) e inicia sequência = 1
    const mathRes = recordDailyMissionEvent(
      'kid_1',
      { type: 'math_lesson', trackId: 'fund1_matematica' },
      day1
    );
    assert.equal(mathRes.newlyCompleted.length, 1);
    assert.equal(mathRes.coinsAwarded, 35);
    assert.equal(mathRes.snapshot.currentStreak, 1);

    // Repetir matemática no mesmo dia é idempotente
    const mathAgain = recordDailyMissionEvent(
      'kid_1',
      { type: 'math_lesson', trackId: 'fund1_matematica' },
      day1
    );
    assert.equal(mathAgain.coinsAwarded, 0);

    // 3) Banho no bichinho conclui missão 2 (+25 moedas)
    const bathRes = recordDailyMissionEvent('kid_1', { type: 'bath' }, day1);
    assert.equal(bathRes.newlyCompleted.length, 1);
    assert.equal(bathRes.coinsAwarded, 25);

    // 4) Pontuação parcial no Pac-Miau (< 500) progride mas não conclui
    const pacLow = recordDailyMissionEvent(
      'kid_1',
      { type: 'pacmiau_score', score: 320 },
      day1
    );
    assert.equal(pacLow.coinsAwarded, 0);
    const pacMission = pacLow.snapshot.missions.find(
      (m) => m.id === 'daily_pacmiau_500'
    );
    assert.equal(pacMission?.progress, 320);
    assert.equal(pacMission?.completed, false);

    // 5) Pac-Miau >= 500 conclui missão 3 (+40 moedas) + bônus 3/3 (+30 moedas) = 70
    const pacWin = recordDailyMissionEvent(
      'kid_1',
      { type: 'pacmiau_score', score: 650 },
      day1
    );
    assert.equal(pacWin.newlyCompleted.length, 1);
    assert.equal(pacWin.allCompletedBonusCoins, 30);
    assert.equal(pacWin.coinsAwarded, 70);
    assert.equal(pacWin.snapshot.allCompletedBonusClaimed, true);
  });

  test('Sequência de dias (Streak) avança em dias consecutivos e reseta se pular dia', () => {
    assert.equal(getPreviousDateKey('2026-11-28'), '2026-11-27');
    assert.equal(getPreviousDateKey('2026-03-01'), '2026-02-28');

    const day1 = new Date('2026-11-26T12:00:00');
    const day2 = new Date('2026-11-27T12:00:00');
    const day4 = new Date('2026-11-29T12:00:00');

    const r1 = recordDailyMissionEvent('kid_streak', { type: 'bath' }, day1);
    assert.equal(r1.snapshot.currentStreak, 1);
    assert.equal(r1.streakBonusCoins, 0);

    const r2 = recordDailyMissionEvent('kid_streak', { type: 'bath' }, day2);
    assert.equal(r2.snapshot.currentStreak, 2);
    assert.equal(r2.streakAdvanced, true);
    assert.equal(r2.streakBonusCoins, 10);
    assert.equal(r2.coinsAwarded, 25 + 10);

    // Pulou o dia 28: ao carregar no dia 29, streak atual zera mas bestStreak fica preservado
    const snapDay4 = loadDailyMissionsSnapshot('kid_streak', day4);
    assert.equal(snapDay4.currentStreak, 0);
    assert.equal(snapDay4.bestStreak, 2);

    const r4 = recordDailyMissionEvent('kid_streak', { type: 'bath' }, day4);
    assert.equal(r4.snapshot.currentStreak, 1);
    assert.equal(r4.snapshot.bestStreak, 2);
  });

  test('filterAndSortRankingEntries segmenta corretamente por Jogo e Escolaridade', () => {
    const fund1All = filterAndSortRankingEntries({
      entries: SEED_RANKING_ENTRIES,
      gameTab: 'all',
      schoolingFilter: 'fundamental_1',
    });
    assert.ok(fund1All.length >= 1);
    assert.ok(
      fund1All.every((row) => row.entry.schooling === 'fundamental_1')
    );

    const infantilPac = filterAndSortRankingEntries({
      entries: SEED_RANKING_ENTRIES,
      gameTab: 'pacmiau',
      schoolingFilter: 'educacao_infantil',
    });
    assert.ok(infantilPac.length >= 1);
    assert.ok(
      infantilPac.every(
        (row) => row.entry.schooling === 'educacao_infantil' && row.score > 0
      )
    );
  });

  test('Modais de Rotina, Menu e Ranking renderizam Missões Diárias, Streak e filtros de Escolaridade', () => {
    const profile = createDefaultProfile('ui_test');
    const snap = loadDailyMissionsSnapshot('ui_test', new Date('2026-11-28T10:00:00'));

    const routineHtml = renderRoutineModalHtml(
      profile,
      false,
      () => false,
      undefined,
      undefined,
      snap
    );
    assert.match(routineHtml, /Missões Diárias/);
    assert.match(routineHtml, /Complete 1 lição de matemática/);
    assert.match(routineHtml, /Dê banho no bichinho/);
    assert.match(routineHtml, /Faça 500 pontos no Pac-Miau/);

    const menuHtml = renderMenuModalHtml({
      accountLabel: 'Teste',
      isFirebaseAccount: false,
      humanProfile: createEmptyHumanProfile('ui_test'),
      unlockedCount: 0,
      routineDoneCount: 0,
      dailyMissions: { completedCount: 1, totalCount: 3, currentStreak: 2 },
      visibleHudCount: 4,
    });
    assert.match(menuHtml, /1\/3 missões • 🔥 2d/);

    const rankingHtml = renderRankingModalHtml({
      currentEntry: {
        id: 'ui_test',
        playerName: 'Teste',
        petName: 'Miau',
        schooling: 'fundamental_1',
        totalScore: 500,
        bestStage: 2,
        coinsEarned: 40,
        isCurrentUser: true,
        updatedAtMs: Date.now(),
      },
      leaderboard: SEED_RANKING_ENTRIES,
      rankingLoading: false,
      activeTab: 'pacmiau',
      schoolingFilter: 'fundamental_1',
      gameRecords: profile.gameRecords!,
      matchHistory: [],
    });
    assert.match(rankingHtml, /data-ranking-schooling="fundamental_1"/);
    assert.match(rankingHtml, /Todas Escolaridades/);
  });
});
