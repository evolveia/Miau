import {
  SCREEN_LIMIT_OPTIONS,
  generateAdultMathChallenge,
  getScreenLimitStatus,
  getWeeklySummary,
  verifyParentalPin,
  type AdultMathChallenge,
  type ParentalControlConfig,
} from '../../services/parentalControlService';
import {
  getStrongestAndWeakestModules,
  type EducationProgressReport,
} from '../../services/progressReportService';
import { escapeHtml } from '../../utils/html';

export interface ParentalDashboardState {
  mode: 'gate' | 'dashboard';
  challenge: AdultMathChallenge;
  pinError: string;
  pinFeedback: string;
  gateNotice: string;
}

export function createInitialParentalDashboardState(): ParentalDashboardState {
  return {
    mode: 'gate',
    challenge: generateAdultMathChallenge(),
    pinError: '',
    pinFeedback: '',
    gateNotice: '',
  };
}

export interface ParentalDashboardCallbacks {
  onBack: () => void;
  onRerender: () => void;
  onOpenTrack: (trackId: string) => void;
  onUpdateConfig: (
    next: ParentalControlConfig,
    options?: { syncPush?: boolean; toast?: string }
  ) => void;
  onSetPin: (rawPin: string) => {
    ok: boolean;
    config: ParentalControlConfig;
    error?: string;
  };
  onClearPin: () => ParentalControlConfig;
}

