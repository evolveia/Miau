import {
  EDUCATION_MODULES_BY_SCHOOLING,
  SCHOOLING_OPTIONS,
  getSchoolingLabel,
} from '../../data/educationModules';
import { EARLY_LITERACY_UNITS } from '../../data/earlyLiteracyData';
import { CONSONANT_UNITS } from '../../modules/consonants/data';
import { loadConsonantsProgress } from '../../modules/consonants/consonantsEngine';
import { WRITING_UNITS } from '../../modules/writing/data';
import { loadWritingProgress } from '../../modules/writing/writingEngine';
import { loadEarlyLiteracyProgress } from '../../services/phonicsEngineService';
import { calculateAgeFromBirthDate } from '../../services/userProfileService';
import type { SchoolingLevel, UserHumanProfile } from '../../types';
import { escapeHtml } from '../../utils/html';

export interface LearnModalCallbacks {
  onBackToMenu: () => void;
  onGoToProfile: () => void;
  onSelectPreviewLevel: (level: SchoolingLevel) => void;
  onOpenTrack?: (trackId: string) => void;
}

export function renderLearnModalHtml(
  humanProfile: UserHumanProfile,
  previewLevel?: SchoolingLevel | null
): string {
  const userSchooling = humanProfile.schooling;
  const activeLevel: SchoolingLevel =
    previewLevel || (userSchooling || 'fundamental_1');
  const age = calculateAgeFromBirthDate(humanProfile.birthDate);
  const tracks = EDUCATION_MODULES_BY_SCHOOLING[activeLevel] || [];
  const activeOption = SCHOOLING_OPTIONS.find((o) => o.id === activeLevel);
  const firstName =
    humanProfile.fullName.trim().split(/\s+/)[0] || 'Explorador(a)';
  const literacyProgress = loadEarlyLiteracyProgress(
    humanProfile.ownerId || 'guest'
  );
  const writingProgress = loadWritingProgress(
    humanProfile.ownerId || 'guest'
  );
  const consonantsProgress = loadConsonantsProgress(
    humanProfile.ownerId || 'guest'
  );

  return `
    <div class="flex items-center justify-between gap-2 mb-3 text-left shrink-0">
      <div class="flex items-center gap-2 min-w-0">
        <button id="btn-learn-back" type="button" class="px-3 py-1.5 rounded-full bg-white/90 border border-purple-200 text-purple-800 font-bold text-xs shrink-0">← Voltar</button>
        <div class="min-w-0">
          <h2 class="font-display text-xl font-bold text-[#3b1f6e] leading-tight truncate">Vamos Aprender 🎓</h2>
          <p class="text-[11px] font-semibold text-[#6b4d9e] truncate">Trilhas educativas personalizadas com o Miau</p>
        </div>
      </div>
      <button id="modal-close" type="button" class="w-9 h-9 rounded-full bg-white/90 border border-purple-200 text-purple-800 font-bold shrink-0">✕</button>
    </div>

    <div class="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto miau-scroll pr-1 text-left">
      <!-- Context Banner linked to User Profile -->
      <div class="rounded-2xl p-3 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 border border-indigo-200 flex flex-col gap-2">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="min-w-0">
            <div class="text-[10px] font-extrabold uppercase tracking-wide text-indigo-700">Aluno(a) & Nível</div>
            <div class="text-sm font-extrabold text-[#3b1f6e] truncate">
              ${escapeHtml(firstName)}${age !== null ? ` • ${age} anos` : ''}
            </div>
          </div>
          <button
            id="btn-learn-edit-profile"
            type="button"
            class="px-2.5 py-1 rounded-full bg-white border border-indigo-200 text-[11px] font-extrabold text-indigo-700 hover:bg-indigo-50 transition shrink-0"
          >
            ${userSchooling ? '✏️ Mudar no Perfil' : '⚙️ Definir Escolaridade'}
          </button>
        </div>

        ${
          userSchooling
            ? `<div class="flex items-center gap-2 flex-wrap">
                 <span class="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${activeOption?.badgeColor || 'bg-purple-100 text-purple-800 border-purple-200'}">
                   📚 ${escapeHtml(getSchoolingLabel(userSchooling))}
                 </span>
                 ${
                   activeLevel !== userSchooling
                     ? `<span class="text-[10px] font-bold text-indigo-700">(Visualizando: ${escapeHtml(getSchoolingLabel(activeLevel))})</span>`
                     : ''
                 }
               </div>`
            : `<div class="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5">
                 Você ainda não salvou sua escolaridade no Perfil do Usuário. Mostrando sugestão inicial abaixo!
               </div>`
        }
      </div>

      <!-- Schooling Level Selector (Preview / Explore) -->
      <div>
        <div class="text-[10px] font-extrabold uppercase tracking-wide text-[#6b4d9e] mb-1.5 px-0.5">
          Explorar módulos por escolaridade
        </div>
        <div class="flex flex-wrap gap-1.5">
          ${SCHOOLING_OPTIONS.map((opt) => {
            const selected = opt.id === activeLevel;
            return `
              <button
                type="button"
                data-learn-level="${opt.id}"
                class="px-2.5 py-1 rounded-full text-[11px] font-extrabold border transition ${
                  selected
                    ? 'bg-[#6e45a5] text-white border-[#6e45a5] shadow-sm'
                    : 'bg-white/90 text-[#4c2a85] border-purple-200 hover:bg-purple-50'
                }"
              >
                ${escapeHtml(opt.label)}
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Adaptive Module Cards -->
      <div class="flex flex-col gap-2.5">
        ${tracks
          .map((track) => {
            const isLiteracy = track.id === 'infantil_letras';
            const isWriting = track.id === 'infantil_escrita';
            const isConsonants = track.id === 'infantil_consoantes';
            const isActiveTrack = isLiteracy || isWriting || isConsonants;
            const completedUnits = isLiteracy
              ? literacyProgress.completedUnits.length
              : isWriting
                ? writingProgress.completedUnits.length
                : isConsonants
                  ? consonantsProgress.completedUnits.length
                  : 0;
            const totalUnits = isLiteracy
              ? EARLY_LITERACY_UNITS.length
              : isWriting
                ? WRITING_UNITS.length
                : isConsonants
                  ? CONSONANT_UNITS.length
                  : 0;
            const totalStars = isLiteracy
              ? literacyProgress.totalStars
              : isWriting
                ? writingProgress.totalStars
                : isConsonants
                  ? consonantsProgress.totalStars
                  : 0;

            return `
              <div class="rounded-2xl p-3.5 ${
                isActiveTrack
                  ? 'bg-white border-2 border-[#7b52b8] shadow-md'
                  : 'bg-white/95 border border-purple-100 shadow-sm'
              } flex items-start gap-3">
                <div class="w-12 h-12 rounded-2xl bg-gradient-to-br ${track.accentBg} border border-white shadow-inner flex items-center justify-center text-2xl shrink-0">
                  ${track.emoji}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-start justify-between gap-2 flex-wrap">
                    <h3 class="font-display text-sm md:text-base font-bold text-[#3b1f6e] leading-snug">${escapeHtml(track.title)}</h3>
                    ${
                      isActiveTrack
                        ? `<button
                             type="button"
                             data-learn-open-track="${track.id}"
                             class="px-3.5 py-1.5 rounded-full bg-[#6e45a5] hover:bg-[#5c3691] text-white font-extrabold text-xs shadow-sm transition shrink-0"
                           >
                             ▶ ${completedUnits > 0 ? 'Continuar' : 'Começar'}
                           </button>`
                        : ''
                    }
                  </div>
                  <p class="text-[11px] text-[#5e4294] leading-snug mt-0.5">${escapeHtml(track.description)}</p>
                  <div class="mt-2 flex items-center flex-wrap gap-1.5">
                    ${track.tags
                      .map(
                        (tag) =>
                          `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-100 text-[#5a3696]">${escapeHtml(tag)}</span>`
                      )
                      .join('')}
                    <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      isActiveTrack
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }">
                      ${
                        isActiveTrack && completedUnits > 0
                          ? `✅ ${completedUnits}/${totalUnits} unidades • ★ ${totalStars}`
                          : escapeHtml(track.statusLabel)
                      }
                    </span>
                  </div>
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
