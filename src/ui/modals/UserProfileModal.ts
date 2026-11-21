import {
  SCHOOLING_OPTIONS,
  getSchoolingLabel,
} from '../../data/educationModules';
import {
  BRAZILIAN_STATES,
  COUNTRIES,
  isBrazilCountry,
} from '../../data/locations';
import {
  calculateAgeFromBirthDate,
  captureVideoFrameToDataUrl,
  compressImageFileToDataUrl,
  hasProfileContent,
} from '../../services/userProfileService';
import type { SchoolingLevel, UserHumanProfile } from '../../types';
import { escapeHtml, sanitizeImageDataUrl } from '../../utils/html';

export interface UserProfileModalDeps {
  getProfile: () => UserHumanProfile;
  onSave: (draft: UserHumanProfile) => Promise<void>;
  onDelete: () => Promise<void>;
  onBackToMenu: () => void;
  onOpenLearn: () => void;
  onRequestRerender: () => void;
  onToast: (msg: string) => void;
}

function formatBirthDateBr(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'Não informada';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export class UserProfileModalController {
  private mode: 'view' | 'edit' = 'view';
  private draft: UserHumanProfile;
  private isSaving = false;
  private confirmDeleteOpen = false;
  private errorMessage = '';
  private cameraActive = false;
  private cameraFacing: 'user' | 'environment' = 'user';
  private cameraStream: MediaStream | null = null;
  private cameraError = '';

  constructor(private deps: UserProfileModalDeps) {
    this.draft = { ...deps.getProfile() };
  }

  public open(profile: UserHumanProfile): void {
    this.disposeCameraStream();
    this.draft = { ...profile };
    this.mode = hasProfileContent(profile) ? 'view' : 'edit';
    this.confirmDeleteOpen = false;
    this.errorMessage = '';
    this.cameraError = '';
  }

  public disposeCameraStream(): void {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore track stop errors
        }
      });
      this.cameraStream = null;
    }
    this.cameraActive = false;
  }

  public render(): string {
    const profile = this.deps.getProfile();
    const hasSaved = hasProfileContent(profile);
    const activeData = this.mode === 'edit' ? this.draft : profile;
    const safePhoto = sanitizeImageDataUrl(activeData.photoDataUrl);
    const age = calculateAgeFromBirthDate(activeData.birthDate);
    const todayIso = new Date().toISOString().slice(0, 10);

    if (this.mode === 'view' && hasSaved) {
      return `
        <div class="flex items-start justify-between gap-2 mb-3 text-left">
          <div class="flex items-center gap-2 min-w-0">
            <button id="btn-profile-back" type="button" class="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold text-sm shrink-0">←</button>
            <div class="min-w-0">
              <h2 class="font-display text-xl font-bold text-[#3b1f6e] leading-tight truncate">Perfil do Usuário 👤</h2>
              <p class="text-[11px] font-semibold text-[#6b4d9e] truncate">Seus dados salvos no jogo e aprendizado</p>
            </div>
          </div>
          <button id="modal-close" type="button" class="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold shrink-0">✕</button>
        </div>

        <div class="flex flex-col gap-3 overflow-y-auto miau-scroll pr-1 text-left">
          <div class="bg-white/95 rounded-2xl p-4 border border-purple-100 shadow-sm flex items-center gap-3.5">
            <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-200 border-2 border-white shadow overflow-hidden flex items-center justify-center shrink-0">
              ${
                safePhoto
                  ? `<img src="${safePhoto}" alt="Foto de perfil" class="w-full h-full object-cover" />`
                  : `<span class="text-3xl">👤</span>`
              }
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-display text-lg font-bold text-[#3b1f6e] truncate">${escapeHtml(profile.fullName || 'Jogador Miau')}</div>
              <div class="flex items-center gap-1.5 flex-wrap mt-1">
                ${
                  age !== null
                    ? `<span class="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">🎂 ${age} anos</span>`
                    : ''
                }
                ${
                  profile.schooling
                    ? `<span class="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">🎓 ${escapeHtml(getSchoolingLabel(profile.schooling))}</span>`
                    : ''
                }
              </div>
            </div>
          </div>

          <div class="bg-white/90 rounded-2xl p-3.5 border border-purple-100 flex flex-col gap-2 text-xs">
            <div class="flex items-center justify-between gap-2 py-1 border-b border-purple-50">
              <span class="font-bold text-[#6b4d9e]">Data de nascimento</span>
              <span class="font-extrabold text-[#3b1f6e]">${escapeHtml(formatBirthDateBr(profile.birthDate))}${age !== null ? ` (${age} anos)` : ''}</span>
            </div>
            <div class="flex items-center justify-between gap-2 py-1 border-b border-purple-50">
              <span class="font-bold text-[#6b4d9e]">Escolaridade</span>
              <span class="font-extrabold text-[#3b1f6e]">${escapeHtml(getSchoolingLabel(profile.schooling))}</span>
            </div>
            <div class="flex items-center justify-between gap-2 py-1 border-b border-purple-50">
              <span class="font-bold text-[#6b4d9e]">Estado</span>
              <span class="font-extrabold text-[#3b1f6e]">${escapeHtml(profile.state || 'Não informado')}</span>
            </div>
            <div class="flex items-center justify-between gap-2 py-1">
              <span class="font-bold text-[#6b4d9e]">País</span>
              <span class="font-extrabold text-[#3b1f6e]">${escapeHtml(profile.country || 'Brasil')}</span>
            </div>
          </div>

          <button
            id="btn-profile-edit"
            type="button"
            class="w-full py-2.5 rounded-2xl bg-gradient-to-r from-[#784eb8] to-[#5a3696] text-white font-display font-bold text-sm shadow-md hover:brightness-105 transition"
          >
            ✏️ Editar / Atualizar Perfil
          </button>

          <button
            id="btn-profile-learn"
            type="button"
            class="w-full py-2.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-800 font-bold text-xs hover:bg-indigo-100/70 transition"
          >
            🎓 Abrir "Vamos Aprender" para minha escolaridade
          </button>

          ${
            this.confirmDeleteOpen
              ? `<div class="rounded-2xl p-3 bg-rose-50 border border-rose-200 flex flex-col gap-2">
                   <p class="text-[11px] font-bold text-rose-800">Deseja realmente limpar e excluir os dados do Perfil do Usuário?</p>
                   <div class="flex gap-2">
                     <button id="btn-profile-confirm-delete" type="button" class="flex-1 py-2 rounded-xl bg-rose-600 text-white text-xs font-extrabold hover:bg-rose-700">Confirmar Exclusão</button>
                     <button id="btn-profile-cancel-delete" type="button" class="flex-1 py-2 rounded-xl bg-white border border-rose-200 text-rose-700 text-xs font-extrabold">Cancelar</button>
                   </div>
                 </div>`
              : `<button id="btn-profile-ask-delete" type="button" class="w-full py-2 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-extrabold hover:bg-rose-100 transition">
                   🗑️ Limpar / Excluir Perfil
                 </button>`
          }
        </div>
      `;
    }

    const isPresetCountry = COUNTRIES.some(
      (c) => c !== 'Outro' && c.toLowerCase() === activeData.country.trim().toLowerCase()
    );
    const selectCountryValue =
      activeData.country.trim() === ''
        ? 'Brasil'
        : isPresetCountry
          ? COUNTRIES.find(
              (c) =>
                c.toLowerCase() === activeData.country.trim().toLowerCase()
            ) || 'Brasil'
          : 'Outro';
    const isBrazil = isBrazilCountry(
      selectCountryValue === 'Outro' ? activeData.country : selectCountryValue
    );

    return `
      <div class="flex items-start justify-between gap-2 mb-3 text-left">
        <div class="flex items-center gap-2 min-w-0">
          <button id="btn-profile-back" type="button" class="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold text-sm shrink-0">←</button>
          <div class="min-w-0">
            <h2 class="font-display text-xl font-bold text-[#3b1f6e] leading-tight truncate">${hasSaved ? 'Editar Perfil 👤' : 'Criar Perfil 👤'}</h2>
            <p class="text-[11px] font-semibold text-[#6b4d9e] truncate">Foto, idade automática, escolaridade e região</p>
          </div>
        </div>
        <button id="modal-close" type="button" class="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold shrink-0">✕</button>
      </div>

      <form id="user-profile-form" class="flex flex-col gap-3 overflow-y-auto miau-scroll pr-1 text-left">
        ${
          this.errorMessage
            ? `<div class="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">${escapeHtml(this.errorMessage)}</div>`
            : ''
        }

        <!-- Photo Section -->
        <div class="bg-white/95 rounded-2xl p-3 border border-purple-100 flex flex-col gap-2.5">
          <div class="flex items-center gap-3">
            <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-200 border-2 border-white shadow overflow-hidden flex items-center justify-center shrink-0">
              ${
                safePhoto
                  ? `<img id="up-photo-preview" src="${safePhoto}" alt="Foto do perfil" class="w-full h-full object-cover" />`
                  : `<span class="text-3xl">👤</span>`
              }
            </div>
            <div class="flex-1 min-w-0 flex flex-col gap-1.5">
              <div class="text-xs font-extrabold text-[#3b1f6e]">Foto de Perfil</div>
              <div class="flex flex-wrap gap-1.5">
                <button id="btn-up-upload" type="button" class="px-2.5 py-1.5 rounded-xl bg-purple-100 text-[#4c2a85] text-[11px] font-extrabold hover:bg-purple-200 transition">
                  📁 Fazer Upload
                </button>
                <button id="btn-up-camera" type="button" class="px-2.5 py-1.5 rounded-xl bg-sky-100 text-sky-800 text-[11px] font-extrabold hover:bg-sky-200 transition">
                  📷 Capturar Foto
                </button>
                ${
                  safePhoto
                    ? `<button id="btn-up-remove-photo" type="button" class="px-2 py-1.5 rounded-xl bg-rose-50 text-rose-700 text-[11px] font-extrabold hover:bg-rose-100 transition">Remover</button>`
                    : ''
                }
              </div>
              <input id="up-photo-file" type="file" accept="image/*" class="hidden" />
            </div>
          </div>

          ${
            this.cameraError
              ? `<div class="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-2">${escapeHtml(this.cameraError)}</div>`
              : ''
          }

          ${
            this.cameraActive
              ? `<div class="rounded-2xl overflow-hidden bg-slate-950 border border-purple-200 p-2 flex flex-col gap-2">
                   <video id="up-camera-video" autoplay playsinline muted class="w-full max-h-44 rounded-xl object-cover bg-black"></video>
                   <div class="flex gap-2">
                     <button id="btn-up-snap" type="button" class="flex-1 py-2 rounded-xl bg-emerald-500 text-white text-xs font-extrabold hover:bg-emerald-600">📸 Bater Foto</button>
                     <button id="btn-up-flip" type="button" class="px-3 py-2 rounded-xl bg-white/15 text-white text-xs font-extrabold hover:bg-white/25">🔄</button>
                     <button id="btn-up-cam-cancel" type="button" class="px-3 py-2 rounded-xl bg-rose-500/90 text-white text-xs font-extrabold hover:bg-rose-600">Fechar</button>
                   </div>
                 </div>`
              : ''
          }
        </div>

        <!-- Nome -->
        <div class="bg-white/95 rounded-2xl p-3 border border-purple-100 flex flex-col gap-2.5">
          <div>
            <label for="up-fullname" class="block text-[11px] font-extrabold text-[#5e4294] mb-1">Nome</label>
            <input
              id="up-fullname"
              type="text"
              maxlength="100"
              placeholder="Seu nome ou apelido"
              value="${escapeHtml(activeData.fullName)}"
              class="w-full rounded-xl bg-[#f4effb] border border-purple-100 px-3 py-2 text-xs font-bold text-[#3b1f6e] placeholder-[#947ebe] focus:outline-none focus:border-purple-400"
            />
          </div>

          <!-- Data de Nascimento & Idade em tempo real -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <label for="up-birthdate" class="text-[11px] font-extrabold text-[#5e4294]">Data de Nascimento</label>
              <span id="up-age-badge" class="text-[11px] font-extrabold px-2 py-0.5 rounded-full ${age !== null ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-[#6b4d9e]'}">
                ${age !== null ? `${age} anos` : 'Idade automática'}
              </span>
            </div>
            <input
              id="up-birthdate"
              type="date"
              max="${todayIso}"
              value="${escapeHtml(activeData.birthDate)}"
              class="w-full rounded-xl bg-[#f4effb] border border-purple-100 px-3 py-2 text-xs font-bold text-[#3b1f6e] focus:outline-none focus:border-purple-400"
            />
          </div>

          <!-- Escolaridade -->
          <div>
            <label for="up-schooling" class="block text-[11px] font-extrabold text-[#5e4294] mb-1">Escolaridade</label>
            <select
              id="up-schooling"
              class="w-full rounded-xl bg-[#f4effb] border border-purple-100 px-3 py-2 text-xs font-bold text-[#3b1f6e] focus:outline-none focus:border-purple-400"
            >
              <option value="">Selecione sua escolaridade...</option>
              ${SCHOOLING_OPTIONS.map(
                (opt) =>
                  `<option value="${opt.id}" ${activeData.schooling === opt.id ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`
              ).join('')}
            </select>
          </div>

          <!-- País & Estado -->
          <div class="grid grid-cols-1 gap-2">
            <div>
              <label for="up-country-select" class="block text-[11px] font-extrabold text-[#5e4294] mb-1">País</label>
              <select
                id="up-country-select"
                class="w-full rounded-xl bg-[#f4effb] border border-purple-100 px-3 py-2 text-xs font-bold text-[#3b1f6e] focus:outline-none focus:border-purple-400"
              >
                ${COUNTRIES.map(
                  (c) =>
                    `<option value="${escapeHtml(c)}" ${selectCountryValue === c ? 'selected' : ''}>${escapeHtml(c)}</option>`
                ).join('')}
              </select>
              ${
                selectCountryValue === 'Outro'
                  ? `<input
                       id="up-country-custom"
                       type="text"
                       maxlength="60"
                       placeholder="Digite seu país"
                       value="${escapeHtml(activeData.country === 'Outro' ? '' : activeData.country)}"
                       class="mt-1.5 w-full rounded-xl bg-[#f4effb] border border-purple-100 px-3 py-2 text-xs font-bold text-[#3b1f6e] focus:outline-none focus:border-purple-400"
                     />`
                  : ''
              }
            </div>

            <div>
              <label for="up-state" class="block text-[11px] font-extrabold text-[#5e4294] mb-1">Estado</label>
              ${
                isBrazil
                  ? `<select
                       id="up-state"
                       class="w-full rounded-xl bg-[#f4effb] border border-purple-100 px-3 py-2 text-xs font-bold text-[#3b1f6e] focus:outline-none focus:border-purple-400"
                     >
                       <option value="">Selecione o estado...</option>
                       ${BRAZILIAN_STATES.map((st) => {
                         const val = `${st.name} (${st.code})`;
                         const isSelected =
                           activeData.state === val ||
                           activeData.state === st.name ||
                           activeData.state === st.code;
                         return `<option value="${escapeHtml(val)}" ${isSelected ? 'selected' : ''}>${escapeHtml(st.name)} (${st.code})</option>`;
                       }).join('')}
                     </select>`
                  : `<input
                       id="up-state"
                       type="text"
                       maxlength="60"
                       placeholder="Estado / Província / Região"
                       value="${escapeHtml(activeData.state)}"
                       class="w-full rounded-xl bg-[#f4effb] border border-purple-100 px-3 py-2 text-xs font-bold text-[#3b1f6e] focus:outline-none focus:border-purple-400"
                     />`
              }
            </div>
          </div>
        </div>

        <!-- CRUD Action Buttons -->
        <div class="flex flex-col gap-2">
          <button
            type="submit"
            ${this.isSaving ? 'disabled' : ''}
            class="w-full py-3 rounded-2xl bg-gradient-to-r from-[#784eb8] to-[#5a3696] text-white font-display font-bold text-sm shadow-md hover:brightness-105 disabled:opacity-60 transition"
          >
            ${
              this.isSaving
                ? 'Salvando...'
                : hasSaved
                  ? '✅ Atualizar Perfil'
                  : '💾 Salvar Perfil'
            }
          </button>

          ${
            hasSaved
              ? `<button id="btn-up-cancel-edit" type="button" class="w-full py-2 rounded-2xl bg-white border border-purple-200 text-[#4c2a85] text-xs font-extrabold hover:bg-purple-50 transition">Cancelar Edição</button>`
              : ''
          }
        </div>
      </form>
    `;
  }

  public bind(root: HTMLElement): void {
    root.querySelector('#btn-profile-back')?.addEventListener('click', () => {
      this.disposeCameraStream();
      this.deps.onBackToMenu();
    });

    if (this.mode === 'view') {
      root.querySelector('#btn-profile-edit')?.addEventListener('click', () => {
        this.draft = { ...this.deps.getProfile() };
        this.mode = 'edit';
        this.confirmDeleteOpen = false;
        this.errorMessage = '';
        this.deps.onRequestRerender();
      });

      root.querySelector('#btn-profile-learn')?.addEventListener('click', () => {
        this.deps.onOpenLearn();
      });

      root
        .querySelector('#btn-profile-ask-delete')
        ?.addEventListener('click', () => {
          this.confirmDeleteOpen = true;
          this.deps.onRequestRerender();
        });

      root
        .querySelector('#btn-profile-cancel-delete')
        ?.addEventListener('click', () => {
          this.confirmDeleteOpen = false;
          this.deps.onRequestRerender();
        });

      root
        .querySelector('#btn-profile-confirm-delete')
        ?.addEventListener('click', async () => {
          this.confirmDeleteOpen = false;
          await this.deps.onDelete();
          this.draft = { ...this.deps.getProfile() };
          this.mode = 'edit';
          this.deps.onRequestRerender();
        });
      return;
    }

    // Attach active stream to <video> if camera is open
    const videoEl = root.querySelector(
      '#up-camera-video'
    ) as HTMLVideoElement | null;
    if (this.cameraActive && this.cameraStream && videoEl) {
      videoEl.srcObject = this.cameraStream;
      void videoEl.play().catch(() => {});
    }

    const nameInput = root.querySelector(
      '#up-fullname'
    ) as HTMLInputElement | null;
    const birthInput = root.querySelector(
      '#up-birthdate'
    ) as HTMLInputElement | null;
    const ageBadge = root.querySelector('#up-age-badge') as HTMLElement | null;
    const schoolingSelect = root.querySelector(
      '#up-schooling'
    ) as HTMLSelectElement | null;
    const countrySelect = root.querySelector(
      '#up-country-select'
    ) as HTMLSelectElement | null;
    const customCountryInput = root.querySelector(
      '#up-country-custom'
    ) as HTMLInputElement | null;
    const stateField = root.querySelector('#up-state') as
      | HTMLSelectElement
      | HTMLInputElement
      | null;
    const fileInput = root.querySelector(
      '#up-photo-file'
    ) as HTMLInputElement | null;

    const syncDraftFromDom = () => {
      if (nameInput) this.draft.fullName = nameInput.value;
      if (birthInput) this.draft.birthDate = birthInput.value;
      if (schoolingSelect) {
        this.draft.schooling = schoolingSelect.value as SchoolingLevel | '';
      }
      if (countrySelect) {
        this.draft.country =
          countrySelect.value === 'Outro'
            ? customCountryInput?.value || 'Outro'
            : countrySelect.value;
      }
      if (stateField) {
        this.draft.state = stateField.value;
      }
    };

    nameInput?.addEventListener('input', () => {
      this.draft.fullName = nameInput.value;
    });

    birthInput?.addEventListener('input', () => {
      this.draft.birthDate = birthInput.value;
      const computedAge = calculateAgeFromBirthDate(birthInput.value);
      if (ageBadge) {
        ageBadge.textContent =
          computedAge !== null ? `${computedAge} anos` : 'Idade automática';
        ageBadge.className = `text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
          computedAge !== null
            ? 'bg-amber-100 text-amber-800'
            : 'bg-purple-100 text-[#6b4d9e]'
        }`;
      }
    });

    schoolingSelect?.addEventListener('change', () => {
      this.draft.schooling = schoolingSelect.value as SchoolingLevel | '';
    });

    countrySelect?.addEventListener('change', () => {
      const next = countrySelect.value;
      const wasBrazil = isBrazilCountry(this.draft.country);
      const nowBrazil = isBrazilCountry(next);
      this.draft.country = next === 'Outro' ? '' : next;
      if (wasBrazil !== nowBrazil) {
        this.draft.state = '';
      }
      this.deps.onRequestRerender();
    });

    customCountryInput?.addEventListener('input', () => {
      this.draft.country = customCountryInput.value;
    });

    stateField?.addEventListener('change', () => {
      this.draft.state = stateField.value;
    });
    stateField?.addEventListener('input', () => {
      this.draft.state = stateField.value;
    });

    root.querySelector('#btn-up-upload')?.addEventListener('click', () => {
      syncDraftFromDom();
      fileInput?.click();
    });

    fileInput?.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      try {
        this.errorMessage = '';
        this.draft.photoDataUrl = await compressImageFileToDataUrl(file);
        this.disposeCameraStream();
        this.deps.onRequestRerender();
      } catch (err) {
        this.errorMessage =
          err instanceof Error
            ? err.message
            : 'Erro ao carregar a foto escolhida.';
        this.deps.onRequestRerender();
      }
    });

    const startCamera = async () => {
      syncDraftFromDom();
      this.cameraError = '';
      this.disposeCameraStream();
      if (!navigator.mediaDevices?.getUserMedia) {
        this.cameraError =
          'Captura de câmera indisponível neste navegador. Use "Fazer Upload"!';
        this.deps.onRequestRerender();
        return;
      }
      try {
        this.cameraStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: this.cameraFacing,
            width: { ideal: 640 },
            height: { ideal: 640 },
          },
          audio: false,
        });
        this.cameraActive = true;
        this.deps.onRequestRerender();
      } catch {
        this.cameraError =
          'Não foi possível acessar a câmera. Permita o uso ou escolha uma foto por Upload.';
        this.disposeCameraStream();
        this.deps.onRequestRerender();
      }
    };

    root.querySelector('#btn-up-camera')?.addEventListener('click', () => {
      void startCamera();
    });

    root.querySelector('#btn-up-flip')?.addEventListener('click', () => {
      this.cameraFacing =
        this.cameraFacing === 'user' ? 'environment' : 'user';
      void startCamera();
    });

    root.querySelector('#btn-up-snap')?.addEventListener('click', () => {
      const v = root.querySelector('#up-camera-video') as HTMLVideoElement | null;
      if (!v) return;
      try {
        this.draft.photoDataUrl = captureVideoFrameToDataUrl(v);
        this.disposeCameraStream();
        this.cameraError = '';
        this.deps.onToast('Foto capturada com sucesso!');
        this.deps.onRequestRerender();
      } catch (err) {
        this.cameraError =
          err instanceof Error ? err.message : 'Erro ao capturar foto.';
        this.deps.onRequestRerender();
      }
    });

    root.querySelector('#btn-up-cam-cancel')?.addEventListener('click', () => {
      this.disposeCameraStream();
      this.deps.onRequestRerender();
    });

    root.querySelector('#btn-up-remove-photo')?.addEventListener('click', () => {
      syncDraftFromDom();
      this.draft.photoDataUrl = '';
      this.deps.onRequestRerender();
    });

    root.querySelector('#btn-up-cancel-edit')?.addEventListener('click', () => {
      this.disposeCameraStream();
      this.draft = { ...this.deps.getProfile() };
      this.mode = 'view';
      this.errorMessage = '';
      this.deps.onRequestRerender();
    });

    root
      .querySelector('#user-profile-form')
      ?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (this.isSaving) return;
        syncDraftFromDom();

        if (!this.draft.fullName.trim()) {
          this.errorMessage = 'Informe seu nome para salvar o perfil.';
          this.deps.onRequestRerender();
          return;
        }
        if (
          this.draft.birthDate &&
          calculateAgeFromBirthDate(this.draft.birthDate) === null
        ) {
          this.errorMessage = 'Informe uma data de nascimento válida.';
          this.deps.onRequestRerender();
          return;
        }

        this.isSaving = true;
        this.errorMessage = '';
        this.deps.onRequestRerender();
        try {
          this.disposeCameraStream();
          await this.deps.onSave({ ...this.draft });
          this.mode = 'view';
          this.deps.onRequestRerender();
        } catch (err) {
          this.errorMessage =
            err instanceof Error
              ? err.message
              : 'Não foi possível salvar o perfil.';
          this.deps.onRequestRerender();
        } finally {
          this.isSaving = false;
        }
      });
  }
}
