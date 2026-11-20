import * as THREE from 'three';
import * as xb from 'xrblocks';
import type { EquippedItems, PetStats } from '../types';

export interface MiauXRCallbacks {
  onPet: () => void;
  onFeed: () => void;
  onClean: () => void;
  onExitXRMode: () => void;
}

export class MiauXRScene extends xb.Script {
  private petGroup = new THREE.Group();
  private tailGroup = new THREE.Group();
  private partyHat = new THREE.Group();
  private bowTie = new THREE.Group();
  private statusCard?: xb.UICard;
  private statsLabel?: xb.UIText;
  private speechLabel?: xb.UIText;
  private bounceTime = 0;

  constructor(private callbacks: MiauXRCallbacks) {
    super();
  }

  init(): void {
    this.add(new THREE.HemisphereLight(0xfef9ff, 0x7c5ca8, 2.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight.position.set(1.5, 3.2, 2.0);
    this.add(dirLight);

    this.buildMiau3D();
    this.buildSpatialCard();
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
    this.petGroup.add(leftEar);

    const rightEar = new THREE.Mesh(earGeo, orangeMat);
    rightEar.position.set(0.1, 0.16, 0.01);
    rightEar.rotation.z = -0.28;
    this.petGroup.add(rightEar);

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
    const leftEye = new THREE.Mesh(eyeGeo, darkMat);
    leftEye.position.set(-0.06, 0.03, 0.162);
    const rightEye = new THREE.Mesh(eyeGeo, darkMat);
    rightEye.position.set(0.06, 0.03, 0.162);
    this.petGroup.add(leftEye, rightEye);

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

    // Party Hat
    const hatCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.055, 0.12, 20),
      new THREE.MeshStandardMaterial({ color: 0x50b6e8, roughness: 0.35 })
    );
    const hatStar = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.02),
      new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.3 })
    );
    hatStar.position.y = 0.075;
    this.partyHat.add(hatCone, hatStar);
    this.partyHat.position.set(0, 0.23, 0.02);
    this.petGroup.add(this.partyHat);

    // Red Bow Tie
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
    this.bowTie.add(bowL, bowR, bowCenter);
    this.bowTie.position.set(0, -0.085, 0.16);
    this.petGroup.add(this.bowTie);

    // Wrap in ModelViewer-compatible spatial container with manipulation
    const viewer = new xb.ModelViewer({
      manipulation: {
        actions: {
          translate: { faceCamera: true },
          rotate: { axis: 'y' },
          scale: { minScale: 0.6, maxScale: 1.8 },
        },
      },
    });
    viewer.setContent(this.petGroup);
    viewer.position.set(-0.22, 1.32, -1.05);
    this.add(viewer);
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
        fontSize: 20,
        fontWeight: 'bold',
        lineHeight: 1.3,
        textAlign: 'center',
        padding: 12,
        backgroundColor: 'rgba(139, 92, 246, 0.25)',
        borderRadius: 14,
      },
    });

    this.statusCard = new xb.UICard({
      size: { width: 0.56, height: 'auto' },
      manipulation: true,
      edge: true,
      style: { flexDirection: 'column', gap: 14, padding: 20 },
      children: [
        new xb.UIText({
          text: 'Sala do Miau (XR)',
          style: { fontSize: 28, fontWeight: 'bold', textAlign: 'center' },
        }),
        this.statsLabel,
        this.speechLabel,
        new xb.UIPanel({
          style: { width: '100%', flexDirection: 'row', gap: 10 },
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
          style: { width: '100%', flexDirection: 'row', gap: 10 },
          children: [
            new xb.UIButton({
              label: 'Limpar',
              icon: 'cleaning_services',
              style: { flexGrow: 1 },
              onClick: () => this.callbacks.onClean(),
            }),
            new xb.UIButton({
              label: 'Voltar 2D',
              icon: 'smartphone',
              style: { flexGrow: 1 },
              onClick: () => this.callbacks.onExitXRMode(),
            }),
          ],
        }),
      ],
    });
    this.statusCard.position.set(0.38, 1.38, -1.05);
    this.statusCard.rotation.y = -0.22;
    this.add(this.statusCard);
  }

  syncState(
    stats: PetStats,
    equipped: EquippedItems,
    speechText: string
  ): void {
    this.partyHat.visible = equipped.hat !== 'hat_none';
    this.bowTie.visible = equipped.accessory !== 'acc_none';

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

  onSelectStart(): void {
    this.triggerBounce();
    this.callbacks.onPet();
  }

  update(): void {
    const dt = xb.getDeltaTime();
    const t = performance.now() * 0.002;
    this.tailGroup.rotation.z = 0.55 + Math.sin(t * 2.2) * 0.16;

    if (this.bounceTime > 0) {
      this.bounceTime = Math.max(0, this.bounceTime - dt);
      const wave = Math.sin((this.bounceTime / 0.6) * Math.PI);
      this.petGroup.position.y = wave * 0.08;
    } else {
      this.petGroup.position.y = Math.sin(t) * 0.012;
    }
  }
}
