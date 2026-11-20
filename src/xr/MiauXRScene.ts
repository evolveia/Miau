import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as xb from 'xrblocks';
import { hapticService } from '../services/hapticService';
import { soundService } from '../services/soundService';
import type { EquippedItems, PetStats } from '../types';

export interface MiauXRCallbacks {
  onPet: () => void;
  onFeed: () => void;
  onClean: () => void;
  onPlay: (source?: 'yarn' | 'ball') => void;
  onMeow: () => void;
  onToggleSleep: () => void;
  onExitXRMode: () => void;
  onActionFeedback?: (msg: string) => void;
}

type PetState =
  | 'idle'
  | 'wander'
  | 'chase_ball'
  | 'go_yarn'
  | 'go_eat'
  | 'go_clean'
  | 'petting'
  | 'sleeping';

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
    this.hoverScale = 1.1;
  }

  onHoverExit(): void {
    this.hoverScale = 1;
  }

  onObjectSelectStart(event: xb.SelectEvent): void {
    if (!xb.core.webXRSessionManager?.currentSession) {
      return;
    }
    this.triggerPop();
    this.onInteract();
    event.stopPropagation();
  }

  update(): void {
    const dt = Math.min(xb.getDeltaTime(), 0.05);
    let popBoost = 0;
    if (this.popTimer > 0) {
      this.popTimer = Math.max(0, this.popTimer - dt);
      popBoost = Math.sin((this.popTimer / 0.45) * Math.PI) * 0.16;
    }
    const target = this.baseScale * (this.hoverScale + popBoost);
    const next = THREE.MathUtils.damp(this.scale.x, target, 12, dt);
    this.scale.setScalar(next);
  }
}

// Reusable math helpers (zero per-frame GC allocations)
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
const _gyroDeltaEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _moveForward = new THREE.Vector3();
const _moveRight = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);
const _zAxis = new THREE.Vector3(0, 0, 1);
const _camOffset = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _tapWorld = new THREE.Vector3();
const _tapLocal = new THREE.Vector3();
const _ballImpulse = new THREE.Vector3();
const _ndc = new THREE.Vector2();

const STAGE_POS = new THREE.Vector3(0, 0.72, -1.25);
const BED_POS = new THREE.Vector3(-0.42, 0, -0.18);
const BOWL_POS = new THREE.Vector3(0.32, 0, 0.34);
const YARN_HOME = new THREE.Vector3(-0.62, 0.095, 0.25);
const SOAP_POS = new THREE.Vector3(-0.58, 0.045, -0.28);
const BALL_HOME = new THREE.Vector3(0.05, 0.078, 0.38);
const PET_BASE_Y = 0.185;
const RUG_WALK_RADIUS = 0.72;

