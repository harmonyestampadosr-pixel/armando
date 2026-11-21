import crypto from 'crypto';
import type express from 'express';
import { GoogleGenAI } from '@google/genai';
import {
  buildGeminiStyleInstruction,
} from './src/shared/announcerEngine.js';
import {
  ANNOUNCER_STYLE_META,
  ANNOUNCER_VOICE_META,
  DEFAULT_FEMALE_VOICE,
  FEMALE_ANNOUNCER_VOICES,
  GEMINI_TTS_CAPABILITIES,
  clampAnnouncerSpeed,
  createDefaultAnnouncerConfig,
  createInitialAnnouncerRoomState,
  normalizeAnnouncerVoiceName,
  type AnnouncerAudioTarget,
  type AnnouncerConfig,
  type AnnouncerRoomState,
  type AnnouncerStage,
  type AnnouncerStyle,
  type AnnouncerVoiceName,
  type SuspenseLevel,
} from './src/shared/announcerTypes.js';
import type { ServerStoredGame } from './server-expansion.js';

const PRIMARY_TTS_MODEL = 'gemini-3.8-flash-lite-tts';
const SECONDARY_TTS_MODEL = 'gemini-3.8-flash-tts';
const TTS_TIMEOUT_MS = 25_000;
const MAX_CACHE_ENTRIES = 80;
const CACHE_VERSION = 'v2-female';

interface CachedWavEntry {
  wavBase64: string;
  byteLength: number;
  durationMs: number;
  modelUsed: string;
  voiceUsed: AnnouncerVoiceName;
  createdAt: number;
}

const ttsCache = new Map<string, CachedWavEntry>();

const VALID_STYLES = new Set<AnnouncerStyle>([
  'misterioso',
  'competitivo',
  'divertido',
  'solemne',
  'juvenil',
]);

const VALID_SUSPENSE = new Set<SuspenseLevel>([
  'bajo',
  'medio',
  'alto',
  'cinematografico',
]);

const VALID_VOICES = new Set<AnnouncerVoiceName>(FEMALE_ANNOUNCER_VOICES);

const VALID_AUDIO_TARGETS = new Set<AnnouncerAudioTarget>([
  'auto',
  'projector',
  'presenter',
  'both',
]);

const VALID_STAGES = new Set<AnnouncerStage>([
  'idle',
  'intro_suspense',
  'third_place',
  'second_place',
  'first_place',
  'last_place',
  'complete',
]);

function getConfiguredApiKey(): string | null {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key || key === 'MY_GEMINI_API_KEY') return null;
  return key;
}

function createTtsClient(): GoogleGenAI | null {
  const key = getConfiguredApiKey();
  if (!key) return null;
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function clamp01(n: unknown, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(1, v));
}

function cacheSet(key: string, val: CachedWavEntry): void {
  if (ttsCache.has(key)) {
    ttsCache.delete(key);
  } else if (ttsCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = ttsCache.keys().next().value;
    if (oldest) ttsCache.delete(oldest);
  }
  ttsCache.set(key, val);
}

