class SoundService {
  private ctx: AudioContext | null = null;
  private activeAudio: HTMLAudioElement | null = null;
  private activeBufferSource: AudioBufferSourceNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private activeRecStream: MediaStream | null = null;
  private recordingStartSeq = 0;
  private recordedChunks: Blob[] = [];
  private recCtx: AudioContext | null = null;
  private recAnalyser: AnalyserNode | null = null;
  private recRafId: number | null = null;
  private recPeakRms = 0;
  private recStartedAt = 0;
  private lullabyTimer: number | null = null;
  private lullabyStep = 0;
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
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Deve ser chamado de forma síncrona dentro de eventos de clique/toque/submit
   * para manter a permissão de áudio ativa no Android Chrome e iOS Safari após fetches.
   */
  public unlockAudio(): void {
    if (!this.enabled || typeof window === 'undefined') return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }
      const buffer = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start(0);
    } catch {
      // Ignore unlock failures
    }
  }

  public stopAllAudio(): void {
    this.stopLullaby();
    if (this.activeBufferSource) {
      try {
        this.activeBufferSource.onended = null;
        this.activeBufferSource.stop();
        this.activeBufferSource.disconnect();
      } catch {
        // Ignore buffer stop error
      }
      this.activeBufferSource = null;
    }
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

  playShakeDrops(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [0, 0.09, 0.18, 0.27].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const baseFreq = 520 + idx * 110;
      osc.frequency.setValueAtTime(baseFreq, now + offset);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.65, now + offset + 0.06);
      gain.gain.setValueAtTime(0.09, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.09);
    });
  }

  playScratch(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [0, 0.11, 0.22].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(340, now + offset);
      osc.frequency.exponentialRampToValueAtTime(160, now + offset + 0.07);
      gain.gain.setValueAtTime(0.11, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.09);
    });
  }

  public isLullabyPlaying(): boolean {
    return this.lullabyTimer !== null;
  }

  public startLullaby(): void {
    if (!this.enabled || typeof window === 'undefined') return;
    if (this.lullabyTimer !== null) return;
    const notes = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 659.25, 523.25];
    const playNote = () => {
      if (!this.enabled) {
        this.stopLullaby();
        return;
      }
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const freq = notes[this.lullabyStep % notes.length];
      this.lullabyStep = (this.lullabyStep + 1) % notes.length;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.055, now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.72);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.75);
    };
    playNote();
    this.lullabyTimer = window.setInterval(playNote, 680);
  }

  public stopLullaby(): void {
    if (this.lullabyTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.lullabyTimer);
    }
    this.lullabyTimer = null;
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const clean = base64.replace(/\s+/g, '');
    const binary = window.atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private async playViaWebAudio(
    arrayBuffer: ArrayBuffer,
    onStart?: () => void,
    onEnd?: () => void,
    playbackRate = 1
  ): Promise<boolean> {
    const ctx = this.getContext();
    if (!ctx) return false;
    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
      if (!this.enabled) return false;
      const src = ctx.createBufferSource();
      src.buffer = decoded;
      src.playbackRate.value = Math.max(0.5, Math.min(1.5, playbackRate));
      src.connect(ctx.destination);
      this.activeBufferSource = src;
      onStart?.();
      await new Promise<void>((resolve) => {
        src.onended = () => {
          if (this.activeBufferSource === src) {
            this.activeBufferSource = null;
          }
          onEnd?.();
          resolve();
        };
        src.start(0);
      });
      return true;
    } catch {
      return false;
    }
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

    try {
      const ab = this.base64ToArrayBuffer(base64Audio);
      const played = await this.playViaWebAudio(ab, onStart, onEnd, playbackRate);
      if (played) return;
    } catch {
      // Fallback to HTMLAudioElement below
    }

    if (!this.enabled) {
      onEnd?.();
      return;
    }
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

  async playAudioDataUrl(
    dataUrl: string,
    onStart?: () => void,
    onEnd?: () => void
  ): Promise<void> {
    if (!this.enabled || !dataUrl) {
      onEnd?.();
      return;
    }
    this.stopAllAudio();
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx > 0) {
      const header = dataUrl.slice(5, commaIdx);
      const mimeType = header.split(';')[0] || 'audio/webm';
      const base64 = dataUrl.slice(commaIdx + 1);
      await this.playBase64Wav(base64, mimeType, onStart, onEnd, 1);
      return;
    }
    const audio = new Audio(dataUrl);
    this.activeAudio = audio;
    audio.onplay = () => onStart?.();
    audio.onended = () => {
      if (this.activeAudio === audio) this.activeAudio = null;
      onEnd?.();
    };
    audio.onerror = () => {
      if (this.activeAudio === audio) this.activeAudio = null;
      onEnd?.();
    };
    await audio.play();
  }

  private pickRecordingMimeType(): string {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
      for (const mime of candidates) {
        if (MediaRecorder.isTypeSupported(mime)) return mime;
      }
    }
    return 'audio/webm';
  }

  private cleanupRecordingAnalyser(): void {
    if (this.recRafId !== null) {
      window.cancelAnimationFrame(this.recRafId);
      this.recRafId = null;
    }
    this.recAnalyser = null;
    if (this.recCtx) {
      void this.recCtx.close().catch(() => {});
      this.recCtx = null;
    }
  }

  public cancelRecording(): void {
    this.recordingStartSeq += 1;
    this.cleanupRecordingAnalyser();
    if (this.mediaRecorder) {
      try {
        this.mediaRecorder.ondataavailable = null;
        this.mediaRecorder.onstop = null;
        if (this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
      } catch {
        // Ignore stop errors
      }
      this.mediaRecorder = null;
    }
    if (this.activeRecStream) {
      this.activeRecStream.getTracks().forEach((t) => t.stop());
      this.activeRecStream = null;
    }
    this.recordedChunks = [];
  }

  public isRecordingActive(): boolean {
    return Boolean(this.mediaRecorder && this.mediaRecorder.state !== 'inactive');
  }

  async startRecording(): Promise<void> {
    const seq = ++this.recordingStartSeq;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: { ideal: 1 },
        sampleRate: { ideal: 16000 },
      },
    });
    if (seq !== this.recordingStartSeq) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error('Gravação cancelada antes de iniciar.');
    }

    this.activeRecStream = stream;
    this.recordedChunks = [];
    this.recPeakRms = 0;
    this.recStartedAt = Date.now();

    // Monitor speech energy so accidental silent taps are detected accurately
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.cleanupRecordingAnalyser();
        const recCtx = new AudioCtx();
        const source = recCtx.createMediaStreamSource(stream);
        const analyser = recCtx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        this.recCtx = recCtx;
        this.recAnalyser = analyser;
        const buf = new Float32Array(analyser.fftSize);
        const measure = () => {
          if (!this.recAnalyser) return;
          this.recAnalyser.getFloatTimeDomainData(buf);
          let sumSq = 0;
          for (let i = 0; i < buf.length; i++) {
            sumSq += buf[i] * buf[i];
          }
          const rms = Math.sqrt(sumSq / buf.length);
          if (rms > this.recPeakRms) this.recPeakRms = rms;
          this.recRafId = window.requestAnimationFrame(measure);
        };
        this.recRafId = window.requestAnimationFrame(measure);
      }
    } catch {
      // Optional diagnostics only
    }

    const mimeType = this.pickRecordingMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 64_000,
      });
    } catch {
      recorder = new MediaRecorder(stream, { mimeType });
    }
    this.mediaRecorder = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.recordedChunks.push(e.data);
    };
    recorder.start(100);
  }

  async stopRecording(): Promise<{
    audioBase64: string;
    dataUrl: string;
    mimeType: string;
    durationMs: number;
    peakRms: number;
  }> {
    const recorder = this.mediaRecorder;
    if (!recorder) {
      throw new Error('Nenhuma gravação ativa.');
    }
    // Brief tail buffer so releasing doesn't clip the final syllable
    await new Promise((r) => window.setTimeout(r, 120));
    const durationMs = Math.max(0, Date.now() - this.recStartedAt);
    const peakRms = this.recPeakRms;
    this.cleanupRecordingAnalyser();

    return new Promise((resolve, reject) => {
      recorder.onstop = () => {
        const rawMime = recorder.mimeType || 'audio/webm';
        const cleanMime = rawMime.split(';')[0].trim() || 'audio/webm';
        const blob = new Blob(this.recordedChunks, { type: rawMime });
        recorder.stream.getTracks().forEach((t) => t.stop());
        this.activeRecStream = null;
        this.mediaRecorder = null;
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = String(reader.result || '');
          const base64 = dataUrl.split(',')[1] || '';
          resolve({
            audioBase64: base64,
            dataUrl,
            mimeType: cleanMime,
            durationMs,
            peakRms,
          });
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

  private resampleTo16kHz(input: Float32Array, sourceRate: number): Float32Array {
    if (!sourceRate || Math.abs(sourceRate - 16000) < 100) {
      return input;
    }
    const ratio = sourceRate / 16000;
    const outputLength = Math.max(1, Math.round(input.length / ratio));
    const output = new Float32Array(outputLength);
    for (let i = 0; i < outputLength; i++) {
      const srcPos = i * ratio;
      const left = Math.floor(srcPos);
      const right = Math.min(input.length - 1, left + 1);
      const frac = srcPos - left;
      output[i] = input[left] * (1 - frac) + input[right] * frac;
    }
    return output;
  }

  async start(userAge?: number | null, strictFilter = false): Promise<void> {
    this.hasErrored = false;
    this.manualStop = false;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const qs = new URLSearchParams();
    if (typeof userAge === 'number' && Number.isFinite(userAge)) {
      qs.set('age', String(Math.round(userAge)));
    }
    if (strictFilter) {
      qs.set('strictFilter', '1');
    }
    const queryString = qs.toString();
    const ws = new WebSocket(
      `${proto}//${window.location.host}/live${queryString ? `?${queryString}` : ''}`
    );
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

      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 16000 },
        },
      });
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

    const inputRate = this.inputCtx.sampleRate || 16000;
    this.processor.onaudioprocess = (event) => {
      if (this.ws?.readyState !== WebSocket.OPEN) return;
      const rawData = event.inputBuffer.getChannelData(0);
      const floatData = this.resampleTo16kHz(rawData, inputRate);
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
