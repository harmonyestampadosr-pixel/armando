import { useState } from 'react';
import { ArrowLeft, Check, Sliders, Swords } from 'lucide-react';
import {
  ALL_CATEGORIES,
  AVATARS,
  CATEGORY_GROUPS,
  DifficultySetting,
  QuestionGroup,
} from '../shared/types';
import { ParticipantIdentityPicker } from './ParticipantIdentityPicker';
import { getOrCreateProfileKey, saveProfileName } from '../utils/profileKey';

interface BattleSetupViewProps {
  onCreated: (
    code: string,
    presenterToken: string,
    participantToken: string,
    participantId: string,
    gameId: string
  ) => void;
  onCancel: () => void;
}

export function BattleSetupView({ onCreated, onCancel }: BattleSetupViewProps) {
  const [title, setTitle] = useState('Batalla Bíblica 1 contra 1');
  const [customCode, setCustomCode] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [identityMode, setIdentityMode] = useState<'avatar' | 'photo'>('avatar');
  const [avatarId, setAvatarId] = useState(AVATARS[0].id);
  const [croppedPhotoDataUrl, setCroppedPhotoDataUrl] = useState<string | null>(
    null
  );

  const [difficulty, setDifficulty] = useState<DifficultySetting>('combinado');
  const [questionCount, setQuestionCount] = useState(15);
  const [timeLimitSec, setTimeLimitSec] = useState(20);
  const [speedBonusMax, setSpeedBonusMax] = useState(500);
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

    if (creatorName.trim().length < 2) {
      setError('Escribe tu nombre (mínimo 2 caracteres) para iniciar la batalla.');
      return;
    }
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
          title: title.trim() || 'Batalla Bíblica 1 contra 1',
          code: customCode.trim(),
          mode: 'batalla_1v1',
          categories: selectedCategories,
          difficulty,
          questionCount,
          timeLimitSec,
          maxParticipants: 2,
          basePoints: 1000,
          speedBonusMax,
          specialEveryN: 5,
          creatorParticipant: {
            name: creatorName.trim(),
            avatarId,
            photoDataUrl:
              identityMode === 'photo' && croppedPhotoDataUrl
                ? croppedPhotoDataUrl
                : undefined,
            profileKey: getOrCreateProfileKey(),
          },
        }),
      });
      saveProfileName(creatorName.trim());
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'No se pudo crear la batalla.');
        setSubmitting(false);
        return;
      }

      onCreated(
        data.code,
        data.presenterToken,
        data.participantToken,
        data.participantId,
        data.gameId
      );
    } catch {
      setError('Error de conexión al crear la batalla.');
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
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
          <Swords className="w-4 h-4" />
          Nuevas competencias
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white">
          Crear Batalla 1 contra 1
        </h1>
        <p className="text-slate-400 text-sm sm:text-base">
          Tú serás el primer participante. Se generará un código exclusivo y un
          código QR para invitar a tu oponente sin necesidad de registro.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Participant 1 Identity */}
        <section className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-white">
            1. Tu perfil de competidor (Participante 1)
          </h2>
          <ParticipantIdentityPicker
            name={creatorName}
            onNameChange={setCreatorName}
            avatarId={avatarId}
            onAvatarIdChange={setAvatarId}
            identityMode={identityMode}
            onIdentityModeChange={setIdentityMode}
            croppedPhotoDataUrl={croppedPhotoDataUrl}
            onPhotoChange={setCroppedPhotoDataUrl}
            nameLabel="Tu nombre para la batalla"
          />
        </section>

        {/* Battle Settings */}
        <section className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-5">
          <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-sky-400" />
            2. Configuración del duelo
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="battle-title"
                className="block text-xs font-medium text-slate-400 mb-1.5"
              >
                Nombre de la batalla
              </label>
              <input
                id="battle-title"
                type="text"
                maxLength={80}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label
                htmlFor="battle-code"
                className="block text-xs font-medium text-slate-400 mb-1.5"
              >
                Código personalizado (opcional)
              </label>
              <input
                id="battle-code"
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
                <option value={5}>5 preguntas (Rápida)</option>
                <option value={10}>10 preguntas</option>
                <option value={15}>15 preguntas</option>
                <option value={20}>20 preguntas</option>
                <option value={25}>25 preguntas (Estándar)</option>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Bonificación por rapidez
              </label>
              <select
                value={speedBonusMax}
                onChange={(e) => setSpeedBonusMax(Number(e.target.value))}
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-amber-400"
              >
                <option value={0}>Sin bono (solo puntos por acierto)</option>
                <option value={500}>Bono estándar (hasta +500 pts)</option>
                <option value={1000}>Bono alto velocidad (hasta +1.000 pts)</option>
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-300 font-medium">
                Categorías bíblicas seleccionadas: {selectedCategories.length}/
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
            className="px-7 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-base inline-flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Swords className="w-5 h-5" />
            {submitting ? 'Creando batalla...' : 'Crear Batalla 1 contra 1'}
          </button>
        </div>
      </form>
    </div>
  );
}
