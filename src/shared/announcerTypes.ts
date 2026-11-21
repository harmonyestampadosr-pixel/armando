import type { LeaderboardEntry } from './types';

export type AnnouncerStyle =
  | 'misterioso'
  | 'competitivo'
  | 'divertido'
  | 'solemne'
  | 'juvenil';

export type SuspenseLevel = 'bajo' | 'medio' | 'alto' | 'cinematografico';

export type AnnouncerVoiceName = 'Zephyr' | 'Kore';

export const FEMALE_ANNOUNCER_VOICES: readonly AnnouncerVoiceName[] = [
  'Zephyr',
  'Kore',
] as const;

export const DEFAULT_FEMALE_VOICE: AnnouncerVoiceName = 'Zephyr';

export type AnnouncerAudioTarget = 'auto' | 'projector' | 'presenter' | 'both';

export type AnnouncerStage =
  | 'idle'
  | 'intro_suspense'
  | 'third_place'
  | 'second_place'
  | 'first_place'
  | 'last_place'
  | 'complete';

export type AnnouncerSfxCueKey =
  | 'suspenseMusic'
  | 'drumroll'
  | 'winnerFanfare'
  | 'topThreeSting'
  | 'lastPlaceSting'
  | 'closingMusic';

export interface AnnouncerSfxToggles {
  suspenseMusic: boolean;
  drumroll: boolean;
  winnerFanfare: boolean;
  topThreeSting: boolean;
  lastPlaceSting: boolean;
  closingMusic: boolean;
}

export interface AnnouncerConfig {
  enabled: boolean;
  autoAnnounce: boolean;
  progressiveReveal: boolean;
  mutedVoice: boolean;
  musicEnabled: boolean;
  voiceVolume: number; // 0..1
  voiceSpeed: number; // 0.85..1.20
  musicVolume: number; // 0..1
  sfxVolume: number; // 0..1
  sfxToggles: AnnouncerSfxToggles;
  style: AnnouncerStyle;
  suspenseLevel: SuspenseLevel;
  voiceName: AnnouncerVoiceName;
  audioTarget: AnnouncerAudioTarget;
  pronunciationOverrides: Record<string, string>;
}

export interface AnnouncerProviderCapabilities {
  provider: string;
  voiceGender: 'female_only';
  locale: string;
  controls: {
    volume: { supported: true; detail: string };
    speed: { supported: true; detail: string };
    pauses: { supported: true; detail: string };
    expressiveness: { supported: true; detail: string };
    numericPitch: { supported: false; detail: string };
  };
}

export const GEMINI_TTS_CAPABILITIES: AnnouncerProviderCapabilities = {
  provider: 'Gemini TTS (@google/genai)',
  voiceGender: 'female_only',
  locale: 'es-419 (Español latinoamericano)',
  controls: {
    volume: {
      supported: true,
      detail: 'Control real de ganancia de salida (0% a 100%).',
    },
    speed: {
      supported: true,
      detail:
        'Ajuste real de velocidad de reproducción (0.85x a 1.20x) con preservación de tono e indicación de ritmo.',
    },
    pauses: {
      supported: true,
      detail:
        'Pausas dramáticas mediante puntuación prosódica (...) y tiempos de espera configurables antes de cada anuncio.',
    },
    expressiveness: {
      supported: true,
      detail:
        'Dirección vocal interpretativa real mediante speechMetadata.style (frialdad controlada, ceremonialidad e intensidad).',
    },
    numericPitch: {
      supported: false,
      detail:
        'Gemini TTS no expone control numérico independiente de tono/pitch (Hz); el timbre se determina por la voz femenina elegida (Zephyr / Kore) y el estilo expresivo.',
    },
  },
};

export interface AnnouncerRoomState {
  config: AnnouncerConfig;
  stage: AnnouncerStage;
  unlockedStages: AnnouncerStage[];
  activeCueIndex: number;
  highlightedParticipantIds: string[];
  ceremonyRunId: string | null;
  ceremonyVariationSeed: number;
  triggeredForFinishedAt: number | null;
  updatedAt: number;
}

export type AnnouncerCuePreSfx =
  | 'suspense_intro'
  | 'drumroll'
  | 'top3_sting'
  | 'winner_fanfare'
  | 'last_place_sting'
  | 'closing';

export interface AnnouncerCue {
  id: string;
  stage: AnnouncerStage;
  title: string;
  rankLabel: string;
  spokenText: string;
  displayText: string;
  highlightedParticipantIds: string[];
  highlightedEntries: LeaderboardEntry[];
  isTie: boolean;
  preSfx?: AnnouncerCuePreSfx;
  postSfx?: AnnouncerCuePreSfx;
  pauseBeforeMs: number;
}

