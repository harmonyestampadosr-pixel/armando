import {
  buildAnnouncerPlan,
  getUnlockedStagesUpToCue,
} from '../shared/announcerEngine';
import {
  clampAnnouncerSpeed,
  createDefaultAnnouncerConfig,
  normalizeAnnouncerVoiceName,
  type AnnouncerAnnouncementPlan,
  type AnnouncerConfig,
  type AnnouncerCue,
  type AnnouncerCuePreSfx,
  type AnnouncerStage,
} from '../shared/announcerTypes';
import type { LeaderboardEntry } from '../shared/types';

export interface AnnouncerPlaybackStatus {
  isCeremonyActive: boolean;
  isGeneratingAudio: boolean;
  isSpeaking: boolean;
  activeCueIndex: number;
  currentStage: AnnouncerStage;
  currentCaption: string;
  currentRankLabel: string;
  highlightedParticipantIds: string[];
  unlockedStages: AnnouncerStage[];
  lastModelUsed: string | null;
  lastError: {
    message: string;
    category: string;
    retryable: boolean;
  } | null;
}

const ANNOUNCER_PREFS_KEY = 'dtqd_announcer_config_v1';

function clamp01(val: number): number {
  if (!Number.isFinite(val)) return 0.5;
  return Math.max(0, Math.min(1, val));
}

export function loadSavedAnnouncerConfig(): AnnouncerConfig {
  const defaults = createDefaultAnnouncerConfig();
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = window.localStorage.getItem(ANNOUNCER_PREFS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<AnnouncerConfig>;
    return {
      ...defaults,
      ...parsed,
      voiceName: normalizeAnnouncerVoiceName(parsed.voiceName),
      voiceVolume:
        typeof parsed.voiceVolume === 'number'
          ? clamp01(parsed.voiceVolume)
          : defaults.voiceVolume,
      voiceSpeed: clampAnnouncerSpeed(parsed.voiceSpeed, defaults.voiceSpeed),
      musicVolume:
        typeof parsed.musicVolume === 'number'
          ? clamp01(parsed.musicVolume)
          : defaults.musicVolume,
      sfxVolume:
        typeof parsed.sfxVolume === 'number'
          ? clamp01(parsed.sfxVolume)
          : defaults.sfxVolume,
      sfxToggles: {
        ...defaults.sfxToggles,
        ...(parsed.sfxToggles || {}),
      },
      pronunciationOverrides: {
        ...defaults.pronunciationOverrides,
        ...(parsed.pronunciationOverrides || {}),
      },
    };
  } catch {
    return defaults;
  }
}

export function persistAnnouncerConfig(cfg: AnnouncerConfig): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ANNOUNCER_PREFS_KEY, JSON.stringify(cfg));
  } catch {
    // ignore storage errors
  }
}

class AnnouncerAudioController {
  private ctx: AudioContext | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private voiceGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private activeAudioEl: HTMLAudioElement | null = null;
  private activeAudioUrl: string | null = null;
  private activeAudioResolve: (() => void) | null = null;
  private musicTimer: number | null = null;
  private isMusicPlaying = false;
  private isDucked = false;
  private currentConfig: AnnouncerConfig = createDefaultAnnouncerConfig();

  private playbackGeneration = 0;
  private abortController: AbortController | null = null;
  private audioBlobCache = new Map<string, Blob>();
  private listeners = new Set<() => void>();

