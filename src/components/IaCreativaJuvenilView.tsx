import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Download,
  Edit3,
  FileText,
  Gamepad2,
  History,
  Image as ImageIcon,
  Layers,
  Loader2,
  MessageSquare,
  Music,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Theater,
  Trash2,
  Wand2,
} from 'lucide-react';
import {
  ActivityCategoryType,
  AiCreativeActivity,
  AiCreativeChatSession,
  AiCreativeImageRecord,
  AiCreativeProgram,
  AiCreativeRecord,
  AiCreativeStatus,
  AiDiagnosticEvent,
  AiErrorCategory,
  BibleTranslationPreference,
  ChatStructuredArtifact,
  ChristianEventType,
  CREATIVE_TOOL_META,
  CreativeAiProfile,
  CreativeImageCategory,
  CreativeImageFormat,
  CreativeImageStyle,
  CreativePayloadUnion,
  CreativeToolKind,
  DOCTRINAL_TRADITIONS,
  DoctrinalTradition,
  ScriptFormatType,
  SermonFormatType,
} from '../shared/creativeAiTypes';
import { getUpcomingSaturdayIso } from '../shared/saturdayProgramTypes';
import {
  ActiveWorkspaceItem,
  IaCreativaEditorPanel,
} from './IaCreativaEditorPanel';

interface IaCreativaJuvenilViewProps {
  onBack: () => void;
  onOpenSaturdayProgram: (programId?: string) => void;
  onCreatedMultiplayerRoom: (code: string, presenterToken: string) => void;
}

type MainTab = 'chat' | 'tools' | 'editor' | 'images' | 'history' | 'profile';

const STARTER_CHAT_PROMPTS = [
  'Quiero un programa que haga pensar a los jóvenes sobre cómo están viviendo su relación con Dios, pero que no sea aburrido',
  'Hazme un programa diferente para este sábado',
  'Quiero una actividad sobre el perdón que emocione y haga reflexionar',
  'Organiza una competencia bíblica para 30 jóvenes',
  'Quiero una dramatización moderna de la historia de José',
  'Tenemos poco dinero, crea algo creativo',
  'Quiero un programa evangelístico para jóvenes que no conocen la iglesia',
];

const ERROR_CATEGORY_LABELS: Record<AiErrorCategory, string> = {
  NONE: 'OK (200)',
  OFFLINE: 'Sin Internet',
  SERVER_UNREACHABLE: 'Servidor Caído',
  MISSING_KEY: 'Sin Clave API (503)',
  AUTH_401: 'No Autorizado (401)',
  FORBIDDEN_403: 'Permiso Denegado (403)',
  RATE_LIMIT_429: 'Cuota / Límite (429)',
  BAD_REQUEST_400: 'Solicitud Inválida (400)',
  MODEL_404: 'Modelo / Ruta No Hallada (404)',
  SERVER_500: 'Error Interno (500)',
  TIMEOUT: 'Tiempo Agotado (504)',
  NETWORK_ERROR: 'Error de Red (502)',
  INVALID_FORMAT: 'Formato Inválido',
  UNKNOWN: 'Error Desconocido',
};

function buildFriendlyErrorMessage(
  status: number,
  category: AiErrorCategory,
  serverMsg?: string
): string {
  if (serverMsg && serverMsg.trim()) return serverMsg.trim();
  switch (category) {
    case 'OFFLINE':
      return 'Tu dispositivo está sin conexión a internet. Verifica tu red e intenta nuevamente.';
    case 'SERVER_UNREACHABLE':
      return 'No se pudo alcanzar el servidor de la aplicación. Verifica que el backend esté activo.';
    case 'MISSING_KEY':
      return 'Falta configurar la variable GEMINI_API_KEY en Settings > Secrets del servidor.';
    case 'AUTH_401':
      return 'Error 401: La credencial de Gemini API es inválida, expiró o no está autorizada.';
    case 'FORBIDDEN_403':
      return 'Error 403: Acceso denegado por Gemini API (verifica permisos de la clave o facturación si usas imágenes).';
    case 'RATE_LIMIT_429':
      return 'Error 429: Se alcanzó el límite de solicitudes o cuota de Gemini API. Espera unos segundos y reintenta.';
    case 'BAD_REQUEST_400':
      return 'Error 400: La solicitud fue demasiado extensa o tuvo parámetros no válidos.';
    case 'MODEL_404':
      return 'Error 404: El modelo de IA o ruta solicitada no está disponible.';
    case 'SERVER_500':
      return `Error ${status || 500}: Falla interna temporal del servidor o de Gemini API. Intenta de nuevo en unos momentos.`;
    case 'TIMEOUT':
      return 'Tiempo de espera agotado al esperar respuesta de Gemini API. Intenta con una instrucción más breve.';
    case 'INVALID_FORMAT':
      return 'La respuesta del servidor no tuvo un formato JSON válido. Reintenta para regenerar la salida.';
    case 'NETWORK_ERROR':
      return 'Error de red entre el servidor y Gemini API. Reintenta en unos segundos.';
    default:
      return `Error inesperado (HTTP ${status || 0}) al comunicarse con la IA.`;
  }
}

function classifyHttpCategory(
  status: number,
  serverCategory?: string,
  serverCode?: string
): AiErrorCategory {
  if (
    serverCategory &&
    serverCategory in ERROR_CATEGORY_LABELS &&
    serverCategory !== 'NONE'
  ) {
    return serverCategory as AiErrorCategory;
  }
  if (status === 503 && serverCode === 'MISSING_API_KEY') return 'MISSING_KEY';
  if (status === 401) return 'AUTH_401';
  if (status === 403) return 'FORBIDDEN_403';
  if (status === 429) return 'RATE_LIMIT_429';
  if (status === 400 || status === 413) return 'BAD_REQUEST_400';
  if (status === 404) return 'MODEL_404';
  if (status === 504) return 'TIMEOUT';
  if (status >= 500) return 'SERVER_500';
  return 'UNKNOWN';
}

