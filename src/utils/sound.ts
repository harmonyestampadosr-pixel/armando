export type DidacticAmbientMode =
  | 'mystery'
  | 'learning'
  | 'adventure_heroic'
  | 'adventure_royal'
  | 'adventure_desert'
  | 'adventure_pastoral'
  | 'adventure_miracle'
  | null;

export interface AudioPreferences {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  masterVolume: number; // 0 to 1
  musicVolume: number;  // 0 to 1
  sfxVolume: number;    // 0 to 1
  didacticSfxEnabled: boolean;
  didacticAmbientEnabled: boolean;
  didacticVolume: number; // 0 to 1
}

export interface AudioManagerSnapshot {
  prefs: AudioPreferences;
  welcomeMusicActive: boolean;
  isMusicPlaying: boolean;
  autoplayBlocked: boolean;
  didacticAmbientMode: DidacticAmbientMode;
}

const PREFS_STORAGE_KEY = 'dtqd_audio_prefs_v1';

const DEFAULT_PREFS: AudioPreferences = {
  musicEnabled: true,
  sfxEnabled: true,
  masterVolume: 0.8,
  musicVolume: 0.55,
  sfxVolume: 0.85,
  didacticSfxEnabled: true,
  didacticAmbientEnabled: true,
  didacticVolume: 0.75,
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function loadSavedPrefs(): AudioPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFS };
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<AudioPreferences>;
    return {
      musicEnabled:
        typeof parsed.musicEnabled === 'boolean'
          ? parsed.musicEnabled
          : DEFAULT_PREFS.musicEnabled,
      sfxEnabled:
        typeof parsed.sfxEnabled === 'boolean'
          ? parsed.sfxEnabled
          : DEFAULT_PREFS.sfxEnabled,
      masterVolume:
        typeof parsed.masterVolume === 'number'
          ? clamp01(parsed.masterVolume)
          : DEFAULT_PREFS.masterVolume,
      musicVolume:
        typeof parsed.musicVolume === 'number'
          ? clamp01(parsed.musicVolume)
          : DEFAULT_PREFS.musicVolume,
      sfxVolume:
        typeof parsed.sfxVolume === 'number'
          ? clamp01(parsed.sfxVolume)
          : DEFAULT_PREFS.sfxVolume,
      didacticSfxEnabled:
        typeof parsed.didacticSfxEnabled === 'boolean'
          ? parsed.didacticSfxEnabled
          : DEFAULT_PREFS.didacticSfxEnabled,
      didacticAmbientEnabled:
        typeof parsed.didacticAmbientEnabled === 'boolean'
          ? parsed.didacticAmbientEnabled
          : DEFAULT_PREFS.didacticAmbientEnabled,
      didacticVolume:
        typeof parsed.didacticVolume === 'number'
          ? clamp01(parsed.didacticVolume)
          : DEFAULT_PREFS.didacticVolume,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function savePrefs(prefs: AudioPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage quota/private mode errors
  }
}

interface ChordBar {
  bass: number;
  padNotes: number[];
  keysVoicing: number[];
  arpNotes: number[];
}

// Uplifting, bright C Major progression at 108 BPM (Cmaj9 -> G6/B -> Am7 -> Fmaj9)
const WELCOME_PROGRESSION: ChordBar[] = [
  {
    bass: 130.81, // C3
    padNotes: [261.63, 329.63, 392.0, 493.88], // C4 E4 G4 B4
    keysVoicing: [329.63, 392.0, 493.88, 587.33], // E4 G4 B4 D5
    arpNotes: [523.25, 659.25, 783.99, 659.25, 587.33, 659.25, 783.99, 987.77],
  },
  {
    bass: 123.47, // B2
    padNotes: [246.94, 293.66, 392.0, 440.0], // B3 D4 G4 A4
    keysVoicing: [293.66, 392.0, 440.0, 493.88], // D4 G4 A4 B4
    arpNotes: [493.88, 587.33, 783.99, 587.33, 659.25, 587.33, 783.99, 880.0],
  },
  {
    bass: 110.0, // A2
    padNotes: [220.0, 329.63, 392.0, 523.25], // A3 E4 G4 C5
    keysVoicing: [329.63, 392.0, 523.25, 587.33], // E4 G4 C5 D5
    arpNotes: [523.25, 659.25, 783.99, 1046.5, 880.0, 783.99, 659.25, 587.33],
  },
  {
    bass: 174.61, // F3
    padNotes: [261.63, 329.63, 349.23, 440.0], // C4 E4 F4 A4
    keysVoicing: [329.63, 349.23, 440.0, 523.25], // E4 F4 A4 C5
    arpNotes: [440.0, 523.25, 659.25, 783.99, 698.46, 659.25, 587.33, 523.25],
  },
];

const EIGHTH_SEC = 60 / 108 / 2; // ~0.2778s per 8th note (108 BPM)

