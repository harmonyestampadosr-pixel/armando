import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Crown,
  Disc,
  LogOut,
  Users,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { useGameSocket } from '../hooks/useGameSocket';
import {
  DIFFICULTY_LABELS,
  GAME_MODE_INFO,
  getTeamDefinition,
} from '../shared/types';
import { soundFX, type DidacticAmbientMode } from '../utils/sound';
import { AdventureRoomPanel } from './AdventureRoomPanel';
import { AvatarBadge } from './AvatarBadge';
import { BattleArenaView } from './BattleArenaView';
import { ChampionshipProgressPanel } from './CampeonatoRondasView';
import { ConnectionStatusBadge } from './ConnectionStatusBadge';
import { CountdownTimer } from './CountdownTimer';
import { LearningMultiplayerRoomPanel } from './LearningMultiplayerRoomPanel';
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
  TeamLeaderboardStrip,
} from './ScoreboardViews';

interface PlayerViewProps {
  code: string;
  token: string;
  presenterToken?: string;
  onExit: (rejoinDirect?: boolean) => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];
const OPTION_STYLES = [
  'bg-sky-600 hover:bg-sky-500 border-sky-400/50 text-white',
  'bg-amber-600 hover:bg-amber-500 border-amber-400/50 text-white',
  'bg-emerald-600 hover:bg-emerald-500 border-emerald-400/50 text-white',
  'bg-rose-600 hover:bg-rose-500 border-rose-400/50 text-white',
];

