import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Clock,
  TrendingUp,
  Trophy,
  User,
  Users,
} from 'lucide-react';
import {
  GlobalStatsOverview,
  PlayerTrajectoryProfile,
} from '../shared/expansionTypes';
import { getOrCreateProfileKey } from '../utils/profileKey';
import { AvatarBadge } from './AvatarBadge';

export function EstadisticasView({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<'presentador' | 'personales'>('presentador');
  const [overview, setOverview] = useState<GlobalStatsOverview | null>(null);
  const [personal, setPersonal] = useState<PlayerTrajectoryProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const profileKey = getOrCreateProfileKey();

  useEffect(() => {
    fetch(`/api/expansion/stats?profileKey=${encodeURIComponent(profileKey)}`)
      .then((r) => r.json())
      .then((data) => {
        setOverview(data.overview || null);
        setPersonal(data.personal || null);
      })
      .finally(() => setLoading(false));
  }, [profileKey]);

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
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-300">
            <BarChart3 className="w-4 h-4" />
            Analítica en Tiempo Real del Sistema
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white">
            Estadísticas Avanzadas
          </h1>
          <p className="text-slate-400 text-sm">
            Métricas globales del presentador y rendimiento personal calculadas automáticamente con los resultados reales.
          </p>
        </div>

        <div className="flex gap-2 bg-[#111A2E] border border-slate-800 p-1.5 rounded-2xl">
          <button
            type="button"
            onClick={() => setTab('presentador')}
            className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
              tab === 'presentador' ? 'bg-sky-400 text-slate-950' : 'text-slate-300'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Para Presentadores y Organizadores
          </button>
          <button
            type="button"
            onClick={() => setTab('personales')}
            className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
              tab === 'personales' ? 'bg-amber-400 text-slate-950' : 'text-slate-300'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Mis Estadísticas Personales
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-10 text-center text-slate-400">
          Calculando estadísticas...
        </div>
      ) : tab === 'presentador' && overview ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5">
              <p className="text-xs text-slate-400">Partidas Finalizadas</p>
              <p className="font-mono-num text-3xl font-extrabold text-white mt-1">
                {overview.totalGames}
              </p>
            </div>
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5">
              <p className="text-xs text-slate-400">Total Participantes</p>
              <p className="font-mono-num text-3xl font-extrabold text-sky-300 mt-1">
                {overview.totalParticipants}
              </p>
            </div>
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5">
              <p className="text-xs text-slate-400">Preguntas Realizadas</p>
              <p className="font-mono-num text-3xl font-extrabold text-amber-300 mt-1">
                {overview.totalQuestionsAsked}
              </p>
            </div>
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5">
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Tiempo Resp. Promedio
              </p>
              <p className="font-mono-num text-3xl font-extrabold text-emerald-300 mt-1">
                {(overview.avgResponseMs / 1000).toFixed(1)}s
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Hardest Questions */}
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-3">
              <h2 className="font-display font-bold text-lg text-white">
                Preguntas Más Difíciles (% de error)
              </h2>
              {overview.hardestQuestions.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Aún no hay suficientes respuestas registradas.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {overview.hardestQuestions.slice(0, 6).map((q) => (
                    <div key={q.questionId} className="bg-[#080E1E] border border-slate-800 rounded-xl p-3 space-y-1.5">
                      <div className="flex justify-between gap-2 text-xs">
                        <span className="text-slate-200 font-medium line-clamp-2">{q.prompt}</span>
                        <span className="font-mono-num font-bold text-rose-400 shrink-0">
                          {q.errorPercent}% error
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-rose-500 rounded-full"
                          style={{ width: `${q.errorPercent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Category Performance */}
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-3">
              <h2 className="font-display font-bold text-lg text-white">
                Rendimiento por Categorías Bíblicas
              </h2>
              {overview.categoryPerformance.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Completa partidas para analizar el acierto por categoría.
                </p>
              ) : (
                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {overview.categoryPerformance.map((cat) => (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-200 font-semibold">{cat.category}</span>
                        <span className="font-mono-num text-emerald-300 font-bold">
                          {cat.accuracyPercent}% ({cat.correct}/{cat.answered})
                        </span>
                      </div>
                      <div className="h-2 bg-[#080E1E] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-400 rounded-full"
                          style={{ width: `${cat.accuracyPercent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* PERSONAL STATS TAB */
        <div className="space-y-6">
          {!personal || (personal.totalGamesPlayed === 0 && personal.totalPoints === 0) ? (
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-10 text-center text-slate-400">
              Participa en partidas, retos o ruleta desde este dispositivo para generar tus estadísticas personales reales.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4">
                  <p className="text-xs text-slate-400">Concursos jugados</p>
                  <p className="font-mono-num text-2xl font-extrabold text-white">
                    {personal.totalGamesPlayed}
                  </p>
                </div>
                <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4">
                  <p className="text-xs text-slate-400">Victorias</p>
                  <p className="font-mono-num text-2xl font-extrabold text-amber-300">
                    {personal.totalWins}
                  </p>
                </div>
                <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4">
                  <p className="text-xs text-slate-400">Precisión</p>
                  <p className="font-mono-num text-2xl font-extrabold text-emerald-300">
                    {personal.totalCorrect + personal.totalIncorrect > 0
                      ? Math.round(
                          (personal.totalCorrect /
                            (personal.totalCorrect + personal.totalIncorrect)) *
                            100
                        )
                      : 0}
                    %
                  </p>
                </div>
                <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4">
                  <p className="text-xs text-slate-400">Mejor puntaje</p>
                  <p className="font-mono-num text-2xl font-extrabold text-sky-300">
                    {personal.bestScore.toLocaleString('es-CO')}
                  </p>
                </div>
              </div>

              {/* Evolution Bar Graph */}
              {personal.recentMatches.length > 0 && (
                <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-4">
                  <h2 className="font-display font-bold text-lg text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    Evolución de Puntajes Recientes
                  </h2>
                  <div className="flex items-end gap-2 h-40 pt-4 overflow-x-auto">
                    {[...personal.recentMatches]
                      .reverse()
                      .slice(-12)
                      .map((m, idx) => {
                        const maxVal = Math.max(
                          1,
                          ...personal.recentMatches.map((x) => x.score)
                        );
                        const hPct = Math.max(10, Math.round((m.score / maxVal) * 100));
                        return (
                          <div
                            key={idx}
                            className="flex-1 min-w-[44px] flex flex-col items-center gap-1"
                            title={`${m.gameTitle}: ${m.score} pts`}
                          >
                            <span className="text-[10px] font-mono-num text-amber-300">
                              {m.score}
                            </span>
                            <div
                              className={`w-full rounded-t-lg ${
                                m.won ? 'bg-amber-400' : 'bg-sky-500/80'
                              }`}
                              style={{ height: `${hPct}%` }}
                            />
                            <span className="text-[10px] text-slate-400 truncate max-w-[54px]">
                              {m.mode}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Medallas */}
              <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-3">
                <h2 className="font-display font-bold text-lg text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  Medallas Conseguidas ({personal.achievements.filter((a) => a.unlocked).length})
                </h2>
                <div className="flex flex-wrap gap-2">
                  {personal.achievements
                    .filter((a) => a.unlocked)
                    .map((a) => (
                      <span
                        key={a.id}
                        className="px-3 py-1.5 rounded-xl bg-amber-400/15 border border-amber-400/50 text-xs font-bold text-amber-200"
                      >
                        {a.name}
                      </span>
                    ))}
                  {personal.achievements.filter((a) => a.unlocked).length === 0 && (
                    <span className="text-xs text-slate-400">
                      Sigue jugando para desbloquear tus primeras medallas.
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {overview && overview.topParticipants.length > 0 && tab === 'presentador' && (
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-3">
          <h2 className="font-display font-bold text-lg text-white">
            Desempeño Destacado de Participantes
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {overview.topParticipants.slice(0, 6).map((p) => (
              <div
                key={p.name}
                className="bg-[#080E1E] border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <AvatarBadge avatarId={p.avatarId} size="sm" />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-white truncate">{p.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {p.gamesPlayed} partidas · {p.accuracyPercent}% precisión
                    </p>
                  </div>
                </div>
                <span className="font-mono-num font-bold text-amber-300 text-sm shrink-0">
                  {p.totalScore.toLocaleString('es-CO')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
