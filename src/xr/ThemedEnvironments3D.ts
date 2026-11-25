import * as THREE from 'three';

export interface ThemeVisualConfig {
  rugColor: number;
  rugTrimColor: number;
  skyColor: number;
  fogColor: number;
  fogNear: number;
  fogFar: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  keyColor: number;
  keyIntensity: number;
  rimColor: number;
  rimIntensity: number;
  showIndoorLamp: boolean;
}

export const THEME_VISUAL_CONFIGS: Record<string, ThemeVisualConfig> = {
  bg_lilac: {
    rugColor: 0xd8b4fe,
    rugTrimColor: 0xfef9c3,
    skyColor: 0xe2d2fc,
    fogColor: 0xe2d2fc,
    fogNear: 5.5,
    fogFar: 13,
    hemiSky: 0xfef9ff,
    hemiGround: 0x6d4ea3,
    hemiIntensity: 2.5,
    keyColor: 0xfff7ed,
    keyIntensity: 2.0,
    rimColor: 0xc4b5fd,
    rimIntensity: 1.0,
    showIndoorLamp: true,
  },
  bg_peach: {
    rugColor: 0xfdba74,
    rugTrimColor: 0xfbcfe8,
    skyColor: 0xfbd3e9,
    fogColor: 0xfbd3e9,
    fogNear: 5.5,
    fogFar: 13,
    hemiSky: 0xfff7ed,
    hemiGround: 0x9d4edd,
    hemiIntensity: 2.5,
    keyColor: 0xffedd5,
    keyIntensity: 2.1,
    rimColor: 0xf9a8d4,
    rimIntensity: 1.05,
    showIndoorLamp: true,
  },
  bg_sunny: {
    rugColor: 0x4ade80,
    rugTrimColor: 0xfef9c3,
    skyColor: 0x8ee0ff,
    fogColor: 0xcffafe,
    fogNear: 6.0,
    fogFar: 14,
    hemiSky: 0xf0f9ff,
    hemiGround: 0x16a34a,
    hemiIntensity: 2.7,
    keyColor: 0xfffbeb,
    keyIntensity: 2.25,
    rimColor: 0xbae6fd,
    rimIntensity: 0.9,
    showIndoorLamp: false,
  },
  bg_pastel_garden: {
    rugColor: 0xbbf7d0,
    rugTrimColor: 0xf9a8d4,
    skyColor: 0xfde8f5,
    fogColor: 0xfde8f5,
    fogNear: 5.8,
    fogFar: 13.5,
    hemiSky: 0xfff1f2,
    hemiGround: 0x4ade80,
    hemiIntensity: 2.65,
    keyColor: 0xfffbeb,
    keyIntensity: 1.95,
    rimColor: 0xe9d5ff,
    rimIntensity: 1.05,
    showIndoorLamp: false,
  },
  bg_night: {
    rugColor: 0x4338ca,
    rugTrimColor: 0xfef08a,
    skyColor: 0x24184a,
    fogColor: 0x24184a,
    fogNear: 5.0,
    fogFar: 12.5,
    hemiSky: 0xc4b5fd,
    hemiGround: 0x1e1b4b,
    hemiIntensity: 1.8,
    keyColor: 0xfef9c3,
    keyIntensity: 1.45,
    rimColor: 0x818cf8,
    rimIntensity: 1.25,
    showIndoorLamp: false,
  },
  bg_space: {
    rugColor: 0x312e81,
    rugTrimColor: 0x38bdf8,
    skyColor: 0x131138,
    fogColor: 0x131138,
    fogNear: 5.5,
    fogFar: 14,
    hemiSky: 0xa5b4fc,
    hemiGround: 0x1e1b4b,
    hemiIntensity: 1.85,
    keyColor: 0xe0f2fe,
    keyIntensity: 1.65,
    rimColor: 0xc084fc,
    rimIntensity: 1.4,
    showIndoorLamp: false,
  },
  bg_jurassic: {
    rugColor: 0x84cc16,
    rugTrimColor: 0xfde047,
    skyColor: 0xbaf2d8,
    fogColor: 0xd9f99d,
    fogNear: 5.5,
    fogFar: 13.5,
    hemiSky: 0xecfccb,
    hemiGround: 0x3f6212,
    hemiIntensity: 2.6,
    keyColor: 0xfef3c7,
    keyIntensity: 2.2,
    rimColor: 0xfb923c,
    rimIntensity: 0.95,
    showIndoorLamp: false,
  },
  bg_hogwarts: {
    rugColor: 0x581c87,
    rugTrimColor: 0xfde047,
    skyColor: 0x1e103c,
    fogColor: 0x2e1065,
    fogNear: 4.8,
    fogFar: 12.5,
    hemiSky: 0xd8b4fe,
    hemiGround: 0x2e1065,
    hemiIntensity: 1.9,
    keyColor: 0xfef08a,
    keyIntensity: 1.65,
    rimColor: 0xa855f7,
    rimIntensity: 1.35,
    showIndoorLamp: false,
  },
  bg_cyberpunk: {
    rugColor: 0x1e1b4b,
    rugTrimColor: 0x22d3ee,
    skyColor: 0x090d24,
    fogColor: 0x1b1042,
    fogNear: 4.8,
    fogFar: 12.5,
    hemiSky: 0x67e8f9,
    hemiGround: 0x3b0764,
    hemiIntensity: 1.95,
    keyColor: 0x22d3ee,
    keyIntensity: 1.55,
    rimColor: 0xf43f5e,
    rimIntensity: 1.6,
    showIndoorLamp: false,
  },
  bg_city: {
    rugColor: 0x93c5fd,
    rugTrimColor: 0xfef08a,
    skyColor: 0x93d5ff,
    fogColor: 0xe0f2fe,
    fogNear: 6.0,
    fogFar: 14,
    hemiSky: 0xe0f2fe,
    hemiGround: 0x64748b,
    hemiIntensity: 2.65,
    keyColor: 0xfffbeb,
    keyIntensity: 2.15,
    rimColor: 0x60a5fa,
    rimIntensity: 0.95,
    showIndoorLamp: false,
  },
  bg_marvel: {
    rugColor: 0x1e3a8a,
    rugTrimColor: 0x38bdf8,
    skyColor: 0x451a1a,
    fogColor: 0x7c2d12,
    fogNear: 5.0,
    fogFar: 13.0,
    hemiSky: 0xfdba74,
    hemiGround: 0x1e3a8a,
    hemiIntensity: 2.2,
    keyColor: 0xfed7aa,
    keyIntensity: 2.0,
    rimColor: 0x38bdf8,
    rimIntensity: 1.45,
    showIndoorLamp: false,
  },
  bg_dc: {
    rugColor: 0x1e293b,
    rugTrimColor: 0xfacc15,
    skyColor: 0x020617,
    fogColor: 0x0f172a,
    fogNear: 4.5,
    fogFar: 12.0,
    hemiSky: 0x94a3b8,
    hemiGround: 0x020617,
    hemiIntensity: 1.65,
    keyColor: 0xfef08a,
    keyIntensity: 1.55,
    rimColor: 0x64748b,
    rimIntensity: 1.2,
    showIndoorLamp: false,
  },
  bg_halloween: {
    rugColor: 0x4c1d95,
    rugTrimColor: 0xf97316,
    skyColor: 0x1e1b4b,
    fogColor: 0x3b0764,
    fogNear: 4.8,
    fogFar: 12.5,
    hemiSky: 0xfdba74,
    hemiGround: 0x2e1065,
    hemiIntensity: 1.85,
    keyColor: 0xfd9853,
    keyIntensity: 1.7,
    rimColor: 0xa855f7,
    rimIntensity: 1.35,
    showIndoorLamp: false,
  },
  bg_natal: {
    rugColor: 0xbae6fd,
    rugTrimColor: 0xef4444,
    skyColor: 0x0f172a,
    fogColor: 0x1e3a8a,
    fogNear: 5.0,
    fogFar: 13.0,
    hemiSky: 0xe0f2fe,
    hemiGround: 0x1e3a8a,
    hemiIntensity: 2.3,
    keyColor: 0xfffbeb,
    keyIntensity: 1.9,
    rimColor: 0x38bdf8,
    rimIntensity: 1.2,
    showIndoorLamp: false,
  },
};

