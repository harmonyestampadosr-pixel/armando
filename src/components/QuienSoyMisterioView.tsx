import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Eye,
  HelpCircle,
  Search,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react';
import { GameRoomClientState } from '../shared/types';
import { getOrCreateProfileKey } from '../utils/profileKey';
import { soundFX } from '../utils/sound';
import { AvatarBadge } from './AvatarBadge';
import { CompetitionSetupForm } from './CompetitionSetupForm';
import { CountdownTimer } from './CountdownTimer';

interface SoloMysteryItem {
  id: string;
  kind: 'quien_soy' | 'misterio_biblico';
  title: string;
  clues: string[];
  options: string[];
  difficulty: string;
  avatarId: string;
}

interface SoloMysteryGuessFeedback {
  isCorrect: boolean;
  pointsEarned: number;
  answer: string;
  correctOptionIndex: number;
  reference: string;
  explanation: string;
}

export function QuienSoyMisterioView({
  onBack,
  onCreatedMultiplayerRoom,
  onJoinCode,
}: {
  onBack: () => void;
  onCreatedMultiplayerRoom: (code: string, presenterToken: string) => void;
  onJoinCode?: (code: string) => void;
}) {
  const [kind, setKind] = useState<'quien_soy' | 'misterio_biblico'>('quien_soy');
  const [playMode, setPlayMode] = useState<'solo' | 'multiplayer'>('solo');

  // Solo state
  const [items, setItems] = useState<SoloMysteryItem[]>([]);
  const [itemIdx, setItemIdx] = useState(0);
  const [revealedClues, setRevealedClues] = useState(1);
  const [typedGuess, setTypedGuess] = useState('');
  const [soloFeedback, setSoloFeedback] = useState<SoloMysteryGuessFeedback | null>(null);
  const [soloScore, setSoloScore] = useState(0);

  const profileKey = getOrCreateProfileKey();

  useEffect(() => {
    soundFX.setDidacticAmbient('mystery');
    return () => soundFX.setDidacticAmbient(null);
  }, []);

  useEffect(() => {
    fetch(`/api/expansion/mystery/solo?kind=${kind}`)
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items || []);
        setItemIdx(0);
        setRevealedClues(1);
        setTypedGuess('');
        setSoloFeedback(null);
      });
  }, [kind]);

  const currentItem = items.length > 0 ? items[itemIdx % items.length] : null;
  const potentialPoints = [1500, 1200, 950, 750, 550][Math.min(4, revealedClues - 1)] || 500;

  const submitSoloGuess = async (payload: { selectedIndex?: number; typedAnswer?: string }) => {
    if (!currentItem || soloFeedback) return;
    const res = await fetch('/api/expansion/mystery/solo-guess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profileKey,
        itemId: currentItem.id,
        revealedClueCount: revealedClues,
        ...payload,
      }),
    });
    const out = (await res.json()) as SoloMysteryGuessFeedback;
    setSoloFeedback(out);
    if (out.isCorrect) {
      soundFX.playMysterySolved();
      setSoloScore((s) => s + out.pointsEarned);
    } else {
      soundFX.playDiscreetError();
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al inicio
      </button>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-300">
            <Search className="w-4 h-4" />
            Pistas Progresivas · Más Puntos si Aciertas Antes
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white">
            ¿Quién Soy? y Misterio Bíblico
          </h1>
          <p className="text-slate-400 text-sm">
            Descubre personajes del Antiguo y Nuevo Testamento o acontecimientos históricos de la Biblia con pistas paso a paso.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setKind('quien_soy');
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer ${
              kind === 'quien_soy'
                ? 'bg-purple-500 text-white'
                : 'bg-[#111A2E] border border-slate-800 text-slate-300'
            }`}
          >
            ¿Quién Soy? (Personajes)
          </button>
          <button
            type="button"
            onClick={() => {
              setKind('misterio_biblico');
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer ${
              kind === 'misterio_biblico'
                ? 'bg-indigo-500 text-white'
                : 'bg-[#111A2E] border border-slate-800 text-slate-300'
            }`}
          >
            Misterio Bíblico (Relatos)
          </button>
        </div>
      </div>

      {/* Mode Switch */}
      <div className="flex gap-2 bg-[#111A2E] border border-slate-800 p-1.5 rounded-2xl w-fit">
        <button
          type="button"
          onClick={() => setPlayMode('solo')}
          className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${
            playMode === 'solo' ? 'bg-amber-400 text-slate-950' : 'text-slate-300'
          }`}
        >
          Jugar Individual
        </button>
        <button
          type="button"
          onClick={() => setPlayMode('multiplayer')}
          className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
            playMode === 'multiplayer' ? 'bg-sky-400 text-slate-950' : 'text-slate-300'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Sala Multijugador con QR
        </button>
      </div>

      {playMode === 'multiplayer' ? (
        <CompetitionSetupForm
          key={kind}
          mode={kind}
          defaultTitle={
            kind === 'quien_soy'
              ? '¿Quién Soy? Bíblico en Vivo'
              : 'Misterio Bíblico en Vivo'
          }
          description="Pistas progresivas en vivo con QR. Mientras menos pistas necesiten los participantes o equipos para resolver el enigma, más puntos ganan."
          countLabel="Cantidad de enigmas"
          countOptions={[5, 8, 10, 12]}
          defaultCount={8}
          timeOptions={[
            { value: 25, label: '25 segundos' },
            { value: 30, label: '30 segundos' },
            { value: 45, label: '45 segundos' },
            { value: 60, label: '60 segundos' },
          ]}
          defaultTimeSec={30}
          onCreated={onCreatedMultiplayerRoom}
          onJoinCode={onJoinCode}
        />
      ) : currentItem ? (
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AvatarBadge avatarId={currentItem.avatarId} size="lg" />
              <div>
                <p className="text-xs font-bold text-purple-300 uppercase">
                  {currentItem.title}
                </p>
                <p className="text-sm text-slate-400">
                  Valor actual si aciertas con {revealedClues}{' '}
                  {revealedClues === 1 ? 'pista' : 'pistas'}:{' '}
                  <strong className="font-mono-num text-amber-300">
                    +{potentialPoints} pts
                  </strong>
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono-num text-2xl font-extrabold text-amber-300">
                {soloScore.toLocaleString('es-CO')}
              </p>
              <p className="text-xs text-slate-400">Puntos acumulados</p>
            </div>
          </div>

          {/* Progressive Clues */}
          <div className="space-y-2">
            {currentItem.clues.slice(0, revealedClues).map((clue, idx) => (
              <div
                key={idx}
                className="bg-[#080E1E] border border-purple-500/35 rounded-xl p-3.5 flex items-start gap-3"
              >
                <span className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-300 font-mono-num font-bold text-xs flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <p className="text-sm sm:text-base text-white">{clue}</p>
              </div>
            ))}
          </div>

          {!soloFeedback && revealedClues < currentItem.clues.length && (
            <button
              type="button"
              onClick={() => {
                soundFX.playClueReveal();
                setRevealedClues((c) => c + 1);
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              Revelar siguiente pista ({revealedClues}/{currentItem.clues.length})
            </button>
          )}

          {/* Option Buttons + Direct Typed Guess */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <p className="text-xs text-slate-400 font-semibold">
              Responde tocando una opción o escribiendo la respuesta:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {currentItem.options.map((opt, idx) => {
                const isRight = soloFeedback && soloFeedback.correctOptionIndex === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={Boolean(soloFeedback)}
                    onClick={() => submitSoloGuess({ selectedIndex: idx })}
                    className={`p-3.5 rounded-xl border text-left font-semibold text-sm flex items-center justify-between cursor-pointer ${
                      soloFeedback
                        ? isRight
                          ? 'bg-emerald-600/25 border-emerald-400 text-emerald-100'
                          : 'bg-[#080E1E] border-slate-800 text-slate-500'
                        : 'bg-[#080E1E] hover:bg-slate-800 border-slate-700 text-white'
                    }`}
                  >
                    <span>{opt}</span>
                    {soloFeedback && isRight && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                  </button>
                );
              })}
            </div>

            {!soloFeedback && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={typedGuess}
                  onChange={(e) => setTypedGuess(e.target.value)}
                  placeholder="O escribe el nombre / respuesta directa..."
                  className="flex-1 bg-[#080E1E] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white"
                />
                <button
                  type="button"
                  disabled={typedGuess.trim().length < 2}
                  onClick={() => submitSoloGuess({ typedAnswer: typedGuess })}
                  className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs cursor-pointer disabled:opacity-40"
                >
                  Enviar
                </button>
              </div>
            )}
          </div>

          {soloFeedback && (
            <div className="bg-[#080E1E] border border-slate-700 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`font-display font-bold text-base inline-flex items-center gap-2 ${
                    soloFeedback.isCorrect ? 'text-emerald-300' : 'text-rose-300'
                  }`}
                >
                  {soloFeedback.isCorrect ? (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      ¡Acertaste: {soloFeedback.answer}! (+{soloFeedback.pointsEarned} pts)
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5" />
                      La respuesta era: {soloFeedback.answer}
                    </>
                  )}
                </span>
                <span className="text-xs text-amber-300 font-semibold inline-flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" />
                  {soloFeedback.reference}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300">{soloFeedback.explanation}</p>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setItemIdx((i) => i + 1);
                    setRevealedClues(1);
                    setTypedGuess('');
                    setSoloFeedback(null);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  Siguiente enigma
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Shared Multiplayer Board for PresenterView / PlayerView / ProjectorView
 * when game.config.mode is 'quien_soy' or 'misterio_biblico'.
 */
export function MysteryMultiplayerRoomPanel({
  state,
  role,
  clockOffsetMs,
  onPresenterAction,
  onSubmitMysteryGuess,
}: {
  state: GameRoomClientState;
  role: 'presenter' | 'projector' | 'participant';
  clockOffsetMs: number;
  onPresenterAction?: (action: string, extra?: Record<string, unknown>) => void;
  onSubmitMysteryGuess?: (payload: { selectedIndex?: number; typedAnswer?: string }) => void;
}) {
  const [typedGuess, setTypedGuess] = useState('');
  const ms = state.mysteryState;
  const view = ms?.currentItemView;
  const solvedCountRef = useRef(0);

  useEffect(() => {
    setTypedGuess('');
    solvedCountRef.current = 0;
  }, [ms?.currentItemIndex]);

  useEffect(() => {
    const count = ms?.itemSolvedBy.length ?? 0;
    if (count > solvedCountRef.current) {
      soundFX.playMysterySolved();
    }
    solvedCountRef.current = count;
  }, [ms?.itemSolvedBy.length]);

  if (!ms || !view) return null;

  const isRevealed = state.status === 'answer_revealed' || state.status === 'finished';
  const mySolved = state.myParticipant && state.answeredParticipantIds.includes(state.myParticipant.id);

  return (
    <div className="bg-[#111A2E] border border-purple-500/40 rounded-2xl p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AvatarBadge avatarId={view.avatarId} size="lg" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-purple-300">
              {ms.kind === 'quien_soy' ? '¿Quién Soy?' : 'Misterio Bíblico'} · Desafío{' '}
              {ms.currentItemIndex + 1} de {ms.totalItems}
            </p>
            <p className="text-xs text-slate-400">
              Pistas reveladas: {ms.revealedClueCount} de {view.totalClues} · Más puntos mientras menos pistas necesites
            </p>
          </div>
        </div>
      </div>

      <CountdownTimer
        status={state.status}
        questionEndsAt={state.questionEndsAt}
        timeLimitSec={state.config.timeLimitSec}
        remainingSecFallback={state.remainingSec}
        clockOffsetMs={clockOffsetMs}
        large={role === 'projector'}
      />

      <div className="space-y-2.5">
        {view.clues.map((clue, idx) => (
          <div
            key={idx}
            className="bg-[#080E1E] border border-purple-500/35 rounded-xl p-3.5 flex items-start gap-3"
          >
            <span className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-300 font-mono-num font-bold text-xs flex items-center justify-center shrink-0">
              {idx + 1}
            </span>
            <p className={`${role === 'projector' ? 'text-lg sm:text-xl' : 'text-sm sm:text-base'} text-white font-medium`}>
              {clue}
            </p>
          </div>
        ))}
      </div>

      {/* Participant Interactive Guessing */}
      {role === 'participant' && state.status === 'question_active' && !mySolved && onSubmitMysteryGuess && (
        <div className="space-y-3 pt-2 border-t border-slate-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {view.options.map((opt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  soundFX.playLock();
                  onSubmitMysteryGuess({ selectedIndex: idx });
                }}
                className="p-3.5 rounded-xl bg-purple-600/25 hover:bg-purple-600/40 border border-purple-400/50 text-left font-bold text-white text-sm cursor-pointer"
              >
                {opt}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={typedGuess}
              onChange={(e) => setTypedGuess(e.target.value)}
              placeholder="O escribe tu respuesta directa..."
              className="flex-1 bg-[#080E1E] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white"
            />
            <button
              type="button"
              disabled={typedGuess.trim().length < 2}
              onClick={() => {
                soundFX.playLock();
                onSubmitMysteryGuess({ typedAnswer: typedGuess });
              }}
              className="px-4 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer disabled:opacity-40"
            >
              Enviar
            </button>
          </div>
        </div>
      )}

      {/* Presenter Controls */}
      {role === 'presenter' && onPresenterAction && (
        <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-slate-800">
          {ms.revealedClueCount < view.totalClues && !isRevealed && (
            <button
              type="button"
              onClick={() => onPresenterAction('mystery_next_clue')}
              className="px-4 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <HelpCircle className="w-4 h-4" />
              Revelar Pista #{ms.revealedClueCount + 1}
            </button>
          )}
          {!isRevealed && (
            <button
              type="button"
              onClick={() => onPresenterAction('mystery_reveal')}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
            >
              Mostrar Respuesta
            </button>
          )}
          <button
            type="button"
            onClick={() => onPresenterAction('mystery_next_item')}
            className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer ml-auto"
          >
            {ms.currentItemIndex + 1 >= ms.totalItems
              ? 'Finalizar Desafío'
              : 'Siguiente Enigma'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Solved leaderboard inside item */}
      {ms.itemSolvedBy.length > 0 && (
        <div className="bg-[#080E1E] border border-slate-800 rounded-xl p-3 space-y-1.5">
          <p className="text-xs font-bold text-emerald-300">
            Aciertos en este enigma:
          </p>
          <div className="flex flex-wrap gap-2">
            {ms.itemSolvedBy.map((s) => (
              <span
                key={s.participantId}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-xs text-emerald-200 font-semibold"
              >
                {s.name} · Pista #{s.clueNumber} (+{s.points} pts)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Revealed Answer Card */}
      {(isRevealed || role === 'presenter') && view.answer && (
        <div className="bg-[#080E1E] border border-amber-400/40 rounded-xl p-4 space-y-1">
          <p className="text-sm font-extrabold text-amber-300 inline-flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" />
            {isRevealed ? 'Respuesta oficial:' : 'Guía privada del presentador:'} {view.answer}
          </p>
          {view.reference && (
            <p className="text-xs text-sky-300">Cita: {view.reference}</p>
          )}
          {view.explanation && (
            <p className="text-xs text-slate-300">{view.explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}