class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private didacticSfxGain: GainNode | null = null;
  private didacticAmbientGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private prefs: AudioPreferences = loadSavedPrefs();
  private welcomeMusicActive = false;
  private didacticAmbientMode: DidacticAmbientMode = null;
  private autoplayBlocked = false;
  private schedulerId: number | null = null;
  private nextStepTime = 0;
  private currentStep = 0; // 0..31 (4 bars x 8 eighth-notes)
  private didacticSchedulerId: number | null = null;
  private didacticNextStepTime = 0;
  private didacticStep = 0;
  private lastDidacticPlayedAt = new Map<string, number>();
  private gestureListenersInstalled = false;

  private listeners = new Set<(snap: AudioManagerSnapshot) => void>();

  constructor() {
    this.installGestureUnlockers();
  }

  // Backwards-compatible accessor for existing quick-mute references
  get muted(): boolean {
    return !this.prefs.sfxEnabled && !this.prefs.musicEnabled;
  }

  set muted(value: boolean) {
    this.updatePrefs({
      sfxEnabled: !value,
      musicEnabled: !value,
    });
  }

  private installGestureUnlockers(): void {
    if (typeof window === 'undefined' || this.gestureListenersInstalled) return;
    this.gestureListenersInstalled = true;

    const handleGesture = () => {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume().then(() => {
          this.onAudioContextStateChange();
        });
      } else if (this.welcomeMusicActive && this.prefs.musicEnabled && !this.ctx) {
        const ctx = this.ensureAudioGraph();
        if (ctx && ctx.state === 'suspended') {
          void ctx.resume().then(() => {
            this.onAudioContextStateChange();
          });
        } else {
          this.onAudioContextStateChange();
        }
      }
    };

    window.addEventListener('pointerdown', handleGesture, { passive: true });
    window.addEventListener('keydown', handleGesture, { passive: true });
    window.addEventListener('touchstart', handleGesture, { passive: true });
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
      compressor.threshold.setValueAtTime(-14, ctx.currentTime);
      compressor.knee.setValueAtTime(18, ctx.currentTime);
      compressor.ratio.setValueAtTime(4, ctx.currentTime);
      compressor.attack.setValueAtTime(0.005, ctx.currentTime);
      compressor.release.setValueAtTime(0.18, ctx.currentTime);

      const master = ctx.createGain();
      master.gain.setValueAtTime(this.prefs.masterVolume, ctx.currentTime);

      const musicFilter = ctx.createBiquadFilter();
      musicFilter.type = 'lowpass';
      musicFilter.frequency.setValueAtTime(4800, ctx.currentTime);

      const music = ctx.createGain();
      music.gain.setValueAtTime(0.0001, ctx.currentTime);

      const sfx = ctx.createGain();
      sfx.gain.setValueAtTime(
        this.prefs.sfxEnabled ? this.prefs.sfxVolume : 0,
        ctx.currentTime
      );

      const didacticSfx = ctx.createGain();
      didacticSfx.gain.setValueAtTime(
        this.prefs.didacticSfxEnabled ? this.prefs.didacticVolume : 0,
        ctx.currentTime
      );

      const didacticAmbientFilter = ctx.createBiquadFilter();
      didacticAmbientFilter.type = 'lowpass';
      didacticAmbientFilter.frequency.setValueAtTime(3200, ctx.currentTime);

      const didacticAmbient = ctx.createGain();
      didacticAmbient.gain.setValueAtTime(0.0001, ctx.currentTime);

      music.connect(musicFilter);
      musicFilter.connect(master);
      sfx.connect(master);
      didacticSfx.connect(master);
      didacticAmbient.connect(didacticAmbientFilter);
      didacticAmbientFilter.connect(master);
      master.connect(compressor);
      compressor.connect(ctx.destination);

      ctx.onstatechange = () => {
        this.onAudioContextStateChange();
      };

      this.ctx = ctx;
      this.masterGain = master;
      this.musicGain = music;
      this.sfxGain = sfx;
      this.didacticSfxGain = didacticSfx;
      this.didacticAmbientGain = didacticAmbient;
      this.noiseBuffer = this.createNoiseBuffer(ctx);
    }

    return this.ctx;
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * 0.4);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private isDidacticAmbientBlockingWelcome(): boolean {
    return this.didacticAmbientMode !== null && this.prefs.didacticAmbientEnabled;
  }

  private onAudioContextStateChange(): void {
    const ctx = this.ctx;
    const shouldPlayDidacticAmbient =
      this.didacticAmbientMode !== null && this.prefs.didacticAmbientEnabled;
    const shouldPlay =
      this.welcomeMusicActive &&
      this.prefs.musicEnabled &&
      !shouldPlayDidacticAmbient;
    if (ctx && ctx.state === 'running') {
      this.autoplayBlocked = false;
      if (shouldPlay && this.schedulerId === null) {
        this.startMusicScheduler();
      } else if (!shouldPlay && this.schedulerId !== null) {
        this.stopMusicScheduler();
      }
      if (shouldPlayDidacticAmbient && this.didacticSchedulerId === null) {
        this.startDidacticAmbientScheduler();
      }
      this.applyGains();
    } else if (shouldPlay) {
      this.autoplayBlocked = true;
    }
    this.notify();
  }

  private applyGains(): void {
    const ctx = this.ctx;
    if (!ctx || !this.masterGain || !this.musicGain || !this.sfxGain) return;

    const now = ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.prefs.masterVolume, now, 0.04);

    const targetSfx = this.prefs.sfxEnabled ? this.prefs.sfxVolume : 0;
    this.sfxGain.gain.setTargetAtTime(targetSfx, now, 0.03);

    const shouldPlayMusic =
      this.welcomeMusicActive &&
      this.prefs.musicEnabled &&
      !this.isDidacticAmbientBlockingWelcome();
    const targetMusic = shouldPlayMusic ? this.prefs.musicVolume * 0.52 : 0.0001;
    this.musicGain.gain.setTargetAtTime(targetMusic, now, shouldPlayMusic ? 0.25 : 0.14);

    if (this.didacticSfxGain) {
      const targetDidacticSfx = this.prefs.didacticSfxEnabled
        ? this.prefs.didacticVolume
        : 0;
      this.didacticSfxGain.gain.setTargetAtTime(targetDidacticSfx, now, 0.03);
    }

    if (this.didacticAmbientGain) {
      const shouldPlayAmbient =
        this.didacticAmbientMode !== null && this.prefs.didacticAmbientEnabled;
      const targetAmbient = shouldPlayAmbient
        ? this.prefs.didacticVolume * 0.42
        : 0.0001;
      this.didacticAmbientGain.gain.setTargetAtTime(
        targetAmbient,
        now,
        shouldPlayAmbient ? 0.35 : 0.18
      );
    }
  }

  public subscribe(listener: (snap: AudioManagerSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSnapshot(): AudioManagerSnapshot {
    const isRunning = this.ctx?.state === 'running';
    const shouldPlay = this.welcomeMusicActive && this.prefs.musicEnabled;
    return {
      prefs: { ...this.prefs },
      welcomeMusicActive: this.welcomeMusicActive,
      isMusicPlaying: Boolean(shouldPlay && isRunning && this.schedulerId !== null),
      autoplayBlocked: Boolean(shouldPlay && this.autoplayBlocked && !isRunning),
      didacticAmbientMode: this.didacticAmbientMode,
    };
  }

  private notify(): void {
    const snap = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snap);
    }
  }

  public updatePrefs(partial: Partial<AudioPreferences>): void {
    this.prefs = {
      musicEnabled:
        typeof partial.musicEnabled === 'boolean'
          ? partial.musicEnabled
          : this.prefs.musicEnabled,
      sfxEnabled:
        typeof partial.sfxEnabled === 'boolean'
          ? partial.sfxEnabled
          : this.prefs.sfxEnabled,
      masterVolume:
        typeof partial.masterVolume === 'number'
          ? clamp01(partial.masterVolume)
          : this.prefs.masterVolume,
      musicVolume:
        typeof partial.musicVolume === 'number'
          ? clamp01(partial.musicVolume)
          : this.prefs.musicVolume,
      sfxVolume:
        typeof partial.sfxVolume === 'number'
          ? clamp01(partial.sfxVolume)
          : this.prefs.sfxVolume,
      didacticSfxEnabled:
        typeof partial.didacticSfxEnabled === 'boolean'
          ? partial.didacticSfxEnabled
          : this.prefs.didacticSfxEnabled,
      didacticAmbientEnabled:
        typeof partial.didacticAmbientEnabled === 'boolean'
          ? partial.didacticAmbientEnabled
          : this.prefs.didacticAmbientEnabled,
      didacticVolume:
        typeof partial.didacticVolume === 'number'
          ? clamp01(partial.didacticVolume)
          : this.prefs.didacticVolume,
    };
    savePrefs(this.prefs);

    if (this.prefs.didacticAmbientEnabled && this.didacticAmbientMode !== null) {
      this.stopMusicScheduler();
      void this.tryStartDidacticAmbient();
    } else if (!this.prefs.didacticAmbientEnabled) {
      this.stopDidacticAmbientScheduler();
      if (this.prefs.musicEnabled && this.welcomeMusicActive) {
        void this.tryStartWelcomeMusic();
      }
    }

    if (
      this.prefs.musicEnabled &&
      this.welcomeMusicActive &&
      !this.isDidacticAmbientBlockingWelcome()
    ) {
      void this.tryStartWelcomeMusic();
    } else {
      this.autoplayBlocked = false;
      this.stopMusicScheduler();
    }

    this.applyGains();
    this.notify();
  }

  public toggleMusic(): void {
    this.updatePrefs({ musicEnabled: !this.prefs.musicEnabled });
  }

  public toggleSfx(): void {
    this.updatePrefs({ sfxEnabled: !this.prefs.sfxEnabled });
  }

  public toggleDidacticSfx(): void {
    this.updatePrefs({ didacticSfxEnabled: !this.prefs.didacticSfxEnabled });
  }

  public toggleDidacticAmbient(): void {
    this.updatePrefs({
      didacticAmbientEnabled: !this.prefs.didacticAmbientEnabled,
    });
  }

  public async unlockAudio(): Promise<boolean> {
    const ctx = this.ensureAudioGraph();
    if (!ctx) return false;
    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      this.onAudioContextStateChange();
      return ctx.state === 'running';
    } catch {
      this.autoplayBlocked = true;
      this.notify();
      return false;
    }
  }

  public setWelcomeMusicActive(active: boolean): void {
    if (this.welcomeMusicActive === active) {
      if (
        active &&
        this.prefs.musicEnabled &&
        !this.isDidacticAmbientBlockingWelcome() &&
        this.schedulerId === null
      ) {
        void this.tryStartWelcomeMusic();
      }
      return;
    }
    this.welcomeMusicActive = active;

    if (
      active &&
      this.prefs.musicEnabled &&
      !this.isDidacticAmbientBlockingWelcome()
    ) {
      void this.tryStartWelcomeMusic();
    } else {
      this.autoplayBlocked = false;
      this.applyGains();
      this.stopMusicScheduler();
      this.notify();
    }
  }

  private async tryStartWelcomeMusic(): Promise<void> {
    if (this.isDidacticAmbientBlockingWelcome()) return;
    const ctx = this.ensureAudioGraph();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // Browser requires explicit gesture
      }
    }

    if ((ctx.state as AudioContextState) !== 'running') {
      this.autoplayBlocked = true;
      this.notify();
      return;
    }

    if (this.isDidacticAmbientBlockingWelcome()) return;
    this.autoplayBlocked = false;
    this.startMusicScheduler();
    this.applyGains();
    this.notify();
  }

  private startMusicScheduler(): void {
    const ctx = this.ctx;
    if (!ctx || this.schedulerId !== null || ctx.state !== 'running') return;

    this.nextStepTime = ctx.currentTime + 0.08;
    this.schedulerId = window.setInterval(() => {
      if (
        !this.ctx ||
        this.ctx.state !== 'running' ||
        !this.welcomeMusicActive ||
        !this.prefs.musicEnabled ||
        this.isDidacticAmbientBlockingWelcome()
      ) {
        return;
      }
      const lookahead = 0.22;
      while (this.nextStepTime < this.ctx.currentTime + lookahead) {
        this.scheduleWelcomeStep(this.currentStep, this.nextStepTime);
        this.nextStepTime += EIGHTH_SEC;
        this.currentStep = (this.currentStep + 1) % 32;
      }
    }, 60);
  }

  private stopMusicScheduler(): void {
    if (this.schedulerId !== null) {
      window.clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
  }

  private scheduleWelcomeStep(step: number, time: number): void {
    const ctx = this.ctx;
    const dest = this.musicGain;
    if (!ctx || !dest) return;

    const barIdx = Math.floor(step / 8);
    const stepInBar = step % 8;
    const chord = WELCOME_PROGRESSION[barIdx];

    // 1. Warm sustained pad on the downbeat of each bar
    if (stepInBar === 0) {
      const barDur = EIGHTH_SEC * 8;
      for (const freq of chord.padNotes) {
        const osc = ctx.createOscillator();
        const padGain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);

        padGain.gain.setValueAtTime(0.0001, time);
        padGain.gain.linearRampToValueAtTime(0.048, time + 0.35);
        padGain.gain.setValueAtTime(0.042, time + barDur - 0.35);
        padGain.gain.exponentialRampToValueAtTime(0.0001, time + barDur);

        osc.connect(padGain);
        padGain.connect(dest);
        osc.start(time);
        osc.stop(time + barDur + 0.04);
      }

      // Warm sub-bass root note
      const bassOsc = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bassOsc.type = 'triangle';
      bassOsc.frequency.setValueAtTime(chord.bass, time);
      bassGain.gain.setValueAtTime(0.0001, time);
      bassGain.gain.linearRampToValueAtTime(0.14, time + 0.04);
      bassGain.gain.exponentialRampToValueAtTime(0.0001, time + barDur * 0.9);
      bassOsc.connect(bassGain);
      bassGain.connect(dest);
      bassOsc.start(time);
      bassOsc.stop(time + barDur);
    }

    // 2. Modern electric-piano rhythmic chord stab (beats 1 and syncopated "2-and")
    if (stepInBar === 0 || stepInBar === 3) {
      const stabDur = stepInBar === 0 ? 0.55 : 0.7;
      for (const freq of chord.keysVoicing) {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const g = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(freq, time);
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(freq * 2, time);

        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.18, time);

        g.gain.setValueAtTime(0.0001, time);
        g.gain.linearRampToValueAtTime(0.055, time + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, time + stabDur);

        osc1.connect(g);
        osc2.connect(g2);
        g2.connect(g);
        g.connect(dest);

        osc1.start(time);
        osc2.start(time);
        osc1.stop(time + stabDur + 0.02);
        osc2.stop(time + stabDur + 0.02);
      }
    }

    // 3. Bright acoustic/kalimba 8th-note melody & arpeggio
    const arpFreq = chord.arpNotes[stepInBar];
    if (arpFreq) {
      const pluckOsc = ctx.createOscillator();
      const pluckFilter = ctx.createBiquadFilter();
      const pluckGain = ctx.createGain();

      pluckOsc.type = 'triangle';
      pluckOsc.frequency.setValueAtTime(arpFreq, time);

      pluckFilter.type = 'lowpass';
      pluckFilter.frequency.setValueAtTime(2400, time);
      pluckFilter.frequency.exponentialRampToValueAtTime(700, time + 0.24);

      const accent = stepInBar % 2 === 0 ? 0.075 : 0.048;
      pluckGain.gain.setValueAtTime(0.0001, time);
      pluckGain.gain.linearRampToValueAtTime(accent, time + 0.012);
      pluckGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.34);

      pluckOsc.connect(pluckFilter);
      pluckFilter.connect(pluckGain);
      pluckGain.connect(dest);
      pluckOsc.start(time);
      pluckOsc.stop(time + 0.38);
    }

    // 4. Soft modern upbeat percussion
    // Warm kick on beat 1, beat 3, and light syncopated "3-and" on bars 2 & 4
    if (
      stepInBar === 0 ||
      stepInBar === 4 ||
      (barIdx % 2 === 1 && stepInBar === 5)
    ) {
      const kickOsc = ctx.createOscillator();
      const kickGain = ctx.createGain();
      kickOsc.type = 'sine';
      kickOsc.frequency.setValueAtTime(115, time);
      kickOsc.frequency.exponentialRampToValueAtTime(46, time + 0.11);

      kickGain.gain.setValueAtTime(0.0001, time);
      kickGain.gain.linearRampToValueAtTime(0.22, time + 0.006);
      kickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);

      kickOsc.connect(kickGain);
      kickGain.connect(dest);
      kickOsc.start(time);
      kickOsc.stop(time + 0.18);
    }

    // Soft rim/wood snap on beats 2 & 4
    if (stepInBar === 2 || stepInBar === 6) {
      const rimOsc = ctx.createOscillator();
      const rimGain = ctx.createGain();
      rimOsc.type = 'triangle';
      rimOsc.frequency.setValueAtTime(920, time);
      rimOsc.frequency.exponentialRampToValueAtTime(420, time + 0.04);

      rimGain.gain.setValueAtTime(0.0001, time);
      rimGain.gain.linearRampToValueAtTime(0.05, time + 0.004);
      rimGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);

      rimOsc.connect(rimGain);
      rimGain.connect(dest);
      rimOsc.start(time);
      rimOsc.stop(time + 0.08);
    }

    // Gentle 8th-note shaker
    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(6500, time);

      const sGain = ctx.createGain();
      const vol = stepInBar % 2 === 0 ? 0.022 : 0.012;
      sGain.gain.setValueAtTime(0.0001, time);
      sGain.gain.linearRampToValueAtTime(vol, time + 0.005);
      sGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);

      src.connect(hp);
      hp.connect(sGain);
      sGain.connect(dest);
      src.start(time);
      src.stop(time + 0.06);
    }
  }

  private getSfxOutput(): { ctx: AudioContext; out: GainNode } | null {
    if (!this.prefs.sfxEnabled || typeof window === 'undefined') return null;
    const ctx = this.ensureAudioGraph();
    if (!ctx || !this.sfxGain) return null;
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
    this.applyGains();
    return { ctx, out: this.sfxGain };
  }

  private playTone(
    freq: number,
    durationSec: number,
    type: OscillatorType = 'sine',
    volume = 0.09,
    delay = 0,
    endFreq?: number
  ): void {
    const sfx = this.getSfxOutput();
    if (!sfx) return;
    const { ctx, out } = sfx;

    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq && endFreq > 0) {
      osc.frequency.exponentialRampToValueAtTime(endFreq, start + durationSec);
    }

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), start + 0.016);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + durationSec);

    osc.connect(gain);
    gain.connect(out);
    osc.start(start);
    osc.stop(start + durationSec + 0.03);
  }

  /**
   * Sonido corto, moderno y emocionante al aparecer cada pregunta nueva
   */
  public playQuestionStart(): void {
    const sfx = this.getSfxOutput();
    if (!sfx) return;
    // Bright ascending arpeggio fanfare (C5 - E5 - G5 - C6) + warm harmonic shimmer
    this.playTone(523.25, 0.14, 'triangle', 0.11, 0);
    this.playTone(659.25, 0.14, 'triangle', 0.11, 0.065);
    this.playTone(783.99, 0.16, 'triangle', 0.12, 0.13);
    this.playTone(1046.5, 0.36, 'sine', 0.14, 0.195);
    this.playTone(1046.5, 0.24, 'triangle', 0.06, 0.195);
    this.playTone(783.99, 0.34, 'sine', 0.07, 0.195);
  }

  /**
   * Sonido claro y reconocible cuando termina el cronómetro
   */
  public playTimeUp(): void {
    const sfx = this.getSfxOutput();
    if (!sfx) return;
    const { ctx, out } = sfx;
    const base = ctx.currentTime;

    // Studio double-lock broadcast chime (distinct downward/resolving dramatic cadence)
    const steps = [
      { delay: 0, freqs: [587.33, 440.0], dur: 0.18, vol: 0.12 },
      { delay: 0.18, freqs: [440.0, 329.63, 220.0], dur: 0.42, vol: 0.13 },
    ];

    for (const st of steps) {
      for (const freq of st.freqs) {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, base + st.delay);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1650, base + st.delay);
        filter.frequency.exponentialRampToValueAtTime(680, base + st.delay + st.dur);

        gain.gain.setValueAtTime(0.0001, base + st.delay);
        gain.gain.linearRampToValueAtTime(st.vol, base + st.delay + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, base + st.delay + st.dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(out);
        osc.start(base + st.delay);
        osc.stop(base + st.delay + st.dur + 0.03);
      }
    }
  }

  public playTick(): void {
    this.playTone(880, 0.06, 'triangle', 0.05);
  }

  public playLock(): void {
    this.playTone(523.25, 0.1, 'sine', 0.08, 0);
    this.playTone(659.25, 0.12, 'sine', 0.08, 0.07);
  }

  public playCorrect(): void {
    this.playTone(523.25, 0.15, 'triangle', 0.1, 0);
    this.playTone(659.25, 0.15, 'triangle', 0.1, 0.1);
    this.playTone(783.99, 0.28, 'triangle', 0.11, 0.2);
  }

  public playWrong(): void {
    this.playTone(260, 0.18, 'sawtooth', 0.05, 0);
    this.playTone(196, 0.28, 'sawtooth', 0.05, 0.14);
  }

  public playVictory(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.25, 'triangle', 0.1, idx * 0.12);
    });
  }

  // ---------------- GAME-SPECIFIC DIDACTIC AMBIENT & SFX ----------------

  public setDidacticAmbient(mode: DidacticAmbientMode): void {
    if (this.didacticAmbientMode === mode) {
      if (mode !== null && this.prefs.didacticAmbientEnabled && this.didacticSchedulerId === null) {
        this.stopMusicScheduler();
        void this.tryStartDidacticAmbient();
      }
      return;
    }
    this.didacticAmbientMode = mode;
    this.didacticStep = 0;

    if (mode !== null && this.prefs.didacticAmbientEnabled) {
      this.stopMusicScheduler();
      this.applyGains();
      void this.tryStartDidacticAmbient();
    } else {
      this.stopDidacticAmbientScheduler();
      if (this.welcomeMusicActive && this.prefs.musicEnabled) {
        void this.tryStartWelcomeMusic();
      } else {
        this.applyGains();
        this.notify();
      }
    }
  }

  private async tryStartDidacticAmbient(): Promise<void> {
    const ctx = this.ensureAudioGraph();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // Requires user gesture
      }
    }
    if ((ctx.state as AudioContextState) !== 'running') return;
    this.startDidacticAmbientScheduler();
    this.applyGains();
    this.notify();
  }

  private startDidacticAmbientScheduler(): void {
    const ctx = this.ctx;
    if (!ctx || this.didacticSchedulerId !== null || ctx.state !== 'running') return;

    this.didacticNextStepTime = ctx.currentTime + 0.08;
    this.didacticSchedulerId = window.setInterval(() => {
      if (
        !this.ctx ||
        this.ctx.state !== 'running' ||
        this.didacticAmbientMode === null ||
        !this.prefs.didacticAmbientEnabled
      ) {
        return;
      }
      const stepSec =
        this.didacticAmbientMode === 'mystery'
          ? 0.39
          : this.didacticAmbientMode?.startsWith('adventure_')
            ? 0.42
            : 0.44;
      const lookahead = 0.25;
      while (this.didacticNextStepTime < this.ctx.currentTime + lookahead) {
        this.scheduleDidacticAmbientStep(this.didacticStep, this.didacticNextStepTime);
        this.didacticNextStepTime += stepSec;
        this.didacticStep = (this.didacticStep + 1) % 16;
      }
    }, 80);
  }

  private stopDidacticAmbientScheduler(): void {
    if (this.didacticSchedulerId !== null) {
      window.clearInterval(this.didacticSchedulerId);
      this.didacticSchedulerId = null;
    }
  }

  private scheduleDidacticAmbientStep(step: number, time: number): void {
    const ctx = this.ctx;
    const dest = this.didacticAmbientGain;
    if (!ctx || !dest) return;

    if (this.didacticAmbientMode === 'mystery') {
      // Gentle reflective D-Dorian pad + harp motif (intriguing yet peaceful)
      const bars = [
        { pad: [293.66, 349.23, 440.0], notes: [587.33, 659.25, 523.25, 440.0] },
        { pad: [261.63, 329.63, 392.0], notes: [523.25, 587.33, 493.88, 392.0] },
        { pad: [220.0, 293.66, 349.23], notes: [440.0, 523.25, 587.33, 440.0] },
        { pad: [246.94, 293.66, 392.0], notes: [493.88, 587.33, 659.25, 523.25] },
      ];
      const bar = bars[Math.floor(step / 4)];
      const inBar = step % 4;
      if (inBar === 0) {
        for (const freq of bar.pad) {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, time);
          g.gain.setValueAtTime(0.0001, time);
          g.gain.linearRampToValueAtTime(0.032, time + 0.35);
          g.gain.exponentialRampToValueAtTime(0.0001, time + 1.55);
          osc.connect(g);
          g.connect(dest);
          osc.start(time);
          osc.stop(time + 1.6);
        }
      }
      const harpFreq = bar.notes[inBar];
      if (harpFreq) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(harpFreq, time);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.linearRampToValueAtTime(0.036, time + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, time + 0.55);
        osc.connect(g);
        g.connect(dest);
        osc.start(time);
        osc.stop(time + 0.6);
      }
    } else if (this.didacticAmbientMode === 'learning') {
      // Calm, meditative study progression (Gmaj7 -> Em7 -> Cmaj7 -> D6)
      const bars = [
        { pad: [196.0, 293.66, 369.99], notes: [392.0, 493.88, 587.33, 739.99] },
        { pad: [164.81, 246.94, 329.63], notes: [392.0, 493.88, 659.25, 587.33] },
        { pad: [130.81, 261.63, 329.63], notes: [329.63, 392.0, 493.88, 659.25] },
        { pad: [146.83, 220.0, 293.66], notes: [369.99, 440.0, 587.33, 493.88] },
      ];
      const bar = bars[Math.floor(step / 4)];
      const inBar = step % 4;
      if (inBar === 0) {
        for (const freq of bar.pad) {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, time);
          g.gain.setValueAtTime(0.0001, time);
          g.gain.linearRampToValueAtTime(0.035, time + 0.45);
          g.gain.exponentialRampToValueAtTime(0.0001, time + 1.75);
          osc.connect(g);
          g.connect(dest);
          osc.start(time);
          osc.stop(time + 1.8);
        }
      }
      if (inBar === 0 || inBar === 2) {
        const bellFreq = bar.notes[inBar];
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(bellFreq, time);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.linearRampToValueAtTime(0.034, time + 0.025);
        g.gain.exponentialRampToValueAtTime(0.0001, time + 0.85);
        osc.connect(g);
        g.connect(dest);
        osc.start(time);
        osc.stop(time + 0.9);
      }
    } else if (this.didacticAmbientMode?.startsWith('adventure_')) {
      const palettes: Record<
        string,
        Array<{ pad: number[]; melody: number[] }>
      > = {
        // David / Nehemías: D major uplifting strings & plucked harp
        adventure_heroic: [
          { pad: [146.83, 220.0, 293.66], melody: [587.33, 739.99, 880.0, 739.99] },
          { pad: [123.47, 185.0, 246.94], melody: [493.88, 587.33, 739.99, 587.33] },
          { pad: [196.0, 246.94, 293.66], melody: [587.33, 659.25, 783.99, 659.25] },
          { pad: [164.81, 220.0, 329.63], melody: [554.37, 659.25, 880.0, 739.99] },
        ],
        // Daniel / Ester: A minor noble warm court strings
        adventure_royal: [
          { pad: [220.0, 261.63, 329.63], melody: [440.0, 523.25, 659.25, 523.25] },
          { pad: [174.61, 220.0, 261.63], melody: [440.0, 587.33, 523.25, 440.0] },
          { pad: [196.0, 246.94, 293.66], melody: [493.88, 587.33, 659.25, 587.33] },
          { pad: [164.81, 207.65, 246.94], melody: [493.88, 659.25, 783.99, 659.25] },
        ],
        // Moisés / José: E dorian open desert wind & gentle bells
        adventure_desert: [
          { pad: [164.81, 246.94, 329.63], melody: [493.88, 587.33, 659.25, 587.33] },
          { pad: [146.83, 220.0, 293.66], melody: [440.0, 523.25, 587.33, 493.88] },
          { pad: [130.81, 196.0, 261.63], melody: [392.0, 493.88, 587.33, 523.25] },
          { pad: [146.83, 220.0, 293.66], melody: [440.0, 493.88, 659.25, 587.33] },
        ],
        // Rut / Samaritano / Hijo Pródigo: F major warm acoustic pastoral
        adventure_pastoral: [
          { pad: [174.61, 220.0, 261.63], melody: [523.25, 659.25, 698.46, 587.33] },
          { pad: [146.83, 220.0, 261.63], melody: [440.0, 523.25, 587.33, 523.25] },
          { pad: [116.54, 174.61, 233.08], melody: [466.16, 587.33, 698.46, 587.33] },
          { pad: [130.81, 196.0, 261.63], melody: [523.25, 587.33, 659.25, 523.25] },
        ],
        // Discípulos de Jesús: C major inspiring crystalline pads
        adventure_miracle: [
          { pad: [130.81, 261.63, 329.63], melody: [523.25, 659.25, 783.99, 1046.5] },
          { pad: [196.0, 246.94, 293.66], melody: [493.88, 587.33, 783.99, 659.25] },
          { pad: [220.0, 261.63, 329.63], melody: [523.25, 659.25, 880.0, 783.99] },
          { pad: [174.61, 220.0, 261.63], melody: [523.25, 659.25, 698.46, 587.33] },
        ],
      };

      const bars = palettes[this.didacticAmbientMode] || palettes.adventure_pastoral;
      const bar = bars[Math.floor(step / 4)];
      const inBar = step % 4;
      if (inBar === 0) {
        for (const freq of bar.pad) {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, time);
          g.gain.setValueAtTime(0.0001, time);
          g.gain.linearRampToValueAtTime(0.032, time + 0.4);
          g.gain.exponentialRampToValueAtTime(0.0001, time + 1.65);
          osc.connect(g);
          g.connect(dest);
          osc.start(time);
          osc.stop(time + 1.7);
        }
      }
      const melFreq = bar.melody[inBar];
      if (melFreq && (inBar === 0 || inBar === 2 || inBar === 3)) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = this.didacticAmbientMode === 'adventure_heroic' ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(melFreq, time);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.linearRampToValueAtTime(0.03, time + 0.025);
        g.gain.exponentialRampToValueAtTime(0.0001, time + 0.7);
        osc.connect(g);
        g.connect(dest);
        osc.start(time);
        osc.stop(time + 0.75);
      }
    }
  }

  private canPlayDidactic(key: string, cooldownMs: number): boolean {
    if (!this.prefs.didacticSfxEnabled || typeof window === 'undefined') return false;
    const now = Date.now();
    const prev = this.lastDidacticPlayedAt.get(key) || 0;
    if (now - prev < cooldownMs) return false;
    this.lastDidacticPlayedAt.set(key, now);
    return true;
  }

  private getDidacticSfxOutput(): { ctx: AudioContext; out: GainNode } | null {
    if (!this.prefs.didacticSfxEnabled || typeof window === 'undefined') return null;
    const ctx = this.ensureAudioGraph();
    if (!ctx || !this.didacticSfxGain) return null;
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
    this.applyGains();
    return { ctx, out: this.didacticSfxGain };
  }

  private playDidacticTone(
    freq: number,
    durationSec: number,
    type: OscillatorType = 'sine',
    volume = 0.08,
    delay = 0,
    endFreq?: number
  ): void {
    const outObj = this.getDidacticSfxOutput();
    if (!outObj) return;
    const { ctx, out } = outObj;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq && endFreq > 0) {
      osc.frequency.exponentialRampToValueAtTime(endFreq, start + durationSec);
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + durationSec);
    osc.connect(gain);
    gain.connect(out);
    osc.start(start);
    osc.stop(start + durationSec + 0.03);
  }

  /** Ruleta Bíblica: secuencia suave de clics desacelerando y toque final */
  public playWheelSpin(durationMs = 3100): void {
    if (!this.canPlayDidactic('wheel_spin', 1200)) return;
    const outObj = this.getDidacticSfxOutput();
    if (!outObj) return;
    const steps = 18;
    for (let i = 0; i < steps; i++) {
      const progress = i / (steps - 1);
      // Ease-out quadratic spacing so clicks decelerate naturally like pegs
      const tSec = ((progress * progress * 0.72 + progress * 0.28) * durationMs) / 1000;
      const pitch = 780 - progress * 240;
      this.playDidacticTone(pitch, 0.045, 'triangle', 0.065, tSec, pitch * 0.75);
    }
    this.playDidacticTone(659.25, 0.16, 'sine', 0.08, durationMs / 1000);
    this.playDidacticTone(880.0, 0.24, 'sine', 0.09, durationMs / 1000 + 0.08);
  }

  public playWheelStop(): void {
    if (!this.canPlayDidactic('wheel_stop', 350)) return;
    this.playDidacticTone(587.33, 0.14, 'triangle', 0.09, 0);
    this.playDidacticTone(880.0, 0.25, 'sine', 0.1, 0.07);
  }

  public playCategorySelect(): void {
    if (!this.canPlayDidactic('cat_select', 200)) return;
    this.playDidacticTone(523.25, 0.12, 'sine', 0.08, 0);
    this.playDidacticTone(659.25, 0.18, 'triangle', 0.08, 0.06);
  }

  /** Crucigramas Bíblicos */
  public playCrosswordWord(): void {
    if (!this.canPlayDidactic('cw_word', 250)) return;
    this.playDidacticTone(523.25, 0.13, 'sine', 0.08, 0);
    this.playDidacticTone(659.25, 0.15, 'sine', 0.08, 0.07);
  }

  public playCrosswordComplete(): void {
    if (!this.canPlayDidactic('cw_done', 500)) return;
    this.playDidacticTone(523.25, 0.18, 'triangle', 0.09, 0);
    this.playDidacticTone(659.25, 0.18, 'triangle', 0.09, 0.09);
    this.playDidacticTone(783.99, 0.22, 'triangle', 0.1, 0.18);
    this.playDidacticTone(1046.5, 0.34, 'sine', 0.1, 0.27);
  }

  public playDiscreetError(): void {
    if (!this.canPlayDidactic('discreet_err', 350)) return;
    this.playDidacticTone(246.94, 0.14, 'sine', 0.06, 0, 196.0);
  }

  /** Palabras Desordenadas */
  public playTileMove(): void {
    if (!this.canPlayDidactic('tile_move', 90)) return;
    this.playDidacticTone(740.0, 0.055, 'triangle', 0.055, 0, 620.0);
  }

  public playWordSolved(): void {
    if (!this.canPlayDidactic('word_solved', 400)) return;
    this.playDidacticTone(587.33, 0.14, 'triangle', 0.09, 0);
    this.playDidacticTone(739.99, 0.14, 'triangle', 0.09, 0.08);
    this.playDidacticTone(880.0, 0.28, 'sine', 0.1, 0.16);
  }

  /** Completa el Versículo */
  public playVerseSelect(): void {
    if (!this.canPlayDidactic('verse_sel', 160)) return;
    this.playDidacticTone(587.33, 0.1, 'sine', 0.07, 0);
  }

  public playVerseCorrect(): void {
    if (!this.canPlayDidactic('verse_ok', 400)) return;
    this.playDidacticTone(493.88, 0.16, 'sine', 0.08, 0);
    this.playDidacticTone(659.25, 0.18, 'sine', 0.09, 0.08);
    this.playDidacticTone(783.99, 0.28, 'triangle', 0.09, 0.17);
  }

  /** Rompecabezas Bíblicos */
  public playPuzzleSnap(): void {
    if (!this.canPlayDidactic('puzzle_snap', 110)) return;
    this.playDidacticTone(659.25, 0.07, 'sine', 0.065, 0, 880.0);
  }

  public playPuzzleComplete(): void {
    if (!this.canPlayDidactic('puzzle_done', 500)) return;
    this.playDidacticTone(523.25, 0.15, 'triangle', 0.09, 0);
    this.playDidacticTone(659.25, 0.15, 'triangle', 0.09, 0.08);
    this.playDidacticTone(783.99, 0.28, 'sine', 0.1, 0.16);
  }

  /** ¿Quién Soy? y Misterio Bíblico */
  public playClueReveal(): void {
    if (!this.canPlayDidactic('clue_rev', 300)) return;
    this.playDidacticTone(440.0, 0.16, 'sine', 0.07, 0);
    this.playDidacticTone(523.25, 0.22, 'triangle', 0.08, 0.09);
    this.playDidacticTone(659.25, 0.28, 'sine', 0.075, 0.18);
  }

  public playMysterySolved(): void {
    if (!this.canPlayDidactic('mys_solved', 450)) return;
    this.playDidacticTone(587.33, 0.14, 'sine', 0.09, 0);
    this.playDidacticTone(880.0, 0.18, 'triangle', 0.095, 0.08);
    this.playDidacticTone(1174.66, 0.34, 'sine', 0.09, 0.16);
  }

  /** Aprende con la Biblia */
  public playStudyNote(): void {
    if (!this.canPlayDidactic('study_note', 220)) return;
    this.playDidacticTone(392.0, 0.18, 'sine', 0.07, 0);
    this.playDidacticTone(493.88, 0.24, 'sine', 0.075, 0.09);
  }

  public playLessonComplete(): void {
    if (!this.canPlayDidactic('lesson_done', 450)) return;
    this.playDidacticTone(392.0, 0.2, 'sine', 0.08, 0);
    this.playDidacticTone(493.88, 0.22, 'sine', 0.08, 0.1);
    this.playDidacticTone(587.33, 0.26, 'sine', 0.085, 0.2);
    this.playDidacticTone(783.99, 0.36, 'triangle', 0.08, 0.3);
  }

  /** Programa del Sábado: avisos sonoros configurables para el cronómetro por actividad */
  public playProgramWarningBell(): void {
    this.playTone(659.25, 0.18, 'sine', 0.085, 0);
    this.playTone(880.0, 0.28, 'sine', 0.095, 0.11);
  }

  public playProgramTick(): void {
    this.playTone(987.77, 0.06, 'triangle', 0.055, 0);
  }

  public playProgramStageEnd(): void {
    this.playTone(523.25, 0.16, 'triangle', 0.1, 0);
    this.playTone(659.25, 0.18, 'triangle', 0.1, 0.09);
    this.playTone(783.99, 0.22, 'sine', 0.11, 0.18);
    this.playTone(1046.5, 0.45, 'sine', 0.12, 0.28);
  }

  /** Talentos Juveniles: apertura, transición de escenario, aplauso respetuoso y certificado */
  public playTalentCurtainOpen(): void {
    if (!this.canPlayDidactic('talent_open', 600)) return;
    this.playDidacticTone(392.0, 0.22, 'sine', 0.075, 0);
    this.playDidacticTone(493.88, 0.24, 'triangle', 0.075, 0.09);
    this.playDidacticTone(587.33, 0.26, 'sine', 0.085, 0.18);
    this.playDidacticTone(783.99, 0.42, 'triangle', 0.09, 0.28);
  }

  public playTalentSpotlightTransition(): void {
    if (!this.canPlayDidactic('talent_trans', 350)) return;
    this.playDidacticTone(523.25, 0.16, 'sine', 0.075, 0);
    this.playDidacticTone(659.25, 0.2, 'sine', 0.08, 0.08);
    this.playDidacticTone(783.99, 0.28, 'triangle', 0.08, 0.16);
  }

  public playTalentApplauseChime(): void {
    if (!this.canPlayDidactic('talent_applause', 300)) return;
    this.playDidacticTone(587.33, 0.14, 'triangle', 0.075, 0);
    this.playDidacticTone(739.99, 0.18, 'sine', 0.08, 0.06);
    this.playDidacticTone(880.0, 0.26, 'sine', 0.085, 0.12);
  }

  public playTalentCertificateAward(): void {
    if (!this.canPlayDidactic('talent_cert', 700)) return;
    this.playDidacticTone(523.25, 0.18, 'triangle', 0.085, 0);
    this.playDidacticTone(659.25, 0.2, 'triangle', 0.085, 0.09);
    this.playDidacticTone(783.99, 0.24, 'sine', 0.095, 0.18);
    this.playDidacticTone(1046.5, 0.45, 'sine', 0.1, 0.28);
  }

  /** Aventuras Bíblicas: transición de escena, decisión, desenlace fiel y reflexión */
  public playAdventureSceneTransition(): void {
    if (!this.canPlayDidactic('adv_scene', 350)) return;
    this.playDidacticTone(440.0, 0.18, 'sine', 0.075, 0);
    this.playDidacticTone(554.37, 0.2, 'triangle', 0.075, 0.08);
    this.playDidacticTone(659.25, 0.28, 'sine', 0.08, 0.16);
  }

  public playAdventureDecisionPrompt(): void {
    if (!this.canPlayDidactic('adv_prompt', 350)) return;
    this.playDidacticTone(523.25, 0.14, 'triangle', 0.08, 0);
    this.playDidacticTone(659.25, 0.16, 'sine', 0.085, 0.08);
    this.playDidacticTone(783.99, 0.24, 'sine', 0.085, 0.16);
  }

  public playAdventureFaithfulOutcome(): void {
    if (!this.canPlayDidactic('adv_faithful', 400)) return;
    this.playDidacticTone(523.25, 0.15, 'triangle', 0.085, 0);
    this.playDidacticTone(659.25, 0.18, 'triangle', 0.09, 0.08);
    this.playDidacticTone(783.99, 0.24, 'sine', 0.095, 0.16);
    this.playDidacticTone(1046.5, 0.36, 'sine', 0.095, 0.25);
  }

  public playAdventureReflectionEnd(): void {
    if (!this.canPlayDidactic('adv_reflection', 600)) return;
    this.playDidacticTone(392.0, 0.22, 'sine', 0.08, 0);
    this.playDidacticTone(493.88, 0.24, 'sine', 0.08, 0.1);
    this.playDidacticTone(587.33, 0.28, 'triangle', 0.085, 0.2);
    this.playDidacticTone(783.99, 0.45, 'sine', 0.095, 0.32);
  }

  /** Cabina de Sorpresas: sonido de misterio, pulso de cuenta regresiva y fanfarria de revelación */
  public playSurpriseMysterySuspense(): void {
    const sfx = this.getSfxOutput();
    if (!sfx) return;
    // Deep mysterious D-minor/suspended shimmer + ascending harp-like tension
    this.playTone(146.83, 1.35, 'sine', 0.11, 0); // D3
    this.playTone(220.0, 1.25, 'triangle', 0.08, 0.04); // A3
    this.playTone(329.63, 1.0, 'sine', 0.07, 0.14); // E4 (add9 mystery)
    this.playTone(349.23, 0.9, 'sine', 0.065, 0.26); // F4
    this.playTone(440.0, 0.8, 'triangle', 0.07, 0.42); // A4
    this.playTone(523.25, 0.65, 'sine', 0.075, 0.62); // C5
    this.playTone(587.33, 0.6, 'triangle', 0.085, 0.82); // D5
    this.playTone(659.25, 0.55, 'sine', 0.09, 1.02); // E5
  }

  public playSurpriseCountdownTick(step: number): void {
    const sfx = this.getSfxOutput();
    if (!sfx) return;
    const pitch = step === 3 ? 440 : step === 2 ? 523.25 : 659.25;
    this.playTone(pitch, 0.16, 'triangle', 0.095, 0);
    this.playTone(pitch * 1.5, 0.14, 'sine', 0.055, 0.02);
  }

  public playSurpriseReveal(): void {
    const sfx = this.getSfxOutput();
    if (!sfx) return;
    // Bright celebratory opening burst (G major / C major lift)
    this.playTone(523.25, 0.16, 'triangle', 0.11, 0); // C5
    this.playTone(659.25, 0.16, 'triangle', 0.11, 0.06); // E5
    this.playTone(783.99, 0.2, 'triangle', 0.12, 0.12); // G5
    this.playTone(1046.5, 0.48, 'sine', 0.14, 0.19); // C6
    this.playTone(783.99, 0.42, 'sine', 0.08, 0.19); // G5 sustain
    this.playTone(1318.5, 0.36, 'sine', 0.075, 0.26); // E6 shimmer
  }
}

