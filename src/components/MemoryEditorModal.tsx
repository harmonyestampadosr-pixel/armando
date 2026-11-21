import { useEffect, useState } from 'react';
import {
  DownloadCloud,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import type {
  MemoryActivityItem,
  MemoryChallengeItem,
  MemoryGameItem,
  MemoryImportSourcesBundle,
  MemoryRecognitionItem,
  MemoryResultRankItem,
  MemoryTeamItem,
  MemoryVisibility,
  SaturdayMemoryRecord,
} from '../shared/memoriesData';

interface MemoryEditorModalProps {
  initialMemory: SaturdayMemoryRecord | null;
  initialDate?: string;
  isAdmin: boolean;
  adminToken: string;
  memberToken: string;
  onClose: () => void;
  onSaved: (memory: SaturdayMemoryRecord) => void;
}

function makeLocalId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export function MemoryEditorModal({
  initialMemory,
  initialDate,
  isAdmin,
  adminToken,
  memberToken,
  onClose,
  onSaved,
}: MemoryEditorModalProps) {
  const isEditing = Boolean(initialMemory);

  const [date, setDate] = useState(
    initialMemory?.date || initialDate || new Date().toISOString().slice(0, 10)
  );
  const [title, setTitle] = useState(initialMemory?.title || '');
  const [theme, setTheme] = useState(initialMemory?.theme || '');
  const [bibleText, setBibleText] = useState(initialMemory?.bibleText || '');
  const [bibleVerseQuote, setBibleVerseQuote] = useState(
    initialMemory?.bibleVerseQuote || ''
  );
  const [directorName, setDirectorName] = useState(
    initialMemory?.directorName || ''
  );
  const [attendanceCount, setAttendanceCount] = useState<string>(
    typeof initialMemory?.attendanceCount === 'number'
      ? String(initialMemory.attendanceCount)
      : ''
  );
  const [participantsText, setParticipantsText] = useState(
    (initialMemory?.participantNames || []).join(', ')
  );

  const [activities, setActivities] = useState<MemoryActivityItem[]>(
    initialMemory?.activities || []
  );
  const [gamesPlayed, setGamesPlayed] = useState<MemoryGameItem[]>(
    initialMemory?.gamesPlayed || []
  );
  const [challengesCompleted, setChallengesCompleted] = useState<
    MemoryChallengeItem[]
  >(initialMemory?.challengesCompleted || []);
  const [teams, setTeams] = useState<MemoryTeamItem[]>(
    initialMemory?.teams || []
  );
  const [resultsSummary, setResultsSummary] = useState(
    initialMemory?.resultsSummary || ''
  );
  const [rankings, setRankings] = useState<MemoryResultRankItem[]>(
    initialMemory?.rankings || []
  );
  const [recognitions, setRecognitions] = useState<MemoryRecognitionItem[]>(
    initialMemory?.recognitions || []
  );
  const [dailyReflection, setDailyReflection] = useState(
    initialMemory?.dailyReflection || ''
  );
  const [observations, setObservations] = useState(
    initialMemory?.observations || ''
  );

  // Privacy flags per memory
  const [visibility, setVisibility] = useState<MemoryVisibility>(
    initialMemory?.visibility || 'authorized_public'
  );
  const [hideParticipantNames, setHideParticipantNames] = useState<boolean>(
    Boolean(initialMemory?.hideParticipantNames)
  );
  const [hidePhotos, setHidePhotos] = useState<boolean>(
    Boolean(initialMemory?.hidePhotos)
  );
  const [sourceProgramId, setSourceProgramId] = useState<string | undefined>(
    initialMemory?.sourceProgramId
  );

  // Import from past programs/games/challenges
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [importBundle, setImportBundle] =
    useState<MemoryImportSourcesBundle | null>(null);
  const [loadingImport, setLoadingImport] = useState(false);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const authHeaders = () => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (adminToken) h['x-memory-admin-token'] = adminToken;
    if (memberToken) h['x-memory-member-token'] = memberToken;
    return h;
  };

  useEffect(() => {
    if (!showImportPanel || importBundle) return;
    let active = true;
    setLoadingImport(true);
    fetch('/api/memories/import-sources', { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data) setImportBundle(data as MemoryImportSourcesBundle);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingImport(false);
      });
    return () => {
      active = false;
    };
  }, [showImportPanel, importBundle]);

  const handleImportProgram = (progId: string) => {
    if (!importBundle) return;
    const prog = importBundle.programs.find((p) => p.id === progId);
    if (!prog) return;
    setDate(prog.scheduledDate || date);
    setTitle(prog.title || title);
    setTheme(prog.centralTheme || theme);
    setBibleText(prog.mainBibleText || bibleText);
    if (prog.mainBibleVerseQuote) setBibleVerseQuote(prog.mainBibleVerseQuote);
    if (prog.directorName) setDirectorName(prog.directorName);
    if (prog.spiritualObjective && !dailyReflection) {
      setDailyReflection(prog.spiritualObjective);
    }
    if (prog.directorNotes && !observations) {
      setObservations(prog.directorNotes);
    }
    setSourceProgramId(prog.id);
    setActivities(
      prog.activities.map((a) => ({
        id: makeLocalId('act'),
        title: a.title,
        categoryLabel: a.categoryLabel,
        durationMin: a.durationMin,
        notes: a.description,
      }))
    );

    // Also attach matching games/challenges from that same date if found
    const matchingGames = importBundle.games.filter(
      (g) => g.date === prog.scheduledDate
    );
    if (matchingGames.length > 0) {
      setGamesPlayed((prev) => [
        ...prev,
        ...matchingGames.map((g) => ({
          id: makeLocalId('gam'),
          title: g.title,
          modeLabel: g.mode,
          participantsCount: g.participantsCount,
          winnerOrHighlight: g.podium[0]
            ? `${g.podium[0].name} (${g.podium[0].score} pts)`
            : undefined,
        })),
      ]);
      const importedTeams = matchingGames.flatMap((g) => g.teams);
      if (importedTeams.length > 0) {
        setTeams((prev) => [
          ...prev,
          ...importedTeams.map((t) => ({
            id: makeLocalId('tm'),
            name: t.name,
            color: t.color,
            score: t.score,
          })),
        ]);
      }
    }

    const matchingChallenges = importBundle.challenges.filter(
      (c) => c.date === prog.scheduledDate
    );
    if (matchingChallenges.length > 0) {
      setChallengesCompleted((prev) => [
        ...prev,
        ...matchingChallenges.map((c) => ({
          id: makeLocalId('chl'),
          title: c.title,
          categoryLabel: c.categoryLabel,
          participantOrTeam: c.participantName,
          outcome: `${c.outcome} (${c.points} pts)`,
        })),
      ]);
    }
    setShowImportPanel(false);
  };

  const handleImportGame = (gameId: string) => {
    if (!importBundle) return;
    const g = importBundle.games.find((x) => x.id === gameId);
    if (!g) return;
    setGamesPlayed((prev) => [
      ...prev,
      {
        id: makeLocalId('gam'),
        title: g.title,
        modeLabel: g.mode,
        participantsCount: g.participantsCount,
        winnerOrHighlight: g.podium[0]
          ? `${g.podium[0].name} (${g.podium[0].score} pts)`
          : undefined,
      },
    ]);
    if (g.teams.length > 0) {
      setTeams((prev) => [
        ...prev,
        ...g.teams.map((t) => ({
          id: makeLocalId('tm'),
          name: t.name,
          color: t.color,
          score: t.score,
        })),
      ]);
    }
    if (g.podium.length > 0 && rankings.length === 0) {
      setRankings(
        g.podium.map((p, idx) => ({
          id: makeLocalId('rk'),
          position: idx + 1,
          name: p.name,
          points: p.score,
        }))
      );
    }
  };

  const handleImportChallenge = (chlId: string) => {
    if (!importBundle) return;
    const c = importBundle.challenges.find((x) => x.id === chlId);
    if (!c) return;
    setChallengesCompleted((prev) => [
      ...prev,
      {
        id: makeLocalId('chl'),
        title: c.title,
        categoryLabel: c.categoryLabel,
        participantOrTeam: c.participantName,
        outcome: `${c.outcome} (${c.points} pts)`,
      },
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setErrorMsg(null);
    if (!theme.trim() && !title.trim()) {
      setErrorMsg('Escribe al menos el tema o el título del sábado.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        date,
        title: title.trim() || `Sábado: ${theme.trim()}`,
        theme: theme.trim() || title.trim(),
        bibleText: bibleText.trim() || 'Palabra de Dios',
        bibleVerseQuote: bibleVerseQuote.trim(),
        directorName: directorName.trim() || 'Dirección Juvenil',
        ...(attendanceCount.trim()
          ? { attendanceCount: Math.max(0, Number(attendanceCount) || 0) }
          : {}),
        participantNames: participantsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        activities,
        gamesPlayed,
        challengesCompleted,
        teams,
        resultsSummary: resultsSummary.trim(),
        rankings,
        recognitions,
        dailyReflection: dailyReflection.trim(),
        observations: observations.trim(),
        ...(sourceProgramId ? { sourceProgramId } : {}),
        ...(isAdmin
          ? { visibility, hideParticipantNames, hidePhotos }
          : {}),
      };

      const url = isEditing
        ? `/api/memories/${encodeURIComponent(initialMemory!.id)}`
        : '/api/memories';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.memory) {
        setErrorMsg(data.error || 'No se pudo guardar la memoria del sábado.');
        return;
      }
      onSaved(data.memory as SaturdayMemoryRecord);
    } catch {
      setErrorMsg('Error de conexión al guardar la memoria.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm overflow-y-auto p-4 sm:p-6 flex items-start justify-center">
      <div className="bg-[#111A2E] border border-slate-700 rounded-3xl max-w-4xl w-full my-6 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-[#0C1429]">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
              {isEditing
                ? 'Editar Registro de Memoria (conserva historial de versiones)'
                : 'Nuevo Registro Independiente de Sábado'}
            </p>
            <h2 className="font-display text-xl font-extrabold text-white">
              {isEditing
                ? `Memoria del ${initialMemory!.date}`
                : 'Registrar Memoria del Programa Juvenil'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowImportPanel((v) => !v)}
              className="px-3.5 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <DownloadCloud className="w-4 h-4" />
              Recuperar desde Programa / Partidas
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              aria-label="Cerrar editor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Recovery / Import Drawer */}
        {showImportPanel && (
          <div className="px-6 py-4 bg-[#080E1E] border-b border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-sky-300">
                Recuperar programas, partidas o retos ya realizados
              </p>
              <button
                type="button"
                onClick={() => setShowImportPanel(false)}
                className="text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Ocultar
              </button>
            </div>

            {loadingImport ? (
              <p className="text-xs text-slate-400">
                Consultando registros guardados en la plataforma...
              </p>
            ) : !importBundle ||
              (importBundle.programs.length === 0 &&
                importBundle.games.length === 0 &&
                importBundle.challenges.length === 0) ? (
              <p className="text-xs text-slate-400">
                No se encontraron programas, partidas o retos guardados todavía. Puedes llenar los campos manualmente abajo.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="space-y-1.5">
                  <p className="font-bold text-amber-300">
                    Programas del Sábado ({importBundle.programs.length})
                  </p>
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {importBundle.programs.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleImportProgram(p.id)}
                        className="w-full text-left px-2.5 py-2 rounded-lg bg-[#111A2E] hover:bg-slate-800 border border-slate-800 text-slate-200 cursor-pointer"
                      >
                        <p className="font-bold truncate">{p.title}</p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {p.scheduledDate} · {p.centralTheme}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="font-bold text-sky-300">
                    Juegos y Partidas ({importBundle.games.length})
                  </p>
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {importBundle.games.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => handleImportGame(g.id)}
                        className="w-full text-left px-2.5 py-2 rounded-lg bg-[#111A2E] hover:bg-slate-800 border border-slate-800 text-slate-200 cursor-pointer"
                      >
                        <p className="font-bold truncate">+ {g.title}</p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {g.date} · {g.participantsCount} participantes
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="font-bold text-emerald-300">
                    Retos, Ruleta y Cabina ({importBundle.challenges.length})
                  </p>
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {importBundle.challenges.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleImportChallenge(c.id)}
                        className="w-full text-left px-2.5 py-2 rounded-lg bg-[#111A2E] hover:bg-slate-800 border border-slate-800 text-slate-200 cursor-pointer"
                      >
                        <p className="font-bold truncate">+ {c.title}</p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {c.date} · {c.participantName}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {errorMsg && (
            <div className="bg-rose-500/15 border border-rose-400/50 rounded-xl px-4 py-3 text-sm text-rose-200">
              {errorMsg}
            </div>
          )}

          {/* Core Saturday Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Fecha del sábado
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Tema del programa
              </label>
              <input
                type="text"
                required
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="Ej: Firmes en la Roca"
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Título de archivo (opcional)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Culto Joven Especial"
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Texto bíblico
              </label>
              <input
                type="text"
                value={bibleText}
                onChange={(e) => setBibleText(e.target.value)}
                placeholder="Ej: 1 Timoteo 4:12"
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-sky-300 font-semibold"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Director del programa
              </label>
              <input
                type="text"
                value={directorName}
                onChange={(e) => setDirectorName(e.target.value)}
                placeholder="Nombre del director/a"
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Nombres de participantes (separados por coma, opcional)
              </label>
              <input
                type="text"
                value={participantsText}
                onChange={(e) => setParticipantsText(e.target.value)}
                placeholder="Ej: Daniel, Sofía, Mateo, Valeria..."
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Asistencia total (jóvenes)
              </label>
              <input
                type="number"
                min={0}
                max={5000}
                value={attendanceCount}
                onChange={(e) => setAttendanceCount(e.target.value)}
                placeholder="Ej: 45"
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono-num"
              />
            </div>
          </div>

          {/* Activities Section */}
          <div className="bg-[#080E1E]/70 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-sm text-white">
                Actividades Realizadas ({activities.length})
              </h3>
              <button
                type="button"
                onClick={() =>
                  setActivities((prev) => [
                    ...prev,
                    { id: makeLocalId('act'), title: '', durationMin: 10 },
                  ])
                }
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-300 inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar actividad
              </button>
            </div>
            {activities.map((act, idx) => (
              <div
                key={act.id}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
              >
                <input
                  type="text"
                  value={act.title}
                  onChange={(e) =>
                    setActivities((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, title: e.target.value } : x
                      )
                    )
                  }
                  placeholder="Título de la actividad"
                  className="sm:col-span-5 bg-[#111A2E] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
                <input
                  type="text"
                  value={act.categoryLabel || ''}
                  onChange={(e) =>
                    setActivities((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, categoryLabel: e.target.value } : x
                      )
                    )
                  }
                  placeholder="Bloque (ej: Alabanza)"
                  className="sm:col-span-3 bg-[#111A2E] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
                <input
                  type="number"
                  min={1}
                  value={act.durationMin || ''}
                  onChange={(e) =>
                    setActivities((prev) =>
                      prev.map((x, i) =>
                        i === idx
                          ? { ...x, durationMin: Number(e.target.value) || 0 }
                          : x
                      )
                    )
                  }
                  placeholder="Min"
                  className="sm:col-span-2 bg-[#111A2E] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono-num"
                />
                <button
                  type="button"
                  onClick={() =>
                    setActivities((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="sm:col-span-2 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-bold inline-flex items-center justify-center cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Games & Challenges Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#080E1E]/70 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-sm text-white">
                  Juegos Realizados ({gamesPlayed.length})
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    setGamesPlayed((prev) => [
                      ...prev,
                      { id: makeLocalId('gam'), title: '' },
                    ])
                  }
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-sky-300 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Juego
                </button>
              </div>
              {gamesPlayed.map((g, idx) => (
                <div key={g.id} className="space-y-1.5 border-b border-slate-800 pb-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={g.title}
                      onChange={(e) =>
                        setGamesPlayed((prev) =>
                          prev.map((x, i) =>
                            i === idx ? { ...x, title: e.target.value } : x
                          )
                        )
                      }
                      placeholder="Nombre del juego / trivia"
                      className="flex-1 bg-[#111A2E] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setGamesPlayed((prev) =>
                          prev.filter((_, i) => i !== idx)
                        )
                      }
                      className="p-1.5 rounded-lg bg-rose-500/15 text-rose-300 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={g.winnerOrHighlight || ''}
                    onChange={(e) =>
                      setGamesPlayed((prev) =>
                        prev.map((x, i) =>
                          i === idx
                            ? { ...x, winnerOrHighlight: e.target.value }
                            : x
                        )
                      )
                    }
                    placeholder="Ganador o destaque (ej: Equipo Águilas)"
                    className="w-full bg-[#111A2E] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300"
                  />
                </div>
              ))}
            </div>

            <div className="bg-[#080E1E]/70 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-sm text-white">
                  Retos Completados ({challengesCompleted.length})
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    setChallengesCompleted((prev) => [
                      ...prev,
                      { id: makeLocalId('chl'), title: '' },
                    ])
                  }
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-emerald-300 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Reto
                </button>
              </div>
              {challengesCompleted.map((c, idx) => (
                <div key={c.id} className="space-y-1.5 border-b border-slate-800 pb-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={c.title}
                      onChange={(e) =>
                        setChallengesCompleted((prev) =>
                          prev.map((x, i) =>
                            i === idx ? { ...x, title: e.target.value } : x
                          )
                        )
                      }
                      placeholder="Título del reto o sorpresa"
                      className="flex-1 bg-[#111A2E] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setChallengesCompleted((prev) =>
                          prev.filter((_, i) => i !== idx)
                        )
                      }
                      className="p-1.5 rounded-lg bg-rose-500/15 text-rose-300 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="text"
                      value={c.participantOrTeam || ''}
                      onChange={(e) =>
                        setChallengesCompleted((prev) =>
                          prev.map((x, i) =>
                            i === idx
                              ? { ...x, participantOrTeam: e.target.value }
                              : x
                          )
                        )
                      }
                      placeholder="Participante / equipo"
                      className="bg-[#111A2E] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300"
                    />
                    <input
                      type="text"
                      value={c.outcome || ''}
                      onChange={(e) =>
                        setChallengesCompleted((prev) =>
                          prev.map((x, i) =>
                            i === idx ? { ...x, outcome: e.target.value } : x
                          )
                        )
                      }
                      placeholder="Resultado (ej: Cumplido)"
                      className="bg-[#111A2E] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Teams & Recognitions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#080E1E]/70 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-sm text-white">
                  Equipos Participantes ({teams.length})
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    setTeams((prev) => [
                      ...prev,
                      { id: makeLocalId('tm'), name: '', score: 0 },
                    ])
                  }
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-300 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Equipo
                </button>
              </div>
              {teams.map((t, idx) => (
                <div key={t.id} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={t.name}
                    onChange={(e) =>
                      setTeams((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, name: e.target.value } : x
                        )
                      )
                    }
                    placeholder="Nombre del equipo"
                    className="flex-1 bg-[#111A2E] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                  <input
                    type="number"
                    min={0}
                    value={t.score ?? 0}
                    onChange={(e) =>
                      setTeams((prev) =>
                        prev.map((x, i) =>
                          i === idx
                            ? { ...x, score: Number(e.target.value) || 0 }
                            : x
                        )
                      )
                    }
                    className="w-20 bg-[#111A2E] border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono-num"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setTeams((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="p-1.5 rounded-lg bg-rose-500/15 text-rose-300 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-[#080E1E]/70 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-sm text-white">
                  Reconocimientos ({recognitions.length})
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    setRecognitions((prev) => [
                      ...prev,
                      {
                        id: makeLocalId('rec'),
                        recipientName: '',
                        title: '',
                      },
                    ])
                  }
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-emerald-300 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Reconocimiento
                </button>
              </div>
              {recognitions.map((r, idx) => (
                <div key={r.id} className="space-y-1.5 border-b border-slate-800 pb-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={r.title}
                      onChange={(e) =>
                        setRecognitions((prev) =>
                          prev.map((x, i) =>
                            i === idx ? { ...x, title: e.target.value } : x
                          )
                        )
                      }
                      placeholder="Título (ej: Espíritu de Servicio)"
                      className="flex-1 bg-[#111A2E] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setRecognitions((prev) =>
                          prev.filter((_, i) => i !== idx)
                        )
                      }
                      className="p-1.5 rounded-lg bg-rose-500/15 text-rose-300 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={r.recipientName}
                    onChange={(e) =>
                      setRecognitions((prev) =>
                        prev.map((x, i) =>
                          i === idx
                            ? { ...x, recipientName: e.target.value }
                            : x
                        )
                      )
                    }
                    placeholder="Joven o equipo reconocido"
                    className="w-full bg-[#111A2E] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Results, Reflection & Observations */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Resumen de resultados del sábado
              </label>
              <textarea
                rows={2}
                value={resultsSummary}
                onChange={(e) => setResultsSummary(e.target.value)}
                placeholder="Ej: Empate amistoso en la trivia final, gran participación de todos los equipos..."
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Reflexión espiritual del día
                </label>
                <textarea
                  rows={3}
                  value={dailyReflection}
                  onChange={(e) => setDailyReflection(e.target.value)}
                  placeholder="Mensaje central, enseñanza bíblica y llamado espiritual compartido..."
                  className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Observaciones y notas de seguimiento
                </label>
                <textarea
                  rows={3}
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Logística, visitantes nuevos, ideas para próximos sábados..."
                  className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white"
                />
              </div>
            </div>
          </div>

          {/* Admin-only Per-Record Privacy Controls */}
          {isAdmin && (
            <div className="bg-[#080E1E] border border-amber-400/35 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Privacidad específica de este registro
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">
                    Visibilidad
                  </label>
                  <select
                    value={visibility}
                    onChange={(e) =>
                      setVisibility(e.target.value as MemoryVisibility)
                    }
                    className="w-full bg-[#111A2E] border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="authorized_public">
                      Pública autorizada
                    </option>
                    <option value="internal_only">
                      Solo miembros con código
                    </option>
                    <option value="admins_only">Solo administradores</option>
                  </select>
                </div>

                <label className="flex items-center justify-between gap-2 bg-[#111A2E] border border-slate-800 rounded-xl px-3 py-2 text-slate-200 cursor-pointer">
                  <span>Ocultar nombres</span>
                  <input
                    type="checkbox"
                    checked={hideParticipantNames}
                    onChange={(e) => setHideParticipantNames(e.target.checked)}
                    className="accent-amber-400 w-4 h-4"
                  />
                </label>

                <label className="flex items-center justify-between gap-2 bg-[#111A2E] border border-slate-800 rounded-xl px-3 py-2 text-slate-200 cursor-pointer">
                  <span>Ocultar fotografías</span>
                  <input
                    type="checkbox"
                    checked={hidePhotos}
                    onChange={(e) => setHidePhotos(e.target.checked)}
                    className="accent-amber-400 w-4 h-4"
                  />
                </label>
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-display font-extrabold text-xs sm:text-sm inline-flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {saving
                ? 'Guardando...'
                : isEditing
                  ? 'Guardar Cambios'
                  : 'Guardar Memoria del Sábado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
