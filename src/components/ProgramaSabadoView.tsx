import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit3,
  FileText,
  History,
  Loader2,
  PackageOpen,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import {
  getDefaultActivityDurations,
  getUpcomingSaturdayIso,
  rebalanceActivityDurations,
  REQUIRED_SATURDAY_SEQUENCE,
  SATURDAY_CATEGORY_META,
  SaturdayActivityAlternative,
  SaturdayActivityCategory,
  SaturdayProgram,
  SaturdayProgramActivity,
  SaturdayProgramDuration,
  SaturdayProgramStatus,
} from '../shared/saturdayProgramTypes';
import { CabinaSorpresasView } from './CabinaSorpresasView';
import { ProgramaSabadoPresenter } from './ProgramaSabadoPresenter';

interface ProgramaSabadoViewProps {
  onBack: () => void;
  initialProgramId?: string;
}

type ModuleTab = 'editor' | 'history' | 'presenter';

function makeLocalActivityId(): string {
  return `ACT-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

function createBlankProgramTemplate(
  durationMinutes: SaturdayProgramDuration,
  scheduledDate: string,
  directorName = ''
): SaturdayProgram {
  const defaultTimes = getDefaultActivityDurations(durationMinutes);
  const now = Date.now();
  return {
    id: '',
    title: 'Programa Juvenil de Sábado',
    centralTheme: 'Viviendo una fe auténtica hoy',
    mainBibleText: '1 Timoteo 4:12',
    mainBibleVerseQuote:
      'Ninguno tenga en poco tu juventud, sino sé ejemplo de los creyentes en palabra, conducta, amor, espíritu, fe y pureza.',
    spiritualObjective:
      'Inspirar a los jóvenes a vivir su relación con Dios con alegría, servicio y valentía.',
    scheduledDate,
    durationMinutes,
    status: 'draft',
    directorName: directorName || undefined,
    directorNotes: '',
    activities: REQUIRED_SATURDAY_SEQUENCE.map((cat) => {
      const meta = SATURDAY_CATEGORY_META[cat];
      return {
        id: makeLocalActivityId(),
        category: cat,
        categoryLabel: meta.label,
        title: meta.label,
        description: `Espacio dedicado a ${meta.label.toLowerCase()} con participación juvenil.`,
        leaderHint: '',
        durationMin: defaultTimes[cat],
      };
    }),
    createdAt: now,
    updatedAt: now,
    generatedByAi: false,
  };
}

export function ProgramaSabadoView({
  onBack,
  initialProgramId,
}: ProgramaSabadoViewProps) {
  const [activeTab, setActiveTab] = useState<ModuleTab>('editor');
  const [showSurpriseBooth, setShowSurpriseBooth] = useState(false);

  // Generator controls
  const [durationChoice, setDurationChoice] = useState<SaturdayProgramDuration>(90);
  const [scheduledDateChoice, setScheduledDateChoice] = useState<string>(() =>
    getUpcomingSaturdayIso()
  );
  const [customFocus, setCustomFocus] = useState('');
  const [directorNameChoice, setDirectorNameChoice] = useState('');

  // Working program in editor
  const [program, setProgram] = useState<SaturdayProgram>(() =>
    createBlankProgramTemplate(90, getUpcomingSaturdayIso())
  );
  const [isPersisted, setIsPersisted] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // History list
  const [savedPrograms, setSavedPrograms] = useState<SaturdayProgram[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | SaturdayProgramStatus>('all');
  const [historySearch, setHistorySearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Async action states
  const [generatingAi, setGeneratingAi] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Activity editing & AI alternatives drawer
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);
  const [altTargetActivity, setAltTargetActivity] =
    useState<SaturdayProgramActivity | null>(null);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);
  const [alternatives, setAlternatives] = useState<SaturdayActivityAlternative[]>([]);

  // Custom activity form
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [newActCategory, setNewActCategory] =
    useState<SaturdayActivityCategory>('personalizada');
  const [newActTitle, setNewActTitle] = useState('');
  const [newActDesc, setNewActDesc] = useState('');
  const [newActHint, setNewActHint] = useState('');
  const [newActDuration, setNewActDuration] = useState(10);

  const loadProgramsHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/saturday-programs');
      if (!res.ok) return;
      const data = (await res.json()) as { programs?: SaturdayProgram[] };
      if (Array.isArray(data.programs)) {
        setSavedPrograms(data.programs);
      }
    } catch {
      // ignore transient network fetch issue
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    void loadProgramsHistory();
  }, []);

  useEffect(() => {
    if (!initialProgramId) return;
    let cancelled = false;
    const fetchInitial = async () => {
      try {
        const res = await fetch(
          `/api/saturday-programs/${encodeURIComponent(initialProgramId)}`
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { program?: SaturdayProgram };
        if (data.program && !cancelled) {
          setProgram(data.program);
          setDurationChoice(data.program.durationMinutes);
          setIsPersisted(true);
          setHasUnsavedChanges(false);
          setExpandedActivityId(data.program.activities[0]?.id || null);
          setActiveTab('editor');
          setFeedbackMsg(
            'Programa recibido desde IA Creativa Juvenil como borrador editable para revisión del director.'
          );
        }
      } catch {
        // ignore transient error
      }
    };
    void fetchInitial();
    return () => {
      cancelled = true;
    };
  }, [initialProgramId]);

  const totalAssignedMin = useMemo(
    () => program.activities.reduce((sum, a) => sum + (Number(a.durationMin) || 0), 0),
    [program.activities]
  );

  const mutateProgram = (updater: (prev: SaturdayProgram) => SaturdayProgram) => {
    setProgram((prev) => updater({ ...prev, updatedAt: Date.now() }));
    setHasUnsavedChanges(true);
    setFeedbackMsg(null);
  };

  const handleGenerateWithAi = async () => {
    setGeneratingAi(true);
    setErrorMsg(null);
    setFeedbackMsg(null);
    setAltTargetActivity(null);
    setAlternatives([]);

    try {
      const res = await fetch('/api/saturday-programs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          durationMinutes: durationChoice,
          scheduledDate: scheduledDateChoice,
          customFocus: customFocus.trim(),
          directorName: directorNameChoice.trim(),
        }),
      });

      const data = (await res.json()) as {
        program?: SaturdayProgram;
        error?: string;
      };

      if (!res.ok || !data.program) {
        setErrorMsg(
          data.error ||
            'No se pudo generar el programa con IA. Verifica tu configuración e intenta nuevamente.'
        );
        return;
      }

      setProgram(data.program);
      setIsPersisted(false);
      setHasUnsavedChanges(true);
      setExpandedActivityId(data.program.activities[0]?.id || null);
      setActiveTab('editor');
      setFeedbackMsg(
        'Programa generado con IA evitando repetir actividades recientes. Revísalo, ajústalo si deseas y guárdalo como borrador o definitivo.'
      );
    } catch {
      setErrorMsg('Error de conexión al generar el programa con IA.');
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleNewBlankProgram = () => {
    setErrorMsg(null);
    setAltTargetActivity(null);
    setAlternatives([]);
    const template = createBlankProgramTemplate(
      durationChoice,
      scheduledDateChoice,
      directorNameChoice.trim()
    );
    setProgram(template);
    setIsPersisted(false);
    setHasUnsavedChanges(true);
    setActiveTab('editor');
    setFeedbackMsg('Plantilla editable lista para personalizar.');
  };

  const handleSaveProgram = async (targetStatus: SaturdayProgramStatus) => {
    if (!program.title.trim()) {
      setErrorMsg('Por favor escribe un título para el programa antes de guardar.');
      return;
    }
    if (program.activities.length === 0) {
      setErrorMsg('El programa debe tener al menos una actividad.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setFeedbackMsg(null);

    try {
      const payload = {
        ...program,
        status: targetStatus,
      };

      const url =
        isPersisted && program.id
          ? `/api/saturday-programs/${encodeURIComponent(program.id)}`
          : '/api/saturday-programs';
      const method = isPersisted && program.id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as {
        program?: SaturdayProgram;
        error?: string;
      };

      if (!res.ok || !data.program) {
        setErrorMsg(data.error || 'No se pudo guardar el programa.');
        return;
      }

      setProgram(data.program);
      setIsPersisted(true);
      setHasUnsavedChanges(false);
      await loadProgramsHistory();
      setFeedbackMsg(
        targetStatus === 'final'
          ? 'Programa definitivo guardado en el historial sin sobrescribir programas anteriores.'
          : 'Borrador guardado correctamente.'
      );
    } catch {
      setErrorMsg('Error de red al guardar el programa.');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicateProgram = async (sourceId?: string) => {
    const targetId = sourceId || (isPersisted ? program.id : '');
    setErrorMsg(null);
    setFeedbackMsg(null);

    if (!targetId) {
      // Unsaved local duplicate -> mint fresh local draft
      mutateProgram((prev) => ({
        ...prev,
        id: '',
        status: 'draft',
        title: prev.title.startsWith('Copia de ')
          ? prev.title
          : `Copia de ${prev.title}`,
        scheduledDate: getUpcomingSaturdayIso(),
        activities: prev.activities.map((a) => ({
          ...a,
          id: makeLocalActivityId(),
        })),
      }));
      setIsPersisted(false);
      setFeedbackMsg('Copia creada en el editor lista para modificar.');
      return;
    }

    try {
      const res = await fetch(
        `/api/saturday-programs/${encodeURIComponent(targetId)}/duplicate`,
        { method: 'POST' }
      );
      const data = (await res.json()) as {
        program?: SaturdayProgram;
        error?: string;
      };
      if (!res.ok || !data.program) {
        setErrorMsg(data.error || 'No se pudo duplicar el programa.');
        return;
      }
      setProgram(data.program);
      setIsPersisted(true);
      setHasUnsavedChanges(false);
      setActiveTab('editor');
      await loadProgramsHistory();
      setFeedbackMsg(
        'Programa duplicado como nuevo borrador. El programa original permanece intacto en el historial.'
      );
    } catch {
      setErrorMsg('Error de red al duplicar el programa.');
    }
  };

  const handleOpenSavedProgram = async (saved: SaturdayProgram) => {
    setErrorMsg(null);
    setFeedbackMsg(null);
    try {
      const res = await fetch(
        `/api/saturday-programs/${encodeURIComponent(saved.id)}`
      );
      if (res.ok) {
        const data = (await res.json()) as { program?: SaturdayProgram };
        if (data.program) {
          setProgram(data.program);
          setDurationChoice(data.program.durationMinutes);
          setIsPersisted(true);
          setHasUnsavedChanges(false);
          setActiveTab('editor');
          return;
        }
      }
    } catch {
      // fallback to local copy
    }
    setProgram(saved);
    setDurationChoice(saved.durationMinutes);
    setIsPersisted(true);
    setHasUnsavedChanges(false);
    setActiveTab('editor');
  };

  const handleDeleteSavedProgram = async (id: string) => {
    try {
      const res = await fetch(
        `/api/saturday-programs/${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) return;
      setConfirmDeleteId(null);
      if (isPersisted && program.id === id) {
        setIsPersisted(false);
        setProgram((prev) => ({ ...prev, id: '' }));
      }
      await loadProgramsHistory();
      setFeedbackMsg('Programa eliminado del historial.');
    } catch {
      setErrorMsg('No se pudo eliminar el programa.');
    }
  };

  const handleMoveActivity = (index: number, delta: -1 | 1) => {
    const nextIdx = index + delta;
    if (nextIdx < 0 || nextIdx >= program.activities.length) return;
    mutateProgram((prev) => {
      const copy = [...prev.activities];
      [copy[index], copy[nextIdx]] = [copy[nextIdx], copy[index]];
      return { ...prev, activities: copy };
    });
  };

  const handleDeleteActivity = (actId: string) => {
    if (program.activities.length <= 1) {
      setErrorMsg('El programa debe mantener al menos una actividad.');
      return;
    }
    mutateProgram((prev) => ({
      ...prev,
      activities: prev.activities.filter((a) => a.id !== actId),
    }));
    if (altTargetActivity?.id === actId) {
      setAltTargetActivity(null);
      setAlternatives([]);
    }
  };

  const handleUpdateActivity = (
    actId: string,
    patch: Partial<SaturdayProgramActivity>
  ) => {
    mutateProgram((prev) => ({
      ...prev,
      activities: prev.activities.map((a) =>
        a.id === actId ? { ...a, ...patch } : a
      ),
    }));
  };

  const handleAddCustomActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActTitle.trim()) return;
    const meta = SATURDAY_CATEGORY_META[newActCategory];
    const newAct: SaturdayProgramActivity = {
      id: makeLocalActivityId(),
      category: newActCategory,
      categoryLabel: meta.label,
      title: newActTitle.trim(),
      description:
        newActDesc.trim() ||
        `Actividad personalizada enfocada en ${program.centralTheme}.`,
      ...(newActHint.trim() ? { leaderHint: newActHint.trim() } : {}),
      durationMin: Math.max(1, Math.min(120, Math.round(newActDuration || 10))),
    };
    mutateProgram((prev) => ({
      ...prev,
      activities: [...prev.activities, newAct],
    }));
    setNewActTitle('');
    setNewActDesc('');
    setNewActHint('');
    setNewActDuration(10);
    setShowAddActivity(false);
    setExpandedActivityId(newAct.id);
  };

  const handleChangeProgramDuration = (nextDur: SaturdayProgramDuration) => {
    setDurationChoice(nextDur);
    mutateProgram((prev) => ({
      ...prev,
      durationMinutes: nextDur,
      activities: rebalanceActivityDurations(prev.activities, nextDur),
    }));
  };

  const handleRebalanceToTarget = () => {
    mutateProgram((prev) => ({
      ...prev,
      activities: rebalanceActivityDurations(prev.activities, prev.durationMinutes),
    }));
    setFeedbackMsg(
      `Tiempos redistribuidos automáticamente para sumar ${program.durationMinutes} minutos exactos.`
    );
  };

  const handleCheckVariety = async () => {
    try {
      const res = await fetch('/api/saturday-programs/check-variety', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(program),
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        warnings?: SaturdayProgram['varietyWarnings'];
      };
      setProgram((prev) => ({
        ...prev,
        varietyWarnings: data.warnings || [],
      }));
      if ((data.warnings || []).length === 0) {
        setFeedbackMsg(
          'Verificación de variedad completada: todas las actividades son frescas respecto al historial reciente.'
        );
      }
    } catch {
      // ignore
    }
  };

  const handleRequestAlternatives = async (act: SaturdayProgramActivity) => {
    setAltTargetActivity(act);
    setLoadingAlternatives(true);
    setAlternatives([]);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/saturday-programs/suggest-alternative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: act.category,
          currentTitle: act.title,
          centralTheme: program.centralTheme,
          mainBibleText: program.mainBibleText,
          durationMin: act.durationMin,
        }),
      });
      const data = (await res.json()) as {
        alternatives?: SaturdayActivityAlternative[];
        error?: string;
      };
      if (!res.ok || !Array.isArray(data.alternatives)) {
        setErrorMsg(
          data.error || 'No se pudieron generar alternativas en este momento.'
        );
        return;
      }
      setAlternatives(data.alternatives);
    } catch {
      setErrorMsg('Error de conexión al pedir alternativas a la IA.');
    } finally {
      setLoadingAlternatives(false);
    }
  };

  const handleApplyAlternative = (alt: SaturdayActivityAlternative) => {
    if (!altTargetActivity) return;
    mutateProgram((prev) => ({
      ...prev,
      activities: prev.activities.map((a) =>
        a.id === altTargetActivity.id
          ? {
              ...a,
              title: alt.title,
              description: alt.description,
              leaderHint: alt.leaderHint,
              durationMin: alt.durationMin,
            }
          : a
      ),
      varietyWarnings: (prev.varietyWarnings || []).filter(
        (w) => w.activityId !== altTargetActivity.id
      ),
    }));
    setFeedbackMsg(`Actividad "${altTargetActivity.categoryLabel}" actualizada con nueva propuesta.`);
    setAltTargetActivity(null);
    setAlternatives([]);
  };

  const handleExportTxt = (target: SaturdayProgram) => {
    const lines = [
      `PROGRAMA DE SOCIEDAD DE JÓVENES — DIME TÚ QUÉ DICES`,
      `====================================================`,
      `Título: ${target.title}`,
      `Fecha: ${target.scheduledDate}`,
      `Duración total: ${target.durationMinutes} minutos (${target.status === 'final' ? 'DEFINITIVO' : 'BORRADOR'})`,
      `Tema central: ${target.centralTheme}`,
      `Texto bíblico principal: ${target.mainBibleText}`,
      ...(target.mainBibleVerseQuote ? [`"${target.mainBibleVerseQuote}"`] : []),
      `Objetivo espiritual: ${target.spiritualObjective}`,
      ...(target.directorName ? [`Director/a: ${target.directorName}`] : []),
      ``,
      `ORDEN DE ACTIVIDADES:`,
      ...target.activities.map(
        (a, i) =>
          `\n${i + 1}. [${a.durationMin} min] ${a.categoryLabel.toUpperCase()} — ${a.title}\n   ${a.description}${a.leaderHint ? `\n   Guía: ${a.leaderHint}` : ''}`
      ),
      ...(target.directorNotes
        ? [`\nOBSERVACIONES DEL DIRECTOR:\n${target.directorNotes}`]
        : []),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `programa-sabado-${target.scheduledDate || 'jovenes'}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return savedPrograms.filter((p) => {
      if (historyFilter !== 'all' && p.status !== historyFilter) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.centralTheme.toLowerCase().includes(q) ||
        p.mainBibleText.toLowerCase().includes(q) ||
        p.scheduledDate.toLowerCase().includes(q) ||
        (p.directorNotes || '').toLowerCase().includes(q)
      );
    });
  }, [savedPrograms, historyFilter, historySearch]);

  if (showSurpriseBooth) {
    return (
      <CabinaSorpresasView
        onBack={() => setShowSurpriseBooth(false)}
        embeddedContext={{
          programId: program.id || undefined,
          programTitle: program.title,
          centralTheme: program.centralTheme,
        }}
      />
    );
  }

  if (activeTab === 'presenter') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <ProgramaSabadoPresenter
          program={program}
          onExitPresentation={() => setActiveTab('editor')}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Top Module Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-xl bg-[#111A2E] hover:bg-slate-800 border border-slate-800 text-slate-200 cursor-pointer"
            title="Volver al inicio"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Sociedad de Jóvenes · Módulo Independiente
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
              Programa del Sábado
            </h1>
          </div>
        </div>

        {/* Sub-navigation tabs */}
        <div className="flex flex-wrap items-center gap-2 bg-[#111A2E] border border-slate-800 p-1.5 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'editor'
                ? 'bg-amber-400 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            Editor y Generador IA
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('presenter')}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-400/40 transition-colors"
          >
            <Play className="w-4 h-4 fill-current" />
            Modo Presentación ({program.activities.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('history');
              void loadProgramsHistory();
            }}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'history'
                ? 'bg-amber-400 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            Historial ({savedPrograms.length})
          </button>

          <button
            type="button"
            onClick={() => setShowSurpriseBooth(true)}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 border border-amber-400/40 transition-colors whitespace-nowrap"
          >
            <PackageOpen className="w-4 h-4" />
            Cabina de Sorpresas
          </button>
        </div>
      </div>

      {/* AI Generator Command Card */}
      <section className="bg-gradient-to-br from-[#142140] via-[#111A2E] to-[#0D1528] border border-amber-400/35 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <h2 className="font-display text-lg sm:text-xl font-extrabold text-white inline-flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Generador Inteligente de Programas Juveniles
            </h2>
            <p className="text-sm text-slate-300">
              Crea un programa completo y bíblico evitando repetir títulos, dinámicas o juegos de sábados anteriores.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleNewBlankProgram}
              className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
            >
              <FileText className="w-4 h-4 text-sky-400" />
              Plantilla manual
            </button>

            <button
              type="button"
              disabled={generatingAi}
              onClick={handleGenerateWithAi}
              className="px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 font-display font-extrabold text-sm sm:text-base inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/15 transition-colors"
            >
              {generatingAi ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creando programa...
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" />
                  Crear programa de este sábado
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Generator Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 block">
              Duración total del programa
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {([60, 90, 120] as SaturdayProgramDuration[]).map((dur) => (
                <button
                  key={dur}
                  type="button"
                  onClick={() => handleChangeProgramDuration(dur)}
                  className={`py-2.5 rounded-xl font-mono-num text-xs sm:text-sm font-bold border cursor-pointer transition-colors ${
                    durationChoice === dur
                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                      : 'bg-[#080E1E] text-slate-300 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {dur} min
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 block">
              Fecha del sábado
            </label>
            <input
              type="date"
              value={scheduledDateChoice}
              onChange={(e) => {
                setScheduledDateChoice(e.target.value);
                mutateProgram((prev) => ({
                  ...prev,
                  scheduledDate: e.target.value,
                }));
              }}
              className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 block">
              Enfoque o necesidad (opcional)
            </label>
            <input
              type="text"
              value={customFocus}
              onChange={(e) => setCustomFocus(e.target.value)}
              placeholder="Ej: Amistad, Fe en pruebas, Misión..."
              className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 block">
              Director / Encargado (opcional)
            </label>
            <input
              type="text"
              value={directorNameChoice}
              onChange={(e) => {
                setDirectorNameChoice(e.target.value);
                mutateProgram((prev) => ({
                  ...prev,
                  directorName: e.target.value || undefined,
                }));
              }}
              placeholder="Nombre del director"
              className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>
      </section>

      {/* Feedback / Error Banners */}
      {errorMsg && (
        <div className="bg-rose-500/15 border border-rose-400/50 rounded-2xl px-5 py-4 text-sm text-rose-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">{errorMsg}</div>
        </div>
      )}

      {feedbackMsg && (
        <div className="bg-emerald-500/15 border border-emerald-400/45 rounded-2xl px-5 py-3.5 text-sm text-emerald-200 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="flex-1">{feedbackMsg}</span>
        </div>
      )}

      {/* TAB 1: EDITOR & DIRECTOR CONTROL */}
      {activeTab === 'editor' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Metadata, Save Actions, Observations */}
          <div className="lg:col-span-4 space-y-5">
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display font-bold text-lg text-white">
                  Datos del Programa
                </h3>
                <span
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                    program.status === 'final'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40'
                      : 'bg-amber-500/15 text-amber-300 border-amber-400/40'
                  }`}
                >
                  {program.status === 'final' ? 'Definitivo' : 'Borrador'}
                </span>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">
                    Título del programa
                  </label>
                  <input
                    type="text"
                    value={program.title}
                    onChange={(e) =>
                      mutateProgram((prev) => ({ ...prev, title: e.target.value }))
                    }
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-white font-semibold focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">
                    Tema central
                  </label>
                  <input
                    type="text"
                    value={program.centralTheme}
                    onChange={(e) =>
                      mutateProgram((prev) => ({
                        ...prev,
                        centralTheme: e.target.value,
                      }))
                    }
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">
                      Texto bíblico principal
                    </label>
                    <input
                      type="text"
                      value={program.mainBibleText}
                      onChange={(e) =>
                        mutateProgram((prev) => ({
                          ...prev,
                          mainBibleText: e.target.value,
                        }))
                      }
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-sky-300 font-semibold focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">
                    Versículo clave (opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={program.mainBibleVerseQuote || ''}
                    onChange={(e) =>
                      mutateProgram((prev) => ({
                        ...prev,
                        mainBibleVerseQuote: e.target.value,
                      }))
                    }
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">
                    Objetivo espiritual
                  </label>
                  <textarea
                    rows={3}
                    value={program.spiritualObjective}
                    onChange={(e) =>
                      mutateProgram((prev) => ({
                        ...prev,
                        spiritualObjective: e.target.value,
                      }))
                    }
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">
                    Observaciones del director (historial)
                  </label>
                  <textarea
                    rows={3}
                    value={program.directorNotes}
                    onChange={(e) =>
                      mutateProgram((prev) => ({
                        ...prev,
                        directorNotes: e.target.value,
                      }))
                    }
                    placeholder="Notas de logística, materiales, participación de los jóvenes, feedback post-culto..."
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </div>

            {/* Duration Balance & Director Save Actions */}
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Control de Duración
                </span>
                <span
                  className={`font-mono-num text-sm font-extrabold ${
                    totalAssignedMin === program.durationMinutes
                      ? 'text-emerald-400'
                      : 'text-amber-300'
                  }`}
                >
                  {totalAssignedMin} / {program.durationMinutes} min
                </span>
              </div>

              {totalAssignedMin !== program.durationMinutes && (
                <button
                  type="button"
                  onClick={handleRebalanceToTarget}
                  className="w-full py-2.5 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-amber-200 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Ajustar tiempos automáticamente a {program.durationMinutes} min
                </button>
              )}

              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSaveProgram('draft')}
                  className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4 text-sky-400" />
                  {isPersisted ? 'Actualizar Borrador' : 'Guardar Borrador'}
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSaveProgram('final')}
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Guardar Programa Definitivo
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void handleDuplicateProgram()}
                    className="py-2.5 px-3 rounded-xl bg-[#080E1E] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-amber-400" />
                    Duplicar
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportTxt(program)}
                    className="py-2.5 px-3 rounded-xl bg-[#080E1E] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-400" />
                    Exportar TXT
                  </button>
                </div>

                {hasUnsavedChanges && (
                  <p className="text-[11px] text-amber-300 text-center">
                    Hay cambios sin guardar en este programa.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Variety Warnings + Activities Sequence */}
          <div className="lg:col-span-8 space-y-5">
            {/* Automatic Variety Status & Warnings */}
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h3 className="font-display font-bold text-base text-white inline-flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-sky-400" />
                    Control de Variedad Automática
                  </h3>
                  <p className="text-xs text-slate-400">
                    {program.varietyNotice ||
                      'Compara este programa contra el historial guardado para evitar repetir títulos, dinámicas y juegos.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCheckVariety()}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
                  Verificar contra historial
                </button>
              </div>

              {program.varietyWarnings && program.varietyWarnings.length > 0 && (
                <div className="space-y-2 pt-1">
                  {program.varietyWarnings.map((w, idx) => {
                    const actObj = program.activities.find((a) => a.id === w.activityId);
                    return (
                      <div
                        key={`${w.activityId}-${idx}`}
                        className="bg-amber-500/10 border border-amber-400/40 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="text-xs text-amber-100 space-y-0.5">
                          <p className="font-bold text-amber-300">
                            Posible similitud detectada: {w.activityTitle}
                          </p>
                          <p>{w.reason}</p>
                        </div>
                        {actObj && (
                          <button
                            type="button"
                            onClick={() => void handleRequestAlternatives(actObj)}
                            className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold cursor-pointer shrink-0"
                          >
                            Ver alternativas IA
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* AI Alternatives Drawer when requested for an activity */}
            {altTargetActivity && (
              <div className="bg-[#131F3D] border border-sky-400/50 rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-sky-400">
                      Alternativas sin repetir para: {altTargetActivity.categoryLabel}
                    </p>
                    <h4 className="font-display font-bold text-lg text-white">
                      Reemplazar “{altTargetActivity.title}”
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAltTargetActivity(null);
                      setAlternatives([]);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>

                {loadingAlternatives ? (
                  <div className="py-6 flex items-center justify-center gap-2 text-sm text-sky-300">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generando 3 propuestas frescas con IA...
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {alternatives.map((alt, idx) => (
                      <div
                        key={idx}
                        className="bg-[#080E1E] border border-slate-700 rounded-xl p-4 flex flex-col justify-between gap-3"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-sky-400">
                              Opción {idx + 1}
                            </span>
                            <span className="text-[11px] font-mono-num text-amber-300 font-bold">
                              {alt.durationMin} min
                            </span>
                          </div>
                          <h5 className="font-display font-bold text-sm text-white">
                            {alt.title}
                          </h5>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {alt.description}
                          </p>
                          {alt.leaderHint && (
                            <p className="text-[11px] text-slate-400 italic">
                              Guía: {alt.leaderHint}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleApplyAlternative(alt)}
                          className="w-full py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-extrabold cursor-pointer"
                        >
                          Usar esta opción
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Activities List Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display font-extrabold text-xl text-white">
                Agenda del Programa ({program.activities.length} actividades)
              </h3>
              <button
                type="button"
                onClick={() => setShowAddActivity((v) => !v)}
                className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-display font-extrabold text-xs sm:text-sm inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Agregar actividad propia
              </button>
            </div>

            {/* Add Custom Activity Form */}
            {showAddActivity && (
              <form
                onSubmit={handleAddCustomActivity}
                className="bg-[#111A2E] border border-sky-400/40 rounded-2xl p-5 space-y-4"
              >
                <h4 className="font-display font-bold text-base text-white">
                  Nueva Actividad Propia
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">
                      Tipo de bloque
                    </label>
                    <select
                      value={newActCategory}
                      onChange={(e) =>
                        setNewActCategory(e.target.value as SaturdayActivityCategory)
                      }
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                    >
                      {Object.values(SATURDAY_CATEGORY_META).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">
                      Título de la actividad
                    </label>
                    <input
                      type="text"
                      required
                      value={newActTitle}
                      onChange={(e) => setNewActTitle(e.target.value)}
                      placeholder="Ej: Testimonio juvenil en video"
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">
                      Duración (minutos)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={newActDuration}
                      onChange={(e) => setNewActDuration(Number(e.target.value))}
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono-num"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">
                      Descripción
                    </label>
                    <textarea
                      rows={2}
                      value={newActDesc}
                      onChange={(e) => setNewActDesc(e.target.value)}
                      placeholder="¿Cómo participarán los jóvenes?"
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">
                      Guía o materiales (opcional)
                    </label>
                    <textarea
                      rows={2}
                      value={newActHint}
                      onChange={(e) => setNewActHint(e.target.value)}
                      placeholder="Ej: Proyector, micrófonos, pasaje..."
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddActivity(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold cursor-pointer"
                  >
                    Agregar al programa
                  </button>
                </div>
              </form>
            )}

            {/* Activity Timeline Cards */}
            <div className="space-y-3">
              {program.activities.map((act, idx) => {
                const meta =
                  SATURDAY_CATEGORY_META[act.category] ||
                  SATURDAY_CATEGORY_META.personalizada;
                const isExpanded = expandedActivityId === act.id;
                const hasWarning = (program.varietyWarnings || []).some(
                  (w) => w.activityId === act.id
                );

                return (
                  <div
                    key={act.id}
                    className={`bg-[#111A2E] border rounded-2xl p-4 sm:p-5 transition-colors space-y-3 ${
                      hasWarning
                        ? 'border-amber-400/60'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1 min-w-[220px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-[#080E1E] border border-slate-700 text-xs font-mono-num font-bold text-slate-300 inline-flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${meta.badgeClass}`}
                          >
                            {act.categoryLabel}
                          </span>
                          {hasWarning && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[11px] font-bold">
                              Similar al historial
                            </span>
                          )}
                        </div>
                        <h4 className="font-display font-bold text-lg text-white">
                          {act.title}
                        </h4>
                        <p className="text-sm text-slate-300 leading-relaxed">
                          {act.description}
                        </p>
                        {act.leaderHint && (
                          <p className="text-xs text-amber-200/80">
                            <span className="font-bold text-amber-400">Guía:</span>{' '}
                            {act.leaderHint}
                          </p>
                        )}
                      </div>

                      {/* Right Toolbar per Activity */}
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <div className="flex items-center gap-1 bg-[#080E1E] border border-slate-700 rounded-xl px-2 py-1">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <input
                            type="number"
                            min={1}
                            max={180}
                            aria-label={`Duración en minutos de ${act.title}`}
                            value={act.durationMin}
                            onChange={(e) =>
                              handleUpdateActivity(act.id, {
                                durationMin: Math.max(
                                  1,
                                  Math.min(180, Math.round(Number(e.target.value) || 1))
                                ),
                              })
                            }
                            className="w-11 bg-transparent text-white font-mono-num font-bold text-xs text-center focus:outline-none"
                          />
                          <span className="text-[11px] text-slate-400">min</span>
                        </div>

                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveActivity(idx, -1)}
                          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 cursor-pointer"
                          title="Subir orden"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === program.activities.length - 1}
                          onClick={() => handleMoveActivity(idx, 1)}
                          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 cursor-pointer"
                          title="Bajar orden"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleRequestAlternatives(act)}
                          className="px-2.5 py-2 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/35 text-sky-300 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                          title="Sugerir 3 alternativas con IA"
                        >
                          <Wand2 className="w-3.5 h-3.5" />
                          Alternativas
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setExpandedActivityId(isExpanded ? null : act.id)
                          }
                          className={`px-2.5 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer ${
                            isExpanded
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                          }`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          {isExpanded ? 'Listo' : 'Editar'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteActivity(act.id)}
                          className="p-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 cursor-pointer"
                          title="Eliminar actividad del programa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Inline Activity Editor Drawer */}
                    {isExpanded && (
                      <div className="pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="text-slate-400 font-semibold block mb-1">
                            Categoría
                          </label>
                          <select
                            value={act.category}
                            onChange={(e) => {
                              const nextCat = e.target.value as SaturdayActivityCategory;
                              handleUpdateActivity(act.id, {
                                category: nextCat,
                                categoryLabel: SATURDAY_CATEGORY_META[nextCat].label,
                              });
                            }}
                            className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-white"
                          >
                            {Object.values(SATURDAY_CATEGORY_META).map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-slate-400 font-semibold block mb-1">
                            Título
                          </label>
                          <input
                            type="text"
                            value={act.title}
                            onChange={(e) =>
                              handleUpdateActivity(act.id, { title: e.target.value })
                            }
                            className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-white font-semibold"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="text-slate-400 font-semibold block mb-1">
                            Descripción participativa
                          </label>
                          <textarea
                            rows={3}
                            value={act.description}
                            onChange={(e) =>
                              handleUpdateActivity(act.id, {
                                description: e.target.value,
                              })
                            }
                            className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="text-slate-400 font-semibold block mb-1">
                            Guía del director / materiales / versículo de apoyo
                          </label>
                          <input
                            type="text"
                            value={act.leaderHint || ''}
                            onChange={(e) =>
                              handleUpdateActivity(act.id, {
                                leaderHint: e.target.value,
                              })
                            }
                            className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: HISTORY & SAVED PROGRAMS */}
      {activeTab === 'history' && (
        <section className="space-y-5">
          <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Buscar por tema, título, pasaje bíblico, fecha u observaciones..."
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex items-center gap-2">
              {(
                [
                  ['all', 'Todos'],
                  ['final', 'Definitivos'],
                  ['draft', 'Borradores'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setHistoryFilter(key)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                    historyFilter === key
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-[#080E1E] text-slate-300 border border-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loadingHistory ? (
            <div className="py-12 text-center text-slate-400 text-sm inline-flex items-center justify-center gap-2 w-full">
              <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
              Cargando historial de programas...
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-10 text-center space-y-3">
              <Calendar className="w-10 h-10 text-amber-400 mx-auto" />
              <h3 className="font-display font-bold text-xl text-white">
                {savedPrograms.length === 0
                  ? 'Aún no hay programas guardados'
                  : 'Ningún programa coincide con tu búsqueda'}
              </h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Genera el programa de este sábado con IA o arma uno personalizado y guárdalo como borrador o definitivo para consultarlo cualquier semana.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredHistory.map((item) => (
                <article
                  key={item.id}
                  className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-mono-num font-bold text-amber-300 inline-flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {item.scheduledDate} · {item.durationMinutes} min
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          item.status === 'final'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40'
                            : 'bg-amber-500/15 text-amber-300 border-amber-400/40'
                        }`}
                      >
                        {item.status === 'final' ? 'Definitivo' : 'Borrador'}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-display font-extrabold text-xl text-white">
                        {item.title}
                      </h3>
                      <p className="text-sm text-sky-300 font-semibold mt-0.5">
                        Tema: {item.centralTheme}
                      </p>
                      <p className="text-xs text-slate-400 mt-1 inline-flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                        {item.mainBibleText}
                      </p>
                    </div>

                    <div className="bg-[#080E1E]/80 border border-slate-800 rounded-xl p-3 space-y-1.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Actividades ({item.activities.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {item.activities.map((a) => (
                          <span
                            key={a.id}
                            className="px-2 py-0.5 rounded-md bg-slate-800/90 text-[11px] text-slate-200"
                          >
                            {a.title} ({a.durationMin}m)
                          </span>
                        ))}
                      </div>
                    </div>

                    {item.directorNotes && (
                      <div className="text-xs text-slate-300 bg-amber-500/10 border border-amber-400/25 rounded-xl p-3">
                        <span className="font-bold text-amber-300">
                          Observaciones del director:
                        </span>{' '}
                        {item.directorNotes}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleOpenSavedProgram(item)}
                        className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Abrir / Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setProgram(item);
                          setIsPersisted(true);
                          setHasUnsavedChanges(false);
                          setActiveTab('presenter');
                        }}
                        className="px-3 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Presentar
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleDuplicateProgram(item.id)}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5 text-amber-400" />
                        Duplicar
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleExportTxt(item)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                        title="Descargar TXT"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      {confirmDeleteId === item.id ? (
                        <button
                          type="button"
                          onClick={() => void handleDeleteSavedProgram(item.id)}
                          className="px-2.5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold cursor-pointer"
                        >
                          ¿Confirmar?
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          className="p-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 cursor-pointer"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
