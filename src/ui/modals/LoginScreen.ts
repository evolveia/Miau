import { pwaService } from '../../services/pwaService';
import { escapeHtml } from '../../utils/html';

export interface LoginScreenRenderParams {
  authMode: 'login' | 'register' | 'forgot';
  showPassword: boolean;
  authError: string;
  authNotice: string;
  showLegalModal: boolean;
  legalDoc: 'terms' | 'privacy';
  installGuideHtml: string;
}

export interface LoginEventHandlers {
  onTogglePassword: (savedEmail: string, savedPw: string) => void;
  onSwitchMode: (mode: 'login' | 'register' | 'forgot') => void;
  onGoogleSignIn: () => Promise<void>;
  onSubmitCredentials: (emailOrUser: string, password: string) => Promise<void>;
  onOpenLegal: (doc: 'terms' | 'privacy') => void;
  onCloseLegal: () => void;
  onInstallApp: () => void;
  onCloseInstallGuide: () => void;
}

export function renderLegalModalHtml(legalDoc: 'terms' | 'privacy'): string {
  const isTerms = legalDoc === 'terms';
  return `
    <div class="fixed inset-0 z-50 bg-purple-950/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="w-full max-w-sm glass-card rounded-3xl p-6 text-[#3b1f6e]">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-display text-xl font-bold">${isTerms ? 'Termos de Uso' : 'Políticas de Privacidade'}</h2>
          <button id="close-legal" class="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold">✕</button>
        </div>
        <p class="text-xs leading-relaxed text-[#583b8c]">
          ${
            isTerms
              ? 'O jogo Miau é um bichinho virtual interativo com inteligência artificial. As moedas e itens do jogo são virtuais e destinam-se exclusivamente ao entretenimento na Sala de Estar e Modo XR.'
              : 'Seus dados de conta Google, perfil do usuário e progresso do Miau (nível, moedas, roupas e conversas) são armazenados com segurança no Firebase Firestore vinculados exclusivamente ao seu perfil autenticado.'
          }
        </p>
      </div>
    </div>
  `;
}

