import type { User } from 'firebase/auth';
import {
  ACHIEVEMENTS,
  DEFAULT_OWNED_ITEMS,
  FOOD_ITEMS,
  INITIAL_GREETING,
  MIAU_AVATAR_URL,
  ROUTINE_SCHEDULE,
  SEED_RANKING_ENTRIES,
  SHOP_CONSUMABLES,
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
  loadParentalControlCloud,
  loadTopRankings,
  logoutUser,
  registerWithEmail,
  resetPassword,
  saveMessage,
  saveParentalControlCloud,
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
  transcribeUserAudioDetailed,
} from '../services/geminiClient';
import {
  MINOR_REFUSAL_TEXT,
  isUnsafeTopicForMinorClient,
  shouldApplyMinorSafety,
} from '../data/minorSafety';
import { hapticService } from '../services/hapticService';
import { miauSpeechService } from '../services/miauSpeechService';
import {
  pwaService,
  type CameraPermissionState,
} from '../services/pwaService';
import {
  pushNotificationService,
  type CareNeedKey,
  type NotificationActionType,
} from '../services/pushNotificationService';
import {
  setEasyReadEnabled,
  shouldUseNightModalTheme,
  syncEasyReadBodyClass,
} from '../services/accessibilityService';
import {
  advanceBathFoamProgress,
  getHouseRoomDef,
  renderRoomInteractiveOverlayHtml,
  renderRoomSwitcherHtml,
} from '../services/interactiveRoomsService';
import {
  hasCompletedOnboarding,
  markOnboardingCompleted,
  renderOnboardingOverlayHtml,
  resetOnboarding,
  type OnboardingStep,
} from '../services/onboardingService';
import { LiveVoiceSession, soundService } from '../services/soundService';
import type {
  AchievementDef,
  ActiveLearnTrack,
  ActiveModal,
  AppScreen,
  ChatMessage,
  EquippedItems,
  GameId,
  GameMatchHistoryItem,
  HouseRoomId,
  MiauMood,
  MiauVisualEffect,
  RankingEntry,
  RoutineCategory,
  RoutineSlotDef,
  ScreenVisibilityPrefs,
  ShopTab,
  UserPetProfile,
} from '../types';
import {
  buildConversationContextSnapshot,
  buildFriendGreeting,
  buildLowNeedAlert,
  buildPeriodGreeting,
  getDailyGreetingBucket,
  type DailyGreetingBucket,
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
  mountMilkMazeGame,
  mountPacMiauGame,
  type MiniGameResult,
} from './MiniGames';
import {
  claimBallCoins,
  claimMinigameCoins,
  claimPetCoins,
} from '../services/coinEconomyService';
import {
  buildEducationProgressReport,
  getStrongestAndWeakestModules,
} from '../services/progressReportService';
import {
  buildSmartReviewSession,
  markSmartReviewCompleted,
} from '../services/smartReviewService';
import {
  clearParentalPin,
  generateAdultMathChallenge,
  getScreenLimitStatus,
  loadParentalControlConfig,
  mergeParentalControlConfigs,
  recordActiveSeconds,
  recordCompletedLesson,
  registerParentalSaveListener,
  saveParentalControlConfig,
  setParentalPin,
  unlockScreenLimitTemporarily,
  verifyParentalPin,
  type ParentalControlConfig,
} from '../services/parentalControlService';
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
  type RankingSchoolingFilter,
} from './modals/CareAndGamesModals';
import {
  isMathEducationTrack,
  loadDailyMissionsSnapshot,
  recordDailyMissionEvent,
  type DailyMissionEvent,
} from '../services/dailyMissionsService';
import {
  renderChatHistoryItemsHtml,
  renderChatModalHtml,
  renderInstallGuideModalHtml,
  renderSettingsModalHtml,
  renderSupportModalHtml,
} from './modals/CommunicationModals';
import {
  renderLearnModalHtml,
  bindLearnModalEvents,
} from './modals/LearnModal';
import {
  hydrateUserCloudProgress,
  initCloudProgressSyncListeners,
} from '../services/cloudProgressService';
import {
  patchSpeechBubbleDom,
  patchStatusBarsAndHeaderDom,
} from '../services/hudPatchService';
import {
  createLearnTrackControllers,
  type LearnTrackControllers,
} from '../services/learnTrackFactory';
import {
  getRoomThemeClasses,
  isNightRoomBackground,
} from '../services/roomThemeService';
import {
  renderCollapsibleBottomNavHtml,
  renderCollapsibleSpeechAndChatHtml,
  renderCollapsibleStatusSectionHtml,
} from '../services/roomHudLayoutService';
import { loadWritingProgress } from '../modules/writing/writingEngine';
import {
  bindLoginScreenEvents,
  renderLoginScreenHtml,
} from './modals/LoginScreen';
import { renderMenuModalHtml } from './modals/MenuModal';
import {
  renderPreloaderHtml,
  updatePreloaderProgressDom,
} from './modals/PreloaderScreen';
import {
  renderProgressReportModalHtml,
  type ProgressReportFilter,
} from './modals/ProgressReportModal';
import {
  bindSmartReviewModalEvents,
  createInitialSmartReviewState,
  renderSmartReviewModalHtml,
  type SmartReviewModalState,
} from './modals/SmartReviewModal';
import {
  bindParentalDashboardModalEvents,
  createInitialParentalDashboardState,
  renderParentalDashboardModalHtml,
  type ParentalDashboardState,
} from './modals/ParentalDashboardModal';
import { UserProfileModalController } from './modals/UserProfileModal';

const LOCAL_DEMO_KEY = 'miau_demo_profile_v1';
const LOCAL_DEMO_MSGS_KEY = 'miau_demo_msgs_v1';
const LOCAL_RANKING_KEY = 'miau_local_rankings_v1';
const LOCAL_MATCH_HISTORY_PREFIX = 'miau_game_history_v1_';
const SCREEN_PREFS_KEY = 'miau_screen_prefs_v1';
const CAM_PROMPTED_SESSION_KEY = 'miau_cam_prompted_v1';
const PERIOD_GREETINGS_STORAGE_PREFIX = 'miau_period_greetings_v1_';

const DEFAULT_SCREEN_PREFS: ScreenVisibilityPrefs = {
  showStatusBars: true,
  showStatusBadges: true,
  showSpeechAndChat: true,
  showCoinsBadge: true,
  easyReadMode: false,
  collapseStatusPanel: false,
  collapseSpeechBox: false,
  collapseChatBox: false,
  collapseBottomNav: false,
};

