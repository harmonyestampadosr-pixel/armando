import { useCallback, useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Crown,
  Disc,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
  Trophy,
  Tv,
  Users,
  WifiOff,
} from 'lucide-react';
import { useGameSocket } from '../hooks/useGameSocket';
import { DIFFICULTY_LABELS, GAME_MODE_INFO } from '../shared/types';
import { soundFX, type DidacticAmbientMode } from '../utils/sound';
import { AdventureRoomPanel } from './AdventureRoomPanel';
import { AudioControls } from './AudioControls';
import { AvatarBadge } from './AvatarBadge';
import { ChampionshipProgressPanel } from './CampeonatoRondasView';
import { ConnectionStatusBadge } from './ConnectionStatusBadge';
import { CountdownTimer } from './CountdownTimer';
import { LearningMultiplayerRoomPanel } from './LearningMultiplayerRoomPanel';
import { ProjectorAnnouncerStage } from './ProjectorAnnouncerStage';
import { QrCodeCard } from './QrCodeCard';
import { TeamWinnerBanner } from './QuestionReviewSection';
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

interface ProjectorViewProps {
  code: string;
  onBack?: () => void;
  onReturnToPresenter?: () => void;
  onSelectCode?: (newCode: string) => void;
}

type ProjectorPrecheckStatus =
  | 'empty'
  | 'checking'
  | 'not_found'
  | 'offline'
  | 'finished_prompt'
  | 'ready';

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];
const OPTION_CARD_CLASSES = [
  'bg-sky-600/25 border-sky-400/50 text-white',
  'bg-amber-600/25 border-amber-400/50 text-white',
  'bg-emerald-600/25 border-emerald-400/50 text-white',
  'bg-rose-600/25 border-rose-400/50 text-white',
];