  private status: AnnouncerPlaybackStatus = {
    isCeremonyActive: false,
    isGeneratingAudio: false,
    isSpeaking: false,
    activeCueIndex: -1,
    currentStage: 'idle',
    currentCaption: '',
    currentRankLabel: '',
    highlightedParticipantIds: [],
    unlockedStages: [],
    lastModelUsed: null,
    lastError: null,
  };

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  public getStatus(): AnnouncerPlaybackStatus {
    return {
      ...this.status,
      highlightedParticipantIds: [...this.status.highlightedParticipantIds],
      unlockedStages: [...this.status.unlockedStages],
      lastError: this.status.lastError ? { ...this.status.lastError } : null,
    };
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  private setStatus(patch: Partial<AnnouncerPlaybackStatus>): void {
    this.status = {
      ...this.status,
      ...patch,
    };
    this.emit();
  }

  private ensureAudioGraph(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;

      const ctx = new AudioCtx();
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.knee.value = 18;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.005;
      compressor.release.value = 0.2;

      const voiceGain = ctx.createGain();
      const musicGain = ctx.createGain();
      const sfxGain = ctx.createGain();

      voiceGain.connect(compressor);
      musicGain.connect(compressor);
      sfxGain.connect(compressor);
      compressor.connect(ctx.destination);

      this.ctx = ctx;
      this.compressor = compressor;
      this.voiceGain = voiceGain;
      this.musicGain = musicGain;
      this.sfxGain = sfxGain;
      this.syncGains();
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  public applyConfig(config: AnnouncerConfig): void {
    this.currentConfig = config;
    this.syncGains();
    if (!config.enabled || !config.musicEnabled) {
      this.stopSuspenseMusic();
    }
  }

  private syncGains(): void {
    const voiceLevel =
      !this.currentConfig.enabled || this.currentConfig.mutedVoice
        ? 0
        : clamp01(this.currentConfig.voiceVolume);
    const speed = clampAnnouncerSpeed(this.currentConfig.voiceSpeed, 0.95);

    if (this.activeAudioEl) {
      this.activeAudioEl.volume = voiceLevel;
      this.activeAudioEl.muted =
        !this.currentConfig.enabled || this.currentConfig.mutedVoice;
      this.activeAudioEl.playbackRate = speed;
    }

    const ctx = this.ctx;
    if (!ctx || !this.voiceGain || !this.musicGain || !this.sfxGain) return;
    const now = ctx.currentTime;
    const duckFactor = this.isDucked ? 0.22 : 1;
    const musicLevel =
      !this.currentConfig.enabled || !this.currentConfig.musicEnabled
        ? 0
        : clamp01(this.currentConfig.musicVolume) * 0.35 * duckFactor;
    const sfxLevel = !this.currentConfig.enabled
      ? 0
      : clamp01(this.currentConfig.sfxVolume) * (this.isDucked ? 0.65 : 1);

    this.voiceGain.gain.setTargetAtTime(voiceLevel, now, 0.04);
    this.musicGain.gain.setTargetAtTime(musicLevel, now, 0.14);
    this.sfxGain.gain.setTargetAtTime(sfxLevel, now, 0.05);
  }

  private setDucking(ducked: boolean): void {
    this.isDucked = ducked;
    this.syncGains();
  }

  private scheduleNote(
    target: 'music' | 'sfx',
    freq: number,
    durationSec: number,
    type: OscillatorType,
    peakGain: number,
    delaySec = 0,
    slideToFreq?: number
  ): void {
    const ctx = this.ensureAudioGraph();
    const bus = target === 'music' ? this.musicGain : this.sfxGain;
    if (!ctx || !bus) return;

    const t0 = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideToFreq) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(40, slideToFreq),
        t0 + durationSec
      );
    }

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(Math.max(0.0002, peakGain), t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);

