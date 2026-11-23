import type { User } from 'firebase/auth';
import {
  ACHIEVEMENTS,
  DEFAULT_OWNED_ITEMS,
  FOOD_ITEMS,
  INITIAL_GREETING,
  MIAU_AVATAR_URL,
  ROUTINE_SCHEDULE,
  SEED_RANKING_ENTRIES,
  SHOP_ITEMS,
  SUPPORT_WHATSAPP_NUMBER,
  XP_PER_LEVEL,
  createDefaultGameRecords,
  createDefaultProfile,
  getTodayDateKey,
} from '../constants';
import {
  loadMessages,
  loadOrCreatePetProfile,
  loadTopRankings,
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
  upsertRankingEntry,
} from '../services/firebaseService';
import {
  GeminiApiError,
  askMiau,
  transcribeUserAudio,
} from '../services/geminiClient';
import { hapticService } from '../services/hapticService';
import { miauSpeechService } from '../services/miauSpeechService';
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
  GameId,
  GameMatchHistoryItem,
  MiauMood,
  RankingEntry,
  RoutineCategory,
  RoutineSlotDef,
  ScreenVisibilityPrefs,
  UserPetProfile,
} from '../types';
import {
  buildContextualGreeting,
  buildConversationContextSnapshot,
  buildFriendGreeting,
  buildMainScreenCheckIn,
} from '../data/chatContext';
import {
  mountInteractiveBall,
  type InteractiveBallController,
} from './InteractiveBall';
import { MiauARCamera } from './MiauARCamera';
import { renderMiauSvg } from './MiauIllustration';
import {
  mountEscapeRunGame,
  mountFishCatchGame,
  mountGalaxyRatGame,
  mountMemoryGame,
  type MiniGameResult,
} from './MiniGames';
import { renderRoomScenerySvg } from './RoomScenery';
import {
  createEmptyHumanProfile,
  deleteUserHumanProfile,
  loadUserHumanProfile,
  saveUserHumanProfile,
} from '../services/userProfileService';
import type { SchoolingLevel, UserHumanProfile } from '../types';
import { escapeHtml } from '../utils/html';
import {
  renderAchievementsModalHtml,
  renderCleanModalHtml,
  renderCustomizeModalHtml,
  renderFeedModalHtml,
  renderGamesHubModalHtml,
  renderRankingModalHtml,
  renderRoutineModalHtml,
} from './modals/CareAndGamesModals';
import {
  renderChatHistoryItemsHtml,
  renderChatModalHtml,
  renderInstallGuideModalHtml,
  renderSettingsModalHtml,
  renderSupportModalHtml,
} from './modals/CommunicationModals';
import {
  bindLearnModalEvents,
  renderLearnModalHtml,
} from './modals/LearnModal';
import {
  bindLoginScreenEvents,
  renderLoginScreenHtml,
} from './modals/LoginScreen';
import { renderMenuModalHtml } from './modals/MenuModal';
import {
  renderPreloaderHtml,
  updatePreloaderProgressDom,
} from './modals/PreloaderScreen';
import { UserProfileModalController } from './modals/UserProfileModal';

