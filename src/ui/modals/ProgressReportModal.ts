import type {
  EducationProgressReport,
  ProgressReportCategory,
} from '../../services/progressReportService';
import { escapeHtml } from '../../utils/html';

export type ProgressReportFilter = 'all' | ProgressReportCategory;

const REPORT_TABS: Array<{ id: ProgressReportFilter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'letras_escrita', label: 'Letras e Escrita' },
  { id: 'matematica_cores', label: 'Matemática e Cores' },
  { id: 'mundo_saude', label: 'Mundo e Saúde' },
];

export function renderProgressReportModalHtml(
  report: EducationProgressReport,
  activeTab: ProgressReportFilter
): string {
  const visibleModules =
    activeTab === 'all'
      ? report.modules
      : report.modules.filter((m) => m.category === activeTab);

  return `
    <div class="flex items-center justify-between gap-2 mb-3 shrink-0">
      <div class="flex items-center gap-2.5 min-w-0">
        <button id="btn-report-back" type="button" class="min-h-[40px] px-3.5 py-2 rounded-full bg-white/95 border border-purple-200 text-purple-800 font-extrabold text-xs shadow-xs hover:bg-purple-50 active:scale-95 transition shrink-0">← Voltar</button>
        <div class="min-w-0">
          <h2 class="font-display text-xl sm:text-2xl font-bold text-[#3b1f6e] leading-tight truncate">Relatório de Progresso 📊</h2>
          <p class="text-xs font-semibold text-[#6b4d9e] truncate">Acompanhe suas lições concluídas e conquiste moedas para a loja</p>
        </div>
      </div>
      <button id="modal-close" type="button" class="w-10 h-10 rounded-full bg-white/95 border border-purple-200 text-purple-800 font-bold text-sm shadow-xs hover:bg-purple-50 active:scale-95 transition shrink-0">✕</button>
    </div>

    <div class="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto miau-scroll pr-1 text-left">
      <!-- Card Resumo Geral -->
      <div class="rounded-3xl p-4 bg-gradient-to-br from-white via-purple-50/90 to-amber-50/70 border-2 border-[#a882e3] shadow-sm flex flex-col gap-3 shrink-0">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div class="min-w-0">
            <div class="text-[11px] font-extrabold uppercase tracking-wide text-[#6b4d9e]">Progresso Educativo Geral</div>
            <div class="font-display text-2xl font-bold text-[#3b1f6e] leading-tight">
              ${report.totalCompletedUnits}/${report.totalUnits} lições • ${report.overallPct}%
            </div>
          </div>
          <button
            id="btn-report-open-shop"
            type="button"
            class="min-h-[40px] px-3.5 py-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-extrabold text-xs shadow-sm hover:brightness-105 active:scale-95 transition shrink-0"
          >
            🛍️ Loja do Miau
          </button>
        </div>

        <div class="w-full h-3 rounded-full bg-purple-100 overflow-hidden border border-purple-200/80">
          <div
            class="h-full rounded-full bg-gradient-to-r from-[#7b52b8] via-[#ec4899] to-amber-400 transition-all duration-300"
            style="width: ${Math.max(4, report.overallPct)}%"
          ></div>
        </div>

        <div class="grid grid-cols-3 gap-2 text-center">
          <div class="rounded-2xl bg-white/90 border border-purple-100 px-2 py-2">
            <div class="text-[10px] font-bold text-[#6b4d9e]">Estrelas</div>
            <div class="font-display text-base font-bold text-amber-600">★ ${report.totalStars}</div>
          </div>
          <div class="rounded-2xl bg-white/90 border border-purple-100 px-2 py-2">
            <div class="text-[10px] font-bold text-[#6b4d9e]">Sequência</div>
            <div class="font-display text-base font-bold text-rose-600">🔥 ${report.maxStreakDays}d</div>
          </div>
          <div class="rounded-2xl bg-white/90 border border-purple-100 px-2 py-2">
            <div class="text-[10px] font-bold text-[#6b4d9e]">Completos</div>
            <div class="font-display text-base font-bold text-emerald-700">${report.completedModulesCount}/${report.modules.length}</div>
          </div>
        </div>
      </div>

      <!-- Filtros de Categoria -->
      <div class="flex gap-1.5 overflow-x-auto pb-1 shrink-0 miau-scroll">
        ${REPORT_TABS.map((tab) => {
          const active = tab.id === activeTab;
          return `
            <button
              type="button"
              data-report-tab="${tab.id}"
              class="min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap border transition shrink-0 ${
                active
                  ? 'bg-[#6e45a5] text-white border-[#6e45a5] shadow-sm'
                  : 'bg-white/90 text-[#4c2a85] border-purple-200 hover:bg-purple-50'
              }"
            >
              ${escapeHtml(tab.label)}
            </button>
          `;
        }).join('')}
      </div>

      <!-- Lista de Módulos com Barra Visual -->
      <div class="flex flex-col gap-3 pb-2">
        ${visibleModules
          .map((mod) => {
            const isComplete =
              mod.totalUnits > 0 && mod.completedUnits >= mod.totalUnits;
            return `
              <div class="rounded-3xl p-4 bg-white/95 border ${isComplete ? 'border-emerald-300 shadow-md' : 'border-purple-200 shadow-sm'} flex flex-col gap-3">
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="w-14 h-14 rounded-2xl bg-gradient-to-br ${mod.accentGradient} text-white flex items-center justify-center text-3xl shadow-sm shrink-0">
                      ${mod.emoji}
                    </div>
                    <div class="min-w-0">
                      <h3 class="font-display text-base font-bold text-[#3b1f6e] leading-snug">
                        ${escapeHtml(mod.title)}
                      </h3>
                      <div class="flex items-center gap-2 flex-wrap mt-0.5 text-xs font-bold text-[#6b4d9e]">
                        <span>✅ ${mod.completedUnits}/${mod.totalUnits} lições</span>
                        <span>•</span>
                        <span class="text-amber-600">★ ${mod.stars}</span>
                      </div>
                    </div>
                  </div>
                  <span class="text-xs font-extrabold px-2.5 py-1 rounded-full ${isComplete ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-[#5a3696]'} shrink-0">
                    ${mod.progressPct}%
                  </span>
                </div>

                <div class="w-full h-2.5 rounded-full bg-purple-100 overflow-hidden border border-purple-200/70">
                  <div
                    class="h-full rounded-full bg-gradient-to-r ${mod.accentGradient} transition-all duration-300"
                    style="width: ${mod.progressPct > 0 ? Math.max(6, mod.progressPct) : 0}%"
                  ></div>
                </div>

                <div class="flex items-center justify-between gap-2 pt-1 border-t border-purple-100/80 flex-wrap">
                  <div class="text-xs font-bold text-[#5e4294]">
                    🏅 ${escapeHtml(mod.masteredLabel)}${mod.lessonsCompleted > 0 ? ` · ${mod.lessonsCompleted} aula(s)` : ''}
                  </div>
                  <button
                    type="button"
                    data-report-open-track="${mod.trackId}"
                    class="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#6e45a5] hover:bg-[#5c3691] active:scale-95 text-white font-extrabold text-xs shadow-xs transition shrink-0"
                  >
                    ▶ ${mod.completedUnits > 0 ? 'Continuar' : 'Estudar'}
                  </button>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    </div>
  `;
}
