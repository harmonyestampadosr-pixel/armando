import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  HelpCircle,
  Lightbulb,
  ToggleLeft,
  ToggleRight,
  XCircle,
} from 'lucide-react';
import { DIFFICULTY_LABELS, GameRoomClientState } from '../shared/types';
import { soundFX } from '../utils/sound';
import { CountdownTimer } from './CountdownTimer';

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];
const OPTION_STYLES = [
  'bg-sky-600 hover:bg-sky-500 border-sky-400/50 text-white',
  'bg-amber-600 hover:bg-amber-500 border-amber-400/50 text-white',
  'bg-emerald-600 hover:bg-emerald-500 border-emerald-400/50 text-white',
  'bg-rose-600 hover:bg-rose-500 border-rose-400/50 text-white',
];

export function LearningMultiplayerRoomPanel({
  state,
  role,
  clockOffsetMs,
  onPresenterAction,
  onSubmitAnswer,
}: {
  state: GameRoomClientState;
  role: 'presenter' | 'projector' | 'participant';
  clockOffsetMs: number;
  onPresenterAction?: (action: string, extra?: Record<string, unknown>) => void;
  onSubmitAnswer?: (questionIndex: number, selectedIndex: number) => void;
}) {
  const ls = state.learningState;
  const card = ls?.currentCard;
  const myAns = state.myCurrentAnswer;

  const [showPrivateGuide, setShowPrivateGuide] = useState(false);
  const [showComplementary, setShowComplementary] = useState(false);

  useEffect(() => {
    setShowPrivateGuide(false);
    setShowComplementary(false);
  }, [ls?.currentIndex, card?.id]);

  if (!ls || !card) return null;

  const isRevealed =
    state.status === 'answer_revealed' || state.status === 'finished';
  const showExplanationNow =
    (isRevealed && ls.explanationTiming === 'after_each') ||
    (role === 'presenter' && showPrivateGuide);

  return (
    <div className="bg-[#111A2E] border border-sky-500/40 rounded-2xl p-5 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wider text-sky-300">
              <GraduationCap className="w-4 h-4" />
              Aprende con la Biblia · Pregunta {ls.currentIndex + 1} de{' '}
              {ls.totalCards}
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-300 font-semibold">
              {card.topicLabel}
            </span>
            <span aria-hidden="true">·</span>
            <span>{card.bookOrSection}</span>
            {card.chapterRef && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-300 font-semibold">
                  {card.chapterRef}
                </span>
              </>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Dificultad: {DIFFICULTY_LABELS[card.difficulty]} · Explicación:{' '}
            <strong className="text-slate-200">
              {ls.explanationTiming === 'after_each'
                ? 'Después de cada pregunta'
                : 'Al finalizar toda la ronda'}
            </strong>
          </p>
        </div>

        {role === 'presenter' && onPresenterAction && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onPresenterAction('toggle_explanation_timing')}
              className="px-3 py-1.5 rounded-xl bg-[#080E1E] border border-slate-700 hover:border-sky-400 text-xs font-semibold text-sky-300 inline-flex items-center gap-1.5 cursor-pointer"
              title="Alternar cuándo se muestran las explicaciones bíblicas"
            >
              {ls.explanationTiming === 'after_each' ? (
                <ToggleRight className="w-4 h-4 text-emerald-400" />
              ) : (
                <ToggleLeft className="w-4 h-4 text-amber-300" />
              )}
              {ls.explanationTiming === 'after_each'
                ? 'Explicación tras cada pregunta'
                : 'Explicación al final de ronda'}
            </button>

            <button
              type="button"
              onClick={() => setShowPrivateGuide((v) => !v)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-amber-300 inline-flex items-center gap-1.5 cursor-pointer"
            >
              {showPrivateGuide ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  Ocultar guía
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  Ver guía bíblica
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <CountdownTimer
        status={state.status}
        questionEndsAt={state.questionEndsAt}
        timeLimitSec={state.config.timeLimitSec}
        remainingSecFallback={state.remainingSec}
        clockOffsetMs={clockOffsetMs}
        large={role === 'projector'}
      />

      <h2
        className={`font-display font-bold text-white leading-snug ${
          role === 'projector' ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'
        }`}
      >
        {card.prompt}
      </h2>

      {/* Options */}
      <div className="grid grid-cols-1 gap-2.5">
        {card.options.map((opt, idx) => {
          const isSelected = myAns?.selectedIndex === idx;
          const isCorrectOpt =
            (isRevealed || (role === 'presenter' && showPrivateGuide)) &&
            card.correctIndex === idx;
          const canTap =
            role === 'participant' &&
            state.status === 'question_active' &&
            !myAns &&
            !state.myParticipant?.eliminated;

          let cls = 'bg-[#080E1E] border-slate-800 text-slate-300';
          if (role === 'participant') {
            cls = OPTION_STYLES[idx % OPTION_STYLES.length];
            if (isRevealed) {
              if (isCorrectOpt) {
                cls =
                  'bg-emerald-600 border-emerald-300 text-white ring-2 ring-emerald-300';
              } else if (isSelected && !isCorrectOpt) {
                cls = 'bg-rose-700 border-rose-400 text-white opacity-90';
              } else {
                cls = 'bg-slate-800/80 border-slate-700 text-slate-400 opacity-55';
              }
            } else if (myAns) {
              cls = isSelected
                ? 'bg-sky-600 border-white text-white ring-2 ring-white'
                : 'bg-slate-800/70 border-slate-700 text-slate-400 opacity-50';
            } else if (
              state.status === 'question_locked' ||
              state.myParticipant?.eliminated
            ) {
              cls = 'bg-slate-800/70 border-slate-700 text-slate-400 opacity-60';
            }
          } else if (isCorrectOpt) {
            cls =
              'bg-emerald-500/20 border-emerald-400 text-emerald-100 font-semibold';
          }

          return (
            <button
              key={idx}
              type="button"
              disabled={!canTap}
              onClick={() => {
                if (!canTap || !onSubmitAnswer) return;
                soundFX.playStudyNote();
                onSubmitAnswer(state.currentQuestionIndex, idx);
              }}
              className={`w-full p-3.5 sm:p-4 rounded-xl border text-left flex items-center gap-3 transition-all ${
                canTap ? 'cursor-pointer active:scale-[0.99]' : 'cursor-default'
              } ${cls}`}
            >
              <span className="w-8 h-8 rounded-lg bg-black/25 font-mono-num font-bold text-sm flex items-center justify-center shrink-0">
                {OPTION_LETTERS[idx]}
              </span>
              <span className="flex-1 text-sm sm:text-base font-medium">
                {opt}
              </span>
              {(isRevealed || (role === 'presenter' && showPrivateGuide)) &&
                isCorrectOpt && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
                )}
              {isRevealed &&
                role === 'participant' &&
                isSelected &&
                !isCorrectOpt && (
                  <XCircle className="w-5 h-5 text-white shrink-0" />
                )}
            </button>
          );
        })}
      </div>

      {/* Waiting message for participant */}
      {role === 'participant' && state.status === 'question_active' && myAns && (
        <div className="bg-sky-500/15 border border-sky-400/50 rounded-xl p-4 text-center text-sky-200 text-sm font-medium">
          ¡Respuesta registrada! Esperando a que termine el tiempo o el
          presentador revele la respuesta.
        </div>
      )}

      {/* Participant Score Summary on Reveal */}
      {role === 'participant' && state.status === 'answer_revealed' && (
        <div className="bg-[#080E1E] border border-slate-700 rounded-xl p-4 flex items-center justify-between gap-3">
          {myAns ? (
            myAns.isCorrect ? (
              <>
                <span className="font-display font-bold text-emerald-300 inline-flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  ¡Respuesta Correcta!
                </span>
                <span className="font-mono-num font-extrabold text-lg text-amber-300">
                  +{(myAns.pointsEarned ?? 0).toLocaleString('es-CO')} pts
                </span>
              </>
            ) : (
              <span className="font-display font-bold text-rose-300 inline-flex items-center gap-2">
                <XCircle className="w-5 h-5" />
                Respuesta Incorrecta (+0 pts)
              </span>
            )
          ) : (
            <span className="text-sm text-slate-400">
              No enviaste respuesta a tiempo (+0 pts)
            </span>
          )}
        </div>
      )}

      {/* Mode: End of Round notice when revealed */}
      {isRevealed &&
        ls.explanationTiming === 'end_of_round' &&
        role !== 'presenter' && (
          <div className="bg-amber-400/10 border border-amber-400/35 rounded-xl p-4 text-xs sm:text-sm text-amber-200">
            Modo Ronda Continua: la explicación bíblica completa, contexto y cita
            de esta pregunta se presentarán al finalizar toda la ronda.
          </div>
        )}

      {/* Teaching Explanation Panel (after_each OR presenter private guide) */}
      {showExplanationNow && card.reference && (
        <div className="bg-[#080E1E] border border-sky-500/40 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300">
              <BookOpen className="w-4 h-4" />
              Cita bíblica: {card.reference}
            </span>
            {role === 'presenter' && !isRevealed && (
              <span className="text-[11px] font-semibold text-sky-300">
                Vista privada del presentador
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs sm:text-sm">
            {card.simpleExplanation && (
              <div className="bg-[#111A2E] border border-slate-800 rounded-xl p-3.5 space-y-1">
                <p className="text-[11px] font-bold text-sky-300 uppercase">
                  Explicación sencilla
                </p>
                <p className="text-slate-200">{card.simpleExplanation}</p>
              </div>
            )}
            {card.context && (
              <div className="bg-[#111A2E] border border-slate-800 rounded-xl p-3.5 space-y-1">
                <p className="text-[11px] font-bold text-indigo-300 uppercase">
                  Contexto
                </p>
                <p className="text-slate-200">{card.context}</p>
              </div>
            )}
            {card.mainTeaching && (
              <div className="bg-[#111A2E] border border-slate-800 rounded-xl p-3.5 space-y-1">
                <p className="text-[11px] font-bold text-emerald-300 uppercase inline-flex items-center gap-1">
                  <Lightbulb className="w-3.5 h-3.5" />
                  Enseñanza principal
                </p>
                <p className="text-slate-200">{card.mainTeaching}</p>
              </div>
            )}
          </div>

          {card.complementaryQuestion && (
            <div className="bg-[#111A2E] border border-amber-400/30 rounded-xl p-3.5 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-amber-300 inline-flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5" />
                  Pregunta complementaria para dialogar
                </p>
                <button
                  type="button"
                  onClick={() => setShowComplementary((v) => !v)}
                  className="text-xs font-semibold text-sky-400 hover:text-sky-300 cursor-pointer"
                >
                  {showComplementary ? 'Ocultar' : 'Ver respuesta'}
                </button>
              </div>
              <p className="text-xs sm:text-sm text-white">
                {card.complementaryQuestion.prompt}
              </p>
              {showComplementary && (
                <p className="text-xs text-emerald-300">
                  {card.complementaryQuestion.answer} (
                  {card.complementaryQuestion.reference})
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Presenter Action Bar */}
      {role === 'presenter' && onPresenterAction && (
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-800">
          {!isRevealed && state.status !== 'paused' && (
            <button
              type="button"
              onClick={() => onPresenterAction('reveal_answer')}
              className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-sm inline-flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              Mostrar Respuesta
            </button>
          )}
          <button
            type="button"
            onClick={() => onPresenterAction('next_question')}
            className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-sm inline-flex items-center gap-2 cursor-pointer ml-auto"
          >
            {ls.currentIndex + 1 >= ls.totalCards
              ? 'Finalizar Ronda'
              : 'Siguiente Pregunta'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
