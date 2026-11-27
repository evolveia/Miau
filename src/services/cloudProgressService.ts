import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getTodayDateKey } from '../constants';
import {
  loadConsonantsProgress,
  saveConsonantsProgress,
  type ConsonantsProgress,
} from '../modules/consonants/consonantsEngine';
import {
  loadEarlyLiteracyProgress,
  saveEarlyLiteracyProgress,
  type EarlyLiteracyProgress,
} from '../modules/learning/phonicsEngine';
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
import {
  loadThemedProgress,
  saveThemedProgress,
  type ThemedProgress,
} from '../modules/themed/themedEngine';
import type { ThemedModuleConfig } from '../modules/themed/types';
import {
  CONSONANTS_WRITING_CONFIG,
  VOWELS_WRITING_CONFIG,
  loadWritingProgress,
  saveWritingProgress,
  type WritingProgress,
  type WritingTrackConfig,
} from '../modules/writing/writingEngine';
import {
  registerCloudProgressListeners,
  type CloudSyncTrackId,
  type DailyEconomyPayload,
} from './cloudProgressHooks';
import {
  VALID_CLOUD_EDUCATION_TRACKS,
  mergeDailyEconomyPayloads,
  mergeEducationTrackSnapshots,
  normalizeDailyEconomyPayload,
  normalizeEducationTrackSnapshot,
  type CloudEducationTrackSnapshot,
} from './cloudProgressModel';
import {
  OperationType,
  auth,
  db,
  handleFirestoreError,
} from './firebaseService';

const ECONOMY_STORAGE_PREFIX = 'miau_coin_economy_v1_';

const THEMED_CONFIG_BY_TRACK: Partial<Record<CloudSyncTrackId, ThemedModuleConfig>> = {
  infantil_cores_numeros: CORES_FORMAS_CONFIG,
  infantil_soma_subtracao: ADICAO_SUBTRACAO_CONFIG,
  infantil_matematica_desafios: LOGICA_MATEMATICA_CONFIG,
  infantil_natureza: ANIMAIS_NATUREZA_CONFIG,
  infantil_comidas_bebidas: COMIDAS_BEBIDAS_CONFIG,
  fund1_leitura: FUND1_LEITURA_CONFIG,
  fund1_matematica: FUND1_MATEMATICA_CONFIG,
  fund1_ciencias: FUND1_CIENCIAS_CONFIG,
  fund2_logica: FUND2_LOGICA_CONFIG,
  fund2_ciencias: FUND2_CIENCIAS_CONFIG,
  fund2_historia: FUND2_HISTORIA_CONFIG,
};

const trackDebounceTimers = new Map<string, number>();
let economyDebounceTimer: number | null = null;
let initializedListeners = false;
let isHydrating = false;

function isAuthenticatedVerifiedOwner(ownerId: string): boolean {
  const user = auth.currentUser;
  return Boolean(user && user.uid === ownerId && user.emailVerified);
}

function readLocalTrackSnapshot(
  ownerId: string,
  trackId: CloudSyncTrackId
): CloudEducationTrackSnapshot {
  if (trackId === 'infantil_letras') {
    return normalizeEducationTrackSnapshot(
      ownerId,
      trackId,
      loadEarlyLiteracyProgress(ownerId)
    );
  }
  if (trackId === 'infantil_escrita') {
    return normalizeEducationTrackSnapshot(
      ownerId,
      trackId,
      loadWritingProgress(ownerId, VOWELS_WRITING_CONFIG)
    );
  }
  if (trackId === 'infantil_escrita_consoantes') {
    return normalizeEducationTrackSnapshot(
      ownerId,
      trackId,
      loadWritingProgress(ownerId, CONSONANTS_WRITING_CONFIG)
    );
  }
  if (trackId === 'infantil_consoantes') {
    return normalizeEducationTrackSnapshot(
      ownerId,
      trackId,
      loadConsonantsProgress(ownerId)
    );
  }
  const themedCfg = THEMED_CONFIG_BY_TRACK[trackId];
  if (themedCfg) {
    return normalizeEducationTrackSnapshot(
      ownerId,
      trackId,
      loadThemedProgress(themedCfg, ownerId)
    );
  }
  return normalizeEducationTrackSnapshot(ownerId, trackId, {});
}

