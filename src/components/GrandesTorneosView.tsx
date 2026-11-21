import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Crown,
  Flag,
  Plus,
  Trophy,
  Users,
} from 'lucide-react';
import {
  ChurchTournament,
  TournamentEntityKind,
} from '../shared/expansionTypes';
import { AVATARS } from '../shared/types';
import { getOrCreateProfileKey } from '../utils/profileKey';
import { AvatarBadge } from './AvatarBadge';
import { QrCodeCard } from './QrCodeCard';

const ENTITY_KINDS: TournamentEntityKind[] = [
  'Iglesia',
  'Distrito',
  'Congregación',
  'Grupo Juvenil',
  'Familia',
  'Ministerio',
];

export function GrandesTorneosView({
  initialTournamentId,
  initialSignature,
  onBack,
}: {
  initialTournamentId?: string;
  initialSignature?: string;
  onBack: () => void;
}) {
  const [tournaments, setTournaments] = useState<ChurchTournament[]>([]);
  const [selected, setSelected] = useState<ChurchTournament | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'detail'>(
    initialTournamentId ? 'detail' : 'list'
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [entityKind, setEntityKind] = useState<TournamentEntityKind>('Iglesia');
  const [scheduledAt, setScheduledAt] = useState('');
  const [rulesSummary, setRulesSummary] = useState(
    '3 rondas clasificatorias, Semifinales y Gran Final en vivo.'
  );
  const [totalRounds, setTotalRounds] = useState(3);
  const [orgNames, setOrgNames] = useState<string[]>([
    'Iglesia Central',
    'Iglesia Monte Sion',
    'Iglesia Bethel',
  ]);
  const [creating, setCreating] = useState(false);

  // Guest join tournament form
  const [joinName, setJoinName] = useState('');
  const [joinAvatarId, setJoinAvatarId] = useState(AVATARS[0].id);
  const [joinOrgId, setJoinOrgId] = useState('');
  const [joinedMsg, setJoinedMsg] = useState<string | null>(null);

  // Round score submission state (organizer)
  const [roundTitle, setRoundTitle] = useState('');
  const [roundStage, setRoundStage] = useState<'Clasificatoria' | 'Semifinal' | 'Gran Final'>('Clasificatoria');
  const [scoreInputs, setScoreInputs] = useState<Record<string, number>>({});

  const loadList = async () => {
    const res = await fetch('/api/expansion/tournaments');
    const data = await res.json();
    setTournaments(data.tournaments || []);
  };

  useEffect(() => {
    if (initialTournamentId) {
      const qs = initialSignature ? `?s=${encodeURIComponent(initialSignature)}` : '';
      fetch(`/api/expansion/tournaments/${encodeURIComponent(initialTournamentId)}/validate${qs}`)
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || 'Torneo no encontrado');
          setSelected(d.tournament);
          setJoinOrgId(d.tournament.organizations?.[0]?.id || '');
          setViewMode('detail');
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    } else {
      loadList().finally(() => setLoading(false));
    }
  }, [initialTournamentId, initialSignature]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanedOrgs = orgNames
      .map((n) => n.trim())
      .filter(Boolean)
      .map((n) => ({ name: n, kind: entityKind }));
    if (cleanedOrgs.length < 2) {
      setError('Agrega al menos 2 delegaciones o equipos participantes.');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/expansion/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || 'Gran Torneo Bíblico',
          description,
          entityKind,
          scheduledAt,
          rulesSummary,
          totalRounds,
          organizations: cleanedOrgs,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'No se pudo crear el torneo.');
        setCreating(false);
        return;
      }
      setSelected(data.tournament);
      setJoinOrgId(data.tournament.organizations[0]?.id || '');
      setViewMode('detail');
      await loadList();
    } finally {
      setCreating(false);
    }
  };

  const handleGuestJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    setJoinedMsg(null);
    const res = await fetch(
      `/api/expansion/tournaments/${encodeURIComponent(selected.id)}/join`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: joinName.trim(),
          avatarId: joinAvatarId,
          orgId: joinOrgId || selected.organizations[0]?.id,
          profileKey: getOrCreateProfileKey(),
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'No se pudo registrar.');
      return;
    }
    setSelected(data.tournament);
    setJoinedMsg(`¡${joinName.trim()} quedó inscrito en ${selected.name}!`);
    setJoinName('');
  };

  const handleRoundAction = async (payload: Record<string, unknown>) => {
    if (!selected) return;
    setError(null);
    const res = await fetch(
      `/api/expansion/tournaments/${encodeURIComponent(selected.id)}/round`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Error actualizando ronda.');
      return;
    }
    setSelected(data.tournament);
    loadList();
  };

  const sortedOrgs = selected
    ? [...selected.organizations].sort((a, b) => b.points - a.points || b.wins - a.wins)
    : [];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            if (viewMode !== 'list' && !initialTournamentId) {
              setViewMode('list');
              setSelected(null);
            } else {
              onBack();
            }
          }}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          {viewMode !== 'list' && !initialTournamentId ? 'Ver todos los torneos' : 'Volver al inicio'}
        </button>

        {viewMode === 'list' && (
          <button
            type="button"
            onClick={() => setViewMode('create')}
            className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-xs sm:text-sm inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Crear Gran Torneo
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
          <Building2 className="w-4 h-4" />
          Iglesias · Distritos · Congregaciones · Grupos Juveniles
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white">
          Grandes Torneos Bíblicos
        </h1>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/50 text-rose-200 text-sm">
          {error}
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {loading ? (
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-10 text-center text-slate-400">
              Cargando torneos...
            </div>
          ) : tournaments.length === 0 ? (
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-10 text-center space-y-3">
              <Trophy className="w-12 h-12 text-amber-400 mx-auto" />
              <p className="font-display text-xl font-bold text-white">
                Aún no hay Grandes Torneos creados
              </p>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Organiza competencias entre iglesias, distritos o grupos juveniles con código de invitación, tabla de posiciones y fases finales.
              </p>
              <button
                type="button"
                onClick={() => setViewMode('create')}
                className="px-5 py-3 rounded-xl bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer"
              >
                Crear Primer Gran Torneo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tournaments.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setSelected(t);
                    setJoinOrgId(t.organizations[0]?.id || '');
                    setViewMode('detail');
                  }}
                  className="text-left bg-[#111A2E] hover:bg-[#16213B] border border-slate-800 rounded-2xl p-6 space-y-3 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-amber-300 font-bold">{t.entityKind}</span>
                    <span className="font-mono-num text-slate-400">{t.code}</span>
                  </div>
                  <h2 className="font-display text-xl font-extrabold text-white">
                    {t.name}
                  </h2>
                  <p className="text-xs text-slate-400 line-clamp-2">{t.description || t.rulesSummary}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 pt-1">
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-sky-400" />
                      {t.organizations.length} delegaciones
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-emerald-400" />
                      {t.participants.length} inscritos
                    </span>
                    <span className="text-amber-300 font-semibold ml-auto">
                      {t.currentStage}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CREATE VIEW */}
      {viewMode === 'create' && (
        <form
          onSubmit={handleCreate}
          className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-5 max-w-3xl"
        >
          <h2 className="font-display text-xl font-bold text-white">
            Organizar Nuevo Torneo
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nombre del torneo</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Copa Bíblica Distrital 2026"
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Tipo de competencia</label>
              <select
                value={entityKind}
                onChange={(e) => setEntityKind(e.target.value as TournamentEntityKind)}
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm"
              >
                {ENTITY_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Fecha y hora programada</label>
              <input
                type="text"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                placeholder="Ej: Sábado 18:00"
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Cantidad de rondas</label>
              <select
                value={totalRounds}
                onChange={(e) => setTotalRounds(Number(e.target.value))}
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm"
              >
                <option value={2}>2 rondas</option>
                <option value={3}>3 rondas (Clasificatoria, Semifinal, Final)</option>
                <option value={4}>4 rondas</option>
                <option value={5}>5 rondas</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Descripción y reglas</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles de convocatoria..."
              className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm"
            />
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">
                Delegaciones / {entityKind}s Participantes
              </span>
              <button
                type="button"
                onClick={() => setOrgNames((prev) => [...prev, `Delegación ${prev.length + 1}`])}
                className="text-xs font-bold text-sky-400 hover:text-sky-300 cursor-pointer"
              >
                + Agregar otra
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {orgNames.map((orgName, idx) => (
                <input
                  key={idx}
                  type="text"
                  value={orgName}
                  onChange={(e) => {
                    const next = [...orgNames];
                    next[idx] = e.target.value;
                    setOrgNames(next);
                  }}
                  className="bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={creating}
            className="w-full py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-sm cursor-pointer"
          >
            {creating ? 'Creando torneo...' : 'Crear Gran Torneo y Generar QR'}
          </button>
        </form>
      )}

      {/* DETAIL / ORGANIZER / GUEST JOIN VIEW */}
      {viewMode === 'detail' && selected && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  {selected.entityKind} · {selected.currentStage}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                  <Calendar className="w-3.5 h-3.5" />
                  {selected.scheduledAt}
                </span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                {selected.name}
              </h2>
              {selected.description && (
                <p className="text-sm text-slate-300">{selected.description}</p>
              )}
              <p className="text-xs text-slate-400">Reglas: {selected.rulesSummary}</p>

              {/* Standings Table */}
              <div className="pt-3 border-t border-slate-800 space-y-3">
                <h3 className="font-display font-bold text-lg text-white flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-400" />
                  Tabla de Posiciones por {selected.entityKind}
                </h3>
                <div className="space-y-2">
                  {sortedOrgs.map((org, idx) => (
                    <div
                      key={org.id}
                      className="flex items-center justify-between gap-3 bg-[#080E1E] border border-slate-800 rounded-xl px-4 py-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono-num font-bold text-sm text-amber-300 w-5">
                          #{idx + 1}
                        </span>
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: org.color }}
                        />
                        <div className="min-w-0">
                          <p className="font-display font-bold text-white text-sm truncate">
                            {org.name}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {selected.participants.filter((p) => p.orgId === org.id).length} inscritos ·{' '}
                            {org.wins} rondas ganadas
                          </p>
                        </div>
                      </div>
                      <p className="font-mono-num text-xl font-extrabold text-amber-300 shrink-0">
                        {org.points.toLocaleString('es-CO')} pts
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: QR Invite + Guest Registration */}
            <div className="lg:col-span-5 space-y-5">
              <QrCodeCard
                code={selected.code}
                gameId={selected.id}
                title={selected.name}
                showProjectorLink={false}
                inviteInfoEndpoint={`/api/expansion/tournaments/${encodeURIComponent(selected.id)}/invite-info`}
                allowedPathPrefix="/torneo/"
              />

              {selected.status !== 'finished' && (
                <form
                  onSubmit={handleGuestJoin}
                  className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-3"
                >
                  <h3 className="font-display font-bold text-base text-white">
                    Inscribir Participante al Torneo
                  </h3>
                  <input
                    type="text"
                    required
                    value={joinName}
                    onChange={(e) => setJoinName(e.target.value)}
                    placeholder="Nombre completo del participante"
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                  />
                  <select
                    value={joinOrgId}
                    onChange={(e) => setJoinOrgId(e.target.value)}
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                  >
                    {selected.organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {AVATARS.slice(0, 8).map((av) => (
                      <button
                        key={av.id}
                        type="button"
                        onClick={() => setJoinAvatarId(av.id)}
                        className={`p-1 rounded-xl border shrink-0 cursor-pointer ${
                          joinAvatarId === av.id
                            ? 'border-amber-400 bg-amber-400/15'
                            : 'border-slate-800'
                        }`}
                      >
                        <AvatarBadge avatarId={av.id} size="sm" />
                      </button>
                    ))}
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
                  >
                    Unirme como Invitado al Torneo
                  </button>
                  {joinedMsg && (
                    <p className="text-xs text-emerald-300 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {joinedMsg}
                    </p>
                  )}
                </form>
              )}
            </div>
          </div>

          {/* Organizer Round Runner */}
          {selected.status !== 'finished' && (
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display font-bold text-lg text-white">
                  Control de Rondas (Clasificatoria · Semifinales · Gran Final)
                </h3>
                <button
                  type="button"
                  onClick={() => handleRoundAction({ action: 'finish_tournament' })}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Flag className="w-3.5 h-3.5" />
                  Finalizar y Proclamar Campeón
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select
                  value={roundStage}
                  onChange={(e) =>
                    setRoundStage(
                      e.target.value as 'Clasificatoria' | 'Semifinal' | 'Gran Final'
                    )
                  }
                  className="bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                >
                  <option value="Clasificatoria">Clasificatoria</option>
                  <option value="Semifinal">Semifinal</option>
                  <option value="Gran Final">Gran Final</option>
                </select>
                <input
                  type="text"
                  value={roundTitle}
                  onChange={(e) => setRoundTitle(e.target.value)}
                  placeholder="Título de la ronda (ej: Ronda 1)"
                  className="bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    handleRoundAction({
                      action: 'create_round',
                      stage: roundStage,
                      title: roundTitle || `${roundStage} #${selected.rounds.length + 1}`,
                    });
                    setRoundTitle('');
                  }}
                  className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  Abrir Nueva Ronda
                </button>
              </div>

              {selected.rounds.length > 0 && (
                <div className="space-y-3">
                  {selected.rounds.map((r) => (
                    <div
                      key={r.id}
                      className="bg-[#080E1E] border border-slate-800 rounded-xl p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white">
                          {r.title} ({r.stage})
                        </span>
                        <span
                          className={
                            r.status === 'finished' ? 'text-emerald-400' : 'text-amber-300'
                          }
                        >
                          {r.status === 'finished' ? 'Completada' : 'En curso'}
                        </span>
                      </div>

                      {r.status !== 'finished' ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {selected.organizations.map((org) => (
                              <div key={org.id} className="space-y-1">
                                <label className="text-[11px] text-slate-400 block truncate">
                                  Puntos {org.name}
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  value={scoreInputs[`${r.id}:${org.id}`] ?? ''}
                                  onChange={(e) =>
                                    setScoreInputs((prev) => ({
                                      ...prev,
                                      [`${r.id}:${org.id}`]: Number(e.target.value) || 0,
                                    }))
                                  }
                                  placeholder="0"
                                  className="w-full bg-[#111A2E] border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-mono-num text-white"
                                />
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleRoundAction({
                                action: 'record_round_scores',
                                roundId: r.id,
                                orgScores: selected.organizations.map((org) => ({
                                  orgId: org.id,
                                  points: scoreInputs[`${r.id}:${org.id}`] || 0,
                                })),
                              })
                            }
                            className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs cursor-pointer"
                          >
                            Guardar Puntos de Ronda
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                          {r.orgScores.map((s) => (
                            <span
                              key={s.orgId}
                              className="px-2.5 py-1 rounded-lg bg-[#111A2E] border border-slate-800"
                            >
                              {s.orgName}: <strong className="text-amber-300">{s.points}</strong>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
