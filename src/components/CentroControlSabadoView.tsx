import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  Gamepad2,
  Lock,
  MonitorPlay,
  PackageOpen,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Sliders,
  Sparkles,
  Trash2,
  Trophy,
  Unlock,
  Users,
  Volume2,
  X,
} from 'lucide-react';
import {
  CONTROL_CENTER_MODULES,
  formatTimerMMSS,
  getModuleMetaById,
  mapKindToModuleId,
  type ControlCenterBlockKind,
  type ControlCenterLiveClientView,
  type ControlCenterLiveSession,
  type ControlCenterModuleId,
  type ControlCenterParticipantVisibility,
  type ControlCenterSeparatedResults,
  type ControlCenterTimelineBlock,
  type ControlCenterVarietyRecommendation,
} from '../shared/controlCenterData';
import type { SaturdayProgram } from '../shared/saturdayProgramTypes';
import {
  SURPRISE_CATEGORIES,
  SURPRISE_OUTCOME_META,
  type SurpriseCategoryId,
  type SurpriseResultOutcome,
} from '../shared/surpriseBoothData';
import { GAME_MODE_INFO, type GameMode } from '../shared/types';
import { moduleSoundController, type ModuleAudioChannelId } from '../utils/sound';
import { ModuleAudioPanel } from './ModuleAudioPanel';
import { QrCodeCard } from './QrCodeCard';

const DIRECTOR_TOKEN_KEY = 'dtqd_control_director_token';

interface ActiveGameSummary {
  code: string;
  gameId: string;
  title: string;
  mode: GameMode;
  modeLabel: string;
  status: string;
  participantCount: number;
  invitePath: string;
}

interface ControlCenterOverviewResponse {
  isDirector: boolean;
  activeSessionId: string | null;
  sessions: ControlCenterLiveSession[];
  savedPrograms: SaturdayProgram[];
  activeGames: ActiveGameSummary[];
  championshipSeasons: Array<{ id: string; name: string; status: string }>;
  weeklyMissions: Array<{ id: string; title: string; category: string }>;
  surpriseCategories: typeof SURPRISE_CATEGORIES;
  varietyRecommendations: ControlCenterVarietyRecommendation;
  separatedResults: ControlCenterSeparatedResults;
}

interface CentroControlSabadoViewProps {
  onBack: () => void;
  onOpenProjector: (sessionId: string) => void;
  onOpenGamePresenter: (code: string, token: string) => void;
  onOpenGameProjector: (code: string) => void;
  onJoinGameCode: (code: string) => void;
  initialSessionId?: string;
  initialParticipantMode?: boolean;
}

type DirectorTab = 'agenda' | 'resultados' | 'sonido' | 'permisos';

const CREATABLE_GAME_MODES: Array<{ mode: GameMode; label: string }> = [
  { mode: 'clasico', label: GAME_MODE_INFO.clasico.name },
  { mode: 'equipos', label: GAME_MODE_INFO.equipos.name },
  { mode: 'competencia_equipos', label: GAME_MODE_INFO.competencia_equipos.name },
  { mode: 'ruleta_biblica', label: GAME_MODE_INFO.ruleta_biblica.name },
  { mode: 'quien_soy', label: GAME_MODE_INFO.quien_soy.name },
  { mode: 'misterio_biblico', label: GAME_MODE_INFO.misterio_biblico.name },
  { mode: 'crucigrama_biblico', label: GAME_MODE_INFO.crucigrama_biblico.name },
  { mode: 'palabras_desordenadas', label: GAME_MODE_INFO.palabras_desordenadas.name },
  { mode: 'completa_versiculo', label: GAME_MODE_INFO.completa_versiculo.name },
  { mode: 'rompecabezas_biblico', label: GAME_MODE_INFO.rompecabezas_biblico.name },
  { mode: 'retos_sabado', label: GAME_MODE_INFO.retos_sabado.name },
  { mode: 'ruleta_sabado', label: GAME_MODE_INFO.ruleta_sabado.name },
  { mode: 'talentos_juveniles', label: GAME_MODE_INFO.talentos_juveniles.name },
  { mode: 'aventuras_biblicas', label: GAME_MODE_INFO.aventuras_biblicas.name },
];

const QUICK_MODULE_BLOCKS: Array<{
  kind: ControlCenterBlockKind;
  label: string;
  defaultTitle: string;
  defaultInstructions: string;
  defaultDuration: number;
}> = [
  {
    kind: 'actividad_programa',
    label: 'Programa del Sábado',
    defaultTitle: 'Bienvenida, Alabanza y Reflexión',
    defaultInstructions: 'Recepción juvenil, cantos congregacionales y lectura del texto lema.',
    defaultDuration: 12,
  },
  {
    kind: 'retos_sabado',
    label: 'Retos del Sábado',
    defaultTitle: 'Reto Bíblico Sabatino en Vivo',
    defaultInstructions: 'Dinámica creativa o bíblica con validación del director.',
    defaultDuration: 10,
  },
  {
    kind: 'ruleta_sabado',
    label: 'Ruleta de Actividades',
    defaultTitle: 'Ronda de Ruleta de Actividades',
    defaultInstructions: 'Gira la ruleta de 12 categorías para asignar el desafío del momento.',
    defaultDuration: 10,
  },
  {
    kind: 'talentos_juveniles',
    label: 'Talentos Juveniles',
    defaultTitle: 'Bloque de Talentos Juveniles',
    defaultInstructions: 'Participaciones artísticas preparadas por los jóvenes con aprecio positivo.',
    defaultDuration: 15,
  },
  {
    kind: 'aventuras_biblicas',
    label: 'Aventuras Bíblicas',
    defaultTitle: 'Aventura Bíblica Interactiva',
    defaultInstructions: 'Recorrido narrativo por escenas bíblicas con decisiones del grupo.',
    defaultDuration: 12,
  },
  {
    kind: 'misiones_juveniles',
    label: 'Misiones Juveniles',
    defaultTitle: 'Presentación de Misión de la Semana',
    defaultInstructions: 'Comparte el desafío semanal de servicio y abre el registro voluntario.',
    defaultDuration: 6,
  },
  {
    kind: 'campeonato_juvenil',
    label: 'Campeonatos Juveniles',
    defaultTitle: 'Actualización de Tabla del Campeonato',
    defaultInstructions: 'Revisión de posiciones de la temporada y próximos encuentros.',
    defaultDuration: 5,
  },
  {
    kind: 'cabina_sorpresas',
    label: 'Cabina de Sorpresas',
    defaultTitle: 'Momento de Cabina de Sorpresas',
    defaultInstructions: 'Revela una actividad sorpresa aleatoria en pantalla para todos.',
    defaultDuration: 6,
  },
];

function buildIntegralNineModuleBlocks(): ControlCenterTimelineBlock[] {
  const baseTs = Date.now().toString(36);
  return QUICK_MODULE_BLOCKS.map((item, idx) => {
    const moduleId = mapKindToModuleId(item.kind);
    return {
      id: `CCB-${baseTs}-${idx + 1}`,
      order: idx + 1,
      kind: item.kind,
      moduleId,
      moduleTag: item.label,
      title: item.defaultTitle,
      instructions: item.defaultInstructions,
      durationMin: item.defaultDuration,
      scoreIsolationNote: getModuleMetaById(moduleId).scorePolicy,
    };
  });
}

function getStatusText(status: ControlCenterLiveSession['status']): {
  label: string;
  colorClass: string;
} {
  switch (status) {
    case 'en_curso':
      return { label: 'En curso', colorClass: 'text-emerald-400' };
    case 'pausado':
      return { label: 'Pausado', colorClass: 'text-amber-300' };
    case 'finalizado':
      return { label: 'Finalizado', colorClass: 'text-sky-300' };
    default:
      return { label: 'Preparación', colorClass: 'text-slate-300' };
  }
}

