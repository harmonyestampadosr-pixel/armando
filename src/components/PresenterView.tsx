import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Crown,
  Disc,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Flag,
  Pause,
  Play,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Scale,
  Share2,
  Shuffle,
  Tv,
  UserX,
  Users,
} from 'lucide-react';
import { useGameSocket } from '../hooks/useGameSocket';
import { buildAnnouncerPlan } from '../shared/announcerEngine';
import {
  createDefaultAnnouncerConfig,
  type AnnouncerConfig,
} from '../shared/announcerTypes';
import {
  DIFFICULTY_LABELS,
  GAME_MODE_INFO,
  getTeamDefinition,
} from '../shared/types';
import {
  announcerAudio,
  loadSavedAnnouncerConfig,
  shouldPlayAudioHere,
  type AnnouncerPlaybackStatus,
} from '../utils/announcerAudio';
import { soundFX, type DidacticAmbientMode } from '../utils/sound';
import { AdventureRoomPanel } from './AdventureRoomPanel';
import { AnnouncerDirectorPanel } from './AnnouncerDirectorPanel';
import { AvatarBadge } from './AvatarBadge';
import { ChampionshipProgressPanel } from './CampeonatoRondasView';
import { ConnectionStatusBadge } from './ConnectionStatusBadge';
import { CountdownTimer } from './CountdownTimer';
import { LearningMultiplayerRoomPanel } from './LearningMultiplayerRoomPanel';
import { QrCodeCard } from './QrCodeCard';
import {
  QuestionReviewSection,
  TeamWinnerBanner,
} from './QuestionReviewSection';
import { MysteryMultiplayerRoomPanel } from './QuienSoyMisterioView';
import { RetoMultiplayerRoomPanel } from './RetoMultiplayerRoomPanel';
import { RouletteWheelGraphic } from './RuletaBiblicaView';
import { SaturdayChallengeRoomPanel } from './SaturdayChallengeRoomPanel';
import { SaturdayRouletteRoomPanel } from './SaturdayRouletteRoomPanel';
import { TalentRoomPanel } from './TalentRoomPanel';
import {
  LeaderboardTable,
  PodiumDisplay,
  QuestionDistributionChart,
  QuestionResultsTable,
  TeamLeaderboardStrip,
} from './ScoreboardViews';

