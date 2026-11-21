import {
  ACHIEVEMENTS,
  DEFAULT_OWNED_ITEMS,
  FOOD_ITEMS,
  ROUTINE_SCHEDULE,
  SHOP_ITEMS,
} from '../../constants';
import type {
  AchievementDef,
  RankingEntry,
  RoutineCategory,
  RoutineSlotDef,
  UserPetProfile,
} from '../../types';
import { escapeHtml } from '../../utils/html';

export function renderFeedModalHtml(): string {
  return `
    <div class="flex items-center justify-between mb-3">
      <div>
        <h2 class="font-display text-xl font-bold text-[#3b1f6e]">Alimentar o Miau 🐟</h2>
        <p class="text-[11px] font-semibold text-[#6b4d9e]">Escolha um petisco delicioso para ganhar +Fome e +XP</p>
      </div>
      <button id="modal-close" class="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold shrink-0">✕</button>
    </div>
    <div class="grid grid-cols-2 gap-2.5 max-h-[340px] overflow-y-auto miau-scroll pr-1">
      ${FOOD_ITEMS.map(
        (item) => `
          <button data-food="${item.id}" class="bg-white/90 hover:bg-white rounded-2xl p-3 border border-purple-100 shadow-sm text-left flex flex-col gap-1 active:scale-95 transition">
            <div class="flex items-center justify-between">
              <span class="text-3xl">${item.emoji}</span>
              <span class="text-xs font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">🪙 ${item.cost}</span>
            </div>
            <div class="font-display text-sm font-bold text-[#3b1f6e] leading-tight">${escapeHtml(item.name)}</div>
            <div class="text-[11px] text-[#6b4d9e] leading-tight">+${item.hungerBoost}% Fome • +${item.xpReward} XP</div>
            ${
              item.happinessBoost
                ? `<span class="inline-block self-start text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 mt-0.5">+${item.happinessBoost}% Feliz 💖</span>`
                : ''
            }
          </button>
        `
      ).join('')}
    </div>
  `;
}

export function renderCleanModalHtml(): string {
  return `
    <div class="flex items-center justify-between mb-3">
      <h2 class="font-display text-xl font-bold text-[#3b1f6e]">Banho & Limpeza 🧼</h2>
      <button id="modal-close" class="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold">✕</button>
    </div>
    <p class="text-xs font-semibold text-[#5e4294] mb-4">Deixe o pelo branquinho do Miau brilhando! Você pode dar um banho rápido ou ativar o modo espuma para esfregar na Sala de Estar.</p>
    <div class="flex flex-col gap-2.5">
      <button id="btn-instant-bath" class="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-sky-500 text-white font-display font-bold shadow-md hover:brightness-105">
        🚿 Banho de Espuma Completo (+35% Higiene)
      </button>
      <button id="btn-sponge-mode" class="w-full py-2.5 rounded-2xl bg-white border border-sky-200 text-sky-800 font-bold text-sm hover:bg-sky-50">
        🫧 Esfregar Miau na Sala de Estar
      </button>
    </div>
  `;
}

