import { useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  Send,
  Shuffle,
  Sparkles,
  Star,
  Users,
  XCircle,
} from 'lucide-react';
import {
  PARTICIPATION_MODE_META,
  SATURDAY_CHALLENGE_CATEGORIES,
  type SaturdayValidationStatus,
} from '../shared/saturdayChallengesData';
import { GameRoomClientState, getTeamDefinition } from '../shared/types';
import { soundFX } from '../utils/sound';
import { AvatarBadge } from './AvatarBadge';
import { CountdownTimer } from './CountdownTimer';

interface SaturdayChallengeRoomPanelProps {
  state: GameRoomClientState;
  role: 'presenter' | 'participant' | 'projector';
  clockOffsetMs: number;
  onPresenterAction?: (action: string, extra?: Record<string, unknown>) => void;
  onSubmitChallenge?: (payload: {
    selectedIndex?: number;
    submittedText?: string;
    completedSignal?: boolean;
  }) => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];
const OPTION_STYLES = [
  'bg-sky-600 hover:bg-sky-500 border-sky-400/50 text-white',
  'bg-amber-600 hover:bg-amber-500 border-amber-400/50 text-white',
  'bg-emerald-600 hover:bg-emerald-500 border-emerald-400/50 text-white',
  'bg-rose-600 hover:bg-rose-500 border-rose-400/50 text-white',
];
const PROJECTOR_OPTION_CLASSES = [
  'bg-sky-600/25 border-sky-400/50 text-white',
  'bg-amber-600/25 border-amber-400/50 text-white',
  'bg-emerald-600/25 border-emerald-400/50 text-white',
  'bg-rose-600/25 border-rose-400/50 text-white',
];

function ValidationBadge({ status, points }: { status: SaturdayValidationStatus; points: number }) {
  if (status === 'featured') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-400/20 border border-amber-400/50 text-amber-300 text-xs font-bold">
        <Star className="w-3.5 h-3.5 fill-current" />
        Destacado · +{points} pts
      </span>
    );
  }
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-xs font-bold">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Aprobado · +{points} pts
      </span>
    );
  }
  if (status === 'participation') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/20 border border-sky-400/50 text-sky-300 text-xs font-bold">
        <Award className="w-3.5 h-3.5" />
        Participación · +{points} pts
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-400/50 text-rose-300 text-xs font-bold">
        <XCircle className="w-3.5 h-3.5" />
        No validado (0 pts)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold">
      Pendiente de validación
    </span>
  );
}

