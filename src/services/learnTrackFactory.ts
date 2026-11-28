import { ConsonantsModuleController } from '../modules/consonants/ConsonantsModule';
import { ADICAO_SUBTRACAO_CONFIG } from '../modules/themed/adicaoSubtracaoData';
import { ANIMAIS_NATUREZA_CONFIG } from '../modules/themed/animaisNaturezaData';
import { COMIDAS_BEBIDAS_CONFIG } from '../modules/themed/comidasBebidasData';
import { CORES_FORMAS_CONFIG } from '../modules/themed/coresFormasData';
import { FUND1_CIENCIAS_CONFIG } from '../modules/themed/fund1CienciasData';
import { FUND1_LEITURA_CONFIG } from '../modules/themed/fund1LeituraData';
import { FUND1_MATEMATICA_CONFIG } from '../modules/themed/fund1MatematicaData';
import { FUND2_CIENCIAS_CONFIG } from '../modules/themed/fund2CienciasData';
import { FUND2_HISTORIA_CONFIG } from '../modules/themed/fund2HistoriaData';
import { FUND2_LOGICA_CONFIG } from '../modules/themed/fund2LogicaData';
import { LOGICA_MATEMATICA_CONFIG } from '../modules/themed/logicaMatematicaData';
import { ThemedLearningModuleController } from '../modules/themed/ThemedLearningModule';
import type { ThemedModuleConfig } from '../modules/themed/types';
import { WritingModuleController } from '../modules/writing/WritingModule';
import { CONSONANTS_WRITING_CONFIG } from '../modules/writing/writingEngine';
import type { ActiveLearnTrack, EquippedItems, UserHumanProfile } from '../types';
import { EarlyLiteracyController } from '../ui/modals/EarlyLiteracyView';

export type ConcreteLearnTrackId = Exclude<ActiveLearnTrack, 'none'>;

export interface LearnTrackControllerBase {
  render: () => string;
  bind: (root: HTMLElement) => void;
  resetToTrail: () => void;
}

export interface LearnTrackFactoryDeps {
  getOwnerId: () => string;
  getHumanProfile: () => UserHumanProfile;
  getEquipped: () => EquippedItems;
  isSoundEnabled: () => boolean;
  onToggleSoundMute: () => boolean;
  onGrantRewards: (coinsDelta: number, xpDelta: number) => void;
  onLessonCompleted?: (info: {
    trackId: string;
    unitId: string | null;
    stars: number;
  }) => void;
  onExitToLearnHub: () => void;
  onExitToMainMenu: () => void;
  onRequestTrackRerender: (trackId: ConcreteLearnTrackId) => void;
  onToast: (msg: string) => void;
}

export interface LearnTrackControllers {
  hasTrack: (trackId: string) => trackId is ConcreteLearnTrackId;
  renderTrack: (trackId: ConcreteLearnTrackId) => string;
  bindTrack: (trackId: ConcreteLearnTrackId, root: HTMLElement) => void;
  resetTrack: (trackId: ConcreteLearnTrackId) => void;
  resetAll: () => void;
}

export function createLearnTrackControllers(
  deps: LearnTrackFactoryDeps
): LearnTrackControllers {
  const buildAdapter = (trackId: ConcreteLearnTrackId) => ({
    getOwnerId: deps.getOwnerId,
    getHumanProfile: deps.getHumanProfile,
    getEquipped: deps.getEquipped,
    isSoundEnabled: deps.isSoundEnabled,
    onToggleSoundMute: deps.onToggleSoundMute,
    onGrantRewards: deps.onGrantRewards,
    onLessonCompleted: deps.onLessonCompleted,
    onExitToLearnHub: deps.onExitToLearnHub,
    onExitToMainMenu: deps.onExitToMainMenu,
    onRequestRerender: () => deps.onRequestTrackRerender(trackId),
    onToast: deps.onToast,
  });

  const makeThemed = (config: ThemedModuleConfig) =>
    new ThemedLearningModuleController(config, buildAdapter(config.trackId));

  const registry: Record<ConcreteLearnTrackId, LearnTrackControllerBase> = {
    infantil_letras: new EarlyLiteracyController(
      buildAdapter('infantil_letras')
    ),
    infantil_escrita: new WritingModuleController(
      buildAdapter('infantil_escrita')
    ),
    infantil_escrita_consoantes: new WritingModuleController(
      buildAdapter('infantil_escrita_consoantes'),
      CONSONANTS_WRITING_CONFIG
    ),
    infantil_consoantes: new ConsonantsModuleController(
      buildAdapter('infantil_consoantes')
    ),
    infantil_cores_numeros: makeThemed(CORES_FORMAS_CONFIG),
    infantil_soma_subtracao: makeThemed(ADICAO_SUBTRACAO_CONFIG),
    infantil_matematica_desafios: makeThemed(LOGICA_MATEMATICA_CONFIG),
    infantil_natureza: makeThemed(ANIMAIS_NATUREZA_CONFIG),
    infantil_comidas_bebidas: makeThemed(COMIDAS_BEBIDAS_CONFIG),
    fund1_leitura: makeThemed(FUND1_LEITURA_CONFIG),
    fund1_matematica: makeThemed(FUND1_MATEMATICA_CONFIG),
    fund1_ciencias: makeThemed(FUND1_CIENCIAS_CONFIG),
    fund2_logica: makeThemed(FUND2_LOGICA_CONFIG),
    fund2_ciencias: makeThemed(FUND2_CIENCIAS_CONFIG),
    fund2_historia: makeThemed(FUND2_HISTORIA_CONFIG),
  };

  const hasTrack = (trackId: string): trackId is ConcreteLearnTrackId =>
    Object.prototype.hasOwnProperty.call(registry, trackId);

  return {
    hasTrack,
    renderTrack: (trackId) => registry[trackId].render(),
    bindTrack: (trackId, root) => registry[trackId].bind(root),
    resetTrack: (trackId) => registry[trackId].resetToTrail(),
    resetAll: () => {
      (Object.values(registry) as LearnTrackControllerBase[]).forEach((ctrl) =>
        ctrl.resetToTrail()
      );
    },
  };
}