interface PresenterViewProps {
  code: string;
  token: string;
  onNewGame: () => void;
  onExit: () => void;
  onOpenProjector?: (code: string) => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export function PresenterView({
  code,
  token,
  onNewGame,
  onExit,
  onOpenProjector,
}: PresenterViewProps) {
  const {
    state,
    connectionStatus,
    reconnectNow,
    error,
    clockOffsetMs,
    sendPresenterAction,
  } = useGameSocket({
    code,
    role: 'presenter',
    token,
  });

  const [showPrivateAnswer, setShowPrivateAnswer] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    'reset' | 'end' | null
  >(null);
  const [openedProjectorStep, setOpenedProjectorStep] = useState(false);
  const [announcerPlayback, setAnnouncerPlayback] =
    useState<AnnouncerPlaybackStatus>(() => announcerAudio.getStatus());

  const syncedPrefsGameRef = useRef<string | null>(null);
  const autoTriggeredFinishedAtRef = useRef<number | null>(null);
  const runningCeremonyIdRef = useRef<string | null>(null);

  useEffect(() => {
    return announcerAudio.subscribe(() => {
      setAnnouncerPlayback(announcerAudio.getStatus());
    });
  }, []);

  useEffect(() => {
    return () => {
      announcerAudio.stopAll();
    };
  }, []);

  useEffect(() => {
    soundFX.setWelcomeMusicActive(!state || state.status === 'waiting');
  }, [state?.status]);

  const activeGameMode = state?.config.mode;
  const adventureAmbient = state?.adventureState?.ambientStyle;
  useEffect(() => {
    if (activeGameMode === 'quien_soy' || activeGameMode === 'misterio_biblico') {
      soundFX.setDidacticAmbient('mystery');
    } else if (activeGameMode === 'aprende_biblia') {
      soundFX.setDidacticAmbient('learning');
    } else if (activeGameMode === 'aventuras_biblicas' && adventureAmbient) {
      soundFX.setDidacticAmbient(`adventure_${adventureAmbient}` as DidacticAmbientMode);
    } else {
      soundFX.setDidacticAmbient(null);
    }
    return () => soundFX.setDidacticAmbient(null);
  }, [activeGameMode, adventureAmbient]);

  const announcerConfig: AnnouncerConfig =
    state?.announcerState?.config || createDefaultAnnouncerConfig();

  // Sync director's local saved preferences cleanly once when opening a room in waiting state
  useEffect(() => {
    if (!state || syncedPrefsGameRef.current === state.gameId) return;
    syncedPrefsGameRef.current = state.gameId;
    if (state.status !== 'finished') {
      const saved = loadSavedAnnouncerConfig();
      announcerAudio.applyConfig(saved);
      sendPresenterAction('announcer_update_config', { config: saved });
    }
  }, [state, sendPresenterAction]);

  // Keep local audio gain/ducking matched to live room config
  useEffect(() => {
    if (state?.announcerState?.config) {
      announcerAudio.applyConfig(state.announcerState.config);
    }
  }, [state?.announcerState?.config]);

  const handleUpdateAnnouncerConfig = useCallback(
    (patch: Partial<AnnouncerConfig>) => {
      sendPresenterAction('announcer_update_config', { config: patch });
    },
    [sendPresenterAction]
  );

  const handleStartCeremony = useCallback(
    (forceRepeat = false) => {
      sendPresenterAction('announcer_start_ceremony', { forceRepeat });
    },
    [sendPresenterAction]
  );

  const handleStopCeremony = useCallback(() => {
    announcerAudio.stopAll();
    sendPresenterAction('announcer_stop_ceremony');
  }, [sendPresenterAction]);

  // Auto-trigger announcement exactly once when match ends and results are confirmed
  useEffect(() => {
    if (!state) return;
    if (state.status !== 'finished') {
      autoTriggeredFinishedAtRef.current = null;
      runningCeremonyIdRef.current = null;
      announcerAudio.stopAll();
      return;
    }

    const finishedKey = state.finishedAt || 1;
    const cfg = state.announcerState?.config;
    if (
      cfg?.enabled &&
      cfg?.autoAnnounce &&
      state.leaderboard.length > 0 &&
      state.announcerState?.triggeredForFinishedAt !== state.finishedAt &&
      autoTriggeredFinishedAtRef.current !== finishedKey
    ) {
      autoTriggeredFinishedAtRef.current = finishedKey;
      sendPresenterAction('announcer_start_ceremony', { forceRepeat: false });
    }
  }, [
    state?.status,
    state?.finishedAt,
    state?.leaderboard.length,
    state?.announcerState?.config?.enabled,
    state?.announcerState?.config?.autoAnnounce,
    state?.announcerState?.triggeredForFinishedAt,
    sendPresenterAction,
  ]);

  // Execute synchronized ceremony runner when a new ceremonyRunId arrives
  useEffect(() => {
    const aState = state?.announcerState;
    if (
      !state ||
      state.status !== 'finished' ||
      !aState ||
      !aState.ceremonyRunId ||
      aState.stage === 'idle' ||
      aState.stage === 'complete'
    ) {
      return;
    }

    if (runningCeremonyIdRef.current === aState.ceremonyRunId) {
      return;
    }

    runningCeremonyIdRef.current = aState.ceremonyRunId;
    const runId = aState.ceremonyRunId;
    const plan = buildAnnouncerPlan({
      leaderboard: state.leaderboard,
      config: aState.config,
      gameTitle: state.config.title,
      ceremonyRunId: runId,
      variationSeed: aState.ceremonyVariationSeed,
    });

    const playHere = shouldPlayAudioHere({
      role: 'presenter',
      audioTarget: aState.config.audioTarget,
      projectorConnectedCount: state.projectorConnectedCount || 0,
    });

    void announcerAudio.runCeremony({
      plan,
      config: aState.config,
      shouldPlayAudioOnThisDevice: playHere,
      onCueStart: (cue, cueIndex, unlocked) => {
        if (runningCeremonyIdRef.current !== runId) return;
        sendPresenterAction('announcer_set_stage', {
          ceremonyRunId: runId,
          stage: cue.stage,
          activeCueIndex: cueIndex,
          unlockedStages: unlocked,
          highlightedParticipantIds: cue.highlightedParticipantIds,
        });
      },
      onComplete: () => {
        if (runningCeremonyIdRef.current !== runId) return;
        sendPresenterAction('announcer_set_stage', {
          ceremonyRunId: runId,
          stage: 'complete',
          activeCueIndex: -1,
          unlockedStages: [
            'intro_suspense',
            'third_place',
            'second_place',
            'first_place',
            'last_place',
            'complete',
          ],
          highlightedParticipantIds: [],
        });
      },
    });
  }, [
    state,
    sendPresenterAction,
  ]);

  if (!state) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-8 space-y-4">
          <div className="flex justify-center">
            <ConnectionStatusBadge status={connectionStatus} />
          </div>
          <p className="text-white font-semibold text-lg">
            {error ||
              (connectionStatus === 'offline'
                ? 'Sin conexión con el servidor. Verifica tu red.'
                : connectionStatus === 'unavailable'
                  ? `La partida ${code} no está disponible.`
                  : `Cargando sala ${code}...`)}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            {connectionStatus !== 'connecting' && (
              <button
                type="button"
                onClick={reconnectNow}
                className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Reintentar conexión
              </button>
            )}
            <button
              type="button"
              onClick={onExit}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm cursor-pointer"
            >
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  const q = state.currentQuestion;
  const isRevealed =
    state.status === 'answer_revealed' || state.status === 'finished';
  const onlineCount = state.participants.filter((p) => p.online).length;
  const isRoulette = state.config.mode === 'ruleta_biblica';
  const isMystery =
    state.config.mode === 'quien_soy' ||
    state.config.mode === 'misterio_biblico';
  const isReto = Boolean(state.retoState);
  const isLearning =
    state.config.mode === 'aprende_biblia' && Boolean(state.learningState);
  const isRetosSabado =
    state.config.mode === 'retos_sabado' &&
    Boolean(state.saturdayChallengeState);
  const isRuletaSabado =
    state.config.mode === 'ruleta_sabado' &&
    Boolean(state.saturdayRouletteState);
  const isTalentos =
    state.config.mode === 'talentos_juveniles' &&
    Boolean(state.talentRoomState);
  const isAventuras =
    state.config.mode === 'aventuras_biblicas' &&
    Boolean(state.adventureState);
  const isTeamConfigurable =
    state.config.mode === 'competencia_equipos' ||
    Boolean(state.config.teamMode);
  const isChampionship = state.config.mode === 'campeonato_rondas';
  const hasTeamTie =
    isTeamConfigurable &&
    state.teamLeaderboard.length >= 2 &&
    state.teamLeaderboard[0].score === state.teamLeaderboard[1].score;

  const shareFinalWhatsApp = () => {
    const top = state.leaderboard
      .slice(0, 3)
      .map(
        (e) =>
          `${e.rank}. ${e.name} — ${e.score.toLocaleString('es-CO')} pts (${e.correctCount}/${e.answeredCount})`
      )
      .join('\n');
    const text = encodeURIComponent(
      `Resultados finales de "${state.config.title}" (${state.code}) en DIME TÚ QUÉ DICES:\n\n${top}\n\n¡Gracias por participar!`
    );
    return `https://wa.me/?text=${text}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Presenter Control Header */}
      <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="text-amber-300 font-semibold">
              Panel del Presentador
            </span>
            <span aria-hidden="true">·</span>
            <span>{GAME_MODE_INFO[state.config.mode].name}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num text-amber-300 font-bold">
              Código: {state.code}
            </span>
            <span aria-hidden="true">·</span>
            <ConnectionStatusBadge status={connectionStatus} />
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
            {state.config.title}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onOpenProjector ? (
            <button
              type="button"
              onClick={() => {
                setOpenedProjectorStep(true);
                onOpenProjector(state.code);
              }}
              className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Tv className="w-4 h-4" />
              Abrir pantalla de proyección
            </button>
          ) : null}

          <a
            href={`/?projector=${encodeURIComponent(state.code)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpenedProjectorStep(true)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            title="Abrir proyección en una nueva pestaña para televisor o videobeam"
          >
            <ExternalLink className="w-4 h-4" />
            {onOpenProjector ? 'Nueva pestaña (TV)' : 'Abrir pantalla de proyección'}
          </a>

          {state.status !== 'waiting' && state.status !== 'finished' && (
            <>
              {state.status === 'paused' ? (
                <button
                  type="button"
                  onClick={() => sendPresenterAction('resume_game')}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Reanudar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => sendPresenterAction('pause_game')}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Pause className="w-4 h-4" />
                  Pausar
                </button>
              )}

              <button
                type="button"
                onClick={() => setConfirmAction('end')}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Flag className="w-4 h-4" />
                Finalizar
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setConfirmAction('reset')}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
            Reiniciar
          </button>

          <button
            type="button"
            onClick={onExit}
            title="Volver al inicio sin cerrar ni destruir la partida activa"
            className="px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            Inicio
          </button>
        </div>
      </div>

      {/* Action / validation error notice */}
      {error && (
        <div className="bg-rose-500/15 border border-rose-500/50 rounded-2xl p-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* Inline confirmation banner (no window.confirm) */}
      {confirmAction && (
        <div className="bg-amber-500/15 border border-amber-400/60 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-amber-100 font-medium">
            {confirmAction === 'reset'
              ? '¿Reiniciar la partida? Todos los puntajes volverán a 0 y regresarás a la sala de espera.'
              : '¿Finalizar el concurso ahora? Se mostrará la clasificación definitiva y se guardará en el historial.'}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmAction(null)}
              className="px-3.5 py-2 rounded-lg bg-slate-800 text-slate-200 text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                sendPresenterAction(
                  confirmAction === 'reset' ? 'reset_game' : 'end_game'
                );
                setConfirmAction(null);
              }}
              className="px-4 py-2 rounded-lg bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
            >
              Confirmar
            </button>
          </div>
        </div>
      )}

      {/* WAITING ROOM */}
      {state.status === 'waiting' && (
        <div className="space-y-6">
          {/* 3-Step Visual Director Assistant */}
          <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-display font-bold text-sm sm:text-base text-white">
                Asistente Rápido del Director
              </p>
              <span className="text-xs text-slate-400">
                Sigue estos 3 pasos para comenzar sin contratiempos
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-xl p-3.5 flex items-start gap-3">
                <span className="w-7 h-7 rounded-lg bg-emerald-500 text-slate-950 font-mono-num font-extrabold text-xs flex items-center justify-center shrink-0">
                  ✓
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                    PASO 1: Crear partida
                  </p>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Sala creada con el código real{' '}
                    <strong className="font-mono-num text-amber-300">
                      {state.code}
                    </strong>
                    .
                  </p>
                </div>
              </div>

              <div
                className={`rounded-xl p-3.5 border flex items-start gap-3 ${
                  openedProjectorStep || state.participants.length > 0
                    ? 'bg-emerald-500/10 border-emerald-500/40'
                    : 'bg-sky-500/10 border-sky-400/50'
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-lg font-mono-num font-extrabold text-xs flex items-center justify-center shrink-0 ${
                    openedProjectorStep || state.participants.length > 0
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-sky-400 text-slate-950'
                  }`}
                >
                  {openedProjectorStep || state.participants.length > 0 ? '✓' : '2'}
                </span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-sky-300">
                    PASO 2: Abrir proyección o mostrar QR
                  </p>
                  <p className="text-xs text-slate-300">
                    Proyecta la sala en televisor o videobeam y comparte el QR o enlace abajo.
                  </p>
                </div>
              </div>

              <div
                className={`rounded-xl p-3.5 border flex items-start gap-3 ${
                  state.participants.length > 0
                    ? 'bg-amber-400/15 border-amber-400/60'
                    : 'bg-[#080E1E] border-slate-800'
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-lg font-mono-num font-extrabold text-xs flex items-center justify-center shrink-0 ${
                    state.participants.length > 0
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  3
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    PASO 3: Esperar a los jugadores e iniciar
                  </p>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {state.participants.length > 0
                      ? `${onlineCount} conectado(s). Ya puedes iniciar el concurso.`
                      : 'Esperando que ingresen jugadores desde su celular.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <AnnouncerDirectorPanel
            state={state}
            config={announcerConfig}
            playbackStatus={announcerPlayback}
            onUpdateConfig={handleUpdateAnnouncerConfig}
            onStartCeremony={handleStartCeremony}
            onStopCeremony={handleStopCeremony}
            defaultExpanded={false}
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-5 space-y-5">
              <QrCodeCard
                code={state.code}
                gameId={state.gameId}
                title={state.config.title}
                showProjectorLink
                onOpenProjector={
                  onOpenProjector
                    ? () => {
                        setOpenedProjectorStep(true);
                        onOpenProjector(state.code);
                      }
                    : undefined
                }
              />

              <div className="bg-[#0B1224] border border-slate-800 rounded-2xl p-4 space-y-2 text-xs text-slate-300">
                <p className="font-semibold text-white">
                  Instrucciones rápidas para conectar dispositivos
                </p>
                <ul className="space-y-1 text-slate-400 list-disc list-inside">
                  <li>
                    Televisor / Videobeam: pulsa{' '}
                    <strong className="text-sky-300">Abrir pantalla de proyección</strong>{' '}
                    (o abre en otro equipo con el código{' '}
                    <strong className="font-mono-num text-amber-300">{state.code}</strong>).
                  </li>
                  <li>
                    Jugadores: escanean el <strong className="text-white">código QR</strong>, abren el{' '}
                    <strong className="text-white">enlace</strong> o entran con el código en{' '}
                    <strong className="text-white">Unirme a una Partida</strong>.
                  </li>
                  <li>
                    Puedes salir al inicio y regresar luego: tu partida seguirá activa en tiempo real.
                  </li>
                </ul>
              </div>

              <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>
                  {isAventuras
                    ? 'Escenas de la historia'
                    : isTalentos
                      ? 'Presentaciones registradas'
                      : isRuletaSabado
                        ? 'Categorías activas'
                        : 'Preguntas preparadas'}
                </span>
                <strong className="font-mono-num text-white">
                  {isAventuras
                    ? state.adventureState?.totalScenes || state.totalQuestions
                    : isTalentos
                      ? state.talentRoomState?.entries.length || 0
                      : isRuletaSabado
                        ? state.saturdayRouletteState?.enabledCategories.length || 12
                        : state.totalQuestions}
                </strong>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>
                  Tiempo por{' '}
                  {isAventuras
                    ? 'escena'
                    : isTalentos
                      ? 'presentación'
                      : isRuletaSabado
                        ? 'actividad'
                        : 'pregunta'}
                </span>
                <strong className="font-mono-num text-white">
                  {state.config.timeLimitSec}s
                </strong>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>Límite de jugadores</span>
                <strong className="font-mono-num text-white">
                  {state.config.maxParticipants}
                </strong>
              </div>

              <button
                type="button"
                onClick={() =>
                  sendPresenterAction(
                    isRuletaSabado
                      ? 'spin_saturday_roulette'
                      : isRoulette
                        ? 'spin_roulette'
                        : 'start_game'
                  )
                }
                className="w-full py-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-lg inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {isRoulette || isRuletaSabado ? (
                  <Disc className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 fill-current" />
                )}
                {isAventuras
                  ? 'COMENZAR AVENTURA BÍBLICA'
                  : isTalentos
                    ? 'ABRIR PROGRAMA DE TALENTOS'
                    : isRuletaSabado
                      ? 'GIRAR RULETA DEL SÁBADO'
                      : isRoulette
                        ? 'GIRAR RULETA Y COMENZAR'
                        : 'INICIAR CONCURSO'}
              </button>
              {state.participants.length === 0 && (
                <p className="text-xs text-slate-400 text-center">
                  Comparte el código QR o el enlace de invitación para que los
                  jugadores entren directamente en la sala de espera.
                </p>
              )}
            </div>
          </div>

          <div className="lg:col-span-7 space-y-5">
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-sky-400" />
                  Sala de Espera en Vivo
                </h2>
                <span className="font-mono-num text-sm text-slate-300">
                  {onlineCount} conectados · {state.participants.length}{' '}
                  registrados
                </span>
              </div>

              {state.participants.length === 0 ? (
                <div className="py-14 text-center border border-dashed border-slate-800 rounded-xl text-slate-400 text-sm">
                  Esperando que los primeros participantes se unan...
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[480px] overflow-y-auto pr-1">
                  {state.participants.map((p) => {
                    const team = p.teamId
                      ? getTeamDefinition(p.teamId, state.config.teams)
                      : undefined;
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-2 bg-[#080E1E] border border-slate-800 rounded-xl px-3.5 py-2.5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <AvatarBadge
                            avatarId={p.avatarId}
                            photoUrl={p.photoUrl}
                            name={p.name}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-white truncate">
                              {p.name}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {p.online ? 'En línea' : 'Desconectado'}
                              {team ? ` · ${team.name}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isTeamConfigurable &&
                            state.config.teams && (
                              <select
                                aria-label={`Cambiar equipo de ${p.name}`}
                                value={p.teamId || ''}
                                onChange={(e) =>
                                  sendPresenterAction('assign_team', {
                                    participantId: p.id,
                                    teamId: e.target.value,
                                  })
                                }
                                className="bg-[#111A2E] border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-amber-400"
                              >
                                {state.config.teams.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          <button
                            type="button"
                            onClick={() =>
                              sendPresenterAction('kick_participant', {
                                participantId: p.id,
                              })
                            }
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title={`Expulsar a ${p.name}`}
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {isTeamConfigurable &&
              state.teamLeaderboard.length > 0 && (
                <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display font-bold text-base text-white">
                        Organización por Equipos
                      </h3>
                      <p className="text-xs text-slate-400">
                        Cupo de {state.config.teamCapacity || 5} participantes
                        por equipo. Puedes reasignar o equilibrar antes de
                        comenzar.
                      </p>
                    </div>
                    {state.participants.length >= 2 && (
                      <button
                        type="button"
                        onClick={() => sendPresenterAction('rebalance_teams')}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-amber-300 inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Shuffle className="w-3.5 h-3.5" />
                        Equilibrar equipos
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {state.teamLeaderboard.map((team) => {
                      const members = state.participants.filter(
                        (m) => m.teamId === team.teamId
                      );
                      return (
                        <div
                          key={team.teamId}
                          className="bg-[#080E1E] border border-slate-800 rounded-xl p-3.5 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <span
                                className="font-display font-bold text-sm truncate block"
                                style={{ color: team.color }}
                              >
                                {team.name}
                              </span>
                              {team.captainName && (
                                <span className="text-[11px] text-amber-300 inline-flex items-center gap-1">
                                  <Crown className="w-3 h-3" />
                                  Capitán: {team.captainName}
                                </span>
                              )}
                            </div>
                            <span className="font-mono-num text-xs text-slate-400 shrink-0">
                              {members.length}/
                              {team.capacity || state.config.teamCapacity || '∞'}
                            </span>
                          </div>
                          {members.length === 0 ? (
                            <p className="text-xs text-slate-500">
                              Sin integrantes aún
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {members.map((m) => {
                                const isCap = team.captainParticipantId === m.id;
                                return (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() =>
                                      sendPresenterAction('assign_captain', {
                                        teamId: team.teamId,
                                        participantId: m.id,
                                      })
                                    }
                                    title={`Designar a ${m.name} como capitán`}
                                    className={`inline-flex items-center gap-1.5 border rounded-lg px-2 py-1 text-xs cursor-pointer transition-colors ${
                                      isCap
                                        ? 'bg-amber-400/15 border-amber-400 text-amber-200 font-semibold'
                                        : 'bg-[#111A2E] border-slate-800 text-slate-200 hover:border-amber-400/60'
                                    }`}
                                  >
                                    <AvatarBadge
                                      avatarId={m.avatarId}
                                      photoUrl={m.photoUrl}
                                      name={m.name}
                                      size="sm"
                                    />
                                    <span className="truncate max-w-[110px]">
                                      {m.name}
                                    </span>
                                    <Crown
                                      className={`w-3 h-3 shrink-0 ${
                                        isCap ? 'text-amber-300' : 'text-slate-600'
                                      }`}
                                    />
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
          </div>
        </div>
        </div>
      )}

      {/* LIVE QUESTION CONTROL */}
      {(state.status === 'question_active' ||
        state.status === 'question_locked' ||
        state.status === 'answer_revealed' ||
        state.status === 'paused') &&
        (q || isMystery || isReto || isLearning || isRetosSabado || isRuletaSabado || isTalentos || isAventuras) && (
          <div className="space-y-6">
            {state.teamLeaderboard.length > 0 && (
              <TeamLeaderboardStrip teams={state.teamLeaderboard} />
            )}

            {isChampionship && (
              <ChampionshipProgressPanel
                state={state}
                role="presenter"
                onPresenterAction={sendPresenterAction}
              />
            )}

            {isRoulette && state.rouletteState && (
              <div className="bg-[#111A2E] border border-amber-400/40 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-5">
                <div className="flex items-center gap-4">
                  <RouletteWheelGraphic
                    angleDeg={state.rouletteState.targetAngleDeg}
                    spinning={false}
                    size={140}
                  />
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                      Ruleta Bíblica en Vivo · Giro #{state.rouletteState.spinsCount}
                    </p>
                    <h3 className="font-display text-xl font-extrabold text-white">
                      {state.rouletteState.selectedCategoryLabel || 'Categoría Aleatoria'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Preguntas únicas usadas: {state.rouletteState.usedQuestionIds.length} · Meta: {state.config.questionCount}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => sendPresenterAction('spin_roulette')}
                  className="px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-sm inline-flex items-center gap-2 cursor-pointer shrink-0"
                >
                  <Disc className="w-4 h-4" />
                  Girar Ruleta (Nueva Categoría)
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left: Question & Primary Controls */}
              <div className="lg:col-span-7 space-y-5">
                {isMystery ? (
                  <MysteryMultiplayerRoomPanel
                    state={state}
                    role="presenter"
                    clockOffsetMs={clockOffsetMs}
                    onPresenterAction={sendPresenterAction}
                  />
                ) : isReto ? (
                  <RetoMultiplayerRoomPanel
                    state={state}
                    role="presenter"
                    clockOffsetMs={clockOffsetMs}
                    onPresenterAction={sendPresenterAction}
                  />
                ) : isLearning ? (
                  <LearningMultiplayerRoomPanel
                    state={state}
                    role="presenter"
                    clockOffsetMs={clockOffsetMs}
                    onPresenterAction={sendPresenterAction}
                  />
                ) : isRetosSabado ? (
                  <SaturdayChallengeRoomPanel
                    state={state}
                    role="presenter"
                    clockOffsetMs={clockOffsetMs}
                    onPresenterAction={sendPresenterAction}
                  />
                ) : isRuletaSabado ? (
                  <SaturdayRouletteRoomPanel
                    state={state}
                    role="presenter"
                    clockOffsetMs={clockOffsetMs}
                    onPresenterAction={sendPresenterAction}
                  />
                ) : isTalentos ? (
                  <TalentRoomPanel
                    state={state}
                    role="presenter"
                    clockOffsetMs={clockOffsetMs}
                    onPresenterAction={sendPresenterAction}
                  />
                ) : isAventuras ? (
                  <AdventureRoomPanel
                    state={state}
                    role="presenter"
                    onPresenterAction={sendPresenterAction}
                  />
                ) : q ? (
                  <>
                    <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                        <span className="font-semibold text-sky-300">
                          Pregunta {state.currentQuestionIndex + 1} de{' '}
                          {state.totalQuestions}
                        </span>
                        <div className="flex items-center gap-2">
                          <span>{q.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>{DIFFICULTY_LABELS[q.difficulty]}</span>
                          {q.isSpecialMultiplier > 1 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-amber-300 font-bold">
                                Especial x{q.isSpecialMultiplier}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {q.roundStage && (
                        <p className="text-xs font-bold text-amber-300">
                          {q.roundStage}
                        </p>
                      )}

                      <CountdownTimer
                        status={state.status}
                        questionEndsAt={state.questionEndsAt}
                        timeLimitSec={state.config.timeLimitSec}
                        remainingSecFallback={state.remainingSec}
                        clockOffsetMs={clockOffsetMs}
                      />

                      <h2 className="font-display text-2xl font-bold text-white leading-snug">
                        {q.prompt}
                      </h2>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-slate-400">
                          Vista previa de opciones
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowPrivateAnswer((v) => !v)}
                          className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 font-medium cursor-pointer"
                        >
                          {showPrivateAnswer ? (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              Ocultar respuesta guía
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              Ver respuesta guía
                            </>
                          )}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {q.options.map((opt, idx) => {
                          const markCorrect =
                            (isRevealed || showPrivateAnswer) &&
                            q.correctIndex === idx;
                          return (
                            <div
                              key={idx}
                              className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-sm ${
                                markCorrect
                                  ? 'bg-emerald-500/15 border-emerald-400 text-emerald-200 font-semibold'
                                  : 'bg-[#080E1E] border-slate-800 text-slate-300'
                              }`}
                            >
                              <span className="font-mono-num font-bold w-6 h-6 rounded-md bg-slate-800 text-white flex items-center justify-center shrink-0">
                                {OPTION_LETTERS[idx]}
                              </span>
                              <span className="flex-1">{opt}</span>
                              {markCorrect && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {(isRevealed || showPrivateAnswer) && q.reference && (
                        <p className="text-xs text-amber-300 font-medium">
                          Referencia bíblica: {q.reference}
                          {q.explanation ? ` — ${q.explanation}` : ''}
                        </p>
                      )}

                      {/* Presenter Action Bar */}
                      <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-800">
                        {!isRevealed && state.status !== 'paused' && (
                          <button
                            type="button"
                            onClick={() => sendPresenterAction('reveal_answer')}
                            className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-sm inline-flex items-center gap-2 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Mostrar Respuesta Correcta
                          </button>
                        )}

                        {isRoulette ? (
                          <button
                            type="button"
                            onClick={() => sendPresenterAction('spin_roulette')}
                            className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-sm inline-flex items-center gap-2 cursor-pointer ml-auto"
                          >
                            <Disc className="w-4 h-4" />
                            Girar Ruleta · Siguiente
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => sendPresenterAction('next_question')}
                            className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-sm inline-flex items-center gap-2 cursor-pointer ml-auto"
                          >
                            {state.currentQuestionIndex + 1 >= state.totalQuestions
                              ? isChampionship
                                ? 'Finalizar Ronda'
                                : 'Ver Resultados Finales'
                              : 'Siguiente Pregunta'}
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Live Distribution & Results Table */}
                    <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-5">
                      <h3 className="font-display font-bold text-lg text-white">
                        Resultados de la pregunta
                      </h3>

                      <QuestionDistributionChart
                        options={q.options}
                        correctIndex={q.correctIndex}
                        stats={state.questionStats}
                        isRevealed={isRevealed}
                      />

                      <div className="pt-3 border-t border-slate-800">
                        <QuestionResultsTable stats={state.questionStats} />
                      </div>
                    </div>
                  </>
                ) : null}
              </div>

              {/* Right: Live Leaderboard + Connected Management */}
              <div className="lg:col-span-5 space-y-5">
                <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-lg text-white">
                      Clasificación en Vivo
                    </h3>
                    <span className="font-mono-num text-xs text-slate-400">
                      {state.answeredParticipantIds.length}/
                      {state.participants.length} respondieron
                    </span>
                  </div>
                  <LeaderboardTable
                    entries={state.leaderboard}
                    customTeams={state.config.teams}
                  />
                </div>

                <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-3">
                  <h3 className="font-display font-bold text-sm text-slate-300">
                    Gestión de participantes ({state.participants.length})
                  </h3>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {state.participants.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-2 text-xs py-1.5 px-2.5 rounded-lg bg-[#080E1E]"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <AvatarBadge
                            avatarId={p.avatarId}
                            photoUrl={p.photoUrl}
                            name={p.name}
                            size="sm"
                          />
                          <span className="text-slate-200 truncate">
                            {p.name}{' '}
                            <span className="text-slate-500">
                              ({p.online ? 'en línea' : 'offline'})
                            </span>
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            sendPresenterAction('kick_participant', {
                              participantId: p.id,
                            })
                          }
                          className="text-rose-400 hover:text-rose-300 font-medium cursor-pointer ml-2 shrink-0"
                        >
                          Expulsar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* FINISHED */}
      {state.status === 'finished' && (
        <div className="space-y-6">
          <div className="bg-[#111A2E] border border-amber-400/50 rounded-2xl p-6 sm:p-8 text-center space-y-4">
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white">
              ¡Concurso Finalizado!
            </h2>
            <p className="text-slate-300 text-sm sm:text-base">
              Resultados guardados automáticamente en el historial de partidas.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <a
                href={`/api/games/${encodeURIComponent(state.code)}/export?format=csv`}
                download
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Descargar CSV
              </a>
              <a
                href={`/api/games/${encodeURIComponent(state.code)}/export?format=json`}
                download
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Descargar JSON
              </a>
              <a
                href={shareFinalWhatsApp()}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold inline-flex items-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                Compartir clasificación
              </a>
              <button
                type="button"
                onClick={onNewGame}
                className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                Crear nueva partida
              </button>
            </div>
          </div>

          <AnnouncerDirectorPanel
            state={state}
            config={announcerConfig}
            playbackStatus={announcerPlayback}
            onUpdateConfig={handleUpdateAnnouncerConfig}
            onStartCeremony={handleStartCeremony}
            onStopCeremony={handleStopCeremony}
            defaultExpanded
          />

          {hasTeamTie && (
            <div className="bg-amber-400/15 border border-amber-400/50 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-display font-bold text-amber-300 text-base">
                  ¡Empate en el primer lugar por equipos!
                </p>
                <p className="text-xs text-slate-300">
                  Lanza una pregunta extra de desempate con puntaje doble (x2) para definir al equipo ganador.
                </p>
              </div>
              <button
                type="button"
                onClick={() => sendPresenterAction('start_tiebreaker')}
                className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-sm inline-flex items-center gap-2 cursor-pointer"
              >
                <Scale className="w-4 h-4" />
                Iniciar Pregunta de Desempate (x2)
              </button>
            </div>
          )}

          {isChampionship && (
            <ChampionshipProgressPanel
              state={state}
              role="presenter"
              onPresenterAction={sendPresenterAction}
            />
          )}

          {isTeamConfigurable &&
            state.teamLeaderboard.length > 0 && (
              <TeamWinnerBanner teams={state.teamLeaderboard} />
            )}

          {state.teamLeaderboard.length > 0 && (
            <TeamLeaderboardStrip teams={state.teamLeaderboard} />
          )}

          <PodiumDisplay entries={state.leaderboard} />

          <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="font-display font-bold text-xl text-white">
              Clasificación Completa y Estadísticas
            </h3>
            <LeaderboardTable
              entries={state.leaderboard}
              customTeams={state.config.teams}
            />
          </div>

          {isReto &&
            state.retoState?.reviewItems &&
            state.retoState.reviewItems.length > 0 && (
              <div className="bg-[#111A2E] border border-teal-500/40 rounded-2xl p-6 space-y-4">
                <h3 className="font-display font-bold text-xl text-white inline-flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-teal-300" />
                  Resumen de Desafíos y Citas Bíblicas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {state.retoState.reviewItems.map((item) => (
                    <div
                      key={item.index}
                      className="bg-[#080E1E] border border-slate-800 rounded-xl p-4 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-amber-300">
                          #{item.index + 1} · {item.title}
                        </span>
                        <span className="text-sky-300 font-semibold">
                          {item.reference}
                        </span>
                      </div>
                      <p className="text-sm text-emerald-200">
                        {item.answerSummary}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {isLearning &&
            state.learningState?.completedCardsReview &&
            state.learningState.completedCardsReview.length > 0 && (
              <div className="bg-[#111A2E] border border-sky-500/40 rounded-2xl p-6 space-y-4">
                <h3 className="font-display font-bold text-xl text-white inline-flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-sky-300" />
                  Enseñanzas y Citas Bíblicas de Toda la Ronda
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {state.learningState.completedCardsReview.map((rc) => (
                    <div
                      key={rc.id}
                      className="bg-[#080E1E] border border-slate-800 rounded-xl p-4 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-sky-300">
                          #{rc.index + 1} · {rc.topicLabel} · {rc.bookOrSection}
                        </span>
                        <span className="font-bold text-amber-300">
                          {rc.reference}
                        </span>
                      </div>
                      <p className="font-semibold text-sm text-white">
                        {rc.prompt}
                      </p>
                      <p className="text-xs font-bold text-emerald-300">
                        Respuesta: {rc.options[rc.correctIndex]}
                      </p>
                      <p className="text-xs text-slate-300">
                        {rc.simpleExplanation}
                      </p>
                      <p className="text-xs text-emerald-200">
                        <strong className="text-emerald-300">Enseñanza:</strong>{' '}
                        {rc.mainTeaching}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          <QuestionReviewSection
            items={state.questionReview}
            customTeams={state.config.teams}
          />
        </div>
      )}
    </div>
  );
}
