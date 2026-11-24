import { synthesizeMiauVoice } from './geminiClient';
import { soundService } from './soundService';

export type SpeakingStateListener = (speaking: boolean) => void;

class MiauSpeechService {
  private seq = 0;
  private speaking = false;
  private textOnlyModeUntilMs = 0;
  private listener: SpeakingStateListener | null = null;

  public setSpeakingListener(listener: SpeakingStateListener | null): void {
    this.listener = listener;
  }

  public isSpeaking(): boolean {
    return this.speaking;
  }

  public isTextOnlyFallbackActive(): boolean {
    return Date.now() < this.textOnlyModeUntilMs;
  }

  private setSpeaking(next: boolean): void {
    this.speaking = next;
    this.listener?.(next);
  }

  public cancel(): void {
    this.seq += 1;
    soundService.stopAllAudio();
    this.setSpeaking(false);
  }

  public async speakPhrase(
    meowPrefix: string,
    text: string,
    options?: {
      withLeadingMeow?: boolean;
      pitchMultiplier?: number;
      fallbackMeowOnError?: boolean;
    }
  ): Promise<void> {
    const reqId = ++this.seq;
    soundService.stopAllAudio();

    if (!soundService.enabled) {
      this.setSpeaking(false);
      return;
    }

    if (options?.withLeadingMeow) {
      soundService.playMeow(options.pitchMultiplier ?? 1.06);
    }

    const cleanSpeech = `${meowPrefix || ''} ${text || ''}`
      .replace(/[()]/g, '')
      .trim();
    if (!cleanSpeech) {
      this.setSpeaking(false);
      return;
    }

    // Se todas as cotas TTS estão temporariamente em cooldown, evite atrasar a resposta
    if (this.isTextOnlyFallbackActive()) {
      this.setSpeaking(false);
      if (!options?.withLeadingMeow && options?.fallbackMeowOnError && soundService.enabled) {
        soundService.playMeow(options.pitchMultiplier ?? 1.08);
      }
      return;
    }

    this.setSpeaking(true);
    try {
      const voiceRes = await synthesizeMiauVoice(cleanSpeech);
      if (reqId !== this.seq || !soundService.enabled) {
        this.setSpeaking(false);
        return;
      }

      if (voiceRes.textOnlyFallback || !voiceRes.audioBase64) {
        // Audio tokens exhausted across all TTS tiers: stay smoothly in text-only mode
        // while backend recovery probe restores audio when tokens return.
        this.textOnlyModeUntilMs = Date.now() + 25_000;
        this.setSpeaking(false);
        if (!options?.withLeadingMeow && options?.fallbackMeowOnError && soundService.enabled) {
          soundService.playMeow(options.pitchMultiplier ?? 1.08);
        }
        return;
      }

      this.textOnlyModeUntilMs = 0;
      await soundService.playBase64Wav(
        voiceRes.audioBase64,
        voiceRes.mimeType || 'audio/wav',
        () => {
          if (reqId === this.seq && soundService.enabled) {
            this.setSpeaking(true);
          }
        },
        () => {
          if (reqId === this.seq) {
            this.setSpeaking(false);
          }
        }
      );
    } catch {
      if (reqId !== this.seq) return;
      this.setSpeaking(false);
      if (!options?.withLeadingMeow && options?.fallbackMeowOnError && soundService.enabled) {
        soundService.playMeow(options.pitchMultiplier ?? 1.08);
      }
    }
  }
}

export const miauSpeechService = new MiauSpeechService();