export interface AnnouncerAnnouncementPlan {
  ceremonyRunId: string;
  participantCount: number;
  hasAnyTie: boolean;
  cues: AnnouncerCue[];
}

export function normalizeAnnouncerVoiceName(
  voice?: unknown
): AnnouncerVoiceName {
  if (voice === 'Kore') return 'Kore';
  return DEFAULT_FEMALE_VOICE;
}

export function clampAnnouncerSpeed(speed?: unknown, fallback = 0.95): number {
  const n = Number(speed);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(Math.max(0.85, Math.min(1.2, n)) * 100) / 100;
}

export const ANNOUNCER_STYLE_META: Record<
  AnnouncerStyle,
  { label: string; description: string; defaultVoice: AnnouncerVoiceName }
> = {
  misterioso: {
    label: 'Misterioso Ceremonial (Predeterminado)',
    description:
      'Voz femenina fría, controlada y ceremonial con pausas dramáticas y suspenso de alto impacto.',
    defaultVoice: 'Zephyr',
  },
  solemne: {
    label: 'Solemne',
    description:
      'Voz femenina serena, formal y ceremonial para premiaciones especiales.',
    defaultVoice: 'Zephyr',
  },
  competitivo: {
    label: 'Competitivo',
    description:
      'Voz femenina firme, intensa y precisa para finales de campeonato.',
    defaultVoice: 'Zephyr',
  },
  juvenil: {
    label: 'Juvenil',
    description:
      'Voz femenina clara, fresca y expresiva para Sociedad de Jóvenes.',
    defaultVoice: 'Zephyr',
  },
  divertido: {
    label: 'Dinámico',
    description:
      'Voz femenina ágil, cercana y cálida manteniendo claridad y elegancia.',
    defaultVoice: 'Zephyr',
  },
};

export const ANNOUNCER_SUSPENSE_META: Record<
  SuspenseLevel,
  { label: string; preDelayMs: number }
> = {
  bajo: { label: 'Suave', preDelayMs: 350 },
  medio: { label: 'Equilibrado', preDelayMs: 700 },
  alto: { label: 'Alto (Recomendado)', preDelayMs: 1150 },
  cinematografico: { label: 'Cinematográfico', preDelayMs: 1650 },
};

export const ANNOUNCER_VOICE_META: Record<
  AnnouncerVoiceName,
  { label: string; tone: string }
> = {
  Zephyr: {
    label: 'Sofía · Femenina Clara y Juvenil (Predeterminada)',
    tone: 'Voz femenina clara, ligeramente aguda y juvenil; precisa, fría y ceremonial en español latinoamericano.',
  },
  Kore: {
    label: 'Valeria · Femenina Firme y Serena',
    tone: 'Voz femenina clara y firme con autoridad serena y dicción ceremonial.',
  },
};

export function createDefaultAnnouncerConfig(): AnnouncerConfig {
  return {
    enabled: true,
    autoAnnounce: true,
    progressiveReveal: true,
    mutedVoice: false,
    musicEnabled: true,
    voiceVolume: 0.95,
    voiceSpeed: 0.95,
    musicVolume: 0.42,
    sfxVolume: 0.78,
    sfxToggles: {
      suspenseMusic: true,
      drumroll: true,
      winnerFanfare: true,
      topThreeSting: true,
      lastPlaceSting: true,
      closingMusic: true,
    },
    style: 'misterioso',
    suspenseLevel: 'alto',
    voiceName: DEFAULT_FEMALE_VOICE,
    audioTarget: 'auto',
    pronunciationOverrides: {},
  };
}

export function createInitialAnnouncerRoomState(
  partial?: Partial<AnnouncerConfig>
): AnnouncerRoomState {
  const defaults = createDefaultAnnouncerConfig();
  return {
    config: {
      ...defaults,
      ...(partial || {}),
      voiceName: normalizeAnnouncerVoiceName(partial?.voiceName),
      voiceSpeed: clampAnnouncerSpeed(partial?.voiceSpeed, defaults.voiceSpeed),
      sfxToggles: {
        ...defaults.sfxToggles,
        ...(partial?.sfxToggles || {}),
      },
      pronunciationOverrides: {
        ...(partial?.pronunciationOverrides || {}),
      },
    },
    stage: 'idle',
    unlockedStages: [],
    activeCueIndex: -1,
    highlightedParticipantIds: [],
    ceremonyRunId: null,
    ceremonyVariationSeed: Math.floor(Math.random() * 10000),
    triggeredForFinishedAt: null,
    updatedAt: Date.now(),
  };
}