export function classifyTtsError(err: unknown): {
  status: number;
  category: 'AUTH' | 'PERMISSION' | 'QUOTA' | 'TIMEOUT' | 'UNAVAILABLE' | 'INTERNAL';
  message: string;
  retryable: boolean;
} {
  const raw =
    err instanceof Error ? err.message : typeof err === 'string' ? err : String(err);
  const lower = raw.toLowerCase();

  if (
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('aborted') ||
    lower.includes('abort')
  ) {
    return {
      status: 504,
      category: 'TIMEOUT',
      message:
        'El servicio de voz TTS tardó demasiado en responder. Inténtalo de nuevo en unos segundos.',
      retryable: true,
    };
  }

  if (lower.includes('401') || lower.includes('api key not valid') || lower.includes('unauthenticated')) {
    return {
      status: 401,
      category: 'AUTH',
      message:
        'La credencial GEMINI_API_KEY del servidor no es válida o falta autorización para TTS.',
      retryable: false,
    };
  }

  if (lower.includes('403') || lower.includes('permission') || lower.includes('forbidden')) {
    return {
      status: 403,
      category: 'PERMISSION',
      message:
        'La cuenta/clave configurada no tiene permisos para usar el modelo de síntesis de voz Gemini TTS.',
      retryable: false,
    };
  }

  if (
    lower.includes('429') ||
    lower.includes('quota') ||
    lower.includes('resource_exhausted') ||
    lower.includes('rate limit')
  ) {
    return {
      status: 429,
      category: 'QUOTA',
      message:
        'Se alcanzó temporalmente el límite o cuota del servicio de voz Gemini TTS. Espera unos segundos e intenta de nuevo.',
      retryable: true,
    };
  }

  if (
    lower.includes('503') ||
    lower.includes('unavailable') ||
    lower.includes('overloaded') ||
    lower.includes('high demand')
  ) {
    return {
      status: 503,
      category: 'UNAVAILABLE',
      message:
        'El servicio de síntesis de voz Gemini TTS está saturado temporalmente. Intenta de nuevo en unos instantes.',
      retryable: true,
    };
  }

  return {
    status: 500,
    category: 'INTERNAL',
    message: `No se pudo generar el audio de voz con Gemini TTS (${raw.slice(0, 140)}).`,
    retryable: true,
  };
}

function isValidWavBuffer(buf: Buffer): boolean {
  return (
    buf.length > 44 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WAVE'
  );
}

async function generateGeminiSpeechWav(options: {
  text: string;
  style: AnnouncerStyle;
  suspenseLevel: SuspenseLevel;
  voiceName: AnnouncerVoiceName;
  bypassCache?: boolean;
}): Promise<CachedWavEntry & { cached: boolean; latencyMs: number }> {
  const { text, style, suspenseLevel, voiceName, bypassCache } = options;
  const cacheKey = `${CACHE_VERSION}::${PRIMARY_TTS_MODEL}::${voiceName}::${style}::${suspenseLevel}::${text}`;

  if (!bypassCache) {
    const existing = ttsCache.get(cacheKey);
    if (existing) {
      return { ...existing, cached: true, latencyMs: 1 };
    }
  }

  const ai = createTtsClient();
  if (!ai) {
    const err = new Error('GEMINI_API_KEY no configurada en el servidor');
    (err as Error & { statusCode?: number }).statusCode = 503;
    throw err;
  }

  const styleInstruction = buildGeminiStyleInstruction(style, suspenseLevel);
  const startedAt = Date.now();
  const modelsToTry = [PRIMARY_TTS_MODEL, SECONDARY_TTS_MODEL];
  let lastError: unknown = null;

  for (const model of modelsToTry) {
    let timeoutHandle: NodeJS.Timeout | null = null;
    try {
      const apiPromise = ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text,
                speechMetadata: {
                  style: styleInstruction,
                },
              } as Record<string, unknown>,
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
          },
        },
      });

      const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error('Gemini TTS request timed out'));
        }, TTS_TIMEOUT_MS);
      });

      const response = await Promise.race([apiPromise, timeoutPromise]);
      if (timeoutHandle) clearTimeout(timeoutHandle);

      const parts = response.candidates?.[0]?.content?.parts || [];
      let base64Audio: string | undefined;
      for (const part of parts) {
        if (part.inlineData?.data) {
          base64Audio = part.inlineData.data;
          break;
        }
      }

      if (!base64Audio) {
        throw new Error(`El modelo ${model} no devolvió datos de audio inlineData.`);
      }

      const wavBuffer = Buffer.from(base64Audio, 'base64');
      if (!isValidWavBuffer(wavBuffer)) {
        throw new Error(
          `El audio devuelto por ${model} no posee cabecera WAV RIFF válida.`
        );
      }

      const byteRate =
        wavBuffer.length >= 32 ? wavBuffer.readUInt32LE(28) || 48_000 : 48_000;
      const pcmBytes = Math.max(0, wavBuffer.length - 44);
      const durationMs = Math.max(
        450,
        Math.round((pcmBytes / Math.max(8_000, byteRate)) * 1000)
      );

      const entry: CachedWavEntry = {
        wavBase64: base64Audio,
        byteLength: wavBuffer.length,
        durationMs,
        modelUsed: model,
        voiceUsed: voiceName,
        createdAt: Date.now(),
      };
      cacheSet(cacheKey, entry);

      return {
        ...entry,
        cached: false,
        latencyMs: Date.now() - startedAt,
      };
    } catch (err) {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      lastError = err;
      const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      const isTransientRateOrLoad =
        msg.includes('429') ||
        msg.includes('quota') ||
        msg.includes('resource_exhausted') ||
        msg.includes('503') ||
        msg.includes('unavailable') ||
        msg.includes('overloaded');
      const isMissingModel =
        msg.includes('not found') || msg.includes('404') || msg.includes('unsupported');

      if (model === PRIMARY_TTS_MODEL && (isMissingModel || isTransientRateOrLoad)) {
        if (isTransientRateOrLoad) {
          await new Promise((r) => setTimeout(r, 800));
        }
        continue;
      }

      throw err;
    }
  }

  throw lastError || new Error('Fallo desconocido al generar audio TTS');
}

