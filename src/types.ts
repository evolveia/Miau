export type MiauMood =
  | 'happy'
  | 'playful'
  | 'hungry'
  | 'sleepy'
  | 'affectionate'
  | 'eating'
  | 'bathing';

export type AppScreen = 'preloader' | 'login' | 'game';

export type ActiveModal =
  | 'none'
  | 'feed'
  | 'clean'
  | 'games'
  | 'customize'
  | 'chat'
  | 'achievements'
  | 'ranking'
  | 'routine'
  | 'menu'
  | 'profile'
  | 'learn'
  | 'support'
  | 'ar'
  | 'settings'
  | 'legal';

export type SchoolingLevel =
  | 'educacao_infantil'
  | 'fundamental_1'
  | 'fundamental_2'
  | 'medio'
  | 'superior_outro';

export interface UserHumanProfile {
  ownerId: string;
  fullName: string;
  birthDate: string;
  schooling: SchoolingLevel | '';
  state: string;
  country: string;
  photoDataUrl: string;
  updatedAtMs: number;
}

export interface EducationTrackDef {
  id: string;
  title: string;
  description: string;
  emoji: string;
  tags: string[];
  accentBg: string;
  statusLabel: string;
}

export type GameId = 'fish' | 'memory' | 'escape' | 'galaxy';

export interface GameStatsRecord {
  highScore: number;
  maxStage: number;
  bestTimeSec: number;
  totalCoins: number;
  plays: number;
}

export interface GameMatchHistoryItem {
  id: string;
  gameId: GameId;
  gameName: string;
  score: number;
  stageReached: number;
  durationSec: number;
  coinsEarned: number;
  performanceTier: 'bronze' | 'silver' | 'gold';
  playedAtMs: number;
}

export interface RankingEntry {
  id: string;
  playerName: string;
  petName: string;
  totalScore: number;
  bestStage: number;
  coinsEarned: number;
  gameScores?: Partial<Record<GameId, number>>;
  gameStages?: Partial<Record<GameId, number>>;
  isCurrentUser?: boolean;
  updatedAtMs: number;
}

export type RoutineCategory = 'food' | 'bath' | 'sleep';

export interface RoutineSlotDef {
  id: string;
  category: RoutineCategory;
  label: string;
  timeLabel: string;
  targetHour: number;
  targetMinute: number;
  windowMinutes: number;
  bonusCoins: number;
  bonusXp: number;
  emoji: string;
}

export interface DailyRoutineState {
  dateKey: string;
  completedSlots: string[];
}

export interface ScreenVisibilityPrefs {
  showStatusBars: boolean;
  showStatusBadges: boolean;
  showSpeechAndChat: boolean;
  showCoinsBadge: boolean;
}

export interface PetStats {
  hunger: number;
  hygiene: number;
  fun: number;
  sleep: number;
  happiness: number;
}

export interface EquippedItems {
  hat: string;
  accessory: string;
  background: string;
}

export interface AchievementProgress {
  mealsFed: number;
  gamesPlayed: number;
  cleanCount: number;
  petsCount: number;
  chatsCount: number;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  emoji: string;
  coinReward: number;
  target: number;
  progressKey: keyof AchievementProgress | 'shopBought';
}

export interface UserPetProfile {
  ownerId: string;
  petName: string;
  coins: number;
  level: number;
  xp: number;
  stats: PetStats;
  equipped: EquippedItems;
  ownedItems: string[];
  soundEnabled: boolean;
  unlockedAchievements: string[];
  progress: AchievementProgress;
  gameRecords?: Record<GameId, GameStatsRecord>;
  dailyRoutine?: DailyRoutineState;
}

export interface ChatMessage {
  id: string;
  ownerId: string;
  sender: 'user' | 'miau';
  meowPrefix: string;
  text: string;
  mood: MiauMood;
  createdAtMs: number;
}

export interface ChatTemporalContext {
  weekdayIndex: number;
  weekdayName: string;
  isWeekend: boolean;
  periodOfDay: 'madrugada' | 'manhã' | 'tarde' | 'noite';
  timeStr: string;
  dateKey: string;
}

export interface ChatUserContext {
  firstName: string;
  age: number | null;
  schooling: SchoolingLevel | '';
  schoolingLabel: string;
}

export interface FoodItem {
  id: string;
  name: string;
  emoji: string;
  hungerBoost: number;
  funBoost: number;
  happinessBoost?: number;
  cost: number;
  xpReward: number;
  description: string;
}

export interface ShopItem {
  id: string;
  category: 'hat' | 'accessory' | 'background';
  name: string;
  emoji: string;
  price: number;
  previewColor: string;
}