    osc.connect(g);
    g.connect(bus);
    osc.start(t0);
    osc.stop(t0 + durationSec + 0.04);
  }

  private scheduleNoiseBurst(
    durationSec: number,
    peakGain: number,
    delaySec = 0,
    bandpassFreq = 1600
  ): void {
    const ctx = this.ensureAudioGraph();
    if (!ctx || !this.sfxGain) return;

    const sampleCount = Math.max(256, Math.floor(ctx.sampleRate * durationSec));
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleCount * 0.45));
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = bandpassFreq;
    filter.Q.value = 1.6;

    const g = ctx.createGain();
    const t0 = ctx.currentTime + delaySec;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(Math.max(0.0002, peakGain), t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start(t0);
    src.stop(t0 + durationSec + 0.02);
  }

  public startSuspenseMusic(): void {
    if (
      !this.currentConfig.enabled ||
      !this.currentConfig.musicEnabled ||
      !this.currentConfig.sfxToggles.suspenseMusic
    ) {
      return;
    }
    if (this.isMusicPlaying) return;
    this.isMusicPlaying = true;
    this.ensureAudioGraph();

    let barStep = 0;
    const bassNotes = [110, 110, 130.81, 98]; // A2, A2, C3, G2
    const padChords = [
      [220, 261.63, 329.63],
      [220, 261.63, 392.0],
      [196, 246.94, 329.63],
      [174.61, 220, 293.66],
    ];

    const playBar = () => {
      if (!this.isMusicPlaying) return;
      const idx = barStep % bassNotes.length;
      const bass = bassNotes[idx];
      const chord = padChords[idx];

      // Deep warm pulse bass
      this.scheduleNote('music', bass, 0.72, 'triangle', 0.24, 0);
      this.scheduleNote('music', bass, 0.35, 'sine', 0.14, 0.9);

      // Gentle atmospheric string/pad shimmer
      chord.forEach((f, ci) => {
        this.scheduleNote('music', f, 1.55, 'sine', 0.065, ci * 0.06);
      });
      // Subtle high expectation sparkle
      this.scheduleNote('music', chord[2] * 2, 0.28, 'sine', 0.035, 1.35);

      barStep += 1;
    };

    playBar();
    this.musicTimer = window.setInterval(playBar, 1800);
  }

  public stopSuspenseMusic(): void {
    this.isMusicPlaying = false;
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  public playSfx(kind: AnnouncerCuePreSfx): void {
    if (!this.currentConfig.enabled) return;

    switch (kind) {
      case 'suspense_intro':
        if (!this.currentConfig.sfxToggles.suspenseMusic) return;
        this.scheduleNote('sfx', 146.83, 0.9, 'triangle', 0.22, 0, 220);
        this.scheduleNote('sfx', 293.66, 0.75, 'sine', 0.14, 0.12);
        this.scheduleNote('sfx', 440, 0.65, 'sine', 0.1, 0.28);
        break;

      case 'drumroll':
        if (!this.currentConfig.sfxToggles.drumroll) return;
        // 10 accelerating soft percussive hits + warm low swell
        for (let i = 0; i < 10; i++) {
          const progress = i / 9;
          const delay = progress * 0.75;
          const gain = 0.08 + progress * 0.16;
          this.scheduleNoiseBurst(0.06, gain, delay, 1400 + i * 110);
          if (i % 3 === 0) {
            this.scheduleNote('sfx', 98 + i * 6, 0.11, 'triangle', 0.15, delay);
          }
        }
        this.scheduleNote('sfx', 261.63, 0.35, 'triangle', 0.18, 0.78, 392.0);
        break;

      case 'top3_sting':
        if (!this.currentConfig.sfxToggles.topThreeSting) return;
        this.scheduleNote('sfx', 523.25, 0.18, 'triangle', 0.16, 0);
        this.scheduleNote('sfx', 659.25, 0.2, 'triangle', 0.16, 0.09);
        this.scheduleNote('sfx', 783.99, 0.34, 'sine', 0.18, 0.18);
        this.scheduleNote('sfx', 1046.5, 0.55, 'sine', 0.17, 0.27);
        break;

      case 'winner_fanfare':
        if (!this.currentConfig.sfxToggles.winnerFanfare) return;
        // Celebratory original anthem fanfare
        this.scheduleNote('sfx', 392.0, 0.16, 'triangle', 0.22, 0);
        this.scheduleNote('sfx', 523.25, 0.16, 'triangle', 0.23, 0.13);
        this.scheduleNote('sfx', 659.25, 0.18, 'triangle', 0.24, 0.26);
        this.scheduleNote('sfx', 783.99, 0.26, 'sawtooth', 0.12, 0.39);
        this.scheduleNote('sfx', 1046.5, 0.85, 'triangle', 0.25, 0.52);
        this.scheduleNote('sfx', 523.25, 0.85, 'sine', 0.18, 0.52);
        this.scheduleNote('sfx', 659.25, 0.85, 'sine', 0.16, 0.52);
        this.scheduleNoiseBurst(0.18, 0.09, 0.52, 4200);
        break;

      case 'last_place_sting':
        if (!this.currentConfig.sfxToggles.lastPlaceSting) return;
        // Lighthearted friendly marimba-like bounce
        this.scheduleNote('sfx', 349.23, 0.15, 'sine', 0.18, 0);
        this.scheduleNote('sfx', 440.0, 0.15, 'sine', 0.18, 0.13);
        this.scheduleNote('sfx', 523.25, 0.16, 'sine', 0.19, 0.26);
        this.scheduleNote('sfx', 587.33, 0.24, 'triangle', 0.17, 0.39);
        this.scheduleNote('sfx', 523.25, 0.38, 'sine', 0.18, 0.54);
        break;

      case 'closing':
        if (!this.currentConfig.sfxToggles.closingMusic) return;
        this.scheduleNote('sfx', 349.23, 0.5, 'sine', 0.14, 0);
        this.scheduleNote('sfx', 440.0, 0.55, 'sine', 0.14, 0.14);
        this.scheduleNote('sfx', 523.25, 0.65, 'sine', 0.15, 0.28);
        this.scheduleNote('sfx', 659.25, 0.9, 'sine', 0.15, 0.42);
        break;
    }
  }

  private stopActiveVoice(): void {
    if (this.activeAudioEl) {
      try {
        this.activeAudioEl.onended = null;
        this.activeAudioEl.onerror = null;
        this.activeAudioEl.pause();
        this.activeAudioEl.src = '';
      } catch {
        // ignore cleanup errors
      }
      this.activeAudioEl = null;
    }
    if (this.activeAudioUrl) {
      try {
        URL.revokeObjectURL(this.activeAudioUrl);
      } catch {
        // ignore
      }
      this.activeAudioUrl = null;
    }
    if (this.activeAudioResolve) {
      const resolve = this.activeAudioResolve;
      this.activeAudioResolve = null;
      resolve();
    }
  }

  public stopAll(): void {
    this.playbackGeneration += 1;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.stopActiveVoice();
    this.setDucking(false);
    this.stopSuspenseMusic();
    this.setStatus({
      isCeremonyActive: false,
      isGeneratingAudio: false,
      isSpeaking: false,
    });
  }

  private async fetchSpeechBlob(
    text: string,
    config: AnnouncerConfig,
    signal: AbortSignal
  ): Promise<{ audioBlob: Blob; modelUsed: string }> {
    const voiceName = normalizeAnnouncerVoiceName(config.voiceName);
    const cacheKey = `v2-female::${voiceName}::${config.style}::${config.suspenseLevel}::${text}`;

    const cachedBlob = this.audioBlobCache.get(cacheKey);
    if (cachedBlob) {
      return { audioBlob: cachedBlob, modelUsed: 'gemini-tts (caché local)' };
    }

    const res = await fetch('/api/announcer/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        style: config.style,
        suspenseLevel: config.suspenseLevel,
        voiceName,
      }),
      signal,
    });

    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      wavBase64?: string;
      modelUsed?: string;
      error?: string;
      category?: string;
      retryable?: boolean;
    };

    if (!res.ok || !data.wavBase64) {
      const err = new Error(
        data.error || `Error del servidor TTS (${res.status}).`
      ) as Error & { category?: string; retryable?: boolean };
      err.category = data.category || 'HTTP_ERROR';
      err.retryable = Boolean(data.retryable);
      throw err;
    }

    const binaryStr = window.atob(data.wavBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const audioBlob = new Blob([bytes], { type: 'audio/wav' });
    if (this.audioBlobCache.size > 40) {
      const first = this.audioBlobCache.keys().next().value;
      if (first) this.audioBlobCache.delete(first);
    }
    this.audioBlobCache.set(cacheKey, audioBlob);

    return {
      audioBlob,
      modelUsed: data.modelUsed || 'gemini-3.8-flash-lite-tts',
    };
  }

  private playAudioBlob(
    blob: Blob,
    generation: number
  ): Promise<void> {
    this.stopActiveVoice();

    return new Promise((resolve) => {
      if (generation !== this.playbackGeneration) {
        resolve();
        return;
      }

      const objectUrl = URL.createObjectURL(blob);
      const audio = new Audio(objectUrl) as HTMLAudioElement & {
        preservesPitch?: boolean;
        mozPreservesPitch?: boolean;
        webkitPreservesPitch?: boolean;
      };

      audio.preservesPitch = true;
      audio.mozPreservesPitch = true;
      audio.webkitPreservesPitch = true;
      audio.playbackRate = clampAnnouncerSpeed(this.currentConfig.voiceSpeed, 0.95);
      audio.volume =
        !this.currentConfig.enabled || this.currentConfig.mutedVoice
          ? 0
          : clamp01(this.currentConfig.voiceVolume);
      audio.muted =
        !this.currentConfig.enabled || this.currentConfig.mutedVoice;

      this.activeAudioEl = audio;
      this.activeAudioUrl = objectUrl;
      this.activeAudioResolve = resolve;

      const finish = () => {
        if (this.activeAudioEl === audio) {
          this.activeAudioEl = null;
        }
        if (this.activeAudioUrl === objectUrl) {
          this.activeAudioUrl = null;
          try {
            URL.revokeObjectURL(objectUrl);
          } catch {
            // ignore
          }
        }
        if (this.activeAudioResolve === resolve) {
          this.activeAudioResolve = null;
        }
        this.setDucking(false);
        this.setStatus({ isSpeaking: false });
        resolve();
      };

      audio.onended = finish;
      audio.onerror = finish;

      this.setDucking(true);
      this.setStatus({ isSpeaking: true });

      void audio.play().catch(() => {
        finish();
      });
    });
  }

  private delay(ms: number, generation: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (generation !== this.playbackGeneration || ms <= 0) {
        resolve(generation === this.playbackGeneration);
        return;
      }
      window.setTimeout(() => {
        resolve(generation === this.playbackGeneration);
      }, ms);
    });
  }

  /**
   * Plays a single preview demonstration line using real Gemini TTS + optional SFX.
   */
  public async playPreviewSample(
    config: AnnouncerConfig,
    sampleName = 'Mateo Herrera'
  ): Promise<boolean> {
    this.stopAll();
    const normalizedConfig: AnnouncerConfig = {
      ...config,
      voiceName: normalizeAnnouncerVoiceName(config.voiceName),
      voiceSpeed: clampAnnouncerSpeed(config.voiceSpeed, 0.95),
    };
    this.applyConfig(normalizedConfig);
    const generation = ++this.playbackGeneration;
    const controller = new AbortController();
    this.abortController = controller;

    const previewText =
      normalizedConfig.style === 'misterioso'
        ? `Participantes... ha llegado el momento de conocer los resultados... Puesto número uno... ${sampleName}.`
        : normalizedConfig.style === 'solemne'
          ? `Estimados participantes... es momento de conocer los resultados... Puesto número uno... ${sampleName}.`
          : normalizedConfig.style === 'competitivo'
            ? `Participantes... la competencia ha concluido... Puesto número uno... ${sampleName}.`
            : normalizedConfig.style === 'juvenil'
              ? `Participantes... ha llegado el momento de conocer los resultados... Puesto número uno... ${sampleName}.`
              : `Participantes... ha llegado el momento de conocer los resultados... Puesto número uno... ${sampleName}.`;

    this.setStatus({
      isCeremonyActive: true,
      isGeneratingAudio: true,
      currentStage: 'first_place',
      currentRankLabel: 'Demostración de Voz Femenina IA',
      currentCaption: previewText,
      lastError: null,
    });

    try {
      if (normalizedConfig.sfxToggles.drumroll) {
        this.playSfx('drumroll');
        await this.delay(650, generation);
      }
      if (generation !== this.playbackGeneration) return false;

      if (!normalizedConfig.mutedVoice && normalizedConfig.voiceVolume > 0.01) {
        const { audioBlob, modelUsed } = await this.fetchSpeechBlob(
          previewText,
          normalizedConfig,
          controller.signal
        );
        if (generation !== this.playbackGeneration) return false;

        this.setStatus({ isGeneratingAudio: false, lastModelUsed: modelUsed });
        await this.playAudioBlob(audioBlob, generation);
      } else {
        this.setStatus({ isGeneratingAudio: false });
        await this.delay(1200, generation);
      }

      if (generation !== this.playbackGeneration) return false;
      if (normalizedConfig.sfxToggles.winnerFanfare) {
        this.playSfx('winner_fanfare');
      }

      this.setStatus({
        isCeremonyActive: false,
        isGeneratingAudio: false,
        isSpeaking: false,
      });
      return true;
    } catch (err) {
      if (generation !== this.playbackGeneration) return false;
      const typedErr = err as Error & { category?: string; retryable?: boolean };
      this.setStatus({
        isCeremonyActive: false,
        isGeneratingAudio: false,
        isSpeaking: false,
        lastError: {
          message:
            typedErr.message ||
            'No se pudo reproducir la demostración del locutor.',
          category: typedErr.category || 'ERROR',
          retryable: Boolean(typedErr.retryable),
        },
      });
      return false;
    }
  }

  private async fetchSpeechDurationMetadata(
    text: string,
    config: AnnouncerConfig,
    signal: AbortSignal
  ): Promise<{ durationMs: number; modelUsed: string }> {
    const res = await fetch('/api/announcer/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        style: config.style,
        suspenseLevel: config.suspenseLevel,
        voiceName: config.voiceName,
        metadataOnly: true,
      }),
      signal,
    });

    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      durationMs?: number;
      modelUsed?: string;
      error?: string;
      category?: string;
      retryable?: boolean;
    };

    if (!res.ok || !data.ok) {
      const err = new Error(
        data.error || `Error del servidor TTS (${res.status}).`
      ) as Error & { category?: string; retryable?: boolean };
      err.category = data.category || 'HTTP_ERROR';
      err.retryable = Boolean(data.retryable);
      throw err;
    }

    return {
      durationMs: Math.max(1200, Number(data.durationMs) || 2600),
      modelUsed: data.modelUsed || 'gemini-3.8-flash-lite-tts',
    };
  }

  /**
   * Used exclusively by ProjectorView when room audio is routed to Projector.
   * Plays a single synchronized cue cleanly without overlapping prior audio.
   */
  public async playSynchronizedProjectorCue(options: {
    cue: AnnouncerCue;
    config: AnnouncerConfig;
    isStartOfCeremony: boolean;
    isEndOfCeremony: boolean;
  }): Promise<void> {
    const { cue, config, isStartOfCeremony, isEndOfCeremony } = options;
    this.playbackGeneration += 1;
    const generation = this.playbackGeneration;
    if (this.abortController) {
      this.abortController.abort();
    }
    this.stopActiveVoice();
    this.setDucking(false);

    const controller = new AbortController();
    this.abortController = controller;
    this.applyConfig(config);

    if (isStartOfCeremony && config.musicEnabled) {
      this.startSuspenseMusic();
    }

    this.setStatus({
      isCeremonyActive: !isEndOfCeremony,
      currentStage: cue.stage,
      currentCaption: cue.displayText,
      currentRankLabel: cue.rankLabel,
      highlightedParticipantIds: cue.highlightedParticipantIds,
      lastError: null,
    });

    try {
      if (cue.preSfx) {
        this.playSfx(cue.preSfx);
      }

      const stillValid = await this.delay(cue.pauseBeforeMs, generation);
      if (!stillValid) return;

      if (config.enabled && !config.mutedVoice && config.voiceVolume > 0.01) {
        this.setStatus({ isGeneratingAudio: true });
        const { audioBlob, modelUsed } = await this.fetchSpeechBlob(
          cue.spokenText,
          config,
          controller.signal
        );
        if (generation !== this.playbackGeneration) return;
        this.setStatus({ isGeneratingAudio: false, lastModelUsed: modelUsed });
        await this.playAudioBlob(audioBlob, generation);
      }

      if (generation !== this.playbackGeneration) return;

      if (cue.postSfx) {
        this.playSfx(cue.postSfx);
      }
      if (isEndOfCeremony) {
        await this.delay(950, generation);
        if (generation === this.playbackGeneration) {
          this.stopSuspenseMusic();
          this.setStatus({
            isCeremonyActive: false,
            isGeneratingAudio: false,
            isSpeaking: false,
          });
        }
      }
    } catch (err) {
      if (generation !== this.playbackGeneration) return;
      const typed = err as Error & { category?: string; retryable?: boolean };
      this.setStatus({
        isGeneratingAudio: false,
        isSpeaking: false,
        lastError: {
          message:
            typed.message || 'No se pudo reproducir la voz del locutor en proyección.',
          category: typed.category || 'TTS_ERROR',
          retryable: Boolean(typed.retryable),
        },
      });
    }
  }

  /**
   * Executes the full synchronized ceremony cue-by-cue, emitting stage callbacks
   * so Presenter and Projector stay strictly in lockstep during progressive reveal.
   */
  public async runCeremony(options: {
    plan: AnnouncerAnnouncementPlan;
    config: AnnouncerConfig;
    shouldPlayAudioOnThisDevice: boolean;
    onCueStart?: (cue: AnnouncerCue, cueIndex: number, unlocked: AnnouncerStage[]) => void;
    onComplete?: () => void;
  }): Promise<void> {
    const { plan, config, shouldPlayAudioOnThisDevice, onCueStart, onComplete } =
      options;

    this.stopAll();
    this.applyConfig(config);
    const generation = ++this.playbackGeneration;
    const controller = new AbortController();
    this.abortController = controller;

    this.setStatus({
      isCeremonyActive: true,
      isGeneratingAudio: false,
      isSpeaking: false,
      activeCueIndex: 0,
      lastError: null,
    });

    if (shouldPlayAudioOnThisDevice && config.musicEnabled) {
      this.startSuspenseMusic();
    }

    const prefetchedMap = new Map<
      string,
      Promise<{ audioBlob: Blob; modelUsed: string }>
    >();

    const startPrefetch = (cueIdx: number) => {
      if (
        !shouldPlayAudioOnThisDevice ||
        !config.enabled ||
        config.mutedVoice ||
        config.voiceVolume <= 0.01
      ) {
        return;
      }
      const c = plan.cues[cueIdx];
      if (!c || prefetchedMap.has(c.id)) return;
      prefetchedMap.set(
        c.id,
        this.fetchSpeechBlob(c.spokenText, config, controller.signal)
      );
    };

    try {
      for (let i = 0; i < plan.cues.length; i++) {
        if (generation !== this.playbackGeneration) return;

        const cue = plan.cues[i];
        const unlocked = getUnlockedStagesUpToCue(plan, i);

        // If Projector plays audio, warm the server TTS cache and read exact WAV duration first!
        let remoteDurationMs = 2400;
        if (
          !shouldPlayAudioOnThisDevice &&
          config.enabled &&
          !config.mutedVoice &&
          config.voiceVolume > 0.01
        ) {
          this.setStatus({ isGeneratingAudio: true });
          try {
            const meta = await this.fetchSpeechDurationMetadata(
              cue.spokenText,
              config,
              controller.signal
            );
            const speed = clampAnnouncerSpeed(config.voiceSpeed, 0.95);
            remoteDurationMs = Math.round(meta.durationMs / speed);
            if (generation !== this.playbackGeneration) return;
            this.setStatus({ isGeneratingAudio: false, lastModelUsed: meta.modelUsed });
          } catch (ttsErr) {
            if (generation !== this.playbackGeneration) return;
            const typed = ttsErr as Error & { category?: string; retryable?: boolean };
            this.setStatus({
              isGeneratingAudio: false,
              lastError: {
                message:
                  typed.message || 'Error al preparar audio TTS para proyección.',
                category: typed.category || 'TTS_ERROR',
                retryable: Boolean(typed.retryable),
              },
            });
          }
        } else {
          startPrefetch(i);
        }

        if (generation !== this.playbackGeneration) return;

        this.setStatus({
          activeCueIndex: i,
          currentStage: cue.stage,
          currentCaption: cue.displayText,
          currentRankLabel: cue.rankLabel,
          highlightedParticipantIds: cue.highlightedParticipantIds,
          unlockedStages: unlocked,
        });

        onCueStart?.(cue, i, unlocked);

        if (shouldPlayAudioOnThisDevice && cue.preSfx) {
          this.playSfx(cue.preSfx);
        }

        const stillValidAfterWait = await this.delay(cue.pauseBeforeMs, generation);
        if (!stillValidAfterWait) return;

        if (
          shouldPlayAudioOnThisDevice &&
          config.enabled &&
          !config.mutedVoice &&
          config.voiceVolume > 0.01
        ) {
          this.setStatus({ isGeneratingAudio: true });
          try {
            const audioTask =
              prefetchedMap.get(cue.id) ||
              this.fetchSpeechBlob(cue.spokenText, config, controller.signal);
            const { audioBlob, modelUsed } = await audioTask;
            if (generation !== this.playbackGeneration) return;
            this.setStatus({ isGeneratingAudio: false, lastModelUsed: modelUsed });
            await this.playAudioBlob(audioBlob, generation);
          } catch (ttsErr) {
            if (generation !== this.playbackGeneration) return;
            const typed = ttsErr as Error & {
              category?: string;
              retryable?: boolean;
            };
            this.setStatus({
              isGeneratingAudio: false,
              lastError: {
                message:
                  typed.message || 'Error al sintetizar voz con Gemini TTS.',
                category: typed.category || 'TTS_ERROR',
                retryable: Boolean(typed.retryable),
              },
            });
            await this.delay(2200, generation);
          }
        } else {
          // Wait the exact WAV duration (plus brief buffer) while Projector plays the audio
          await this.delay(remoteDurationMs + 320, generation);
        }

        if (generation !== this.playbackGeneration) return;

        if (cue.postSfx) {
          if (shouldPlayAudioOnThisDevice) {
            this.playSfx(cue.postSfx);
          }
          await this.delay(750, generation);
        }

        if (cue.stage === 'complete') {
          this.stopSuspenseMusic();
        }
      }

      if (generation !== this.playbackGeneration) return;
      this.stopSuspenseMusic();
      this.setStatus({
        isCeremonyActive: false,
        isGeneratingAudio: false,
        isSpeaking: false,
      });
      onComplete?.();
    } catch {
      if (generation === this.playbackGeneration) {
        this.stopSuspenseMusic();
        this.setStatus({
          isCeremonyActive: false,
          isGeneratingAudio: false,
          isSpeaking: false,
        });
      }
    }
  }
}

export const announcerAudio = new AnnouncerAudioController();

export function shouldPlayAudioHere(options: {
  role: 'presenter' | 'projector';
  audioTarget: AnnouncerConfig['audioTarget'];
  projectorConnectedCount?: number;
}): boolean {
  const { role, audioTarget, projectorConnectedCount = 0 } = options;
  if (audioTarget === 'both') return true;
  if (audioTarget === 'projector') return role === 'projector';
  if (audioTarget === 'presenter') return role === 'presenter';
  // 'auto': play on projector when a projector window is connected, otherwise play on presenter
  if (projectorConnectedCount > 0) {
    return role === 'projector';
  }
  return role === 'presenter';
}

export function buildPlanForRoom(options: {
  leaderboard: LeaderboardEntry[];
  config: AnnouncerConfig;
  gameTitle: string;
  ceremonyRunId: string;
  variationSeed: number;
}): AnnouncerAnnouncementPlan {
  return buildAnnouncerPlan(options);
}
