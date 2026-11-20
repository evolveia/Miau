import { SHOP_ITEMS } from '../constants';
import { soundService } from '../services/soundService';
import type { EquippedItems, MiauMood } from '../types';
import { renderMiauSvg } from './MiauIllustration';

export interface MiauARCameraOptions {
  petName: string;
  initialMood: MiauMood;
  initialEquipped: EquippedItems;
  ownedItems: string[];
  onPetReward: () => void;
  onEquipChange: (equipped: EquippedItems) => void;
  onClose: () => void;
}

const AR_MOODS: Array<{ id: MiauMood; label: string; emoji: string }> = [
  { id: 'playful', label: 'Alegre', emoji: '😺' },
  { id: 'affectionate', label: 'Carinhoso', emoji: '😻' },
  { id: 'happy', label: 'Radiante', emoji: '✨' },
  { id: 'eating', label: 'Guloso', emoji: '😋' },
  { id: 'sleepy', label: 'Soninho', emoji: '😴' },
];

export class MiauARCamera {
  private overlay: HTMLDivElement;
  private stream: MediaStream | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private facingMode: 'environment' | 'user' = 'environment';
  private cameraState: 'requesting' | 'streaming' | 'error' = 'requesting';
  private errorText = '';

  private equipped: EquippedItems;
  private mood: MiauMood;
  private showSpeechBubble = true;
  private speechText = 'Miau! Estou no mundo real!';
  private arTab: 'none' | 'hat' | 'accessory' | 'mood' = 'none';

  // Placement & size relative to preview stage (0..1 normalized center + scale)
  private normX = 0.5;
  private normY = 0.6;
  private petScale = 1.0;
  private isFlipped = false;

  private dragging = false;
  private dragMoved = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private startNormX = 0.5;
  private startNormY = 0.6;

  private capturedDataUrl: string | null = null;
  private capturedBlob: Blob | null = null;
  private toastText = '';
  private toastTimer: number | null = null;

  constructor(private options: MiauARCameraOptions) {
    this.equipped = { ...options.initialEquipped };
    this.mood = options.initialMood;

    this.overlay = document.createElement('div');
    this.overlay.id = 'miau-ar-overlay';
    this.overlay.className =
      'fixed inset-0 z-[10050] bg-slate-950 flex flex-col overflow-hidden select-none';
    document.body.appendChild(this.overlay);

    this.render();
    void this.startCamera();
  }