export function renderGamesHubModalHtml(
  profile: UserPetProfile,
  activeMiniGame: 'none' | 'fish' | 'memory' | 'escape' | 'galaxy'
): string {
  if (activeMiniGame !== 'none') {
    return `<div id="minigame-host" class="min-h-[340px]"></div>`;
  }
  const recs = profile.gameRecords!;
  return `
    <div class="flex items-center justify-between mb-3 gap-2">
      <h2 class="font-display text-xl font-bold text-[#3b1f6e]">Minijogos do Miau 🎮</h2>
      <div class="flex items-center gap-1.5">
        <button id="btn-open-ranking" type="button" class="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-extrabold text-xs shadow-sm hover:bg-amber-200 transition">🏆 Ranking</button>
        <button id="modal-close" class="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold">✕</button>
      </div>
    </div>
    <div class="flex flex-col gap-2.5 max-h-[350px] overflow-y-auto miau-scroll pr-1">
      <button id="start-fish-game" class="bg-white/90 hover:bg-white rounded-2xl p-3 border border-emerald-100 shadow-sm flex items-center gap-3 text-left active:scale-95 transition">
        <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-300 to-emerald-400 flex items-center justify-center text-2xl shadow shrink-0">🐟</div>
        <div class="flex-1 min-w-0">
          <div class="font-display font-bold text-[#3b1f6e] leading-tight">Caça aos Peixinhos</div>
          <div class="text-[11px] text-[#6b4d9e]">Pegue peixes em fases progressivas 1–4+!</div>
          <div class="text-[10px] font-extrabold text-emerald-700 mt-0.5">Recorde: ${recs.fish.highScore} pts • Fase ${recs.fish.maxStage}</div>
        </div>
        <span class="text-xs font-extrabold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full shrink-0">Jogar</span>
      </button>

      <button id="start-memory-game" class="bg-white/90 hover:bg-white rounded-2xl p-3 border border-purple-100 shadow-sm flex items-center gap-3 text-left active:scale-95 transition">
        <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-300 to-purple-500 flex items-center justify-center text-2xl shadow shrink-0">🐾</div>
        <div class="flex-1 min-w-0">
          <div class="font-display font-bold text-[#3b1f6e] leading-tight">Memória dos Miados</div>
          <div class="text-[11px] text-[#6b4d9e]">Repita sequências musicais de miados!</div>
          <div class="text-[10px] font-extrabold text-purple-700 mt-0.5">Recorde: ${recs.memory.highScore} pts • Fase ${recs.memory.maxStage}</div>
        </div>
        <span class="text-xs font-extrabold text-purple-700 bg-purple-100 px-2.5 py-1 rounded-full shrink-0">Jogar</span>
      </button>

      <button id="start-escape-game" class="bg-white/90 hover:bg-white rounded-2xl p-3 border border-amber-100 shadow-sm flex items-center gap-3 text-left active:scale-95 transition">
        <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-300 to-orange-500 flex items-center justify-center text-2xl shadow shrink-0">🚗</div>
        <div class="flex-1 min-w-0">
          <div class="font-display font-bold text-[#3b1f6e] leading-tight">Miau Escape Run</div>
          <div class="text-[11px] text-[#6b4d9e]">Dirija em 1ª pessoa desviando na pista!</div>
          <div class="text-[10px] font-extrabold text-amber-700 mt-0.5">Recorde: ${recs.escape.highScore} pts • Fase ${recs.escape.maxStage}</div>
        </div>
        <span class="text-xs font-extrabold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full shrink-0">Jogar</span>
      </button>

      <button id="start-galaxy-game" class="bg-white/90 hover:bg-white rounded-2xl p-3 border border-indigo-100 shadow-sm flex items-center gap-3 text-left active:scale-95 transition">
        <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-400 to-violet-700 flex items-center justify-center text-2xl shadow shrink-0">🚀</div>
        <div class="flex-1 min-w-0">
          <div class="font-display font-bold text-[#3b1f6e] leading-tight">Miau Galáxia vs. Ratos ETs</div>
          <div class="text-[11px] text-[#6b4d9e]">Nave espacial contra invasores e chefões!</div>
          <div class="text-[10px] font-extrabold text-indigo-700 mt-0.5">Recorde: ${recs.galaxy.highScore} pts • Fase ${recs.galaxy.maxStage}</div>
        </div>
        <span class="text-xs font-extrabold text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded-full shrink-0">Jogar</span>
      </button>
    </div>
  `;
}

export function renderCustomizeModalHtml(
  profile: UserPetProfile,
  shopTab: 'hat' | 'accessory' | 'background'
): string {
  const filtered = SHOP_ITEMS.filter((i) => i.category === shopTab);
  return `
    <div class="flex items-center justify-between mb-3">
      <h2 class="font-display text-xl font-bold text-[#3b1f6e]">Personalizar Miau 👗</h2>
      <button id="modal-close" class="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold">✕</button>
    </div>
    <div class="flex gap-2 mb-3">
      ${(['hat', 'accessory', 'background'] as const)
        .map((tab) => {
          const label =
            tab === 'hat'
              ? '🎩 Chapéus'
              : tab === 'accessory'
                ? '🎀 Acessórios'
                : '🖼️ Fundos';
          const active = shopTab === tab;
          return `<button data-shoptab="${tab}" class="flex-1 py-1.5 rounded-full text-xs font-extrabold transition ${active ? 'bg-[#6e45a5] text-white shadow' : 'bg-white/75 text-[#5e4294]'}">${label}</button>`;
        })
        .join('')}
    </div>
    <div class="grid grid-cols-2 gap-2.5 max-h-[250px] overflow-y-auto miau-scroll pr-1">
      ${filtered
        .map((item) => {
          const owned = profile.ownedItems.includes(item.id);
          const equipped =
            (item.category === 'hat' && profile.equipped.hat === item.id) ||
            (item.category === 'accessory' &&
              profile.equipped.accessory === item.id) ||
            (item.category === 'background' &&
              profile.equipped.background === item.id);
          return `
            <button data-shopitem="${item.id}" class="bg-white/90 rounded-2xl p-3 border-2 ${equipped ? 'border-[#6e45a5]' : 'border-white'} shadow-sm flex flex-col gap-1.5 text-left hover:bg-white transition">
              <div class="flex items-center justify-between">
                <span class="w-9 h-9 rounded-xl flex items-center justify-center text-xl" style="background:${item.previewColor}">${item.emoji}</span>
                ${
                  equipped
                    ? '<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-600 text-white">Equipado</span>'
                    : owned
                      ? '<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Seu</span>'
                      : `<span class="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">🪙 ${item.price}</span>`
                }
              </div>
              <div class="font-display text-xs font-bold text-[#3b1f6e]">${escapeHtml(item.name)}</div>
            </button>
          `;
        })
        .join('')}
    </div>
  `;
}

