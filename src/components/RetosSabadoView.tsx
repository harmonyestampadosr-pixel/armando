import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  Heart,
  History,
  Library,
  LogIn,
  Pause,
  Play,
  Plus,
  QrCode,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';
import {
  PARTICIPATION_MODE_META,
  SATURDAY_CHALLENGE_CATEGORIES,
  SATURDAY_CHALLENGE_SUBTYPES,
  type SaturdayChallengeCategory,
  type SaturdayChallengeEvaluationType,
  type SaturdayChallengeHistoryEntry,
  type SaturdayChallengeItem,
  type SaturdayChallengeSubType,
  type SaturdayParticipationMode,
} from '../shared/saturdayChallengesData';
import { COMPETITION_TEAM_PRESETS } from '../shared/types';
import { soundFX } from '../utils/sound';

interface RetosSabadoViewProps {
  onBack: () => void;
  onCreatedMultiplayerRoom: (code: string, presenterToken: string) => void;
  onJoinCode: (code: string) => void;
}

type SabadoSubTab = 'competencia' | 'sorpresa' | 'biblioteca' | 'historial';

const ALL_MODES: SaturdayParticipationMode[] = [
  'individual',
  'parejas',
  'equipos',
  'competencia_general',
];

export function RetosSabadoView({
  onBack,
  onCreatedMultiplayerRoom,
  onJoinCode,
}: RetosSabadoViewProps) {
  const [tab, setTab] = useState<SabadoSubTab>('sorpresa');
  const [challenges, setChallenges] = useState<SaturdayChallengeItem[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [history, setHistory] = useState<SaturdayChallengeHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  // ==================== SURPRISE LIVE STAGE STATE ====================
  const [surpriseCategory, setSurpriseCategory] = useState<string>('all');
  const [surpriseMode, setSurpriseMode] =
    useState<SaturdayParticipationMode>('equipos');
  const [surpriseFavOnly, setSurpriseFavOnly] = useState(false);
  const [currentSurprise, setCurrentSurprise] =
    useState<SaturdayChallengeItem | null>(null);
  const [surpriseLoading, setSurpriseLoading] = useState(false);
  const [showSurpriseGuide, setShowSurpriseGuide] = useState(false);
  const [stageSecLeft, setStageSecLeft] = useState(60);
  const [stageRunning, setStageRunning] = useState(false);
  const stageTimerRef = useRef<number | null>(null);

  // Stage quick history log form
  const [logWinnerName, setLogWinnerName] = useState('');
  const [logWinnerScore, setLogWinnerScore] = useState(1000);
  const [logParticipantsCount, setLogParticipantsCount] = useState(12);
  const [logSummary, setLogSummary] = useState('');
  const [logNote, setLogNote] = useState('');
  const [savingHistory, setSavingHistory] = useState(false);

  // ==================== MULTIPLAYER QR ROOM STATE ====================
  const [roomTitle, setRoomTitle] = useState(
    'Retos del Sábado - Sociedad de Jóvenes'
  );
  const [roomParticipationMode, setRoomParticipationMode] =
    useState<SaturdayParticipationMode>('parejas');
  const [roomCategory, setRoomCategory] = useState<string>('all');
  const [roomFavOnly, setRoomFavOnly] = useState(false);
  const [roomChallengeCount, setRoomChallengeCount] = useState(5);
  const [roomTimeLimitSec, setRoomTimeLimitSec] = useState(60);
  const [teamCount, setTeamCount] = useState(3);
  const [teamCapacity, setTeamCapacity] = useState(5);
  const [customTeamNames, setCustomTeamNames] = useState<string[]>([
    'Leones de Judá',
    'Águilas de Sion',
    'Olivos de Paz',
    'Estrellas de Belén',
    'Guerreros de Gedeón',
    'Valientes de David',
  ]);
  const [pinnedChallengeIds, setPinnedChallengeIds] = useState<string[]>([]);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');

  // ==================== LIBRARY & CUSTOM CREATOR STATE ====================
  const [libSearch, setLibSearch] = useState('');
  const [libCategory, setLibCategory] = useState<string>('all');
  const [libSubType, setLibSubType] = useState<string>('all');
  const [libEvalFilter, setLibEvalFilter] = useState<string>('all');
  const [libFavOnly, setLibFavOnly] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [newCategory, setNewCategory] =
    useState<SaturdayChallengeCategory>('retos_biblicos');
  const [newSubType, setNewSubType] = useState<SaturdayChallengeSubType>(
    'encuentra_versiculo'
  );
  const [newTitle, setNewTitle] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [newInstructions, setNewInstructions] = useState('');
  const [newReference, setNewReference] = useState('');
  const [newSuggestedSec, setNewSuggestedSec] = useState(60);
  const [newEvalType, setNewEvalType] =
    useState<SaturdayChallengeEvaluationType>('director_review');
  const [newGuideAnswer, setNewGuideAnswer] = useState('');
  const [newOptions, setNewOptions] = useState(['', '', '', '']);
  const [newCorrectIndex, setNewCorrectIndex] = useState(0);
  const [savingCustom, setSavingCustom] = useState(false);

  // ==================== HISTORY SEARCH ====================
  const [historySearch, setHistorySearch] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [libRes, histRes] = await Promise.all([
        fetch('/api/saturday-challenges/library'),
        fetch('/api/saturday-challenges/history'),
      ]);
      const libData = await libRes.json();
      const histData = await histRes.json();
      if (Array.isArray(libData.challenges)) {
        setChallenges(libData.challenges);
      }
      if (Array.isArray(libData.recentIds)) {
        setRecentIds(libData.recentIds);
      }
      if (Array.isArray(histData.history)) {
        setHistory(histData.history);
      }
    } catch {
      setFeedback({
        type: 'err',
        text: 'No se pudo cargar la biblioteca de Retos del Sábado.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Countdown tick for live stage surprise timer
  useEffect(() => {
    if (!stageRunning) {
      if (stageTimerRef.current) {
        window.clearInterval(stageTimerRef.current);
        stageTimerRef.current = null;
      }
      return;
    }
    stageTimerRef.current = window.setInterval(() => {
      setStageSecLeft((prev) => {
        if (prev <= 1) {
          setStageRunning(false);
          soundFX.playProgramStageEnd();
          return 0;
        }
        if (prev === 11) {
          soundFX.playProgramWarningBell();
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (stageTimerRef.current) {
        window.clearInterval(stageTimerRef.current);
        stageTimerRef.current = null;
      }
    };
  }, [stageRunning]);

  // Ensure newSubType always belongs to newCategory
  useEffect(() => {
    const validForCat = SATURDAY_CHALLENGE_SUBTYPES.filter(
      (s) => s.category === newCategory
    );
    if (validForCat.length > 0 && !validForCat.some((s) => s.id === newSubType)) {
      setNewSubType(validForCat[0].id);
    }
  }, [newCategory, newSubType]);

  const handlePickSurprise = async () => {
    setSurpriseLoading(true);
    setFeedback(null);
    setStageRunning(false);
    setShowSurpriseGuide(false);
    try {
      const res = await fetch('/api/saturday-challenges/surprise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count: 1,
          category: surpriseCategory,
          favoritesOnly: surpriseFavOnly,
          participationMode: surpriseMode,
          excludeIds: currentSurprise ? [currentSurprise.id] : [],
        }),
      });
      const data = await res.json();
      if (data.challenge) {
        setCurrentSurprise(data.challenge);
        setStageSecLeft(data.challenge.suggestedSec || 60);
        soundFX.playCategorySelect();
        loadData();
      } else {
        setFeedback({
          type: 'err',
          text: 'No se encontraron retos disponibles con esos filtros.',
        });
      }
    } catch {
      setFeedback({
        type: 'err',
        text: 'Error eligiendo un reto sorpresa.',
      });
    } finally {
      setSurpriseLoading(false);
    }
  };

  const handleToggleFavorite = async (id: string) => {
    try {
      const res = await fetch(
        `/api/saturday-challenges/favorites/${encodeURIComponent(id)}`,
        { method: 'POST' }
      );
      const data = await res.json();
      if (res.ok) {
        setChallenges((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, isFavorite: Boolean(data.isFavorite) } : c
          )
        );
        if (currentSurprise?.id === id) {
          setCurrentSurprise((prev) =>
            prev ? { ...prev, isFavorite: Boolean(data.isFavorite) } : prev
          );
        }
      }
    } catch {
      // ignore
    }
  };

  const handleSaveStageHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSurprise) return;
    setSavingHistory(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/saturday-challenges/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: currentSurprise.id,
          challengeTitle: currentSurprise.title,
          category: currentSurprise.category,
          subTypeLabel: currentSurprise.subTypeLabel,
          participationMode: surpriseMode,
          participantCount: logParticipantsCount,
          winnerName: logWinnerName.trim() || 'Grupo Juvenil',
          winnerScore: logWinnerScore,
          resultSummary:
            logSummary.trim() ||
            `Reto sorpresa "${currentSurprise.title}" realizado en vivo (${PARTICIPATION_MODE_META[surpriseMode].label}).`,
          directorNote: logNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.entry) {
        setHistory((prev) => [data.entry, ...prev]);
        setLogWinnerName('');
        setLogSummary('');
        setLogNote('');
        setFeedback({
          type: 'ok',
          text: 'Reto registrado en el Historial de Retos del Sábado.',
        });
      }
    } catch {
      setFeedback({
        type: 'err',
        text: 'No se pudo guardar en el historial.',
      });
    } finally {
      setSavingHistory(false);
    }
  };

  const handleCreateMultiplayerRoom = async () => {
    setCreatingRoom(true);
    setFeedback(null);
    try {
      const isTeamMode =
        roomParticipationMode === 'parejas' ||
        roomParticipationMode === 'equipos';

      const namesForRoom =
        roomParticipationMode === 'parejas'
          ? Array.from({ length: teamCount }, (_, i) => `Pareja ${i + 1}`)
          : customTeamNames.slice(0, teamCount);

      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:
            roomTitle.trim() || 'Retos del Sábado - Sociedad de Jóvenes',
          mode: 'retos_sabado',
          participationMode: roomParticipationMode,
          challengeCategory: roomCategory,
          favoritesOnly: roomFavOnly,
          selectedChallengeIds: pinnedChallengeIds,
          questionCount: roomChallengeCount,
          timeLimitSec: roomTimeLimitSec,
          basePoints: 1000,
          speedBonusMax: 400,
          specialEveryN: 0,
          ...(isTeamMode
            ? {
                teamMode: true,
                teamCount,
                teamCapacity:
                  roomParticipationMode === 'parejas' ? 2 : teamCapacity,
                teamNames: namesForRoom,
                teamColors: COMPETITION_TEAM_PRESETS.slice(0, teamCount).map(
                  (t) => t.color
                ),
              }
            : { maxParticipants: 150 }),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          type: 'err',
          text: data.error || 'No se pudo crear la sala de retos.',
        });
        return;
      }
      onCreatedMultiplayerRoom(data.code, data.presenterToken);
    } catch {
      setFeedback({
        type: 'err',
        text: 'Error de conexión al crear la sala de retos.',
      });
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleSaveCustomChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCustom(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/saturday-challenges/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: newCategory,
          subType: newSubType,
          title: newTitle.trim(),
          prompt: newPrompt.trim(),
          instructions: newInstructions.trim(),
          reference: newReference.trim(),
          suggestedSec: newSuggestedSec,
          evaluationType: newEvalType,
          guideAnswer: newGuideAnswer.trim(),
          ...(newEvalType === 'auto_choice'
            ? { options: newOptions, correctIndex: newCorrectIndex }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          type: 'err',
          text: data.error || 'No se pudo guardar el reto personalizado.',
        });
        return;
      }
      setChallenges((prev) => [data.challenge, ...prev]);
      setNewTitle('');
      setNewPrompt('');
      setNewInstructions('');
      setNewReference('');
      setNewGuideAnswer('');
      setNewOptions(['', '', '', '']);
      setShowCustomForm(false);
      setFeedback({
        type: 'ok',
        text: `Reto personalizado "${data.challenge.title}" agregado a la biblioteca.`,
      });
    } catch {
      setFeedback({
        type: 'err',
        text: 'Error guardando reto personalizado.',
      });
    } finally {
      setSavingCustom(false);
    }
  };

  const handleDeleteCustom = async (id: string) => {
    try {
      const res = await fetch(
        `/api/saturday-challenges/custom/${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        setChallenges((prev) => prev.filter((c) => c.id !== id));
        setPinnedChallengeIds((prev) => prev.filter((pid) => pid !== id));
        setConfirmDeleteId(null);
        setFeedback({
          type: 'ok',
          text: 'Reto personalizado eliminado.',
        });
      }
    } catch {
      setFeedback({
        type: 'err',
        text: 'No se pudo eliminar el reto personalizado.',
      });
    }
  };

  const availableSubTypes = useMemo(() => {
    if (libCategory === 'all') return SATURDAY_CHALLENGE_SUBTYPES;
    return SATURDAY_CHALLENGE_SUBTYPES.filter((s) => s.category === libCategory);
  }, [libCategory]);

  const filteredLibrary = useMemo(() => {
    const q = libSearch.trim().toLowerCase();
    return challenges.filter((c) => {
      if (libCategory !== 'all' && c.category !== libCategory) return false;
      if (libSubType !== 'all' && c.subType !== libSubType) return false;
      if (libEvalFilter !== 'all' && c.evaluationType !== libEvalFilter) {
        return false;
      }
      if (libFavOnly && !c.isFavorite) return false;
      if (
        q &&
        !c.title.toLowerCase().includes(q) &&
        !c.prompt.toLowerCase().includes(q) &&
        !c.subTypeLabel.toLowerCase().includes(q) &&
        !c.reference.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [challenges, libCategory, libSubType, libEvalFilter, libFavOnly, libSearch]);

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return history;
    return history.filter(
      (h) =>
        h.challengeTitle.toLowerCase().includes(q) ||
        h.winnerName.toLowerCase().includes(q) ||
        h.subTypeLabel.toLowerCase().includes(q) ||
        h.resultSummary.toLowerCase().includes(q) ||
        (h.roomCode || '').toLowerCase().includes(q)
    );
  }, [history, historySearch]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              RETOS DEL SÁBADO
            </h1>
            <span className="px-2.5 py-1 rounded-lg bg-violet-500/15 border border-violet-400/40 text-violet-300 text-xs font-bold">
              {challenges.length} retos disponibles
            </span>
          </div>
          <p className="text-sm text-slate-400">
            Dinámicas juveniles sorpresas: retos bíblicos, representación, creatividad e integración en modo individual, parejas, equipos o competencia general.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setTab('sorpresa');
            handlePickSurprise();
          }}
          disabled={surpriseLoading}
          className="px-5 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0 disabled:opacity-60"
        >
          <Sparkles className="w-5 h-5" />
          Elegir reto sorpresa
        </button>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {(
          [
            { id: 'sorpresa', label: 'Reto Sorpresa en Vivo', icon: Sparkles },
            { id: 'competencia', label: 'Competencia en Vivo con QR', icon: QrCode },
            {
              id: 'biblioteca',
              label: `Biblioteca (${challenges.length})`,
              icon: Library,
            },
            {
              id: 'historial',
              label: `Historial (${history.length})`,
              icon: History,
            },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors cursor-pointer ${
                active
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-[#111A2E] text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {feedback && (
        <div
          className={`rounded-xl p-4 border text-sm font-medium ${
            feedback.type === 'ok'
              ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200'
              : 'bg-rose-500/15 border-rose-500/50 text-rose-200'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* ==================== TAB 1: RETO SORPRESA EN VIVO ==================== */}
      {tab === 'sorpresa' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Surprise Generator Controls */}
          <div className="lg:col-span-4 bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-5">
            <h2 className="font-display font-bold text-lg text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Configurar Ruleta Sorpresa
            </h2>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Categoría del reto
              </label>
              <select
                value={surpriseCategory}
                onChange={(e) => setSurpriseCategory(e.target.value)}
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              >
                <option value="all">Todas las categorías (Aleatorio total)</option>
                {Object.values(SATURDAY_CHALLENGE_CATEGORIES).map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Modo de participación
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSurpriseMode(m)}
                    className={`px-3 py-2 rounded-xl border text-xs font-bold text-left cursor-pointer transition-colors ${
                      surpriseMode === m
                        ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                        : 'bg-[#080E1E] border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {PARTICIPATION_MODE_META[m].label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={surpriseFavOnly}
                onChange={(e) => setSurpriseFavOnly(e.target.checked)}
                className="accent-amber-400 w-4 h-4"
              />
              Solo entre mis retos favoritos
            </label>

            <button
              type="button"
              onClick={handlePickSurprise}
              disabled={surpriseLoading}
              className="w-full py-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-base inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Sparkles className="w-5 h-5" />
              {currentSurprise ? 'Elegir otro reto sorpresa' : 'Elegir reto sorpresa'}
            </button>

            <p className="text-xs text-slate-400">
              Sistema inteligente anti-repetición: evita repetir los últimos {recentIds.length} retos realizados recientemente.
            </p>
          </div>

          {/* Right: Active Surprise Stage & Timer */}
          <div className="lg:col-span-8 space-y-5">
            {!currentSurprise ? (
              <div className="bg-[#111A2E] border border-dashed border-slate-700 rounded-2xl p-12 text-center space-y-4">
                <Sparkles className="w-12 h-12 text-amber-400 mx-auto" />
                <h3 className="font-display text-2xl font-extrabold text-white">
                  ¡Sorprende a la Sociedad de Jóvenes!
                </h3>
                <p className="text-sm text-slate-300 max-w-lg mx-auto">
                  Pulsa el botón <strong>“Elegir reto sorpresa”</strong> para sortear una dinámica bíblica, de actuación, creatividad o integración sin repetir los retos recientes.
                </p>
                <button
                  type="button"
                  onClick={handlePickSurprise}
                  className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-sm inline-flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  Elegir reto sorpresa ahora
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="bg-[#111A2E] border border-amber-400/45 rounded-2xl p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-xl border text-xs font-bold ${
                          SATURDAY_CHALLENGE_CATEGORIES[currentSurprise.category]
                            .badgeClass
                        }`}
                      >
                        {
                          SATURDAY_CHALLENGE_CATEGORIES[currentSurprise.category]
                            .label
                        }
                      </span>
                      <span className="px-3 py-1 rounded-xl bg-[#080E1E] border border-slate-700 text-xs font-semibold text-sky-300">
                        {currentSurprise.subTypeLabel}
                      </span>
                      <span className="px-3 py-1 rounded-xl bg-[#080E1E] border border-slate-700 text-xs font-semibold text-emerald-300">
                        Modo: {PARTICIPATION_MODE_META[surpriseMode].label}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleFavorite(currentSurprise.id)}
                      className={`p-2 rounded-xl border cursor-pointer transition-colors ${
                        currentSurprise.isFavorite
                          ? 'bg-rose-500/20 border-rose-400 text-rose-300'
                          : 'bg-[#080E1E] border-slate-700 text-slate-400 hover:text-white'
                      }`}
                      title="Marcar como favorito"
                    >
                      <Heart
                        className={`w-4 h-4 ${
                          currentSurprise.isFavorite ? 'fill-current' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Stage Timer Bar */}
                  <div className="bg-[#080E1E] border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Clock
                        className={`w-6 h-6 ${
                          stageSecLeft <= 10 ? 'text-rose-400' : 'text-amber-400'
                        }`}
                      />
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                          Cronómetro en Escenario
                        </p>
                        <p
                          className={`font-mono-num text-3xl font-extrabold ${
                            stageSecLeft <= 10 ? 'text-rose-400' : 'text-white'
                          }`}
                        >
                          {formatTimer(stageSecLeft)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setStageRunning((r) => !r)}
                        className={`px-4 py-2.5 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer ${
                          stageRunning
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-emerald-500 text-slate-950'
                        }`}
                      >
                        {stageRunning ? (
                          <>
                            <Pause className="w-4 h-4" /> Pausar
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 fill-current" /> Iniciar tiempo
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setStageRunning(false);
                          setStageSecLeft(currentSurprise.suggestedSec || 60);
                        }}
                        className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reiniciar
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                      {currentSurprise.title}
                    </h3>
                    <p className="text-base sm:text-lg text-slate-100 leading-relaxed">
                      {currentSurprise.prompt}
                    </p>
                    <div className="bg-[#080E1E] border border-slate-800 rounded-xl p-4 text-sm text-sky-200">
                      <strong className="text-sky-300">Cómo realizarlo:</strong>{' '}
                      {currentSurprise.instructions}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <span className="text-xs font-bold text-amber-300 inline-flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4" />
                        Base bíblica: {currentSurprise.reference}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowSurpriseGuide((v) => !v)}
                        className="text-xs font-semibold text-sky-400 hover:text-sky-300 cursor-pointer"
                      >
                        {showSurpriseGuide
                          ? 'Ocultar guía / respuesta'
                          : 'Ver guía / respuesta del director'}
                      </button>
                    </div>
                    {showSurpriseGuide && (
                      <div className="bg-emerald-500/10 border border-emerald-500/35 rounded-xl p-4 space-y-2 text-sm text-emerald-100">
                        {currentSurprise.options &&
                          typeof currentSurprise.correctIndex === 'number' && (
                            <p className="font-bold text-emerald-300">
                              Respuesta correcta:{' '}
                              {
                                currentSurprise.options[
                                  currentSurprise.correctIndex
                                ]
                              }
                            </p>
                          )}
                        {currentSurprise.guideAnswer && (
                          <p>{currentSurprise.guideAnswer}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Shortcut to launch this exact challenge inside a QR multiplayer room */}
                  <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-slate-400">
                      ¿Quieres que los jóvenes participen desde su celular con código QR y puntaje en vivo?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setPinnedChallengeIds([currentSurprise.id]);
                        setRoomParticipationMode(surpriseMode);
                        setTab('competencia');
                      }}
                      className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <QrCode className="w-4 h-4" />
                      Competir con este reto en sala QR
                    </button>
                  </div>
                </div>

                {/* Quick Log Stage Result into History */}
                <form
                  onSubmit={handleSaveStageHistory}
                  className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-4"
                >
                  <h4 className="font-display font-bold text-base text-white flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    Registrar Resultado en Historial
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">
                        Ganador / Pareja / Equipo
                      </label>
                      <input
                        type="text"
                        value={logWinnerName}
                        onChange={(e) => setLogWinnerName(e.target.value)}
                        placeholder="Ej. Pareja Daniel y Sara"
                        className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">
                        Puntaje otorgado
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={50}
                        value={logWinnerScore}
                        onChange={(e) =>
                          setLogWinnerScore(Number(e.target.value) || 0)
                        }
                        className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono-num"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">
                        Jóvenes participantes
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={logParticipantsCount}
                        onChange={(e) =>
                          setLogParticipantsCount(Number(e.target.value) || 1)
                        }
                        className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono-num"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={logSummary}
                      onChange={(e) => setLogSummary(e.target.value)}
                      placeholder="Resumen breve del resultado (opcional)"
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                    />
                    <input
                      type="text"
                      value={logNote}
                      onChange={(e) => setLogNote(e.target.value)}
                      placeholder="Nota del director (opcional)"
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingHistory}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Guardar en Historial de Retos
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB 2: COMPETENCIA EN VIVO CON QR ==================== */}
      {tab === 'competencia' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="space-y-1">
              <h2 className="font-display text-2xl font-extrabold text-white">
                Crear Competencia de Retos del Sábado con QR
              </h2>
              <p className="text-sm text-slate-400">
                Reutiliza la sala en vivo, avatares y fotografías personales, códigos QR de invitado sin registro, temporizador sincronizado y validación humana del director.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Nombre de la sesión
              </label>
              <input
                type="text"
                value={roomTitle}
                onChange={(e) => setRoomTitle(e.target.value)}
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* 4 Participation Modes */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Modo de participación
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ALL_MODES.map((m) => {
                  const meta = PARTICIPATION_MODE_META[m];
                  const active = roomParticipationMode === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setRoomParticipationMode(m)}
                      className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                        active
                          ? 'bg-amber-400/15 border-amber-400 text-white'
                          : 'bg-[#080E1E] border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <p className="font-display font-bold text-base text-white">
                        {meta.label}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">{meta.shortDesc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pair / Team Setup */}
            {(roomParticipationMode === 'parejas' ||
              roomParticipationMode === 'equipos') && (
              <div className="bg-[#080E1E] border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display font-bold text-sm text-amber-300">
                      {roomParticipationMode === 'parejas'
                        ? 'Configuración de Parejas (máx. 2 jóvenes por pareja)'
                        : 'Configuración de Equipos'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Al escanear el QR, cada joven elige su {roomParticipationMode === 'parejas' ? 'pareja' : 'equipo'} o el sistema los distribuye.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Cantidad de {roomParticipationMode === 'parejas' ? 'parejas' : 'equipos'}
                    </label>
                    <select
                      value={teamCount}
                      onChange={(e) => setTeamCount(Number(e.target.value))}
                      className="w-full bg-[#111A2E] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                    >
                      {[2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>
                          {n} {roomParticipationMode === 'parejas' ? 'parejas' : 'equipos'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {roomParticipationMode === 'equipos' && (
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">
                        Cupo máximo por equipo
                      </label>
                      <input
                        type="number"
                        min={2}
                        max={30}
                        value={teamCapacity}
                        onChange={(e) =>
                          setTeamCapacity(
                            Math.max(2, Math.min(30, Number(e.target.value) || 5))
                          )
                        }
                        className="w-full bg-[#111A2E] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono-num"
                      />
                    </div>
                  )}
                </div>

                {roomParticipationMode === 'equipos' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {Array.from({ length: teamCount }, (_, i) => (
                      <input
                        key={i}
                        type="text"
                        value={customTeamNames[i] || `Equipo ${i + 1}`}
                        onChange={(e) => {
                          const next = [...customTeamNames];
                          next[i] = e.target.value;
                          setCustomTeamNames(next);
                        }}
                        className="bg-[#111A2E] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                        placeholder={`Nombre equipo ${i + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Filter & Timing Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Categoría de retos
                </label>
                <select
                  value={roomCategory}
                  onChange={(e) => setRoomCategory(e.target.value)}
                  className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
                >
                  <option value="all">Mezcla sorpresa de las 4 categorías</option>
                  {Object.values(SATURDAY_CHALLENGE_CATEGORIES).map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Cantidad de retos
                </label>
                <select
                  value={roomChallengeCount}
                  onChange={(e) => setRoomChallengeCount(Number(e.target.value))}
                  className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
                >
                  {[3, 5, 8, 10, 12].map((n) => (
                    <option key={n} value={n}>
                      {n} retos
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Tiempo por reto
                </label>
                <select
                  value={roomTimeLimitSec}
                  onChange={(e) => setRoomTimeLimitSec(Number(e.target.value))}
                  className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
                >
                  {[30, 45, 60, 90, 120].map((sec) => (
                    <option key={sec} value={sec}>
                      {sec} segundos
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={roomFavOnly}
                  onChange={(e) => setRoomFavOnly(e.target.checked)}
                  className="accent-amber-400 w-4 h-4"
                />
                Priorizar retos marcados como favoritos
              </label>

              {pinnedChallengeIds.length > 0 && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sky-500/15 border border-sky-400/40 text-xs text-sky-200">
                  <span>{pinnedChallengeIds.length} reto(s) seleccionado(s) incluido(s)</span>
                  <button
                    type="button"
                    onClick={() => setPinnedChallengeIds([])}
                    className="text-sky-300 underline cursor-pointer"
                  >
                    Limpiar
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleCreateMultiplayerRoom}
              disabled={creatingRoom}
              className="w-full py-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-base inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <QrCode className="w-5 h-5" />
              {creatingRoom
                ? 'Creando sala de retos en vivo...'
                : 'Crear Sala de Retos del Sábado con QR'}
            </button>
          </div>

          {/* Right: Quick Join + How it works */}
          <div className="lg:col-span-4 space-y-5">
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 className="font-display font-bold text-lg text-white flex items-center gap-2">
                <LogIn className="w-5 h-5 text-sky-400" />
                Unirme con Código
              </h3>
              <p className="text-xs text-slate-400">
                Si ya crearon una sala de Retos del Sábado, ingresa el código como invitado.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const clean = joinCodeInput.trim().toUpperCase();
                  if (clean) onJoinCode(clean);
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={joinCodeInput}
                  onChange={(e) =>
                    setJoinCodeInput(
                      e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                    )
                  }
                  placeholder="Código"
                  className="flex-1 min-w-0 bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono-num font-bold"
                />
                <button
                  type="submit"
                  disabled={!joinCodeInput.trim()}
                  className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs cursor-pointer disabled:opacity-40"
                >
                  Entrar
                </button>
              </form>
            </div>

            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-3 text-xs text-slate-300 leading-relaxed">
              <h4 className="font-display font-bold text-sm text-amber-300 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Cómo funciona en la Sociedad de Jóvenes
              </h4>
              <p>
                • <strong>Retos bíblicos rápidos:</strong> responden desde su celular con opciones y puntaje automático por rapidez.
              </p>
              <p>
                • <strong>Actuación, mímica, lemas e integración:</strong> los jóvenes actúan, dibujan o envían su lema, y el director califica en vivo como <em>Destacado</em>, <em>Aprobado</em> o <em>Participación</em>.
              </p>
              <p>
                • <strong>Botón Sorpresa en vivo:</strong> en cualquier momento el presentador puede cambiar el reto actual por otro reto sorpresa sin repetir.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 3: BIBLIOTECA DE RETOS ==================== */}
      {tab === 'biblioteca' && (
        <div className="space-y-5">
          {/* Controls */}
          <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLibCategory('all');
                    setLibSubType('all');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                    libCategory === 'all'
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-[#080E1E] text-slate-300 border border-slate-800'
                  }`}
                >
                  Todas ({challenges.length})
                </button>
                {Object.values(SATURDAY_CHALLENGE_CATEGORIES).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setLibCategory(cat.id);
                      setLibSubType('all');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                      libCategory === cat.id
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-[#080E1E] text-slate-300 border border-slate-800'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowCustomForm((v) => !v)}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                {showCustomForm ? 'Cerrar formulario' : 'Agregar reto propio'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={libSearch}
                  onChange={(e) => setLibSearch(e.target.value)}
                  placeholder="Buscar título, versículo o consigna..."
                  className="w-full bg-[#080E1E] border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white"
                />
              </div>

              <select
                value={libSubType}
                onChange={(e) => setLibSubType(e.target.value)}
                className="bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="all">Todos los subtipos ({availableSubTypes.length})</option>
                {availableSubTypes.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.label}
                  </option>
                ))}
              </select>

              <select
                value={libEvalFilter}
                onChange={(e) => setLibEvalFilter(e.target.value)}
                className="bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="all">Cualquier evaluación</option>
                <option value="auto_choice">Opción múltiple (automática)</option>
                <option value="director_review">Validación del director</option>
              </select>

              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#080E1E] border border-slate-700 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={libFavOnly}
                  onChange={(e) => setLibFavOnly(e.target.checked)}
                  className="accent-amber-400"
                />
                Mostrar solo favoritos
              </label>
            </div>
          </div>

          {/* Custom Challenge Creator Form */}
          {showCustomForm && (
            <form
              onSubmit={handleSaveCustomChallenge}
              className="bg-[#111A2E] border border-emerald-400/50 rounded-2xl p-6 space-y-4"
            >
              <h3 className="font-display font-bold text-lg text-white">
                Crear Nuevo Reto Personalizado para tu Sociedad de Jóvenes
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Categoría</label>
                  <select
                    value={newCategory}
                    onChange={(e) =>
                      setNewCategory(e.target.value as SaturdayChallengeCategory)
                    }
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                  >
                    {Object.values(SATURDAY_CHALLENGE_CATEGORIES).map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Subtipo</label>
                  <select
                    value={newSubType}
                    onChange={(e) =>
                      setNewSubType(e.target.value as SaturdayChallengeSubType)
                    }
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                  >
                    {SATURDAY_CHALLENGE_SUBTYPES.filter(
                      (s) => s.category === newCategory
                    ).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Evaluación</label>
                  <select
                    value={newEvalType}
                    onChange={(e) =>
                      setNewEvalType(
                        e.target.value as SaturdayChallengeEvaluationType
                      )
                    }
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                  >
                    <option value="director_review">Validación del director</option>
                    <option value="auto_choice">Opción múltiple (A/B/C/D)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Título del reto"
                  className="sm:col-span-2 bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                />
                <input
                  type="text"
                  value={newReference}
                  onChange={(e) => setNewReference(e.target.value)}
                  placeholder="Cita bíblica (ej. Salmos 119:9)"
                  className="bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                />
              </div>

              <textarea
                rows={2}
                required
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
                placeholder="Consigna o pregunta principal que verán los jóvenes..."
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={newInstructions}
                  onChange={(e) => setNewInstructions(e.target.value)}
                  placeholder="Instrucciones breves (opcional)"
                  className="sm:col-span-2 bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                />
                <input
                  type="number"
                  min={15}
                  max={180}
                  value={newSuggestedSec}
                  onChange={(e) =>
                    setNewSuggestedSec(Number(e.target.value) || 60)
                  }
                  placeholder="Segundos sugeridos"
                  className="bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono-num"
                />
              </div>

              {newEvalType === 'auto_choice' && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-300">
                    Opciones (marca cuál es la correcta):
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {newOptions.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="newCorrectIdx"
                          checked={newCorrectIndex === idx}
                          onChange={() => setNewCorrectIndex(idx)}
                          className="accent-emerald-400"
                        />
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const copy = [...newOptions];
                            copy[idx] = e.target.value;
                            setNewOptions(copy);
                          }}
                          placeholder={`Opción ${idx + 1}`}
                          className="flex-1 bg-[#080E1E] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <input
                type="text"
                value={newGuideAnswer}
                onChange={(e) => setNewGuideAnswer(e.target.value)}
                placeholder="Guía o criterio de respuesta para el director (opcional)"
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
              />

              <button
                type="submit"
                disabled={savingCustom}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm cursor-pointer disabled:opacity-60"
              >
                {savingCustom ? 'Guardando...' : 'Guardar Reto Personalizado'}
              </button>
            </form>
          )}

          {/* Library Cards */}
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              Cargando biblioteca de retos...
            </div>
          ) : filteredLibrary.length === 0 ? (
            <div className="py-12 text-center bg-[#111A2E] border border-slate-800 rounded-2xl text-slate-400 text-sm">
              No hay retos que coincidan con los filtros actuales.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredLibrary.map((c) => {
                const cat = SATURDAY_CHALLENGE_CATEGORIES[c.category];
                return (
                  <div
                    key={c.id}
                    className={`bg-[#111A2E] border ${cat.borderClass} rounded-2xl p-5 flex flex-col justify-between gap-4`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span
                            className={`px-2 py-0.5 rounded-md border font-bold ${cat.badgeClass}`}
                          >
                            {cat.label}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-[#080E1E] border border-slate-800 text-sky-300 font-semibold">
                            {c.subTypeLabel}
                          </span>
                          {c.isCustom && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 font-bold">
                              Propio
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleFavorite(c.id)}
                          className={`p-1.5 rounded-lg cursor-pointer ${
                            c.isFavorite
                              ? 'text-rose-400 bg-rose-500/10'
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
                          title="Favorito"
                        >
                          <Heart
                            className={`w-4 h-4 ${
                              c.isFavorite ? 'fill-current' : ''
                            }`}
                          />
                        </button>
                      </div>

                      <h3 className="font-display font-bold text-lg text-white">
                        {c.title}
                      </h3>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {c.prompt}
                      </p>
                      <p className="text-xs text-slate-400">
                        <strong className="text-amber-300">{c.reference}</strong> ·{' '}
                        {c.suggestedSec}s ·{' '}
                        {c.evaluationType === 'auto_choice'
                          ? 'Opción múltiple automática'
                          : 'Validación del director'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentSurprise(c);
                            setStageSecLeft(c.suggestedSec || 60);
                            setStageRunning(false);
                            setShowSurpriseGuide(false);
                            setTab('sorpresa');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#080E1E] hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-amber-300 cursor-pointer"
                        >
                          Usar en Escenario
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPinnedChallengeIds((prev) =>
                              prev.includes(c.id) ? prev : [...prev, c.id]
                            );
                            setTab('competencia');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/35 border border-sky-400/30 text-xs font-semibold text-sky-200 cursor-pointer"
                        >
                          Incluir en Sala QR
                        </button>
                      </div>

                      {c.isCustom && (
                        <div>
                          {confirmDeleteId === c.id ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 rounded bg-slate-800 text-[11px] text-slate-300 cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCustom(c.id)}
                                className="px-2 py-1 rounded bg-rose-600 text-[11px] text-white font-bold cursor-pointer"
                              >
                                Confirmar
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(c.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 cursor-pointer"
                              title="Eliminar reto propio"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 4: HISTORIAL ==================== */}
      {tab === 'historial' && (
        <div className="space-y-4">
          <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display font-bold text-lg text-white">
                Historial de Retos Realizados
              </h2>
              <p className="text-xs text-slate-400">
                Registro de dinámicas ejecutadas en escenario y competencias multijugador con QR.
              </p>
            </div>
            <div className="relative sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Buscar ganador, reto o código..."
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="bg-[#111A2E] border border-dashed border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-sm">
              Aún no hay retos registrados en el historial. ¡Lanza un reto sorpresa o crea una sala con QR para comenzar!
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map((h) => {
                const cat =
                  SATURDAY_CHALLENGE_CATEGORIES[h.category] ||
                  SATURDAY_CHALLENGE_CATEGORIES.retos_biblicos;
                const modeLabel =
                  PARTICIPATION_MODE_META[h.participationMode]?.label ||
                  h.participationMode;
                return (
                  <div
                    key={h.id}
                    className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`px-2.5 py-0.5 rounded-md border font-bold ${cat.badgeClass}`}
                        >
                          {cat.label}
                        </span>
                        <span className="text-sky-300 font-semibold">
                          {h.subTypeLabel}
                        </span>
                        <span className="text-slate-500">·</span>
                        <span className="text-slate-300">{modeLabel}</span>
                        {h.roomCode && (
                          <>
                            <span className="text-slate-500">·</span>
                            <span className="font-mono-num text-amber-300 font-bold">
                              Sala {h.roomCode}
                            </span>
                          </>
                        )}
                      </div>
                      <h3 className="font-display font-bold text-lg text-white">
                        {h.challengeTitle}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-300">
                        {h.resultSummary}
                      </p>
                      {h.directorNote && (
                        <p className="text-xs text-emerald-300">
                          Nota del director: {h.directorNote}
                        </p>
                      )}
                    </div>

                    <div className="sm:text-right shrink-0 space-y-1">
                      <p className="text-xs text-slate-400">
                        {new Date(h.executedAt).toLocaleString('es-CO', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </p>
                      <p className="text-sm font-bold text-amber-300 inline-flex items-center gap-1 sm:justify-end">
                        <Star className="w-4 h-4 fill-current" />
                        {h.winnerName}
                      </p>
                      <p className="text-xs font-mono-num text-slate-300">
                        {h.winnerScore.toLocaleString('es-CO')} pts ·{' '}
                        {h.participantCount} participantes
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
