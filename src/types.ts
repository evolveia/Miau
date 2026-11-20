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
  | 'menu'
  | 'support'
  | 'ar'
  | 'settings'
  | 'legal';

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

export interface FoodItem {
  id: string;
  name: string;
  emoji: string;
  hungerBoost: number;
  funBoost: number;
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
