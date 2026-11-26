export type ThemedExerciseType =
  | 'listen_pick'
  | 'sound_to_badge'
  | 'complete_word'
  | 'rhyme_fun'
  | 'speak_repeat';

export type ThemedChallengeDifficulty = 1 | 2 | 3;

export interface ThemedOptionCard {
  id: string;
  label: string;
  sublabel?: string;
  emoji: string;
  visualAssetUrl?: string;
  highlightPrefix?: string;
  accentClass?: string;
}

export interface ThemedChallenge {
  id: string;
  unitId: string;
  type: ThemedExerciseType;
  challengeLevel: ThemedChallengeDifficulty;
  targetKey: string;
  masteryTag: string;
  keywords: string[];
  badgeLabel: string;
  instruction: string;
  audioNormalText: string;
  audioSlowText: string;
  visualAssetUrl: string;
  hintText: string;
  hintAudioText: string;
  praiseText: string;
  anchorCard?: {
    emoji: string;
    word: string;
    verseHtml?: string;
    showVisualImage?: boolean;
  };
  options?: ThemedOptionCard[];
  correctOptionId?: string;
  choiceBadges?: string[];
  correctBadge?: string;
  wordSegments?: Array<string | null>;
  missingSlotIndex?: number;
  missingAnswer?: string;
  letterBank?: string[];
  speakTargetText?: string;
  speakAcceptedVariants?: string[];
  speakVisualEmoji?: string;
  speakVisualLabel?: string;
}

export interface ThemedSticker {
  id: string;
  title: string;
  emoji: string;
  description: string;
  colorClass: string;
  visualAssetUrl: string;
}

export interface ThemedUnitDef {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  themeLabel: string;
  emoji: string;
  focusTags: string[];
  keywords: string[];
  challengeLevel: ThemedChallengeDifficulty;
  visualAssetUrl: string;
  accentGradient: string;
  coinReward: number;
  xpReward: number;
  sticker: ThemedSticker;
  challenges: ThemedChallenge[];
}

export interface ThemedMasteryBadgeDef {
  id: string;
  label: string;
  emoji?: string;
  swatchHex?: string;
}

export interface ThemedModuleConfig {
  trackId:
    | 'infantil_cores_numeros'
    | 'infantil_soma_subtracao'
    | 'infantil_matematica_desafios'
    | 'infantil_natureza'
    | 'infantil_comidas_bebidas';
  storagePrefix: string;
  domPrefix: string;
  headerTitle: string;
  headerSubtitle: string;
  loadingTitle: string;
  loadingSubtitle: string;
  trailSectionTitle: string;
  masterySectionTitle: string;
  stickerShelfTitle: string;
  reviewSubtitle: string;
  completionUnitVerb: string;
  accentBarGradient: string;
  masteryItems: ThemedMasteryBadgeDef[];
  units: ThemedUnitDef[];
}
