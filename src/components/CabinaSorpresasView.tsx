import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  Ban,
  BookOpen,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  History,
  Lock,
  Maximize2,
  Minimize2,
  PackageOpen,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Unlock,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  getSurpriseCategoryMeta,
  SURPRISE_CATEGORIES,
  SURPRISE_OUTCOME_META,
  type SurpriseCategoryId,
  type SurpriseHistoryEntry,
  type SurpriseItem,
  type SurpriseResultOutcome,
} from '../shared/surpriseBoothData';
import { soundFX } from '../utils/sound';
import {
  MysteryBoxArtwork,
  type MysteryBoxVisualState,
} from './MysteryBoxArtwork';

export interface SurpriseBoothEmbeddedContext {
  programId?: string;
  programTitle?: string;
  centralTheme?: string;
}

interface CabinaSorpresasViewProps {
  onBack: () => void;
  embeddedContext?: SurpriseBoothEmbeddedContext;
}

const TIME_PRESETS = [0, 20, 30, 45, 60, 75, 90, 120, 180] as const;

const BIBLICAL_CATEGORY_IDS: SurpriseCategoryId[] = [
  'pregunta_biblica',
  'reto_relampago',
  'personaje_misterioso',
  'versiculo_sorpresa',
  'cultura_biblica',
  'reflexion_espiritual',
];

const DYNAMIC_CATEGORY_IDS: SurpriseCategoryId[] = [
  'duelo_equipos',
  'minuto_testimonios',
  'reto_creativo',
  'participacion_voluntario',
  'actividad_grupal',
  'mision_inesperada',
];