const LOCAL_DEMO_KEY = 'miau_demo_profile_v1';
const LOCAL_DEMO_MSGS_KEY = 'miau_demo_msgs_v1';
const LOCAL_RANKING_KEY = 'miau_local_rankings_v1';
const LOCAL_MATCH_HISTORY_PREFIX = 'miau_game_history_v1_';
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
  private activeMiniGame: 'none' | 'fish' | 'memory' | 'escape' | 'galaxy' =
    'none';
  private miniGameCleanup: (() => void) | null = null;
  private leaderboard: RankingEntry[] = [];
  private rankingLoading = false;
  private rankingTab: 'all' | GameId = 'all';
  private lastSleepRewardAtMs = 0;

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
  private liveInputBuffer = '';
  private liveOutputBuffer = '';

  private authError = '';
  private authNotice = '';
  private toastMessage = '';
  private toastTimer: number | null = null;

  private decayTimer: number | null = null;
  private sleepTimer: number | null = null;
  private proactiveTimer: number | null = null;
  private lastUserInteractionAt = Date.now();
  private lastProactivePromptAt = 0;
  private proactiveStepIndex = 0;
  private hasGreetedMainScreen = false;
  private hasUserGesture = false;
  private lastFriendModalGreetAt = 0;
  private supportDraft = '';
  private arCamera: MiauARCamera | null = null;
  private screenPrefs: ScreenVisibilityPrefs = { ...DEFAULT_SCREEN_PREFS };
  private cameraPermission: CameraPermissionState = 'unknown';
  private showInstallGuideModal = false;
  private humanProfile: UserHumanProfile = createEmptyHumanProfile('guest');
  private learnPreviewLevel: SchoolingLevel | null = null;
  private profileModal: UserProfileModalController;
  private ballController: InteractiveBallController | null = null;

  constructor(
    container: HTMLElement,
    private xrBridge?: MiauUIXRBridge
  ) {
    this.root = document.createElement('div');
    this.root.id = 'miau-2d-shell';
    this.root.className = 'fixed inset-0 z-20 flex items-center justify-center';
    container.appendChild(this.root);
    const markInteraction = () => {
      this.lastUserInteractionAt = Date.now();
      this.hasUserGesture = true;
    };
    this.root.addEventListener('pointerdown', markInteraction, { passive: true });
    this.root.addEventListener('keydown', markInteraction, { passive: true });
    this.root.addEventListener('input', markInteraction, { passive: true });
    miauSpeechService.setSpeakingListener((speaking) => {
      this.isSpeaking = speaking;
      this.updateSpeakerButtonDOM();
    });
    this.profileModal = new UserProfileModalController({
      getProfile: () => this.humanProfile,
      onSave: async (draft) => {
        const ownerId =
          this.firebaseUser?.uid || (this.isDemoSession ? 'demo' : 'guest');
        const saved = await saveUserHumanProfile(this.firebaseUser, {
          ...draft,
          ownerId,
        });
        this.humanProfile = saved;
        this.showToast('Perfil do usuário salvo com sucesso!');
        void this.syncRankingEntry();
      },
      onDelete: async () => {
        const ownerId =
          this.firebaseUser?.uid || (this.isDemoSession ? 'demo' : 'guest');
        this.humanProfile = await deleteUserHumanProfile(
          this.firebaseUser,
          ownerId
        );
        this.showToast('Perfil do usuário limpo.');
        void this.syncRankingEntry();
      },
      onBackToMenu: () => {
        this.activeModal = 'menu';
        this.render();
      },
      onOpenLearn: () => {
        this.profileModal.disposeCameraStream();
        this.learnPreviewLevel = null;
        this.activeModal = 'learn';
        this.render();
      },
      onRequestRerender: () => {
        if (this.screen === 'game' && this.activeModal === 'profile') {
          this.render();
        }
      },
      onToast: (msg) => this.showToast(msg),
    });
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
      updatePreloaderProgressDom(this.root, this.preloaderProgress);
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
          soundService.setEnabled(this.profile.soundEnabled);
          const [msgs, humanProf] = await Promise.all([
            loadMessages(user.uid),
            loadUserHumanProfile(user, user.uid),
          ]);
          this.humanProfile = humanProf;
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
          this.humanProfile = await loadUserHumanProfile(null, user.uid);
          this.showToast('Conectado! Usando cache local enquanto sincroniza.');
        }
        if (this.screen === 'login') {
          this.screen = 'game';
          this.render();
          void this.requestCameraPermissionOnStart();
        } else if (
          this.screen === 'game' &&
          (this.activeModal === 'menu' ||
            this.activeModal === 'profile' ||
            this.activeModal === 'learn')
        ) {
          this.render();
        }
      } else if (!this.isDemoSession) {
        this.profileModal.disposeCameraStream();
        this.humanProfile = createEmptyHumanProfile('guest');
        this.learnPreviewLevel = null;
        if (preloaderFinished) {
          this.screen = 'login';
          this.render();
        }
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

    this.proactiveTimer = window.setInterval(() => {
      this.evaluateProactiveInteraction();
    }, 5000);
  }

  private evaluateProactiveInteraction(): void {
    if (
      this.screen !== 'game' ||
      this.activeModal !== 'none' ||
      this.isSleeping ||
      this.isCleaningMode ||
      this.isThinking ||
      this.isSpeaking ||
      this.isRecordingMic ||
      this.liveSession
    ) {
      return;
    }
    const activeEl = document.activeElement as HTMLElement | null;
    if (activeEl?.id === 'quick-chat-input') return;

    const now = Date.now();
    if (!this.hasGreetedMainScreen) {
      if (now - this.lastUserInteractionAt >= 3500) {
        this.hasGreetedMainScreen = true;
        this.triggerProactiveCheckIn(true);
      }
      return;
    }

    if (
      now - this.lastUserInteractionAt >= 24000 &&
      now - this.lastProactivePromptAt >= 48000
    ) {
      this.triggerProactiveCheckIn(false);
    }
  }

  private triggerProactiveCheckIn(isInitial: boolean): void {
    this.ensureProfileDefaults();
    this.lastProactivePromptAt = Date.now();
    const snapshot = buildConversationContextSnapshot(this.humanProfile);
    const checkIn = isInitial
      ? buildContextualGreeting(snapshot, this.profile.petName)
      : buildMainScreenCheckIn(
          snapshot,
          this.profile.stats,
          this.profile.petName,
          this.proactiveStepIndex++
        );
    this.currentSpeech = {
      meowPrefix: checkIn.meowPrefix,
      text: checkIn.text,
    };
    this.mood = checkIn.mood;
    this.updateSpeechDOM();
    this.updateCharacterSvgDOM();
    this.triggerMiauReaction('bounce');
    this.spawnFloatingParticle('💬');
    if (this.hasUserGesture && this.profile.soundEnabled) {
      void this.speakCurrentCaption({
        withLeadingMeow: false,
        pitchMultiplier: 1.05,
      });
    }
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
    const defaultRecords = createDefaultGameRecords();
    const currentRecords = this.profile.gameRecords || defaultRecords;
    this.profile.gameRecords = {
      fish: { ...defaultRecords.fish, ...(currentRecords.fish || {}) },
      memory: { ...defaultRecords.memory, ...(currentRecords.memory || {}) },
      escape: { ...defaultRecords.escape, ...(currentRecords.escape || {}) },
      galaxy: { ...defaultRecords.galaxy, ...(currentRecords.galaxy || {}) },
    };
    const todayKey = getTodayDateKey();
    if (
      !this.profile.dailyRoutine ||
      this.profile.dailyRoutine.dateKey !== todayKey ||
      !Array.isArray(this.profile.dailyRoutine.completedSlots)
    ) {
      this.profile.dailyRoutine = {
        dateKey: todayKey,
        completedSlots: [],
      };
    }
  }

  private isSlotInWindow(slot: RoutineSlotDef, now = new Date()): boolean {
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const targetMins = slot.targetHour * 60 + slot.targetMinute;
    const rawDiff = Math.abs(nowMins - targetMins);
    const circularDiff = Math.min(rawDiff, 1440 - rawDiff);
    return circularDiff <= slot.windowMinutes;
  }

  private getActiveWindowSlots(): RoutineSlotDef[] {
    this.ensureProfileDefaults();
    const completed = this.profile.dailyRoutine?.completedSlots || [];
    const now = new Date();
    return ROUTINE_SCHEDULE.filter(
      (slot) => !completed.includes(slot.id) && this.isSlotInWindow(slot, now)
    );
  }

  private claimRoutineSlot(category: RoutineCategory): RoutineSlotDef | null {
    this.ensureProfileDefaults();
    const routine = this.profile.dailyRoutine!;
    const now = new Date();
    const slot = ROUTINE_SCHEDULE.find(
      (s) =>
        s.category === category &&
        !routine.completedSlots.includes(s.id) &&
        this.isSlotInWindow(s, now)
    );
    if (!slot) return null;
    routine.completedSlots.push(slot.id);
    this.addRewards(slot.bonusCoins, slot.bonusXp);
    soundService.playCoin();
    hapticService.coin();
    this.spawnFloatingParticle('⏰');
    this.showToast(
      `⏰ Rotina no horário! ${slot.label} (+${slot.bonusCoins} moedas)`
    );
    return slot;
  }

  private getPlayerDisplayName(): string {
    const raw =
      this.humanProfile.fullName.trim() ||
      this.firebaseUser?.displayName ||
      this.firebaseUser?.email?.split('@')[0] ||
      'Jogador Local';
    return raw.slice(0, 36);
  }

  private getMatchHistoryStorageKey(): string {
    const ownerId =
      this.firebaseUser?.uid || (this.isDemoSession ? 'demo' : 'local_player');
    return `${LOCAL_MATCH_HISTORY_PREFIX}${ownerId}`;
  }

  private loadGameMatchHistory(): GameMatchHistoryItem[] {
    try {
      const raw = localStorage.getItem(this.getMatchHistoryStorageKey());
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as GameMatchHistoryItem[]) : [];
    } catch {
      return [];
    }
  }

  private appendGameMatchHistory(
    res: MiniGameResult,
    coinsEarned: number
  ): void {
    try {
      const prev = this.loadGameMatchHistory();
      const item: GameMatchHistoryItem = {
        id: `match_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        gameId: res.gameId,
        gameName: res.gameName,
        score: res.score,
        stageReached: res.stageReached || 1,
        durationSec: res.durationSec,
        coinsEarned,
        performanceTier: res.performanceTier,
        playedAtMs: Date.now(),
      };
      const next = [item, ...prev].slice(0, 30);
      localStorage.setItem(
        this.getMatchHistoryStorageKey(),
        JSON.stringify(next)
      );
    } catch {
      // ignore storage quota errors
    }
  }

  private buildCurrentRankingEntry(): RankingEntry {
    this.ensureProfileDefaults();
    const recs = this.profile.gameRecords!;
    const gameIds: GameId[] = ['fish', 'memory', 'escape', 'galaxy'];
    const totalScore = gameIds.reduce(
      (sum, id) => sum + (recs[id]?.highScore || 0),
      0
    );
    const bestStage = gameIds.reduce(
      (max, id) => Math.max(max, recs[id]?.maxStage || 1),
      1
    );
    const coinsEarned = gameIds.reduce(
      (sum, id) => sum + (recs[id]?.totalCoins || 0),
      0
    );
    const gameScores: Partial<Record<GameId, number>> = {
      fish: recs.fish?.highScore || 0,
      memory: recs.memory?.highScore || 0,
      escape: recs.escape?.highScore || 0,
      galaxy: recs.galaxy?.highScore || 0,
    };
    const gameStages: Partial<Record<GameId, number>> = {
      fish: recs.fish?.maxStage || 1,
      memory: recs.memory?.maxStage || 1,
      escape: recs.escape?.maxStage || 1,
      galaxy: recs.galaxy?.maxStage || 1,
    };
    const id = this.firebaseUser?.uid || 'local_player';
    return {
      id,
      playerName: this.getPlayerDisplayName(),
      petName: this.profile.petName || 'Miau',
      totalScore,
      bestStage,
      coinsEarned,
      gameScores,
      gameStages,
      isCurrentUser: true,
      updatedAtMs: Date.now(),
    };
  }

  private async syncRankingEntry(): Promise<void> {
    const entry = this.buildCurrentRankingEntry();
    try {
      const savedRaw = localStorage.getItem(LOCAL_RANKING_KEY);
      const saved: RankingEntry[] = savedRaw ? JSON.parse(savedRaw) : [];
      const filtered = saved.filter((r) => r.id !== entry.id);
      filtered.push(entry);
      localStorage.setItem(
        LOCAL_RANKING_KEY,
        JSON.stringify(filtered.slice(0, 20))
      );
    } catch {
      // ignore storage errors
    }
    if (this.firebaseUser) {
      await upsertRankingEntry(this.firebaseUser.uid, {
        playerName: entry.playerName,
        petName: entry.petName,
        totalScore: entry.totalScore,
        bestStage: entry.bestStage,
        coinsEarned: entry.coinsEarned,
        gameScores: entry.gameScores,
        gameStages: entry.gameStages,
      });
    }
  }

  private async openRankingModal(): Promise<void> {
    this.activeModal = 'ranking';
    this.rankingLoading = true;
    this.render();

    const currentEntry = this.buildCurrentRankingEntry();
    let remote: RankingEntry[] = [];
    try {
      remote = await loadTopRankings(25);
    } catch {
      remote = [];
    }

    let localSaved: RankingEntry[] = [];
    try {
      const raw = localStorage.getItem(LOCAL_RANKING_KEY);
      if (raw) localSaved = JSON.parse(raw) as RankingEntry[];
    } catch {
      localSaved = [];
    }

    const byId = new Map<string, RankingEntry>();
    for (const item of [...SEED_RANKING_ENTRIES, ...localSaved, ...remote]) {
      const prev = byId.get(item.id);
      if (!prev || item.totalScore >= prev.totalScore) {
        byId.set(item.id, {
          ...item,
          isCurrentUser: item.id === currentEntry.id,
        });
      }
    }
    byId.set(currentEntry.id, currentEntry);

    this.leaderboard = [...byId.values()]
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 20);
    this.rankingLoading = false;
    if (this.activeModal === 'ranking') {
      this.render();
    }
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

  private async persistMessage(
    msg: {
      sender: 'user' | 'miau';
      meowPrefix: string;
      text: string;
      mood: MiauMood;
    },
    optimistic = false
  ): Promise<void> {
    const tempId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const localMsg: ChatMessage = {
      id: tempId,
      ownerId: this.profile.ownerId,
      sender: msg.sender,
      meowPrefix: msg.meowPrefix,
      text: msg.text,
      mood: msg.mood,
      createdAtMs: Date.now(),
    };
    if (optimistic) {
      this.messages.push(localMsg);
    }

    if (this.firebaseUser) {
      try {
        const saved = await saveMessage(this.firebaseUser.uid, msg);
        if (optimistic) {
          const idx = this.messages.findIndex((m) => m.id === tempId);
          if (idx >= 0) {
            this.messages[idx] = saved;
          } else {
            this.messages.push(saved);
          }
        } else {
          this.messages.push(saved);
        }
        return;
      } catch (e) {
        console.warn('Falha ao salvar mensagem no Firestore:', e);
      }
    }

    if (!optimistic) {
      this.messages.push(localMsg);
    }
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
    this.humanProfile = createEmptyHumanProfile('demo');
    void loadUserHumanProfile(null, 'demo').then((hp) => {
      this.humanProfile = hp;
      if (
        !hp.fullName &&
        nameHint &&
        nameHint.trim() &&
        !nameHint.includes('@')
      ) {
        this.humanProfile.fullName = nameHint.trim().slice(0, 100);
      }
      if (
        this.activeModal === 'menu' ||
        this.activeModal === 'profile' ||
        this.activeModal === 'learn'
      ) {
        this.render();
      }
    });
    soundService.setEnabled(this.profile.soundEnabled);
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
    this.currentSpeech = {
      meowPrefix: 'Purrr~ 💖',
      text: '(Que carinho gostoso, humano!)',
    };
    this.updateStatusBarsDOM();
    this.updateSpeechDOM();
    this.updateCharacterSvgDOM();
    this.speakCurrentCaption({ pitchMultiplier: 1.05 });
    void this.persistStats();
  }

  public handleMeowInteraction(): void {
    if (this.isSleeping) {
      this.toggleSleep();
    }
    this.ensureProfileDefaults();
    const lines: Array<[string, string]> = [
      ['Miau! 😺', '(Que alegria ter você aqui comigo!)'],
      ['Miauuu~ ✨', '(Adoro passar esse tempinho com você!)'],
      ['Purrr~ 🐾', '(Estou cheio de energia e carinho!)'],
      ['Miau! 💕', '(Você é o melhor amigo do mundo!)'],
    ];
    const [prefix, msg] = lines[Math.floor(Math.random() * lines.length)];
    soundService.playMeow(1.08 + Math.random() * 0.22);
    hapticService.tap();
    this.mood = 'happy';
    this.profile.stats.fun = Math.min(100, this.profile.stats.fun + 5);
    this.profile.stats.happiness = Math.min(
      100,
      this.profile.stats.happiness + 6
    );
    this.addRewards(4, 4);
    this.triggerMiauReaction('jump');
    this.spawnFloatingParticle('🎵');
    this.currentSpeech = { meowPrefix: prefix, text: msg };
    this.updateStatusBarsDOM();
    this.updateSpeechDOM();
    this.updateCharacterSvgDOM();
    this.speakCurrentCaption();
    void this.persistStats();
  }

  public handleQuickFeed(): void {
    this.ensureProfileDefaults();
    const fish = FOOD_ITEMS[0];
    const neededFood = this.profile.stats.hunger < 85;
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
    this.addRewards(neededFood ? 6 : 0, fish.xpReward);
    const claimedRoutine = this.claimRoutineSlot('food');
    this.evaluateAchievements();
    soundService.playCrunch();
    hapticService.chomp();
    this.mood = 'eating';
    this.triggerMiauReaction('jump');
    this.spawnFloatingParticle('🐟');
    if (!claimedRoutine) {
      this.currentSpeech = {
        meowPrefix: 'Nham nham!',
        text: '(Que peixinho delicioso, obrigado!)',
      };
    } else {
      this.currentSpeech = {
        meowPrefix: 'Nham nham! ⏰',
        text: `(Refeição no horário! +${claimedRoutine.bonusCoins} moedas bônus!)`,
      };
    }
    this.updateStatusBarsDOM();
    this.updateSpeechDOM();
    this.updateCharacterSvgDOM();
    this.speakCurrentCaption();
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
    const neededBath = this.profile.stats.hygiene < 92;
    soundService.playBubble();
    hapticService.bubbles();
    this.profile.stats.hygiene = Math.min(100, this.profile.stats.hygiene + 22);
    this.profile.stats.happiness = Math.min(
      100,
      this.profile.stats.happiness + 8
    );
    this.profile.progress.cleanCount += 1;
    this.addRewards(neededBath ? 12 : 0, 10);
    const claimedRoutine = this.claimRoutineSlot('bath');
    this.evaluateAchievements();
    this.mood = 'happy';
    this.triggerMiauReaction('spin');
    this.spawnFloatingParticle('🫧');
    this.currentSpeech = claimedRoutine
      ? {
          meowPrefix: 'Purrr~ ⏰',
          text: `(Banho no horário! +${claimedRoutine.bonusCoins} moedas de bônus!)`,
        }
      : {
          meowPrefix: 'Purrr~',
          text: '(Fiquei limpinho e cheiroso!)',
        };
    this.updateStatusBarsDOM();
    this.updateSpeechDOM();
    this.updateCharacterSvgDOM();
    this.speakCurrentCaption();
    void this.persistStats();
  }

  public handleQuickPlay(source: 'yarn' | 'ball' = 'yarn'): void {
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
    this.spawnFloatingParticle(source === 'ball' ? '⚽' : '🧶');
    this.currentSpeech =
      source === 'ball'
        ? {
            meowPrefix: 'Miau!! ⚽',
            text: '(Peguei a bolinha! Joga de novo!)',
          }
        : {
            meowPrefix: 'Miau!! 🧶',
            text: '(Adorei brincar com o novelo de lã!)',
          };
    this.updateStatusBarsDOM();
    this.updateSpeechDOM();
    this.updateCharacterSvgDOM();
    this.speakCurrentCaption({ pitchMultiplier: 1.12 });
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
      this.ensureProfileDefaults();
      soundService.playPurr();
      hapticService.purr();
      const nowMs = Date.now();
      let sleepBonusCoins = 0;
      if (
        this.profile.stats.sleep < 90 &&
        nowMs - this.lastSleepRewardAtMs > 60_000
      ) {
        this.lastSleepRewardAtMs = nowMs;
        sleepBonusCoins = 10;
        this.addRewards(10, 8);
      }
      const claimedRoutine = this.claimRoutineSlot('sleep');
      this.currentSpeech = claimedRoutine
        ? {
            meowPrefix: 'Zzz... ⏰',
            text: `(Soneca no horário! +${claimedRoutine.bonusCoins} moedas bônus!)`,
          }
        : sleepBonusCoins > 0
          ? {
              meowPrefix: 'Zzz...',
              text: '(Hora da soneca gostosa... +10 moedas!)',
            }
          : {
              meowPrefix: 'Zzz...',
              text: '(Hora da soneca gostosa...)',
            };
      this.speakCurrentCaption();
      void this.persistStats();
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
      this.speakCurrentCaption();
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
    this.speakCurrentCaption();
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

  private speakCurrentCaption(options?: {
    withLeadingMeow?: boolean;
    pitchMultiplier?: number;
    fallbackMeowOnError?: boolean;
  }): void {
    void miauSpeechService.speakPhrase(
      this.currentSpeech.meowPrefix,
      this.currentSpeech.text,
      options
    );
  }

  private toggleSoundMute = (): boolean => {
    hapticService.tap();
    this.profile.soundEnabled = !this.profile.soundEnabled;
    soundService.setEnabled(this.profile.soundEnabled);
    miauSpeechService.cancel();
    this.liveSession?.setMuted(!this.profile.soundEnabled);
    this.updateMuteButtonsDOM();
    void this.persistSettings();
    return this.profile.soundEnabled;
  };

  private updateMuteButtonsDOM(): void {
    const enabled = this.profile.soundEnabled;
    const topBtn = this.root.querySelector('#btn-top-sound') as HTMLButtonElement | null;
    if (topBtn) {
      topBtn.textContent = enabled ? '🔊' : '🔇';
      topBtn.setAttribute('aria-pressed', String(!enabled));
      topBtn.setAttribute('aria-label', enabled ? 'Silenciar áudio' : 'Ativar áudio');
      topBtn.className = `w-9 h-9 rounded-full backdrop-blur border flex items-center justify-center text-base shadow-sm hover:scale-105 transition ${
        enabled
          ? 'bg-white/75 border-white/80 text-[#3b1f6e]'
          : 'bg-rose-100/95 border-rose-300 text-rose-700'
      }`;
    }
    const chatMuteBtn = this.root.querySelector('#btn-chat-mute') as HTMLButtonElement | null;
    if (chatMuteBtn) {
      chatMuteBtn.textContent = enabled ? '🔊 Som' : '🔇 Mudo';
      chatMuteBtn.setAttribute('aria-pressed', String(!enabled));
      chatMuteBtn.setAttribute('aria-label', enabled ? 'Silenciar áudio' : 'Ativar áudio');
      chatMuteBtn.className = `px-3 py-1.5 rounded-full text-xs font-extrabold shadow-sm border transition ${
        enabled
          ? 'bg-white/95 border-purple-200 text-[#4c2a85] hover:bg-purple-50'
          : 'bg-rose-100 border-rose-300 text-rose-800 hover:bg-rose-200'
      }`;
    }
  }

  private async playCurrentMiauSpeech(autoSpeakTTS = true): Promise<void> {
    if (!this.profile.soundEnabled) return;
    if (!autoSpeakTTS) {
      soundService.playMeow(1.05);
      return;
    }
    await miauSpeechService.speakPhrase(
      this.currentSpeech.meowPrefix,
      this.currentSpeech.text,
      { withLeadingMeow: true, pitchMultiplier: 1.05 }
    );
  }

  private async sendChatToMiau(userText: string): Promise<void> {
    const trimmed = userText.trim();
    if (!trimmed || this.isThinking) return;

    this.ensureProfileDefaults();
    this.lastUserInteractionAt = Date.now();
    this.hasUserGesture = true;
    this.isThinking = true;
    this.currentSpeech = {
      meowPrefix: 'Miau...',
      text: '(Ouvindo você com carinho...)',
    };
    this.updateSpeechDOM();

    const recentHistory = this.messages.slice(-4);
    const contextSnapshot = buildConversationContextSnapshot(this.humanProfile);
    const userPersistPromise = this.persistMessage(
      {
        sender: 'user',
        meowPrefix: '',
        text: trimmed,
        mood: 'happy',
      },
      true
    );
    this.refreshChatModalIfOpen();

    try {
      const reply = await askMiau({
        message: trimmed,
        history: recentHistory,
        stats: this.profile.stats,
        equipped: this.profile.equipped,
        petName: this.profile.petName,
        temporalContext: contextSnapshot.temporal,
        userContext: contextSnapshot.user,
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

      this.isThinking = false;
      this.triggerMiauReaction('jump');
      hapticService.coin();
      this.updateSpeechDOM();
      this.updateStatusBarsDOM();
      this.updateCharacterSvgDOM();
      void this.playCurrentMiauSpeech(true);

      const miauPersistPromise = (async () => {
        await userPersistPromise;
        await this.persistMessage(
          {
            sender: 'miau',
            meowPrefix: reply.meowPrefix,
            text: reply.text,
            mood: reply.mood,
          },
          true
        );
        this.refreshChatModalIfOpen();
        await this.persistStats();
      })();
      this.refreshChatModalIfOpen();
      await miauPersistPromise;
    } catch (error) {
      this.isThinking = false;
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
      this.refreshChatModalIfOpen();
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

    const recs = this.profile.gameRecords!;
    const prevRec = recs[res.gameId];
    const isNewRecord = res.score > prevRec.highScore && prevRec.highScore > 0;
    const recordBonus = isNewRecord ? 25 : 0;
    const totalCoinsGained = res.coinsEarned + recordBonus;

    recs[res.gameId] = {
      highScore: Math.max(prevRec.highScore, res.score),
      maxStage: Math.max(prevRec.maxStage, res.stageReached || 1),
      bestTimeSec:
        prevRec.bestTimeSec === 0
          ? res.durationSec
          : Math.max(prevRec.bestTimeSec, res.durationSec),
      totalCoins: prevRec.totalCoins + totalCoinsGained,
      plays: prevRec.plays + 1,
    };
    this.appendGameMatchHistory(res, totalCoinsGained);

    this.addRewards(totalCoinsGained, res.xpEarned);
    const unlockedNew = this.evaluateAchievements();
    soundService.playCoin();
    if (res.performanceTier === 'gold' || isNewRecord) {
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

    if (isNewRecord) {
      this.currentSpeech = {
        meowPrefix: 'NOVO RECORDE!! 🏆',
        text: `(${res.gameName}: ${res.score} pts • Fase ${res.stageReached}! +${totalCoinsGained} moedas com bônus!)`,
      };
    } else if (res.performanceTier === 'gold') {
      this.currentSpeech = {
        meowPrefix: 'Miau!! 🏆',
        text: `(${res.gameName}: ${res.summaryText}! Você arrasou, ganhamos +${totalCoinsGained} moedas!)`,
      };
    } else if (res.performanceTier === 'silver') {
      this.currentSpeech = {
        meowPrefix: 'Miau! ✨',
        text: `(${res.gameName}: ${res.summaryText}! Mandou super bem, +${totalCoinsGained} moedas!)`,
      };
    } else {
      this.currentSpeech = {
        meowPrefix: 'Purrr~ 🐾',
        text: `(${res.gameName}: ${res.summaryText}! Foi muito divertido, +${totalCoinsGained} moedas!)`,
      };
    }

    this.render();
    this.triggerMiauReaction('spin');
    this.spawnFloatingParticle(res.performanceTier === 'gold' ? '🏆' : '🎮');
    if (!unlockedNew) {
      this.showToast(
        isNewRecord
          ? `🏆 Novo Recorde em ${res.gameName}! +${totalCoinsGained} moedas`
          : `${res.gameName}: +${totalCoinsGained} moedas e +${res.xpEarned} XP!`
      );
    }
    void this.persistStats();
    void this.syncRankingEntry();
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

    const contextSnapshot = buildConversationContextSnapshot(this.humanProfile);
    try {
      const reply = await askMiau({
        message: prompt,
        history: this.messages,
        stats: this.profile.stats,
        equipped: this.profile.equipped,
        petName: this.profile.petName,
        temporalContext: contextSnapshot.temporal,
        userContext: contextSnapshot.user,
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
      this.speakCurrentCaption();
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
    this.syncXR();
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
    listEl.innerHTML = renderChatHistoryItemsHtml(
      this.messages,
      this.isThinking
    );
    listEl.scrollTop = listEl.scrollHeight;
    this.bindChatHistorySpeakButtons();
  }

  private bindChatHistorySpeakButtons(): void {
    this.root.querySelectorAll('[data-speak-msg]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rawIdx = btn.getAttribute('data-speak-msg');
        const idx = rawIdx ? Number(rawIdx) : -1;
        const msg = this.messages[idx];
        if (!msg) return;
        void miauSpeechService.speakPhrase(msg.meowPrefix, msg.text, {
          withLeadingMeow: true,
          pitchMultiplier: 1.05,
        });
      });
    });
  }

  private updateMicButtonsDOM(): void {
    const applyState = (btn: Element | null) => {
      if (!btn) return;
      btn.classList.toggle('bg-rose-500', this.isRecordingMic);
      btn.classList.toggle('animate-pulse', this.isRecordingMic);
      btn.classList.toggle('bg-[#7b52b8]', !this.isRecordingMic);
      btn.setAttribute(
        'aria-label',
        this.isRecordingMic
          ? 'Parar e enviar áudio'
          : 'Gravar mensagem de áudio'
      );
    };
    applyState(this.root.querySelector('#btn-mic'));
    applyState(this.root.querySelector('#btn-modal-mic'));
  }

  private async handleMicToggle(): Promise<void> {
    if (this.isRecordingMic) {
      this.isRecordingMic = false;
      this.updateMicButtonsDOM();
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
        this.updateMicButtonsDOM();
        this.showToast('Gravando... toque no microfone para enviar!');
      } catch {
        this.showToast('Permissão de microfone necessária para falar.');
      }
    }
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
    this.root.innerHTML = renderPreloaderHtml(this.preloaderProgress);
  }

  private renderLogin(): void {
    this.root.innerHTML = renderLoginScreenHtml({
      authMode: this.authMode,
      showPassword: this.showPassword,
      authError: this.authError,
      authNotice: this.authNotice,
      showLegalModal: this.activeModal === 'legal',
      legalDoc: this.legalDoc,
      installGuideHtml: this.showInstallGuideModal
        ? renderInstallGuideModalHtml()
        : '',
    });

    bindLoginScreenEvents(this.root, this.authMode, {
      onTogglePassword: (savedEmail, savedPw) => {
        this.showPassword = !this.showPassword;
        this.renderLogin();
        const newEmail = this.root.querySelector(
          '#login-email'
        ) as HTMLInputElement | null;
        const newPw = this.root.querySelector(
          '#login-password'
        ) as HTMLInputElement | null;
        if (newEmail) newEmail.value = savedEmail;
        if (newPw) newPw.value = savedPw;
      },
      onSwitchMode: (nextMode) => {
        this.authError = '';
        this.authNotice = '';
        this.authMode = nextMode;
        this.renderLogin();
      },
      onGoogleSignIn: async () => {
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
            this.authError =
              'O navegador bloqueou a janela do Google. Permita pop-ups para este site e tente novamente.';
          } else {
            this.authError = `Não foi possível entrar com o Google: ${msg}`;
          }
          this.renderLogin();
        }
      },
      onSubmitCredentials: async (emailOrUser, password) => {
        this.authError = '';
        this.authNotice = '';
        if (this.authMode === 'forgot') {
          if (!emailOrUser.includes('@')) {
            this.authError = 'Informe um e-mail válido para recuperar a senha.';
            this.renderLogin();
            return;
          }
          try {
            await resetPassword(emailOrUser);
            this.authNotice =
              'E-mail de recuperação enviado! Confira sua caixa de entrada.';
          } catch (err) {
            this.authError =
              err instanceof Error
                ? err.message
                : 'Erro ao enviar recuperação.';
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
              this.enterDemoMode(emailOrUser);
              return;
            }
            this.authError =
              err instanceof Error ? err.message : 'Erro na autenticação.';
            this.renderLogin();
            return;
          }
        } else {
          this.enterDemoMode(emailOrUser);
        }
      },
      onOpenLegal: (doc) => {
        this.legalDoc = doc;
        this.activeModal = 'legal';
        this.renderLogin();
      },
      onCloseLegal: () => {
        this.activeModal = 'none';
        this.renderLogin();
      },
      onInstallApp: () => {
        void this.handleInstallAppClick();
      },
      onCloseInstallGuide: () => {
        this.showInstallGuideModal = false;
        this.render();
      },
    });
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
      case 'bg_pastel_garden':
        return {
          wall: 'from-[#dff7ea] via-[#fde8f5] to-[#e9d5ff]',
          floor: 'from-[#bbf7d0] to-[#86efac]',
          showFloor: false,
          useWallpaper: false,
        };
      case 'bg_space':
        return {
          wall: 'from-[#131138] via-[#261f5e] to-[#392978]',
          floor: 'from-[#312e81] to-[#1e1b4b]',
          showFloor: true,
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
    this.ensureProfileDefaults();
    const s = this.profile.stats;
    const theme = this.getRoomThemeClasses();
    const isNight =
      this.isSleeping ||
      this.profile.equipped.background === 'bg_night' ||
      this.profile.equipped.background === 'bg_space';
    const routineDone = this.profile.dailyRoutine?.completedSlots.length || 0;
    const activeRoutineCount = this.getActiveWindowSlots().length;

    this.root.innerHTML = `
      <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#dfd0ff] via-[#cbb1fb] to-[#b896f5] md:p-4">
        <div class="relative w-full h-full md:max-w-[440px] md:max-h-[860px] md:rounded-[42px] md:border-[6px] md:border-white/80 md:shadow-[0_24px_70px_rgba(64,33,117,0.3)] overflow-hidden flex flex-col bg-gradient-to-b ${theme.wall}">
          ${theme.useWallpaper ? '<div class="pointer-events-none absolute inset-0 miau-wallpaper z-0"></div>' : ''}

          <!-- Night / Sleep Dimmer -->
          <div class="pointer-events-none absolute inset-0 transition-opacity duration-500 bg-indigo-950/35 z-10 ${this.isSleeping ? 'opacity-100' : 'opacity-0'}"></div>

          <!-- Top Header -->
          <header class="relative z-20 px-4 pt-3.5 pb-2 flex items-center justify-between gap-2">
            <button id="btn-menu" aria-label="Abrir menu" class="w-10 h-10 rounded-full bg-white/60 backdrop-blur border border-white/80 flex items-center justify-center text-[#3b1f6e] shadow-sm hover:scale-105 transition shrink-0">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" d="M4 7h16M4 12h16M4 17h16"/>
              </svg>
            </button>

            <h1 class="font-display text-2xl font-bold ${isNight ? 'text-white' : 'text-[#2d1b4e]'} tracking-tight truncate">Sala de Estar</h1>

            <div class="flex items-center gap-1.5 shrink-0">
              <button
                id="btn-top-sound"
                type="button"
                aria-pressed="${!this.profile.soundEnabled}"
                aria-label="${this.profile.soundEnabled ? 'Silenciar áudio' : 'Ativar áudio'}"
                class="w-9 h-9 rounded-full backdrop-blur border flex items-center justify-center text-base shadow-sm hover:scale-105 transition ${
                  this.profile.soundEnabled
                    ? 'bg-white/75 border-white/80 text-[#3b1f6e]'
                    : 'bg-rose-100/95 border-rose-300 text-rose-700'
                }"
              >${this.profile.soundEnabled ? '🔊' : '🔇'}</button>
              ${
                this.screenPrefs.showCoinsBadge
                  ? `<div class="flex items-center gap-1.5 bg-[#4a3566]/85 text-white rounded-full pl-1.5 pr-3 py-1 shadow-md border border-white/30">
                       <span class="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 border border-yellow-100 flex items-center justify-center text-xs font-extrabold text-amber-900 shadow-inner">$</span>
                       <span id="miau-coins" class="text-sm font-extrabold">${this.profile.coins.toLocaleString('pt-BR')}</span>
                     </div>`
                  : ''
              }
            </div>
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
                      ? `<div class="flex justify-between items-center gap-1.5 ${this.screenPrefs.showStatusBars ? 'mt-2' : ''}">
                          <div class="flex items-center gap-1.5">
                            <button id="btn-achievements" type="button" class="glass-pill px-2.5 py-1 rounded-full text-xs font-extrabold text-[#4c2a85] flex items-center gap-1 hover:scale-105 transition">
                              <span>🏆</span>
                              <span id="achievements-count">${(this.profile.unlockedAchievements || []).length}/${ACHIEVEMENTS.length}</span>
                            </button>
                            <button id="btn-routine" type="button" class="glass-pill px-2.5 py-1 rounded-full text-xs font-extrabold text-[#4c2a85] flex items-center gap-1 hover:scale-105 transition ${activeRoutineCount > 0 ? 'ring-2 ring-amber-400' : ''}">
                              <span>📅</span>
                              <span>${routineDone}/${ROUTINE_SCHEDULE.length}</span>
                            </button>
                          </div>
                          <div class="flex items-center gap-1.5">
                            <button id="btn-sleep-toggle" class="glass-pill px-2.5 py-1 rounded-full text-xs font-bold text-[#4c2a85] flex items-center gap-1 hover:scale-105 transition">
                              ${this.isSleeping ? '☀️ Acordar' : '🌙 Soneca'}
                            </button>
                            <div id="miau-level" class="glass-pill px-3 py-1 rounded-full text-xs font-extrabold text-[#3b1f6e]">
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
                  <div id="speech-bubble-card" class="relative glass-card rounded-[24px] p-3 flex items-center gap-3 cursor-pointer hover:brightness-[1.02] transition">
                    <div class="w-12 h-12 rounded-full overflow-hidden border-2 border-purple-200 bg-purple-100 shrink-0 shadow-sm">
                      <img src="${MIAU_AVATAR_URL}" alt="Miau" referrerpolicy="no-referrer" class="w-full h-full object-cover" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div id="speech-prefix" class="font-display text-sm font-bold text-[#2d1b4e]">${escapeHtml(this.currentSpeech.meowPrefix)}</div>
                      <div id="speech-text" class="text-sm font-semibold text-[#473173] leading-snug break-words">${escapeHtml(this.currentSpeech.text)}</div>
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
          >${escapeHtml(this.toastMessage)}</div>

          <!-- Active Drawer / Modal -->
          ${this.activeModal !== 'none' ? this.renderModal() : ''}
          ${this.showInstallGuideModal ? renderInstallGuideModalHtml() : ''}
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
    this.ensureProfileDefaults();
    let body = '';
    if (this.activeModal === 'feed') {
      body = renderFeedModalHtml();
    } else if (this.activeModal === 'clean') {
      body = renderCleanModalHtml();
    } else if (this.activeModal === 'games') {
      body = renderGamesHubModalHtml(this.profile, this.activeMiniGame);
    } else if (this.activeModal === 'customize') {
      body = renderCustomizeModalHtml(this.profile, this.shopTab);
    } else if (this.activeModal === 'chat') {
      body = renderChatModalHtml({
        petName: this.profile.petName,
        liveStatus: this.liveStatus,
        hasLiveSession: Boolean(this.liveSession),
        liveTranscript: this.liveTranscript,
        messages: this.messages,
        soundEnabled: this.profile.soundEnabled,
        isRecordingMic: this.isRecordingMic,
        isThinking: this.isThinking,
      });
    } else if (this.activeModal === 'achievements') {
      body = renderAchievementsModalHtml(this.profile);
    } else if (this.activeModal === 'ranking') {
      body = renderRankingModalHtml({
        currentEntry: this.buildCurrentRankingEntry(),
        leaderboard: this.leaderboard,
        rankingLoading: this.rankingLoading,
        activeTab: this.rankingTab,
        gameRecords: this.profile.gameRecords!,
        matchHistory: this.loadGameMatchHistory(),
      });
    } else if (this.activeModal === 'routine') {
      body = renderRoutineModalHtml(
        this.profile,
        this.isSleeping,
        (slot, now) => this.isSlotInWindow(slot, now)
      );
    } else if (this.activeModal === 'menu') {
      const unlockedCount = (this.profile.unlockedAchievements || []).length;
      const routineDone = this.profile.dailyRoutine?.completedSlots.length || 0;
      const visibleHudCount = [
        this.screenPrefs.showStatusBars,
        this.screenPrefs.showStatusBadges,
        this.screenPrefs.showSpeechAndChat,
        this.screenPrefs.showCoinsBadge,
      ].filter(Boolean).length;
      body = renderMenuModalHtml({
        accountLabel:
          this.firebaseUser?.displayName ||
          this.firebaseUser?.email ||
          'Modo Demonstração Local',
        isFirebaseAccount: Boolean(this.firebaseUser),
        humanProfile: this.humanProfile,
        unlockedCount,
        routineDoneCount: routineDone,
        visibleHudCount,
      });
    } else if (this.activeModal === 'profile') {
      body = this.profileModal.render();
    } else if (this.activeModal === 'learn') {
      body = renderLearnModalHtml(this.humanProfile, this.learnPreviewLevel);
    } else if (this.activeModal === 'settings') {
      body = renderSettingsModalHtml({
        screenPrefs: this.screenPrefs,
        soundEnabled: this.profile.soundEnabled,
        cameraPermission: this.cameraPermission,
      });
    } else if (this.activeModal === 'support') {
      body = renderSupportModalHtml(
        this.supportDraft,
        this.buildSupportWhatsAppUrl(this.supportDraft)
      );
    }

    return `
      <div id="modal-fullscreen" class="fixed inset-0 z-30 flex flex-col bg-gradient-to-b from-[#ede4ff] via-[#e4d5fc] to-[#d9c4fa] overflow-hidden">
        <div class="w-full max-w-4xl mx-auto h-full flex flex-col p-4 md:p-6 min-h-0">
          ${body}
        </div>
      </div>
    `;
  }

  private openConversarModal(): void {
    this.activeModal = 'chat';
    this.lastUserInteractionAt = Date.now();
    this.hasUserGesture = true;
    const ctx = buildConversationContextSnapshot(this.humanProfile);
    const now = Date.now();
    const lastMsg = this.messages[this.messages.length - 1];
    const hasRecentMiauCheckIn =
      lastMsg?.sender === 'miau' &&
      now - lastMsg.createdAtMs < 90_000 &&
      now - this.lastFriendModalGreetAt < 120_000;

    if (!hasRecentMiauCheckIn) {
      this.lastFriendModalGreetAt = now;
      const greeting = buildFriendGreeting(ctx, this.profile.petName);
      this.currentSpeech = {
        meowPrefix: greeting.meowPrefix,
        text: greeting.text,
      };
      this.mood = greeting.mood;
      this.render();
      void this.playCurrentMiauSpeech(true);
      void this.persistMessage(
        {
          sender: 'miau',
          meowPrefix: greeting.meowPrefix,
          text: greeting.text,
          mood: greeting.mood,
        },
        true
      ).then(() => this.refreshChatModalIfOpen());
    } else {
      this.render();
      if (lastMsg) {
        this.currentSpeech = {
          meowPrefix: lastMsg.meowPrefix || 'Miau!',
          text: lastMsg.text,
        };
        void this.playCurrentMiauSpeech(true);
      }
    }
  }

  private bindGameEvents(): void {
    this.ballController?.dispose();
    this.ballController = null;
    if (
      this.screen === 'game' &&
      this.activeModal === 'none' &&
      !this.isSleeping &&
      !this.isCleaningMode
    ) {
      const stageEl = this.root.querySelector('#miau-stage') as HTMLElement | null;
      const charWrapEl = this.root.querySelector('#miau-character-wrap') as HTMLElement | null;
      if (stageEl) {
        this.ballController = mountInteractiveBall(stageEl, charWrapEl, () => {
          this.handleQuickPlay('ball');
        });
      }
    }

    // Pet Miau or rub bubbles in cleaning mode
    const miauWrap = this.root.querySelector('#miau-character-wrap');
    miauWrap?.addEventListener('click', () => {
      if (this.isCleaningMode) {
        this.ensureProfileDefaults();
        const neededWash = this.profile.stats.hygiene < 98;
        soundService.playBubble();
        hapticService.bubbles();
        this.profile.stats.hygiene = Math.min(100, this.profile.stats.hygiene + 8);
        this.profile.stats.happiness = Math.min(
          100,
          this.profile.stats.happiness + 3
        );
        this.addRewards(neededWash ? 4 : 0, 4);
        this.spawnFloatingParticle('🫧');
        this.updateStatusBarsDOM();
        this.triggerMiauReaction('bounce');
        if (this.profile.stats.hygiene >= 98) {
          this.isCleaningMode = false;
          this.profile.progress.cleanCount += 1;
          const claimedRoutine = this.claimRoutineSlot('bath');
          this.evaluateAchievements();
          hapticService.coin();
          this.currentSpeech = claimedRoutine
            ? {
                meowPrefix: 'Purrr~ ⏰',
                text: `(Banho no horário! +${claimedRoutine.bonusCoins} moedas de bônus!)`,
              }
            : {
                meowPrefix: 'Purrr~',
                text: '(Estou limpinho e reluzente!)',
              };
          this.render();
          this.triggerMiauReaction('spin');
          this.speakCurrentCaption();
        }
        void this.persistStats();
      } else {
        this.handlePetInteraction();
      }
    });

    this.root
      .querySelector('#btn-top-sound')
      ?.addEventListener('click', () => void this.toggleSoundMute());

    // Speaker button & speech bubble tap
    this.root.querySelector('#btn-speaker')?.addEventListener('click', (e) => {
      e.stopPropagation();
      void this.playCurrentMiauSpeech(true);
    });
    this.root
      .querySelector('#speech-bubble-card')
      ?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest('#btn-speaker')) return;
        hapticService.tap();
        this.openConversarModal();
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

    // Mic transcription buttons (main screen + Conversar modal)
    this.root.querySelector('#btn-mic')?.addEventListener('click', () => {
      void this.handleMicToggle();
    });
    this.root.querySelector('#btn-modal-mic')?.addEventListener('click', () => {
      void this.handleMicToggle();
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

    this.root.querySelector('#btn-routine')?.addEventListener('click', () => {
      this.activeModal = this.activeModal === 'routine' ? 'none' : 'routine';
      this.render();
    });

    // Bottom Navigation
    this.root.querySelectorAll('[data-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        hapticService.tap();
        const target = btn.getAttribute('data-nav') as ActiveModal;
        this.profileModal.disposeCameraStream();
        this.isCleaningMode = false;
        this.activeMiniGame = 'none';
        this.miniGameCleanup?.();
        this.miniGameCleanup = null;
        if (target === 'chat' && this.activeModal !== 'chat') {
          this.openConversarModal();
          return;
        }
        this.activeModal = this.activeModal === target ? 'none' : target;
        this.render();
      });
    });

    // Full-screen close / back controls
    this.root.querySelectorAll('[data-modal-close]').forEach((btn) => {
      btn.addEventListener('click', () => this.closeActiveModal());
    });
    this.root
      .querySelector('#modal-close')
      ?.addEventListener('click', () => this.closeActiveModal());
    this.root
      .querySelector('#btn-chat-mute')
      ?.addEventListener('click', () => void this.toggleSoundMute());

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
        const neededFood = this.profile.stats.hunger < 85;
        this.profile.coins -= food.cost;
        this.profile.stats.hunger = Math.min(
          100,
          this.profile.stats.hunger + food.hungerBoost
        );
        this.profile.stats.fun = Math.min(
          100,
          this.profile.stats.fun + food.funBoost
        );
        const happyGain =
          food.happinessBoost ?? Math.max(4, Math.round(food.funBoost * 0.8));
        this.profile.stats.happiness = Math.min(
          100,
          this.profile.stats.happiness + happyGain
        );
        this.profile.progress.mealsFed += 1;
        this.addRewards(neededFood ? 6 : 0, food.xpReward);
        const claimedRoutine = this.claimRoutineSlot('food');
        this.evaluateAchievements();
        soundService.playCrunch();
        hapticService.chomp();
        this.mood = 'eating';
        this.currentSpeech = claimedRoutine
          ? {
              meowPrefix: 'Nham nham! ⏰',
              text: `(${food.name} no horário! +${claimedRoutine.bonusCoins} moedas bônus!)`,
            }
          : {
              meowPrefix: 'Nham nham!',
              text: `(Adorei o ${food.name}! Que delícia!)`,
            };
        this.activeModal = 'none';
        this.render();
        this.triggerMiauReaction(
          food.id === 'food_salmon' || food.id === 'food_catnip'
            ? 'spin'
            : 'jump'
        );
        this.spawnFloatingParticle(food.emoji);
        this.speakCurrentCaption();
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
      const neededBath = this.profile.stats.hygiene < 92;
      soundService.playBubble();
      hapticService.bubbles();
      this.profile.stats.hygiene = Math.min(100, this.profile.stats.hygiene + 35);
      this.profile.stats.happiness = Math.min(
        100,
        this.profile.stats.happiness + 10
      );
      this.profile.progress.cleanCount += 1;
      this.addRewards(neededBath ? 15 : 0, 12);
      const claimedRoutine = this.claimRoutineSlot('bath');
      this.evaluateAchievements();
      this.currentSpeech = claimedRoutine
        ? {
            meowPrefix: 'Purrr~ ⏰',
            text: `(Banho no horário! +${claimedRoutine.bonusCoins} moedas de bônus!)`,
          }
        : {
            meowPrefix: 'Purrr~',
            text: '(Banho quentinho! Estou cheiroso demais!)',
          };
      this.activeModal = 'none';
      this.render();
      this.triggerMiauReaction('spin');
      this.spawnFloatingParticle('🫧');
      this.spawnFloatingParticle('✨');
      this.speakCurrentCaption();
      void this.persistStats();
    });

    this.root.querySelector('#btn-sponge-mode')?.addEventListener('click', () => {
      hapticService.tap();
      this.isCleaningMode = true;
      this.activeModal = 'none';
      this.render();
    });

    // Mini games launch & ranking
    this.root.querySelector('#btn-open-ranking')?.addEventListener('click', () => {
      void this.openRankingModal();
    });
    this.root.querySelector('#btn-ranking-back')?.addEventListener('click', () => {
      this.activeModal = 'games';
      this.render();
    });
    this.root.querySelectorAll('[data-ranking-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-ranking-tab') as 'all' | GameId | null;
        if (!tab) return;
        this.rankingTab = tab;
        this.render();
      });
    });

    const launchGame = (
      id: 'fish' | 'memory' | 'escape' | 'galaxy'
    ) => {
      this.ensureProfileDefaults();
      const high = this.profile.gameRecords![id].highScore;
      this.activeMiniGame = id;
      this.render();
      const host = this.root.querySelector('#minigame-host') as HTMLElement | null;
      if (!host) return;
      const onDone = (res: MiniGameResult) => void this.handleMiniGameComplete(res);
      const onExit = () => {
        this.miniGameCleanup?.();
        this.miniGameCleanup = null;
        this.activeMiniGame = 'none';
        this.render();
      };
      if (id === 'fish') {
        this.miniGameCleanup = mountFishCatchGame(
          host,
          onDone,
          onExit,
          high,
          this.toggleSoundMute
        );
      } else if (id === 'memory') {
        this.miniGameCleanup = mountMemoryGame(
          host,
          onDone,
          onExit,
          high,
          this.toggleSoundMute
        );
      } else if (id === 'escape') {
        this.miniGameCleanup = mountEscapeRunGame(
          host,
          onDone,
          onExit,
          high,
          this.toggleSoundMute
        );
      } else {
        this.miniGameCleanup = mountGalaxyRatGame(
          host,
          onDone,
          onExit,
          high,
          this.toggleSoundMute
        );
      }
    };

    this.root.querySelector('#start-fish-game')?.addEventListener('click', () => launchGame('fish'));
    this.root.querySelector('#start-memory-game')?.addEventListener('click', () => launchGame('memory'));
    this.root.querySelector('#start-escape-game')?.addEventListener('click', () => launchGame('escape'));
    this.root.querySelector('#start-galaxy-game')?.addEventListener('click', () => launchGame('galaxy'));

    // Routine modal quick actions
    this.root.querySelector('#btn-routine-feed')?.addEventListener('click', () => {
      this.activeModal = 'feed';
      this.render();
    });
    this.root.querySelector('#btn-routine-bath')?.addEventListener('click', () => {
      this.activeModal = 'clean';
      this.render();
    });
    this.root.querySelector('#btn-routine-sleep')?.addEventListener('click', () => {
      this.activeModal = 'none';
      if (!this.isSleeping) {
        this.toggleSleep();
      } else {
        this.render();
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

        const actionSpeech: Record<
          'hat' | 'accessory' | 'background',
          { prefix: string; text: string }
        > = {
          hat: {
            prefix: owned ? 'Miau! 🎩' : 'Uau!! 🎩✨',
            text: owned
              ? `(Coloquei o chapéu ${item.name}! Fiquei estiloso?)`
              : `(Comprei e equipei ${item.name}! Estou muito chique!)`,
          },
          accessory: {
            prefix: owned ? 'Purrr~ 🎀' : 'Miau!! 🎀✨',
            text: owned
              ? `(Adorei usar ${item.name}! Combinou comigo?)`
              : `(Novo visual com ${item.name}! Obrigado por me mimar!)`,
          },
          background: {
            prefix: owned ? 'Miau~ 🏡' : 'Uau!! 🌈✨',
            text: owned
              ? `(Mudei meu cantinho para ${item.name}! Ficou aconchegante!)`
              : `(Novo cenário ${item.name} desbloqueado! Que lindo!)`,
          },
        };
        const picked = actionSpeech[item.category];
        this.mood = 'happy';
        this.currentSpeech = { meowPrefix: picked.prefix, text: picked.text };

        this.render();
        this.triggerMiauReaction('spin');
        this.spawnFloatingParticle(item.emoji);
        this.speakCurrentCaption();
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

    this.root.querySelectorAll('[data-chat-quick]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const prompt = btn.getAttribute('data-chat-quick') || '';
        if (prompt.trim()) {
          void this.sendChatToMiau(prompt);
        }
      });
    });

    this.bindChatHistorySpeakButtons();

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
          hapticService.tap();
          this.render();
          return;
        }
        hapticService.tap();
        this.liveStatus = 'Conectando ao Gemini Live...';
        this.liveTranscript = '';
        this.liveInputBuffer = '';
        this.liveOutputBuffer = '';
        this.render();
        let hadLiveError = false;
        const session = new LiveVoiceSession({
          onStatus: (status) => {
            this.liveStatus = status;
            const el = this.root.querySelector('#live-status-text');
            if (el) el.textContent = status;
          },
          onInputTranscript: (txt) => {
            this.liveInputBuffer += txt;
            this.liveTranscript += `Você: ${txt}\n`;
            this.render();
          },
          onOutputTranscript: (txt) => {
            this.liveOutputBuffer += txt;
            this.liveTranscript += `Miau: ${txt}\n`;
            this.currentSpeech = { meowPrefix: 'Miau!', text: txt };
            this.updateSpeechDOM();
            this.render();
          },
          onTurnComplete: () => {
            soundService.playPurr();
            const userSay = this.liveInputBuffer.trim();
            const miauSay = this.liveOutputBuffer.trim();
            this.liveInputBuffer = '';
            this.liveOutputBuffer = '';
            if (userSay || miauSay) {
              void (async () => {
                if (userSay) {
                  await this.persistMessage(
                    {
                      sender: 'user',
                      meowPrefix: '',
                      text: userSay,
                      mood: 'happy',
                    },
                    true
                  );
                }
                if (miauSay) {
                  await this.persistMessage(
                    {
                      sender: 'miau',
                      meowPrefix: 'Miau! 🎙️',
                      text: miauSay,
                      mood: 'affectionate',
                    },
                    true
                  );
                }
                this.refreshChatModalIfOpen();
              })();
            }
          },
          onError: (err) => {
            hadLiveError = true;
            this.liveStatus = err;
            this.liveSession = null;
            hapticService.warning();
            this.render();
          },
          onClosed: () => {
            this.liveSession = null;
            if (!hadLiveError) {
              this.liveStatus = 'Sessão de voz encerrada.';
            }
            this.render();
          },
        });
        this.liveSession = session;
        session.setMuted(!this.profile.soundEnabled);
        try {
          await session.start();
        } catch (err) {
          hadLiveError = true;
          this.liveSession = null;
          this.liveStatus =
            err instanceof Error ? err.message : 'Erro ao iniciar microfone.';
          hapticService.warning();
          this.render();
        }
      });

    // Menu, Profile, Learn & Settings actions
    this.root
      .querySelector('#btn-menu-profile')
      ?.addEventListener('click', () => {
        this.profileModal.open(this.humanProfile);
        this.activeModal = 'profile';
        this.render();
      });

    this.root
      .querySelector('#btn-menu-learn')
      ?.addEventListener('click', () => {
        this.learnPreviewLevel = null;
        this.activeModal = 'learn';
        this.render();
      });

    if (this.activeModal === 'profile') {
      this.profileModal.bind(this.root);
    }

    if (this.activeModal === 'learn') {
      bindLearnModalEvents(this.root, {
        onBackToMenu: () => {
          this.activeModal = 'menu';
          this.render();
        },
        onGoToProfile: () => {
          this.profileModal.open(this.humanProfile);
          this.activeModal = 'profile';
          this.render();
        },
        onSelectPreviewLevel: (level) => {
          this.learnPreviewLevel = level;
          this.render();
        },
      });
    }

    this.root
      .querySelector('#btn-menu-routine')
      ?.addEventListener('click', () => {
        this.activeModal = 'routine';
        this.render();
      });

    this.root
      .querySelector('#btn-menu-ranking')
      ?.addEventListener('click', () => {
        void this.openRankingModal();
      });

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
        this.toggleSoundMute();
        this.render();
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
      this.ballController?.dispose();
      this.ballController = null;
      miauSpeechService.cancel();
      this.profileModal.disposeCameraStream();
      this.liveSession?.stop();
      this.liveSession = null;
      this.activeModal = 'none';
      this.isDemoSession = false;
      this.humanProfile = createEmptyHumanProfile('guest');
      this.learnPreviewLevel = null;
      if (this.firebaseUser) {
        await logoutUser();
      }
      this.screen = 'login';
      this.render();
    });
  }

  private buildSupportMessageText(draft: string): string {
    const player =
      this.humanProfile.fullName.trim() ||
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
    this.profileModal.disposeCameraStream();
    this.miniGameCleanup?.();
    this.miniGameCleanup = null;
    this.activeMiniGame = 'none';
    this.activeModal = 'none';
    this.render();
  }
}