export function CentroControlSabadoView({
  onBack,
  onOpenProjector,
  onOpenGamePresenter,
  onOpenGameProjector,
  onJoinGameCode,
  initialSessionId,
  initialParticipantMode = false,
}: CentroControlSabadoViewProps) {
  const [directorToken, setDirectorToken] = useState<string>(() => {
    try {
      return localStorage.getItem(DIRECTOR_TOKEN_KEY) || '';
    } catch {
      return '';
    }
  });
  const [viewMode, setViewMode] = useState<'director' | 'participante'>(
    initialParticipantMode ? 'participante' : 'director'
  );
  const [activeTab, setActiveTab] = useState<DirectorTab>('agenda');

  const [overview, setOverview] = useState<ControlCenterOverviewResponse | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    initialSessionId || ''
  );
  const [live, setLive] = useState<ControlCenterLiveClientView | null>(null);
  const [draftBlocks, setDraftBlocks] = useState<ControlCenterTimelineBlock[]>([]);
  const [hasUnsavedBlocks, setHasUnsavedBlocks] = useState(false);

  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [wsConnected, setWsConnected] = useState(false);

  // Director PIN modal
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // Create session modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createTheme, setCreateTheme] = useState('');
  const [createBibleText, setCreateBibleText] = useState('1 Timoteo 4:12');
  const [createDirectorName, setCreateDirectorName] = useState('Dirección Juvenil');
  const [createDuration, setCreateDuration] = useState<60 | 90 | 120>(90);
  const [createTemplate, setCreateTemplate] = useState<
    'integral' | 'blank' | 'import'
  >('integral');
  const [createImportId, setCreateImportId] = useState('');
  const [createSeasonId, setCreateSeasonId] = useState('');

  // Existing game modal
  const [showExistingGameModal, setShowExistingGameModal] = useState(false);
  const [existingGamesList, setExistingGamesList] = useState<ActiveGameSummary[]>([]);

  // New game modal
  const [showNewGameModal, setShowNewGameModal] = useState(false);
  const [newGameTitle, setNewGameTitle] = useState('Trivia Bíblica del Sábado');
  const [newGameCode, setNewGameCode] = useState('');
  const [newGameMode, setNewGameMode] = useState<GameMode>('clasico');
  const [newGameQuestions, setNewGameQuestions] = useState(12);
  const [newGameTimeSec, setNewGameTimeSec] = useState(20);
  const [newGameDurationMin, setNewGameDurationMin] = useState(12);

  // Surprise modal / outcome state
  const [showSurpriseModal, setShowSurpriseModal] = useState(false);
  const [surpriseCategories, setSurpriseCategories] = useState<SurpriseCategoryId[]>(
    () => SURPRISE_CATEGORIES.map((c) => c.id)
  );
  const [surpriseAvoidRecent, setSurpriseAvoidRecent] = useState(true);
  const [surpriseDurationSec, setSurpriseDurationSec] = useState(45);
  const [surpriseOutcome, setSurpriseOutcome] =
    useState<SurpriseResultOutcome>('cumplido');
  const [surpriseParticipant, setSurpriseParticipant] = useState('');

  // Participant self-results lookup
  const [participantSearch, setParticipantSearch] = useState('');
  const [participantQueryApplied, setParticipantQueryApplied] = useState('');
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const lastCueNonceRef = useRef<number>(-1);

  const isDirector = Boolean(overview?.isDirector);

  const authHeaders = useMemo((): Record<string, string> => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (directorToken) {
      h['x-control-director-token'] = directorToken;
    }
    return h;
  }, [directorToken]);

  // 250ms smooth local countdown clock
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const loadOverview = useCallback(
    async (preferSessionId?: string) => {
      try {
        const res = await fetch('/api/control-center/overview', {
          headers: directorToken
            ? { 'x-control-director-token': directorToken }
            : undefined,
        });
        if (!res.ok) return;
        const data = (await res.json()) as ControlCenterOverviewResponse;
        setOverview(data);
        setExistingGamesList(data.activeGames || []);

        const resolvedId =
          preferSessionId ||
          (selectedSessionId &&
          data.sessions.some((s) => s.id === selectedSessionId)
            ? selectedSessionId
            : data.activeSessionId || data.sessions[0]?.id || '');

        if (resolvedId) {
          setSelectedSessionId(resolvedId);
        }
      } catch {
        // ignore transient error
      } finally {
        setLoading(false);
      }
    },
    [directorToken, selectedSessionId]
  );

  useEffect(() => {
    loadOverview(initialSessionId);
  }, [loadOverview, initialSessionId]);

  const fetchLiveSession = useCallback(
    async (sessionId: string, participantName = '') => {
      if (!sessionId) {
        setLive(null);
        return;
      }
      try {
        const qs = participantName
          ? `?participantName=${encodeURIComponent(participantName)}`
          : '';
        const res = await fetch(
          `/api/control-center/live/${encodeURIComponent(sessionId)}${qs}`
        );
        if (!res.ok) return;
        const payload = (await res.json()) as ControlCenterLiveClientView;
        setLive(payload);
        if (!hasUnsavedBlocks) {
          setDraftBlocks(payload.session.blocks || []);
        }
      } catch {
        // ignore
      }
    },
    [hasUnsavedBlocks]
  );

  // Sync draftBlocks when switching session
  useEffect(() => {
    setHasUnsavedBlocks(false);
    if (selectedSessionId) {
      fetchLiveSession(selectedSessionId, participantQueryApplied);
    } else {
      setLive(null);
      setDraftBlocks([]);
    }
  }, [selectedSessionId, participantQueryApplied, fetchLiveSession]);

  // Real-time WebSocket subscription for active selectedSessionId
  useEffect(() => {
    if (!selectedSessionId) return;
    let active = true;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;

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
            type: 'cc_subscribe',
            sessionId: selectedSessionId,
            role: viewMode === 'participante' ? 'participant' : 'director',
            ...(participantQueryApplied
              ? { participantName: participantQueryApplied }
              : {}),
          })
        );
      };

      socket.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(String(ev.data || '{}'));
          if (parsed.type === 'cc_state' && parsed.payload && active) {
            const payload = parsed.payload as ControlCenterLiveClientView;
            setLive(payload);
            setHasUnsavedBlocks((dirty) => {
              if (!dirty) {
                setDraftBlocks(payload.session.blocks || []);
              }
              return dirty;
            });
          }
        } catch {
          // ignore
        }
      };

      socket.onclose = () => {
        if (!active) return;
        setWsConnected(false);
        reconnectTimer = window.setTimeout(connect, 2200);
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connect();
    return () => {
      active = false;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [selectedSessionId, viewMode, participantQueryApplied]);

  // Play independent module sound cue when server cue changes
  useEffect(() => {
    const sess = live?.session;
    if (!sess) return;
    const nonce = sess.soundCueNonce || 0;
    if (lastCueNonceRef.current === -1) {
      lastCueNonceRef.current = nonce;
      return;
    }
    if (nonce > lastCueNonceRef.current && sess.lastSoundCue) {
      lastCueNonceRef.current = nonce;
      moduleSoundController.playModuleCue(
        sess.lastSoundCue.moduleId as ModuleAudioChannelId,
        sess.lastSoundCue.action
      );
    }
  }, [live?.session]);

  const activeSession = live?.session || null;

  const displayedRemainingSec = useMemo(() => {
    if (!activeSession) return 0;
    if (
      activeSession.status === 'en_curso' &&
      activeSession.timerRunning &&
      typeof activeSession.timerEndsAt === 'number'
    ) {
      return Math.max(0, Math.ceil((activeSession.timerEndsAt - nowMs) / 1000));
    }
    if (typeof activeSession.timerPausedRemainingSec === 'number') {
      return Math.max(0, Math.round(activeSession.timerPausedRemainingSec));
    }
    return live?.remainingSec ?? 0;
  }, [activeSession, live?.remainingSec, nowMs]);

  const showNotice = (type: 'ok' | 'err', text: string) => {
    setNotice({ type, text });
    window.setTimeout(() => {
      setNotice((prev) => (prev?.text === text ? null : prev));
    }, 5000);
  };

  const handleDirectorLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    try {
      const res = await fetch('/api/control-center/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPinError(data.error || 'Clave incorrecta.');
        return;
      }
      localStorage.setItem(DIRECTOR_TOKEN_KEY, data.token);
      setDirectorToken(data.token);
      setShowPinModal(false);
      setPinInput('');
      setViewMode('director');
      showNotice('ok', 'Acceso de director habilitado.');
    } catch {
      setPinError('Error de conexión al validar la clave.');
    }
  };

  const handleDirectorLogout = () => {
    try {
      localStorage.removeItem(DIRECTOR_TOKEN_KEY);
    } catch {
      // ignore
    }
    setDirectorToken('');
    showNotice('ok', 'Modo de solo lectura activado.');
  };

  const requireDirectorOrPrompt = (): boolean => {
    if (isDirector) return true;
    setShowPinModal(true);
    return false;
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireDirectorOrPrompt()) return;
    setBusyAction('create_session');
    try {
      const blocks =
        createTemplate === 'integral' ? buildIntegralNineModuleBlocks() : [];
      const payload: Record<string, unknown> = {
        title: createTitle.trim() || undefined,
        theme: createTheme.trim() || undefined,
        bibleText: createBibleText.trim() || undefined,
        directorName: createDirectorName.trim() || undefined,
        durationMinutes: createDuration,
        ...(createSeasonId ? { linkedSeasonId: createSeasonId } : {}),
        ...(createTemplate === 'import' && createImportId
          ? { sourceProgramId: createImportId }
          : { blocks }),
      };

      const res = await fetch('/api/control-center/sessions', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotice('err', data.error || 'No se pudo crear el programa.');
        return;
      }
      const created = data.session as ControlCenterLiveSession;
      setShowCreateModal(false);
      setHasUnsavedBlocks(false);
      setDraftBlocks(created.blocks || []);
      await loadOverview(created.id);
      await fetchLiveSession(created.id, participantQueryApplied);
      showNotice('ok', `Programa "${created.title}" creado y listo.`);
    } catch {
      showNotice('err', 'Error al crear el programa.');
    } finally {
      setBusyAction(null);
    }
  };

  const persistSessionUpdate = async (
    blocksToSave: ControlCenterTimelineBlock[],
    extra?: Partial<{
      participantVisibility: ControlCenterParticipantVisibility;
      linkedSeasonId: string;
    }>
  ) => {
    if (!activeSession || !requireDirectorOrPrompt()) return;
    setBusyAction('save_blocks');
    try {
      const res = await fetch(
        `/api/control-center/sessions/${encodeURIComponent(activeSession.id)}`,
        {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify({
            blocks: blocksToSave,
            ...extra,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        showNotice('err', data.error || 'No se pudieron guardar los cambios.');
        return;
      }
      setHasUnsavedBlocks(false);
      setDraftBlocks((data.session as ControlCenterLiveSession).blocks || []);
      await loadOverview(activeSession.id);
      showNotice('ok', 'Cambios guardados y sincronizados.');
    } catch {
      showNotice('err', 'Error de conexión al guardar.');
    } finally {
      setBusyAction(null);
    }
  };

  const runPlaybackControl = async (
    action: string,
    extra?: Record<string, unknown>
  ) => {
    if (!activeSession || !requireDirectorOrPrompt()) return;
    if (hasUnsavedBlocks) {
      await persistSessionUpdate(draftBlocks);
    }
    setBusyAction(`ctrl_${action}`);
    try {
      const res = await fetch(
        `/api/control-center/sessions/${encodeURIComponent(activeSession.id)}/control`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ action, ...extra }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        showNotice('err', data.error || 'No se pudo ejecutar la acción.');
        return;
      }
      if (action === 'finish_and_save') {
        const s = data.session as ControlCenterLiveSession;
        showNotice(
          'ok',
          `Programa finalizado y guardado en Programa del Sábado (${s.savedProgramId}) y Nuestras Memorias (${s.savedMemoryId}).`
        );
      }
      await loadOverview(activeSession.id);
    } catch {
      showNotice('err', 'Error de conexión con el servidor.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDrawSurprise = async () => {
    if (!activeSession || !requireDirectorOrPrompt()) return;
    setBusyAction('surprise_draw');
    try {
      const res = await fetch(
        `/api/control-center/sessions/${encodeURIComponent(activeSession.id)}/surprise`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            action: 'draw',
            enabledCategories: surpriseCategories,
            avoidRecent: surpriseAvoidRecent,
            durationSec: surpriseDurationSec,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        showNotice('err', data.error || 'No se pudo revelar la sorpresa.');
        return;
      }
      setShowSurpriseModal(false);
      showNotice('ok', '¡Sorpresa revelada en la pantalla de proyección!');
    } catch {
      showNotice('err', 'Error al activar sorpresa.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleSurpriseOutcome = async () => {
    if (!activeSession || !requireDirectorOrPrompt()) return;
    setBusyAction('surprise_outcome');
    try {
      const res = await fetch(
        `/api/control-center/sessions/${encodeURIComponent(activeSession.id)}/surprise`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            action: 'record_outcome',
            outcome: surpriseOutcome,
            participantName: surpriseParticipant.trim() || 'Sociedad de Jóvenes',
          }),
        }
      );
      if (res.ok) {
        setSurpriseParticipant('');
        await loadOverview(activeSession.id);
        showNotice('ok', 'Resultado de sorpresa guardado en su historial propio.');
      }
    } catch {
      showNotice('err', 'No se pudo registrar el resultado.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDismissSurprise = async () => {
    if (!activeSession || !requireDirectorOrPrompt()) return;
    await fetch(
      `/api/control-center/sessions/${encodeURIComponent(activeSession.id)}/surprise`,
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ action: 'dismiss' }),
      }
    );
  };

  const appendBlockAndSave = async (block: Omit<ControlCenterTimelineBlock, 'order'>) => {
    if (!activeSession || !requireDirectorOrPrompt()) return;
    const nextBlocks = [...draftBlocks, { ...block, order: draftBlocks.length + 1 }];
    setDraftBlocks(nextBlocks);
    await persistSessionUpdate(nextBlocks);
  };

  const handleInsertExistingGame = async (g: ActiveGameSummary) => {
    await appendBlockAndSave({
      id: `CCB-${Date.now().toString(36)}`,
      kind: 'juego_existente',
      moduleId: 'juegos_biblicos',
      moduleTag: g.modeLabel || 'Juego en Vivo',
      title: g.title,
      instructions: `Únete escaneando el QR o ingresando el código ${g.code}.`,
      durationMin: 12,
      linkedGameCode: g.code,
      linkedGameMode: g.mode,
      linkedGameTitle: g.title,
      linkedInvitePath: g.invitePath,
      scoreIsolationNote: `Puntuación propia de ${g.modeLabel || 'la partida'}`,
    });
    setShowExistingGameModal(false);
  };

  const handleCreateAndInsertGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || !requireDirectorOrPrompt()) return;
    setBusyAction('create_game');
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newGameTitle.trim() || 'Juego Bíblico del Sábado',
          code: newGameCode.trim() || undefined,
          mode: newGameMode,
          questionCount: newGameQuestions,
          timeLimitSec: newGameTimeSec,
          teamMode: newGameMode === 'equipos' || newGameMode === 'competencia_equipos',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotice('err', data.error || 'No se pudo crear la sala del juego.');
        return;
      }
      try {
        localStorage.setItem(`dtqd_presenter_${data.code}`, data.presenterToken);
        localStorage.setItem('dtqd_last_presenter_code', data.code);
      } catch {
        // ignore
      }
      const modeLabel = GAME_MODE_INFO[newGameMode]?.name || newGameMode;
      await appendBlockAndSave({
        id: `CCB-${Date.now().toString(36)}`,
        kind: 'nuevo_juego',
        moduleId: 'juegos_biblicos',
        moduleTag: modeLabel,
        title: newGameTitle.trim() || data.code,
        instructions: `Nueva sala ${modeLabel} en vivo. Código: ${data.code}.`,
        durationMin: newGameDurationMin,
        linkedGameCode: data.code,
        linkedGameMode: newGameMode,
        linkedGameTitle: newGameTitle.trim() || data.code,
        linkedInvitePath: `/partida/${encodeURIComponent(data.gameId)}?s=${encodeURIComponent(data.inviteSignature)}`,
        scoreIsolationNote: `Puntuación independiente de ${modeLabel}`,
      });
      setShowNewGameModal(false);
      setNewGameCode('');
      showNotice('ok', `Juego "${data.code}" creado e integrado al programa.`);
    } catch {
      showNotice('err', 'Error al crear la partida.');
    } finally {
      setBusyAction(null);
    }
  };

  const moveBlock = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= draftBlocks.length) return;
    const copy = [...draftBlocks];
    const [removed] = copy.splice(idx, 1);
    copy.splice(target, 0, removed);
    setDraftBlocks(copy.map((b, i) => ({ ...b, order: i + 1 })));
    setHasUnsavedBlocks(true);
  };

  const removeBlock = (idx: number) => {
    const copy = draftBlocks.filter((_, i) => i !== idx);
    setDraftBlocks(copy.map((b, i) => ({ ...b, order: i + 1 })));
    setHasUnsavedBlocks(true);
  };

  const updateBlockField = (
    idx: number,
    patch: Partial<ControlCenterTimelineBlock>
  ) => {
    setDraftBlocks((prev) =>
      prev.map((b, i) => (i === idx ? { ...b, ...patch } : b))
    );
    setHasUnsavedBlocks(true);
  };

  const handleOpenExistingGamePicker = async () => {
    try {
      const res = await fetch('/api/control-center/overview', {
        headers: directorToken
          ? { 'x-control-director-token': directorToken }
          : undefined,
      });
      if (res.ok) {
        const data = (await res.json()) as ControlCenterOverviewResponse;
        setExistingGamesList(data.activeGames || []);
      }
    } catch {
      // ignore
    }
    setShowExistingGameModal(true);
  };

  const copySharePath = async (path: string, key: string) => {
    const full =
      typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;
    try {
      await navigator.clipboard.writeText(full);
      setCopiedLink(key);
      window.setTimeout(() => setCopiedLink(null), 2000);
    } catch {
      // ignore
    }
  };

  const currentBlock = live?.currentBlock || null;
  const totalBlocksDurationMin = draftBlocks.reduce(
    (sum, b) => sum + (b.durationMin || 0),
    0
  );

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
    showNotice(
      'err',
      'Esta partida fue creada desde otro dispositivo. Ábrela en Proyección o desde el presentador original.'
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Top Bar */}
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
              Centro de Control del Sábado
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 truncate">
              Organiza y dirige en tiempo real los módulos de Sociedad de Jóvenes
              ·{' '}
              <span className={wsConnected ? 'text-emerald-400' : 'text-amber-300'}>
                {wsConnected ? 'Sincronización en vivo' : 'Conectando...'}
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Mode Toggle: Director vs Participante */}
          <div className="inline-flex bg-[#111A2E] border border-white/10 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setViewMode('director')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                viewMode === 'director'
                  ? 'bg-amber-400 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Panel del Director
            </button>
            <button
              type="button"
              onClick={() => setViewMode('participante')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                viewMode === 'participante'
                  ? 'bg-sky-400 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Vista Participante
            </button>
          </div>

          {viewMode === 'director' &&
            (isDirector ? (
              <button
                type="button"
                onClick={handleDirectorLogout}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Unlock className="w-3.5 h-3.5" />
                Director verificado
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowPinModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400/15 border border-amber-400/45 text-amber-300 hover:bg-amber-400/25 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                Acceder como Director
              </button>
            ))}

          {activeSession && (
            <button
              type="button"
              onClick={() => onOpenProjector(activeSession.id)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
            >
              <MonitorPlay className="w-3.5 h-3.5" />
              Pantalla de Proyección
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

      {/* Session Selector Strip */}
      <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[240px]">
          <label className="text-xs font-semibold text-slate-400 whitespace-nowrap">
            Programa activo:
          </label>
          {overview && overview.sessions.length > 0 ? (
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="flex-1 max-w-md bg-[#080E1E] border border-white/15 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
            >
              {overview.sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} · {s.scheduledDate} ({getStatusText(s.status).label})
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm text-slate-400">
              {loading
                ? 'Cargando programas...'
                : 'Aún no hay un programa en vivo configurado.'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => loadOverview(selectedSessionId)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0B1221] hover:bg-[#16213B] border border-white/10 text-slate-300 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Actualizar
          </button>
          {viewMode === 'director' && (
            <button
              type="button"
              onClick={() => {
                if (!requireDirectorOrPrompt()) return;
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Nuevo Programa
            </button>
          )}
        </div>
      </div>

      {/* PARTICIPANT VIEW */}
      {viewMode === 'participante' && (
        <div className="space-y-6">
          {!activeSession ? (
            <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-8 text-center space-y-2">
              <p className="font-display font-bold text-lg text-white">
                Esperando inicio del programa del sábado
              </p>
              <p className="text-sm text-slate-400">
                Cuando el director prepare la sesión de hoy, aquí verás las
                actividades habilitadas y podrás unirte a los juegos en vivo.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-2 min-w-0">
                  <div className="text-xs font-semibold text-amber-300">
                    {activeSession.scheduledDate} · {activeSession.bibleText} ·{' '}
                    <span className={getStatusText(activeSession.status).colorClass}>
                      {getStatusText(activeSession.status).label}
                    </span>
                  </div>
                  <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-white">
                    {activeSession.title}
                  </h2>
                  <p className="text-sm text-slate-300">
                    Tema: {activeSession.theme}
                  </p>
                </div>

                <div className="flex items-center gap-4 bg-[#080E1E] border border-white/10 rounded-xl px-5 py-3.5 shrink-0">
                  <Clock className="w-5 h-5 text-amber-400" />
                  <div>
                    <div className="text-[11px] text-slate-400">
                      Tiempo de actividad
                    </div>
                    <div className="font-mono-num font-extrabold text-3xl text-white">
                      {formatTimerMMSS(displayedRemainingSec)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Active surprise for participants */}
              {activeSession.activeSurprise && (
                <div className="bg-[#16213B] border border-amber-400/50 rounded-2xl p-6 space-y-2">
                  <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
                    <PackageOpen className="w-4 h-4" />
                    CABINA DE SORPRESAS · {activeSession.activeSurprise.categoryLabel}
                  </div>
                  <h3 className="font-display font-extrabold text-xl text-white">
                    {activeSession.activeSurprise.title}
                  </h3>
                  <p className="text-sm text-slate-200">
                    {activeSession.activeSurprise.instructions}
                  </p>
                  <p className="text-xs text-amber-300">
                    {activeSession.activeSurprise.reference}
                  </p>
                </div>
              )}

              {/* Active Block & Join Button */}
              {activeSession.participantVisibility.showSchedule && currentBlock && (
                <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-sky-300">
                        Actividad Actual · {currentBlock.moduleTag}
                      </div>
                      <h3 className="font-display font-bold text-xl text-white">
                        {currentBlock.title}
                      </h3>
                      <p className="text-sm text-slate-300">
                        {currentBlock.instructions}
                      </p>
                    </div>
                    {currentBlock.linkedGameCode && (
                      <button
                        type="button"
                        onClick={() => onJoinGameCode(currentBlock.linkedGameCode!)}
                        className="px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-sm inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Gamepad2 className="w-4 h-4" />
                        Unirme al juego ({currentBlock.linkedGameCode})
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Allowed Schedule */}
                <div className="lg:col-span-7 bg-[#111A2E] border border-white/10 rounded-2xl p-5 space-y-4">
                  <h3 className="font-display font-bold text-lg text-white">
                    Agenda del Programa
                  </h3>
                  {!activeSession.participantVisibility.showSchedule ? (
                    <p className="text-sm text-slate-400">
                      El director mantiene la agenda completa reservada por ahora.
                    </p>
                  ) : (
                    <div className="divide-y divide-white/10">
                      {activeSession.blocks.map((b, idx) => {
                        const isCur = idx === activeSession.currentBlockIndex;
                        return (
                          <div
                            key={b.id}
                            className={`py-3 flex items-center justify-between gap-3 ${
                              isCur ? 'text-white' : 'text-slate-300'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-xs text-slate-400">
                                <span className="font-mono-num">#{idx + 1}</span> ·{' '}
                                {b.moduleTag} ·{' '}
                                <span className="font-mono-num">{b.durationMin} min</span>
                                {isCur && (
                                  <span className="text-amber-300 font-semibold">
                                    {' '}
                                    · En vivo
                                  </span>
                                )}
                              </div>
                              <div className="font-semibold text-sm truncate">
                                {b.title}
                              </div>
                            </div>
                            {b.linkedGameCode && (
                              <button
                                type="button"
                                onClick={() => onJoinGameCode(b.linkedGameCode!)}
                                className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                Entrar ({b.linkedGameCode})
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Own Results + Standings */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-5 space-y-4">
                    <h3 className="font-display font-bold text-lg text-white">
                      Mis Resultados
                    </h3>
                    {!activeSession.participantVisibility.showOwnResults ? (
                      <p className="text-sm text-slate-400">
                        La consulta individual de resultados está oculta por el director.
                      </p>
                    ) : (
                      <>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            setParticipantQueryApplied(participantSearch.trim());
                          }}
                          className="flex gap-2"
                        >
                          <input
                            type="text"
                            value={participantSearch}
                            onChange={(e) => setParticipantSearch(e.target.value)}
                            placeholder="Tu nombre como participante..."
                            className="flex-1 min-w-0 bg-[#080E1E] border border-white/15 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-400"
                          />
                          <button
                            type="submit"
                            className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Search className="w-3.5 h-3.5" />
                            Consultar
                          </button>
                        </form>

                        {participantQueryApplied && (
                          <div className="divide-y divide-white/10">
                            {live?.myResults && live.myResults.length > 0 ? (
                              live.myResults.map((r, i) => (
                                <div
                                  key={`${r.moduleLabel}-${i}`}
                                  className="py-2.5 flex items-center justify-between gap-2 text-xs"
                                >
                                  <div className="min-w-0">
                                    <div className="text-sky-300 font-semibold">
                                      {r.moduleLabel}
                                    </div>
                                    <div className="text-white truncate">
                                      {r.contextTitle} · {r.detail}
                                    </div>
                                  </div>
                                  <span className="font-mono-num font-bold text-amber-300 shrink-0">
                                    {r.scoreLabel}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-slate-400 pt-2">
                                No se encontraron registros para "{participantQueryApplied}".
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {activeSession.participantVisibility.showStandings &&
                    live &&
                    live.championshipStandings.length > 0 && (
                      <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-5 space-y-3">
                        <h3 className="font-display font-bold text-base text-white flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-amber-400" />
                          Clasificación del Campeonato
                        </h3>
                        {live.championshipStandings.map((ch) => (
                          <div key={ch.seasonName} className="space-y-2">
                            <div className="text-xs font-semibold text-amber-300">
                              {ch.seasonName}
                            </div>
                            <div className="divide-y divide-white/10">
                              {ch.standings.map((st, idx) => (
                                <div
                                  key={`${ch.seasonName}-${st.name}`}
                                  className="py-1.5 flex items-center justify-between text-xs"
                                >
                                  <span className="text-slate-200">
                                    <span className="font-mono-num text-slate-400 mr-2">
                                      #{idx + 1}
                                    </span>
                                    {st.name}
                                  </span>
                                  <span className="font-mono-num font-bold text-amber-300">
                                    {st.points} pts
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* DIRECTOR MODE */}
      {viewMode === 'director' && (
        <div className="space-y-6">
          {/* Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
            {(
              [
                { id: 'agenda', label: 'Control y Agenda', icon: Sliders },
                { id: 'resultados', label: 'Resultados por Modalidad', icon: Trophy },
                { id: 'sonido', label: 'Sonido por Módulo', icon: Volume2 },
                { id: 'permisos', label: 'Permisos y Acceso', icon: ShieldCheck },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const isAct = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    isAct
                      ? 'bg-amber-400 border-amber-400 text-slate-950 font-bold'
                      : 'bg-[#111A2E] border-white/10 text-slate-300 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {!isDirector && activeTab === 'agenda' && (
            <div className="bg-amber-500/10 border border-amber-400/35 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-sm text-amber-200">
                <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Solo los directores autorizados pueden editar bloques, iniciar el
                  programa o lanzar sorpresas.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowPinModal(true)}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
              >
                Ingresar Clave de Director
              </button>
            </div>
          )}

          {/* TAB 1: AGENDA Y CONTROL EN VIVO */}
          {activeTab === 'agenda' && (
            <div className="space-y-6">
              {!activeSession ? (
                <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-10 text-center space-y-4">
                  <h2 className="font-display font-bold text-xl text-white">
                    Crea o importa tu primer Programa Integrado
                  </h2>
                  <p className="text-sm text-slate-400 max-w-xl mx-auto">
                    Combina el Programa del Sábado, Juegos Bíblicos en vivo, Retos,
                    Ruleta, Talentos, Aventuras, Misiones, Campeonatos y Cabina de
                    Sorpresas en una sola línea de tiempo sincronizada.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (!requireDirectorOrPrompt()) return;
                      setShowCreateModal(true);
                    }}
                    className="px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-sm inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Crear Programa del Sábado
                  </button>
                </div>
              ) : (
                <>
                  {/* Live Playback Control Console */}
                  <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-5">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-5">
                      <div className="space-y-1 min-w-0">
                        <div className="text-xs font-semibold text-amber-300">
                          {activeSession.scheduledDate} · {activeSession.bibleText} ·{' '}
                          <span
                            className={
                              getStatusText(activeSession.status).colorClass
                            }
                          >
                            {getStatusText(activeSession.status).label}
                          </span>
                          {' · '}
                          <span className="font-mono-num text-slate-300">
                            Bloque{' '}
                            {activeSession.blocks.length > 0
                              ? activeSession.currentBlockIndex + 1
                              : 0}
                            /{activeSession.blocks.length}
                          </span>
                        </div>
                        <h2 className="font-display font-extrabold text-xl sm:text-2xl text-white truncate">
                          {activeSession.title}
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-400 truncate">
                          Tema: {activeSession.theme} · Director:{' '}
                          {activeSession.directorName}
                        </p>
                      </div>

                      <div className="flex items-center gap-5 shrink-0">
                        <div className="text-right">
                          <div className="text-[11px] text-slate-400">
                            Cronómetro del bloque
                          </div>
                          <div
                            className={`font-mono-num font-extrabold text-4xl ${
                              displayedRemainingSec <= 15 &&
                              activeSession.status === 'en_curso'
                                ? 'text-rose-400'
                                : 'text-white'
                            }`}
                          >
                            {formatTimerMMSS(displayedRemainingSec)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Playback Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      {activeSession.status === 'en_curso' ? (
                        <button
                          type="button"
                          disabled={!isDirector || Boolean(busyAction)}
                          onClick={() => runPlaybackControl('pause')}
                          className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                        >
                          <Pause className="w-4 h-4" />
                          Pausar
                        </button>
                      ) : activeSession.status === 'pausado' ? (
                        <button
                          type="button"
                          disabled={!isDirector || Boolean(busyAction)}
                          onClick={() => runPlaybackControl('resume')}
                          className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          Reanudar
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={
                            !isDirector ||
                            Boolean(busyAction) ||
                            activeSession.blocks.length === 0
                          }
                          onClick={() => runPlaybackControl('start')}
                          className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          Iniciar Programa
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={
                          !isDirector ||
                          Boolean(busyAction) ||
                          activeSession.currentBlockIndex <= 0
                        }
                        onClick={() => runPlaybackControl('prev')}
                        className="px-3.5 py-2.5 rounded-xl bg-[#0B1221] hover:bg-[#16213B] border border-white/10 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                      >
                        <SkipBack className="w-4 h-4" />
                        Anterior
                      </button>

                      <button
                        type="button"
                        disabled={
                          !isDirector ||
                          Boolean(busyAction) ||
                          activeSession.currentBlockIndex >=
                            activeSession.blocks.length - 1
                        }
                        onClick={() => runPlaybackControl('next')}
                        className="px-3.5 py-2.5 rounded-xl bg-[#0B1221] hover:bg-[#16213B] border border-white/10 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                      >
                        <SkipForward className="w-4 h-4" />
                        Siguiente
                      </button>

                      <button
                        type="button"
                        disabled={!isDirector || Boolean(busyAction)}
                        onClick={() => runPlaybackControl('reset_timer')}
                        className="px-3.5 py-2.5 rounded-xl bg-[#0B1221] hover:bg-[#16213B] border border-white/10 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reiniciar reloj
                      </button>

                      <button
                        type="button"
                        disabled={!isDirector || Boolean(busyAction)}
                        onClick={() =>
                          runPlaybackControl('adjust_timer', { deltaSec: 60 })
                        }
                        className="px-3.5 py-2.5 rounded-xl bg-[#0B1221] hover:bg-[#16213B] border border-white/10 text-slate-200 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                      >
                        +1 min
                      </button>

                      <button
                        type="button"
                        disabled={!isDirector || Boolean(busyAction)}
                        onClick={() => setShowSurpriseModal(true)}
                        className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                      >
                        <PackageOpen className="w-4 h-4" />
                        Activar Sorpresa
                      </button>

                      <button
                        type="button"
                        disabled={!isDirector || Boolean(busyAction)}
                        onClick={() => runPlaybackControl('finish_and_save')}
                        className="ml-auto px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Finalizar y Guardar Programa
                      </button>
                    </div>

                    {/* Active Block + Active Linked Game / Surprise */}
                    {currentBlock && (
                      <div className="border-t border-white/10 pt-5 space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="space-y-1 max-w-2xl">
                            <div className="text-xs font-semibold text-sky-300">
                              En curso ahora · {currentBlock.moduleTag} ·{' '}
                              <span className="font-mono-num">
                                {currentBlock.durationMin} min
                              </span>
                            </div>
                            <h3 className="font-display font-bold text-lg text-white">
                              {currentBlock.title}
                            </h3>
                            <p className="text-sm text-slate-300">
                              {currentBlock.instructions}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {currentBlock.scoreIsolationNote}
                            </p>
                          </div>

                          {currentBlock.linkedGameCode && (
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  openLinkedPresenter(currentBlock.linkedGameCode!)
                                }
                                className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                Abrir Presentador ({currentBlock.linkedGameCode})
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenGameProjector(currentBlock.linkedGameCode!)
                                }
                                className="px-3.5 py-2 rounded-xl bg-[#0B1221] hover:bg-[#16213B] border border-white/15 text-slate-200 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                Proyector del Juego
                              </button>
                            </div>
                          )}
                        </div>

                        {currentBlock.linkedGameCode && (
                          <div className="space-y-3">
                            {live?.linkedLiveGame && (
                              <div className="text-xs text-slate-300 flex flex-wrap items-center gap-4">
                                <span className="inline-flex items-center gap-1.5">
                                  <Users className="w-3.5 h-3.5 text-sky-400" />
                                  <span className="font-mono-num font-bold text-white">
                                    {live.linkedLiveGame.participantCount}
                                  </span>{' '}
                                  participantes conectados
                                </span>
                                <span>
                                  Estado de sala:{' '}
                                  <strong className="text-amber-300">
                                    {live.linkedLiveGame.status}
                                  </strong>
                                </span>
                              </div>
                            )}
                            <QrCodeCard
                              code={currentBlock.linkedGameCode}
                              gameId={live?.linkedLiveGame?.gameId}
                              title={
                                currentBlock.linkedGameTitle || currentBlock.title
                              }
                              compact
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Active Surprise Control Panel */}
                    {activeSession.activeSurprise && (
                      <div className="border-t border-orange-400/35 pt-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-bold text-orange-300">
                              SORPRESA ACTIVA EN PROYECCIÓN ·{' '}
                              {activeSession.activeSurprise.categoryLabel}
                            </div>
                            <div className="font-display font-bold text-base text-white">
                              {activeSession.activeSurprise.title}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleDismissSurprise}
                            className="px-3 py-1.5 rounded-lg bg-[#0B1221] border border-white/15 text-slate-300 hover:text-white text-xs cursor-pointer"
                          >
                            Ocultar de proyección
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={surpriseParticipant}
                            onChange={(e) => setSurpriseParticipant(e.target.value)}
                            placeholder="Participante o equipo (opcional)"
                            className="bg-[#080E1E] border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 min-w-[200px]"
                          />
                          <select
                            value={surpriseOutcome}
                            onChange={(e) =>
                              setSurpriseOutcome(
                                e.target.value as SurpriseResultOutcome
                              )
                            }
                            className="bg-[#080E1E] border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                          >
                            {(
                              Object.keys(
                                SURPRISE_OUTCOME_META
                              ) as SurpriseResultOutcome[]
                            ).map((k) => (
                              <option key={k} value={k}>
                                {SURPRISE_OUTCOME_META[k].label} (+
                                {SURPRISE_OUTCOME_META[k].defaultPoints} pts)
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={!isDirector || Boolean(busyAction)}
                            onClick={handleSurpriseOutcome}
                            className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold cursor-pointer disabled:opacity-40"
                          >
                            Registrar resultado
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Two-column workspace: Timeline Constructor (left) + Quick Inserters & Weekly Variety (right) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Timeline */}
                    <div className="lg:col-span-7 bg-[#111A2E] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                        <div>
                          <h3 className="font-display font-bold text-lg text-white">
                            Orden del Programa y Tiempos
                          </h3>
                          <p className="text-xs text-slate-400">
                            <span className="font-mono-num font-semibold text-white">
                              {draftBlocks.length}
                            </span>{' '}
                            bloques · Duración total estimada:{' '}
                            <span className="font-mono-num font-semibold text-amber-300">
                              {totalBlocksDurationMin} min
                            </span>
                          </p>
                        </div>

                        {hasUnsavedBlocks && (
                          <button
                            type="button"
                            disabled={!isDirector || Boolean(busyAction)}
                            onClick={() => persistSessionUpdate(draftBlocks)}
                            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Save className="w-3.5 h-3.5" />
                            Guardar orden y cambios
                          </button>
                        )}
                      </div>

                      {draftBlocks.length === 0 ? (
                        <p className="text-sm text-slate-400 py-6 text-center">
                          Agrega actividades, juegos o sorpresas desde el panel
                          derecho.
                        </p>
                      ) : (
                        <div className="divide-y divide-white/10">
                          {draftBlocks.map((block, idx) => {
                            const isCur = idx === activeSession.currentBlockIndex;
                            return (
                              <div
                                key={block.id}
                                className={`py-4 space-y-2.5 ${
                                  isCur ? 'border-l-2 border-amber-400 pl-3' : ''
                                }`}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="text-xs text-slate-400">
                                    <span className="font-mono-num font-bold text-white mr-1.5">
                                      #{idx + 1}
                                    </span>
                                    {block.moduleTag}
                                    {block.linkedGameCode && (
                                      <span className="text-sky-300 font-mono-num ml-1.5">
                                        · Sala {block.linkedGameCode}
                                      </span>
                                    )}
                                    {isCur && (
                                      <span className="text-amber-300 font-semibold ml-1.5">
                                        · Activo
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      disabled={!isDirector}
                                      onClick={() =>
                                        runPlaybackControl('jump', { index: idx })
                                      }
                                      className="px-2.5 py-1 rounded-lg bg-[#0B1221] border border-white/10 text-[11px] font-semibold text-sky-300 hover:text-sky-200 cursor-pointer disabled:opacity-40"
                                    >
                                      Ir aquí
                                    </button>
                                    <button
                                      type="button"
                                      disabled={!isDirector || idx === 0}
                                      onClick={() => moveBlock(idx, -1)}
                                      className="p-1.5 rounded-lg bg-[#0B1221] border border-white/10 text-slate-300 hover:text-white cursor-pointer disabled:opacity-30"
                                      title="Subir bloque"
                                    >
                                      <ArrowUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={
                                        !isDirector ||
                                        idx === draftBlocks.length - 1
                                      }
                                      onClick={() => moveBlock(idx, 1)}
                                      className="p-1.5 rounded-lg bg-[#0B1221] border border-white/10 text-slate-300 hover:text-white cursor-pointer disabled:opacity-30"
                                      title="Bajar bloque"
                                    >
                                      <ArrowDown className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={!isDirector}
                                      onClick={() => removeBlock(idx)}
                                      className="p-1.5 rounded-lg bg-[#0B1221] border border-white/10 text-rose-300 hover:text-rose-200 cursor-pointer disabled:opacity-30"
                                      title="Quitar bloque"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-2">
                                  <input
                                    type="text"
                                    disabled={!isDirector}
                                    value={block.title}
                                    onChange={(e) =>
                                      updateBlockField(idx, {
                                        title: e.target.value,
                                      })
                                    }
                                    className="flex-1 bg-[#080E1E] border border-white/10 rounded-xl px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-amber-400 disabled:opacity-70"
                                  />
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <input
                                      type="number"
                                      min={1}
                                      max={180}
                                      disabled={!isDirector}
                                      value={block.durationMin}
                                      onChange={(e) =>
                                        updateBlockField(idx, {
                                          durationMin: Math.max(
                                            1,
                                            Math.min(180, Number(e.target.value) || 5)
                                          ),
                                        })
                                      }
                                      className="w-16 bg-[#080E1E] border border-white/10 rounded-xl px-2.5 py-2 text-sm font-mono-num text-white text-center"
                                    />
                                    <span className="text-xs text-slate-400">
                                      min
                                    </span>
                                  </div>
                                </div>

                                <input
                                  type="text"
                                  disabled={!isDirector}
                                  value={block.instructions}
                                  onChange={(e) =>
                                    updateBlockField(idx, {
                                      instructions: e.target.value,
                                    })
                                  }
                                  placeholder="Instrucciones para proyectar..."
                                  className="w-full bg-[#080E1E] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-400 disabled:opacity-70"
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Right Column: Insert Games / Modules + Weekly Variety */}
                    <div className="lg:col-span-5 space-y-6">
                      {/* Insert Games */}
                      <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-5 space-y-4">
                        <h3 className="font-display font-bold text-base text-white">
                          Insertar Juegos en Vivo
                        </h3>
                        <p className="text-xs text-slate-400">
                          Reutiliza salas existentes con su QR y participantes o
                          crea un nuevo juego bíblico directamente en la agenda.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            disabled={!isDirector}
                            onClick={handleOpenExistingGamePicker}
                            className="px-3.5 py-2.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 text-sky-200 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                          >
                            <Gamepad2 className="w-4 h-4" />
                            Juego Existente
                          </button>
                          <button
                            type="button"
                            disabled={!isDirector}
                            onClick={() => setShowNewGameModal(true)}
                            className="px-3.5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                          >
                            <Plus className="w-4 h-4" />
                            Nuevo Juego
                          </button>
                        </div>
                      </div>

                      {/* Insert Module Activities */}
                      <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-5 space-y-3">
                        <h3 className="font-display font-bold text-base text-white">
                          Agregar Bloque de Módulo
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {QUICK_MODULE_BLOCKS.map((item) => {
                            const modId = mapKindToModuleId(item.kind);
                            return (
                              <button
                                key={item.kind}
                                type="button"
                                disabled={!isDirector || Boolean(busyAction)}
                                onClick={() =>
                                  appendBlockAndSave({
                                    id: `CCB-${Date.now().toString(36)}`,
                                    kind: item.kind,
                                    moduleId: modId,
                                    moduleTag: item.label,
                                    title: item.defaultTitle,
                                    instructions: item.defaultInstructions,
                                    durationMin: item.defaultDuration,
                                    scoreIsolationNote:
                                      getModuleMetaById(modId).scorePolicy,
                                  })
                                }
                                className="text-left px-3 py-2.5 rounded-xl bg-[#0B1221] hover:bg-[#16213B] border border-white/10 text-xs text-slate-200 cursor-pointer disabled:opacity-40"
                              >
                                <div className="font-semibold text-white">
                                  + {item.label}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono-num">
                                  {item.defaultDuration} min
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Weekly Variety Recommendations */}
                      {overview?.varietyRecommendations && (
                        <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-5 space-y-4">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-400" />
                            <h3 className="font-display font-bold text-base text-white">
                              Variedad Semanal Recomendada
                            </h3>
                          </div>

                          {overview.varietyRecommendations.recentThemesToAvoid
                            .length > 0 && (
                            <p className="text-xs text-slate-400 leading-relaxed">
                              Temas recientes a evitar:{' '}
                              <span className="text-slate-200">
                                {overview.varietyRecommendations.recentThemesToAvoid.join(
                                  ' · '
                                )}
                              </span>
                            </p>
                          )}

                          <div className="divide-y divide-white/10">
                            {overview.varietyRecommendations.suggestedBlocks.map(
                              (rec) => (
                                <div
                                  key={rec.id}
                                  className="py-3 flex items-start justify-between gap-3"
                                >
                                  <div className="space-y-0.5 min-w-0">
                                    <div className="text-xs font-semibold text-white">
                                      {rec.title}
                                    </div>
                                    <div className="text-[11px] text-slate-400">
                                      {rec.reason} ·{' '}
                                      <span className="font-mono-num">
                                        {rec.durationMin} min
                                      </span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={!isDirector || Boolean(busyAction)}
                                    onClick={() =>
                                      appendBlockAndSave({
                                        id: `CCB-${Date.now().toString(36)}`,
                                        kind: rec.kind,
                                        moduleId: rec.moduleId,
                                        moduleTag:
                                          getModuleMetaById(rec.moduleId).label,
                                        title: rec.title,
                                        instructions: rec.instructions,
                                        durationMin: rec.durationMin,
                                        scoreIsolationNote:
                                          getModuleMetaById(rec.moduleId)
                                            .scorePolicy,
                                      })
                                    }
                                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/35 text-emerald-200 text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                                  >
                                    + Agregar
                                  </button>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: RESULTADOS SEPARADOS POR MODALIDAD */}
          {activeTab === 'resultados' && overview?.separatedResults && (
            <div className="space-y-6">
              <div className="bg-sky-500/10 border border-sky-400/35 rounded-2xl p-4 text-xs sm:text-sm text-sky-200">
                <strong>Aislamiento de Puntuaciones:</strong> los resultados de
                cada juego bíblico, retos del sábado, ruleta, sorpresas,
                talentos, misiones y campeonatos se conservan por separado sin
                mezclar escalas distintas.
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Games by Mode */}
                <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-5 space-y-4">
                  <h3 className="font-display font-bold text-lg text-white">
                    Juegos Bíblicos en Vivo por Modalidad
                  </h3>
                  {overview.separatedResults.gamesByMode.length === 0 ? (
                    <p className="text-sm text-slate-400">
                      Sin partidas registradas aún.
                    </p>
                  ) : (
                    <div className="divide-y divide-white/10">
                      {overview.separatedResults.gamesByMode.map((g) => (
                        <div key={g.code} className="py-3 space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-semibold text-amber-300">
                              {g.modeLabel} ·{' '}
                              <span className="font-mono-num">{g.code}</span>
                            </span>
                            <span className="text-slate-400">
                              {g.status === 'activa' ? 'En vivo' : 'Finalizada'} ·{' '}
                              <span className="font-mono-num">
                                {g.participantCount}
                              </span>{' '}
                              participantes
                            </span>
                          </div>
                          <div className="text-sm font-semibold text-white">
                            {g.title}
                          </div>
                          {g.topEntries.length > 0 && (
                            <div className="text-xs text-slate-300">
                              {g.topEntries
                                .slice(0, 3)
                                .map((e) => `${e.name}: ${e.score} pts`)
                                .join(' · ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Championships */}
                <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-5 space-y-4">
                  <h3 className="font-display font-bold text-lg text-white">
                    Campeonatos Juveniles
                  </h3>
                  {overview.separatedResults.championships.length === 0 ? (
                    <p className="text-sm text-slate-400">
                      No hay temporadas de campeonato creadas.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {overview.separatedResults.championships.map((c) => (
                        <div key={c.seasonId} className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-amber-300">
                              {c.seasonName}
                            </span>
                            <span className="text-slate-400">{c.status}</span>
                          </div>
                          <div className="divide-y divide-white/10">
                            {c.standings.map((s, idx) => (
                              <div
                                key={`${c.seasonId}-${s.name}`}
                                className="py-1.5 flex items-center justify-between text-xs"
                              >
                                <span className="text-slate-200">
                                  <span className="font-mono-num text-slate-400 mr-2">
                                    #{idx + 1}
                                  </span>
                                  {s.name}
                                </span>
                                <span className="font-mono-num font-bold text-amber-300">
                                  {s.points} pts
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Challenges & Roulette */}
                <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-5 space-y-4">
                  <h3 className="font-display font-bold text-lg text-white">
                    Retos del Sábado y Ruleta de Actividades
                  </h3>
                  {overview.separatedResults.challengesAndRoulette.length === 0 ? (
                    <p className="text-sm text-slate-400">
                      Sin retos o giros registrados aún.
                    </p>
                  ) : (
                    <div className="divide-y divide-white/10">
                      {overview.separatedResults.challengesAndRoulette.map((c) => (
                        <div
                          key={c.id}
                          className="py-2.5 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="text-emerald-300 font-semibold">
                              {c.module}
                            </div>
                            <div className="text-white truncate">
                              {c.title} · {c.participantOrWinner}
                            </div>
                            <div className="text-slate-400 truncate">{c.outcome}</div>
                          </div>
                          <span className="font-mono-num font-bold text-amber-300 shrink-0">
                            {c.points} pts
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Surprises, Talents, Missions */}
                <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-5 space-y-5">
                  <div className="space-y-2">
                    <h3 className="font-display font-bold text-base text-white">
                      Cabina de Sorpresas
                    </h3>
                    {overview.separatedResults.surprises.length === 0 ? (
                      <p className="text-xs text-slate-400">
                        Sin sorpresas registradas.
                      </p>
                    ) : (
                      <div className="divide-y divide-white/10">
                        {overview.separatedResults.surprises.slice(0, 6).map((s) => (
                          <div
                            key={s.id}
                            className="py-2 flex items-center justify-between text-xs"
                          >
                            <span className="text-slate-200 truncate">
                              {s.title} · {s.participantName} ({s.outcome})
                            </span>
                            <span className="font-mono-num text-amber-300 font-bold shrink-0">
                              {s.pointsAwarded} pts
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-white/10 pt-4 space-y-2">
                    <h3 className="font-display font-bold text-base text-white">
                      Talentos Juveniles y Misiones
                    </h3>
                    <div className="text-xs text-slate-300 space-y-1">
                      <p>
                        Presentaciones de talento:{' '}
                        <strong className="font-mono-num text-white">
                          {overview.separatedResults.talents.length}
                        </strong>
                      </p>
                      <p>
                        Registros de misiones semanales:{' '}
                        <strong className="font-mono-num text-white">
                          {overview.separatedResults.missions.length}
                        </strong>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: EXPERIENCIA SONORA POR MÓDULO */}
          {activeTab === 'sonido' && <ModuleAudioPanel />}

          {/* TAB 4: CONTROL Y PERMISOS */}
          {activeTab === 'permisos' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-6 space-y-4">
                <h3 className="font-display font-bold text-lg text-white">
                  Visibilidad para Participantes
                </h3>
                {!activeSession ? (
                  <p className="text-sm text-slate-400">
                    Selecciona o crea un programa para configurar permisos.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {(
                      [
                        {
                          key: 'showSchedule',
                          title: 'Mostrar agenda de actividades',
                          desc: 'Permite a los participantes consultar el orden del programa y botones para unirse a juegos.',
                        },
                        {
                          key: 'showOwnResults',
                          title: 'Consultar sus propios resultados',
                          desc: 'Habilita la búsqueda personal por nombre sin exponer controles privados.',
                        },
                        {
                          key: 'showStandings',
                          title: 'Mostrar tabla del campeonato',
                          desc: 'Muestra las posiciones vigentes de la temporada vinculada.',
                        },
                      ] as const
                    ).map((opt) => {
                      const checked = activeSession.participantVisibility[opt.key];
                      return (
                        <label
                          key={opt.key}
                          className="flex items-start justify-between gap-4 py-3 border-b border-white/10 last:border-b-0 cursor-pointer"
                        >
                          <div>
                            <div className="text-sm font-semibold text-white">
                              {opt.title}
                            </div>
                            <div className="text-xs text-slate-400">
                              {opt.desc}
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            disabled={!isDirector || Boolean(busyAction)}
                            checked={checked}
                            onChange={(e) => {
                              if (!requireDirectorOrPrompt()) return;
                              persistSessionUpdate(draftBlocks, {
                                participantVisibility: {
                                  ...activeSession.participantVisibility,
                                  [opt.key]: e.target.checked,
                                },
                              });
                            }}
                            className="w-4 h-4 accent-amber-400 mt-1 shrink-0"
                          />
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-6 space-y-4">
                <h3 className="font-display font-bold text-lg text-white">
                  Enlaces Directos de Proyección y Participación
                </h3>
                {!activeSession ? (
                  <p className="text-sm text-slate-400">
                    Crea un programa para generar los enlaces de acceso directo.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <div className="text-xs text-slate-400">
                        Pantalla de Proyección Integrada
                      </div>
                      <div className="flex items-center gap-2 bg-[#080E1E] border border-white/10 rounded-xl px-3 py-2">
                        <span className="text-xs font-mono text-slate-200 truncate flex-1">
                          {`/?cc_proyector=${activeSession.id}`}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            copySharePath(
                              `/?cc_proyector=${encodeURIComponent(activeSession.id)}`,
                              'proj'
                            )
                          }
                          className="text-xs font-semibold text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {copiedLink === 'proj' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          {copiedLink === 'proj' ? 'Copiado' : 'Copiar'}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-xs text-slate-400">
                        Vista Participante (sin clave de director)
                      </div>
                      <div className="flex items-center gap-2 bg-[#080E1E] border border-white/10 rounded-xl px-3 py-2">
                        <span className="text-xs font-mono text-slate-200 truncate flex-1">
                          {`/?cc_participante=${activeSession.id}`}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            copySharePath(
                              `/?cc_participante=${encodeURIComponent(activeSession.id)}`,
                              'part'
                            )
                          }
                          className="text-xs font-semibold text-amber-300 hover:text-amber-200 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {copiedLink === 'part' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          {copiedLink === 'part' ? 'Copiado' : 'Copiar'}
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setViewMode('participante')}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/35 text-sky-200 text-xs font-semibold cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                      Probar Vista Participante ahora
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: DIRECTOR PIN */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form
            onSubmit={handleDirectorLogin}
            className="bg-[#111A2E] border border-white/15 rounded-2xl p-6 max-w-sm w-full space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg text-white">
                Acceso de Director Autorizado
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
              Ingresa la clave de dirección de Sociedad de Jóvenes para crear,
              editar, iniciar programas y validar resultados.
            </p>
            <input
              type="password"
              autoFocus
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Clave de director"
              className="w-full bg-[#080E1E] border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
            />
            {pinError && <p className="text-xs text-rose-400">{pinError}</p>}
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm cursor-pointer"
            >
              Verificar Acceso
            </button>
          </form>
        </div>
      )}

      {/* MODAL: CREATE NEW INTEGRATED SESSION */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleCreateSession}
            className="bg-[#111A2E] border border-white/15 rounded-2xl p-6 max-w-lg w-full space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg text-white">
                Nuevo Programa en Centro de Control
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Base inicial</label>
                <select
                  value={createTemplate}
                  onChange={(e) =>
                    setCreateTemplate(
                      e.target.value as 'integral' | 'blank' | 'import'
                    )
                  }
                  className="mt-1 w-full bg-[#080E1E] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                >
                  <option value="integral">
                    Plantilla Integral (módulos de Sociedad de Jóvenes)
                  </option>
                  <option value="import">
                    Importar desde Programa del Sábado guardado
                  </option>
                  <option value="blank">Programa en blanco</option>
                </select>
              </div>

              {createTemplate === 'import' && overview && (
                <div>
                  <label className="text-xs text-slate-400">
                    Programa guardado a importar
                  </label>
                  <select
                    value={createImportId}
                    onChange={(e) => setCreateImportId(e.target.value)}
                    className="mt-1 w-full bg-[#080E1E] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                  >
                    <option value="">Selecciona un programa...</option>
                    {overview.savedPrograms.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.scheduledDate})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">
                    Título del programa
                  </label>
                  <input
                    type="text"
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                    placeholder="Ej: Sábado de Jóvenes en Acción"
                    className="mt-1 w-full bg-[#080E1E] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Tema central</label>
                  <input
                    type="text"
                    value={createTheme}
                    onChange={(e) => setCreateTheme(e.target.value)}
                    placeholder="Ej: Luz en nuestra generación"
                    className="mt-1 w-full bg-[#080E1E] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Texto bíblico</label>
                  <input
                    type="text"
                    value={createBibleText}
                    onChange={(e) => setCreateBibleText(e.target.value)}
                    className="mt-1 w-full bg-[#080E1E] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Director</label>
                  <input
                    type="text"
                    value={createDirectorName}
                    onChange={(e) => setCreateDirectorName(e.target.value)}
                    className="mt-1 w-full bg-[#080E1E] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Duración</label>
                  <select
                    value={createDuration}
                    onChange={(e) =>
                      setCreateDuration(Number(e.target.value) as 60 | 90 | 120)
                    }
                    className="mt-1 w-full bg-[#080E1E] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                  >
                    <option value={60}>60 min</option>
                    <option value={90}>90 min</option>
                    <option value={120}>120 min</option>
                  </select>
                </div>
              </div>

              {overview && overview.championshipSeasons.length > 0 && (
                <div>
                  <label className="text-xs text-slate-400">
                    Vincular temporada de campeonato (opcional)
                  </label>
                  <select
                    value={createSeasonId}
                    onChange={(e) => setCreateSeasonId(e.target.value)}
                    className="mt-1 w-full bg-[#080E1E] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                  >
                    <option value="">Automático (temporada activa)</option>
                    {overview.championshipSeasons.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl bg-[#0B1221] text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={Boolean(busyAction)}
                className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold cursor-pointer"
              >
                Crear Programa
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: INSERT EXISTING GAME */}
      {showExistingGameModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#111A2E] border border-white/15 rounded-2xl p-6 max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg text-white">
                Insertar Juego Existente
              </h3>
              <button
                type="button"
                onClick={() => setShowExistingGameModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {existingGamesList.length === 0 ? (
              <p className="text-sm text-slate-400 py-4">
                No hay salas activas abiertas en este momento. Puedes crear un
                nuevo juego directamente desde "Nuevo Juego".
              </p>
            ) : (
              <div className="divide-y divide-white/10 max-h-80 overflow-y-auto">
                {existingGamesList.map((g) => (
                  <div
                    key={g.gameId}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">
                        {g.title}
                      </div>
                      <div className="text-xs text-slate-400">
                        <span className="font-mono-num text-amber-300">
                          {g.code}
                        </span>{' '}
                        · {g.modeLabel} ·{' '}
                        <span className="font-mono-num">
                          {g.participantCount}
                        </span>{' '}
                        participantes
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleInsertExistingGame(g)}
                      className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Insertar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: CREATE AND INSERT NEW GAME */}
      {showNewGameModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateAndInsertGame}
            className="bg-[#111A2E] border border-white/15 rounded-2xl p-6 max-w-lg w-full space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg text-white">
                Crear e Insertar Nuevo Juego
              </h3>
              <button
                type="button"
                onClick={() => setShowNewGameModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Crea una sala oficial en el motor original con código QR,
              avatares y participantes reales, e intégrala automáticamente en la
              agenda.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">
                  Título de la partida
                </label>
                <input
                  type="text"
                  required
                  value={newGameTitle}
                  onChange={(e) => setNewGameTitle(e.target.value)}
                  className="mt-1 w-full bg-[#080E1E] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">
                    Modalidad del juego
                  </label>
                  <select
                    value={newGameMode}
                    onChange={(e) => setNewGameMode(e.target.value as GameMode)}
                    className="mt-1 w-full bg-[#080E1E] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                  >
                    {CREATABLE_GAME_MODES.map((m) => (
                      <option key={m.mode} value={m.mode}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400">
                    Código personalizado (opcional)
                  </label>
                  <input
                    type="text"
                    value={newGameCode}
                    onChange={(e) =>
                      setNewGameCode(
                        e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                      )
                    }
                    placeholder="Automático"
                    className="mt-1 w-full bg-[#080E1E] border border-white/15 rounded-xl px-3 py-2 text-sm font-mono-num text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Preguntas</label>
                  <input
                    type="number"
                    min={3}
                    max={40}
                    value={newGameQuestions}
                    onChange={(e) => setNewGameQuestions(Number(e.target.value) || 10)}
                    className="mt-1 w-full bg-[#080E1E] border border-white/15 rounded-xl px-3 py-2 text-sm font-mono-num text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Seg/preg</label>
                  <input
                    type="number"
                    min={8}
                    max={120}
                    value={newGameTimeSec}
                    onChange={(e) => setNewGameTimeSec(Number(e.target.value) || 20)}
                    className="mt-1 w-full bg-[#080E1E] border border-white/15 rounded-xl px-3 py-2 text-sm font-mono-num text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Bloque (min)</label>
                  <input
                    type="number"
                    min={3}
                    max={60}
                    value={newGameDurationMin}
                    onChange={(e) =>
                      setNewGameDurationMin(Number(e.target.value) || 12)
                    }
                    className="mt-1 w-full bg-[#080E1E] border border-white/15 rounded-xl px-3 py-2 text-sm font-mono-num text-white"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewGameModal(false)}
                className="px-4 py-2 rounded-xl bg-[#0B1221] text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={Boolean(busyAction)}
                className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold cursor-pointer"
              >
                Crear e Insertar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: SURPRISE BOOTH CONFIG & DRAW */}
      {showSurpriseModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#111A2E] border border-white/15 rounded-2xl p-6 max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg text-white flex items-center gap-2">
                <PackageOpen className="w-5 h-5 text-orange-400" />
                Activar Cabina de Sorpresas
              </h3>
              <button
                type="button"
                onClick={() => setShowSurpriseModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="text-xs text-slate-400">
                Categorías habilitadas ({surpriseCategories.length}/12)
              </div>
              <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto">
                {SURPRISE_CATEGORIES.map((cat) => {
                  const checked = surpriseCategories.includes(cat.id);
                  return (
                    <label
                      key={cat.id}
                      className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer py-1"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSurpriseCategories((p) => [...p, cat.id]);
                          } else {
                            setSurpriseCategories((p) =>
                              p.filter((id) => id !== cat.id)
                            );
                          }
                        }}
                        className="accent-orange-400"
                      />
                      <span className="truncate">{cat.label}</span>
                    </label>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
                <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={surpriseAvoidRecent}
                    onChange={(e) => setSurpriseAvoidRecent(e.target.checked)}
                    className="accent-orange-400"
                  />
                  Evitar repetir sorpresas recientes
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Tiempo (seg):</span>
                  <input
                    type="number"
                    min={15}
                    max={240}
                    value={surpriseDurationSec}
                    onChange={(e) =>
                      setSurpriseDurationSec(Number(e.target.value) || 45)
                    }
                    className="w-16 bg-[#080E1E] border border-white/15 rounded-lg px-2 py-1 text-xs font-mono-num text-white text-center"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSurpriseModal(false)}
                className="px-4 py-2 rounded-xl bg-[#0B1221] text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  surpriseCategories.length === 0 || Boolean(busyAction)
                }
                onClick={handleDrawSurprise}
                className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-bold cursor-pointer disabled:opacity-40"
              >
                Revelar Sorpresa en Vivo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
