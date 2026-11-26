export interface RoomThemeClasses {
  wall: string;
  floor: string;
  showFloor: boolean;
  useWallpaper: boolean;
}

const NIGHT_BACKGROUNDS = new Set<string>([
  'bg_night',
  'bg_space',
  'bg_hogwarts',
  'bg_cyberpunk',
  'bg_marvel',
  'bg_dc',
  'bg_halloween',
  'bg_natal',
]);

export function isNightRoomBackground(
  backgroundId: string,
  isSleeping: boolean
): boolean {
  return isSleeping || NIGHT_BACKGROUNDS.has(backgroundId);
}

export function getRoomThemeClasses(
  backgroundId: string,
  isSleeping: boolean
): RoomThemeClasses {
  if (isSleeping) {
    return {
      wall: 'from-[#281e4f] via-[#3b2d6d] to-[#4e3d8a]',
      floor: 'from-[#372863] to-[#231847]',
      showFloor: true,
      useWallpaper: false,
    };
  }
  switch (backgroundId) {
    case 'bg_night':
      return {
        wall: 'from-[#281d52] via-[#3d2d73] to-[#523d91]',
        floor: 'from-[#3a2a6b] to-[#24184a]',
        showFloor: true,
        useWallpaper: false,
      };
    case 'bg_sunny':
      return {
        wall: 'from-[#56ccf2] via-[#8ee0ff] to-[#dff5ff]',
        floor: 'from-[#4ade80] to-[#16a34a]',
        showFloor: false,
        useWallpaper: false,
      };
    case 'bg_pastel_garden':
      return {
        wall: 'from-[#dff7ea] via-[#fde8f5] to-[#e9d5ff]',
        floor: 'from-[#bbf7d0] to-[#86efac]',
        showFloor: false,
        useWallpaper: false,
      };
    case 'bg_space':
      return {
        wall: 'from-[#131138] via-[#261f5e] to-[#392978]',
        floor: 'from-[#312e81] to-[#1e1b4b]',
        showFloor: true,
        useWallpaper: false,
      };
    case 'bg_peach':
      return {
        wall: 'from-[#ffe4d6] via-[#fbd3e9] to-[#ebd4ff]',
        floor: 'from-[#eab8d9] to-[#cfa3e8]',
        showFloor: true,
        useWallpaper: true,
      };
    case 'bg_jurassic':
      return {
        wall: 'from-[#bae6fd] via-[#d9f99d] to-[#bbf7d0]',
        floor: 'from-[#86efac] to-[#4ade80]',
        showFloor: false,
        useWallpaper: false,
      };
    case 'bg_hogwarts':
      return {
        wall: 'from-[#1e103c] via-[#311761] to-[#4c1d95]',
        floor: 'from-[#3b0764] to-[#1e1b4b]',
        showFloor: false,
        useWallpaper: false,
      };
    case 'bg_cyberpunk':
      return {
        wall: 'from-[#090d24] via-[#1b1042] to-[#3b0764]',
        floor: 'from-[#1e1b4b] to-[#0f172a]',
        showFloor: false,
        useWallpaper: false,
      };
    case 'bg_city':
      return {
        wall: 'from-[#60a5fa] via-[#bae6fd] to-[#e0f2fe]',
        floor: 'from-[#cbd5e1] to-[#94a3b8]',
        showFloor: false,
        useWallpaper: false,
      };
    case 'bg_marvel':
      return {
        wall: 'from-[#1e293b] via-[#7c2d12] to-[#ea580c]',
        floor: 'from-[#1e3a8a] to-[#0f172a]',
        showFloor: false,
        useWallpaper: false,
      };
    case 'bg_dc':
      return {
        wall: 'from-[#020617] via-[#0f172a] to-[#1e293b]',
        floor: 'from-[#0f172a] to-[#020617]',
        showFloor: false,
        useWallpaper: false,
      };
    case 'bg_halloween':
      return {
        wall: 'from-[#1e1b4b] via-[#3b0764] to-[#7c2d12]',
        floor: 'from-[#3b0764] to-[#1e1b4b]',
        showFloor: false,
        useWallpaper: false,
      };
    case 'bg_natal':
      return {
        wall: 'from-[#0f172a] via-[#1e3a8a] to-[#38bdf8]',
        floor: 'from-[#f8fafc] to-[#e2e8f0]',
        showFloor: false,
        useWallpaper: false,
      };
    default:
      return {
        wall: 'from-[#ece3ff] via-[#e2d2fc] to-[#d9c4fa]',
        floor: 'from-[#c8aaf4] to-[#b590eb]',
        showFloor: true,
        useWallpaper: true,
      };
  }
}
