import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Mic,
  Music,
  Play,
  RotateCcw,
  Sliders,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  ANNOUNCER_STYLE_META,
  ANNOUNCER_SUSPENSE_META,
  ANNOUNCER_VOICE_META,
  GEMINI_TTS_CAPABILITIES,
  clampAnnouncerSpeed,
  normalizeAnnouncerVoiceName,
  type AnnouncerConfig,
  type AnnouncerSfxCueKey,
  type AnnouncerStyle,
  type AnnouncerVoiceName,
  type SuspenseLevel,
} from '../shared/announcerTypes';
import { resolveSpokenParticipantName } from '../shared/announcerEngine';
import type { GameRoomClientState } from '../shared/types';
import {
  announcerAudio,
  persistAnnouncerConfig,
  type AnnouncerPlaybackStatus,
} from '../utils/announcerAudio';

interface AnnouncerDirectorPanelProps {
  state: GameRoomClientState;
  config: AnnouncerConfig;
  playbackStatus: AnnouncerPlaybackStatus;
  onUpdateConfig: (patch: Partial<AnnouncerConfig>) => void;
  onStartCeremony: (forceRepeat?: boolean) => void;
  onStopCeremony: () => void;
  defaultExpanded?: boolean;
}

const SFX_LABELS: Array<{ key: AnnouncerSfxCueKey; label: string }> = [
  { key: 'suspenseMusic', label: 'Música de suspenso' },
  { key: 'drumroll', label: 'Redoble previo' },
  { key: 'topThreeSting', label: 'Acento Top 3' },
  { key: 'winnerFanfare', label: 'Fanfarria del campeón' },
  { key: 'lastPlaceSting', label: 'Efecto simpático último puesto' },
  { key: 'closingMusic', label: 'Cierre musical' },
];

