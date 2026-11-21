import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Delete,
  Eye,
  EyeOff,
  Grid,
  Link2,
  RotateCcw,
  Send,
  Shuffle,
  Sparkles,
  Trophy,
  XCircle,
} from 'lucide-react';
import { DIFFICULTY_LABELS, GameRoomClientState } from '../shared/types';
import { soundFX } from '../utils/sound';
import { AvatarBadge } from './AvatarBadge';
import { CountdownTimer } from './CountdownTimer';

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export function RetoMultiplayerRoomPanel({
  state,
  role,
  clockOffsetMs,
  onPresenterAction,
  onSubmitRetoAttempt,
}: {
  state: GameRoomClientState;
  role: 'presenter' | 'projector' | 'participant';
  clockOffsetMs: number;
  onPresenterAction?: (action: string, extra?: Record<string, unknown>) => void;
  onSubmitRetoAttempt?: (payload: Record<string, unknown>) => void;
}) {
  const rs = state.retoState;
  const challenge = rs?.currentChallenge;

  const [cwGrid, setCwGrid] = useState<Record<string, string>>({});
  const [scAnswer, setScAnswer] = useState('');
  const [usedTileIndices, setUsedTileIndices] = useState<number[]>([]);
  const [cvTyped, setCvTyped] = useState('');
  const [pairings, setPairings] = useState<Record<string, string>>({});
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    setCwGrid({});
    setScAnswer('');
    setUsedTileIndices([]);
    setCvTyped('');
    setPairings({});
    setShowGuide(false);
  }, [rs?.currentIndex, challenge?.id]);

  if (!rs || !challenge) return null;

  const isRevealed =
    state.status === 'answer_revealed' || state.status === 'finished';
  const mySub = rs.mySubmission;
  const canInteract =
    role === 'participant' &&
    state.status === 'question_active' &&
    !mySub?.submitted &&
    !state.myParticipant?.eliminated;

  const kindMeta = {
    crucigrama_biblico: {
      label: 'Crucigrama Bíblico',
      icon: Grid,
      accent: 'text-teal-300',
    },
    palabras_desordenadas: {
      label: 'Palabras Desordenadas',
      icon: Shuffle,
      accent: 'text-amber-300',
    },
    completa_versiculo: {
      label: 'Completa el Versículo',
      icon: BookOpen,
      accent: 'text-sky-300',
    },
    rompecabezas_biblico: {
      label: 'Rompecabezas Bíblico',
      icon: Link2,
      accent: 'text-emerald-300',
    },
  }[rs.kind];

  const KindIcon = kindMeta.icon;

  // Build coordinate metadata for crossword
  const cwCellMap = new Map<string, { numbers: number[] }>();
  if (challenge.kind === 'crucigrama_biblico') {
    for (const w of challenge.words) {
      for (let i = 0; i < w.length; i++) {
        const r = w.direction === 'H' ? w.row : w.row + i;
        const c = w.direction === 'H' ? w.col + i : w.col;
        const coord = `${r},${c}`;
        const existing = cwCellMap.get(coord) || { numbers: [] };
        if (i === 0 && !existing.numbers.includes(w.number)) {
          existing.numbers.push(w.number);
        }
        cwCellMap.set(coord, existing);
      }
    }
  }

  return (
    <div className="bg-[#111A2E] border border-teal-500/40 rounded-2xl p-5 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div
            className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${kindMeta.accent}`}
          >
            <KindIcon className="w-4 h-4" />
            {kindMeta.label} · Desafío {rs.currentIndex + 1} de{' '}
            {rs.totalChallenges}
          </div>
          <p className="text-xs text-slate-400">
            Dificultad: {DIFFICULTY_LABELS[challenge.difficulty]} · Han enviado:{' '}
            <strong className="font-mono-num text-white">
              {state.answeredParticipantIds.length}/{state.participants.length}
            </strong>
          </p>
        </div>

        {role === 'presenter' && (
          <button
            type="button"
            onClick={() => setShowGuide((v) => !v)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-sky-300 inline-flex items-center gap-1.5 cursor-pointer"
          >
            {showGuide ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                Ocultar guía privada
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                Ver solución guía
              </>
            )}
          </button>
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

      {/* 1. CRUCIGRAMA BÍBLICO */}
      {challenge.kind === 'crucigrama_biblico' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-lg sm:text-xl font-bold text-white">
              {challenge.title}
            </h3>
            <span className="text-xs text-slate-400">
              Escribe letras sin tildes
            </span>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            <div className="xl:col-span-6 overflow-x-auto">
              <div
                className="inline-grid gap-1 bg-[#080E1E] p-3 rounded-xl border border-slate-800"
                style={{
                  gridTemplateColumns: `repeat(${challenge.cols}, minmax(28px, 38px))`,
                }}
              >
                {Array.from({ length: challenge.rows }).map((_, r) =>
                  Array.from({ length: challenge.cols }).map((__, c) => {
                    const coord = `${r},${c}`;
                    const meta = cwCellMap.get(coord);
                    if (!meta) {
                      return <div key={coord} className="w-7 h-7 sm:w-9 sm:h-9" />;
                    }
                    const officialChar = challenge.solutionGrid?.[coord] || '';
                    const userChar = cwGrid[coord] || '';
                    const shouldShowOfficial =
                      (isRevealed || (role === 'presenter' && showGuide)) &&
                      officialChar;
                    const displayChar =
                      role === 'participant'
                        ? userChar || (isRevealed ? officialChar : '')
                        : shouldShowOfficial
                          ? officialChar
                          : '';

                    return (
                      <div key={coord} className="relative w-7 h-7 sm:w-9 sm:h-9">
                        {meta.numbers.length > 0 && (
                          <span className="absolute top-0.5 left-1 text-[9px] font-mono-num font-bold text-amber-300 pointer-events-none">
                            {meta.numbers[0]}
                          </span>
                        )}
                        {role === 'participant' ? (
                          <input
                            type="text"
                            maxLength={1}
                            disabled={!canInteract}
                            value={displayChar}
                            onChange={(e) => {
                              const val = e.target.value
                                .normalize('NFD')
                                .replace(/[\u0300-\u036f]/g, '')
                                .toUpperCase()
                                .replace(/[^A-Z]/g, '');
                              setCwGrid((prev) => ({ ...prev, [coord]: val }));
                            }}
                            className={`w-full h-full border rounded-md text-center font-mono-num font-extrabold text-sm sm:text-base uppercase focus:outline-none ${
                              isRevealed
                                ? 'bg-emerald-500/15 border-emerald-400 text-emerald-200'
                                : 'bg-[#15203A] border-slate-600 focus:border-amber-400 text-white'
                            }`}
                          />
                        ) : (
                          <div
                            className={`w-full h-full border rounded-md flex items-center justify-center font-mono-num font-extrabold text-sm sm:text-base ${
                              shouldShowOfficial
                                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                                : 'bg-[#15203A] border-slate-700 text-slate-400'
                            }`}
                          >
                            {displayChar}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="xl:col-span-6 space-y-2.5">
              {challenge.words.map((w) => {
                const myWordRes = mySub?.wordResults?.find(
                  (wr) => wr.wordId === w.id
                );
                return (
                  <div
                    key={w.id}
                    className={`p-3 rounded-xl border text-xs sm:text-sm ${
                      myWordRes && isRevealed
                        ? myWordRes.correct
                          ? 'bg-emerald-500/15 border-emerald-400 text-emerald-100'
                          : 'bg-rose-500/15 border-rose-400 text-rose-100'
                        : 'bg-[#080E1E] border-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-amber-300">
                        {w.number}. {w.direction === 'H' ? 'Horizontal' : 'Vertical'} ({w.length} letras)
                      </span>
                      {(isRevealed || (role === 'presenter' && showGuide)) &&
                        w.displayAnswer && (
                          <span className="font-mono-num font-extrabold text-emerald-300">
                            {w.displayAnswer}
                          </span>
                        )}
                    </div>
                    <p className="mt-1">{w.clue}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Cita: {w.reference}
                    </p>
                  </div>
                );
              })}

              {canInteract && onSubmitRetoAttempt && (
                <button
                  type="button"
                  onClick={() => {
                    soundFX.playCrosswordWord();
                    onSubmitRetoAttempt({
                      challengeIndex: rs.currentIndex,
                      grid: cwGrid,
                    });
                  }}
                  className="w-full py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  Enviar Crucigrama
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. PALABRAS DESORDENADAS */}
      {challenge.kind === 'palabras_desordenadas' && (
        <div className="space-y-5">
          <div className="bg-[#080E1E] border border-slate-800 rounded-2xl p-5 sm:p-6 text-center space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
              <span>
                Categoría:{' '}
                <strong className="text-sky-300">{challenge.category}</strong>
              </span>
              <span>Ordena las {challenge.wordLength} letras</span>
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              {challenge.scrambledLetters.split('').map((ch, idx) => {
                const used = usedTileIndices.includes(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={!canInteract || used}
                    onClick={() => {
                      if (!canInteract || used) return;
                      soundFX.playTileMove();
                      setUsedTileIndices((prev) => [...prev, idx]);
                      setScAnswer((prev) => `${prev}${ch}`);
                    }}
                    className={`w-10 h-12 sm:w-12 sm:h-14 rounded-xl border font-mono-num font-extrabold text-xl sm:text-2xl flex items-center justify-center transition-all ${
                      used
                        ? 'bg-slate-900 border-slate-800 text-slate-600 opacity-45'
                        : canInteract
                          ? 'bg-amber-400/15 hover:bg-amber-400/30 border-amber-400/60 text-amber-300 cursor-pointer'
                          : 'bg-amber-400/15 border-amber-400/50 text-amber-300'
                    }`}
                  >
                    {ch}
                  </button>
                );
              })}
            </div>

            <p className="text-sm sm:text-base text-slate-300">
              Pista: <strong className="text-white">{challenge.hint}</strong>
            </p>
            <p className="text-xs text-slate-400">Cita: {challenge.reference}</p>
          </div>

          {canInteract && onSubmitRetoAttempt && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={scAnswer}
                  onChange={(e) => {
                    setScAnswer(e.target.value.toUpperCase());
                    setUsedTileIndices([]);
                  }}
                  placeholder="Toca las fichas o escribe la palabra..."
                  className="flex-1 min-w-[200px] bg-[#080E1E] border border-slate-700 rounded-xl px-4 py-3 text-white font-mono-num font-bold tracking-wider uppercase focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (usedTileIndices.length > 0) {
                      setUsedTileIndices((prev) => prev.slice(0, -1));
                    }
                    setScAnswer((prev) => prev.slice(0, -1));
                  }}
                  className="px-3.5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  title="Borrar última letra"
                >
                  <Delete className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScAnswer('');
                    setUsedTileIndices([]);
                  }}
                  className="px-3.5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  title="Limpiar letras"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={scAnswer.trim().length < 2}
                  onClick={() => {
                    soundFX.playLock();
                    onSubmitRetoAttempt({
                      challengeIndex: rs.currentIndex,
                      answer: scAnswer,
                    });
                  }}
                  className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-sm inline-flex items-center gap-2 cursor-pointer disabled:opacity-45"
                >
                  <Send className="w-4 h-4" />
                  Enviar Palabra
                </button>
              </div>
            </div>
          )}

          {(isRevealed || (role === 'presenter' && showGuide)) &&
            challenge.displayWord && (
              <div className="bg-emerald-500/15 border border-emerald-400/60 rounded-xl p-4 flex flex-wrap items-center justify-between gap-2">
                <span className="font-display font-extrabold text-lg text-emerald-200 inline-flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-300" />
                  {isRevealed ? 'Palabra correcta:' : 'Guía:'} {challenge.displayWord}
                </span>
                <span className="text-xs font-semibold text-amber-300">
                  {challenge.reference}
                </span>
              </div>
            )}
        </div>
      )}

      {/* 3. COMPLETA EL VERSÍCULO */}
      {challenge.kind === 'completa_versiculo' && (
        <div className="space-y-5">
          <div className="bg-[#080E1E] border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-3">
            <p className="text-xs font-bold text-amber-300 uppercase tracking-wider">
              {challenge.reference}
            </p>
            <p
              className={`font-display font-bold text-white leading-relaxed ${
                role === 'projector' ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-2xl'
              }`}
            >
              «{challenge.verseBefore}{' '}
              <span className="inline-block px-3 py-0.5 rounded-lg border border-dashed border-amber-400 text-amber-300 mx-1">
                {(isRevealed || (role === 'presenter' && showGuide)) &&
                challenge.missingWord
                  ? challenge.missingWord
                  : '_______'}
              </span>{' '}
              {challenge.verseAfter}»
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {challenge.options.map((opt, idx) => {
              const isSelected = mySub?.selectedIndex === idx;
              const isCorrectOpt =
                (isRevealed || (role === 'presenter' && showGuide)) &&
                challenge.correctIndex === idx;

              let btnCls = 'bg-[#080E1E] border-slate-800 text-slate-300';
              if (isRevealed) {
                if (isCorrectOpt) {
                  btnCls =
                    'bg-emerald-600/30 border-emerald-400 text-emerald-100 ring-1 ring-emerald-300';
                } else if (isSelected && !isCorrectOpt) {
                  btnCls = 'bg-rose-600/30 border-rose-400 text-rose-100';
                } else {
                  btnCls = 'bg-[#080E1E] border-slate-800 text-slate-500 opacity-60';
                }
              } else if (role === 'presenter' && showGuide && isCorrectOpt) {
                btnCls =
                  'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-bold';
              } else if (isSelected) {
                btnCls = 'bg-sky-600/30 border-sky-400 text-white ring-1 ring-sky-400';
              } else if (canInteract) {
                btnCls =
                  'bg-[#080E1E] hover:bg-slate-800 border-slate-700 text-white cursor-pointer';
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!canInteract}
                  onClick={() => {
                    if (!canInteract || !onSubmitRetoAttempt) return;
                    soundFX.playVerseSelect();
                    onSubmitRetoAttempt({
                      challengeIndex: rs.currentIndex,
                      selectedIndex: idx,
                    });
                  }}
                  className={`p-4 rounded-xl border text-left font-semibold text-sm sm:text-base flex items-center gap-3 transition-colors ${btnCls}`}
                >
                  <span className="w-8 h-8 rounded-lg bg-black/30 font-mono-num font-bold text-sm flex items-center justify-center shrink-0">
                    {OPTION_LETTERS[idx]}
                  </span>
                  <span className="flex-1">{opt}</span>
                  {isRevealed && isCorrectOpt && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
                  )}
                  {isRevealed && isSelected && !isCorrectOpt && (
                    <XCircle className="w-5 h-5 text-rose-300 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {canInteract && onSubmitRetoAttempt && (
            <div className="flex gap-2">
              <input
                type="text"
                value={cvTyped}
                onChange={(e) => setCvTyped(e.target.value)}
                placeholder="O escribe la palabra exacta que falta..."
                className="flex-1 bg-[#080E1E] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white"
              />
              <button
                type="button"
                disabled={cvTyped.trim().length < 2}
                onClick={() => {
                  soundFX.playVerseSelect();
                  onSubmitRetoAttempt({
                    challengeIndex: rs.currentIndex,
                    typedAnswer: cvTyped.trim(),
                  });
                }}
                className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs cursor-pointer disabled:opacity-45"
              >
                Enviar texto
              </button>
            </div>
          )}

          {(isRevealed || (role === 'presenter' && showGuide)) &&
            challenge.explanation && (
              <div className="bg-[#080E1E] border border-emerald-500/40 rounded-xl p-4 space-y-1">
                <p className="text-xs font-bold text-amber-300">
                  Cita bíblica: {challenge.reference}
                </p>
                <p className="text-xs sm:text-sm text-slate-200">
                  {challenge.explanation}
                </p>
              </div>
            )}
        </div>
      )}

      {/* 4. ROMPECABEZAS DE RELACIÓN */}
      {challenge.kind === 'rompecabezas_biblico' && (
        <div className="space-y-4">
          <div>
            <h3 className="font-display text-lg sm:text-xl font-bold text-white">
              {challenge.title}
            </h3>
            <p className="text-xs text-slate-400">{challenge.description}</p>
          </div>

          <div className="space-y-2.5">
            {challenge.leftItems.map((left) => {
              const myPairRes = mySub?.pairResults?.find(
                (p) => p.id === left.id
              );
              const expected = challenge.expectedPairs?.find(
                (ep) => ep.id === left.id
              );
              return (
                <div
                  key={left.id}
                  className={`p-3.5 rounded-xl border grid grid-cols-1 md:grid-cols-12 gap-3 items-center ${
                    myPairRes && isRevealed
                      ? myPairRes.correct
                        ? 'bg-emerald-500/15 border-emerald-400'
                        : 'bg-rose-500/15 border-rose-400'
                      : 'bg-[#080E1E] border-slate-800'
                  }`}
                >
                  <div className="md:col-span-4 font-display font-bold text-white text-sm">
                    {left.label}
                  </div>

                  <div className="md:col-span-8">
                    {role === 'participant' ? (
                      <select
                        disabled={!canInteract}
                        value={pairings[left.id] || ''}
                        onChange={(e) => {
                          soundFX.playPuzzleSnap();
                          setPairings((prev) => ({
                            ...prev,
                            [left.id]: e.target.value,
                          }));
                        }}
                        className="w-full bg-[#111A2E] border border-slate-700 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-slate-200 disabled:opacity-65"
                      >
                        <option value="">
                          Selecciona su pareja correspondiente...
                        </option>
                        {challenge.rightItems.map((r) => (
                          <option key={r.right} value={r.right}>
                            {r.right}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-xs sm:text-sm text-slate-300">
                        {(isRevealed || showGuide) && expected ? (
                          <span className="text-emerald-300 font-semibold">
                            {expected.right}{' '}
                            <span className="text-amber-300 text-xs">
                              ({expected.reference})
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-500">
                            Pareja oculta hasta finalizar el tiempo
                          </span>
                        )}
                      </div>
                    )}

                    {isRevealed && expected && role === 'participant' && (
                      <p className="text-[11px] text-amber-300 mt-1">
                        Correcto: {expected.right} ({expected.reference})
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {canInteract && onSubmitRetoAttempt && (
            <button
              type="button"
              onClick={() => {
                soundFX.playPuzzleSnap();
                onSubmitRetoAttempt({
                  challengeIndex: rs.currentIndex,
                  pairings,
                });
              }}
              className="w-full py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              Enviar Relaciones
            </button>
          )}
        </div>
      )}

      {/* Participant Waiting / Personal Outcome */}
      {role === 'participant' &&
        state.status === 'question_active' &&
        mySub?.submitted && (
          <div className="bg-sky-500/15 border border-sky-400/50 rounded-xl p-4 text-center text-sky-200 text-sm font-medium">
            ¡Respuesta registrada! Esperando al resto o al cierre del tiempo.
          </div>
        )}

      {role === 'participant' &&
        state.status === 'question_locked' &&
        !mySub?.submitted &&
        !state.myParticipant?.eliminated && (
          <div className="bg-amber-500/15 border border-amber-400/50 rounded-xl p-4 text-center text-amber-200 text-sm font-medium">
            Tiempo finalizado. Esperando que el presentador muestre los resultados.
          </div>
        )}

      {role === 'participant' && isRevealed && (
        <div className="bg-[#080E1E] border border-slate-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          {mySub?.submitted ? (
            <>
              <div className="flex items-center gap-2">
                {mySub.isCorrect ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-amber-400" />
                )}
                <span className="font-display font-bold text-sm text-white">
                  {mySub.isCorrect
                    ? '¡Desafío completado con precisión!'
                    : `Precisión obtenida: ${mySub.accuracyPercent ?? 0}%`}
                </span>
              </div>
              <span className="font-mono-num font-extrabold text-lg text-amber-300">
                +{(mySub.pointsEarned ?? 0).toLocaleString('es-CO')} pts
              </span>
            </>
          ) : (
            <span className="text-sm text-slate-400">
              No enviaste respuesta a tiempo (+0 pts)
            </span>
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
              Mostrar Resultados
            </button>
          )}
          <button
            type="button"
            onClick={() => onPresenterAction('next_question')}
            className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-sm inline-flex items-center gap-2 cursor-pointer ml-auto"
          >
            {rs.currentIndex + 1 >= rs.totalChallenges
              ? 'Ver Resultados Finales'
              : 'Siguiente Reto'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Challenge Results Table (Shown after reveal) */}
      {isRevealed && rs.challengeResults.length > 0 && (
        <div className="bg-[#080E1E] border border-slate-800 rounded-xl p-4 space-y-2.5">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-300 inline-flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5" />
            Resultados del desafío
          </p>
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {rs.challengeResults.map((entry, idx) => (
              <div
                key={entry.participantId}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[#111A2E] text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-mono-num font-bold text-amber-300 w-5">
                    #{idx + 1}
                  </span>
                  <AvatarBadge
                    avatarId={entry.avatarId}
                    photoUrl={entry.photoUrl}
                    name={entry.participantName}
                    size="sm"
                  />
                  <span className="font-semibold text-white truncate">
                    {entry.participantName}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0 font-mono-num">
                  <span
                    className={
                      entry.accuracyPercent >= 100
                        ? 'text-emerald-300 font-bold'
                        : entry.accuracyPercent > 0
                          ? 'text-sky-300'
                          : 'text-rose-300'
                    }
                  >
                    {entry.accuracyPercent}%
                  </span>
                  {entry.responseTimeMs !== null && (
                    <span className="text-slate-400">
                      {(entry.responseTimeMs / 1000).toFixed(1)}s
                    </span>
                  )}
                  <span className="text-amber-300 font-bold">
                    +{entry.pointsEarned} pts
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