function applyMergedSnapshotToLocal(
  ownerId: string,
  snapshot: CloudEducationTrackSnapshot
): void {
  if (snapshot.trackId === 'infantil_letras') {
    const base = loadEarlyLiteracyProgress(ownerId);
    const updated: EarlyLiteracyProgress = {
      ...base,
      ownerId,
      completedUnits: snapshot.completedUnits,
      unitBestStars: snapshot.unitBestStars,
      totalStars: snapshot.totalStars,
      streakDays: snapshot.streakDays,
      lastStudyDateKey: snapshot.lastStudyDateKey,
      masteredVowels: snapshot.masteredPrimary as EarlyLiteracyProgress['masteredVowels'],
      masteredTargets: snapshot.masteredTargets,
      unlockedStickers: snapshot.unlockedStickers,
      freeExploreUnlocked: snapshot.freeExploreUnlocked,
      totalLessonsCompleted: snapshot.totalLessonsCompleted,
    };
    saveEarlyLiteracyProgress(updated);
    return;
  }

  if (
    snapshot.trackId === 'infantil_escrita' ||
    snapshot.trackId === 'infantil_escrita_consoantes'
  ) {
    const cfg: WritingTrackConfig =
      snapshot.trackId === 'infantil_escrita'
        ? VOWELS_WRITING_CONFIG
        : CONSONANTS_WRITING_CONFIG;
    const base = loadWritingProgress(ownerId, cfg);
    const updated: WritingProgress = {
      ...base,
      ownerId,
      completedUnits: snapshot.completedUnits,
      unitBestStars: snapshot.unitBestStars,
      letterBestStars: snapshot.letterBestStars,
      totalStars: snapshot.totalStars,
      streakDays: snapshot.streakDays,
      bestStreakDays: snapshot.bestStreakDays,
      lastStudyDateKey: snapshot.lastStudyDateKey,
      masteredVowels:
        cfg.kind === 'vowels'
          ? (snapshot.masteredPrimary as WritingProgress['masteredVowels'])
          : base.masteredVowels,
      masteredConsonants:
        cfg.kind === 'consonants'
          ? snapshot.masteredPrimary
          : base.masteredConsonants,
      masteredTargets: snapshot.masteredTargets,
      unlockedMedals: snapshot.unlockedStickers,
      freeExploreUnlocked: snapshot.freeExploreUnlocked,
      totalPracticesCompleted: snapshot.totalLessonsCompleted,
      dailyDateKey: snapshot.dailyDateKey || base.dailyDateKey,
      dailyStepsCount: snapshot.dailyStepsCount,
      dailyCompletedTargets: snapshot.dailyCompletedTargets,
      dailyBonusClaimedDateKey: snapshot.dailyBonusClaimedDateKey,
    };
    saveWritingProgress(updated, cfg);
    return;
  }

  if (snapshot.trackId === 'infantil_consoantes') {
    const base = loadConsonantsProgress(ownerId);
    const updated: ConsonantsProgress = {
      ...base,
      ownerId,
      completedUnits: snapshot.completedUnits,
      unitBestStars: snapshot.unitBestStars,
      totalStars: snapshot.totalStars,
      streakDays: snapshot.streakDays,
      lastStudyDateKey: snapshot.lastStudyDateKey,
      masteredConsonants:
        snapshot.masteredPrimary as ConsonantsProgress['masteredConsonants'],
      masteredTargets: snapshot.masteredTargets,
      unlockedStickers: snapshot.unlockedStickers,
      freeExploreUnlocked: snapshot.freeExploreUnlocked,
      totalLessonsCompleted: snapshot.totalLessonsCompleted,
    };
    saveConsonantsProgress(updated);
    return;
  }

  const themedCfg = THEMED_CONFIG_BY_TRACK[snapshot.trackId];
  if (themedCfg) {
    const base = loadThemedProgress(themedCfg, ownerId);
    const updated: ThemedProgress = {
      ...base,
      ownerId,
      completedUnits: snapshot.completedUnits,
      unitBestStars: snapshot.unitBestStars,
      totalStars: snapshot.totalStars,
      streakDays: snapshot.streakDays,
      lastStudyDateKey: snapshot.lastStudyDateKey,
      masteredTags: snapshot.masteredPrimary,
      masteredTargets: snapshot.masteredTargets,
      unlockedStickers: snapshot.unlockedStickers,
      freeExploreUnlocked: snapshot.freeExploreUnlocked,
      totalLessonsCompleted: snapshot.totalLessonsCompleted,
    };
    saveThemedProgress(themedCfg, updated);
  }
}