function getAchProgressValue(
  profile: UserPetProfile,
  key: AchievementDef['progressKey']
): number {
  if (key === 'shopBought') {
    return profile.ownedItems.some((id) => !DEFAULT_OWNED_ITEMS.includes(id))
      ? 1
      : 0;
  }
  return profile.progress[key] ?? 0;
}

export function renderAchievementsModalHtml(profile: UserPetProfile): string {
  const unlockedList = profile.unlockedAchievements || [];
  const totalEarned = ACHIEVEMENTS.filter((a) =>
    unlockedList.includes(a.id)
  ).reduce((sum, a) => sum + a.coinReward, 0);
  return `
    <div class="flex items-center justify-between mb-2">
      <div>
        <h2 class="font-display text-xl font-bold text-[#3b1f6e]">Conquistas 🏆</h2>
        <p class="text-[11px] font-semibold text-[#6b4d9e]">${unlockedList.length} de ${ACHIEVEMENTS.length} desbloqueadas • 🪙 ${totalEarned} bônus ganhos</p>
      </div>
      <button id="modal-close" class="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold">✕</button>
    </div>
    <div class="flex flex-col gap-2.5 max-h-[340px] overflow-y-auto miau-scroll pr-1">
      ${ACHIEVEMENTS.map((ach) => {
        const isUnlocked = unlockedList.includes(ach.id);
        const current = Math.min(
          ach.target,
          getAchProgressValue(profile, ach.progressKey)
        );
        const pct = Math.round((current / ach.target) * 100);
        return `
          <div class="rounded-2xl p-3 border ${isUnlocked ? 'bg-gradient-to-r from-amber-50/95 to-purple-50/95 border-amber-300 shadow-sm' : 'bg-white/75 border-purple-100'} flex items-center gap-3">
            <div class="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${isUnlocked ? 'bg-amber-200/80 shadow-inner' : 'bg-purple-100/80 grayscale opacity-75'}">
              ${ach.emoji}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-2">
                <span class="font-display text-sm font-bold text-[#3b1f6e] truncate">${escapeHtml(ach.title)}</span>
                ${
                  isUnlocked
                    ? `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0">✓ +🪙 ${ach.coinReward}</span>`
                    : `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 shrink-0">🪙 +${ach.coinReward}</span>`
                }
              </div>
              <p class="text-[11px] text-[#5e4294] leading-tight mt-0.5">${escapeHtml(ach.description)}</p>
              <div class="mt-1.5 flex items-center gap-2">
                <div class="flex-1 h-1.5 bg-purple-100 rounded-full overflow-hidden">
                  <div class="h-full rounded-full ${isUnlocked ? 'bg-emerald-400' : 'bg-purple-400'} transition-all" style="width: ${pct}%"></div>
                </div>
                <span class="text-[10px] font-extrabold text-[#6b4d9e]">${current}/${ach.target}</span>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

export function renderRankingModalHtml(
  currentEntry: RankingEntry,
  leaderboard: RankingEntry[],
  rankingLoading: boolean
): string {
  return `
    <div class="flex items-center justify-between mb-2">
      <div>
        <h2 class="font-display text-xl font-bold text-[#3b1f6e]">Ranking Global 🏆</h2>
        <p class="text-[11px] font-semibold text-[#6b4d9e]">Sua pontuação combinada: ${currentEntry.totalScore} pts • Fase ${currentEntry.bestStage}</p>
      </div>
      <div class="flex items-center gap-1.5">
        <button id="btn-ranking-back" type="button" class="px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 font-bold text-xs">← Jogos</button>
        <button id="modal-close" class="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold">✕</button>
      </div>
    </div>
    ${
      rankingLoading
        ? `<div class="py-8 text-center text-xs font-bold text-[#6b4d9e]">Carregando ranking...</div>`
        : `<div class="flex flex-col gap-2 max-h-[340px] overflow-y-auto miau-scroll pr-1">
            ${leaderboard
              .map((entry, idx) => {
                const rank = idx + 1;
                const medal =
                  rank === 1
                    ? '🥇'
                    : rank === 2
                      ? '🥈'
                      : rank === 3
                        ? '🥉'
                        : `#${rank}`;
                return `
                  <div class="rounded-2xl p-2.5 border flex items-center gap-2.5 ${entry.isCurrentUser ? 'bg-gradient-to-r from-amber-50 to-purple-50 border-purple-400 shadow-sm' : 'bg-white/85 border-purple-100'}">
                    <div class="w-8 h-8 rounded-xl ${rank <= 3 ? 'bg-amber-100 text-base' : 'bg-purple-100 text-xs'} font-extrabold text-[#4c2a85] flex items-center justify-center shrink-0">${medal}</div>
                    <div class="flex-1 min-w-0">
                      <div class="font-display text-sm font-bold text-[#3b1f6e] truncate">${escapeHtml(entry.playerName)} ${entry.isCurrentUser ? '(Você)' : ''}</div>
                      <div class="text-[10px] font-semibold text-[#6b4d9e]">Pet: ${escapeHtml(entry.petName)} • Fase Máx ${entry.bestStage}</div>
                    </div>
                    <div class="text-right shrink-0">
                      <div class="text-xs font-extrabold text-[#3b1f6e]">${entry.totalScore} pts</div>
                      <div class="text-[10px] font-bold text-amber-700">🪙 ${entry.coinsEarned}</div>
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>`
    }
  `;
}

export function renderRoutineModalHtml(
  profile: UserPetProfile,
  isSleeping: boolean,
  isSlotInWindow: (slot: RoutineSlotDef, now: Date) => boolean
): string {
  const completed = profile.dailyRoutine?.completedSlots || [];
  const now = new Date();
  const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const groups: Array<{
    cat: RoutineCategory;
    title: string;
    actionId: string;
    actionLabel: string;
  }> = [
    {
      cat: 'food',
      title: '🍽️ Horários de Alimentação',
      actionId: 'btn-routine-feed',
      actionLabel: 'Alimentar Agora',
    },
    {
      cat: 'bath',
      title: '🛁 Horários de Banho',
      actionId: 'btn-routine-bath',
      actionLabel: 'Dar Banho Agora',
    },
    {
      cat: 'sleep',
      title: '🌙 Horários de Soneca',
      actionId: 'btn-routine-sleep',
      actionLabel: isSleeping ? 'Dormindo...' : 'Iniciar Soneca',
    },
  ];
  return `
    <div class="flex items-center justify-between mb-2">
      <div>
        <h2 class="font-display text-xl font-bold text-[#3b1f6e]">Rotina Diária 📅</h2>
        <p class="text-[11px] font-semibold text-[#6b4d9e]">Cuide do Miau nos horários (${nowTimeStr}) para ganhar moedas extras!</p>
      </div>
      <button id="modal-close" class="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold shrink-0">✕</button>
    </div>
    <div class="flex flex-col gap-3 max-h-[350px] overflow-y-auto miau-scroll pr-1">
      ${groups
        .map((g) => {
          const slots = ROUTINE_SCHEDULE.filter((s) => s.category === g.cat);
          return `
            <div class="bg-white/85 rounded-2xl p-2.5 border border-purple-100 flex flex-col gap-2">
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-extrabold text-[#4c2a85]">${g.title}</span>
                <button id="${g.actionId}" type="button" class="px-2.5 py-1 rounded-full bg-[#6e45a5] text-white text-[10px] font-extrabold shadow-sm hover:brightness-110">${g.actionLabel}</button>
              </div>
              <div class="flex flex-col gap-1.5">
                ${slots
                  .map((slot) => {
                    const done = completed.includes(slot.id);
                    const inWin = !done && isSlotInWindow(slot, now);
                    return `
                      <div class="rounded-xl px-2.5 py-1.5 border flex items-center justify-between gap-2 ${done ? 'bg-emerald-50 border-emerald-200' : inWin ? 'bg-amber-50 border-amber-300' : 'bg-purple-50/50 border-purple-100'}">
                        <div class="flex items-center gap-2 min-w-0">
                          <span class="text-lg">${slot.emoji}</span>
                          <div class="min-w-0">
                            <div class="text-xs font-bold text-[#3b1f6e] truncate">${escapeHtml(slot.label)}</div>
                            <div class="text-[10px] font-semibold text-[#6b4d9e]">Horário: ${escapeHtml(slot.timeLabel)}</div>
                          </div>
                        </div>
                        ${
                          done
                            ? `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0">✓ Feito</span>`
                            : inWin
                              ? `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 shrink-0 animate-pulse">⏰ +🪙 ${slot.bonusCoins}</span>`
                              : `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-[#6b4d9e] shrink-0">+🪙 ${slot.bonusCoins}</span>`
                        }
                      </div>
                    `;
                  })
                  .join('')}
              </div>
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}
