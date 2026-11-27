export type CloudSyncTrackId =
  | 'infantil_letras'
  | 'infantil_escrita'
  | 'infantil_escrita_consoantes'
  | 'infantil_consoantes'
  | 'infantil_cores_numeros'
  | 'infantil_soma_subtracao'
  | 'infantil_matematica_desafios'
  | 'infantil_natureza'
  | 'infantil_comidas_bebidas'
  | 'fund1_leitura'
  | 'fund1_matematica'
  | 'fund1_ciencias'
  | 'fund2_logica'
  | 'fund2_ciencias'
  | 'fund2_historia';

export interface DailyEconomyPayload {
  dateKey: string;
  petCoinsToday: number;
  lastPetCoinAtMs: number;
  ballCoinsToday: number;
  lastBallCoinAtMs: number;
  minigameCoinsToday: number;
}

type EducationSavedListener = (
  ownerId: string,
  trackId: CloudSyncTrackId,
  rawProgress: unknown
) => void;

type EconomySavedListener = (
  ownerId: string,
  state: DailyEconomyPayload
) => void;

let onEducationSaved: EducationSavedListener | null = null;
let onEconomySaved: EconomySavedListener | null = null;

export function registerCloudProgressListeners(listeners: {
  onEducationSaved?: EducationSavedListener;
  onEconomySaved?: EconomySavedListener;
}): void {
  if (listeners.onEducationSaved) {
    onEducationSaved = listeners.onEducationSaved;
  }
  if (listeners.onEconomySaved) {
    onEconomySaved = listeners.onEconomySaved;
  }
}

export function notifyEducationProgressSaved(
  ownerId: string,
  trackId: CloudSyncTrackId,
  rawProgress: unknown
): void {
  onEducationSaved?.(ownerId, trackId, rawProgress);
}

export function notifyDailyEconomySaved(
  ownerId: string,
  state: DailyEconomyPayload
): void {
  onEconomySaved?.(ownerId, state);
}