export interface ThemedEnvironmentsBuildResult {
  groups: Record<string, THREE.Group>;
  floorMeshes: THREE.Object3D[];
  update: (activeBgId: string, dt: number, t: number) => void;
  dispose: () => void;
}

const _snowDummy = new THREE.Object3D();

export function buildNewThemedEnvironments3D(): ThemedEnvironmentsBuildResult {
  const disposableGeos: THREE.BufferGeometry[] = [];
  const disposableMats: THREE.Material[] = [];
  const disposableTex: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposableGeos.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposableMats.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    disposableTex.push(t);
    return t;
  };

  const groups: Record<string, THREE.Group> = {};
  const floorMeshes: THREE.Object3D[] = [];

  const createFloorDisc = (
    radius: number,
    mat: THREE.Material,
    height = 0.022
  ): THREE.Mesh => {
    const geo = trackGeo(
      new THREE.CylinderGeometry(radius, radius + 0.04, height, 48)
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = height * 0.5;
    mesh.userData.miauAction = 'floor';
    floorMeshes.push(mesh);
    return mesh;
  };

  // Shared primitive geos for stars & details
  const smallStarGeo = trackGeo(new THREE.OctahedronGeometry(0.024, 0));

  // =========================================================================
  // 1. VALE JURÁSSICO (bg_jurassic)
  // =========================================================================
  const jurassicEnv = new THREE.Group();
  const jurassicGrassMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.85 })
  );
  const jurassicDarkGrassMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.88 })
  );
  const jurassicFloor = createFloorDisc(1.34, jurassicGrassMat);
  const jurassicOuterRing = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(1.32, 0.032, 10, 48)),
    jurassicDarkGrassMat
  );
  jurassicOuterRing.rotation.x = Math.PI / 2;
  jurassicOuterRing.position.y = 0.022;
  jurassicEnv.add(jurassicFloor, jurassicOuterRing);

  // Warm Jungle Sun
  const jurassicSun = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.15, 22, 20)),
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfde047,
        emissive: 0xfacc15,
        emissiveIntensity: 0.85,
        roughness: 0.3,
      })
    )
  );
  jurassicSun.position.set(-0.68, 1.24, -0.66);
  jurassicEnv.add(jurassicSun);

  // Smoking Volcano on back-right
  const volcanoGroup = new THREE.Group();
  volcanoGroup.position.set(0.84, 0.02, -0.86);
  const volcanoRockMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.92 })
  );
  const volcanoCone = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.09, 0.34, 0.56, 20)),
    volcanoRockMat
  );
  volcanoCone.position.y = 0.28;
  const lavaPoolMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xea580c,
      emissive: 0xf97316,
      emissiveIntensity: 1.15,
      roughness: 0.35,
    })
  );
  const lavaPool = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 16)),
    lavaPoolMat
  );
  lavaPool.position.y = 0.555;
  volcanoGroup.add(volcanoCone, lavaPool);

  const smokeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd6d3d1,
      roughness: 0.95,
      transparent: true,
      opacity: 0.72,
    })
  );
  const smokePuffs: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const puff = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.055 + i * 0.012, 12, 12)),
      smokeMat
    );
    puff.position.set((i % 2 === 0 ? -1 : 1) * 0.02, 0.64 + i * 0.1, 0);
    puff.userData.baseY = 0.62;
    puff.userData.phase = i * 1.5;
    volcanoGroup.add(puff);
    smokePuffs.push(puff);
  }
  jurassicEnv.add(volcanoGroup);

  // Cute 3D Long-Neck Dinosaur (Brachiosaurus)
  const dinoGroup = new THREE.Group();
  dinoGroup.position.set(0.28, 0.02, -0.84);
  dinoGroup.rotation.y = -0.35;
  const dinoSkinMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.7 })
  );
  const dinoBellyMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.65 })
  );
  const dinoBody = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.11, 18, 16)),
    dinoSkinMat
  );
  dinoBody.scale.set(1.35, 0.85, 0.82);
  dinoBody.position.set(0, 0.16, 0);
  const dinoLegGeo = trackGeo(new THREE.CylinderGeometry(0.026, 0.028, 0.14, 10));
  for (const lx of [-0.075, 0.065]) {
    for (const lz of [-0.045, 0.045]) {
      const leg = new THREE.Mesh(dinoLegGeo, dinoSkinMat);
      leg.position.set(lx, 0.07, lz);
      dinoGroup.add(leg);
    }
  }
  const dinoTail = new THREE.Mesh(
    trackGeo(new THREE.ConeGeometry(0.036, 0.22, 10)),
    dinoSkinMat
  );
  dinoTail.rotation.z = -1.25;
  dinoTail.position.set(0.17, 0.17, 0);

  const dinoNeckPivot = new THREE.Group();
  dinoNeckPivot.position.set(-0.08, 0.2, 0);
  const dinoNeck = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.026, 0.04, 0.28, 12)),
    dinoSkinMat
  );
  dinoNeck.position.set(-0.03, 0.12, 0);
  dinoNeck.rotation.z = 0.22;
  const dinoHead = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.042, 14, 14)),
    dinoBellyMat
  );
  dinoHead.scale.set(1.35, 0.85, 0.85);
  dinoHead.position.set(-0.08, 0.26, 0);
  const dinoEyeMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1b1024, roughness: 0.2 })
  );
  const dinoEye = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.008, 8, 8)),
    dinoEyeMat
  );
  dinoEye.position.set(-0.095, 0.275, 0.032);
  dinoNeckPivot.add(dinoNeck, dinoHead, dinoEye);
  dinoGroup.add(dinoBody, dinoTail, dinoNeckPivot);
  jurassicEnv.add(dinoGroup);

  // Wooden Jurassic Gate with twin flaming torches
  const gateGroup = new THREE.Group();
  gateGroup.position.set(-0.84, 0.02, -0.5);
  gateGroup.rotation.y = 0.58;
  const woodDarkMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.88 })
  );
  const woodLightMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.85 })
  );
  const torchFlameMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xfde047,
      emissiveIntensity: 1.25,
      roughness: 0.25,
    })
  );
  const jurassicTorches: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.065, 0.44, 0.065)),
      woodDarkMat
    );
    pillar.position.set(side * 0.19, 0.22, 0);
    const sconce = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.018, 0.012, 0.06, 8)),
      woodLightMat
    );
    sconce.position.set(side * 0.19, 0.26, 0.048);
    const flame = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.022, 0.055, 8)),
      torchFlameMat
    );
    flame.position.set(side * 0.19, 0.305, 0.048);
    jurassicTorches.push(flame);
    gateGroup.add(pillar, sconce, flame);
  }
  const archBar = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.48, 0.075, 0.075)),
    woodLightMat
  );
  archBar.position.set(0, 0.43, 0);
  const archCrest = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.28, 0.055, 0.05)),
    woodDarkMat
  );
  archCrest.position.set(0, 0.485, 0);
  gateGroup.add(archBar, archCrest);
  jurassicEnv.add(gateGroup);

  // Tropical Palms & Ferns around perimeter
  const fernMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xbef264, roughness: 0.65 })
  );
  const palmPositions: [number, number, number][] = [
    [-0.98, 0.02, 0.38],
    [1.04, 0.02, 0.24],
    [-0.36, 0.02, -1.04],
  ];
  for (const [px, py, pz] of palmPositions) {
    const fernCluster = new THREE.Group();
    fernCluster.position.set(px, py, pz);
    for (let f = 0; f < 5; f++) {
      const a = (f / 5) * Math.PI * 2;
      const blade = new THREE.Mesh(
        trackGeo(new THREE.ConeGeometry(0.045, 0.22, 6)),
        f % 2 === 0 ? jurassicGrassMat : fernMat
      );
      blade.position.set(Math.cos(a) * 0.06, 0.08, Math.sin(a) * 0.06);
      blade.rotation.z = -Math.cos(a) * 0.72;
      blade.rotation.x = Math.sin(a) * 0.72;
      fernCluster.add(blade);
    }
    jurassicEnv.add(fernCluster);
  }

  groups['bg_jurassic'] = jurassicEnv;

  // =========================================================================
  // 2. CASTELO DE MAGIA (bg_hogwarts)
  // =========================================================================
  const hogwartsEnv = new THREE.Group();
  const magicStoneMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x3b0764, roughness: 0.88 })
  );
  const magicRuneMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0xc084fc,
      emissiveIntensity: 0.55,
      roughness: 0.4,
    })
  );
  const hogwartsFloor = createFloorDisc(1.34, magicStoneMat);
  const runeRing = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(1.18, 0.014, 8, 48)),
    magicRuneMat
  );
  runeRing.rotation.x = Math.PI / 2;
  runeRing.position.y = 0.024;
  hogwartsEnv.add(hogwartsFloor, runeRing);

  // Full Moon & Stars
  const hogwartsMoon = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.145, 22, 20)),
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xfde047,
        emissiveIntensity: 0.88,
        roughness: 0.35,
      })
    )
  );
  hogwartsMoon.position.set(-0.72, 1.24, -0.64);
  hogwartsEnv.add(hogwartsMoon);

  const magicStarMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfef9c3,
      emissive: 0xfef08a,
      emissiveIntensity: 0.9,
    })
  );
  const hogwartsStars: THREE.Mesh[] = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 1.4 - Math.PI * 0.7;
    const s = new THREE.Mesh(smallStarGeo, magicStarMat);
    s.position.set(
      Math.sin(a) * (0.98 + (i % 3) * 0.12),
      0.7 + ((i * 23) % 7) * 0.09,
      -Math.cos(a) * 0.65 - 0.35
    );
    s.userData.phase = i * 0.8;
    hogwartsEnv.add(s);
    hogwartsStars.push(s);
  }

  // Towering 3-Spire Magic Castle on Cliff
  const castleGroup = new THREE.Group();
  castleGroup.position.set(0.32, 0.02, -0.92);
  const castleWallMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x31105f, roughness: 0.78 })
  );
  const castleRoofMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x4c1d95, roughness: 0.55 })
  );
  const cliffMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.92 })
  );
  const windowGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfde047,
      emissiveIntensity: 1.15,
      roughness: 0.25,
    })
  );
  const cliffBase = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.32, 0.42, 0.14, 14)),
    cliffMat
  );
  cliffBase.position.y = 0.07;
  castleGroup.add(cliffBase);

  const spireSpecs: [number, number, number, number][] = [
    [-0.17, 0.02, 0.07, 0.54],
    [0.0, 0.0, 0.095, 0.46],
    [0.17, -0.02, 0.065, 0.64],
  ];
  for (const [sx, sz, rad, h] of spireSpecs) {
    const tower = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(rad * 0.88, rad, h, 14)),
      castleWallMat
    );
    tower.position.set(sx, 0.14 + h * 0.5, sz);
    const roof = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(rad * 1.18, 0.22, 14)),
      castleRoofMat
    );
    roof.position.set(sx, 0.14 + h + 0.11, sz);
    const win = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.036, 0.068, 0.02)),
      windowGlowMat
    );
    win.position.set(sx, 0.14 + h * 0.72, sz + rad * 0.88);
    castleGroup.add(tower, roof, win);
  }
  hogwartsEnv.add(castleGroup);

  // 6 Floating Magic Candles
  const waxMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.55 })
  );
  const candleFlameMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xfb923c,
      emissiveIntensity: 1.35,
      roughness: 0.2,
    })
  );
  const candleGeo = trackGeo(new THREE.CylinderGeometry(0.016, 0.018, 0.11, 10));
  const flameGeo = trackGeo(new THREE.ConeGeometry(0.015, 0.04, 8));
  const floatingCandles: THREE.Group[] = [];
  const candleCoords: [number, number, number][] = [
    [-0.78, 0.72, -0.32],
    [-0.48, 0.96, -0.58],
    [-0.12, 1.08, -0.68],
    [0.24, 0.94, -0.56],
    [-0.86, 0.86, 0.22],
    [0.54, 1.02, -0.38],
  ];
  candleCoords.forEach(([cx, cy, cz], idx) => {
    const candle = new THREE.Group();
    const wax = new THREE.Mesh(candleGeo, waxMat);
    const flame = new THREE.Mesh(flameGeo, candleFlameMat);
    flame.position.y = 0.075;
    candle.add(wax, flame);
    candle.position.set(cx, cy, cz);
    candle.userData.baseY = cy;
    candle.userData.phase = idx * 1.1;
    candle.userData.flame = flame;
    hogwartsEnv.add(candle);
    floatingCandles.push(candle);
  });

  groups['bg_hogwarts'] = hogwartsEnv;

  // =========================================================================
  // 3. METRÓPOLE CYBERPUNK (bg_cyberpunk)
  // =========================================================================
  const cyberEnv = new THREE.Group();
  const gridCanvas = document.createElement('canvas');
  gridCanvas.width = 512;
  gridCanvas.height = 512;
  const gCtx = gridCanvas.getContext('2d');
  if (gCtx) {
    gCtx.fillStyle = '#0f172a';
    gCtx.fillRect(0, 0, 512, 512);
    gCtx.strokeStyle = '#06b6d4';
    gCtx.lineWidth = 3;
    const step = 32;
    for (let i = 0; i <= 512; i += step) {
      gCtx.beginPath();
      gCtx.moveTo(i, 0);
      gCtx.lineTo(i, 512);
      gCtx.stroke();
      gCtx.beginPath();
      gCtx.moveTo(0, i);
      gCtx.lineTo(512, i);
      gCtx.stroke();
    }
    gCtx.strokeStyle = '#ec4899';
    gCtx.lineWidth = 6;
    gCtx.beginPath();
    gCtx.arc(256, 256, 236, 0, Math.PI * 2);
    gCtx.stroke();
  }
  const cyberGridTex = trackTex(new THREE.CanvasTexture(gridCanvas));
  cyberGridTex.colorSpace = THREE.SRGBColorSpace;
  const cyberFloorMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: cyberGridTex,
      emissive: 0x083344,
      emissiveIntensity: 0.45,
      roughness: 0.35,
      metalness: 0.3,
    })
  );
  const cyberFloor = createFloorDisc(1.36, cyberFloorMat);
  cyberEnv.add(cyberFloor);

  // Synthwave Horizon Sun with scanline cutouts
  const cyberSunGroup = new THREE.Group();
  cyberSunGroup.position.set(0, 0.78, -1.08);
  const cyberSunMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xf43f5e,
      emissiveIntensity: 0.85,
      roughness: 0.3,
    })
  );
  const cyberSun = new THREE.Mesh(
    trackGeo(new THREE.CircleGeometry(0.32, 32)),
    cyberSunMat
  );
  cyberSunGroup.add(cyberSun);
  const scanlineMat = trackMat(
    new THREE.MeshBasicMaterial({ color: 0x090d24 })
  );
  for (let b = 0; b < 3; b++) {
    const bar = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(0.66, 0.022 + b * 0.008)),
      scanlineMat
    );
    bar.position.set(0, -0.05 - b * 0.068, 0.005);
    cyberSunGroup.add(bar);
  }
  cyberEnv.add(cyberSunGroup);

  // Neon Skyscrapers
  const cyberTowerMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.45,
      metalness: 0.35,
    })
  );
  const neonCyanMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x22d3ee,
      emissiveIntensity: 1.35,
    })
  );
  const neonPinkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xec4899,
      emissive: 0xec4899,
      emissiveIntensity: 1.35,
    })
  );
  const cyberBuildings: [number, number, number, number, boolean][] = [
    [-0.95, -0.44, 0.22, 0.78, true],
    [-0.64, -0.82, 0.24, 0.98, false],
    [0.58, -0.86, 0.24, 0.92, true],
    [0.92, -0.52, 0.22, 0.7, false],
  ];
  for (const [bx, bz, w, h, cyan] of cyberBuildings) {
    const bMesh = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(w, h, w * 0.9)),
      cyberTowerMat
    );
    bMesh.position.set(bx, h * 0.5 + 0.02, bz);
    const strip = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.022, h * 0.82, 0.015)),
      cyan ? neonCyanMat : neonPinkMat
    );
    strip.position.set(bx + (bx < 0 ? 0.06 : -0.06), h * 0.52, bz + w * 0.46);
    const antenna = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.006, 0.008, 0.16, 6)),
      cyberTowerMat
    );
    antenna.position.set(bx, h + 0.1, bz);
    cyberEnv.add(bMesh, strip, antenna);
  }

  // Animated Hologram Billboard
  const holoBillboard = new THREE.Group();
  holoBillboard.position.set(-0.88, 0.54, 0.16);
  holoBillboard.rotation.y = 0.92;
  const holoFrame = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.32, 0.2, 0.024)),
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x1e1b4b,
        transparent: true,
        opacity: 0.85,
        roughness: 0.2,
      })
    )
  );
  const holoBorder = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.11, 0.01, 8, 24)),
    neonPinkMat
  );
  holoBorder.position.z = 0.016;
  const holoCore = new THREE.Mesh(
    trackGeo(new THREE.OctahedronGeometry(0.045, 0)),
    neonCyanMat
  );
  holoCore.position.z = 0.032;
  holoBillboard.add(holoFrame, holoBorder, holoCore);
  cyberEnv.add(holoBillboard);

  groups['bg_cyberpunk'] = cyberEnv;

  // =========================================================================
  // 4. CIDADE ENSOLARADA (bg_city)
  // =========================================================================
  const cityEnv = new THREE.Group();
  const sidewalkMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.78 })
  );
  const parkGrassMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.82 })
  );
  const cityFloor = createFloorDisc(1.36, sidewalkMat);
  const cityGrassBorder = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(1.32, 0.045, 10, 48)),
    parkGrassMat
  );
  cityGrassBorder.rotation.x = Math.PI / 2;
  cityGrassBorder.position.y = 0.022;
  cityEnv.add(cityFloor, cityGrassBorder);

  const citySun = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.135, 22, 20)),
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfde047,
        emissive: 0xfacc15,
        emissiveIntensity: 0.88,
      })
    )
  );
  citySun.position.set(0.66, 1.24, -0.66);
  cityEnv.add(citySun);

  const cityCloudMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 })
  );
  const cityClouds: THREE.Group[] = [];
  const cityCloudCoords: [number, number, number][] = [
    [-0.58, 1.16, -0.58],
    [0.08, 1.26, -0.74],
  ];
  cityCloudCoords.forEach(([cx, cy, cz], idx) => {
    const cl = new THREE.Group();
    const p1 = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.085, 12, 12)), cityCloudMat);
    const p2 = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.105, 12, 12)), cityCloudMat);
    p2.position.set(0.08, 0.025, 0);
    const p3 = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.08, 12, 12)), cityCloudMat);
    p3.position.set(0.16, -0.008, 0);
    cl.add(p1, p2, p3);
    cl.position.set(cx, cy, cz);
    cl.userData.baseX = cx;
    cl.userData.phase = idx * 2.2;
    cityEnv.add(cl);
    cityClouds.push(cl);
  });

  // Colorful Urban Towers
  const cityPalette = [0x60a5fa, 0x818cf8, 0x38bdf8, 0xa78bfa];
  const cityWinMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfef9c3,
      emissive: 0xfef08a,
      emissiveIntensity: 0.65,
    })
  );
  const cityTowers: [number, number, number, number][] = [
    [-0.92, -0.48, 0.25, 0.62],
    [-0.48, -0.84, 0.26, 0.86],
    [0.44, -0.86, 0.25, 0.78],
    [0.88, -0.56, 0.24, 0.56],
  ];
  cityTowers.forEach(([bx, bz, w, h], idx) => {
    const bMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: cityPalette[idx % cityPalette.length],
        roughness: 0.52,
      })
    );
    const tower = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(w, h, w * 0.9)),
      bMat
    );
    tower.position.set(bx, h * 0.5 + 0.02, bz);
    cityEnv.add(tower);

    for (let row = 0; row < 2; row++) {
      for (let col = -1; col <= 1; col += 2) {
        const win = new THREE.Mesh(
          trackGeo(new THREE.PlaneGeometry(0.045, 0.065)),
          cityWinMat
        );
        win.position.set(
          bx + col * 0.055,
          h * 0.52 + row * 0.14,
          bz + w * 0.455
        );
        cityEnv.add(win);
      }
    }
  });

  // Park Trees & Streetlamps
  const cityTreeLeafMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.75 })
  );
  const cityTrunkMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.85 })
  );
  for (const [tx, tz] of [
    [-0.96, 0.34],
    [1.02, 0.24],
  ]) {
    const tree = new THREE.Group();
    const tr = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.028, 0.036, 0.22, 10)),
      cityTrunkMat
    );
    tr.position.y = 0.11;
    const lf = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.13, 14, 14)),
      cityTreeLeafMat
    );
    lf.position.y = 0.28;
    tree.add(tr, lf);
    tree.position.set(tx, 0.02, tz);
    cityEnv.add(tree);
  }

  groups['bg_city'] = cityEnv;

  // =========================================================================
  // 5. TORRE DOS HERÓIS (bg_marvel)
  // =========================================================================
  const marvelEnv = new THREE.Group();
  const heroDeckMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e3a8a,
      roughness: 0.4,
      metalness: 0.38,
    })
  );
  const heroReactorMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x7dd3fc,
      emissiveIntensity: 1.25,
      roughness: 0.2,
    })
  );
  const marvelFloor = createFloorDisc(1.36, heroDeckMat);
  const marvelTrim = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(1.25, 0.015, 8, 48)),
    heroReactorMat
  );
  marvelTrim.rotation.x = Math.PI / 2;
  marvelTrim.position.y = 0.024;
  marvelEnv.add(marvelFloor, marvelTrim);

  // Heroic Sunset Orb
  const heroSunset = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.24, 24, 20)),
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfb923c,
        emissive: 0xea580c,
        emissiveIntensity: 0.72,
        roughness: 0.35,
      })
    )
  );
  heroSunset.position.set(0, 0.82, -1.08);
  marvelEnv.add(heroSunset);

  // Iconic Angled Hero Tower on right-back
  const heroTowerGroup = new THREE.Group();
  heroTowerGroup.position.set(0.46, 0.02, -0.84);
  const sleekNavyMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.55,
    })
  );
  const towerShaft = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.11, 0.2, 0.96, 6)),
    sleekNavyMat
  );
  towerShaft.position.y = 0.48;
  const landingPad = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.28, 0.045, 0.18)),
    heroReactorMat
  );
  landingPad.position.set(-0.08, 0.68, 0.06);
  const arcCore = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.065, 0.014, 10, 24)),
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xe0f2fe,
        emissive: 0x38bdf8,
        emissiveIntensity: 1.5,
      })
    )
  );
  arcCore.position.set(-0.08, 0.68, 0.16);
  heroTowerGroup.add(towerShaft, landingPad, arcCore);
  marvelEnv.add(heroTowerGroup);

  // Flanking skyline blocks on left
  for (const [bx, bz, w, h] of [
    [-0.92, -0.5, 0.24, 0.54],
    [-0.58, -0.82, 0.22, 0.42],
  ]) {
    const sideTower = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(w, h, w * 0.9)),
      sleekNavyMat
    );
    sideTower.position.set(bx, h * 0.5 + 0.02, bz);
    marvelEnv.add(sideTower);
  }

  // Hero Energy Streaks
  const goldStreakMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xfde047,
      emissiveIntensity: 1.15,
    })
  );
  const redStreakMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xf87171,
      emissiveIntensity: 1.1,
    })
  );
  const heroStreaks: THREE.Mesh[] = [];
  const streak1 = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.012, 0.52, 4, 8)),
    goldStreakMat
  );
  streak1.position.set(-0.48, 1.06, -0.68);
  streak1.rotation.z = -1.25;
  const streak2 = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.01, 0.42, 4, 8)),
    redStreakMat
  );
  streak2.position.set(-0.42, 0.96, -0.64);
  streak2.rotation.z = -1.25;
  marvelEnv.add(streak1, streak2);
  heroStreaks.push(streak1, streak2);

  groups['bg_marvel'] = marvelEnv;

  // =========================================================================
  // 6. NOITE EM GOTHAM (bg_dc)
  // =========================================================================
  const dcEnv = new THREE.Group();
  const gothamStoneMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.82 })
  );
  const dcFloor = createFloorDisc(1.36, gothamStoneMat);
  dcEnv.add(dcFloor);

  // Full Moon with Bat Emblem
  const dcMoonGroup = new THREE.Group();
  dcMoonGroup.position.set(0.42, 1.2, -0.82);
  const dcMoon = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.18, 24, 20)),
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xfde047,
        emissiveIntensity: 0.95,
        roughness: 0.3,
      })
    )
  );
  dcMoon.scale.set(1, 1, 0.35);
  const batBlackMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.6 })
  );
  const batCenter = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.032, 10, 10)),
    batBlackMat
  );
  batCenter.scale.set(1.2, 0.85, 0.5);
  batCenter.position.z = 0.068;
  const batLeftWing = new THREE.Mesh(
    trackGeo(new THREE.ConeGeometry(0.042, 0.11, 4)),
    batBlackMat
  );
  batLeftWing.rotation.z = Math.PI / 2;
  batLeftWing.position.set(-0.06, 0.005, 0.068);
  const batRightWing = new THREE.Mesh(
    trackGeo(new THREE.ConeGeometry(0.042, 0.11, 4)),
    batBlackMat
  );
  batRightWing.rotation.z = -Math.PI / 2;
  batRightWing.position.set(0.06, 0.005, 0.068);
  dcMoonGroup.add(dcMoon, batCenter, batLeftWing, batRightWing);
  dcEnv.add(dcMoonGroup);

  // Sweeping Bat-Signal Spotlight Cone
  const signalPivot = new THREE.Group();
  signalPivot.position.set(-0.76, 0.56, -0.62);
  const projectorHousing = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.045, 0.055, 0.09, 12)),
    gothamStoneMat
  );
  const beamMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  const beamCone = new THREE.Mesh(
    trackGeo(new THREE.ConeGeometry(0.24, 1.35, 20, 1, true)),
    beamMat
  );
  beamCone.position.set(0, 0.68, 0);
  beamCone.rotation.x = Math.PI;
  signalPivot.add(projectorHousing, beamCone);
  signalPivot.rotation.z = -0.68;
  dcEnv.add(signalPivot);

  // Gothic Art-Deco Skyscrapers
  const gothamWindowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xeab308,
      emissiveIntensity: 0.85,
    })
  );
  const gothamSpireData: [number, number, number, number, boolean][] = [
    [-0.92, -0.48, 0.22, 0.68, true],
    [-0.64, -0.78, 0.22, 0.54, false],
    [0.54, -0.84, 0.24, 0.58, false],
    [0.88, -0.54, 0.22, 0.78, true],
  ];
  for (const [bx, bz, w, h, hasSpire] of gothamSpireData) {
    const tower = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(w, h, w * 0.9)),
      gothamStoneMat
    );
    tower.position.set(bx, h * 0.5 + 0.02, bz);
    dcEnv.add(tower);
    if (hasSpire) {
      const spire = new THREE.Mesh(
        trackGeo(new THREE.ConeGeometry(w * 0.62, 0.24, 4)),
        gothamStoneMat
      );
      spire.rotation.y = Math.PI / 4;
      spire.position.set(bx, h + 0.14, bz);
      dcEnv.add(spire);
    }
    const litWin = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(0.04, 0.06)),
      gothamWindowMat
    );
    litWin.position.set(bx, h * 0.72, bz + w * 0.455);
    dcEnv.add(litWin);
  }

  groups['bg_dc'] = dcEnv;

  // =========================================================================
  // 7. NOITE DE HALLOWEEN (bg_halloween)
  // =========================================================================
  const halloweenEnv = new THREE.Group();
  const hauntedHillMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x3b0764, roughness: 0.9 })
  );
  const halloweenFloor = createFloorDisc(1.36, hauntedHillMat);
  halloweenEnv.add(halloweenFloor);

  // Giant Spooky Peach Moon
  const spookyMoon = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.21, 24, 20)),
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfed7aa,
        emissive: 0xfb923c,
        emissiveIntensity: 0.65,
        roughness: 0.35,
      })
    )
  );
  spookyMoon.position.set(0.56, 1.18, -0.78);
  halloweenEnv.add(spookyMoon);

  // Cute Haunted Manor House
  const manorGroup = new THREE.Group();
  manorGroup.position.set(-0.82, 0.02, -0.58);
  manorGroup.rotation.y = 0.52;
  const manorMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x2e1065, roughness: 0.85 })
  );
  const pumpkinOrangeMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.6 })
  );
  const pumpkinGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf97316,
      emissiveIntensity: 1.25,
    })
  );
  const manorBody = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.32, 0.36, 0.26)),
    manorMat
  );
  manorBody.position.y = 0.18;
  const manorRoof = new THREE.Mesh(
    trackGeo(new THREE.ConeGeometry(0.26, 0.26, 4)),
    manorMat
  );
  manorRoof.rotation.y = Math.PI / 4;
  manorRoof.position.y = 0.49;
  for (const wx of [-0.07, 0.07]) {
    const win = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.055, 0.075, 0.02)),
      pumpkinGlowMat
    );
    win.position.set(wx, 0.22, 0.132);
    manorGroup.add(win);
  }
  halloweenEnv.add(manorGroup);
  manorGroup.add(manorBody, manorRoof);

  // Carved Jack-o'-Lantern Pumpkins
  const pumpkinStemMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8 })
  );
  const pumpkinCoords: [number, number, number, number][] = [
    [0.86, 0.02, -0.62, 1.05],
    [-0.96, 0.02, 0.28, 0.9],
    [0.92, 0.02, 0.34, 0.82],
  ];
  for (const [px, py, pz, s] of pumpkinCoords) {
    const pGroup = new THREE.Group();
    const pBody = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.085, 16, 14)),
      pumpkinOrangeMat
    );
    pBody.scale.set(1.15, 0.82, 1.15);
    pBody.position.y = 0.07;
    const pStem = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.012, 0.018, 0.04, 8)),
      pumpkinStemMat
    );
    pStem.position.y = 0.145;
    for (const ex of [-0.028, 0.028]) {
      const eye = new THREE.Mesh(
        trackGeo(new THREE.ConeGeometry(0.014, 0.022, 3)),
        pumpkinGlowMat
      );
      eye.position.set(ex, 0.085, 0.09);
      pGroup.add(eye);
    }
    const grin = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.052, 0.016, 0.015)),
      pumpkinGlowMat
    );
    grin.position.set(0, 0.052, 0.092);
    pGroup.add(pBody, pStem, grin);
    pGroup.position.set(px, py, pz);
    pGroup.scale.setScalar(s);
    pGroup.lookAt(0, py, 0);
    halloweenEnv.add(pGroup);
  }

  // Animated Flying Bats
  const batMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.65 })
  );
  const flyingBats: Array<{
    pivot: THREE.Group;
    leftWing: THREE.Mesh;
    rightWing: THREE.Mesh;
    radius: number;
    speed: number;
    baseY: number;
    phase: number;
  }> = [];
  for (let i = 0; i < 3; i++) {
    const pivot = new THREE.Group();
    const bBody = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.022, 10, 10)),
      batMat
    );
    bBody.scale.set(0.8, 0.8, 1.4);
    const wingGeo = trackGeo(new THREE.BoxGeometry(0.075, 0.008, 0.04));
    const leftWing = new THREE.Mesh(wingGeo, batMat);
    leftWing.position.set(-0.045, 0, 0);
    const rightWing = new THREE.Mesh(wingGeo, batMat);
    rightWing.position.set(0.045, 0, 0);
    pivot.add(bBody, leftWing, rightWing);
    halloweenEnv.add(pivot);
    flyingBats.push({
      pivot,
      leftWing,
      rightWing,
      radius: 0.55 + i * 0.16,
      speed: 0.75 + i * 0.22,
      baseY: 0.92 + i * 0.14,
      phase: i * 2.1,
    });
  }

  groups['bg_halloween'] = halloweenEnv;

  // =========================================================================
  // 8. VILA DE NATAL (bg_natal)
  // =========================================================================
  const natalEnv = new THREE.Group();
  const snowFloorMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.78 })
  );
  const snowMoundMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.82 })
  );
  const natalFloor = createFloorDisc(1.38, snowFloorMat);
  natalEnv.add(natalFloor);

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const mound = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.16, 14, 10)),
      snowMoundMat
    );
    mound.scale.set(1.4, 0.36, 1.1);
    mound.position.set(Math.cos(a) * 1.18, 0.015, Math.sin(a) * 1.18);
    natalEnv.add(mound);
  }

  // Hero Decorated Christmas Tree (left-back, balancing right statusCard)
  const buildTree = (scale = 1): THREE.Group => {
    const tree = new THREE.Group();
    const xmasTrunkMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 })
    );
    const pineTiers = [
      { y: 0.26, r: 0.24, h: 0.28, color: 0x166534 },
      { y: 0.44, r: 0.19, h: 0.26, color: 0x15803d },
      { y: 0.6, r: 0.14, h: 0.22, color: 0x16a34a },
    ];
    const tTrunk = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.042, 0.054, 0.16, 10)),
      xmasTrunkMat
    );
    tTrunk.position.y = 0.08;
    tree.add(tTrunk);

    for (const tier of pineTiers) {
      const cone = new THREE.Mesh(
        trackGeo(new THREE.ConeGeometry(tier.r, tier.h, 16)),
        trackMat(
          new THREE.MeshStandardMaterial({ color: tier.color, roughness: 0.72 })
        )
      );
      cone.position.y = tier.y;
      tree.add(cone);
    }

    const starTopper = new THREE.Mesh(
      trackGeo(new THREE.OctahedronGeometry(0.052, 0)),
      trackMat(
        new THREE.MeshStandardMaterial({
          color: 0xfacc15,
          emissive: 0xfde047,
          emissiveIntensity: 1.25,
          roughness: 0.2,
          metalness: 0.4,
        })
      )
    );
    starTopper.position.y = 0.75;
    tree.add(starTopper);

    const ornColors = [0xef4444, 0xfde047, 0x38bdf8, 0xf472b6];
    for (let o = 0; o < 10; o++) {
      const oa = (o / 10) * Math.PI * 2 + o * 0.4;
      const tierFrac = (o % 3) * 0.16;
      const rad = 0.21 - tierFrac * 0.48;
      const orn = new THREE.Mesh(
        trackGeo(new THREE.SphereGeometry(0.022, 10, 10)),
        trackMat(
          new THREE.MeshStandardMaterial({
            color: ornColors[o % ornColors.length],
            emissive: ornColors[o % ornColors.length],
            emissiveIntensity: 0.35,
            metalness: 0.55,
            roughness: 0.2,
          })
        )
      );
      orn.position.set(
        Math.cos(oa) * rad,
        0.22 + tierFrac * 1.15,
        Math.sin(oa) * rad
      );
      tree.add(orn);
    }
    tree.scale.setScalar(scale);
    return tree;
  };

  const mainTree = buildTree(1.08);
  mainTree.position.set(-0.78, 0.02, -0.58);
  const sideTree = buildTree(0.76);
  sideTree.position.set(0.32, 0.02, -0.92);
  natalEnv.add(mainTree, sideTree);

  // Wrapped 3D Gift Boxes with Ribbons
  const giftSpecs: Array<{
    pos: [number, number, number];
    size: [number, number, number];
    boxColor: number;
    ribbonColor: number;
    rotY: number;
  }> = [
    {
      pos: [-0.94, 0.02, -0.26],
      size: [0.14, 0.12, 0.14],
      boxColor: 0xef4444,
      ribbonColor: 0xfacc15,
      rotY: 0.35,
    },
    {
      pos: [-0.88, 0.02, -0.06],
      size: [0.11, 0.095, 0.11],
      boxColor: 0x22c55e,
      ribbonColor: 0xffffff,
      rotY: -0.25,
    },
    {
      pos: [0.56, 0.02, -0.78],
      size: [0.12, 0.1, 0.12],
      boxColor: 0x38bdf8,
      ribbonColor: 0xfacc15,
      rotY: 0.45,
    },
  ];
  for (const g of giftSpecs) {
    const gift = new THREE.Group();
    const boxMat = trackMat(
      new THREE.MeshStandardMaterial({ color: g.boxColor, roughness: 0.45 })
    );
    const ribMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: g.ribbonColor,
        roughness: 0.3,
        metalness: 0.25,
      })
    );
    const [w, h, d] = g.size;
    const boxMesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(w, h, d)), boxMat);
    boxMesh.position.y = h * 0.5;
    const rib1 = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(w * 1.04, h * 1.03, 0.024)),
      ribMat
    );
    rib1.position.y = h * 0.5;
    const rib2 = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.024, h * 1.03, d * 1.04)),
      ribMat
    );
    rib2.position.y = h * 0.5;
    const bow = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.022, 10, 10)),
      ribMat
    );
    bow.position.y = h + 0.015;
    gift.add(boxMesh, rib1, rib2, bow);
    gift.position.set(...g.pos);
    gift.rotation.y = g.rotY;
    natalEnv.add(gift);
  }

  // Animated Falling 3D Snowflakes (InstancedMesh, zero per-frame allocations)
  const SNOW_COUNT = 72;
  const snowFlakeGeo = trackGeo(new THREE.OctahedronGeometry(0.014, 0));
  const snowFlakeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xe0f2fe,
      emissiveIntensity: 0.5,
      roughness: 0.2,
    })
  );
  const snowInstanced = new THREE.InstancedMesh(
    snowFlakeGeo,
    snowFlakeMat,
    SNOW_COUNT
  );
  snowInstanced.frustumCulled = false;
  snowInstanced.xb = { pointerEvents: 'none' };
  const snowData: Array<{
    x: number;
    y: number;
    z: number;
    speed: number;
    phase: number;
    scale: number;
  }> = [];
  for (let i = 0; i < SNOW_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const rad = Math.sqrt(Math.random()) * 1.32;
    const item = {
      x: Math.cos(angle) * rad,
      y: 0.08 + Math.random() * 1.55,
      z: Math.sin(angle) * rad - 0.15,
      speed: 0.22 + Math.random() * 0.24,
      phase: Math.random() * Math.PI * 2,
      scale: 0.65 + Math.random() * 0.65,
    };
    snowData.push(item);
    _snowDummy.position.set(item.x, item.y, item.z);
    _snowDummy.scale.setScalar(item.scale);
    _snowDummy.updateMatrix();
    snowInstanced.setMatrixAt(i, _snowDummy.matrix);
  }
  snowInstanced.instanceMatrix.needsUpdate = true;
  natalEnv.add(snowInstanced);

  groups['bg_natal'] = natalEnv;

  // =========================================================================
  // Per-frame Ambient Animations (Zero GC allocations)
  // =========================================================================
  const update = (activeBgId: string, dt: number, t: number): void => {
    if (activeBgId === 'bg_jurassic') {
      dinoNeckPivot.rotation.z = Math.sin(t * 1.2) * 0.08;
      dinoTail.rotation.y = Math.sin(t * 1.5) * 0.14;
      for (let i = 0; i < smokePuffs.length; i++) {
        const puff = smokePuffs[i];
        const cycle = ((t * 0.45 + (puff.userData.phase as number)) % 1 + 1) % 1;
        puff.position.y = 0.58 + cycle * 0.42;
        puff.position.x = Math.sin(t * 1.3 + i) * 0.035;
        const s = 0.65 + cycle * 0.85;
        puff.scale.setScalar(s);
      }
      for (let i = 0; i < jurassicTorches.length; i++) {
        const fl = jurassicTorches[i];
        fl.scale.y = 0.85 + Math.sin(t * 9 + i * 2) * 0.25;
      }
    } else if (activeBgId === 'bg_hogwarts') {
      for (const candle of floatingCandles) {
        const baseY = candle.userData.baseY as number;
        const phase = candle.userData.phase as number;
        candle.position.y = baseY + Math.sin(t * 1.4 + phase) * 0.045;
        const flame = candle.userData.flame as THREE.Mesh | undefined;
        if (flame) {
          flame.scale.set(
            0.9 + Math.sin(t * 8 + phase) * 0.12,
            0.9 + Math.cos(t * 10 + phase) * 0.22,
            0.9 + Math.sin(t * 8 + phase) * 0.12
          );
        }
      }
      for (const star of hogwartsStars) {
        const ph = star.userData.phase as number;
        star.scale.setScalar(0.75 + 0.35 * Math.sin(t * 1.9 + ph));
        star.rotation.y += dt * 0.6;
      }
    } else if (activeBgId === 'bg_cyberpunk') {
      holoBillboard.position.y = 0.54 + Math.sin(t * 1.5) * 0.035;
      holoCore.rotation.y += dt * 1.8;
      holoCore.rotation.x += dt * 0.9;
    } else if (activeBgId === 'bg_city') {
      citySun.rotation.y += dt * 0.3;
      for (const cl of cityClouds) {
        cl.position.x =
          (cl.userData.baseX as number) +
          Math.sin(t * 0.35 + (cl.userData.phase as number)) * 0.14;
      }
    } else if (activeBgId === 'bg_marvel') {
      arcCore.rotation.z += dt * 1.4;
      const pulse = 1 + Math.sin(t * 3.0) * 0.12;
      arcCore.scale.setScalar(pulse);
      for (let i = 0; i < heroStreaks.length; i++) {
        heroStreaks[i].position.x = -0.52 + Math.sin(t * 1.8 + i) * 0.08;
      }
    } else if (activeBgId === 'bg_dc') {
      signalPivot.rotation.z = -0.68 + Math.sin(t * 0.65) * 0.18;
      signalPivot.rotation.x = Math.cos(t * 0.45) * 0.08;
    } else if (activeBgId === 'bg_halloween') {
      for (const bat of flyingBats) {
        const ang = t * bat.speed + bat.phase;
        bat.pivot.position.set(
          Math.cos(ang) * bat.radius,
          bat.baseY + Math.sin(t * 2.4 + bat.phase) * 0.06,
          Math.sin(ang) * bat.radius * 0.65 - 0.35
        );
        bat.pivot.rotation.y = -ang;
        const flap = Math.sin(t * 11 + bat.phase) * 0.55;
        bat.leftWing.rotation.z = flap;
        bat.rightWing.rotation.z = -flap;
      }
    } else if (activeBgId === 'bg_natal') {
      for (let i = 0; i < SNOW_COUNT; i++) {
        const flake = snowData[i];
        flake.y -= flake.speed * dt;
        if (flake.y < 0.04) {
          flake.y = 1.62;
        }
        const swayX = Math.sin(t * 1.3 + flake.phase) * 0.045;
        _snowDummy.position.set(flake.x + swayX, flake.y, flake.z);
        _snowDummy.rotation.y = t * 1.2 + flake.phase;
        _snowDummy.scale.setScalar(flake.scale);
        _snowDummy.updateMatrix();
        snowInstanced.setMatrixAt(i, _snowDummy.matrix);
      }
      snowInstanced.instanceMatrix.needsUpdate = true;
    }
  };

  const dispose = (): void => {
    for (const g of disposableGeos) g.dispose();
    for (const m of disposableMats) m.dispose();
    for (const tex of disposableTex) tex.dispose();
  };

  return { groups, floorMeshes, update, dispose };
}
