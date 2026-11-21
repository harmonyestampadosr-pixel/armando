import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Crown,
  Flag,
  LogOut,
  Pause,
  Play,
  RotateCcw,
  Scale,
  Swords,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { useGameSocket } from '../hooks/useGameSocket';
import { DIFFICULTY_LABELS } from '../shared/types';
import { soundFX } from '../utils/sound';
import { AvatarBadge } from './AvatarBadge';
import { CountdownTimer } from './CountdownTimer';
import { QrCodeCard } from './QrCodeCard';
import { QuestionReviewSection } from './QuestionReviewSection';

interface BattleArenaViewProps {
  code: string;
  playerToken: string;
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

export function BattleArenaView({
  code,
  playerToken,
  presenterToken,
  onExit,
}: BattleArenaViewProps) {
  const {
    state,
    connected,
    error,
    kickedMessage,
    clockOffsetMs,
    sendPresenterAction,
    sendParticipantAction,
    submitAnswer,
  } = useGameSocket({
    code,
    role: 'participant',
    token: playerToken,
    presenterToken,
  });

  const isCreator = Boolean(presenterToken);
  const lastSoundKeyRef = useRef<string>('');
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    soundFX.setWelcomeMusicActive(!state || state.status === 'waiting');
  }, [state?.status]);

  useEffect(() => {
    if (!state) return;
    const key = `${state.status}-${state.currentQuestionIndex}`;
    if (key === lastSoundKeyRef.current) return;

    if (state.status === 'answer_revealed' && state.myCurrentAnswer) {
      lastSoundKeyRef.current = key;
      if (state.myCurrentAnswer.isCorrect) {
        soundFX.playCorrect();
      } else {
        soundFX.playWrong();
      }
    } else if (state.status === 'finished') {
      lastSoundKeyRef.current = key;
      soundFX.playVictory();
      confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });
    }
  }, [state]);

  if (kickedMessage) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-5">
        <div className="bg-[#111A2E] border border-rose-500/50 rounded-2xl p-8 space-y-4">
          <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto" />
          <h2 className="font-display text-2xl font-bold text-white">
            Has salido de la batalla
          </h2>
          <p className="text-slate-300 text-sm">{kickedMessage}</p>
          <button
            type="button"
            onClick={() => onExit(false)}
            className="w-full py-3 rounded-xl bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  if (!state || !state.myParticipant) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-8 space-y-4">
          <p className="text-white font-semibold">
            {error || 'Conectando a la arena de Batalla 1 contra 1...'}
          </p>
          <button
            type="button"
            onClick={() => onExit(false)}
            className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm cursor-pointer"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  const me = state.myParticipant;
  const sortedPlayers = [...state.participants].sort(
    (a, b) => a.joinedAt - b.joinedAt
  );
  const p1 = sortedPlayers[0] || me;
  const p2 = sortedPlayers[1] || null;
  const bothJoined = sortedPlayers.length >= 2;
  const bothReady = bothJoined && sortedPlayers.every((p) => p.ready !== false);

  const q = state.currentQuestion;
  const myAns = state.myCurrentAnswer;
  const isRevealed =
    state.status === 'answer_revealed' || state.status === 'finished';

  const getAvgSeconds = (answeredCount: number, totalResponseMs: number) => {
    if (!answeredCount) return '0.0s';
    return `${(totalResponseMs / answeredCount / 1000).toFixed(1)}s`;
  };

  const getRoundAnswerFor = (pid: string) =>
    state.questionStats?.rows.find((r) => r.participantId === pid);

  // Determine final winner or exact tie
  const lb = state.leaderboard;
  const topA = lb[0];
  const topB = lb[1];
  const isTie = Boolean(topA && topB && topA.score === topB.score);
  const winner = !isTie ? topA : null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-14 space-y-6">
      {/* Header Bar */}
      <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5 text-amber-300 font-bold">
              <Swords className="w-3.5 h-3.5" />
              Batalla 1 contra 1
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num font-bold text-white">
              Código: {state.code}
            </span>
            <span aria-hidden="true">·</span>
            <span className={connected ? 'text-emerald-400' : 'text-rose-400'}>
              {connected ? 'En vivo' : 'Reconectando...'}
            </span>
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-white">
            {state.config.title}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isCreator &&
            state.status !== 'waiting' &&
            state.status !== 'finished' && (
              <>
                {state.status === 'paused' ? (
                  <button
                    type="button"
                    onClick={() => sendPresenterAction('resume_game')}
                    className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Reanudar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => sendPresenterAction('pause_game')}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    Pausar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => sendPresenterAction('end_game')}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Flag className="w-3.5 h-3.5" />
                  Finalizar
                </button>
              </>
            )}
          {isCreator && (
            <button
              type="button"
              onClick={() => setConfirmReset((v) => !v)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reiniciar
            </button>
          )}
          <button
            type="button"
            onClick={() => onExit(false)}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Salir
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/50 text-rose-200 text-sm">
          {error}
        </div>
      )}

      {confirmReset && isCreator && (
        <div className="bg-amber-500/15 border border-amber-400/60 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-amber-100 font-medium">
            ¿Reiniciar la batalla? Ambos puntajes volverán a 0 y se generarán
            preguntas nuevas.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-200 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                sendPresenterAction('reset_game');
                setConfirmReset(false);
              }}
              className="px-4 py-1.5 rounded-lg bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
            >
              Confirmar reinicio
            </button>
          </div>
        </div>
      )}

      {/* WAITING LOBBY */}
      {state.status === 'waiting' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div
            className={`${
              isCreator ? 'lg:col-span-7' : 'lg:col-span-12'
            } bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-6`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl font-bold text-white">
                Participantes del Duelo ({sortedPlayers.length}/2)
              </h2>
              <span className="text-xs text-slate-400">
                {state.totalQuestions} preguntas · {state.config.timeLimitSec}s
                por ronda
              </span>
            </div>

            {/* VS Matchup Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[p1, p2].map((player, idx) => (
                <div
                  key={player ? player.id : `empty-${idx}`}
                  className={`rounded-2xl p-5 border flex flex-col items-center text-center gap-3 ${
                    player
                      ? player.id === me.id
                        ? 'bg-sky-500/10 border-sky-400/60'
                        : 'bg-[#080E1E] border-slate-700'
                      : 'bg-[#080E1E]/60 border-dashed border-slate-800 justify-center min-h-[210px]'
                  }`}
                >
                  {player ? (
                    <>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Participante {idx + 1}
                        {player.id === me.id ? ' (Tú)' : ''}
                      </span>
                      <AvatarBadge
                        avatarId={player.avatarId}
                        photoUrl={player.photoUrl}
                        name={player.name}
                        size="xl"
                      />
                      <div>
                        <p className="font-display text-xl font-extrabold text-white">
                          {player.name}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {player.online ? 'En línea' : 'Desconectado'}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold ${
                          player.ready !== false
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/40'
                        }`}
                      >
                        {player.ready !== false ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Preparado
                          </>
                        ) : (
                          <>
                            <Clock className="w-3.5 h-3.5" />
                            Por confirmar
                          </>
                        )}
                      </span>
                    </>
                  ) : (
                    <div className="space-y-2 py-4">
                      <Clock className="w-8 h-8 text-slate-600 mx-auto" />
                      <p className="font-display font-bold text-slate-300">
                        Esperando al Participante 2
                      </p>
                      <p className="text-xs text-slate-500">
                        Comparte el código{' '}
                        <span className="font-mono-num text-amber-300 font-bold">
                          {state.code}
                        </span>{' '}
                        o el código QR para que entre como invitado.
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Ready Toggle & Creator Start */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() =>
                    sendParticipantAction('toggle_ready', {
                      ready: me.ready === false,
                    })
                  }
                  className={`px-5 py-3 rounded-xl font-display font-bold text-sm inline-flex items-center gap-2 transition-colors cursor-pointer ${
                    me.ready !== false
                      ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-200 hover:bg-emerald-500/30'
                      : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  {me.ready !== false
                    ? 'Estás preparado (clic para cambiar)'
                    : '¡Estoy listo para competir!'}
                </button>

                {isCreator && (
                  <button
                    type="button"
                    disabled={!bothReady}
                    onClick={() => sendPresenterAction('start_game')}
                    className="px-6 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-base inline-flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ml-auto"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    Iniciar Batalla 1 vs 1
                  </button>
                )}
              </div>

              {isCreator && !bothJoined && (
                <p className="text-xs text-slate-400">
                  Cuando el segundo participante se una y confirme que está
                  listo, podrás iniciar la batalla.
                </p>
              )}
              {isCreator && bothJoined && !bothReady && (
                <p className="text-xs text-amber-300">
                  Esperando que ambos participantes marquen «Preparado» para
                  comenzar.
                </p>
              )}
              {!isCreator && (
                <p className="text-xs text-slate-300">
                  {me.ready === false
                    ? 'Pulsa «¡Estoy listo para competir!» para avisar al creador.'
                    : '¡Listo! Esperando que el creador inicie la batalla.'}
                </p>
              )}
            </div>
          </div>

          {isCreator && (
            <div className="lg:col-span-5">
              <QrCodeCard
                code={state.code}
                gameId={state.gameId}
                title={state.config.title}
                showProjectorLink={false}
              />
            </div>
          )}
        </div>
      )}

      {/* LIVE DUEL SCOREBOARD HUD (shown while active/locked/revealed/paused) */}
      {state.status !== 'waiting' && state.status !== 'finished' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[p1, p2].map((player, idx) => {
            if (!player) return null;
            const roundRow = getRoundAnswerFor(player.id);
            const hasAnsweredThisRound = state.answeredParticipantIds.includes(
              player.id
            );
            const isMe = player.id === me.id;
            return (
              <div
                key={player.id}
                className={`rounded-2xl p-4 border flex items-center justify-between gap-3 ${
                  isMe
                    ? 'bg-sky-500/10 border-sky-400/60'
                    : 'bg-[#111A2E] border-slate-800'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <AvatarBadge
                    avatarId={player.avatarId}
                    photoUrl={player.photoUrl}
                    name={player.name}
                    size="md"
                  />
                  <div className="min-w-0">
                    <p className="font-display font-bold text-white truncate">
                      {player.name}{' '}
                      <span className="text-xs font-normal text-sky-300">
                        {isMe ? '(Tú)' : `· P${idx + 1}`}
                      </span>
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="font-mono-num">
                        {player.correctCount}/{player.answeredCount} correctas
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num">
                        Prom: {getAvgSeconds(player.answeredCount, player.totalResponseMs)}
                      </span>
                    </div>
                    <div className="mt-1">
                      {isRevealed && roundRow ? (
                        roundRow.isCorrect ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Correcta (+{roundRow.pointsEarned})
                            {roundRow.responseTimeMs !== null
                              ? ` · ${(roundRow.responseTimeMs / 1000).toFixed(1)}s`
                              : ''}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-400">
                            <XCircle className="w-3.5 h-3.5" />
                            {roundRow.selectedIndex === null
                              ? 'Sin responder'
                              : 'Incorrecta'}
                          </span>
                        )
                      ) : (
                        <span
                          className={`text-xs font-semibold ${
                            hasAnsweredThisRound
                              ? 'text-emerald-300'
                              : 'text-slate-400'
                          }`}
                        >
                          {hasAnsweredThisRound
                            ? '✓ Respuesta enviada'
                            : 'Respondiendo...'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="font-mono-num font-extrabold text-2xl text-amber-300">
                    {player.score.toLocaleString('es-CO')}
                  </p>
                  <p className="text-[11px] text-slate-400">puntos</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PAUSED */}
      {state.status === 'paused' && (
        <div className="bg-[#111A2E] border border-amber-400/50 rounded-2xl p-8 text-center space-y-2">
          <h2 className="font-display text-2xl font-bold text-amber-300">
            Batalla en Pausa
          </h2>
          <p className="text-sm text-slate-300">
            El creador pausó temporalmente el duelo. Los puntajes están
            guardados.
          </p>
        </div>
      )}

      {/* ACTIVE / LOCKED / REVEALED QUESTION */}
      {(state.status === 'question_active' ||
        state.status === 'question_locked' ||
        state.status === 'answer_revealed') &&
        q && (
          <div className="space-y-5">
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
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
                        Doble puntaje x{q.isSpecialMultiplier}
                      </span>
                    </>
                  )}
                </div>
              </div>

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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {q.options.map((opt, idx) => {
                const isSelected = myAns?.selectedIndex === idx;
                const isCorrectOpt = isRevealed && q.correctIndex === idx;
                const canTap = state.status === 'question_active' && !myAns;

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
                } else if (state.status === 'question_locked') {
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
                    className={`w-full min-h-[64px] p-4 rounded-2xl border text-left flex items-center gap-3.5 transition-all ${
                      canTap ? 'cursor-pointer active:scale-[0.99]' : 'cursor-default'
                    } ${btnClass}`}
                  >
                    <span className="w-9 h-9 rounded-xl bg-black/25 font-mono-num font-bold text-base flex items-center justify-center shrink-0">
                      {OPTION_LETTERS[idx]}
                    </span>
                    <span className="font-semibold text-base leading-snug flex-1">
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

            {state.status === 'answer_revealed' && q.reference && (
              <div className="bg-[#111A2E] border border-slate-700 rounded-2xl p-4 space-y-1">
                <p className="font-semibold text-amber-300 text-sm inline-flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" />
                  Cita bíblica: {q.reference}
                </p>
                {q.explanation && (
                  <p className="text-slate-300 text-xs sm:text-sm">
                    {q.explanation}
                  </p>
                )}
              </div>
            )}

            {/* Creator Round Controls */}
            {isCreator && (
              <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-400">
                  {state.status === 'question_locked'
                    ? 'Ronda cerrada — revela la respuesta o avanza.'
                    : 'Controles del creador de la batalla'}
                </span>
                <div className="flex flex-wrap items-center gap-2.5 ml-auto">
                  {!isRevealed && (
                    <button
                      type="button"
                      onClick={() => sendPresenterAction('reveal_answer')}
                      className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-sm inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Mostrar Respuesta
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => sendPresenterAction('next_question')}
                    className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-sm inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {state.currentQuestionIndex + 1 >= state.totalQuestions
                      ? 'Finalizar y Ver Resultado'
                      : 'Siguiente Pregunta'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      {/* FINISHED */}
      {state.status === 'finished' && (
        <div className="space-y-6">
          {/* Winner or Tie Banner */}
          <div
            className={`rounded-2xl p-6 sm:p-8 border text-center space-y-4 ${
              isTie
                ? 'bg-sky-500/10 border-sky-400/60'
                : 'bg-[#15203A] border-amber-400/60 shadow-lg shadow-amber-500/10'
            }`}
          >
            {isTie ? (
              <>
                <Scale className="w-12 h-12 text-sky-300 mx-auto" />
                <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white">
                  ¡Empate Oficial!
                </h2>
                <p className="text-slate-200 text-base">
                  Ambos competidores terminaron exactamente con{' '}
                  <strong className="font-mono-num text-amber-300">
                    {(topA?.score ?? 0).toLocaleString('es-CO')} puntos
                  </strong>
                  . No hay un ganador único.
                </p>
              </>
            ) : winner ? (
              <>
                <div className="inline-flex items-center gap-2 text-amber-300 font-display font-bold text-sm uppercase tracking-wider">
                  <Crown className="w-5 h-5 text-amber-400" />
                  Ganador de la Batalla 1 contra 1
                </div>
                <AvatarBadge
                  avatarId={winner.avatarId}
                  photoUrl={winner.photoUrl}
                  name={winner.name}
                  size="2xl"
                  className="mx-auto"
                />
                <div>
                  <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white">
                    {winner.name}
                  </h2>
                  <p className="font-mono-num text-2xl font-extrabold text-amber-300 mt-1">
                    {winner.score.toLocaleString('es-CO')} puntos
                  </p>
                </div>
              </>
            ) : null}

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {isCreator && (
                <button
                  type="button"
                  onClick={() => sendPresenterAction('reset_game')}
                  className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-sm inline-flex items-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Revancha (Jugar de nuevo)
                </button>
              )}
              <button
                type="button"
                onClick={() => onExit(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm cursor-pointer"
              >
                Volver al inicio
              </button>
            </div>
          </div>

          {/* Head-to-Head Final Results */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {lb.map((entry) => {
              const isWinnerCard = !isTie && winner?.participantId === entry.participantId;
              return (
                <div
                  key={entry.participantId}
                  className={`bg-[#111A2E] rounded-2xl p-5 border space-y-4 ${
                    isWinnerCard
                      ? 'border-amber-400/70'
                      : 'border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <AvatarBadge
                        avatarId={entry.avatarId}
                        photoUrl={entry.photoUrl}
                        name={entry.name}
                        size="lg"
                      />
                      <div className="min-w-0">
                        <p className="font-display font-extrabold text-lg text-white truncate">
                          {entry.name}
                          {entry.participantId === me.id ? ' (Tú)' : ''}
                        </p>
                        <p className="text-xs text-slate-400">
                          {isTie
                            ? 'Empate en puntos'
                            : isWinnerCard
                              ? 'Ganador del duelo'
                              : '2.º puesto'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono-num text-2xl font-extrabold text-amber-300">
                        {entry.score.toLocaleString('es-CO')}
                      </p>
                      <p className="text-xs text-slate-400">pts</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800 text-center">
                    <div className="bg-[#080E1E] rounded-xl p-2.5">
                      <p className="font-mono-num font-bold text-white text-sm">
                        {entry.correctCount}/{entry.answeredCount}
                      </p>
                      <p className="text-[11px] text-slate-400">Correctas</p>
                    </div>
                    <div className="bg-[#080E1E] rounded-xl p-2.5">
                      <p className="font-mono-num font-bold text-emerald-300 text-sm">
                        {entry.accuracyPercent}%
                      </p>
                      <p className="text-[11px] text-slate-400">Precisión</p>
                    </div>
                    <div className="bg-[#080E1E] rounded-xl p-2.5">
                      <p className="font-mono-num font-bold text-sky-300 text-sm">
                        {entry.answeredCount > 0
                          ? `${(entry.avgResponseMs / 1000).toFixed(1)}s`
                          : '—'}
                      </p>
                      <p className="text-[11px] text-slate-400">Tiempo prom.</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <QuestionReviewSection items={state.questionReview} />
        </div>
      )}
    </div>
  );
}