export function renderParentalDashboardModalHtml(params: {
  state: ParentalDashboardState;
  config: ParentalControlConfig;
  report: EducationProgressReport;
  isFirebaseAccount: boolean;
  petName: string;
}): string {
  const { state, config, report, isFirebaseAccount, petName } = params;
  const hasPin = Boolean(config.pinHash);

  if (state.mode === 'gate') {
    return `
      <div class="flex items-center justify-between gap-2 mb-3 text-left shrink-0">
        <div class="flex items-center gap-2 min-w-0">
          <button id="btn-parental-back" type="button" class="px-3 py-1.5 rounded-full bg-white/95 border border-purple-200 text-[#4c2a85] font-extrabold text-xs shadow-sm hover:bg-purple-50 transition shrink-0">← Voltar</button>
          <div class="min-w-0">
            <h2 class="font-display text-lg sm:text-xl font-bold text-[#3b1f6e] leading-tight truncate">Área dos Responsáveis 🛡️</h2>
            <p class="text-[11px] font-semibold text-[#6b4d9e] truncate">Acesso protegido para pais e educadores</p>
          </div>
        </div>
        <button id="modal-close" type="button" class="w-9 h-9 rounded-full bg-white/95 border border-purple-200 text-purple-800 font-bold shrink-0">✕</button>
      </div>

      <div class="flex-1 min-h-0 flex items-center justify-center p-2 overflow-y-auto miau-scroll">
        <div class="w-full max-w-md rounded-3xl p-5 sm:p-6 bg-white/95 border-2 border-purple-200 shadow-lg text-center flex flex-col gap-4">
          <div class="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-200 border border-purple-200 flex items-center justify-center text-3xl shadow-xs">
            ${hasPin ? '🔐' : '🧮'}
          </div>
          <div>
            <span class="inline-block text-[10px] font-extrabold uppercase tracking-wide px-2.5 py-0.5 rounded-full bg-purple-100 text-[#5a3696] mb-1.5">
              ${hasPin ? 'PIN de 4 dígitos ativo' : 'Verificação de Adulto'}
            </span>
            <h3 class="font-display text-lg font-bold text-[#3b1f6e]">
              ${hasPin ? 'Digite o PIN dos Responsáveis' : 'Confirme que você é um adulto'}
            </h3>
            <p class="text-xs font-semibold text-[#6b4d9e] mt-1">
              ${
                hasPin
                  ? 'Informe seu código numérico de 4 dígitos para abrir o painel.'
                  : `Resolva a conta abaixo para liberar os controles do ${escapeHtml(petName)}:`
              }
            </p>
          </div>

          ${
            !hasPin
              ? `<div class="rounded-2xl px-4 py-3 bg-indigo-50 border border-indigo-200 font-display text-lg font-bold text-[#3b1f6e]">
                   ${escapeHtml(state.challenge.question)}
                 </div>`
              : ''
          }

          <form id="parental-gate-form" class="flex flex-col gap-3">
            <input
              id="parental-gate-input"
              type="${hasPin ? 'password' : 'text'}"
              inputmode="numeric"
              autocomplete="off"
              maxlength="${hasPin ? 4 : 6}"
              placeholder="${hasPin ? '•••• (4 dígitos)' : 'Digite a resposta'}"
              class="w-full rounded-2xl border-2 border-purple-200 bg-purple-50/70 px-4 py-3 text-center font-display text-lg font-bold text-[#3b1f6e] placeholder:text-[#8d74b8] focus:outline-none focus:border-[#6e45a5]"
            />
            ${
              state.pinError
                ? `<p class="text-xs font-extrabold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">${escapeHtml(state.pinError)}</p>`
                : ''
            }
            ${
              state.gateNotice
                ? `<p class="text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">${escapeHtml(state.gateNotice)}</p>`
                : ''
            }
            <button
              type="submit"
              class="w-full min-h-[46px] py-3 rounded-2xl bg-gradient-to-r from-[#6e45a5] to-[#4f46e5] text-white font-display font-bold text-sm shadow-md hover:brightness-105 active:scale-[0.99] transition"
            >
              Entrar no Painel 🛡️
            </button>
          </form>

          ${
            !hasPin
              ? `<button id="btn-parental-refresh-challenge" type="button" class="text-xs font-extrabold text-[#6e45a5] hover:underline">
                   ↻ Trocar pergunta de verificação
                 </button>`
              : `<button id="btn-parental-forgot-pin" type="button" class="text-xs font-bold text-[#6b4d9e] hover:underline">
                   Esqueceu o PIN?
                 </button>`
          }
        </div>
      </div>
    `;
  }

  const weekly = getWeeklySummary(config);
  const limitStatus = getScreenLimitStatus(config);
  const { strongest, needsReinforcement } = getStrongestAndWeakestModules(report);
  const maxBarMinutes = Math.max(
    15,
    ...weekly.days.map((d) => d.minutes),
    config.dailyScreenLimitMin || 0
  );

  return `
    <div class="flex items-center justify-between gap-2 mb-3 text-left shrink-0">
      <div class="flex items-center gap-2 min-w-0">
        <button id="btn-parental-back" type="button" class="px-3 py-1.5 rounded-full bg-white/95 border border-purple-200 text-[#4c2a85] font-extrabold text-xs shadow-sm hover:bg-purple-50 transition shrink-0">← Voltar</button>
        <div class="min-w-0">
          <div class="flex items-center gap-1.5 flex-wrap">
            <h2 class="font-display text-lg sm:text-xl font-bold text-[#3b1f6e] leading-tight truncate">Área dos Responsáveis 🛡️</h2>
            <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
              isFirebaseAccount
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-purple-100 text-[#5a3696] border border-purple-200'
            }">
              ${isFirebaseAccount ? '☁️ Conta Verificada • Nuvem Ativa' : '💾 Modo Local'}
            </span>
          </div>
          <p class="text-[11px] font-semibold text-[#6b4d9e] truncate">Acompanhamento pedagógico e controles para ${escapeHtml(petName)}</p>
        </div>
      </div>
      <button id="modal-close" type="button" class="w-9 h-9 rounded-full bg-white/95 border border-purple-200 text-purple-800 font-bold shrink-0">✕</button>
    </div>

    <div class="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto miau-scroll pr-1 text-left">
      <!-- 1. Resumo Semanal (7 dias) -->
      <section class="rounded-3xl p-4 bg-white/95 border border-purple-200 shadow-sm flex flex-col gap-3">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h3 class="font-display text-base font-bold text-[#3b1f6e]">📊 Resumo Semanal (7 dias)</h3>
            <p class="text-[11px] font-semibold text-[#6b4d9e]">Tempo ativo diário e lições concluídas</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-purple-100 text-[#4c2a85]">
              ⏱️ ${weekly.totalMinutes} min
            </span>
            <span class="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900">
              🎓 ${weekly.totalLessons} lições
            </span>
          </div>
        </div>

        <div class="grid grid-cols-7 gap-1.5 items-end pt-2 px-1">
          ${weekly.days
            .map((day) => {
              const barPct =
                day.minutes > 0
                  ? Math.max(12, Math.min(100, Math.round((day.minutes / maxBarMinutes) * 100)))
                  : 6;
              const isToday = day.weekdayLabel === 'Hoje';
              return `
                <div class="flex flex-col items-center gap-1">
                  <span class="text-[10px] font-extrabold text-[#4c2a85]">${day.minutes}m</span>
                  <div class="w-full h-24 rounded-xl bg-purple-50 border border-purple-100 p-1 flex items-end justify-center">
                    <div
                      class="w-full rounded-lg transition-all duration-300 ${
                        isToday
                          ? 'bg-gradient-to-t from-[#6e45a5] to-[#ec4899]'
                          : day.minutes > 0
                            ? 'bg-gradient-to-t from-indigo-400 to-purple-400'
                            : 'bg-purple-200/60'
                      }"
                      style="height:${barPct}%"
                      title="${day.dateKey}: ${day.minutes} min • ${day.lessons} lições"
                    ></div>
                  </div>
                  <span class="text-[10px] font-extrabold ${
                    isToday ? 'text-[#6e45a5]' : 'text-[#6b4d9e]'
                  }">${escapeHtml(day.weekdayLabel)}</span>
                  <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                    day.lessons > 0
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-purple-50 text-[#8469b0]'
                  }">${day.lessons}📚</span>
                </div>
              `;
            })
            .join('')}
        </div>
      </section>

      <!-- 2. Desempenho Pedagógico -->
      <section class="rounded-3xl p-4 bg-white/95 border border-purple-200 shadow-sm flex flex-col gap-3">
        <div class="flex items-center justify-between gap-2">
          <div>
            <h3 class="font-display text-base font-bold text-[#3b1f6e]">🌟 Desempenho Pedagógico</h3>
            <p class="text-[11px] font-semibold text-[#6b4d9e]">Progresso geral: ${report.overallPct}% • ${report.totalStars} ⭐ conquistadas</p>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="rounded-2xl p-3 bg-emerald-50 border border-emerald-200 flex flex-col gap-2">
            <div class="text-xs font-extrabold uppercase tracking-wide text-emerald-900">
              💪 Pontos Fortes
            </div>
            ${
              strongest.length === 0
                ? `<p class="text-xs font-semibold text-emerald-800/85">Nenhuma lição concluída ainda. Toque em qualquer módulo para começar!</p>`
                : strongest
                    .map(
                      (m) => `
                        <button
                          type="button"
                          data-parental-open-track="${escapeHtml(m.trackId)}"
                          class="w-full rounded-xl px-3 py-2 bg-white/95 border border-emerald-200 flex items-center justify-between gap-2 text-left hover:bg-emerald-100/60 transition"
                        >
                          <div class="flex items-center gap-2 min-w-0">
                            <span class="text-lg shrink-0">${m.emoji}</span>
                            <div class="min-w-0">
                              <div class="text-xs font-extrabold text-emerald-950 truncate">${escapeHtml(m.title)}</div>
                              <div class="text-[10px] font-bold text-emerald-800">${m.completedUnits}/${m.totalUnits} un. • ${m.stars}⭐</div>
                            </div>
                          </div>
                          <span class="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 shrink-0">${m.progressPct}%</span>
                        </button>
                      `
                    )
                    .join('')
            }
          </div>

          <div class="rounded-2xl p-3 bg-amber-50 border border-amber-200 flex flex-col gap-2">
            <div class="text-xs font-extrabold uppercase tracking-wide text-amber-900">
              🎯 Merecem Reforço
            </div>
            ${needsReinforcement
              .map(
                (m) => `
                  <button
                    type="button"
                    data-parental-open-track="${escapeHtml(m.trackId)}"
                    class="w-full rounded-xl px-3 py-2 bg-white/95 border border-amber-200 flex items-center justify-between gap-2 text-left hover:bg-amber-100/60 transition"
                  >
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="text-lg shrink-0">${m.emoji}</span>
                      <div class="min-w-0">
                        <div class="text-xs font-extrabold text-amber-950 truncate">${escapeHtml(m.title)}</div>
                        <div class="text-[10px] font-bold text-amber-800">${m.completedUnits}/${m.totalUnits} un. • ${m.stars}⭐</div>
                      </div>
                    </div>
                    <span class="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 shrink-0">Abrir ›</span>
                  </button>
                `
              )
              .join('')}
          </div>
        </div>
      </section>

      <!-- 3. Limite Diário de Tempo de Tela -->
      <section class="rounded-3xl p-4 bg-white/95 border border-purple-200 shadow-sm flex flex-col gap-3">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h3 class="font-display text-base font-bold text-[#3b1f6e]">⏰ Limite Diário de Tempo de Tela</h3>
            <p class="text-[11px] font-semibold text-[#6b4d9e]">
              Hoje: ${limitStatus.usedMinutes} min usados${
                limitStatus.limitMinutes > 0
                  ? limitStatus.bypassActive
                    ? ' • Liberado temporariamente'
                    : ` • Restam ${limitStatus.remainingMinutes} min`
                  : ' • Sem limite diário'
              }
            </p>
          </div>
        </div>
        <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
          ${SCREEN_LIMIT_OPTIONS.map((min) => {
            const active = config.dailyScreenLimitMin === min;
            return `
              <button
                type="button"
                data-parental-limit="${min}"
                class="min-h-[42px] py-2 px-2 rounded-xl border-2 text-xs font-extrabold transition ${
                  active
                    ? 'bg-[#6e45a5] border-[#5a3696] text-white shadow-sm'
                    : 'bg-purple-50 border-purple-200 text-[#3b1f6e] hover:bg-purple-100'
                }"
              >
                ${min === 0 ? 'Sem limite' : `${min} min`}
              </button>
            `;
          }).join('')}
        </div>
      </section>

      <!-- 4. Horário Silencioso (Notificações) -->
      <section class="rounded-3xl p-4 bg-white/95 border border-purple-200 shadow-sm flex flex-col gap-3">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <h3 class="font-display text-base font-bold text-[#3b1f6e]">🌙 Horário Silencioso de Notificações</h3>
            <p class="text-[11px] font-semibold text-[#6b4d9e]">Silencia lembretes automáticos locais e Web Push no período escolar ou noturno</p>
          </div>
          <button
            id="btn-parental-quiet-toggle"
            type="button"
            aria-pressed="${config.quietHoursEnabled}"
            class="px-3.5 py-2 rounded-xl text-xs font-extrabold transition shrink-0 ${
              config.quietHoursEnabled
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-purple-100 text-[#4c2a85]'
            }"
          >
            ${config.quietHoursEnabled ? 'Ativado' : 'Desativado'}
          </button>
        </div>

        <div class="grid grid-cols-2 gap-3 ${config.quietHoursEnabled ? '' : 'opacity-70'}">
          <label class="flex flex-col gap-1">
            <span class="text-[11px] font-extrabold text-[#4c2a85]">Início do silêncio</span>
            <input
              id="parental-quiet-start"
              type="time"
              value="${escapeHtml(config.quietStart)}"
              class="rounded-xl border border-purple-200 bg-purple-50/70 px-3 py-2 text-sm font-bold text-[#3b1f6e]"
            />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-[11px] font-extrabold text-[#4c2a85]">Fim do silêncio</span>
            <input
              id="parental-quiet-end"
              type="time"
              value="${escapeHtml(config.quietEnd)}"
              class="rounded-xl border border-purple-200 bg-purple-50/70 px-3 py-2 text-sm font-bold text-[#3b1f6e]"
            />
          </label>
        </div>
      </section>

      <!-- 5. Filtro Estrito de Segurança da IA -->
      <section class="rounded-3xl p-4 bg-white/95 border border-purple-200 shadow-sm flex items-center justify-between gap-3">
        <div class="min-w-0">
          <h3 class="font-display text-base font-bold text-[#3b1f6e]">🧠 Filtro Estrito de IA do {PET}</h3>
          <p class="text-[11px] font-semibold text-[#6b4d9e]">
            Aplica proteção infantil máxima em conversas, transcrição e voz ao vivo, independente da idade do perfil.
          </p>
        </div>
        <button
          id="btn-parental-strict-ai"
          type="button"
          aria-pressed="${config.strictAiFilter}"
          class="px-3.5 py-2 rounded-xl text-xs font-extrabold transition shrink-0 ${
            config.strictAiFilter
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-purple-100 text-[#4c2a85]'
          }"
        >
          ${config.strictAiFilter ? 'Ativado 🛡️' : 'Padrão'}
        </button>
      </section>

      <!-- 6. PIN de Acesso (4 dígitos) -->
      <section class="rounded-3xl p-4 bg-white/95 border border-purple-200 shadow-sm flex flex-col gap-3">
        <div>
          <h3 class="font-display text-base font-bold text-[#3b1f6e]">🔐 PIN dos Responsáveis (4 dígitos)</h3>
          <p class="text-[11px] font-semibold text-[#6b4d9e]">
            ${
              hasPin
                ? 'PIN ativo! Apenas quem souber os 4 dígitos pode acessar este painel ou liberar tempo extra.'
                : 'Opcional: defina 4 dígitos para proteger o painel em vez do desafio matemático.'
            }
          </p>
        </div>

        <form id="parental-pin-form" class="flex items-center gap-2 flex-wrap">
          <input
            id="parental-new-pin"
            type="password"
            inputmode="numeric"
            maxlength="4"
            autocomplete="off"
            placeholder="Novo PIN (4 dígitos)"
            class="flex-1 min-w-[160px] rounded-xl border border-purple-200 bg-purple-50/70 px-3 py-2.5 text-sm font-bold text-[#3b1f6e] placeholder:text-[#8d74b8]"
          />
          <button
            type="submit"
            class="min-h-[42px] px-4 py-2 rounded-xl bg-[#6e45a5] hover:bg-[#5c3691] text-white font-extrabold text-xs transition"
          >
            Salvar PIN
          </button>
          ${
            hasPin
              ? `<button
                   id="btn-parental-clear-pin"
                   type="button"
                   class="min-h-[42px] px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-extrabold text-xs hover:bg-rose-100 transition"
                 >
                   Remover PIN
                 </button>`
              : ''
          }
        </form>
        ${
          state.pinFeedback
            ? `<p class="text-xs font-bold text-[#4c2a85] bg-purple-50 border border-purple-200 rounded-xl px-3 py-2">${escapeHtml(state.pinFeedback)}</p>`
            : ''
        }
      </section>
    </div>
  `.replace('{PET}', escapeHtml(petName));
}

