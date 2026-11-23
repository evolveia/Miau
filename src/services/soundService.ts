class SoundService {
  private ctx: AudioContext | null = null;
  private activeAudio: HTMLAudioElement | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  public enabled = true;

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public stopAllAudio(): void {
    if (this.activeAudio) {
      try {
        this.activeAudio.onplay = null;
        this.activeAudio.onended = null;
        this.activeAudio.onerror = null;
        this.activeAudio.pause();
        this.activeAudio.currentTime = 0;
        this.activeAudio.src = '';
      } catch {
        // Ignore audio stop error
      }
      this.activeAudio = null;
    }
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stopAllAudio();
      if (this.ctx && this.ctx.state === 'running') {
        void this.ctx.suspend().catch(() => {});
      }
    } else if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
  }

  playMeow(pitchMultiplier = 1): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520 * pitchMultiplier, now);
    osc.frequency.exponentialRampToValueAtTime(
      840 * pitchMultiplier,
      now + 0.12
    );
    osc.frequency.exponentialRampToValueAtTime(
      460 * pitchMultiplier,
      now + 0.36
    );

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1100, now);
    filter.Q.setValueAtTime(1.8, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  playPurr(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(68, now);

    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(24, now);
    lfoGain.gain.setValueAtTime(0.06, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.1);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.55);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    osc.connect(gain);
    gain.connect(ctx.destination);

    lfo.start(now);
    osc.start(now);
    lfo.stop(now + 0.88);
    osc.stop(now + 0.88);
  }

  playCoin(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [987.77, 1318.51].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.07);
      gain.gain.setValueAtTime(0.12, now + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.2);
    });
  }

  playBubble(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.09);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playCrunch(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [0, 0.14].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(220, now + offset);
      osc.frequency.exponentialRampToValueAtTime(95, now + offset + 0.08);
      gain.gain.setValueAtTime(0.08, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.1);
    });
  }

  async playBase64Wav(
    base64Audio: string,
    mimeType = 'audio/wav',
    onStart?: () => void,
    onEnd?: () => void,
    playbackRate = 1
  ): Promise<void> {
    if (!this.enabled) {
      onEnd?.();
      return;
    }
    this.stopAllAudio();
    const audio = new Audio(`data:${mimeType};base64,${base64Audio}`);
    if (playbackRate !== 1) {
      audio.preservesPitch = true;
      audio.playbackRate = Math.max(0.5, Math.min(1.5, playbackRate));
    }
    this.activeAudio = audio;
    audio.onplay = () => {
      if (!this.enabled) {
        this.stopAllAudio();
        onEnd?.();
        return;
      }
      onStart?.();
    };
    audio.onended = () => {
      if (this.activeAudio === audio) this.activeAudio = null;
      onEnd?.();
    };
    audio.onerror = () => {
      if (this.activeAudio === audio) this.activeAudio = null;
      onEnd?.();
    };
    if (!this.enabled) {
      this.stopAllAudio();
      onEnd?.();
      return;
    }
    await audio.play();
  }

  async startRecording(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.recordedChunks = [];
    const mimeType = MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : 'audio/mp4';
    const recorder = new MediaRecorder(stream, { mimeType });
    this.mediaRecorder = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.recordedChunks.push(e.data);
    };
    recorder.start();
  }

  async stopRecording(): Promise<{ audioBase64: string; mimeType: string }> {
    const recorder = this.mediaRecorder;
    if (!recorder) {
      throw new Error('Nenhuma gravação ativa.');
    }
    return new Promise((resolve, reject) => {
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        recorder.stream.getTracks().forEach((t) => t.stop());
        this.mediaRecorder = null;
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = String(reader.result || '');
          const base64 = dataUrl.split(',')[1] || '';
          resolve({ audioBase64: base64, mimeType });
        };
        reader.onerror = () => reject(new Error('Falha ao ler áudio gravado.'));
        reader.readAsDataURL(blob);
      };
      recorder.stop();
    });
  }
}

export class LiveVoiceSession {
  private ws: WebSocket | null = null;
  private inputCtx: AudioContext | null = null;
  private outputCtx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private nextStartTime = 0;
  private activeSources = new Set<AudioBufferSourceNode>();

  constructor(
    private callbacks: {
      onStatus: (status: string) => void;
      onInputTranscript: (text: string) => void;
      onOutputTranscript: (text: string) => void;
      onTurnComplete: () => void;
      onError: (err: string) => void;
      onClosed: () => void;
    }
  ) {}

