import { useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Disc,
  RotateCw,
  Shield,
  Sparkles,
  User,
  Users,
  XCircle,
} from 'lucide-react';
import { ROULETTE_CATEGORIES } from '../shared/biblicalModulesData';
import { DIFFICULTY_LABELS, Difficulty } from '../shared/types';
import { getOrCreateProfileKey } from '../utils/profileKey';
import { soundFX } from '../utils/sound';
import { CompetitionSetupForm } from './CompetitionSetupForm';

interface RuletaBiblicaViewProps {
  onBack: () => void;
  onCreatedMultiplayerRoom: (code: string, presenterToken: string) => void;
  onJoinCode?: (code: string) => void;
}

export function RouletteWheelGraphic({
  angleDeg,
  spinning,
  size = 340,
}: {
  angleDeg: number;
  spinning: boolean;
  size?: number;
}) {
  const count = ROULETTE_CATEGORIES.length;
  const sliceDeg = 360 / count;
  const cx = 200;
  const cy = 200;
  const r = 186;

  const polarToCartesian = (angleInDegrees: number, radius: number) => {
    const rad = ((angleInDegrees - 90) * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  };

  return (
    <div
      className="relative mx-auto flex items-center justify-center select-none"
      style={{ width: size, height: size, maxWidth: '100%' }}
    >
      {/* Top Pointer */}
      <div
        className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 w-0 h-0 border-l-[14px] border-r-[14px] border-t-[24px] border-l-transparent border-r-transparent border-t-amber-300 drop-shadow-[0_3px_6px_rgba(0,0,0,0.7)]"
        aria-hidden="true"
      />

      <svg
        viewBox="0 0 400 400"
        className="w-full h-full drop-shadow-2xl"
        style={{
          transform: `rotate(${angleDeg}deg)`,
          transition: spinning
            ? 'transform 3.4s cubic-bezier(0.14, 0.86, 0.22, 1)'
            : 'transform 0.6s ease-out',
        }}
      >
        <circle cx={cx} cy={cy} r={195} fill="#0F172A" stroke="#FBBF24" strokeWidth="6" />
        {ROULETTE_CATEGORIES.map((slot, idx) => {
          const startAngle = idx * sliceDeg;
          const endAngle = startAngle + sliceDeg;
          const start = polarToCartesian(endAngle, r);
          const end = polarToCartesian(startAngle, r);
          const largeArc = sliceDeg > 180 ? 1 : 0;
          const d = [
            'M',
            cx,
            cy,
            'L',
            end.x,
            end.y,
            'A',
            r,
            r,
            0,
            largeArc,
            1,
            start.x,
            start.y,
            'Z',
          ].join(' ');
          const midAngle = startAngle + sliceDeg / 2;
          const labelPos = polarToCartesian(midAngle, r * 0.66);

          return (
            <g key={slot.id}>
              <path d={d} fill={slot.color} stroke="#080E1E" strokeWidth="2.5" />
              <text
                x={labelPos.x}
                y={labelPos.y}
                fill="#FFFFFF"
                fontSize="10.5"
                fontWeight="800"
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${midAngle - 90}, ${labelPos.x}, ${labelPos.y})`}
                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.75)' }}
              >
                {slot.label.length > 16 ? `${slot.label.slice(0, 15)}…` : slot.label}
              </text>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r="32" fill="#080E1E" stroke="#FBBF24" strokeWidth="4" />
        <text
          x={cx}
          y={cy}
          fill="#FBBF24"
          fontSize="11"
          fontWeight="900"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          BIBLIA
        </text>
      </svg>
    </div>
  );
}

interface SoloSpinQuestion {
  spinId: string;
  slotIndex: number;
  slot: { id: string; label: string; color: string };
  question: {
    id: string;
    category: string;
    difficulty: Difficulty;
    prompt: string;
    options: string[];
  };
}

interface SpinFeedback {
  isCorrect: boolean;
  correctIndex: number;
  pointsEarned: number;
  reference: string;
  explanation: string;
}

export function RuletaBiblicaView({
  onBack,
  onCreatedMultiplayerRoom,
  onJoinCode,
}: RuletaBiblicaViewProps) {
  const [playMode, setPlayMode] = useState<'solo' | 'equipos' | 'multiplayer'>('solo');

  // Solo & Local Teams state
  const [angleDeg, setAngleDeg] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [usedQuestionIds, setUsedQuestionIds] = useState<string[]>([]);
  const [activeTurn, setActiveTurn] = useState<SoloSpinQuestion | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<SpinFeedback | null>(null);
  const [soloScore, setSoloScore] = useState(0);
  const [soloCorrect, setSoloCorrect] = useState(0);
  const [soloError, setSoloError] = useState<string | null>(null);

  // Local teams score tracking
  const [localTeams, setLocalTeams] = useState([
    { name: 'Equipo Azul', color: '#0EA5E9', score: 0 },
    { name: 'Equipo Rojo', color: '#EF4444', score: 0 },
  ]);
  const [activeTeamIndex, setActiveTeamIndex] = useState(0);

  const handleSpin = async () => {
    if (spinning) return;
    setSoloError(null);
    setSelectedIdx(null);
    setFeedback(null);
    setActiveTurn(null);

    try {
      const res = await fetch('/api/expansion/roulette/solo-spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileKey: getOrCreateProfileKey(),
          usedQuestionIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSoloError(data.error || 'No se pudo girar la ruleta.');
        return;
      }

      const sliceDeg = 360 / ROULETTE_CATEGORIES.length;
      const offset = (360 - (data.slotIndex * sliceDeg + sliceDeg / 2)) % 360;
      const nextAngle = Math.floor(angleDeg / 360) * 360 + 1440 + offset;

      setSpinning(true);
      setAngleDeg(nextAngle);
      soundFX.playWheelSpin(3400);

      window.setTimeout(() => {
        setSpinning(false);
        setActiveTurn(data);
        setUsedQuestionIds((prev) => [...prev, data.question.id]);
        soundFX.playWheelStop();
        soundFX.playCategorySelect();
      }, 3450);
    } catch {
      setSoloError('Error de conexión al girar la ruleta.');
      setSpinning(false);
    }
  };

  const handleAnswer = async (idx: number) => {
    if (!activeTurn || selectedIdx !== null || feedback) return;
    setSelectedIdx(idx);
    soundFX.playLock();
    try {
      const res = await fetch('/api/expansion/roulette/solo-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spinId: activeTurn.spinId,
          selectedIndex: idx,
        }),
      });
      const data = (await res.json()) as SpinFeedback;
      setFeedback(data);
      if (data.isCorrect) {
        soundFX.playCorrect();
        if (playMode === 'equipos') {
          setLocalTeams((prev) =>
            prev.map((tm, i) =>
              i === activeTeamIndex ? { ...tm, score: tm.score + data.pointsEarned } : tm
            )
          );
        } else {
          setSoloScore((s) => s + data.pointsEarned);
          setSoloCorrect((c) => c + 1);
        }
      } else {
        soundFX.playWrong();
      }
      if (playMode === 'equipos') {
        setActiveTeamIndex((i) => (i + 1) % localTeams.length);
      }
    } catch {
      setSoloError('No se pudo verificar la respuesta.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
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
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
            <Disc className="w-4 h-4" />
            Nuevos Juegos y Competencias
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white">
            Ruleta Bíblica
          </h1>
          <p className="text-slate-400 text-sm sm:text-base max-w-2xl">
            Gira la ruleta de 14 categorías bíblicas. Nunca repite una pregunta dentro de la misma sesión.
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="flex flex-wrap gap-2 bg-[#111A2E] border border-slate-800 p-1.5 rounded-2xl">
          <button
            type="button"
            onClick={() => setPlayMode('solo')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
              playMode === 'solo'
                ? 'bg-amber-400 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Individual
          </button>
          <button
            type="button"
            onClick={() => setPlayMode('equipos')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
              playMode === 'equipos'
                ? 'bg-emerald-400 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Equipos
          </button>
          <button
            type="button"
            onClick={() => setPlayMode('multiplayer')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
              playMode === 'multiplayer'
                ? 'bg-sky-400 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Multijugador con Presentador
          </button>
        </div>
      </div>

      {/* MULTIPLAYER SETUP */}
      {playMode === 'multiplayer' ? (
        <CompetitionSetupForm
          mode="ruleta_biblica"
          defaultTitle="Ruleta Bíblica en Vivo"
          description="Generará una sala con código único y código QR. Tú giras la ruleta desde el Panel del Presentador y todos los participantes (individuales o por equipos) responden desde sus celulares en tiempo real."
          countLabel="Giros / Preguntas meta"
          countOptions={[10, 14, 20, 25]}
          defaultCount={14}
          timeOptions={[
            { value: 15, label: '15 segundos' },
            { value: 20, label: '20 segundos' },
            { value: 30, label: '30 segundos' },
          ]}
          defaultTimeSec={20}
          onCreated={onCreatedMultiplayerRoom}
          onJoinCode={onJoinCode}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Wheel & Spin Control */}
          <div className="lg:col-span-5 bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-5 text-center">
            <RouletteWheelGraphic angleDeg={angleDeg} spinning={spinning} size={320} />

            {playMode === 'equipos' && (
              <div className="grid grid-cols-2 gap-2.5 text-left">
                {localTeams.map((tm, idx) => (
                  <div
                    key={tm.name}
                    className={`p-3 rounded-xl border ${
                      idx === activeTeamIndex
                        ? 'bg-[#080E1E] border-amber-400 ring-1 ring-amber-400/50'
                        : 'bg-[#080E1E]/60 border-slate-800'
                    }`}
                  >
                    <p className="text-xs font-bold truncate" style={{ color: tm.color }}>
                      {tm.name} {idx === activeTeamIndex ? '· Turno' : ''}
                    </p>
                    <p className="font-mono-num text-xl font-extrabold text-white">
                      {tm.score.toLocaleString('es-CO')} pts
                    </p>
                  </div>
                ))}
              </div>
            )}

            {playMode === 'solo' && (
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-[#080E1E] border border-slate-800 rounded-xl p-3">
                  <p className="font-mono-num text-2xl font-extrabold text-amber-300">
                    {soloScore.toLocaleString('es-CO')}
                  </p>
                  <p className="text-xs text-slate-400">Puntos acumulados</p>
                </div>
                <div className="bg-[#080E1E] border border-slate-800 rounded-xl p-3">
                  <p className="font-mono-num text-2xl font-extrabold text-emerald-300">
                    {soloCorrect}/{usedQuestionIds.length}
                  </p>
                  <p className="text-xs text-slate-400">Aciertos / Giros</p>
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={spinning || (Boolean(activeTurn) && !feedback)}
              onClick={handleSpin}
              className="w-full py-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-lg inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-45"
            >
              <RotateCw className={`w-5 h-5 ${spinning ? 'animate-spin' : ''}`} />
              {spinning ? 'GIRANDO RULETA...' : 'GIRAR RULETA'}
            </button>

            {usedQuestionIds.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setUsedQuestionIds([]);
                  setActiveTurn(null);
                  setFeedback(null);
                  setSelectedIdx(null);
                }}
                className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
              >
                Reiniciar historial de preguntas usadas ({usedQuestionIds.length})
              </button>
            )}
          </div>

          {/* Right: Question Panel */}
          <div className="lg:col-span-7 bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-5 min-h-[380px] flex flex-col justify-center">
            {soloError && (
              <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/50 text-rose-200 text-sm">
                {soloError}
              </div>
            )}

            {!activeTurn ? (
              <div className="text-center space-y-3 py-10">
                <Sparkles className="w-12 h-12 text-amber-400 mx-auto" />
                <h2 className="font-display text-2xl font-bold text-white">
                  {spinning
                    ? 'Seleccionando categoría aleatoria...'
                    : 'Pulsa «GIRAR RULETA» para comenzar'}
                </h2>
                <p className="text-sm text-slate-400 max-w-md mx-auto">
                  Incluye las 14 categorías: Antiguo y Nuevo Testamento, Personajes, Mujeres, Milagros, Parábolas, Profetas, Reyes, Apóstoles, Libros, Geografía, Difíciles, Versículos e Historia.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className="px-3 py-1 rounded-lg text-xs font-extrabold text-white"
                    style={{ backgroundColor: activeTurn.slot.color }}
                  >
                    Categoría: {activeTurn.slot.label}
                  </span>
                  <span className="text-xs text-slate-400">
                    {activeTurn.question.category} ·{' '}
                    {DIFFICULTY_LABELS[activeTurn.question.difficulty]}
                  </span>
                </div>

                <h2 className="font-display text-xl sm:text-2xl font-bold text-white leading-snug">
                  {activeTurn.question.prompt}
                </h2>

                <div className="grid grid-cols-1 gap-2.5">
                  {activeTurn.question.options.map((opt, idx) => {
                    const isPicked = selectedIdx === idx;
                    const isCorrectOpt = feedback && feedback.correctIndex === idx;
                    let cls =
                      'bg-[#080E1E] hover:bg-slate-800/80 border-slate-700 text-white cursor-pointer';
                    if (feedback) {
                      if (isCorrectOpt) {
                        cls =
                          'bg-emerald-600/25 border-emerald-400 text-emerald-100';
                      } else if (isPicked && !isCorrectOpt) {
                        cls = 'bg-rose-600/25 border-rose-400 text-rose-100';
                      } else {
                        cls = 'bg-[#080E1E] border-slate-800 text-slate-500';
                      }
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={selectedIdx !== null}
                        onClick={() => handleAnswer(idx)}
                        className={`p-4 rounded-xl border text-left text-sm sm:text-base font-medium flex items-center justify-between gap-3 transition-colors ${cls}`}
                      >
                        <span>{opt}</span>
                        {feedback && isCorrectOpt && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        )}
                        {feedback && isPicked && !isCorrectOpt && (
                          <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {feedback && (
                  <div className="bg-[#080E1E] border border-slate-700 rounded-xl p-4 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`font-display font-bold text-sm ${
                          feedback.isCorrect ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {feedback.isCorrect
                          ? `¡Correcto! (+${feedback.pointsEarned} pts)`
                          : 'Respuesta incorrecta'}
                      </span>
                      {feedback.reference && (
                        <span className="text-xs font-semibold text-amber-300 inline-flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5" />
                          {feedback.reference}
                        </span>
                      )}
                    </div>
                    {feedback.explanation && (
                      <p className="text-xs sm:text-sm text-slate-300">
                        {feedback.explanation}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