export function ProjectorView({
  code,
  onBack,
  onReturnToPresenter,
  onSelectCode,
}: ProjectorViewProps) {
  const cleanCode = code.trim().toUpperCase();
  const [precheckStatus, setPrecheckStatus] =
    useState<ProjectorPrecheckStatus>(() => (cleanCode ? 'checking' : 'empty'));
  const [precheckMessage, setPrecheckMessage] = useState<string>('');
  const [precheckGameTitle, setPrecheckGameTitle] = useState<string>('');
  const [manualCodeInput, setManualCodeInput] = useState(cleanCode);
  const [showCodeSwitcher, setShowCodeSwitcher] = useState(false);

  const verifyRoomBeforeConnect = useCallback(async (target: string) => {
    const normalized = target.trim().toUpperCase();
    if (!normalized) {
      setPrecheckStatus('empty');
      setPrecheckMessage(
        'El código está vacío. Ingresa el código real de la partida para abrir la proyección.'
      );
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setPrecheckStatus('offline');
      setPrecheckMessage(
        'Sin conexión con el servidor. Verifica tu conexión a internet o red local.'
      );
      return;
    }

    setPrecheckStatus('checking');
    setPrecheckMessage('');
    try {
      const res = await fetch(
        `/api/games/${encodeURIComponent(normalized)}/exists`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPrecheckStatus(res.status === 400 ? 'empty' : 'not_found');
        setPrecheckMessage(
          data.error ||
            `No existe ninguna partida con el código "${normalized}". Verifica que el código sea correcto.`
        );
        return;
      }
      setPrecheckGameTitle(data.title || '');
      if (data.status === 'finished') {
        setPrecheckStatus('finished_prompt');
        setPrecheckMessage(
          `La partida "${data.title || normalized}" (${data.code || normalized}) ya ha terminado.`
        );
        return;
      }
      setPrecheckStatus('ready');
    } catch {
      setPrecheckStatus('offline');
      setPrecheckMessage(
        'No se pudo conectar con el servidor. Verifica tu conexión e inténtalo nuevamente.'
      );
    }
  }, []);

  useEffect(() => {
    setManualCodeInput(cleanCode);
    setShowCodeSwitcher(false);
    verifyRoomBeforeConnect(cleanCode);
  }, [cleanCode, verifyRoomBeforeConnect]);

  const { state, connectionStatus, reconnectNow, error, clockOffsetMs } =
    useGameSocket({
      code: cleanCode,
      role: 'projector',
      enabled: precheckStatus === 'ready' && Boolean(cleanCode),
    });

  const celebratedRef = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      setIsFullscreen((v) => !v);
    }
  };

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

  useEffect(() => {
    if (state?.status === 'finished' && !celebratedRef.current) {
      celebratedRef.current = true;
      confetti({ particleCount: 140, spread: 90, origin: { y: 0.6 } });
    }
    if (state?.status === 'waiting') {
      celebratedRef.current = false;
    }
  }, [state?.status]);

  const handleSubmitCode = (e: React.FormEvent) => {
    e.preventDefault();
    const next = manualCodeInput.trim().toUpperCase();
    if (!next) {
      setPrecheckStatus('empty');
      setPrecheckMessage(
        'El código está vacío. Ingresa el código real de la partida.'
      );
      return;
    }
    if (onSelectCode && next !== cleanCode) {
      onSelectCode(next);
    } else {
      verifyRoomBeforeConnect(next);
    }
  };

  if (precheckStatus !== 'ready') {
    return (
      <div className="min-h-screen bg-[#080E1E] flex items-center justify-center px-6 py-10">
        <div className="bg-[#111A2E] border border-slate-800 rounded-3xl p-8 sm:p-10 text-center max-w-lg w-full space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-sky-500/15 border border-sky-400/40 flex items-center justify-center mx-auto text-sky-400">
            {precheckStatus === 'checking' ? (
              <Loader2 className="w-7 h-7 animate-spin" />
            ) : precheckStatus === 'offline' ? (
              <WifiOff className="w-7 h-7 text-rose-400" />
            ) : precheckStatus === 'not_found' ? (
              <AlertCircle className="w-7 h-7 text-rose-400" />
            ) : (
              <Tv className="w-7 h-7 text-amber-400" />
            )}
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
              Pantalla de Proyección
            </h1>
            <p className="text-sm sm:text-base text-slate-300">
              {precheckStatus === 'checking'
                ? `Cargando sala ${cleanCode}...`
                : precheckMessage ||
                  'Ingresa el código real de la partida para proyectar en televisor o videobeam.'}
            </p>
          </div>

          {precheckStatus === 'finished_prompt' && (
            <div className="bg-amber-500/15 border border-amber-400/50 rounded-2xl p-4 space-y-3">
              <p className="text-xs sm:text-sm text-amber-100">
                La partida <strong>{precheckGameTitle || cleanCode}</strong> ya ha terminado. Puedes ver los resultados finales o abrir otra partida activa.
              </p>
              <button
                type="button"
                onClick={() => setPrecheckStatus('ready')}
                className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-sm cursor-pointer"
              >
                Ver resultados finales en proyección
              </button>
            </div>
          )}

          {precheckStatus === 'offline' && (
            <button
              type="button"
              onClick={() => verifyRoomBeforeConnect(cleanCode)}
              className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Reintentar conexión
            </button>
          )}

          {precheckStatus !== 'checking' && (
            <form onSubmit={handleSubmitCode} className="space-y-3 text-left pt-2">
              <label
                htmlFor="projector-code-entry"
                className="block text-xs font-semibold text-slate-400"
              >
                Código real de la partida
              </label>
              <div className="flex gap-2">
                <input
                  id="projector-code-entry"
                  type="text"
                  value={manualCodeInput}
                  onChange={(e) =>
                    setManualCodeInput(
                      e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                    )
                  }
                  placeholder="Ej: BIBLIA2026"
                  className="flex-1 bg-[#080E1E] border border-slate-700 rounded-xl px-4 py-3 text-amber-300 font-mono-num font-bold text-base tracking-wider placeholder-slate-500 focus:outline-none focus:border-sky-400"
                />
                <button
                  type="submit"
                  className="px-5 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm cursor-pointer whitespace-nowrap"
                >
                  Abrir
                </button>
              </div>
            </form>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {onReturnToPresenter && (
              <button
                type="button"
                onClick={onReturnToPresenter}
                className="px-4 py-2 rounded-xl bg-amber-400/15 border border-amber-400/40 text-amber-200 text-xs sm:text-sm font-semibold cursor-pointer inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver al Presentador
              </button>
            )}
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs sm:text-sm font-semibold cursor-pointer"
              >
                Volver al inicio
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="min-h-screen bg-[#080E1E] flex items-center justify-center px-6">
        <div className="bg-[#111A2E] border border-slate-800 rounded-3xl p-10 text-center max-w-lg w-full space-y-5">
          <div className="flex justify-center">
            <ConnectionStatusBadge status={connectionStatus} />
          </div>
          <h1 className="font-display text-2xl font-extrabold text-white">
            Pantalla de Proyección
          </h1>
          <p className="text-slate-300 text-sm sm:text-base">
            {error ||
              (connectionStatus === 'offline'
                ? 'Sin conexión con el servidor. Verifica tu red.'
                : connectionStatus === 'unavailable'
                  ? `La partida ${cleanCode} no está disponible.`
                  : `Cargando sala ${cleanCode}...`)}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {connectionStatus !== 'connecting' && (
              <button
                type="button"
                onClick={reconnectNow}
                className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Reintentar
              </button>
            )}
            {onReturnToPresenter && (
              <button
                type="button"
                onClick={onReturnToPresenter}
                className="px-4 py-2.5 rounded-xl bg-amber-400/15 border border-amber-400/40 text-amber-200 text-sm font-semibold cursor-pointer"
              >
                Volver al Presentador
              </button>
            )}
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm cursor-pointer"
              >
                Volver al inicio
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const q = state.currentQuestion;
  const isRevealed =
    state.status === 'answer_revealed' || state.status === 'finished';
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
  const isTeamsMode =
    state.config.mode === 'equipos' || isTeamConfigurable;

  return (
    <div className="min-h-screen bg-[#080E1E] text-white px-6 sm:px-10 py-6 flex flex-col gap-6 max-w-[1440px] mx-auto">
      {/* Broadcast Top Strip */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-4">
          <span className="font-display font-extrabold text-xl sm:text-2xl tracking-tight text-amber-400">
            DIME TÚ QUÉ DICES
          </span>
          <span className="text-slate-600" aria-hidden="true">
            |
          </span>
          <span className="font-display font-semibold text-lg text-white">
            {state.config.title}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
          <span>{GAME_MODE_INFO[state.config.mode].name}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-num font-bold text-amber-300">
            Código: {state.code}
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1.5 font-mono-num">
            <Users className="w-4 h-4 text-sky-400" />
            {state.participants.length} jugadores
          </span>
          <span aria-hidden="true">·</span>
          <ConnectionStatusBadge status={connectionStatus} />
          {state.status === 'finished' && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-amber-300 font-bold text-xs">
                Partida finalizada
              </span>
            </>
          )}
          <AudioControls compact />
          <button
            type="button"
            onClick={toggleFullscreen}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            title={
              isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'
            }
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {isFullscreen ? 'Salir' : 'Pantalla completa'}
            </span>
          </button>

          {!isFullscreen && onSelectCode && (
            <button
              type="button"
              onClick={() => setShowCodeSwitcher((v) => !v)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              Cambiar código
            </button>
          )}

          {!isFullscreen && onReturnToPresenter && (
            <button
              type="button"
              onClick={onReturnToPresenter}
              className="px-3 py-1.5 rounded-xl bg-amber-400/15 border border-amber-400/40 hover:bg-amber-400/25 text-amber-200 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Presentador
            </button>
          )}

          {!isFullscreen && onBack && !onReturnToPresenter && (
            <button
              type="button"
              onClick={onBack}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Inicio
            </button>
          )}
        </div>
      </header>

      {showCodeSwitcher && !isFullscreen && (
        <form
          onSubmit={handleSubmitCode}
          className="bg-[#111A2E] border border-slate-700 rounded-2xl p-4 flex flex-wrap items-center gap-3"
        >
          <span className="text-xs font-semibold text-slate-300">
            Proyectar otra partida:
          </span>
          <input
            type="text"
            value={manualCodeInput}
            onChange={(e) =>
              setManualCodeInput(
                e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
              )
            }
            placeholder="Código de partida"
            className="bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2 text-amber-300 font-mono-num font-bold text-sm focus:outline-none focus:border-sky-400"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs cursor-pointer"
          >
            Cambiar sala
          </button>
          <button
            type="button"
            onClick={() => setShowCodeSwitcher(false)}
            className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs cursor-pointer"
          >
            Cancelar
          </button>
        </form>
      )}

      {/* WAITING LOBBY FOR PROJECTION */}
      {state.status === 'waiting' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start flex-1 py-4">
          <div className="lg:col-span-5 space-y-5">
            <div className="space-y-2">
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white text-balance">
                ¡Escanea el QR o entra con el código para participar!
              </h2>
              <p className="text-slate-300 text-base">
                Participa en vivo desde tu celular o tableta. No necesitas
                contraseñas ni registro.
              </p>
            </div>
            <QrCodeCard
              code={state.code}
              gameId={state.gameId}
              title={state.config.title}
              showProjectorLink={false}
            />
          </div>

          <div className="lg:col-span-7 bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl font-bold text-white">
                Participantes en Sala de Espera
              </h3>
              <span className="font-mono-num text-xl font-bold text-sky-300">
                {state.participants.length} conectados
              </span>
            </div>

            {state.participants.length === 0 ? (
              <div className="py-20 text-center text-slate-400 text-lg border border-dashed border-slate-800 rounded-2xl">
                Esperando a los primeros concursantes...
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {state.participants.map((p) => (
                  <div
                    key={p.id}
                    className="bg-[#080E1E] border border-slate-800 rounded-xl p-3 flex items-center gap-3"
                  >
                    <AvatarBadge
                      avatarId={p.avatarId}
                      photoUrl={p.photoUrl}
                      name={p.name}
                      size="md"
                    />
                    <span className="font-semibold text-sm sm:text-base text-white truncate">
                      {p.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PAUSED */}
      {state.status === 'paused' && (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="bg-[#111A2E] border border-amber-400/50 rounded-3xl p-12 text-center max-w-xl space-y-3">
            <h2 className="font-display text-4xl font-extrabold text-amber-300">
              Concurso en Pausa
            </h2>
            <p className="text-slate-300 text-lg">
              En unos instantes continuamos con la competencia.
            </p>
          </div>
        </div>
      )}

      {/* LIVE QUESTION & REVEAL */}
      {(state.status === 'question_active' ||
        state.status === 'question_locked' ||
        state.status === 'answer_revealed') &&
        (q || isMystery || isReto || isLearning || isRetosSabado || isRuletaSabado || isTalentos || isAventuras) && (
          <div className="space-y-6 flex-1">
            {isTeamsMode && state.teamLeaderboard.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Equipos Enfrentados en Vivo
                </p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {state.teamLeaderboard.map((t, idx) => (
                    <div
                      key={t.teamId}
                      className="bg-[#111A2E] rounded-2xl p-4 border-2 flex flex-col justify-between gap-2"
                      style={{ borderColor: t.color }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="font-display font-extrabold text-base truncate"
                          style={{ color: t.color }}
                        >
                          {t.name}
                        </span>
                        <span className="text-xs font-mono-num text-slate-400 shrink-0">
                          #{idx + 1}
                        </span>
                      </div>
                      <div className="flex items-end justify-between gap-2">
                        <div className="text-xs text-slate-400 truncate">
                          {t.captainName ? (
                            <span className="inline-flex items-center gap-1 text-amber-300">
                              <Crown className="w-3.5 h-3.5" />
                              {t.captainName}
                            </span>
                          ) : (
                            <span>{t.memberCount} integrantes</span>
                          )}
                        </div>
                        <span className="font-mono-num text-2xl font-extrabold text-white">
                          {t.score.toLocaleString('es-CO')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              state.teamLeaderboard.length > 0 && (
                <TeamLeaderboardStrip teams={state.teamLeaderboard} />
              )
            )}

            {isChampionship && (
              <ChampionshipProgressPanel state={state} role="projector" />
            )}

            {isRoulette && state.rouletteState && (
              <div className="bg-[#111A2E] border border-amber-400/50 rounded-3xl p-5 flex flex-wrap items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <RouletteWheelGraphic
                    angleDeg={state.rouletteState.targetAngleDeg}
                    spinning={false}
                    size={148}
                  />
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-300 inline-flex items-center gap-1.5">
                      <Disc className="w-4 h-4" />
                      Ruleta Bíblica en Vivo · Giro #{state.rouletteState.spinsCount}
                    </p>
                    <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                      {state.rouletteState.selectedCategoryLabel || 'Categoría en Juego'}
                    </h3>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono-num text-2xl font-extrabold text-sky-300">
                    {state.rouletteState.usedQuestionIds.length} / {state.config.questionCount}
                  </p>
                  <p className="text-xs text-slate-400">Giros realizados</p>
                </div>
              </div>
            )}

            {isMystery ? (
              <MysteryMultiplayerRoomPanel
                state={state}
                role="projector"
                clockOffsetMs={clockOffsetMs}
              />
            ) : isReto ? (
              <RetoMultiplayerRoomPanel
                state={state}
                role="projector"
                clockOffsetMs={clockOffsetMs}
              />
            ) : isLearning ? (
              <LearningMultiplayerRoomPanel
                state={state}
                role="projector"
                clockOffsetMs={clockOffsetMs}
              />
            ) : isRetosSabado ? (
              <SaturdayChallengeRoomPanel
                state={state}
                role="projector"
                clockOffsetMs={clockOffsetMs}
              />
            ) : isRuletaSabado ? (
              <SaturdayRouletteRoomPanel
                state={state}
                role="projector"
                clockOffsetMs={clockOffsetMs}
              />
            ) : isTalentos ? (
              <TalentRoomPanel
                state={state}
                role="projector"
                clockOffsetMs={clockOffsetMs}
              />
            ) : isAventuras ? (
              <AdventureRoomPanel state={state} role="projector" />
            ) : q ? (
              <div className="bg-[#111A2E] border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3 text-sm sm:text-base text-slate-300">
                    <span className="font-mono-num font-bold text-sky-300 text-lg">
                      Pregunta {state.currentQuestionIndex + 1} /{' '}
                      {state.totalQuestions}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{q.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{DIFFICULTY_LABELS[q.difficulty]}</span>
                    {q.isSpecialMultiplier > 1 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-bold text-amber-300">
                          Pregunta Especial x{q.isSpecialMultiplier}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="font-mono-num text-base sm:text-lg text-slate-200">
                    Han respondido:{' '}
                    <strong className="text-amber-300">
                      {state.answeredParticipantIds.length} /{' '}
                      {state.participants.length}
                    </strong>
                  </div>
                </div>

                {q.roundStage && (
                  <p className="text-sm font-bold text-amber-300">
                    {q.roundStage}
                  </p>
                )}

                <CountdownTimer
                  status={state.status}
                  questionEndsAt={state.questionEndsAt}
                  timeLimitSec={state.config.timeLimitSec}
                  remainingSecFallback={state.remainingSec}
                  clockOffsetMs={clockOffsetMs}
                  large
                  playAudioTicks
                />

                <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-white leading-tight text-balance">
                  {q.prompt}
                </h2>

                <div
                  className={`grid gap-4 pt-2 ${
                    q.options.length === 2
                      ? 'grid-cols-1 sm:grid-cols-2'
                      : 'grid-cols-1 sm:grid-cols-2'
                  }`}
                >
                  {q.options.map((opt, idx) => {
                    const isCorrect = isRevealed && q.correctIndex === idx;
                    const cardStyle = isRevealed
                      ? isCorrect
                        ? 'bg-emerald-600 border-emerald-300 text-white ring-2 ring-emerald-300'
                        : 'bg-slate-900/70 border-slate-800 text-slate-400 opacity-55'
                      : OPTION_CARD_CLASSES[idx % OPTION_CARD_CLASSES.length];

                    return (
                      <div
                        key={idx}
                        className={`p-5 rounded-2xl border flex items-center gap-4 transition-all ${cardStyle}`}
                      >
                        <span className="w-11 h-11 rounded-xl bg-black/30 font-mono-num font-bold text-xl flex items-center justify-center shrink-0">
                          {OPTION_LETTERS[idx]}
                        </span>
                        <span className="font-display font-bold text-lg sm:text-2xl leading-snug flex-1">
                          {opt}
                        </span>
                        {isCorrect && (
                          <CheckCircle2 className="w-7 h-7 text-white shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {isRevealed && q.reference && (
                  <div className="bg-[#080E1E] border border-emerald-500/40 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 text-amber-300 font-semibold text-base">
                      <BookOpen className="w-5 h-5 shrink-0" />
                      <span>Cita bíblica: {q.reference}</span>
                    </div>
                    {q.explanation && (
                      <p className="text-slate-300 text-sm">{q.explanation}</p>
                    )}
                  </div>
                )}
              </div>
            ) : null}

            {isRevealed &&
              q &&
              !isMystery &&
              !isReto &&
              !isLearning &&
              !isRetosSabado &&
              !isRuletaSabado && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-5">
                  <h3 className="font-display font-bold text-xl text-white">
                    Distribución y Resultados de la Pregunta
                  </h3>
                  <QuestionDistributionChart
                    options={q.options}
                    correctIndex={q.correctIndex}
                    stats={state.questionStats}
                    isRevealed
                  />
                  <div className="pt-3 border-t border-slate-800">
                    <QuestionResultsTable
                      stats={state.questionStats}
                      maxRows={12}
                    />
                  </div>
                </div>

                <div className="lg:col-span-5 bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-4">
                  <h3 className="font-display font-bold text-xl text-white flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    Top Clasificación en Vivo
                  </h3>
                  <LeaderboardTable
                    entries={state.leaderboard.slice(0, 8)}
                    compact={false}
                    customTeams={state.config.teams}
                  />
                </div>
              </div>
            )}
          </div>
        )}

      {/* FINAL CELEBRATION SCREEN */}
      {state.status === 'finished' && (
        <ProjectorAnnouncerStage
          state={state}
          renderFullSummary={() => (
            <div className="space-y-8 py-4">
              <div className="text-center space-y-2">
                <h2 className="font-display text-4xl sm:text-5xl font-extrabold text-white">
                  ¡Resultados Finales del Concurso!
                </h2>
                <p className="text-slate-300 text-lg">
                  {state.config.title} · {state.totalQuestions} preguntas completadas
                </p>
              </div>

              {isChampionship && (
                <ChampionshipProgressPanel state={state} role="projector" />
              )}

              {isTeamConfigurable &&
                state.teamLeaderboard.length > 0 && (
                  <TeamWinnerBanner teams={state.teamLeaderboard} />
                )}

              {state.teamLeaderboard.length > 0 && (
                <TeamLeaderboardStrip teams={state.teamLeaderboard} />
              )}

              <PodiumDisplay entries={state.leaderboard} />

              <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 max-w-4xl mx-auto space-y-4">
                <h3 className="font-display font-bold text-2xl text-white">
                  Tabla Final de Posiciones
                </h3>
                <LeaderboardTable
                  entries={state.leaderboard}
                  customTeams={state.config.teams}
                />
              </div>

              {isLearning &&
                state.learningState?.completedCardsReview &&
                state.learningState.completedCardsReview.length > 0 && (
                  <div className="bg-[#111A2E] border border-sky-500/40 rounded-2xl p-6 max-w-5xl mx-auto space-y-4">
                    <h3 className="font-display font-bold text-2xl text-white inline-flex items-center gap-2">
                      <BookOpen className="w-6 h-6 text-sky-300" />
                      Resumen de Enseñanzas Bíblicas de la Ronda
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {state.learningState.completedCardsReview.map((rc) => (
                        <div
                          key={rc.id}
                          className="bg-[#080E1E] border border-slate-800 rounded-xl p-4 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-bold text-sky-300">
                              #{rc.index + 1} · {rc.topicLabel}
                            </span>
                            <span className="font-bold text-amber-300">
                              {rc.reference}
                            </span>
                          </div>
                          <p className="font-semibold text-base text-white">
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
            </div>
          )}
        />
      )}
    </div>
  );
}
