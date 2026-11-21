import type { GameId } from '../types';

export interface MiniGameResult {
  gameId: GameId;
  gameName: string;
  score: number;
  stageReached: number;
  durationSec: number;
  coinsEarned: number;
  funBoost: number;
  xpEarned: number;
  performanceTier: 'gold' | 'silver' | 'bronze';
  summaryText: string;
}

export { mountEscapeRunGame } from './EscapeRunGame';
export { mountGalaxyRatGame } from './GalaxyRatGame';
export { mountFishCatchGame } from './games/FishCatchGame';
export { mountMemoryGame } from './games/MemoryMeowGame';
