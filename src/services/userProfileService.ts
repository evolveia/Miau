import type { User } from 'firebase/auth';
import type { SchoolingLevel, UserHumanProfile } from '../types';
import { sanitizeImageDataUrl } from '../utils/html';
import {
  deletePrivateUserProfile,
  loadPrivateUserProfile,
  savePrivateUserProfile,
} from './firebaseService';

const PROFILE_STORAGE_PREFIX = 'miau_human_profile_v1_';

function getStorageKey(ownerId: string): string {
  const safeId = (ownerId || 'demo').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${PROFILE_STORAGE_PREFIX}${safeId}`;
}

export function createEmptyHumanProfile(ownerId = 'demo'): UserHumanProfile {
  return {
    ownerId,
    fullName: '',
    birthDate: '',
    schooling: '',
    state: '',
    country: 'Brasil',
    photoDataUrl: '',
    updatedAtMs: Date.now(),
  };
}

export function calculateAgeFromBirthDate(birthDateStr: string): number | null {
  if (!birthDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(birthDateStr)) {
    return null;
  }
  const [yStr, mStr, dStr] = birthDateStr.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 1900 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  const dob = new Date(year, month - 1, day);
  if (
    dob.getFullYear() !== year ||
    dob.getMonth() !== month - 1 ||
    dob.getDate() !== day
  ) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - year;
  const monthDiff = today.getMonth() + 1 - month;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < day)) {
    age -= 1;
  }
  if (age < 0 || age > 130) return null;
  return age;
}

export function hasProfileContent(profile: UserHumanProfile): boolean {
  return Boolean(
    profile.fullName.trim() ||
      profile.birthDate ||
      profile.schooling ||
      profile.state.trim() ||
      profile.photoDataUrl
  );
}

function readLocalHumanProfile(ownerId: string): UserHumanProfile | null {
  try {
    const raw = localStorage.getItem(getStorageKey(ownerId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserHumanProfile>;
    return {
      ownerId,
      fullName:
        typeof parsed.fullName === 'string'
          ? parsed.fullName.slice(0, 100)
          : '',
      birthDate:
        typeof parsed.birthDate === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(parsed.birthDate)
          ? parsed.birthDate
          : '',
      schooling: (parsed.schooling || '') as SchoolingLevel | '',
      state:
        typeof parsed.state === 'string' ? parsed.state.slice(0, 60) : '',
      country:
        typeof parsed.country === 'string' && parsed.country.trim().length > 0
          ? parsed.country.slice(0, 60)
          : 'Brasil',
      photoDataUrl: sanitizeImageDataUrl(parsed.photoDataUrl),
      updatedAtMs:
        typeof parsed.updatedAtMs === 'number' ? parsed.updatedAtMs : Date.now(),
    };
  } catch {
    return null;
  }
}

function writeLocalHumanProfile(
  ownerId: string,
  profile: UserHumanProfile
): void {
  try {
    localStorage.setItem(getStorageKey(ownerId), JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors
  }
}

export async function loadUserHumanProfile(
  user: User | null,
  ownerId: string
): Promise<UserHumanProfile> {
  const local = readLocalHumanProfile(ownerId);
  if (user) {
    try {
      const remote = await loadPrivateUserProfile(user.uid);
      if (remote) {
        writeLocalHumanProfile(user.uid, remote);
        return remote;
      }
      if (local && hasProfileContent(local)) {
        return local;
      }
      const seeded = createEmptyHumanProfile(user.uid);
      if (user.displayName) {
        seeded.fullName = user.displayName.trim().slice(0, 100);
      }
      return seeded;
    } catch (err) {
      console.warn('Falha ao carregar perfil do usuário no Firestore:', err);
      return local || createEmptyHumanProfile(user.uid);
    }
  }
  return local || createEmptyHumanProfile(ownerId);
}

export async function saveUserHumanProfile(
  user: User | null,
  profile: UserHumanProfile
): Promise<UserHumanProfile> {
  const ownerId = user?.uid || profile.ownerId || 'demo';
  const clean: UserHumanProfile = {
    ownerId,
    fullName: profile.fullName.trim().slice(0, 100),
    birthDate:
      profile.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(profile.birthDate)
        ? profile.birthDate
        : '',
    schooling: profile.schooling || '',
    state: profile.state.trim().slice(0, 60),
    country: (profile.country.trim() || 'Brasil').slice(0, 60),
    photoDataUrl: sanitizeImageDataUrl(profile.photoDataUrl),
    updatedAtMs: Date.now(),
  };

  if (clean.photoDataUrl.length > 180000) {
    throw new Error(
      'A foto selecionada ficou muito grande. Tente outra imagem.'
    );
  }

  writeLocalHumanProfile(ownerId, clean);
  if (user) {
    return await savePrivateUserProfile(user.uid, clean);
  }
  return clean;
}

export async function deleteUserHumanProfile(
  user: User | null,
  ownerId: string
): Promise<UserHumanProfile> {
  const targetOwner = user?.uid || ownerId || 'demo';
  try {
    localStorage.removeItem(getStorageKey(targetOwner));
  } catch {
    // Ignore storage errors
  }
  if (user) {
    try {
      await deletePrivateUserProfile(user.uid);
    } catch (err) {
      console.warn('Falha ao excluir perfil no Firestore:', err);
    }
  }
  return createEmptyHumanProfile(targetOwner);
}

function renderCroppedSquareCanvas(
  source: HTMLImageElement | HTMLVideoElement,
  srcW: number,
  srcH: number,
  maxSize = 260,
  quality = 0.78
): string {
  const side = Math.max(1, Math.min(srcW, srcH));
  const sx = Math.max(0, (srcW - side) / 2);
  const sy = Math.max(0, (srcH - side) / 2);
  const target = Math.min(maxSize, side);

  const canvas = document.createElement('canvas');
  canvas.width = target;
  canvas.height = target;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Não foi possível processar a imagem neste navegador.');
  }
  ctx.drawImage(source, sx, sy, side, side, 0, 0, target, target);
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  if (dataUrl.length > 160000) {
    dataUrl = canvas.toDataURL('image/jpeg', 0.56);
  }
  return dataUrl;
}

export function compressImageFileToDataUrl(
  file: File,
  maxSize = 260,
  quality = 0.78
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Escolha um arquivo de imagem válido (JPG, PNG ou WebP).'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () =>
        reject(new Error('Não foi possível carregar a imagem escolhida.'));
      img.onload = () => {
        try {
          resolve(
            renderCroppedSquareCanvas(
              img,
              img.naturalWidth || img.width,
              img.naturalHeight || img.height,
              maxSize,
              quality
            )
          );
        } catch (err) {
          reject(err);
        }
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

export function captureVideoFrameToDataUrl(
  video: HTMLVideoElement,
  maxSize = 260,
  quality = 0.8
): string {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) {
    throw new Error('A câmera ainda está inicializando. Aguarde um instante.');
  }
  return renderCroppedSquareCanvas(video, w, h, maxSize, quality);
}
