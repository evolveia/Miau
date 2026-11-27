import { ACHIEVEMENTS, ROUTINE_SCHEDULE } from '../../constants';
import { getSchoolingLabel } from '../../data/educationModules';
import { pwaService } from '../../services/pwaService';
import {
  calculateAgeFromBirthDate,
  hasProfileContent,
} from '../../services/userProfileService';
import type { UserHumanProfile } from '../../types';
import { escapeHtml, sanitizeImageDataUrl } from '../../utils/html';

export interface MenuModalRenderParams {
  accountLabel: string;
  isFirebaseAccount: boolean;
  humanProfile: UserHumanProfile;
  unlockedCount: number;
  routineDoneCount: number;
  visibleHudCount: number;
}

export function renderMenuModalHtml(params: MenuModalRenderParams): string {
  const { humanProfile } = params;
  const safePhoto = sanitizeImageDataUrl(humanProfile.photoDataUrl);
  const age = calculateAgeFromBirthDate(humanProfile.birthDate);
  const schoolingLabel = getSchoolingLabel(humanProfile.schooling);
  const hasProfile = hasProfileContent(humanProfile);
  const displayName =
    humanProfile.fullName.trim() || params.accountLabel || 'Jogador Miau';
  const locationParts = [humanProfile.state.trim(), humanProfile.country.trim()].filter(
    Boolean
  );
  const locationStr = locationParts.join(' • ');

  return `
    <div class="flex items-center justify-between gap-2 mb-3 text-left shrink-0">
      <div class="flex items-center gap-2 min-w-0">
        <button data-modal-close type="button" class="px-3 py-1.5 rounded-full bg-white/90 border border-purple-200 text-[#4c2a85] font-extrabold text-xs shadow-sm hover:bg-purple-50 transition shrink-0">← Voltar</button>
        <div class="text-left min-w-0">
          <h2 class="font-display text-xl font-bold text-[#3b1f6e] leading-tight truncate">Menu do Jogo 🐾</h2>
          <p class="text-[11px] font-semibold text-[#6b4d9e] truncate">Perfil, aprendizado, modos e configurações</p>
        </div>
      </div>
      <button id="modal-close" type="button" class="w-9 h-9 rounded-full bg-white/90 border border-purple-200 text-purple-800 font-bold shrink-0">✕</button>
    </div>

    <div class="flex-1 min-h-0 flex flex-col gap-2.5 overflow-y-auto miau-scroll pr-1 text-left">
      <!-- Perfil do Usuário Card -->
      <button
        id="btn-menu-profile"
        type="button"
        class="w-full rounded-2xl p-3 bg-white/95 border border-purple-200 shadow-sm flex items-center gap-3 text-left hover:bg-purple-50/70 transition"
      >
        <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-200 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center shrink-0">
          ${
            safePhoto
              ? `<img src="${safePhoto}" alt="Foto do usuário" class="w-full h-full object-cover" />`
              : `<span class="text-2xl">👤</span>`
          }
        </div>
        <div class="flex-1 min-w-0 text-left">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-[10px] font-extrabold uppercase tracking-wide text-[#7a52b8]">Perfil do Usuário</span>
            <span class="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-purple-100 text-[#6e45a5]">${params.isFirebaseAccount ? 'Conta Google/E-mail' : 'Local'}</span>
          </div>
          <div class="text-sm font-extrabold text-[#3b1f6e] truncate">${escapeHtml(displayName)}</div>
          <div class="text-[11px] font-semibold text-[#6b4d9e] truncate">
            ${
              hasProfile
                ? [
                    age !== null ? `${age} anos` : '',
                    humanProfile.schooling ? schoolingLabel : '',
                    locationStr,
                  ]
                    .filter(Boolean)
                    .join(' • ') || 'Toque para atualizar dados'
                : 'Toque para cadastrar foto, idade e escolaridade'
            }
          </div>
        </div>
        <span class="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-purple-100 text-[#5a3696] shrink-0">
          ${hasProfile ? 'Editar' : 'Criar'}
        </span>
      </button>

      <!-- Card Destaque: Vamos Aprender -->
      <button
        id="btn-menu-learn"
        type="button"
        class="w-full py-2.5 px-3 rounded-2xl bg-gradient-to-r from-[#eef6ff] via-[#f3ebff] to-[#e9f7f4] border-2 border-indigo-200 text-[#3b1f6e] font-bold text-sm flex items-center gap-3 text-left shadow-sm hover:brightness-[0.98] transition"
      >
        <span class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 text-white flex items-center justify-center text-xl shadow-sm shrink-0">🎓</span>
        <div class="flex-1 min-w-0 text-left">
          <div class="font-display font-bold text-[15px] leading-tight text-[#3b1f6e]">Vamos Aprender</div>
          <div class="text-[11px] font-semibold text-[#5b468f] truncate">
            ${
              humanProfile.schooling
                ? `Trilhas para ${escapeHtml(schoolingLabel)}`
                : 'Defina sua escolaridade no perfil para personalizar'
            }
          </div>
        </div>
        <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 shrink-0">
          ${humanProfile.schooling ? 'Adaptado' : 'Configurar'}
        </span>
      </button>

      <button id="btn-menu-progress-report" class="w-full py-2.5 px-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 font-bold text-sm flex items-center gap-3 text-left hover:bg-emerald-100/70 transition">
        <span class="w-9 h-9 rounded-xl bg-emerald-200/80 flex items-center justify-center text-lg shrink-0">📊</span>
        <div class="flex-1 min-w-0 text-left">
          <div class="font-bold leading-tight">Relatório de Progresso</div>
          <div class="text-[11px] font-semibold text-emerald-800/85">Lições completas e barras por módulo</div>
        </div>
        <span class="text-xs font-extrabold bg-emerald-200/80 px-2.5 py-0.5 rounded-full shrink-0">Ver</span>
      </button>

      <button id="btn-menu-routine" class="w-full py-2.5 px-3 rounded-2xl bg-sky-50 border border-sky-200 text-sky-900 font-bold text-sm flex items-center gap-3 text-left hover:bg-sky-100/70 transition">
        <span class="w-9 h-9 rounded-xl bg-sky-200/70 flex items-center justify-center text-lg shrink-0">📅</span>
        <div class="flex-1 min-w-0 text-left">
          <div class="font-bold leading-tight">Rotina Diária do Miau</div>
          <div class="text-[11px] font-semibold text-sky-700/85">Comida, banho e soneca com bônus</div>
        </div>
        <span class="text-xs font-extrabold bg-sky-200/80 px-2.5 py-0.5 rounded-full shrink-0">${params.routineDoneCount}/${ROUTINE_SCHEDULE.length}</span>
      </button>

      <button id="btn-menu-ranking" class="w-full py-2.5 px-3 rounded-2xl bg-purple-50 border border-purple-200 text-[#3b1f6e] font-bold text-sm flex items-center gap-3 text-left hover:bg-purple-100/70 transition">
        <span class="w-9 h-9 rounded-xl bg-purple-200/70 flex items-center justify-center text-lg shrink-0">🎮</span>
        <div class="flex-1 min-w-0 text-left">
          <div class="font-bold leading-tight">Ranking dos Minijogos</div>
          <div class="text-[11px] font-semibold text-[#6b4d9e]">Melhores pontuações e fases</div>
        </div>
        <span class="text-xs font-extrabold bg-purple-200/80 px-2.5 py-0.5 rounded-full shrink-0">Top</span>
      </button>

      <button id="btn-menu-achievements" class="w-full py-2.5 px-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 font-bold text-sm flex items-center gap-3 text-left hover:bg-amber-100/70 transition">
        <span class="w-9 h-9 rounded-xl bg-amber-200/70 flex items-center justify-center text-lg shrink-0">🏆</span>
        <div class="flex-1 min-w-0 text-left">
          <div class="font-bold leading-tight">Conquistas do Miau</div>
          <div class="text-[11px] font-semibold text-amber-700/85">Medalhas e metas desbloqueadas</div>
        </div>
        <span class="text-xs font-extrabold bg-amber-200/80 px-2.5 py-0.5 rounded-full shrink-0">${params.unlockedCount}/${ACHIEVEMENTS.length}</span>
      </button>

      <button id="btn-open-settings" class="w-full py-2.5 px-3 rounded-2xl bg-white/90 border border-purple-200 text-[#3b1f6e] font-bold text-sm flex items-center gap-3 text-left hover:bg-purple-50 transition">
        <span class="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-lg shrink-0">⚙️</span>
        <div class="flex-1 min-w-0 text-left">
          <div class="font-bold leading-tight">Configurações da Tela</div>
          <div class="text-[11px] font-semibold text-[#6b4d9e]">Notificações push, áudio, câmera e HUD</div>
        </div>
        <span class="text-[11px] font-extrabold bg-purple-100 text-[#6e45a5] px-2.5 py-0.5 rounded-full shrink-0">${params.visibleHudCount === 4 ? 'Completo' : params.visibleHudCount === 0 ? 'Limpo' : `${params.visibleHudCount}/4 itens`}</span>
      </button>

      <button id="btn-menu-parental" class="w-full py-2.5 px-3 rounded-2xl bg-indigo-50 border border-indigo-200 text-[#3b1f6e] font-bold text-sm flex items-center gap-3 text-left hover:bg-indigo-100/70 transition">
        <span class="w-9 h-9 rounded-xl bg-indigo-200/80 flex items-center justify-center text-lg shrink-0">🛡️</span>
        <div class="flex-1 min-w-0 text-left">
          <div class="font-bold leading-tight">Área dos Responsáveis</div>
          <div class="text-[11px] font-semibold text-[#5b468f]">Tempo de tela, resumo semanal, silêncio e PIN</div>
        </div>
        <span class="text-[11px] font-extrabold bg-indigo-200/80 text-indigo-900 px-2.5 py-0.5 rounded-full shrink-0">Pais</span>
      </button>

      ${
        !pwaService.isInstalled
          ? `<button id="btn-menu-install" class="w-full py-2.5 px-3 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white font-display font-bold text-sm shadow-md flex items-center gap-3 text-left hover:brightness-110 transition">
               <span class="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-lg shrink-0">📲</span>
               <div class="flex-1 min-w-0 text-left">
                 <div class="font-bold leading-tight">Instalar App Miau</div>
                 <div class="text-[11px] font-normal text-white/85">Adicionar aplicativo à tela inicial</div>
               </div>
               <span class="text-[10px] font-extrabold bg-white/25 px-2 py-0.5 rounded-full shrink-0">PWA</span>
             </button>`
          : ''
      }

      <button id="btn-open-ar" class="w-full py-2.5 px-3 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-display font-bold shadow-md flex items-center gap-3 text-left hover:brightness-110 transition">
        <span class="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-lg shrink-0">📸</span>
        <div class="flex-1 min-w-0 text-left">
          <div class="font-bold leading-tight">Realidade Aumentada</div>
          <div class="text-[11px] font-normal text-white/85">Interagir com câmera e tirar foto</div>
        </div>
        <span class="text-xs font-extrabold text-white/90 shrink-0">›</span>
      </button>

      <button id="btn-enter-xr" class="w-full py-2.5 px-3 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-700 text-white font-display font-bold shadow-md flex items-center gap-3 text-left hover:brightness-110 transition">
        <span class="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-lg shrink-0">🥽</span>
        <div class="flex-1 min-w-0 text-left">
          <div class="font-bold leading-tight">Sala 3D / Modo XR</div>
          <div class="text-[11px] font-normal text-white/85">Explorar, girar e brincar em 3D</div>
        </div>
        <span class="text-xs font-extrabold text-white/90 shrink-0">›</span>
      </button>

      <button id="btn-open-support" class="w-full py-2.5 px-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-sm flex items-center gap-3 text-left hover:bg-emerald-100/70 transition">
        <span class="w-9 h-9 rounded-xl bg-emerald-200/75 flex items-center justify-center text-lg shrink-0">💬</span>
        <div class="flex-1 min-w-0 text-left">
          <div class="font-bold leading-tight">Suporte & Dúvidas</div>
          <div class="text-[11px] font-semibold text-emerald-700/85">Atendimento direto por mensagem</div>
        </div>
        <span class="text-[11px] font-extrabold bg-emerald-200/80 px-2.5 py-0.5 rounded-full shrink-0">WhatsApp</span>
      </button>

      <button id="btn-logout" class="w-full py-2.5 px-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 font-bold text-sm flex items-center gap-3 text-left hover:bg-rose-100 transition">
        <span class="w-9 h-9 rounded-xl bg-rose-200/60 flex items-center justify-center text-lg shrink-0">🚪</span>
        <div class="flex-1 min-w-0 text-left">
          <div class="font-bold leading-tight">Sair da Conta</div>
          <div class="text-[11px] font-semibold text-rose-600/80">Trocar de perfil ou desconectar</div>
        </div>
        <span class="text-xs font-extrabold text-rose-500 shrink-0">›</span>
      </button>
    </div>
  `;
}