export interface MiauUIXRBridge {
  syncState: (
    stats: UserPetProfile['stats'],
    equipped: UserPetProfile['equipped'],
    speech: string,
    isSleeping?: boolean,
    petName?: string
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
  private shopTab: ShopTab = 'hat';
  private previewEquipped: Partial<EquippedItems> | null = null;
  private activeMiniGame: 'none' | GameId = 'none';
  private miniGameCleanup: (() => void) | null = null;
  private leaderboard: RankingEntry[] = [];
  private rankingLoading = false;
  private rankingTab: 'all' | GameId = 'all';
  private rankingSchoolingFilter: RankingSchoolingFilter = 'all';
  private progressReportTab: ProgressReportFilter = 'all';
  private decayTickCount = 0;
  private lastSleepRewardAtMs = 0;

  private currentSpeech = {
    meowPrefix: INITIAL_GREETING.meowPrefix,
    text: INITIAL_GREETING.text,
  };
  private isThinking = false;
  private isSpeaking = false;
  private isRecordingMic = false;
  private isHoldPressed = false;
  private activeHoldCleanup: (() => void) | null = null;
  private activePlayingUserAudioBtn: HTMLElement | null = null;
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
  private lastNeedAlertAt = 0;
  private alertedLowNeeds: Set<'hunger' | 'sleep' | 'hygiene'> = new Set();
  private hasUserGesture = false;
  private lastFriendModalGreetAt = 0;
  private supportDraft = '';
  private arCamera: MiauARCamera | null = null;
  private screenPrefs: ScreenVisibilityPrefs = { ...DEFAULT_SCREEN_PREFS };
  private cameraPermission: CameraPermissionState = 'unknown';
  private showInstallGuideModal = false;
  private pushTestPreview: { title: string; body: string } | null = null;
  private humanProfile: UserHumanProfile = createEmptyHumanProfile('guest');
  private learnPreviewLevel: SchoolingLevel | null = null;
  private activeLearnTrack: ActiveLearnTrack = 'none';
  private learnTracks: LearnTrackControllers;
  private profileModal: UserProfileModalController;
  private ballController: InteractiveBallController | null = null;
  private activeRoom: HouseRoomId = 'living';
  private activeMiauEffect: MiauVisualEffect = 'none';
  private miauEffectTimer: number | null = null;
  private kitchenFridgeOpen = false;
  private bathFoamPct = 0;
  private lastBathPointer: { x: number; y: number } | null = null;
  private lastBathFeedbackAt = 0;
  private onboardingActive = false;
  private onboardingStep: OnboardingStep = 1;
  private onboardingStep2Done = false;
  private smartReviewState: SmartReviewModalState | null = null;
  private parentalConfig: ParentalControlConfig = loadParentalControlConfig('guest');
  private parentalDashboardState: ParentalDashboardState =
    createInitialParentalDashboardState();
  private parentalScreenLockChallenge = generateAdultMathChallenge();
  private parentalScreenLockError = '';
  private screenTimeTimer: number | null = null;
  private pendingParentalUnlockMinutes = 30;

  constructor(
    container: HTMLElement,
    private xrBridge?: MiauUIXRBridge
  ) {
    this.root = document.createElement('div');
    this.root.id = 'miau-2d-shell';
    this.root.className = 'fixed inset-0 z-20 flex items-center justify-center';
    container.appendChild(this.root);
    const markInteraction = () => {
      const wasFirstGesture = !this.hasUserGesture;
      this.lastUserInteractionAt = Date.now();
      this.hasUserGesture = true;
      if (wasFirstGesture && this.profile.soundEnabled && soundService.enabled) {
        soundService.unlockAudio();
      }
    };
    this.root.addEventListener('pointerdown', markInteraction, { passive: true });
    this.root.addEventListener('keydown', markInteraction, { passive: true });
    this.root.addEventListener('input', markInteraction, { passive: true });
    miauSpeechService.setSpeakingListener((speaking) => {
      this.isSpeaking = speaking;
      this.updateSpeakerButtonDOM();
    });
    pushNotificationService.registerNotificationActionHandler((action) => {
      this.handleNotificationDeepLink(action);
    });
    document.addEventListener('visibilitychange', () => {
      if (this.screen !== 'game') return;
      const statsSnap = {
        hunger: this.profile.stats.hunger,
        hygiene: this.profile.stats.hygiene,
        sleep: this.profile.stats.sleep,
        isSleeping: this.isSleeping,
      };
      if (document.hidden) {
        pushNotificationService.syncWithServerOnHide(
          this.profile.petName,
          statsSnap
        );
      } else {
        pushNotificationService.clearServiceWorkerFallbackReminders();
        pushNotificationService.updateAppBadgeAndTitle(
          this.profile.petName,
          statsSnap
        );
        void pushNotificationService.syncCareSnapshotToServiceWorker(
          this.profile.petName,
          statsSnap
        );
        void pushNotificationService.syncWithServer(
          this.profile.petName,
          statsSnap,
          true
        );
      }
    });
    window.addEventListener('pagehide', () => {
      if (this.screen !== 'game') return;
      pushNotificationService.syncWithServerOnHide(this.profile.petName, {
        hunger: this.profile.stats.hunger,
        hygiene: this.profile.stats.hygiene,
        sleep: this.profile.stats.sleep,
        isSleeping: this.isSleeping,
      });
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
        this.resetAllLearnTracks();
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
    initCloudProgressSyncListeners();
    registerParentalSaveListener((ownerId, cfg) => {
      const currentOwner =
        this.firebaseUser?.uid || (this.isDemoSession ? 'demo' : 'guest');
      if (ownerId === currentOwner) {
        this.parentalConfig = cfg;
      }
      if (this.firebaseUser && ownerId === this.firebaseUser.uid) {
        void saveParentalControlCloud(ownerId, cfg).catch((err) => {
          console.warn('Falha ao sincronizar controle parental na nuvem:', err);
        });
      }
    });
    this.learnTracks = createLearnTrackControllers({
      getOwnerId: () =>
        this.firebaseUser?.uid || (this.isDemoSession ? 'demo' : 'guest'),
      getHumanProfile: () => this.humanProfile,
      getEquipped: () => this.profile.equipped,
      isSoundEnabled: () => this.profile.soundEnabled,
      onToggleSoundMute: () => this.toggleSoundMute(),
      onGrantRewards: (coinsDelta, xpDelta) => {
        this.ensureProfileDefaults();
        this.addRewards(coinsDelta, xpDelta);
        this.updateStatusBarsDOM();
        void this.persistStats();
      },
      onExitToLearnHub: () => {
        this.activeLearnTrack = 'none';
        this.render();
      },
      onExitToMainMenu: () => {
        this.activeLearnTrack = 'none';
        this.activeModal = 'menu';
        this.render();
      },
      onRequestTrackRerender: (trackId) => {
        if (
          this.screen === 'game' &&
          this.activeModal === 'learn' &&
          this.activeLearnTrack === trackId
        ) {
          this.render();
        }
      },
      onLessonCompleted: ({ trackId }) => {
        this.recordMissionProgress({ type: 'math_lesson', trackId });
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

  private resetAllLearnTracks(): void {
    this.activeLearnTrack = 'none';
    this.learnTracks.resetAll();
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
    syncEasyReadBodyClass(this.screenPrefs.easyReadMode);
  }

  private saveScreenPrefs(): void {
    try {
      localStorage.setItem(SCREEN_PREFS_KEY, JSON.stringify(this.screenPrefs));
    } catch {
      // Ignore storage quota errors
    }
    syncEasyReadBodyClass(this.screenPrefs.easyReadMode);
  }

  private getEffectiveMiauEffect(): MiauVisualEffect {
    if (
      this.activeRoom === 'bathroom' &&
      this.bathFoamPct >= 20 &&
      this.activeMiauEffect === 'none'
    ) {
      return 'bath_foam';
    }
    return this.activeMiauEffect;
  }

  private setTemporaryMiauEffect(
    effect: MiauVisualEffect,
    durationMs = 1700
  ): void {
    if (this.miauEffectTimer !== null) {
      clearTimeout(this.miauEffectTimer);
      this.miauEffectTimer = null;
    }
    this.activeMiauEffect = effect;
    this.updateCharacterSvgDOM();
    if (effect !== 'none' && durationMs > 0) {
      this.miauEffectTimer = window.setTimeout(() => {
        this.miauEffectTimer = null;
        if (this.activeMiauEffect === effect) {
          this.activeMiauEffect = 'none';
          this.updateCharacterSvgDOM();
        }
      }, durationMs);
    }
  }

  private maybeActivateFirstTimeOnboarding(ownerId: string): void {
    if (!hasCompletedOnboarding(ownerId)) {
      this.onboardingActive = true;
      this.onboardingStep = 1;
      this.onboardingStep2Done = false;
    } else {
      this.onboardingActive = false;
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
        this.alertedLowNeeds.clear();
        this.lastNeedAlertAt = 0;
        try {
          this.profile = await loadOrCreatePetProfile(user);
          this.ensureProfileDefaults();
          soundService.setEnabled(this.profile.soundEnabled);
          const [msgs, humanProf, cloudParental] = await Promise.all([
            loadMessages(user.uid),
            loadUserHumanProfile(user, user.uid),
            loadParentalControlCloud(user.uid).catch((err) => {
              console.warn('Falha ao carregar controle parental da nuvem:', err);
              return null;
            }),
          ]);
          this.humanProfile = humanProf;
          const localParental = loadParentalControlConfig(user.uid);
          const mergedParental = mergeParentalControlConfigs(
            localParental,
            cloudParental
          );
          this.parentalConfig = saveParentalControlConfig(mergedParental, {
            notifyListener: false,
          });
          if (
            !cloudParental ||
            (localParental.updatedAtMs || 0) > (cloudParental.updatedAtMs || 0)
          ) {
            void saveParentalControlCloud(user.uid, this.parentalConfig).catch(
              (err) => {
                console.warn(
                  'Falha ao enviar controle parental inicial para a nuvem:',
                  err
                );
              }
            );
          }
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
          void hydrateUserCloudProgress(user.uid).then(() => {
            if (
              this.screen === 'game' &&
              (this.activeModal === 'progress_report' ||
                this.activeModal === 'learn' ||
                this.activeModal === 'routine' ||
                this.activeModal === 'parental')
            ) {
              this.render();
            }
          });
          void pushNotificationService
            .initializeRuntime(user.uid, this.profile.petName, {
              hunger: this.profile.stats.hunger,
              hygiene: this.profile.stats.hygiene,
              sleep: this.profile.stats.sleep,
              isSleeping: this.isSleeping,
            })
            .then(() => {
              const urlAct = pushNotificationService.consumeInitialUrlAction();
              if (urlAct) this.handleNotificationDeepLink(urlAct);
            });
        } catch (err) {
          console.error('Erro ao carregar perfil no Firestore:', err);
          this.humanProfile = await loadUserHumanProfile(null, user.uid);
          this.parentalConfig = loadParentalControlConfig(user.uid);
          this.showToast('Conectado! Usando cache local enquanto sincroniza.');
        }
        if (this.screen === 'login') {
          this.maybeActivateFirstTimeOnboarding(user.uid);
          this.screen = 'game';
          this.render();
          void this.requestCameraPermissionOnStart();
        } else if (
          this.screen === 'game' &&
          (this.activeModal === 'menu' ||
            this.activeModal === 'profile' ||
            this.activeModal === 'learn' ||
            this.activeModal === 'parental')
        ) {
          this.render();
        }
      } else if (!this.isDemoSession) {
        this.profileModal.disposeCameraStream();
        this.humanProfile = createEmptyHumanProfile('guest');
        this.parentalConfig = loadParentalControlConfig('guest');
        this.learnPreviewLevel = null;
        if (preloaderFinished) {
          this.screen = 'login';
          this.render();
        }
      }
      authResolved = true;
      const wasPreloader = this.screen === 'preloader';
      if (user && wasPreloader) {
        this.maybeActivateFirstTimeOnboarding(user.uid);
      }
      tryAdvanceFromPreloader();
      if (wasPreloader && this.screen === 'game') {
        void this.requestCameraPermissionOnStart();
      }
    });

    this.decayTimer = window.setInterval(() => {
      if (this.screen !== 'game') return;
      if (this.isSleeping) return;
      this.ensureProfileDefaults();
      this.decayTickCount += 1;
      // Ritmo organizado e realista: Fome a cada ciclo (~35s), Sono/Diversão a cada 2 ciclos (~70s), Banho/Higiene a cada 3 ciclos (~105s)
      this.profile.stats.hunger = Math.max(5, this.profile.stats.hunger - 1);
      if (this.decayTickCount % 3 === 0) {
        this.profile.stats.hygiene = Math.max(8, this.profile.stats.hygiene - 1);
      }
      if (this.decayTickCount % 2 === 0) {
        this.profile.stats.fun = Math.max(5, this.profile.stats.fun - 1);
        this.profile.stats.sleep = Math.max(5, this.profile.stats.sleep - 1);
      }
      const anyLow =
        this.profile.stats.hunger < 30 ||
        this.profile.stats.hygiene < 30 ||
        this.profile.stats.fun < 30 ||
        this.profile.stats.sleep < 30;
      if (anyLow || this.decayTickCount % 2 === 0) {
        this.profile.stats.happiness = Math.max(
          5,
          this.profile.stats.happiness - (anyLow ? 2 : 1)
        );
      }
      this.updateStatusBarsDOM();
      void this.persistStats();
      const ownerId =
        this.firebaseUser?.uid || (this.isDemoSession ? 'demo' : 'guest');
      void pushNotificationService
        .evaluateAndNotifyLowNeeds({
          ownerId,
          petName: this.profile.petName,
          stats: {
            hunger: this.profile.stats.hunger,
            hygiene: this.profile.stats.hygiene,
            sleep: this.profile.stats.sleep,
            isSleeping: this.isSleeping,
          },
          soundEnabled: this.profile.soundEnabled,
        })
        .then((alertedNeed) => {
          if (
            alertedNeed &&
            pushNotificationService.getPermission() !== 'granted'
          ) {
            const label =
              alertedNeed === 'hunger'
                ? 'com muita fome 🐟'
                : alertedNeed === 'hygiene'
                  ? 'precisando de banho 🛁'
                  : 'com muito sono 🌙';
            this.showToast(`${this.profile.petName} está ${label}!`);
          }
        });
    }, 35000);

    this.proactiveTimer = window.setInterval(() => {
      this.evaluateProactiveInteraction();
    }, 5000);

    this.screenTimeTimer = window.setInterval(() => {
      if (this.screen !== 'game' || document.hidden) return;
      const ownerId =
        this.firebaseUser?.uid || (this.isDemoSession ? 'demo' : 'guest');
      const wasLocked = getScreenLimitStatus(this.parentalConfig).locked;
      const res = recordActiveSeconds(ownerId, 30);
      this.parentalConfig = res.config;
      const nowLocked = getScreenLimitStatus(this.parentalConfig).locked;
      if (!wasLocked && nowLocked && this.activeModal !== 'parental') {
        this.parentalScreenLockChallenge = generateAdultMathChallenge();
        this.parentalScreenLockError = '';
        this.render();
      }
    }, 30000);
  }

  private getPeriodGreetingStorageKey(): string {
    const ownerId =
      this.firebaseUser?.uid || (this.isDemoSession ? 'demo' : 'guest');
    return `${PERIOD_GREETINGS_STORAGE_PREFIX}${ownerId}`;
  }

  private hasSentPeriodGreetingToday(
    dateKey: string,
    period: DailyGreetingBucket
  ): boolean {
    try {
      const raw = localStorage.getItem(this.getPeriodGreetingStorageKey());
      if (!raw) return false;
      const parsed = JSON.parse(raw) as {
        dateKey?: string;
        sent?: Partial<Record<DailyGreetingBucket, boolean>>;
      };
      if (parsed.dateKey !== dateKey) return false;
      return Boolean(parsed.sent?.[period]);
    } catch {
      return false;
    }
  }

  private markPeriodGreetingSentToday(
    dateKey: string,
    period: DailyGreetingBucket
  ): void {
    try {
      const key = this.getPeriodGreetingStorageKey();
      let sent: Partial<Record<DailyGreetingBucket, boolean>> = {};
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          dateKey?: string;
          sent?: Partial<Record<DailyGreetingBucket, boolean>>;
        };
        if (parsed.dateKey === dateKey && parsed.sent) {
          sent = { ...parsed.sent };
        }
      }
      sent[period] = true;
      localStorage.setItem(key, JSON.stringify({ dateKey, sent }));
    } catch {
      // Ignore storage quota errors
    }
  }

  private refreshNeedAlertHysteresis(): void {
    if (this.profile.stats.hunger >= 45) this.alertedLowNeeds.delete('hunger');
    if (this.profile.stats.sleep >= 45) this.alertedLowNeeds.delete('sleep');
    if (this.profile.stats.hygiene >= 45) this.alertedLowNeeds.delete('hygiene');
  }

  private evaluateProactiveInteraction(): void {
    if (this.screen === 'game') {
      this.ensureProfileDefaults();
      this.refreshNeedAlertHysteresis();
    }

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
    const dateKey = getTodayDateKey();
    const period = getDailyGreetingBucket(new Date().getHours());

    // 1. Mensagem padrão de manhã, tarde e noite (apenas 1 vez por período por dia)
    if (!this.hasSentPeriodGreetingToday(dateKey, period)) {
      if (
        now - this.lastUserInteractionAt >= 3500 &&
        now - this.lastProactivePromptAt >= 5000
      ) {
        this.markPeriodGreetingSentToday(dateKey, period);
        const snapshot = buildConversationContextSnapshot(this.humanProfile);
        const greeting = buildPeriodGreeting(
          snapshot,
          this.profile.petName,
          period
        );
        const particle =
          period === 'manhã' ? '☀️' : period === 'tarde' ? '🌤️' : '🌙';
        this.deliverProactiveSpeech(greeting, particle);
      }
      return;
    }

    // 2. Avisar apenas quando estiver com fome, sono ou sujo (com intervalo calmo, sem incomodar)
    if (
      now - this.lastUserInteractionAt < 25000 ||
      now - this.lastProactivePromptAt < 60000 ||
      now - this.lastNeedAlertAt < 180000
    ) {
      return;
    }

    const lowNeedOrder: Array<'hunger' | 'sleep' | 'hygiene'> = [
      'hunger',
      'sleep',
      'hygiene',
    ];
    const pendingNeed = lowNeedOrder.find(
      (need) =>
        this.profile.stats[need] < 30 && !this.alertedLowNeeds.has(need)
    );
    if (!pendingNeed) return;

    this.alertedLowNeeds.add(pendingNeed);
    this.lastNeedAlertAt = now;
    const snapshot = buildConversationContextSnapshot(this.humanProfile);
    const alert = buildLowNeedAlert(
      pendingNeed,
      snapshot,
      this.profile.petName
    );
    const particle =
      pendingNeed === 'hunger' ? '🐟' : pendingNeed === 'sleep' ? '💤' : '🫧';
    this.deliverProactiveSpeech(alert, particle);
  }

  private deliverProactiveSpeech(
    payload: { meowPrefix: string; text: string; mood: MiauMood },
    particle: string
  ): void {
    this.ensureProfileDefaults();
    this.lastProactivePromptAt = Date.now();
    this.currentSpeech = {
      meowPrefix: payload.meowPrefix,
      text: payload.text,
    };
    this.mood = payload.mood;
    this.updateSpeechDOM();
    this.updateCharacterSvgDOM();
    this.triggerMiauReaction('bounce');
    this.spawnFloatingParticle(particle);
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
      this.isSleeping,
      this.profile.petName
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
      pacmiau: { ...defaultRecords.pacmiau, ...(currentRecords.pacmiau || {}) },
      maze: { ...defaultRecords.maze, ...(currentRecords.maze || {}) },
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
    const gameIds: GameId[] = [
      'fish',
      'memory',
      'escape',
      'galaxy',
      'pacmiau',
      'maze',
    ];
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
      pacmiau: recs.pacmiau?.highScore || 0,
      maze: recs.maze?.highScore || 0,
    };
    const gameStages: Partial<Record<GameId, number>> = {
      fish: recs.fish?.maxStage || 1,
      memory: recs.memory?.maxStage || 1,
      escape: recs.escape?.maxStage || 1,
      galaxy: recs.galaxy?.maxStage || 1,
      pacmiau: recs.pacmiau?.maxStage || 1,
      maze: recs.maze?.maxStage || 1,
    };
    const id = this.firebaseUser?.uid || 'local_player';
    return {
      id,
      playerName: this.getPlayerDisplayName(),
      petName: this.profile.petName || 'Miau',
      schooling: this.humanProfile.schooling || '',
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
        schooling: entry.schooling || '',
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

  private recordMissionProgress(event: DailyMissionEvent): void {
    const ownerId =
      this.firebaseUser?.uid || (this.isDemoSession ? 'demo' : 'guest');
    const res = recordDailyMissionEvent(ownerId, event);
    if (res.coinsAwarded > 0 || res.xpAwarded > 0) {
      this.ensureProfileDefaults();
      this.addRewards(res.coinsAwarded, res.xpAwarded);
      this.evaluateAchievements();
      soundService.playCoin();
      hapticService.achievement();
      this.updateStatusBarsDOM();
      void this.persistStats();
      const titles = res.newlyCompleted
        .map((m) => `${m.emoji} ${m.title}`)
        .join(' + ');
      const extras: string[] = [];
      if (res.allCompletedBonusCoins > 0) {
        extras.push(`Bônus 3/3 (+🪙 ${res.allCompletedBonusCoins})`);
      }
      if (res.streakBonusCoins > 0) {
        extras.push(
          `Sequência ${res.snapshot.currentStreak} dias (+🪙 ${res.streakBonusCoins})`
        );
      }
      const extraSuffix = extras.length > 0 ? ` • ${extras.join(' • ')}` : '';
      this.showToast(
        `Missão diária concluída: ${titles}! +🪙 ${res.coinsAwarded}${extraSuffix}`
      );
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
      this.setTemporaryMiauEffect('celebrating', 1800);
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

  private handleNotificationDeepLink(action: NotificationActionType): void {
    if (this.screen !== 'game') return;
    if (action === 'feed') {
      this.activeRoom = 'kitchen';
      this.kitchenFridgeOpen = true;
      this.activeModal = 'none';
      this.render();
    } else if (action === 'clean') {
      this.activeRoom = 'bathroom';
      this.activeModal = 'none';
      this.render();
    } else if (action === 'sleep') {
      this.activeRoom = 'bedroom';
      this.activeModal = 'none';
      if (!this.isSleeping) {
        this.toggleSleep();
      } else {
        this.render();
      }
    } else {
      this.activeModal = 'none';
      this.render();
    }
  }

  private async activatePushFromUI(): Promise<void> {
    const ownerId =
      this.firebaseUser?.uid || (this.isDemoSession ? 'demo' : 'guest');
    const res = await pushNotificationService.enablePushNotifications({
      ownerId,
      petName: this.profile.petName,
      stats: {
        hunger: this.profile.stats.hunger,
        hygiene: this.profile.stats.hygiene,
        sleep: this.profile.stats.sleep,
        isSleeping: this.isSleeping,
      },
    });
    this.pushTestPreview = null;
    if (res.permission === 'granted') {
      soundService.playCoin();
      this.showToast(
        res.webPushActive
          ? 'Notificações Push ativadas! Avisaremos em 2º plano quando o Miau precisar.'
          : 'Notificações ativadas via Service Worker e navegador!'
      );
    } else if (res.inAppActive) {
      soundService.playCoin();
      this.showToast(
        res.permission === 'denied'
          ? 'Alertas no App ativados (barra e badge)! Para pop-ups do sistema, libere no navegador.'
          : 'Alertas no App ativados para fome, banho e sono!'
      );
    }
    this.render();
  }

  private async persistStats(): Promise<void> {
    this.syncXR();
    if (this.screen === 'game') {
      const statsSnap = {
        hunger: this.profile.stats.hunger,
        hygiene: this.profile.stats.hygiene,
        sleep: this.profile.stats.sleep,
        isSleeping: this.isSleeping,
      };
      pushNotificationService.updateAppBadgeAndTitle(
        this.profile.petName,
        statsSnap
      );
      void pushNotificationService.syncCareSnapshotToServiceWorker(
        this.profile.petName,
        statsSnap
      );
      void pushNotificationService.syncWithServer(
        this.profile.petName,
        statsSnap,
        !document.hidden
      );
    }
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

  private saveDemoMessagesTrimmed(): void {
    if (!this.isDemoSession) return;
    try {
      const recent = this.messages.slice(-30);
      const compact = recent.map((m, idx) =>
        idx >= recent.length - 6 || !m.audioDataUrl
          ? m
          : { ...m, audioDataUrl: undefined }
      );
      localStorage.setItem(LOCAL_DEMO_MSGS_KEY, JSON.stringify(compact));
    } catch {
      try {
        const noAudio = this.messages
          .slice(-20)
          .map((m) => ({ ...m, audioDataUrl: undefined }));
        localStorage.setItem(LOCAL_DEMO_MSGS_KEY, JSON.stringify(noAudio));
      } catch {
        // Ignore storage quota exceeded
      }
    }
  }

  private async persistMessage(
    msg: {
      sender: 'user' | 'miau';
      meowPrefix: string;
      text: string;
      mood: MiauMood;
      audioDataUrl?: string;
      audioDurationMs?: number;
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
      audioDataUrl: msg.audioDataUrl,
      audioDurationMs: msg.audioDurationMs,
    };
    if (optimistic) {
      this.messages.push(localMsg);
    }

    if (this.firebaseUser) {
      try {
        const saved = await saveMessage(this.firebaseUser.uid, {
          sender: msg.sender,
          meowPrefix: msg.meowPrefix,
          text: msg.text,
          mood: msg.mood,
        });
        const hydrated: ChatMessage = {
          ...saved,
          audioDataUrl: msg.audioDataUrl,
          audioDurationMs: msg.audioDurationMs,
        };
        if (optimistic) {
          const idx = this.messages.findIndex((m) => m.id === tempId);
          if (idx >= 0) {
            this.messages[idx] = hydrated;
          } else {
            this.messages.push(hydrated);
          }
        } else {
          this.messages.push(hydrated);
        }
        return;
      } catch (e) {
        console.warn('Falha ao salvar mensagem no Firestore:', e);
      }
    }

    if (!optimistic) {
      this.messages.push(localMsg);
    }
    this.saveDemoMessagesTrimmed();
  }

  private enterDemoMode(nameHint?: string): void {
    this.isDemoSession = true;
    this.alertedLowNeeds.clear();
    this.lastNeedAlertAt = 0;
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
    this.parentalConfig = loadParentalControlConfig('demo');
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
    this.maybeActivateFirstTimeOnboarding('demo');
    this.screen = 'game';
    this.syncXR();
    this.render();
    void this.requestCameraPermissionOnStart();
    void pushNotificationService
      .initializeRuntime('demo', this.profile.petName, {
        hunger: this.profile.stats.hunger,
        hygiene: this.profile.stats.hygiene,
        sleep: this.profile.stats.sleep,
        isSleeping: this.isSleeping,
      })
      .then(() => {
        const urlAct = pushNotificationService.consumeInitialUrlAction();
        if (urlAct) this.handleNotificationDeepLink(urlAct);
      });
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
    const petClaim = claimPetCoins(this.profile.ownerId || 'guest', 6);
    this.addRewards(petClaim.coinsGranted, 5);
    this.evaluateAchievements();
    this.triggerMiauReaction('jump');
    this.spawnFloatingParticle('💖');
    this.currentSpeech = {
      meowPrefix: 'Purrr~ 💖',
      text:
        petClaim.coinsGranted > 0
          ? `(Obrigado pelo carinho gostoso! +🪙 ${petClaim.coinsGranted} moedas!)`
          : '(Obrigado pelo carinho gostoso! Estude nas lições para ganhar mais moedas!)',
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
    const meowClaim = claimPetCoins(this.profile.ownerId || 'guest', 4);
    this.addRewards(meowClaim.coinsGranted, 4);
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
    this.setTemporaryMiauEffect('chewing', 1700);
    this.triggerMiauReaction('jump');
    this.spawnFloatingParticle('🐟');
    if (!claimedRoutine) {
      this.currentSpeech = {
        meowPrefix: 'Nham nham! 🐟',
        text: '(Obrigado pela comida! Que peixinho delicioso!)',
      };
    } else {
      this.currentSpeech = {
        meowPrefix: 'Nham nham! ⏰',
        text: `(Obrigado pela refeição no horário! +${claimedRoutine.bonusCoins} moedas bônus!)`,
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
    this.recordMissionProgress({ type: 'bath' });
    this.mood = 'happy';
    this.triggerMiauReaction('spin');
    this.spawnFloatingParticle('🫧');
    this.currentSpeech = claimedRoutine
      ? {
          meowPrefix: 'Purrr~ ⏰',
          text: `(Obrigado pelo banho no horário! +${claimedRoutine.bonusCoins} moedas de bônus!)`,
        }
      : {
          meowPrefix: 'Purrr~ 🫧',
          text: '(Obrigado pelo banho! Fiquei limpinho e cheiroso!)',
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
    const ballClaim = claimBallCoins(this.profile.ownerId || 'guest', 8);
    this.addRewards(ballClaim.coinsGranted, 8);
    this.evaluateAchievements();
    this.mood = 'playful';
    this.triggerMiauReaction('spin');
    this.spawnFloatingParticle(source === 'ball' ? '⚽' : '🧶');
    if (ballClaim.coinsGranted > 0) {
      this.currentSpeech =
        source === 'ball'
          ? {
              meowPrefix: 'Miau!! ⚽',
              text: `(Peguei a bolinha! +🪙 ${ballClaim.coinsGranted} moedas! Estude no Vamos Aprender para ganhar ainda mais!)`,
            }
          : {
              meowPrefix: 'Miau!! 🧶',
              text: `(Adorei o novelo! +🪙 ${ballClaim.coinsGranted} moedas!)`,
            };
    } else {
      this.currentSpeech =
        source === 'ball'
          ? {
              meowPrefix: 'Miau!! ⚽',
              text: '(Que brincadeira legal! Para ganhar mais moedas agora, pratique nas lições educativas!)',
            }
          : {
              meowPrefix: 'Miau!! 🧶',
              text: '(Obrigado por brincar com o novelo! Ganhe mais moedas estudando com o Miau!)',
            };
    }
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
      soundService.stopLullaby();
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
    if (this.profile.soundEnabled) {
      soundService.unlockAudio();
    }
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

  private async playCurrentMiauSpeech(
    autoSpeakTTS = true,
    notifyIfTextOnly = false
  ): Promise<void> {
    if (!this.profile.soundEnabled) return;
    soundService.unlockAudio();
    if (!autoSpeakTTS) {
      soundService.playMeow(1.05);
      return;
    }
    if (notifyIfTextOnly && miauSpeechService.isTextOnlyFallbackActive()) {
      this.showToast('Voz por IA pausada momentaneamente — mantendo texto e miados!');
    }
    await miauSpeechService.speakPhrase(
      this.currentSpeech.meowPrefix,
      this.currentSpeech.text,
      { withLeadingMeow: true, pitchMultiplier: 1.05, fallbackMeowOnError: true }
    );
  }

  private async sendChatToMiau(
    userText: string,
    voiceClip?: { audioDataUrl?: string; audioDurationMs?: number }
  ): Promise<void> {
    const trimmed = userText.trim();
    if (!trimmed || this.isThinking) return;

    this.ensureProfileDefaults();
    soundService.unlockAudio();
    this.lastUserInteractionAt = Date.now();
    this.lastProactivePromptAt = Date.now();
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
        audioDataUrl: voiceClip?.audioDataUrl,
        audioDurationMs: voiceClip?.audioDurationMs,
      },
      true
    );
    this.refreshChatModalIfOpen();

    // Proteção instantânea (<1ms) para menores de 18 anos ou Filtro Estrito antes de chamar a rede
    if (
      shouldApplyMinorSafety(
        contextSnapshot.user.age,
        this.parentalConfig.strictAiFilter
      ) &&
      isUnsafeTopicForMinorClient(trimmed)
    ) {
      this.currentSpeech = {
        meowPrefix: 'Miau!',
        text: MINOR_REFUSAL_TEXT,
      };
      this.mood = 'happy';
      this.isThinking = false;
      this.lastUserInteractionAt = Date.now();
      this.lastProactivePromptAt = Date.now();
      this.updateSpeechDOM();
      this.updateCharacterSvgDOM();
      void this.playCurrentMiauSpeech(true);
      await userPersistPromise;
      await this.persistMessage(
        {
          sender: 'miau',
          meowPrefix: 'Miau!',
          text: MINOR_REFUSAL_TEXT,
          mood: 'happy',
        },
        true
      );
      this.refreshChatModalIfOpen();
      return;
    }

    try {
      const reply = await askMiau({
        message: trimmed,
        history: recentHistory,
        stats: this.profile.stats,
        equipped: this.profile.equipped,
        petName: this.profile.petName,
        temporalContext: contextSnapshot.temporal,
        userContext: contextSnapshot.user,
        strictFilter: this.parentalConfig.strictAiFilter,
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
      this.lastUserInteractionAt = Date.now();
      this.lastProactivePromptAt = Date.now();
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
          text: '(Falta configurar a chave GEMINI_API_KEY nas configurações do servidor para ativar minha IA.)',
        };
        this.showToast('Configure GEMINI_API_KEY nas Environment Variables.');
      } else if (
        error instanceof GeminiApiError &&
        (error.code === 'MODEL_UNAVAILABLE' || error.code === 'QUOTA_EXHAUSTED')
      ) {
        this.currentSpeech = {
          meowPrefix: 'Miau...',
          text: '(Os servidores de IA estão bem cheios agora, tente enviar de novo em alguns segundinhos!)',
        };
        this.showToast('Alta demanda na IA no momento — tentando restabelecer...');
      } else {
        const msg =
          error instanceof Error
            ? error.message
            : 'Não consegui responder agora. Tente novamente!';
        this.currentSpeech = {
          meowPrefix: 'Miau?',
          text: `(${msg})`,
        };
      }
      this.updateSpeechDOM();
      this.refreshChatModalIfOpen();
    } finally {
      this.isThinking = false;
      if (this.currentSpeech.text === '(Ouvindo você com carinho...)') {
        this.currentSpeech = {
          meowPrefix: 'Miau!',
          text: '(Estou aqui com você! Pode mandar outra mensagem.)',
        };
        this.updateSpeechDOM();
        this.refreshChatModalIfOpen();
      }
    }
  }

  private async handleMiniGameComplete(res: MiniGameResult): Promise<void> {
    this.ensureProfileDefaults();
    this.lastUserInteractionAt = Date.now();
    this.lastProactivePromptAt = Date.now();
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
    const recordBonus = isNewRecord ? 20 : 0;
    const rawCoins = res.coinsEarned + recordBonus;
    const ecoClaim = claimMinigameCoins(this.profile.ownerId || 'guest', rawCoins);
    const totalCoinsGained = ecoClaim.coinsGranted;

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
    if (res.gameId === 'pacmiau') {
      this.recordMissionProgress({ type: 'pacmiau_score', score: res.score });
    }
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

    const coinSuffix =
      totalCoinsGained > 0
        ? `+${totalCoinsGained} moedas!`
        : 'cota diária de jogos atingida — ganhe mais moedas estudando!';

    if (isNewRecord) {
      this.currentSpeech = {
        meowPrefix: 'NOVO RECORDE!! 🏆',
        text: `(${res.gameName}: ${res.score} pts • Fase ${res.stageReached}! ${coinSuffix})`,
      };
    } else if (res.performanceTier === 'gold') {
      this.currentSpeech = {
        meowPrefix: 'Miau!! 🏆',
        text: `(${res.gameName}: ${res.summaryText}! ${coinSuffix})`,
      };
    } else if (res.performanceTier === 'silver') {
      this.currentSpeech = {
        meowPrefix: 'Miau! ✨',
        text: `(${res.gameName}: ${res.summaryText}! ${coinSuffix})`,
      };
    } else {
      this.currentSpeech = {
        meowPrefix: 'Purrr~ 🐾',
        text: `(${res.gameName}: ${res.summaryText}! ${coinSuffix})`,
      };
    }

    this.render();
    this.triggerMiauReaction('spin');
    this.spawnFloatingParticle(res.performanceTier === 'gold' ? '🏆' : '🎮');
    if (!unlockedNew) {
      this.showToast(
        totalCoinsGained === 0
          ? `${res.gameName}: +${res.xpEarned} XP! (Cota diária de jogos completa; estude para +🪙)`
          : isNewRecord
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
      if (this.isThinking || this.activeModal === 'chat') return;
      this.lastProactivePromptAt = Date.now();
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
    patchStatusBarsAndHeaderDom(this.root, this.profile);
    this.syncXR();
  }

  private updateSpeechDOM(): void {
    patchSpeechBubbleDom(this.root, this.currentSpeech);
    this.syncXR();
  }

  private updateCharacterSvgDOM(): void {
    const svgWrap = this.root.querySelector('#miau-svg-container');
    if (svgWrap) {
      svgWrap.innerHTML = renderMiauSvg(
        this.mood,
        this.profile.equipped,
        this.isSleeping,
        this.getEffectiveMiauEffect()
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
        soundService.unlockAudio();
        if (!this.profile.soundEnabled) {
          this.showToast('Som silenciado! Ative o áudio para ouvir o Miau.');
          return;
        }
        if (miauSpeechService.isTextOnlyFallbackActive()) {
          this.showToast('Voz por IA pausada momentaneamente — mantendo texto e miados!');
        }
        void miauSpeechService.speakPhrase(msg.meowPrefix, msg.text, {
          withLeadingMeow: true,
          pitchMultiplier: 1.05,
          fallbackMeowOnError: true,
        });
      });
    });

    this.root.querySelectorAll('[data-play-user-audio]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rawIdx = btn.getAttribute('data-play-user-audio');
        const idx = rawIdx ? Number(rawIdx) : -1;
        const msg = this.messages[idx];
        if (!msg?.audioDataUrl) return;
        soundService.unlockAudio();
        if (!this.profile.soundEnabled) {
          this.showToast('Som silenciado! Ative o áudio para ouvir sua gravação.');
          return;
        }
        miauSpeechService.cancel();
        if (this.activePlayingUserAudioBtn && this.activePlayingUserAudioBtn !== btn) {
          const prevDur = this.activePlayingUserAudioBtn.getAttribute('data-audio-label') || '🎙️ Ouvir áudio';
          this.activePlayingUserAudioBtn.textContent = prevDur;
        }
        const buttonEl = btn as HTMLElement;
        if (!buttonEl.getAttribute('data-audio-label')) {
          buttonEl.setAttribute('data-audio-label', buttonEl.textContent?.trim() || '🎙️ Ouvir áudio');
        }
        const originalLabel = buttonEl.getAttribute('data-audio-label') || '🎙️ Ouvir áudio';
        this.activePlayingUserAudioBtn = buttonEl;
        void soundService
          .playAudioDataUrl(
            msg.audioDataUrl,
            () => {
              buttonEl.textContent = '🔊 Tocando...';
            },
            () => {
              if (this.activePlayingUserAudioBtn === buttonEl) {
                this.activePlayingUserAudioBtn = null;
              }
              buttonEl.textContent = originalLabel;
            }
          )
          .catch(() => {
            if (this.activePlayingUserAudioBtn === buttonEl) {
              this.activePlayingUserAudioBtn = null;
            }
            buttonEl.textContent = originalLabel;
            this.showToast('Não foi possível reproduzir este áudio no navegador.');
          });
      });
    });
  }

  private updateMicButtonsDOM(): void {
    const applyState = (btn: Element | null) => {
      if (!btn) return;
      btn.classList.toggle('bg-rose-500', this.isRecordingMic);
      btn.classList.toggle('animate-pulse', this.isRecordingMic);
      btn.classList.toggle('scale-110', this.isRecordingMic);
      btn.classList.toggle('bg-[#7b52b8]', !this.isRecordingMic);
      btn.setAttribute(
        'aria-label',
        this.isRecordingMic
          ? 'Solte para enviar áudio'
          : 'Segure para gravar mensagem de áudio'
      );
    };
    applyState(this.root.querySelector('#btn-mic'));
    applyState(this.root.querySelector('#btn-modal-mic'));

    const quickInput = this.root.querySelector(
      '#quick-chat-input'
    ) as HTMLInputElement | null;
    if (quickInput) {
      quickInput.placeholder = this.isRecordingMic
        ? '🔴 Gravando... solte para enviar!'
        : 'Fale com o Miau...';
    }
    const modalInput = this.root.querySelector(
      '#modal-chat-input'
    ) as HTMLInputElement | null;
    if (modalInput) {
      modalInput.placeholder = this.isRecordingMic
        ? '🔴 Gravando... solte para enviar!'
        : 'Digite ou segure 🎙️ para falar...';
    }
    const banner = this.root.querySelector('#modal-mic-holding-banner');
    if (banner) {
      banner.classList.toggle('hidden', !this.isRecordingMic);
    }
  }

  private bindHoldMicButtons(): void {
    this.activeHoldCleanup?.();
    this.activeHoldCleanup = null;

    const attachHoldHandlers = (btn: HTMLElement | null) => {
      if (!btn) return;
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
      });
      btn.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (this.isHoldPressed) return;
        e.preventDefault();
        soundService.unlockAudio();
        this.hasUserGesture = true;
        this.lastUserInteractionAt = Date.now();
        this.isHoldPressed = true;
        this.isRecordingMic = true;
        this.updateMicButtonsDOM();
        this.showToast('🎙️ Gravando... solte para enviar!');

        let permissionError = false;
        const startPromise = soundService.startRecording().catch((err) => {
          const msg = err instanceof Error ? err.message : '';
          if (!msg.includes('cancelada antes de iniciar')) {
            permissionError = true;
          }
          throw err;
        });

        let released = false;
        const finishHold = async () => {
          if (released) return;
          released = true;
          window.removeEventListener('pointerup', onRelease);
          window.removeEventListener('pointercancel', onRelease);
          window.removeEventListener('blur', onRelease);
          this.activeHoldCleanup = null;
          this.isHoldPressed = false;
          this.isRecordingMic = false;
          this.updateMicButtonsDOM();

          if (!soundService.isRecordingActive()) {
            soundService.cancelRecording();
            try {
              await startPromise;
            } catch {
              // Handled via permissionError check below
            }
            if (permissionError) {
              this.showToast('Permissão de microfone necessária para falar.');
            } else {
              this.showToast('Segure o botão do microfone enquanto fala e solte para enviar!');
            }
            return;
          }

          try {
            const rec = await soundService.stopRecording();
            if (rec.durationMs < 240 || !rec.audioBase64) {
              this.showToast('Segure o microfone enquanto fala e solte para enviar!');
              return;
            }
            if (rec.peakRms < 0.0012) {
              this.showToast('Fale um pouquinho mais perto do microfone para o Miau ouvir!');
              return;
            }
            await this.processRecordedVoiceClip(rec);
          } catch (err) {
            this.showToast(
              err instanceof Error ? err.message : 'Erro ao enviar áudio.'
            );
          }
        };

        const onRelease = () => {
          void finishHold();
        };

        this.activeHoldCleanup = () => {
          window.removeEventListener('pointerup', onRelease);
          window.removeEventListener('pointercancel', onRelease);
          window.removeEventListener('blur', onRelease);
          this.isHoldPressed = false;
          this.isRecordingMic = false;
          soundService.cancelRecording();
        };

        window.addEventListener('pointerup', onRelease, { once: true });
        window.addEventListener('pointercancel', onRelease, { once: true });
        window.addEventListener('blur', onRelease, { once: true });
      });
    };

    attachHoldHandlers(this.root.querySelector('#btn-mic') as HTMLElement | null);
    attachHoldHandlers(this.root.querySelector('#btn-modal-mic') as HTMLElement | null);
  }

  private async processRecordedVoiceClip(rec: {
    audioBase64: string;
    dataUrl: string;
    mimeType: string;
    durationMs: number;
  }): Promise<void> {
    this.showToast('Ouvindo e entendendo sua voz...');
    this.currentSpeech = {
      meowPrefix: 'Miau...',
      text: '(Ouvindo seu áudio com carinho...)',
    };
    this.updateSpeechDOM();

    const userAge = buildConversationContextSnapshot(this.humanProfile).user.age;
    let res: { transcript: string; safetyBlocked?: boolean; safeReply?: string };
    try {
      res = await transcribeUserAudioDetailed(rec.audioBase64, rec.mimeType, {
        mode: 'conversation',
        userAge,
        strictFilter: this.parentalConfig.strictAiFilter,
      });
    } catch (err) {
      await this.persistMessage(
        {
          sender: 'user',
          meowPrefix: '',
          text: '🎙️ Mensagem de voz',
          mood: 'happy',
          audioDataUrl: rec.dataUrl,
          audioDurationMs: rec.durationMs,
        },
        true
      );
      const fallbackMsg =
        err instanceof Error && err.message
          ? err.message
          : 'Não consegui entender o áudio agora, mas você pode ouvir sua gravação ou enviar por texto!';
      this.currentSpeech = { meowPrefix: 'Miau?', text: `(${fallbackMsg})` };
      this.updateSpeechDOM();
      this.refreshChatModalIfOpen();
      this.showToast(fallbackMsg);
      return;
    }

    if (res.safetyBlocked) {
      const safeText = res.safeReply || MINOR_REFUSAL_TEXT;
      await this.persistMessage(
        {
          sender: 'user',
          meowPrefix: '',
          text: res.transcript || '🎙️ Mensagem de voz',
          mood: 'happy',
          audioDataUrl: rec.dataUrl,
          audioDurationMs: rec.durationMs,
        },
        true
      );
      this.currentSpeech = { meowPrefix: 'Miau!', text: safeText };
      this.mood = 'happy';
      this.updateSpeechDOM();
      this.updateCharacterSvgDOM();
      void this.playCurrentMiauSpeech(true);
      await this.persistMessage(
        {
          sender: 'miau',
          meowPrefix: 'Miau!',
          text: safeText,
          mood: 'happy',
        },
        true
      );
      this.refreshChatModalIfOpen();
      return;
    }

    if (res.transcript.trim()) {
      await this.sendChatToMiau(res.transcript, {
        audioDataUrl: rec.dataUrl,
        audioDurationMs: rec.durationMs,
      });
      return;
    }

    // Caso o áudio tenha som mas as palavras tenham ficado muito baixinhas, ainda salva para ambos ouvirem
    await this.persistMessage(
      {
        sender: 'user',
        meowPrefix: '',
        text: '🎙️ Mensagem de voz',
        mood: 'happy',
        audioDataUrl: rec.dataUrl,
        audioDurationMs: rec.durationMs,
      },
      true
    );
    const gentleRetry =
      'Ouvi seu áudio, mas ficou bem baixinho! Pode falar um pouquinho mais perto do microfone?';
    this.currentSpeech = { meowPrefix: 'Miau?', text: `(${gentleRetry})` };
    this.mood = 'playful';
    this.updateSpeechDOM();
    this.updateCharacterSvgDOM();
    void this.playCurrentMiauSpeech(true);
    await this.persistMessage(
      {
        sender: 'miau',
        meowPrefix: 'Miau?',
        text: gentleRetry,
        mood: 'playful',
      },
      true
    );
    this.refreshChatModalIfOpen();
    this.showToast('Áudio enviado! Fale pertinho do microfone na próxima.');
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

  private renderGame(): void {
    this.ensureProfileDefaults();
    syncEasyReadBodyClass(this.screenPrefs.easyReadMode);
    const s = this.profile.stats;
    const bgId = this.profile.equipped.background;
    const theme = getRoomThemeClasses(bgId, this.isSleeping);
    const isNight = isNightRoomBackground(bgId, this.isSleeping);
    const petName = (this.profile.petName || 'Miau').trim() || 'Miau';
    const routineDone = this.profile.dailyRoutine?.completedSlots.length || 0;
    const activeRoutineCount = this.getActiveWindowSlots().length;
    const activeRoomDef = getHouseRoomDef(this.activeRoom);
    const effectiveEffect = this.getEffectiveMiauEffect();
    const screenLimit = getScreenLimitStatus(this.parentalConfig);
    const showScreenLockOverlay =
      screenLimit.locked && this.activeModal !== 'parental';
    const hasParentalPin = Boolean(this.parentalConfig.pinHash);

    this.root.innerHTML = `
      <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#dfd0ff] via-[#cbb1fb] to-[#b896f5] md:p-4">
        <div class="relative w-full h-full md:max-w-[440px] md:max-h-[860px] md:rounded-[42px] md:border-[6px] md:border-white/80 md:shadow-[0_24px_70px_rgba(64,33,117,0.3)] overflow-hidden flex flex-col bg-gradient-to-b ${theme.wall}">
          ${theme.useWallpaper ? '<div class="pointer-events-none absolute inset-0 miau-wallpaper z-0"></div>' : ''}

          <!-- Night / Sleep Dimmer -->
          <div class="pointer-events-none absolute inset-0 transition-opacity duration-500 bg-indigo-950/35 z-10 ${this.isSleeping ? 'opacity-100' : 'opacity-0'}"></div>

          <!-- Top Header -->
          <header class="relative z-20 px-4 pt-3.5 pb-1.5 flex items-center justify-between gap-2">
            <button id="btn-menu" aria-label="Abrir menu" class="w-10 h-10 rounded-full bg-white/60 backdrop-blur border border-white/80 flex items-center justify-center text-[#3b1f6e] shadow-sm hover:scale-105 transition shrink-0">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" d="M4 7h16M4 12h16M4 17h16"/>
              </svg>
            </button>

            <div class="min-w-0 flex-1 text-center px-1">
              <h1 id="hud-pet-name" class="font-display text-xl sm:text-2xl font-bold ${isNight ? 'text-white' : 'text-[#2d1b4e]'} tracking-tight truncate">🐾 ${escapeHtml(petName)}</h1>
              <p id="hud-room-name" class="text-[10px] font-extrabold uppercase tracking-wider ${isNight ? 'text-purple-200/85' : 'text-[#5b468f]/85'} leading-none mt-0.5">${activeRoomDef.emoji} ${escapeHtml(activeRoomDef.label)}</p>
            </div>

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

          <!-- Interactive House Room Switcher -->
          ${renderRoomSwitcherHtml(this.activeRoom, isNight)}

          ${
            !pwaService.isOnline
              ? `<div class="relative z-20 mx-auto mb-1 px-3 py-0.5 rounded-full bg-amber-500/90 text-white text-[10px] font-extrabold shadow">
                   📡 Modo Offline — dados salvos localmente
                 </div>`
              : ''
          }

          <!-- Status Bars & Quick Badges (Collapsible & Configurable Visibility) -->
          ${renderCollapsibleStatusSectionHtml({
            showStatusBars: this.screenPrefs.showStatusBars,
            showStatusBadges: this.screenPrefs.showStatusBadges,
            collapsed: this.screenPrefs.collapseStatusPanel,
            stats: s,
            unlockedCount: (this.profile.unlockedAchievements || []).length,
            totalAchievements: ACHIEVEMENTS.length,
            routineDone,
            routineTotal: ROUTINE_SCHEDULE.length,
            activeRoutineCount,
            isSleeping: this.isSleeping,
            level: this.profile.level,
          })}

          <!-- House Room Stage, Themed Scenery, Room Props & Miau -->
          <main id="miau-stage" class="relative flex-1 flex flex-col items-center justify-center overflow-hidden ${activeRoomDef.backdropTintClass}">
            ${
              theme.showFloor
                ? `<div class="absolute inset-x-0 bottom-0 h-[44%] bg-gradient-to-b ${theme.floor} border-t border-white/35"></div>`
                : ''
            }
            <div id="miau-room-scenery" class="absolute inset-0 pointer-events-none z-0">
              ${renderRoomScenerySvg(this.profile.equipped.background, this.isSleeping)}
            </div>

            <!-- Room-Specific Interactive Props & Controls -->
            ${renderRoomInteractiveOverlayHtml({
              activeRoom: this.activeRoom,
              petName,
              isSleeping: this.isSleeping,
              isNight,
              fridgeOpen: this.kitchenFridgeOpen,
              bathFoamPct: this.bathFoamPct,
              lullabyPlaying: soundService.isLullabyPlaying(),
              coins: this.profile.coins,
            })}

            <!-- Cleaning / Push Opt-in Banner -->
            ${
              this.isCleaningMode && this.activeRoom !== 'bathroom'
                ? `<div class="absolute top-2 z-20 glass-pill px-4 py-1.5 rounded-full text-xs font-extrabold text-cyan-800 animate-bounce">
                     🫧 Esfregue ou toque no Miau para ensaboar!
                   </div>`
                : this.activeRoom !== 'bathroom' &&
                    (this.profile.stats.hunger < 35 ||
                      this.profile.stats.hygiene < 35 ||
                      this.profile.stats.sleep < 35) &&
                    pushNotificationService.shouldOfferRoomPrompt()
                  ? `<div class="absolute top-2 z-20 glass-pill px-3 py-1.5 rounded-full flex items-center gap-2 shadow-md max-w-[92%]">
                       <span class="text-[11px] font-extrabold text-[#3b1f6e] truncate">🔔 Avisar quando Miau precisar?</span>
                       <button id="btn-room-enable-push" type="button" class="px-2.5 py-0.5 rounded-full bg-[#6e45a5] text-white text-[10px] font-extrabold shrink-0 hover:brightness-110">Ativar</button>
                       <button id="btn-room-dismiss-push" type="button" aria-label="Dispensar aviso" class="text-[11px] font-bold text-[#7a60a8] px-1 shrink-0">✕</button>
                     </div>`
                  : ''
            }

            <!-- Interactive Miau Character -->
            <div
              id="miau-character-wrap"
              role="button"
              tabindex="0"
              aria-label="${this.activeRoom === 'bathroom' ? `Esfregar sabonete em ${escapeHtml(petName)}` : `Fazer carinho em ${escapeHtml(petName)}`}"
              style="${this.activeRoom === 'bathroom' || this.isCleaningMode ? 'touch-action:none;' : ''}"
              class="relative z-10 w-[235px] h-[210px] sm:w-[260px] sm:h-[230px] cursor-pointer active:scale-95 transition-transform"
            >
              <div id="miau-svg-container" class="w-full h-full">
                ${renderMiauSvg(this.mood, this.profile.equipped, this.isSleeping, effectiveEffect)}
              </div>
            </div>
          </main>

          <!-- AI Speech Bubble + Input Area (Collapsible) -->
          ${renderCollapsibleSpeechAndChatHtml({
            showSpeechAndChat: this.screenPrefs.showSpeechAndChat,
            collapseSpeechBox: this.screenPrefs.collapseSpeechBox,
            collapseChatBox: this.screenPrefs.collapseChatBox,
            petName,
            meowPrefix: this.currentSpeech.meowPrefix,
            speechText: this.currentSpeech.text,
            avatarUrl: MIAU_AVATAR_URL,
            isRecordingMic: this.isRecordingMic,
          })}

          <!-- Bottom Navigation Bar (Collapsible) -->
          ${renderCollapsibleBottomNavHtml({
            collapsed: this.screenPrefs.collapseBottomNav,
            activeModal: this.activeModal,
            isCleaningMode: this.isCleaningMode,
          })}

          <!-- Toast Notification -->
          <div
            id="miau-toast"
            class="pointer-events-none ${this.toastMessage ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300 absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-[#3b1f6e]/95 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg whitespace-nowrap max-w-[90%] truncate"
          >${escapeHtml(this.toastMessage)}</div>

          <!-- Active Drawer / Modal -->
          ${this.activeModal !== 'none' ? this.renderModal() : ''}
          ${
            this.onboardingActive && this.activeModal === 'none'
              ? renderOnboardingOverlayHtml({
                  step: this.onboardingStep,
                  petName,
                  step2ActionDone: this.onboardingStep2Done,
                  isNight,
                })
              : ''
          }
          ${this.showInstallGuideModal ? renderInstallGuideModalHtml() : ''}
          ${
            showScreenLockOverlay
              ? `
                <div id="parental-screen-lock-overlay" class="fixed inset-0 z-40 flex items-center justify-center bg-indigo-950/80 backdrop-blur-md p-4">
                  <div class="w-full max-w-sm rounded-3xl p-5 bg-white border-2 border-purple-200 shadow-2xl text-center flex flex-col gap-3.5">
                    <div class="w-16 h-16 mx-auto rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-3xl">⏰</div>
                    <div>
                      <h2 class="font-display text-xl font-bold text-[#3b1f6e]">Tempo de tela de hoje concluído!</h2>
                      <p class="text-xs font-semibold text-[#6b4d9e] mt-1">
                        O ${escapeHtml(petName)} descansou após ${screenLimit.usedMinutes} min de diversão e estudo (limite: ${screenLimit.limitMinutes} min).
                      </p>
                    </div>
                    <form id="parental-lock-form" class="flex flex-col gap-2.5 text-left">
                      <label class="text-[11px] font-extrabold text-[#4c2a85] text-center">
                        ${
                          hasParentalPin
                            ? 'Responsável: digite o PIN de 4 dígitos para liberar'
                            : `Responsável: ${escapeHtml(this.parentalScreenLockChallenge.question)}`
                        }
                      </label>
                      <input
                        id="parental-lock-input"
                        type="${hasParentalPin ? 'password' : 'text'}"
                        inputmode="numeric"
                        maxlength="${hasParentalPin ? 4 : 6}"
                        autocomplete="off"
                        placeholder="${hasParentalPin ? 'PIN (4 dígitos)' : 'Resposta'}"
                        class="w-full rounded-2xl border-2 border-purple-200 bg-purple-50/70 px-4 py-2.5 text-center font-display text-base font-bold text-[#3b1f6e]"
                      />
                      ${
                        this.parentalScreenLockError
                          ? `<p class="text-xs font-extrabold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-1.5 text-center">${escapeHtml(this.parentalScreenLockError)}</p>`
                          : ''
                      }
                      <div class="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="submit"
                          data-lock-extra="30"
                          class="min-h-[42px] py-2 px-3 rounded-xl bg-[#6e45a5] hover:bg-[#5c3691] text-white font-extrabold text-xs shadow-sm transition"
                        >
                          +30 min extras
                        </button>
                        <button
                          type="submit"
                          data-lock-extra="0"
                          class="min-h-[42px] py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-sm transition"
                        >
                          Liberar por hoje
                        </button>
                      </div>
                    </form>
                    <button
                      id="btn-lock-open-parental"
                      type="button"
                      class="text-xs font-extrabold text-[#6e45a5] hover:underline"
                    >
                      🛡️ Abrir Área dos Responsáveis
                    </button>
                  </div>
                </div>
              `
              : ''
          }
        </div>
      </div>
    `;

    this.bindGameEvents();
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
      body = renderCustomizeModalHtml(this.profile, this.shopTab, {
        previewEquipped: this.previewEquipped,
        mood: this.mood,
      });
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
        schoolingFilter: this.rankingSchoolingFilter,
        gameRecords: this.profile.gameRecords!,
        matchHistory: this.loadGameMatchHistory(),
      });
    } else if (this.activeModal === 'routine') {
      const ownerId =
        this.firebaseUser?.uid || (this.isDemoSession ? 'demo' : 'guest');
      pushNotificationService.setOwner(ownerId);
      const pushPrefs = pushNotificationService.getPrefs(ownerId);
      const dailyMissions = loadDailyMissionsSnapshot(ownerId);
      body = renderRoutineModalHtml(
        this.profile,
        this.isSleeping,
        (slot, now) => this.isSlotInWindow(slot, now),
        loadWritingProgress(ownerId),
        {
          supported: pushNotificationService.isSupported(),
          enabled: pushPrefs.enabled,
          permission: pushNotificationService.getPermission(),
          threshold: pushPrefs.threshold,
        },
        dailyMissions
      );
    } else if (this.activeModal === 'menu') {
      const ownerId =
        this.firebaseUser?.uid || (this.isDemoSession ? 'demo' : 'guest');
      const dailyMissionsSnap = loadDailyMissionsSnapshot(ownerId);
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
        dailyMissions: {
          completedCount: dailyMissionsSnap.missions.filter((m) => m.completed)
            .length,
          totalCount: dailyMissionsSnap.missions.length,
          currentStreak: dailyMissionsSnap.currentStreak,
        },
        visibleHudCount,
      });
    } else if (this.activeModal === 'profile') {
      body = this.profileModal.render();
    } else if (this.activeModal === 'learn') {
      body =
        this.activeLearnTrack !== 'none' &&
        this.learnTracks.hasTrack(this.activeLearnTrack)
          ? this.learnTracks.renderTrack(this.activeLearnTrack)
          : renderLearnModalHtml(this.humanProfile, this.learnPreviewLevel);
    } else if (this.activeModal === 'progress_report') {
      const ownerId =
        this.firebaseUser?.uid || (this.isDemoSession ? 'demo' : 'guest');
      body = renderProgressReportModalHtml(
        buildEducationProgressReport(ownerId),
        this.progressReportTab
      );
    } else if (this.activeModal === 'settings') {
      const ownerId =
        this.firebaseUser?.uid || (this.isDemoSession ? 'demo' : 'guest');
      pushNotificationService.setOwner(ownerId);
      body = renderSettingsModalHtml({
        petName: this.profile.petName,
        screenPrefs: this.screenPrefs,
        soundEnabled: this.profile.soundEnabled,
        cameraPermission: this.cameraPermission,
        pushState: {
          supported: pushNotificationService.isSupported(),
          permission: pushNotificationService.getPermission(),
          prefs: pushNotificationService.getPrefs(ownerId),
          webPushActive: pushNotificationService.hasActiveWebPushSubscription(),
        },
        pushTestPreview: this.pushTestPreview,
      });
    } else if (this.activeModal === 'smart_review' && this.smartReviewState) {
      body = renderSmartReviewModalHtml({
        state: this.smartReviewState,
        equipped: this.profile.equipped,
        petName: this.profile.petName,
      });
    } else if (this.activeModal === 'parental') {
      const ownerId =
        this.firebaseUser?.uid || (this.isDemoSession ? 'demo' : 'guest');
      body = renderParentalDashboardModalHtml({
        state: this.parentalDashboardState,
        config: this.parentalConfig,
        report: buildEducationProgressReport(ownerId),
        isFirebaseAccount: Boolean(this.firebaseUser),
        petName: this.profile.petName,
      });
    } else if (this.activeModal === 'support') {
      body = renderSupportModalHtml(
        this.supportDraft,
        this.buildSupportWhatsAppUrl(this.supportDraft)
      );
    }

