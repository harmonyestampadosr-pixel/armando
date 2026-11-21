import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BarChart3,
  BookCheck,
  BookOpen,
  CheckCircle2,
  Clock,
  Edit3,
  Gamepad2,
  History,
  Lock,
  MonitorPlay,
  PackageOpen,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Trash2,
  Unlock,
  Users,
  Volume2,
  VolumeX,
  Wand2,
  X,
} from 'lucide-react';
import {
  formatMmSs,
  getSectionMeta,
  rebalanceYouthActivities,
  SOUND_MOOD_LABELS,
  YOUTH_CONFIG_PRESETS,
  YOUTH_SECTIONS,
  type YouthBiblicalContentType,
  type YouthExperienceType,
  type YouthParticipationMode,
  type YouthProgramActivityItem,
  type YouthProgramConfigInput,
  type YouthProgramHistoryEntry,
  type YouthProgramPlan,
  type YouthSectionCode,
  type YouthSocietyStatsSummary,
  type YouthSoundMood,
} from '../shared/youthSocietyData';
import { getUpcomingSaturdayIso } from '../shared/saturdayProgramTypes';
import { GAME_MODE_INFO, type DifficultySetting, type GameMode } from '../shared/types';
import { youthSocietyAudio } from '../utils/sound';
import { QrCodeCard } from './QrCodeCard';

const YS_DIRECTOR_TOKEN_KEY = 'dtqd_youth_society_director_token';

interface RecoverableActivityItem {
  sourceProgramId: string;
  sourceProgramName: string;
  sourceDate: string;
  activity: YouthProgramActivityItem;
}

interface OverviewPayload {
  isDirector: boolean;
  activeProgramId: string | null;
  programs: YouthProgramPlan[];
  history: YouthProgramHistoryEntry[];
  stats: YouthSocietyStatsSummary;
  recoverableActivities: RecoverableActivityItem[];
}

interface LivePayload {
  program: YouthProgramPlan;
  remainingSec: number;
  serverNow: number;
  currentActivity: YouthProgramActivityItem | null;
  nextActivity: YouthProgramActivityItem | null;
  linkedLiveGame: {
    code: string;
    gameId: string;
    title: string;
    modeLabel: string;
    status: string;
    participantCount: number;
    leaderboardTop: Array<{ name: string; score: number; correctCount: number }>;
    teamTop: Array<{ name: string; color: string; score: number; memberCount: number }>;
  } | null;
}

interface ReplacementAlternative {
  sectionCode: YouthSectionCode;
  durationMin: number;
  title: string;
  description: string;
  materials: string;
  directorInstructions: string;
  participantInstructions: string;
  biblicalReference: string;
  scripturalText?: string;
}

interface MiSociedadJovenesViewProps {
  onBack: () => void;
  onOpenProjector: (programId: string) => void;
  onOpenGamePresenter: (code: string, token: string) => void;
  onOpenGameProjector: (code: string) => void;
  onJoinGameCode: (code: string) => void;
  initialProgramId?: string;
}

type ModuleTab = 'config' | 'editor' | 'live' | 'history' | 'audio';

const LINKABLE_MODES: GameMode[] = [
  'clasico',
  'velocidad',
  'equipos',
  'competencia_equipos',
  'batalla_1v1',
  'ruleta_biblica',
  'quien_soy',
  'misterio_biblico',
  'crucigrama_biblico',
  'completa_versiculo',
  'aprende_biblia',
  'retos_sabado',
  'ruleta_sabado',
  'talentos_juveniles',
  'aventuras_biblicas',
];