export const soundFX = new SoundManager();

// ---------------- ETAPA 10: INDEPENDENT MODULE SOUND CHANNELS ----------------
// Additive audio controller for each youth-society module with independent volume & mute.
// Does NOT modify or replace any existing SoundManager preferences or cues.

export type ModuleAudioChannelId =
  | 'programa_sabado'
  | 'juegos_biblicos'
  | 'retos_sabado'
  | 'ruleta_sabado'
  | 'talentos_juveniles'
  | 'aventuras_biblicas'
  | 'misiones_juveniles'
  | 'campeonatos_juveniles'
  | 'cabina_sorpresas'
  | 'nuestras_memorias';

export interface ModuleChannelAudioPref {
  muted: boolean;
  volume: number; // 0 to 1
}

export type ModuleAudioPrefsMap = Record<
  ModuleAudioChannelId,
  ModuleChannelAudioPref
>;

const MODULE_AUDIO_STORAGE_KEY = 'dtqd_module_audio_prefs_v1';

const DEFAULT_MODULE_AUDIO_PREFS: ModuleAudioPrefsMap = {
  programa_sabado: { muted: false, volume: 0.8 },
  juegos_biblicos: { muted: false, volume: 0.85 },
  retos_sabado: { muted: false, volume: 0.85 },
  ruleta_sabado: { muted: false, volume: 0.85 },
  talentos_juveniles: { muted: false, volume: 0.8 },
  aventuras_biblicas: { muted: false, volume: 0.8 },
  misiones_juveniles: { muted: false, volume: 0.75 },
  campeonatos_juveniles: { muted: false, volume: 0.85 },
  cabina_sorpresas: { muted: false, volume: 0.9 },
  nuestras_memorias: { muted: false, volume: 0.7 },
};