    const useNightModal = shouldUseNightModalTheme(
      this.profile.equipped.background,
      this.isSleeping
    );
    return `
      <div id="modal-fullscreen" class="fixed inset-0 z-30 flex flex-col bg-gradient-to-b from-[#ede4ff] via-[#e4d5fc] to-[#d9c4fa] overflow-hidden ${useNightModal ? 'miau-night-modal' : ''}">
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
      !this.isCleaningMode &&
      (this.activeRoom === 'living' || this.activeRoom === 'playroom')
    ) {
      const stageEl = this.root.querySelector('#miau-stage') as HTMLElement | null;
      const charWrapEl = this.root.querySelector('#miau-character-wrap') as HTMLElement | null;
      if (stageEl) {
        this.ballController = mountInteractiveBall(stageEl, charWrapEl, () => {
          this.handleQuickPlay('ball');
        });
      }
    }

    // House room switcher
    this.root.querySelectorAll('[data-room-switch]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextRoom = btn.getAttribute('data-room-switch') as HouseRoomId | null;
        if (!nextRoom || nextRoom === this.activeRoom) return;
        this.activeRoom = nextRoom;
        this.kitchenFridgeOpen = false;
        this.isCleaningMode = false;
        hapticService.tap();
        this.render();
      });
    });

    // Kitchen interactive props (fridge & bowl)
    this.root.querySelector('#btn-room-fridge')?.addEventListener('click', () => {
      hapticService.tap();
      this.kitchenFridgeOpen = !this.kitchenFridgeOpen;
      this.render();
    });
    this.root.querySelector('#btn-room-close-fridge')?.addEventListener('click', () => {
      this.kitchenFridgeOpen = false;
      this.render();
    });
    this.root.querySelector('#btn-room-all-foods')?.addEventListener('click', () => {
      this.kitchenFridgeOpen = false;
      this.activeModal = 'feed';
      this.render();
    });
    this.root.querySelector('#btn-room-bowl')?.addEventListener('click', () => {
      this.kitchenFridgeOpen = false;
      this.handleQuickFeed();
    });

    // Bathroom interactive props (soap scrub + showerhead rinse)
    const updateFoamDom = (nextPct: number) => {
      const prevHasFoam = this.bathFoamPct >= 20;
      this.bathFoamPct = nextPct;
      const pctEl = this.root.querySelector('#bath-foam-pct');
      const barEl = this.root.querySelector('#bath-foam-bar') as HTMLElement | null;
      if (pctEl) pctEl.textContent = `${Math.round(nextPct)}%`;
      if (barEl) barEl.style.width = `${Math.round(nextPct)}%`;
      if (!prevHasFoam && nextPct >= 20) {
        this.updateCharacterSvgDOM();
      }
    };

    const applyBathScrubDelta = (deltaPx: number) => {
      const nextPct = advanceBathFoamProgress(this.bathFoamPct, deltaPx);
      updateFoamDom(nextPct);
      const now = performance.now();
      if (now - this.lastBathFeedbackAt >= 180) {
        this.lastBathFeedbackAt = now;
        soundService.playBubble();
        hapticService.bubbles();
        this.spawnFloatingParticle('🫧');
        this.profile.stats.hygiene = Math.min(100, this.profile.stats.hygiene + 3);
        this.profile.stats.happiness = Math.min(100, this.profile.stats.happiness + 1);
        this.updateStatusBarsDOM();
      }
    };

    this.root.querySelector('#btn-room-soap')?.addEventListener('click', () => {
      applyBathScrubDelta(120);
      this.triggerMiauReaction('bounce');
      if (this.bathFoamPct >= 80) {
        this.showToast('Agora toque no 🚿 Chuveirinho para enxaguar!');
      }
    });

    this.root.querySelector('#btn-room-showerhead')?.addEventListener('click', () => {
      this.ensureProfileDefaults();
      const neededBath = this.profile.stats.hygiene < 94 || this.bathFoamPct >= 20;
      const foamBonus = this.bathFoamPct >= 40 ? 15 : 8;
      this.bathFoamPct = 0;
      this.isCleaningMode = false;
      soundService.playShakeDrops();
      hapticService.coin();
      this.profile.stats.hygiene = Math.min(100, this.profile.stats.hygiene + 30 + foamBonus);
      this.profile.stats.happiness = Math.min(100, this.profile.stats.happiness + 12);
      this.profile.progress.cleanCount += 1;
      this.addRewards(neededBath ? 14 : 0, 12);
      const claimedRoutine = this.claimRoutineSlot('bath');
      this.evaluateAchievements();
      this.recordMissionProgress({ type: 'bath' });
      this.mood = 'happy';
      this.currentSpeech = claimedRoutine
        ? {
            meowPrefix: 'Brrr! 🚿⏰',
            text: `(Banho completo no horário! Sacudi as gotinhas! +${claimedRoutine.bonusCoins} moedas!)`,
          }
        : {
            meowPrefix: 'Brrr! 🚿✨',
            text: '(Chuveirinho gostoso! Sacudi toda a água e estou cheiroso!)',
          };
      this.render();
      this.setTemporaryMiauEffect('bath_shake', 1900);
      this.spawnFloatingParticle('💧');
      this.spawnFloatingParticle('✨');
      this.speakCurrentCaption();
      void this.persistStats();
    });

    // Bedroom interactive props (lamp & lullaby)
    this.root.querySelector('#btn-room-lamp')?.addEventListener('click', () => {
      hapticService.tap();
      if (!this.isSleeping) {
        this.setTemporaryMiauEffect('yawning', 600);
        window.setTimeout(() => {
          if (!this.isSleeping) {
            this.activeMiauEffect = 'none';
            this.toggleSleep();
          }
        }, 420);
      } else {
        this.toggleSleep();
      }
    });
    this.root.querySelector('#btn-room-lullaby')?.addEventListener('click', () => {
      hapticService.tap();
      if (soundService.isLullabyPlaying()) {
        soundService.stopLullaby();
        this.showToast('Música de ninar pausada.');
      } else {
        soundService.unlockAudio();
        soundService.startLullaby();
        this.spawnFloatingParticle('🎶');
        this.showToast('🎶 Tocando música de ninar suave...');
      }
      this.render();
    });

    // Playroom interactive props (scratcher & toybox)
    this.root.querySelector('#btn-room-scratcher')?.addEventListener('click', () => {
      if (this.isSleeping) this.toggleSleep();
      this.ensureProfileDefaults();
      soundService.playScratch();
      hapticService.play();
      this.profile.stats.fun = Math.min(100, this.profile.stats.fun + 14);
      this.profile.stats.happiness = Math.min(100, this.profile.stats.happiness + 10);
      const claim = claimBallCoins(this.profile.ownerId || 'guest', 6);
      this.addRewards(claim.coinsGranted, 6);
      this.evaluateAchievements();
      this.mood = 'playful';
      this.currentSpeech = {
        meowPrefix: 'Scratch! 🐾',
        text:
          claim.coinsGranted > 0
            ? `(Adoro o arranhador! Minhas garras ficaram afiadas! +🪙 ${claim.coinsGranted})`
            : '(Que arranhador gostoso! Estude no Vamos Aprender para ganhar mais moedas!)',
      };
      this.updateStatusBarsDOM();
      this.updateSpeechDOM();
      this.setTemporaryMiauEffect('scratching', 1500);
      this.spawnFloatingParticle('🐾');
      this.speakCurrentCaption();
      void this.persistStats();
    });
    this.root.querySelector('#btn-room-toybox')?.addEventListener('click', () => {
      hapticService.tap();
      this.activeModal = 'games';
      this.render();
    });

    // Pet Miau or rub soap bubbles in bathroom / cleaning mode
    const miauWrap = this.root.querySelector('#miau-character-wrap');
    miauWrap?.addEventListener('pointerdown', (e) => {
      if (this.activeRoom !== 'bathroom' && !this.isCleaningMode) return;
      const pe = e as PointerEvent;
      this.lastBathPointer = { x: pe.clientX, y: pe.clientY };
    });
    miauWrap?.addEventListener('pointermove', (e) => {
      if (this.activeRoom !== 'bathroom' && !this.isCleaningMode) return;
      if (!this.lastBathPointer) return;
      const pe = e as PointerEvent;
      const dist = Math.hypot(
        pe.clientX - this.lastBathPointer.x,
        pe.clientY - this.lastBathPointer.y
      );
      if (dist >= 12) {
        this.lastBathPointer = { x: pe.clientX, y: pe.clientY };
        applyBathScrubDelta(dist);
      }
    });
    const clearBathPointer = () => {
      this.lastBathPointer = null;
    };
    miauWrap?.addEventListener('pointerup', clearBathPointer);
    miauWrap?.addEventListener('pointercancel', clearBathPointer);

    miauWrap?.addEventListener('click', () => {
      if (this.activeRoom === 'bathroom') {
        applyBathScrubDelta(75);
        this.triggerMiauReaction('bounce');
        void this.persistStats();
        return;
      }
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
          this.recordMissionProgress({ type: 'bath' });
          hapticService.coin();
          this.currentSpeech = claimedRoutine
            ? {
                meowPrefix: 'Purrr~ ⏰',
                text: `(Obrigado pelo banho no horário! +${claimedRoutine.bonusCoins} moedas de bônus!)`,
              }
            : {
                meowPrefix: 'Purrr~ ✨',
                text: '(Obrigado pelo banho de espuma! Estou limpinho e reluzente!)',
              };
          this.render();
          this.setTemporaryMiauEffect('bath_shake', 1800);
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
      soundService.unlockAudio();
      void this.playCurrentMiauSpeech(true, true);
    });
    this.root
      .querySelector('#speech-bubble-card')
      ?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest('#btn-speaker, #btn-toggle-speech-box')) return;
        soundService.unlockAudio();
        hapticService.tap();
        this.openConversarModal();
      });

    // Collapsible HUD panel toggles (free up space for the room & pet)
    this.root
      .querySelector('#btn-toggle-status-panel')
      ?.addEventListener('click', () => {
        this.screenPrefs.collapseStatusPanel =
          !this.screenPrefs.collapseStatusPanel;
        hapticService.tap();
        this.saveScreenPrefs();
        this.render();
      });
    this.root
      .querySelector('#btn-toggle-speech-box')
      ?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.screenPrefs.collapseSpeechBox =
          !this.screenPrefs.collapseSpeechBox;
        hapticService.tap();
        this.saveScreenPrefs();
        this.render();
      });
    this.root
      .querySelector('#btn-toggle-chat-box')
      ?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.screenPrefs.collapseChatBox = !this.screenPrefs.collapseChatBox;
        hapticService.tap();
        this.saveScreenPrefs();
        this.render();
      });
    this.root
      .querySelector('#btn-toggle-bottom-nav')
      ?.addEventListener('click', () => {
        this.screenPrefs.collapseBottomNav =
          !this.screenPrefs.collapseBottomNav;
        hapticService.tap();
        this.saveScreenPrefs();
        this.render();
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
      soundService.unlockAudio();
      const val = chatInput?.value || '';
      if (!val.trim()) return;
      if (chatInput) chatInput.value = '';
      void this.sendChatToMiau(val);
    });

    // Mic hold-to-record buttons (main screen + Conversar modal)
    this.bindHoldMicButtons();

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
        this.previewEquipped = null;
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
        this.kitchenFridgeOpen = false;
        this.mood = 'eating';
        this.currentSpeech = claimedRoutine
          ? {
              meowPrefix: 'Nham nham! ⏰',
              text: `(Obrigado pelo ${food.name} no horário! +${claimedRoutine.bonusCoins} moedas bônus!)`,
            }
          : {
              meowPrefix: 'Nham nham! 😋',
              text: `(Obrigado pelo ${food.name}! Que delícia!)`,
            };
        this.activeModal = 'none';
        this.render();
        this.setTemporaryMiauEffect('chewing', 1700);
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
      this.bathFoamPct = 0;
      soundService.playShakeDrops();
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
      this.recordMissionProgress({ type: 'bath' });
      this.currentSpeech = claimedRoutine
        ? {
            meowPrefix: 'Purrr~ ⏰',
            text: `(Obrigado pelo banho no horário! +${claimedRoutine.bonusCoins} moedas de bônus!)`,
          }
        : {
            meowPrefix: 'Purrr~ 🫧',
            text: '(Obrigado pelo banho quentinho! Estou cheiroso demais!)',
          };
      this.activeModal = 'none';
      this.render();
      this.setTemporaryMiauEffect('bath_shake', 1900);
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
    this.root.querySelectorAll('[data-ranking-schooling]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const filter = btn.getAttribute(
          'data-ranking-schooling'
        ) as RankingSchoolingFilter | null;
        if (!filter) return;
        this.rankingSchoolingFilter = filter;
        this.render();
      });
    });

    const launchGame = (id: GameId) => {
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
      } else if (id === 'pacmiau') {
        this.miniGameCleanup = mountPacMiauGame(
          host,
          onDone,
          onExit,
          high,
          this.toggleSoundMute
        );
      } else if (id === 'maze') {
        this.miniGameCleanup = mountMilkMazeGame(
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
    this.root.querySelector('#start-pacmiau-game')?.addEventListener('click', () => launchGame('pacmiau'));
    this.root.querySelector('#start-maze-game')?.addEventListener('click', () => launchGame('maze'));

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
    this.root
      .querySelector('#btn-routine-open-writing')
      ?.addEventListener('click', () => {
        this.learnPreviewLevel = null;
        this.learnTracks.resetTrack('infantil_escrita');
        this.activeLearnTrack = 'infantil_escrita';
        this.activeModal = 'learn';
        this.render();
      });
    this.root
      .querySelector('#btn-routine-push-action')
      ?.addEventListener('click', async () => {
        const ownerId =
          this.firebaseUser?.uid || (this.isDemoSession ? 'demo' : 'guest');
        const prefs = pushNotificationService.getPrefs(ownerId);
        if (prefs.enabled) {
          this.activeModal = 'settings';
          this.render();
          return;
        }
        await this.activatePushFromUI();
      });

    this.root
      .querySelector('#btn-room-enable-push')
      ?.addEventListener('click', () => {
        void this.activatePushFromUI();
      });
    this.root
      .querySelector('#btn-room-dismiss-push')
      ?.addEventListener('click', () => {
        pushNotificationService.dismissPromptTemporarily(3);
        this.render();
      });

    // Customize tabs & items (Loja 2.0: Chapéus, Acessórios, Fundos, Comidas & Experimentar)
    this.root.querySelectorAll('[data-shoptab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextTab = btn.getAttribute('data-shoptab') as ShopTab | null;
        if (!nextTab) return;
        this.shopTab = nextTab;
        this.render();
      });
    });

    this.root.querySelectorAll('[data-shop-try]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-shop-try');
        const item = SHOP_ITEMS.find((s) => s.id === id);
        if (!item) return;
        hapticService.tap();
        const currentlyPreviewed =
          this.previewEquipped?.[item.category] === item.id;
        if (currentlyPreviewed) {
          const nextPreview = { ...(this.previewEquipped ?? {}) };
          delete nextPreview[item.category];
          this.previewEquipped =
            Object.keys(nextPreview).length > 0 ? nextPreview : null;
        } else {
          this.previewEquipped = {
            ...(this.previewEquipped ?? {}),
            [item.category]: item.id,
          };
        }
        this.render();
      });
    });

    this.root
      .querySelectorAll('[data-shop-try-stop]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          hapticService.tap();
          this.previewEquipped = null;
          this.render();
        });
      });

    this.root.querySelectorAll('[data-shop-consumable]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-shop-consumable');
        const food = SHOP_CONSUMABLES.find((f) => f.id === id);
        if (!food) return;
        if (this.profile.coins < food.price) {
          hapticService.warning();
          this.showToast(
            'Moedas insuficientes! Brinque nos Minijogos ou estude para ganhar.'
          );
          return;
        }
        if (this.isSleeping) {
          this.toggleSleep();
        }
        this.ensureProfileDefaults();
        this.profile.coins -= food.price;
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
          this.profile.stats.happiness + food.happinessBoost
        );
        if (food.sleepBoost) {
          this.profile.stats.sleep = Math.min(
            100,
            this.profile.stats.sleep + food.sleepBoost
          );
        }
        this.profile.progress.mealsFed += 1;
        this.addRewards(0, food.xpReward);
        const claimedRoutine = this.claimRoutineSlot('food');
        this.evaluateAchievements();
        soundService.playCrunch();
        hapticService.chomp();
        this.kitchenFridgeOpen = false;
        this.previewEquipped = null;
        this.mood = 'eating';
        this.currentSpeech = claimedRoutine
          ? {
              meowPrefix: `Nham nham! ${food.emoji}⏰`,
              text: `(Adorei o ${food.name} no horário! +${claimedRoutine.bonusCoins} moedas bônus!)`,
            }
          : {
              meowPrefix: `Nham nham! ${food.emoji}`,
              text: `(Que delícia de ${food.name}! Estou me sentindo super bem!)`,
            };
        this.activeModal = 'none';
        this.render();
        this.setTemporaryMiauEffect('chewing', 1700);
        this.triggerMiauReaction('spin');
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
        if (this.previewEquipped) {
          const nextPreview = { ...this.previewEquipped };
          delete nextPreview[item.category];
          this.previewEquipped =
            Object.keys(nextPreview).length > 0 ? nextPreview : null;
        }

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
      soundService.unlockAudio();
      const txt = modalChatInput?.value || '';
      if (!txt.trim()) return;
      if (modalChatInput) modalChatInput.value = '';
      void this.sendChatToMiau(txt);
    });

    this.root.querySelectorAll('[data-chat-quick]').forEach((btn) => {
      btn.addEventListener('click', () => {
        soundService.unlockAudio();
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
            this.liveStatus =
              err ||
              'Voz ao vivo pausada temporariamente — continue conversando por texto ou 🎤!';
            this.liveSession = null;
            hapticService.warning();
            this.showToast('Continuando a conversa por texto!');
            this.render();
          },
          onClosed: () => {
            this.liveSession = null;
            if (!hadLiveError) {
              this.liveStatus = 'Sessão de voz encerrada. Continue por texto ou 🎤!';
            }
            this.render();
          },
        });
        this.liveSession = session;
        session.setMuted(!this.profile.soundEnabled);
        try {
          const liveUserAge = buildConversationContextSnapshot(
            this.humanProfile
          ).user.age;
          await session.start(
            liveUserAge,
            this.parentalConfig.strictAiFilter
          );
        } catch (err) {
          hadLiveError = true;
          this.liveSession = null;
          this.liveStatus =
            err instanceof Error
              ? err.message
              : 'Voz ao vivo indisponível agora — continue conversando por texto!';
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
        this.resetAllLearnTracks();
        this.activeModal = 'learn';
        this.render();
      });

    this.root
      .querySelector('#btn-menu-progress-report')
      ?.addEventListener('click', () => {
        this.activeModal = 'progress_report';
        this.render();
      });

    const openEducationTrack = (trackId: string) => {
      this.activeModal = 'learn';
      if (this.learnTracks.hasTrack(trackId)) {
        this.learnTracks.resetTrack(trackId);
        this.activeLearnTrack = trackId;
      }
      this.render();
    };

    if (this.activeModal === 'profile') {
      this.profileModal.bind(this.root);
    }

    if (this.activeModal === 'progress_report') {
      this.root
        .querySelector('#btn-report-back')
        ?.addEventListener('click', () => {
          this.activeModal = 'menu';
          this.render();
        });
      this.root
        .querySelector('#btn-report-open-shop')
        ?.addEventListener('click', () => {
          this.activeModal = 'customize';
          this.render();
        });
      this.root.querySelectorAll('[data-report-tab]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const tab = btn.getAttribute('data-report-tab') as ProgressReportFilter | null;
          if (!tab) return;
          this.progressReportTab = tab;
          this.render();
        });
      });
      this.root.querySelectorAll('[data-report-open-track]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const trackId = btn.getAttribute('data-report-open-track');
          if (trackId) openEducationTrack(trackId);
        });
      });
    }

    if (this.activeModal === 'learn') {
      if (
        this.activeLearnTrack !== 'none' &&
        this.learnTracks.hasTrack(this.activeLearnTrack)
      ) {
        this.learnTracks.bindTrack(this.activeLearnTrack, this.root);
      } else {
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
          onOpenProgressReport: () => {
            this.activeModal = 'progress_report';
            this.render();
          },
          onOpenSmartReview: () => {
            const ownerId =
              this.firebaseUser?.uid || (this.isDemoSession ? 'demo' : 'guest');
            const session = buildSmartReviewSession({
              ownerId,
              schooling: this.humanProfile.schooling,
            });
            this.smartReviewState = createInitialSmartReviewState(session);
            this.activeModal = 'smart_review';
            this.render();
          },
          onSelectPreviewLevel: (level) => {
            this.learnPreviewLevel = level;
            this.render();
          },
          onOpenTrack: openEducationTrack,
        });
      }
    }

    if (this.activeModal === 'smart_review' && this.smartReviewState) {
      const srState = this.smartReviewState;
      bindSmartReviewModalEvents(this.root, srState, {
        onBack: () => {
          this.activeModal = 'learn';
          this.render();
        },
        onRerender: () => {
          if (this.screen === 'game' && this.activeModal === 'smart_review') {
            this.render();
          }
        },
        onCompleteSession: (score, total) => {
          const ownerId =
            this.firebaseUser?.uid || (this.isDemoSession ? 'demo' : 'guest');
          const res = markSmartReviewCompleted(ownerId, score, total);
          this.parentalConfig = recordCompletedLesson(ownerId);
          this.ensureProfileDefaults();
          this.addRewards(res.coinsReward, res.xpReward);
          if (srState.session.questions.some((q) => isMathEducationTrack(q.trackId))) {
            this.recordMissionProgress({
              type: 'math_lesson',
              trackId: 'fund1_matematica',
            });
          }
          this.updateStatusBarsDOM();
          void this.persistStats();
          return res;
        },
        onRestartSession: () => {
          const ownerId =
            this.firebaseUser?.uid || (this.isDemoSession ? 'demo' : 'guest');
          const session = buildSmartReviewSession({
            ownerId,
            schooling: this.humanProfile.schooling,
          });
          this.smartReviewState = createInitialSmartReviewState(session);
          this.render();
        },
      });
    }

    if (this.activeModal === 'parental') {
      const ownerId =
        this.firebaseUser?.uid || (this.isDemoSession ? 'demo' : 'guest');
      bindParentalDashboardModalEvents(
        this.root,
        this.parentalDashboardState,
        this.parentalConfig,
        {
          onBack: () => {
            this.activeModal = 'menu';
            this.render();
          },
          onRerender: () => {
            if (this.screen === 'game' && this.activeModal === 'parental') {
              this.render();
            }
          },
          onOpenTrack: (trackId) => {
            openEducationTrack(trackId);
          },
          onUpdateConfig: (next, opts) => {
            this.parentalConfig = saveParentalControlConfig(next);
            if (opts?.syncPush) {
              const statsSnap = {
                hunger: this.profile.stats.hunger,
                hygiene: this.profile.stats.hygiene,
                sleep: this.profile.stats.sleep,
                isSleeping: this.isSleeping,
              };
              pushNotificationService.scheduleServiceWorkerFallbackReminders(
                this.profile.petName,
                statsSnap
              );
              void pushNotificationService.syncWithServer(
                this.profile.petName,
                statsSnap,
                true
              );
            }
            if (opts?.toast) this.showToast(opts.toast);
            this.render();
          },
          onSetPin: (rawPin) => {
            const res = setParentalPin(ownerId, rawPin);
            this.parentalConfig = res.config;
            return res;
          },
          onClearPin: () => {
            this.parentalConfig = clearParentalPin(ownerId);
            return this.parentalConfig;
          },
        }
      );
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
      .querySelector('#btn-menu-parental')
      ?.addEventListener('click', () => {
        this.parentalDashboardState = createInitialParentalDashboardState();
        this.activeModal = 'parental';
        this.render();
      });

    this.root.querySelectorAll('[data-lock-extra]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const extra = Number(btn.getAttribute('data-lock-extra') || 30);
        this.pendingParentalUnlockMinutes = Number.isFinite(extra) ? extra : 30;
      });
    });

    this.root
      .querySelector('#btn-lock-open-parental')
      ?.addEventListener('click', () => {
        this.parentalDashboardState = createInitialParentalDashboardState();
        this.activeModal = 'parental';
        this.render();
      });

    this.root
      .querySelector('#parental-lock-form')
      ?.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = this.root.querySelector(
          '#parental-lock-input'
        ) as HTMLInputElement | null;
        const val = (input?.value || '').trim();
        const ownerId =
          this.firebaseUser?.uid || (this.isDemoSession ? 'demo' : 'guest');
        const hasPin = Boolean(this.parentalConfig.pinHash);
        const valid = hasPin
          ? verifyParentalPin(val, this.parentalConfig.pinHash)
          : Boolean(val) &&
            Number(val) === this.parentalScreenLockChallenge.answer;

        if (!valid) {
          this.parentalScreenLockError = hasPin
            ? 'PIN incorreto. Tente novamente.'
            : 'Resposta incorreta. Confira a conta e tente novamente.';
          if (!hasPin) {
            this.parentalScreenLockChallenge = generateAdultMathChallenge();
          }
          this.render();
          return;
        }

        const extra = this.pendingParentalUnlockMinutes;
        this.parentalConfig = unlockScreenLimitTemporarily(ownerId, extra);
        this.parentalScreenLockError = '';
        this.showToast(
          extra > 0
            ? `Tempo de tela liberado por mais ${extra} min!`
            : 'Tempo de tela liberado por hoje!'
        );
        this.render();
      });

    this.root
      .querySelector('#btn-settings-back')
      ?.addEventListener('click', () => {
        this.activeModal = 'menu';
        this.render();
      });

    this.root
      .querySelector('#settings-pet-name-form')
      ?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = this.root.querySelector(
          '#settings-pet-name-input'
        ) as HTMLInputElement | null;
        if (!input) return;
        const cleanName = input.value.replace(/\s+/g, ' ').trim().slice(0, 32);
        if (!cleanName) {
          this.showToast('Digite um nome válido para o seu bichinho!');
          input.focus();
          return;
        }
        this.profile.petName = cleanName;
        this.syncXR();
        const statsSnap = {
          hunger: this.profile.stats.hunger,
          hygiene: this.profile.stats.hygiene,
          sleep: this.profile.stats.sleep,
          isSleeping: this.isSleeping,
        };
        pushNotificationService.updateAppBadgeAndTitle(cleanName, statsSnap);
        void pushNotificationService.syncCareSnapshotToServiceWorker(
          cleanName,
          statsSnap
        );
        void pushNotificationService.syncWithServer(
          cleanName,
          statsSnap,
          !document.hidden
        );
        await this.persistSettings();
        void this.syncRankingEntry();
        if (this.profile.soundEnabled) soundService.playCoin();
        this.showToast(`🐾 Nome salvo! Agora seu bichinho se chama ${cleanName}!`);
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
        if (key === 'easyReadMode') {
          setEasyReadEnabled(this.screenPrefs.easyReadMode);
        }
        this.saveScreenPrefs();
        this.render();
      });
    });

    this.root
      .querySelector('#btn-settings-replay-onboarding')
      ?.addEventListener('click', () => {
        const ownerId =
          this.firebaseUser?.uid || (this.isDemoSession ? 'demo' : 'guest');
        resetOnboarding(ownerId);
        this.onboardingActive = true;
        this.onboardingStep = 1;
        this.onboardingStep2Done = false;
        this.activeModal = 'none';
        hapticService.tap();
        this.render();
      });

    // Onboarding overlay events
    this.root
      .querySelector('#onboarding-name-form')
      ?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = this.root.querySelector(
          '#onboarding-pet-name-input'
        ) as HTMLInputElement | null;
        const cleanName = (input?.value || 'Miau')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 32);
        if (!cleanName) {
          this.showToast('Digite um nome válido para o seu bichinho!');
          input?.focus();
          return;
        }
        this.profile.petName = cleanName;
        this.syncXR();
        soundService.playCoin();
        hapticService.coin();
        void this.persistSettings();
        this.onboardingStep = 2;
        this.render();
      });

    this.root
      .querySelector('#btn-onboarding-pet')
      ?.addEventListener('click', () => {
        this.onboardingStep2Done = true;
        this.handlePetInteraction();
        this.render();
      });

    this.root
      .querySelector('#btn-onboarding-treat')
      ?.addEventListener('click', () => {
        this.onboardingStep2Done = true;
        this.handleQuickFeed();
        this.render();
      });

    this.root
      .querySelector('#btn-onboarding-next-2')
      ?.addEventListener('click', () => {
        hapticService.tap();
        this.onboardingStep = 3;
        this.render();
      });

    this.root
      .querySelector('#btn-onboarding-open-learn')
      ?.addEventListener('click', () => {
        const ownerId =
          this.firebaseUser?.uid || (this.isDemoSession ? 'demo' : 'guest');
        markOnboardingCompleted(ownerId);
        this.onboardingActive = false;
        this.learnPreviewLevel = null;
        this.resetAllLearnTracks();
        this.activeModal = 'learn';
        hapticService.tap();
        this.render();
      });

    const closeOnboarding = () => {
      const ownerId =
        this.firebaseUser?.uid || (this.isDemoSession ? 'demo' : 'guest');
      markOnboardingCompleted(ownerId);
      this.onboardingActive = false;
      hapticService.tap();
      this.render();
    };
    this.root
      .querySelector('#btn-onboarding-finish')
      ?.addEventListener('click', closeOnboarding);
    this.root
      .querySelector('#btn-onboarding-skip')
      ?.addEventListener('click', closeOnboarding);

    this.root
      .querySelector('#btn-preset-full')
      ?.addEventListener('click', () => {
        this.screenPrefs = {
          showStatusBars: true,
          showStatusBadges: true,
          showSpeechAndChat: true,
          showCoinsBadge: true,
          easyReadMode: this.screenPrefs.easyReadMode,
          collapseStatusPanel: false,
          collapseSpeechBox: false,
          collapseChatBox: false,
          collapseBottomNav: false,
        };
        this.saveScreenPrefs();
        this.render();
      });

    this.root
      .querySelector('#btn-preset-clean')
      ?.addEventListener('click', () => {
        this.screenPrefs = {
          showStatusBars: true,
          showStatusBadges: true,
          showSpeechAndChat: true,
          showCoinsBadge: true,
          easyReadMode: this.screenPrefs.easyReadMode,
          collapseStatusPanel: true,
          collapseSpeechBox: true,
          collapseChatBox: true,
          collapseBottomNav: true,
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
      .querySelector('#btn-toggle-push')
      ?.addEventListener('click', async () => {
        const ownerId =
          this.firebaseUser?.uid || (this.isDemoSession ? 'demo' : 'guest');
        const prefs = pushNotificationService.getPrefs(ownerId);
        if (prefs.enabled) {
          this.pushTestPreview = null;
          await pushNotificationService.disablePushNotifications(
            this.profile.petName,
            {
              hunger: this.profile.stats.hunger,
              hygiene: this.profile.stats.hygiene,
              sleep: this.profile.stats.sleep,
              isSleeping: this.isSleeping,
            }
          );
          this.showToast('Notificações de cuidado desativadas.');
          this.render();
        } else {
          await this.activatePushFromUI();
        }
      });

    this.root.querySelectorAll('[data-push-need]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const need = btn.getAttribute('data-push-need') as CareNeedKey | null;
        if (!need) return;
        const next = pushNotificationService.toggleNeedEnabled(
          need,
          this.profile.petName,
          {
            hunger: this.profile.stats.hunger,
            hygiene: this.profile.stats.hygiene,
            sleep: this.profile.stats.sleep,
            isSleeping: this.isSleeping,
          }
        );
        this.showToast(
          next
            ? 'Alerta ativado para essa necessidade!'
            : 'Alerta pausado para essa necessidade.'
        );
        this.render();
      });
    });

    this.root.querySelectorAll('[data-push-threshold]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = Number(btn.getAttribute('data-push-threshold'));
        if (!Number.isFinite(val)) return;
        pushNotificationService.updateThreshold(val, this.profile.petName, {
          hunger: this.profile.stats.hunger,
          hygiene: this.profile.stats.hygiene,
          sleep: this.profile.stats.sleep,
          isSleeping: this.isSleeping,
        });
        this.showToast(`Aviso ajustado para quando cair para ≤ ${val}%!`);
        this.render();
      });
    });

    this.root
      .querySelector('#btn-test-push')
      ?.addEventListener('click', async () => {
        if (this.profile.soundEnabled && soundService.enabled) {
          soundService.playMeow(1.12);
        }
        const result = await pushNotificationService.sendTestNotification(
          this.profile.petName
        );
        this.pushTestPreview =
          result.previewTitle && result.previewBody
            ? { title: result.previewTitle, body: result.previewBody }
            : null;
        this.showToast(result.message);
        this.render();
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
      soundService.stopLullaby();
      if (this.miauEffectTimer !== null) {
        clearTimeout(this.miauEffectTimer);
        this.miauEffectTimer = null;
      }
      this.activeMiauEffect = 'none';
      this.onboardingActive = false;
      this.activeRoom = 'living';
      miauSpeechService.cancel();
      this.profileModal.disposeCameraStream();
      this.liveSession?.stop();
      this.liveSession = null;
      this.previewEquipped = null;
      this.activeModal = 'none';
      this.isDemoSession = false;
      this.alertedLowNeeds.clear();
      this.lastNeedAlertAt = 0;
      this.humanProfile = createEmptyHumanProfile('guest');
      this.smartReviewState = null;
      this.parentalConfig = loadParentalControlConfig('guest');
      this.parentalDashboardState = createInitialParentalDashboardState();
      this.learnPreviewLevel = null;
      this.resetAllLearnTracks();
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
    this.resetAllLearnTracks();
    this.miniGameCleanup?.();
    this.miniGameCleanup = null;
    this.activeMiniGame = 'none';
    this.previewEquipped = null;
    this.activeModal = 'none';
    this.render();
  }
}
