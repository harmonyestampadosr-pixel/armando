import { useEffect, useRef, useState } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Disc,
  Eye,
  EyeOff,
  Lock,
  Play,
  RotateCw,
  Send,
  Settings2,
  Sparkles,
  Timer,
  Users,
  XCircle,
} from 'lucide-react';
import {
  getSaturdayRouletteCategoryMeta,
  SATURDAY_ROULETTE_CATEGORIES,
  SATURDAY_ROULETTE_MODE_INFO,
  type SaturdayRouletteCategoryId,
  type SaturdayRouletteValidationGrade,
} from '../shared/saturdayRouletteData';
import type { GameRoomClientState } from '../shared/types';
import { soundFX } from '../utils/sound';
import { AvatarBadge } from './AvatarBadge';
import { CountdownTimer } from './CountdownTimer';
import { SaturdayRouletteWheel } from './SaturdayRouletteWheel';

interface SaturdayRouletteRoomPanelProps {
  state: GameRoomClientState;
  role: 'presenter' | 'projector' | 'participant';
  clockOffsetMs: number;
  onPresenterAction?: (action: string, extra?: Record<string, unknown>) => void;
  onSubmitRoulette?: (payload: {
    selectedIndex?: number;
    submittedText?: string;
    completedSignal?: boolean;
  }) => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];
const TIMER_PRESETS = [20, 30, 45, 60, 90, 120];

