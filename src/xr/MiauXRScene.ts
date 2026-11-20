import * as THREE from 'three';
import * as xb from 'xrblocks';
import type { EquippedItems, PetStats } from '../types';

export interface MiauXRCallbacks {
  onPet: () => void;
  onFeed: () => void;
  onClean: () => void;
  onPlay: () => void;
  onToggleSleep: () => void;
  onExitXRMode: () => void;
}

class InteractiveProp extends xb.Script {
  private hoverScale = 1;
  private popTimer = 0;

  constructor(
    name: string,
    private content: THREE.Object3D,
    private onInteract: () => void,
    private baseScale = 1
  ) {
    super();
    this.name = name;
    this.add(content);
    this.scale.setScalar(baseScale);
  }

  triggerPop(): void {
    this.popTimer = 0.45;
  }

  onHoverEnter(): void {
    this.hoverScale = 1.12;
  }

  onHoverExit(): void {
    this.hoverScale = 1;
  }

  onObjectSelectStart(event: xb.SelectEvent): void {
    this.triggerPop();
    this.onInteract();
    event.stopPropagation();
  }

  update(): void {
    const dt = Math.min(xb.getDeltaTime(), 0.05);
    let popBoost = 0;
    if (this.popTimer > 0) {
      this.popTimer = Math.max(0, this.popTimer - dt);
      popBoost = Math.sin((this.popTimer / 0.45) * Math.PI) * 0.18;
    }
    const target = this.baseScale * (this.hoverScale + popBoost);
    const next = THREE.MathUtils.damp(this.scale.x, target, 12, dt);
    this.scale.setScalar(next);
  }
}

// Reusable math objects to avoid per-frame allocations in update()
const _gyroEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _gyroDeviceQuat = new THREE.Quaternion();
const _gyroScreenFix = new THREE.Quaternion(
  -Math.sqrt(0.5),
  0,
  0,
  Math.sqrt(0.5)
);
const _gyroScreenOri = new THREE.Quaternion();
const _gyroTargetQuat = new THREE.Quaternion();
const _moveForward = new THREE.Vector3();
const _moveRight = new THREE.Vector3();
const _desiredPos = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);
const _zAxis = new THREE.Vector3(0, 0, 1);

export class MiauXRScene extends xb.Script {
  private stageRoot = new THREE.Group();
  private petGroup = new THREE.Group();
  private tailGroup = new THREE.Group();
  private leftEyeMesh?: THREE.Mesh;
  private rightEyeMesh?: THREE.Mesh;

  // Hats
  private hatGroups: Record<string, THREE.Group> = {};
  // Accessories
  private accGroups: Record<string, THREE.Group> = {};

  // Themed 3D Environments
  private envGroups: Record<string, THREE.Group> = {};
  private activeBackgroundId = 'bg_lilac';
  private rugMat?: THREE.MeshStandardMaterial;
  private rugTrimMat?: THREE.MeshStandardMaterial;
  private lampGroup = new THREE.Group();
  private sunGroup = new THREE.Group();
  private cloudGroups: THREE.Group[] = [];
  private starMeshes: THREE.Mesh[] = [];
  private yarnProp?: InteractiveProp;
  private activeBubbles: Array<{ mesh: THREE.Mesh; life: number; vy: number }> =
    [];
  private bubbleGeo = new THREE.SphereGeometry(0.022, 12, 12);
  private bubbleMat = new THREE.MeshStandardMaterial({
    color: 0xbae6fd,
    roughness: 0.1,
    metalness: 0.1,
    transparent: true,
    opacity: 0.65,
  });

  // Spatial UI
  private statusCard?: xb.UICard;
  private statsLabel?: xb.UIText;
  private speechLabel?: xb.UIText;
  private bounceTime = 0;
  private isSleeping = false;

  // Gyroscope navigation state
  private gyroEnabled = false;
  private gyroCalibrated = false;
  private gyroBaseQuat = new THREE.Quaternion();
  private gyroCameraBaseQuat = new THREE.Quaternion();
  private currentDeviceQuat = new THREE.Quaternion();
  private hasDeviceReading = false;
  private gyroListener = (e: DeviceOrientationEvent) =>
    this.onDeviceOrientation(e);

  // Movement state (from mobile HUD D-pad)
  private moveInput = { forward: 0, right: 0 };

  constructor(private callbacks: MiauXRCallbacks) {
    super();
  }

  init(): void {
    this.add(new THREE.HemisphereLight(0xfef9ff, 0x6d4ea3, 2.7));
    const keyLight = new THREE.DirectionalLight(0xfff8ed, 1.9);
    keyLight.position.set(1.6, 3.4, 2.1);
    this.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xc4b5fd, 0.95);
    rimLight.position.set(-1.8, 2.2, -2.4);
    this.add(rimLight);

    this.stageRoot.position.set(0, 0.72, -1.25);
    this.add(this.stageRoot);