export function bindParentalDashboardModalEvents(
  root: HTMLElement,
  state: ParentalDashboardState,
  config: ParentalControlConfig,
  callbacks: ParentalDashboardCallbacks
): void {
  root.querySelector('#btn-parental-back')?.addEventListener('click', () => {
    callbacks.onBack();
  });

  if (state.mode === 'gate') {
    root
      .querySelector('#btn-parental-refresh-challenge')
      ?.addEventListener('click', () => {
        state.challenge = generateAdultMathChallenge();
        state.pinError = '';
        callbacks.onRerender();
      });

    root
      .querySelector('#btn-parental-forgot-pin')
      ?.addEventListener('click', () => {
        state.gateNotice =
          'Se esqueceu o PIN cadastrado no navegador, limpe os dados do site ou acesse com sua conta Google/E-mail sincronizada.';
        callbacks.onRerender();
      });

    root
      .querySelector('#parental-gate-form')
      ?.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = root.querySelector(
          '#parental-gate-input'
        ) as HTMLInputElement | null;
        const val = (input?.value || '').trim();

        if (config.pinHash) {
          if (verifyParentalPin(val, config.pinHash)) {
            state.mode = 'dashboard';
            state.pinError = '';
            state.gateNotice = '';
            callbacks.onRerender();
          } else {
            state.pinError = 'PIN incorreto. Tente novamente com os 4 dígitos.';
            callbacks.onRerender();
          }
          return;
        }

        const numeric = Number(val);
        if (val && Number.isFinite(numeric) && numeric === state.challenge.answer) {
          state.mode = 'dashboard';
          state.pinError = '';
          state.gateNotice = '';
          callbacks.onRerender();
        } else {
          state.pinError = 'Resposta incorreta. Confira a conta e tente novamente.';
          state.challenge = generateAdultMathChallenge();
          callbacks.onRerender();
        }
      });
    return;
  }

  root.querySelectorAll('[data-parental-open-track]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const trackId = btn.getAttribute('data-parental-open-track');
      if (trackId) callbacks.onOpenTrack(trackId);
    });
  });

  root.querySelectorAll('[data-parental-limit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const minutes = Number(btn.getAttribute('data-parental-limit') || 0);
      callbacks.onUpdateConfig(
        {
          ...config,
          dailyScreenLimitMin: Number.isFinite(minutes) ? minutes : 0,
        },
        {
          toast:
            minutes === 0
              ? 'Limite diário de tela removido.'
              : `Limite diário definido para ${minutes} min.`,
        }
      );
    });
  });

  root
    .querySelector('#btn-parental-quiet-toggle')
    ?.addEventListener('click', () => {
      const nextEnabled = !config.quietHoursEnabled;
      callbacks.onUpdateConfig(
        {
          ...config,
          quietHoursEnabled: nextEnabled,
        },
        {
          syncPush: true,
          toast: nextEnabled
            ? `Horário silencioso ativado (${config.quietStart}–${config.quietEnd}).`
            : 'Horário silencioso desativado.',
        }
      );
    });

  const handleTimeChange = () => {
    const startInput = root.querySelector(
      '#parental-quiet-start'
    ) as HTMLInputElement | null;
    const endInput = root.querySelector(
      '#parental-quiet-end'
    ) as HTMLInputElement | null;
    const nextStart = startInput?.value || config.quietStart;
    const nextEnd = endInput?.value || config.quietEnd;
    callbacks.onUpdateConfig(
      {
        ...config,
        quietStart: nextStart,
        quietEnd: nextEnd,
      },
      {
        syncPush: true,
        toast: `Horário silencioso atualizado: ${nextStart}–${nextEnd}.`,
      }
    );
  };

  root
    .querySelector('#parental-quiet-start')
    ?.addEventListener('change', handleTimeChange);
  root
    .querySelector('#parental-quiet-end')
    ?.addEventListener('change', handleTimeChange);

  root
    .querySelector('#btn-parental-strict-ai')
    ?.addEventListener('click', () => {
      const nextStrict = !config.strictAiFilter;
      callbacks.onUpdateConfig(
        {
          ...config,
          strictAiFilter: nextStrict,
        },
        {
          toast: nextStrict
            ? 'Filtro estrito de IA ativado!'
            : 'Filtro estrito de IA ajustado para o padrão por idade.',
        }
      );
    });

  root
    .querySelector('#parental-pin-form')
    ?.addEventListener('submit', (e) => {
      e.preventDefault();
      const pinInput = root.querySelector(
        '#parental-new-pin'
      ) as HTMLInputElement | null;
      const res = callbacks.onSetPin(pinInput?.value || '');
      if (!res.ok) {
        state.pinFeedback =
          res.error || 'Digite exatamente 4 dígitos numéricos para o PIN.';
      } else {
        state.pinFeedback = 'PIN de 4 dígitos salvo com segurança!';
      }
      callbacks.onRerender();
    });

  root
    .querySelector('#btn-parental-clear-pin')
    ?.addEventListener('click', () => {
      callbacks.onClearPin();
      state.pinFeedback = 'PIN removido. Verificação matemática reativada.';
      callbacks.onRerender();
    });
}