export function ensureGameAnnouncerState(game: ServerStoredGame): AnnouncerRoomState {
  if (!game.announcerInternal) {
    game.announcerInternal = createInitialAnnouncerRoomState();
  } else {
    game.announcerInternal.config.voiceName = normalizeAnnouncerVoiceName(
      game.announcerInternal.config.voiceName
    );
    game.announcerInternal.config.voiceSpeed = clampAnnouncerSpeed(
      game.announcerInternal.config.voiceSpeed,
      0.95
    );
  }
  return game.announcerInternal;
}

export function resetGameAnnouncerCeremony(game: ServerStoredGame): void {
  const existing = ensureGameAnnouncerState(game);
  existing.stage = 'idle';
  existing.unlockedStages = [];
  existing.activeCueIndex = -1;
  existing.highlightedParticipantIds = [];
  existing.ceremonyRunId = null;
  existing.triggeredForFinishedAt = null;
  existing.updatedAt = Date.now();
}

export function sanitizeAnnouncerConfigPatch(
  current: AnnouncerConfig,
  patch: Record<string, unknown>
): AnnouncerConfig {
  const next: AnnouncerConfig = {
    ...current,
    sfxToggles: { ...current.sfxToggles },
    pronunciationOverrides: { ...current.pronunciationOverrides },
  };

  if (typeof patch.enabled === 'boolean') next.enabled = patch.enabled;
  if (typeof patch.autoAnnounce === 'boolean') next.autoAnnounce = patch.autoAnnounce;
  if (typeof patch.progressiveReveal === 'boolean') {
    next.progressiveReveal = patch.progressiveReveal;
  }
  if (typeof patch.mutedVoice === 'boolean') next.mutedVoice = patch.mutedVoice;
  if (typeof patch.musicEnabled === 'boolean') next.musicEnabled = patch.musicEnabled;

  next.voiceVolume = clamp01(patch.voiceVolume, current.voiceVolume);
  next.voiceSpeed = clampAnnouncerSpeed(patch.voiceSpeed, current.voiceSpeed);
  next.musicVolume = clamp01(patch.musicVolume, current.musicVolume);
  next.sfxVolume = clamp01(patch.sfxVolume, current.sfxVolume);

  if (typeof patch.style === 'string' && VALID_STYLES.has(patch.style as AnnouncerStyle)) {
    next.style = patch.style as AnnouncerStyle;
  }
  if (
    typeof patch.suspenseLevel === 'string' &&
    VALID_SUSPENSE.has(patch.suspenseLevel as SuspenseLevel)
  ) {
    next.suspenseLevel = patch.suspenseLevel as SuspenseLevel;
  }
  if (typeof patch.voiceName === 'string') {
    next.voiceName = normalizeAnnouncerVoiceName(patch.voiceName);
  } else {
    next.voiceName = normalizeAnnouncerVoiceName(next.voiceName);
  }
  if (
    typeof patch.audioTarget === 'string' &&
    VALID_AUDIO_TARGETS.has(patch.audioTarget as AnnouncerAudioTarget)
  ) {
    next.audioTarget = patch.audioTarget as AnnouncerAudioTarget;
  }

  if (patch.sfxToggles && typeof patch.sfxToggles === 'object') {
    const rawToggles = patch.sfxToggles as Record<string, unknown>;
    const keys: Array<keyof AnnouncerConfig['sfxToggles']> = [
      'suspenseMusic',
      'drumroll',
      'winnerFanfare',
      'topThreeSting',
      'lastPlaceSting',
      'closingMusic',
    ];
    for (const k of keys) {
      if (typeof rawToggles[k] === 'boolean') {
        next.sfxToggles[k] = rawToggles[k] as boolean;
      }
    }
  }

  if (
    patch.pronunciationOverrides &&
    typeof patch.pronunciationOverrides === 'object'
  ) {
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(
      patch.pronunciationOverrides as Record<string, unknown>
    )) {
      const cleanKey = String(k || '').trim().slice(0, 80);
      const cleanVal = String(v || '').trim().slice(0, 80);
      if (cleanKey && cleanVal) {
        cleaned[cleanKey] = cleanVal;
      }
    }
    next.pronunciationOverrides = cleaned;
  }

  return next;
}

