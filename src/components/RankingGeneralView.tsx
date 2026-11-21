import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Crown,
  Medal,
  Shield,
  Trophy,
} from 'lucide-react';
import { GeneralRankingResponse } from '../shared/expansionTypes';
import { AvatarBadge } from './AvatarBadge';

export function RankingGeneralView({ onBack }: { onBack: () => void }) {
  const [period, setPeriod] = useState<'all' | 'week' | 'month' | 'season' | 'year'>('all');
  const [compType, setCompType] = useState<string>('all');
  const [tab, setTab] = useState<'participants' | 'teams' | 'churches' | 'records'>('participants');
  const [ranking, setRanking] = useState<GeneralRankingResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(
      `/api/expansion/ranking?period=${encodeURIComponent(period)}&type=${encodeURIComponent(compType)}`
    )
      .then((r) => r.json())
      .then((data) => setRanking(data))
      .finally(() => setLoading(false));
  }, [period, compType]);

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

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
            <Trophy className="w-4 h-4" />
            Cuadro de Honor Histórico y por Temporada
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white">
            Ranking General
          </h1>
          <p className="text-slate-400 text-sm">
            Puntajes separados con claridad entre participantes individuales, equipos y delegaciones o iglesias.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2.5">
          <select
            aria-label="Filtrar por período"
            value={period}
            onChange={(e) => setPeriod(e.target.value as GeneralRankingResponse['period'])}
            className="bg-[#111A2E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
          >
            <option value="all">Todo el tiempo</option>
            <option value="week">Última semana</option>
            <option value="month">Último mes</option>
            <option value="season">Temporada (90 días)</option>
            <option value="year">Último año</option>
          </select>

          <select
            aria-label="Filtrar por tipo de competencia"
            value={compType}
            onChange={(e) => setCompType(e.target.value)}
            className="bg-[#111A2E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
          >
            <option value="all">Todas las competencias</option>
            <option value="clasico">Modo Clásico</option>
            <option value="batalla_1v1">Batalla 1 contra 1</option>
            <option value="competencia_equipos">Competencia por Equipos</option>
            <option value="ruleta_biblica">Ruleta Bíblica</option>
            <option value="quien_soy">¿Quién Soy?</option>
            <option value="misterio_biblico">Misterio Bíblico</option>
            <option value="crucigrama_biblico">Crucigramas Bíblicos</option>
            <option value="palabras_desordenadas">Palabras Desordenadas</option>
            <option value="completa_versiculo">Completa el Versículo</option>
            <option value="rompecabezas_biblico">Rompecabezas Bíblicos</option>
            <option value="aprende_biblia">Aprende con la Biblia</option>
            <option value="campeonato_rondas">Campeonato por Rondas</option>
            <option value="torneo">Modo Torneo</option>
          </select>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { id: 'participants' as const, label: 'Participantes', icon: Crown },
          { id: 'teams' as const, label: 'Equipos', icon: Shield },
          { id: 'churches' as const, label: 'Iglesias y Torneos', icon: Building2 },
          { id: 'records' as const, label: 'Victorias y Aciertos', icon: Medal },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`p-3.5 rounded-2xl border flex items-center gap-2 text-xs sm:text-sm font-bold cursor-pointer ${
                tab === item.id
                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                  : 'bg-[#111A2E] border-slate-800 text-slate-300 hover:border-slate-600'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {loading || !ranking ? (
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-10 text-center text-slate-400">
          Cargando ranking general...
        </div>
      ) : (
        <>
          {tab === 'participants' && (
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-3">
              <h2 className="font-display text-xl font-bold text-white">
                Mejores Participantes (Puntos Individuales)
              </h2>
              {ranking.bestParticipants.length === 0 ? (
                <p className="text-sm text-slate-400 py-6 text-center">
                  No hay resultados individuales registrados para este filtro.
                </p>
              ) : (
                <div className="space-y-2">
                  {ranking.bestParticipants.map((p) => (
                    <div
                      key={`${p.rank}-${p.name}`}
                      className="flex items-center justify-between gap-3 bg-[#080E1E] border border-slate-800 rounded-xl px-4 py-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono-num font-bold text-sm text-amber-300 w-7">
                          #{p.rank}
                        </span>
                        <AvatarBadge avatarId={p.avatarId} size="sm" />
                        <div className="min-w-0">
                          <p className="font-bold text-white text-sm truncate">{p.name}</p>
                          <p className="text-xs text-slate-400">
                            {p.wins} victorias · {p.correctCount} aciertos · {p.gamesPlayed} partidas
                          </p>
                        </div>
                      </div>
                      <span className="font-mono-num text-lg font-extrabold text-amber-300 shrink-0">
                        {p.totalScore.toLocaleString('es-CO')} pts
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'teams' && (
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-3">
              <h2 className="font-display text-xl font-bold text-white">
                Mejores Equipos (Puntos Grupales)
              </h2>
              {ranking.bestTeams.length === 0 ? (
                <p className="text-sm text-slate-400 py-6 text-center">
                  No hay resultados de competencias por equipos en este filtro.
                </p>
              ) : (
                <div className="space-y-2">
                  {ranking.bestTeams.map((t) => (
                    <div
                      key={t.teamName}
                      className="flex items-center justify-between gap-3 bg-[#080E1E] border border-slate-800 rounded-xl px-4 py-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono-num font-bold text-sm text-amber-300 w-7">
                          #{t.rank}
                        </span>
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: t.color }}
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-white text-sm truncate">{t.teamName}</p>
                          <p className="text-xs text-slate-400">
                            {t.wins} victorias · {t.gamesPlayed} partidas
                          </p>
                        </div>
                      </div>
                      <span className="font-mono-num text-lg font-extrabold text-emerald-300 shrink-0">
                        {t.totalScore.toLocaleString('es-CO')} pts
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'churches' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-3">
                <h2 className="font-display text-xl font-bold text-white">
                  Iglesias, Distritos y Congregaciones
                </h2>
                {ranking.bestChurches.length === 0 ? (
                  <p className="text-sm text-slate-400 py-4">
                    Aún no hay torneos registrados con delegaciones.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {ranking.bestChurches.map((c) => (
                      <div
                        key={c.orgName}
                        className="flex items-center justify-between gap-3 bg-[#080E1E] border border-slate-800 rounded-xl px-4 py-3"
                      >
                        <div>
                          <p className="font-bold text-white text-sm">
                            #{c.rank} {c.orgName}
                          </p>
                          <p className="text-xs text-slate-400">
                            {c.kind} · {c.wins} victorias
                          </p>
                        </div>
                        <span className="font-mono-num font-extrabold text-amber-300">
                          {c.totalPoints.toLocaleString('es-CO')} pts
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-3">
                <h2 className="font-display text-xl font-bold text-white">
                  Campeones de Torneos
                </h2>
                {ranking.tournamentChampions.length === 0 ? (
                  <p className="text-sm text-slate-400 py-4">
                    Cuando finalice un Gran Torneo aparecerá su campeón aquí.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {ranking.tournamentChampions.map((tc, i) => (
                      <div
                        key={i}
                        className="bg-[#080E1E] border border-amber-400/40 rounded-xl px-4 py-3 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-bold text-amber-300 text-sm">{tc.championName}</p>
                          <p className="text-xs text-slate-400">
                            {tc.tournamentName} ({tc.kind})
                          </p>
                        </div>
                        <span className="font-mono-num font-bold text-white">
                          {tc.points.toLocaleString('es-CO')} pts
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'records' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-3">
                <h2 className="font-display text-xl font-bold text-white">
                  Más Victorias
                </h2>
                {ranking.mostWins.map((m) => (
                  <div
                    key={m.name}
                    className="flex items-center justify-between bg-[#080E1E] border border-slate-800 rounded-xl px-4 py-2.5 text-sm"
                  >
                    <span className="text-white font-semibold">
                      #{m.rank} {m.name}
                    </span>
                    <span className="font-mono-num font-bold text-amber-300">
                      {m.wins} victorias
                    </span>
                  </div>
                ))}
              </div>
              <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-3">
                <h2 className="font-display text-xl font-bold text-white">
                  Más Respuestas Correctas
                </h2>
                {ranking.mostCorrect.map((m) => (
                  <div
                    key={m.name}
                    className="flex items-center justify-between bg-[#080E1E] border border-slate-800 rounded-xl px-4 py-2.5 text-sm"
                  >
                    <span className="text-white font-semibold">
                      #{m.rank} {m.name}
                    </span>
                    <span className="font-mono-num font-bold text-emerald-300">
                      {m.correctCount} aciertos
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