export function PlayerView({
  code,
  token,
  presenterToken,
  onExit,
}: PlayerViewProps) {
  const {
    state,
    connectionStatus,
    reconnectNow,
    error,
    kickedMessage,
    clockOffsetMs,
    sendParticipantAction,
    submitAnswer,
    submitMysteryGuess,
    submitRetoAttempt,
    submitSaturdayChallenge,
    submitSaturdayRoulette,
    submitTalentVote,
    submitAdventureChoice,
  } = useGameSocket({
    code,
    role: 'participant',
    token,
    presenterToken,
  });

  const [sfxDisabled, setSfxDisabled] = useState(
    () => !soundFX.getSnapshot().prefs.sfxEnabled
  );
  const lastSoundKeyRef = useRef<string>('');

  useEffect(() => {
    return soundFX.subscribe((snap) => {
      setSfxDisabled(!snap.prefs.sfxEnabled);
    });
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

  const toggleMute = () => {
    soundFX.toggleSfx();
  };

  useEffect(() => {
    if (!state) return;
    const key = `${state.status}-${state.currentQuestionIndex}`;
    if (key === lastSoundKeyRef.current) return;

    const satSub = state.saturdayChallengeState?.mySubmission;
    if (
      satSub &&
      state.saturdayChallengeState?.currentChallenge?.evaluationType ===
        'director_review' &&
      satSub.validationStatus !== 'pending'
    ) {
      const satGradeKey = `sat-${state.currentQuestionIndex}-${satSub.validationStatus}`;
      if (satGradeKey !== lastSoundKeyRef.current) {
        lastSoundKeyRef.current = satGradeKey;
        if (satSub.validationStatus === 'rejected') {
          soundFX.playDiscreetError();
        } else {
          soundFX.playMysterySolved();
        }
      }
    }

    const satRouletteSub = state.saturdayRouletteState?.mySubmission;
    if (
      satRouletteSub &&
      state.saturdayRouletteState?.currentActivity?.evaluationType ===
        'director_review' &&
      satRouletteSub.validationStatus !== 'pending'
    ) {
      const satRKey = `satr-${state.saturdayRouletteState.spinsCount}-${satRouletteSub.validationStatus}`;
      if (satRKey !== lastSoundKeyRef.current) {
        lastSoundKeyRef.current = satRKey;
        if (satRouletteSub.validationStatus === 'rejected') {
          soundFX.playDiscreetError();
        } else {
          soundFX.playMysterySolved();
        }
      }
    }

    if (state.status === 'answer_revealed') {
      if (state.saturdayRouletteState?.mySubmission) {
        lastSoundKeyRef.current = key;
        const srSub = state.saturdayRouletteState.mySubmission;
        if (
          srSub.isAutoCorrect ||
          srSub.validationStatus === 'approved' ||
          srSub.validationStatus === 'featured' ||
          srSub.validationStatus === 'participation'
        ) {
          soundFX.playCorrect();
        } else {
          soundFX.playDiscreetError();
        }
      } else if (state.saturdayChallengeState?.mySubmission) {
        lastSoundKeyRef.current = key;
        const sSub = state.saturdayChallengeState.mySubmission;
        if (
          sSub.isAutoCorrect ||
          sSub.validationStatus === 'approved' ||
          sSub.validationStatus === 'featured' ||
          sSub.validationStatus === 'participation'
        ) {
          soundFX.playCorrect();
        } else {
          soundFX.playDiscreetError();
        }
      } else if (state.retoState?.mySubmission?.submitted) {
        lastSoundKeyRef.current = key;
        const mySub = state.retoState.mySubmission;
        if (mySub.isCorrect) {
          if (state.retoState.kind === 'crucigrama_biblico') {
            soundFX.playCrosswordComplete();
          } else if (state.retoState.kind === 'palabras_desordenadas') {
            soundFX.playWordSolved();
          } else if (state.retoState.kind === 'completa_versiculo') {
            soundFX.playVerseCorrect();
          } else {
            soundFX.playPuzzleComplete();
          }
        } else {
          soundFX.playDiscreetError();
        }
      } else if (state.myCurrentAnswer) {
        lastSoundKeyRef.current = key;
        if (state.config.mode === 'aprende_biblia') {
          if (state.myCurrentAnswer.isCorrect) {
            soundFX.playLessonComplete();
          } else {
            soundFX.playStudyNote();
          }
        } else if (
          state.config.mode === 'quien_soy' ||
          state.config.mode === 'misterio_biblico'
        ) {
          if (state.myCurrentAnswer.isCorrect) {
            soundFX.playMysterySolved();
          } else {
            soundFX.playDiscreetError();
          }
        } else if (state.myCurrentAnswer.isCorrect) {
          soundFX.playCorrect();
        } else {
          soundFX.playWrong();
        }
      }
    } else if (state.status === 'finished') {
      lastSoundKeyRef.current = key;
      soundFX.playVictory();
      confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
    }
  }, [state]);

  if (kickedMessage) {
    const canRejoinDirect =
      typeof window !== 'undefined' &&
      /^\/(?:partida|unirse|join)\//i.test(window.location.pathname);
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-5">
        <div className="bg-[#111A2E] border border-rose-500/50 rounded-2xl p-8 space-y-4">
          <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto" />
          <h2 className="font-display text-2xl font-bold text-white">
            Has salido de la partida
          </h2>
          <p className="text-slate-300 text-sm">{kickedMessage}</p>
          <div className="space-y-2">
            {canRejoinDirect && (
              <button
                type="button"
                onClick={() => onExit(true)}
                className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm cursor-pointer"
              >
                Ingresar de nuevo como invitado
              </button>
            )}
            <button
              type="button"
              onClick={() => onExit(false)}
              className={`w-full py-3 rounded-xl font-bold text-sm cursor-pointer ${
                canRejoinDirect
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  : 'bg-amber-400 text-slate-950'
              }`}
            >
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!state || !state.myParticipant) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-8 space-y-4">
          <div className="flex justify-center">
            <ConnectionStatusBadge status={connectionStatus} />
          </div>
          <p className="text-white font-semibold">
            {error ||
              (connectionStatus === 'offline'
                ? 'Sin conexión con el servidor. Verifica tu internet.'
                : connectionStatus === 'unavailable'
                  ? `La partida ${code} no está disponible.`
                  : 'Conectando en tiempo real a la partida...')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {connectionStatus !== 'connecting' && (
              <button
                type="button"
                onClick={reconnectNow}
                className="px-4 py-2 rounded-lg bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer"
              >
                Reintentar
              </button>
            )}
            <button
              type="button"
              onClick={() => onExit(false)}
              className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm cursor-pointer"
            >
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state.config.mode === 'batalla_1v1') {
    return (
      <BattleArenaView
        code={code}
        playerToken={token}
        presenterToken={presenterToken}
        onExit={onExit}
      />
    );
  }

  const me = state.myParticipant;
  const myRank =
    state.leaderboard.find((e) => e.participantId === me.id)?.rank ?? 1;
  const myTeam = me.teamId
    ? getTeamDefinition(me.teamId, state.config.teams)
    : undefined;
  const q = state.currentQuestion;
  const myAns = state.myCurrentAnswer;
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
  const isCaptain = state.teamLeaderboard.some(
    (t) => t.captainParticipantId === me.id
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 pb-12 space-y-5">
      {/* Top Player HUD */}
      <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <AvatarBadge
            avatarId={me.avatarId}
            photoUrl={me.photoUrl}
            name={me.name}
            size="md"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="font-display font-bold text-white truncate">
                {me.name}
              </p>
              {isCaptain && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/50 text-[10px] font-bold text-amber-300 shrink-0">
                  <Crown className="w-3 h-3" />
                  Capitán
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>{code}</span>
              <span aria-hidden="true">·</span>
              <span>Puesto #{myRank}</span>
              {myTeam && (
                <>
                  <span aria-hidden="true">·</span>
                  <span style={{ color: myTeam.color }}>{myTeam.name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="font-mono-num font-extrabold text-xl text-amber-300">
              {me.score.toLocaleString('es-CO')}
            </p>
            <div className="flex justify-end">
              <ConnectionStatusBadge status={connectionStatus} compact />
            </div>
          </div>
          <button
            type="button"
            onClick={toggleMute}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
            aria-label={sfxDisabled ? 'Activar efectos de sonido' : 'Silenciar efectos'}
            title={sfxDisabled ? 'Activar efectos de sonido' : 'Silenciar efectos'}
          >
            {sfxDisabled ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => onExit(false)}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
            title="Salir de la partida"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Eliminated Banner */}
      {me.eliminated && state.status !== 'finished' && (
        <div className="bg-rose-500/15 border border-rose-500/50 rounded-2xl p-4 text-rose-200 text-sm">
          {isChampionship
            ? 'No avanzaste a la siguiente fase del campeonato, pero todas tus estadísticas y puntos anteriores quedan guardados. Puedes seguir viendo la competencia en vivo.'
            : 'Has quedado eliminado en esta partida de Modo Eliminación. Puedes seguir viendo el progreso de la competencia en vivo.'}
        </div>
      )}

      {/* WAITING ROOM */}
      {state.status === 'waiting' && (
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 sm:p-8 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-400/15 text-amber-300 flex items-center justify-center mx-auto">
            {isRoulette ? <Disc className="w-7 h-7" /> : <Clock className="w-7 h-7" />}
          </div>
          <div className="space-y-1.5">
            <h2 className="font-display text-2xl font-extrabold text-white">
              {state.config.title}
            </h2>
            <p className="text-sm text-slate-400">
              {GAME_MODE_INFO[state.config.mode].name} ·{' '}
              {isRoulette
                ? `${state.config.questionCount} giros de ruleta`
                : `${state.totalQuestions} preguntas`}
            </p>
          </div>

          <div className="bg-[#080E1E] border border-slate-800 rounded-xl p-4">
            <p className="text-base font-semibold text-sky-300">
              ¡Ya estás dentro! Esperando que el presentador inicie el concurso.
            </p>
            <p className="text-xs text-slate-400 mt-1.5 inline-flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              {state.participants.length} participantes en sala de espera
            </p>
          </div>

          {isTeamConfigurable &&
            state.teamLeaderboard.length > 0 && (
              <div className="bg-[#080E1E] border border-slate-800 rounded-xl p-4 text-left space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Tu equipo actual
                  </span>
                  {myTeam && (
                    <span
                      className="text-xs font-bold"
                      style={{ color: myTeam.color }}
                    >
                      {myTeam.name}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {state.teamLeaderboard.map((t) => {
                    const isMine = me.teamId === t.teamId;
                    const isFull =
                      typeof t.capacity === 'number' &&
                      t.memberCount >= t.capacity;
                    return (
                      <button
                        key={t.teamId}
                        type="button"
                        disabled={isMine || isFull}
                        onClick={() =>
                          sendParticipantAction('select_team', {
                            teamId: t.teamId,
                          })
                        }
                        className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 transition-colors ${
                          isMine
                            ? 'bg-emerald-500/15 border-emerald-400 text-white'
                            : isFull
                              ? 'bg-[#111A2E]/60 border-slate-800 opacity-50 cursor-not-allowed'
                              : 'bg-[#111A2E] border-slate-800 text-slate-300 hover:border-slate-600 cursor-pointer'
                        }`}
                      >
                        <span className="truncate" style={{ color: t.color }}>
                          {t.name}
                        </span>
                        <span className="font-mono-num text-slate-400 shrink-0">
                          {t.capacity
                            ? `${t.memberCount}/${t.capacity}`
                            : t.memberCount}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
        </div>
      )}

      {/* PAUSED */}
      {state.status === 'paused' && (
        <div className="bg-[#111A2E] border border-amber-400/50 rounded-2xl p-8 text-center space-y-3">
          <h2 className="font-display text-2xl font-bold text-amber-300">
            Concurso en Pausa
          </h2>
          <p className="text-sm text-slate-300">
            El presentador ha pausado temporalmente la partida. Tu puntaje está
            seguro.
          </p>
        </div>
      )}

      {/* ACTIVE / LOCKED / REVEALED QUESTION */}
      {(state.status === 'question_active' ||
        state.status === 'question_locked' ||
        state.status === 'answer_revealed') &&
        (q || isMystery || isReto || isLearning || isRetosSabado || isRuletaSabado || isTalentos || isAventuras) && (
          <div className="space-y-5">
            {isTeamConfigurable &&
              state.teamLeaderboard.length > 0 && (
                <TeamLeaderboardStrip teams={state.teamLeaderboard} />
              )}

            {isChampionship && (
              <ChampionshipProgressPanel state={state} role="participant" />
            )}

            {isRoulette && state.rouletteState && (
              <div className="bg-[#111A2E] border border-amber-400/40 rounded-2xl p-3.5 flex items-center gap-4">
                <RouletteWheelGraphic
                  angleDeg={state.rouletteState.targetAngleDeg}
                  spinning={false}
                  size={76}
                />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                    Ruleta Bíblica · Giro #{state.rouletteState.spinsCount}
                  </p>
                  <p className="font-display font-bold text-base text-white truncate">
                    {state.rouletteState.selectedCategoryLabel || 'Categoría en vivo'}
                  </p>
                </div>
              </div>
            )}

            {isMystery ? (
              <MysteryMultiplayerRoomPanel
                state={state}
                role="participant"
                clockOffsetMs={clockOffsetMs}
                onSubmitMysteryGuess={submitMysteryGuess}
              />
            ) : isReto ? (
              <RetoMultiplayerRoomPanel
                state={state}
                role="participant"
                clockOffsetMs={clockOffsetMs}
                onSubmitRetoAttempt={submitRetoAttempt}
              />
            ) : isLearning ? (
              <LearningMultiplayerRoomPanel
                state={state}
                role="participant"
                clockOffsetMs={clockOffsetMs}
                onSubmitAnswer={submitAnswer}
              />
            ) : isRetosSabado ? (
              <SaturdayChallengeRoomPanel
                state={state}
                role="participant"
                clockOffsetMs={clockOffsetMs}
                onSubmitChallenge={submitSaturdayChallenge}
              />
            ) : isRuletaSabado ? (
              <SaturdayRouletteRoomPanel
                state={state}
                role="participant"
                clockOffsetMs={clockOffsetMs}
                onSubmitRoulette={submitSaturdayRoulette}
              />
            ) : isTalentos ? (
              <TalentRoomPanel
                state={state}
                role="participant"
                clockOffsetMs={clockOffsetMs}
                onSubmitTalentVote={submitTalentVote}
              />
            ) : isAventuras ? (
              <AdventureRoomPanel
                state={state}
                role="participant"
                onSubmitChoice={submitAdventureChoice}
              />
            ) : q ? (
              <>
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-4">
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
                        Puntaje x{q.isSpecialMultiplier}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {q.roundStage && (
                <p className="text-xs font-semibold text-amber-300">
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

              <h2 className="font-display text-xl sm:text-2xl font-bold text-white leading-snug pt-1">
                {q.prompt}
              </h2>
            </div>

            {/* Answer Buttons */}
            <div
              className={`grid gap-3 ${
                q.options.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
              }`}
            >
              {q.options.map((opt, idx) => {
                const isSelected = myAns?.selectedIndex === idx;
                const isRevealed = state.status === 'answer_revealed';
                const isCorrectOpt = isRevealed && q.correctIndex === idx;
                const canTap =
                  state.status === 'question_active' && !myAns && !me.eliminated;

                let btnClass = OPTION_STYLES[idx % OPTION_STYLES.length];
                if (isRevealed) {
                  if (isCorrectOpt) {
                    btnClass =
                      'bg-emerald-600 border-emerald-300 text-white ring-2 ring-emerald-300';
                  } else if (isSelected && !isCorrectOpt) {
                    btnClass =
                      'bg-rose-700 border-rose-400 text-white opacity-90';
                  } else {
                    btnClass =
                      'bg-slate-800/80 border-slate-700 text-slate-400 opacity-55';
                  }
                } else if (myAns) {
                  btnClass = isSelected
                    ? 'bg-sky-600 border-white text-white ring-2 ring-white'
                    : 'bg-slate-800/70 border-slate-700 text-slate-400 opacity-50';
                } else if (state.status === 'question_locked' || me.eliminated) {
                  btnClass =
                    'bg-slate-800/70 border-slate-700 text-slate-400 opacity-60';
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={!canTap}
                    onClick={() => {
                      soundFX.playLock();
                      submitAnswer(state.currentQuestionIndex, idx);
                    }}
                    className={`w-full min-h-[60px] p-4 rounded-2xl border text-left flex items-center gap-3.5 transition-all ${
                      canTap ? 'cursor-pointer active:scale-[0.99]' : 'cursor-default'
                    } ${btnClass}`}
                  >
                    <span className="w-9 h-9 rounded-xl bg-black/25 font-mono-num font-bold text-base flex items-center justify-center shrink-0">
                      {OPTION_LETTERS[idx]}
                    </span>
                    <span className="font-semibold text-base sm:text-lg leading-snug flex-1">
                      {opt}
                    </span>
                    {isRevealed && isCorrectOpt && (
                      <CheckCircle2 className="w-6 h-6 text-white shrink-0" />
                    )}
                    {isRevealed && isSelected && !isCorrectOpt && (
                      <XCircle className="w-6 h-6 text-white shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Locked Feedback */}
            {state.status === 'question_active' && myAns && (
              <div className="bg-sky-500/15 border border-sky-400/50 rounded-xl p-4 text-center text-sky-200 text-sm font-medium">
                ¡Respuesta registrada! Esperando a que termine el tiempo o el
                presentador revele la respuesta correcta.
              </div>
            )}

            {state.status === 'question_locked' && !myAns && !me.eliminated && (
              <div className="bg-amber-500/15 border border-amber-400/50 rounded-xl p-4 text-center text-amber-200 text-sm font-medium">
                Tiempo finalizado. Esperando que el presentador muestre la
                respuesta correcta.
              </div>
            )}

            {/* Revealed Feedback + Reference */}
            {state.status === 'answer_revealed' && (
              <div className="bg-[#111A2E] border border-slate-700 rounded-2xl p-5 space-y-3">
                {myAns ? (
                  myAns.isCorrect ? (
                    <div className="flex items-center justify-between gap-3 text-emerald-300">
                      <span className="font-display font-bold text-lg flex items-center gap-2">
                        <CheckCircle2 className="w-6 h-6" />
                        ¡Respuesta Correcta!
                      </span>
                      <span className="font-mono-num font-extrabold text-xl text-amber-300">
                        +{(myAns.pointsEarned ?? 0).toLocaleString('es-CO')} pts
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-rose-300 font-display font-bold text-lg">
                      <XCircle className="w-6 h-6" />
                      Respuesta Incorrecta (+0 pts)
                    </div>
                  )
                ) : (
                  <p className="text-slate-300 font-semibold">
                    No enviaste respuesta a tiempo (+0 pts)
                  </p>
                )}

                {q.reference && (
                  <div className="pt-2 border-t border-slate-800 text-sm text-slate-300 space-y-1">
                    <p className="font-semibold text-amber-300 inline-flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4" />
                      Cita bíblica: {q.reference}
                    </p>
                    {q.explanation && (
                      <p className="text-slate-400 text-xs sm:text-sm">
                        {q.explanation}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
              </>
            ) : null}
          </div>
        )}

      {/* FINISHED */}
      {state.status === 'finished' && (
        <div className="space-y-6">
          <div className="bg-[#111A2E] border border-amber-400/50 rounded-2xl p-6 text-center space-y-3">
            <AvatarBadge
              avatarId={me.avatarId}
              photoUrl={me.photoUrl}
              name={me.name}
              size="xl"
              className="mx-auto"
            />
            <Award className="w-8 h-8 text-amber-400 mx-auto" />
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
              ¡Concurso Finalizado!
            </h2>
            <p className="text-slate-300 text-sm">
              Terminaste en el puesto{' '}
              <strong className="text-amber-300 font-mono-num">#{myRank}</strong>{' '}
              con{' '}
              <strong className="text-amber-300 font-mono-num">
                {me.score.toLocaleString('es-CO')} puntos
              </strong>{' '}
              ({me.correctCount}/{me.answeredCount} correctas).
            </p>
          </div>

          {isChampionship && (
            <ChampionshipProgressPanel state={state} role="participant" />
          )}

          {isTeamConfigurable &&
            state.teamLeaderboard.length > 0 && (
              <TeamWinnerBanner teams={state.teamLeaderboard} />
            )}

          {state.teamLeaderboard.length > 0 && (
            <TeamLeaderboardStrip teams={state.teamLeaderboard} />
          )}

          <PodiumDisplay entries={state.leaderboard} />

          <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 className="font-display font-bold text-lg text-white">
              Clasificación General
            </h3>
            <LeaderboardTable
              entries={state.leaderboard}
              highlightParticipantId={me.id}
              customTeams={state.config.teams}
            />
          </div>

          {isReto &&
            state.retoState?.reviewItems &&
            state.retoState.reviewItems.length > 0 && (
              <div className="bg-[#111A2E] border border-teal-500/40 rounded-2xl p-5 space-y-3">
                <h3 className="font-display font-bold text-lg text-white inline-flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-teal-300" />
                  Resumen de Desafíos y Citas Bíblicas
                </h3>
                <div className="space-y-2">
                  {state.retoState.reviewItems.map((item) => (
                    <div
                      key={item.index}
                      className="bg-[#080E1E] border border-slate-800 rounded-xl p-3.5 space-y-1"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-amber-300">
                          #{item.index + 1} · {item.title}
                        </span>
                        <span className="text-sky-300 font-semibold">
                          {item.reference}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-emerald-200">
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
              <div className="bg-[#111A2E] border border-sky-500/40 rounded-2xl p-5 space-y-4">
                <h3 className="font-display font-bold text-lg text-white inline-flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-sky-300" />
                  Enseñanzas y Citas Bíblicas de la Ronda
                </h3>
                <div className="space-y-3">
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
                        Respuesta correcta: {rc.options[rc.correctIndex]}
                      </p>
                      <p className="text-xs text-slate-300">
                        {rc.simpleExplanation}
                      </p>
                      <p className="text-xs text-slate-400">
                        <strong className="text-indigo-300">Contexto:</strong>{' '}
                        {rc.context}
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
