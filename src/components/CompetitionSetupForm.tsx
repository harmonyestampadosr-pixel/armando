import { useState } from 'react';
import { BookOpen, LogIn, Play, Shield, User, Users } from 'lucide-react';
import { STUDY_TOPICS } from '../shared/biblicalModulesData';
import {
  DIFFICULTY_LABELS,
  DifficultySetting,
  GameMode,
} from '../shared/types';

const DEFAULT_TEAM_NAMES = [
  'Leones de Judá',
  'Águilas de Sion',
  'Olivos de Paz',
  'Estrellas de Belén',
  'Valientes de Gedeón',
  'Testigos de Fe',
];

const DEFAULT_TEAM_COLORS = [
  '#F59E0B',
  '#0EA5E9',
  '#10B981',
  '#EC4899',
  '#8B5CF6',
  '#F97316',
];

export interface CompetitionSetupFormProps {
  mode: GameMode;
  defaultTitle: string;
  description?: string;
  countLabel?: string;
  countOptions?: number[];
  defaultCount?: number;
  timeOptions?: Array<{ value: number; label: string }>;
  defaultTimeSec?: number;
  defaultDifficulty?: DifficultySetting;
  showLearningOptions?: boolean;
  onCreated: (code: string, presenterToken: string) => void;
  onJoinCode?: (code: string) => void;
}

const DEFAULT_TIME_OPTIONS = [
  { value: 20, label: '20 segundos' },
  { value: 30, label: '30 segundos' },
  { value: 45, label: '45 segundos' },
  { value: 60, label: '60 segundos' },
];