function formatMMSS(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function CabinaSorpresasView({
  onBack,
  embeddedContext,
}: CabinaSorpresasViewProps) {
  const [activeTab, setActiveTab] = useState<'stage' | 'library' | 'history'>(
    'stage'
  );

  // Library, exclusions, recent tracking & history from server
  const [items, setItems] = useState<SurpriseItem[]>([]);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [history, setHistory] = useState<SurpriseHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Director configuration
  const [enabledCategories, setEnabledCategories] = useState<
    SurpriseCategoryId[]
  >(() => SURPRISE_CATEGORIES.map((c) => c.id));
  const [configuredTimeSec, setConfiguredTimeSec] = useState<number>(0); // 0 = usar sugerido por actividad
  const [useSuspenseCountdown, setUseSuspenseCountdown] = useState(true);
  const [prepareBeforeRevealMode, setPrepareBeforeRevealMode] = useState(false);
  const [allowRepeatRecent, setAllowRepeatRecent] = useState(false);
  const [boothSoundsEnabled, setBoothSoundsEnabled] = useState(true);

  // Stage & Mystery Box state
  const [boxState, setBoxState] = useState<MysteryBoxVisualState>('idle');
  const [suspenseCount, setSuspenseCount] = useState<number | null>(null);
  const [sessionUsedIds, setSessionUsedIds] = useState<string[]>([]);
  const [lastCategoryId, setLastCategoryId] =
    useState<SurpriseCategoryId | null>(null);
  const [currentSurprise, setCurrentSurprise] = useState<SurpriseItem | null>(
    null
  );
  const [recycledNotice, setRecycledNotice] = useState<string | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);
  const [directorPeekOpen, setDirectorPeekOpen] = useState(false);
  const [showGuideHint, setShowGuideHint] = useState(false);

  // Activity countdown timer
  const [activityTotalSec, setActivityTotalSec] = useState(45);
  const [timeLeftSec, setTimeLeftSec] = useState(45);
  const [timerRunning, setTimerRunning] = useState(false);

  // Presentation / Projector mode
  const [fullscreenStage, setFullscreenStage] = useState(false);
  const [cleanAudienceMode, setCleanAudienceMode] = useState(false);

  // Result recording state
  const [participantName, setParticipantName] = useState('Sociedad de Jóvenes');
  const [outcome, setOutcome] = useState<SurpriseResultOutcome>('cumplido');
  const [pointsAwarded, setPointsAwarded] = useState<number>(
    SURPRISE_OUTCOME_META.cumplido.defaultPoints
  );
  const [resultNote, setResultNote] = useState('');
  const [savingResult, setSavingResult] = useState(false);
  const [recordedNotice, setRecordedNotice] = useState<string | null>(null);

  // Library filters & custom surprise form
  const [libSearch, setLibSearch] = useState('');
  const [libCategoryFilter, setLibCategoryFilter] = useState<
    'all' | SurpriseCategoryId
  >('all');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customCatId, setCustomCatId] =
    useState<SurpriseCategoryId>('pregunta_biblica');
  const [customTitle, setCustomTitle] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [customReference, setCustomReference] = useState('');
  const [customGuideHint, setCustomGuideHint] = useState('');
  const [customSuggestedSec, setCustomSuggestedSec] = useState(45);
  const [savingCustom, setSavingCustom] = useState(false);
  const [libraryMsg, setLibraryMsg] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const openingTimersRef = useRef<number[]>([]);
  const lastBeepSecRef = useRef<number | null>(null);

  const clearOpeningTimers = useCallback(() => {
    for (const id of openingTimersRef.current) {
      window.clearTimeout(id);
    }
    openingTimersRef.current = [];
  }, []);

  const fetchBoothState = useCallback(async () => {
    try {
      const res = await fetch('/api/surprise-booth/state');
      if (!res.ok) return;
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setExcludedIds(Array.isArray(data.excludedIds) ? data.excludedIds : []);
      setRecentIds(Array.isArray(data.recentIds) ? data.recentIds : []);
      setHistory(Array.isArray(data.history) ? data.history : []);
    } catch {
      // ignore transient network failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBoothState();
    return () => {
      clearOpeningTimers();
    };
  }, [fetchBoothState, clearOpeningTimers]);

  // Activity countdown loop
  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setTimeLeftSec((prev) => {
        const next = Math.max(0, prev - 1);
        if (
          boothSoundsEnabled &&
          next > 0 &&
          next <= 5 &&
          lastBeepSecRef.current !== next
        ) {
          lastBeepSecRef.current = next;
          soundFX.playTick();
        }
        if (next === 0) {
          setTimerRunning(false);
          if (boothSoundsEnabled) {
            soundFX.playTimeUp();
          }
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning, boothSoundsEnabled]);

  // Pool availability stats
  const poolStats = useMemo(() => {
    const catSet = new Set(enabledCategories);
    const exclSet = new Set(excludedIds);
    const recentSet = new Set(recentIds);
    const sessionSet = new Set(sessionUsedIds);

    const eligible = items.filter(
      (i) => catSet.has(i.categoryId) && !exclSet.has(i.id)
    );
    const fresh = eligible.filter(
      (i) => !recentSet.has(i.id) && !sessionSet.has(i.id)
    );
    return {
      totalEligible: eligible.length,
      freshAvailable: fresh.length,
      excludedCount: excludedIds.length,
    };
  }, [items, enabledCategories, excludedIds, recentIds, sessionUsedIds]);

  const toggleCategory = (catId: SurpriseCategoryId) => {
    setEnabledCategories((prev) => {
      const exists = prev.includes(catId);
      if (exists && prev.length <= 1) return prev;
      return exists
        ? prev.filter((id) => id !== catId)
        : SURPRISE_CATEGORIES.map((c) => c.id).filter(
            (id) => id === catId || prev.includes(id)
          );
    });
  };

  const applySurpriseTiming = useCallback(
    (item: SurpriseItem) => {
      const targetSec =
        configuredTimeSec > 0 ? configuredTimeSec : item.suggestedSec || 45;
      setActivityTotalSec(targetSec);
      setTimeLeftSec(targetSec);
      setTimerRunning(false);
      lastBeepSecRef.current = null;
    },
    [configuredTimeSec]
  );

  const runOpeningSequence = useCallback(
    (item: SurpriseItem) => {
      clearOpeningTimers();
      setBoxState('opening');
      setShowGuideHint(false);
      setRecordedNotice(null);
      setDirectorPeekOpen(false);
      applySurpriseTiming(item);

      if (boothSoundsEnabled) {
        soundFX.playSurpriseMysterySuspense();
      }

      const finishReveal = () => {
        setSuspenseCount(null);
        setBoxState('revealed');
        if (boothSoundsEnabled) {
          soundFX.playSurpriseReveal();
        }
        try {
          confetti({
            particleCount: 70,
            spread: 75,
            origin: { y: 0.56 },
          });
        } catch {
          // ignore confetti issue in headless environments
        }
      };

      if (!useSuspenseCountdown) {
        setSuspenseCount(null);
        const t = window.setTimeout(finishReveal, 850);
        openingTimersRef.current.push(t);
        return;
      }

      setSuspenseCount(3);
      if (boothSoundsEnabled) soundFX.playSurpriseCountdownTick(3);

      const t2 = window.setTimeout(() => {
        setSuspenseCount(2);
        if (boothSoundsEnabled) soundFX.playSurpriseCountdownTick(2);
      }, 650);

      const t1 = window.setTimeout(() => {
        setSuspenseCount(1);
        if (boothSoundsEnabled) soundFX.playSurpriseCountdownTick(1);
      }, 1300);

      const tReveal = window.setTimeout(finishReveal, 1950);
      openingTimersRef.current.push(t2, t1, tReveal);
    },
    [
      clearOpeningTimers,
      applySurpriseTiming,
      boothSoundsEnabled,
      useSuspenseCountdown,
    ]
  );

  const drawFromServer = async (): Promise<SurpriseItem | null> => {
    setStageError(null);
    setRecycledNotice(null);

    try {
      const res = await fetch('/api/surprise-booth/draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabledCategories,
          excludedIds,
          sessionUsedIds,
          allowRepeatRecent,
          lastCategoryId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.surprise) {
        setStageError(
          data.error || 'No se pudo obtener una sorpresa en este momento.'
        );
        return null;
      }

      const picked = data.surprise as SurpriseItem;
      setCurrentSurprise(picked);
      setLastCategoryId(picked.categoryId);
      setSessionUsedIds((prev) =>
        prev.includes(picked.id) ? prev : [...prev, picked.id]
      );
      if (Array.isArray(data.recentIds)) {
        setRecentIds(data.recentIds);
      }
      if (data.recycledPool && !allowRepeatRecent) {
        setRecycledNotice(
          'Todas las sorpresas de las categorías activas ya salieron recientemente; se seleccionó la menos reciente.'
        );
      }
      return picked;
    } catch {
      setStageError('Error de conexión al sortear la sorpresa.');
      return null;
    }
  };

  // Prepare mystery box in secret (director decides when to reveal)
  const handlePrepareSecretSurprise = async () => {
    if (boxState === 'opening') return;
    setTimerRunning(false);
    setRecordedNotice(null);
    const picked = await drawFromServer();
    if (!picked) return;
    applySurpriseTiming(picked);
    setBoxState('prepared');
    setDirectorPeekOpen(false);
    if (boothSoundsEnabled) {
      soundFX.playCategorySelect();
    }
  };

  // Main Mystery Box / Reveal Action
  const handleRevealAction = async () => {
    if (boxState === 'opening') return;

    // If a surprise was already prepared secretly inside the closed box, reveal it now!
    if (boxState === 'prepared' && currentSurprise) {
      runOpeningSequence(currentSurprise);
      return;
    }

    // Otherwise draw a fresh surprise and open immediately
    setTimerRunning(false);
    const picked = await drawFromServer();
    if (!picked) return;

    if (prepareBeforeRevealMode && boxState === 'idle') {
      applySurpriseTiming(picked);
      setBoxState('prepared');
      if (boothSoundsEnabled) {
        soundFX.playCategorySelect();
      }
      return;
    }

    runOpeningSequence(picked);
  };

  const handleCloseResetBooth = () => {
    clearOpeningTimers();
    setTimerRunning(false);
    setSuspenseCount(null);
    setBoxState('idle');
    setCurrentSurprise(null);
    setShowGuideHint(false);
    setDirectorPeekOpen(false);
    setRecordedNotice(null);
    setStageError(null);
  };

  const handleResetRecentHistory = async () => {
    try {
      const res = await fetch('/api/surprise-booth/reset-recent', {
        method: 'POST',
      });
      if (res.ok) {
        setRecentIds([]);
        setSessionUsedIds([]);
        setRecycledNotice(null);
      }
    } catch {
      // ignore
    }
  };

  const handleToggleExclusion = async (id: string) => {
    const next = excludedIds.includes(id)
      ? excludedIds.filter((eid) => eid !== id)
      : [...excludedIds, id];
    setExcludedIds(next);
    try {
      await fetch('/api/surprise-booth/exclusions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excludedIds: next }),
      });
    } catch {
      // ignore transient error
    }
  };

  const handleClearAllExclusions = async () => {
    setExcludedIds([]);
    try {
      await fetch('/api/surprise-booth/exclusions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excludedIds: [] }),
      });
    } catch {
      // ignore
    }
  };

  const handleOutcomeSelect = (nextOutcome: SurpriseResultOutcome) => {
    setOutcome(nextOutcome);
    setPointsAwarded(SURPRISE_OUTCOME_META[nextOutcome].defaultPoints);
  };

  const handleRecordResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSurprise || savingResult) return;
    setSavingResult(true);
    setStageError(null);

    const usedSec = Math.max(
      1,
      activityTotalSec > timeLeftSec
        ? activityTotalSec - timeLeftSec
        : activityTotalSec
    );

    try {
      const res = await fetch('/api/surprise-booth/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surpriseId: currentSurprise.id,
          categoryId: currentSurprise.categoryId,
          title: currentSurprise.title,
          participantName: participantName.trim() || 'Sociedad de Jóvenes',
          outcome,
          pointsAwarded,
          durationUsedSec: usedSec,
          note: resultNote.trim(),
          ...(embeddedContext?.programId
            ? { programId: embeddedContext.programId }
            : {}),
          ...(embeddedContext?.programTitle
            ? { programTitle: embeddedContext.programTitle }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.entry) {
        setStageError(data.error || 'No se pudo registrar el resultado.');
        return;
      }

      setHistory((prev) => [data.entry as SurpriseHistoryEntry, ...prev]);
      setRecordedNotice(
        `Resultado guardado: ${data.entry.participantName} · ${SURPRISE_OUTCOME_META[outcome].label} (${pointsAwarded} pts)`
      );
      setResultNote('');
      setTimerRunning(false);
      if (boothSoundsEnabled) {
        soundFX.playCorrect();
      }
    } catch {
      setStageError('Error de red al guardar el resultado.');
    } finally {
      setSavingResult(false);
    }
  };

  const handleCreateCustomSurprise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingCustom) return;
    setSavingCustom(true);
    setLibraryMsg(null);

    try {
      const res = await fetch('/api/surprise-booth/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: customCatId,
          title: customTitle.trim(),
          instructions: customInstructions.trim(),
          reference: customReference.trim() || 'Palabra de Dios',
          guideHint: customGuideHint.trim(),
          suggestedSec: customSuggestedSec,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.item) {
        setLibraryMsg(data.error || 'Verifica los campos de la sorpresa.');
        return;
      }

      setItems((prev) => [data.item as SurpriseItem, ...prev]);
      setCustomTitle('');
      setCustomInstructions('');
      setCustomReference('');
      setCustomGuideHint('');
      setShowCustomForm(false);
      setLibraryMsg('Sorpresa personalizada agregada a la Cabina.');
    } catch {
      setLibraryMsg('Error de conexión al guardar la sorpresa.');
    } finally {
      setSavingCustom(false);
    }
  };

  const handleDeleteCustomSurprise = async (id: string) => {
    try {
      const res = await fetch(
        `/api/surprise-booth/custom/${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        setItems((prev) => prev.filter((item) => item.id !== id));
        setExcludedIds((prev) => prev.filter((eid) => eid !== id));
      }
    } catch {
      // ignore
    }
  };

  const enterFullscreen = async () => {
    setFullscreenStage(true);
    try {
      if (!document.fullscreenElement && stageRef.current?.requestFullscreen) {
        await stageRef.current.requestFullscreen();
      }
    } catch {
      // Fallback overlay handles projection cleanly even if fullscreen API is blocked
    }
  };

  const exitFullscreen = async () => {
    setFullscreenStage(false);
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      // ignore
    }
  };

  const filteredLibrary = useMemo(() => {
    const q = libSearch.trim().toLowerCase();
    return items.filter((item) => {
      if (libCategoryFilter !== 'all' && item.categoryId !== libCategoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.instructions.toLowerCase().includes(q) ||
        item.reference.toLowerCase().includes(q)
      );
    });
  }, [items, libCategoryFilter, libSearch]);

  const currentCatMeta = currentSurprise
    ? getSurpriseCategoryMeta(currentSurprise.categoryId)
    : null;

  const timerProgressPct =
    activityTotalSec > 0
      ? Math.max(0, Math.min(100, (timeLeftSec / activityTotalSec) * 100))
      : 0;

  const isTimerDanger = timeLeftSec <= 5 && boxState === 'revealed';

  // Reusable Stage Presentation Card (used in both normal stage & full-screen projector)
  const renderStageCanvas = (isProjector: boolean) => (
    <div
      className={`relative rounded-3xl border overflow-hidden ${
        isProjector
          ? 'bg-gradient-to-b from-[#0E1832] via-[#091124] to-[#050914] border-amber-400/35 p-6 sm:p-10 flex-1 flex flex-col justify-center'
          : 'bg-gradient-to-br from-[#131F3D] via-[#0E172E] to-[#091022] border-amber-400/35 p-6 sm:p-8'
      }`}
    >
      {/* STATE 1 & 2 & 3: MYSTERY BOX CLOSED / PREPARED / OPENING */}
      {boxState !== 'revealed' && (
        <div className="flex flex-col items-center text-center space-y-6 py-4">
          <div className="space-y-1.5 max-w-xl">
            <p className="text-xs sm:text-sm font-bold uppercase tracking-widest text-amber-300">
              {boxState === 'opening'
                ? 'Abriendo Cabina de Sorpresas...'
                : boxState === 'prepared'
                  ? 'Sorpresa Lista en la Cabina'
                  : 'Momento Inesperado del Programa'}
            </p>
            <h2
              className={`font-display font-extrabold text-white text-balance ${
                isProjector ? 'text-3xl sm:text-5xl' : 'text-2xl sm:text-4xl'
              }`}
            >
              {boxState === 'opening'
                ? '¡Prepárate para la Sorpresa!'
                : boxState === 'prepared'
                  ? '¿Qué habrá dentro de la Cabina hoy?'
                  : 'Cabina de Sorpresas del Sábado'}
            </h2>
            <p className="text-sm sm:text-base text-slate-300">
              {boxState === 'opening'
                ? 'Descubriendo la actividad sorpresa para la Sociedad de Jóvenes...'
                : boxState === 'prepared'
                  ? 'El director ha preparado una sorpresa. Cuando dé la señal, se revelará ante todos.'
                  : 'Pulsa la caja misteriosa o el botón de revelar para descubrir una actividad inesperada.'}
            </p>
          </div>

          <MysteryBoxArtwork
            state={boxState}
            suspenseNumber={suspenseCount}
            size={isProjector ? 290 : 230}
            onClick={
              boxState === 'opening' ? undefined : () => void handleRevealAction()
            }
            disabled={boxState === 'opening' || poolStats.totalEligible === 0}
          />

          {/* Director secret preview option when prepared */}
          {boxState === 'prepared' &&
            currentSurprise &&
            !cleanAudienceMode && (
              <div className="bg-[#080E1E]/85 border border-slate-700 rounded-2xl px-4 py-3 max-w-md w-full space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-amber-300">
                    Control Privado del Director
                  </span>
                  <button
                    type="button"
                    onClick={() => setDirectorPeekOpen((v) => !v)}
                    className="text-sky-300 hover:text-sky-200 font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    {directorPeekOpen ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        Ocultar vista previa
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        Ver qué salió
                      </>
                    )}
                  </button>
                </div>
                {directorPeekOpen && (
                  <div className="text-left text-xs text-slate-300 border-t border-slate-800 pt-2 space-y-1">
                    <p className="font-bold text-white">
                      {getSurpriseCategoryMeta(currentSurprise.categoryId).label}{' '}
                      · {currentSurprise.title}
                    </p>
                    <p className="text-slate-400 line-clamp-2">
                      {currentSurprise.instructions}
                    </p>
                  </div>
                )}
              </div>
            )}

          {/* Primary Stage Buttons */}
          {(!isProjector || !cleanAudienceMode) && (
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button
                type="button"
                disabled={
                  boxState === 'opening' || poolStats.totalEligible === 0
                }
                onClick={() => void handleRevealAction()}
                className="px-7 py-4 rounded-2xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-display font-extrabold text-base sm:text-lg inline-flex items-center gap-2.5 cursor-pointer shadow-lg shadow-amber-500/20 transition-colors whitespace-nowrap"
              >
                <PackageOpen className="w-5 h-5" />
                {boxState === 'opening'
                  ? 'Abriendo cabina...'
                  : boxState === 'prepared'
                    ? '¡Revelar Sorpresa Ahora!'
                    : 'Revelar Sorpresa'}
              </button>

              {boxState === 'idle' && (
                <button
                  type="button"
                  disabled={poolStats.totalEligible === 0}
                  onClick={() => void handlePrepareSecretSurprise()}
                  className="px-5 py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-slate-100 font-bold text-sm inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <Lock className="w-4 h-4 text-amber-300" />
                  Preparar en Suspenso
                </button>
              )}

              {boxState === 'prepared' && (
                <button
                  type="button"
                  onClick={() => void handlePrepareSecretSurprise()}
                  className="px-4 py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-sm inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className="w-4 h-4 text-sky-400" />
                  Cambiar en secreto
                </button>
              )}
            </div>
          )}

          <p className="text-xs text-slate-400 font-mono-num">
            {poolStats.freshAvailable} sorpresas nuevas disponibles ·{' '}
            {poolStats.totalEligible} activas en {enabledCategories.length}{' '}
            categorías
          </p>
        </div>
      )}

      {/* STATE 4: SURPRISE REVEALED */}
      {boxState === 'revealed' && currentSurprise && currentCatMeta && (
        <div className="animate-surprise-reveal space-y-6">
          {/* Category + Countdown Top Row */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`px-4 py-1.5 rounded-xl border text-xs sm:text-sm font-extrabold ${currentCatMeta.badgeClass}`}
              >
                {currentCatMeta.label}
              </span>
              <span className="text-xs text-slate-400 font-mono-num">
                Tiempo asignado: {activityTotalSec}s
              </span>
            </div>

            <div className="flex items-center gap-2.5 bg-[#080E1E] border border-slate-700 px-4 py-2 rounded-2xl">
              <Clock
                className={`w-5 h-5 ${
                  isTimerDanger ? 'text-rose-400' : 'text-amber-300'
                }`}
              />
              <span
                className={`font-mono-num font-extrabold tabular-nums ${
                  isProjector ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl'
                } ${
                  timeLeftSec === 0
                    ? 'text-rose-400'
                    : isTimerDanger
                      ? 'text-rose-300'
                      : timerRunning
                        ? 'text-emerald-300'
                        : 'text-white'
                }`}
              >
                {formatMMSS(timeLeftSec)}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-3 rounded-full bg-slate-800/90 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ease-linear rounded-full ${
                timeLeftSec <= 5
                  ? 'bg-rose-500'
                  : timeLeftSec <= 15
                    ? 'bg-amber-400'
                    : 'bg-sky-400'
              }`}
              style={{ width: `${timerProgressPct}%` }}
            />
          </div>

          {/* Main Surprise Content */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-3 flex justify-center">
              <MysteryBoxArtwork
                state="revealed"
                accentColor={currentCatMeta.color}
                size={isProjector ? 200 : 165}
              />
            </div>

            <div className="lg:col-span-9 space-y-4">
              <h2
                className={`font-display font-extrabold text-white leading-tight text-balance ${
                  isProjector ? 'text-3xl sm:text-5xl' : 'text-2xl sm:text-4xl'
                }`}
              >
                {currentSurprise.title}
              </h2>

              <div className="bg-[#080E1E]/75 border border-slate-800 rounded-2xl p-5 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-sky-400">
                  Instrucciones de la Sorpresa
                </p>
                <p
                  className={`text-slate-100 leading-relaxed ${
                    isProjector
                      ? 'text-lg sm:text-2xl'
                      : 'text-base sm:text-lg'
                  }`}
                >
                  {currentSurprise.instructions}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm sm:text-base font-semibold text-amber-300 inline-flex items-center gap-2">
                  <BookOpen className="w-4 h-4 shrink-0" />
                  Referencia bíblica: {currentSurprise.reference}
                </p>

                {currentSurprise.guideHint && !cleanAudienceMode && (
                  <button
                    type="button"
                    onClick={() => setShowGuideHint((v) => !v)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {showGuideHint ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        Ocultar respuesta / guía
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5 text-amber-300" />
                        Ver guía del director
                      </>
                    )}
                  </button>
                )}
              </div>

              {showGuideHint &&
                currentSurprise.guideHint &&
                !cleanAudienceMode && (
                  <div className="bg-amber-500/10 border border-amber-400/35 rounded-xl px-4 py-3 text-xs sm:text-sm text-amber-100">
                    <span className="font-bold text-amber-300">
                      Guía del Director:
                    </span>{' '}
                    {currentSurprise.guideHint}
                  </div>
                )}
            </div>
          </div>

          {recycledNotice && !cleanAudienceMode && (
            <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-400/30 rounded-xl px-3.5 py-2">
              {recycledNotice}
            </p>
          )}

          {recordedNotice && (
            <div className="bg-emerald-500/15 border border-emerald-400/45 rounded-2xl px-4 py-3 text-sm text-emerald-200 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{recordedNotice}</span>
            </div>
          )}

          {/* Director Live Controls Bar */}
          {(!isProjector || !cleanAudienceMode) && (
            <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTimerRunning((r) => !r)}
                  className={`px-5 py-3 rounded-xl font-display font-extrabold text-sm inline-flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                    timerRunning
                      ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                  }`}
                >
                  {timerRunning ? (
                    <>
                      <Pause className="w-4 h-4 fill-current" />
                      Pausar reloj
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      {timeLeftSec === activityTotalSec
                        ? 'Iniciar cuenta regresiva'
                        : 'Reanudar reloj'}
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTimerRunning(false);
                    setTimeLeftSec(activityTotalSec);
                    lastBeepSecRef.current = null;
                  }}
                  className="px-3.5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reiniciar
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setTimeLeftSec((prev) => Math.max(0, prev - 15))
                  }
                  className="px-3 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono-num text-xs font-bold cursor-pointer"
                >
                  -15s
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTimeLeftSec((prev) => {
                      const next = prev + 15;
                      setActivityTotalSec((tot) => Math.max(tot, next));
                      return next;
                    });
                  }}
                  className="px-3 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono-num text-xs font-bold cursor-pointer"
                >
                  +15s
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleRevealAction()}
                  className="px-4 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-xs sm:text-sm inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Sparkles className="w-4 h-4" />
                  Nueva Sorpresa
                </button>
                <button
                  type="button"
                  onClick={handleCloseResetBooth}
                  className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-bold cursor-pointer whitespace-nowrap"
                >
                  Cerrar Cabina
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div
      ref={stageRef}
      className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6"
    >
      {/* FULL-SCREEN PROJECTOR PRESENTATION OVERLAY */}
      {fullscreenStage && (
        <div className="fixed inset-0 z-50 bg-[#050914] text-white p-5 sm:p-8 flex flex-col justify-between gap-6 overflow-y-auto">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-300 truncate">
                {embeddedContext?.programTitle
                  ? `Programa del Sábado · ${embeddedContext.programTitle}`
                  : 'Dime Tú Qué Dices · Sociedad de Jóvenes'}
              </p>
              <h2 className="font-display text-xl sm:text-2xl font-extrabold text-white">
                Cabina de Sorpresas en Vivo
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setCleanAudienceMode((v) => !v)}
                className={`px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  cleanAudienceMode
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                    : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                }`}
              >
                {cleanAudienceMode ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
                {cleanAudienceMode
                  ? 'Vista Proyección Limpia'
                  : 'Controles Visibles'}
              </button>

              <button
                type="button"
                onClick={() => void exitFullscreen()}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <Minimize2 className="w-4 h-4" />
                Salir de Proyección
              </button>
            </div>
          </div>

          <div className="max-w-5xl w-full mx-auto flex-1 flex flex-col justify-center">
            {renderStageCanvas(true)}
          </div>
        </div>
      )}

      {/* MODULE HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-xl bg-[#111A2E] hover:bg-slate-800 border border-slate-800 text-slate-200 cursor-pointer"
            title={
              embeddedContext
                ? 'Volver al Programa del Sábado'
                : 'Volver al inicio'
            }
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
              {embeddedContext?.programTitle
                ? `Integrado en Programa del Sábado · ${embeddedContext.programTitle}`
                : 'Sociedad de Jóvenes · Momentos Inesperados'}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
              Cabina de Sorpresas
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setBoothSoundsEnabled((v) => !v)}
            className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              boothSoundsEnabled
                ? 'bg-[#111A2E] border-slate-700 text-amber-300'
                : 'bg-[#111A2E] border-slate-800 text-slate-400'
            }`}
          >
            {boothSoundsEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
            {boothSoundsEnabled ? 'Sonido Activo' : 'Silenciado'}
          </button>

          <button
            type="button"
            onClick={() => void enterFullscreen()}
            className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-display font-extrabold text-xs sm:text-sm inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <Maximize2 className="w-4 h-4" />
            Proyectar Pantalla Completa
          </button>
        </div>
      </div>

      {/* SUB-NAVIGATION TABS */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {[
          {
            id: 'stage',
            label: 'Cabina en Vivo',
            icon: PackageOpen,
          },
          {
            id: 'library',
            label: `Biblioteca y Exclusiones (${items.length})`,
            icon: Settings2,
          },
          {
            id: 'history',
            label: `Resultados Registrados (${history.length})`,
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
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
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

      {stageError && (
        <div className="bg-rose-500/15 border border-rose-400/50 rounded-2xl px-4 py-3 text-sm text-rose-200">
          {stageError}
        </div>
      )}

      {/* TAB 1: LIVE SURPRISE BOOTH STAGE & DIRECTOR CONTROLS */}
      {activeTab === 'stage' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left / Main Stage Area */}
          <div className="lg:col-span-8 space-y-5">
            {renderStageCanvas(false)}

            {/* Result Recording Panel when Surprise is Revealed */}
            {boxState === 'revealed' && currentSurprise && (
              <form
                onSubmit={handleRecordResult}
                className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display font-bold text-lg text-white">
                      Registrar Resultado de la Sorpresa
                    </h3>
                    <p className="text-xs text-slate-400">
                      Guarda quién participó y cómo resultó este momento inesperado.
                    </p>
                  </div>
                  <span className="text-xs font-mono-num text-amber-300">
                    {formatMMSS(
                      Math.max(
                        1,
                        activityTotalSec > timeLeftSec
                          ? activityTotalSec - timeLeftSec
                          : activityTotalSec
                      )
                    )}{' '}
                    transcurrido
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">
                      Participante, voluntario o equipo
                    </label>
                    <input
                      type="text"
                      value={participantName}
                      onChange={(e) => setParticipantName(e.target.value)}
                      placeholder="Ej: Equipo Águilas, María, Toda la juventud..."
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {[
                        'Sociedad de Jóvenes',
                        'Equipo 1',
                        'Equipo 2',
                        'Voluntario',
                      ].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setParticipantName(preset)}
                          className="px-2.5 py-1 rounded-lg bg-[#080E1E] hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 cursor-pointer"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">
                      Puntos otorgados (opcional)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10000}
                      step={50}
                      value={pointsAwarded}
                      onChange={(e) =>
                        setPointsAwarded(Math.max(0, Number(e.target.value) || 0))
                      }
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono-num font-bold focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1.5">
                    Valoración del resultado
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(
                      Object.keys(
                        SURPRISE_OUTCOME_META
                      ) as SurpriseResultOutcome[]
                    ).map((key) => {
                      const meta = SURPRISE_OUTCOME_META[key];
                      const active = outcome === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => handleOutcomeSelect(key)}
                          className={`px-3 py-2.5 rounded-xl border text-xs font-bold text-center cursor-pointer transition-colors ${
                            active
                              ? meta.colorClass
                              : 'bg-[#080E1E] border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">
                    Nota del director (opcional)
                  </label>
                  <input
                    type="text"
                    value={resultNote}
                    onChange={(e) => setResultNote(e.target.value)}
                    placeholder="Observación breve sobre la respuesta o participación..."
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="submit"
                    disabled={savingResult}
                    className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-display font-extrabold text-sm inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {savingResult ? 'Guardando...' : 'Guardar Resultado'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Right Sidebar: Director Control Panel */}
          <aside className="lg:col-span-4 space-y-5">
            {/* Timing & Reveal Behavior */}
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="font-display font-bold text-base text-white flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-amber-300" />
                Control del Director
              </h3>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 block">
                  Tiempo disponible para la sorpresa
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {TIME_PRESETS.map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => {
                        setConfiguredTimeSec(sec);
                        if (boxState === 'revealed' && currentSurprise) {
                          const target =
                            sec > 0 ? sec : currentSurprise.suggestedSec || 45;
                          setActivityTotalSec(target);
                          setTimeLeftSec(target);
                          setTimerRunning(false);
                        }
                      }}
                      className={`py-2 rounded-xl border text-xs font-bold font-mono-num cursor-pointer transition-colors ${
                        configuredTimeSec === sec
                          ? 'bg-amber-400 text-slate-950 border-amber-300'
                          : 'bg-[#080E1E] text-slate-300 border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      {sec === 0 ? 'Sugerido' : `${sec}s`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center justify-between gap-2 bg-[#080E1E] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-200 cursor-pointer">
                  <span>Cuenta regresiva de apertura (3-2-1)</span>
                  <input
                    type="checkbox"
                    checked={useSuspenseCountdown}
                    onChange={(e) => setUseSuspenseCountdown(e.target.checked)}
                    className="accent-amber-400 w-4 h-4"
                  />
                </label>

                <label className="flex items-center justify-between gap-2 bg-[#080E1E] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-200 cursor-pointer">
                  <span>Preparar antes y revelar cuando yo decida</span>
                  <input
                    type="checkbox"
                    checked={prepareBeforeRevealMode}
                    onChange={(e) =>
                      setPrepareBeforeRevealMode(e.target.checked)
                    }
                    className="accent-amber-400 w-4 h-4"
                  />
                </label>

                <label className="flex items-center justify-between gap-2 bg-[#080E1E] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-200 cursor-pointer">
                  <span>Permitir repetir sorpresas recientes</span>
                  <input
                    type="checkbox"
                    checked={allowRepeatRecent}
                    onChange={(e) => setAllowRepeatRecent(e.target.checked)}
                    className="accent-sky-400 w-4 h-4"
                  />
                </label>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-400">
                  Recientes bloqueadas:{' '}
                  <strong className="text-white font-mono-num">
                    {recentIds.length}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => void handleResetRecentHistory()}
                  className="text-sky-300 hover:text-sky-200 font-semibold cursor-pointer"
                >
                  Reiniciar variedad
                </button>
              </div>
            </div>

            {/* Category Selector */}
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display font-bold text-base text-white">
                  Tipos de Sorpresas ({enabledCategories.length}/12)
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    setEnabledCategories(
                      SURPRISE_CATEGORIES.map((c) => c.id)
                    )
                  }
                  className="text-xs font-semibold text-amber-300 hover:text-amber-200 cursor-pointer"
                >
                  Activar todas
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setEnabledCategories(BIBLICAL_CATEGORY_IDS)}
                  className="px-2.5 py-1 rounded-lg bg-[#080E1E] hover:bg-slate-800 border border-slate-800 text-[11px] font-semibold text-sky-300 cursor-pointer"
                >
                  Solo bíblicas
                </button>
                <button
                  type="button"
                  onClick={() => setEnabledCategories(DYNAMIC_CATEGORY_IDS)}
                  className="px-2.5 py-1 rounded-lg bg-[#080E1E] hover:bg-slate-800 border border-slate-800 text-[11px] font-semibold text-emerald-300 cursor-pointer"
                >
                  Solo dinámicas
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5 max-h-[340px] overflow-y-auto pr-1">
                {SURPRISE_CATEGORIES.map((cat) => {
                  const active = enabledCategories.includes(cat.id);
                  const countInCat = items.filter(
                    (i) =>
                      i.categoryId === cat.id && !excludedIds.includes(i.id)
                  ).length;

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      className={`px-3 py-2 rounded-xl border text-left text-xs font-semibold flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                        active
                          ? 'bg-[#080E1E] border-amber-400/50 text-white'
                          : 'bg-[#080E1E]/40 border-slate-800 text-slate-500 opacity-60'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="truncate">{cat.label}</span>
                      </span>
                      <span className="font-mono-num text-[11px] text-slate-400 shrink-0">
                        {countInCat}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* TAB 2: LIBRARY, EXCLUSIONS & CUSTOM SURPRISES */}
      {activeTab === 'library' && (
        <section className="space-y-5">
          <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={libSearch}
                  onChange={(e) => setLibSearch(e.target.value)}
                  placeholder="Buscar por título, instrucción o cita bíblica..."
                  className="w-full bg-[#080E1E] border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <select
                value={libCategoryFilter}
                onChange={(e) =>
                  setLibCategoryFilter(
                    e.target.value as 'all' | SurpriseCategoryId
                  )
                }
                className="bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
              >
                <option value="all">Todas las categorías (12)</option>
                {SURPRISE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {excludedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => void handleClearAllExclusions()}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-300 cursor-pointer whitespace-nowrap"
                >
                  Restaurar {excludedIds.length} excluidas
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowCustomForm((v) => !v)}
                className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-xs sm:text-sm inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Agregar Sorpresa Propia
              </button>
            </div>
          </div>

          {libraryMsg && (
            <div className="bg-emerald-500/15 border border-emerald-400/40 rounded-xl px-4 py-3 text-sm text-emerald-200">
              {libraryMsg}
            </div>
          )}

          {/* Create Custom Surprise Form */}
          {showCustomForm && (
            <form
              onSubmit={handleCreateCustomSurprise}
              className="bg-[#111A2E] border border-amber-400/45 rounded-2xl p-5 sm:p-6 space-y-4"
            >
              <h3 className="font-display font-bold text-lg text-white">
                Nueva Sorpresa Personalizada
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">
                    Tipo de sorpresa
                  </label>
                  <select
                    value={customCatId}
                    onChange={(e) =>
                      setCustomCatId(e.target.value as SurpriseCategoryId)
                    }
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
                  >
                    {SURPRISE_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">
                    Título de la sorpresa
                  </label>
                  <input
                    type="text"
                    required
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Ej: Pregunta especial de Romanos 8"
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">
                    Tiempo sugerido (seg)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={300}
                    value={customSuggestedSec}
                    onChange={(e) =>
                      setCustomSuggestedSec(Number(e.target.value) || 45)
                    }
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono-num"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Instrucciones para los participantes
                </label>
                <textarea
                  rows={3}
                  required
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="Describe claramente qué deben hacer o responder al abrirse la cabina..."
                  className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">
                    Cita bíblica
                  </label>
                  <input
                    type="text"
                    value={customReference}
                    onChange={(e) => setCustomReference(e.target.value)}
                    placeholder="Ej: Romanos 8:28"
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">
                    Respuesta o guía para el director (opcional)
                  </label>
                  <input
                    type="text"
                    value={customGuideHint}
                    onChange={(e) => setCustomGuideHint(e.target.value)}
                    placeholder="Visible solo cuando el director la active"
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomForm(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCustom}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold cursor-pointer"
                >
                  {savingCustom ? 'Guardando...' : 'Guardar en Biblioteca'}
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400">
              Cargando biblioteca de sorpresas...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredLibrary.map((item) => {
                const catMeta = getSurpriseCategoryMeta(item.categoryId);
                const isExcluded = excludedIds.includes(item.id);
                const isRecent = recentIds.includes(item.id);

                return (
                  <article
                    key={item.id}
                    className={`bg-[#111A2E] border rounded-2xl p-5 flex flex-col justify-between gap-4 transition-colors ${
                      isExcluded
                        ? 'border-rose-500/35 opacity-60'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                        <span className="font-bold text-slate-200 inline-flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: catMeta.color }}
                          />
                          {catMeta.label}
                        </span>
                        <span className="font-mono-num">
                          {item.suggestedSec}s
                          {isRecent ? ' · Reciente' : ''}
                          {item.isCustom ? ' · Personalizada' : ''}
                        </span>
                      </div>

                      <h4 className="font-display font-bold text-lg text-white">
                        {item.title}
                      </h4>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {item.instructions}
                      </p>
                      <p className="text-xs font-semibold text-amber-300">
                        {item.reference}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => void handleToggleExclusion(item.id)}
                        className={`px-3 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                          isExcluded
                            ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/25'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-rose-500/15 hover:border-rose-400/40 hover:text-rose-200'
                        }`}
                      >
                        {isExcluded ? (
                          <>
                            <Unlock className="w-3.5 h-3.5" />
                            Volver a incluir
                          </>
                        ) : (
                          <>
                            <Ban className="w-3.5 h-3.5" />
                            Excluir actividad
                          </>
                        )}
                      </button>

                      {item.isCustom && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteCustomSurprise(item.id)}
                          className="p-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 cursor-pointer"
                          title="Eliminar sorpresa personalizada"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* TAB 3: HISTORY OF RESULTS */}
      {activeTab === 'history' && (
        <section className="space-y-4">
          {history.length === 0 ? (
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-10 text-center space-y-2">
              <PackageOpen className="w-10 h-10 text-amber-400 mx-auto" />
              <h3 className="font-display font-bold text-xl text-white">
                Aún no hay sorpresas registradas
              </h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Cuando reveles una sorpresa en la Cabina en Vivo y registres el
                resultado, aparecerá aquí con fecha, participante y puntos.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {history.map((entry) => {
                const catMeta = getSurpriseCategoryMeta(entry.categoryId);
                const outMeta = SURPRISE_OUTCOME_META[entry.outcome];
                return (
                  <article
                    key={entry.id}
                    className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                      <span className="font-semibold text-slate-200 inline-flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: catMeta.color }}
                        />
                        {catMeta.label}
                      </span>
                      <span className="font-mono-num">
                        {new Date(entry.createdAt).toLocaleString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-display font-bold text-lg text-white">
                        {entry.title}
                      </h4>
                      <p className="text-sm text-sky-300 font-semibold mt-0.5">
                        {entry.participantName}
                      </p>
                      {entry.programTitle && (
                        <p className="text-xs text-amber-300 mt-0.5">
                          Programa: {entry.programTitle}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs">
                      <span
                        className={`px-2.5 py-1 rounded-lg border font-bold ${outMeta.colorClass}`}
                      >
                        {outMeta.label}
                      </span>
                      <div className="font-mono-num text-slate-300">
                        <strong className="text-amber-300">
                          {entry.pointsAwarded} pts
                        </strong>{' '}
                        · {entry.durationUsedSec}s
                      </div>
                    </div>

                    {entry.note && (
                      <p className="text-xs text-slate-300 bg-[#080E1E] border border-slate-800 rounded-xl px-3 py-2">
                        {entry.note}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