function loadModuleAudioPrefs(): ModuleAudioPrefsMap {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_MODULE_AUDIO_PREFS };
  }
  try {
    const raw = localStorage.getItem(MODULE_AUDIO_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MODULE_AUDIO_PREFS };
    const parsed = JSON.parse(raw) as Partial<ModuleAudioPrefsMap>;
    const out = { ...DEFAULT_MODULE_AUDIO_PREFS };
    (Object.keys(DEFAULT_MODULE_AUDIO_PREFS) as ModuleAudioChannelId[]).forEach(
      (k) => {
        const entry = parsed?.[k];
        if (entry && typeof entry === 'object') {
          out[k] = {
            muted: Boolean(entry.muted),
            volume:
              typeof entry.volume === 'number'
                ? clamp01(entry.volume)
                : DEFAULT_MODULE_AUDIO_PREFS[k].volume,
          };
        }
      }
    );
    return out;
  } catch {
    return { ...DEFAULT_MODULE_AUDIO_PREFS };
  }
}

class ModuleSoundController {
  private prefs: ModuleAudioPrefsMap = loadModuleAudioPrefs();
  private globalMuted = false;
  private ctx: AudioContext | null = null;
  private listeners = new Set<() => void>();

  private ensureCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          MODULE_AUDIO_STORAGE_KEY,
          JSON.stringify(this.prefs)
        );
      }
    } catch {
      // ignore storage errors
    }
    for (const l of this.listeners) l();
  }

  public getPrefs(): ModuleAudioPrefsMap {
    return { ...this.prefs };
  }

  public isGlobalMuted(): boolean {
    return this.globalMuted;
  }

  public setGlobalMuted(muted: boolean): void {
    this.globalMuted = muted;
    this.notify();
  }

  public setModulePref(
    id: ModuleAudioChannelId,
    patch: Partial<ModuleChannelAudioPref>
  ): void {
    const cur = this.prefs[id] || { muted: false, volume: 0.8 };
    this.prefs = {
      ...this.prefs,
      [id]: {
        muted: typeof patch.muted === 'boolean' ? patch.muted : cur.muted,
        volume:
          typeof patch.volume === 'number' ? clamp01(patch.volume) : cur.volume,
      },
    };
    this.notify();
  }

  private scheduleNote(
    freq: number,
    dur: number,
    type: OscillatorType,
    volScale: number,
    delaySec: number,
    moduleVol: number,
    slideTo?: number
  ): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    }
    const peak = Math.max(0.001, volScale * moduleVol);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  public playModuleCue(
    moduleId: ModuleAudioChannelId,
    action: 'start' | 'pause' | 'next' | 'surprise' | 'finish' | 'warning' = 'start'
  ): void {
    if (this.globalMuted) return;
    const pref = this.prefs[moduleId];
    if (!pref || pref.muted || pref.volume <= 0.01) return;
    const v = pref.volume;

    if (action === 'pause') {
      this.scheduleNote(440, 0.14, 'sine', 0.08, 0, v, 349.23);
      return;
    }
    if (action === 'warning') {
      this.scheduleNote(659.25, 0.18, 'sine', 0.1, 0, v);
      this.scheduleNote(880.0, 0.28, 'sine', 0.11, 0.12, v);
      return;
    }

    switch (moduleId) {
      case 'programa_sabado':
        this.scheduleNote(523.25, 0.18, 'sine', 0.09, 0, v);
        this.scheduleNote(659.25, 0.22, 'sine', 0.1, 0.09, v);
        this.scheduleNote(783.99, 0.34, 'triangle', 0.1, 0.18, v);
        break;
      case 'juegos_biblicos':
        this.scheduleNote(587.33, 0.12, 'triangle', 0.1, 0, v);
        this.scheduleNote(739.99, 0.12, 'triangle', 0.1, 0.07, v);
        this.scheduleNote(880.0, 0.24, 'triangle', 0.11, 0.14, v);
        break;
      case 'retos_sabado':
        this.scheduleNote(493.88, 0.12, 'triangle', 0.1, 0, v);
        this.scheduleNote(659.25, 0.14, 'triangle', 0.11, 0.08, v);
        this.scheduleNote(987.77, 0.26, 'sine', 0.11, 0.16, v);
        break;
      case 'ruleta_sabado':
        [440, 523.25, 659.25, 783.99, 987.77].forEach((f, idx) =>
          this.scheduleNote(f, 0.08, 'triangle', 0.09, idx * 0.045, v)
        );
        break;
      case 'talentos_juveniles':
        this.scheduleNote(392.0, 0.22, 'sine', 0.09, 0, v);
        this.scheduleNote(493.88, 0.24, 'sine', 0.09, 0.09, v);
        this.scheduleNote(783.99, 0.38, 'triangle', 0.1, 0.18, v);
        break;
      case 'aventuras_biblicas':
        this.scheduleNote(440.0, 0.2, 'sine', 0.085, 0, v);
        this.scheduleNote(554.37, 0.22, 'triangle', 0.09, 0.09, v);
        this.scheduleNote(659.25, 0.34, 'sine', 0.095, 0.19, v);
        break;
      case 'misiones_juveniles':
        this.scheduleNote(523.25, 0.2, 'sine', 0.085, 0, v);
        this.scheduleNote(659.25, 0.24, 'sine', 0.09, 0.1, v);
        this.scheduleNote(1046.5, 0.36, 'sine', 0.09, 0.2, v);
        break;
      case 'campeonatos_juveniles':
        this.scheduleNote(523.25, 0.14, 'triangle', 0.11, 0, v);
        this.scheduleNote(659.25, 0.14, 'triangle', 0.11, 0.08, v);
        this.scheduleNote(783.99, 0.16, 'triangle', 0.12, 0.16, v);
        this.scheduleNote(1046.5, 0.42, 'sine', 0.13, 0.25, v);
        break;
      case 'cabina_sorpresas':
        this.scheduleNote(293.66, 0.3, 'sine', 0.1, 0, v);
        this.scheduleNote(440.0, 0.25, 'triangle', 0.095, 0.12, v);
        this.scheduleNote(659.25, 0.25, 'sine', 0.1, 0.24, v);
        this.scheduleNote(1046.5, 0.45, 'triangle', 0.12, 0.38, v);
        break;
      case 'nuestras_memorias':
        this.scheduleNote(440.0, 0.24, 'sine', 0.08, 0, v);
        this.scheduleNote(587.33, 0.26, 'sine', 0.085, 0.11, v);
        this.scheduleNote(880.0, 0.4, 'sine', 0.09, 0.22, v);
        break;
    }
  }
}

