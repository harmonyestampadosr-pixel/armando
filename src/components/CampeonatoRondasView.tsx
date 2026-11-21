import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Crown,
  Play,
  Scale,
  Swords,
} from 'lucide-react';
import { GameRoomClientState } from '../shared/types';
import { AvatarBadge } from './AvatarBadge';

export function CampeonatoRondasView({
  onBack,
  onCreatedRoom,
}: {
  onBack: () => void;
  onCreatedRoom: (code: string, presenterToken: string) => void;
}) {
  const [title, setTitle] = useState('Gran Campeonato Bíblico por Rondas');
  const [questionsPerRound, setQuestionsPerRound] = useState(5);
  const [advanceRound2Count, setAdvanceRound2Count] = useState(8);
  const [advanceSemifinalCount, setAdvanceSemifinalCount] = useState(4);
  const [advanceFinalCount, setAdvanceFinalCount] = useState(2);
  const [timeLimitSec, setTimeLimitSec] = useState(20);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || 'Gran Campeonato Bíblico por Rondas',
          mode: 'campeonato_rondas',
          difficulty: 'combinado',
          questionCount: questionsPerRound * 4,
          questionsPerRound,
          advanceRound2Count,
          advanceSemifinalCount,
          advanceFinalCount,
          timeLimitSec,
          maxParticipants: 200,
          basePoints: 1000,
          speedBonusMax: 500,
          specialEveryN: 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al crear el campeonato.');
        setCreating(false);
        return;
      }
      onCreatedRoom(data.code, data.presenterToken);
    } catch {
      setError('Error de conexión.');
      setCreating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al inicio
      </button>

      <div className="space-y-1.5">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
          <Crown className="w-4 h-4" />
          4 Fases Oficiales · Doble Puntaje en la Gran Final
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white">
          Campeonato Bíblico y Grandes Finales
        </h1>
        <p className="text-slate-400 text-sm">
          Organiza eliminatorias oficiales: Ronda 1 (Clasificación) → Ronda 2 (Avanzados) → Ronda 3 (Semifinales) → Ronda 4 (Gran Final). Conserva estadísticas de todas las fases.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-5"
      >
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">
            Título del Campeonato
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              Preguntas por cada ronda
            </label>
            <select
              value={questionsPerRound}
              onChange={(e) => setQuestionsPerRound(Number(e.target.value))}
              className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm"
            >
              <option value={3}>3 preguntas por ronda</option>
              <option value={5}>5 preguntas por ronda</option>
              <option value={7}>7 preguntas por ronda</option>
              <option value={10}>10 preguntas por ronda</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              Tiempo por pregunta
            </label>
            <select
              value={timeLimitSec}
              onChange={(e) => setTimeLimitSec(Number(e.target.value))}
              className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm"
            >
              <option value={15}>15 segundos</option>
              <option value={20}>20 segundos</option>
              <option value={30}>30 segundos</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              Clasifican a Ronda 2
            </label>
            <select
              value={advanceRound2Count}
              onChange={(e) => setAdvanceRound2Count(Number(e.target.value))}
              className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2.5 text-white font-mono-num text-sm"
            >
              <option value={4}>Top 4</option>
              <option value={8}>Top 8</option>
              <option value={12}>Top 12</option>
              <option value={16}>Top 16</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              Clasifican a Semifinales
            </label>
            <select
              value={advanceSemifinalCount}
              onChange={(e) => setAdvanceSemifinalCount(Number(e.target.value))}
              className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2.5 text-white font-mono-num text-sm"
            >
              <option value={2}>Top 2</option>
              <option value={4}>Top 4</option>
              <option value={6}>Top 6</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              Finalistas (Gran Final)
            </label>
            <select
              value={advanceFinalCount}
              onChange={(e) => setAdvanceFinalCount(Number(e.target.value))}
              className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2.5 text-white font-mono-num text-sm"
            >
              <option value={2}>Top 2 (Duelo Final)</option>
              <option value={3}>Top 3 (Podio Vivo)</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/50 text-rose-200 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={creating}
          className="w-full py-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-base inline-flex items-center justify-center gap-2 cursor-pointer"
        >
          <Play className="w-5 h-5 fill-current" />
          {creating ? 'Creando campeonato...' : 'Crear Sala de Campeonato con QR'}
        </button>
      </form>
    </div>
  );
}