export function renderLoginScreenHtml(params: LoginScreenRenderParams): string {
  const titleLabel =
    params.authMode === 'register'
      ? 'Criar acesso'
      : params.authMode === 'forgot'
        ? 'Recuperar senha'
        : 'Miau';

  return `
    <div class="w-full h-full miau-wallpaper flex items-center justify-center p-4 overflow-y-auto">
      <div class="w-full max-w-[390px] min-h-[600px] glass-card rounded-[38px] p-7 flex flex-col justify-between relative">
        <!-- Top Brand -->
        <div class="flex flex-col items-center pt-2">
          <div class="relative w-24 h-24 rounded-full bg-white/80 border-2 border-white shadow-md flex items-center justify-center mb-3">
            <svg class="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="46" stroke="rgba(167,139,250,0.3)" stroke-width="5" fill="none"/>
              <circle cx="50" cy="50" r="46" stroke="#7c52b8" stroke-width="5" stroke-linecap="round" fill="none" stroke-dasharray="289" stroke-dashoffset="90"/>
            </svg>
            <svg viewBox="0 0 80 80" class="w-14 h-14">
              <path d="M26 52 C26 40, 54 40, 54 52 C54 61, 46 66, 40 66 C34 66, 26 61, 26 52 Z" fill="#f7c8c0" stroke="#3b1f6e" stroke-width="3.5"/>
              <ellipse cx="22" cy="34" rx="6" ry="7.5" fill="#f7c8c0" stroke="#3b1f6e" stroke-width="3" transform="rotate(-14 22 34)"/>
              <ellipse cx="34" cy="25" rx="6" ry="8" fill="#f7c8c0" stroke="#3b1f6e" stroke-width="3"/>
              <ellipse cx="47" cy="25" rx="6" ry="8" fill="#f7c8c0" stroke="#3b1f6e" stroke-width="3"/>
              <ellipse cx="58" cy="34" rx="6" ry="7.5" fill="#f7c8c0" stroke="#3b1f6e" stroke-width="3" transform="rotate(14 58 34)"/>
            </svg>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-purple-400 text-lg">🐾</span>
            <h1 class="font-display text-4xl font-bold text-[#4c2a85]">${titleLabel}</h1>
            <span class="text-purple-400 text-lg">🐾</span>
          </div>
          <p class="text-xs font-semibold text-[#7b5ea7] mt-1">Seu bichinho virtual com inteligência artificial</p>
        </div>

        <!-- Form Card -->
        <form id="login-form" class="bg-white/85 rounded-3xl p-5 shadow-sm border border-white flex flex-col gap-3.5 my-4">
          ${
            params.authError
              ? `<div class="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">${escapeHtml(params.authError)}</div>`
              : ''
          }
          ${
            params.authNotice
              ? `<div class="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">${escapeHtml(params.authNotice)}</div>`
              : ''
          }

          <div class="relative flex items-center bg-[#efeaf8] rounded-xl px-3.5 py-2.5 border border-purple-100 focus-within:border-purple-400">
            <span class="text-[#7b5ea7] mr-2.5 text-base">👤</span>
            <input
              id="login-email"
              type="text"
              placeholder="E-mail ou Usuário"
              required
              class="w-full bg-transparent text-sm text-[#3b1f6e] placeholder-[#8c78ad] focus:outline-none"
            />
          </div>

          ${
            params.authMode !== 'forgot'
              ? `
            <div class="relative flex items-center bg-[#efeaf8] rounded-xl px-3.5 py-2.5 border border-purple-100 focus-within:border-purple-400">
              <span class="text-[#7b5ea7] mr-2.5 text-base">🔒</span>
              <input
                id="login-password"
                type="${params.showPassword ? 'text' : 'password'}"
                placeholder="Senha"
                required
                class="w-full bg-transparent text-sm text-[#3b1f6e] placeholder-[#8c78ad] focus:outline-none pr-8"
              />
              <button
                id="toggle-pw"
                type="button"
                aria-label="Mostrar ou esconder senha"
                class="absolute right-3 text-[#7b5ea7] hover:text-[#4c2a85] text-base"
              >
                ${params.showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          `
              : ''
          }

          <div class="flex items-center justify-between text-xs font-semibold px-0.5">
            <button id="link-forgot" type="button" class="text-[#6e45a5] underline hover:text-[#4c2a85]">
              ${params.authMode === 'forgot' ? 'Voltar ao login' : 'Esqueci a senha'}
            </button>
            <button id="link-register" type="button" class="text-[#6e45a5] underline hover:text-[#4c2a85]">
              ${params.authMode === 'register' ? 'Já tenho conta' : 'Criar acesso'}
            </button>
          </div>

          <button
            type="submit"
            class="w-full py-3 rounded-full bg-gradient-to-r from-[#784eb8] to-[#5a3696] text-white font-display text-base font-semibold shadow-md hover:brightness-105 active:scale-[0.98] transition-all"
          >
            ${
              params.authMode === 'register'
                ? 'Cadastrar'
                : params.authMode === 'forgot'
                  ? 'Enviar link'
                  : 'Entrar'
            }
          </button>

          <div class="flex items-center gap-2 my-0.5">
            <div class="h-px flex-1 bg-purple-100"></div>
            <span class="text-[11px] font-bold text-[#9a86be]">ou</span>
            <div class="h-px flex-1 bg-purple-100"></div>
          </div>

          <button
            id="btn-google-signin"
            type="button"
            class="w-full py-2.5 px-4 rounded-full bg-white border border-purple-200 shadow-sm flex items-center justify-center gap-2.5 text-sm font-bold text-[#3b1f6e] hover:bg-purple-50 active:scale-[0.98] transition-all"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.19 14.97 0 12 0 7.31 0 3.26 2.69 1.27 6.61l3.66 2.84C5.8 6.86 8.65 5 12 5z"/>
              <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.76 2.91c2.2-2.03 3.66-5.02 3.66-8.73z"/>
              <path fill="#FBBC05" d="M4.93 14.55c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09L1.27 7.53C.46 9.14 0 10.96 0 12.46s.46 3.32 1.27 4.93l3.66-2.84z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.76-2.91c-1.08.72-2.45 1.16-4.17 1.16-3.35 0-6.2-1.86-7.07-4.45l-3.66 2.84C3.26 21.31 7.31 24 12 24z"/>
            </svg>
            Entrar com o Google
          </button>
        </form>

        <!-- Footer Links & Optional PWA Install -->
        <div class="flex flex-col items-center gap-2.5">
          ${
            !pwaService.isInstalled
              ? `
                <button
                  id="btn-login-install"
                  type="button"
                  class="px-4 py-1.5 rounded-full bg-white/85 border border-purple-200 text-[#4c2a85] text-xs font-extrabold shadow-sm hover:bg-white active:scale-95 transition flex items-center gap-1.5"
                >
                  <span>📲</span>
                  <span>Instalar App Miau</span>
                </button>
              `
              : ''
          }
          <div class="flex items-center justify-center gap-6 text-[11px] font-semibold text-[#6e45a5]">
            <button id="link-terms" type="button" class="underline hover:text-[#4c2a85]">Termos de Uso</button>
            <button id="link-privacy" type="button" class="underline hover:text-[#4c2a85]">Políticas de Privacidade</button>
          </div>
        </div>
      </div>
      ${params.showLegalModal ? renderLegalModalHtml(params.legalDoc) : ''}
      ${params.installGuideHtml}
    </div>
  `;
}

export function bindLoginScreenEvents(
  root: HTMLElement,
  authMode: 'login' | 'register' | 'forgot',
  handlers: LoginEventHandlers
): void {
  const form = root.querySelector('#login-form') as HTMLFormElement | null;
  const emailInput = root.querySelector('#login-email') as HTMLInputElement | null;
  const pwInput = root.querySelector('#login-password') as HTMLInputElement | null;

  root.querySelector('#toggle-pw')?.addEventListener('click', () => {
    handlers.onTogglePassword(emailInput?.value || '', pwInput?.value || '');
  });

  root.querySelector('#link-forgot')?.addEventListener('click', () => {
    handlers.onSwitchMode(authMode === 'forgot' ? 'login' : 'forgot');
  });

  root.querySelector('#link-register')?.addEventListener('click', () => {
    handlers.onSwitchMode(authMode === 'register' ? 'login' : 'register');
  });

  root.querySelector('#btn-google-signin')?.addEventListener('click', () => {
    void handlers.onGoogleSignIn();
  });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    void handlers.onSubmitCredentials(
      (emailInput?.value || '').trim(),
      pwInput?.value || ''
    );
  });

  root.querySelector('#link-terms')?.addEventListener('click', () => {
    handlers.onOpenLegal('terms');
  });
  root.querySelector('#link-privacy')?.addEventListener('click', () => {
    handlers.onOpenLegal('privacy');
  });
  root.querySelector('#close-legal')?.addEventListener('click', () => {
    handlers.onCloseLegal();
  });
  root.querySelector('#btn-login-install')?.addEventListener('click', () => {
    handlers.onInstallApp();
  });
  root.querySelector('#close-install-guide')?.addEventListener('click', () => {
    handlers.onCloseInstallGuide();
  });
}