export const moduleSoundController = new ModuleSoundController();

// ---------------- MI SOCIEDAD DE JÓVENES: SONIDOS Y AMBIENTACIÓN ----------------
// Isolated Web Audio synthesizer for automatic Saturday programs (does NOT touch soundFX).

export type YouthSocietyAudioMood =
  | 'bienvenida'
  | 'transicion'
  | 'reto'
  | 'ruleta'
  | 'misterio'
  | 'competencia'
  | 'presentacion'
  | 'cuenta_regresiva'
  | 'reconocimiento'
  | 'finalizacion';

export interface YouthSocietyAudioPrefs {
  muted: boolean;
  effectsEnabled: boolean;
  volume: number; // 0..1
}

const YS_AUDIO_STORAGE_KEY = 'dtqd_youth_society_audio_v1';

function loadYsAudioPrefs(): YouthSocietyAudioPrefs {
  const defaults: YouthSocietyAudioPrefs = {
    muted: false,
    effectsEnabled: true,
    volume: 0.8,
  };
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(YS_AUDIO_STORAGE_KEY);
    if (!raw) return defaults;
    const p = JSON.parse(raw) as Partial<YouthSocietyAudioPrefs>;
    return {
      muted: Boolean(p.muted),
      effectsEnabled: p.effectsEnabled !== false,
      volume: typeof p.volume === 'number' ? clamp01(p.volume) : defaults.volume,
    };
  } catch {
    return defaults;
  }
}