/**
 * Embedded Championship Phase Tracker & Controls inside PresenterView / PlayerView / ProjectorView
 */
export function ChampionshipProgressPanel({
  state,
  role,
  onPresenterAction,
}: {
  state: GameRoomClientState;
  role: 'presenter' | 'projector' | 'participant';
  onPresenterAction?: (action: string, extra?: Record<string, unknown>) => void;
}) {
  const cs = state.championshipState;
  if (!cs) return null;

  const stages = [
    { num: 1, label: 'Clasificación' },
    { num: 2, label: 'Avanzados' },
    { num: 3, label: 'Semifinales' },
    { num: 4, label: 'Gran Final' },
  ];

  const isAtRoundBoundary =
    state.status !== 'waiting' &&
    state.status !== 'finished' &&
    state.currentQuestionIndex + 1 >= state.totalQuestions;

  const latestMatchups =
    cs.roundHistory.length > 0
      ? cs.roundHistory[cs.roundHistory.length - 1].matchups
      : undefined;

  return (
    <div className="bg-[#111A2E] border border-amber-400/40 rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-400" />
          <span className="font-display font-bold text-white text-sm sm:text-base">
            {cs.roundName}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {stages.map((st) => {
            const active = cs.currentRound === st.num;
            const done = cs.currentRound > st.num || state.status === 'finished';
            return (
              <span
                key={st.num}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                  active
                    ? 'bg-amber-400 text-slate-950'
                    : done
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400'
                }`}
              >
                {st.num}. {st.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Matchup Draw for Semifinales / Gran Final */}
      {latestMatchups && latestMatchups.length > 0 && (
        <div className="bg-[#080E1E] border border-slate-800 rounded-xl p-3 space-y-2">
          <p className="text-xs font-bold text-sky-300 inline-flex items-center gap-1.5">
            <Swords className="w-3.5 h-3.5" />
            Cruces oficiales de esta fase:
          </p>
          <div className="flex flex-wrap gap-2">
            {latestMatchups.map((m) => (
              <span
                key={m.id}
                className="px-3 py-1.5 rounded-lg bg-[#111A2E] border border-slate-700 text-xs font-semibold text-white"
              >
                {m.playerA} <span className="text-amber-400">vs</span> {m.playerB}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Presenter Round Advance & Tiebreaker Controls */}
      {role === 'presenter' && onPresenterAction && state.status !== 'waiting' && state.status !== 'finished' && (
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() => onPresenterAction('championship_tiebreaker')}
            className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Scale className="w-3.5 h-3.5" />
            Pregunta de Desempate (x2)
          </button>

          {isAtRoundBoundary && (
            <button
              type="button"
              onClick={() => onPresenterAction('championship_advance_round')}
              className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer ml-auto"
            >
              {cs.currentRound >= 4
                ? 'Proclamar Campeón Final'
                : `Clasificar y Avanzar a Ronda ${cs.currentRound + 1}`}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Preserved Round History (keeps eliminated stats intact) */}
      {cs.roundHistory.length > 0 && state.status === 'finished' && (
        <div className="space-y-3 pt-2 border-t border-slate-800">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Registro Histórico de Todas las Fases (Clasificados y Eliminados)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {cs.roundHistory.map((rec) => (
              <div
                key={rec.roundNumber}
                className="bg-[#080E1E] border border-slate-800 rounded-xl p-3 space-y-2"
              >
                <p className="text-xs font-bold text-amber-300">{rec.roundName}</p>
                <div className="space-y-1">
                  {rec.standings.map((st, idx) => (
                    <div
                      key={st.participantId}
                      className="flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono-num text-slate-500">{idx + 1}.</span>
                        <AvatarBadge avatarId={st.avatarId} size="sm" />
                        <span className="text-slate-200 truncate">{st.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono-num text-amber-300 font-bold">
                          {st.score}
                        </span>
                        <span
                          className={`text-[10px] font-bold ${
                            st.advanced ? 'text-emerald-400' : 'text-slate-500'
                          }`}
                        >
                          {st.advanced ? 'Avanzó' : 'Eliminado'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
