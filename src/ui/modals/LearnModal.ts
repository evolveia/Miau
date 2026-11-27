import {
  EDUCATION_MODULES_BY_SCHOOLING,
  SCHOOLING_OPTIONS,
  getSchoolingLabel,
} from '../../data/educationModules';
import { EARLY_LITERACY_UNITS } from '../../data/earlyLiteracyData';
import { CONSONANT_UNITS } from '../../modules/consonants/data';
import { loadConsonantsProgress } from '../../modules/consonants/consonantsEngine';
import { ADICAO_SUBTRACAO_CONFIG } from '../../modules/themed/adicaoSubtracaoData';
import { ANIMAIS_NATUREZA_CONFIG } from '../../modules/themed/animaisNaturezaData';
import { COMIDAS_BEBIDAS_CONFIG } from '../../modules/themed/comidasBebidasData';
import { CORES_FORMAS_CONFIG } from '../../modules/themed/coresFormasData';
import { FUND1_CIENCIAS_CONFIG } from '../../modules/themed/fund1CienciasData';
import { FUND1_LEITURA_CONFIG } from '../../modules/themed/fund1LeituraData';
import { FUND1_MATEMATICA_CONFIG } from '../../modules/themed/fund1MatematicaData';
import { FUND2_CIENCIAS_CONFIG } from '../../modules/themed/fund2CienciasData';
import { FUND2_HISTORIA_CONFIG } from '../../modules/themed/fund2HistoriaData';
import { FUND2_LOGICA_CONFIG } from '../../modules/themed/fund2LogicaData';
import { LOGICA_MATEMATICA_CONFIG } from '../../modules/themed/logicaMatematicaData';
import { loadThemedProgress } from '../../modules/themed/themedEngine';
import {
  WRITING_CONSONANTS_UNITS,
  WRITING_UNITS,
} from '../../modules/writing/data';
import {
  CONSONANTS_WRITING_CONFIG,
  loadWritingProgress,
} from '../../modules/writing/writingEngine';
import { loadEarlyLiteracyProgress } from '../../services/phonicsEngineService';
import { getSmartReviewDailyState } from '../../services/smartReviewService';
import { calculateAgeFromBirthDate } from '../../services/userProfileService';
import type { SchoolingLevel, UserHumanProfile } from '../../types';
import { escapeHtml } from '../../utils/html';

export interface LearnModalCallbacks {
  onBackToMenu: () => void;
  onGoToProfile: () => void;
  onOpenProgressReport: () => void;
  onOpenSmartReview: () => void;
  onSelectPreviewLevel: (level: SchoolingLevel) => void;
  onOpenTrack?: (trackId: string) => void;
}