export function MiSociedadJovenesView({
  onBack,
  onOpenProjector,
  onOpenGamePresenter,
  onOpenGameProjector,
  onJoinGameCode,
  initialProgramId,
}: MiSociedadJovenesViewProps) {
  const [directorToken, setDirectorToken] = useState<string>(() => {
    try {
      return localStorage.getItem(YS_DIRECTOR_TOKEN_KEY) || '';
    } catch {
      return '';
    }
  });
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState<string>(
    initialProgramId || ''
  );
  const [draft, setDraft] = useState<YouthProgramPlan | null>(null);
  const [live, setLive] = useState<LivePayload | null>(null);
  const [tab, setTab] = useState<ModuleTab>('config');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [wsConnected, setWsConnected] = useState(false);

  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  // PIN gate modal
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinErr, setPinErr] = useState('');

  // Generator config
  const [config, setConfig] = useState<YouthProgramConfigInput>({
    durationMinutes: 90,
    estimatedParticipants: 40,
    participationMode: 'equipos',
    difficulty: 'combinado',
    spiritualTheme: '',
    experienceType: 'combinada',
    includeSections: ['A', 'B', 'D', 'E', 'J', 'M'],
    avoidSections: [],
    includeCompetitions: true,
    includeTalents: false,
    includeMission: true,
    scheduledDate: getUpcomingSaturdayIso(),
    directorName: 'Dirección Juvenil',
  });

  // Replacement modal state
  const [replaceTargetIdx, setReplaceTargetIdx] = useState<number | null>(null);
  const [alternatives, setAlternatives] = useState<ReplacementAlternative[]>([]);
  const [loadingAlts, setLoadingAlts] = useState(false);

  // Recover past activity modal
  const [showRecoverModal, setShowRecoverModal] = useState(false);

  // Onsite validation note & director final observations
  const [onsiteNoteInput, setOnsiteNoteInput] = useState('');
  const [finalObsInput, setFinalObsInput] = useState('');

  // Ambient sound preferences
  const [audioPrefs, setAudioPrefs] = useState(() =>
    youthSocietyAudio.getPrefs()
  );

  const lastCueNonceRef = useRef<number>(-1);
  const isDirector = Boolean(overview?.isDirector);

  const authHeaders = useMemo((): Record<string, string> => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (directorToken) h['x-youth-director-token'] = directorToken;
    return h;
  }, [directorToken]);

  useEffect(() => {
    return youthSocietyAudio.subscribe(() => {
      setAudioPrefs(youthSocietyAudio.getPrefs());
    });
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const showMsg = (type: 'ok' | 'err', text: string) => {
    setNotice({ type, text });
    window.setTimeout(() => {
      setNotice((prev) => (prev?.text === text ? null : prev));
    }, 5500);
  };

  const loadOverview = useCallback(
    async (preferId?: string) => {
      try {
        const res = await fetch('/api/mi-sociedad/overview', {
          headers: directorToken
            ? { 'x-youth-director-token': directorToken }
            : undefined,
        });
        if (!res.ok) return;
        const data = (await res.json()) as OverviewPayload;
        setOverview(data);
        const resolvedId =
          preferId ||
          (selectedProgramId &&
          data.programs.some((p) => p.id === selectedProgramId)
            ? selectedProgramId
            : data.activeProgramId || data.programs[0]?.id || '');

        if (resolvedId) {
          setSelectedProgramId(resolvedId);
          const found = data.programs.find((p) => p.id === resolvedId);
          if (found) {
            setDraft((cur) => (cur && cur.id === found.id ? cur : found));
          }
        }
      } catch {
        // ignore transient error
      }
    },
    [directorToken, selectedProgramId]
  );

  useEffect(() => {
    loadOverview(initialProgramId);
  }, [loadOverview, initialProgramId]);

  // Real-time WebSocket subscription for active selectedProgramId
  useEffect(() => {
    if (!selectedProgramId) {
      setLive(null);
      return;
    }
    let active = true;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;

    const fetchOnce = async () => {
      try {
        const res = await fetch(
          `/api/mi-sociedad/live/${encodeURIComponent(selectedProgramId)}`
        );
        if (res.ok && active) {
          const payload = (await res.json()) as LivePayload;
          setLive(payload);
        }
      } catch {
        // ignore
      }
    };

    const connect = () => {
      if (!active) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${proto}//${window.location.host}/ws`);
      ws = socket;

      socket.onopen = () => {
        if (!active) return;
        setWsConnected(true);
        socket.send(
          JSON.stringify({
            type: 'ys_subscribe',
            programId: selectedProgramId,
            role: isDirector ? 'director' : 'participant',
          })
        );
      };

      socket.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(String(ev.data || '{}'));
          if (parsed.type === 'ys_state' && parsed.payload && active) {
            const payload = parsed.payload as LivePayload;
            setLive(payload);
            const nonce = payload.program.liveState.soundCueNonce || 0;
            if (lastCueNonceRef.current === -1) {
              lastCueNonceRef.current = nonce;
            } else if (nonce > lastCueNonceRef.current) {
              lastCueNonceRef.current = nonce;
              youthSocietyAudio.playMood(
                payload.program.liveState.lastSoundMood || 'transicion'
              );
            }
          }
        } catch {
          // ignore
        }
      };

      socket.onclose = () => {
        if (!active) return;
        setWsConnected(false);
        reconnectTimer = window.setTimeout(connect, 2400);
      };

      socket.onerror = () => socket.close();
    };

    fetchOnce();
    connect();

    return () => {
      active = false;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [selectedProgramId, isDirector]);

  const requireDirector = (): boolean => {
    if (isDirector) return true;
    setShowPinModal(true);
    return false;
  };

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinErr('');
    try {
      const res = await fetch('/api/mi-sociedad/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPinErr(data.error || 'Clave incorrecta.');
        return;
      }
      localStorage.setItem(YS_DIRECTOR_TOKEN_KEY, data.token);
      setDirectorToken(data.token);
      setShowPinModal(false);
      setPinInput('');
      showMsg('ok', 'Modo Director autorizado correctamente.');
    } catch {
      setPinErr('Error de conexión.');
    }
  };

  const handleLogoutDirector = () => {
    try {
      localStorage.removeItem(YS_DIRECTOR_TOKEN_KEY);
    } catch {
      // ignore
    }
    setDirectorToken('');
    showMsg('ok', 'Sesión de director cerrada (solo lectura).');
  };

  const handleGenerateProgram = async (engine: 'ai' | 'curated') => {
    if (!requireDirector()) return;
    setBusy(`gen_${engine}`);
    try {
      const res = await fetch('/api/mi-sociedad/generate', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ engine, config }),
      });
      const data = await res.json();
      if (!res.ok) {
        showMsg('err', data.error || 'No se pudo generar el programa.');
        return;
      }
      const created = data.program as YouthProgramPlan;
      setSelectedProgramId(created.id);
      setDraft(created);
      setTab('editor');
      await loadOverview(created.id);
      youthSocietyAudio.playMood('bienvenida');
      showMsg(
        'ok',
        `Programa "${created.creativeName}" generado (${created.totalDurationMin} min exactos).`
      );
    } catch {
      showMsg('err', 'Error de conexión al generar el programa.');
    } finally {
      setBusy(null);
    }
  };

  const saveDraftChanges = async (
    targetPlan: YouthProgramPlan,
    statusOverride?: 'draft' | 'final'
  ) => {
    if (!requireDirector()) return;
    setBusy('save');
    try {
      const res = await fetch(
        `/api/mi-sociedad/programs/${encodeURIComponent(targetPlan.id)}`,
        {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify({
            ...targetPlan,
            status: statusOverride || targetPlan.status,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        showMsg('err', data.error || 'No se pudo guardar.');
        return;
      }
      const updated = data.program as YouthProgramPlan;
      setDraft(updated);
      await loadOverview(updated.id);
      youthSocietyAudio.playMood('reconocimiento');
      showMsg(
        'ok',
        statusOverride === 'final'
          ? 'Programa guardado como definitivo.'
          : 'Borrador guardado correctamente.'
      );
    } catch {
      showMsg('err', 'Error al guardar el programa.');
    } finally {
      setBusy(null);
    }
  };

  const openReplacementModal = async (idx: number) => {
    if (!draft || !requireDirector()) return;
    const act = draft.activities[idx];
    setReplaceTargetIdx(idx);
    setAlternatives([]);
    setLoadingAlts(true);
    try {
      const res = await fetch('/api/mi-sociedad/suggest-replacements', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          sectionCode: act.sectionCode,
          durationMin: act.durationMin,
          currentTitle: act.title,
          centralTheme: draft.centralTheme,
        }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.alternatives)) {
        setAlternatives(data.alternatives);
      }
    } catch {
      // ignore
    } finally {
      setLoadingAlts(false);
    }
  };

  const applyReplacement = async (alt: ReplacementAlternative) => {
    if (!draft || replaceTargetIdx === null) return;
    const updatedActs = draft.activities.map((a, i) =>
      i === replaceTargetIdx
        ? {
            ...a,
            title: alt.title,
            description: alt.description,
            materials: alt.materials,
            directorInstructions: alt.directorInstructions,
            participantInstructions: alt.participantInstructions,
            biblicalReference: alt.biblicalReference,
            ...(alt.scripturalText ? { scripturalText: alt.scripturalText } : {}),
            durationMin: alt.durationMin,
          }
        : a
    );
    const nextPlan = {
      ...draft,
      activities: updatedActs,
      totalDurationMin: updatedActs.reduce((s, a) => s + a.durationMin, 0),
    };
    setDraft(nextPlan);
    setReplaceTargetIdx(null);
    if (tab === 'live') {
      await saveDraftChanges(nextPlan);
    }
    showMsg('ok', 'Actividad reemplazada conservando la duración y el historial.');
  };

  const handleSurpriseSwap = async (idx: number) => {
    if (!draft || !requireDirector()) return;
    const act = draft.activities[idx];
    setBusy(`surp_${idx}`);
    try {
      const res = await fetch('/api/mi-sociedad/surprise-activity', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ durationMin: act.durationMin }),
      });
      const data = await res.json();
      if (!res.ok || !data.activity) {
        showMsg('err', data.error || 'No se pudo obtener sorpresa.');
        return;
      }
      const nextActs = draft.activities.map((a, i) =>
        i === idx ? { ...data.activity, order: idx + 1 } : a
      );
      const nextPlan = {
        ...draft,
        activities: nextActs,
        totalDurationMin: nextActs.reduce((s, a) => s + a.durationMin, 0),
      };
      setDraft(nextPlan);
      youthSocietyAudio.playMood('misterio');
      if (tab === 'live') {
        await saveDraftChanges(nextPlan);
      }
      showMsg('ok', '¡Actividad renovada con una propuesta sorpresa!');
    } catch {
      showMsg('err', 'Error de conexión.');
    } finally {
      setBusy(null);
    }
  };

  const runLiveAction = async (
    action: string,
    extra?: Record<string, unknown>
  ) => {
    const pid = live?.program?.id || draft?.id;
    if (!pid || !requireDirector()) return;
    setBusy(`live_${action}`);
    try {
      const res = await fetch(
        `/api/mi-sociedad/programs/${encodeURIComponent(pid)}/live`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ action, ...extra }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        showMsg('err', data.error || 'No se pudo ejecutar la acción.');
        return;
      }
      const updated = data.program as YouthProgramPlan;
      setDraft(updated);
      if (action === 'finish') {
        await loadOverview(updated.id);
        showMsg(
          'ok',
          'Programa finalizado y archivado en el Historial y Estadísticas de Sociedad de Jóvenes.'
        );
      }
    } catch {
      showMsg('err', 'Error de conexión con la sala en vivo.');
    } finally {
      setBusy(null);
    }
  };

  const launchRealGameForActivity = async (act: YouthProgramActivityItem) => {
    if (!requireDirector()) return;
    const mode: GameMode = act.linkedGameMode || 'clasico';
    setBusy(`launch_${act.id}`);
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: act.title,
          mode,
          difficulty: draft?.config.difficulty || 'combinado',
          questionCount: 10,
          timeLimitSec: 20,
          teamMode: mode === 'equipos' || mode === 'competencia_equipos',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showMsg('err', data.error || 'No se pudo abrir la partida.');
        return;
      }
      try {
        localStorage.setItem(`dtqd_presenter_${data.code}`, data.presenterToken);
        localStorage.setItem('dtqd_last_presenter_code', data.code);
      } catch {
        // ignore
      }
      await runLiveAction('link_game', {
        activityId: act.id,
        code: data.code,
        gameId: data.gameId,
        invitePath: `/partida/${encodeURIComponent(data.gameId)}?s=${encodeURIComponent(data.inviteSignature)}`,
        mode,
      });
      youthSocietyAudio.playMood('competencia');
      showMsg(
        'ok',
        `Sala real creada (${data.code}) conectada con QR, avatares y puntuación oficial.`
      );
    } catch {
      showMsg('err', 'Error al crear la sala del juego.');
    } finally {
      setBusy(null);
    }
  };

  const activeLiveProgram = live?.program || draft;

  const liveRemainingSec = useMemo(() => {
    const p = activeLiveProgram;
    if (!p) return 0;
    if (
      p.liveState.playbackStatus === 'en_curso' &&
      p.liveState.timerRunning &&
      typeof p.liveState.timerEndsAt === 'number'
    ) {
      return Math.max(0, Math.ceil((p.liveState.timerEndsAt - nowMs) / 1000));
    }
    if (typeof p.liveState.timerPausedRemainingSec === 'number') {
      return Math.max(0, Math.round(p.liveState.timerPausedRemainingSec));
    }
    return live?.remainingSec ?? 0;
  }, [activeLiveProgram, live?.remainingSec, nowMs]);

  const draftTotalMinutes = draft
    ? draft.activities.reduce((s, a) => s + (a.durationMin || 0), 0)
    : 0;

  const toggleSectionPref = (
    listKey: 'includeSections' | 'avoidSections',
    code: YouthSectionCode
  ) => {
    setConfig((prev) => {
      const otherKey =
        listKey === 'includeSections' ? 'avoidSections' : 'includeSections';
      const exists = prev[listKey].includes(code);
      return {
        ...prev,
        [listKey]: exists
          ? prev[listKey].filter((c) => c !== code)
          : [...prev[listKey], code],
        [otherKey]: prev[otherKey].filter((c) => c !== code),
      };
    });
  };

  const openLinkedPresenter = (code: string) => {
    try {
      const tok = localStorage.getItem(`dtqd_presenter_${code.toUpperCase()}`);
      if (tok) {
        onOpenGamePresenter(code.toUpperCase(), tok);
        return;
      }
    } catch {
      // ignore
    }
    showMsg(
      'err',
      'Esta sala fue abierta en otro navegador. Proyéctala o entra como jugador.'
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-xl bg-[#111A2E] hover:bg-[#16213B] border border-white/10 text-slate-200 cursor-pointer shrink-0"
            aria-label="Volver al inicio"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h1 className="font-display font-extrabold text-xl sm:text-2xl text-white tracking-tight truncate">
              Mi Sociedad de Jóvenes
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 truncate">
              Planificador inteligente semanal · Edita, proyecta y dirige en tiempo real ·{' '}
              <span className={wsConnected ? 'text-emerald-400' : 'text-amber-300'}>
                {wsConnected ? 'En vivo' : 'Listo'}
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setTab('config')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-xs sm:text-sm whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Wand2 className="w-4 h-4" />
            CREAR PROGRAMA AUTOMÁTICO
          </button>

          {isDirector ? (
            <button
              type="button"
              onClick={handleLogoutDirector}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Unlock className="w-3.5 h-3.5" />
              Director autorizado
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowPinModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#111A2E] border border-amber-400/45 text-amber-300 hover:bg-[#16213B] text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              Acceso Director
            </button>
          )}

          {activeLiveProgram && (
            <button
              type="button"
              onClick={() => onOpenProjector(activeLiveProgram.id)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
            >
              <MonitorPlay className="w-4 h-4" />
              Modo Proyección
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {notice && (
        <div
          className={`px-4 py-3 rounded-xl border text-sm flex items-center justify-between gap-3 ${
            notice.type === 'ok'
              ? 'bg-emerald-500/10 border-emerald-400/40 text-emerald-200'
              : 'bg-rose-500/10 border-rose-400/40 text-rose-200'
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Program Switcher + Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-[#111A2E] border border-white/10 rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'config', label: 'Generar Automático', icon: Wand2 },
              { id: 'editor', label: 'Editor del Programa', icon: Edit3 },
              { id: 'live', label: 'Director en Vivo', icon: Play },
              { id: 'history', label: 'Historial y Estadísticas', icon: BarChart3 },
              { id: 'audio', label: 'Sonidos y Ambientación', icon: Volume2 },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  tab === item.id
                    ? 'bg-amber-400 border-amber-400 text-slate-950 font-bold'
                    : 'bg-[#0B1221] border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>

        {overview && overview.programs.length > 0 && (
          <div className="flex items-center gap-2 min-w-[220px]">
            <select
              value={selectedProgramId}
              onChange={(e) => {
                const pid = e.target.value;
                setSelectedProgramId(pid);
                const found = overview.programs.find((p) => p.id === pid);
                if (found) setDraft(found);
              }}
              className="flex-1 bg-[#080E1E] border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
            >
              {overview.programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.creativeName} ({p.config.scheduledDate}) · {p.status === 'final' ? 'Definitivo' : 'Borrador'}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => loadOverview(selectedProgramId)}
              className="p-2 rounded-xl bg-[#080E1E] border border-white/15 text-slate-300 hover:text-white cursor-pointer"
              title="Actualizar lista"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: CONFIGURACIÓN & GENERADOR AUTOMÁTICO INTELIGENTE */}
      {tab === 'config' && (
        <div className="space-y-6">
          {/* Presets */}
          <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4">
            <div>
              <h2 className="font-display font-bold text-lg text-white">
                Configuraciones Predeterminadas Rápidas
              </h2>
              <p className="text-xs text-slate-400">
                Aplica una plantilla base con un toque o ajusta cada parámetro manualmente.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {YOUTH_CONFIG_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      ...preset.config,
                    }))
                  }
                  className="text-left bg-[#0B1221] hover:bg-[#16213B] border border-white/10 rounded-xl p-4 space-y-1.5 cursor-pointer transition-colors"
                >
                  <div className="font-display font-bold text-sm text-amber-300">
                    {preset.label}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {preset.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Full Configurator */}
          <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-slate-400">Duración del programa</label>
                <div className="grid grid-cols-3 gap-2 mt-1.5">
                  {([60, 90, 120] as const).map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() =>
                        setConfig((p) => ({ ...p, durationMinutes: dur }))
                      }
                      className={`py-2 rounded-xl text-xs font-mono-num font-bold border cursor-pointer ${
                        config.durationMinutes === dur
                          ? 'bg-amber-400 border-amber-400 text-slate-950'
                          : 'bg-[#080E1E] border-white/15 text-slate-200'
                      }`}
                    >
                      {dur} min
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400">
                  Participantes aproximados
                </label>
                <input
                  type="number"
                  min={4}
                  max={500}
                  value={config.estimatedParticipants}
                  onChange={(e) =>
                    setConfig((p) => ({
                      ...p,
                      estimatedParticipants: Math.max(
                        4,
                        Number(e.target.value) || 30
                      ),
                    }))
                  }
                  className="mt-1.5 w-full bg-[#080E1E] border border-white/15 rounded-xl px-3.5 py-2 text-sm font-mono-num text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">Modalidad</label>
                <select
                  value={config.participationMode}
                  onChange={(e) =>
                    setConfig((p) => ({
                      ...p,
                      participationMode: e.target.value as YouthParticipationMode,
                    }))
                  }
                  className="mt-1.5 w-full bg-[#080E1E] border border-white/15 rounded-xl px-3.5 py-2 text-sm text-white"
                >
                  <option value="individual">Individual</option>
                  <option value="parejas">Parejas</option>
                  <option value="equipos">Equipos</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400">Dificultad bíblica</label>
                <select
                  value={config.difficulty}
                  onChange={(e) =>
                    setConfig((p) => ({
                      ...p,
                      difficulty: e.target.value as DifficultySetting,
                    }))
                  }
                  className="mt-1.5 w-full bg-[#080E1E] border border-white/15 rounded-xl px-3.5 py-2 text-sm text-white"
                >
                  <option value="facil">Fácil</option>
                  <option value="intermedio">Intermedio</option>
                  <option value="dificil">Difícil</option>
                  <option value="combinado">Combinado</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400">Tipo de experiencia</label>
                <select
                  value={config.experienceType}
                  onChange={(e) =>
                    setConfig((p) => ({
                      ...p,
                      experienceType: e.target.value as YouthExperienceType,
                    }))
                  }
                  className="mt-1.5 w-full bg-[#080E1E] border border-white/15 rounded-xl px-3.5 py-2 text-sm text-white"
                >
                  <option value="combinada">Combinada (equilibrada)</option>
                  <option value="divertida">Divertida</option>
                  <option value="educativa">Educativa</option>
                  <option value="evangelistica">Evangelística</option>
                  <option value="reflexiva">Reflexiva</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400">Fecha del sábado</label>
                <input
                  type="date"
                  value={config.scheduledDate}
                  onChange={(e) =>
                    setConfig((p) => ({ ...p, scheduledDate: e.target.value }))
                  }
                  className="mt-1.5 w-full bg-[#080E1E] border border-white/15 rounded-xl px-3.5 py-2 text-sm font-mono-num text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs text-slate-400">
                  Tema espiritual (dejar vacío para sugerencia automática sin repetir)
                </label>
                <input
                  type="text"
                  value={config.spiritualTheme}
                  onChange={(e) =>
                    setConfig((p) => ({ ...p, spiritualTheme: e.target.value }))
                  }
                  placeholder="Ej: Valentía para ser luz en el colegio"
                  className="mt-1.5 w-full bg-[#080E1E] border border-white/15 rounded-xl px-3.5 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">Director del programa</label>
                <input
                  type="text"
                  value={config.directorName}
                  onChange={(e) =>
                    setConfig((p) => ({ ...p, directorName: e.target.value }))
                  }
                  className="mt-1.5 w-full bg-[#080E1E] border border-white/15 rounded-xl px-3.5 py-2 text-sm text-white"
                />
              </div>
            </div>

            {/* Boolean Switches */}
            <div className="flex flex-wrap gap-6 border-t border-white/10 pt-4">
              <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeCompetitions}
                  onChange={(e) =>
                    setConfig((p) => ({
                      ...p,
                      includeCompetitions: e.target.checked,
                    }))
                  }
                  className="accent-amber-400"
                />
                Incluir competencias / duelos
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeTalents}
                  onChange={(e) =>
                    setConfig((p) => ({
                      ...p,
                      includeTalents: e.target.checked,
                    }))
                  }
                  className="accent-amber-400"
                />
                Incluir talentos juveniles
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeMission}
                  onChange={(e) =>
                    setConfig((p) => ({
                      ...p,
                      includeMission: e.target.checked,
                    }))
                  }
                  className="accent-amber-400"
                />
                Incluir misión espiritual
              </label>
            </div>

            {/* Sections A-M Include / Avoid */}
            <div className="border-t border-white/10 pt-4 space-y-3">
              <div className="text-xs font-semibold text-slate-300">
                Secciones disponibles (A–M): indica cuáles deseas priorizar o evitar
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {YOUTH_SECTIONS.map((sec) => {
                  const inc = config.includeSections.includes(sec.code);
                  const avd = config.avoidSections.includes(sec.code);
                  return (
                    <div
                      key={sec.code}
                      className="flex items-center justify-between gap-2 bg-[#0B1221] border border-white/10 rounded-xl px-3 py-2 text-xs"
                    >
                      <span className="text-white truncate">
                        <strong className="font-mono-num text-amber-300 mr-1.5">
                          {sec.code}.
                        </strong>
                        {sec.label}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleSectionPref('includeSections', sec.code)}
                          className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                            inc
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-[#16213B] text-slate-300'
                          }`}
                        >
                          Incluir
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleSectionPref('avoidSections', sec.code)}
                          className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                            avd
                              ? 'bg-rose-500 text-white'
                              : 'bg-[#16213B] text-slate-400'
                          }`}
                        >
                          Evitar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Generate Actions */}
            <div className="border-t border-white/10 pt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => handleGenerateProgram('ai')}
                className="px-6 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-sm inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                {busy === 'gen_ai'
                  ? 'Generando programa con IA...'
                  : 'CREAR PROGRAMA AUTOMÁTICO (IA)'}
              </button>

              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => handleGenerateProgram('curated')}
                className="px-5 py-3.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/45 text-sky-200 font-display font-bold text-sm inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                <BookOpen className="w-4 h-4" />
                {busy === 'gen_curated'
                  ? 'Armando propuesta...'
                  : 'Generar con Biblioteca Bíblica Curada'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EDITOR DEL PROGRAMA */}
      {tab === 'editor' && (
        <div className="space-y-6">
          {!draft ? (
            <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-10 text-center space-y-3">
              <p className="font-display font-bold text-lg text-white">
                Aún no hay un programa seleccionado para editar
              </p>
              <button
                type="button"
                onClick={() => setTab('config')}
                className="px-5 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
              >
                Ir a CREAR PROGRAMA AUTOMÁTICO
              </button>
            </div>
          ) : (
            <>
              {/* Summary + Save Actions */}
              <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div className="text-xs text-slate-400">
                    Duración objetivo:{' '}
                    <strong className="font-mono-num text-white">
                      {draft.config.durationMinutes} min
                    </strong>{' '}
                    · Suma actual:{' '}
                    <strong
                      className={`font-mono-num ${
                        draftTotalMinutes === draft.config.durationMinutes
                          ? 'text-emerald-400'
                          : 'text-amber-300'
                      }`}
                    >
                      {draftTotalMinutes} min
                    </strong>{' '}
                    · Origen:{' '}
                    <span className="text-sky-300">
                      {draft.generationSource === 'gemini_ai'
                        ? 'IA Gemini'
                        : 'Biblioteca Curada'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {draftTotalMinutes !== draft.config.durationMinutes && (
                      <button
                        type="button"
                        onClick={() => {
                          const rebalanced = rebalanceYouthActivities(
                            draft.activities,
                            draft.config.durationMinutes
                          );
                          setDraft({
                            ...draft,
                            activities: rebalanced,
                            totalDurationMin: draft.config.durationMinutes,
                          });
                        }}
                        className="px-3.5 py-2 rounded-xl bg-amber-500/20 border border-amber-400/45 text-amber-200 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Ajustar tiempos a {draft.config.durationMinutes} min
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setTab('config')}
                      className="px-3.5 py-2 rounded-xl bg-[#0B1221] border border-white/15 text-slate-200 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Generar otra propuesta
                    </button>

                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => saveDraftChanges(draft, 'draft')}
                      className="px-4 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/45 text-sky-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Guardar Borrador
                    </button>

                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => saveDraftChanges(draft, 'final')}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Guardar Programa Definitivo
                    </button>
                  </div>
                </div>

                {draft.repetitionWarnings.length > 0 && (
                  <div className="bg-amber-500/10 border border-amber-400/35 rounded-xl p-3.5 text-xs text-amber-200 space-y-1">
                    {draft.repetitionWarnings.map((w, i) => (
                      <div key={i}>• {w}</div>
                    ))}
                  </div>
                )}

                {/* Program Metadata Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400">Nombre creativo</label>
                    <input
                      type="text"
                      value={draft.creativeName}
                      onChange={(e) =>
                        setDraft({ ...draft, creativeName: e.target.value })
                      }
                      className="mt-1 w-full bg-[#080E1E] border border-white/15 rounded-xl px-3.5 py-2 text-sm text-white font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Tema central</label>
                    <input
                      type="text"
                      value={draft.centralTheme}
                      onChange={(e) =>
                        setDraft({ ...draft, centralTheme: e.target.value })
                      }
                      className="mt-1 w-full bg-[#080E1E] border border-white/15 rounded-xl px-3.5 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">
                      Texto bíblico principal (cita verificada)
                    </label>
                    <input
                      type="text"
                      value={draft.mainBibleText}
                      onChange={(e) =>
                        setDraft({ ...draft, mainBibleText: e.target.value })
                      }
                      className="mt-1 w-full bg-[#080E1E] border border-white/15 rounded-xl px-3.5 py-2 text-sm text-amber-300 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Objetivo espiritual</label>
                    <input
                      type="text"
                      value={draft.spiritualObjective}
                      onChange={(e) =>
                        setDraft({ ...draft, spiritualObjective: e.target.value })
                      }
                      className="mt-1 w-full bg-[#080E1E] border border-white/15 rounded-xl px-3.5 py-2 text-sm text-white"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-slate-400">
                      Texto bíblico literal (para proyectar)
                    </label>
                    <textarea
                      rows={2}
                      value={draft.mainBibleVerseQuote}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          mainBibleVerseQuote: e.target.value,
                        })
                      }
                      className="mt-1 w-full bg-[#080E1E] border border-white/15 rounded-xl px-3.5 py-2 text-xs text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Introducción</label>
                    <textarea
                      rows={2}
                      value={draft.introduction}
                      onChange={(e) =>
                        setDraft({ ...draft, introduction: e.target.value })
                      }
                      className="mt-1 w-full bg-[#080E1E] border border-white/15 rounded-xl px-3.5 py-2 text-xs text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Bienvenida</label>
                    <textarea
                      rows={2}
                      value={draft.welcomeSpeech}
                      onChange={(e) =>
                        setDraft({ ...draft, welcomeSpeech: e.target.value })
                      }
                      className="mt-1 w-full bg-[#080E1E] border border-white/15 rounded-xl px-3.5 py-2 text-xs text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Reflexión bíblica</label>
                    <textarea
                      rows={2}
                      value={draft.biblicalReflection}
                      onChange={(e) =>
                        setDraft({ ...draft, biblicalReflection: e.target.value })
                      }
                      className="mt-1 w-full bg-[#080E1E] border border-white/15 rounded-xl px-3.5 py-2 text-xs text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">
                      Aplicación práctica y desafío semanal
                    </label>
                    <textarea
                      rows={2}
                      value={draft.practicalApplication}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          practicalApplication: e.target.value,
                        })
                      }
                      className="mt-1 w-full bg-[#080E1E] border border-white/15 rounded-xl px-3.5 py-2 text-xs text-slate-200"
                    />
                  </div>
                </div>
              </div>

              {/* Activities List Editor */}
              <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                  <div>
                    <h3 className="font-display font-bold text-lg text-white">
                      Actividades Organizadas ({draft.activities.length})
                    </h3>
                    <p className="text-xs text-slate-400">
                      Reordena, cambia duración, vincula juegos existentes o usa
                      "Reemplazar esta actividad" / "Sorpréndeme".
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowRecoverModal(true)}
                      className="px-3.5 py-2 rounded-xl bg-[#0B1221] hover:bg-[#16213B] border border-white/15 text-sky-300 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <History className="w-3.5 h-3.5" />
                      Recuperar de sábado anterior
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const sec = getSectionMeta('A');
                        const nextAct: YouthProgramActivityItem = {
                          id: `YSA-${Date.now().toString(36)}`,
                          order: draft.activities.length + 1,
                          sectionCode: 'A',
                          sectionLabel: sec.label,
                          title: 'Nueva actividad personalizada',
                          description: 'Describe aquí el desarrollo de la actividad.',
                          durationMin: 8,
                          materials: 'Biblias',
                          directorInstructions: 'Guía al grupo paso a paso.',
                          participantInstructions: 'Participa activamente.',
                          transitionText: 'Continuamos con el siguiente bloque.',
                          biblicalReference: draft.mainBibleText,
                          scripturalText: '',
                          contentType: 'dinamica_practica',
                          directorReviewed: false,
                          soundMood: 'transicion',
                          status: 'pendiente',
                        };
                        const nextActs = [...draft.activities, nextAct];
                        setDraft({
                          ...draft,
                          activities: nextActs,
                          totalDurationMin: nextActs.reduce(
                            (s, a) => s + a.durationMin,
                            0
                          ),
                        });
                      }}
                      className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Agregar actividad
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-white/10">
                  {draft.activities.map((act, idx) => (
                    <div key={act.id} className="py-5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs text-slate-400">
                          <span className="font-mono-num font-bold text-amber-300 mr-1.5">
                            #{idx + 1} · Sección {act.sectionCode}
                          </span>
                          {act.sectionLabel} ·{' '}
                          <span className="text-sky-300">
                            {act.contentType === 'texto_biblico_literal'
                              ? 'Texto bíblico literal'
                              : act.contentType === 'adaptacion_narrativa'
                                ? 'Adaptación narrativa'
                                : 'Dinámica práctica'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => openReplacementModal(idx)}
                            className="px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 text-sky-200 text-[11px] font-bold cursor-pointer whitespace-nowrap shrink-0"
                          >
                            REEMPLAZAR ESTA ACTIVIDAD
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(busy)}
                            onClick={() => handleSurpriseSwap(idx)}
                            className="px-2.5 py-1.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-400/45 text-orange-200 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <PackageOpen className="w-3 h-3" />
                            SORPRÉNDEME
                          </button>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => {
                              const copy = [...draft.activities];
                              const [m] = copy.splice(idx, 1);
                              copy.splice(idx - 1, 0, m);
                              setDraft({
                                ...draft,
                                activities: copy.map((a, i) => ({
                                  ...a,
                                  order: i + 1,
                                })),
                              });
                            }}
                            className="p-1.5 rounded-lg bg-[#0B1221] border border-white/10 text-slate-300 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === draft.activities.length - 1}
                            onClick={() => {
                              const copy = [...draft.activities];
                              const [m] = copy.splice(idx, 1);
                              copy.splice(idx + 1, 0, m);
                              setDraft({
                                ...draft,
                                activities: copy.map((a, i) => ({
                                  ...a,
                                  order: i + 1,
                                })),
                              });
                            }}
                            className="p-1.5 rounded-lg bg-[#0B1221] border border-white/10 text-slate-300 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const nextActs = draft.activities
                                .filter((_, i) => i !== idx)
                                .map((a, i) => ({ ...a, order: i + 1 }));
                              setDraft({
                                ...draft,
                                activities: nextActs,
                                totalDurationMin: nextActs.reduce(
                                  (s, a) => s + a.durationMin,
                                  0
                                ),
                              });
                            }}
                            className="p-1.5 rounded-lg bg-[#0B1221] border border-white/10 text-rose-300 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                        <input
                          type="text"
                          value={act.title}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              activities: draft.activities.map((a, i) =>
                                i === idx ? { ...a, title: e.target.value } : a
                              ),
                            })
                          }
                          className="md:col-span-6 bg-[#080E1E] border border-white/15 rounded-xl px-3 py-2 text-sm font-semibold text-white"
                        />
                        <div className="md:col-span-2 flex items-center gap-1.5">
                          <input
                            type="number"
                            min={1}
                            max={90}
                            value={act.durationMin}
                            onChange={(e) => {
                              const val = Math.max(1, Number(e.target.value) || 5);
                              const nextActs = draft.activities.map((a, i) =>
                                i === idx ? { ...a, durationMin: val } : a
                              );
                              setDraft({
                                ...draft,
                                activities: nextActs,
                                totalDurationMin: nextActs.reduce(
                                  (s, a) => s + a.durationMin,
                                  0
                                ),
                              });
                            }}
                            className="w-full bg-[#080E1E] border border-white/15 rounded-xl px-2.5 py-2 text-sm font-mono-num text-white text-center"
                          />
                          <span className="text-xs text-slate-400">min</span>
                        </div>
                        <select
                          value={act.linkedGameMode || ''}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              activities: draft.activities.map((a, i) =>
                                i === idx
                                  ? {
                                      ...a,
                                      linkedGameMode:
                                        (e.target.value as GameMode) || undefined,
                                    }
                                  : a
                              ),
                            })
                          }
                          className="md:col-span-4 bg-[#080E1E] border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                        >
                          <option value="">Sin juego digital vinculado</option>
                          {LINKABLE_MODES.map((m) => (
                            <option key={m} value={m}>
                              Juego: {GAME_MODE_INFO[m].name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <textarea
                        rows={2}
                        value={act.description}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            activities: draft.activities.map((a, i) =>
                              i === idx ? { ...a, description: e.target.value } : a
                            ),
                          })
                        }
                        className="w-full bg-[#080E1E] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200"
                      />

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                        <input
                          type="text"
                          value={act.directorInstructions}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              activities: draft.activities.map((a, i) =>
                                i === idx
                                  ? { ...a, directorInstructions: e.target.value }
                                  : a
                              ),
                            })
                          }
                          placeholder="Instrucciones para el director"
                          className="bg-[#080E1E] border border-white/10 rounded-xl px-3 py-1.5 text-slate-300"
                        />
                        <input
                          type="text"
                          value={act.participantInstructions}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              activities: draft.activities.map((a, i) =>
                                i === idx
                                  ? {
                                      ...a,
                                      participantInstructions: e.target.value,
                                    }
                                  : a
                              ),
                            })
                          }
                          placeholder="Instrucciones para participantes"
                          className="bg-[#080E1E] border border-white/10 rounded-xl px-3 py-1.5 text-slate-300"
                        />
                        <input
                          type="text"
                          value={act.materials}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              activities: draft.activities.map((a, i) =>
                                i === idx ? { ...a, materials: e.target.value } : a
                              ),
                            })
                          }
                          placeholder="Materiales"
                          className="bg-[#080E1E] border border-white/10 rounded-xl px-3 py-1.5 text-slate-300"
                        />
                      </div>

                      {/* Reliable Biblical Content Verification Row */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={act.biblicalReference}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                activities: draft.activities.map((a, i) =>
                                  i === idx
                                    ? { ...a, biblicalReference: e.target.value }
                                    : a
                                ),
                              })
                            }
                            placeholder="Cita bíblica"
                            className="bg-[#080E1E] border border-white/10 rounded-lg px-2.5 py-1 text-amber-300 w-36"
                          />
                          <select
                            value={act.contentType}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                activities: draft.activities.map((a, i) =>
                                  i === idx
                                    ? {
                                        ...a,
                                        contentType: e.target
                                          .value as YouthBiblicalContentType,
                                      }
                                    : a
                                ),
                              })
                            }
                            className="bg-[#080E1E] border border-white/10 rounded-lg px-2.5 py-1 text-slate-200"
                          >
                            <option value="texto_biblico_literal">
                              Texto bíblico literal
                            </option>
                            <option value="adaptacion_narrativa">
                              Adaptación narrativa
                            </option>
                            <option value="dinamica_practica">
                              Dinámica práctica
                            </option>
                          </select>
                        </div>

                        <label className="inline-flex items-center gap-2 text-emerald-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={act.directorReviewed}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                activities: draft.activities.map((a, i) =>
                                  i === idx
                                    ? { ...a, directorReviewed: e.target.checked }
                                    : a
                                ),
                              })
                            }
                            className="accent-emerald-400"
                          />
                          <BookCheck className="w-3.5 h-3.5" />
                          Contenido bíblico revisado antes de proyectar
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 3: MODO DIRECTOR EN VIVO */}
      {tab === 'live' && (
        <div className="space-y-6">
          {!activeLiveProgram ? (
            <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-10 text-center space-y-3">
              <p className="font-display font-bold text-lg text-white">
                Selecciona o genera un programa para dirigirlo en vivo
              </p>
              <button
                type="button"
                onClick={() => setTab('config')}
                className="px-5 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
              >
                CREAR PROGRAMA AUTOMÁTICO
              </button>
            </div>
          ) : (
            (() => {
              const curIdx = activeLiveProgram.liveState.currentActivityIndex;
              const curAct = activeLiveProgram.activities[curIdx] || null;
              const nextAct = activeLiveProgram.activities[curIdx + 1] || null;
              return (
                <div className="space-y-6">
                  {/* Live Playback Bar */}
                  <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-5">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4">
                      <div>
                        <div className="text-xs font-semibold text-amber-300">
                          {activeLiveProgram.config.scheduledDate} ·{' '}
                          {activeLiveProgram.mainBibleText} ·{' '}
                          <span className="font-mono-num text-white">
                            Actividad {curIdx + 1}/{activeLiveProgram.activities.length}
                          </span>
                        </div>
                        <h2 className="font-display font-extrabold text-2xl text-white">
                          {activeLiveProgram.creativeName}
                        </h2>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <div className="text-[11px] text-slate-400">
                            Tiempo restante
                          </div>
                          <div className="font-mono-num font-extrabold text-4xl text-amber-400">
                            {formatMmSs(liveRemainingSec)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      {activeLiveProgram.liveState.playbackStatus === 'en_curso' ? (
                        <button
                          type="button"
                          disabled={!isDirector || Boolean(busy)}
                          onClick={() => runLiveAction('pause')}
                          className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                        >
                          <Pause className="w-4 h-4" />
                          Pausar
                        </button>
                      ) : activeLiveProgram.liveState.playbackStatus === 'pausado' ? (
                        <button
                          type="button"
                          disabled={!isDirector || Boolean(busy)}
                          onClick={() => runLiveAction('resume')}
                          className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          Reanudar
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!isDirector || Boolean(busy)}
                          onClick={() => runLiveAction('start')}
                          className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          Iniciar Programa
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={!isDirector || Boolean(busy)}
                        onClick={() => runLiveAction('complete_next')}
                        className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Completar y Siguiente
                      </button>

                      <button
                        type="button"
                        disabled={!isDirector || Boolean(busy)}
                        onClick={() => runLiveAction('skip_next')}
                        className="px-3.5 py-2.5 rounded-xl bg-[#0B1221] border border-white/15 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                      >
                        <SkipForward className="w-4 h-4" />
                        Saltar actividad
                      </button>

                      <button
                        type="button"
                        disabled={!isDirector || Boolean(busy)}
                        onClick={() => runLiveAction('adjust_timer', { deltaSec: 60 })}
                        className="px-3 py-2.5 rounded-xl bg-[#0B1221] border border-white/15 text-slate-200 text-xs font-semibold cursor-pointer disabled:opacity-40"
                      >
                        +1 min
                      </button>

                      <button
                        type="button"
                        disabled={!isDirector || Boolean(busy)}
                        onClick={() => runLiveAction('reset_timer')}
                        className="px-3 py-2.5 rounded-xl bg-[#0B1221] border border-white/15 text-slate-200 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-40"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reiniciar
                      </button>

                      <button
                        type="button"
                        disabled={!isDirector || Boolean(busy)}
                        onClick={() => runLiveAction('insert_surprise')}
                        className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                      >
                        <PackageOpen className="w-4 h-4" />
                        Insertar Sorpresa
                      </button>

                      <button
                        type="button"
                        onClick={() => setTab('editor')}
                        className="px-3.5 py-2.5 rounded-xl bg-[#0B1221] border border-white/15 text-amber-300 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Modificar en vivo
                      </button>

                      <button
                        type="button"
                        disabled={!isDirector || Boolean(busy)}
                        onClick={() =>
                          runLiveAction('finish', {
                            directorObservations: finalObsInput,
                          })
                        }
                        className="ml-auto px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/45 text-emerald-200 text-xs font-bold cursor-pointer disabled:opacity-40"
                      >
                        Finalizar Programa
                      </button>
                    </div>

                    {activeLiveProgram.liveState.activeSurprise && (
                      <div className="bg-orange-500/10 border border-orange-400/45 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-bold text-orange-300">
                            SORPRESA ACTIVA EN PROYECCIÓN ·{' '}
                            {activeLiveProgram.liveState.activeSurprise.categoryLabel}
                          </div>
                          <div className="font-bold text-white text-sm">
                            {activeLiveProgram.liveState.activeSurprise.title}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => runLiveAction('dismiss_surprise')}
                          className="px-3 py-1.5 rounded-lg bg-[#080E1E] text-xs text-slate-200 border border-white/15 cursor-pointer"
                        >
                          Cerrar sorpresa
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Current Activity Detail + Game Launcher + Onsite Validation */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    <div className="lg:col-span-7 bg-[#111A2E] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4">
                      {curAct ? (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-sky-300">
                              Sección {curAct.sectionCode} · {curAct.sectionLabel}
                            </span>
                            <button
                              type="button"
                              onClick={() => openReplacementModal(curIdx)}
                              className="px-3 py-1.5 rounded-lg bg-sky-500/15 border border-sky-400/35 text-sky-200 text-xs font-semibold cursor-pointer"
                            >
                              Reemplazar esta actividad
                            </button>
                          </div>
                          <h3 className="font-display font-extrabold text-xl text-white">
                            {curAct.title}
                          </h3>
                          <p className="text-sm text-slate-200">{curAct.description}</p>
                          <div className="space-y-2 text-xs border-t border-white/10 pt-3">
                            <p className="text-amber-300">
                              <strong>Guía del Director:</strong>{' '}
                              {curAct.directorInstructions}
                            </p>
                            <p className="text-slate-300">
                              <strong>Para participantes:</strong>{' '}
                              {curAct.participantInstructions}
                            </p>
                            <p className="text-slate-400">
                              <strong>Transición:</strong> {curAct.transitionText}
                            </p>
                          </div>

                          {/* Game integration */}
                          {(curAct.linkedGameMode || curAct.linkedGameCode) && (
                            <div className="border-t border-white/10 pt-4 space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-bold text-amber-300 inline-flex items-center gap-1.5">
                                  <Gamepad2 className="w-4 h-4" />
                                  Integración con Juego Existente (
                                  {
                                    GAME_MODE_INFO[
                                      curAct.linkedGameMode || 'clasico'
                                    ]?.name
                                  }
                                  )
                                </span>

                                {!curAct.linkedGameCode ? (
                                  <button
                                    type="button"
                                    disabled={!isDirector || Boolean(busy)}
                                    onClick={() => launchRealGameForActivity(curAct)}
                                    className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold cursor-pointer"
                                  >
                                    Abrir Sala Real con QR
                                  </button>
                                ) : (
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openLinkedPresenter(curAct.linkedGameCode!)
                                      }
                                      className="px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
                                    >
                                      Presentador ({curAct.linkedGameCode})
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onOpenGameProjector(curAct.linkedGameCode!)
                                      }
                                      className="px-3 py-1.5 rounded-lg bg-[#080E1E] border border-white/15 text-slate-200 text-xs font-semibold cursor-pointer"
                                    >
                                      Proyector del Juego
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onJoinGameCode(curAct.linkedGameCode!)
                                      }
                                      className="px-3 py-1.5 rounded-lg bg-sky-500 text-slate-950 text-xs font-bold cursor-pointer"
                                    >
                                      Entrar como Participante
                                    </button>
                                  </div>
                                )}
                              </div>

                              {curAct.linkedGameCode && (
                                <QrCodeCard
                                  code={curAct.linkedGameCode}
                                  gameId={curAct.linkedGameId}
                                  title={curAct.title}
                                  compact
                                />
                              )}
                            </div>
                          )}

                          {/* Presencial Director Validation */}
                          <div className="border-t border-white/10 pt-4 space-y-2">
                            <div className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                              <ShieldCheck className="w-4 h-4" />
                              Validación presencial del director
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={onsiteNoteInput}
                                onChange={(e) => setOnsiteNoteInput(e.target.value)}
                                placeholder="Resultado, ganador presencial u observación..."
                                className="flex-1 bg-[#080E1E] border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                              />
                              <button
                                type="button"
                                disabled={!isDirector || Boolean(busy)}
                                onClick={async () => {
                                  await runLiveAction('validate_onsite', {
                                    activityId: curAct.id,
                                    note:
                                      onsiteNoteInput.trim() ||
                                      'Participación validada por el director',
                                  });
                                  setOnsiteNoteInput('');
                                }}
                                className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
                              >
                                Validar
                              </button>
                            </div>
                            {curAct.onsiteValidated && (
                              <p className="text-xs text-emerald-300">
                                Validado: {curAct.onsiteResultNote}
                              </p>
                            )}
                          </div>
                        </>
                      ) : null}
                    </div>

                    {/* Right: Next Activity + Connected Game Participants + Final Observations */}
                    <div className="lg:col-span-5 space-y-5">
                      {nextAct && (
                        <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-5 space-y-1">
                          <div className="text-xs text-slate-400">
                            Próxima actividad · Sección {nextAct.sectionCode} ·{' '}
                            <span className="font-mono-num">{nextAct.durationMin} min</span>
                          </div>
                          <div className="font-display font-bold text-base text-white">
                            {nextAct.title}
                          </div>
                          <p className="text-xs text-slate-400">
                            {nextAct.directorInstructions}
                          </p>
                        </div>
                      )}

                      {live?.linkedLiveGame && (
                        <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-5 space-y-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-white inline-flex items-center gap-1.5">
                              <Users className="w-4 h-4 text-sky-400" />
                              Participantes / Equipos en Vivo
                            </span>
                            <span className="font-mono-num text-amber-300 font-bold">
                              {live.linkedLiveGame.participantCount} conectados
                            </span>
                          </div>
                          {live.linkedLiveGame.teamTop.length > 0 ? (
                            <div className="divide-y divide-white/10">
                              {live.linkedLiveGame.teamTop.map((t) => (
                                <div
                                  key={t.name}
                                  className="py-1.5 flex justify-between text-xs"
                                >
                                  <span className="text-slate-200">{t.name}</span>
                                  <span className="font-mono-num font-bold text-amber-300">
                                    {t.score} pts
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="divide-y divide-white/10">
                              {live.linkedLiveGame.leaderboardTop.map((e, i) => (
                                <div
                                  key={`${e.name}-${i}`}
                                  className="py-1.5 flex justify-between text-xs"
                                >
                                  <span className="text-slate-200">{e.name}</span>
                                  <span className="font-mono-num font-bold text-amber-300">
                                    {e.score} pts
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-5 space-y-2.5">
                        <label className="text-xs font-semibold text-white">
                          Observaciones del director (se guardan al finalizar)
                        </label>
                        <textarea
                          rows={3}
                          value={finalObsInput}
                          onChange={(e) => setFinalObsInput(e.target.value)}
                          placeholder="Anota testimonios, participación destacada o mejoras para el próximo sábado..."
                          className="w-full bg-[#080E1E] border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* TAB 4: HISTORIAL Y ESTADÍSTICAS */}
      {tab === 'history' && overview && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6 bg-[#111A2E] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4">
            <h2 className="font-display font-bold text-lg text-white">
              Frecuencia de Uso por Sección (A–M)
            </h2>
            <p className="text-xs text-slate-400">
              Total creados:{' '}
              <strong className="font-mono-num text-white">
                {overview.stats.totalProgramsCreated}
              </strong>{' '}
              · Programas finalizados:{' '}
              <strong className="font-mono-num text-emerald-400">
                {overview.stats.totalExecutedPrograms}
              </strong>
            </p>
            <div className="space-y-2.5">
              {overview.stats.sectionFrequency.map((row) => (
                <div key={row.code} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-200">
                      <strong className="font-mono-num text-amber-300 mr-1.5">
                        {row.code}.
                      </strong>
                      {row.label}
                    </span>
                    <span className="font-mono-num text-slate-400">
                      {row.count} usos ({row.sharePercent}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#080E1E] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400"
                      style={{ width: `${Math.min(100, row.sharePercent * 3)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6 bg-[#111A2E] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4">
            <h2 className="font-display font-bold text-lg text-white">
              Historial de Sábados Realizados
            </h2>
            {overview.history.length === 0 ? (
              <p className="text-sm text-slate-400">
                Cuando finalices un programa desde el Modo Director en Vivo, su registro
                independiente aparecerá aquí.
              </p>
            ) : (
              <div className="divide-y divide-white/10">
                {overview.history.map((h) => (
                  <div key={h.id} className="py-3.5 space-y-1">
                    <div className="flex items-center justify-between text-xs text-amber-300">
                      <span className="font-mono-num">{h.date}</span>
                      <span>
                        {h.mainBibleText} ·{' '}
                        <span className="font-mono-num">{h.durationMinutes} min</span>
                      </span>
                    </div>
                    <div className="font-display font-bold text-sm text-white">
                      {h.creativeName}
                    </div>
                    <div className="text-xs text-slate-300">
                      Completadas:{' '}
                      <strong className="font-mono-num text-emerald-300">
                        {h.completedActivities.length}
                      </strong>{' '}
                      · Omitidas:{' '}
                      <strong className="font-mono-num text-slate-400">
                        {h.skippedActivities.length}
                      </strong>
                    </div>
                    {h.directorObservations && (
                      <p className="text-xs text-slate-400 italic">
                        "{h.directorObservations}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: SONIDOS Y AMBIENTACIÓN */}
      {tab === 'audio' && (
        <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <h2 className="font-display font-bold text-lg text-white">
                Sonidos y Ambientación de Sociedad de Jóvenes
              </h2>
              <p className="text-xs text-slate-400">
                Efectos independientes por tipo de momento. Los sonidos originales de los
                juegos existentes permanecen intactos.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() =>
                  youthSocietyAudio.updatePrefs({ muted: !audioPrefs.muted })
                }
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                  audioPrefs.muted
                    ? 'bg-rose-500/20 border-rose-400/45 text-rose-200'
                    : 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                }`}
              >
                {audioPrefs.muted ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
                {audioPrefs.muted ? 'Silenciado' : 'Audio Activo'}
              </button>

              <label className="inline-flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={audioPrefs.effectsEnabled}
                  onChange={(e) =>
                    youthSocietyAudio.updatePrefs({
                      effectsEnabled: e.target.checked,
                    })
                  }
                  className="accent-amber-400"
                />
                Efectos automáticos en cambios
              </label>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Volumen:</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(audioPrefs.volume * 100)}
                  onChange={(e) =>
                    youthSocietyAudio.updatePrefs({
                      volume: Number(e.target.value) / 100,
                    })
                  }
                  className="w-28 accent-amber-400 cursor-pointer"
                />
                <span className="font-mono-num text-xs text-white w-9 text-right">
                  {Math.round(audioPrefs.volume * 100)}%
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {(Object.keys(SOUND_MOOD_LABELS) as YouthSoundMood[]).map((mood) => (
              <button
                key={mood}
                type="button"
                onClick={() => youthSocietyAudio.playMood(mood)}
                className="bg-[#0B1221] hover:bg-[#16213B] border border-white/10 rounded-xl p-4 text-left space-y-1.5 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between text-amber-300">
                  <Play className="w-4 h-4" />
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <div className="text-xs font-semibold text-white">
                  {SOUND_MOOD_LABELS[mood]}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: DIRECTOR PIN */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form
            onSubmit={handlePinLogin}
            className="bg-[#111A2E] border border-white/15 rounded-2xl p-6 max-w-sm w-full space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg text-white">
                Acceso de Director
              </h3>
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Ingresa la clave de dirección para generar, editar y dirigir programas.
            </p>
            <input
              type="password"
              autoFocus
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Clave de director"
              className="w-full bg-[#080E1E] border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white"
            />
            {pinErr && <p className="text-xs text-rose-400">{pinErr}</p>}
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm cursor-pointer"
            >
              Autorizar Director
            </button>
          </form>
        </div>
      )}

      {/* MODAL: REPLACE ACTIVITY SUGGESTIONS */}
      {replaceTargetIdx !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#111A2E] border border-white/15 rounded-2xl p-6 max-w-xl w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg text-white">
                Alternativas para Reemplazar Actividad
              </h3>
              <button
                type="button"
                onClick={() => setReplaceTargetIdx(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {loadingAlts ? (
              <p className="text-sm text-slate-400 py-6 text-center">
                Buscando alternativas frescas de la misma duración y sección...
              </p>
            ) : (
              <div className="divide-y divide-white/10 max-h-96 overflow-y-auto">
                {alternatives.map((alt, i) => (
                  <div key={i} className="py-3.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-white">
                        {alt.title}
                      </span>
                      <span className="font-mono-num text-xs text-amber-300">
                        {alt.durationMin} min · {alt.biblicalReference}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">{alt.description}</p>
                    <button
                      type="button"
                      onClick={() => applyReplacement(alt)}
                      className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold cursor-pointer"
                    >
                      Elegir esta alternativa
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: RECOVER PREVIOUS ACTIVITY */}
      {showRecoverModal && overview && draft && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#111A2E] border border-white/15 rounded-2xl p-6 max-w-xl w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg text-white">
                Recuperar Actividad de Sábados Anteriores
              </h3>
              <button
                type="button"
                onClick={() => setShowRecoverModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {overview.recoverableActivities.length === 0 ? (
              <p className="text-sm text-slate-400 py-4">
                No hay actividades previas guardadas todavía.
              </p>
            ) : (
              <div className="divide-y divide-white/10 max-h-96 overflow-y-auto">
                {overview.recoverableActivities.map((item, i) => (
                  <div
                    key={`${item.sourceProgramId}-${i}`}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">
                        {item.activity.title}
                      </div>
                      <div className="text-xs text-slate-400">
                        {item.sourceDate} · {item.sourceProgramName} ·{' '}
                        <span className="font-mono-num">
                          {item.activity.durationMin} min
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const cloned: YouthProgramActivityItem = {
                          ...item.activity,
                          id: `YSA-${Date.now().toString(36)}`,
                          order: draft.activities.length + 1,
                          status: 'pendiente',
                          onsiteValidated: false,
                          onsiteResultNote: undefined,
                          linkedGameCode: undefined,
                        };
                        const nextActs = [...draft.activities, cloned];
                        setDraft({
                          ...draft,
                          activities: nextActs,
                          totalDurationMin: nextActs.reduce(
                            (s, a) => s + a.durationMin,
                            0
                          ),
                        });
                        setShowRecoverModal(false);
                        showMsg('ok', 'Actividad recuperada e insertada en el editor.');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Recuperar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
