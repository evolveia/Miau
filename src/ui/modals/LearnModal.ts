import {
  EDUCATION_MODULES_BY_SCHOOLING,
  SCHOOLING_OPTIONS,
  getSchoolingLabel,
} from '../../data/educationModules';
import { calculateAgeFromBirthDate } from '../../services/userProfileService';
import type { SchoolingLevel, UserHumanProfile } from '../../types';
import { escapeHtml } from '../../utils/html';

export interface LearnModalCallbacks {
  onBackToMenu: () => void;
  onGoToProfile: () => void;
  onSelectPreviewLevel: (level: SchoolingLevel) => void;
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

  return `
    <div class="flex items-start justify-between gap-2 mb-3 text-left">
      <div class="flex items-center gap-2 min-w-0">
        <button id="btn-learn-back" type="button" class="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold text-sm shrink-0">←</button>
        <div class="min-w-0">
          <h2 class="font-display text-xl font-bold text-[#3b1f6e] leading-tight truncate">Vamos Aprender 🎓</h2>
          <p class="text-[11px] font-semibold text-[#6b4d9e] truncate">Trilhas educativas personalizadas com o Miau</p>
        </div>
      </div>
      <button id="modal-close" type="button" class="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold shrink-0">✕</button>
    </div>

    <div class="flex flex-col gap-3 overflow-y-auto miau-scroll pr-1 text-left">
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
          .map(
            (track) => `
              <div class="rounded-2xl p-3 bg-white/95 border border-purple-100 shadow-sm flex items-start gap-3">
                <div class="w-11 h-11 rounded-2xl bg-gradient-to-br ${track.accentBg} border border-white shadow-inner flex items-center justify-center text-2xl shrink-0">
                  ${track.emoji}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-start justify-between gap-2">
                    <h3 class="font-display text-sm font-bold text-[#3b1f6e] leading-snug">${escapeHtml(track.title)}</h3>
                  </div>
                  <p class="text-[11px] text-[#5e4294] leading-snug mt-0.5">${escapeHtml(track.description)}</p>
                  <div class="mt-2 flex items-center flex-wrap gap-1.5">
                    ${track.tags
                      .map(
                        (tag) =>
                          `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-100 text-[#5a3696]">${escapeHtml(tag)}</span>`
                      )
                      .join('')}
                    <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">${escapeHtml(track.statusLabel)}</span>
                  </div>
                </div>
              </div>
            `
          )
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
}
