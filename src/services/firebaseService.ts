import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  User,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  INITIAL_GREETING,
  createDefaultGameRecords,
  createDefaultProfile,
  getTodayDateKey,
} from '../constants';
import type {
  ChatMessage,
  DailyRoutineState,
  GameId,
  GameStatsRecord,
  MiauMood,
  RankingEntry,
  SchoolingLevel,
  UserHumanProfile,
  UserPetProfile,
} from '../types';
import { sanitizeImageDataUrl } from '../utils/html';
import {
  normalizeParentalControlConfig,
  type ParentalControlConfig,
} from './parentalControlService';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Verifique sua configuração do Firebase (cliente offline).');
    }
  }
}
void testConnection();

export function subscribeAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function registerWithEmail(
  email: string,
  password: string
): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

function safeInt(
  value: unknown,
  min: number,
  max: number,
  fallback = min
): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

function sanitizeStringList(
  raw: unknown,
  maxItems: number,
  maxLen: number
): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && item.length > 0) {
      out.push(item.slice(0, maxLen));
      if (out.length >= maxItems) break;
    }
  }
  return out;
}

function sanitizeGameStat(raw?: Partial<GameStatsRecord>): GameStatsRecord {
  return {
    highScore: safeInt(raw?.highScore, 0, 10000000, 0),
    maxStage: safeInt(raw?.maxStage, 1, 999, 1),
    bestTimeSec: safeInt(raw?.bestTimeSec, 0, 86400, 0),
    totalCoins: safeInt(raw?.totalCoins, 0, 10000000, 0),
    plays: safeInt(raw?.plays, 0, 1000000, 0),
  };
}

function sanitizeGameRecords(
  raw?: Partial<Record<GameId, Partial<GameStatsRecord>>>
): Record<GameId, GameStatsRecord> {
  const defaults = createDefaultGameRecords();
  return {
    fish: sanitizeGameStat(raw?.fish || defaults.fish),
    memory: sanitizeGameStat(raw?.memory || defaults.memory),
    escape: sanitizeGameStat(raw?.escape || defaults.escape),
    galaxy: sanitizeGameStat(raw?.galaxy || defaults.galaxy),
    pacmiau: sanitizeGameStat(raw?.pacmiau || defaults.pacmiau),
    maze: sanitizeGameStat(raw?.maze || defaults.maze),
  };
}

function sanitizeDailyRoutine(raw?: Partial<DailyRoutineState>): DailyRoutineState {
  const today = getTodayDateKey();
  const dateKey =
    typeof raw?.dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.dateKey)
      ? raw.dateKey
      : today;
  if (dateKey !== today) {
    return { dateKey: today, completedSlots: [] };
  }
  const completedSlots = Array.isArray(raw?.completedSlots)
    ? Array.from(
        new Set(
          raw.completedSlots
            .filter((s): s is string => typeof s === 'string' && s.length > 0)
            .map((s) => s.slice(0, 40))
        )
      ).slice(0, 20)
    : [];
  return { dateKey, completedSlots };
}

