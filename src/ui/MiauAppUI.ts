import type { User } from 'firebase/auth';
import {
  ACHIEVEMENTS,
  DEFAULT_OWNED_ITEMS,
  FOOD_ITEMS,
  INITIAL_GREETING,
  MIAU_AVATAR_URL,
  SHOP_ITEMS,
  SUPPORT_WHATSAPP_NUMBER,
  XP_PER_LEVEL,
  createDefaultProfile,
} from '../constants';
import {
  loadMessages,
  loadOrCreatePetProfile,
  logoutUser,
  registerWithEmail,
  resetPassword,
  saveMessage,
  saveSettings,
  saveShopAction,
  saveStatsProgress,
  signInWithEmail,
  signInWithGoogle,
  subscribeAuth,
} from '../services/firebaseService';
import {
  GeminiApiError,
  askMiau,
  synthesizeMiauVoice,
  transcribeUserAudio,
} from '../services/geminiClient';
import { hapticService } from '../services/hapticService';
import {
  pwaService,
  type CameraPermissionState,
} from '../services/pwaService';
import { LiveVoiceSession, soundService } from '../services/soundService';
import type {
  AchievementDef,
  ActiveModal,
  AppScreen,
  ChatMessage,
  MiauMood,
  ScreenVisibilityPrefs,
  UserPetProfile,
} from '../types';
import { MiauARCamera } from './MiauARCamera';
import { renderMiauSvg } from './MiauIllustration';
import { renderRoomScenerySvg } from './RoomScenery';
import {
  mountFishCatchGame,
  mountMemoryGame,
  type MiniGameResult,
} from './MiniGames';

const LOCAL_DEMO_KEY = 'miau_demo_profile_v1';
const LOCAL_DEMO_MSGS_KEY = 'miau_demo_msgs_v1';
const SCREEN_PREFS_KEY = 'miau_screen_prefs_v1';
const CAM_PROMPTED_SESSION_KEY = 'miau_cam_prompted_v1';

const DEFAULT_SCREEN_PREFS: ScreenVisibilityPrefs = {
  showStatusBars: true,
  showStatusBadges: true,
  showSpeechAndChat: true,
  showCoinsBadge: true,
};

export interface MiauUIXRBridge {
  syncState: (
    stats: UserPetProfile['stats'],
    equipped: UserPetProfile['equipped'],
    speech: string,
    isSleeping?: boolean
  ) => void;
  triggerBounce: () => void;
  enterXRMode: () => void;
}

export class MiauAppUI {
  private root: HTMLElement;
  private screen: AppScreen = 'preloader';
  private authMode: 'login' | 'register' | 'forgot' = 'login';
  private showPassword = false;
  private preloaderProgress = 0;

  private firebaseUser: User | null = null;
  private isDemoSession = false;
  private profile: UserPetProfile = createDefaultProfile('guest');
  private messages: ChatMessage[] = [];
  private mood: MiauMood = 'playful';
  private isSleeping = false;
  private isCleaningMode = false;
  private activeModal: ActiveModal = 'none';
  private legalDoc: 'terms' | 'privacy' = 'terms';
  private shopTab: 'hat' | 'accessory' | 'background' = 'hat';
  private activeMiniGame: 'none' | 'fish' | 'memory' = 'none';
  private miniGameCleanup: (() => void) | null = null;

  private currentSpeech = {
    meowPrefix: INITIAL_GREETING.meowPrefix,
    text: INITIAL_GREETING.text,
  };
  private isThinking = false;
  private isSpeaking = false;
  private isRecordingMic = false;
  private liveSession: LiveVoiceSession | null = null;
  private liveStatus = '';
  private liveTranscript = '';

  private authError = '';
  private authNotice = '';
  private toastMessage = '';
  private toastTimer: number | null = null;

  private decayTimer: number | null = null;
  private sleepTimer: number | null = null;
  private supportDraft = '';
  private arCamera: MiauARCamera | null = null;
  private screenPrefs: ScreenVisibilityPrefs = { ...DEFAULT_SCREEN_PREFS };
  private cameraPermission: CameraPermissionState = 'unknown';
  private showInstallGuideModal = false;

  constructor(
    container: HTMLElement,
    private xrBridge?: MiauUIXRBridge
  ) {
    this.root = document.createElement('div');
    this.root.id = 'miau-2d-shell';
    this.root.className = 'fixed inset-0 z-20 flex items-center justify-center';
    container.appendChild(this.root);
    this.loadScreenPrefs();
    pwaService.subscribe(() => {
      if (
        this.screen === 'login' ||
        this.activeModal === 'menu' ||
        this.activeModal === 'settings' ||
        !pwaService.isOnline
      ) {
        this.render();
      }
    });
    void this.refreshCameraPermissionState();
    this.initLifecycle();
  }

  private loadScreenPrefs(): void {
    try {
      const raw = localStorage.getItem(SCREEN_PREFS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ScreenVisibilityPrefs>;
        this.screenPrefs = { ...DEFAULT_SCREEN_PREFS, ...parsed };
      }
    } catch {
      this.screenPrefs = { ...DEFAULT_SCREEN_PREFS };
    }
  }

  private saveScreenPrefs(): void {
    try {
      localStorage.setItem(SCREEN_PREFS_KEY, JSON.stringify(this.screenPrefs));
    } catch {
      // Ignore storage quota errors
    }
  }

  private async refreshCameraPermissionState(): Promise<void> {
    this.cameraPermission = await pwaService.getCameraPermissionState();
    if (this.activeModal === 'settings') {
      this.render();
    }
  }

  private async requestCameraPermissionOnStart(): Promise<void> {
    if (sessionStorage.getItem(CAM_PROMPTED_SESSION_KEY) === '1') return;
    const state = await pwaService.getCameraPermissionState();
    this.cameraPermission = state;
    if (state === 'granted' || state === 'denied' || state === 'unsupported') {
      return;
    }
    sessionStorage.setItem(CAM_PROMPTED_SESSION_KEY, '1');
    const result = await pwaService.requestCameraAuthorization();
    this.cameraPermission = result;
  }

  private initLifecycle(): void {
    this.render();
    let preloaderFinished = false;
    let authResolved = false;

    const tryAdvanceFromPreloader = () => {
      if (!preloaderFinished || !authResolved) return;
      this.screen = this.firebaseUser || this.isDemoSession ? 'game' : 'login';
      this.render();
    };

    const interval = window.setInterval(() => {
      this.preloaderProgress = Math.min(100, this.preloaderProgress + 12);
      const pctEl = this.root.querySelector('#preloader-pct');
      const ringEl = this.root.querySelector(
        '#preloader-ring'
      ) as SVGCircleElement | null;
      if (pctEl) pctEl.textContent = `${this.preloaderProgress}%`;
      if (ringEl) {
        const dash = 289 - (289 * this.preloaderProgress) / 100;
        ringEl.style.strokeDashoffset = String(dash);
      }
      if (this.preloaderProgress >= 100) {
        clearInterval(interval);
        window.setTimeout(() => {
          preloaderFinished = true;
          tryAdvanceFromPreloader();
        }, 250);
      }
    }, 85);

    subscribeAuth(async (user) => {
      this.firebaseUser = user;
      if (user) {
        this.isDemoSession = false;
        try {
          this.profile = await loadOrCreatePetProfile(user);
          this.ensureProfileDefaults();
          soundService.enabled = this.profile.soundEnabled;
          const msgs = await loadMessages(user.uid);
          this.messages =
            msgs.length > 0
              ? msgs
              : [
                  {
                    id: 'welcome',
                    ownerId: user.uid,
                    sender: 'miau',
                    meowPrefix: INITIAL_GREETING.meowPrefix,
                    text: INITIAL_GREETING.text,
                    mood: 'playful',
                    createdAtMs: Date.now(),
                  },
                ];
          const lastMiau = [...this.messages]
            .reverse()
            .find((m) => m.sender === 'miau');
          if (lastMiau) {
            this.currentSpeech = {
              meowPrefix: lastMiau.meowPrefix || 'Miau!',
              text: lastMiau.text,
            };
            this.mood = lastMiau.mood;
          }
          this.syncXR();
        } catch (err) {
          console.error('Erro ao carregar perfil no Firestore:', err);
          this.showToast('Conectado! Usando cache local enquanto sincroniza.');
        }
        if (this.screen === 'login') {
          this.screen = 'game';
          this.render();
          void this.requestCameraPermissionOnStart();
        }
      } else if (!this.isDemoSession && preloaderFinished) {
        this.screen = 'login';
        this.render();
      }
      authResolved = true;
      const wasPreloader = this.screen === 'preloader';
      tryAdvanceFromPreloader();
      if (wasPreloader && this.screen === 'game') {
        void this.requestCameraPermissionOnStart();
      }
    });

    this.decayTimer = window.setInterval(() => {
      if (this.screen !== 'game') return;
      if (this.isSleeping) return;
      this.ensureProfileDefaults();
      this.profile.stats.hunger = Math.max(5, this.profile.stats.hunger - 1);
      this.profile.stats.hygiene = Math.max(8, this.profile.stats.hygiene - 1);
      this.profile.stats.fun = Math.max(5, this.profile.stats.fun - 1);
      this.profile.stats.sleep = Math.max(5, this.profile.stats.sleep - 1);
      const anyLow =
        this.profile.stats.hunger < 30 ||
        this.profile.stats.hygiene < 30 ||
        this.profile.stats.fun < 30 ||
        this.profile.stats.sleep < 30;
      this.profile.stats.happiness = Math.max(
        5,
        this.profile.stats.happiness - (anyLow ? 2 : 1)
      );
      this.updateStatusBarsDOM();
      void this.persistStats();
    }, 35000);
  }

  private syncXR(): void {
    this.xrBridge?.syncState(
      this.profile.stats,
      this.profile.equipped,
      `${this.currentSpeech.meowPrefix} ${this.currentSpeech.text}`.trim(),
      this.isSleeping
    );
  }