class YouthSocietyAudioController {
  private prefs: YouthSocietyAudioPrefs = loadYsAudioPrefs();
  private ctx: AudioContext | null = null;
  private listeners = new Set<() => void>();

  private ensureCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify(): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(YS_AUDIO_STORAGE_KEY, JSON.stringify(this.prefs));
      }
    } catch {
      // ignore storage quota errors
    }
    for (const l of this.listeners) l();
  }

  public getPrefs(): YouthSocietyAudioPrefs {
    return { ...this.prefs };
  }

  public updatePrefs(patch: Partial<YouthSocietyAudioPrefs>): void {
    this.prefs = {
      muted: typeof patch.muted === 'boolean' ? patch.muted : this.prefs.muted,
      effectsEnabled:
        typeof patch.effectsEnabled === 'boolean'
          ? patch.effectsEnabled
          : this.prefs.effectsEnabled,
      volume:
        typeof patch.volume === 'number'
          ? clamp01(patch.volume)
          : this.prefs.volume,
    };
    this.notify();
  }

  private note(
    freq: number,
    dur: number,
    type: OscillatorType,
    gainBase: number,
    delay: number,
    slideTo?: number
  ): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    }
    const peak = Math.max(0.001, gainBase * this.prefs.volume);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.04);
  }

  public playMood(mood: YouthSocietyAudioMood): void {
    if (this.prefs.muted || !this.prefs.effectsEnabled || this.prefs.volume <= 0.01) {
      return;
    }
    switch (mood) {
      case 'bienvenida':
        this.note(523.25, 0.22, 'sine', 0.1, 0);
        this.note(659.25, 0.24, 'sine', 0.1, 0.1);
        this.note(783.99, 0.36, 'triangle', 0.11, 0.2);
        break;
      case 'transicion':
        this.note(440, 0.18, 'sine', 0.08, 0, 587.33);
        this.note(659.25, 0.26, 'sine', 0.09, 0.14);
        break;
      case 'reto':
        this.note(493.88, 0.12, 'triangle', 0.11, 0);
        this.note(659.25, 0.12, 'triangle', 0.11, 0.08);
        this.note(987.77, 0.28, 'triangle', 0.12, 0.16);
        break;
      case 'ruleta':
        [440, 493.88, 587.33, 659.25, 783.99, 880].forEach((f, idx) =>
          this.note(f, 0.07, 'triangle', 0.09, idx * 0.045)
        );
        break;
      case 'misterio':
        this.note(277.18, 0.32, 'sine', 0.095, 0);
        this.note(329.63, 0.3, 'sine', 0.09, 0.16);
        this.note(415.3, 0.38, 'triangle', 0.095, 0.32);
        break;
      case 'competencia':
        this.note(523.25, 0.14, 'triangle', 0.11, 0);
        this.note(659.25, 0.14, 'triangle', 0.11, 0.09);
        this.note(783.99, 0.16, 'triangle', 0.12, 0.18);
        this.note(1046.5, 0.34, 'sine', 0.12, 0.27);
        break;
      case 'presentacion':
        this.note(392.0, 0.24, 'sine', 0.09, 0);
        this.note(493.88, 0.24, 'sine', 0.095, 0.11);
        this.note(783.99, 0.4, 'sine', 0.1, 0.22);
        break;
      case 'cuenta_regresiva':
        this.note(880, 0.09, 'sine', 0.1, 0);
        this.note(880, 0.09, 'sine', 0.1, 0.18);
        break;
      case 'reconocimiento':
        this.note(587.33, 0.16, 'triangle', 0.11, 0);
        this.note(739.99, 0.16, 'triangle', 0.11, 0.09);
        this.note(880.0, 0.22, 'triangle', 0.12, 0.18);
        this.note(1174.66, 0.42, 'sine', 0.12, 0.28);
        break;
      case 'finalizacion':
        this.note(523.25, 0.26, 'sine', 0.095, 0);
        this.note(659.25, 0.28, 'sine', 0.095, 0.12);
        this.note(783.99, 0.3, 'sine', 0.1, 0.24);
        this.note(1046.5, 0.52, 'sine', 0.11, 0.38);
        break;
    }
  }
}

export const youthSocietyAudio = new YouthSocietyAudioController();


