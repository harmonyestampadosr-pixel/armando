import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Disc,
  Eye,
  EyeOff,
  History,
  Lock,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Plus,
  QrCode,
  RotateCw,
  Settings2,
  Shuffle,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  getSaturdayRouletteCategoryMeta,
  SATURDAY_ROULETTE_CATEGORIES,
  SATURDAY_ROULETTE_MODE_INFO,
  type SaturdayRouletteActivity,
  type SaturdayRouletteCategoryId,
  type SaturdayRouletteHistoryEntry,
  type SaturdayRouletteParticipationMode,
  type SaturdayRouletteValidationGrade,
} from '../shared/saturdayRouletteData';
import { COMPETITION_TEAM_PRESETS } from '../shared/types';
import { soundFX } from '../utils/sound';
import { SaturdayRouletteWheel } from './SaturdayRouletteWheel';

interface RuletaSabadoViewProps {
  onBack: () => void;
  onCreatedMultiplayerRoom: (code: string, presenterToken: string) => void;
  onJoinCode?: (code: string) => void;
}

interface StageParticipant {
  id: string;
  name: string;
  score: number;
  turns: number;
}

const TIMER_OPTIONS = [15, 20, 30, 45, 60, 75, 90, 120];

export function RuletaSabadoView({
  onBack,
  onCreatedMultiplayerRoom,
  onJoinCode,
}: RuletaSabadoViewProps) {
  const [activeTab, setActiveTab] = useState<
    'stage' | 'multiplayer' | 'library' | 'history'
  >('stage');

  // Shared Library & History state
  const [activities, setActivities] = useState<SaturdayRouletteActivity[]>([]);
  const [history, setHistory] = useState<SaturdayRouletteHistoryEntry[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(true);

  // Stage Roulette Director Configuration
  const [enabledCategories, setEnabledCategories] = useState<
    SaturdayRouletteCategoryId[]
  >(() => SATURDAY_ROULETTE_CATEGORIES.map((c) => c.id));
  const [stageMode, setStageMode] =
    useState<SaturdayRouletteParticipationMode>('individual');
  const [allowRespin, setAllowRespin] = useState(true);
  const [configuredTimeSec, setConfiguredTimeSec] = useState(45);
  const [fullscreenStage, setFullscreenStage] = useState(false);

  // Stage Roster
  const [roster, setRoster] = useState<StageParticipant[]>([
    { id: 'st-1', name: 'Joven 1', score: 0, turns: 0 },
    { id: 'st-2', name: 'Joven 2', score: 0, turns: 0 },
    { id: 'st-3', name: 'Equipo Águilas', score: 0, turns: 0 },
    { id: 'st-4', name: 'Equipo Leones', score: 0, turns: 0 },
  ]);
  const [newRosterName, setNewRosterName] = useState('');
  const [selectedRosterId, setSelectedRosterId] = useState<string>('st-1');

  // Stage Wheel & Challenge Lifecycle
  const [angleDeg, setAngleDeg] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [spinsCount, setSpinsCount] = useState(0);
  const [sessionUsedIds, setSessionUsedIds] = useState<string[]>([]);
  const [lastCategoryId, setLastCategoryId] =
    useState<SaturdayRouletteCategoryId | null>(null);
  const [currentActivity, setCurrentActivity] =
    useState<SaturdayRouletteActivity | null>(null);
  const [currentCategoryId, setCurrentCategoryId] =
    useState<SaturdayRouletteCategoryId | null>(null);
  const [stagePhase, setStagePhase] = useState<
    'idle' | 'spun' | 'running' | 'recorded'
  >('idle');
  const [timeLeftSec, setTimeLeftSec] = useState(45);
  const [timerRunning, setTimerRunning] = useState(false);
  const [showGuideAnswer, setShowGuideAnswer] = useState(false);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState<number | null>(
    null
  );
  const [resultGrade, setResultGrade] =
    useState<SaturdayRouletteValidationGrade>('approved');
  const [resultNote, setResultNote] = useState('');
  const [stageFeedback, setStageFeedback] = useState<string | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);
  const [savingResult, setSavingResult] = useState(false);

  // Multiplayer Room Form State
  const [mpTitle, setMpTitle] = useState('Ruleta del Sábado — Sociedad de Jóvenes');
  const [mpMode, setMpMode] =
    useState<SaturdayRouletteParticipationMode>('individual');
  const [mpTeamCount, setMpTeamCount] = useState(3);
  const [mpTeamCapacity, setMpTeamCapacity] = useState(4);
  const [mpTeamNames, setMpTeamNames] = useState<string[]>(() =>
    COMPETITION_TEAM_PRESETS.map((t) => t.name)
  );
  const [mpTimeLimit, setMpTimeLimit] = useState(45);
  const [mpBasePoints, setMpBasePoints] = useState(1000);
  const [mpAllowRespin, setMpAllowRespin] = useState(true);
  const [mpCategories, setMpCategories] = useState<SaturdayRouletteCategoryId[]>(
    () => SATURDAY_ROULETTE_CATEGORIES.map((c) => c.id)
  );
  const [mpCreating, setMpCreating] = useState(false);
  const [mpError, setMpError] = useState<string | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState('');

  // Custom Activity Form State
  const [libFilterCat, setLibFilterCat] = useState<'all' | SaturdayRouletteCategoryId>('all');
  const [showNewForm, setShowNewForm] = useState(false);
  const [newCatId, setNewCatId] =
    useState<SaturdayRouletteCategoryId>('pregunta_biblica');
  const [newTitle, setNewTitle] = useState('');
  const [newInstructions, setNewInstructions] = useState('');
  const [newRef, setNewRef] = useState('');
  const [newSuggestedSec, setNewSuggestedSec] = useState(45);
  const [newGuide, setNewGuide] = useState('');
  const [newEvalType, setNewEvalType] = useState<'director_review' | 'auto_choice'>(
    'director_review'
  );
  const [newOptions, setNewOptions] = useState(['', '', '', '']);
  const [newCorrectIdx, setNewCorrectIdx] = useState(0);
  const [savingCustom, setSavingCustom] = useState(false);
  const [customMsg, setCustomMsg] = useState<string | null>(null);

  const spinTimeoutRef = useRef<number | null>(null);
  const lastBeepSecRef = useRef<number | null>(null);

  const fetchLibraryAndHistory = useCallback(async () => {
    try {
      const [libRes, histRes] = await Promise.all([
        fetch('/api/saturday-roulette/library'),
        fetch('/api/saturday-roulette/history'),
      ]);
      if (libRes.ok) {
        const libData = await libRes.json();
        setActivities(libData.activities || []);
      }
      if (histRes.ok) {
        const histData = await histRes.json();
        setHistory(histData.history || []);
      }
    } catch {
      // ignore network glitches on initial fetch
    } finally {
      setLoadingLibrary(false);
    }
  }, []);

  useEffect(() => {
    fetchLibraryAndHistory();
    return () => {
      if (spinTimeoutRef.current) {
        window.clearTimeout(spinTimeoutRef.current);
      }
    };
  }, [fetchLibraryAndHistory]);

  // Listen to browser fullscreen exit (ESC)
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement && fullscreenStage) {
        // Keep stage overlay open only if user didn't hit exit button; sync seamlessly
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, [fullscreenStage]);

  // Stage countdown timer effect
  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setTimeLeftSec((prev) => {
        const next = Math.max(0, prev - 1);
        if (next > 0 && next <= 5 && lastBeepSecRef.current !== next) {
          lastBeepSecRef.current = next;
          soundFX.playTick();
        }
        if (next === 0) {
          setTimerRunning(false);
          soundFX.playTimeUp();
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  // When switching between individual / parejas / equipos, adjust default labels nicely if desired
  const enterFullscreenStage = async () => {
    setFullscreenStage(true);
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Fullscreen API may be restricted inside sandboxed iframes; stage overlay still fills screen
    }
  };

  const exitFullscreenStage = async () => {
    setFullscreenStage(false);
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      // ignore
    }
  };

  const toggleStageCategory = (catId: SaturdayRouletteCategoryId) => {
    setEnabledCategories((prev) => {
      const exists = prev.includes(catId);
      if (exists && prev.length <= 2) return prev;
      return exists
        ? prev.filter((id) => id !== catId)
        : SATURDAY_ROULETTE_CATEGORIES.map((c) => c.id).filter(
            (id) => id === catId || prev.includes(id)
          );
    });
  };

  const pickRandomParticipant = () => {
    if (roster.length === 0) return;
    const pool =
      roster.length > 1
        ? roster.filter((r) => r.id !== selectedRosterId)
        : roster;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    setSelectedRosterId(chosen.id);
    soundFX.playCategorySelect();
  };

  const handleAddRoster = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newRosterName.trim();
    if (!clean) return;
    const nextItem: StageParticipant = {
      id: `st-${Date.now().toString(36)}`,
      name: clean.slice(0, 40),
      score: 0,
      turns: 0,
    };
    setRoster((prev) => [...prev, nextItem]);
    setSelectedRosterId(nextItem.id);
    setNewRosterName('');
  };

  const handleStageSpin = async (pickRandomPlayer = false) => {
    if (spinning) return;
    setStageError(null);

    if (stagePhase === 'spun' && !allowRespin) {
      setStageError(
        'El director bloqueó volver a girar antes de iniciar o registrar el reto actual.'
      );
      return;
    }

    if (pickRandomPlayer && stageMode !== 'congregacion' && roster.length > 0) {
      const pool =
        roster.length > 1
          ? roster.filter((r) => r.id !== selectedRosterId)
          : roster;
      const chosen = pool[Math.floor(Math.random() * pool.length)];
      setSelectedRosterId(chosen.id);
    }

    setTimerRunning(false);
    setShowGuideAnswer(false);
    setSelectedOptionIdx(null);
    setStageFeedback(null);
    setResultNote('');
    lastBeepSecRef.current = null;

    try {
      const res = await fetch('/api/saturday-roulette/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabledCategories,
          sessionUsedIds,
          lastCategoryId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.activity) {
        setStageError(data.error || 'No se pudo girar la ruleta.');
        return;
      }

      const sliceDeg = 360 / Math.max(1, enabledCategories.length);
      const offset = (360 - (data.slotIndex * sliceDeg + sliceDeg / 2)) % 360;
      const nextAngle = Math.floor(angleDeg / 360) * 360 + 1440 + offset;

      setSpinning(true);
      setAngleDeg(nextAngle);
      soundFX.playWheelSpin(3400);

      if (spinTimeoutRef.current) {
        window.clearTimeout(spinTimeoutRef.current);
      }

      spinTimeoutRef.current = window.setTimeout(() => {
        setSpinning(false);
        setSpinsCount((c) => c + 1);
        setCurrentCategoryId(data.category.id);
        setLastCategoryId(data.category.id);
        setCurrentActivity(data.activity);
        setSessionUsedIds((prev) =>
          prev.includes(data.activity.id) ? prev : [...prev, data.activity.id]
        );
        const suggested = Number(data.activity.suggestedSec) || configuredTimeSec;
        setConfiguredTimeSec(suggested);
        setTimeLeftSec(suggested);
        setStagePhase('spun');
        soundFX.playWheelStop();
        soundFX.playCategorySelect();
      }, 3450);
    } catch {
      setStageError('Error de conexión al girar la Ruleta del Sábado.');
      setSpinning(false);
    }
  };

  const handleStartStageChallenge = () => {
    if (!currentActivity) return;
    setTimeLeftSec(configuredTimeSec);
    lastBeepSecRef.current = null;
    setStagePhase('running');
    setTimerRunning(true);
    soundFX.playQuestionStart();
  };

  const handleRecordStageResult = async () => {
    if (!currentActivity || !currentCategoryId || savingResult) return;
    setSavingResult(true);
    setTimerRunning(false);
    setStageError(null);

    const participantObj =
      stageMode === 'congregacion'
        ? null
        : roster.find((r) => r.id === selectedRosterId) || roster[0] || null;
    const performerName =
      stageMode === 'congregacion'
        ? 'Toda la congregación'
        : participantObj?.name || 'Participación en vivo';

    const pointsAwarded =
      resultGrade === 'featured'
        ? 150
        : resultGrade === 'approved'
          ? 100
          : resultGrade === 'participation'
            ? 50
            : 0;

    try {
      const res = await fetch('/api/saturday-roulette/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spinNumber: Math.max(1, spinsCount),
          categoryId: currentCategoryId,
          activityId: currentActivity.id,
          activityTitle: currentActivity.title,
          participationMode: stageMode,
          participantName: performerName,
          grade: resultGrade,
          pointsAwarded,
          durationSec: configuredTimeSec,
          note: resultNote.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStageError(
          data.error || 'No se pudo guardar el resultado en el servidor.'
        );
        return;
      }
      if (data.entry) {
        setHistory((prev) => [data.entry, ...prev]);
      }

      if (participantObj && pointsAwarded > 0) {
        setRoster((prev) =>
          prev.map((r) =>
            r.id === participantObj.id
              ? { ...r, score: r.score + pointsAwarded, turns: r.turns + 1 }
              : r
          )
        );
      } else if (participantObj) {
        setRoster((prev) =>
          prev.map((r) =>
            r.id === participantObj.id ? { ...r, turns: r.turns + 1 } : r
          )
        );
      }

      setStagePhase('recorded');
      setShowGuideAnswer(true);
      setStageFeedback(
        `Resultado registrado para ${performerName}: +${pointsAwarded} pts.`
      );
      if (pointsAwarded >= 100) {
        soundFX.playMysterySolved();
        confetti({ particleCount: 55, spread: 60, origin: { y: 0.7 } });
      } else {
        soundFX.playCorrect();
      }
    } catch {
      setStageError('No se pudo guardar el resultado en el servidor.');
    } finally {
      setSavingResult(false);
    }
  };

  const handleCreateMultiplayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mpCreating) return;
    setMpError(null);
    setMpCreating(true);

    const needsTeams = mpMode === 'parejas' || mpMode === 'equipos';
    const teamCapacity = mpMode === 'parejas' ? 2 : mpTeamCapacity;
    const defaultTeamNames =
      mpMode === 'parejas'
        ? Array.from({ length: mpTeamCount }, (_, i) => `Pareja ${i + 1}`)
        : mpTeamNames.slice(0, mpTeamCount);

    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: mpTitle.trim() || 'Ruleta del Sábado en Vivo',
          mode: 'ruleta_sabado',
          participationMode: mpMode,
          enabledCategories: mpCategories,
          allowRespin: mpAllowRespin,
          timeLimitSec: mpTimeLimit,
          basePoints: mpBasePoints,
          speedBonusMax: Math.round(mpBasePoints * 0.4),
          teamMode: needsTeams,
          ...(needsTeams
            ? {
                teamCount: mpTeamCount,
                teamCapacity,
                teamNames: defaultTeamNames,
              }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMpError(data.error || 'No se pudo crear la sala de Ruleta del Sábado.');
        setMpCreating(false);
        return;
      }
      onCreatedMultiplayerRoom(data.code, data.presenterToken);
    } catch {
      setMpError('Error de conexión al crear la sala.');
      setMpCreating(false);
    }
  };

  const handleCreateCustomActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingCustom) return;
    setCustomMsg(null);
    setSavingCustom(true);

    try {
      const payload: Record<string, unknown> = {
        categoryId: newCatId,
        title: newTitle.trim(),
        instructions: newInstructions.trim(),
        reference: newRef.trim() || 'Palabra de Dios',
        suggestedSec: newSuggestedSec,
        guideAnswer: newGuide.trim(),
        evaluationType: newEvalType,
        ...(newEvalType === 'auto_choice'
          ? {
              options: newOptions.map((o) => o.trim()).filter(Boolean),
              correctIndex: newCorrectIdx,
            }
          : {}),
      };
      const res = await fetch('/api/saturday-roulette/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setCustomMsg(data.error || 'Revisa los campos de la actividad.');
        setSavingCustom(false);
        return;
      }
      setActivities((prev) => [data.activity, ...prev]);
      setNewTitle('');
      setNewInstructions('');
      setNewRef('');
      setNewGuide('');
      setNewOptions(['', '', '', '']);
      setShowNewForm(false);
      setCustomMsg('Actividad personalizada agregada a la Ruleta del Sábado.');
    } catch {
      setCustomMsg('Error de conexión al guardar la actividad.');
    } finally {
      setSavingCustom(false);
    }
  };

  const handleDeleteCustom = async (id: string) => {
    try {
      const res = await fetch(`/api/saturday-roulette/custom/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setActivities((prev) => prev.filter((a) => a.id !== id));
      }
    } catch {
      // ignore
    }
  };

  const filteredActivities = useMemo(() => {
    if (libFilterCat === 'all') return activities;
    return activities.filter((a) => a.categoryId === libFilterCat);
  }, [activities, libFilterCat]);

  const currentCatMeta = currentCategoryId
    ? getSaturdayRouletteCategoryMeta(currentCategoryId)
    : null;
  const activeParticipant =
    roster.find((r) => r.id === selectedRosterId) || roster[0] || null;
  const canRespinStage = stagePhase !== 'spun' || allowRespin;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* FULL-SCREEN PROJECTOR PRESENTATION OVERLAY */}
      {fullscreenStage && (
        <div className="fixed inset-0 z-50 bg-[#050914] text-white p-5 sm:p-8 flex flex-col justify-between gap-6 overflow-y-auto">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <Disc className="w-7 h-7 text-amber-400" />
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-amber-300">
                  DIME TÚ QUÉ DICES · PRESENTACIÓN EN VIVO
                </p>
                <h2 className="font-display text-xl sm:text-2xl font-extrabold text-white">
                  Ruleta del Sábado · {SATURDAY_ROULETTE_MODE_INFO[stageMode].label}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-4 py-2 rounded-xl bg-[#111A2E] border border-slate-700 text-sm font-semibold text-sky-300">
                Turno:{' '}
                <strong className="text-white">
                  {stageMode === 'congregacion'
                    ? 'Toda la Congregación'
                    : activeParticipant?.name || 'Por definir'}
                </strong>
              </div>
              <button
                type="button"
                onClick={exitFullscreenStage}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
              >
                <Minimize2 className="w-4 h-4" />
                Salir de Pantalla Completa
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-6xl w-full mx-auto flex-1">
            <div className="lg:col-span-5 flex flex-col items-center space-y-3">
              <SaturdayRouletteWheel
                enabledCategories={enabledCategories}
                angleDeg={angleDeg}
                spinning={spinning}
                size={380}
                selectedCategoryId={currentCategoryId}
              />
              <span className="font-mono-num text-sm text-slate-400">
                Giro #{spinsCount} · {enabledCategories.length} categorías activas
              </span>
            </div>

            <div className="lg:col-span-7 space-y-5">
              {spinning ? (
                <div className="bg-[#111A2E] border border-amber-400/50 rounded-3xl p-10 text-center space-y-3">
                  <Disc className="w-12 h-12 text-amber-400 mx-auto animate-spin" />
                  <h3 className="font-display text-3xl sm:text-4xl font-extrabold text-white">
                    ¡Girando la Ruleta del Sábado!
                  </h3>
                  <p className="text-slate-300 text-lg">
                    Descubriendo la actividad sorpresa...
                  </p>
                </div>
              ) : currentActivity && currentCatMeta ? (
                <div className="bg-[#111A2E] border border-amber-400/50 rounded-3xl p-7 sm:p-8 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span
                      className={`px-4 py-1.5 rounded-xl border text-sm font-extrabold ${currentCatMeta.accentBg}`}
                    >
                      {currentCatMeta.label}
                    </span>
                    <div className="flex items-center gap-2 bg-[#080E1E] border border-slate-700 px-4 py-2 rounded-2xl">
                      <Clock className="w-5 h-5 text-amber-300" />
                      <span
                        className={`font-mono-num font-extrabold text-3xl ${
                          timerRunning && timeLeftSec <= 5
                            ? 'text-rose-400'
                            : 'text-white'
                        }`}
                      >
                        {stagePhase === 'spun' ? `${configuredTimeSec}s` : `${timeLeftSec}s`}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-display text-3xl sm:text-4xl font-extrabold text-white leading-tight">
                    {currentActivity.title}
                  </h3>
                  <p className="text-lg sm:text-xl text-slate-200 leading-relaxed">
                    {currentActivity.instructions}
                  </p>
                  {currentActivity.reference && (
                    <p className="text-base font-semibold text-amber-300 inline-flex items-center gap-2">
                      <BookOpen className="w-5 h-5" />
                      Cita bíblica: {currentActivity.reference}
                    </p>
                  )}

                  {stageFeedback && (
                    <div className="bg-emerald-500/15 border border-emerald-400/50 rounded-2xl p-4 text-emerald-200 font-bold text-base">
                      {stageFeedback}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-[#111A2E] border border-dashed border-slate-700 rounded-3xl p-10 text-center space-y-3">
                  <h3 className="font-display text-3xl font-extrabold text-white">
                    ¡Bienvenidos a la Ruleta del Sábado!
                  </h3>
                  <p className="text-slate-300 text-lg">
                    Presiona &quot;Girar Ruleta&quot; para descubrir la primera dinámica de Sociedad de Jóvenes.
                  </p>
                </div>
              )}

              {/* Director Stage Control Bar inside Fullscreen */}
              <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={spinning || !canRespinStage}
                    onClick={() => handleStageSpin(false)}
                    className={`px-5 py-3 rounded-xl font-display font-extrabold text-sm inline-flex items-center gap-2 ${
                      !spinning && canRespinStage
                        ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <RotateCw className="w-4 h-4" />
                    {stagePhase === 'spun' ? 'Girar Nuevamente' : 'Girar Ruleta'}
                  </button>

                  {stagePhase === 'spun' && currentActivity && (
                    <button
                      type="button"
                      onClick={handleStartStageChallenge}
                      className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-sm inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      Comenzar Reto ({configuredTimeSec}s)
                    </button>
                  )}

                  {(stagePhase === 'running' || stagePhase === 'spun') &&
                    currentActivity && (
                      <button
                        type="button"
                        onClick={handleRecordStageResult}
                        className="px-5 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-display font-extrabold text-sm inline-flex items-center gap-2 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Registrar Resultado
                      </button>
                    )}
                </div>

                {stageMode !== 'congregacion' && roster.length > 0 && (
                  <button
                    type="button"
                    onClick={pickRandomParticipant}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Shuffle className="w-3.5 h-3.5 text-amber-300" />
                    Sortear participante
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-xl bg-[#111A2E] border border-slate-800 hover:border-slate-700 text-slate-300 cursor-pointer"
            title="Volver al inicio"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
              Etapa 3 · Sociedad de Jóvenes
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
              Ruleta del Sábado
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={enterFullscreenStage}
          className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
        >
          <Maximize2 className="w-4 h-4" />
          Modo Proyector Pantalla Completa
        </button>
      </div>

      {/* Mode Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {[
          { id: 'stage', label: 'Ruleta en Vivo (Escenario)', icon: Disc },
          { id: 'multiplayer', label: 'Multijugador con QR', icon: QrCode },
          {
            id: 'library',
            label: `Actividades y Director (${activities.length})`,
            icon: Settings2,
          },
          {
            id: 'history',
            label: `Historial de Giros (${history.length})`,
            icon: History,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer transition-colors ${
                active
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-[#111A2E] border border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: LIVE STAGE ROULETTE */}
      {activeTab === 'stage' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Wheel + Spin + Director Settings */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 flex flex-col items-center space-y-5">
              <SaturdayRouletteWheel
                enabledCategories={enabledCategories}
                angleDeg={angleDeg}
                spinning={spinning}
                size={330}
                selectedCategoryId={currentCategoryId}
              />

              <div className="w-full space-y-2.5">
                <button
                  type="button"
                  disabled={spinning || !canRespinStage}
                  onClick={() => handleStageSpin(false)}
                  className={`w-full py-4 rounded-xl font-display font-extrabold text-base inline-flex items-center justify-center gap-2 transition-colors ${
                    !spinning && canRespinStage
                      ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {!canRespinStage ? (
                    <Lock className="w-5 h-5" />
                  ) : (
                    <RotateCw
                      className={`w-5 h-5 ${spinning ? 'animate-spin' : ''}`}
                    />
                  )}
                  {spinning
                    ? 'Girando ruleta...'
                    : stagePhase === 'spun'
                      ? 'Girar Nuevamente'
                      : 'Girar Ruleta del Sábado'}
                </button>

                {stageMode !== 'congregacion' && roster.length > 0 && (
                  <button
                    type="button"
                    disabled={spinning || !canRespinStage}
                    onClick={() => handleStageSpin(true)}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Shuffle className="w-4 h-4 text-sky-400" />
                    Sortear Participante + Girar Ruleta
                  </button>
                )}

                {!canRespinStage && (
                  <p className="text-xs text-amber-300 text-center">
                    Permiso de regiro desactivado por el director. Presiona &quot;Comenzar reto&quot; o &quot;Registrar resultado&quot;.
                  </p>
                )}
              </div>
            </div>

            {/* Director Category Activation & Respin Controls */}
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display font-bold text-base text-white flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-amber-300" />
                  Controles del Director
                </h3>
                <span className="text-xs font-mono-num text-slate-400">
                  {enabledCategories.length}/12 activas
                </span>
              </div>

              <label className="flex items-center justify-between gap-2 bg-[#080E1E] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-200 cursor-pointer">
                <span>Permitir girar nuevamente antes de comenzar</span>
                <input
                  type="checkbox"
                  checked={allowRespin}
                  onChange={(e) => setAllowRespin(e.target.checked)}
                  className="accent-amber-400 w-4 h-4"
                />
              </label>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-400">
                  Categorías visibles en la ruleta (mínimo 2):
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {SATURDAY_ROULETTE_CATEGORIES.map((cat) => {
                    const active = enabledCategories.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleStageCategory(cat.id)}
                        className={`px-2.5 py-2 rounded-xl border text-left text-[11px] font-semibold flex items-center gap-2 cursor-pointer transition-colors ${
                          active
                            ? 'bg-[#080E1E] border-amber-400/50 text-white'
                            : 'bg-[#080E1E]/40 border-slate-800 text-slate-500 opacity-55'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="truncate">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Mode + Roster + Active Challenge + Record Result */}
          <div className="lg:col-span-7 space-y-5">
            {/* Participation Mode Selector + Roster */}
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  Object.keys(
                    SATURDAY_ROULETTE_MODE_INFO
                  ) as SaturdayRouletteParticipationMode[]
                ).map((modeKey) => (
                  <button
                    key={modeKey}
                    type="button"
                    onClick={() => setStageMode(modeKey)}
                    className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      stageMode === modeKey
                        ? 'bg-amber-400/15 border-amber-400 text-white'
                        : 'bg-[#080E1E] border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <p className="font-display font-bold text-xs">
                      {SATURDAY_ROULETTE_MODE_INFO[modeKey].label}
                    </p>
                  </button>
                ))}
              </div>

              {stageMode === 'congregacion' ? (
                <div className="bg-[#080E1E] border border-slate-800 rounded-xl p-3.5 flex items-center gap-3">
                  <Users className="w-5 h-5 text-amber-300 shrink-0" />
                  <p className="text-xs sm:text-sm text-slate-300">
                    Modo activo:{' '}
                    <strong className="text-white">
                      Participación de toda la congregación
                    </strong>
                    . Todos los jóvenes participan unidos en cada giro.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Participantes / {stageMode === 'parejas' ? 'Parejas' : stageMode === 'equipos' ? 'Equipos' : 'Turno actual'}
                    </p>
                    <button
                      type="button"
                      onClick={pickRandomParticipant}
                      className="text-xs font-bold text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                      Elegir al azar
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {roster.map((item) => {
                      const selected = selectedRosterId === item.id;
                      return (
                        <div
                          key={item.id}
                          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs ${
                            selected
                              ? 'bg-amber-400/15 border-amber-400 text-white font-bold'
                              : 'bg-[#080E1E] border-slate-800 text-slate-300'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedRosterId(item.id)}
                            className="cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <span>{item.name}</span>
                            <span className="font-mono-num text-amber-300">
                              {item.score}
                            </span>
                          </button>
                          {roster.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setRoster((prev) => {
                                  const next = prev.filter((r) => r.id !== item.id);
                                  if (selectedRosterId === item.id && next[0]) {
                                    setSelectedRosterId(next[0].id);
                                  }
                                  return next;
                                });
                              }}
                              className="text-slate-500 hover:text-rose-400 cursor-pointer"
                              title={`Quitar a ${item.name}`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <form onSubmit={handleAddRoster} className="flex gap-2">
                    <input
                      type="text"
                      value={newRosterName}
                      onChange={(e) => setNewRosterName(e.target.value)}
                      placeholder={
                        stageMode === 'parejas'
                          ? 'Agregar pareja (ej: Ana y Mateo)'
                          : stageMode === 'equipos'
                            ? 'Agregar equipo'
                            : 'Agregar participante al listado'
                      }
                      className="flex-1 bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Agregar
                    </button>
                  </form>
                </div>
              )}
            </div>

            {stageError && (
              <div className="bg-rose-500/15 border border-rose-500/50 rounded-2xl p-4 text-sm text-rose-200">
                {stageError}
              </div>
            )}

            {/* Revealed Activity Card */}
            {currentActivity && currentCatMeta ? (
              <div className="bg-[#111A2E] border border-amber-400/50 rounded-2xl p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span
                    className={`px-3.5 py-1.5 rounded-xl border text-xs sm:text-sm font-bold inline-flex items-center gap-2 ${currentCatMeta.accentBg}`}
                  >
                    <Sparkles className="w-4 h-4" />
                    {currentCatMeta.label}
                  </span>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Turno:</span>
                    <span className="text-xs font-bold text-amber-300 bg-[#080E1E] border border-slate-700 px-3 py-1 rounded-lg">
                      {stageMode === 'congregacion'
                        ? 'Toda la Congregación'
                        : activeParticipant?.name || 'Joven'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h2 className="font-display text-2xl font-extrabold text-white">
                    {currentActivity.title}
                  </h2>
                  <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
                    {currentActivity.instructions}
                  </p>
                  {currentActivity.reference && (
                    <p className="text-xs sm:text-sm font-semibold text-amber-300 inline-flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4" />
                      Referencia: {currentActivity.reference}
                    </p>
                  )}
                </div>

                {/* Auto-choice interactive options on Stage if applicable */}
                {currentActivity.evaluationType === 'auto_choice' &&
                  currentActivity.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {currentActivity.options.map((opt, idx) => {
                        const isPicked = selectedOptionIdx === idx;
                        const isCorrect =
                          (selectedOptionIdx !== null || showGuideAnswer) &&
                          currentActivity.correctIndex === idx;
                        const isWrongPicked =
                          isPicked && currentActivity.correctIndex !== idx;

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              if (selectedOptionIdx !== null) return;
                              setSelectedOptionIdx(idx);
                              setShowGuideAnswer(true);
                              if (currentActivity.correctIndex === idx) {
                                soundFX.playCorrect();
                                setResultGrade('approved');
                              } else {
                                soundFX.playWrong();
                                setResultGrade('participation');
                              }
                            }}
                            className={`p-3 rounded-xl border text-left text-sm font-medium cursor-pointer transition-colors ${
                              isCorrect
                                ? 'bg-emerald-600/25 border-emerald-400 text-emerald-200 font-bold'
                                : isWrongPicked
                                  ? 'bg-rose-600/25 border-rose-400 text-rose-200'
                                  : 'bg-[#080E1E] border-slate-800 text-slate-200 hover:border-amber-400/60'
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}

                {/* Configurable Timer & "Comenzar reto" */}
                <div className="bg-[#080E1E] border border-slate-800 rounded-2xl p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-5 h-5 text-sky-400" />
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Cronómetro del reto
                        </p>
                        <p
                          className={`font-mono-num text-2xl font-extrabold ${
                            timerRunning && timeLeftSec <= 5
                              ? 'text-rose-400'
                              : 'text-white'
                          }`}
                        >
                          {stagePhase === 'spun' ? configuredTimeSec : timeLeftSec}s
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {TIMER_OPTIONS.map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => {
                            setConfiguredTimeSec(sec);
                            if (!timerRunning) setTimeLeftSec(sec);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono-num font-bold cursor-pointer ${
                            configuredTimeSec === sec
                              ? 'bg-sky-500 text-slate-950'
                              : 'bg-[#111A2E] border border-slate-700 text-slate-300'
                          }`}
                        >
                          {sec}s
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {stagePhase === 'spun' ? (
                      <button
                        type="button"
                        onClick={handleStartStageChallenge}
                        className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-sm inline-flex items-center gap-2 cursor-pointer"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        Comenzar Reto ({configuredTimeSec}s)
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setTimerRunning((r) => !r)}
                        className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
                      >
                        {timerRunning ? (
                          <>
                            <Pause className="w-4 h-4 text-amber-300" />
                            Pausar Cronómetro
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 text-emerald-400" />
                            Reanudar Cronómetro
                          </>
                        )}
                      </button>
                    )}

                    {currentActivity.guideAnswer && (
                      <button
                        type="button"
                        onClick={() => setShowGuideAnswer((v) => !v)}
                        className="px-4 py-2.5 rounded-xl bg-[#111A2E] border border-slate-700 text-xs font-semibold text-sky-300 inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        {showGuideAnswer ? (
                          <>
                            <EyeOff className="w-4 h-4" />
                            Ocultar guía
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4" />
                            Ver guía / respuesta
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {showGuideAnswer && currentActivity.guideAnswer && (
                    <p className="text-xs sm:text-sm text-emerald-200 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
                      <strong className="text-emerald-300">Guía:</strong>{' '}
                      {currentActivity.guideAnswer}
                    </p>
                  )}
                </div>

                {/* Record Result Box */}
                <div className="bg-[#080E1E] border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Calificación y Registro
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          { id: 'featured', label: 'Destacado (+150)' },
                          { id: 'approved', label: 'Cumplido (+100)' },
                          { id: 'participation', label: 'Participación (+50)' },
                          { id: 'rejected', label: 'Sin puntos (0)' },
                        ] as const
                      ).map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setResultGrade(g.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                            resultGrade === g.id
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-[#111A2E] border border-slate-700 text-slate-300'
                          }`}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      type="text"
                      value={resultNote}
                      onChange={(e) => setResultNote(e.target.value)}
                      placeholder="Nota del resultado (opcional)..."
                      className="flex-1 bg-[#111A2E] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      disabled={savingResult}
                      onClick={handleRecordStageResult}
                      className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      <Award className="w-4 h-4" />
                      Registrar Resultado
                    </button>
                  </div>

                  {stageFeedback && (
                    <div className="bg-emerald-500/15 border border-emerald-400/50 rounded-xl p-3 text-xs sm:text-sm text-emerald-200 font-semibold flex items-center justify-between gap-2">
                      <span>{stageFeedback}</span>
                      <button
                        type="button"
                        onClick={() => handleStageSpin(stageMode !== 'congregacion')}
                        className="px-3 py-1 rounded-lg bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer shrink-0"
                      >
                        Siguiente giro
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-[#111A2E] border border-dashed border-slate-700 rounded-2xl p-10 text-center space-y-3">
                <Disc className="w-12 h-12 text-amber-400 mx-auto" />
                <h2 className="font-display text-2xl font-bold text-white">
                  ¡Gira la Ruleta del Sábado!
                </h2>
                <p className="text-sm text-slate-400 max-w-md mx-auto">
                  Incluye 12 categorías juveniles: alabanza, preguntas bíblicas, personaje misterioso, representación, desafío relámpago, reflexión, testimonio, reto en pareja, equipos, versículo sorpresa, misión de servicio y creatividad.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MULTIPLAYER LIVE ROOM WITH QR */}
      {activeTab === 'multiplayer' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleCreateMultiplayer}
            className="lg:col-span-8 bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-5"
          >
            <div>
              <h2 className="font-display text-xl font-bold text-white">
                Crear Sala Multijugador de Ruleta del Sábado
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Todos los conectados ven la ruleta animada, la categoría ganadora, el participante elegido, el cronómetro y los resultados sincronizados en tiempo real.
              </p>
            </div>

            {mpError && (
              <div className="bg-rose-500/15 border border-rose-500/50 rounded-xl p-3 text-sm text-rose-200">
                {mpError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">
                Nombre de la sesión / sala
              </label>
              <input
                type="text"
                value={mpTitle}
                onChange={(e) => setMpTitle(e.target.value)}
                required
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">
                Modalidad de participación
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(
                  Object.keys(
                    SATURDAY_ROULETTE_MODE_INFO
                  ) as SaturdayRouletteParticipationMode[]
                ).map((modeKey) => (
                  <button
                    key={modeKey}
                    type="button"
                    onClick={() => setMpMode(modeKey)}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition-colors ${
                      mpMode === modeKey
                        ? 'bg-amber-400/15 border-amber-400 text-white'
                        : 'bg-[#080E1E] border-slate-800 text-slate-300'
                    }`}
                  >
                    <p className="font-display font-bold text-sm">
                      {SATURDAY_ROULETTE_MODE_INFO[modeKey].label}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {SATURDAY_ROULETTE_MODE_INFO[modeKey].shortDesc}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {(mpMode === 'parejas' || mpMode === 'equipos') && (
              <div className="bg-[#080E1E] border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-400">
                      Cantidad de {mpMode === 'parejas' ? 'parejas' : 'equipos'}
                    </label>
                    <select
                      value={mpTeamCount}
                      onChange={(e) => setMpTeamCount(Number(e.target.value))}
                      className="mt-1 w-full bg-[#111A2E] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                    >
                      {[2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>
                          {n} {mpMode === 'parejas' ? 'parejas' : 'equipos'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {mpMode === 'equipos' && (
                    <div>
                      <label className="text-xs font-semibold text-slate-400">
                        Cupo por equipo
                      </label>
                      <select
                        value={mpTeamCapacity}
                        onChange={(e) => setMpTeamCapacity(Number(e.target.value))}
                        className="mt-1 w-full bg-[#111A2E] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                      >
                        {[3, 4, 5, 6, 8, 10, 15].map((n) => (
                          <option key={n} value={n}>
                            Hasta {n} integrantes
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {mpMode === 'equipos' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Array.from({ length: mpTeamCount }).map((_, idx) => (
                      <input
                        key={idx}
                        type="text"
                        value={mpTeamNames[idx] || `Equipo ${idx + 1}`}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMpTeamNames((prev) =>
                            prev.map((n, i) => (i === idx ? val : n))
                          );
                        }}
                        className="bg-[#111A2E] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-300">
                  Cronómetro predeterminado (segundos)
                </label>
                <select
                  value={mpTimeLimit}
                  onChange={(e) => setMpTimeLimit(Number(e.target.value))}
                  className="mt-1 w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
                >
                  {TIMER_OPTIONS.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec} segundos
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300">
                  Puntos base por actividad
                </label>
                <select
                  value={mpBasePoints}
                  onChange={(e) => setMpBasePoints(Number(e.target.value))}
                  className="mt-1 w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
                >
                  {[500, 1000, 1500, 2000].map((pts) => (
                    <option key={pts} value={pts}>
                      {pts} pts
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300">
                  Categorías activas para esta sala ({mpCategories.length}/12)
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-amber-300 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mpAllowRespin}
                    onChange={(e) => setMpAllowRespin(e.target.checked)}
                    className="accent-amber-400"
                  />
                  Permitir girar nuevamente antes de comenzar
                </label>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SATURDAY_ROULETTE_CATEGORIES.map((cat) => {
                  const active = mpCategories.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() =>
                        setMpCategories((prev) => {
                          if (prev.includes(cat.id) && prev.length <= 2) {
                            return prev;
                          }
                          return prev.includes(cat.id)
                            ? prev.filter((id) => id !== cat.id)
                            : SATURDAY_ROULETTE_CATEGORIES.map((c) => c.id).filter(
                                (id) => id === cat.id || prev.includes(id)
                              );
                        })
                      }
                      className={`px-3 py-2 rounded-xl border text-left text-xs font-semibold flex items-center gap-2 cursor-pointer ${
                        active
                          ? 'bg-[#080E1E] border-amber-400/50 text-white'
                          : 'bg-[#080E1E]/40 border-slate-800 text-slate-500 opacity-55'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="truncate">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={mpCreating}
              className="w-full py-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-base cursor-pointer disabled:opacity-50"
            >
              {mpCreating
                ? 'Creando sala y código QR...'
                : 'Crear Sala en Vivo con QR y Proyector'}
            </button>
          </form>

          {onJoinCode && (
            <div className="lg:col-span-4 bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="font-display font-bold text-lg text-white">
                Unirse a una Ruleta en Vivo
              </h3>
              <p className="text-xs text-slate-400">
                Si ya proyectaron un código o QR en pantalla, ingrésalo aquí para entrar como invitado sin correo ni contraseña.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const clean = joinCodeInput.trim().toUpperCase();
                  if (clean) onJoinCode(clean);
                }}
                className="space-y-3"
              >
                <input
                  type="text"
                  value={joinCodeInput}
                  onChange={(e) =>
                    setJoinCodeInput(
                      e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                    )
                  }
                  placeholder="Código (ej: SABADO)"
                  className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-4 py-3 text-sm text-white font-mono-num font-bold"
                />
                <button
                  type="submit"
                  disabled={!joinCodeInput.trim()}
                  className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm cursor-pointer disabled:opacity-40"
                >
                  Entrar a la Sala
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LIBRARY & CUSTOM ACTIVITIES */}
      {activeTab === 'library' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setLibFilterCat('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                  libFilterCat === 'all'
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-[#111A2E] border border-slate-800 text-slate-300'
                }`}
              >
                Todas (12 categorías)
              </button>
              {SATURDAY_ROULETTE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setLibFilterCat(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 ${
                    libFilterCat === cat.id
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-[#111A2E] border border-slate-800 text-slate-300'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  {cat.shortLabel}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowNewForm((v) => !v)}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {showNewForm ? 'Cerrar formulario' : 'Agregar actividad propia'}
            </button>
          </div>

          {customMsg && (
            <div className="bg-emerald-500/15 border border-emerald-400/50 rounded-xl p-3 text-sm text-emerald-200">
              {customMsg}
            </div>
          )}

          {showNewForm && (
            <form
              onSubmit={handleCreateCustomActivity}
              className="bg-[#111A2E] border border-emerald-400/40 rounded-2xl p-6 space-y-4"
            >
              <h3 className="font-display font-bold text-lg text-white">
                Nueva Actividad Personalizada para la Ruleta del Sábado
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400">
                    Categoría
                  </label>
                  <select
                    value={newCatId}
                    onChange={(e) =>
                      setNewCatId(e.target.value as SaturdayRouletteCategoryId)
                    }
                    className="mt-1 w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    {SATURDAY_ROULETTE_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400">
                    Evaluación
                  </label>
                  <select
                    value={newEvalType}
                    onChange={(e) =>
                      setNewEvalType(
                        e.target.value as 'director_review' | 'auto_choice'
                      )
                    }
                    className="mt-1 w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="director_review">
                      Participación / Revisión del director
                    </option>
                    <option value="auto_choice">
                      Pregunta con opciones A/B/C/D
                    </option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400">
                    Tiempo sugerido (s)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={240}
                    value={newSuggestedSec}
                    onChange={(e) => setNewSuggestedSec(Number(e.target.value))}
                    className="mt-1 w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Título de la actividad (ej: Coro de Avance Juvenil)"
                  className="bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                />
                <input
                  type="text"
                  value={newRef}
                  onChange={(e) => setNewRef(e.target.value)}
                  placeholder="Cita bíblica (ej: Salmos 100:1)"
                  className="bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                />
              </div>

              <textarea
                rows={2}
                required
                value={newInstructions}
                onChange={(e) => setNewInstructions(e.target.value)}
                placeholder="Instrucciones claras que aparecerán cuando caiga esta actividad..."
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
              />

              {newEvalType === 'auto_choice' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {newOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correctIdx"
                        checked={newCorrectIdx === idx}
                        onChange={() => setNewCorrectIdx(idx)}
                        className="accent-emerald-400"
                      />
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewOptions((prev) =>
                            prev.map((o, i) => (i === idx ? val : o))
                          );
                        }}
                        placeholder={`Opción ${idx + 1}${newCorrectIdx === idx ? ' (Correcta)' : ''}`}
                        className="flex-1 bg-[#080E1E] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                  ))}
                </div>
              )}

              <input
                type="text"
                value={newGuide}
                onChange={(e) => setNewGuide(e.target.value)}
                placeholder="Respuesta o guía privada para el director (opcional)"
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white"
              />

              <button
                type="submit"
                disabled={savingCustom}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
              >
                {savingCustom ? 'Guardando...' : 'Guardar Actividad'}
              </button>
            </form>
          )}

          {loadingLibrary ? (
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-sm">
              Cargando catálogo de actividades...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredActivities.map((act) => {
                const cat = getSaturdayRouletteCategoryMeta(act.categoryId);
                return (
                  <div
                    key={act.id}
                    className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold ${cat.accentBg}`}
                      >
                        {cat.label}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-num text-xs text-slate-400">
                          {act.suggestedSec}s
                        </span>
                        {act.isCustom && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCustom(act.id)}
                            className="text-slate-500 hover:text-rose-400 cursor-pointer"
                            title="Eliminar actividad personalizada"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <h4 className="font-display font-bold text-base text-white">
                      {act.title}
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      {act.instructions}
                    </p>
                    <p className="text-xs font-semibold text-amber-300">
                      {act.reference}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-xl text-white">
              Historial de Giros y Resultados Registrados
            </h2>
            <span className="font-mono-num text-xs text-slate-400">
              {history.length} registros
            </span>
          </div>

          {history.length === 0 ? (
            <div className="py-14 text-center border border-dashed border-slate-800 rounded-2xl text-slate-400 text-sm">
              Aún no se han registrado giros en la Ruleta del Sábado. Gira la ruleta y presiona &quot;Registrar resultado&quot; para guardar cada dinámica.
            </div>
          ) : (
            <div className="space-y-2.5">
              {history.map((item) => {
                const cat = getSaturdayRouletteCategoryMeta(item.categoryId);
                return (
                  <div
                    key={item.id}
                    className="bg-[#080E1E] border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`px-2 py-0.5 rounded-md border font-bold ${cat.accentBg}`}
                        >
                          {item.categoryLabel}
                        </span>
                        <span className="font-semibold text-white">
                          {item.activityTitle}
                        </span>
                        {item.roomCode && (
                          <span className="font-mono-num text-sky-300">
                            Sala {item.roomCode}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        Participó:{' '}
                        <strong className="text-slate-200">
                          {item.participantName}
                        </strong>{' '}
                        · {SATURDAY_ROULETTE_MODE_INFO[item.participationMode].label} ·{' '}
                        {new Date(item.executedAt).toLocaleString('es-CO')}
                        {item.note ? ` — "${item.note}"` : ''}
                      </p>
                    </div>
                    <span className="font-mono-num font-bold text-sm text-amber-300 shrink-0">
                      +{item.pointsAwarded} pts
                    </span>
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