function sanitizeProfile(
  profile: Partial<UserPetProfile>,
  fallbackOwnerId = 'guest'
): UserPetProfile {
  const progress = profile.progress ?? {
    mealsFed: 0,
    gamesPlayed: 0,
    cleanCount: 0,
    petsCount: 0,
    chatsCount: 0,
  };
  const owned = sanitizeStringList(profile.ownedItems, 50, 64);
  if (owned.length === 0) {
    owned.push('hat_none', 'acc_none', 'bg_lilac', 'bg_sunny');
  } else if (!owned.includes('bg_sunny') && owned.length < 50) {
    owned.push('bg_sunny');
  }
  const petName =
    typeof profile.petName === 'string' && profile.petName.trim().length > 0
      ? profile.petName.trim().slice(0, 32)
      : 'Miau';

  return {
    ownerId:
      typeof profile.ownerId === 'string' && profile.ownerId.length > 0
        ? profile.ownerId.slice(0, 128)
        : fallbackOwnerId,
    petName,
    coins: safeInt(profile.coins, 0, 10000000, 0),
    level: safeInt(profile.level, 1, 999, 1),
    xp: safeInt(profile.xp, 0, 100000, 0),
    stats: {
      hunger: safeInt(profile.stats?.hunger, 0, 100, 60),
      hygiene: safeInt(profile.stats?.hygiene, 0, 100, 90),
      fun: safeInt(profile.stats?.fun, 0, 100, 50),
      sleep: safeInt(profile.stats?.sleep, 0, 100, 70),
      happiness: safeInt(profile.stats?.happiness, 0, 100, 75),
    },
    equipped: {
      hat:
        typeof profile.equipped?.hat === 'string' && profile.equipped.hat.length > 0
          ? profile.equipped.hat.slice(0, 64)
          : 'hat_party',
      accessory:
        typeof profile.equipped?.accessory === 'string' &&
        profile.equipped.accessory.length > 0
          ? profile.equipped.accessory.slice(0, 64)
          : 'acc_bowtie',
      background:
        typeof profile.equipped?.background === 'string' &&
        profile.equipped.background.length > 0
          ? profile.equipped.background.slice(0, 64)
          : 'bg_lilac',
    },
    ownedItems: owned.slice(0, 50),
    soundEnabled:
      typeof profile.soundEnabled === 'boolean' ? profile.soundEnabled : true,
    unlockedAchievements: sanitizeStringList(
      profile.unlockedAchievements,
      50,
      64
    ),
    progress: {
      mealsFed: safeInt(progress.mealsFed, 0, 1000000, 0),
      gamesPlayed: safeInt(progress.gamesPlayed, 0, 1000000, 0),
      cleanCount: safeInt(progress.cleanCount, 0, 1000000, 0),
      petsCount: safeInt(progress.petsCount, 0, 1000000, 0),
      chatsCount: safeInt(progress.chatsCount, 0, 1000000, 0),
    },
    gameRecords: sanitizeGameRecords(profile.gameRecords),
    dailyRoutine: sanitizeDailyRoutine(profile.dailyRoutine),
  };
}

const ALLOWED_USER_DOC_KEYS = new Set([
  'ownerId',
  'petName',
  'coins',
  'level',
  'xp',
  'stats',
  'equipped',
  'ownedItems',
  'soundEnabled',
  'unlockedAchievements',
  'progress',
  'gameRecords',
  'dailyRoutine',
  'createdAt',
  'updatedAt',
]);

const REQUIRED_USER_DOC_KEYS = [
  'ownerId',
  'petName',
  'coins',
  'level',
  'xp',
  'stats',
  'equipped',
  'ownedItems',
  'soundEnabled',
  'createdAt',
  'updatedAt',
];

function isFirestoreTimestamp(val: unknown): boolean {
  return (
    typeof val === 'object' &&
    val !== null &&
    typeof (val as { toMillis?: unknown }).toMillis === 'function'
  );
}