export function renderLearnModalHtml(
  humanProfile: UserHumanProfile,
  previewLevel?: SchoolingLevel | null
): string {
  const userSchooling = humanProfile.schooling;
  const activeLevel: SchoolingLevel =
    previewLevel || userSchooling || 'fundamental_1';
  const age = calculateAgeFromBirthDate(humanProfile.birthDate);
  const tracks = EDUCATION_MODULES_BY_SCHOOLING[activeLevel] || [];
  const activeOption = SCHOOLING_OPTIONS.find((o) => o.id === activeLevel);
  const firstName =
    humanProfile.fullName.trim().split(/\s+/)[0] || 'Explorador(a)';
  const ownerId = humanProfile.ownerId || 'guest';

  const literacyProgress = loadEarlyLiteracyProgress(ownerId);
  const writingProgress = loadWritingProgress(ownerId);
  const writingConsonantsProgress = loadWritingProgress(
    ownerId,
    CONSONANTS_WRITING_CONFIG
  );
  const consonantsProgress = loadConsonantsProgress(ownerId);
  const coresProgress = loadThemedProgress(CORES_FORMAS_CONFIG, ownerId);
  const somaSubtracaoProgress = loadThemedProgress(
    ADICAO_SUBTRACAO_CONFIG,
    ownerId
  );
  const logicaMathProgress = loadThemedProgress(
    LOGICA_MATEMATICA_CONFIG,
    ownerId
  );
  const naturezaProgress = loadThemedProgress(ANIMAIS_NATUREZA_CONFIG, ownerId);
  const comidasProgress = loadThemedProgress(COMIDAS_BEBIDAS_CONFIG, ownerId);
  const f1LeituraProgress = loadThemedProgress(FUND1_LEITURA_CONFIG, ownerId);
  const f1MathProgress = loadThemedProgress(FUND1_MATEMATICA_CONFIG, ownerId);
  const f1CienciasProgress = loadThemedProgress(FUND1_CIENCIAS_CONFIG, ownerId);
  const f2LogicaProgress = loadThemedProgress(FUND2_LOGICA_CONFIG, ownerId);
  const f2CienciasProgress = loadThemedProgress(FUND2_CIENCIAS_CONFIG, ownerId);
  const f2HistoriaProgress = loadThemedProgress(FUND2_HISTORIA_CONFIG, ownerId);
  const smartReviewState = getSmartReviewDailyState(ownerId);

  return `
    <div class="flex items-center justify-between gap-2 mb-3 text-left shrink-0">
      <div class="flex items-center gap-2.5 min-w-0">
        <button id="btn-learn-back" type="button" class="min-h-[40px] px-3.5 py-2 rounded-full bg-white/95 border border-purple-200 text-purple-800 font-extrabold text-xs shadow-xs hover:bg-purple-50 active:scale-95 transition shrink-0">← Voltar</button>
        <div class="min-w-0">
          <h2 class="font-display text-xl sm:text-2xl font-bold text-[#3b1f6e] leading-tight truncate">Vamos Aprender 🎓</h2>
          <p class="easy-read-hide text-xs font-semibold text-[#6b4d9e] truncate">Trilhas educativas personalizadas com o Miau</p>
        </div>
      </div>
      <button id="modal-close" type="button" class="w-10 h-10 rounded-full bg-white/95 border border-purple-200 text-purple-800 font-bold text-sm shadow-xs hover:bg-purple-50 active:scale-95 transition shrink-0">✕</button>
    </div>

    <div class="flex-1 min-h-0 flex flex-col gap-3.5 overflow-y-auto miau-scroll pr-1 text-left">
      <!-- Context Banner linked to User Profile -->
      <div class="rounded-2xl p-3.5 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 border border-indigo-200 flex flex-col gap-2">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="min-w-0">
            <div class="text-[11px] font-extrabold uppercase tracking-wide text-indigo-700">Aluno(a) e Nível</div>
            <div class="text-base font-extrabold text-[#3b1f6e] truncate">
              ${escapeHtml(firstName)}${age !== null ? ` • ${age} anos` : ''}
            </div>
          </div>
          <div class="flex items-center gap-1.5 flex-wrap shrink-0">
            <button
              id="btn-learn-progress-report"
              type="button"
              class="min-h-[38px] px-3 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-extrabold hover:bg-emerald-700 shadow-xs transition shrink-0"
            >
              📊 Relatório de Progresso
            </button>
            <button
              id="btn-learn-edit-profile"
              type="button"
              class="min-h-[38px] px-3 py-1.5 rounded-full bg-white border border-indigo-200 text-xs font-extrabold text-indigo-700 hover:bg-indigo-50 transition shrink-0"
            >
              ${userSchooling ? '✏️ Mudar no Perfil' : '⚙️ Definir Escolaridade'}
            </button>
          </div>
        </div>

        ${
          userSchooling
            ? `<div class="flex items-center gap-2 flex-wrap">
                 <span class="text-xs font-extrabold px-3 py-1 rounded-full border ${activeOption?.badgeColor || 'bg-purple-100 text-purple-800 border-purple-200'}">
                   📚 ${escapeHtml(getSchoolingLabel(userSchooling))}
                 </span>
                 ${
                   activeLevel !== userSchooling
                     ? `<span class="text-xs font-bold text-indigo-700">(Visualizando: ${escapeHtml(getSchoolingLabel(activeLevel))})</span>`
                     : ''
                 }
               </div>`
            : `<div class="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                 Você ainda não salvou sua escolaridade no Perfil do Usuário. Mostrando sugestão inicial abaixo!
               </div>`
        }
      </div>

      <!-- Treino do Dia com o Miau (Revisão Inteligente) -->
      <div class="rounded-2xl p-3.5 bg-gradient-to-r from-amber-50 via-rose-50 to-purple-50 border-2 border-amber-300 shadow-sm flex items-center justify-between gap-3 flex-wrap">
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <div class="w-12 h-12 rounded-2xl bg-white border border-amber-200 flex items-center justify-center text-2xl shadow-xs shrink-0">🧠</div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-display text-sm sm:text-base font-bold text-[#3b1f6e]">Treino do Dia com o Miau</span>
              <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full ${smartReviewState.completed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-200 text-amber-950'}">
                ${smartReviewState.completed ? '✅ Feito hoje' : '🪙 +35 Bônus'}
              </span>
            </div>
            <p class="text-[11px] font-semibold text-[#5e4294] leading-snug mt-0.5">
              Revisão inteligente focada em unidades com &lt;3★ ou +5 dias sem praticar.
            </p>
          </div>
        </div>
        <button
          id="btn-learn-smart-review"
          type="button"
          class="min-h-[42px] w-full sm:w-auto px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-105 active:scale-95 text-white font-extrabold text-xs sm:text-sm shadow-sm transition shrink-0"
        >
          ${smartReviewState.completed ? '🔁 Praticar de Novo' : '✨ Começar Treino'}
        </button>
      </div>

      <!-- Schooling Level Selector (Preview / Explore) -->
      <div>
        <div class="text-[11px] font-extrabold uppercase tracking-wide text-[#6b4d9e] mb-2 px-0.5">
          Explorar módulos por escolaridade
        </div>
        <div class="flex flex-wrap gap-2">
          ${SCHOOLING_OPTIONS.map((opt) => {
            const selected = opt.id === activeLevel;
            return `
              <button
                type="button"
                data-learn-level="${opt.id}"
                class="min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-extrabold border transition ${
                  selected
                    ? 'bg-[#6e45a5] text-white border-[#6e45a5] shadow-sm'
                    : 'bg-white/95 text-[#4c2a85] border-purple-200 hover:bg-purple-50'
                }"
              >
                ${escapeHtml(opt.label)}
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Adaptive Module Cards -->
      <div class="flex flex-col gap-3.5 pb-2">
        ${tracks
          .map((track) => {
            let isActiveTrack = false;
            let completedUnits = 0;
            let totalUnits = 0;
            let totalStars = 0;

            switch (track.id) {
              case 'infantil_letras':
                isActiveTrack = true;
                completedUnits = literacyProgress.completedUnits.length;
                totalUnits = EARLY_LITERACY_UNITS.length;
                totalStars = literacyProgress.totalStars;
                break;
              case 'infantil_escrita':
                isActiveTrack = true;
                completedUnits = writingProgress.completedUnits.length;
                totalUnits = WRITING_UNITS.length;
                totalStars = writingProgress.totalStars;
                break;
              case 'infantil_escrita_consoantes':
                isActiveTrack = true;
                completedUnits =
                  writingConsonantsProgress.completedUnits.length;
                totalUnits = WRITING_CONSONANTS_UNITS.length;
                totalStars = writingConsonantsProgress.totalStars;
                break;
              case 'infantil_consoantes':
                isActiveTrack = true;
                completedUnits = consonantsProgress.completedUnits.length;
                totalUnits = CONSONANT_UNITS.length;
                totalStars = consonantsProgress.totalStars;
                break;
              case 'infantil_cores_numeros':
                isActiveTrack = true;
                completedUnits = coresProgress.completedUnits.length;
                totalUnits = CORES_FORMAS_CONFIG.units.length;
                totalStars = coresProgress.totalStars;
                break;
              case 'infantil_soma_subtracao':
                isActiveTrack = true;
                completedUnits = somaSubtracaoProgress.completedUnits.length;
                totalUnits = ADICAO_SUBTRACAO_CONFIG.units.length;
                totalStars = somaSubtracaoProgress.totalStars;
                break;
              case 'infantil_matematica_desafios':
                isActiveTrack = true;
                completedUnits = logicaMathProgress.completedUnits.length;
                totalUnits = LOGICA_MATEMATICA_CONFIG.units.length;
                totalStars = logicaMathProgress.totalStars;
                break;
              case 'infantil_natureza':
                isActiveTrack = true;
                completedUnits = naturezaProgress.completedUnits.length;
                totalUnits = ANIMAIS_NATUREZA_CONFIG.units.length;
                totalStars = naturezaProgress.totalStars;
                break;
              case 'infantil_comidas_bebidas':
                isActiveTrack = true;
                completedUnits = comidasProgress.completedUnits.length;
                totalUnits = COMIDAS_BEBIDAS_CONFIG.units.length;
                totalStars = comidasProgress.totalStars;
                break;
              case 'fund1_leitura':
                isActiveTrack = true;
                completedUnits = f1LeituraProgress.completedUnits.length;
                totalUnits = FUND1_LEITURA_CONFIG.units.length;
                totalStars = f1LeituraProgress.totalStars;
                break;
              case 'fund1_matematica':
                isActiveTrack = true;
                completedUnits = f1MathProgress.completedUnits.length;
                totalUnits = FUND1_MATEMATICA_CONFIG.units.length;
                totalStars = f1MathProgress.totalStars;
                break;
              case 'fund1_ciencias':
                isActiveTrack = true;
                completedUnits = f1CienciasProgress.completedUnits.length;
                totalUnits = FUND1_CIENCIAS_CONFIG.units.length;
                totalStars = f1CienciasProgress.totalStars;
                break;
              case 'fund2_logica':
                isActiveTrack = true;
                completedUnits = f2LogicaProgress.completedUnits.length;
                totalUnits = FUND2_LOGICA_CONFIG.units.length;
                totalStars = f2LogicaProgress.totalStars;
                break;
              case 'fund2_ciencias':
                isActiveTrack = true;
                completedUnits = f2CienciasProgress.completedUnits.length;
                totalUnits = FUND2_CIENCIAS_CONFIG.units.length;
                totalStars = f2CienciasProgress.totalStars;
                break;
              case 'fund2_historia':
                isActiveTrack = true;
                completedUnits = f2HistoriaProgress.completedUnits.length;
                totalUnits = FUND2_HISTORIA_CONFIG.units.length;
                totalStars = f2HistoriaProgress.totalStars;
                break;
            }

            const metadataLine = track.tags.join(' · ');
            const statusSummary =
              isActiveTrack && completedUnits > 0
                ? `✅ ${completedUnits}/${totalUnits} unidades · ★ ${totalStars}`
                : track.statusLabel;

            return `
              <div class="rounded-3xl p-4 sm:p-5 ${
                isActiveTrack
                  ? 'bg-white border-2 border-[#7b52b8] shadow-md'
                  : 'bg-white/95 border border-purple-100 shadow-sm'
              } flex flex-col gap-3">
                <div class="flex items-start gap-3.5 sm:gap-4">
                  <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br ${track.accentBg} border border-white shadow-inner flex items-center justify-center text-3xl sm:text-4xl shrink-0">
                    ${track.emoji}
                  </div>
                  <div class="flex-1 min-w-0">
                    <h3 class="font-display text-base sm:text-lg font-bold text-[#3b1f6e] leading-snug">
                      ${escapeHtml(track.title)}
                    </h3>
                    <p class="text-xs sm:text-sm text-[#4e3580] leading-relaxed mt-1">
                      ${escapeHtml(track.description)}
                    </p>
                  </div>
                </div>

                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-purple-100/80">
                  <div class="min-w-0 space-y-0.5">
                    <div class="easy-read-hide text-xs font-bold text-[#5a3696] truncate">
                      ${escapeHtml(metadataLine)}
                    </div>
                    <div class="text-xs font-extrabold ${
                      isActiveTrack ? 'text-emerald-700' : 'text-amber-700'
                    }">
                      ${escapeHtml(statusSummary)}
                    </div>
                  </div>
                  ${
                    isActiveTrack
                      ? `<button
                           type="button"
                           data-learn-open-track="${track.id}"
                           class="min-h-[44px] w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-[#6e45a5] hover:bg-[#5c3691] active:scale-95 text-white font-extrabold text-xs sm:text-sm shadow-sm transition shrink-0"
                         >
                           ▶ ${completedUnits > 0 ? 'Continuar' : 'Começar'}
                         </button>`
                      : ''
                  }
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    </div>
  `;
}

export function bindLearnModalEvents(
  root: HTMLElement,
  callbacks: LearnModalCallbacks
): void {
  root
    .querySelector('#btn-learn-back')
    ?.addEventListener('click', () => callbacks.onBackToMenu());
  root
    .querySelector('#btn-learn-progress-report')
    ?.addEventListener('click', () => callbacks.onOpenProgressReport());
  root
    .querySelector('#btn-learn-smart-review')
    ?.addEventListener('click', () => callbacks.onOpenSmartReview());
  root
    .querySelector('#btn-learn-edit-profile')
    ?.addEventListener('click', () => callbacks.onGoToProfile());
  root.querySelectorAll('[data-learn-level]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const level = btn.getAttribute('data-learn-level') as SchoolingLevel | null;
      if (level) callbacks.onSelectPreviewLevel(level);
    });
  });
  root.querySelectorAll('[data-learn-open-track]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const trackId = btn.getAttribute('data-learn-open-track');
      if (trackId) callbacks.onOpenTrack?.(trackId);
    });
  });
}