export function handleAnnouncerPresenterAction(
  game: ServerStoredGame,
  action: string,
  msg: Record<string, unknown>,
  helpers: {
    broadcastRoom: (code: string) => void;
    scheduleSave: () => void;
    sendWsError: (message: string) => void;
  }
): boolean {
  if (!action.startsWith('announcer_')) return false;

  const state = ensureGameAnnouncerState(game);

  if (action === 'announcer_update_config') {
    const rawPatch =
      msg.config && typeof msg.config === 'object'
        ? (msg.config as Record<string, unknown>)
        : {};
    state.config = sanitizeAnnouncerConfigPatch(state.config, rawPatch);
    state.updatedAt = Date.now();
    helpers.scheduleSave();
    helpers.broadcastRoom(game.code);
    return true;
  }

  if (action === 'announcer_start_ceremony') {
    if (game.status !== 'finished') {
      helpers.sendWsError(
        'El locutor solo puede anunciar resultados cuando la partida haya finalizado.'
      );
      return true;
    }

    const forceRepeat = Boolean(msg.forceRepeat);
    const finishedAt = game.finishedAt || Date.now();

    // Anti-duplication guard: prevent automatic double-trigger for the exact same finished game
    if (
      !forceRepeat &&
      state.triggeredForFinishedAt === finishedAt &&
      state.ceremonyRunId &&
      state.stage !== 'idle'
    ) {
      return true;
    }

    state.ceremonyVariationSeed =
      (state.ceremonyVariationSeed + 1) % 10000;
    const requestedRunId = String(msg.ceremonyRunId || '').trim();
    state.ceremonyRunId =
      requestedRunId || `cer-${game.code}-${finishedAt}-${crypto.randomBytes(3).toString('hex')}`;
    state.triggeredForFinishedAt = finishedAt;
    state.stage = 'intro_suspense';
    state.unlockedStages = ['intro_suspense'];
    state.activeCueIndex = 0;
    state.highlightedParticipantIds = [];
    state.updatedAt = Date.now();

    helpers.scheduleSave();
    helpers.broadcastRoom(game.code);
    return true;
  }

  if (action === 'announcer_set_stage') {
    if (game.status !== 'finished') return true;
    const runId = String(msg.ceremonyRunId || '').trim();
    if (state.ceremonyRunId && runId && runId !== state.ceremonyRunId) {
      // Ignore stale cue updates from an older/cancelled run
      return true;
    }

    const rawStage = String(msg.stage || '');
    if (VALID_STAGES.has(rawStage as AnnouncerStage)) {
      state.stage = rawStage as AnnouncerStage;
    }

    if (Array.isArray(msg.unlockedStages)) {
      state.unlockedStages = msg.unlockedStages
        .map((s) => String(s) as AnnouncerStage)
        .filter((s) => VALID_STAGES.has(s));
    }

    if (typeof msg.activeCueIndex === 'number' && Number.isFinite(msg.activeCueIndex)) {
      state.activeCueIndex = Math.max(-1, Math.floor(msg.activeCueIndex));
    }

    if (Array.isArray(msg.highlightedParticipantIds)) {
      state.highlightedParticipantIds = msg.highlightedParticipantIds
        .map((id) => String(id || '').trim())
        .filter(Boolean);
    }

    state.updatedAt = Date.now();
    helpers.scheduleSave();
    helpers.broadcastRoom(game.code);
    return true;
  }

  if (action === 'announcer_stop_ceremony') {
    state.stage = 'complete';
    state.unlockedStages = [
      'intro_suspense',
      'third_place',
      'second_place',
      'first_place',
      'last_place',
      'complete',
    ];
    state.activeCueIndex = -1;
    state.highlightedParticipantIds = [];
    state.updatedAt = Date.now();
    helpers.scheduleSave();
    helpers.broadcastRoom(game.code);
    return true;
  }

  if (action === 'announcer_reset_ceremony') {
    resetGameAnnouncerCeremony(game);
    helpers.scheduleSave();
    helpers.broadcastRoom(game.code);
    return true;
  }

  return false;
}

