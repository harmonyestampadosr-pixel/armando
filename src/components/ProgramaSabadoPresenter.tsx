import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  BellOff,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  PackageOpen,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Volume2,
} from 'lucide-react';
import {
  SATURDAY_CATEGORY_META,
  SaturdayProgram,
} from '../shared/saturdayProgramTypes';
import { soundFX } from '../utils/sound';
import { CabinaSorpresasView } from './CabinaSorpresasView';

interface ProgramaSabadoPresenterProps {
  program: SaturdayProgram;
  onExitPresentation: () => void;
}

function formatMMSS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function ProgramaSabadoPresenter({
  program,
  onExitPresentation,
}: ProgramaSabadoPresenterProps) {
  const activities = program.activities;
  const [activeIdx, setActiveIdx] = useState(0);
  const safeIdx = Math.min(Math.max(0, activeIdx), Math.max(0, activities.length - 1));
  const currentActivity = activities[safeIdx] || null;
  const nextActivity = activities[safeIdx + 1] || null;

  const [secondsLeft, setSecondsLeft] = useState<number>(
    () => (activities[0]?.durationMin || 5) * 60
  );
  const [activityTotalSec, setActivityTotalSec] = useState<number>(
    () => (activities[0]?.durationMin || 5) * 60
  );
  const [isRunning, setIsRunning] = useState(false);

  // Configurable sound & stage preferences
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [warningSecBefore, setWarningSecBefore] = useState<0 | 30 | 60 | 120>(60);
  const [finalTicksEnabled, setFinalTicksEnabled] = useState(true);
  const [endBellEnabled, setEndBellEnabled] = useState(true);
  const [autoAdvance, setAutoAdvance] = useState(false);

  // Display modes
  const [fullscreenOverlay, setFullscreenOverlay] = useState(true);
  const [cleanAudienceMode, setCleanAudienceMode] = useState(false);
  const [showAgendaDrawer, setShowAgendaDrawer] = useState(true);
  const [showSurpriseBooth, setShowSurpriseBooth] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const firedWarningRef = useRef(false);
  const firedEndRef = useRef(false);

  // Reset timer cleanly whenever active activity changes
  const selectActivity = (idx: number, autoStart = false) => {
    const bounded = Math.min(Math.max(0, idx), Math.max(0, activities.length - 1));
    const sec = Math.max(60, (activities[bounded]?.durationMin || 5) * 60);
    setActiveIdx(bounded);
    setActivityTotalSec(sec);
    setSecondsLeft(sec);
    setIsRunning(autoStart);
    firedWarningRef.current = false;
    firedEndRef.current = false;
  };

  const handleReset = () => {
    if (!currentActivity) return;
    const sec = Math.max(60, currentActivity.durationMin * 60);
    setActivityTotalSec(sec);
    setSecondsLeft(sec);
    setIsRunning(false);
    firedWarningRef.current = false;
    firedEndRef.current = false;
  };

  const handleAdjustSeconds = (deltaSec: number) => {
    setSecondsLeft((prev) => {
      const next = Math.max(0, prev + deltaSec);
      setActivityTotalSec((tot) => Math.max(tot, next));
      if (next > warningSecBefore) firedWarningRef.current = false;
      if (next > 0) firedEndRef.current = false;
      return next;
    });
  };

  // Countdown tick loop
  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  // Sound cues & end-of-activity transition handling
  useEffect(() => {
    if (!isRunning) return;

    if (
      soundEnabled &&
      warningSecBefore > 0 &&
      secondsLeft === warningSecBefore &&
      activityTotalSec > warningSecBefore &&
      !firedWarningRef.current
    ) {
      firedWarningRef.current = true;
      soundFX.playProgramWarningBell();
    }

    if (
      soundEnabled &&
      finalTicksEnabled &&
      secondsLeft > 0 &&
      secondsLeft <= 5
    ) {
      soundFX.playProgramTick();
    }

    if (secondsLeft === 0 && !firedEndRef.current) {
      firedEndRef.current = true;
      if (soundEnabled && endBellEnabled) {
        soundFX.playProgramStageEnd();
      }
      if (autoAdvance && safeIdx < activities.length - 1) {
        const t = window.setTimeout(() => {
          selectActivity(safeIdx + 1, true);
        }, 1400);
        return () => window.clearTimeout(t);
      } else {
        setIsRunning(false);
      }
    }
  }, [
    secondsLeft,
    isRunning,
    soundEnabled,
    warningSecBefore,
    finalTicksEnabled,
    endBellEnabled,
    autoAdvance,
    safeIdx,
    activities.length,
    activityTotalSec,
  ]);

  // Keyboard shortcuts for presenter convenience
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsRunning((r) => !r);
      } else if (e.code === 'ArrowRight') {
        if (safeIdx < activities.length - 1) selectActivity(safeIdx + 1, false);
      } else if (e.code === 'ArrowLeft') {
        if (safeIdx > 0) selectActivity(safeIdx - 1, false);
      } else if (e.key === 'r' || e.key === 'R') {
        handleReset();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const toggleBrowserFullscreen = async () => {
    try {
      if (!document.fullscreenElement && stageRef.current?.requestFullscreen) {
        await stageRef.current.requestFullscreen();
        setFullscreenOverlay(true);
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        setFullscreenOverlay((v) => !v);
      }
    } catch {
      setFullscreenOverlay((v) => !v);
    }
  };

  if (!currentActivity) {
    return (
      <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-8 text-center space-y-4">
        <p className="text-slate-300">Este programa no tiene actividades todavía.</p>
        <button
          type="button"
          onClick={onExitPresentation}
          className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer"
        >
          Volver al Editor
        </button>
      </div>
    );
  }

  const meta =
    SATURDAY_CATEGORY_META[currentActivity.category] ||
    SATURDAY_CATEGORY_META.personalizada;
  const nextMeta = nextActivity
    ? SATURDAY_CATEGORY_META[nextActivity.category] ||
      SATURDAY_CATEGORY_META.personalizada
    : null;

  const progressPct =
    activityTotalSec > 0
      ? Math.max(0, Math.min(100, (secondsLeft / activityTotalSec) * 100))
      : 0;
  const isFinalMoment = secondsLeft <= 10;
  const isWarningZone =
    warningSecBefore > 0 && secondsLeft > 10 && secondsLeft <= warningSecBefore;

  const timerTextClass = isFinalMoment
    ? 'text-rose-400'
    : isWarningZone
      ? 'text-amber-300'
      : isRunning
        ? 'text-emerald-300'
        : 'text-white';

  const progressColor = isFinalMoment
    ? 'bg-rose-500'
    : isWarningZone
      ? 'bg-amber-400'
      : 'bg-sky-400';

  const totalProgramMin = activities.reduce((acc, a) => acc + (a.durationMin || 0), 0);

  return (
    <div
      ref={stageRef}
      className={
        fullscreenOverlay
          ? 'fixed inset-0 z-50 bg-[#080E1E] text-white overflow-y-auto flex flex-col'
          : 'bg-[#080E1E] text-white rounded-2xl border border-slate-800 overflow-hidden flex flex-col'
      }
    >
      {showSurpriseBooth && (
        <div className="fixed inset-0 z-[60] bg-[#080E1E] overflow-y-auto">
          <CabinaSorpresasView
            onBack={() => setShowSurpriseBooth(false)}
            embeddedContext={{
              programId: program.id || undefined,
              programTitle: program.title,
              centralTheme: program.centralTheme,
            }}
          />
        </div>
      )}
      {/* Broadcast Stage Header */}
      <header className="border-b border-slate-800/90 bg-[#0C1429]/95 px-4 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              if (document.fullscreenElement) {
                void document.exitFullscreen().catch(() => {});
              }
              onExitPresentation();
            }}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            Salir de Presentación
          </button>

          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider font-bold text-amber-400 truncate">
              Sociedad de Jóvenes · {program.scheduledDate} · {totalProgramMin} min
            </p>
            <h2 className="font-display font-extrabold text-base sm:text-xl text-white truncate">
              {program.title}
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIsRunning(false);
              setShowSurpriseBooth(true);
            }}
            className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <PackageOpen className="w-3.5 h-3.5" />
            Cabina de Sorpresas
          </button>

          <span className="px-3 py-1.5 rounded-lg bg-[#111A2E] border border-slate-700 text-xs font-semibold text-sky-300 inline-flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            {program.mainBibleText}
          </span>

          <button
            type="button"
            onClick={() => setCleanAudienceMode((v) => !v)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
              cleanAudienceMode
                ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
            }`}
            title="Ocultar notas privadas del director en pantalla"
          >
            {cleanAudienceMode ? (
              <Eye className="w-3.5 h-3.5" />
            ) : (
              <EyeOff className="w-3.5 h-3.5" />
            )}
            {cleanAudienceMode ? 'Pantalla Proyección Limpia' : 'Modo Director'}
          </button>

          <button
            type="button"
            onClick={() => void toggleBrowserFullscreen()}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
          >
            {fullscreenOverlay ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
            Pantalla Completa
          </button>
        </div>
      </header>

      {/* Main Stage Body */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-8 py-6 sm:py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left/Center: Current Activity Spotlight */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-gradient-to-br from-[#131F3A] to-[#0E172E] border border-slate-700/80 rounded-3xl p-6 sm:p-10 space-y-6 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span
                  className={`px-3.5 py-1 rounded-full border text-xs sm:text-sm font-bold ${meta.badgeClass}`}
                >
                  {currentActivity.categoryLabel}
                </span>
                <span className="text-xs sm:text-sm font-mono-num text-slate-400">
                  Bloque {safeIdx + 1} de {activities.length}
                </span>
              </div>

              <span className="text-xs sm:text-sm font-semibold text-amber-300">
                Tema: {program.centralTheme}
              </span>
            </div>

            <div className="space-y-4">
              <h1 className="font-display font-extrabold text-3xl sm:text-5xl text-white leading-tight text-balance">
                {currentActivity.title}
              </h1>
              <p className="text-base sm:text-xl text-slate-200 leading-relaxed whitespace-pre-line">
                {currentActivity.description}
              </p>
            </div>

            {!cleanAudienceMode && currentActivity.leaderHint && (
              <div className="bg-[#080E1E]/80 border border-amber-400/30 rounded-2xl p-4 sm:p-5 space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Guía para el Director
                </p>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {currentActivity.leaderHint}
                </p>
              </div>
            )}

            {/* Giant Countdown Progress */}
            <div className="pt-2 space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                    {secondsLeft === 0
                      ? 'Tiempo completado'
                      : isRunning
                        ? 'Tiempo restante de la actividad'
                        : 'Cronómetro listo / en pausa'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Duración asignada: {currentActivity.durationMin} min
                  </p>
                </div>
                <div
                  className={`font-mono-num font-extrabold text-5xl sm:text-7xl tracking-tight ${timerTextClass}`}
                >
                  {formatMMSS(secondsLeft)}
                </div>
              </div>

              <div className="w-full h-4 rounded-full bg-slate-800/90 overflow-hidden">
                <div
                  className={`h-full ${progressColor} transition-all duration-500 ease-linear rounded-full`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {/* Director Timer Controls */}
            {!cleanAudienceMode && (
              <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsRunning((r) => !r)}
                    className={`px-5 py-3 rounded-xl font-display font-extrabold text-sm sm:text-base inline-flex items-center gap-2 cursor-pointer transition-colors ${
                      isRunning
                        ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                    }`}
                  >
                    {isRunning ? (
                      <>
                        <Pause className="w-4 h-4 fill-current" />
                        Pausar
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        {secondsLeft === activityTotalSec ? 'Iniciar' : 'Reanudar'}
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reiniciar
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAdjustSeconds(-60)}
                    className="px-3 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-mono-num font-bold text-xs cursor-pointer"
                  >
                    -1m
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustSeconds(60)}
                    className="px-3 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-mono-num font-bold text-xs cursor-pointer"
                  >
                    +1m
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={safeIdx <= 0}
                    onClick={() => selectActivity(safeIdx - 1, false)}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white text-sm font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Anterior
                  </button>
                  <button
                    type="button"
                    disabled={safeIdx >= activities.length - 1}
                    onClick={() => selectActivity(safeIdx + 1, false)}
                    className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 text-sm font-extrabold inline-flex items-center gap-1 cursor-pointer"
                  >
                    Siguiente
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bible Anchor Card */}
          <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Objetivo Espiritual del Programa
              </p>
              <p className="text-sm sm:text-base text-slate-200">
                {program.spiritualObjective}
              </p>
            </div>
            {program.mainBibleVerseQuote && (
              <p className="text-xs sm:text-sm italic text-amber-200/90 max-w-md">
                “{program.mainBibleVerseQuote}” — {program.mainBibleText}
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Next Activity + Sound Alerts + Quick Agenda */}
        <div className="lg:col-span-4 space-y-5">
          {/* Next Activity Spotlight */}
          <div className="bg-[#111A2E] border border-sky-400/35 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-sky-400 inline-flex items-center gap-1.5">
                <SkipForward className="w-4 h-4" />
                Siguiente Actividad
              </span>
              {nextActivity && (
                <span className="text-xs font-mono-num font-bold text-slate-300">
                  {nextActivity.durationMin} min
                </span>
              )}
            </div>

            {nextActivity && nextMeta ? (
              <div className="space-y-2">
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${nextMeta.badgeClass}`}
                >
                  {nextActivity.categoryLabel}
                </span>
                <h3 className="font-display font-bold text-xl text-white">
                  {nextActivity.title}
                </h3>
                <p className="text-sm text-slate-300 line-clamp-3">
                  {nextActivity.description}
                </p>
                {!cleanAudienceMode && (
                  <button
                    type="button"
                    onClick={() => selectActivity(safeIdx + 1, isRunning)}
                    className="w-full mt-1 py-2.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 text-xs font-bold cursor-pointer"
                  >
                    Pasar ahora a esta actividad
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm text-emerald-300 font-semibold">
                Última actividad del programa. ¡Excelente cierre de Sociedad de Jóvenes!
              </p>
            )}
          </div>

          {/* Configurable Sound Alerts Panel */}
          {!cleanAudienceMode && (
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-base text-white inline-flex items-center gap-2">
                  {soundEnabled ? (
                    <Bell className="w-4 h-4 text-amber-400" />
                  ) : (
                    <BellOff className="w-4 h-4 text-slate-500" />
                  )}
                  Avisos Sonoros
                </h3>
                <button
                  type="button"
                  onClick={() => setSoundEnabled((v) => !v)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                    soundEnabled
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {soundEnabled ? 'Activados' : 'Silenciados'}
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-300">Aviso preventivo:</span>
                  <select
                    value={warningSecBefore}
                    disabled={!soundEnabled}
                    onChange={(e) =>
                      setWarningSecBefore(Number(e.target.value) as 0 | 30 | 60 | 120)
                    }
                    className="bg-[#080E1E] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-semibold disabled:opacity-40"
                  >
                    <option value={0}>Desactivado</option>
                    <option value={30}>30 seg antes</option>
                    <option value={60}>1 min antes</option>
                    <option value={120}>2 min antes</option>
                  </select>
                </div>

                <label className="flex items-center justify-between gap-2 cursor-pointer">
                  <span className="text-slate-300">Tic últimos 5 segundos</span>
                  <input
                    type="checkbox"
                    checked={finalTicksEnabled}
                    disabled={!soundEnabled}
                    onChange={(e) => setFinalTicksEnabled(e.target.checked)}
                    className="accent-amber-400 w-4 h-4"
                  />
                </label>

                <label className="flex items-center justify-between gap-2 cursor-pointer">
                  <span className="text-slate-300">Timbre al terminar actividad</span>
                  <input
                    type="checkbox"
                    checked={endBellEnabled}
                    disabled={!soundEnabled}
                    onChange={(e) => setEndBellEnabled(e.target.checked)}
                    className="accent-amber-400 w-4 h-4"
                  />
                </label>

                <label className="flex items-center justify-between gap-2 cursor-pointer">
                  <span className="text-slate-300">Avanzar automáticamente al siguiente bloque</span>
                  <input
                    type="checkbox"
                    checked={autoAdvance}
                    onChange={(e) => setAutoAdvance(e.target.checked)}
                    className="accent-sky-400 w-4 h-4"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => soundFX.playProgramWarningBell()}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                  Probar aviso sonoro
                </button>
              </div>
            </div>
          )}

          {/* Full Agenda Navigator */}
          <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-white inline-flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-400" />
                Orden del Programa
              </h3>
              <button
                type="button"
                onClick={() => setShowAgendaDrawer((v) => !v)}
                className="text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                {showAgendaDrawer ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>

            {showAgendaDrawer && (
              <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
                {activities.map((act, idx) => {
                  const isCurrent = idx === safeIdx;
                  const isDone = idx < safeIdx;
                  return (
                    <button
                      key={act.id}
                      type="button"
                      disabled={cleanAudienceMode}
                      onClick={() => selectActivity(idx, false)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors flex items-center justify-between gap-2 ${
                        isCurrent
                          ? 'bg-amber-400/15 border-amber-400/60 text-white'
                          : isDone
                            ? 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:bg-slate-800/60'
                            : 'bg-[#080E1E]/70 border-slate-800 text-slate-200 hover:bg-slate-800/70'
                      } ${cleanAudienceMode ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                          {idx + 1}. {act.categoryLabel}
                        </p>
                        <p className="text-xs sm:text-sm font-bold truncate">
                          {act.title}
                        </p>
                      </div>
                      <span className="text-xs font-mono-num font-bold text-amber-300 shrink-0">
                        {act.durationMin}m
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
