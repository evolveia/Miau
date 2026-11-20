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
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { INITIAL_GREETING, createDefaultProfile } from '../constants';
import type { ChatMessage, MiauMood, UserPetProfile } from '../types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

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

function sanitizeProfile(profile: UserPetProfile): UserPetProfile {
  const progress = profile.progress ?? {
    mealsFed: 0,
    gamesPlayed: 0,
    cleanCount: 0,
    petsCount: 0,
    chatsCount: 0,
  };
  return {
    ownerId: profile.ownerId,
    petName: profile.petName.slice(0, 32) || 'Miau',
    coins: Math.max(0, Math.min(10000000, Math.round(profile.coins))),
    level: Math.max(1, Math.min(999, Math.round(profile.level))),
    xp: Math.max(0, Math.min(100000, Math.round(profile.xp))),
    stats: {
      hunger: Math.max(0, Math.min(100, Math.round(profile.stats.hunger))),
      hygiene: Math.max(0, Math.min(100, Math.round(profile.stats.hygiene))),
      fun: Math.max(0, Math.min(100, Math.round(profile.stats.fun))),
      sleep: Math.max(0, Math.min(100, Math.round(profile.stats.sleep))),
      happiness: Math.max(
        0,
        Math.min(100, Math.round(profile.stats.happiness ?? 75))
      ),
    },
    equipped: {
      hat: profile.equipped.hat.slice(0, 64),
      accessory: profile.equipped.accessory.slice(0, 64),
      background: profile.equipped.background.slice(0, 64),
    },
    ownedItems: profile.ownedItems.slice(0, 50),
    soundEnabled: Boolean(profile.soundEnabled),
    unlockedAchievements: Array.isArray(profile.unlockedAchievements)
      ? profile.unlockedAchievements.slice(0, 50)
      : [],
    progress: {
      mealsFed: Math.max(0, Math.round(progress.mealsFed || 0)),
      gamesPlayed: Math.max(0, Math.round(progress.gamesPlayed || 0)),
      cleanCount: Math.max(0, Math.round(progress.cleanCount || 0)),
      petsCount: Math.max(0, Math.round(progress.petsCount || 0)),
      chatsCount: Math.max(0, Math.round(progress.chatsCount || 0)),
    },
  };
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
    snap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  if (snap.exists()) {
    const data = snap.data() as UserPetProfile;
    return sanitizeProfile(data);
  }

  const initial = sanitizeProfile(createDefaultProfile(user.uid));
  try {
    await setDoc(userRef, {
      ...initial,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, userPath);
  }

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

export async function saveStatsProgress(
  uid: string,
  profile: Pick<
    UserPetProfile,
    'stats' | 'coins' | 'level' | 'xp' | 'progress' | 'unlockedAchievements'
  >
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      stats: {
        hunger: Math.max(0, Math.min(100, Math.round(profile.stats.hunger))),
        hygiene: Math.max(0, Math.min(100, Math.round(profile.stats.hygiene))),
        fun: Math.max(0, Math.min(100, Math.round(profile.stats.fun))),
        sleep: Math.max(0, Math.min(100, Math.round(profile.stats.sleep))),
        happiness: Math.max(
          0,
          Math.min(100, Math.round(profile.stats.happiness ?? 75))
        ),
      },
      coins: Math.max(0, Math.min(10000000, Math.round(profile.coins))),
      level: Math.max(1, Math.min(999, Math.round(profile.level))),
      xp: Math.max(0, Math.min(100000, Math.round(profile.xp))),
      progress: {
        mealsFed: Math.max(0, Math.round(profile.progress.mealsFed)),
        gamesPlayed: Math.max(0, Math.round(profile.progress.gamesPlayed)),
        cleanCount: Math.max(0, Math.round(profile.progress.cleanCount)),
        petsCount: Math.max(0, Math.round(profile.progress.petsCount)),
        chatsCount: Math.max(0, Math.round(profile.progress.chatsCount)),
      },
      unlockedAchievements: profile.unlockedAchievements.slice(0, 50),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveShopAction(
  uid: string,
  profile: Pick<
    UserPetProfile,
    'equipped' | 'ownedItems' | 'coins' | 'progress' | 'unlockedAchievements'
  >
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      equipped: {
        hat: profile.equipped.hat.slice(0, 64),
        accessory: profile.equipped.accessory.slice(0, 64),
        background: profile.equipped.background.slice(0, 64),
      },
      ownedItems: profile.ownedItems.slice(0, 50),
      coins: Math.max(0, Math.min(10000000, Math.round(profile.coins))),
      progress: {
        mealsFed: Math.max(0, Math.round(profile.progress.mealsFed)),
        gamesPlayed: Math.max(0, Math.round(profile.progress.gamesPlayed)),
        cleanCount: Math.max(0, Math.round(profile.progress.cleanCount)),
        petsCount: Math.max(0, Math.round(profile.progress.petsCount)),
        chatsCount: Math.max(0, Math.round(profile.progress.chatsCount)),
      },
      unlockedAchievements: profile.unlockedAchievements.slice(0, 50),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveSettings(
  uid: string,
  profile: Pick<UserPetProfile, 'petName' | 'soundEnabled'>
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      petName: profile.petName.slice(0, 32) || 'Miau',
      soundEnabled: Boolean(profile.soundEnabled),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
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