export function registerAnnouncerRoutes(app: express.Express): void {
  app.get('/api/announcer/health', (_req, res) => {
    const configured = Boolean(getConfiguredApiKey());
    res.json({
      ok: configured,
      configured,
      primaryModel: PRIMARY_TTS_MODEL,
      secondaryModel: SECONDARY_TTS_MODEL,
      defaultVoice: DEFAULT_FEMALE_VOICE,
      defaultConfig: createDefaultAnnouncerConfig(),
      styles: Object.keys(ANNOUNCER_STYLE_META),
      voices: Object.keys(ANNOUNCER_VOICE_META),
      capabilities: GEMINI_TTS_CAPABILITIES,
    });
  });

  app.post('/api/announcer/synthesize', async (req, res) => {
    const body = req.body || {};
    const text = String(body.text || '').trim();
    const style = VALID_STYLES.has(body.style)
      ? (body.style as AnnouncerStyle)
      : 'misterioso';
    const suspenseLevel = VALID_SUSPENSE.has(body.suspenseLevel)
      ? (body.suspenseLevel as SuspenseLevel)
      : 'alto';
    const voiceName = VALID_VOICES.has(body.voiceName)
      ? (body.voiceName as AnnouncerVoiceName)
      : DEFAULT_FEMALE_VOICE;
    const bypassCache = Boolean(body.bypassCache);
    const metadataOnly = Boolean(body.metadataOnly);

    if (!text) {
      res.status(400).json({
        error: 'El texto a anunciar está vacío.',
        category: 'VALIDATION',
        retryable: false,
      });
      return;
    }

    if (text.length > 900) {
      res.status(400).json({
        error: 'El texto del anuncio excede el límite permitido (900 caracteres).',
        category: 'VALIDATION',
        retryable: false,
      });
      return;
    }

    if (!getConfiguredApiKey()) {
      res.status(503).json({
        error:
          'Falta configurar GEMINI_API_KEY en el servidor para habilitar el locutor de voz TTS real.',
        category: 'UNCONFIGURED',
        retryable: false,
      });
      return;
    }

    try {
      const result = await generateGeminiSpeechWav({
        text,
        style,
        suspenseLevel,
        voiceName,
        bypassCache,
      });
      res.json({
        ok: true,
        mimeType: 'audio/wav',
        ...(metadataOnly ? {} : { wavBase64: result.wavBase64 }),
        byteLength: result.byteLength,
        durationMs: result.durationMs,
        modelUsed: result.modelUsed,
        voiceUsed: result.voiceUsed,
        cached: result.cached,
        latencyMs: result.latencyMs,
      });
    } catch (err) {
      const classified = classifyTtsError(err);
      res.status(classified.status).json({
        ok: false,
        error: classified.message,
        category: classified.category,
        retryable: classified.retryable,
      });
    }
  });
}