function shortestAngleDiff(from: number, to: number): number {
  let diff = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

export class MiauXRScene extends xb.Script {
  private stageRoot = new THREE.Group();
  private petMover = new THREE.Group();
  private petGroup = new THREE.Group();
  private tailGroup = new THREE.Group();
  private mouthMesh?: THREE.Mesh;
  private leftEyeMesh?: THREE.Mesh;
  private rightEyeMesh?: THREE.Mesh;
  private leftEarMesh?: THREE.Mesh;
  private rightEarMesh?: THREE.Mesh;
  private frontLeftPaw?: THREE.Mesh;
  private frontRightPaw?: THREE.Mesh;
  private backLeftPaw?: THREE.Mesh;
  private backRightPaw?: THREE.Mesh;
  private contactShadow?: THREE.Mesh;

  // Hats & Accessories
  private hatGroups: Record<string, THREE.Group> = {};
  private accGroups: Record<string, THREE.Group> = {};

  // Environments
  private envGroups: Record<string, THREE.Group> = {};
  private activeBackgroundId = 'bg_lilac';
  private rugMesh?: THREE.Mesh;
  private rugMat?: THREE.MeshStandardMaterial;
  private rugTrimMat?: THREE.MeshStandardMaterial;
  private meadowFloorMesh?: THREE.Mesh;
  private lampGroup = new THREE.Group();
  private sunGroup = new THREE.Group();
  private cloudGroups: THREE.Group[] = [];
  private starMeshes: THREE.Mesh[] = [];

  // Interactive Props
  private petInteractive?: InteractiveProp;
  private yarnProp?: InteractiveProp;
  private bowlProp?: InteractiveProp;
  private soapProp?: InteractiveProp;
  private bedProp?: InteractiveProp;
  private ballProp?: InteractiveProp;
  private ballMeshGroup = new THREE.Group();
  private interactiveRoots: THREE.Object3D[] = [];
  private tapRingMesh?: THREE.Mesh;
  private tapRingTimer = 0;

  // Ball physics
  private ballPos = new THREE.Vector3().copy(BALL_HOME);
  private ballVel = new THREE.Vector3();
  private ballActive = false;
  private ballKickCooldown = 0;

  // Floating particle pools (bubbles, hearts, stars)
  private activeParticles: Array<{
    mesh: THREE.Mesh;
    life: number;
    maxLife: number;
    vy: number;
    vx: number;
    vz: number;
  }> = [];
  private bubbleGeo = new THREE.SphereGeometry(0.022, 12, 12);
  private bubbleMat = new THREE.MeshStandardMaterial({
    color: 0xbae6fd,
    roughness: 0.1,
    metalness: 0.1,
    transparent: true,
    opacity: 0.72,
  });
  private heartGeo = new THREE.OctahedronGeometry(0.024, 1);
  private heartMat = new THREE.MeshStandardMaterial({
    color: 0xf43f5e,
    emissive: 0xfb7185,
    emissiveIntensity: 0.45,
    roughness: 0.3,
    transparent: true,
    opacity: 0.92,
  });
  private starParticleGeo = new THREE.OctahedronGeometry(0.02, 0);
  private starParticleMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xfde047,
    emissiveIntensity: 0.6,
    roughness: 0.25,
    transparent: true,
    opacity: 0.92,
  });

  // Autonomous Pet AI state
  private petState: PetState = 'idle';
  private petPos = new THREE.Vector3(-0.18, 0, 0.04);
  private petTarget = new THREE.Vector3(-0.18, 0, 0.04);
  private petYaw = 0.15;
  private petStateTimer = 1.6;
  private walkCycle = 0;
  private bounceTime = 0;
  private spinTime = 0;
  private meowAnimTime = 0;
  private spontaneousMeowCooldown = 8;
  private blinkTimer = 3.2;
  private isSleeping = false;
  private ballThrowMode = false;

  // Spatial UI
  private statusCard?: xb.UICard;
  private statsLabel?: xb.UIText;
  private speechLabel?: xb.UIText;

  // Touch / Mouse Orbit + Pinch + Walk Camera Rig
  private cameraTarget = new THREE.Vector3(0, 0.94, -1.25);
  private targetYaw = 0;
  private currentYaw = 0;
  private targetPitch = 0.28;
  private currentPitch = 0.28;
  private targetDistance = 1.68;
  private currentDistance = 1.68;
  private yawVelocity = 0;
  private pitchVelocity = 0;

  // Pointer & Gesture tracking
  private activePointers = new Map<
    number,
    { x: number; y: number; startX: number; startY: number }
  >();
  private dragMoved = false;
  private lastPinchDist = 0;
  private lastPinchCenterX = 0;
  private lastPinchCenterY = 0;
  private tapRaycaster = new THREE.Raycaster();
  private canvasBound = false;
  private boundCanvas: HTMLElement | null = null;
  private envTexture: THREE.Texture | null = null;

  // Gyroscope navigation state
  private gyroEnabled = false;
  private gyroCalibrated = false;
  private gyroBaseQuat = new THREE.Quaternion();
  private currentDeviceQuat = new THREE.Quaternion();
  private hasDeviceReading = false;
  private lastGyroYaw = 0;
  private lastGyroPitch = 0;
  private gyroListener = (e: DeviceOrientationEvent) =>
    this.onDeviceOrientation(e);

  // Movement state (from mobile HUD joystick)
  private moveInput = { forward: 0, right: 0 };

  constructor(private callbacks: MiauXRCallbacks) {
    super();
  }

  init(): void {
    // Studio environment reflection for crisp metallic crowns, bells & glossy ball
    const renderer = xb.core.renderer as unknown as
      | THREE.WebGLRenderer
      | undefined;
    const mainScene = xb.core.scene;
    if (renderer && mainScene && !mainScene.environment) {
      try {
        const pmrem = new THREE.PMREMGenerator(renderer);
        this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        mainScene.environment = this.envTexture;
        pmrem.dispose();
      } catch {
        // Ignore if software renderer doesn't support PMREM
      }
    }

    this.add(new THREE.HemisphereLight(0xfef9ff, 0x6d4ea3, 2.5));
    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.0);
    keyLight.position.set(1.6, 3.4, 2.1);
    this.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xc4b5fd, 1.0);
    rimLight.position.set(-1.8, 2.2, -2.4);
    this.add(rimLight);

    this.stageRoot.position.copy(STAGE_POS);
    this.add(this.stageRoot);

    this.buildCozyRoomStage();
    this.buildThemedEnvironments();
    this.buildMiau3D();
    this.buildInteractiveProps();
    this.buildTapRing();
    this.buildSpatialCard();
    this.applyBackgroundTheme(this.activeBackgroundId);
    this.bindTouchNavigation();
    this.resetCameraView();
  }

  private buildCozyRoomStage(): void {
    // Ground rug + decorative trim
    this.rugMat = new THREE.MeshStandardMaterial({
      color: 0xd8b4fe,
      roughness: 0.85,
    });
    this.rugMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1.06, 1.1, 0.024, 48),
      this.rugMat
    );
    this.rugMesh.position.y = 0.012;
    this.rugMesh.userData.miauAction = 'floor';

    this.rugTrimMat = new THREE.MeshStandardMaterial({
      color: 0xfef9c3,
      roughness: 0.7,
    });
    const rugTrim = new THREE.Mesh(
      new THREE.TorusGeometry(1.06, 0.018, 12, 48),
      this.rugTrimMat
    );
    rugTrim.rotation.x = Math.PI / 2;
    rugTrim.position.y = 0.022;

    // Plush cat bed cushion (clickable to toggle sleep)
    const bedGroup = new THREE.Group();
    const bedMat = new THREE.MeshStandardMaterial({
      color: 0xf3e8ff,
      roughness: 0.82,
    });
    const cushionMat = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      roughness: 0.78,
    });
    const bedBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.3, 0.045, 32),
      bedMat
    );
    bedBase.position.y = 0.022;
    const bedRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.26, 0.048, 16, 36),
      cushionMat
    );
    bedRim.rotation.x = Math.PI / 2;
    bedRim.position.y = 0.045;
    bedGroup.add(bedBase, bedRim);
    bedGroup.traverse((obj) => {
      obj.userData.miauAction = 'bed';
    });

    this.bedProp = new InteractiveProp('Caminha do Miau', bedGroup, () => {
      this.callbacks.onToggleSleep();
      this.callbacks.onActionFeedback?.(
        this.isSleeping ? 'Miau acordou! 😺' : 'Hora da soneca na caminha... 💤'
      );
    });
    this.bedProp.position.set(BED_POS.x, 0.026, BED_POS.z);

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
    this.lampGroup.position.set(-0.36, 1.44, -0.15);

    this.stageRoot.add(this.rugMesh, rugTrim, this.bedProp, this.lampGroup);
    this.interactiveRoots.push(this.rugMesh, this.bedProp);
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
        Math.cos(angle) * 0.96,
        0.55 + (i % 2) * 0.28,
        Math.sin(angle) * 0.48 - 0.35
      );
      lilacEnv.add(star);
    }
    this.envGroups['bg_lilac'] = lilacEnv;
    this.stageRoot.add(lilacEnv);

    // 2. Noite Estrelada
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
      const r = 0.88 + (i % 4) * 0.18;
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

    // 3. Dia Ensolarado (Grass + Tree + Clouds + Sun)
    const sunnyEnv = new THREE.Group();
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      roughness: 0.85,
    });
    this.meadowFloorMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1.22, 1.28, 0.032, 48),
      grassMat
    );
    this.meadowFloorMesh.position.y = 0.016;
    this.meadowFloorMesh.userData.miauAction = 'floor';
    sunnyEnv.add(this.meadowFloorMesh);
    this.interactiveRoots.push(this.meadowFloorMesh);

    const treeGroup = new THREE.Group();
    treeGroup.position.set(-0.84, 0.02, -0.36);
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
    const whiskerMat = new THREE.MeshStandardMaterial({
      color: 0x4c2a85,
      roughness: 0.5,
    });

    // Chubby body
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.175, 32, 24),
      whiteMat
    );
    body.scale.set(1.08, 0.96, 0.95);
    this.petGroup.add(body);

    // Cute grounded paws
    const pawGeo = new THREE.SphereGeometry(0.036, 14, 12);
    this.frontLeftPaw = new THREE.Mesh(pawGeo, whiteMat);
    this.frontLeftPaw.scale.set(1, 0.72, 1.25);
    this.frontLeftPaw.position.set(-0.075, -0.145, 0.085);

    this.frontRightPaw = new THREE.Mesh(pawGeo, orangeMat);
    this.frontRightPaw.scale.set(1, 0.72, 1.25);
    this.frontRightPaw.position.set(0.075, -0.145, 0.085);

    this.backLeftPaw = new THREE.Mesh(pawGeo, whiteMat);
    this.backLeftPaw.scale.set(1.05, 0.72, 1.3);
    this.backLeftPaw.position.set(-0.09, -0.145, -0.07);

    this.backRightPaw = new THREE.Mesh(pawGeo, whiteMat);
    this.backRightPaw.scale.set(1.05, 0.72, 1.3);
    this.backRightPaw.position.set(0.09, -0.145, -0.07);

    this.petGroup.add(
      this.frontLeftPaw,
      this.frontRightPaw,
      this.backLeftPaw,
      this.backRightPaw
    );

    // Ears + Pink Inner Ears
    const earGeo = new THREE.ConeGeometry(0.058, 0.1, 20);
    const innerEarGeo = new THREE.ConeGeometry(0.032, 0.06, 14);
    this.leftEarMesh = new THREE.Mesh(earGeo, whiteMat);
    this.leftEarMesh.position.set(-0.1, 0.155, 0.01);
    this.leftEarMesh.rotation.z = 0.28;
    const leftInnerEar = new THREE.Mesh(innerEarGeo, pinkMat);
    leftInnerEar.position.set(0, -0.005, 0.022);
    this.leftEarMesh.add(leftInnerEar);

    this.rightEarMesh = new THREE.Mesh(earGeo, orangeMat);
    this.rightEarMesh.position.set(0.1, 0.155, 0.01);
    this.rightEarMesh.rotation.z = -0.28;
    const rightInnerEar = new THREE.Mesh(innerEarGeo, pinkMat);
    rightInnerEar.position.set(0, -0.005, 0.022);
    this.rightEarMesh.add(rightInnerEar);
    this.petGroup.add(this.leftEarMesh, this.rightEarMesh);

    // Calico patch on right face
    const cheekPatch = new THREE.Mesh(
      new THREE.SphereGeometry(0.092, 24, 18),
      orangeMat
    );
    cheekPatch.position.set(0.074, 0.054, 0.102);
    cheekPatch.scale.set(1.0, 0.95, 0.6);
    this.petGroup.add(cheekPatch);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.022, 16, 16);
    this.leftEyeMesh = new THREE.Mesh(eyeGeo, darkMat);
    this.leftEyeMesh.position.set(-0.06, 0.032, 0.158);
    this.rightEyeMesh = new THREE.Mesh(eyeGeo, darkMat);
    this.rightEyeMesh.position.set(0.06, 0.032, 0.158);
    this.petGroup.add(this.leftEyeMesh, this.rightEyeMesh);

    // Rosy cheeks
    const blushGeo = new THREE.SphereGeometry(0.018, 12, 12);
    const leftBlush = new THREE.Mesh(blushGeo, pinkMat);
    leftBlush.scale.set(1.3, 0.65, 0.5);
    leftBlush.position.set(-0.095, -0.006, 0.142);
    const rightBlush = new THREE.Mesh(blushGeo, pinkMat);
    rightBlush.scale.set(1.3, 0.65, 0.5);
    rightBlush.position.set(0.095, -0.006, 0.142);
    this.petGroup.add(leftBlush, rightBlush);

    // Whiskers
    const whiskerGeo = new THREE.CylinderGeometry(0.0025, 0.0025, 0.055, 6);
    for (const side of [-1, 1]) {
      for (const idx of [-1, 1]) {
        const w = new THREE.Mesh(whiskerGeo, whiskerMat);
        w.rotation.z = Math.PI / 2 + side * idx * 0.12;
        w.position.set(side * 0.115, 0.002 + idx * 0.014, 0.145);
        this.petGroup.add(w);
      }
    }

    // Nose & expressive mouth
    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(0.014, 12, 12),
      darkMat
    );
    nose.scale.set(1.3, 0.85, 0.8);
    nose.position.set(0, -0.002, 0.169);
    this.mouthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.017, 12, 12),
      pinkMat
    );
    this.mouthMesh.position.set(0, -0.032, 0.163);
    this.petGroup.add(nose, this.mouthMesh);

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
    this.tailGroup.position.set(-0.185, -0.05, -0.05);
    this.tailGroup.rotation.z = 0.55;
    this.petGroup.add(this.tailGroup);

    // --- Hats ---
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
    partyHat.position.set(0, 0.22, 0.02);
    this.hatGroups['hat_party'] = partyHat;

    const crown = new THREE.Group();
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.72,
      roughness: 0.2,
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
    crown.position.set(0, 0.195, 0.02);
    this.hatGroups['hat_crown'] = crown;

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
    wizard.position.set(0, 0.185, 0.02);
    this.hatGroups['hat_wizard'] = wizard;

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
    flower.position.set(-0.08, 0.185, 0.08);
    flower.rotation.y = 0.25;
    this.hatGroups['hat_flower'] = flower;

    Object.values(this.hatGroups).forEach((g) => this.petGroup.add(g));

    // --- Accessories ---
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
    bowTie.position.set(0, -0.085, 0.155);
    this.accGroups['acc_bowtie'] = bowTie;

    const glasses = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      metalness: 0.55,
      roughness: 0.25,
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
    leftRim.position.set(-0.06, 0.032, 0.172);
    const rightRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.034, 0.006, 8, 20),
      frameMat
    );
    rightRim.position.set(0.06, 0.032, 0.172);
    const leftLens = new THREE.Mesh(
      new THREE.CircleGeometry(0.032, 16),
      lensMat
    );
    leftLens.position.set(-0.06, 0.032, 0.173);
    const rightLens = new THREE.Mesh(
      new THREE.CircleGeometry(0.032, 16),
      lensMat
    );
    rightLens.position.set(0.06, 0.032, 0.173);
    const bridge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.004, 0.055, 8),
      frameMat
    );
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.034, 0.174);
    glasses.add(leftRim, rightRim, leftLens, rightLens, bridge);
    this.accGroups['acc_glasses'] = glasses;

    const scarf = new THREE.Group();
    const scarfMat = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      roughness: 0.75,
    });
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.152, 0.024, 12, 28),
      scarfMat
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, -0.075, 0.02);
    const tailEnd = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.09, 0.018),
      new THREE.MeshStandardMaterial({ color: 0xc084fc, roughness: 0.75 })
    );
    tailEnd.position.set(0.05, -0.12, 0.145);
    tailEnd.rotation.z = -0.18;
    scarf.add(collar, tailEnd);
    this.accGroups['acc_scarf'] = scarf;

    const bell = new THREE.Group();
    const strap = new THREE.Mesh(
      new THREE.TorusGeometry(0.152, 0.016, 10, 28),
      new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.45 })
    );
    strap.rotation.x = Math.PI / 2;
    strap.position.set(0, -0.078, 0.02);
    const bellSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.024, 16, 16),
      goldMat
    );
    bellSphere.position.set(0, -0.1, 0.165);
    bell.add(strap, bellSphere);
    this.accGroups['acc_bell'] = bell;

    Object.values(this.accGroups).forEach((g) => this.petGroup.add(g));

    this.petGroup.traverse((obj) => {
      obj.userData.miauAction = 'pet';
    });

    this.petInteractive = new InteractiveProp(
      'Miau 3D',
      this.petGroup,
      () => this.triggerPetFromScene(),
      1
    );
    this.petInteractive.userData.miauAction = 'pet';

    // Soft contact shadow directly under Miau on rug
    this.contactShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.19, 28),
      new THREE.MeshBasicMaterial({
        color: 0x3b1f6e,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
      })
    );
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.contactShadow.position.y = 0.028 - PET_BASE_Y;
    this.contactShadow.xb = { pointerEvents: 'none' };

    this.petMover.add(this.petInteractive, this.contactShadow);
    this.petMover.position.set(this.petPos.x, PET_BASE_Y, this.petPos.z);
    this.petMover.rotation.y = this.petYaw;
    this.stageRoot.add(this.petMover);
    this.interactiveRoots.push(this.petInteractive);
  }

  private buildInteractiveProps(): void {
    // 1. Yarn Ball (Play)
    const yarnGroup = new THREE.Group();
    const yarnCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 20, 16),
      new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.65 })
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
    yarnGroup.traverse((o) => (o.userData.miauAction = 'yarn'));

    this.yarnProp = new InteractiveProp('Novelo de Lã', yarnGroup, () => {
      this.triggerYarnPlayFromScene();
    });
    this.yarnProp.position.copy(YARN_HOME);
    this.stageRoot.add(this.yarnProp);
    this.interactiveRoots.push(this.yarnProp);

    // 2. Bouncy Striped Toy Ball (Throw & Chase!)
    const ballCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.056, 22, 18),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        roughness: 0.22,
        metalness: 0.15,
      })
    );
    const ballRing1 = new THREE.Mesh(
      new THREE.TorusGeometry(0.054, 0.007, 8, 24),
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        roughness: 0.25,
      })
    );
    const ballRing2 = new THREE.Mesh(
      new THREE.TorusGeometry(0.054, 0.007, 8, 24),
      new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        roughness: 0.25,
      })
    );
    ballRing2.rotation.y = Math.PI / 2;
    this.ballMeshGroup.add(ballCore, ballRing1, ballRing2);
    this.ballMeshGroup.traverse((o) => (o.userData.miauAction = 'ball'));

    this.ballProp = new InteractiveProp(
      'Bolinha do Miau',
      this.ballMeshGroup,
      () => {
        this.throwBall();
      }
    );
    this.ballProp.position.copy(this.ballPos);
    this.stageRoot.add(this.ballProp);
    this.interactiveRoots.push(this.ballProp);

    // 3. Fish Bowl (Feed)
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
    bowlGroup.traverse((o) => (o.userData.miauAction = 'feed'));

    this.bowlProp = new InteractiveProp('Tigela de Peixinho', bowlGroup, () => {
      this.triggerFeedFromScene();
    });
    this.bowlProp.position.set(BOWL_POS.x, 0.052, BOWL_POS.z);
    this.stageRoot.add(this.bowlProp);
    this.interactiveRoots.push(this.bowlProp);

    // 4. Bubble Soap (Clean)
    const soapGroup = new THREE.Group();
    const soapBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.036, 0.058),
      new THREE.MeshStandardMaterial({ color: 0x22d3ee, roughness: 0.25 })
    );
    const decoBubble = new THREE.Mesh(this.bubbleGeo, this.bubbleMat);
    decoBubble.position.set(0.03, 0.045, 0.01);
    soapGroup.add(soapBar, decoBubble);
    soapGroup.traverse((o) => (o.userData.miauAction = 'clean'));

    this.soapProp = new InteractiveProp('Sabonete Espuma', soapGroup, () => {
      this.triggerCleanFromScene();
    });
    this.soapProp.position.copy(SOAP_POS);
    this.stageRoot.add(this.soapProp);
    this.interactiveRoots.push(this.soapProp);
  }

  private buildTapRing(): void {
    this.tapRingMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.045, 0.075, 28),
      new THREE.MeshBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    this.tapRingMesh.rotation.x = -Math.PI / 2;
    this.tapRingMesh.visible = false;
    this.tapRingMesh.xb = { pointerEvents: 'none' };
    this.stageRoot.add(this.tapRingMesh);
  }

  private showTapRingAt(localPos: THREE.Vector3, colorHex = 0xfde047): void {
    if (!this.tapRingMesh) return;
    (this.tapRingMesh.material as THREE.MeshBasicMaterial).color.setHex(
      colorHex
    );
    this.tapRingMesh.position.set(localPos.x, 0.032, localPos.z);
    this.tapRingMesh.scale.setScalar(0.5);
    this.tapRingMesh.visible = true;
    this.tapRingTimer = 0.55;
  }

  // --- Interactive Actions (callable from 3D taps, Spatial Card, or HUD buttons) ---

  public triggerPetFromScene(): void {
    this.petInteractive?.triggerPop();
    this.petState = 'petting';
    this.petStateTimer = 2.0;
    this.triggerBounce();
    this.meowAnimTime = 0.45;
    this.spawnParticles('heart', 7);
    this.callbacks.onPet();
    this.callbacks.onActionFeedback?.('Purrr~ Miau adorou o carinho! 💖');
  }

  public triggerFeedFromScene(): void {
    this.bowlProp?.triggerPop();
    this.petTarget.set(BOWL_POS.x - 0.16, 0, BOWL_POS.z - 0.08);
    this.petState = 'go_eat';
    this.petStateTimer = 3.2;
    this.triggerBounce();
    this.spawnParticles('star', 7);
    this.callbacks.onFeed();
    this.callbacks.onActionFeedback?.('Nham nham! Miau foi comer peixinho! 🐟');
  }

  public triggerCleanFromScene(): void {
    this.soapProp?.triggerPop();
    this.petTarget.set(SOAP_POS.x + 0.22, 0, SOAP_POS.z + 0.14);
    this.petState = 'go_clean';
    this.petStateTimer = 2.8;
    this.triggerSpin();
    this.spawnParticles('bubble', 12);
    this.callbacks.onClean();
    this.callbacks.onActionFeedback?.('Banho de espuma cheiroso! 🫧');
  }

  public triggerYarnPlayFromScene(): void {
    this.yarnProp?.triggerPop();
    this.petTarget.set(YARN_HOME.x + 0.16, 0, YARN_HOME.z - 0.06);
    this.petState = 'go_yarn';
    this.petStateTimer = 2.8;
    this.triggerSpin();
    this.spawnParticles('star', 6);
    this.callbacks.onPlay('yarn');
    this.callbacks.onActionFeedback?.('Miau correu para o novelo de lã! 🧶');
  }

  public triggerMeowFromScene(): void {
    this.petInteractive?.triggerPop();
    this.triggerBounce();
    this.meowAnimTime = 0.6;
    this.spawnParticles('heart', 4);
    this.callbacks.onMeow();
    this.callbacks.onActionFeedback?.('Miau! 😺');
  }

  public setBallThrowMode(enabled: boolean): void {
    this.ballThrowMode = enabled;
    this.callbacks.onActionFeedback?.(
      enabled
        ? 'Modo Bolinha ativo! Toque no tapete para lançar ⚽'
        : 'Modo livre ativo! Toque no tapete para o Miau andar 🐾'
    );
  }

  public isBallThrowMode(): boolean {
    return this.ballThrowMode;
  }

  public throwBall(localTarget?: THREE.Vector3): void {
    if (this.isSleeping) {
      this.callbacks.onToggleSleep();
    }
    this.ballProp?.triggerPop();
    this.ballActive = true;
    this.ballKickCooldown = 0.35;

    if (localTarget) {
      const clampedR = Math.hypot(localTarget.x, localTarget.z);
      if (clampedR > RUG_WALK_RADIUS) {
        localTarget.x *= RUG_WALK_RADIUS / clampedR;
        localTarget.z *= RUG_WALK_RADIUS / clampedR;
      }
      this.showTapRingAt(localTarget, 0x38bdf8);
      _ballImpulse
        .set(localTarget.x - this.ballPos.x, 0, localTarget.z - this.ballPos.z)
        .multiplyScalar(2.4);
      if (_ballImpulse.length() < 0.8) {
        _ballImpulse.normalize().multiplyScalar(1.25);
      }
      this.ballVel.set(_ballImpulse.x, 2.25, _ballImpulse.z);
    } else {
      // Throw dynamically away from Miau or around the rug
      const angle = Math.atan2(
        this.petPos.z - this.ballPos.z,
        this.petPos.x - this.ballPos.x
      );
      const throwAngle = angle + Math.PI + (Math.random() - 0.5) * 1.4;
      const speed = 1.45 + Math.random() * 0.55;
      this.ballVel.set(
        Math.cos(throwAngle) * speed,
        2.35,
        Math.sin(throwAngle) * speed
      );
    }

    this.petState = 'chase_ball';
    this.petStateTimer = 5.0;
    this.meowAnimTime = 0.45;
    if (soundService.enabled) {
      soundService.playMeow(1.26);
    }
    hapticService.play();
    this.callbacks.onActionFeedback?.('Bolinha lançada! Miau foi buscar! ⚽');
  }

  private spawnParticles(
    kind: 'bubble' | 'heart' | 'star',
    count: number
  ): void {
    const geo =
      kind === 'bubble'
        ? this.bubbleGeo
        : kind === 'heart'
          ? this.heartGeo
          : this.starParticleGeo;
    const mat =
      kind === 'bubble'
        ? this.bubbleMat
        : kind === 'heart'
          ? this.heartMat
          : this.starParticleMat;

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        this.petPos.x + (Math.random() - 0.5) * 0.34,
        0.24 + Math.random() * 0.18,
        this.petPos.z + (Math.random() - 0.5) * 0.28
      );
      mesh.scale.setScalar(0.65 + Math.random() * 0.7);
      mesh.xb = { pointerEvents: 'none' };
      this.stageRoot.add(mesh);
      const maxLife = 1.15 + Math.random() * 0.55;
      this.activeParticles.push({
        mesh,
        life: maxLife,
        maxLife,
        vy: 0.26 + Math.random() * 0.22,
        vx: (Math.random() - 0.5) * 0.14,
        vz: (Math.random() - 0.5) * 0.14,
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
      text: 'Miau! (Vamos brincar e explorar em 3D?)',
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
      size: { width: 0.64, height: 'auto' },
      manipulation: true,
      edge: true,
      style: { flexDirection: 'column', gap: 10, padding: 16 },
      children: [
        new xb.UIText({
          text: 'Sala do Miau (3D / XR)',
          style: { fontSize: 25, fontWeight: 'bold', textAlign: 'center' },
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
              onClick: () => this.triggerPetFromScene(),
            }),
            new xb.UIButton({
              label: 'Peixinho',
              icon: 'restaurant',
              style: { flexGrow: 1 },
              onClick: () => this.triggerFeedFromScene(),
            }),
          ],
        }),
        new xb.UIPanel({
          style: { width: '100%', flexDirection: 'row', gap: 8 },
          children: [
            new xb.UIButton({
              label: 'Bolinha',
              icon: 'sports_soccer',
              style: { flexGrow: 1 },
              onClick: () => this.throwBall(),
            }),
            new xb.UIButton({
              label: 'Banho',
              icon: 'cleaning_services',
              style: { flexGrow: 1 },
              onClick: () => this.triggerCleanFromScene(),
            }),
          ],
        }),
        new xb.UIPanel({
          style: { width: '100%', flexDirection: 'row', gap: 8 },
          children: [
            new xb.UIButton({
              label: 'Miar',
              icon: 'pets',
              style: { flexGrow: 1 },
              onClick: () => this.triggerMeowFromScene(),
            }),
            new xb.UIButton({
              label: 'Soneca',
              icon: 'bedtime',
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
    this.statusCard.position.set(0.68, 0.56, -0.18);
    this.statusCard.rotation.y = -0.45;
    this.stageRoot.add(this.statusCard);
  }

  syncState(
    stats: PetStats,
    equipped: EquippedItems,
    speechText: string,
    isSleeping = false
  ): void {
    const wasSleeping = this.isSleeping;
    this.isSleeping = isSleeping;
    if (isSleeping && !wasSleeping) {
      this.petState = 'sleeping';
      this.petTarget.copy(BED_POS);
    } else if (!isSleeping && wasSleeping) {
      this.petState = 'idle';
      this.petStateTimer = 0.9;
      this.triggerBounce();
    }

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
    this.bounceTime = 0.62;
  }

  triggerSpin(): void {
    this.spinTime = 0.72;
  }

  // --- Touch & Mouse Orbit / Pinch / Pan / Tap Raycasting ---

  private bindTouchNavigation(): void {
    if (this.canvasBound) return;
    const dom = xb.core.renderer?.domElement;
    if (!dom) return;
    this.boundCanvas = dom;
    this.canvasBound = true;

    dom.addEventListener('pointerdown', this.onCanvasPointerDown);
    dom.addEventListener('pointermove', this.onCanvasPointerMove);
    dom.addEventListener('pointerup', this.onCanvasPointerUp);
    dom.addEventListener('pointercancel', this.onCanvasPointerUp);
    dom.addEventListener('wheel', this.onCanvasWheel, { passive: false });
  }

  private isNonHeadsetActive(): boolean {
    if (!document.body.classList.contains('xr-mode-active')) return false;
    return !xb.core.webXRSessionManager?.currentSession;
  }

  private onCanvasPointerDown = (event: PointerEvent): void => {
    if (!this.isNonHeadsetActive()) return;
    this.activePointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
    });
    if (this.activePointers.size === 1) {
      this.dragMoved = false;
      this.yawVelocity = 0;
      this.pitchVelocity = 0;
    } else if (this.activePointers.size === 2) {
      this.dragMoved = true;
      const pts = Array.from(this.activePointers.values());
      this.lastPinchDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      this.lastPinchCenterX = (pts[0].x + pts[1].x) * 0.5;
      this.lastPinchCenterY = (pts[0].y + pts[1].y) * 0.5;
    }
  };

  private onCanvasPointerMove = (event: PointerEvent): void => {
    if (!this.isNonHeadsetActive()) return;
    const prev = this.activePointers.get(event.pointerId);
    if (!prev) return;

    const dx = event.clientX - prev.x;
    const dy = event.clientY - prev.y;
    const totalMoved = Math.hypot(
      event.clientX - prev.startX,
      event.clientY - prev.startY
    );
    prev.x = event.clientX;
    prev.y = event.clientY;

    if (totalMoved > 7) {
      this.dragMoved = true;
    }

    if (this.activePointers.size === 1 && this.dragMoved) {
      const yawDelta = -dx * 0.0085;
      const pitchDelta = dy * 0.0062;
      this.targetYaw += yawDelta;
      this.targetPitch = THREE.MathUtils.clamp(
        this.targetPitch + pitchDelta,
        -0.12,
        1.18
      );
      this.yawVelocity = yawDelta * 36;
      this.pitchVelocity = pitchDelta * 36;
    } else if (this.activePointers.size === 2) {
      const pts = Array.from(this.activePointers.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const cx = (pts[0].x + pts[1].x) * 0.5;
      const cy = (pts[0].y + pts[1].y) * 0.5;

      if (this.lastPinchDist > 10 && dist > 10) {
        const ratio = this.lastPinchDist / dist;
        this.targetDistance = THREE.MathUtils.clamp(
          this.targetDistance * ratio,
          0.72,
          3.15
        );
      }

      const panDx = cx - this.lastPinchCenterX;
      const panDy = cy - this.lastPinchCenterY;
      const panScale = 0.0022 * this.targetDistance;
      const cosY = Math.cos(this.currentYaw);
      const sinY = Math.sin(this.currentYaw);
      this.cameraTarget.x = THREE.MathUtils.clamp(
        this.cameraTarget.x - (panDx * cosY + panDy * sinY) * panScale,
        -1.3,
        1.3
      );
      this.cameraTarget.z = THREE.MathUtils.clamp(
        this.cameraTarget.z - (-panDx * sinY + panDy * cosY) * panScale,
        -2.3,
        -0.2
      );

      this.lastPinchDist = dist;
      this.lastPinchCenterX = cx;
      this.lastPinchCenterY = cy;
    }
  };

  private onCanvasPointerUp = (event: PointerEvent): void => {
    const pointer = this.activePointers.get(event.pointerId);
    this.activePointers.delete(event.pointerId);

    if (
      pointer &&
      !this.dragMoved &&
      this.activePointers.size === 0 &&
      this.isNonHeadsetActive()
    ) {
      this.handleCanvasTap(event.clientX, event.clientY);
    }

    if (this.activePointers.size < 2) {
      this.lastPinchDist = 0;
    }
  };

  private onCanvasWheel = (event: WheelEvent): void => {
    if (!this.isNonHeadsetActive()) return;
    event.preventDefault();
    this.targetDistance = THREE.MathUtils.clamp(
      this.targetDistance + event.deltaY * 0.0014,
      0.72,
      3.15
    );
  };

  private handleCanvasTap(clientX: number, clientY: number): void {
    const cam = xb.core.camera;
    const dom = this.boundCanvas;
    if (!cam || !dom) return;

    const rect = dom.getBoundingClientRect();
    _ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );

    this.tapRaycaster.setFromCamera(_ndc, cam);

    // If tap hits Spatial UICard directly, let XR Blocks UI handle its button click
    if (this.statusCard) {
      const cardHits = this.tapRaycaster.intersectObject(this.statusCard, true);
      if (cardHits.length > 0) {
        return;
      }
    }

    const hits = this.tapRaycaster.intersectObjects(this.interactiveRoots, true);
    if (hits.length === 0) return;

    const firstHit = hits[0];
    let action: string | undefined;
    let cursor: THREE.Object3D | null = firstHit.object;
    while (cursor) {
      if (typeof cursor.userData?.miauAction === 'string') {
        action = cursor.userData.miauAction as string;
        break;
      }
      cursor = cursor.parent;
    }

    if (action === 'pet') {
      this.triggerPetFromScene();
    } else if (action === 'ball') {
      this.throwBall();
    } else if (action === 'yarn') {
      this.triggerYarnPlayFromScene();
    } else if (action === 'feed') {
      this.triggerFeedFromScene();
    } else if (action === 'clean') {
      this.triggerCleanFromScene();
    } else if (action === 'bed') {
      this.callbacks.onToggleSleep();
    } else if (action === 'floor') {
      _tapWorld.copy(firstHit.point);
      _tapLocal.copy(_tapWorld);
      this.stageRoot.worldToLocal(_tapLocal);
      const r = Math.hypot(_tapLocal.x, _tapLocal.z);
      if (r > RUG_WALK_RADIUS) {
        _tapLocal.x *= RUG_WALK_RADIUS / r;
        _tapLocal.z *= RUG_WALK_RADIUS / r;
      }
      if (this.ballThrowMode) {
        this.throwBall(_tapLocal);
      } else {
        if (this.isSleeping) {
          this.callbacks.onToggleSleep();
        }
        this.petTarget.set(_tapLocal.x, 0, _tapLocal.z);
        this.petState = 'wander';
        this.petStateTimer = 4.0;
        this.showTapRingAt(_tapLocal, 0xfde047);
        hapticService.tap();
        this.callbacks.onActionFeedback?.('Miau está indo até lá! 🐾');
      }
    }
  }

  // --- Gyroscope & Virtual Joystick Navigation ---

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
    if (this.hasDeviceReading) {
      this.gyroBaseQuat.copy(this.currentDeviceQuat);
      this.gyroCalibrated = true;
      this.lastGyroYaw = 0;
      this.lastGyroPitch = 0;
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
    window.addEventListener('deviceorientation', this.gyroListener);
    return {
      enabled: true,
      message: 'Giroscópio ativo! Mova o celular para girar a visão.',
    };
  }

  public isGyroscopeEnabled(): boolean {
    return this.gyroEnabled;
  }

  public setMoveInput(forward: number, right: number): void {
    this.moveInput.forward = forward;
    this.moveInput.right = right;
  }

  public zoomBy(delta: number): void {
    this.targetDistance = THREE.MathUtils.clamp(
      this.targetDistance + delta,
      0.72,
      3.15
    );
  }

  public rotateBy(deltaYaw: number): void {
    this.targetYaw += deltaYaw;
  }

  public resetCameraView(): void {
    this.cameraTarget.set(0, 0.94, -1.25);
    this.targetYaw = 0;
    this.targetPitch = 0.28;
    this.targetDistance = 1.68;
    this.yawVelocity = 0;
    this.pitchVelocity = 0;
    this.calibrateGyroscope();

    const cam = xb.core.camera;
    if (cam) {
      cam.position.set(0, 1.4, 0.35);
      cam.lookAt(this.cameraTarget);
    }
  }

  private updateBallPhysics(dt: number): void {
    if (!this.ballProp) return;

    if (this.ballKickCooldown > 0) {
      this.ballKickCooldown = Math.max(0, this.ballKickCooldown - dt);
    }

    if (!this.ballActive) {
      this.ballProp.position.set(this.ballPos.x, 0.078, this.ballPos.z);
      return;
    }

    // Gravity + velocity integration
    this.ballVel.y -= 6.2 * dt;
    this.ballPos.addScaledVector(this.ballVel, dt);

    // Floor bounce
    const minY = 0.078;
    if (this.ballPos.y <= minY) {
      this.ballPos.y = minY;
      if (Math.abs(this.ballVel.y) > 0.42) {
        this.ballVel.y = -this.ballVel.y * 0.66;
      } else {
        this.ballVel.y = 0;
      }
      // Rolling friction
      const damp = Math.exp(-2.1 * dt);
      this.ballVel.x *= damp;
      this.ballVel.z *= damp;
    }

    // Keep ball inside rug perimeter
    const r = Math.hypot(this.ballPos.x, this.ballPos.z);
    const maxBallR = 0.86;
    if (r > maxBallR) {
      const nx = this.ballPos.x / r;
      const nz = this.ballPos.z / r;
      this.ballPos.x = nx * maxBallR;
      this.ballPos.z = nz * maxBallR;
      const dot = this.ballVel.x * nx + this.ballVel.z * nz;
      if (dot > 0) {
        this.ballVel.x -= 1.7 * dot * nx;
        this.ballVel.z -= 1.7 * dot * nz;
      }
    }

    // Spin ball visually as it moves
    this.ballMeshGroup.rotation.x += this.ballVel.z * dt * 12;
    this.ballMeshGroup.rotation.z -= this.ballVel.x * dt * 12;
    this.ballProp.position.copy(this.ballPos);

    if (
      this.ballPos.y <= minY + 0.002 &&
      this.ballVel.lengthSq() < 0.008
    ) {
      this.ballActive = false;
      this.ballVel.set(0, 0, 0);
    }
  }

  private updatePetBehavior(dt: number, t: number): void {
    // Spontaneous adorable meow timer while awake
    if (!this.isSleeping && this.isNonHeadsetActive()) {
      this.spontaneousMeowCooldown -= dt;
      if (this.spontaneousMeowCooldown <= 0) {
        this.spontaneousMeowCooldown = 14 + Math.random() * 10;
        this.meowAnimTime = 0.45;
        if (soundService.enabled) {
          soundService.playMeow(1.06 + Math.random() * 0.24);
        }
        if (this.petState === 'idle') {
          this.triggerBounce();
        }
      }
    }

    // Autonomous state transitions
    this.petStateTimer -= dt;
    if (this.isSleeping) {
      this.petState = 'sleeping';
      this.petTarget.copy(BED_POS);
    } else if (this.petState === 'chase_ball') {
      this.petTarget.set(this.ballPos.x, 0, this.ballPos.z);
    } else if (this.petStateTimer <= 0) {
      const roll = Math.random();
      if (roll < 0.56) {
        // Pick a fun cozy point on the rug
        const ang = Math.random() * Math.PI * 2;
        const dist = 0.16 + Math.random() * 0.5;
        this.petTarget.set(Math.cos(ang) * dist, 0, Math.sin(ang) * dist);
        this.petState = 'wander';
        this.petStateTimer = 3.2 + Math.random() * 2.2;
      } else if (roll < 0.78) {
        // Trot over to play with ball!
        this.petTarget.set(this.ballPos.x, 0, this.ballPos.z);
        this.petState = 'chase_ball';
        this.petStateTimer = 4.0;
      } else if (roll < 0.9) {
        // Visit the yarn ball
        this.petTarget.set(YARN_HOME.x + 0.14, 0, YARN_HOME.z - 0.08);
        this.petState = 'go_yarn';
        this.petStateTimer = 3.2;
      } else {
        // Happy idle hop
        this.petState = 'idle';
        this.petStateTimer = 1.6 + Math.random() * 1.4;
        this.triggerBounce();
      }
    }

    // Movement toward target
    const dx = this.petTarget.x - this.petPos.x;
    const dz = this.petTarget.z - this.petPos.z;
    const dist = Math.hypot(dx, dz);
    const isChasing = this.petState === 'chase_ball';
    const moveSpeed = isChasing ? 0.72 : 0.42;

    let walking = false;
    if (dist > 0.045) {
      walking = true;
      const step = Math.min(dist, moveSpeed * dt);
      this.petPos.x += (dx / dist) * step;
      this.petPos.z += (dz / dist) * step;

      const targetYaw = Math.atan2(dx, dz);
      this.petYaw += shortestAngleDiff(this.petYaw, targetYaw) * Math.min(1, 10 * dt);
      this.walkCycle += dt * (isChasing ? 16 : 11);
    } else {
      // Arrived! Trigger context reaction if chasing ball or visiting prop
      if (this.petState === 'chase_ball' && this.ballKickCooldown <= 0) {
        this.ballKickCooldown = 0.9;
        this.ballActive = true;
        const kickAngle = Math.random() * Math.PI * 2;
        this.ballVel.set(
          Math.cos(kickAngle) * 1.35,
          1.75,
          Math.sin(kickAngle) * 1.35
        );
        this.triggerSpin();
        this.spawnParticles('star', 5);
        this.callbacks.onPlay('ball');
        this.callbacks.onActionFeedback?.('Miau rebateu a bolinha! ⚽✨');
        this.petState = 'idle';
        this.petStateTimer = 2.0;
      } else if (this.petState === 'go_yarn') {
        this.yarnProp?.triggerPop();
        this.triggerSpin();
        this.petState = 'idle';
        this.petStateTimer = 2.0;
      } else if (this.petState === 'wander') {
        this.petState = 'idle';
        this.petStateTimer = 1.5 + Math.random() * 1.8;
      } else if (!this.isSleeping) {
        // Face slightly toward the camera when resting/petting
        const cam = xb.core.camera;
        if (cam) {
          const toCamYaw = Math.atan2(
            cam.position.x - (STAGE_POS.x + this.petPos.x),
            cam.position.z - (STAGE_POS.z + this.petPos.z)
          );
          this.petYaw +=
            shortestAngleDiff(this.petYaw, toCamYaw) * Math.min(1, 3.5 * dt);
        }
      }
    }

    // Apply mover transform
    const bedOffset = this.isSleeping && !walking ? 0.025 : 0;
    const walkHop = walking ? Math.abs(Math.sin(this.walkCycle)) * 0.035 : 0;
    this.petMover.position.set(
      this.petPos.x,
      PET_BASE_Y + bedOffset + walkHop,
      this.petPos.z
    );
    this.petMover.rotation.y = this.petYaw;

    // Paw gait animation
    const pawSwing = walking ? Math.sin(this.walkCycle) * 0.032 : 0;
    const pawLift = walking ? Math.max(0, Math.cos(this.walkCycle)) * 0.022 : 0;
    if (this.frontLeftPaw && this.frontRightPaw && this.backLeftPaw && this.backRightPaw) {
      this.frontLeftPaw.position.z = 0.085 + pawSwing;
      this.frontLeftPaw.position.y = -0.145 + pawLift;
      this.frontRightPaw.position.z = 0.085 - pawSwing;
      this.frontRightPaw.position.y = -0.145 + Math.max(0, -Math.cos(this.walkCycle)) * 0.022;
      this.backLeftPaw.position.z = -0.07 - pawSwing;
      this.backRightPaw.position.z = -0.07 + pawSwing;
    }

    // Tail wagging
    const tailSpeed = this.isSleeping ? 0.8 : walking ? 5.0 : 2.3;
    this.tailGroup.rotation.z = 0.55 + Math.sin(t * tailSpeed) * 0.2;

    // Ear wiggle
    if (this.leftEarMesh && this.rightEarMesh) {
      const earWiggle = walking
        ? Math.sin(this.walkCycle * 0.5) * 0.06
        : Math.sin(t * 1.4) * 0.025;
      this.leftEarMesh.rotation.z = 0.28 + earWiggle;
      this.rightEarMesh.rotation.z = -0.28 - earWiggle;
    }

    // Blinking & sleepy eyes
    this.blinkTimer -= dt;
    if (this.blinkTimer <= -0.14) {
      this.blinkTimer = 2.6 + Math.random() * 2.5;
    }
    const blinkingNow = this.blinkTimer < 0;
    if (this.leftEyeMesh && this.rightEyeMesh) {
      const targetEyeY = this.isSleeping ? 0.16 : blinkingNow ? 0.12 : 1.0;
      this.leftEyeMesh.scale.y = THREE.MathUtils.damp(
        this.leftEyeMesh.scale.y,
        targetEyeY,
        18,
        dt
      );
      this.rightEyeMesh.scale.y = THREE.MathUtils.damp(
        this.rightEyeMesh.scale.y,
        targetEyeY,
        18,
        dt
      );
    }

    // Meow mouth expression
    if (this.mouthMesh) {
      if (this.meowAnimTime > 0) {
        this.meowAnimTime = Math.max(0, this.meowAnimTime - dt);
        const openAmt = 1 + Math.sin((this.meowAnimTime / 0.5) * Math.PI) * 0.85;
        this.mouthMesh.scale.set(1.15, openAmt, 1.1);
      } else {
        this.mouthMesh.scale.set(1, 0.85, 1);
      }
    }

    // Bounce & Spin overlays
    let yOffset = Math.sin(t) * 0.01;
    let extraRotY = 0;
    let scaleY = 1;
    let scaleXZ = 1;

    if (this.bounceTime > 0) {
      this.bounceTime = Math.max(0, this.bounceTime - dt);
      const p = 1 - this.bounceTime / 0.62;
      const wave = Math.sin(p * Math.PI);
      yOffset = wave * 0.11;
      scaleY = 1 + Math.sin(p * Math.PI * 2) * 0.08;
      scaleXZ = 1 - Math.sin(p * Math.PI * 2) * 0.04;
    }

    if (this.spinTime > 0) {
      this.spinTime = Math.max(0, this.spinTime - dt);
      const p = 1 - this.spinTime / 0.72;
      extraRotY = p * Math.PI * 2;
      yOffset = Math.max(yOffset, Math.sin(p * Math.PI) * 0.09);
    }

    this.petGroup.position.y = this.isSleeping ? -0.025 : yOffset;
    this.petGroup.rotation.y = extraRotY;
    this.petGroup.scale.set(scaleXZ, this.isSleeping ? 0.9 : scaleY, scaleXZ);

    if (this.contactShadow) {
      const heightRatio = Math.max(0.55, 1 - (yOffset + walkHop) * 2.2);
      this.contactShadow.scale.setScalar(heightRatio);
    }
  }

  update(): void {
    if (!this.canvasBound) {
      this.bindTouchNavigation();
    }
    const dt = Math.min(xb.getDeltaTime(), 0.05);
    const t = performance.now() * 0.002;

    this.updateBallPhysics(dt);
    this.updatePetBehavior(dt, t);

    // Tap ring ripple fade
    if (this.tapRingMesh && this.tapRingTimer > 0) {
      this.tapRingTimer = Math.max(0, this.tapRingTimer - dt);
      const p = 1 - this.tapRingTimer / 0.55;
      this.tapRingMesh.scale.setScalar(0.7 + p * 1.15);
      (this.tapRingMesh.material as THREE.MeshBasicMaterial).opacity =
        (1 - p) * 0.85;
      if (this.tapRingTimer <= 0) {
        this.tapRingMesh.visible = false;
      }
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
        const s =
          0.75 + 0.35 * Math.sin(t * 1.8 + (star.userData.phase as number));
        star.scale.setScalar(s);
        star.rotation.y += dt * 0.7;
      }
    }

    // Floating particles (soap bubbles, hearts, stars)
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i];
      p.life -= dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.x += (p.vx + Math.sin(t * 3 + i) * 0.06) * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.y += dt * 2.2;
      if (p.life <= 0) {
        p.mesh.removeFromParent();
        this.activeParticles.splice(i, 1);
      }
    }

    // Camera Touch Orbit + Momentum + Joystick Walk + Gyroscope
    const cam = xb.core.camera;
    const inNativeXR = Boolean(xb.core.webXRSessionManager?.currentSession);
    if (cam && !inNativeXR && document.body.classList.contains('xr-mode-active')) {
      // Inertial glide after touch swipe release
      if (this.activePointers.size === 0) {
        if (Math.abs(this.yawVelocity) > 0.001) {
          this.targetYaw += this.yawVelocity * dt;
          this.yawVelocity *= Math.exp(-6.5 * dt);
        } else {
          this.yawVelocity = 0;
        }
        if (Math.abs(this.pitchVelocity) > 0.001) {
          this.targetPitch = THREE.MathUtils.clamp(
            this.targetPitch + this.pitchVelocity * dt,
            -0.12,
            1.18
          );
          this.pitchVelocity *= Math.exp(-6.5 * dt);
        } else {
          this.pitchVelocity = 0;
        }
      }

      // Apply Gyroscope delta smoothly onto orbit yaw/pitch
      if (this.gyroEnabled && this.hasDeviceReading && this.gyroCalibrated) {
        _gyroTargetQuat
          .copy(this.gyroBaseQuat)
          .invert()
          .multiply(this.currentDeviceQuat);
        _gyroDeltaEuler.setFromQuaternion(_gyroTargetQuat, 'YXZ');
        const dyaw = _gyroDeltaEuler.y - this.lastGyroYaw;
        const dpitch = _gyroDeltaEuler.x - this.lastGyroPitch;
        this.lastGyroYaw = _gyroDeltaEuler.y;
        this.lastGyroPitch = _gyroDeltaEuler.x;

        this.targetYaw += dyaw * 0.9;
        this.targetPitch = THREE.MathUtils.clamp(
          this.targetPitch - dpitch * 0.75,
          -0.12,
          1.18
        );
      }

      // Fast, responsive joystick / directional movement relative to camera yaw
      if (this.moveInput.forward !== 0 || this.moveInput.right !== 0) {
        const walkSpeed = 2.4 * dt;
        _moveForward.set(-Math.sin(this.currentYaw), 0, -Math.cos(this.currentYaw));
        _moveRight.crossVectors(_moveForward, _worldUp).normalize();

        this.cameraTarget.addScaledVector(
          _moveForward,
          this.moveInput.forward * walkSpeed
        );
        this.cameraTarget.addScaledVector(
          _moveRight,
          this.moveInput.right * walkSpeed
        );
        this.cameraTarget.x = THREE.MathUtils.clamp(
          this.cameraTarget.x,
          -1.45,
          1.45
        );
        this.cameraTarget.z = THREE.MathUtils.clamp(
          this.cameraTarget.z,
          -2.45,
          -0.1
        );
      }

      // Smooth exponential damping on orbit parameters
      this.currentYaw = THREE.MathUtils.damp(
        this.currentYaw,
        this.targetYaw,
        14,
        dt
      );
      this.currentPitch = THREE.MathUtils.damp(
        this.currentPitch,
        this.targetPitch,
        14,
        dt
      );
      this.currentDistance = THREE.MathUtils.damp(
        this.currentDistance,
        this.targetDistance,
        14,
        dt
      );

      // Compute spherical camera offset around cameraTarget
      const cosP = Math.cos(this.currentPitch);
      _camOffset.set(
        Math.sin(this.currentYaw) * cosP * this.currentDistance,
        Math.sin(this.currentPitch) * this.currentDistance + 0.16,
        Math.cos(this.currentYaw) * cosP * this.currentDistance
      );

      _camPos.copy(this.cameraTarget).add(_camOffset);
      _camPos.y = Math.max(0.88, _camPos.y);

      cam.position.copy(_camPos);
      _lookTarget.copy(this.cameraTarget);
      cam.lookAt(_lookTarget);
    }
  }

  dispose(): void {
    window.removeEventListener('deviceorientation', this.gyroListener);
    if (this.boundCanvas) {
      this.boundCanvas.removeEventListener(
        'pointerdown',
        this.onCanvasPointerDown
      );
      this.boundCanvas.removeEventListener(
        'pointermove',
        this.onCanvasPointerMove
      );
      this.boundCanvas.removeEventListener('pointerup', this.onCanvasPointerUp);
      this.boundCanvas.removeEventListener(
        'pointercancel',
        this.onCanvasPointerUp
      );
      this.boundCanvas.removeEventListener('wheel', this.onCanvasWheel);
    }
    this.bubbleGeo.dispose();
    this.bubbleMat.dispose();
    this.heartGeo.dispose();
    this.heartMat.dispose();
    this.starParticleGeo.dispose();
    this.starParticleMat.dispose();
    this.envTexture?.dispose();
  }
}