export function SaturdayChallengeRoomPanel({
  state,
  role,
  clockOffsetMs,
  onPresenterAction,
  onSubmitChallenge,
}: SaturdayChallengeRoomPanelProps) {
  const room = state.saturdayChallengeState;
  const challenge = room?.currentChallenge;
  const [showGuide, setShowGuide] = useState(false);
  const [textDraft, setTextDraft] = useState('');
  const [applyToTeam, setApplyToTeam] = useState(
    () => Boolean(state.config.teamMode)
  );

  if (!room || !challenge) return null;

  const catMeta = SATURDAY_CHALLENGE_CATEGORIES[challenge.category];
  const modeMeta = PARTICIPATION_MODE_META[room.participationMode];
  const isRevealed =
    state.status === 'answer_revealed' || state.status === 'finished';
  const mySub = room.mySubmission;
  const me = state.myParticipant;

  const subByPid = new Map(
    room.submissions.map((s) => [s.participantId, s])
  );

  const isTeamMode = Boolean(state.config.teamMode || state.config.mode === 'equipos');

  // ==================== PARTICIPANT VIEW ====================
  if (role === 'participant') {
    const canTapChoice =
      state.status === 'question_active' &&
      !mySub &&
      !me?.eliminated &&
      challenge.evaluationType === 'auto_choice';

    const canSubmitReview =
      state.status === 'question_active' &&
      !mySub &&
      !me?.eliminated &&
      challenge.evaluationType === 'director_review';

    return (
      <div className="space-y-5">
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-mono-num font-bold text-amber-300">
              Reto {room.currentIndex + 1} de {room.totalChallenges}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-bold ${catMeta.badgeClass}`}
              >
                {catMeta.label}
              </span>
              <span className="text-slate-400">{challenge.subTypeLabel}</span>
            </div>
          </div>

          <CountdownTimer
            status={state.status}
            questionEndsAt={state.questionEndsAt}
            timeLimitSec={state.config.timeLimitSec}
            remainingSecFallback={state.remainingSec}
            clockOffsetMs={clockOffsetMs}
          />

          <div className="space-y-2 pt-1">
            <h2 className="font-display text-xl sm:text-2xl font-extrabold text-white leading-snug">
              {challenge.title}
            </h2>
            <p className="text-base text-slate-100 leading-relaxed">
              {challenge.prompt}
            </p>
            <div className="bg-[#080E1E] border border-slate-800 rounded-xl p-3 text-xs sm:text-sm text-sky-200">
              <strong className="text-sky-300">Consigna ({modeMeta.label}):</strong>{' '}
              {challenge.instructions}
            </div>
            {challenge.reference && (
              <p className="text-xs font-semibold text-amber-300 inline-flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                Referencia: {challenge.reference}
              </p>
            )}
          </div>
        </div>

        {/* Auto-choice buttons */}
        {challenge.evaluationType === 'auto_choice' && challenge.options && (
          <div className="grid grid-cols-1 gap-3">
            {challenge.options.map((opt, idx) => {
              const isSelected = mySub?.selectedIndex === idx;
              const isCorrectOpt = isRevealed && challenge.correctIndex === idx;
              let btnClass = OPTION_STYLES[idx % OPTION_STYLES.length];
              if (isRevealed) {
                if (isCorrectOpt) {
                  btnClass =
                    'bg-emerald-600 border-emerald-300 text-white ring-2 ring-emerald-300';
                } else if (isSelected && !isCorrectOpt) {
                  btnClass = 'bg-rose-700 border-rose-400 text-white opacity-90';
                } else {
                  btnClass =
                    'bg-slate-800/80 border-slate-700 text-slate-400 opacity-55';
                }
              } else if (mySub) {
                btnClass = isSelected
                  ? 'bg-sky-600 border-white text-white ring-2 ring-white'
                  : 'bg-slate-800/70 border-slate-700 text-slate-400 opacity-50';
              } else if (state.status === 'question_locked' || me?.eliminated) {
                btnClass =
                  'bg-slate-800/70 border-slate-700 text-slate-400 opacity-60';
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!canTapChoice}
                  onClick={() => {
                    soundFX.playLock();
                    onSubmitChallenge?.({ selectedIndex: idx });
                  }}
                  className={`w-full min-h-[58px] p-4 rounded-2xl border text-left flex items-center gap-3.5 transition-all ${
                    canTapChoice ? 'cursor-pointer active:scale-[0.99]' : 'cursor-default'
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
        )}

        {/* Director review response panel */}
        {challenge.evaluationType === 'director_review' && (
          <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-4">
            {canSubmitReview ? (
              <>
                <label className="block space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Tu aporte / lema / explicación (opcional si pasas al frente)
                  </span>
                  <textarea
                    rows={3}
                    value={textDraft}
                    onChange={(e) => setTextDraft(e.target.value)}
                    placeholder="Escribe aquí tu respuesta creativa, lema, resumen o marca directamente como completado si estás participando en persona..."
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    soundFX.playLock();
                    onSubmitChallenge?.({
                      submittedText: textDraft.trim() || undefined,
                      completedSignal: true,
                    });
                    setTextDraft('');
                  }}
                  className="w-full py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-base inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  Enviar / Marcar Reto Completado
                </button>
              </>
            ) : mySub ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold text-white">
                    Estado de tu participación
                  </span>
                  <ValidationBadge
                    status={mySub.validationStatus}
                    points={mySub.pointsAwarded}
                  />
                </div>
                {mySub.submittedText && (
                  <p className="bg-[#080E1E] border border-slate-800 rounded-xl p-3 text-sm text-slate-200">
                    “{mySub.submittedText}”
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-300 text-center">
                El tiempo finalizó. El director puede validar tu participación presencial en vivo.
              </p>
            )}
          </div>
        )}

        {/* Waiting / Reveal feedback */}
        {state.status === 'question_active' &&
          challenge.evaluationType === 'auto_choice' &&
          mySub && (
            <div className="bg-sky-500/15 border border-sky-400/50 rounded-xl p-4 text-center text-sky-200 text-sm font-medium">
              ¡Respuesta registrada! Esperando el cierre del reto para revelar el resultado.
            </div>
          )}

        {isRevealed && (
          <div className="bg-[#111A2E] border border-emerald-500/40 rounded-2xl p-5 space-y-2.5">
            {challenge.evaluationType === 'auto_choice' && mySub && (
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`font-display font-bold text-lg flex items-center gap-2 ${
                    mySub.isAutoCorrect ? 'text-emerald-300' : 'text-rose-300'
                  }`}
                >
                  {mySub.isAutoCorrect ? (
                    <>
                      <CheckCircle2 className="w-5 h-5" /> ¡Reto superado!
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5" /> Sigue intentando
                    </>
                  )}
                </span>
                <span className="font-mono-num font-extrabold text-lg text-amber-300">
                  +{mySub.pointsAwarded} pts
                </span>
              </div>
            )}
            {challenge.reference && (
              <p className="text-xs font-bold text-amber-300">
                Cita bíblica: {challenge.reference}
              </p>
            )}
            {challenge.guideAnswer && (
              <p className="text-xs sm:text-sm text-slate-200">
                {challenge.guideAnswer}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ==================== PRESENTER VIEW ====================
  if (role === 'presenter') {
    return (
      <div className="space-y-5">
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono-num font-bold text-amber-300">
                Reto {room.currentIndex + 1} de {room.totalChallenges}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-lg border font-bold ${catMeta.badgeClass}`}
              >
                {catMeta.label}
              </span>
              <span className="text-slate-300 font-semibold">
                {challenge.subTypeLabel}
              </span>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-[#080E1E] border border-slate-700 text-sky-300 font-semibold">
              Modo: {modeMeta.label}
            </span>
          </div>

          <CountdownTimer
            status={state.status}
            questionEndsAt={state.questionEndsAt}
            timeLimitSec={state.config.timeLimitSec}
            remainingSecFallback={state.remainingSec}
            clockOffsetMs={clockOffsetMs}
          />

          <div className="space-y-2">
            <h2 className="font-display text-2xl font-extrabold text-white leading-snug">
              {challenge.title}
            </h2>
            <p className="text-base text-slate-100 leading-relaxed">
              {challenge.prompt}
            </p>
            <div className="bg-[#080E1E] border border-slate-800 rounded-xl p-3.5 text-sm text-sky-200">
              <strong className="text-sky-300">Dinámica para los jóvenes:</strong>{' '}
              {challenge.instructions}
            </div>
          </div>

          {/* Guide toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowGuide((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 font-semibold cursor-pointer"
            >
              {showGuide ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  Ocultar guía del director
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  Ver respuesta / guía del director
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => onPresenterAction?.('surprise_next_challenge')}
              className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Shuffle className="w-3.5 h-3.5" />
              Cambiar por Reto Sorpresa
            </button>
          </div>

          {challenge.evaluationType === 'auto_choice' && challenge.options && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {challenge.options.map((opt, idx) => {
                const markCorrect =
                  (isRevealed || showGuide) && challenge.correctIndex === idx;
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
          )}

          {(isRevealed || showGuide) && (challenge.reference || challenge.guideAnswer) && (
            <div className="bg-emerald-500/10 border border-emerald-500/35 rounded-xl p-3.5 space-y-1 text-xs sm:text-sm">
              {challenge.reference && (
                <p className="font-bold text-amber-300">
                  Referencia bíblica: {challenge.reference}
                </p>
              )}
              {challenge.guideAnswer && (
                <p className="text-emerald-100">{challenge.guideAnswer}</p>
              )}
            </div>
          )}

          {/* Presenter Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-800">
            {!isRevealed && state.status !== 'paused' && (
              <button
                type="button"
                onClick={() => onPresenterAction?.('reveal_answer')}
                className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-sm inline-flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                {challenge.evaluationType === 'auto_choice'
                  ? 'Mostrar Respuesta Correcta'
                  : 'Cerrar Reto y Mostrar Guía'}
              </button>
            )}

            <button
              type="button"
              onClick={() => onPresenterAction?.('next_question')}
              className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-sm inline-flex items-center gap-2 cursor-pointer ml-auto"
            >
              {room.currentIndex + 1 >= room.totalChallenges
                ? 'Ver Resultados Finales'
                : 'Siguiente Reto'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Human Director Validation Panel OR Auto-Choice Responses */}
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display font-bold text-lg text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                {challenge.evaluationType === 'director_review'
                  ? 'Validación del Director en Vivo'
                  : 'Respuestas Recibidas'}
              </h3>
              <p className="text-xs text-slate-400">
                {challenge.evaluationType === 'director_review'
                  ? 'Califica el desempeño de cada participante, pareja o equipo (incluyendo participaciones presenciales al frente).'
                  : `${room.submissions.length} de ${state.participants.length} respondieron.`}
              </p>
            </div>
            {challenge.evaluationType === 'director_review' && isTeamMode && (
              <label className="inline-flex items-center gap-2 text-xs text-amber-200 bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyToTeam}
                  onChange={(e) => setApplyToTeam(e.target.checked)}
                  className="accent-amber-400"
                />
                Aplicar calificación a toda la pareja/equipo
              </label>
            )}
          </div>

          {state.participants.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">
              Aún no hay participantes en la sala.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {state.participants.map((p) => {
                const sub = subByPid.get(p.id);
                const team = p.teamId
                  ? getTeamDefinition(p.teamId, state.config.teams)
                  : undefined;

                return (
                  <div
                    key={p.id}
                    className="bg-[#080E1E] border border-slate-800 rounded-xl p-3.5 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
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
                          <p className="text-[11px] text-slate-400">
                            {team ? (
                              <span style={{ color: team.color }}>{team.name}</span>
                            ) : (
                              'Participante'
                            )}
                            {sub ? ` · ${(sub.responseTimeMs / 1000).toFixed(1)}s` : ' · Sin envío en celular'}
                          </p>
                        </div>
                      </div>

                      {sub && (
                        <ValidationBadge
                          status={sub.validationStatus}
                          points={sub.pointsAwarded}
                        />
                      )}
                    </div>

                    {sub?.submittedText && (
                      <p className="text-xs sm:text-sm text-slate-200 bg-[#111A2E] border border-slate-800 rounded-lg px-3 py-2">
                        “{sub.submittedText}”
                      </p>
                    )}

                    {challenge.evaluationType === 'director_review' && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onPresenterAction?.('director_validate_challenge', {
                              participantId: p.id,
                              validationStatus: 'featured',
                              applyToTeam,
                            })
                          }
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                            sub?.validationStatus === 'featured'
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-400/30'
                          }`}
                        >
                          <Star className="w-3.5 h-3.5" />
                          Destacado
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onPresenterAction?.('director_validate_challenge', {
                              participantId: p.id,
                              validationStatus: 'approved',
                              applyToTeam,
                            })
                          }
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                            sub?.validationStatus === 'approved'
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-400/30'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Aprobar
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onPresenterAction?.('director_validate_challenge', {
                              participantId: p.id,
                              validationStatus: 'participation',
                              applyToTeam,
                            })
                          }
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                            sub?.validationStatus === 'participation'
                              ? 'bg-sky-500 text-slate-950'
                              : 'bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-400/30'
                          }`}
                        >
                          <Award className="w-3.5 h-3.5" />
                          Participación
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onPresenterAction?.('director_validate_challenge', {
                              participantId: p.id,
                              validationStatus: 'rejected',
                              applyToTeam,
                            })
                          }
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                            sub?.validationStatus === 'rejected'
                              ? 'bg-rose-500 text-white'
                              : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-400/30'
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          No válido
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==================== PROJECTOR VIEW ====================
  return (
    <div className="space-y-6">
      <div className="bg-[#111A2E] border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono-num font-bold text-amber-300 text-lg">
              Reto {room.currentIndex + 1} / {room.totalChallenges}
            </span>
            <span
              className={`px-3 py-1 rounded-xl border text-xs font-bold ${catMeta.badgeClass}`}
            >
              {catMeta.label}
            </span>
            <span className="text-slate-300 font-semibold text-sm sm:text-base">
              {challenge.subTypeLabel}
            </span>
          </div>
          <div className="inline-flex items-center gap-2 text-sm sm:text-base text-slate-200 font-semibold">
            <Users className="w-4 h-4 text-sky-400" />
            Modo {modeMeta.label} · {room.submissions.length} participaciones
          </div>
        </div>

        <CountdownTimer
          status={state.status}
          questionEndsAt={state.questionEndsAt}
          timeLimitSec={state.config.timeLimitSec}
          remainingSecFallback={state.remainingSec}
          clockOffsetMs={clockOffsetMs}
          large
          playAudioTicks
        />

        <div className="space-y-3">
          <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-white leading-tight text-balance">
            {challenge.title}
          </h2>
          <p className="text-lg sm:text-2xl text-slate-100 leading-relaxed">
            {challenge.prompt}
          </p>
          <div className="bg-[#080E1E] border border-slate-800 rounded-2xl p-4 text-sm sm:text-base text-sky-200">
            <strong className="text-sky-300">Consigna:</strong> {challenge.instructions}
          </div>
        </div>

        {challenge.evaluationType === 'auto_choice' && challenge.options && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {challenge.options.map((opt, idx) => {
              const isCorrect = isRevealed && challenge.correctIndex === idx;
              const cardStyle = isRevealed
                ? isCorrect
                  ? 'bg-emerald-600 border-emerald-300 text-white ring-2 ring-emerald-300'
                  : 'bg-slate-900/70 border-slate-800 text-slate-400 opacity-55'
                : PROJECTOR_OPTION_CLASSES[idx % PROJECTOR_OPTION_CLASSES.length];
              return (
                <div
                  key={idx}
                  className={`p-5 rounded-2xl border flex items-center gap-4 ${cardStyle}`}
                >
                  <span className="w-11 h-11 rounded-xl bg-black/30 font-mono-num font-bold text-xl flex items-center justify-center shrink-0">
                    {OPTION_LETTERS[idx]}
                  </span>
                  <span className="font-display font-bold text-lg sm:text-2xl flex-1">
                    {opt}
                  </span>
                  {isCorrect && <CheckCircle2 className="w-7 h-7 text-white shrink-0" />}
                </div>
              );
            })}
          </div>
        )}

        {challenge.evaluationType === 'director_review' && room.submissions.length > 0 && (
          <div className="space-y-3 pt-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Participaciones y Validación en Vivo
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {room.submissions.slice(0, 8).map((sub) => (
                <div
                  key={sub.participantId}
                  className="bg-[#080E1E] border border-slate-800 rounded-2xl p-4 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <AvatarBadge
                        avatarId={sub.avatarId}
                        photoUrl={sub.photoUrl}
                        name={sub.participantName}
                        size="sm"
                      />
                      <span className="font-semibold text-white truncate">
                        {sub.participantName}
                      </span>
                    </div>
                    <ValidationBadge
                      status={sub.validationStatus}
                      points={sub.pointsAwarded}
                    />
                  </div>
                  {sub.submittedText && (
                    <p className="text-sm text-slate-200 line-clamp-2">
                      “{sub.submittedText}”
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {isRevealed && (challenge.reference || challenge.guideAnswer) && (
          <div className="bg-[#080E1E] border border-emerald-500/40 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {challenge.reference && (
              <div className="flex items-center gap-2 text-amber-300 font-bold text-base">
                <BookOpen className="w-5 h-5 shrink-0" />
                <span>Cita bíblica: {challenge.reference}</span>
              </div>
            )}
            {challenge.guideAnswer && (
              <p className="text-slate-200 text-sm sm:text-base">
                {challenge.guideAnswer}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