  private showToast(msg: string): void {
    this.toastMessage = msg;
    const el = this.root.querySelector('#miau-toast') as HTMLElement | null;
    if (el) {
      el.textContent = msg;
      el.classList.remove('opacity-0', 'pointer-events-none');
      el.classList.add('opacity-100');
    }
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toastMessage = '';
      if (el) {
        el.classList.add('opacity-0', 'pointer-events-none');
        el.classList.remove('opacity-100');
      }
    }, 3200);
  }

  private ensureProfileDefaults(): void {
    const defaults = createDefaultProfile(this.profile.ownerId || 'guest');
    if (typeof this.profile.stats.happiness !== 'number') {
      this.profile.stats.happiness = defaults.stats.happiness;
    }
    if (!Array.isArray(this.profile.unlockedAchievements)) {
      this.profile.unlockedAchievements = [];
    }
    this.profile.progress = {
      ...defaults.progress,
      ...(this.profile.progress || {}),
    };
  }

  private getAchievementProgressValue(
    key: AchievementDef['progressKey']
  ): number {
    this.ensureProfileDefaults();
    if (key === 'shopBought') {
      return this.profile.ownedItems.some(
        (id) => !DEFAULT_OWNED_ITEMS.includes(id)
      )
        ? 1
        : 0;
    }
    return this.profile.progress[key] ?? 0;
  }

  private evaluateAchievements(): boolean {
    this.ensureProfileDefaults();
    const unlockedNow: AchievementDef[] = [];
    for (const ach of ACHIEVEMENTS) {
      if (this.profile.unlockedAchievements.includes(ach.id)) continue;
      if (this.getAchievementProgressValue(ach.progressKey) >= ach.target) {
        this.profile.unlockedAchievements.push(ach.id);
        this.profile.coins += ach.coinReward;
        unlockedNow.push(ach);
      }
    }
    if (unlockedNow.length > 0) {
      soundService.playCoin();
      hapticService.achievement();
      this.spawnFloatingParticle('🏆');
      const totalBonus = unlockedNow.reduce((acc, a) => acc + a.coinReward, 0);
      const label =
        unlockedNow.length === 1
          ? `🏆 Conquista: ${unlockedNow[0].title}! (+${totalBonus} moedas)`
          : `🏆 ${unlockedNow.length} conquistas desbloqueadas! (+${totalBonus} moedas)`;
      this.showToast(label);
      this.updateStatusBarsDOM();
      return true;
    }
    return false;
  }

  private addRewards(coinsDelta: number, xpDelta: number): void {
    this.profile.coins = Math.max(0, this.profile.coins + coinsDelta);
    this.profile.xp += xpDelta;
    while (this.profile.xp >= XP_PER_LEVEL) {
      this.profile.xp -= XP_PER_LEVEL;
      this.profile.level += 1;
      this.profile.coins += 100;
      soundService.playCoin();
      hapticService.levelUp();
      this.showToast(`Parabéns! Você alcançou o Nível ${this.profile.level}! (+100 moedas)`);
    }
  }

  private async persistStats(): Promise<void> {
    this.syncXR();
    if (this.firebaseUser) {
      try {
        await saveStatsProgress(this.firebaseUser.uid, this.profile);
      } catch (e) {
        console.warn('Falha ao salvar progresso no Firestore:', e);
      }
    } else if (this.isDemoSession) {
      localStorage.setItem(LOCAL_DEMO_KEY, JSON.stringify(this.profile));
    }
  }

  private async persistShop(): Promise<void> {
    this.syncXR();
    if (this.firebaseUser) {
      try {
        await saveShopAction(this.firebaseUser.uid, this.profile);
      } catch (e) {
        console.warn('Falha ao salvar personalização no Firestore:', e);
      }
    } else if (this.isDemoSession) {
      localStorage.setItem(LOCAL_DEMO_KEY, JSON.stringify(this.profile));
    }
  }

  private async persistSettings(): Promise<void> {
    if (this.firebaseUser) {
      try {
        await saveSettings(this.firebaseUser.uid, this.profile);
      } catch (e) {
        console.warn('Falha ao salvar configurações:', e);
      }
    } else if (this.isDemoSession) {
      localStorage.setItem(LOCAL_DEMO_KEY, JSON.stringify(this.profile));
    }
  }

  private async persistMessage(msg: {
    sender: 'user' | 'miau';
    meowPrefix: string;
    text: string;
    mood: MiauMood;
  }): Promise<void> {
    if (this.firebaseUser) {
      try {
        const saved = await saveMessage(this.firebaseUser.uid, msg);
        this.messages.push(saved);
        return;
      } catch (e) {
        console.warn('Falha ao salvar mensagem no Firestore:', e);
      }
    }
    const localMsg: ChatMessage = {
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ownerId: this.profile.ownerId,
      sender: msg.sender,
      meowPrefix: msg.meowPrefix,
      text: msg.text,
      mood: msg.mood,
      createdAtMs: Date.now(),
    };
    this.messages.push(localMsg);
    if (this.isDemoSession) {
      localStorage.setItem(
        LOCAL_DEMO_MSGS_KEY,
        JSON.stringify(this.messages.slice(-30))
      );
    }
  }

  private enterDemoMode(nameHint?: string): void {
    this.isDemoSession = true;
    const saved = localStorage.getItem(LOCAL_DEMO_KEY);
    if (saved) {
      try {
        this.profile = JSON.parse(saved) as UserPetProfile;
      } catch {
        this.profile = createDefaultProfile('demo');
      }
    } else {
      this.profile = createDefaultProfile('demo');
      if (nameHint && nameHint.trim()) {
        this.profile.petName = 'Miau';
      }
    }
    this.ensureProfileDefaults();
    soundService.enabled = this.profile.soundEnabled;
    const savedMsgs = localStorage.getItem(LOCAL_DEMO_MSGS_KEY);
    if (savedMsgs) {
      try {
        this.messages = JSON.parse(savedMsgs) as ChatMessage[];
      } catch {
        this.messages = [];
      }
    }
    if (this.messages.length === 0) {
      this.messages = [
        {
          id: 'welcome',
          ownerId: 'demo',
          sender: 'miau',
          meowPrefix: INITIAL_GREETING.meowPrefix,
          text: INITIAL_GREETING.text,
          mood: 'playful',
          createdAtMs: Date.now(),
        },
      ];
    }
    this.screen = 'game';
    this.syncXR();
    this.render();
    void this.requestCameraPermissionOnStart();
  }

  // Public actions usable from XR scene too
  public handlePetInteraction(): void {
    if (this.isSleeping) {
      this.toggleSleep();
    }
    this.ensureProfileDefaults();
    soundService.playPurr();
    hapticService.purr();
    this.mood = 'affectionate';
    this.profile.stats.fun = Math.min(100, this.profile.stats.fun + 6);
    this.profile.stats.happiness = Math.min(
      100,
      this.profile.stats.happiness + 8
    );
    this.profile.progress.petsCount += 1;
    this.addRewards(8, 5);
    this.evaluateAchievements();
    this.triggerMiauReaction('jump');
    this.spawnFloatingParticle('💖');
    this.updateStatusBarsDOM();
    this.updateCharacterSvgDOM();
    void this.persistStats();
  }

  public handleQuickFeed(): void {
    this.ensureProfileDefaults();
    const fish = FOOD_ITEMS[0];
    this.profile.stats.hunger = Math.min(
      100,
      this.profile.stats.hunger + fish.hungerBoost
    );
    this.profile.stats.fun = Math.min(
      100,
      this.profile.stats.fun + fish.funBoost
    );
    this.profile.stats.happiness = Math.min(
      100,
      this.profile.stats.happiness + 6
    );
    this.profile.progress.mealsFed += 1;
    this.addRewards(0, fish.xpReward);
    this.evaluateAchievements();
    soundService.playCrunch();
    hapticService.chomp();
    this.mood = 'eating';
    this.triggerMiauReaction('jump');
    this.spawnFloatingParticle('🐟');
    this.currentSpeech = {
      meowPrefix: 'Nham nham!',
      text: '(Que peixinho delicioso, obrigado!)',
    };
    this.updateStatusBarsDOM();
    this.updateSpeechDOM();
    this.updateCharacterSvgDOM();
    void this.persistStats();
    window.setTimeout(() => {
      if (this.mood === 'eating') {
        this.mood = 'happy';
        this.updateCharacterSvgDOM();
      }
    }, 1500);
  }

  public handleQuickClean(): void {
    this.ensureProfileDefaults();
    soundService.playBubble();
    hapticService.bubbles();
    this.profile.stats.hygiene = Math.min(100, this.profile.stats.hygiene + 22);
    this.profile.stats.happiness = Math.min(
      100,
      this.profile.stats.happiness + 8
    );
    this.profile.progress.cleanCount += 1;
    this.addRewards(12, 10);
    this.evaluateAchievements();
    this.mood = 'happy';
    this.triggerMiauReaction('spin');
    this.spawnFloatingParticle('🫧');
    this.currentSpeech = {
      meowPrefix: 'Purrr~',
      text: '(Fiquei limpinho e cheiroso!)',
    };
    this.updateStatusBarsDOM();
    this.updateSpeechDOM();
    this.updateCharacterSvgDOM();
    void this.persistStats();
  }

  public handleQuickPlay(): void {
    if (this.isSleeping) {
      this.toggleSleep();
    }
    this.ensureProfileDefaults();
    soundService.playMeow(1.22);
    hapticService.play();
    this.profile.stats.fun = Math.min(100, this.profile.stats.fun + 18);
    this.profile.stats.happiness = Math.min(
      100,
      this.profile.stats.happiness + 12
    );
    this.addRewards(10, 8);
    this.evaluateAchievements();
    this.mood = 'playful';
    this.triggerMiauReaction('spin');
    this.spawnFloatingParticle('🧶');
    this.currentSpeech = {
      meowPrefix: 'Miau!! 🧶',
      text: '(Adorei brincar com o novelo de lã!)',
    };
    this.updateStatusBarsDOM();
    this.updateSpeechDOM();
    this.updateCharacterSvgDOM();
    void this.persistStats();
  }

  public handleToggleSleepFromXR(): void {
    this.toggleSleep();
  }

  private toggleSleep(): void {
    this.isSleeping = !this.isSleeping;
    if (this.sleepTimer) {
      clearInterval(this.sleepTimer);
      this.sleepTimer = null;
    }
    if (this.isSleeping) {
      soundService.playPurr();
      hapticService.purr();
      this.currentSpeech = {
        meowPrefix: 'Zzz...',
        text: '(Hora da soneca gostosa...)',
      };
      this.sleepTimer = window.setInterval(() => {
        if (!this.isSleeping) return;
        this.ensureProfileDefaults();
        this.profile.stats.sleep = Math.min(100, this.profile.stats.sleep + 4);
        this.profile.stats.happiness = Math.min(
          100,
          this.profile.stats.happiness + 1
        );
        this.spawnFloatingParticle('💤');
        this.updateStatusBarsDOM();
        void this.persistStats();
        if (this.profile.stats.sleep >= 100) {
          this.toggleSleep();
        }
      }, 2200);
    } else {
      soundService.playMeow(1.1);
      hapticService.play();
      this.currentSpeech = {
        meowPrefix: 'Miau!',
        text: '(Acordei cheio de energia!)',
      };
    }
    this.render();
    if (!this.isSleeping) {
      this.triggerMiauReaction('jump');
    }
  }

  private triggerMiauReaction(
    kind: 'jump' | 'spin' | 'bounce' = 'jump'
  ): void {
    this.xrBridge?.triggerBounce();
    const wrap = this.root.querySelector('#miau-character-wrap');
    if (!wrap) return;
    wrap.classList.remove(
      'animate-miau-bounce',
      'animate-miau-jump',
      'animate-miau-spin'
    );
    void (wrap as HTMLElement).offsetWidth;
    const cls =
      kind === 'spin'
        ? 'animate-miau-spin'
        : kind === 'bounce'
          ? 'animate-miau-bounce'
          : 'animate-miau-jump';
    wrap.classList.add(cls);
  }

  private handleStatPillClick(
    statKey: 'hunger' | 'hygiene' | 'fun' | 'sleep' | 'happiness'
  ): void {
    if (statKey === 'sleep') {
      this.toggleSleep();
      return;
    }
    if (this.isSleeping) {
      this.toggleSleep();
    }
    this.ensureProfileDefaults();
    const val = Math.round(this.profile.stats[statKey]);
    this.profile.stats.happiness = Math.min(
      100,
      this.profile.stats.happiness + 2
    );

    const isLow = val < 30;
    const reactionMap: Record<
      'hunger' | 'hygiene' | 'fun' | 'happiness',
      {
        anim: 'jump' | 'spin';
        emoji: string;
        lowSpeech: { meowPrefix: string; text: string; mood: MiauMood };
        okSpeech: { meowPrefix: string; text: string; mood: MiauMood };
      }
    > = {
      hunger: {
        anim: 'jump',
        emoji: '🐟',
        lowSpeech: {
          meowPrefix: 'Miau... 😿',
          text: '(Minha barriguinha está roncando! Que tal um peixinho?)',
          mood: 'hungry',
        },
        okSpeech: {
          meowPrefix: 'Nham!',
          text: `(Estou bem alimentado com ${val}% de fome!)`,
          mood: 'happy',
        },
      },
      hygiene: {
        anim: 'spin',
        emoji: '🧼',
        lowSpeech: {
          meowPrefix: 'Mrrrow!',
          text: '(Preciso de um banho de espumas bem cheiroso!)',
          mood: 'playful',
        },
        okSpeech: {
          meowPrefix: 'Purrr~ ✨',
          text: `(Meu pelo está brilhando com ${val}% de higiene!)`,
          mood: 'happy',
        },
      },
      fun: {
        anim: 'spin',
        emoji: '🧶',
        lowSpeech: {
          meowPrefix: 'Miau!',
          text: '(Quero brincar! Vamos jogar um minijogo juntos?)',
          mood: 'playful',
        },
        okSpeech: {
          meowPrefix: 'Miau!! 🎉',
          text: `(Estou me divertindo muito! Diversão em ${val}%!)`,
          mood: 'playful',
        },
      },
      happiness: {
        anim: 'spin',
        emoji: '💖',
        lowSpeech: {
          meowPrefix: 'Miau... 💕',
          text: '(Senti sua falta! Faz um carinho ou conversa comigo?)',
          mood: 'affectionate',
        },
        okSpeech: {
          meowPrefix: 'Purrr~ 💖',
          text: '(Estou radiante de alegria com você cuidando de mim!)',
          mood: 'affectionate',
        },
      },
    };

    const cfg = reactionMap[statKey];
    const picked = isLow ? cfg.lowSpeech : cfg.okSpeech;
    this.mood = picked.mood;
    this.currentSpeech = {
      meowPrefix: picked.meowPrefix,
      text: picked.text,
    };
    soundService.playMeow(isLow ? 0.92 : 1.15);
    if (isLow) {
      hapticService.warning();
    } else {
      hapticService.tap();
    }
    this.triggerMiauReaction(cfg.anim);
    this.spawnFloatingParticle(cfg.emoji);
    this.updateStatusBarsDOM();
    this.updateSpeechDOM();
    this.updateCharacterSvgDOM();
    void this.persistStats();
  }

  private spawnFloatingParticle(emoji: string): void {
    const stage = this.root.querySelector('#miau-stage');
    if (!stage) return;
    const el = document.createElement('div');
    el.className =
      'absolute text-3xl pointer-events-none animate-float-up z-20 select-none';
    el.style.left = `${35 + Math.random() * 30}%`;
    el.style.top = `${28 + Math.random() * 20}%`;
    el.textContent = emoji;
    stage.appendChild(el);
    window.setTimeout(() => el.remove(), 1250);
  }

  private async playCurrentMiauSpeech(autoSpeakTTS = true): Promise<void> {
    soundService.playMeow(1.05);
    if (!autoSpeakTTS || !this.profile.soundEnabled) return;
    this.isSpeaking = true;
    this.updateSpeakerButtonDOM();
    try {
      const spoken = `${this.currentSpeech.meowPrefix} ${this.currentSpeech.text}`;
      const { audioBase64, mimeType } = await synthesizeMiauVoice(spoken);
      await soundService.playBase64Wav(
        audioBase64,
        mimeType,
        () => {
          this.isSpeaking = true;
          this.updateSpeakerButtonDOM();
        },
        () => {
          this.isSpeaking = false;
          this.updateSpeakerButtonDOM();
        }
      );
    } catch {
      this.isSpeaking = false;
      this.updateSpeakerButtonDOM();
    }
  }

  private async sendChatToMiau(userText: string): Promise<void> {
    const trimmed = userText.trim();
    if (!trimmed || this.isThinking) return;

    this.ensureProfileDefaults();
    this.isThinking = true;
    this.currentSpeech = {
      meowPrefix: 'Miau...',
      text: '(Pensando na resposta...)',
    };
    this.updateSpeechDOM();

    const recentHistory = this.messages.slice(-4);
    const userPersistPromise = this.persistMessage({
      sender: 'user',
      meowPrefix: '',
      text: trimmed,
      mood: 'happy',
    });

    try {
      const reply = await askMiau({
        message: trimmed,
        history: recentHistory,
        stats: this.profile.stats,
        equipped: this.profile.equipped,
        petName: this.profile.petName,
      });

      this.currentSpeech = {
        meowPrefix: reply.meowPrefix,
        text: reply.text,
      };
      this.mood = reply.mood;
      this.profile.stats.fun = Math.min(100, this.profile.stats.fun + 5);
      this.profile.stats.happiness = Math.min(
        100,
        this.profile.stats.happiness + 7
      );
      this.profile.progress.chatsCount += 1;
      this.addRewards(5, 8);
      this.evaluateAchievements();

      this.triggerMiauReaction('jump');
      hapticService.coin();
      this.updateSpeechDOM();
      this.updateStatusBarsDOM();
      this.updateCharacterSvgDOM();
      void this.playCurrentMiauSpeech(true);

      void (async () => {
        await userPersistPromise;
        await this.persistMessage({
          sender: 'miau',
          meowPrefix: reply.meowPrefix,
          text: reply.text,
          mood: reply.mood,
        });
        this.refreshChatModalIfOpen();
        await this.persistStats();
      })();
    } catch (error) {
      hapticService.warning();
      if (
        error instanceof GeminiApiError &&
        error.code === 'MISSING_GEMINI_API_KEY'
      ) {
        this.currentSpeech = {
          meowPrefix: 'Miau!',
          text: '(Falta configurar a GEMINI_API_KEY nas variáveis do servidor Vercel para ativar minha IA.)',
        };
        this.showToast('Configure GEMINI_API_KEY na Vercel e faça um Redeploy.');
      } else {
        const msg = error instanceof Error ? error.message : String(error);
        this.currentSpeech = {
          meowPrefix: 'Miau?',
          text: `(${msg})`,
        };
      }
      this.updateSpeechDOM();
    } finally {
      this.isThinking = false;
    }
  }

  private async handleMiniGameComplete(res: MiniGameResult): Promise<void> {
    this.ensureProfileDefaults();
    this.activeMiniGame = 'none';
    this.activeModal = 'none';
    this.profile.stats.fun = Math.min(100, this.profile.stats.fun + res.funBoost);
    this.profile.stats.happiness = Math.min(
      100,
      this.profile.stats.happiness +
        Math.min(18, Math.max(6, Math.round(res.funBoost * 0.8)))
    );
    this.profile.progress.gamesPlayed += 1;
    this.addRewards(res.coinsEarned, res.xpEarned);
    const unlockedNew = this.evaluateAchievements();
    soundService.playCoin();
    if (res.performanceTier === 'gold') {
      hapticService.achievement();
    } else {
      hapticService.coin();
    }

    this.mood =
      res.performanceTier === 'gold'
        ? 'affectionate'
        : res.performanceTier === 'silver'
          ? 'playful'
          : 'happy';

    if (res.performanceTier === 'gold') {
      this.currentSpeech = {
        meowPrefix: 'Miau!! 🏆',
        text: `(${res.gameName}: ${res.summaryText}! Você arrasou, ganhamos +${res.coinsEarned} moedas!)`,
      };
    } else if (res.performanceTier === 'silver') {
      this.currentSpeech = {
        meowPrefix: 'Miau! ✨',
        text: `(${res.gameName}: ${res.summaryText}! Mandou super bem, +${res.coinsEarned} moedas!)`,
      };
    } else {
      this.currentSpeech = {
        meowPrefix: 'Purrr~ 🐾',
        text: `(${res.gameName}: ${res.summaryText}! Foi muito divertido, +${res.coinsEarned} moedas!)`,
      };
    }

    this.render();
    this.triggerMiauReaction('spin');
    this.spawnFloatingParticle(res.performanceTier === 'gold' ? '🏆' : '🎮');
    if (!unlockedNew) {
      this.showToast(
        `${res.gameName}: +${res.coinsEarned} moedas e +${res.xpEarned} XP!`
      );
    }
    void this.persistStats();
    void this.reactToMiniGamePerformance(res);
  }

  private async reactToMiniGamePerformance(res: MiniGameResult): Promise<void> {
    const tierDesc =
      res.performanceTier === 'gold'
        ? 'excelente (medalha de ouro)'
        : res.performanceTier === 'silver'
          ? 'muito bom (medalha de prata)'
          : 'divertido (iniciante/bronze)';
    const prompt = `Acabamos de jogar o minijogo "${res.gameName}" juntos! Meu resultado foi: ${res.summaryText}, desempenho ${tierDesc}, e ganhamos ${res.coinsEarned} moedas. Reaja e comente de forma carinhosa e divertida sobre o meu desempenho!`;

    try {
      const reply = await askMiau({
        message: prompt,
        history: this.messages,
        stats: this.profile.stats,
        equipped: this.profile.equipped,
        petName: this.profile.petName,
      });
      if (this.isThinking) return;
      this.currentSpeech = {
        meowPrefix: reply.meowPrefix,
        text: reply.text,
      };
      this.mood = reply.mood;
      await this.persistMessage({
        sender: 'miau',
        meowPrefix: reply.meowPrefix,
        text: reply.text,
        mood: reply.mood,
      });
      this.updateSpeechDOM();
      this.updateCharacterSvgDOM();
      this.refreshChatModalIfOpen();
      void this.playCurrentMiauSpeech(true);
    } catch (err) {
      console.warn('Não foi possível gerar comentário de IA do minijogo:', err);
    }
  }

  private updateStatusBarsDOM(): void {
    this.ensureProfileDefaults();
    const s = this.profile.stats;
    const map: Array<[string, number]> = [
      ['hunger', s.hunger],
      ['hygiene', s.hygiene],
      ['fun', s.fun],
      ['sleep', s.sleep],
      ['happiness', s.happiness],
    ];
    map.forEach(([key, val]) => {
      const pct = Math.round(val);
      const isLow = pct < 30;
      const bar = this.root.querySelector(`#bar-${key}`) as HTMLElement | null;
      const txt = this.root.querySelector(`#pct-${key}`) as HTMLElement | null;
      const pill = this.root.querySelector(
        `#stat-pill-${key}`
      ) as HTMLElement | null;
      const icon = this.root.querySelector(
        `#stat-icon-${key}`
      ) as HTMLElement | null;
      if (bar) bar.style.width = `${pct}%`;
      if (txt) {
        txt.textContent = `${pct}%`;
        txt.classList.toggle('text-rose-600', isLow);
      }
      if (pill) pill.classList.toggle('status-alert-glow', isLow);
      if (icon) icon.classList.toggle('status-icon-alert', isLow);
    });
    const coinsEl = this.root.querySelector('#miau-coins');
    const levelEl = this.root.querySelector('#miau-level');
    const achEl = this.root.querySelector('#achievements-count');
    if (coinsEl) {
      coinsEl.textContent = this.profile.coins.toLocaleString('pt-BR');
    }
    if (levelEl) {
      levelEl.textContent = `Nível ${this.profile.level}`;
    }
    if (achEl) {
      const count = this.profile.unlockedAchievements?.length || 0;
      achEl.textContent = `${count}/${ACHIEVEMENTS.length}`;
    }
  }

  private updateSpeechDOM(): void {
    const prefixEl = this.root.querySelector('#speech-prefix');
    const textEl = this.root.querySelector('#speech-text');
    if (prefixEl) prefixEl.textContent = this.currentSpeech.meowPrefix;
    if (textEl) textEl.textContent = this.currentSpeech.text;
    this.syncXR();
  }

  private updateCharacterSvgDOM(): void {
    const svgWrap = this.root.querySelector('#miau-svg-container');
    if (svgWrap) {
      svgWrap.innerHTML = renderMiauSvg(
        this.mood,
        this.profile.equipped,
        this.isSleeping
      );
    }
  }

  private updateSpeakerButtonDOM(): void {
    const btn = this.root.querySelector('#btn-speaker');
    if (!btn) return;
    btn.classList.toggle('ring-4', this.isSpeaking);
    btn.classList.toggle('ring-purple-300', this.isSpeaking);
    btn.classList.toggle('animate-pulse', this.isSpeaking);
  }

  private refreshChatModalIfOpen(): void {
    if (this.activeModal !== 'chat') return;
    const listEl = this.root.querySelector('#chat-history-list');
    if (!listEl) return;
    listEl.innerHTML = this.renderChatHistoryItems();
    listEl.scrollTop = listEl.scrollHeight;
  }

  public render(): void {
    if (this.screen === 'preloader') {
      this.renderPreloader();
    } else if (this.screen === 'login') {
      this.renderLogin();
    } else {
      this.renderGame();
    }
  }

  private renderPreloader(): void {
    this.root.innerHTML = `
      <div class="w-full h-full miau-wallpaper flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div class="flex flex-col items-center gap-5 animate-fade-in">
          <div class="relative w-32 h-32 flex items-center justify-center">
            <svg class="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="46" stroke="rgba(255,255,255,0.65)" stroke-width="6" fill="rgba(255,255,255,0.45)"/>
              <circle
                id="preloader-ring"
                cx="50" cy="50" r="46"
                stroke="#6e45a5"
                stroke-width="6"
                stroke-linecap="round"
                fill="none"
                stroke-dasharray="289"
                stroke-dashoffset="${289 - (289 * this.preloaderProgress) / 100}"
                class="transition-all duration-150"
              />
            </svg>
            <div class="absolute inset-0 flex items-center justify-center">
              <svg viewBox="0 0 80 80" class="w-16 h-16 drop-shadow">
                <path d="M26 52 C26 40, 54 40, 54 52 C54 61, 46 66, 40 66 C34 66, 26 61, 26 52 Z" fill="#f7c8c0" stroke="#3b1f6e" stroke-width="3.5"/>
                <ellipse cx="22" cy="34" rx="6.5" ry="8" fill="#f7c8c0" stroke="#3b1f6e" stroke-width="3.2" transform="rotate(-14 22 34)"/>
                <ellipse cx="34" cy="25" rx="6.5" ry="8.5" fill="#f7c8c0" stroke="#3b1f6e" stroke-width="3.2"/>
                <ellipse cx="47" cy="25" rx="6.5" ry="8.5" fill="#f7c8c0" stroke="#3b1f6e" stroke-width="3.2"/>
                <ellipse cx="58" cy="34" rx="6.5" ry="8" fill="#f7c8c0" stroke="#3b1f6e" stroke-width="3.2" transform="rotate(14 58 34)"/>
                <path d="M33 52 Q40 46 47 52 Q45 59 40 59 Q35 59 33 52 Z" fill="#f2929c"/>
              </svg>
            </div>
          </div>
          <div class="text-center">
            <h1 class="font-display text-5xl font-bold text-[#4c2a85] tracking-tight">Miau</h1>
            <p id="preloader-pct" class="mt-1 text-sm font-bold text-[#6e45a5]">${this.preloaderProgress}%</p>
          </div>
        </div>
      </div>
    `;
  }

  private renderLogin(): void {
    const titleLabel =
      this.authMode === 'register'
        ? 'Criar acesso'
        : this.authMode === 'forgot'
          ? 'Recuperar senha'
          : 'Miau';

    this.root.innerHTML = `
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
              this.authError
                ? `<div class="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">${this.authError}</div>`
                : ''
            }
            ${
              this.authNotice
                ? `<div class="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">${this.authNotice}</div>`
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
              this.authMode !== 'forgot'
                ? `
              <div class="relative flex items-center bg-[#efeaf8] rounded-xl px-3.5 py-2.5 border border-purple-100 focus-within:border-purple-400">
                <span class="text-[#7b5ea7] mr-2.5 text-base">🔒</span>
                <input
                  id="login-password"
                  type="${this.showPassword ? 'text' : 'password'}"
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
                  ${this.showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            `
                : ''
            }

            <div class="flex items-center justify-between text-xs font-semibold px-0.5">
              <button id="link-forgot" type="button" class="text-[#6e45a5] underline hover:text-[#4c2a85]">
                ${this.authMode === 'forgot' ? 'Voltar ao login' : 'Esqueci a senha'}
              </button>
              <button id="link-register" type="button" class="text-[#6e45a5] underline hover:text-[#4c2a85]">
                ${this.authMode === 'register' ? 'Já tenho conta' : 'Criar acesso'}
              </button>
            </div>

            <button
              type="submit"
              class="w-full py-3 rounded-full bg-gradient-to-r from-[#784eb8] to-[#5a3696] text-white font-display text-base font-semibold shadow-md hover:brightness-105 active:scale-[0.98] transition-all"
            >
              ${
                this.authMode === 'register'
                  ? 'Cadastrar'
                  : this.authMode === 'forgot'
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
        ${this.activeModal === 'legal' ? this.renderLegalModal() : ''}
        ${this.showInstallGuideModal ? this.renderInstallGuideModal() : ''}
      </div>
    `;

    this.bindLoginEvents();
  }

  private bindLoginEvents(): void {
    const form = this.root.querySelector('#login-form') as HTMLFormElement | null;
    const emailInput = this.root.querySelector('#login-email') as HTMLInputElement | null;
    const pwInput = this.root.querySelector('#login-password') as HTMLInputElement | null;

    this.root.querySelector('#toggle-pw')?.addEventListener('click', () => {
      this.showPassword = !this.showPassword;
      const savedEmail = emailInput?.value || '';
      const savedPw = pwInput?.value || '';
      this.renderLogin();
      const newEmail = this.root.querySelector('#login-email') as HTMLInputElement | null;
      const newPw = this.root.querySelector('#login-password') as HTMLInputElement | null;
      if (newEmail) newEmail.value = savedEmail;
      if (newPw) newPw.value = savedPw;
    });

    this.root.querySelector('#link-forgot')?.addEventListener('click', () => {
      this.authError = '';
      this.authNotice = '';
      this.authMode = this.authMode === 'forgot' ? 'login' : 'forgot';
      this.renderLogin();
    });

    this.root.querySelector('#link-register')?.addEventListener('click', () => {
      this.authError = '';
      this.authNotice = '';
      this.authMode = this.authMode === 'register' ? 'login' : 'register';
      this.renderLogin();
    });

    this.root.querySelector('#btn-google-signin')?.addEventListener('click', async () => {
      this.authError = '';
      this.authNotice = '';
      try {
        await signInWithGoogle();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('popup-closed')) {
          this.authError = 'Login com Google cancelado.';
        } else if (msg.includes('unauthorized-domain')) {
          this.authError = `Domínio (${window.location.hostname}) não autorizado no Firebase Authentication. Adicione este domínio em Authentication > Settings > Authorized domains no projeto Firebase.`;
        } else if (msg.includes('popup-blocked')) {
          this.authError = 'O navegador bloqueou a janela do Google. Permita pop-ups para este site e tente novamente.';
        } else {
          this.authError = `Não foi possível entrar com o Google: ${msg}`;
        }
        this.renderLogin();
      }
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      this.authError = '';
      this.authNotice = '';
      const emailOrUser = (emailInput?.value || '').trim();
      const password = pwInput?.value || '';

      if (this.authMode === 'forgot') {
        if (!emailOrUser.includes('@')) {
          this.authError = 'Informe um e-mail válido para recuperar a senha.';
          this.renderLogin();
          return;
        }
        try {
          await resetPassword(emailOrUser);
          this.authNotice = 'E-mail de recuperação enviado! Confira sua caixa de entrada.';
        } catch (err) {
          this.authError =
            err instanceof Error ? err.message : 'Erro ao enviar recuperação.';
        }
        this.renderLogin();
        return;
      }

      if (emailOrUser.includes('@')) {
        try {
          if (this.authMode === 'register') {
            await registerWithEmail(emailOrUser, password);
          } else {
            await signInWithEmail(emailOrUser, password);
          }
          return;
        } catch (err) {
          const code = (err as { code?: string }).code || '';
          if (code === 'auth/operation-not-allowed') {
            // Email/Password provider isn't enabled in Firebase Console by default — allow instant local play or Google Sign-In
            this.enterDemoMode(emailOrUser);
            return;
          }
          this.authError =
            err instanceof Error ? err.message : 'Erro na autenticação.';
          this.renderLogin();
          return;
        }
      } else {
        // Username-only login enters local playful mode cleanly
        this.enterDemoMode(emailOrUser);
      }
    });

    this.root.querySelector('#link-terms')?.addEventListener('click', () => {
      this.legalDoc = 'terms';
      this.activeModal = 'legal';
      this.renderLogin();
    });

    this.root.querySelector('#link-privacy')?.addEventListener('click', () => {
      this.legalDoc = 'privacy';
      this.activeModal = 'legal';
      this.renderLogin();
    });

    this.root.querySelector('#close-legal')?.addEventListener('click', () => {
      this.activeModal = 'none';
      this.renderLogin();
    });

    this.root
      .querySelector('#btn-login-install')
      ?.addEventListener('click', () => {
        void this.handleInstallAppClick();
      });

    this.root
      .querySelector('#close-install-guide')
      ?.addEventListener('click', () => {
        this.showInstallGuideModal = false;
        this.render();
      });
  }

  private renderLegalModal(): string {
    const isTerms = this.legalDoc === 'terms';
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
                : 'Seus dados de conta Google e progresso do Miau (nível, moedas, roupas e conversas) são armazenados com segurança no Firebase Firestore vinculados exclusivamente ao seu perfil autenticado.'
            }
          </p>
        </div>
      </div>
    `;
  }

  private getRoomThemeClasses(): { wall: string; floor: string; showFloor: boolean; useWallpaper: boolean } {
    if (this.isSleeping) {
      return {
        wall: 'from-[#281e4f] via-[#3b2d6d] to-[#4e3d8a]',
        floor: 'from-[#372863] to-[#231847]',
        showFloor: true,
        useWallpaper: false,
      };
    }
    switch (this.profile.equipped.background) {
      case 'bg_night':
        return {
          wall: 'from-[#281d52] via-[#3d2d73] to-[#523d91]',
          floor: 'from-[#3a2a6b] to-[#24184a]',
          showFloor: true,
          useWallpaper: false,
        };
      case 'bg_sunny':
        return {
          wall: 'from-[#56ccf2] via-[#8ee0ff] to-[#dff5ff]',
          floor: 'from-[#4ade80] to-[#16a34a]',
          showFloor: false,
          useWallpaper: false,
        };
      case 'bg_peach':
        return {
          wall: 'from-[#ffe4d6] via-[#fbd3e9] to-[#ebd4ff]',
          floor: 'from-[#eab8d9] to-[#cfa3e8]',
          showFloor: true,
          useWallpaper: true,
        };
      default:
        return {
          wall: 'from-[#ece3ff] via-[#e2d2fc] to-[#d9c4fa]',
          floor: 'from-[#c8aaf4] to-[#b590eb]',
          showFloor: true,
          useWallpaper: true,
        };
    }
  }

  private renderGame(): void {
    const s = this.profile.stats;
    const theme = this.getRoomThemeClasses();
    const isNight = this.isSleeping || this.profile.equipped.background === 'bg_night';

    this.root.innerHTML = `
      <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#dfd0ff] via-[#cbb1fb] to-[#b896f5] md:p-4">
        <div class="relative w-full h-full md:max-w-[440px] md:max-h-[860px] md:rounded-[42px] md:border-[6px] md:border-white/80 md:shadow-[0_24px_70px_rgba(64,33,117,0.3)] overflow-hidden flex flex-col bg-gradient-to-b ${theme.wall} ${theme.useWallpaper ? 'miau-wallpaper' : ''}">

          <!-- Night / Sleep Dimmer -->
          <div class="pointer-events-none absolute inset-0 transition-opacity duration-500 bg-indigo-950/35 z-10 ${this.isSleeping ? 'opacity-100' : 'opacity-0'}"></div>

          <!-- Top Header -->
          <header class="relative z-20 px-4 pt-3.5 pb-2 flex items-center justify-between">
            <button id="btn-menu" aria-label="Abrir menu" class="w-10 h-10 rounded-full bg-white/60 backdrop-blur border border-white/80 flex items-center justify-center text-[#3b1f6e] shadow-sm hover:scale-105 transition">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" d="M4 7h16M4 12h16M4 17h16"/>
              </svg>
            </button>

            <h1 class="font-display text-2xl font-bold ${isNight ? 'text-white' : 'text-[#2d1b4e]'} tracking-tight">Sala de Estar</h1>

            ${
              this.screenPrefs.showCoinsBadge
                ? `<div class="flex items-center gap-1.5 bg-[#4a3566]/85 text-white rounded-full pl-1.5 pr-3 py-1 shadow-md border border-white/30">
                     <span class="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 border border-yellow-100 flex items-center justify-center text-xs font-extrabold text-amber-900 shadow-inner">$</span>
                     <span id="miau-coins" class="text-sm font-extrabold">${this.profile.coins.toLocaleString('pt-BR')}</span>
                   </div>`
                : `<div class="w-10"></div>`
            }
          </header>

          ${
            !pwaService.isOnline
              ? `<div class="relative z-20 mx-auto mb-1 px-3 py-0.5 rounded-full bg-amber-500/90 text-white text-[10px] font-extrabold shadow">
                   📡 Modo Offline — dados salvos localmente
                 </div>`
              : ''
          }

          <!-- Status Bars & Quick Badges (Configurable Visibility) -->
          ${
            this.screenPrefs.showStatusBars || this.screenPrefs.showStatusBadges
              ? `<section class="relative z-20 px-3.5 pt-1">
                  ${
                    this.screenPrefs.showStatusBars
                      ? `<div class="grid grid-cols-2 gap-1.5">
                          ${this.renderStatPill('hunger', 'Fome', s.hunger, '🐟', 'from-amber-400 to-orange-500', 'bg-orange-300')}
                          ${this.renderStatPill('hygiene', 'Higiene', s.hygiene, '🧼', 'from-cyan-400 to-emerald-400', 'bg-teal-300')}
                          ${this.renderStatPill('fun', 'Diversão', s.fun, '🧶', 'from-fuchsia-400 to-pink-500', 'bg-fuchsia-300')}
                          ${this.renderStatPill('sleep', 'Sono', s.sleep, '🌙', 'from-indigo-400 to-purple-500', 'bg-indigo-300')}
                          ${this.renderStatPill('happiness', 'Felicidade', s.happiness ?? 75, '💖', 'from-rose-400 to-pink-500', 'bg-rose-300', true)}
                        </div>`
                      : ''
                  }
                  ${
                    this.screenPrefs.showStatusBadges
                      ? `<div class="flex justify-between items-center gap-2 ${this.screenPrefs.showStatusBars ? 'mt-2' : ''}">
                          <button id="btn-achievements" type="button" class="glass-pill px-3 py-1 rounded-full text-xs font-extrabold text-[#4c2a85] flex items-center gap-1.5 hover:scale-105 transition">
                            <span>🏆</span>
                            <span id="achievements-count">${(this.profile.unlockedAchievements || []).length}/${ACHIEVEMENTS.length}</span>
                          </button>
                          <div class="flex items-center gap-2">
                            <button id="btn-sleep-toggle" class="glass-pill px-3 py-1 rounded-full text-xs font-bold text-[#4c2a85] flex items-center gap-1 hover:scale-105 transition">
                              ${this.isSleeping ? '☀️ Acordar' : '🌙 Soneca'}
                            </button>
                            <div id="miau-level" class="glass-pill px-3.5 py-1 rounded-full text-xs font-extrabold text-[#3b1f6e]">
                              Nível ${this.profile.level}
                            </div>
                          </div>
                        </div>`
                      : ''
                  }
                </section>`
              : ''
          }

          <!-- Living Room Floor, Themed Scenery & Miau Stage -->
          <main id="miau-stage" class="relative flex-1 flex flex-col items-center justify-center overflow-hidden">
            ${
              theme.showFloor
                ? `<div class="absolute inset-x-0 bottom-0 h-[44%] bg-gradient-to-b ${theme.floor} border-t border-white/35"></div>`
                : ''
            }
            <div id="miau-room-scenery" class="absolute inset-0 pointer-events-none z-0">
              ${renderRoomScenerySvg(this.profile.equipped.background, this.isSleeping)}
            </div>

            <!-- Cleaning Banner -->
            ${
              this.isCleaningMode
                ? `<div class="absolute top-2 z-20 glass-pill px-4 py-1.5 rounded-full text-xs font-extrabold text-cyan-800 animate-bounce">
                     🫧 Toque no Miau para ensaboar e limpar!
                   </div>`
                : ''
            }

            <!-- Interactive Miau Character -->
            <div
              id="miau-character-wrap"
              role="button"
              tabindex="0"
              aria-label="Fazer carinho no Miau"
              class="relative z-10 w-[235px] h-[210px] sm:w-[260px] sm:h-[230px] cursor-pointer active:scale-95 transition-transform"
            >
              <div id="miau-svg-container" class="w-full h-full">
                ${renderMiauSvg(this.mood, this.profile.equipped, this.isSleeping)}
              </div>
            </div>
          </main>

          <!-- AI Speech Bubble + Input Area -->
          ${
            this.screenPrefs.showSpeechAndChat
              ? `<section class="relative z-20 px-3.5 pb-2 flex flex-col gap-2.5">
                  <!-- Speech Bubble -->
                  <div class="relative glass-card rounded-[24px] p-3 flex items-center gap-3">
                    <div class="w-12 h-12 rounded-full overflow-hidden border-2 border-purple-200 bg-purple-100 shrink-0 shadow-sm">
                      <img src="${MIAU_AVATAR_URL}" alt="Miau" referrerpolicy="no-referrer" class="w-full h-full object-cover" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div id="speech-prefix" class="font-display text-sm font-bold text-[#2d1b4e]">${this.currentSpeech.meowPrefix}</div>
                      <div id="speech-text" class="text-sm font-semibold text-[#473173] leading-snug break-words">${this.currentSpeech.text}</div>
                    </div>
                    <button
                      id="btn-speaker"
                      type="button"
                      aria-label="Ouvir voz do Miau"
                      class="w-11 h-11 rounded-full bg-gradient-to-br from-[#7d52bd] to-[#5d3798] text-white flex items-center justify-center shrink-0 shadow-md hover:scale-105 active:scale-95 transition"
                    >
                      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                      </svg>
                    </button>
                  </div>

                  <!-- Chat Input Pill -->
                  <form id="quick-chat-form" class="glass-pill rounded-full p-1.5 pl-4 flex items-center gap-2">
                    <input
                      id="quick-chat-input"
                      type="text"
                      placeholder="Fale com o Miau..."
                      class="flex-1 bg-transparent text-sm font-semibold text-[#3b1f6e] placeholder-[#8f79b5] focus:outline-none min-w-0"
                    />
                    <button
                      id="btn-mic"
                      type="button"
                      aria-label="Gravar voz para o Miau"
                      class="w-9 h-9 rounded-full ${this.isRecordingMic ? 'bg-rose-500 animate-pulse' : 'bg-[#7b52b8]'} text-white flex items-center justify-center shadow hover:brightness-110 transition shrink-0"
                    >
                      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>
                      </svg>
                    </button>
                    <button
                      type="submit"
                      aria-label="Enviar mensagem"
                      class="w-9 h-9 rounded-full bg-gradient-to-br from-[#8c64cc] to-[#633ea1] text-white flex items-center justify-center shadow hover:brightness-110 transition shrink-0"
                    >
                      <svg class="w-4 h-4 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                      </svg>
                    </button>
                  </form>
                </section>`
              : ''
          }

          <!-- Bottom Navigation Bar -->
          <nav class="relative z-20 px-3 pb-3 pt-1">
            <div class="glass-card rounded-[28px] px-2 py-2.5 grid grid-cols-5 gap-1">
              ${this.renderNavBtn('feed', 'Alimentar', 'from-amber-400 to-orange-500', '🐟')}
              ${this.renderNavBtn('clean', 'Limpar', 'from-cyan-400 to-sky-500', '✨')}
              ${this.renderNavBtn('games', 'Jogos', 'from-emerald-400 to-green-500', '🎮')}
              ${this.renderNavBtn('customize', 'Personalizar', 'from-pink-400 to-fuchsia-500', '👗')}
              ${this.renderNavBtn('chat', 'Conversar', 'from-violet-400 to-purple-600', '💬')}
            </div>
          </nav>

          <!-- Toast Notification -->
          <div
            id="miau-toast"
            class="pointer-events-none opacity-0 transition-opacity duration-300 absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-[#3b1f6e]/90 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg whitespace-nowrap max-w-[90%] truncate"
          >${this.toastMessage}</div>

          <!-- Active Drawer / Modal -->
          ${this.activeModal !== 'none' ? this.renderModal() : ''}
          ${this.showInstallGuideModal ? this.renderInstallGuideModal() : ''}
        </div>
      </div>
    `;

    this.bindGameEvents();
  }

  private renderStatPill(
    key: string,
    label: string,
    value: number,
    emoji: string,
    barGrad: string,
    badgeBg: string,
    fullSpan = false
  ): string {
    const pct = Math.round(value);
    const isLow = pct < 30;
    return `
      <button
        id="stat-pill-${key}"
        data-stat="${key}"
        type="button"
        class="glass-pill rounded-full px-2 py-1 flex items-center gap-2 text-left cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform ${fullSpan ? 'col-span-2' : ''} ${isLow ? 'status-alert-glow' : ''}"
      >
        <div id="stat-icon-${key}" class="w-7 h-7 rounded-full ${badgeBg} border-2 border-white flex items-center justify-center text-sm shadow-sm shrink-0 ${isLow ? 'status-icon-alert' : ''}">${emoji}</div>
        <div class="flex-1 min-w-0 pr-1">
          <div class="flex items-center justify-between text-[11px] font-extrabold text-[#3b1f6e] leading-tight mb-0.5">
            <span>${label}</span>
            <span id="pct-${key}" class="${isLow ? 'text-rose-600' : ''}">${pct}%</span>
          </div>
          <div class="w-full h-1.5 bg-purple-100 rounded-full overflow-hidden">
            <div id="bar-${key}" class="h-full rounded-full bg-gradient-to-r ${barGrad} transition-all duration-300" style="width: ${pct}%"></div>
          </div>
        </div>
      </button>
    `;
  }

  private renderNavBtn(
    modal: ActiveModal,
    label: string,
    grad: string,
    emoji: string
  ): string {
    const active = this.activeModal === modal || (modal === 'clean' && this.isCleaningMode);
    return `
      <button
        data-nav="${modal}"
        type="button"
        class="flex flex-col items-center gap-1 group"
      >
        <div class="w-12 h-12 rounded-2xl bg-gradient-to-b ${grad} border-2 border-white shadow-md flex items-center justify-center text-2xl transition-transform group-hover:scale-105 group-active:scale-95 ${active ? 'ring-3 ring-purple-500 scale-105' : ''}">
          ${emoji}
        </div>
        <span class="text-[11px] font-extrabold text-[#3b1f6e] tracking-tight">${label}</span>
      </button>
    `;
  }

  private renderModal(): string {
    let body = '';
    if (this.activeModal === 'feed') {
      body = `
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-display text-xl font-bold text-[#3b1f6e]">Alimentar o Miau 🐟</h2>
          <button id="modal-close" class="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold">✕</button>
        </div>
        <div class="grid grid-cols-2 gap-2.5">
          ${FOOD_ITEMS.map(
            (item) => `
              <button data-food="${item.id}" class="bg-white/90 hover:bg-white rounded-2xl p-3 border border-purple-100 shadow-sm text-left flex flex-col gap-1 active:scale-95 transition">
                <div class="flex items-center justify-between">
                  <span class="text-3xl">${item.emoji}</span>
                  <span class="text-xs font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">🪙 ${item.cost}</span>
                </div>
                <div class="font-display text-sm font-bold text-[#3b1f6e]">${item.name}</div>
                <div class="text-[11px] text-[#6b4d9e] leading-tight">+${item.hungerBoost}% Fome • +${item.xpReward} XP</div>
              </button>
            `
          ).join('')}
        </div>
      `;
    } else if (this.activeModal === 'clean') {
      body = `
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
    } else if (this.activeModal === 'games') {
      if (this.activeMiniGame !== 'none') {
        body = `<div id="minigame-host" class="min-h-[320px]"></div>`;
      } else {
        body = `
          <div class="flex items-center justify-between mb-3">
            <h2 class="font-display text-xl font-bold text-[#3b1f6e]">Minijogos do Miau 🎮</h2>
            <button id="modal-close" class="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold">✕</button>
          </div>
          <div class="flex flex-col gap-2.5">
            <button id="start-fish-game" class="bg-white/90 hover:bg-white rounded-2xl p-3.5 border border-emerald-100 shadow-sm flex items-center gap-3 text-left active:scale-95 transition">
              <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-300 to-emerald-400 flex items-center justify-center text-2xl shadow">🐟</div>
              <div class="flex-1">
                <div class="font-display font-bold text-[#3b1f6e]">Caça aos Peixinhos</div>
                <div class="text-xs text-[#6b4d9e]">Pegue peixes e novelos caindo para ganhar moedas!</div>
              </div>
              <span class="text-xs font-extrabold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">Jogar</span>
            </button>
            <button id="start-memory-game" class="bg-white/90 hover:bg-white rounded-2xl p-3.5 border border-purple-100 shadow-sm flex items-center gap-3 text-left active:scale-95 transition">
              <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-300 to-purple-500 flex items-center justify-center text-2xl shadow">🐾</div>
              <div class="flex-1">
                <div class="font-display font-bold text-[#3b1f6e]">Memória dos Miados</div>
                <div class="text-xs text-[#6b4d9e]">Ouça os miados musicais e combine os pares!</div>
              </div>
              <span class="text-xs font-extrabold text-purple-700 bg-purple-100 px-2.5 py-1 rounded-full">Jogar</span>
            </button>
          </div>
        `;
      }
    } else if (this.activeModal === 'customize') {
      const filtered = SHOP_ITEMS.filter((i) => i.category === this.shopTab);
      body = `
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
              const active = this.shopTab === tab;
              return `<button data-shoptab="${tab}" class="flex-1 py-1.5 rounded-full text-xs font-extrabold transition ${active ? 'bg-[#6e45a5] text-white shadow' : 'bg-white/75 text-[#5e4294]'}">${label}</button>`;
            })
            .join('')}
        </div>
        <div class="grid grid-cols-2 gap-2.5 max-h-[250px] overflow-y-auto miau-scroll pr-1">
          ${filtered
            .map((item) => {
              const owned = this.profile.ownedItems.includes(item.id);
              const equipped =
                (item.category === 'hat' && this.profile.equipped.hat === item.id) ||
                (item.category === 'accessory' &&
                  this.profile.equipped.accessory === item.id) ||
                (item.category === 'background' &&
                  this.profile.equipped.background === item.id);
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
                  <div class="font-display text-xs font-bold text-[#3b1f6e]">${item.name}</div>
                </button>
              `;
            })
            .join('')}
        </div>
      `;
    } else if (this.activeModal === 'chat') {
      body = `
        <div class="flex items-center justify-between mb-2">
          <div>
            <h2 class="font-display text-lg font-bold text-[#3b1f6e]">Conversar com ${this.profile.petName} 💬</h2>
            <p class="text-[11px] font-semibold text-[#6b4d9e]">Histórico com Gemini IA & Conversa por Voz ao Vivo</p>
          </div>
          <button id="modal-close" class="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold">✕</button>
        </div>

        <div class="mb-2.5 bg-purple-50 border border-purple-200 rounded-2xl p-2.5 flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-xs font-extrabold text-[#4c2a85]">Voz ao Vivo (Gemini Live)</div>
            <div id="live-status-text" class="text-[11px] text-[#6b4d9e] truncate">${this.liveStatus || 'Fale em tempo real com o Miau!'}</div>
          </div>
          <button id="btn-live-toggle" class="px-3 py-1.5 rounded-full text-xs font-extrabold text-white shrink-0 ${this.liveSession ? 'bg-rose-500 animate-pulse' : 'bg-[#6e45a5]'}">
            ${this.liveSession ? '⏹️ Parar' : '🎙️ Ligar Voz'}
          </button>
        </div>

        ${
          this.liveTranscript
            ? `<div class="mb-2 bg-white/90 rounded-xl p-2 text-xs text-[#3b1f6e] border border-purple-100 max-h-20 overflow-y-auto miau-scroll whitespace-pre-line">${this.liveTranscript}</div>`
            : ''
        }

        <div id="chat-history-list" class="flex-1 max-h-[210px] min-h-[160px] overflow-y-auto miau-scroll flex flex-col gap-2 pr-1 mb-2.5">
          ${this.renderChatHistoryItems()}
        </div>

        <form id="modal-chat-form" class="flex items-center gap-2 bg-white rounded-full p-1.5 pl-3.5 border border-purple-200">
          <input id="modal-chat-input" type="text" placeholder="Escreva para o Miau..." class="flex-1 text-xs font-semibold text-[#3b1f6e] bg-transparent focus:outline-none" />
          <button type="submit" class="px-3.5 py-1.5 rounded-full bg-[#6e45a5] text-white text-xs font-extrabold">Enviar</button>
        </form>
      `;
    } else if (this.activeModal === 'achievements') {
      this.ensureProfileDefaults();
      const unlockedList = this.profile.unlockedAchievements;
      const totalEarned = ACHIEVEMENTS.filter((a) =>
        unlockedList.includes(a.id)
      ).reduce((sum, a) => sum + a.coinReward, 0);
      body = `
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
              this.getAchievementProgressValue(ach.progressKey)
            );
            const pct = Math.round((current / ach.target) * 100);
            return `
              <div class="rounded-2xl p-3 border ${isUnlocked ? 'bg-gradient-to-r from-amber-50/95 to-purple-50/95 border-amber-300 shadow-sm' : 'bg-white/75 border-purple-100'} flex items-center gap-3">
                <div class="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${isUnlocked ? 'bg-amber-200/80 shadow-inner' : 'bg-purple-100/80 grayscale opacity-75'}">
                  ${ach.emoji}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-2">
                    <span class="font-display text-sm font-bold text-[#3b1f6e] truncate">${ach.title}</span>
                    ${
                      isUnlocked
                        ? `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0">✓ +🪙 ${ach.coinReward}</span>`
                        : `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 shrink-0">🪙 +${ach.coinReward}</span>`
                    }
                  </div>
                  <p class="text-[11px] text-[#5e4294] leading-tight mt-0.5">${ach.description}</p>
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
    } else if (this.activeModal === 'menu') {
      const unlockedCount = (this.profile.unlockedAchievements || []).length;
      const visibleCount = [
        this.screenPrefs.showStatusBars,
        this.screenPrefs.showStatusBadges,
        this.screenPrefs.showSpeechAndChat,
        this.screenPrefs.showCoinsBadge,
      ].filter(Boolean).length;
      body = `
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-display text-xl font-bold text-[#3b1f6e]">Menu do Jogo 🐾</h2>
          <button id="modal-close" class="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold">✕</button>
        </div>
        <div class="flex flex-col gap-2.5 overflow-y-auto miau-scroll pr-1">
          <div class="bg-white/85 rounded-2xl p-3 border border-purple-100">
            <div class="text-xs font-bold text-[#6b4d9e] mb-0.5">Conta conectada</div>
            <div class="text-sm font-extrabold text-[#3b1f6e]">${this.firebaseUser?.displayName || this.firebaseUser?.email || 'Modo Demonstração Local'}</div>
          </div>

          <button id="btn-menu-achievements" class="w-full py-2.5 px-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 font-bold text-sm flex items-center justify-between hover:bg-amber-100/70 transition">
            <span>🏆 Conquistas do Miau</span>
            <span class="text-xs font-extrabold bg-amber-200/80 px-2.5 py-0.5 rounded-full">${unlockedCount}/${ACHIEVEMENTS.length}</span>
          </button>

          <button id="btn-open-settings" class="w-full py-2.5 px-3.5 rounded-2xl bg-white/90 border border-purple-200 text-[#3b1f6e] font-bold text-sm flex items-center justify-between hover:bg-purple-50 transition">
            <span>⚙️ Configurações da Tela</span>
            <span class="text-[11px] font-extrabold bg-purple-100 text-[#6e45a5] px-2.5 py-0.5 rounded-full">${visibleCount === 4 ? 'Completo' : visibleCount === 0 ? 'Limpo' : `${visibleCount}/4 itens`}</span>
          </button>

          ${
            !pwaService.isInstalled
              ? `<button id="btn-menu-install" class="w-full py-2.5 px-3.5 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white font-display font-bold text-sm shadow-md flex items-center justify-between hover:brightness-110 transition">
                   <span>📲 Instalar App Miau</span>
                   <span class="text-[10px] font-extrabold bg-white/25 px-2 py-0.5 rounded-full">PWA</span>
                 </button>`
              : ''
          }

          <button id="btn-open-ar" class="w-full py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-display font-bold shadow-md flex items-center justify-center gap-2 hover:brightness-110 transition">
            📸 Realidade Aumentada (Câmera)
          </button>

          <button id="btn-enter-xr" class="w-full py-3 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-700 text-white font-display font-bold shadow-md flex items-center justify-center gap-2 hover:brightness-110 transition">
            🥽 Abrir Sala 3D / Modo XR
          </button>

          <button id="btn-open-support" class="w-full py-2.5 px-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-sm flex items-center justify-between hover:bg-emerald-100/70 transition">
            <span>💬 Suporte & Dúvidas</span>
            <span class="text-[11px] font-extrabold bg-emerald-200/80 px-2.5 py-0.5 rounded-full">WhatsApp</span>
          </button>

          <button id="btn-logout" class="w-full py-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 font-bold text-sm hover:bg-rose-100 transition">
            🚪 Sair da Conta
          </button>
        </div>
      `;
    } else if (this.activeModal === 'settings') {
      const camLabel =
        this.cameraPermission === 'granted'
          ? 'Autorizada'
          : this.cameraPermission === 'denied'
            ? 'Bloqueada'
            : this.cameraPermission === 'unsupported'
              ? 'Indisponível'
              : 'Pendente';
      const camBadgeCls =
        this.cameraPermission === 'granted'
          ? 'bg-emerald-100 text-emerald-700'
          : this.cameraPermission === 'denied'
            ? 'bg-rose-100 text-rose-700'
            : 'bg-amber-100 text-amber-800';

      body = `
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <button id="btn-settings-back" class="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold text-sm">←</button>
            <h2 class="font-display text-xl font-bold text-[#3b1f6e]">Configurações ⚙️</h2>
          </div>
          <button id="modal-close" class="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold">✕</button>
        </div>

        <div class="flex flex-col gap-3 overflow-y-auto miau-scroll pr-1">
          <!-- Tela Principal Visibility -->
          <div class="bg-white/85 rounded-2xl p-3 border border-purple-100 flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-extrabold uppercase tracking-wide text-[#6b4d9e]">Tela Principal (Sala)</span>
              <div class="flex gap-1.5">
                <button id="btn-preset-full" type="button" class="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-purple-100 text-[#4c2a85] hover:bg-purple-200">✨ Tudo</button>
                <button id="btn-preset-clean" type="button" class="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 hover:bg-emerald-200">🧘 Limpo</button>
              </div>
            </div>

            ${this.renderToggleRow('showStatusBars', '📊 Barras de Status', 'Fome, Higiene, Diversão, Sono e Felicidade')}
            ${this.renderToggleRow('showStatusBadges', '🏆 Atalhos do Topo', 'Conquistas, Soneca e Nível')}
            ${this.renderToggleRow('showSpeechAndChat', '💬 Balão de Fala e Chat', 'Caixa de conversa rápida na Sala')}
            ${this.renderToggleRow('showCoinsBadge', '🪙 Moedas no Cabeçalho', 'Mostrar saldo de moedas no topo')}
          </div>

          <!-- Audio & Camera Permission -->
          <div class="bg-white/85 rounded-2xl p-3 border border-purple-100 flex flex-col gap-2.5">
            <span class="text-xs font-extrabold uppercase tracking-wide text-[#6b4d9e]">Áudio e Câmera (AR)</span>

            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-[#3b1f6e]">🔊 Sons e Voz do Miau</span>
              <button id="btn-toggle-sound" class="px-3 py-1 rounded-full text-xs font-extrabold ${this.profile.soundEnabled ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-700'}">
                ${this.profile.soundEnabled ? 'Ativado' : 'Mudo'}
              </button>
            </div>

            <div class="flex items-center justify-between pt-1 border-t border-purple-100">
              <div class="min-w-0">
                <div class="text-xs font-bold text-[#3b1f6e]">📳 Vibração Tátil</div>
                <div class="text-[10px] text-[#7a60a8]">Feedback ao fazer carinho e cuidar do Miau</div>
              </div>
              <button id="btn-toggle-haptics" class="px-3 py-1 rounded-full text-xs font-extrabold shrink-0 ${hapticService.enabled ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-700'}">
                ${hapticService.enabled ? 'Ativada' : 'Desativada'}
              </button>
            </div>

            <div class="flex items-center justify-between gap-2 pt-1 border-t border-purple-100">
              <div class="min-w-0">
                <div class="text-xs font-bold text-[#3b1f6e]">📷 Câmera (Realidade Aumentada)</div>
                <span class="inline-block mt-0.5 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${camBadgeCls}">${camLabel}</span>
              </div>
              <button id="btn-auth-camera" class="px-3 py-1.5 rounded-full bg-sky-500 text-white text-xs font-extrabold shadow-sm hover:brightness-110 shrink-0">
                ${this.cameraPermission === 'granted' ? 'Revalidar' : 'Autorizar'}
              </button>
            </div>
          </div>

          ${
            !pwaService.isInstalled
              ? `<button id="btn-settings-install" class="w-full py-2.5 px-3.5 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-700 text-white font-display font-bold text-sm shadow flex items-center justify-center gap-2 hover:brightness-110 transition">
                   📲 Instalar Aplicativo Miau
                 </button>`
              : `<div class="text-center text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-2xl py-2">
                   ✅ Aplicativo instalado no dispositivo
                 </div>`
          }
        </div>
      `;
    } else if (this.activeModal === 'support') {
      const waHref = this.buildSupportWhatsAppUrl(this.supportDraft);
      body = `
        <div class="flex items-center justify-between mb-2">
          <div>
            <h2 class="font-display text-xl font-bold text-[#3b1f6e]">Suporte Miau 💬</h2>
            <p class="text-[11px] font-semibold text-[#6b4d9e]">Envie sua dúvida direto para o WhatsApp +55 91 99615-6672</p>
          </div>
          <button id="modal-close" class="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold">✕</button>
        </div>

        <div class="flex flex-wrap gap-1.5 mb-2.5">
          ${[
            'Dúvida sobre o jogo',
            'Problema técnico',
            'Sugestão de recurso',
            'Minha conta / moedas',
          ]
            .map(
              (topic) =>
                `<button type="button" data-support-topic="${topic}" class="px-2.5 py-1 rounded-full bg-purple-100/80 hover:bg-purple-200 text-[#4c2a85] text-[11px] font-bold transition">${topic}</button>`
            )
            .join('')}
        </div>

        <textarea
          id="support-message-input"
          rows="4"
          placeholder="Escreva aqui sua pergunta ou dúvida sobre o Miau..."
          class="w-full rounded-2xl bg-white/95 border border-purple-200 p-3 text-xs font-semibold text-[#3b1f6e] placeholder-[#947ebe] focus:outline-none focus:border-purple-500 resize-none mb-3"
        >${this.escapeHtml(this.supportDraft)}</textarea>

        <div class="flex flex-col gap-2">
          <a
            id="btn-send-whatsapp"
            href="${waHref}"
            target="_blank"
            rel="noopener noreferrer"
            class="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-display font-bold text-sm shadow-md flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.99] transition text-center"
          >
            📲 Enviar no WhatsApp (+55 91 99615-6672)
          </a>
          <button
            id="btn-copy-support"
            type="button"
            class="w-full py-2 rounded-2xl bg-white/85 border border-purple-200 text-[#4c2a85] text-xs font-extrabold hover:bg-white transition"
          >
            📋 Copiar Pergunta
          </button>
        </div>
      `;
    }

    return `
      <div id="modal-backdrop" class="absolute inset-0 z-30 bg-purple-950/35 backdrop-blur-sm flex items-end md:items-center justify-center p-3">
        <div class="w-full max-w-[400px] glass-card rounded-[30px] p-4.5 shadow-2xl flex flex-col max-h-[82%]">
          ${body}
        </div>
      </div>
    `;
  }

  private renderChatHistoryItems(): string {
    return this.messages
      .map((m) => {
        const isUser = m.sender === 'user';
        return `
          <div class="flex ${isUser ? 'justify-end' : 'justify-start'}">
            <div class="max-w-[82%] rounded-2xl px-3 py-2 text-xs leading-snug ${
              isUser
                ? 'bg-[#6e45a5] text-white rounded-br-sm'
                : 'bg-white/95 text-[#3b1f6e] border border-purple-100 rounded-bl-sm'
            }">
              ${m.meowPrefix ? `<strong class="block font-display">${m.meowPrefix}</strong>` : ''}
              <span>${m.text}</span>
            </div>
          </div>
        `;
      })
      .join('');
  }

  private bindGameEvents(): void {
    // Pet Miau or rub bubbles in cleaning mode
    const miauWrap = this.root.querySelector('#miau-character-wrap');
    miauWrap?.addEventListener('click', () => {
      if (this.isCleaningMode) {
        this.ensureProfileDefaults();
        soundService.playBubble();
        hapticService.bubbles();
        this.profile.stats.hygiene = Math.min(100, this.profile.stats.hygiene + 8);
        this.profile.stats.happiness = Math.min(
          100,
          this.profile.stats.happiness + 3
        );
        this.addRewards(4, 4);
        this.spawnFloatingParticle('🫧');
        this.updateStatusBarsDOM();
        this.triggerMiauReaction('bounce');
        if (this.profile.stats.hygiene >= 98) {
          this.isCleaningMode = false;
          this.profile.progress.cleanCount += 1;
          this.evaluateAchievements();
          hapticService.coin();
          this.currentSpeech = {
            meowPrefix: 'Purrr~',
            text: '(Estou limpinho e reluzente!)',
          };
          this.render();
          this.triggerMiauReaction('spin');
        }
        void this.persistStats();
      } else {
        this.handlePetInteraction();
      }
    });

    // Speaker button
    this.root.querySelector('#btn-speaker')?.addEventListener('click', () => {
      void this.playCurrentMiauSpeech(true);
    });

    // Quick chat form
    const chatForm = this.root.querySelector(
      '#quick-chat-form'
    ) as HTMLFormElement | null;
    const chatInput = this.root.querySelector(
      '#quick-chat-input'
    ) as HTMLInputElement | null;
    chatForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = chatInput?.value || '';
      if (!val.trim()) return;
      if (chatInput) chatInput.value = '';
      void this.sendChatToMiau(val);
    });

    // Mic transcription button
    this.root.querySelector('#btn-mic')?.addEventListener('click', async () => {
      if (this.isRecordingMic) {
        this.isRecordingMic = false;
        this.render();
        try {
          const { audioBase64, mimeType } = await soundService.stopRecording();
          this.showToast('Transcrevendo sua voz...');
          const transcript = await transcribeUserAudio(audioBase64, mimeType);
          if (transcript) {
            await this.sendChatToMiau(transcript);
          } else {
            this.showToast('Não consegui ouvir direitinho. Tente de novo!');
          }
        } catch (err) {
          this.showToast(
            err instanceof Error ? err.message : 'Erro ao gravar áudio.'
          );
        }
      } else {
        try {
          await soundService.startRecording();
          this.isRecordingMic = true;
          this.render();
          this.showToast('Gravando... toque no microfone para enviar!');
        } catch {
          this.showToast('Permissão de microfone necessária para falar.');
        }
      }
    });

    // Sleep toggle & interactive status pills
    this.root
      .querySelector('#btn-sleep-toggle')
      ?.addEventListener('click', () => this.toggleSleep());
    this.root.querySelectorAll('[data-stat]').forEach((el) => {
      el.addEventListener('click', () => {
        const key = el.getAttribute('data-stat') as
          | 'hunger'
          | 'hygiene'
          | 'fun'
          | 'sleep'
          | 'happiness';
        if (key) this.handleStatPillClick(key);
      });
    });

    // Top menu & achievements
    this.root.querySelector('#btn-menu')?.addEventListener('click', () => {
      this.activeModal = 'menu';
      this.render();
    });

    this.root
      .querySelector('#btn-achievements')
      ?.addEventListener('click', () => {
        this.activeModal =
          this.activeModal === 'achievements' ? 'none' : 'achievements';
        this.render();
      });

    // Bottom Navigation
    this.root.querySelectorAll('[data-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        hapticService.tap();
        const target = btn.getAttribute('data-nav') as ActiveModal;
        this.isCleaningMode = false;
        this.activeMiniGame = 'none';
        this.miniGameCleanup?.();
        this.miniGameCleanup = null;
        this.activeModal = this.activeModal === target ? 'none' : target;
        this.render();
      });
    });

    // Modal Backdrop & Close
    this.root
      .querySelector('#modal-backdrop')
      ?.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).id === 'modal-backdrop') {
          this.closeActiveModal();
        }
      });
    this.root
      .querySelector('#modal-close')
      ?.addEventListener('click', () => this.closeActiveModal());

    // Food actions
    this.root.querySelectorAll('[data-food]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-food');
        const food = FOOD_ITEMS.find((f) => f.id === id);
        if (!food) return;
        if (this.profile.coins < food.cost) {
          hapticService.warning();
          this.showToast('Moedas insuficientes! Brinque nos Minijogos para ganhar.');
          return;
        }
        this.ensureProfileDefaults();
        this.profile.coins -= food.cost;
        this.profile.stats.hunger = Math.min(
          100,
          this.profile.stats.hunger + food.hungerBoost
        );
        this.profile.stats.fun = Math.min(
          100,
          this.profile.stats.fun + food.funBoost
        );
        this.profile.stats.happiness = Math.min(
          100,
          this.profile.stats.happiness + Math.max(4, Math.round(food.funBoost * 0.8))
        );
        this.profile.progress.mealsFed += 1;
        this.addRewards(0, food.xpReward);
        this.evaluateAchievements();
        soundService.playCrunch();
        hapticService.chomp();
        this.mood = 'eating';
        this.currentSpeech = {
          meowPrefix: 'Nham nham!',
          text: `(Adorei o ${food.name}! Que delícia!)`,
        };
        this.activeModal = 'none';
        this.render();
        this.triggerMiauReaction(food.id === 'food_salmon' ? 'spin' : 'jump');
        this.spawnFloatingParticle(food.emoji);
        void this.persistStats();
        window.setTimeout(() => {
          if (this.mood === 'eating') {
            this.mood = 'happy';
            this.updateCharacterSvgDOM();
          }
        }, 1600);
      });
    });

    // Clean modal buttons
    this.root.querySelector('#btn-instant-bath')?.addEventListener('click', () => {
      this.ensureProfileDefaults();
      soundService.playBubble();
      hapticService.bubbles();
      this.profile.stats.hygiene = Math.min(100, this.profile.stats.hygiene + 35);
      this.profile.stats.happiness = Math.min(
        100,
        this.profile.stats.happiness + 10
      );
      this.profile.progress.cleanCount += 1;
      this.addRewards(15, 12);
      this.evaluateAchievements();
      this.currentSpeech = {
        meowPrefix: 'Purrr~',
        text: '(Banho quentinho! Estou cheiroso demais!)',
      };
      this.activeModal = 'none';
      this.render();
      this.triggerMiauReaction('spin');
      this.spawnFloatingParticle('🫧');
      this.spawnFloatingParticle('✨');
      void this.persistStats();
    });

    this.root.querySelector('#btn-sponge-mode')?.addEventListener('click', () => {
      hapticService.tap();
      this.isCleaningMode = true;
      this.activeModal = 'none';
      this.render();
    });

    // Mini games launch
    this.root.querySelector('#start-fish-game')?.addEventListener('click', () => {
      this.activeMiniGame = 'fish';
      this.render();
      const host = this.root.querySelector('#minigame-host') as HTMLElement | null;
      if (host) {
        this.miniGameCleanup = mountFishCatchGame(
          host,
          (res) => void this.handleMiniGameComplete(res),
          () => {
            this.activeMiniGame = 'none';
            this.render();
          }
        );
      }
    });

    this.root
      .querySelector('#start-memory-game')
      ?.addEventListener('click', () => {
        this.activeMiniGame = 'memory';
        this.render();
        const host = this.root.querySelector(
          '#minigame-host'
        ) as HTMLElement | null;
        if (host) {
          this.miniGameCleanup = mountMemoryGame(
            host,
            (res) => void this.handleMiniGameComplete(res),
            () => {
              this.activeMiniGame = 'none';
              this.render();
            }
          );
        }
      });

    // Customize tabs & items
    this.root.querySelectorAll('[data-shoptab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.shopTab = btn.getAttribute('data-shoptab') as
          | 'hat'
          | 'accessory'
          | 'background';
        this.render();
      });
    });

    this.root.querySelectorAll('[data-shopitem]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-shopitem');
        const item = SHOP_ITEMS.find((s) => s.id === id);
        if (!item) return;

        const owned = this.profile.ownedItems.includes(item.id);
        if (!owned) {
          if (this.profile.coins < item.price) {
            hapticService.warning();
            this.showToast('Moedas insuficientes! Jogue minijogos para ganhar.');
            return;
          }
          this.profile.coins -= item.price;
          this.profile.ownedItems.push(item.id);
          soundService.playCoin();
          hapticService.coin();
          this.evaluateAchievements();
        } else {
          soundService.playMeow(1.18);
          hapticService.tap();
        }

        if (item.category === 'hat') this.profile.equipped.hat = item.id;
        if (item.category === 'accessory')
          this.profile.equipped.accessory = item.id;
        if (item.category === 'background')
          this.profile.equipped.background = item.id;

        this.render();
        void this.persistShop();
      });
    });

    // Chat modal events
    const modalChatForm = this.root.querySelector(
      '#modal-chat-form'
    ) as HTMLFormElement | null;
    const modalChatInput = this.root.querySelector(
      '#modal-chat-input'
    ) as HTMLInputElement | null;
    modalChatForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const txt = modalChatInput?.value || '';
      if (!txt.trim()) return;
      if (modalChatInput) modalChatInput.value = '';
      void this.sendChatToMiau(txt);
    });

    const listEl = this.root.querySelector('#chat-history-list');
    if (listEl) listEl.scrollTop = listEl.scrollHeight;

    // Live Voice Toggle
    this.root
      .querySelector('#btn-live-toggle')
      ?.addEventListener('click', async () => {
        if (this.liveSession) {
          this.liveSession.stop();
          this.liveSession = null;
          this.liveStatus = '';
          this.render();
          return;
        }
        this.liveStatus = 'Conectando ao Gemini Live...';
        this.liveTranscript = '';
        this.render();
        const session = new LiveVoiceSession({
          onStatus: (status) => {
            this.liveStatus = status;
            const el = this.root.querySelector('#live-status-text');
            if (el) el.textContent = status;
          },
          onInputTranscript: (txt) => {
            this.liveTranscript += `Você: ${txt}\n`;
            this.render();
          },
          onOutputTranscript: (txt) => {
            this.liveTranscript += `Miau: ${txt}\n`;
            this.currentSpeech = { meowPrefix: 'Miau!', text: txt };
            this.updateSpeechDOM();
            this.render();
          },
          onTurnComplete: () => {
            soundService.playPurr();
          },
          onError: (err) => {
            this.liveStatus = err;
            this.liveSession = null;
            this.render();
          },
          onClosed: () => {
            this.liveSession = null;
            this.liveStatus = 'Sessão de voz encerrada.';
            this.render();
          },
        });
        this.liveSession = session;
        try {
          await session.start();
        } catch (err) {
          this.liveSession = null;
          this.liveStatus =
            err instanceof Error ? err.message : 'Erro ao iniciar microfone.';
          this.render();
        }
      });

    // Menu & Settings actions
    this.root
      .querySelector('#btn-menu-achievements')
      ?.addEventListener('click', () => {
        this.activeModal = 'achievements';
        this.render();
      });

    this.root
      .querySelector('#btn-open-settings')
      ?.addEventListener('click', () => {
        this.activeModal = 'settings';
        void this.refreshCameraPermissionState();
        this.render();
      });

    this.root
      .querySelector('#btn-settings-back')
      ?.addEventListener('click', () => {
        this.activeModal = 'menu';
        this.render();
      });

    this.root
      .querySelector('#btn-menu-install')
      ?.addEventListener('click', () => {
        void this.handleInstallAppClick();
      });

    this.root
      .querySelector('#btn-settings-install')
      ?.addEventListener('click', () => {
        void this.handleInstallAppClick();
      });

    this.root
      .querySelector('#close-install-guide')
      ?.addEventListener('click', () => {
        this.showInstallGuideModal = false;
        this.render();
      });

    this.root.querySelectorAll('[data-screen-pref]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute(
          'data-screen-pref'
        ) as keyof ScreenVisibilityPrefs | null;
        if (!key) return;
        this.screenPrefs[key] = !this.screenPrefs[key];
        this.saveScreenPrefs();
        this.render();
      });
    });

    this.root
      .querySelector('#btn-preset-full')
      ?.addEventListener('click', () => {
        this.screenPrefs = {
          showStatusBars: true,
          showStatusBadges: true,
          showSpeechAndChat: true,
          showCoinsBadge: true,
        };
        this.saveScreenPrefs();
        this.render();
      });

    this.root
      .querySelector('#btn-preset-clean')
      ?.addEventListener('click', () => {
        this.screenPrefs = {
          showStatusBars: false,
          showStatusBadges: false,
          showSpeechAndChat: false,
          showCoinsBadge: true,
        };
        this.saveScreenPrefs();
        this.render();
      });

    this.root
      .querySelector('#btn-auth-camera')
      ?.addEventListener('click', async () => {
        const res = await pwaService.requestCameraAuthorization();
        this.cameraPermission = res;
        this.render();
        if (res === 'granted') {
          this.showToast('Câmera autorizada para Realidade Aumentada!');
        } else if (res === 'denied') {
          this.showToast(
            'Permissão negada. Libere a câmera nas configurações do navegador.'
          );
        } else {
          this.showToast('Câmera não suportada neste dispositivo.');
        }
      });

    this.root
      .querySelector('#btn-toggle-sound')
      ?.addEventListener('click', () => {
        hapticService.tap();
        this.profile.soundEnabled = !this.profile.soundEnabled;
        soundService.enabled = this.profile.soundEnabled;
        this.render();
        void this.persistSettings();
      });

    this.root
      .querySelector('#btn-toggle-haptics')
      ?.addEventListener('click', () => {
        const next = !hapticService.enabled;
        hapticService.enabled = next;
        if (next) {
          hapticService.purr();
          if (!hapticService.isSupported) {
            this.showToast('Preferência salva (aparelho atual sem motor de vibração).');
          }
        }
        this.render();
      });

    this.root.querySelector('#btn-enter-xr')?.addEventListener('click', () => {
      this.activeModal = 'none';
      this.render();
      this.xrBridge?.enterXRMode();
    });

    this.root.querySelector('#btn-open-ar')?.addEventListener('click', () => {
      this.activeModal = 'none';
      this.render();
      this.openARCamera();
    });

    this.root.querySelector('#btn-open-support')?.addEventListener('click', () => {
      this.activeModal = 'support';
      this.render();
    });

    // Support modal events
    const supportInput = this.root.querySelector(
      '#support-message-input'
    ) as HTMLTextAreaElement | null;
    const whatsappLink = this.root.querySelector(
      '#btn-send-whatsapp'
    ) as HTMLAnchorElement | null;
    supportInput?.addEventListener('input', () => {
      this.supportDraft = supportInput.value;
      if (whatsappLink) {
        whatsappLink.href = this.buildSupportWhatsAppUrl(this.supportDraft);
      }
    });
    this.root.querySelectorAll('[data-support-topic]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const topic = btn.getAttribute('data-support-topic') || '';
        const prefix = `[${topic}] `;
        if (!this.supportDraft.startsWith(prefix)) {
          this.supportDraft = `${prefix}${this.supportDraft}`.trimStart();
          if (supportInput) {
            supportInput.value = this.supportDraft;
            supportInput.focus();
          }
          if (whatsappLink) {
            whatsappLink.href = this.buildSupportWhatsAppUrl(this.supportDraft);
          }
        }
      });
    });
    this.root
      .querySelector('#btn-copy-support')
      ?.addEventListener('click', async () => {
        const textToCopy = this.buildSupportMessageText(this.supportDraft);
        try {
          await navigator.clipboard.writeText(textToCopy);
          this.showToast('Mensagem copiada para a área de transferência!');
        } catch {
          this.showToast('Toque em Enviar no WhatsApp para falar com o suporte.');
        }
      });

    this.root.querySelector('#btn-logout')?.addEventListener('click', async () => {
      this.activeModal = 'none';
      this.isDemoSession = false;
      if (this.firebaseUser) {
        await logoutUser();
      }
      this.screen = 'login';
      this.render();
    });
  }

  private escapeHtml(raw: string): string {
    return raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private buildSupportMessageText(draft: string): string {
    const player =
      this.firebaseUser?.displayName ||
      this.firebaseUser?.email ||
      'Jogador Miau';
    const trimmed = draft.trim();
    const question =
      trimmed || 'Olá! Tenho uma dúvida sobre o jogo Miau.';
    return `Olá, Suporte Miau! (${player} • Nível ${this.profile.level})\n\n${question}`;
  }

  private buildSupportWhatsAppUrl(draft: string): string {
    const encoded = encodeURIComponent(this.buildSupportMessageText(draft));
    return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encoded}`;
  }

  private renderToggleRow(
    key: keyof ScreenVisibilityPrefs,
    title: string,
    subtitle: string
  ): string {
    const enabled = this.screenPrefs[key];
    return `
      <div class="flex items-center justify-between gap-2 py-1 border-t border-purple-50 first:border-t-0">
        <div class="min-w-0">
          <div class="text-xs font-bold text-[#3b1f6e] truncate">${title}</div>
          <div class="text-[10px] text-[#7a60a8] truncate">${subtitle}</div>
        </div>
        <button
          type="button"
          data-screen-pref="${key}"
          aria-pressed="${enabled}"
          class="w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${enabled ? 'bg-emerald-500' : 'bg-slate-300'}"
        >
          <div class="w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}"></div>
        </button>
      </div>
    `;
  }

  private renderInstallGuideModal(): string {
    return `
      <div class="fixed inset-0 z-50 bg-purple-950/45 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="w-full max-w-sm glass-card rounded-3xl p-5 text-[#3b1f6e] shadow-2xl">
          <div class="flex items-center justify-between mb-3">
            <h2 class="font-display text-lg font-bold">📲 Instalar o App Miau</h2>
            <button id="close-install-guide" class="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold">✕</button>
          </div>
          ${
            pwaService.isIOS
              ? `
                <ol class="text-xs leading-relaxed text-[#4c2a85] flex flex-col gap-2 bg-white/80 rounded-2xl p-3.5 border border-purple-100">
                  <li><strong>1.</strong> Toque no botão <strong>Compartilhar</strong> (ícone de quadrado com seta ↑) na barra do Safari.</li>
                  <li><strong>2.</strong> Role para baixo e toque em <strong>Adicionar à Tela de Início</strong>.</li>
                  <li><strong>3.</strong> Confirme tocando em <strong>Adicionar</strong>!</li>
                </ol>
              `
              : `
                <ol class="text-xs leading-relaxed text-[#4c2a85] flex flex-col gap-2 bg-white/80 rounded-2xl p-3.5 border border-purple-100">
                  <li><strong>1.</strong> No Google Chrome, abra o menu <strong>⋮</strong> (canto superior direito) ou toque no ícone de instalação na barra de endereço.</li>
                  <li><strong>2.</strong> Selecione <strong>Instalar aplicativo</strong> (ou <strong>Adicionar à tela inicial → Instalar</strong>).</li>
                  <li><strong>3.</strong> O Miau será instalado com ícone próprio e modo tela cheia!</li>
                </ol>
              `
          }
        </div>
      </div>
    `;
  }

  private async handleInstallAppClick(): Promise<void> {
    if (pwaService.canPromptInstall()) {
      const outcome = await pwaService.promptInstall();
      if (outcome === 'accepted') {
        this.showToast('Miau instalado com sucesso!');
        this.render();
      }
      return;
    }
    this.showInstallGuideModal = true;
    this.render();
  }

  private openARCamera(): void {
    this.arCamera?.destroy();
    this.arCamera = new MiauARCamera({
      petName: this.profile.petName,
      initialMood: this.mood,
      initialEquipped: this.profile.equipped,
      ownedItems: this.profile.ownedItems,
      onPetReward: () => {
        this.handlePetInteraction();
      },
      onEquipChange: (newEquipped) => {
        this.profile.equipped = { ...newEquipped };
        this.render();
        void this.persistShop();
      },
      onClose: () => {
        this.arCamera = null;
        void this.refreshCameraPermissionState();
      },
    });
  }

  private closeActiveModal(): void {
    this.miniGameCleanup?.();
    this.miniGameCleanup = null;
    this.activeMiniGame = 'none';
    this.activeModal = 'none';
    this.render();
  }
}