  private async startCamera(): Promise<void> {
    this.stopCameraTracks();
    this.cameraState = 'requesting';
    this.errorText = '';
    this.render();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.cameraState = 'error';
      this.errorText =
        'Seu navegador não suporta acesso à câmera neste ambiente.';
      this.render();
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: this.facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      this.cameraState = 'streaming';
      this.render();
      this.attachStreamToVideo();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.cameraState = 'error';
      this.errorText = msg.toLowerCase().includes('permission') ||
        msg.toLowerCase().includes('denied') ||
        msg.toLowerCase().includes('notallowed')
        ? 'Permissão de câmera negada. Autorize o acesso à câmera no navegador e toque em Tentar Novamente.'
        : 'Não foi possível iniciar a câmera do dispositivo. Verifique se outro app está usando a câmera.';
      this.render();
    }
  }

  private attachStreamToVideo(): void {
    const video = this.overlay.querySelector(
      '#ar-video-feed'
    ) as HTMLVideoElement | null;
    if (!video || !this.stream) return;
    this.videoEl = video;
    video.srcObject = this.stream;
    void video.play().catch(() => {});
  }

  private stopCameraTracks(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.videoEl = null;
  }

  private showToast(msg: string): void {
    this.toastText = msg;
    const el = this.overlay.querySelector('#ar-toast') as HTMLElement | null;
    if (el) {
      el.textContent = msg;
      el.classList.remove('opacity-0');
      el.classList.add('opacity-100');
    }
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toastText = '';
      if (el) {
        el.classList.remove('opacity-100');
        el.classList.add('opacity-0');
      }
    }, 2600);
  }

  private spawnHeart(clientX: number, clientY: number): void {
    const stage = this.overlay.querySelector('#ar-stage') as HTMLElement | null;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const el = document.createElement('div');
    el.className =
      'absolute text-3xl pointer-events-none animate-float-up z-30 select-none';
    el.style.left = `${clientX - rect.left - 14}px`;
    el.style.top = `${clientY - rect.top - 24}px`;
    el.textContent = ['💖', '🐾', '✨', '😻'][Math.floor(Math.random() * 4)];
    stage.appendChild(el);
    window.setTimeout(() => el.remove(), 1200);
  }

  private updateMiauTransformDOM(): void {
    const petEl = this.overlay.querySelector(
      '#ar-miau-actor'
    ) as HTMLElement | null;
    if (!petEl) return;
    petEl.style.left = `${this.normX * 100}%`;
    petEl.style.top = `${this.normY * 100}%`;
    petEl.style.transform = `translate(-50%, -50%) scale(${this.petScale * (this.isFlipped ? -1 : 1)}, ${this.petScale})`;
  }

  private updateMiauSvgDOM(): void {
    const svgHolder = this.overlay.querySelector('#ar-miau-svg');
    if (!svgHolder) return;
    svgHolder.innerHTML = renderMiauSvg(
      this.mood,
      this.equipped,
      this.mood === 'sleepy'
    );
  }

  private async capturePhoto(): Promise<void> {
    const stage = this.overlay.querySelector('#ar-stage') as HTMLElement | null;
    const video = this.videoEl;
    if (!stage || !video || video.videoWidth === 0 || video.videoHeight === 0) {
      this.showToast('Aguarde a câmera carregar para tirar a foto.');
      return;
    }

    // Flash feedback
    const flash = this.overlay.querySelector('#ar-flash') as HTMLElement | null;
    if (flash) {
      flash.classList.remove('opacity-0');
      flash.classList.add('opacity-90');
      window.setTimeout(() => {
        flash.classList.remove('opacity-90');
        flash.classList.add('opacity-0');
      }, 180);
    }
    soundService.playCoin();

    const rect = stage.getBoundingClientRect();
    const outW = Math.max(720, Math.round(rect.width * 2));
    const outH = Math.max(960, Math.round(rect.height * 2));

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw camera video using object-cover aspect fill
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const scaleCover = Math.max(outW / vw, outH / vh);
    const drawW = vw * scaleCover;
    const drawH = vh * scaleCover;
    const offsetX = (outW - drawW) / 2;
    const offsetY = (outH - drawH) / 2;

    ctx.save();
    if (this.facingMode === 'user') {
      ctx.translate(outW, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, offsetX, offsetY, drawW, drawH);
    ctx.restore();

    // Render Miau SVG cleanly onto canvas via Blob URL
    const rawSvg = renderMiauSvg(
      this.mood,
      this.equipped,
      this.mood === 'sleepy'
    );
    const svgBlob = new Blob([rawSvg], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    try {
      const petImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
        img.src = svgUrl;
      });

      const baseSize = Math.min(outW, outH) * 0.56 * this.petScale;
      const petW = baseSize;
      const petH = (baseSize * 300) / 340;
      const cx = this.normX * outW;
      const cy = this.normY * outH;

      ctx.save();
      ctx.translate(cx, cy);
      if (this.isFlipped) {
        ctx.scale(-1, 1);
      }
      ctx.drawImage(petImg, -petW / 2, -petH / 2, petW, petH);
      ctx.restore();

      // Optional speech bubble above Miau
      if (this.showSpeechBubble) {
        const bubbleText = `${this.options.petName}: ${this.speechText}`;
        ctx.save();
        ctx.font = `bold ${Math.round(outW * 0.032)}px Nunito, sans-serif`;
        const metrics = ctx.measureText(bubbleText);
        const padX = outW * 0.04;
        const bw = Math.min(outW * 0.84, metrics.width + padX * 2);
        const bh = outW * 0.085;
        const bx = Math.max(
          16,
          Math.min(outW - bw - 16, cx - bw / 2)
        );
        const by = Math.max(24, cy - petH / 2 - bh - 12);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.85)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, bh / 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#3b1f6e';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(bubbleText, bx + bw / 2, by + bh / 2, bw - padX);
        ctx.restore();
      }

      // Subtle Miau AR Watermark
      ctx.save();
      ctx.fillStyle = 'rgba(45, 27, 78, 0.72)';
      ctx.beginPath();
      ctx.roundRect(24, outH - 72, 230, 46, 23);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px Nunito, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText('🐾 Miau • Modo AR', 44, outH - 49);
      ctx.restore();
    } finally {
      URL.revokeObjectURL(svgUrl);
    }

    this.capturedDataUrl = canvas.toDataURL('image/png');
    this.capturedBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png')
    );
    this.render();
  }

  private async shareCapturedPhoto(): Promise<void> {
    if (!this.capturedBlob && !this.capturedDataUrl) return;
    if (this.capturedBlob && typeof navigator.share === 'function') {
      const file = new File([this.capturedBlob], 'miau-realidade-aumentada.png', {
        type: 'image/png',
      });
      const shareData: ShareData = {
        title: `Foto com ${this.options.petName} em AR`,
        text: `Olha o ${this.options.petName} comigo no mundo real! 🐾📸`,
        files: [file],
      };
      if (!navigator.canShare || navigator.canShare(shareData)) {
        try {
          await navigator.share(shareData);
          return;
        } catch (err) {
          if ((err as Error).name === 'AbortError') return;
        }
      }
    }
    this.downloadCapturedPhoto();
    this.showToast(
      'Foto salva! Compartilhe a imagem baixada no WhatsApp ou redes sociais.'
    );
  }

  private downloadCapturedPhoto(): void {
    if (!this.capturedDataUrl) return;
    const link = document.createElement('a');
    link.href = this.capturedDataUrl;
    link.download = `miau-ar-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    this.showToast('Foto salva no dispositivo!');
  }

  private renderCustomizationDrawer(): string {
    if (this.arTab === 'none') return '';

    if (this.arTab === 'mood') {
      return `
        <div class="bg-white/92 backdrop-blur-md rounded-2xl p-2.5 flex items-center gap-2 overflow-x-auto miau-scroll shadow-lg">
          ${AR_MOODS.map(
            (m) => `
              <button data-ar-mood="${m.id}" class="shrink-0 px-3 py-1.5 rounded-xl text-xs font-extrabold border-2 flex items-center gap-1.5 ${
                this.mood === m.id
                  ? 'bg-[#6e45a5] text-white border-[#6e45a5]'
                  : 'bg-purple-50 text-[#3b1f6e] border-purple-100'
              }">
                <span>${m.emoji}</span>
                <span>${m.label}</span>
              </button>
            `
          ).join('')}
          <button id="ar-toggle-bubble" class="shrink-0 px-3 py-1.5 rounded-xl text-xs font-extrabold border-2 ${
            this.showSpeechBubble
              ? 'bg-emerald-500 text-white border-emerald-500'
              : 'bg-slate-100 text-slate-700 border-slate-200'
          }">
            💬 Balão: ${this.showSpeechBubble ? 'On' : 'Off'}
          </button>
        </div>
      `;
    }

    const items = SHOP_ITEMS.filter(
      (item) =>
        item.category === this.arTab &&
        (item.price === 0 || this.options.ownedItems.includes(item.id))
    );

    return `
      <div class="bg-white/92 backdrop-blur-md rounded-2xl p-2.5 flex items-center gap-2 overflow-x-auto miau-scroll shadow-lg">
        ${items
          .map((item) => {
            const active =
              (item.category === 'hat' && this.equipped.hat === item.id) ||
              (item.category === 'accessory' &&
                this.equipped.accessory === item.id);
            return `
              <button data-ar-item="${item.id}" class="shrink-0 px-3 py-1.5 rounded-xl text-xs font-extrabold border-2 flex items-center gap-1.5 ${
                active
                  ? 'bg-[#6e45a5] text-white border-[#6e45a5]'
                  : 'bg-purple-50 text-[#3b1f6e] border-purple-100'
              }">
                <span>${item.emoji}</span>
                <span>${item.name}</span>
              </button>
            `;
          })
          .join('')}
      </div>
    `;
  }

  private render(): void {
    if (this.capturedDataUrl) {
      this.overlay.innerHTML = `
        <div class="w-full h-full flex flex-col bg-gradient-to-b from-[#2b1749] to-[#140a24] text-white p-4">
          <div class="flex items-center justify-between pb-3">
            <h2 class="font-display text-xl font-bold">📸 Foto do Miau em AR</h2>
            <button id="ar-retake" class="px-3.5 py-1.5 rounded-full bg-white/15 text-xs font-bold hover:bg-white/25">✕ Fechar</button>
          </div>
          <div class="flex-1 min-h-0 flex items-center justify-center p-2">
            <img src="${this.capturedDataUrl}" alt="Foto em Realidade Aumentada" class="max-h-full max-w-full rounded-3xl border-4 border-white/85 shadow-2xl object-contain" />
          </div>
          <div class="pt-4 pb-2 flex flex-col gap-2.5 max-w-md w-full mx-auto">
            <div class="grid grid-cols-2 gap-2.5">
              <button id="ar-share-photo" class="py-3 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 text-white font-display font-bold shadow-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition">
                📤 Compartilhar
              </button>
              <button id="ar-save-photo" class="py-3 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-700 text-white font-display font-bold shadow-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition">
                💾 Salvar Foto
              </button>
            </div>
            <button id="ar-new-photo" class="w-full py-2.5 rounded-2xl bg-white/15 text-white text-sm font-bold hover:bg-white/25">
              📸 Tirar Outra Foto
            </button>
          </div>
          <div id="ar-toast" class="pointer-events-none ${this.toastText ? 'opacity-100' : 'opacity-0'} transition-opacity fixed top-16 left-1/2 -translate-x-1/2 bg-black/80 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg whitespace-nowrap">${this.toastText}</div>
        </div>
      `;
      this.bindPreviewEvents();
      return;
    }

    this.overlay.innerHTML = `
      <div class="relative w-full h-full flex flex-col bg-slate-950">
        <!-- Top Bar -->
        <header class="relative z-30 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/65 to-transparent">
          <button id="ar-close" class="px-3.5 py-2 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-extrabold border border-white/30 hover:bg-white/30">
            ← Voltar
          </button>
          <div class="px-3 py-1 rounded-full bg-purple-900/70 backdrop-blur-md border border-purple-300/40 text-white text-xs font-bold">
            📷 Realidade Aumentada
          </div>
          <button id="ar-switch-cam" class="px-3.5 py-2 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-extrabold border border-white/30 hover:bg-white/30">
            🔄 Virar
          </button>
        </header>

        <!-- Camera + Interactive Stage -->
        <main id="ar-stage" class="relative flex-1 overflow-hidden touch-none">
          <video
            id="ar-video-feed"
            autoplay
            playsinline
            muted
            class="absolute inset-0 w-full h-full object-cover ${this.facingMode === 'user' ? '-scale-x-100' : ''}"
          ></video>

          ${
            this.cameraState === 'requesting'
              ? `
                <div class="absolute inset-0 z-20 bg-[#1d1035]/90 flex flex-col items-center justify-center p-6 text-center text-white gap-3">
                  <div class="text-5xl animate-bounce">📸</div>
                  <h3 class="font-display text-xl font-bold">Autorize a Câmera</h3>
                  <p class="text-xs text-purple-200 max-w-xs">Para colocar o ${this.options.petName} no mundo real e tirar fotos, permita o acesso à câmera quando o navegador solicitar.</p>
                  <button id="ar-retry-cam" class="mt-1 px-5 py-2.5 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold text-xs shadow-lg hover:brightness-110 active:scale-95 transition">📷 Autorizar Câmera</button>
                </div>
              `
              : this.cameraState === 'error'
                ? `
                  <div class="absolute inset-0 z-20 bg-[#1d1035]/95 flex flex-col items-center justify-center p-6 text-center text-white gap-4">
                    <div class="text-5xl">😿</div>
                    <h3 class="font-display text-xl font-bold">Câmera Indisponível</h3>
                    <p class="text-xs text-purple-200 max-w-xs leading-relaxed">${this.errorText}</p>
                    <div class="flex gap-2.5">
                      <button id="ar-retry-cam" class="px-5 py-2.5 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold text-xs shadow-lg">📷 Autorizar Câmera</button>
                      <button id="ar-error-back" class="px-5 py-2.5 rounded-full bg-white/15 text-white font-bold text-xs">Voltar ao Jogo</button>
                    </div>
                  </div>
                `
                : ''
          }

          <!-- Draggable & Interactive Miau in Real World -->
          <div
            id="ar-miau-actor"
            class="absolute z-10 w-[210px] h-[186px] cursor-grab active:cursor-grabbing flex flex-col items-center"
            style="left:${this.normX * 100}%; top:${this.normY * 100}%; transform: translate(-50%, -50%) scale(${this.petScale * (this.isFlipped ? -1 : 1)}, ${this.petScale});"
          >
            ${
              this.showSpeechBubble
                ? `<div class="mb-1 px-3 py-1 rounded-full bg-white/92 border border-purple-300 text-[#3b1f6e] text-[11px] font-extrabold shadow-md whitespace-nowrap ${this.isFlipped ? '-scale-x-100' : ''}">${this.speechText}</div>`
                : ''
            }
            <div id="ar-miau-svg" class="w-full h-full">
              ${renderMiauSvg(this.mood, this.equipped, this.mood === 'sleepy')}
            </div>
          </div>

          <div class="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-black/45 text-white/90 text-[11px] font-semibold whitespace-nowrap">
            Arraste o Miau para posicionar • Toque para fazer carinho
          </div>

          <div id="ar-flash" class="pointer-events-none absolute inset-0 z-40 bg-white opacity-0 transition-opacity duration-150"></div>
          <div id="ar-toast" class="pointer-events-none ${this.toastText ? 'opacity-100' : 'opacity-0'} transition-opacity absolute top-10 left-1/2 -translate-x-1/2 z-30 bg-black/80 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg whitespace-nowrap">${this.toastText}</div>
        </main>

        <!-- Bottom AR Controls & Personalization -->
        <footer class="relative z-30 bg-gradient-to-t from-black/85 via-black/65 to-transparent px-3.5 pt-2 pb-4 flex flex-col gap-2.5">
          ${this.renderCustomizationDrawer()}

          <!-- Size Slider + Flip -->
          <div class="flex items-center gap-3 bg-white/15 backdrop-blur-md rounded-2xl px-3.5 py-2 text-white">
            <span class="text-xs font-bold shrink-0">🔍 Tamanho</span>
            <input id="ar-scale-slider" type="range" min="0.55" max="1.75" step="0.05" value="${this.petScale}" class="flex-1 accent-purple-400" />
            <button id="ar-flip-pet" class="px-2.5 py-1 rounded-xl bg-white/20 text-[11px] font-extrabold hover:bg-white/30 shrink-0">↔️ Virar</button>
          </div>

          <!-- Action Bar: Customize Tabs + Shutter Button -->
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5">
              <button data-artab="hat" class="px-3 py-2 rounded-2xl text-xs font-extrabold ${this.arTab === 'hat' ? 'bg-purple-500 text-white' : 'bg-white/20 text-white'}">🎩 Chapéu</button>
              <button data-artab="accessory" class="px-3 py-2 rounded-2xl text-xs font-extrabold ${this.arTab === 'accessory' ? 'bg-purple-500 text-white' : 'bg-white/20 text-white'}">🎀 Visual</button>
              <button data-artab="mood" class="px-3 py-2 rounded-2xl text-xs font-extrabold ${this.arTab === 'mood' ? 'bg-purple-500 text-white' : 'bg-white/20 text-white'}">😻 Humor</button>
            </div>
            <button
              id="ar-capture-btn"
              class="w-16 h-16 rounded-full bg-white border-4 border-purple-300 shadow-[0_0_25px_rgba(168,85,247,0.6)] flex items-center justify-center text-2xl active:scale-90 transition shrink-0"
              aria-label="Tirar Foto"
              title="Tirar Foto"
            >
              📸
            </button>
          </div>
        </footer>
      </div>
    `;

    this.attachStreamToVideo();
    this.bindLiveEvents();
  }

  private bindLiveEvents(): void {
    this.overlay.querySelector('#ar-close')?.addEventListener('click', () => {
      this.destroy();
      this.options.onClose();
    });
    this.overlay
      .querySelector('#ar-error-back')
      ?.addEventListener('click', () => {
        this.destroy();
        this.options.onClose();
      });
    this.overlay
      .querySelector('#ar-retry-cam')
      ?.addEventListener('click', () => {
        void this.startCamera();
      });
    this.overlay
      .querySelector('#ar-switch-cam')
      ?.addEventListener('click', () => {
        this.facingMode =
          this.facingMode === 'environment' ? 'user' : 'environment';
        void this.startCamera();
      });

    // Drag & tap Miau
    const stage = this.overlay.querySelector('#ar-stage') as HTMLElement | null;
    const actor = this.overlay.querySelector(
      '#ar-miau-actor'
    ) as HTMLElement | null;

    actor?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.dragging = true;
      this.dragMoved = false;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.startNormX = this.normX;
      this.startNormY = this.normY;
      actor.setPointerCapture?.(e.pointerId);
    });

    stage?.addEventListener('pointermove', (e) => {
      if (!this.dragging || !stage) return;
      const rect = stage.getBoundingClientRect();
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      if (Math.hypot(dx, dy) > 6) {
        this.dragMoved = true;
      }
      this.normX = Math.max(0.12, Math.min(0.88, this.startNormX + dx / rect.width));
      this.normY = Math.max(0.18, Math.min(0.86, this.startNormY + dy / rect.height));
      this.updateMiauTransformDOM();
    });

    const endDrag = (e: PointerEvent) => {
      if (!this.dragging) return;
      this.dragging = false;
      if (!this.dragMoved) {
        soundService.playPurr();
        this.mood = 'affectionate';
        this.speechText = 'Purrr~ Adorei aparecer na sua câmera!';
        this.updateMiauSvgDOM();
        this.spawnHeart(e.clientX, e.clientY);
        this.options.onPetReward();
      }
    };
    stage?.addEventListener('pointerup', endDrag);
    stage?.addEventListener('pointercancel', endDrag);

    // Scale & Flip
    const slider = this.overlay.querySelector(
      '#ar-scale-slider'
    ) as HTMLInputElement | null;
    slider?.addEventListener('input', () => {
      this.petScale = parseFloat(slider.value) || 1;
      this.updateMiauTransformDOM();
    });

    this.overlay.querySelector('#ar-flip-pet')?.addEventListener('click', () => {
      this.isFlipped = !this.isFlipped;
      this.updateMiauTransformDOM();
    });

    // Customization drawer tabs
    this.overlay.querySelectorAll('[data-artab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-artab') as
          | 'hat'
          | 'accessory'
          | 'mood';
        this.arTab = this.arTab === tab ? 'none' : tab;
        this.render();
      });
    });

    this.overlay.querySelectorAll('[data-ar-item]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-ar-item');
        const item = SHOP_ITEMS.find((s) => s.id === id);
        if (!item) return;
        if (item.category === 'hat') this.equipped.hat = item.id;
        if (item.category === 'accessory') this.equipped.accessory = item.id;
        soundService.playMeow(1.15);
        this.options.onEquipChange({ ...this.equipped });
        this.render();
      });
    });

    this.overlay.querySelectorAll('[data-ar-mood]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const m = btn.getAttribute('data-ar-mood') as MiauMood;
        this.mood = m;
        soundService.playMeow(1.05);
        this.render();
      });
    });

    this.overlay
      .querySelector('#ar-toggle-bubble')
      ?.addEventListener('click', () => {
        this.showSpeechBubble = !this.showSpeechBubble;
        this.render();
      });

    // Capture Photo
    this.overlay
      .querySelector('#ar-capture-btn')
      ?.addEventListener('click', () => {
        void this.capturePhoto();
      });
  }

  private bindPreviewEvents(): void {
    this.overlay.querySelector('#ar-retake')?.addEventListener('click', () => {
      this.destroy();
      this.options.onClose();
    });
    this.overlay
      .querySelector('#ar-new-photo')
      ?.addEventListener('click', () => {
        this.capturedDataUrl = null;
        this.capturedBlob = null;
        this.render();
      });
    this.overlay
      .querySelector('#ar-share-photo')
      ?.addEventListener('click', () => {
        void this.shareCapturedPhoto();
      });
    this.overlay
      .querySelector('#ar-save-photo')
      ?.addEventListener('click', () => {
        this.downloadCapturedPhoto();
      });
  }

  public destroy(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.stopCameraTracks();
    this.overlay.remove();
  }
}