export function CompetitionSetupForm({
  mode,
  defaultTitle,
  description,
  countLabel = 'Cantidad de desafíos',
  countOptions = [5, 8, 12],
  defaultCount = 8,
  timeOptions = DEFAULT_TIME_OPTIONS,
  defaultTimeSec = 30,
  defaultDifficulty = 'combinado',
  showLearningOptions = false,
  onCreated,
  onJoinCode,
}: CompetitionSetupFormProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [teamMode, setTeamMode] = useState(false);
  const [teamCount, setTeamCount] = useState(2);
  const [teamCapacity, setTeamCapacity] = useState(8);
  const [teamNames, setTeamNames] = useState<string[]>(() =>
    DEFAULT_TEAM_NAMES.slice(0, 6)
  );
  const [difficulty, setDifficulty] =
    useState<DifficultySetting>(defaultDifficulty);
  const [questionCount, setQuestionCount] = useState(defaultCount);
  const [timeLimitSec, setTimeLimitSec] = useState(defaultTimeSec);
  const [maxParticipants, setMaxParticipants] = useState(150);

  // Learning specific options
  const [studyTopicId, setStudyTopicId] = useState<string>('all');
  const [explanationTiming, setExplanationTiming] = useState<
    'after_each' | 'end_of_round'
  >('after_each');

  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const customTeams = teamMode
        ? Array.from({ length: teamCount }).map((_, idx) => ({
            id: `equipo_${idx + 1}`,
            name:
              teamNames[idx]?.trim() ||
              DEFAULT_TEAM_NAMES[idx] ||
              `Equipo ${idx + 1}`,
            color:
              DEFAULT_TEAM_COLORS[idx % DEFAULT_TEAM_COLORS.length],
            capacity: teamCapacity,
          }))
        : undefined;

      const effectiveMaxParticipants = teamMode
        ? Math.max(maxParticipants, teamCount * teamCapacity)
        : maxParticipants;

      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || defaultTitle,
          mode,
          teamMode,
          teamCount: teamMode ? teamCount : undefined,
          teamCapacity: teamMode ? teamCapacity : undefined,
          teams: customTeams,
          difficulty,
          questionCount,
          timeLimitSec,
          maxParticipants: effectiveMaxParticipants,
          basePoints: 1000,
          speedBonusMax: showLearningOptions ? 300 : 500,
          specialEveryN: 0,
          ...(showLearningOptions
            ? {
                studyTopicId,
                explanationTiming,
              }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'No se pudo crear la sala de competencia.');
        setCreating(false);
        return;
      }
      onCreated(data.code, data.presenterToken);
    } catch {
      setError('Error de conexión al crear la competencia.');
      setCreating(false);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <form
        onSubmit={handleSubmit}
        className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 sm:p-7 space-y-5"
      >
        <div className="space-y-1">
          <h2 className="font-display text-xl font-bold text-white">
            Crear Competencia Multijugador con QR
          </h2>
          <p className="text-sm text-slate-400">
            {description ||
              'Genera una sala con código único y código QR. Los participantes ingresan sin cuenta ni contraseña y compiten en vivo desde sus dispositivos.'}
          </p>
        </div>

        {/* Competition Format: Individual vs Por Equipos */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Modalidad de competencia
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setTeamMode(false)}
              className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition-colors cursor-pointer ${
                !teamMode
                  ? 'bg-sky-500/15 border-sky-400 text-white'
                  : 'bg-[#080E1E] border-slate-800 text-slate-300 hover:border-slate-600'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  !teamMode
                    ? 'bg-sky-400 text-slate-950'
                    : 'bg-slate-800 text-sky-300'
                }`}
              >
                <User className="w-4 h-4" />
              </div>
              <div>
                <p className="font-display font-bold text-sm">Individual</p>
                <p className="text-xs text-slate-400">
                  Cada participante suma su propio puntaje
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTeamMode(true)}
              className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition-colors cursor-pointer ${
                teamMode
                  ? 'bg-emerald-500/15 border-emerald-400 text-white'
                  : 'bg-[#080E1E] border-slate-800 text-slate-300 hover:border-slate-600'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  teamMode
                    ? 'bg-emerald-400 text-slate-950'
                    : 'bg-slate-800 text-emerald-300'
                }`}
              >
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <p className="font-display font-bold text-sm">Por Equipos</p>
                <p className="text-xs text-slate-400">
                  Participantes agrupados y puntaje grupal
                </p>
              </div>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Nombre de la partida o competencia
          </label>
          <input
            type="text"
            maxLength={80}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400"
          />
        </div>

        {/* Team Configurator when teamMode === true */}
        {teamMode && (
          <div className="bg-[#080E1E] border border-emerald-500/35 rounded-xl p-4 space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Número de equipos
                </label>
                <select
                  value={teamCount}
                  onChange={(e) => setTeamCount(Number(e.target.value))}
                  className="w-full bg-[#111A2E] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm"
                >
                  {[2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n} equipos
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Cupo máximo por equipo
                </label>
                <select
                  value={teamCapacity}
                  onChange={(e) => setTeamCapacity(Number(e.target.value))}
                  className="w-full bg-[#111A2E] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm"
                >
                  {[3, 5, 8, 12, 20, 30].map((cap) => (
                    <option key={cap} value={cap}>
                      Hasta {cap} integrantes
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Array.from({ length: teamCount }).map((_, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{
                      backgroundColor:
                        DEFAULT_TEAM_COLORS[idx % DEFAULT_TEAM_COLORS.length],
                    }}
                  />
                  <input
                    type="text"
                    maxLength={28}
                    value={teamNames[idx] || ''}
                    onChange={(e) => {
                      const next = [...teamNames];
                      next[idx] = e.target.value;
                      setTeamNames(next);
                    }}
                    placeholder={`Equipo ${idx + 1}`}
                    className="flex-1 bg-[#111A2E] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Learning Mode Specific Controls */}
        {showLearningOptions && (
          <div className="bg-[#080E1E] border border-sky-500/35 rounded-xl p-4 space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-300">
              <BookOpen className="w-4 h-4" />
              Opciones de Estudio en Competencia
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Área o tema bíblico
                </label>
                <select
                  value={studyTopicId}
                  onChange={(e) => setStudyTopicId(e.target.value)}
                  className="w-full bg-[#111A2E] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm"
                >
                  <option value="all">Todos los temas bíblicos</option>
                  {STUDY_TOPICS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Momento de la explicación bíblica
                </label>
                <select
                  value={explanationTiming}
                  onChange={(e) =>
                    setExplanationTiming(
                      e.target.value as 'after_each' | 'end_of_round'
                    )
                  }
                  className="w-full bg-[#111A2E] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm"
                >
                  <option value="after_each">
                    Después de cada pregunta
                  </option>
                  <option value="end_of_round">
                    Al finalizar toda la ronda
                  </option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Core Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              {countLabel}
            </label>
            <select
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm"
            >
              {countOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Tiempo por desafío
            </label>
            <select
              value={timeLimitSec}
              onChange={(e) => setTimeLimitSec(Number(e.target.value))}
              className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm"
            >
              {timeOptions.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Nivel de dificultad
            </label>
            <select
              value={difficulty}
              onChange={(e) =>
                setDifficulty(e.target.value as DifficultySetting)
              }
              className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm"
            >
              {(
                [
                  ['combinado', 'Combinado (Todos los niveles)'],
                  ['facil', DIFFICULTY_LABELS.facil],
                  ['intermedio', DIFFICULTY_LABELS.intermedio],
                  ['dificil', DIFFICULTY_LABELS.dificil],
                ] as const
              ).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {!teamMode && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Límite de participantes
              </label>
              <select
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(Number(e.target.value))}
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm"
              >
                <option value={30}>Hasta 30 participantes</option>
                <option value={80}>Hasta 80 participantes</option>
                <option value={150}>Hasta 150 participantes</option>
                <option value={300}>Hasta 300 participantes</option>
              </select>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/50 text-rose-200 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={creating}
          className="w-full py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-base inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <Play className="w-5 h-5 fill-current" />
          {creating
            ? 'Creando sala...'
            : 'Crear Sala, Código y QR de Invitación'}
        </button>
      </form>

      {/* Quick Join by Code */}
      {onJoinCode && (
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" />
              ¿Ya te compartieron un código de sala?
            </p>
            <p className="text-xs text-slate-400">
              Únete directamente como invitado con tu nombre y avatar.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={joinCodeInput}
              onChange={(e) =>
                setJoinCodeInput(
                  e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                )
              }
              placeholder="CÓDIGO"
              className="w-32 bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-mono-num font-bold text-sm tracking-wider"
            />
            <button
              type="button"
              disabled={!joinCodeInput.trim()}
              onClick={() => onJoinCode(joinCodeInput.trim())}
              className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-45"
            >
              <LogIn className="w-3.5 h-3.5" />
              Unirme
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