export function IaCreativaJuvenilView({
  onBack,
  onOpenSaturdayProgram,
  onCreatedMultiplayerRoom,
}: IaCreativaJuvenilViewProps) {
  const [activeTab, setActiveTab] = useState<MainTab>('chat');
  const [selectedTool, setSelectedTool] = useState<CreativeToolKind>('program');

  const [loadingOverview, setLoadingOverview] = useState(true);
  const [status, setStatus] = useState<AiCreativeStatus | null>(null);
  const [monitorOpen, setMonitorOpen] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [monitorEvents, setMonitorEvents] = useState<AiDiagnosticEvent[]>([]);
  const [profile, setProfile] = useState<CreativeAiProfile>({
    churchName: '',
    denominationalTradition: 'general',
    customTraditionNotes: '',
    bibleTranslation: 'RVR1960',
    youthAgeGroup: 'Jóvenes y adolescentes (13 a 28 años)',
    ministryFocus: 'Sociedad de Jóvenes, discipulado bíblico y participación creativa',
    requireDoctrinalReviewNotes: true,
    updatedAt: Date.now(),
  });
  const [records, setRecords] = useState<AiCreativeRecord[]>([]);
  const [images, setImages] = useState<AiCreativeImageRecord[]>([]);
  const [chatSessions, setChatSessions] = useState<AiCreativeChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>('');

  // Workspace active editable item
  const [activeItem, setActiveItem] = useState<ActiveWorkspaceItem | null>(null);

  // Global notifications
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const notify = useCallback((type: 'ok' | 'err', text: string) => {
    setNotice({ type, text });
  }, []);

  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

  // Program form
  const [progDuration, setProgDuration] = useState<60 | 90 | 120>(90);
  const [progDate, setProgDate] = useState(() => getUpcomingSaturdayIso());
  const [progTopic, setProgTopic] = useState('');
  const [progEventType, setProgEventType] = useState('Sociedad de Jóvenes');
  const [progParticipants, setProgParticipants] = useState(30);
  const [progAllInclusive, setProgAllInclusive] = useState(true);

  // Sermon form
  const [sermonType, setSermonType] = useState<SermonFormatType>('sermon_juvenil');
  const [sermonDuration, setSermonDuration] = useState(20);
  const [sermonDepth, setSermonDepth] = useState<'breve' | 'intermedia' | 'profunda'>('intermedia');
  const [sermonTopic, setSermonTopic] = useState('');
  const [sermonBiblePref, setSermonBiblePref] = useState('');

  // Activity form
  const [actCategory, setActCategory] = useState<ActivityCategoryType>('juegos_biblicos');
  const [actParticipants, setActParticipants] = useState('25 a 35 jóvenes');
  const [actDuration, setActDuration] = useState(15);
  const [actTopic, setActTopic] = useState('');

  // Script form
  const [scriptType, setScriptType] = useState<ScriptFormatType>('drama_biblico');
  const [scriptParticipants, setScriptParticipants] = useState(4);
  const [scriptDuration, setScriptDuration] = useState(10);
  const [scriptTopic, setScriptTopic] = useState('');

  // Presentation form
  const [presTopic, setPresTopic] = useState('');
  const [presSlides, setPresSlides] = useState(8);
  const [presSourceId, setPresSourceId] = useState('');

  // Event form
  const [eventType, setEventType] = useState<ChristianEventType>('semana_oracion');
  const [eventTopic, setEventTopic] = useState('');
  const [eventParticipants, setEventParticipants] = useState(60);
  const [eventIncludeBudget, setEventIncludeBudget] = useState(false);

  // Music form
  const [musicTopic, setMusicTopic] = useState('');
  const [musicBible, setMusicBible] = useState('');
  const [musicStyle, setMusicStyle] = useState('Adoración juvenil congregacional');

  const [generatingTool, setGeneratingTool] = useState(false);

  // Image generator form
  const [imgPrompt, setImgPrompt] = useState('');
  const [imgCategory, setImgCategory] = useState<CreativeImageCategory>('afiche_juvenil');
  const [imgFormat, setImgFormat] = useState<CreativeImageFormat>('16:9');
  const [imgStyle, setImgStyle] = useState<CreativeImageStyle>('diseno_moderno_juvenil');
  const [imgEditSourceId, setImgEditSourceId] = useState<string>('');
  const [generatingImg, setGeneratingImg] = useState(false);

  // History filters
  const [historySearch, setHistorySearch] = useState('');
  const [historyKindFilter, setHistoryKindFilter] = useState<'all' | CreativeToolKind>('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'draft' | 'final'>('all');
  const [savingProfile, setSavingProfile] = useState(false);

  const pushMonitorEvent = useCallback((evt: AiDiagnosticEvent) => {
    setMonitorEvents((prev) => [evt, ...prev].slice(0, 15));
  }, []);

  const monitoredFetchJson = useCallback(
    async <T,>(
      url: string,
      options: RequestInit,
      operation: string,
      timeoutMs = 52000
    ): Promise<{ ok: true; data: T; latencyMs: number } | { ok: false; event: AiDiagnosticEvent }> => {
      const startedAt = performance.now();

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        const evt: AiDiagnosticEvent = {
          id: `CLI-${Date.now()}`,
          timestamp: Date.now(),
          operation,
          ok: false,
          httpStatus: 0,
          errorCategory: 'OFFLINE',
          code: 'CLIENT_OFFLINE',
          latencyMs: 0,
          friendlyMessage: buildFriendlyErrorMessage(0, 'OFFLINE'),
        };
        pushMonitorEvent(evt);
        return { ok: false, event: evt };
      }

      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        const latencyMs = Math.max(1, Math.round(performance.now() - startedAt));
        const rawText = await res.text();

        type ParsedBody = T & {
          error?: string;
          code?: string;
          errorCategory?: string;
          technicalHint?: string;
          diagnostic?: AiDiagnosticEvent;
        };
        let parsed: ParsedBody | null = null;

        if (rawText.trim()) {
          try {
            parsed = JSON.parse(rawText) as ParsedBody;
          } catch {
            const category: AiErrorCategory =
              res.status === 504
                ? 'TIMEOUT'
                : res.status >= 500
                  ? 'SERVER_500'
                  : 'INVALID_FORMAT';
            const evt: AiDiagnosticEvent = {
              id: `CLI-${Date.now()}`,
              timestamp: Date.now(),
              operation,
              ok: false,
              httpStatus: res.status,
              errorCategory: category,
              code: `HTTP_${res.status}_NON_JSON`,
              latencyMs,
              friendlyMessage: buildFriendlyErrorMessage(res.status, category),
              technicalHint: `Respuesta no JSON (HTTP ${res.status})`,
            };
            pushMonitorEvent(evt);
            return { ok: false, event: evt };
          }
        }

        if (!res.ok || !parsed) {
          const category = classifyHttpCategory(
            res.status,
            parsed?.errorCategory,
            parsed?.code
          );
          const evt: AiDiagnosticEvent = parsed?.diagnostic || {
            id: `CLI-${Date.now()}`,
            timestamp: Date.now(),
            operation,
            ok: false,
            httpStatus: res.status,
            errorCategory: category,
            code: parsed?.code || `HTTP_${res.status}`,
            latencyMs,
            friendlyMessage: buildFriendlyErrorMessage(res.status, category, parsed?.error),
            technicalHint: parsed?.technicalHint,
          };
          pushMonitorEvent(evt);
          return { ok: false, event: evt };
        }

        const okEvt: AiDiagnosticEvent = {
          id: `CLI-${Date.now()}`,
          timestamp: Date.now(),
          operation,
          ok: true,
          httpStatus: res.status,
          errorCategory: 'NONE',
          code: 'OK',
          latencyMs,
          friendlyMessage: `${operation} completado correctamente en ${latencyMs} ms.`,
        };
        pushMonitorEvent(okEvt);
        return { ok: true, data: parsed, latencyMs };
      } catch (err) {
        const latencyMs = Math.max(1, Math.round(performance.now() - startedAt));
        const isAbort =
          err instanceof DOMException && err.name === 'AbortError';
        const category: AiErrorCategory = isAbort
          ? 'TIMEOUT'
          : 'SERVER_UNREACHABLE';
        const evt: AiDiagnosticEvent = {
          id: `CLI-${Date.now()}`,
          timestamp: Date.now(),
          operation,
          ok: false,
          httpStatus: isAbort ? 504 : 0,
          errorCategory: category,
          code: isAbort ? 'CLIENT_TIMEOUT' : 'FETCH_FAILED',
          latencyMs,
          friendlyMessage: buildFriendlyErrorMessage(
            isAbort ? 504 : 0,
            category
          ),
          technicalHint:
            err instanceof Error ? err.message.slice(0, 140) : String(err),
        };
        pushMonitorEvent(evt);
        return { ok: false, event: evt };
      } finally {
        window.clearTimeout(timer);
      }
    },
    [pushMonitorEvent]
  );

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const res = await fetch('/api/ia-creativa/overview');
      if (!res.ok) {
        const cat = classifyHttpCategory(res.status);
        pushMonitorEvent({
          id: `CLI-${Date.now()}`,
          timestamp: Date.now(),
          operation: 'load_overview',
          ok: false,
          httpStatus: res.status,
          errorCategory: cat,
          code: `HTTP_${res.status}`,
          latencyMs: 0,
          friendlyMessage: buildFriendlyErrorMessage(res.status, cat),
        });
        return;
      }
      const data = (await res.json()) as {
        status?: AiCreativeStatus;
        profile?: CreativeAiProfile;
        records?: AiCreativeRecord[];
        images?: AiCreativeImageRecord[];
        chatSessions?: AiCreativeChatSession[];
        activeChatSessionId?: string | null;
      };
      if (data.status) setStatus(data.status);
      if (data.profile) setProfile(data.profile);
      if (Array.isArray(data.records)) setRecords(data.records);
      if (Array.isArray(data.images)) setImages(data.images);
      if (Array.isArray(data.chatSessions)) {
        setChatSessions(data.chatSessions);
        if (data.activeChatSessionId) {
          setActiveChatId(data.activeChatSessionId);
        } else if (data.chatSessions.length > 0 && !activeChatId) {
          setActiveChatId(data.chatSessions[0].id);
        }
      }
    } catch {
      const evt: AiDiagnosticEvent = {
        id: `CLI-${Date.now()}`,
        timestamp: Date.now(),
        operation: 'load_overview',
        ok: false,
        httpStatus: 0,
        errorCategory: 'SERVER_UNREACHABLE',
        code: 'OVERVIEW_FETCH_FAILED',
        latencyMs: 0,
        friendlyMessage: buildFriendlyErrorMessage(0, 'SERVER_UNREACHABLE'),
      };
      pushMonitorEvent(evt);
      notify('err', evt.friendlyMessage);
    } finally {
      setLoadingOverview(false);
    }
  }, [activeChatId, notify, pushMonitorEvent]);

  const handleTestRealConnection = async () => {
    setTestingConnection(true);
    setMonitorOpen(true);
    const result = await monitoredFetchJson<{
      ok: boolean;
      modelUsed?: string;
      latencyMs?: number;
      responsePreview?: string;
      diagnostic?: AiDiagnosticEvent;
      status?: AiCreativeStatus;
    }>(
      '/api/ia-creativa/test-connection',
      { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      'test_connection',
      22000
    );

    if (!result.ok) {
      notify(
        'err',
        `[${ERROR_CATEGORY_LABELS[result.event.errorCategory]}] ${result.event.friendlyMessage}`
      );
      setTestingConnection(false);
      return;
    }

    if (result.data.status) setStatus(result.data.status);
    notify(
      'ok',
      `Conexión real verificada con ${result.data.modelUsed || 'Gemini'} en ${result.data.latencyMs || result.latencyMs} ms.`
    );
    setTestingConnection(false);
  };

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const activeChatSession = useMemo(
    () => chatSessions.find((s) => s.id === activeChatId) || null,
    [chatSessions, activeChatId]
  );

  const openArtifactInEditor = useCallback(
    (artifact: ChatStructuredArtifact, keepRecordId?: string) => {
      setActiveItem({
        recordId: keepRecordId,
        kind: artifact.kind,
        title: artifact.title,
        theme: artifact.theme,
        eventType: artifact.eventType,
        scheduledDate: artifact.scheduledDate,
        status: 'draft',
        payload: JSON.parse(JSON.stringify(artifact.payload)) as CreativePayloadUnion,
        versions: [],
        currentVersion: 0,
      });
      setActiveTab('editor');
    },
    []
  );

  const openRecordInEditor = (rec: AiCreativeRecord) => {
    setActiveItem({
      recordId: rec.id,
      kind: rec.kind,
      title: rec.title,
      theme: rec.theme,
      eventType: rec.eventType,
      scheduledDate: rec.scheduledDate,
      status: rec.status,
      payload: JSON.parse(JSON.stringify(rec.payload)) as CreativePayloadUnion,
      versions: rec.versions || [],
      currentVersion: rec.currentVersion || 1,
      sentToSaturdayProgramId: rec.sentToSaturdayProgramId,
    });
    setActiveTab('editor');
  };

  const handleGenerateTool = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    setGeneratingTool(true);

    try {
      let endpoint = '/api/ia-creativa/generate/program';
      let body: Record<string, unknown> = {};

      if (selectedTool === 'program') {
        endpoint = '/api/ia-creativa/generate/program';
        body = {
          durationMinutes: progDuration,
          scheduledDate: progDate,
          topicOrRequest: progTopic,
          eventType: progEventType,
          participantCount: progParticipants,
          allInclusiveMode: progAllInclusive,
        };
      } else if (selectedTool === 'sermon') {
        endpoint = '/api/ia-creativa/generate/sermon';
        body = {
          sermonType,
          durationMinutes: sermonDuration,
          depth: sermonDepth,
          topic: sermonTopic,
          bibleTextPreference: sermonBiblePref,
        };
      } else if (selectedTool === 'activity') {
        endpoint = '/api/ia-creativa/generate/activity';
        body = {
          category: actCategory,
          participantCount: actParticipants,
          durationMinutes: actDuration,
          topic: actTopic,
        };
      } else if (selectedTool === 'script') {
        endpoint = '/api/ia-creativa/generate/script';
        body = {
          scriptType,
          participantCount: scriptParticipants,
          durationMinutes: scriptDuration,
          topic: scriptTopic,
        };
      } else if (selectedTool === 'presentation') {
        endpoint = '/api/ia-creativa/generate/presentation';
        body = {
          topic: presTopic,
          slideCount: presSlides,
          sourceRecordId: presSourceId || undefined,
        };
      } else if (selectedTool === 'event') {
        endpoint = '/api/ia-creativa/generate/event';
        body = {
          eventType,
          topic: eventTopic,
          participantCount: eventParticipants,
          includeBudget: eventIncludeBudget,
        };
      } else if (selectedTool === 'music') {
        endpoint = '/api/ia-creativa/generate/music';
        body = {
          topic: musicTopic,
          mainBibleText: musicBible,
          congregationStyle: musicStyle,
        };
      }

      const result = await monitoredFetchJson<{
        kind?: CreativeToolKind;
        payload?: CreativePayloadUnion;
        modelUsed?: string;
      }>(
        endpoint,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
        `generate_${selectedTool}`,
        52000
      );

      if (!result.ok) {
        notify(
          'err',
          `[${ERROR_CATEGORY_LABELS[result.event.errorCategory]}] ${result.event.friendlyMessage}`
        );
        return;
      }

      const data = result.data;
      if (!data.payload) {
        notify('err', 'La IA no devolvió estructura de contenido válida.');
        return;
      }

      const generatedTitle =
        selectedTool === 'activity'
          ? (data.payload as AiCreativeActivity).name
          : (data.payload as { title?: string }).title || 'Recurso generado con IA';
      const generatedTheme =
        (data.payload as { centralTheme?: string; theme?: string; generalTheme?: string }).centralTheme ||
        (data.payload as { theme?: string }).theme ||
        (data.payload as { generalTheme?: string }).generalTheme ||
        generatedTitle;

      setActiveItem({
        kind: selectedTool,
        title: generatedTitle,
        theme: generatedTheme,
        eventType:
          selectedTool === 'program'
            ? (data.payload as AiCreativeProgram).eventType
            : CREATIVE_TOOL_META[selectedTool].shortLabel,
        scheduledDate:
          selectedTool === 'program'
            ? (data.payload as AiCreativeProgram).scheduledDate
            : progDate,
        status: 'draft',
        payload: data.payload,
        versions: [],
        currentVersion: 0,
      });

      setActiveTab('editor');
      notify(
        'ok',
        `Generado realmente con ${data.modelUsed || 'Gemini'} en ${(result.latencyMs / 1000).toFixed(1)} s. Revísalo, edítalo y guárdalo.`
      );
    } finally {
      setGeneratingTool(false);
    }
  };

  const handleGeneratePresentationFromItem = async (source: ActiveWorkspaceItem) => {
    setGeneratingTool(true);
    setNotice(null);
    try {
      const result = await monitoredFetchJson<{
        payload?: CreativePayloadUnion;
      }>(
        '/api/ia-creativa/generate/presentation',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: `${source.title} — ${source.theme}`,
            slideCount: 9,
            sourceRecordId: source.recordId,
          }),
        },
        'generate_presentation',
        52000
      );
      if (!result.ok || !result.data.payload) {
        if (!result.ok) {
          notify(
            'err',
            `[${ERROR_CATEGORY_LABELS[result.event.errorCategory]}] ${result.event.friendlyMessage}`
          );
        }
        return;
      }
      setActiveItem({
        kind: 'presentation',
        title: (result.data.payload as { title?: string }).title || `Presentación: ${source.title}`,
        theme: source.theme,
        eventType: 'Presentación',
        scheduledDate: source.scheduledDate,
        status: 'draft',
        payload: result.data.payload,
        versions: [],
        currentVersion: 0,
      });
      setActiveTab('editor');
      notify('ok', 'Presentación editable creada a partir de tu recurso.');
    } finally {
      setGeneratingTool(false);
    }
  };

  const handleSendChat = async (customText?: string) => {
    const msg = (customText ?? chatInput).trim();
    if (!msg) return;
    setNotice(null);
    setSendingChat(true);
    if (!customText) setChatInput('');

    try {
      const result = await monitoredFetchJson<{
        session?: AiCreativeChatSession;
        reply?: AiCreativeChatSession['messages'][number];
      }>(
        '/api/ia-creativa/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: activeChatId || undefined,
            message: msg,
            activeRecordId: activeItem?.recordId,
            activeContextKind: activeItem?.kind,
            activeContextPayload: activeItem?.payload,
          }),
        },
        'chat',
        52000
      );
      if (!result.ok || !result.data.session) {
        if (!result.ok) {
          notify(
            'err',
            `[${ERROR_CATEGORY_LABELS[result.event.errorCategory]}] ${result.event.friendlyMessage}`
          );
        }
        return;
      }

      const nextSession = result.data.session;
      setChatSessions((prev) => {
        const filtered = prev.filter((s) => s.id !== nextSession.id);
        return [nextSession, ...filtered];
      });
      setActiveChatId(nextSession.id);

      // If AI updated the currently open program in-place, sync activeItem automatically!
      const reply = result.data.reply;
      if (
        reply?.structuredArtifact &&
        reply.resourceAction === 'update_program' &&
        activeItem?.kind === 'program'
      ) {
        setActiveItem({
          ...activeItem,
          title: reply.structuredArtifact.title,
          theme: reply.structuredArtifact.theme,
          payload: JSON.parse(
            JSON.stringify(reply.structuredArtifact.payload)
          ) as CreativePayloadUnion,
        });
      }
    } finally {
      setSendingChat(false);
    }
  };

  const handleGenerateImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imgPrompt.trim()) {
      notify('err', 'Escribe una descripción de la imagen cristiana que deseas generar.');
      return;
    }
    setGeneratingImg(true);
    setNotice(null);
    try {
      const result = await monitoredFetchJson<{
        image?: AiCreativeImageRecord;
      }>(
        '/api/ia-creativa/images/generate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: imgPrompt.trim(),
            category: imgCategory,
            format: imgFormat,
            style: imgStyle,
            sourceImageId: imgEditSourceId || undefined,
            linkedRecordId: activeItem?.recordId,
          }),
        },
        'generate_image',
        62000
      );
      if (!result.ok || !result.data.image) {
        if (!result.ok) {
          notify(
            'err',
            `[${ERROR_CATEGORY_LABELS[result.event.errorCategory]}] ${result.event.friendlyMessage}`
          );
        }
        return;
      }
      setImages((prev) => [result.data.image!, ...prev]);
      setImgEditSourceId('');
      notify('ok', 'Imagen generada y guardada en tu galería de recursos visuales.');
    } finally {
      setGeneratingImg(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch('/api/ia-creativa/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const data = (await res.json()) as { profile?: CreativeAiProfile; error?: string };
      if (!res.ok || !data.profile) {
        notify('err', data.error || 'No se pudo guardar el perfil doctrinal.');
        return;
      }
      setProfile(data.profile);
      notify('ok', 'Perfil doctrinal e identidad ministerial actualizados.');
    } catch {
      notify('err', 'Error de red al guardar el perfil.');
    } finally {
      setSavingProfile(false);
    }
  };

  const filteredRecords = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return records.filter((r) => {
      if (historyKindFilter !== 'all' && r.kind !== historyKindFilter) return false;
      if (historyStatusFilter !== 'all' && r.status !== historyStatusFilter) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.theme.toLowerCase().includes(q) ||
        r.eventType.toLowerCase().includes(q) ||
        r.scheduledDate.toLowerCase().includes(q)
      );
    });
  }, [records, historyKindFilter, historyStatusFilter, historySearch]);

  const programOrSermonRecords = useMemo(
    () => records.filter((r) => r.kind === 'program' || r.kind === 'sermon'),
    [records]
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Module Header */}
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
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-amber-400">Ministerio Juvenil · Asistente Bíblico</span>
              <span className="text-slate-500">·</span>
              {status ? (
                status.geminiConfigured ? (
                  <span className="text-emerald-300 font-semibold">
                    IA conectada ({status.textModel})
                  </span>
                ) : (
                  <span className="text-amber-300 font-semibold">
                    Sin clave GEMINI_API_KEY configurada
                  </span>
                )
              ) : (
                <span className="text-slate-400">Verificando estado...</span>
              )}
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
              IA CREATIVA JUVENIL
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleTestRealConnection()}
            disabled={testingConnection}
            className="px-3.5 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/50 text-indigo-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {testingConnection ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Activity className="w-3.5 h-3.5" />
            )}
            Probar conexión IA
          </button>

          <button
            type="button"
            onClick={() => setMonitorOpen((v) => !v)}
            className={`px-3.5 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
              monitorEvents.some((e) => !e.ok)
                ? 'bg-rose-500/15 border-rose-400/50 text-rose-200'
                : 'bg-[#111A2E] hover:bg-slate-800 border-slate-800 text-slate-300'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Monitor ({monitorEvents.length})
          </button>

          <button
            type="button"
            onClick={() => void loadOverview()}
            disabled={loadingOverview}
            className="px-3.5 py-2 rounded-xl bg-[#111A2E] hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingOverview ? 'animate-spin' : ''}`} />
            Actualizar estado
          </button>
        </div>
      </div>

      {/* Real Connection & Error Monitoring Panel */}
      {monitorOpen && (
        <div className="bg-[#111A2E] border border-slate-700 rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display font-bold text-sm text-white">
                Sistema de Monitoreo y Diagnóstico Gemini API
              </h3>
              <p className="text-xs text-slate-400">
                Captura y clasifica errores HTTP 401, 403, 429, 500, tiempos agotados y fallas de red en tiempo real.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">
                Modelo texto: <strong className="text-slate-200">{status?.textModel || 'gemini-4-hydrogen'}</strong>
              </span>
              {monitorEvents.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMonitorEvents([])}
                  className="px-2.5 py-1 rounded-lg bg-[#080E1E] border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
                >
                  Limpiar registro
                </button>
              )}
            </div>
          </div>

          {status?.lastDiagnostic && (
            <div className="bg-[#080E1E] border border-slate-800 rounded-xl p-3 text-xs flex flex-wrap items-center justify-between gap-2">
              <span className="text-slate-300">
                Último estado del servidor:{' '}
                <strong className={status.lastDiagnostic.ok ? 'text-emerald-300' : 'text-rose-300'}>
                  {ERROR_CATEGORY_LABELS[status.lastDiagnostic.errorCategory]}
                </strong>{' '}
                · {status.lastDiagnostic.friendlyMessage}
              </span>
              <span className="text-slate-500 font-mono">
                {status.lastDiagnostic.latencyMs} ms
              </span>
            </div>
          )}

          {monitorEvents.length === 0 ? (
            <p className="text-xs text-slate-500">
              No se han registrado eventos en esta sesión. Pulsa &quot;Probar conexión IA&quot; o envía una solicitud.
            </p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {monitorEvents.map((ev) => (
                <div
                  key={ev.id}
                  className={`rounded-xl p-2.5 border text-xs flex flex-wrap items-start justify-between gap-2 ${
                    ev.ok
                      ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-100'
                      : 'bg-rose-500/10 border-rose-400/35 text-rose-100'
                  }`}
                >
                  <div className="space-y-0.5 flex-1 min-w-[240px]">
                    <div className="flex flex-wrap items-center gap-2 font-bold">
                      <span>{ERROR_CATEGORY_LABELS[ev.errorCategory]}</span>
                      <span className="text-slate-400 font-normal">· {ev.operation}</span>
                      {ev.httpStatus > 0 && (
                        <span className="font-mono text-[11px] text-slate-300">
                          HTTP {ev.httpStatus}
                        </span>
                      )}
                    </div>
                    <p>{ev.friendlyMessage}</p>
                    {ev.technicalHint && (
                      <p className="text-[11px] text-slate-400 font-mono">
                        Detalle: {ev.technicalHint}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-[11px] text-slate-400 font-mono shrink-0">
                    <div>{new Date(ev.timestamp).toLocaleTimeString()}</div>
                    <div>{ev.latencyMs} ms</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Real Configuration Notice if GEMINI_API_KEY missing */}
      {status && !status.geminiConfigured && (
        <div className="bg-amber-500/10 border border-amber-400/45 rounded-2xl p-4 flex items-start gap-3 text-xs sm:text-sm text-amber-100">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-amber-300">
              Se requiere configurar la clave de Gemini API en el entorno del servidor
            </p>
            <p>
              {status.statusMessage} Mientras no esté configurada la variable <code className="font-mono text-amber-200">GEMINI_API_KEY</code> en <strong>Settings &gt; Secrets</strong>, el historial guardado, editor manual y exportación de archivos siguen disponibles, pero la generación con IA mostrará este aviso sin simular respuestas.
            </p>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 bg-[#111A2E] border border-slate-800 p-1.5 rounded-2xl">
        {(
          [
            ['chat', 'Asistente IA (Lenguaje Libre)', MessageSquare],
            ['tools', 'Crear por Categoría', Wand2],
            ['editor', activeItem ? `Editor (${activeItem.title.slice(0, 18)}${activeItem.title.length > 18 ? '…' : ''})` : 'Editor', Edit3],
            ['images', `Imágenes (${images.length})`, ImageIcon],
            ['history', `Historial (${records.length})`, History],
            ['profile', 'Perfil Doctrinal', Settings],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors ${
              activeTab === key
                ? 'bg-amber-400 text-slate-950'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Global Notification Banner */}
      {notice && (
        <div
          className={`rounded-2xl px-4 py-3.5 text-sm flex flex-wrap items-start justify-between gap-3 border ${
            notice.type === 'ok'
              ? 'bg-emerald-500/15 border-emerald-400/45 text-emerald-100'
              : 'bg-rose-500/15 border-rose-400/45 text-rose-100'
          }`}
        >
          <div className="flex items-start gap-3 flex-1 min-w-[220px]">
            {notice.type === 'ok' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            )}
            <span className="flex-1">{notice.text}</span>
          </div>
          {notice.type === 'err' && (
            <button
              type="button"
              onClick={() => setMonitorOpen(true)}
              className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-xs font-bold text-rose-100 cursor-pointer shrink-0"
            >
              Ver diagnóstico
            </button>
          )}
        </div>
      )}

      {/* TAB 1: CREATE BY CATEGORY */}
      {activeTab === 'tools' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Tool Category Sidebar */}
          <div className="lg:col-span-4 space-y-2.5">
            {(
              [
                ['program', CalendarDays],
                ['sermon', BookOpen],
                ['activity', Gamepad2],
                ['script', Theater],
                ['presentation', Layers],
                ['event', Sparkles],
                ['music', Music],
              ] as const
            ).map(([k, Icon]) => {
              const m = CREATIVE_TOOL_META[k];
              const active = selectedTool === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSelectedTool(k)}
                  className={`w-full text-left p-4 rounded-2xl border transition-colors cursor-pointer flex items-start gap-3 ${
                    active
                      ? 'bg-[#162340] border-amber-400/75 text-white'
                      : 'bg-[#111A2E] border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${active ? 'text-amber-400' : 'text-sky-400'}`} />
                  <div className="space-y-0.5">
                    <p className="font-display font-bold text-sm text-white">{m.label}</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{m.description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Tool Parameter Form */}
          <form
            onSubmit={handleGenerateTool}
            className="lg:col-span-8 bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-5"
          >
            <div className="space-y-1">
              <h2 className="font-display font-extrabold text-xl text-white">
                {CREATIVE_TOOL_META[selectedTool].label}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                {CREATIVE_TOOL_META[selectedTool].description}
              </p>
            </div>

            {selectedTool === 'program' && (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Duración exacta</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {([60, 90, 120] as const).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setProgDuration(d)}
                          className={`py-2 rounded-xl font-mono-num text-xs font-bold border cursor-pointer ${
                            progDuration === d
                              ? 'bg-amber-400 text-slate-950 border-amber-300'
                              : 'bg-[#080E1E] text-slate-300 border-slate-700'
                          }`}
                        >
                          {d}m
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Fecha prevista</label>
                    <input
                      type="date"
                      value={progDate}
                      onChange={(e) => setProgDate(e.target.value)}
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Participantes aprox.</label>
                    <input
                      type="number"
                      min={4}
                      max={1000}
                      value={progParticipants}
                      onChange={(e) => setProgParticipants(Number(e.target.value) || 30)}
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono-num"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Tipo de encuentro</label>
                  <input
                    type="text"
                    value={progEventType}
                    onChange={(e) => setProgEventType(e.target.value)}
                    placeholder="Sociedad de Jóvenes, Sábado Especial, Culto Juvenil..."
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Tema o solicitud del director</label>
                  <textarea
                    rows={3}
                    value={progTopic}
                    onChange={(e) => setProgTopic(e.target.value)}
                    placeholder="Ej: Los jóvenes valientes de la Biblia (Daniel y sus amigos), o La fe frente a la ansiedad universitaria..."
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-slate-500"
                  />
                </div>

                <label className="flex items-start gap-2.5 bg-[#080E1E] border border-slate-800 rounded-xl p-3.5 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={progAllInclusive}
                    onChange={(e) => setProgAllInclusive(e.target.checked)}
                    className="mt-0.5 accent-amber-400"
                  />
                  <span>
                    <strong className="text-amber-300 block">Paquete Completo con Todo Incluido (19 apartados)</strong>
                    <span className="text-slate-400">
                      Genera título, lema, textos, guion maestro del presentador, los 13 bloques paso a paso, preguntas para el público, reflexión desarrollada, materiales, sugerencias visuales, esquema de presentación y desafío semanal.
                    </span>
                  </span>
                </label>
              </div>
            )}

            {selectedTool === 'sermon' && (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Tipo de mensaje</label>
                    <select
                      value={sermonType}
                      onChange={(e) => setSermonType(e.target.value as SermonFormatType)}
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
                    >
                      <option value="sermon_juvenil">Sermón juvenil</option>
                      <option value="reflexion_corta">Reflexión corta</option>
                      <option value="meditacion">Meditación</option>
                      <option value="mensaje_evangelistico">Mensaje evangelístico</option>
                      <option value="devocional">Devocional</option>
                      <option value="estudio_biblico">Estudio bíblico</option>
                      <option value="llamado_espiritual">Llamado espiritual</option>
                      <option value="semana_oracion">Tema semana de oración</option>
                      <option value="mensaje_campana">Mensaje para campaña</option>
                      <option value="bosquejo_jovenes">Bosquejo predicador joven</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Duración (min)</label>
                    <input
                      type="number"
                      min={5}
                      max={90}
                      value={sermonDuration}
                      onChange={(e) => setSermonDuration(Number(e.target.value) || 20)}
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono-num"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Profundidad</label>
                    <select
                      value={sermonDepth}
                      onChange={(e) => setSermonDepth(e.target.value as 'breve' | 'intermedia' | 'profunda')}
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
                    >
                      <option value="breve">Breve</option>
                      <option value="intermedia">Intermedia</option>
                      <option value="profunda">Profunda (expositiva)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Pasaje bíblico sugerido (opcional)</label>
                  <input
                    type="text"
                    value={sermonBiblePref}
                    onChange={(e) => setSermonBiblePref(e.target.value)}
                    placeholder="Ej: Josué 1:9, Salmos 23, Filipenses 4:6-8..."
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Tema o necesidad espiritual</label>
                  <textarea
                    rows={3}
                    value={sermonTopic}
                    onChange={(e) => setSermonTopic(e.target.value)}
                    placeholder="Ej: Cómo tomar decisiones sabias según la voluntad de Dios en la juventud..."
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm"
                  />
                </div>
              </div>
            )}

            {selectedTool === 'activity' && (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Categoría</label>
                    <select
                      value={actCategory}
                      onChange={(e) => setActCategory(e.target.value as ActivityCategoryType)}
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
                    >
                      <option value="rompehielos">Rompehielos</option>
                      <option value="integracion">Integración</option>
                      <option value="juegos_biblicos">Juegos bíblicos</option>
                      <option value="retos_equipos">Retos por equipos</option>
                      <option value="dramatizaciones">Dramatizaciones</option>
                      <option value="memoria">Juegos de memoria</option>
                      <option value="competencias">Competencias</option>
                      <option value="misioneras">Actividades misioneras</option>
                      <option value="reflexion">Actividades de reflexión</option>
                      <option value="liderazgo">Dinámicas de liderazgo</option>
                      <option value="grupos_pequenos">Grupos pequeños</option>
                      <option value="grupos_numerosos">Grupos numerosos</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Participantes</label>
                    <input
                      type="text"
                      value={actParticipants}
                      onChange={(e) => setActParticipants(e.target.value)}
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Duración (min)</label>
                    <input
                      type="number"
                      min={3}
                      max={90}
                      value={actDuration}
                      onChange={(e) => setActDuration(Number(e.target.value) || 15)}
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono-num"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Enfoque bíblico o propósito</label>
                  <textarea
                    rows={3}
                    value={actTopic}
                    onChange={(e) => setActTopic(e.target.value)}
                    placeholder="Ej: Dinámica sobre trabajo en equipo como el cuerpo de Cristo (1 Corintios 12)..."
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm"
                  />
                </div>
              </div>
            )}

            {selectedTool === 'script' && (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Formato del guion</label>
                    <select
                      value={scriptType}
                      onChange={(e) => setScriptType(e.target.value as ScriptFormatType)}
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
                    >
                      <option value="drama_biblico">Drama bíblico</option>
                      <option value="representacion_teatral">Representación teatral</option>
                      <option value="entrevista_ficticia">Entrevista a personaje bíblico</option>
                      <option value="conversacion_personajes">Conversación entre personajes</option>
                      <option value="presentacion_especial">Presentación especial</option>
                      <option value="apertura_programa">Apertura de programa</option>
                      <option value="cierre_programa">Cierre de programa</option>
                      <option value="video_juvenil">Guion para video juvenil</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Actores / Participantes</label>
                    <input
                      type="number"
                      min={1}
                      max={25}
                      value={scriptParticipants}
                      onChange={(e) => setScriptParticipants(Number(e.target.value) || 4)}
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono-num"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Duración (min)</label>
                    <input
                      type="number"
                      min={2}
                      max={45}
                      value={scriptDuration}
                      onChange={(e) => setScriptDuration(Number(e.target.value) || 10)}
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono-num"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Historia o mensaje</label>
                  <textarea
                    rows={3}
                    value={scriptTopic}
                    onChange={(e) => setScriptTopic(e.target.value)}
                    placeholder="Ej: Entrevista creativa a Nehemías sobre reconstruir con perseverancia..."
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm"
                  />
                </div>
              </div>
            )}

            {selectedTool === 'presentation' && (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Cantidad de diapositivas</label>
                    <input
                      type="number"
                      min={6}
                      max={14}
                      value={presSlides}
                      onChange={(e) => setPresSlides(Number(e.target.value) || 8)}
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono-num"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Basar en un contenido guardado (opcional)</label>
                    <select
                      value={presSourceId}
                      onChange={(e) => setPresSourceId(e.target.value)}
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
                    >
                      <option value="">Crear desde tema libre</option>
                      {programOrSermonRecords.map((r) => (
                        <option key={r.id} value={r.id}>
                          [{r.kind}] {r.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Tema o título de la presentación</label>
                  <textarea
                    rows={3}
                    value={presTopic}
                    onChange={(e) => setPresTopic(e.target.value)}
                    placeholder="Ej: Identidad en Cristo para jóvenes universitarios (Efesios 2:10)..."
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm"
                  />
                </div>
              </div>
            )}

            {selectedTool === 'event' && (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Tipo de evento</label>
                    <select
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value as ChristianEventType)}
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
                    >
                      <option value="sociedad_jovenes">Sociedad de Jóvenes</option>
                      <option value="semana_oracion">Semana de oración</option>
                      <option value="campana_evangelistica">Campaña evangelística</option>
                      <option value="congreso_juvenil">Congreso juvenil</option>
                      <option value="retiro_espiritual">Retiro espiritual</option>
                      <option value="campamento">Campamento</option>
                      <option value="sabado_especial">Sábado especial</option>
                      <option value="semana_enfasis_juvenil">Semana de énfasis juvenil</option>
                      <option value="encuentro_lideres">Encuentro de líderes</option>
                      <option value="actividad_misionera">Actividad misionera</option>
                      <option value="celebracion_talentos">Celebración de talentos</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Asistentes estimados</label>
                    <input
                      type="number"
                      min={10}
                      max={2000}
                      value={eventParticipants}
                      onChange={(e) => setEventParticipants(Number(e.target.value) || 60)}
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono-num"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Tema y detalles del evento</label>
                  <textarea
                    rows={3}
                    value={eventTopic}
                    onChange={(e) => setEventTopic(e.target.value)}
                    placeholder="Ej: Retiro juvenil de fin de semana sobre restauración y misión..."
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={eventIncludeBudget}
                    onChange={(e) => setEventIncludeBudget(e.target.checked)}
                    className="accent-amber-400"
                  />
                  Incluir tabla de presupuesto estimado referencial
                </label>
              </div>
            )}

            {selectedTool === 'music' && (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Texto bíblico del programa</label>
                    <input
                      type="text"
                      value={musicBible}
                      onChange={(e) => setMusicBible(e.target.value)}
                      placeholder="Ej: Salmos 100:1-5"
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Estilo congregacional</label>
                    <input
                      type="text"
                      value={musicStyle}
                      onChange={(e) => setMusicStyle(e.target.value)}
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Tema central del culto o programa</label>
                  <textarea
                    rows={3}
                    value={musicTopic}
                    onChange={(e) => setMusicTopic(e.target.value)}
                    placeholder="Ej: Gratitud, esperanza en la segunda venida y consagración..."
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <p className="text-xs text-slate-400">
                Modelo servidor: <span className="font-mono text-slate-300">{status?.textModel || 'gemini-4-hydrogen'}</span> · Evita repetir historial reciente.
              </p>
              <button
                type="submit"
                disabled={generatingTool}
                className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 font-display font-extrabold text-sm inline-flex items-center gap-2 cursor-pointer"
              >
                {generatingTool ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generando con Gemini...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generar ahora
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: CHRISTIAN CONVERSATIONAL CHAT */}
      {activeTab === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4 bg-[#111A2E] border border-slate-800 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-sm text-white">Conversaciones</h3>
              <button
                type="button"
                onClick={() => setActiveChatId('')}
                className="px-2.5 py-1.5 rounded-lg bg-amber-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Nueva
              </button>
            </div>

            {activeItem && (
              <div className="bg-sky-500/10 border border-sky-400/35 rounded-xl p-3 text-xs space-y-1">
                <p className="font-bold text-sky-300">Contexto activo conectado al chat:</p>
                <p className="text-white font-semibold">{activeItem.title}</p>
                <p className="text-slate-400">Puedes pedir ajustes sobre este recurso sin empezar desde cero.</p>
              </div>
            )}

            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {chatSessions.length === 0 ? (
                <p className="text-xs text-slate-500">Aún no hay conversaciones guardadas.</p>
              ) : (
                chatSessions.map((s) => (
                  <div
                    key={s.id}
                    className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border text-xs cursor-pointer ${
                      s.id === activeChatId
                        ? 'bg-[#162340] border-amber-400/60 text-white'
                        : 'bg-[#080E1E] border-slate-800 text-slate-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveChatId(s.id)}
                      className="flex-1 text-left truncate cursor-pointer"
                    >
                      {s.title}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch(`/api/ia-creativa/chat/${encodeURIComponent(s.id)}`, {
                          method: 'DELETE',
                        });
                        setChatSessions((prev) => prev.filter((x) => x.id !== s.id));
                        if (activeChatId === s.id) setActiveChatId('');
                      }}
                      className="text-slate-500 hover:text-rose-400 cursor-pointer"
                      title="Eliminar conversación"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-800">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Solicitudes rápidas
              </p>
              {STARTER_CHAT_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={sendingChat}
                  onClick={() => void handleSendChat(p)}
                  className="w-full text-left px-3 py-2 rounded-xl bg-[#080E1E] hover:bg-slate-800 border border-slate-800 text-xs text-slate-200 cursor-pointer disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8 bg-[#111A2E] border border-slate-800 rounded-2xl p-5 flex flex-col h-[600px]">
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {!activeChatSession || activeChatSession.messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                  <MessageSquare className="w-10 h-10 text-amber-400" />
                  <h3 className="font-display font-bold text-lg text-white">
                    Asistente Conversacional de Ministerio Juvenil
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 max-w-md">
                    Escribe lo que necesitas en lenguaje natural. La IA recuerda tu programa abierto en el editor y tu historial reciente para proponerte ideas nuevas y bíblicas.
                  </p>
                </div>
              ) : (
                activeChatSession.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-2xl p-4 text-sm leading-relaxed space-y-3 ${
                      m.role === 'user'
                        ? 'bg-[#172542] border border-sky-400/30 text-white ml-8'
                        : 'bg-[#080E1E] border border-slate-800 text-slate-200 mr-4'
                    }`}
                  >
                    <p className="text-[11px] font-bold text-amber-300">
                      {m.role === 'user' ? 'Director' : `IA Creativa Juvenil (${m.modelUsed || 'Gemini'})`}
                    </p>
                    <div className="whitespace-pre-wrap">{m.text}</div>

                    {m.intentAnalysis && m.intentAnalysis.assumedDefaults?.length > 0 && (
                      <div className="bg-[#111A2E] border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300">
                        <span className="font-bold text-sky-300">Supuestos usados: </span>
                        {m.intentAnalysis.assumedDefaults.join(' · ')}
                      </div>
                    )}

                    {m.structuredArtifact && (
                      <div className="bg-[#111A2E] border border-amber-400/45 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-0.5 text-xs">
                          <p className="font-bold text-amber-300">
                            Recurso listo ({CREATIVE_TOOL_META[m.structuredArtifact.kind]?.shortLabel || m.structuredArtifact.kind}): {m.structuredArtifact.title}
                          </p>
                          <p className="text-slate-400">
                            Tema: {m.structuredArtifact.theme}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openArtifactInEditor(m.structuredArtifact!)}
                          className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Abrir en Editor Inteligente
                        </button>
                      </div>
                    )}

                    {m.suggestedImagePrompt && (
                      <div className="bg-[#111A2E] border border-indigo-400/40 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-slate-300 flex-1 min-w-[200px]">
                          <strong className="text-indigo-300">Prompt visual sugerido:</strong>{' '}
                          {m.suggestedImagePrompt}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setImgPrompt(m.suggestedImagePrompt!);
                            setActiveTab('images');
                          }}
                          className="px-3 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          Ir a Generador de Imágenes
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
              {sendingChat && (
                <div className="bg-[#080E1E] border border-slate-800 rounded-2xl p-4 text-xs text-sky-300 inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  IA Creativa Juvenil está redactando la respuesta...
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSendChat();
              }}
              className="pt-4 mt-3 border-t border-slate-800 flex gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ej: Prepara un programa juvenil sobre Daniel 1 para 40 jóvenes..."
                className="flex-1 bg-[#080E1E] border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                disabled={sendingChat || !chatInput.trim()}
                className="px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-display font-extrabold text-sm inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                Enviar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: SMART EDITOR */}
      {activeTab === 'editor' && (
        <IaCreativaEditorPanel
          item={activeItem}
          images={images}
          geminiConfigured={Boolean(status?.geminiConfigured)}
          onChangeItem={setActiveItem}
          onSavedRecord={(saved) => {
            setRecords((prev) => [saved, ...prev.filter((r) => r.id !== saved.id)]);
            openRecordInEditor(saved);
          }}
          onSentToSaturday={(satId, recId) => {
            if (activeItem) {
              setActiveItem({ ...activeItem, sentToSaturdayProgramId: satId });
            }
            if (recId) {
              setRecords((prev) =>
                prev.map((r) => (r.id === recId ? { ...r, sentToSaturdayProgramId: satId } : r))
              );
            }
          }}
          onOpenSaturdayProgram={onOpenSaturdayProgram}
          onGeneratePresentationFromItem={handleGeneratePresentationFromItem}
          onPrefillImageGenerator={(suggestedPrompt) => {
            setImgPrompt(suggestedPrompt);
            setActiveTab('images');
          }}
          onCreatedMultiplayerRoom={onCreatedMultiplayerRoom}
          onNotify={notify}
        />
      )}

      {/* TAB 4: CHRISTIAN IMAGE GENERATOR */}
      {activeTab === 'images' && (
        <div className="space-y-6">
          {/* Truthful Image Integration Status */}
          <div className="bg-[#111A2E] border border-amber-400/40 rounded-2xl p-4 flex items-start gap-3 text-xs sm:text-sm text-amber-100">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-amber-300">
                Estado del Servicio de Generación de Imágenes ({status?.imageModel || 'gemini-3.1-flash-lite-image'})
              </p>
              <p>
                {status?.imageStatusMessage ||
                  'Requiere GEMINI_API_KEY con facturación habilitada en Settings > Secrets para generar imágenes reales. Nunca se muestran imágenes de muestra como si fueran generadas por IA.'}
              </p>
            </div>
          </div>

          <form
            onSubmit={handleGenerateImage}
            className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display font-bold text-xl text-white">
                {imgEditSourceId ? 'Modificar Imagen Existente con IA' : 'Generador de Imágenes Cristianas'}
              </h2>
              {imgEditSourceId && (
                <button
                  type="button"
                  onClick={() => setImgEditSourceId('')}
                  className="text-xs font-bold text-amber-300 cursor-pointer"
                >
                  Cancelar modificación y crear nueva
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="text-slate-400 font-semibold block mb-1">Tipo de recurso visual</label>
                <select
                  value={imgCategory}
                  onChange={(e) => setImgCategory(e.target.value as CreativeImageCategory)}
                  className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="afiche_juvenil">Afiche juvenil</option>
                  <option value="invitacion">Invitación</option>
                  <option value="portada_programa">Portada de programa</option>
                  <option value="fondo_proyector">Fondo para proyector</option>
                  <option value="historia_biblica">Historia bíblica (ilustrada)</option>
                  <option value="ilustracion_educativa">Ilustración educativa</option>
                  <option value="recurso_predicacion">Recurso para predicación</option>
                  <option value="banner_evento">Banner para evento</option>
                  <option value="redes_sociales">Imagen redes sociales</option>
                  <option value="fondo_presentacion">Fondo para presentaciones</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 font-semibold block mb-1">Formato</label>
                <select
                  value={imgFormat}
                  onChange={(e) => setImgFormat(e.target.value as CreativeImageFormat)}
                  className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="16:9">16:9 (Proyector / Banner)</option>
                  <option value="1:1">1:1 (Redes / Cuadrado)</option>
                  <option value="9:16">9:16 (Historia / Invitación móvil)</option>
                  <option value="4:3">4:3 (Diapositiva / Tarjeta)</option>
                  <option value="3:4">3:4 (Afiche vertical)</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 font-semibold block mb-1">Estilo visual</label>
                <select
                  value={imgStyle}
                  onChange={(e) => setImgStyle(e.target.value as CreativeImageStyle)}
                  className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="diseno_moderno_juvenil">Diseño moderno juvenil</option>
                  <option value="ilustracion_biblica">Ilustración bíblica</option>
                  <option value="realismo_cinematografico">Realismo cinematográfico</option>
                  <option value="fotografia_eventos">Fotografía de eventos</option>
                  <option value="arte_digital">Arte digital</option>
                  <option value="diseno_minimalista">Diseño minimalista</option>
                  <option value="estilo_editorial">Estilo editorial</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Descripción detallada de la imagen</label>
              <textarea
                rows={3}
                value={imgPrompt}
                onChange={(e) => setImgPrompt(e.target.value)}
                placeholder="Ej: Fondo limpio y luminoso para proyector de Sociedad de Jóvenes sobre un camino hacia la luz al amanecer en la montaña, espacio amplio para texto..."
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={generatingImg}
                className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-display font-extrabold text-sm inline-flex items-center gap-2 cursor-pointer"
              >
                {generatingImg ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generando imagen real...
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-4 h-4" />
                    {imgEditSourceId ? 'Aplicar modificación visual' : 'Generar imagen'}
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Saved Real Generated Images Gallery */}
          {images.length === 0 ? (
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-8 text-center text-sm text-slate-400">
              Aún no se han generado imágenes en este proyecto. Cuando tu clave Gemini con facturación esté activa, todas las imágenes reales generadas aparecerán aquí listas para descargar o insertar en tus presentaciones.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {images.map((im) => (
                <div
                  key={im.id}
                  className="bg-[#111A2E] border border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between"
                >
                  <img
                    src={im.imageUrl}
                    alt={im.prompt}
                    referrerPolicy="no-referrer"
                    className="w-full h-52 object-cover bg-[#080E1E]"
                  />
                  <div className="p-4 space-y-2 text-xs">
                    <p className="text-slate-400">
                      {im.category.replace(/_/g, ' ')} · {im.format} · {im.style.replace(/_/g, ' ')}
                    </p>
                    <p className="text-slate-200 line-clamp-2">{im.prompt}</p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <a
                        href={im.imageUrl}
                        download={`${im.id}.png`}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold inline-flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Descargar
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          setImgEditSourceId(im.id);
                          setImgPrompt(`Sobre esta imagen, ajusta: `);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-sky-500/20 text-sky-200 font-bold cursor-pointer"
                      >
                        Modificar
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch(`/api/ia-creativa/images/${encodeURIComponent(im.id)}`, {
                            method: 'DELETE',
                          });
                          setImages((prev) => prev.filter((x) => x.id !== im.id));
                        }}
                        className="p-1.5 rounded-lg bg-rose-500/15 text-rose-300 cursor-pointer ml-auto"
                        title="Eliminar imagen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: HISTORY & SAVED LIBRARY */}
      {activeTab === 'history' && (
        <div className="space-y-5">
          <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Buscar por tema, título, fecha o tipo de evento..."
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl pl-10 pr-3 py-2 text-sm text-white"
              />
            </div>

            <select
              value={historyKindFilter}
              onChange={(e) => setHistoryKindFilter(e.target.value as 'all' | CreativeToolKind)}
              className="bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
            >
              <option value="all">Todas las categorías</option>
              {(Object.keys(CREATIVE_TOOL_META) as CreativeToolKind[]).map((k) => (
                <option key={k} value={k}>
                  {CREATIVE_TOOL_META[k].shortLabel}
                </option>
              ))}
            </select>

            <select
              value={historyStatusFilter}
              onChange={(e) => setHistoryStatusFilter(e.target.value as 'all' | 'draft' | 'final')}
              className="bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
            >
              <option value="all">Todos los estados</option>
              <option value="final">Versiones definitivas</option>
              <option value="draft">Borradores</option>
            </select>
          </div>

          {filteredRecords.length === 0 ? (
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-10 text-center space-y-2 text-sm text-slate-400">
              <FileText className="w-9 h-9 text-amber-400 mx-auto" />
              <p className="font-bold text-white text-base">
                {records.length === 0
                  ? 'Aún no hay contenido guardado en el historial de IA Creativa'
                  : 'Ningún recurso coincide con tu filtro'}
              </p>
              <p>Genera un programa, predicación, dinámica, guion o presentación y guárdalo para consultarlo aquí cuando quieras.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRecords.map((rec) => (
                <article
                  key={rec.id}
                  className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                      <span className="font-bold text-amber-300">
                        {CREATIVE_TOOL_META[rec.kind].shortLabel}
                      </span>
                      <span className="font-mono-num">
                        {rec.scheduledDate} · v{rec.currentVersion} ·{' '}
                        <span className={rec.status === 'final' ? 'text-emerald-300' : 'text-amber-300'}>
                          {rec.status === 'final' ? 'Definitivo' : 'Borrador'}
                        </span>
                      </span>
                    </div>
                    <h3 className="font-display font-bold text-lg text-white">{rec.title}</h3>
                    <p className="text-xs text-sky-300">Tema: {rec.theme}</p>
                    <p className="text-xs text-slate-400">
                      <Calendar className="w-3.5 h-3.5 inline mr-1" />
                      {rec.eventType}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => openRecordInEditor(rec)}
                      className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Abrir en Editor
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        await fetch(`/api/ia-creativa/records/${encodeURIComponent(rec.id)}`, {
                          method: 'DELETE',
                        });
                        setRecords((prev) => prev.filter((x) => x.id !== rec.id));
                        if (activeItem?.recordId === rec.id) setActiveItem(null);
                      }}
                      className="p-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 cursor-pointer"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: DOCTRINAL & MINISTRY PROFILE */}
      {activeTab === 'profile' && (
        <form
          onSubmit={handleSaveProfile}
          className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-5 max-w-3xl"
        >
          <div className="space-y-1">
            <h2 className="font-display font-bold text-xl text-white inline-flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              Perfil Doctrinal e Identidad de la Iglesia
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Personaliza la tradición cristiana, versión bíblica y público juvenil. Si no eliges una denominación específica, la IA usará un enfoque cristiano bíblico general y señalará puntos doctrinales para revisión del director.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Nombre de la iglesia o ministerio (opcional)</label>
              <input
                type="text"
                value={profile.churchName}
                onChange={(e) => setProfile({ ...profile, churchName: e.target.value })}
                placeholder="Ej: Sociedad de Jóvenes Central"
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Tradición doctrinal</label>
              <select
                value={profile.denominationalTradition}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    denominationalTradition: e.target.value as DoctrinalTradition,
                  })
                }
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm"
              >
                {DOCTRINAL_TRADITIONS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Versión bíblica preferida</label>
              <select
                value={profile.bibleTranslation}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    bibleTranslation: e.target.value as BibleTranslationPreference,
                  })
                }
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm"
              >
                <option value="RVR1960">Reina-Valera 1960 (RVR1960)</option>
                <option value="NVI">Nueva Versión Internacional (NVI)</option>
                <option value="NTV">Nueva Traducción Viviente (NTV)</option>
                <option value="LBLA">La Biblia de las Américas (LBLA)</option>
                <option value="General">General (citar libro y capítulo/versículo)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Público juvenil</label>
              <input
                type="text"
                value={profile.youthAgeGroup}
                onChange={(e) => setProfile({ ...profile, youthAgeGroup: e.target.value })}
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-400 block mb-1">Énfasis o notas doctrinales adicionales (opcional)</label>
              <textarea
                rows={3}
                value={profile.customTraditionNotes}
                onChange={(e) => setProfile({ ...profile, customTraditionNotes: e.target.value })}
                placeholder="Ej: Enfoque cristocéntrico con reverencia en alabanza y participación misionera sabatina..."
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-sm inline-flex items-center gap-2 cursor-pointer"
          >
            {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar perfil doctrinal
          </button>
        </form>
      )}
    </div>
  );
}