function isValidExistingUserDoc(
  raw: Record<string, unknown>,
  uid: string
): boolean {
  const keys = Object.keys(raw);
  if (!REQUIRED_USER_DOC_KEYS.every((k) => k in raw)) return false;
  if (!keys.every((k) => ALLOWED_USER_DOC_KEYS.has(k))) return false;
  if (raw.ownerId !== uid) return false;
  if (!isFirestoreTimestamp(raw.createdAt) || !isFirestoreTimestamp(raw.updatedAt)) {
    return false;
  }
  if (typeof raw.petName !== 'string' || raw.petName.length < 1 || raw.petName.length > 32) {
    return false;
  }
  if (
    !Number.isInteger(raw.coins) || (raw.coins as number) < 0 || (raw.coins as number) > 10000000 ||
    !Number.isInteger(raw.level) || (raw.level as number) < 1 || (raw.level as number) > 999 ||
    !Number.isInteger(raw.xp) || (raw.xp as number) < 0 || (raw.xp as number) > 100000
  ) {
    return false;
  }
  if (typeof raw.soundEnabled !== 'boolean') return false;
  if (
    !Array.isArray(raw.ownedItems) ||
    raw.ownedItems.length < 1 ||
    raw.ownedItems.length > 50 ||
    typeof raw.ownedItems[0] !== 'string' ||
    raw.ownedItems[0].length > 64
  ) {
    return false;
  }
  const stats = raw.stats as Record<string, unknown> | undefined;
  if (!stats || typeof stats !== 'object') return false;
  const statKeys = Object.keys(stats);
  if (
    !['hunger', 'hygiene', 'fun', 'sleep'].every(
      (k) =>
        typeof stats[k] === 'number' &&
        Number.isFinite(stats[k]) &&
        (stats[k] as number) >= 0 &&
        (stats[k] as number) <= 100
    ) ||
    !statKeys.every((k) => ['hunger', 'hygiene', 'fun', 'sleep', 'happiness'].includes(k)) ||
    ('happiness' in stats &&
      (typeof stats.happiness !== 'number' ||
        !Number.isFinite(stats.happiness) ||
        stats.happiness < 0 ||
        stats.happiness > 100))
  ) {
    return false;
  }
  const equipped = raw.equipped as Record<string, unknown> | undefined;
  if (
    !equipped ||
    typeof equipped !== 'object' ||
    typeof equipped.hat !== 'string' ||
    equipped.hat.length > 64 ||
    typeof equipped.accessory !== 'string' ||
    equipped.accessory.length > 64 ||
    typeof equipped.background !== 'string' ||
    equipped.background.length > 64 ||
    Object.keys(equipped).length !== 3
  ) {
    return false;
  }
  if ('unlockedAchievements' in raw) {
    if (
      !Array.isArray(raw.unlockedAchievements) ||
      raw.unlockedAchievements.length > 50 ||
      (raw.unlockedAchievements.length > 0 &&
        (typeof raw.unlockedAchievements[0] !== 'string' ||
          raw.unlockedAchievements[0].length > 64))
    ) {
      return false;
    }
  }
  if ('progress' in raw) {
    const p = raw.progress as Record<string, unknown> | undefined;
    const pKeys = ['mealsFed', 'gamesPlayed', 'cleanCount', 'petsCount', 'chatsCount'];
    if (
      !p ||
      typeof p !== 'object' ||
      !pKeys.every((k) => Number.isInteger(p[k]) && (p[k] as number) >= 0 && (p[k] as number) <= 1000000) ||
      !Object.keys(p).every((k) => pKeys.includes(k))
    ) {
      return false;
    }
  }
  if ('gameRecords' in raw) {
    const gr = raw.gameRecords as Record<string, unknown> | undefined;
    if (!gr || typeof gr !== 'object') return false;
    const validGames = ['fish', 'memory', 'escape', 'galaxy', 'pacmiau', 'maze'];
    if (!Object.keys(gr).every((k) => validGames.includes(k))) return false;
    for (const g of Object.keys(gr)) {
      const r = gr[g] as Record<string, unknown> | undefined;
      const rKeys = ['highScore', 'maxStage', 'bestTimeSec', 'totalCoins', 'plays'];
      if (
        !r ||
        typeof r !== 'object' ||
        !rKeys.every((k) => k in r && Number.isInteger(r[k])) ||
        !Object.keys(r).every((k) => rKeys.includes(k)) ||
        (r.highScore as number) < 0 || (r.highScore as number) > 10000000 ||
        (r.maxStage as number) < 1 || (r.maxStage as number) > 999 ||
        (r.bestTimeSec as number) < 0 || (r.bestTimeSec as number) > 86400 ||
        (r.totalCoins as number) < 0 || (r.totalCoins as number) > 10000000 ||
        (r.plays as number) < 0 || (r.plays as number) > 1000000
      ) {
        return false;
      }
    }
  }
  if ('dailyRoutine' in raw) {
    const dr = raw.dailyRoutine as Record<string, unknown> | undefined;
    if (
      !dr ||
      typeof dr !== 'object' ||
      !Object.keys(dr).every((k) => k === 'dateKey' || k === 'completedSlots') ||
      typeof dr.dateKey !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(dr.dateKey) ||
      !Array.isArray(dr.completedSlots) ||
      dr.completedSlots.length > 20 ||
      (dr.completedSlots.length > 0 &&
        (typeof dr.completedSlots[0] !== 'string' || dr.completedSlots[0].length > 40))
    ) {
      return false;
    }
  }
  return true;
}

const userWriteQueues = new Map<string, Promise<void>>();

function enqueueUserWrite<T>(uid: string, task: () => Promise<T>): Promise<T> {
  const prev = userWriteQueues.get(uid) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(task);
  const tracked = run.then(
    () => undefined,
    () => undefined
  );
  userWriteQueues.set(uid, tracked);
  return run.finally(() => {
    if (userWriteQueues.get(uid) === tracked) {
      userWriteQueues.delete(uid);
    }
  });
}