async function writeEducationTrackToFirestore(
  uid: string,
  snapshot: CloudEducationTrackSnapshot
): Promise<void> {
  if (!isAuthenticatedVerifiedOwner(uid)) return;
  const path = `users/${uid}/educationProgress/${snapshot.trackId}`;
  const ref = doc(db, 'users', uid, 'educationProgress', snapshot.trackId);

  let exists = false;
  try {
    const snap = await getDoc(ref);
    exists = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  const payload = {
    ownerId: uid,
    trackId: snapshot.trackId,
    completedUnits: snapshot.completedUnits,
    unitBestStars: snapshot.unitBestStars,
    letterBestStars: snapshot.letterBestStars,
    totalStars: snapshot.totalStars,
    streakDays: snapshot.streakDays,
    bestStreakDays: snapshot.bestStreakDays,
    lastStudyDateKey: snapshot.lastStudyDateKey,
    masteredPrimary: snapshot.masteredPrimary,
    masteredTargets: snapshot.masteredTargets,
    unlockedStickers: snapshot.unlockedStickers,
    freeExploreUnlocked: snapshot.freeExploreUnlocked,
    totalLessonsCompleted: snapshot.totalLessonsCompleted,
    dailyDateKey: snapshot.dailyDateKey,
    dailyStepsCount: snapshot.dailyStepsCount,
    dailyCompletedTargets: snapshot.dailyCompletedTargets,
    dailyBonusClaimedDateKey: snapshot.dailyBonusClaimedDateKey,
  };

  if (!exists) {
    try {
      await setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  } else {
    try {
      await updateDoc(ref, {
        completedUnits: payload.completedUnits,
        unitBestStars: payload.unitBestStars,
        letterBestStars: payload.letterBestStars,
        totalStars: payload.totalStars,
        streakDays: payload.streakDays,
        bestStreakDays: payload.bestStreakDays,
        lastStudyDateKey: payload.lastStudyDateKey,
        masteredPrimary: payload.masteredPrimary,
        masteredTargets: payload.masteredTargets,
        unlockedStickers: payload.unlockedStickers,
        freeExploreUnlocked: payload.freeExploreUnlocked,
        totalLessonsCompleted: payload.totalLessonsCompleted,
        dailyDateKey: payload.dailyDateKey,
        dailyStepsCount: payload.dailyStepsCount,
        dailyCompletedTargets: payload.dailyCompletedTargets,
        dailyBonusClaimedDateKey: payload.dailyBonusClaimedDateKey,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}

async function writeDailyEconomyToFirestore(
  uid: string,
  state: DailyEconomyPayload
): Promise<void> {
  if (!isAuthenticatedVerifiedOwner(uid)) return;
  const path = `users/${uid}/economy/daily`;
  const ref = doc(db, 'users', uid, 'economy', 'daily');

  let exists = false;
  try {
    const snap = await getDoc(ref);
    exists = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  const normalized = normalizeDailyEconomyPayload(state, getTodayDateKey());
  if (!exists) {
    try {
      await setDoc(ref, {
        ownerId: uid,
        ...normalized,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  } else {
    try {
      await updateDoc(ref, {
        ...normalized,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}

function scheduleEducationTrackSync(
  ownerId: string,
  trackId: CloudSyncTrackId,
  rawProgress: unknown
): void {
  if (isHydrating || !isAuthenticatedVerifiedOwner(ownerId)) return;
  const key = `${ownerId}:${trackId}`;
  const prev = trackDebounceTimers.get(key);
  if (prev) window.clearTimeout(prev);

  const timer = window.setTimeout(() => {
    trackDebounceTimers.delete(key);
    const snapshot = normalizeEducationTrackSnapshot(ownerId, trackId, rawProgress);
    void writeEducationTrackToFirestore(ownerId, snapshot).catch((err) => {
      console.warn(`Falha ao sincronizar trilha ${trackId} na nuvem:`, err);
    });
  }, 650);

  trackDebounceTimers.set(key, timer);
}

function scheduleDailyEconomySync(
  ownerId: string,
  state: DailyEconomyPayload
): void {
  if (isHydrating || !isAuthenticatedVerifiedOwner(ownerId)) return;
  if (economyDebounceTimer) window.clearTimeout(economyDebounceTimer);
  economyDebounceTimer = window.setTimeout(() => {
    economyDebounceTimer = null;
    void writeDailyEconomyToFirestore(ownerId, state).catch((err) => {
      console.warn('Falha ao sincronizar economia diária na nuvem:', err);
    });
  }, 400);
}

export function initCloudProgressSyncListeners(): void {
  if (initializedListeners) return;
  initializedListeners = true;
  registerCloudProgressListeners({
    onEducationSaved: (ownerId, trackId, rawProgress) => {
      scheduleEducationTrackSync(ownerId, trackId, rawProgress);
    },
    onEconomySaved: (ownerId, state) => {
      scheduleDailyEconomySync(ownerId, state);
    },
  });
}

function snapshotsEqual(
  a: CloudEducationTrackSnapshot,
  b: CloudEducationTrackSnapshot
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export async function hydrateUserCloudProgress(uid: string): Promise<void> {
  initCloudProgressSyncListeners();
  if (!isAuthenticatedVerifiedOwner(uid)) return;

  const today = getTodayDateKey();
  const eduColPath = `users/${uid}/educationProgress`;

  isHydrating = true;
  try {
    const remoteTracks = new Map<CloudSyncTrackId, CloudEducationTrackSnapshot>();
    try {
      const q = query(
        collection(db, 'users', uid, 'educationProgress'),
        where('ownerId', '==', uid)
      );
      const snap = await getDocs(q);
      snap.forEach((docSnap) => {
        const trackId = docSnap.id as CloudSyncTrackId;
        if (!VALID_CLOUD_EDUCATION_TRACKS.includes(trackId)) return;
        remoteTracks.set(
          trackId,
          normalizeEducationTrackSnapshot(uid, trackId, docSnap.data())
        );
      });
    } catch (error) {
      console.warn('Aviso ao carregar trilhas educativas na nuvem:', eduColPath, error);
    }

    for (const trackId of VALID_CLOUD_EDUCATION_TRACKS) {
      const localSnap = readLocalTrackSnapshot(uid, trackId);
      const remoteSnap = remoteTracks.get(trackId);
      const hasLocalData =
        localSnap.completedUnits.length > 0 ||
        localSnap.totalLessonsCompleted > 0 ||
        localSnap.totalStars > 0 ||
        localSnap.masteredTargets.length > 0;

      if (remoteSnap) {
        const merged = mergeEducationTrackSnapshots(localSnap, remoteSnap, today);
        if (!snapshotsEqual(merged, localSnap)) {
          applyMergedSnapshotToLocal(uid, merged);
        }
        if (!snapshotsEqual(merged, remoteSnap)) {
          void writeEducationTrackToFirestore(uid, merged).catch(() => {});
        }
      } else if (hasLocalData) {
        void writeEducationTrackToFirestore(uid, localSnap).catch(() => {});
      }
    }

    // Hydrate daily coin economy
    try {
      const econRef = doc(db, 'users', uid, 'economy', 'daily');
      const econSnap = await getDoc(econRef);
      const rawLocal = localStorage.getItem(`${ECONOMY_STORAGE_PREFIX}${uid}`);
      const localEcon = normalizeDailyEconomyPayload(
        rawLocal ? JSON.parse(rawLocal) : {},
        today
      );
      if (econSnap.exists()) {
        const remoteEcon = normalizeDailyEconomyPayload(econSnap.data(), today);
        const mergedEcon = mergeDailyEconomyPayloads(localEcon, remoteEcon, today);
        localStorage.setItem(
          `${ECONOMY_STORAGE_PREFIX}${uid}`,
          JSON.stringify(mergedEcon)
        );
        if (JSON.stringify(mergedEcon) !== JSON.stringify(remoteEcon)) {
          void writeDailyEconomyToFirestore(uid, mergedEcon).catch(() => {});
        }
      } else if (
        localEcon.dateKey === today &&
        (localEcon.petCoinsToday > 0 ||
          localEcon.ballCoinsToday > 0 ||
          localEcon.minigameCoinsToday > 0)
      ) {
        void writeDailyEconomyToFirestore(uid, localEcon).catch(() => {});
      }
    } catch (error) {
      console.warn('Aviso ao sincronizar economia diária na nuvem:', error);
    }
  } finally {
    isHydrating = false;
  }
}