export function SaturdayRouletteRoomPanel({
  state,
  role,
  clockOffsetMs,
  onPresenterAction,
  onSubmitRoulette,
}: SaturdayRouletteRoomPanelProps) {
  const sat = state.saturdayRouletteState;
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [textDraft, setTextDraft] = useState('');
  const [showDirectorConfig, setShowDirectorConfig] = useState(false);
  const [showGuidePrivately, setShowGuidePrivately] = useState(false);
  const [selectedGrade, setSelectedGrade] =
    useState<SaturdayRouletteValidationGrade>('approved');
  const [resultNote, setResultNote] = useState('');

  const lastSeenNonceRef = useRef<number | null>(null);
  const spinAnimTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!sat) return;
    if (
      lastSeenNonceRef.current !== null &&
      sat.spinNonce > lastSeenNonceRef.current
    ) {
      setWheelSpinning(true);
      setTextDraft('');
      setResultNote('');
      if (spinAnimTimerRef.current) {
        window.clearTimeout(spinAnimTimerRef.current);
      }
      spinAnimTimerRef.current = window.setTimeout(() => {
        setWheelSpinning(false);
      }, 3450);
    }
    lastSeenNonceRef.current = sat.spinNonce;
  }, [sat?.spinNonce]);

  useEffect(() => {
    return () => {
      if (spinAnimTimerRef.current) {
        window.clearTimeout(spinAnimTimerRef.current);
      }
    };
  }, []);

  if (!sat) return null;

  const act = sat.currentActivity;
  const catMeta = sat.selectedCategoryId
    ? getSaturdayRouletteCategoryMeta(sat.selectedCategoryId)
    : null;
  const isRevealed =
    state.status === 'answer_revealed' ||
    state.status === 'finished' ||
    sat.resultRecordedForSpin;
  const isAutoChoice = act?.evaluationType === 'auto_choice';
  const mySub = sat.mySubmission;
  const me = state.myParticipant;

  const targetParticipant = sat.targetParticipantId
    ? state.participants.find((p) => p.id === sat.targetParticipantId)
    : undefined;

  const toggleCategory = (catId: SaturdayRouletteCategoryId) => {
    if (!onPresenterAction) return;
    const isEnabled = sat.enabledCategories.includes(catId);
    if (isEnabled && sat.enabledCategories.length <= 2) return;
    const next = isEnabled
      ? sat.enabledCategories.filter((id) => id !== catId)
      : SATURDAY_ROULETTE_CATEGORIES.map((c) => c.id).filter(
          (id) => id === catId || sat.enabledCategories.includes(id)
        );
    onPresenterAction('set_roulette_config', { enabledCategories: next });
  };

  const canRespinNow =
    sat.phase !== 'spinning_revealed' || sat.resultRecordedForSpin || sat.allowRespin;

  const wheelSize = role === 'projector' ? 350 : role === 'presenter' ? 280 : 210;

  return (
    <div className="space-y-5">
      {/* Main Wheel + Active Challenge Split */}
      <div
        className={`bg-[#111A2E] border rounded-3xl p-5 sm:p-7 ${
          catMeta ? 'border-amber-400/50' : 'border-slate-800'
        }`}
      >
        <div
          className={`grid gap-6 items-center ${
            role === 'participant'
              ? 'grid-cols-1'
              : 'grid-cols-1 lg:grid-cols-12'
          }`}
        >
          {/* Animated Wheel Column */}
          <div
            className={`${
              role === 'participant' ? '' : 'lg:col-span-5'
            } flex flex-col items-center justify-center space-y-3`}
          >
            <SaturdayRouletteWheel
              enabledCategories={sat.enabledCategories}
              angleDeg={sat.targetAngleDeg}
              spinning={wheelSpinning}
              size={wheelSize}
              selectedCategoryId={sat.selectedCategoryId}
            />

            <div className="text-center space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Ruleta del Sábado · Giro #{sat.spinsCount}
              </p>
              <p className="text-xs text-slate-400">
                {SATURDAY_ROULETTE_MODE_INFO[sat.participationMode].label} ·{' '}
                {sat.enabledCategories.length} categorías activas
              </p>
            </div>
          </div>

          {/* Revealed Activity & Live Controls Column */}
          <div
            className={`${
              role === 'participant' ? '' : 'lg:col-span-7'
            } space-y-4`}
          >
            {wheelSpinning ? (
              <div className="bg-[#080E1E] border border-amber-400/40 rounded-2xl p-8 text-center space-y-3">
                <Disc className="w-10 h-10 text-amber-400 mx-auto animate-spin" />
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                  ¡Girando la Ruleta del Sábado!
                </h2>
                <p className="text-sm text-slate-300">
                  Preparando la siguiente categoría y actividad sorpresa...
                </p>
              </div>
            ) : act && catMeta ? (
              <div className="space-y-4">
                {/* Category + Timer Badge Row */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`px-3.5 py-1.5 rounded-xl border text-xs sm:text-sm font-bold inline-flex items-center gap-2 ${catMeta.accentBg}`}
                  >
                    <Sparkles className="w-4 h-4" />
                    {catMeta.label}
                  </span>

                  <span className="px-3 py-1.5 rounded-xl bg-[#080E1E] border border-slate-700 text-xs font-mono-num font-bold text-sky-300 inline-flex items-center gap-1.5">
                    <Timer className="w-3.5 h-3.5" />
                    Tiempo: {sat.configuredTimeSec}s
                  </span>
                </div>

                {/* Selected Participant / Team / Congregation Spotlight */}
                <div className="bg-[#080E1E] border border-slate-800 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {sat.participationMode === 'congregacion' ? (
                      <>
                        <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/40 flex items-center justify-center shrink-0">
                          <Users className="w-5 h-5 text-amber-300" />
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                            Turno actual
                          </p>
                          <p className="font-display font-bold text-base text-amber-300">
                            ¡Toda la Congregación en Juego!
                          </p>
                        </div>
                      </>
                    ) : sat.targetTeamName ? (
                      <>
                        <div
                          className="w-4 h-10 rounded-full shrink-0"
                          style={{
                            backgroundColor: sat.targetTeamColor || '#F59E0B',
                          }}
                        />
                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                            {sat.participationMode === 'parejas'
                              ? 'Pareja elegida'
                              : 'Equipo elegido'}
                          </p>
                          <p
                            className="font-display font-extrabold text-lg"
                            style={{ color: sat.targetTeamColor || '#F8FAFC' }}
                          >
                            {sat.targetTeamName}
                          </p>
                        </div>
                      </>
                    ) : targetParticipant ? (
                      <>
                        <AvatarBadge
                          avatarId={targetParticipant.avatarId}
                          photoUrl={targetParticipant.photoUrl}
                          name={targetParticipant.name}
                          size="md"
                        />
                        <div className="min-w-0">
                          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                            Participante elegido
                          </p>
                          <p className="font-display font-extrabold text-lg text-white truncate">
                            {targetParticipant.name}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                          Modalidad activa
                        </p>
                        <p className="font-display font-bold text-sm text-white">
                          {SATURDAY_ROULETTE_MODE_INFO[sat.participationMode].label}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Director manual reassignment dropdown */}
                  {role === 'presenter' &&
                    onPresenterAction &&
                    sat.participationMode !== 'congregacion' && (
                      <div className="flex items-center gap-2">
                        {sat.participationMode === 'parejas' ||
                        sat.participationMode === 'equipos' ? (
                          state.config.teams && state.config.teams.length > 0 && (
                            <select
                              aria-label="Seleccionar equipo o pareja para este giro"
                              value={sat.targetTeamId || ''}
                              onChange={(e) =>
                                onPresenterAction('set_roulette_config', {
                                  targetTeamId: e.target.value,
                                })
                              }
                              className="bg-[#111A2E] border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                            >
                              <option value="">Elegir equipo...</option>
                              {state.config.teams.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                          )
                        ) : (
                          state.participants.length > 0 && (
                            <select
                              aria-label="Seleccionar participante para este giro"
                              value={sat.targetParticipantId || ''}
                              onChange={(e) =>
                                onPresenterAction('set_roulette_config', {
                                  targetParticipantId: e.target.value,
                                })
                              }
                              className="bg-[#111A2E] border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                            >
                              <option value="">Elegir jugador...</option>
                              {state.participants.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          )
                        )}
                      </div>
                    )}
                </div>

                {/* Activity Title & Instructions */}
                <div className="space-y-2">
                  <h2
                    className={`font-display font-extrabold text-white leading-tight ${
                      role === 'projector'
                        ? 'text-2xl sm:text-4xl'
                        : 'text-xl sm:text-2xl'
                    }`}
                  >
                    {act.title}
                  </h2>
                  <p
                    className={`text-slate-200 leading-relaxed ${
                      role === 'projector' ? 'text-lg sm:text-xl' : 'text-sm sm:text-base'
                    }`}
                  >
                    {act.instructions}
                  </p>
                  {act.reference && (
                    <p className="text-xs sm:text-sm font-semibold text-amber-300 inline-flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 shrink-0" />
                      Referencia bíblica: {act.reference}
                    </p>
                  )}
                </div>

                {/* Phase 1 Status vs Active Countdown Timer */}
                {sat.phase === 'spinning_revealed' ? (
                  <div className="bg-amber-400/10 border border-amber-400/40 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 text-amber-200 text-sm font-semibold">
                      <Clock className="w-5 h-5 text-amber-300 shrink-0" />
                      <span>
                        Actividad lista · Cronómetro configurado en{' '}
                        <strong className="font-mono-num text-white">
                          {sat.configuredTimeSec}s
                        </strong>
                      </span>
                    </div>
                    {role !== 'presenter' && (
                      <span className="text-xs text-slate-300">
                        Esperando que el director presione &quot;Comenzar reto&quot;
                      </span>
                    )}
                  </div>
                ) : (
                  <CountdownTimer
                    status={state.status}
                    questionEndsAt={state.questionEndsAt}
                    timeLimitSec={sat.configuredTimeSec}
                    remainingSecFallback={state.remainingSec}
                    clockOffsetMs={clockOffsetMs}
                    large={role === 'projector'}
                    playAudioTicks={role === 'projector'}
                  />
                )}

                {/* Auto-Choice Multiple Options View */}
                {isAutoChoice && act.options && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {act.options.map((opt, idx) => {
                      const isCorrectOpt = isRevealed && act.correctIndex === idx;
                      const isSelectedByMe = mySub?.selectedIndex === idx;
                      const canTap =
                        role === 'participant' &&
                        sat.phase === 'challenge_active' &&
                        state.status === 'question_active' &&
                        !mySub &&
                        !me?.eliminated &&
                        Boolean(onSubmitRoulette);

                      let btnStyle =
                        'bg-[#080E1E] border-slate-800 text-slate-200';
                      if (role === 'presenter' && (isRevealed || showGuidePrivately)) {
                        btnStyle =
                          act.correctIndex === idx
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-semibold'
                            : 'bg-[#080E1E] border-slate-800 text-slate-400';
                      } else if (role === 'participant') {
                        if (isRevealed) {
                          if (isCorrectOpt) {
                            btnStyle =
                              'bg-emerald-600 border-emerald-300 text-white ring-2 ring-emerald-300';
                          } else if (isSelectedByMe) {
                            btnStyle =
                              'bg-rose-700 border-rose-400 text-white';
                          } else {
                            btnStyle =
                              'bg-slate-800/70 border-slate-800 text-slate-400 opacity-60';
                          }
                        } else if (isSelectedByMe) {
                          btnStyle =
                            'bg-sky-600 border-white text-white ring-2 ring-white';
                        } else if (canTap) {
                          btnStyle =
                            'bg-sky-700/35 hover:bg-sky-600/45 border-sky-400/50 text-white cursor-pointer';
                        }
                      } else if (role === 'projector' && isRevealed && isCorrectOpt) {
                        btnStyle =
                          'bg-emerald-600 border-emerald-300 text-white ring-2 ring-emerald-300';
                      }

                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={!canTap}
                          onClick={() => {
                            if (!canTap || !onSubmitRoulette) return;
                            soundFX.playLock();
                            onSubmitRoulette({ selectedIndex: idx });
                          }}
                          className={`p-3.5 rounded-xl border text-left flex items-center gap-3 text-sm transition-all ${btnStyle}`}
                        >
                          <span className="w-7 h-7 rounded-lg bg-black/30 font-mono-num font-bold flex items-center justify-center shrink-0">
                            {OPTION_LETTERS[idx]}
                          </span>
                          <span className="flex-1 font-medium">{opt}</span>
                          {isCorrectOpt && (
                            <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Open / Stage Participation Controls for Player Mobile */}
                {role === 'participant' && !isAutoChoice && (
                  <div className="bg-[#080E1E] border border-slate-800 rounded-2xl p-4 space-y-3">
                    {mySub ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-sky-300 inline-flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" />
                            Participación enviada
                          </span>
                          <span className="font-mono-num text-xs font-bold text-amber-300">
                            {mySub.validationStatus === 'pending'
                              ? 'Pendiente de registro'
                              : `+${mySub.pointsAwarded} pts`}
                          </span>
                        </div>
                        {mySub.submittedText && (
                          <p className="text-xs text-slate-300 bg-[#111A2E] rounded-lg p-2.5">
                            {mySub.submittedText}
                          </p>
                        )}
                      </div>
                    ) : sat.phase === 'challenge_active' &&
                      state.status === 'question_active' &&
                      !me?.eliminated &&
                      onSubmitRoulette ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          soundFX.playLock();
                          onSubmitRoulette({
                            submittedText: textDraft.trim() || undefined,
                            completedSignal: true,
                          });
                        }}
                        className="space-y-2.5"
                      >
                        <textarea
                          rows={2}
                          value={textDraft}
                          onChange={(e) => setTextDraft(e.target.value)}
                          placeholder="Escribe tu respuesta, versículo o comentario breve (opcional si lo realizas en vivo)..."
                          className="w-full bg-[#111A2E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                        />
                        <button
                          type="submit"
                          className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Send className="w-4 h-4" />
                          Enviar / Marcar Actividad Cumplida
                        </button>
                      </form>
                    ) : (
                      <p className="text-xs text-slate-400 text-center">
                        {sat.phase === 'spinning_revealed'
                          ? 'Prepárate: el director iniciará el reto en cualquier momento.'
                          : 'Este turno ha sido cerrado por el director.'}
                      </p>
                    )}
                  </div>
                )}

                {/* Result Recorded Confirmation */}
                {sat.resultRecordedForSpin && sat.recordedSummary && (
                  <div className="bg-emerald-500/15 border border-emerald-400/50 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-display font-bold text-emerald-200 text-sm sm:text-base inline-flex items-center gap-2">
                      <Award className="w-5 h-5 text-emerald-300 shrink-0" />
                      Resultado registrado: {sat.recordedSummary}
                    </span>
                  </div>
                )}

                {/* Director Private Guide / Post-reveal Explanation */}
                {act.guideAnswer && (role === 'presenter' || isRevealed) && (
                  <div className="bg-[#080E1E] border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                    {role === 'presenter' && !isRevealed && (
                      <button
                        type="button"
                        onClick={() => setShowGuidePrivately((v) => !v)}
                        className="text-xs font-semibold text-sky-400 hover:text-sky-300 inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        {showGuidePrivately ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            Ocultar guía del director
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            Ver guía / respuesta sugerida
                          </>
                        )}
                      </button>
                    )}
                    {(isRevealed || (role === 'presenter' && showGuidePrivately)) && (
                      <p className="text-xs sm:text-sm text-emerald-200">
                        <strong className="text-emerald-300">Guía / Respuesta:</strong>{' '}
                        {act.guideAnswer}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[#080E1E] border border-dashed border-slate-700 rounded-2xl p-8 text-center space-y-2">
                <Disc className="w-10 h-10 text-amber-400 mx-auto" />
                <p className="font-display font-bold text-xl text-white">
                  Lista para girar
                </p>
                <p className="text-sm text-slate-400">
                  El director girará la Ruleta del Sábado para revelar la primera actividad.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* PRESENTER LIVE ACTION CONSOLE */}
        {role === 'presenter' && onPresenterAction && (
          <div className="mt-6 pt-5 border-t border-slate-800 space-y-4">
            {/* Configurable Timer Row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1">
                  Cronómetro:
                </span>
                {TIMER_PRESETS.map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() =>
                      onPresenterAction('set_roulette_config', {
                        configuredTimeSec: sec,
                      })
                    }
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-mono-num font-bold cursor-pointer transition-colors ${
                      sat.configuredTimeSec === sec
                        ? 'bg-sky-500 text-slate-950'
                        : 'bg-[#080E1E] border border-slate-700 text-slate-300 hover:border-sky-400'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowDirectorConfig((v) => !v)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Settings2 className="w-3.5 h-3.5 text-amber-300" />
                Controles del Director ({sat.enabledCategories.length}/12)
              </button>
            </div>

            {/* Primary Director Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              {sat.phase === 'spinning_revealed' && (
                <button
                  type="button"
                  onClick={() =>
                    onPresenterAction('start_roulette_challenge', {
                      timeLimitSec: sat.configuredTimeSec,
                    })
                  }
                  className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-sm inline-flex items-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Comenzar Reto ({sat.configuredTimeSec}s)
                </button>
              )}

              {sat.phase === 'challenge_active' && !isRevealed && (
                <button
                  type="button"
                  onClick={() => onPresenterAction('reveal_answer')}
                  className="px-5 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-display font-bold text-sm inline-flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Mostrar Respuesta / Guía
                </button>
              )}

              <button
                type="button"
                disabled={!canRespinNow || wheelSpinning}
                onClick={() =>
                  onPresenterAction('spin_saturday_roulette', {
                    useSuggestedTime: false,
                  })
                }
                className={`px-5 py-3 rounded-xl font-display font-extrabold text-sm inline-flex items-center gap-2 transition-colors ${
                  canRespinNow && !wheelSpinning
                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                {!canRespinNow ? (
                  <Lock className="w-4 h-4" />
                ) : (
                  <RotateCw className="w-4 h-4" />
                )}
                {sat.phase === 'spinning_revealed' && !sat.resultRecordedForSpin
                  ? 'Girar Nuevamente'
                  : 'Girar Ruleta · Siguiente'}
              </button>

              {!canRespinNow && (
                <span className="text-xs text-amber-300/90">
                  Regiro bloqueado por el director hasta comenzar o registrar el reto actual.
                </span>
              )}
            </div>

            {/* Record Result Panel (for active or just-completed spin) */}
            {sat.spinsCount > 0 && (
              <div className="bg-[#080E1E] border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-display font-bold text-sm text-white">
                    Registrar Resultado del Giro #{sat.spinsCount}
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { id: 'featured', label: 'Destacado (130%)' },
                        { id: 'approved', label: 'Cumplido (100%)' },
                        { id: 'participation', label: 'Participación (50%)' },
                        { id: 'rejected', label: 'Sin puntos (0)' },
                      ] as const
                    ).map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setSelectedGrade(g.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                          selectedGrade === g.id
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-[#111A2E] border border-slate-700 text-slate-300'
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    value={resultNote}
                    onChange={(e) => setResultNote(e.target.value)}
                    placeholder="Nota breve del director (opcional)..."
                    className="flex-1 bg-[#111A2E] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onPresenterAction('record_roulette_result', {
                        grade: selectedGrade,
                        note: resultNote,
                        applyToAll: sat.participationMode === 'congregacion',
                        applyToTeam:
                          sat.participationMode === 'parejas' ||
                          sat.participationMode === 'equipos',
                        participantId: sat.targetParticipantId,
                        teamId: sat.targetTeamId,
                        finalizeSpin: true,
                      })
                    }
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Registrar Resultado
                  </button>
                </div>

                {/* Live Submissions List to Validate Individually */}
                {sat.submissions.length > 0 && (
                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Envíos de participantes ({sat.submissions.length})
                    </p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {sat.submissions.map((sub) => (
                        <div
                          key={sub.participantId}
                          className="bg-[#111A2E] border border-slate-800 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <AvatarBadge
                              avatarId={sub.avatarId}
                              photoUrl={sub.photoUrl}
                              name={sub.participantName}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="font-semibold text-white truncate">
                                {sub.participantName}
                              </p>
                              {sub.submittedText && (
                                <p className="text-[11px] text-slate-300 truncate max-w-xs">
                                  {sub.submittedText}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-mono-num font-bold text-amber-300 mr-1">
                              +{sub.pointsAwarded} pts
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                onPresenterAction('validate_roulette_result', {
                                  participantId: sub.participantId,
                                  validationStatus: 'approved',
                                  applyToTeam:
                                    sat.participationMode === 'parejas' ||
                                    sat.participationMode === 'equipos',
                                })
                              }
                              className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                              title="Aprobar participación"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onPresenterAction('validate_roulette_result', {
                                  participantId: sub.participantId,
                                  validationStatus: 'rejected',
                                })
                              }
                              className="px-2 py-1 rounded bg-rose-700 hover:bg-rose-600 text-white font-bold cursor-pointer"
                              title="No cumplido"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Collapsible Director Config Panel */}
            {showDirectorConfig && (
              <div className="bg-[#080E1E] border border-amber-400/35 rounded-2xl p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="font-display font-bold text-sm text-amber-300">
                      Configuración en Vivo del Director
                    </h4>
                    <p className="text-xs text-slate-400">
                      Activa o desactiva categorías de la ruleta (mínimo 2) y controla el permiso de volver a girar.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sat.allowRespin}
                      onChange={(e) =>
                        onPresenterAction('set_roulette_config', {
                          allowRespin: e.target.checked,
                        })
                      }
                      className="accent-amber-400 w-4 h-4"
                    />
                    Permitir girar nuevamente sin registrar
                  </label>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {SATURDAY_ROULETTE_CATEGORIES.map((cat) => {
                    const active = sat.enabledCategories.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleCategory(cat.id)}
                        className={`px-2.5 py-2 rounded-xl border text-left text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${
                          active
                            ? 'bg-[#111A2E] border-amber-400/60 text-white'
                            : 'bg-[#0B1222] border-slate-800 text-slate-500 opacity-60'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="truncate">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