export async function loadOrCreatePetProfile(
  user: User
): Promise<UserPetProfile> {
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  const privatePath = `users/${user.uid}/private/info`;
  const privateRef = doc(db, 'users', user.uid, 'private', 'info');

  let snap;
  try {
    snap = await getDocFromServer(userRef);
  } catch {
    try {
      snap = await getDoc(userRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, userPath);
    }
  }

  if (snap.exists()) {
    const raw = snap.data() as Record<string, unknown>;
    const sanitized = sanitizeProfile(raw as Partial<UserPetProfile>, user.uid);
    if (!isValidExistingUserDoc(raw, user.uid)) {
      await enqueueUserWrite(user.uid, async () => {
        try {
          await setDoc(userRef, {
            ...sanitized,
            createdAt: isFirestoreTimestamp(raw.createdAt)
              ? raw.createdAt
              : serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          console.warn('Falha ao normalizar perfil legado no Firestore:', error);
        }
      });
    }
    return sanitized;
  }

  const initial = sanitizeProfile(createDefaultProfile(user.uid), user.uid);
  await enqueueUserWrite(user.uid, async () => {
    try {
      await setDoc(userRef, {
        ...initial,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, userPath);
    }
  });

  try {
    await setDoc(privateRef, {
      ownerId: user.uid,
      displayName: (user.displayName || 'Cuidador').slice(0, 80),
      email: (user.email || '').slice(0, 160),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, privatePath);
  }

  try {
    await saveMessage(user.uid, {
      sender: 'miau',
      meowPrefix: INITIAL_GREETING.meowPrefix,
      text: INITIAL_GREETING.text,
      mood: INITIAL_GREETING.mood,
    });
  } catch (error) {
    console.warn('Não foi possível salvar saudação inicial:', error);
  }

  return initial;
}

function diagnoseUserDocMismatch(
  raw: Record<string, unknown> | null,
  uid: string
): string {
  if (!raw) return 'docMissing';
  const keys = Object.keys(raw);
  const missingReq = REQUIRED_USER_DOC_KEYS.filter((k) => !(k in raw));
  if (missingReq.length > 0) return `missingReq:${missingReq.join(',')}`;
  const extraKeys = keys.filter((k) => !ALLOWED_USER_DOC_KEYS.has(k));
  if (extraKeys.length > 0) return `extraKeys:${extraKeys.join(',')}`;
  if (raw.ownerId !== uid) return 'mismatch:ownerId';
  if (!isFirestoreTimestamp(raw.createdAt)) return 'invalid:createdAt';
  if (!isFirestoreTimestamp(raw.updatedAt)) return 'invalid:updatedAt';
  if (!isValidExistingUserDoc(raw, uid)) return 'invalid:fieldShape';
  return 'validExistingDoc';
}

function buildRepairedDocPayload(
  raw: Record<string, unknown> | null,
  payload: Record<string, unknown>,
  fullProfileFallback: Partial<UserPetProfile>,
  uid: string
): Record<string, unknown> {
  const baseRaw = raw ? (raw as Partial<UserPetProfile>) : fullProfileFallback;
  const payloadWithoutTs: Partial<UserPetProfile> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (k !== 'updatedAt' && k !== 'createdAt') {
      (payloadWithoutTs as Record<string, unknown>)[k] = v;
    }
  }
  const merged = sanitizeProfile(
    {
      ...baseRaw,
      ...payloadWithoutTs,
      ownerId: uid,
    },
    uid
  );
  // Preserve existing valid petName, equipped, and ownedItems unless explicitly updated
  if (raw && !('petName' in payloadWithoutTs)) {
    if (
      typeof raw.petName === 'string' &&
      raw.petName.length >= 1 &&
      raw.petName.length <= 32
    ) {
      merged.petName = raw.petName;
    }
  }
  if (raw && !('equipped' in payloadWithoutTs)) {
    const eq = raw.equipped as Record<string, unknown> | undefined;
    if (
      eq &&
      typeof eq === 'object' &&
      Object.keys(eq).length === 3 &&
      typeof eq.hat === 'string' &&
      eq.hat.length <= 64 &&
      typeof eq.accessory === 'string' &&
      eq.accessory.length <= 64 &&
      typeof eq.background === 'string' &&
      eq.background.length <= 64
    ) {
      merged.equipped = {
        hat: eq.hat,
        accessory: eq.accessory,
        background: eq.background,
      };
    }
  }
  if (
    raw &&
    !('ownedItems' in payloadWithoutTs) &&
    Array.isArray(raw.ownedItems) &&
    raw.ownedItems.length >= 1
  ) {
    const preservedOwned = sanitizeStringList(raw.ownedItems, 50, 64);
    if (preservedOwned.length >= 1) {
      merged.ownedItems = preservedOwned;
    }
  }
  return {
    ...merged,
    createdAt:
      raw && isFirestoreTimestamp(raw.createdAt)
        ? raw.createdAt
        : serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function isDeepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return false;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (!isDeepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!(key in objB) || !isDeepEqual(objA[key], objB[key])) return false;
  }
  return true;
}

async function updateUserDocWithLegacyRepair(
  uid: string,
  path: string,
  payload: Record<string, unknown>,
  fullProfileFallback: Partial<UserPetProfile>
): Promise<void> {
  return enqueueUserWrite(uid, async () => {
    const userRef = doc(db, 'users', uid);
    try {
      await updateDoc(userRef, payload);
    } catch (error) {
      const errCode = (error as { code?: string })?.code || '';
      const errMsg = error instanceof Error ? error.message : String(error);
      const isPermissionError =
        errCode === 'permission-denied' ||
        errMsg.includes('Missing or insufficient permissions') ||
        errMsg.includes('PERMISSION_DENIED');

      let diag = '';
      let fromServer = true;
      if (isPermissionError && auth.currentUser?.uid === uid) {
        try {
          let snap;
          try {
            snap = await getDocFromServer(userRef);
          } catch {
            fromServer = false;
            snap = await getDoc(userRef);
          }
          const raw = snap.exists()
            ? (snap.data() as Record<string, unknown>)
            : null;
          diag = diagnoseUserDocMismatch(raw, uid);

          const isLocalPendingTimestamp =
            !fromServer &&
            raw !== null &&
            (diag === 'invalid:updatedAt' || diag === 'invalid:createdAt');

          if (!isLocalPendingTimestamp) {
            const repaired = buildRepairedDocPayload(
              raw,
              payload,
              fullProfileFallback,
              uid
            );
            try {
              await setDoc(userRef, repaired);
              return;
            } catch (setDocErr) {
              const diffKeys = raw
                ? Object.keys(repaired).filter(
                    (k) =>
                      k !== 'updatedAt' &&
                      k !== 'createdAt' &&
                      !isDeepEqual(raw[k], repaired[k])
                  )
                : Object.keys(repaired);
              const meta = raw
                ? `petLen=${typeof raw.petName === 'string' ? raw.petName.length : -1},owned0=${Array.isArray(raw.ownedItems) ? String(raw.ownedItems[0] ?? '').length : -1},ownedN=${Array.isArray(raw.ownedItems) ? raw.ownedItems.length : -1},coinsInt=${Number.isInteger(raw.coins)},lvlInt=${Number.isInteger(raw.level)},xpInt=${Number.isInteger(raw.xp)},diff=${diffKeys.join('+')}`
                : 'noRaw';
              const setErrMsg =
                setDocErr instanceof Error ? setDocErr.message : String(setDocErr);
              throw new Error(`${setErrMsg} [${meta}]`);
            }
          }
        } catch (repairError) {
          const repairMsg =
            repairError instanceof Error
              ? repairError.message
              : String(repairError);
          handleFirestoreError(
            new Error(
              `${repairMsg} [diag=${diag || 'repairFailed'},fromServer=${fromServer},phase=setDoc,keys=${Object.keys(payload).join(',')}]`
            ),
            OperationType.UPDATE,
            path
          );
        }
      }
      if (diag) {
        handleFirestoreError(
          new Error(
            `${errMsg} [diag=${diag},fromServer=${fromServer},phase=updateDoc,keys=${Object.keys(payload).join(',')}]`
          ),
          OperationType.UPDATE,
          path
        );
      }
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  });
}

export async function saveStatsProgress(
  uid: string,
  profile: Pick<
    UserPetProfile,
    | 'stats'
    | 'coins'
    | 'level'
    | 'xp'
    | 'progress'
    | 'unlockedAchievements'
    | 'gameRecords'
    | 'dailyRoutine'
  > &
    Partial<UserPetProfile>
): Promise<void> {
  const path = `users/${uid}`;
  await updateUserDocWithLegacyRepair(
    uid,
    path,
    {
      stats: {
        hunger: safeInt(profile.stats?.hunger, 0, 100, 60),
        hygiene: safeInt(profile.stats?.hygiene, 0, 100, 90),
        fun: safeInt(profile.stats?.fun, 0, 100, 50),
        sleep: safeInt(profile.stats?.sleep, 0, 100, 70),
        happiness: safeInt(profile.stats?.happiness, 0, 100, 75),
      },
      coins: safeInt(profile.coins, 0, 10000000, 0),
      level: safeInt(profile.level, 1, 999, 1),
      xp: safeInt(profile.xp, 0, 100000, 0),
      progress: {
        mealsFed: safeInt(profile.progress?.mealsFed, 0, 1000000, 0),
        gamesPlayed: safeInt(profile.progress?.gamesPlayed, 0, 1000000, 0),
        cleanCount: safeInt(profile.progress?.cleanCount, 0, 1000000, 0),
        petsCount: safeInt(profile.progress?.petsCount, 0, 1000000, 0),
        chatsCount: safeInt(profile.progress?.chatsCount, 0, 1000000, 0),
      },
      unlockedAchievements: sanitizeStringList(profile.unlockedAchievements, 50, 64),
      gameRecords: sanitizeGameRecords(profile.gameRecords),
      dailyRoutine: sanitizeDailyRoutine(profile.dailyRoutine),
      updatedAt: serverTimestamp(),
    },
    profile
  );
}

export async function saveShopAction(
  uid: string,
  profile: Pick<
    UserPetProfile,
    'equipped' | 'ownedItems' | 'coins' | 'progress' | 'unlockedAchievements'
  > &
    Partial<UserPetProfile>
): Promise<void> {
  const path = `users/${uid}`;
  const owned = sanitizeStringList(profile.ownedItems, 50, 64);
  if (owned.length === 0) {
    owned.push('hat_none', 'acc_none', 'bg_lilac', 'bg_sunny');
  }
  await updateUserDocWithLegacyRepair(
    uid,
    path,
    {
      equipped: {
        hat: (profile.equipped?.hat || 'hat_party').slice(0, 64),
        accessory: (profile.equipped?.accessory || 'acc_bowtie').slice(0, 64),
        background: (profile.equipped?.background || 'bg_lilac').slice(0, 64),
      },
      ownedItems: owned,
      coins: safeInt(profile.coins, 0, 10000000, 0),
      progress: {
        mealsFed: safeInt(profile.progress?.mealsFed, 0, 1000000, 0),
        gamesPlayed: safeInt(profile.progress?.gamesPlayed, 0, 1000000, 0),
        cleanCount: safeInt(profile.progress?.cleanCount, 0, 1000000, 0),
        petsCount: safeInt(profile.progress?.petsCount, 0, 1000000, 0),
        chatsCount: safeInt(profile.progress?.chatsCount, 0, 1000000, 0),
      },
      unlockedAchievements: sanitizeStringList(profile.unlockedAchievements, 50, 64),
      updatedAt: serverTimestamp(),
    },
    profile
  );
}

export async function saveSettings(
  uid: string,
  profile: Pick<UserPetProfile, 'petName' | 'soundEnabled'> &
    Partial<UserPetProfile>
): Promise<void> {
  const path = `users/${uid}`;
  const safeName =
    typeof profile.petName === 'string' && profile.petName.trim().length > 0
      ? profile.petName.trim().slice(0, 32)
      : 'Miau';
  await updateUserDocWithLegacyRepair(
    uid,
    path,
    {
      petName: safeName,
      soundEnabled: Boolean(profile.soundEnabled),
      updatedAt: serverTimestamp(),
    },
    profile
  );
}

function sanitizeRankingGameMap(
  raw: unknown,
  minVal: number,
  maxVal: number
): Partial<Record<GameId, number>> {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: Partial<Record<GameId, number>> = {};
  for (const id of ['fish', 'memory', 'escape', 'galaxy', 'pacmiau', 'maze'] as const) {
    const val = Number(src[id]);
    if (Number.isFinite(val)) {
      out[id] = Math.max(minVal, Math.min(maxVal, Math.round(val)));
    }
  }
  return out;
}

const VALID_RANKING_SCHOOLINGS = new Set([
  '',
  'educacao_infantil',
  'fundamental_1',
  'fundamental_2',
  'medio',
  'superior_outro',
]);

function sanitizeRankingSchooling(raw: unknown): RankingEntry['schooling'] {
  if (typeof raw !== 'string' || !VALID_RANKING_SCHOOLINGS.has(raw)) {
    return '';
  }
  return raw as RankingEntry['schooling'];
}

export async function upsertRankingEntry(
  uid: string,
  entry: Omit<RankingEntry, 'id' | 'updatedAtMs'>
): Promise<void> {
  const path = `rankings/${uid}`;
  try {
    const safeName =
      (entry.playerName || 'Jogador')
        .replace(/@.*/, '')
        .trim()
        .slice(0, 40) || 'Jogador';
    const gameScores = sanitizeRankingGameMap(entry.gameScores, 0, 10000000);
    const gameStages = sanitizeRankingGameMap(entry.gameStages, 1, 999);
    const schooling = sanitizeRankingSchooling(entry.schooling);
    await setDoc(doc(db, 'rankings', uid), {
      ownerId: uid,
      playerName: safeName,
      petName: (entry.petName || 'Miau').slice(0, 32),
      totalScore: Math.max(0, Math.min(50000000, Math.round(entry.totalScore))),
      bestStage: Math.max(1, Math.min(999, Math.round(entry.bestStage))),
      coinsEarned: Math.max(0, Math.min(50000000, Math.round(entry.coinsEarned))),
      schooling,
      gameScores,
      gameStages,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('Não foi possível atualizar ranking no Firestore:', path, error);
  }
}

export async function loadTopRankings(maxCount = 20): Promise<RankingEntry[]> {
  try {
    const q = query(
      collection(db, 'rankings'),
      orderBy('totalScore', 'desc'),
      limit(maxCount)
    );
    const snap = await getDocs(q);
    const list: RankingEntry[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      list.push({
        id: docSnap.id,
        playerName: String(d.playerName || 'Jogador'),
        petName: String(d.petName || 'Miau'),
        totalScore: Number(d.totalScore || 0),
        bestStage: Number(d.bestStage || 1),
        coinsEarned: Number(d.coinsEarned || 0),
        schooling: sanitizeRankingSchooling(d.schooling),
        gameScores: d.gameScores
          ? sanitizeRankingGameMap(d.gameScores, 0, 10000000)
          : undefined,
        gameStages: d.gameStages
          ? sanitizeRankingGameMap(d.gameStages, 1, 999)
          : undefined,
        updatedAtMs: d.updatedAt?.toMillis?.() ?? Date.now(),
      });
    });
    return list;
  } catch {
    return [];
  }
}

export async function loadMessages(uid: string): Promise<ChatMessage[]> {
  const path = `users/${uid}/messages`;
  try {
    const q = query(
      collection(db, 'users', uid, 'messages'),
      where('ownerId', '==', uid),
      limit(50)
    );
    const snap = await getDocs(q);
    const list: ChatMessage[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        ownerId: data.ownerId,
        sender: data.sender,
        meowPrefix: data.meowPrefix || '',
        text: data.text,
        mood: (data.mood || 'happy') as MiauMood,
        createdAtMs: data.createdAt?.toMillis?.() ?? Date.now(),
      });
    });
    list.sort((a, b) => a.createdAtMs - b.createdAtMs);
    return list.slice(-30);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveMessage(
  uid: string,
  msg: {
    sender: 'user' | 'miau';
    meowPrefix: string;
    text: string;
    mood: MiauMood;
  }
): Promise<ChatMessage> {
  const path = `users/${uid}/messages`;
  try {
    const ref = await addDoc(collection(db, 'users', uid, 'messages'), {
      ownerId: uid,
      sender: msg.sender,
      meowPrefix: msg.meowPrefix.slice(0, 40),
      text: msg.text.slice(0, 1000),
      mood: msg.mood.slice(0, 32),
      createdAt: serverTimestamp(),
    });
    return {
      id: ref.id,
      ownerId: uid,
      sender: msg.sender,
      meowPrefix: msg.meowPrefix,
      text: msg.text,
      mood: msg.mood,
      createdAtMs: Date.now(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

const VALID_SCHOOLING_SET = new Set<string>([
  '',
  'educacao_infantil',
  'fundamental_1',
  'fundamental_2',
  'medio',
  'superior_outro',
]);

function normalizeHumanProfilePayload(
  uid: string,
  profile: Partial<UserHumanProfile>
): {
  ownerId: string;
  fullName: string;
  birthDate: string;
  schooling: SchoolingLevel | '';
  state: string;
  country: string;
  photoDataUrl: string;
} {
  const fullName =
    typeof profile.fullName === 'string'
      ? profile.fullName.trim().slice(0, 100)
      : '';
  const birthDate =
    typeof profile.birthDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(profile.birthDate.trim())
      ? profile.birthDate.trim()
      : '';
  const rawSchooling =
    typeof profile.schooling === 'string' ? profile.schooling.trim() : '';
  const schooling = (
    VALID_SCHOOLING_SET.has(rawSchooling) ? rawSchooling : ''
  ) as SchoolingLevel | '';
  const state =
    typeof profile.state === 'string' ? profile.state.trim().slice(0, 60) : '';
  const country =
    typeof profile.country === 'string' && profile.country.trim().length > 0
      ? profile.country.trim().slice(0, 60)
      : 'Brasil';
  const cleanPhoto = sanitizeImageDataUrl(profile.photoDataUrl);
  const photoDataUrl = cleanPhoto.length <= 180000 ? cleanPhoto : '';

  return {
    ownerId: uid,
    fullName,
    birthDate,
    schooling,
    state,
    country,
    photoDataUrl,
  };
}

export async function loadPrivateUserProfile(
  uid: string
): Promise<UserHumanProfile | null> {
  const path = `users/${uid}/private/profile`;
  const ref = doc(db, 'users', uid, 'private', 'profile');
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const d = snap.data() as Record<string, unknown>;
    const normalized = normalizeHumanProfilePayload(
      uid,
      d as Partial<UserHumanProfile>
    );
    return {
      ...normalized,
      updatedAtMs:
        (d.updatedAt as { toMillis?: () => number } | undefined)?.toMillis?.() ??
        Date.now(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function savePrivateUserProfile(
  uid: string,
  profile: UserHumanProfile
): Promise<UserHumanProfile> {
  const path = `users/${uid}/private/profile`;
  const ref = doc(db, 'users', uid, 'private', 'profile');
  const normalized = normalizeHumanProfilePayload(uid, profile);

  let exists = false;
  try {
    const snap = await getDoc(ref);
    exists = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!exists) {
    try {
      await setDoc(ref, {
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
        fullName: normalized.fullName,
        birthDate: normalized.birthDate,
        schooling: normalized.schooling,
        state: normalized.state,
        country: normalized.country,
        photoDataUrl: normalized.photoDataUrl,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  return {
    ...normalized,
    updatedAtMs: Date.now(),
  };
}

export async function deletePrivateUserProfile(uid: string): Promise<void> {
  const path = `users/${uid}/private/profile`;
  const ref = doc(db, 'users', uid, 'private', 'profile');
  try {
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function loadParentalControlCloud(
  uid: string
): Promise<ParentalControlConfig | null> {
  const path = `users/${uid}/private/parental`;
  const ref = doc(db, 'users', uid, 'private', 'parental');
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const d = snap.data() as Record<string, unknown>;
    return normalizeParentalControlConfig(uid, {
      ...(d as Partial<ParentalControlConfig>),
      updatedAtMs:
        (d.updatedAt as { toMillis?: () => number } | undefined)?.toMillis?.() ??
        Date.now(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveParentalControlCloud(
  uid: string,
  config: ParentalControlConfig
): Promise<ParentalControlConfig> {
  const path = `users/${uid}/private/parental`;
  const ref = doc(db, 'users', uid, 'private', 'parental');
  const norm = normalizeParentalControlConfig(uid, config);

  let exists = false;
  try {
    const snap = await getDoc(ref);
    exists = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!exists) {
    try {
      await setDoc(ref, {
        ownerId: uid,
        pinHash: norm.pinHash,
        dailyScreenLimitMin: norm.dailyScreenLimitMin,
        quietHoursEnabled: norm.quietHoursEnabled,
        quietStart: norm.quietStart,
        quietEnd: norm.quietEnd,
        strictAiFilter: norm.strictAiFilter,
        dailyMinutesByDate: norm.dailyMinutesByDate,
        dailyLessonsByDate: norm.dailyLessonsByDate,
        screenLockBypassDateKey: norm.screenLockBypassDateKey,
        screenLockBypassUntilMs: norm.screenLockBypassUntilMs,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  } else {
    try {
      await updateDoc(ref, {
        pinHash: norm.pinHash,
        dailyScreenLimitMin: norm.dailyScreenLimitMin,
        quietHoursEnabled: norm.quietHoursEnabled,
        quietStart: norm.quietStart,
        quietEnd: norm.quietEnd,
        strictAiFilter: norm.strictAiFilter,
        dailyMinutesByDate: norm.dailyMinutesByDate,
        dailyLessonsByDate: norm.dailyLessonsByDate,
        screenLockBypassDateKey: norm.screenLockBypassDateKey,
        screenLockBypassUntilMs: norm.screenLockBypassUntilMs,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  return {
    ...norm,
    updatedAtMs: Date.now(),
  };
}