  private hasErrored = false;
  private manualStop = false;
  private muted = !soundService.enabled;

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.stopPlayback();
    }
  }

  async start(): Promise<void> {
    this.hasErrored = false;
    this.manualStop = false;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/live`);
    this.ws = ws;

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        try {
          ws.close();
        } catch {
          // Ignore
        }
        this.cleanup();
        reject(
          new Error(
            'Voz ao vivo em tempo real indisponível neste servidor. Use o botão 🎤 na barra de chat para falar com o Miau!'
          )
        );
      }, 6000);

      ws.onopen = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve();
      };

      ws.onerror = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        this.cleanup();
        reject(
          new Error(
            'Voz ao vivo em tempo real indisponível neste servidor. Use o botão 🎤 na barra de chat para falar com o Miau!'
          )
        );
      };

      ws.onclose = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        this.cleanup();
        reject(
          new Error(
            'Voz ao vivo em tempo real indisponível neste servidor. Use o botão 🎤 na barra de chat para falar com o Miau!'
          )
        );
      };
    });

    try {
      this.inputCtx = new AudioContext({ sampleRate: 16000 });
      this.outputCtx = new AudioContext({ sampleRate: 24000 });
      this.nextStartTime = this.outputCtx.currentTime;

      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = this.inputCtx.createMediaStreamSource(this.stream);
      this.processor = this.inputCtx.createScriptProcessor(4096, 1, 1);
      source.connect(this.processor);
      this.processor.connect(this.inputCtx.destination);
    } catch (err) {
      try {
        ws.close();
      } catch {
        // Ignore
      }
      this.cleanup();
      throw err;
    }

    this.processor.onaudioprocess = (event) => {
      if (this.ws?.readyState !== WebSocket.OPEN) return;
      const floatData = event.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(floatData.length);
      for (let i = 0; i < floatData.length; i++) {
        const s = Math.max(-1, Math.min(1, floatData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      const bytes = new Uint8Array(pcm16.buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      this.ws.send(JSON.stringify({ audio: btoa(binary) }));
    };

    ws.onmessage = (msgEvent) => {
      try {
        const msg = JSON.parse(msgEvent.data);
        if (msg.status === 'connected') {
          this.callbacks.onStatus('Conectado! Pode falar com o Miau.');
        } else if (msg.inputTranscript) {
          this.callbacks.onInputTranscript(msg.inputTranscript);
        } else if (msg.outputTranscript) {
          this.callbacks.onOutputTranscript(msg.outputTranscript);
        } else if (msg.audio) {
          this.playPcmChunk(msg.audio);
        } else if (msg.interrupted) {
          this.stopPlayback();
        } else if (msg.turnComplete) {
          this.callbacks.onTurnComplete();
        } else if (msg.error) {
          this.hasErrored = true;
          this.callbacks.onError(msg.error);
        }
      } catch {
        // Ignore malformed frame
      }
    };

    ws.onerror = () => {
      if (this.manualStop) return;
      this.hasErrored = true;
      this.callbacks.onError('Erro na conexão de voz ao vivo.');
    };

    ws.onclose = () => {
      this.cleanup();
      if (!this.hasErrored && !this.manualStop) {
        this.callbacks.onClosed();
      }
    };
  }

  private playPcmChunk(base64: string): void {
    if (!this.outputCtx || this.muted || !soundService.enabled) return;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }
    const buffer = this.outputCtx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);

    const src = this.outputCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.outputCtx.destination);
    const startAt = Math.max(this.nextStartTime, this.outputCtx.currentTime);
    src.start(startAt);
    this.nextStartTime = startAt + buffer.duration;
    this.activeSources.add(src);
    src.onended = () => this.activeSources.delete(src);
  }

  private stopPlayback(): void {
    this.activeSources.forEach((s) => {
      try {
        s.stop();
      } catch {
        // Ignore
      }
    });
    this.activeSources.clear();
    if (this.outputCtx) {
      this.nextStartTime = this.outputCtx.currentTime;
    }
  }

  stop(): void {
    this.manualStop = true;
    this.ws?.close();
    this.cleanup();
  }

  private cleanup(): void {
    this.stopPlayback();
    this.processor?.disconnect();
    this.processor = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.inputCtx?.close();
    this.inputCtx = null;
    void this.outputCtx?.close();
    this.outputCtx = null;
    this.ws = null;
  }
}

export const soundService = new SoundService();