    this.buildCozyRoomStage();
    this.buildThemedEnvironments();
    this.buildMiau3D();
    this.buildInteractiveProps();
    this.buildSpatialCard();
    this.applyBackgroundTheme(this.activeBackgroundId);
  }

  private buildCozyRoomStage(): void {
    // Ground rug + decorative trim
    this.rugMat = new THREE.MeshStandardMaterial({
      color: 0xd8b4fe,
      roughness: 0.85,
    });
    const rug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 0.98, 0.024, 48),
      this.rugMat
    );
    rug.position.y = 0.012;

    this.rugTrimMat = new THREE.MeshStandardMaterial({
      color: 0xfef9c3,
      roughness: 0.7,
    });
    const rugTrim = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.018, 12, 48),
      this.rugTrimMat
    );
    rugTrim.rotation.x = Math.PI / 2;
    rugTrim.position.y = 0.02;

    // Plush cat bed cushion under Miau
    const bedGroup = new THREE.Group();
    bedGroup.position.set(-0.22, 0.028, 0.08);
    const bedMat = new THREE.MeshStandardMaterial({
      color: 0xf3e8ff,
      roughness: 0.82,
    });
    const cushionMat = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      roughness: 0.78,
    });
    const bedBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.34, 0.05, 32),
      bedMat
    );
    bedBase.position.y = 0.025;
    const bedRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.055, 16, 36),
      cushionMat
    );
    bedRim.rotation.x = Math.PI / 2;
    bedRim.position.y = 0.05;
    bedGroup.add(bedBase, bedRim);

    // Hanging warm ceiling lamp
    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.55, 8),
      new THREE.MeshStandardMaterial({ color: 0x3b1f6e, roughness: 0.6 })
    );
    cord.position.y = 0.28;
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.14, 24, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0xfde68a,
        roughness: 0.45,
        side: THREE.DoubleSide,
      })
    );
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xfde047,
        emissiveIntensity: 0.9,
      })
    );
    bulb.position.y = -0.05;
    this.lampGroup.add(cord, shade, bulb);
    this.lampGroup.position.set(-0.22, 1.38, 0.05);

    this.stageRoot.add(rug, rugTrim, bedGroup, this.lampGroup);
  }

  private buildThemedEnvironments(): void {
    // 1. Lilac Room
    const lilacEnv = new THREE.Group();
    const lilMat = new THREE.MeshStandardMaterial({
      color: 0xe9d5ff,
      emissive: 0xc084fc,
      emissiveIntensity: 0.22,
      roughness: 0.4,
    });
    for (let i = 0; i < 6; i++) {
      const star = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.04, 0),
        lilMat
      );
      const angle = (i / 6) * Math.PI * 2;
      star.position.set(
        Math.cos(angle) * 0.92,
        0.55 + (i % 2) * 0.28,
        Math.sin(angle) * 0.45 - 0.35
      );
      lilacEnv.add(star);
    }
    this.envGroups['bg_lilac'] = lilacEnv;
    this.stageRoot.add(lilacEnv);

    // 2. Noite Estrelada (Moon + Twinkling Stars + Night Clouds)
    const nightEnv = new THREE.Group();
    const moonMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfde047,
      emissiveIntensity: 0.85,
      roughness: 0.35,
    });
    const moonGroup = new THREE.Group();
    moonGroup.position.set(0.68, 1.18, -0.58);
    const moonDisc = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 24, 24),
      moonMat
    );
    moonDisc.scale.set(1, 1, 0.45);
    const moonHalo = new THREE.Mesh(
      new THREE.RingGeometry(0.19, 0.25, 32),
      new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      })
    );
    moonGroup.add(moonDisc, moonHalo);
    nightEnv.add(moonGroup);

    const starMat = new THREE.MeshStandardMaterial({
      color: 0xfef9c3,
      emissive: 0xfef08a,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    });
    const starGeo = new THREE.OctahedronGeometry(0.028, 0);
    for (let i = 0; i < 28; i++) {
      const star = new THREE.Mesh(starGeo, starMat);
      const a = (i / 28) * Math.PI * 1.6 - Math.PI * 0.8;
      const r = 0.85 + (i % 4) * 0.18;
      star.position.set(
        Math.sin(a) * r,
        0.52 + ((i * 37) % 10) * 0.09,
        -Math.cos(a) * 0.65 - 0.22
      );
      star.userData.phase = i * 0.7;
      nightEnv.add(star);
      this.starMeshes.push(star);
    }
    this.envGroups['bg_night'] = nightEnv;
    this.stageRoot.add(nightEnv);

    // 3. Dia Ensolarado (Grass + Cartoon Tree + Clouds + Sun)
    const sunnyEnv = new THREE.Group();
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      roughness: 0.85,
    });
    const meadow = new THREE.Mesh(
      new THREE.CylinderGeometry(1.12, 1.18, 0.032, 48),
      grassMat
    );
    meadow.position.y = 0.016;
    sunnyEnv.add(meadow);

    // Stylized Cartoon Tree
    const treeGroup = new THREE.Group();
    treeGroup.position.set(-0.78, 0.02, -0.32);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x92400e,
      roughness: 0.88,
    });
    const leafLight = new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      roughness: 0.7,
    });
    const leafDark = new THREE.MeshStandardMaterial({
      color: 0x16a34a,
      roughness: 0.75,
    });
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.08, 0.48, 12),
      trunkMat
    );
    trunk.position.y = 0.24;
    const canopy1 = new THREE.Mesh(
      new THREE.SphereGeometry(0.21, 18, 16),
      leafDark
    );
    canopy1.position.set(-0.11, 0.52, 0);
    const canopy2 = new THREE.Mesh(
      new THREE.SphereGeometry(0.19, 18, 16),
      leafDark
    );
    canopy2.position.set(0.12, 0.5, 0.04);
    const canopyTop = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 18, 16),
      leafLight
    );
    canopyTop.position.set(0, 0.68, 0);
    const blossomMat = new THREE.MeshStandardMaterial({
      color: 0xfb7185,
      roughness: 0.4,
    });
    const blossom1 = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 10, 10),
      blossomMat
    );
    blossom1.position.set(0.11, 0.62, 0.19);
    const blossom2 = new THREE.Mesh(
      new THREE.SphereGeometry(0.026, 10, 10),
      blossomMat
    );
    blossom2.position.set(-0.14, 0.56, 0.16);
    treeGroup.add(trunk, canopy1, canopy2, canopyTop, blossom1, blossom2);
    sunnyEnv.add(treeGroup);

    // Sun with Rays
    const sunCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 24, 24),
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xfde047,
        emissiveIntensity: 0.95,
        roughness: 0.25,
      })
    );
    this.sunGroup.add(sunCore);
    const rayGeo = new THREE.ConeGeometry(0.025, 0.08, 8);
    const rayMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfde047,
      emissiveIntensity: 0.7,
    });
    for (let i = 0; i < 8; i++) {
      const ray = new THREE.Mesh(rayGeo, rayMat);
      const angle = (i / 8) * Math.PI * 2;
      ray.position.set(Math.cos(angle) * 0.21, Math.sin(angle) * 0.21, 0);
      ray.rotation.z = angle - Math.PI / 2;
      this.sunGroup.add(ray);
    }
    this.sunGroup.position.set(0.68, 1.22, -0.58);
    sunnyEnv.add(this.sunGroup);

    // Fluffy 3D Clouds
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
    });
    const cloudPositions = [
      new THREE.Vector3(-0.55, 1.15, -0.52),
      new THREE.Vector3(0.12, 1.28, -0.68),
    ];
    cloudPositions.forEach((pos, idx) => {
      const cloud = new THREE.Group();
      const puff1 = new THREE.Mesh(
        new THREE.SphereGeometry(0.095, 14, 14),
        cloudMat
      );
      const puff2 = new THREE.Mesh(
        new THREE.SphereGeometry(0.115, 14, 14),
        cloudMat
      );
      puff2.position.set(0.09, 0.03, 0);
      const puff3 = new THREE.Mesh(
        new THREE.SphereGeometry(0.085, 14, 14),
        cloudMat
      );
      puff3.position.set(0.19, -0.01, 0);
      cloud.add(puff1, puff2, puff3);
      cloud.position.copy(pos);
      cloud.userData.baseX = pos.x;
      cloud.userData.phase = idx * 2.1;
      sunnyEnv.add(cloud);
      this.cloudGroups.push(cloud);
    });

    this.envGroups['bg_sunny'] = sunnyEnv;
    this.stageRoot.add(sunnyEnv);

    // 4. Tarde Pêssego
    const peachEnv = new THREE.Group();
    const sunsetOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 24, 24),
      new THREE.MeshStandardMaterial({
        color: 0xfb923c,
        emissive: 0xfdba74,
        emissiveIntensity: 0.65,
      })
    );
    sunsetOrb.position.set(0.62, 1.1, -0.6);
    peachEnv.add(sunsetOrb);
    this.envGroups['bg_peach'] = peachEnv;
    this.stageRoot.add(peachEnv);
  }

  private applyBackgroundTheme(bgId: string): void {
    this.activeBackgroundId = bgId;
    Object.entries(this.envGroups).forEach(([id, group]) => {
      group.visible = id === bgId;
    });
    if (this.rugMat && this.rugTrimMat) {
      if (bgId === 'bg_night') {
        this.rugMat.color.setHex(0x4338ca);
        this.rugTrimMat.color.setHex(0xfef08a);
      } else if (bgId === 'bg_sunny') {
        this.rugMat.color.setHex(0x4ade80);
        this.rugTrimMat.color.setHex(0xfef9c3);
      } else if (bgId === 'bg_peach') {
        this.rugMat.color.setHex(0xfdba74);
        this.rugTrimMat.color.setHex(0xfbcfe8);
      } else {
        this.rugMat.color.setHex(0xd8b4fe);
        this.rugTrimMat.color.setHex(0xfef9c3);
      }
    }
  }

  private buildMiau3D(): void {
    const whiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.42,
    });
    const orangeMat = new THREE.MeshStandardMaterial({
      color: 0xe89438,
      roughness: 0.45,
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x1b1024,
      roughness: 0.25,
    });
    const pinkMat = new THREE.MeshStandardMaterial({
      color: 0xf28b95,
      roughness: 0.4,
    });

    // Chubby body
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 32, 24),
      whiteMat
    );
    body.scale.set(1.1, 0.98, 0.95);
    this.petGroup.add(body);

    // Ears
    const earGeo = new THREE.ConeGeometry(0.06, 0.1, 20);
    const leftEar = new THREE.Mesh(earGeo, whiteMat);
    leftEar.position.set(-0.1, 0.16, 0.01);
    leftEar.rotation.z = 0.28;
    const rightEar = new THREE.Mesh(earGeo, orangeMat);
    rightEar.position.set(0.1, 0.16, 0.01);
    rightEar.rotation.z = -0.28;
    this.petGroup.add(leftEar, rightEar);

    // Calico patch on right face
    const cheekPatch = new THREE.Mesh(
      new THREE.SphereGeometry(0.095, 24, 18),
      orangeMat
    );
    cheekPatch.position.set(0.075, 0.055, 0.105);
    cheekPatch.scale.set(1.0, 0.95, 0.6);
    this.petGroup.add(cheekPatch);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.022, 16, 16);
    this.leftEyeMesh = new THREE.Mesh(eyeGeo, darkMat);
    this.leftEyeMesh.position.set(-0.06, 0.03, 0.162);
    this.rightEyeMesh = new THREE.Mesh(eyeGeo, darkMat);
    this.rightEyeMesh.position.set(0.06, 0.03, 0.162);
    this.petGroup.add(this.leftEyeMesh, this.rightEyeMesh);

    // Nose & tongue
    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(0.014, 12, 12),
      darkMat
    );
    nose.scale.set(1.3, 0.85, 0.8);
    nose.position.set(0, -0.002, 0.174);
    const mouth = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 12, 12),
      pinkMat
    );
    mouth.position.set(0, -0.032, 0.168);
    this.petGroup.add(nose, mouth);

    // Tail
    const tailBody = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.022, 0.13, 8, 12),
      whiteMat
    );
    tailBody.position.set(0, 0.06, 0);
    const tailTip = new THREE.Mesh(
      new THREE.SphereGeometry(0.026, 12, 12),
      orangeMat
    );
    tailTip.position.set(0, 0.14, 0);
    this.tailGroup.add(tailBody, tailTip);
    this.tailGroup.position.set(-0.19, -0.06, -0.05);
    this.tailGroup.rotation.z = 0.55;
    this.petGroup.add(this.tailGroup);

    // --- Hats ---
    // Party Hat
    const partyHat = new THREE.Group();
    const hatCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.055, 0.12, 20),
      new THREE.MeshStandardMaterial({ color: 0x50b6e8, roughness: 0.35 })
    );
    const hatStar = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.02),
      new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.3 })
    );
    hatStar.position.y = 0.075;
    partyHat.add(hatCone, hatStar);
    partyHat.position.set(0, 0.23, 0.02);
    this.hatGroups['hat_party'] = partyHat;

    // Crown
    const crown = new THREE.Group();
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.55,
      roughness: 0.25,
    });
    const crownRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.062, 0.055, 0.045, 20),
      goldMat
    );
    crown.add(crownRing);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(0.016, 0.04, 8),
        goldMat
      );
      spike.position.set(Math.cos(a) * 0.05, 0.036, Math.sin(a) * 0.05);
      crown.add(spike);
    }
    crown.position.set(0, 0.2, 0.02);
    this.hatGroups['hat_crown'] = crown;

    // Wizard Hat
    const wizard = new THREE.Group();
    const wizMat = new THREE.MeshStandardMaterial({
      color: 0x7c3aed,
      roughness: 0.45,
    });
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.012, 24),
      wizMat
    );
    const wizCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.068, 0.16, 20),
      wizMat
    );
    wizCone.position.y = 0.08;
    const wizBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.062, 0.008, 8, 24),
      goldMat
    );
    wizBand.rotation.x = Math.PI / 2;
    wizBand.position.y = 0.015;
    wizard.add(brim, wizCone, wizBand);
    wizard.position.set(0, 0.19, 0.02);
    this.hatGroups['hat_wizard'] = wizard;

    // Flower Hat
    const flower = new THREE.Group();
    const petalMat = new THREE.MeshStandardMaterial({
      color: 0xf9a8d4,
      roughness: 0.4,
    });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const petal = new THREE.Mesh(
        new THREE.SphereGeometry(0.022, 12, 12),
        petalMat
      );
      petal.position.set(Math.cos(a) * 0.028, Math.sin(a) * 0.028, 0);
      flower.add(petal);
    }
    const flowerCenter = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.3 })
    );
    flowerCenter.position.z = 0.01;
    flower.add(flowerCenter);
    flower.position.set(-0.08, 0.19, 0.08);
    flower.rotation.y = 0.25;
    this.hatGroups['hat_flower'] = flower;

    Object.values(this.hatGroups).forEach((g) => this.petGroup.add(g));

    // --- Accessories ---
    // Bow Tie
    const bowTie = new THREE.Group();
    const bowMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.35,
    });
    const bowL = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.048, 12), bowMat);
    bowL.rotation.z = -Math.PI / 2;
    bowL.position.x = -0.028;
    const bowR = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.048, 12), bowMat);
    bowR.rotation.z = Math.PI / 2;
    bowR.position.x = 0.028;
    const bowCenter = new THREE.Mesh(
      new THREE.SphereGeometry(0.016, 12, 12),
      bowMat
    );
    bowTie.add(bowL, bowR, bowCenter);
    bowTie.position.set(0, -0.085, 0.16);
    this.accGroups['acc_bowtie'] = bowTie;

    // Star Glasses
    const glasses = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      metalness: 0.4,
      roughness: 0.3,
    });
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.72,
      roughness: 0.15,
    });
    const leftRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.034, 0.006, 8, 20),
      frameMat
    );
    leftRim.position.set(-0.06, 0.03, 0.175);
    const rightRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.034, 0.006, 8, 20),
      frameMat
    );
    rightRim.position.set(0.06, 0.03, 0.175);
    const leftLens = new THREE.Mesh(
      new THREE.CircleGeometry(0.032, 16),
      lensMat
    );
    leftLens.position.set(-0.06, 0.03, 0.176);
    const rightLens = new THREE.Mesh(
      new THREE.CircleGeometry(0.032, 16),
      lensMat
    );
    rightLens.position.set(0.06, 0.03, 0.176);
    const bridge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.004, 0.055, 8),
      frameMat
    );
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.032, 0.178);
    glasses.add(leftRim, rightRim, leftLens, rightLens, bridge);
    this.accGroups['acc_glasses'] = glasses;

    // Lilac Scarf
    const scarf = new THREE.Group();
    const scarfMat = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      roughness: 0.75,
    });
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.155, 0.025, 12, 28),
      scarfMat
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, -0.075, 0.02);
    const tailEnd = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.09, 0.018),
      new THREE.MeshStandardMaterial({ color: 0xc084fc, roughness: 0.75 })
    );
    tailEnd.position.set(0.05, -0.12, 0.15);
    tailEnd.rotation.z = -0.18;
    scarf.add(collar, tailEnd);
    this.accGroups['acc_scarf'] = scarf;

    // Golden Bell Collar
    const bell = new THREE.Group();
    const strap = new THREE.Mesh(
      new THREE.TorusGeometry(0.155, 0.016, 10, 28),
      new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.45 })
    );
    strap.rotation.x = Math.PI / 2;
    strap.position.set(0, -0.078, 0.02);
    const bellSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.024, 16, 16),
      goldMat
    );
    bellSphere.position.set(0, -0.1, 0.17);
    bell.add(strap, bellSphere);
    this.accGroups['acc_bell'] = bell;

    Object.values(this.accGroups).forEach((g) => this.petGroup.add(g));

    // Wrap Miau inside InteractivePet + ModelViewer resting on cushion
    const petInteractive = new InteractiveProp(
      'Miau 3D',
      this.petGroup,
      () => this.callbacks.onPet(),
      1
    );

    const viewer = new xb.ModelViewer({
      manipulation: {
        actions: {
          translate: { faceCamera: true },
          rotate: { axis: 'y' },
          scale: { minScale: 0.6, maxScale: 1.8 },
        },
      },
    });
    viewer.setContent(petInteractive);
    viewer.position.set(-0.22, 0.28, 0.08);
    this.stageRoot.add(viewer);
  }

  private buildInteractiveProps(): void {
    // 1. Yarn Ball (Play)
    const yarnGroup = new THREE.Group();
    const yarnMat = new THREE.MeshStandardMaterial({
      color: 0xec4899,
      roughness: 0.65,
    });
    const yarnCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 20, 16),
      yarnMat
    );
    const yarnStripe1 = new THREE.Mesh(
      new THREE.TorusGeometry(0.068, 0.01, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.6 })
    );
    yarnStripe1.rotation.x = 0.6;
    const yarnStripe2 = new THREE.Mesh(
      new THREE.TorusGeometry(0.068, 0.01, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.6 })
    );
    yarnStripe2.rotation.y = 0.9;
    yarnGroup.add(yarnCore, yarnStripe1, yarnStripe2);

    this.yarnProp = new InteractiveProp('Novelo de Lã', yarnGroup, () => {
      this.callbacks.onPlay();
    });
    this.yarnProp.position.set(-0.62, 0.1, 0.25);
    this.stageRoot.add(this.yarnProp);

    // 2. Fish Bowl (Feed)
    const bowlGroup = new THREE.Group();
    const bowlMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.095, 0.072, 0.055, 24),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3 })
    );
    const fishBody = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35 })
    );
    fishBody.scale.set(1.4, 0.85, 0.7);
    fishBody.position.set(-0.005, 0.032, 0);
    const fishTail = new THREE.Mesh(
      new THREE.ConeGeometry(0.018, 0.026, 6),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.35 })
    );
    fishTail.rotation.z = -Math.PI / 2;
    fishTail.position.set(0.04, 0.032, 0);
    bowlGroup.add(bowlMesh, fishBody, fishTail);

    const bowlProp = new InteractiveProp('Tigela de Peixinho', bowlGroup, () => {
      this.callbacks.onFeed();
    });
    bowlProp.position.set(0.16, 0.055, 0.34);
    this.stageRoot.add(bowlProp);

    // 3. Bubble Soap (Clean)
    const soapGroup = new THREE.Group();
    const soapBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.036, 0.058),
      new THREE.MeshStandardMaterial({ color: 0x22d3ee, roughness: 0.25 })
    );
    const decoBubble = new THREE.Mesh(this.bubbleGeo, this.bubbleMat);
    decoBubble.position.set(0.03, 0.045, 0.01);
    soapGroup.add(soapBar, decoBubble);

    const soapProp = new InteractiveProp('Sabonete Espuma', soapGroup, () => {
      this.spawnSoapBubbles();
      this.callbacks.onClean();
    });
    soapProp.position.set(-0.56, 0.045, -0.22);
    this.stageRoot.add(soapProp);
  }

  private spawnSoapBubbles(): void {
    for (let i = 0; i < 8; i++) {
      const b = new THREE.Mesh(this.bubbleGeo, this.bubbleMat);
      b.position.set(
        -0.22 + (Math.random() - 0.5) * 0.35,
        0.22 + Math.random() * 0.12,
        0.08 + (Math.random() - 0.5) * 0.22
      );
      b.scale.setScalar(0.6 + Math.random() * 0.8);
      this.stageRoot.add(b);
      this.activeBubbles.push({
        mesh: b,
        life: 1.4 + Math.random() * 0.6,
        vy: 0.22 + Math.random() * 0.18,
      });
    }
  }

  private buildSpatialCard(): void {
    this.statsLabel = new xb.UIText({
      text: 'Fome 60%  •  Higiene 90%\nDiversão 50%  •  Sono 70%  •  Felicidade 75%',
      style: {
        fontSize: 18,
        lineHeight: 1.35,
        textAlign: 'center',
      },
    });

    this.speechLabel = new xb.UIText({
      text: 'Miau! (Oi, humano! Vamos brincar?)',
      style: {
        fontSize: 19,
        fontWeight: 'bold',
        lineHeight: 1.3,
        textAlign: 'center',
        padding: 12,
        backgroundColor: 'rgba(139, 92, 246, 0.25)',
        borderRadius: 14,
      },
    });

    this.statusCard = new xb.UICard({
      size: { width: 0.62, height: 'auto' },
      manipulation: true,
      edge: true,
      style: { flexDirection: 'column', gap: 12, padding: 18 },
      children: [
        new xb.UIText({
          text: 'Sala do Miau (XR)',
          style: { fontSize: 26, fontWeight: 'bold', textAlign: 'center' },
        }),
        this.statsLabel,
        this.speechLabel,
        new xb.UIPanel({
          style: { width: '100%', flexDirection: 'row', gap: 8 },
          children: [
            new xb.UIButton({
              label: 'Carinho',
              icon: 'favorite',
              style: { flexGrow: 1 },
              onClick: () => this.callbacks.onPet(),
            }),
            new xb.UIButton({
              label: 'Peixinho',
              icon: 'restaurant',
              style: { flexGrow: 1 },
              onClick: () => this.callbacks.onFeed(),
            }),
          ],
        }),
        new xb.UIPanel({
          style: { width: '100%', flexDirection: 'row', gap: 8 },
          children: [
            new xb.UIButton({
              label: 'Limpar',
              icon: 'cleaning_services',
              style: { flexGrow: 1 },
              onClick: () => {
                this.spawnSoapBubbles();
                this.callbacks.onClean();
              },
            }),
            new xb.UIButton({
              label: 'Brincar',
              icon: 'play_arrow',
              style: { flexGrow: 1 },
              onClick: () => {
                this.yarnProp?.triggerPop();
                this.callbacks.onPlay();
              },
            }),
          ],
        }),
        new xb.UIPanel({
          style: { width: '100%', flexDirection: 'row', gap: 8 },
          children: [
            new xb.UIButton({
              label: 'Soneca',
              style: { flexGrow: 1 },
              onClick: () => this.callbacks.onToggleSleep(),
            }),
            new xb.UIButton({
              label: 'Voltar 2D',
              icon: 'arrow_back',
              style: { flexGrow: 1 },
              onClick: () => this.callbacks.onExitXRMode(),
            }),
          ],
        }),
      ],
    });
    this.statusCard.position.set(0.45, 0.56, 0.14);
    this.statusCard.rotation.y = -0.25;
    this.stageRoot.add(this.statusCard);
  }

  syncState(
    stats: PetStats,
    equipped: EquippedItems,
    speechText: string,
    isSleeping = false
  ): void {
    this.isSleeping = isSleeping;

    Object.entries(this.hatGroups).forEach(([id, group]) => {
      group.visible = equipped.hat === id;
    });
    Object.entries(this.accGroups).forEach(([id, group]) => {
      group.visible = equipped.accessory === id;
    });

    if (equipped.background && equipped.background !== this.activeBackgroundId) {
      this.applyBackgroundTheme(equipped.background);
    }

    if (this.statsLabel) {
      this.statsLabel.text =
        `Fome ${Math.round(stats.hunger)}%  •  Higiene ${Math.round(stats.hygiene)}%\n` +
        `Diversão ${Math.round(stats.fun)}%  •  Sono ${Math.round(stats.sleep)}%  •  Felicidade ${Math.round(stats.happiness ?? 75)}%`;
    }
    if (this.speechLabel) {
      this.speechLabel.text = speechText;
    }
  }

  triggerBounce(): void {
    this.bounceTime = 0.6;
  }

  // --- Gyroscope & Touch Navigation ---
  private onDeviceOrientation(event: DeviceOrientationEvent): void {
    if (event.alpha === null || event.beta === null || event.gamma === null) {
      return;
    }
    const alpha = THREE.MathUtils.degToRad(event.alpha);
    const beta = THREE.MathUtils.degToRad(event.beta);
    const gamma = THREE.MathUtils.degToRad(event.gamma);
    const orientAngle =
      (screen.orientation?.angle ??
        (window as unknown as { orientation?: number }).orientation ??
        0) ||
      0;
    const orient = THREE.MathUtils.degToRad(orientAngle);

    _gyroEuler.set(beta, alpha, -gamma, 'YXZ');
    _gyroDeviceQuat.setFromEuler(_gyroEuler);
    _gyroDeviceQuat.multiply(_gyroScreenFix);
    _gyroScreenOri.setFromAxisAngle(_zAxis, -orient);
    _gyroDeviceQuat.multiply(_gyroScreenOri);

    this.currentDeviceQuat.copy(_gyroDeviceQuat);
    this.hasDeviceReading = true;

    if (!this.gyroCalibrated) {
      this.calibrateGyroscope();
    }
  }

  public calibrateGyroscope(): void {
    const cam = xb.core.camera;
    if (cam) {
      this.gyroCameraBaseQuat.copy(cam.quaternion);
    }
    if (this.hasDeviceReading) {
      this.gyroBaseQuat.copy(this.currentDeviceQuat);
      this.gyroCalibrated = true;
    } else {
      this.gyroCalibrated = false;
    }
  }

  public async setGyroscopeEnabled(
    enable: boolean
  ): Promise<{ enabled: boolean; message: string }> {
    if (!enable) {
      this.gyroEnabled = false;
      this.gyroCalibrated = false;
      window.removeEventListener('deviceorientation', this.gyroListener);
      return { enabled: false, message: 'Giroscópio desativado.' };
    }

    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      return {
        enabled: false,
        message: 'Giroscópio não suportado neste dispositivo.',
      };
    }

    const DevOrient = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (typeof DevOrient.requestPermission === 'function') {
      try {
        const res = await DevOrient.requestPermission();
        if (res !== 'granted') {
          return {
            enabled: false,
            message: 'Permissão do giroscópio negada.',
          };
        }
      } catch {
        return {
          enabled: false,
          message: 'Não foi possível autorizar o giroscópio.',
        };
      }
    }

    this.gyroEnabled = true;
    this.gyroCalibrated = false;
    this.hasDeviceReading = false;
    const cam = xb.core.camera;
    if (cam) {
      this.gyroCameraBaseQuat.copy(cam.quaternion);
    }
    window.addEventListener('deviceorientation', this.gyroListener);
    return {
      enabled: true,
      message: 'Giroscópio ativo! Mova o celular para olhar ao redor.',
    };
  }

  public isGyroscopeEnabled(): boolean {
    return this.gyroEnabled;
  }

  public setMoveInput(forward: number, right: number): void {
    this.moveInput.forward = forward;
    this.moveInput.right = right;
  }

  public resetCameraView(): void {
    const cam = xb.core.camera;
    if (!cam) return;
    const home = new THREE.Vector3(0, 1.5, 0.25);
    if (xb.core.simulator) {
      xb.core.simulator.moveUser(home);
    } else {
      cam.position.copy(home);
    }
    cam.lookAt(0, 1.15, -1.25);
    this.calibrateGyroscope();
  }

  update(): void {
    const dt = Math.min(xb.getDeltaTime(), 0.05);
    const t = performance.now() * 0.002;

    // Tail wag & breathing/bounce
    this.tailGroup.rotation.z =
      0.55 + Math.sin(t * (this.isSleeping ? 0.8 : 2.2)) * 0.16;

    if (this.leftEyeMesh && this.rightEyeMesh) {
      const eyeY = this.isSleeping ? 0.22 : 1.0;
      this.leftEyeMesh.scale.y = THREE.MathUtils.damp(
        this.leftEyeMesh.scale.y,
        eyeY,
        10,
        dt
      );
      this.rightEyeMesh.scale.y = THREE.MathUtils.damp(
        this.rightEyeMesh.scale.y,
        eyeY,
        10,
        dt
      );
    }

    if (this.bounceTime > 0) {
      this.bounceTime = Math.max(0, this.bounceTime - dt);
      const wave = Math.sin((this.bounceTime / 0.6) * Math.PI);
      this.petGroup.position.y = wave * 0.085;
      this.petGroup.rotation.y = wave * 0.35;
    } else {
      this.petGroup.position.y = Math.sin(t) * 0.012;
      this.petGroup.rotation.y = THREE.MathUtils.damp(
        this.petGroup.rotation.y,
        0,
        8,
        dt
      );
    }

    // Ambient scenery animations
    this.lampGroup.rotation.z = Math.sin(t * 0.7) * 0.03;
    if (this.envGroups['bg_sunny']?.visible) {
      this.sunGroup.rotation.z += dt * 0.25;
      for (const cloud of this.cloudGroups) {
        cloud.position.x =
          (cloud.userData.baseX as number) +
          Math.sin(t * 0.35 + (cloud.userData.phase as number)) * 0.12;
      }
    }
    if (this.envGroups['bg_night']?.visible) {
      for (const star of this.starMeshes) {
        const s = 0.75 + 0.35 * Math.sin(t * 1.8 + (star.userData.phase as number));
        star.scale.setScalar(s);
        star.rotation.y += dt * 0.7;
      }
    }

    // Active soap bubbles rising
    for (let i = this.activeBubbles.length - 1; i >= 0; i--) {
      const b = this.activeBubbles[i];
      b.life -= dt;
      b.mesh.position.y += b.vy * dt;
      b.mesh.position.x += Math.sin(t * 3 + i) * 0.06 * dt;
      if (b.life <= 0) {
        b.mesh.removeFromParent();
        this.activeBubbles.splice(i, 1);
      }
    }

    // Gyroscope & Touch Walk Navigation (Simulator / non-headset mode)
    const cam = xb.core.camera;
    const inNativeXR = Boolean(xb.core.webXRSessionManager?.currentSession);
    if (cam && !inNativeXR) {
      if (this.gyroEnabled && this.hasDeviceReading && this.gyroCalibrated) {
        _gyroTargetQuat
          .copy(this.gyroBaseQuat)
          .invert()
          .multiply(this.currentDeviceQuat);
        _gyroTargetQuat.premultiply(this.gyroCameraBaseQuat);
        cam.quaternion.slerp(_gyroTargetQuat, 1 - Math.exp(-12 * dt));
      }

      if (this.moveInput.forward !== 0 || this.moveInput.right !== 0) {
        const speed = 1.15 * dt;
        _moveForward.set(0, 0, -1).applyQuaternion(cam.quaternion);
        _moveForward.y = 0;
        if (_moveForward.lengthSq() > 0.0001) _moveForward.normalize();
        _moveRight.crossVectors(_moveForward, _worldUp).normalize();

        _desiredPos
          .copy(cam.position)
          .addScaledVector(_moveForward, this.moveInput.forward * speed)
          .addScaledVector(_moveRight, this.moveInput.right * speed);

        _desiredPos.x = THREE.MathUtils.clamp(_desiredPos.x, -2.1, 2.1);
        _desiredPos.z = THREE.MathUtils.clamp(_desiredPos.z, -2.3, 1.4);

        if (xb.core.simulator) {
          xb.core.simulator.moveUser(_desiredPos);
        } else {
          cam.position.copy(_desiredPos);
        }
      }
    }
  }

  dispose(): void {
    window.removeEventListener('deviceorientation', this.gyroListener);
    this.bubbleGeo.dispose();
    this.bubbleMat.dispose();
  }
}