export function AnnouncerDirectorPanel({
  state,
  config,
  playbackStatus,
  onUpdateConfig,
  onStartCeremony,
  onStopCeremony,
  defaultExpanded = false,
}: AnnouncerDirectorPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showPronunciations, setShowPronunciations] = useState(false);
  const [sampleName, setSampleName] = useState('Mateo Herrera');
  const [testingParticipantId, setTestingParticipantId] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (state.status === 'finished') {
      setExpanded(true);
    }
  }, [state.status]);

  const safeVoiceName = normalizeAnnouncerVoiceName(config.voiceName);
  const safeVoiceSpeed = clampAnnouncerSpeed(config.voiceSpeed, 0.95);

  const updateAndPersist = (patch: Partial<AnnouncerConfig>) => {
    const merged: AnnouncerConfig = {
      ...config,
      ...patch,
      voiceName: normalizeAnnouncerVoiceName(patch.voiceName ?? config.voiceName),
      voiceSpeed: clampAnnouncerSpeed(
        patch.voiceSpeed ?? config.voiceSpeed,
        0.95
      ),
      sfxToggles: {
        ...config.sfxToggles,
        ...(patch.sfxToggles || {}),
      },
      pronunciationOverrides: {
        ...config.pronunciationOverrides,
        ...(patch.pronunciationOverrides || {}),
      },
    };
    persistAnnouncerConfig(merged);
    announcerAudio.applyConfig(merged);
    onUpdateConfig(patch);
  };

  const handleStyleChange = (style: AnnouncerStyle) => {
    // Keep the exact same female vocal identity across styles
    updateAndPersist({ style, voiceName: safeVoiceName });
  };

  const handlePreview = async () => {
    if (playbackStatus.isSpeaking && !playbackStatus.isCeremonyActive) {
      announcerAudio.stopAll();
      return;
    }
    await announcerAudio.playPreviewSample(
      { ...config, voiceName: safeVoiceName, voiceSpeed: safeVoiceSpeed },
      sampleName
    );
  };

  const handleTestParticipantName = async (
    participantId: string,
    rawName: string
  ) => {
    setTestingParticipantId(participantId);
    const spoken = resolveSpokenParticipantName(
      { participantId, name: rawName },
      config.pronunciationOverrides
    );
    await announcerAudio.playPreviewSample(config, spoken);
    setTestingParticipantId(null);
  };

  const handleOverrideChange = (participantId: string, phonetic: string) => {
    const next = { ...config.pronunciationOverrides };
    if (phonetic.trim()) {
      next[participantId] = phonetic;
    } else {
      delete next[participantId];
    }
    updateAndPersist({ pronunciationOverrides: next });
  };

  const isFinished = state.status === 'finished';
  const announcerStage = state.announcerState?.stage || 'idle';
  const hasAnnouncedOnce =
    Boolean(state.announcerState?.ceremonyRunId) && announcerStage !== 'idle';

  return (
    <section
      aria-label="Control del Locutor IA de Competencias Bíblicas"
      className="bg-[#111A2E] border border-slate-800 rounded-2xl overflow-hidden"
    >
      {/* Top Studio Header Bar */}
      <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              playbackStatus.isSpeaking
                ? 'bg-amber-400 text-slate-950 border-amber-300'
                : config.enabled
                  ? 'bg-sky-500/15 text-sky-300 border-sky-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <Mic className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display font-bold text-base sm:text-lg text-white">
                Locutor IA de Competencias Bíblicas
              </h3>
              <span className="text-xs font-medium text-slate-400">
                {!config.enabled
                  ? 'Desactivado'
                  : playbackStatus.isGeneratingAudio
                    ? 'Generando voz real...'
                    : playbackStatus.isSpeaking
                      ? `Hablando · ${playbackStatus.currentRankLabel}`
                      : playbackStatus.isCeremonyActive
                        ? 'Ceremonia en curso'
                        : `${ANNOUNCER_STYLE_META[config.style].label} · ${ANNOUNCER_VOICE_META[safeVoiceName].label}`}
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate">
              {playbackStatus.currentCaption
                ? playbackStatus.currentCaption
                : 'Voz femenina predeterminada en español latinoamericano sincronizada con Proyección.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isFinished && (
            <>
              <button
                type="button"
                onClick={() => onStartCeremony(hasAnnouncedOnce)}
                disabled={!config.enabled || state.leaderboard.length === 0}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-45 text-slate-950 font-display font-bold text-xs sm:text-sm inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                {hasAnnouncedOnce ? (
                  <RotateCcw className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 fill-current" />
                )}
                {hasAnnouncedOnce ? 'Repetir anuncio' : 'Anunciar resultados'}
              </button>

              {playbackStatus.isCeremonyActive && (
                <button
                  type="button"
                  onClick={onStopCeremony}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  Detener
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => updateAndPersist({ mutedVoice: !config.mutedVoice })}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
              config.mutedVoice
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-200'
                : 'bg-[#080E1E] border-slate-700 text-slate-200 hover:border-slate-500'
            }`}
          >
            {config.mutedVoice ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            )}
            {config.mutedVoice ? 'Voz silenciada' : 'Silenciar voz'}
          </button>

          <button
            type="button"
            onClick={handlePreview}
            disabled={!config.enabled || playbackStatus.isGeneratingAudio}
            className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {playbackStatus.isSpeaking
              ? 'Reiniciar prueba de voz'
              : 'Previsualizar voz femenina'}
          </button>

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Sliders className="w-3.5 h-3.5" />
            Ajustes
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Real TTS Error Notice (honest, never simulated) */}
      {playbackStatus.lastError && (
        <div className="mx-5 mt-4 bg-rose-500/15 border border-rose-500/40 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-rose-200">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">
              Aviso del servicio de voz TTS ({playbackStatus.lastError.category})
            </p>
            <p>{playbackStatus.lastError.message}</p>
          </div>
        </div>
      )}

      {expanded && (
        <div className="p-5 space-y-5">
          {/* Primary switches row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="flex items-center justify-between gap-3 bg-[#080E1E] border border-slate-800 rounded-xl px-3.5 py-2.5 cursor-pointer">
              <span className="text-xs font-semibold text-slate-200">
                Activar Locutor IA
              </span>
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => updateAndPersist({ enabled: e.target.checked })}
                className="w-4 h-4 accent-amber-400 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between gap-3 bg-[#080E1E] border border-slate-800 rounded-xl px-3.5 py-2.5 cursor-pointer">
              <span className="text-xs font-semibold text-slate-200">
                Anunciar al finalizar
              </span>
              <input
                type="checkbox"
                checked={config.autoAnnounce}
                onChange={(e) =>
                  updateAndPersist({ autoAnnounce: e.target.checked })
                }
                className="w-4 h-4 accent-amber-400 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between gap-3 bg-[#080E1E] border border-slate-800 rounded-xl px-3.5 py-2.5 cursor-pointer">
              <span className="text-xs font-semibold text-slate-200">
                Revelado progresivo en TV
              </span>
              <input
                type="checkbox"
                checked={config.progressiveReveal}
                onChange={(e) =>
                  updateAndPersist({ progressiveReveal: e.target.checked })
                }
                className="w-4 h-4 accent-amber-400 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between gap-3 bg-[#080E1E] border border-slate-800 rounded-xl px-3.5 py-2.5 cursor-pointer">
              <span className="text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-sky-300" />
                Música de suspenso
              </span>
              <input
                type="checkbox"
                checked={config.musicEnabled}
                onChange={(e) =>
                  updateAndPersist({ musicEnabled: e.target.checked })
                }
                className="w-4 h-4 accent-amber-400 cursor-pointer"
              />
            </label>
          </div>

          {/* Style, Suspense, Voice, Output Target */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Estilo del locutor
              </label>
              <select
                value={config.style}
                onChange={(e) =>
                  handleStyleChange(e.target.value as AnnouncerStyle)
                }
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                {(
                  Object.keys(ANNOUNCER_STYLE_META) as AnnouncerStyle[]
                ).map((sKey) => (
                  <option key={sKey} value={sKey}>
                    {ANNOUNCER_STYLE_META[sKey].label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">
                {ANNOUNCER_STYLE_META[config.style].description}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Nivel de suspenso y pausas
              </label>
              <select
                value={config.suspenseLevel}
                onChange={(e) =>
                  updateAndPersist({
                    suspenseLevel: e.target.value as SuspenseLevel,
                  })
                }
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                {(
                  Object.keys(ANNOUNCER_SUSPENSE_META) as SuspenseLevel[]
                ).map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {ANNOUNCER_SUSPENSE_META[lvl].label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">
                Ajusta las pausas dramáticas antes de revelar nombres.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Voz femenina IA (es-419)
              </label>
              <select
                value={safeVoiceName}
                onChange={(e) =>
                  updateAndPersist({
                    voiceName: normalizeAnnouncerVoiceName(
                      e.target.value as AnnouncerVoiceName
                    ),
                  })
                }
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                {(
                  Object.keys(ANNOUNCER_VOICE_META) as AnnouncerVoiceName[]
                ).map((vKey) => (
                  <option key={vKey} value={vKey}>
                    {ANNOUNCER_VOICE_META[vKey].label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">
                {ANNOUNCER_VOICE_META[safeVoiceName].tone} Se mantiene fija durante toda la competencia.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Dispositivo donde suena el audio
              </label>
              <select
                value={config.audioTarget}
                onChange={(e) =>
                  updateAndPersist({
                    audioTarget: e.target
                      .value as AnnouncerConfig['audioTarget'],
                  })
                }
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="auto">
                  Automático (
                  {(state.projectorConnectedCount || 0) > 0
                    ? 'Proyección conectada'
                    : 'Este panel'}
                  )
                </option>
                <option value="projector">Solo Pantalla de Proyección (TV)</option>
                <option value="presenter">Solo Panel del Presentador</option>
                <option value="both">Ambas pantallas (Presentador + TV)</option>
              </select>
              <p className="text-[11px] text-slate-400">
                Evita eco: Automático reproduce en el televisor cuando está conectado.
              </p>
            </div>
          </div>

          {/* Independent Volume & Speed Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-slate-800/80">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">
                  Volumen de Voz del Locutor
                </span>
                <span className="font-mono-num text-amber-300 font-bold">
                  {Math.round(config.voiceVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(config.voiceVolume * 100)}
                onChange={(e) =>
                  updateAndPersist({ voiceVolume: Number(e.target.value) / 100 })
                }
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">
                  Velocidad de Locución
                </span>
                <span className="font-mono-num text-violet-300 font-bold">
                  {safeVoiceSpeed.toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                min={85}
                max={120}
                step={5}
                value={Math.round(safeVoiceSpeed * 100)}
                onChange={(e) =>
                  updateAndPersist({
                    voiceSpeed: clampAnnouncerSpeed(
                      Number(e.target.value) / 100,
                      0.95
                    ),
                  })
                }
                className="w-full accent-violet-400 cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">
                  Volumen Música Ambiental
                </span>
                <span className="font-mono-num text-sky-300 font-bold">
                  {Math.round(config.musicVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(config.musicVolume * 100)}
                onChange={(e) =>
                  updateAndPersist({ musicVolume: Number(e.target.value) / 100 })
                }
                className="w-full accent-sky-400 cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">
                  Volumen de Efectos
                </span>
                <span className="font-mono-num text-emerald-300 font-bold">
                  {Math.round(config.sfxVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(config.sfxVolume * 100)}
                onChange={(e) =>
                  updateAndPersist({ sfxVolume: Number(e.target.value) / 100 })
                }
                className="w-full accent-emerald-400 cursor-pointer"
              />
            </div>
          </div>

          <div className="bg-[#080E1E] border border-slate-800 rounded-xl px-3.5 py-2.5 text-[11px] text-slate-400 space-y-1">
            <p className="text-slate-200 font-semibold">
              Capacidades reales del proveedor ({GEMINI_TTS_CAPABILITIES.provider}):
            </p>
            <p>
              Velocidad ({GEMINI_TTS_CAPABILITIES.controls.speed.detail}), pausas y expresividad ceremonial disponibles.{' '}
              {GEMINI_TTS_CAPABILITIES.controls.numericPitch.detail}
            </p>
          </div>

          {/* Individual SFX Effect Toggles */}
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            <p className="text-xs font-semibold text-slate-300">
              Efectos sonoros individuales (100% originales)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {SFX_LABELS.map((item) => (
                <label
                  key={item.key}
                  className="flex items-center justify-between gap-2 bg-[#080E1E] border border-slate-800 rounded-lg px-2.5 py-2 text-[11px] text-slate-200 cursor-pointer"
                >
                  <span className="truncate">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={config.sfxToggles[item.key]}
                    onChange={(e) =>
                      updateAndPersist({
                        sfxToggles: {
                          ...config.sfxToggles,
                          [item.key]: e.target.checked,
                        },
                      })
                    }
                    className="w-3.5 h-3.5 accent-emerald-400 shrink-0 cursor-pointer"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Preview input + Hard-to-pronounce participant names */}
          <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-slate-400" htmlFor="announcer-preview-name">
                Nombre de prueba:
              </label>
              <input
                id="announcer-preview-name"
                type="text"
                value={sampleName}
                onChange={(e) => setSampleName(e.target.value)}
                maxLength={40}
                placeholder="Ej. Mateo Herrera"
                className="bg-[#080E1E] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white w-48"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowPronunciations((v) => !v)}
              className="text-xs font-semibold text-sky-300 hover:text-sky-200 cursor-pointer"
            >
              {showPronunciations
                ? 'Ocultar pronunciación personalizada'
                : `Ajustar pronunciación de nombres (${state.participants.length})`}
            </button>
          </div>

          {showPronunciations && (
            <div className="bg-[#080E1E] border border-slate-800 rounded-xl p-3.5 space-y-2.5">
              <p className="text-xs text-slate-400">
                Si algún participante tiene un nombre difícil de pronunciar (ej. "Jhonathan" o "Xóchitl"), escribe cómo debe leerlo el locutor sin cambiar cómo se ve en pantalla.
              </p>
              {state.participants.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Aún no hay participantes conectados en esta sala.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {state.participants.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 bg-[#111A2E] border border-slate-800 rounded-lg px-2.5 py-1.5"
                    >
                      <span className="text-xs font-medium text-white truncate w-28 shrink-0">
                        {p.name}
                      </span>
                      <input
                        type="text"
                        value={config.pronunciationOverrides[p.id] || ''}
                        onChange={(e) =>
                          handleOverrideChange(p.id, e.target.value)
                        }
                        placeholder="Ej. Yónatan"
                        className="flex-1 min-w-0 bg-[#080E1E] border border-slate-700 rounded px-2 py-1 text-xs text-amber-200"
                      />
                      <button
                        type="button"
                        onClick={() => handleTestParticipantName(p.id, p.name)}
                        disabled={testingParticipantId === p.id}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-sky-300 font-semibold shrink-0 cursor-pointer"
                      >
                        {testingParticipantId === p.id ? '...' : 'Probar'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
