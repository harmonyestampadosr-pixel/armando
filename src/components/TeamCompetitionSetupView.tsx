import { useState } from 'react';
import { ArrowLeft, Check, Play, Shield, Sliders, Users } from 'lucide-react';
import {
  ALL_CATEGORIES,
  CATEGORY_GROUPS,
  COMPETITION_TEAM_PRESETS,
  DifficultySetting,
  QuestionGroup,
} from '../shared/types';

interface TeamCompetitionSetupViewProps {
  onCreated: (code: string, presenterToken: string) => void;
  onCancel: () => void;
}

export function TeamCompetitionSetupView({
  onCreated,
  onCancel,
}: TeamCompetitionSetupViewProps) {
  const [title, setTitle] = useState('Competencia Bíblica por Equipos');
  const [customCode, setCustomCode] = useState('');
  const [teamCount, setTeamCount] = useState(2);
  const [teamCapacity, setTeamCapacity] = useState(5);
  const [teamNames, setTeamNames] = useState<string[]>([
    'Equipo Azul',
    'Equipo Rojo',
    'Equipo Verde',
    'Equipo Amarillo',
    ...COMPETITION_TEAM_PRESETS.slice(4).map((t) => t.name),
  ]);
  const [teamColors, setTeamColors] = useState<string[]>([
    '#0EA5E9',
    '#EF4444',
    '#10B981',
    '#F59E0B',
    '#A855F7',
    '#14B8A6',
  ]);

  const [difficulty, setDifficulty] = useState<DifficultySetting>('combinado');
  const [questionCount, setQuestionCount] = useState(25);
  const [timeLimitSec, setTimeLimitSec] = useState(20);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    ...ALL_CATEGORIES,
  ]);
  const [showCategories, setShowCategories] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const toggleGroup = (group: QuestionGroup) => {
    const groupCats = CATEGORY_GROUPS[group];
    const allSelected = groupCats.every((c) => selectedCategories.includes(c));
    if (allSelected) {
      setSelectedCategories((prev) =>
        prev.filter((c) => !groupCats.includes(c))
      );
    } else {
      setSelectedCategories((prev) =>
        Array.from(new Set([...prev, ...groupCats]))
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (selectedCategories.length === 0) {
      setError('Selecciona al menos una categoría bíblica.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || 'Competencia Bíblica por Equipos',
          code: customCode.trim(),
          mode: 'competencia_equipos',
          teamCount,
          teamCapacity,
          teamNames: teamNames.slice(0, teamCount),
          teamColors: teamColors.slice(0, teamCount),
          categories: selectedCategories,
          difficulty,
          questionCount,
          timeLimitSec,
          maxParticipants: teamCount * teamCapacity,
          basePoints: 1000,
          speedBonusMax: 500,
          specialEveryN: 5,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'No se pudo crear la competencia.');
        setSubmitting(false);
        return;
      }
      onCreated(data.code, data.presenterToken);
    } catch {
      setError('Error de conexión con el servidor.');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al inicio
      </button>

      <div className="mb-8 space-y-2">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-300">
          <Shield className="w-4 h-4" />
          Nuevas competencias
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white">
          Configurar Competencia por Equipos
        </h1>
        <p className="text-slate-400 text-sm sm:text-base">
          Define cuántos equipos competirán y el cupo máximo por equipo. Los
          participantes podrán elegir su equipo al entrar o tú podrás
          reorganizarlos en la sala de espera.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Teams Configuration */}
        <section className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              1. Equipos y cupos
            </h2>
            <span className="text-xs font-mono-num text-amber-300 font-semibold">
              Capacidad total de sala: {teamCount * teamCapacity} participantes
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <span className="block text-xs font-medium text-slate-400">
                Cantidad de equipos
              </span>
              <div className="grid grid-cols-5 gap-2">
                {[2, 3, 4, 5, 6].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setTeamCount(cnt)}
                    className={`py-2.5 rounded-xl font-mono-num font-bold text-sm border transition-colors cursor-pointer ${
                      teamCount === cnt
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-[#080E1E] border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {cnt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="team-capacity-input"
                className="block text-xs font-medium text-slate-400"
              >
                Participantes por equipo
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="team-capacity-input"
                  type="number"
                  min={1}
                  max={50}
                  value={teamCapacity}
                  onChange={(e) =>
                    setTeamCapacity(
                      Math.max(1, Math.min(50, Number(e.target.value) || 1))
                    )
                  }
                  className="w-24 bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono-num font-bold text-sm focus:outline-none focus:border-emerald-400"
                />
                <div className="flex flex-wrap gap-1.5">
                  {[2, 3, 5, 10].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTeamCapacity(preset)}
                      className={`px-2.5 py-2 rounded-lg text-xs font-mono-num font-bold cursor-pointer ${
                        teamCapacity === preset
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="block text-xs font-medium text-slate-400">
                Nombres y colores de los equipos (Azul, Rojo, Verde, Amarillo o personalizados)
              </span>
              <button
                type="button"
                onClick={() => {
                  setTeamNames([
                    'Equipo Azul',
                    'Equipo Rojo',
                    'Equipo Verde',
                    'Equipo Amarillo',
                    'Equipo Morado',
                    'Equipo Turquesa',
                  ]);
                  setTeamColors([
                    '#0EA5E9',
                    '#EF4444',
                    '#10B981',
                    '#F59E0B',
                    '#A855F7',
                    '#14B8A6',
                  ]);
                }}
                className="text-xs font-semibold text-sky-400 hover:text-sky-300 cursor-pointer"
              >
                Usar colores clásicos
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {COMPETITION_TEAM_PRESETS.slice(0, teamCount).map((preset, idx) => (
                <div
                  key={preset.id}
                  className="flex items-center gap-2.5 bg-[#080E1E] border border-slate-800 rounded-xl p-2.5"
                >
                  <input
                    type="color"
                    aria-label={`Color del equipo ${idx + 1}`}
                    value={teamColors[idx] ?? preset.color}
                    onChange={(e) => {
                      const next = [...teamColors];
                      next[idx] = e.target.value;
                      setTeamColors(next);
                    }}
                    className="w-7 h-7 rounded-lg bg-transparent border-0 cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    maxLength={32}
                    value={teamNames[idx] ?? preset.name}
                    onChange={(e) => {
                      const next = [...teamNames];
                      next[idx] = e.target.value;
                      setTeamNames(next);
                    }}
                    className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-white focus:outline-none"
                  />
                  <span className="text-[11px] font-mono-num text-slate-400 shrink-0">
                    Máx {teamCapacity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Room Settings */}
        <section className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-5">
          <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-sky-400" />
            2. Detalles y reglas del concurso
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="team-comp-title"
                className="block text-xs font-medium text-slate-400 mb-1.5"
              >
                Nombre del concurso
              </label>
              <input
                id="team-comp-title"
                type="text"
                maxLength={80}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-sky-400"
              />
            </div>

            <div>
              <label
                htmlFor="team-comp-code"
                className="block text-xs font-medium text-slate-400 mb-1.5"
              >
                Código de sala (opcional)
              </label>
              <input
                id="team-comp-code"
                type="text"
                maxLength={14}
                value={customCode}
                onChange={(e) =>
                  setCustomCode(
                    e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                  )
                }
                placeholder="Vacío = código automático"
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-amber-300 font-mono-num font-bold text-sm placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Dificultad
              </label>
              <select
                value={difficulty}
                onChange={(e) =>
                  setDifficulty(e.target.value as DifficultySetting)
                }
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-sky-400"
              >
                <option value="combinado">Combinado (Equilibrado)</option>
                <option value="facil">Fácil</option>
                <option value="intermedio">Intermedio</option>
                <option value="dificil">Difícil</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Cantidad de preguntas
              </label>
              <select
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono-num text-sm focus:outline-none focus:border-sky-400"
              >
                <option value={10}>10 preguntas</option>
                <option value={15}>15 preguntas</option>
                <option value={20}>20 preguntas</option>
                <option value={25}>25 preguntas (Estándar)</option>
                <option value={30}>30 preguntas</option>
                <option value={40}>40 preguntas</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Tiempo por pregunta
              </label>
              <select
                value={timeLimitSec}
                onChange={(e) => setTimeLimitSec(Number(e.target.value))}
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono-num text-sm focus:outline-none focus:border-sky-400"
              >
                <option value={10}>10 segundos</option>
                <option value={15}>15 segundos</option>
                <option value={20}>20 segundos</option>
                <option value={30}>30 segundos</option>
                <option value={45}>45 segundos</option>
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-300 font-medium">
                Categorías bíblicas: {selectedCategories.length}/
                {ALL_CATEGORIES.length}
              </span>
              <button
                type="button"
                onClick={() => setShowCategories((v) => !v)}
                className="text-xs font-semibold text-sky-400 hover:text-sky-300 cursor-pointer"
              >
                {showCategories ? 'Ocultar categorías' : 'Personalizar categorías'}
              </button>
            </div>

            {showCategories && (
              <div className="space-y-4 pt-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCategories([...ALL_CATEGORIES])}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-semibold text-white cursor-pointer"
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCategories([])}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-semibold text-slate-300 cursor-pointer"
                  >
                    Limpiar
                  </button>
                </div>

                {(Object.keys(CATEGORY_GROUPS) as QuestionGroup[]).map(
                  (group) => {
                    const cats = CATEGORY_GROUPS[group];
                    const allChecked = cats.every((c) =>
                      selectedCategories.includes(c)
                    );
                    return (
                      <div key={group} className="space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                          <h3 className="text-xs font-bold text-amber-300">
                            {group}
                          </h3>
                          <button
                            type="button"
                            onClick={() => toggleGroup(group)}
                            className="text-xs text-sky-400 cursor-pointer"
                          >
                            {allChecked ? 'Desmarcar' : 'Marcar grupo'}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {cats.map((cat) => {
                            const active = selectedCategories.includes(cat);
                            return (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => toggleCategory(cat)}
                                className={`px-3 py-2 rounded-xl border text-left text-xs flex items-center justify-between gap-2 cursor-pointer ${
                                  active
                                    ? 'bg-emerald-500/15 border-emerald-500/50 text-white'
                                    : 'bg-[#080E1E] border-slate-800 text-slate-400'
                                }`}
                              >
                                <span className="truncate">{cat}</span>
                                {active && (
                                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </div>
        </section>

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/50 text-rose-200 text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-7 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-base inline-flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Play className="w-5 h-5 fill-current" />
            {submitting ? 'Creando sala...' : 'Crear Competencia por Equipos'}
          </button>
        </div>
      </form>
    </div>
  );
}
