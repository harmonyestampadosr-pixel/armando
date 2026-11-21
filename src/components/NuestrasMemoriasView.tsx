import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArrowLeft,
  Award,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  FolderHeart,
  ImagePlus,
  Images,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Share2,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
  Unlock,
  Users,
  X,
} from 'lucide-react';
import {
  anonymizeDisplayName,
  formatMemoryDateEs,
  isPhotoPubliclyAllowed,
  type MemoryChampionshipSummary,
  type MemoryEditAccess,
  type MemoryGlobalSettings,
  type MemoryParticipationStats,
  type MemoryPhotoItem,
  type MemoryPlatformRecognitionSummary,
  type MemoryShareAccess,
  type MemoryViewAccess,
  type SaturdayMemoryRecord,
  type SharedMemoryPublicView,
} from '../shared/memoriesData';
import { exportMemoryToPdf } from '../utils/memoryPdfExport';
import { MemoryEditorModal } from './MemoryEditorModal';

interface NuestrasMemoriasViewProps {
  onBack: () => void;
  sharedToken?: string;
}

type MemoriasTab =
  | 'archivo'
  | 'album'
  | 'campeonatos'
  | 'participacion'
  | 'privacidad';

interface OverviewPayload {
  accessDenied: boolean;
  requiredAccess?: MemoryViewAccess;
  role: 'admin' | 'member' | 'public';
  canEdit: boolean;
  canShare: boolean;
  settings: MemoryGlobalSettings;
  memories: SaturdayMemoryRecord[];
  championships: MemoryChampionshipSummary[];
  recognitions: MemoryPlatformRecognitionSummary[];
  stats: MemoryParticipationStats;
}

const ADMIN_TOKEN_KEY = 'dtqd_memories_admin_token';
const MEMBER_TOKEN_KEY = 'dtqd_memories_member_token';

const MONTH_NAMES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const WEEKDAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function readStorage(key: string): string {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function writeStorage(key: string, val: string): void {
  try {
    if (val) localStorage.setItem(key, val);
    else localStorage.removeItem(key);
  } catch {
    // ignore storage errors
  }
}

function resolvePhotoSrc(
  baseUrl: string,
  adminToken: string,
  memberToken: string
): string {
  if (!baseUrl) return '';
  if (baseUrl.includes('?')) return baseUrl;
  if (adminToken) return `${baseUrl}?at=${encodeURIComponent(adminToken)}`;
  if (memberToken) return `${baseUrl}?mt=${encodeURIComponent(memberToken)}`;
  return baseUrl;
}

async function compressImageFileToDataUrl(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      el.src = objectUrl;
    });

    const maxSide = 1280;
    const scale = Math.min(
      1,
      maxSide / Math.max(img.naturalWidth || 1, img.naturalHeight || 1)
    );
    const w = Math.max(1, Math.round((img.naturalWidth || 800) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || 600) * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Error de canvas al comprimir imagen.');
    ctx.drawImage(img, 0, 0, w, h);

    let quality = 0.82;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    while (dataUrl.length > 520_000 && quality > 0.45) {
      quality -= 0.12;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function NuestrasMemoriasView({
  onBack,
  sharedToken,
}: NuestrasMemoriasViewProps) {
  const [adminToken, setAdminToken] = useState<string>(() =>
    readStorage(ADMIN_TOKEN_KEY)
  );
  const [memberToken, setMemberToken] = useState<string>(() =>
    readStorage(MEMBER_TOKEN_KEY)
  );

  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);

  // Shared public view mode when ?memoria=<token> or /memorias/<token>
  const [sharedView, setSharedView] = useState<SharedMemoryPublicView | null>(
    null
  );
  const [sharedError, setSharedError] = useState<string | null>(null);
  const [sharedLoading, setSharedLoading] = useState(Boolean(sharedToken));

  // Navigation & filters
  const [activeTab, setActiveTab] = useState<MemoriasTab>('archivo');
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>('');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Live screen quick privacy mask (useful when projecting!)
  const [quickHideIdentities, setQuickHideIdentities] = useState(false);

  // Modals & forms
  const [showAuthModal, setShowAuthModal] = useState<'admin' | 'member' | null>(
    null
  );
  const [pinInput, setPinInput] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [editorState, setEditorState] = useState<{
    open: boolean;
    memory: SaturdayMemoryRecord | null;
    initialDate?: string;
  }>({ open: false, memory: null });

  const [shareModalMemory, setShareModalMemory] =
    useState<SaturdayMemoryRecord | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [exportingPdfId, setExportingPdfId] = useState<string | null>(null);

  // Photo upload & lightbox
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoIncludesMinors, setPhotoIncludesMinors] = useState(false);
  const [photoGuardianConsent, setPhotoGuardianConsent] = useState(false);
  const [photoAutoAuthorize, setPhotoAutoAuthorize] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<{
    photo: MemoryPhotoItem;
    memoryTitle: string;
    memoryDate: string;
  } | null>(null);
  const [albumMemoryFilter, setAlbumMemoryFilter] = useState<string>('all');

  // Privacy Settings form state (admin)
  const [settingsForm, setSettingsForm] = useState<{
    viewAccess: MemoryViewAccess;
    editAccess: MemoryEditAccess;
    shareAccess: MemoryShareAccess;
    hideNamesByDefault: boolean;
    hidePhotosByDefault: boolean;
    requireMinorGuardianConsent: boolean;
    memberViewCode: string;
    newAdminPin: string;
  }>({
    viewAccess: 'public',
    editAccess: 'admins_only',
    shareAccess: 'admins_only',
    hideNamesByDefault: false,
    hidePhotosByDefault: false,
    requireMinorGuardianConsent: true,
    memberViewCode: '',
    newAdminPin: '',
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const authHeaders = useCallback(
    (aTok = adminToken, mTok = memberToken): Record<string, string> => {
      const h: Record<string, string> = {};
      if (aTok) h['x-memory-admin-token'] = aTok;
      if (mTok) h['x-memory-member-token'] = mTok;
      return h;
    },
    [adminToken, memberToken]
  );

  const showToastSuccess = (msg: string) => {
    setBannerError(null);
    setBannerSuccess(msg);
  };

  const showToastError = (msg: string) => {
    setBannerSuccess(null);
    setBannerError(msg);
  };

  // Load shared link if sharedToken prop is active
  useEffect(() => {
    if (!sharedToken) return;
    let active = true;
    setSharedLoading(true);
    setSharedError(null);
    fetch(`/api/memories/shared/${encodeURIComponent(sharedToken)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Enlace compartido no disponible.');
        }
        return data as SharedMemoryPublicView;
      })
      .then((data) => {
        if (active) setSharedView(data);
      })
      .catch((err) => {
        if (active) {
          setSharedError(
            err instanceof Error
              ? err.message
              : 'No se pudo cargar este resumen compartido.'
          );
        }
      })
      .finally(() => {
        if (active) setSharedLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sharedToken]);

  const loadOverview = useCallback(
    async (aTok = adminToken, mTok = memberToken) => {
      setLoading(true);
      try {
        const query = aTok ? '?includeArchived=1' : '';
        const res = await fetch(`/api/memories/overview${query}`, {
          headers: authHeaders(aTok, mTok),
        });
        const data = (await res.json()) as OverviewPayload;
        setOverview(data);
        if (data.settings) {
          setSettingsForm((prev) => ({
            ...prev,
            viewAccess: data.settings.viewAccess,
            editAccess: data.settings.editAccess,
            shareAccess: data.settings.shareAccess,
            hideNamesByDefault: data.settings.hideNamesByDefault,
            hidePhotosByDefault: data.settings.hidePhotosByDefault,
            requireMinorGuardianConsent:
              data.settings.requireMinorGuardianConsent,
          }));
        }
        const activeList = (data.memories || []).filter((m) => !m.isArchived);
        setSelectedMemoryId((prev) => {
          if (prev && activeList.some((m) => m.id === prev)) return prev;
          return activeList[0]?.id || null;
        });
      } catch {
        showToastError('No se pudo cargar el archivo de memorias.');
      } finally {
        setLoading(false);
      }
    },
    [adminToken, memberToken, authHeaders]
  );

  useEffect(() => {
    if (!sharedToken) {
      loadOverview();
    }
  }, [sharedToken, loadOverview]);

  const activeMemories = useMemo(
    () => (overview?.memories || []).filter((m) => !m.isArchived),
    [overview]
  );

  const archivedMemories = useMemo(
    () => (overview?.memories || []).filter((m) => Boolean(m.isArchived)),
    [overview]
  );

  const filteredMemories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeMemories.filter((m) => {
      if (selectedCalendarDate && m.date !== selectedCalendarDate) return false;
      if (dateFrom && m.date < dateFrom) return false;
      if (dateTo && m.date > dateTo) return false;
      if (!q) return true;
      const haystack = [
        m.date,
        m.title,
        m.theme,
        m.bibleText,
        m.directorName,
        m.dailyReflection,
        m.observations,
        ...m.activities.map((a) => a.title),
        ...m.teams.map((t) => t.name),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [activeMemories, searchQuery, dateFrom, dateTo, selectedCalendarDate]);

  const selectedMemory = useMemo(() => {
    if (!selectedMemoryId) return filteredMemories[0] || null;
    return (
      activeMemories.find((m) => m.id === selectedMemoryId) ||
      filteredMemories[0] ||
      null
    );
  }, [activeMemories, filteredMemories, selectedMemoryId]);

  // Calendar grid dates
  const memoriesByDate = useMemo(() => {
    const map = new Map<string, SaturdayMemoryRecord[]>();
    for (const m of activeMemories) {
      const list = map.get(m.date) || [];
      list.push(m);
      map.set(m.date, list);
    }
    return map;
  }, [activeMemories]);

  const calendarCells = useMemo(() => {
    const { year, month } = calendarMonth;
    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay(); // 0=Sun..6=Sat
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{
      isoDate: string | null;
      dayNum: number | null;
      isSaturday: boolean;
      count: number;
    }> = [];

    for (let i = 0; i < startWeekday; i++) {
      cells.push({ isoDate: null, dayNum: null, isSaturday: false, count: 0 });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(month + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      const isoDate = `${year}-${mm}-${dd}`;
      const weekday = new Date(year, month, d).getDay();
      const count = memoriesByDate.get(isoDate)?.length || 0;
      cells.push({
        isoDate,
        dayNum: d,
        isSaturday: weekday === 6,
        count,
      });
    }
    return cells;
  }, [calendarMonth, memoriesByDate]);

  const isAdmin = overview?.role === 'admin';
  const canEdit = Boolean(overview?.canEdit);
  const canShare = Boolean(overview?.canShare);
  const requireMinorConsent =
    overview?.settings?.requireMinorGuardianConsent !== false;

  const shouldHideNames = (mem?: SaturdayMemoryRecord | null) =>
    quickHideIdentities ||
    Boolean(
      !isAdmin &&
        (overview?.settings?.hideNamesByDefault || mem?.hideParticipantNames)
    );

  const shouldHidePhotos = (mem?: SaturdayMemoryRecord | null) =>
    quickHideIdentities ||
    Boolean(
      !isAdmin && (overview?.settings?.hidePhotosByDefault || mem?.hidePhotos)
    );

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAuthModal) return;
    setAuthSubmitting(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/memories/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: showAuthModal, pin: pinInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Clave incorrecta.');
        return;
      }
      if (data.role === 'admin') {
        writeStorage(ADMIN_TOKEN_KEY, data.token);
        setAdminToken(data.token);
        setShowAuthModal(null);
        setPinInput('');
        await loadOverview(data.token, memberToken);
        showToastSuccess('Modo administrador de memorias desbloqueado.');
      } else {
        writeStorage(MEMBER_TOKEN_KEY, data.token);
        setMemberToken(data.token);
        setShowAuthModal(null);
        setPinInput('');
        await loadOverview(adminToken, data.token);
        showToastSuccess('Acceso de miembros verificado.');
      }
    } catch {
      setAuthError('Error de conexión al verificar la clave.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogoutRole = async () => {
    writeStorage(ADMIN_TOKEN_KEY, '');
    writeStorage(MEMBER_TOKEN_KEY, '');
    setAdminToken('');
    setMemberToken('');
    await loadOverview('', '');
    showToastSuccess('Sesión de privilegios cerrada.');
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedMemory) return;
    e.target.value = '';

    if (
      photoIncludesMinors &&
      requireMinorConsent &&
      photoAutoAuthorize &&
      !photoGuardianConsent
    ) {
      showToastError(
        'Si la fotografía incluye menores, confirma primero la autorización de padres o representantes para autorizarla.'
      );
      return;
    }

    setUploadingPhoto(true);
    try {
      const dataUrl = await compressImageFileToDataUrl(file);
      const res = await fetch(
        `/api/memories/${encodeURIComponent(selectedMemory.id)}/photos`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(),
          },
          body: JSON.stringify({
            photoDataUrl: dataUrl,
            caption:
              photoCaption.trim() || `Recuerdo · ${selectedMemory.theme}`,
            includesMinors: photoIncludesMinors,
            guardianConsentConfirmed: photoGuardianConsent,
            authorized: isAdmin ? photoAutoAuthorize : false,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        showToastError(data.error || 'No se pudo subir la fotografía.');
        return;
      }
      setPhotoCaption('');
      setPhotoIncludesMinors(false);
      setPhotoGuardianConsent(false);
      await loadOverview();
      showToastSuccess(
        data.photo?.authorized
          ? 'Fotografía agregada y autorizada en el archivo.'
          : 'Fotografía subida como pendiente de autorización de administrador.'
      );
    } catch (err) {
      showToastError(
        err instanceof Error ? err.message : 'Error al procesar la imagen.'
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleTogglePhotoAuth = async (
    memoryId: string,
    photo: MemoryPhotoItem,
    patch: Partial<{
      authorized: boolean;
      includesMinors: boolean;
      guardianConsentConfirmed: boolean;
    }>
  ) => {
    try {
      const res = await fetch(
        `/api/memories/${encodeURIComponent(memoryId)}/photos/${encodeURIComponent(photo.id)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(),
          },
          body: JSON.stringify(patch),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        showToastError(data.error || 'No se pudo actualizar la autorización.');
        return;
      }
      await loadOverview();
      showToastSuccess('Estado de autorización actualizado.');
    } catch {
      showToastError('Error de conexión al actualizar la fotografía.');
    }
  };

  const handleDeletePhoto = async (memoryId: string, photoId: string) => {
    try {
      const res = await fetch(
        `/api/memories/${encodeURIComponent(memoryId)}/photos/${encodeURIComponent(photoId)}`,
        {
          method: 'DELETE',
          headers: authHeaders(),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToastError(data.error || 'No se pudo eliminar la fotografía.');
        return;
      }
      await loadOverview();
      showToastSuccess('Fotografía eliminada del archivo.');
    } catch {
      showToastError('Error al eliminar fotografía.');
    }
  };

  const handleExportPdf = async (mem: SaturdayMemoryRecord) => {
    setExportingPdfId(mem.id);
    try {
      await exportMemoryToPdf(mem, {
        hideNames: shouldHideNames(mem),
        hidePhotos: shouldHidePhotos(mem),
        requireMinorGuardianConsent: requireMinorConsent,
        adminToken: shouldHidePhotos(mem) ? undefined : adminToken,
        memberToken: shouldHidePhotos(mem) ? undefined : memberToken,
      });
      showToastSuccess('Memoria exportada en formato PDF.');
    } catch {
      showToastError('No se pudo generar el archivo PDF.');
    } finally {
      setExportingPdfId(null);
    }
  };

  const handleToggleShare = async (
    mem: SaturdayMemoryRecord,
    enabled: boolean,
    rotateToken = false
  ) => {
    try {
      const res = await fetch(
        `/api/memories/${encodeURIComponent(mem.id)}/share`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(),
          },
          body: JSON.stringify({ enabled, rotateToken }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        showToastError(data.error || 'No se pudo actualizar el enlace.');
        return;
      }
      await loadOverview();
      if (data.memory) {
        setShareModalMemory(data.memory as SaturdayMemoryRecord);
      }
      showToastSuccess(
        enabled
          ? 'Enlace autorizado habilitado para compartir.'
          : 'Enlace compartido desactivado.'
      );
    } catch {
      showToastError('Error de conexión al configurar el enlace compartido.');
    }
  };

  const handleArchiveMemory = async (mem: SaturdayMemoryRecord) => {
    try {
      const res = await fetch(
        `/api/memories/${encodeURIComponent(mem.id)}/archive`,
        {
          method: 'POST',
          headers: authHeaders(),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToastError(data.error || 'No se pudo archivar la memoria.');
        return;
      }
      await loadOverview();
      showToastSuccess(
        'Memoria movida al archivo histórico de recuperación (sin pérdida de datos).'
      );
    } catch {
      showToastError('Error al archivar la memoria.');
    }
  };

  const handleRestoreMemory = async (memId: string) => {
    try {
      const res = await fetch(
        `/api/memories/${encodeURIComponent(memId)}/restore`,
        {
          method: 'POST',
          headers: authHeaders(),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        showToastError(data.error || 'No se pudo recuperar la memoria.');
        return;
      }
      await loadOverview();
      setSelectedMemoryId(memId);
      setActiveTab('archivo');
      showToastSuccess('Memoria recuperada y restaurada en el archivo activo.');
    } catch {
      showToastError('Error al recuperar la memoria.');
    }
  };

  const handleRecoverToProgram = async (mem: SaturdayMemoryRecord) => {
    try {
      const nextSaturday = new Date().toISOString().slice(0, 10);
      const res = await fetch(
        `/api/memories/${encodeURIComponent(mem.id)}/recover-to-program`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(),
          },
          body: JSON.stringify({ scheduledDate: nextSaturday }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        showToastError(
          data.error || 'No se pudo recuperar en Programa del Sábado.'
        );
        return;
      }
      showToastSuccess(
        `Copia recuperada en "Programa del Sábado" como borrador (${data.program?.title || 'Nuevo borrador'}).`
      );
    } catch {
      showToastError('Error de conexión al recuperar el programa.');
    }
  };

  const handleSavePrivacySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch('/api/memories/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({
          viewAccess: settingsForm.viewAccess,
          editAccess: settingsForm.editAccess,
          shareAccess: settingsForm.shareAccess,
          hideNamesByDefault: settingsForm.hideNamesByDefault,
          hidePhotosByDefault: settingsForm.hidePhotosByDefault,
          requireMinorGuardianConsent: settingsForm.requireMinorGuardianConsent,
          ...(settingsForm.memberViewCode.trim().length >= 4
            ? { memberViewCode: settingsForm.memberViewCode.trim() }
            : {}),
          ...(settingsForm.newAdminPin.trim().length >= 4
            ? { newAdminPin: settingsForm.newAdminPin.trim() }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToastError(data.error || 'No se pudo guardar la configuración.');
        return;
      }
      let nextAdminToken = adminToken;
      if (data.newAdminToken) {
        nextAdminToken = data.newAdminToken;
        writeStorage(ADMIN_TOKEN_KEY, nextAdminToken);
        setAdminToken(nextAdminToken);
      }
      setSettingsForm((prev) => ({
        ...prev,
        memberViewCode: '',
        newAdminPin: '',
      }));
      await loadOverview(nextAdminToken, memberToken);
      showToastSuccess('Políticas de privacidad y acceso guardadas.');
    } catch {
      showToastError('Error al guardar la configuración de privacidad.');
    } finally {
      setSavingSettings(false);
    }
  };

  const copyText = (key: string, text: string) => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
      })
      .catch(() => {});
  };

  const buildShareSummaryText = (mem: SaturdayMemoryRecord) => {
    const hideN = shouldHideNames(mem);
    const lines = [
      `MEMORIA DE LA SOCIEDAD DE JÓVENES`,
      `Fecha: ${formatMemoryDateEs(mem.date)}`,
      `Programa: ${mem.title}`,
      `Tema: ${mem.theme}`,
      `Texto bíblico: ${mem.bibleText}${mem.bibleVerseQuote ? ` — "${mem.bibleVerseQuote}"` : ''}`,
      hideN ? 'Dirección: Sociedad de Jóvenes' : `Director: ${mem.directorName}`,
    ];
    if (mem.activities.length > 0) {
      lines.push(
        `Actividades (${mem.activities.length}): ${mem.activities.map((a) => a.title).join(', ')}`
      );
    }
    if (mem.gamesPlayed.length > 0) {
      lines.push(
        `Juegos (${mem.gamesPlayed.length}): ${mem.gamesPlayed.map((g) => g.title).join(', ')}`
      );
    }
    if (mem.challengesCompleted.length > 0) {
      lines.push(
        `Retos completados (${mem.challengesCompleted.length}): ${mem.challengesCompleted.map((c) => c.title).join(', ')}`
      );
    }
    if (mem.resultsSummary) {
      lines.push(`Resultados: ${mem.resultsSummary}`);
    }
    if (mem.dailyReflection) {
      lines.push(`Reflexión del día: ${mem.dailyReflection}`);
    }
    if (mem.sharingEnabled && mem.shareToken && typeof window !== 'undefined') {
      lines.push(
        `Enlace autorizado: ${window.location.origin}/?memoria=${mem.shareToken}`
      );
    }
    return lines.join('\n');
  };

  // ==================== SHARED PUBLIC VIEW RENDER ====================
  if (sharedToken) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white bg-[#111A2E] border border-white/10 hover:border-white/25 rounded-xl px-4 py-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            Ir al inicio
          </button>

          {sharedView && (
            <button
              type="button"
              onClick={() => handleExportPdf(sharedView.memory)}
              disabled={exportingPdfId === sharedView.memory.id}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl px-4 py-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {exportingPdfId === sharedView.memory.id
                ? 'Generando PDF...'
                : 'Descargar PDF'}
            </button>
          )}
        </div>

        {sharedLoading ? (
          <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-10 text-center text-slate-300">
            Cargando memoria autorizada...
          </div>
        ) : sharedError || !sharedView ? (
          <div className="bg-[#111A2E] border border-rose-400/30 rounded-2xl p-8 text-center space-y-3">
            <Lock className="w-10 h-10 text-rose-400 mx-auto" />
            <h2 className="font-display font-bold text-xl text-white">
              Resumen no disponible
            </h2>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              {sharedError ||
                'Este enlace ya no se encuentra autorizado para visualización pública.'}
            </p>
          </div>
        ) : (
          <div className="bg-[#111A2E] border border-amber-400/25 rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="border-b border-white/10 pb-5 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-amber-300 flex flex-wrap items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                <span>Memoria Autorizada de Sociedad de Jóvenes</span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-400 font-normal">
                  {sharedView.privacyNote}
                </span>
              </div>
              <h1 className="font-display font-bold text-2xl sm:text-3xl text-white text-balance">
                {sharedView.memory.title}
              </h1>
              <div className="text-sm text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-mono-num text-amber-200">
                  {formatMemoryDateEs(sharedView.memory.date)}
                </span>
                <span className="text-slate-600">·</span>
                <span>Tema: {sharedView.memory.theme}</span>
                <span className="text-slate-600">·</span>
                <span>Texto: {sharedView.memory.bibleText}</span>
                <span className="text-slate-600">·</span>
                <span>Dirección: {sharedView.memory.directorName}</span>
              </div>
              {sharedView.memory.bibleVerseQuote && (
                <blockquote className="text-sm italic text-amber-100/90 bg-[#0B1221] border border-amber-400/20 rounded-xl px-4 py-3 mt-2">
                  “{sharedView.memory.bibleVerseQuote}”
                </blockquote>
              )}
            </div>

            {sharedView.memory.dailyReflection && (
              <div className="space-y-1.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Reflexión del día
                </h2>
                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                  {sharedView.memory.dailyReflection}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sharedView.memory.activities.length > 0 && (
                <div className="bg-[#0B1221] border border-white/10 rounded-xl p-4 space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                    Actividades Realizadas ({sharedView.memory.activities.length})
                  </h3>
                  <ul className="space-y-1.5 text-sm text-slate-300">
                    {sharedView.memory.activities.map((a) => (
                      <li key={a.id}>
                        <span className="font-medium text-white">{a.title}</span>
                        {a.categoryLabel && (
                          <span className="text-slate-400">
                            {' '}
                            · {a.categoryLabel}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {sharedView.memory.gamesPlayed.length > 0 && (
                <div className="bg-[#0B1221] border border-white/10 rounded-xl p-4 space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-sky-300">
                    Juegos Realizados ({sharedView.memory.gamesPlayed.length})
                  </h3>
                  <ul className="space-y-1.5 text-sm text-slate-300">
                    {sharedView.memory.gamesPlayed.map((g) => (
                      <li key={g.id}>
                        <span className="font-medium text-white">{g.title}</span>
                        {g.winnerOrHighlight && (
                          <span className="text-slate-400">
                            {' '}
                            · {g.winnerOrHighlight}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {sharedView.memory.challengesCompleted.length > 0 && (
                <div className="bg-[#0B1221] border border-white/10 rounded-xl p-4 space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    Retos Completados (
                    {sharedView.memory.challengesCompleted.length})
                  </h3>
                  <ul className="space-y-1.5 text-sm text-slate-300">
                    {sharedView.memory.challengesCompleted.map((c) => (
                      <li key={c.id}>
                        <span className="font-medium text-white">{c.title}</span>
                        {c.outcome && (
                          <span className="text-slate-400"> · {c.outcome}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(sharedView.memory.teams.length > 0 ||
                sharedView.memory.resultsSummary) && (
                <div className="bg-[#0B1221] border border-white/10 rounded-xl p-4 space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                    Equipos y Resultados
                  </h3>
                  {sharedView.memory.resultsSummary && (
                    <p className="text-sm text-slate-200">
                      {sharedView.memory.resultsSummary}
                    </p>
                  )}
                  <div className="space-y-1 text-sm text-slate-300">
                    {sharedView.memory.teams.map((t) => (
                      <div key={t.id} className="flex justify-between">
                        <span>{t.name}</span>
                        {typeof t.score === 'number' && (
                          <span className="font-mono-num text-amber-300">
                            {t.score} pts
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {sharedView.memory.recognitions.length > 0 && (
              <div className="bg-[#0B1221] border border-amber-400/20 rounded-xl p-4 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Reconocimientos ({sharedView.memory.recognitions.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {sharedView.memory.recognitions.map((r) => (
                    <div
                      key={r.id}
                      className="text-sm bg-[#111A2E] border border-white/10 rounded-lg px-3 py-2"
                    >
                      <div className="font-semibold text-white">
                        {r.recipientName}
                      </div>
                      <div className="text-xs text-amber-300">{r.title}</div>
                      {r.reason && (
                        <div className="text-xs text-slate-400 mt-0.5">
                          {r.reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sharedView.memory.photos.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Fotografías Autorizadas ({sharedView.memory.photos.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {sharedView.memory.photos.map((ph) => (
                    <figure
                      key={ph.id}
                      className="bg-[#0B1221] border border-white/10 rounded-xl overflow-hidden"
                    >
                      <img
                        src={ph.photoUrl}
                        alt={ph.caption}
                        referrerPolicy="no-referrer"
                        className="w-full h-44 object-cover"
                      />
                      <figcaption className="px-3 py-2 text-xs text-slate-300">
                        {ph.caption}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ==================== COLLECT AUTHORIZED ALBUM PHOTOS ====================
  const albumPhotos = useMemo(() => {
    const list: Array<{
      photo: MemoryPhotoItem;
      memoryId: string;
      memoryTitle: string;
      memoryDate: string;
      hiddenByPolicy: boolean;
    }> = [];
    for (const mem of activeMemories) {
      if (albumMemoryFilter !== 'all' && mem.id !== albumMemoryFilter) continue;
      const hidden = shouldHidePhotos(mem);
      for (const ph of mem.photos) {
        if (!isAdmin && !isPhotoPubliclyAllowed(ph, requireMinorConsent)) {
          continue;
        }
        list.push({
          photo: ph,
          memoryId: mem.id,
          memoryTitle: mem.title,
          memoryDate: mem.date,
          hiddenByPolicy: hidden,
        });
      }
    }
    return list;
  }, [
    activeMemories,
    albumMemoryFilter,
    isAdmin,
    requireMinorConsent,
    quickHideIdentities,
    overview?.settings?.hidePhotosByDefault,
  ]);

  // ==================== MAIN AUTH / ACCESS GATE ====================
  if (!loading && overview?.accessDenied) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white bg-[#111A2E] border border-white/10 hover:border-white/25 rounded-xl px-4 py-2 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al inicio
        </button>

        <div className="bg-[#111A2E] border border-amber-400/30 rounded-2xl p-8 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-400/35 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7 text-amber-300" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display font-bold text-2xl sm:text-3xl text-white">
              Nuestras Memorias — Acceso Protegido
            </h1>
            <p className="text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
              {overview.requiredAccess === 'admins_only'
                ? 'La administración configuró este archivo histórico para visualización exclusiva de administradores.'
                : 'Este archivo histórico requiere el código de acceso de miembros o la clave de administrador.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {overview.requiredAccess === 'members_code' && (
              <button
                type="button"
                onClick={() => {
                  setAuthError(null);
                  setPinInput('');
                  setShowAuthModal('member');
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm cursor-pointer"
              >
                <Users className="w-4 h-4" />
                Ingresar Código de Miembros
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setAuthError(null);
                setPinInput('');
                setShowAuthModal('admin');
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-sm cursor-pointer"
            >
              <Shield className="w-4 h-4" />
              Acceso de Administrador
            </button>
          </div>
        </div>

        {showAuthModal && (
          <AuthPromptModal
            mode={showAuthModal}
            pinInput={pinInput}
            setPinInput={setPinInput}
            submitting={authSubmitting}
            error={authError}
            onClose={() => setShowAuthModal(null)}
            onSubmit={handleAuthSubmit}
          />
        )}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Top Bar */}
      <header className="bg-[#111A2E] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white bg-[#0B1221] border border-white/10 hover:border-white/25 rounded-xl px-3.5 py-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            Inicio
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Privacy Mask for live projection */}
            <button
              type="button"
              onClick={() => setQuickHideIdentities((v) => !v)}
              className={`inline-flex items-center gap-2 text-xs font-semibold rounded-xl px-3.5 py-2 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                quickHideIdentities
                  ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                  : 'bg-[#0B1221] border-white/15 text-slate-300 hover:text-white'
              }`}
              title="Ocultar nombres y fotografías temporalmente en esta pantalla"
            >
              {quickHideIdentities ? (
                <EyeOff className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
              {quickHideIdentities
                ? 'Privacidad activa (ocultando nombres/fotos)'
                : 'Ocultar nombres y fotos'}
            </button>

            {overview?.role === 'public' && (
              <button
                type="button"
                onClick={() => {
                  setAuthError(null);
                  setPinInput('');
                  setShowAuthModal('member');
                }}
                className="inline-flex items-center gap-2 text-xs font-semibold text-slate-200 bg-[#0B1221] hover:bg-[#16213B] border border-white/15 rounded-xl px-3.5 py-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                Acceso Director / Miembros
              </button>
            )}

            {isAdmin ? (
              <button
                type="button"
                onClick={handleLogoutRole}
                className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-200 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 rounded-xl px-3.5 py-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Unlock className="w-3.5 h-3.5" />
                Admin activo · Salir
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAuthError(null);
                  setPinInput('');
                  setShowAuthModal('admin');
                }}
                className="inline-flex items-center gap-2 text-xs font-semibold text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 rounded-xl px-3.5 py-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Lock className="w-3.5 h-3.5" />
                Modo Administrador
              </button>
            )}

            {canEdit && (
              <button
                type="button"
                onClick={() =>
                  setEditorState({
                    open: true,
                    memory: null,
                    initialDate:
                      selectedCalendarDate ||
                      new Date().toISOString().slice(0, 10),
                  })
                }
                className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl px-4 py-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                Registrar Sábado
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-1">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300">
              <FolderHeart className="w-4 h-4" />
              <span>Archivo Histórico de la Sociedad de Jóvenes</span>
            </div>
            <h1 className="font-display font-bold text-2xl sm:text-3xl text-white text-balance">
              Nuestras Memorias
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl">
              Crónica independiente de cada sábado: temas, texto bíblico,
              actividades, juegos, retos, equipos, fotografías autorizadas,
              reflexiones y exportación en PDF.
            </p>
          </div>

          {overview && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
              <span>
                <strong className="font-mono-num text-white text-sm">
                  {overview.stats.totalMemories}
                </strong>{' '}
                sábados archivados
              </span>
              <span className="text-slate-600">·</span>
              <span>
                <strong className="font-mono-num text-white text-sm">
                  {overview.stats.totalAuthorizedPhotos}
                </strong>{' '}
                fotos autorizadas
              </span>
              <span className="text-slate-600">·</span>
              <span>
                <strong className="font-mono-num text-white text-sm">
                  {overview.recognitions.length}
                </strong>{' '}
                reconocimientos
              </span>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <nav
          aria-label="Secciones de Nuestras Memorias"
          className="flex flex-wrap gap-2 pt-2 border-t border-white/10"
        >
          {(
            [
              {
                id: 'archivo',
                label: 'Archivo y Calendario',
                icon: CalendarDays,
              },
              { id: 'album', label: 'Álbum de Fotos', icon: Images },
              {
                id: 'campeonatos',
                label: 'Campeonatos y Reconocimientos',
                icon: Trophy,
              },
              {
                id: 'participacion',
                label: 'Resumen de Participación',
                icon: Users,
              },
              {
                id: 'privacidad',
                label: 'Privacidad y Recuperación',
                icon: ShieldCheck,
              },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                    : 'bg-[#0B1221] text-slate-300 border-white/10 hover:text-white hover:border-white/25'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Feedback banners */}
      {bannerError && (
        <div className="bg-rose-500/15 border border-rose-400/40 text-rose-200 rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-3">
          <span>{bannerError}</span>
          <button
            type="button"
            onClick={() => setBannerError(null)}
            className="text-rose-200 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {bannerSuccess && (
        <div className="bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-3">
          <span>{bannerSuccess}</span>
          <button
            type="button"
            onClick={() => setBannerSuccess(null)}
            className="text-emerald-200 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading && !overview ? (
        <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-12 text-center text-slate-300">
          Cargando memorias de la Sociedad de Jóvenes...
        </div>
      ) : null}

      {/* ==================== TAB 1: ARCHIVO Y CALENDARIO ==================== */}
      {overview && activeTab === 'archivo' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left column: Calendar + Search + List */}
          <aside className="lg:col-span-5 space-y-5">
            {/* Monthly Calendar */}
            <section className="bg-[#111A2E] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-base text-white flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-amber-300" />
                  Calendario de Programas
                </h2>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setCalendarMonth((prev) =>
                        prev.month === 0
                          ? { year: prev.year - 1, month: 11 }
                          : { year: prev.year, month: prev.month - 1 }
                      )
                    }
                    className="p-1.5 rounded-lg bg-[#0B1221] border border-white/10 text-slate-300 hover:text-white cursor-pointer"
                    aria-label="Mes anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-semibold text-white min-w-[116px] text-center">
                    {MONTH_NAMES_ES[calendarMonth.month]} {calendarMonth.year}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setCalendarMonth((prev) =>
                        prev.month === 11
                          ? { year: prev.year + 1, month: 0 }
                          : { year: prev.year, month: prev.month + 1 }
                      )
                    }
                    className="p-1.5 rounded-lg bg-[#0B1221] border border-white/10 text-slate-300 hover:text-white cursor-pointer"
                    aria-label="Mes siguiente"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-400">
                {WEEKDAYS_ES.map((w, idx) => (
                  <div
                    key={w}
                    className={idx === 6 ? 'text-amber-300' : undefined}
                  >
                    {w}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarCells.map((cell, idx) => {
                  if (!cell.isoDate) {
                    return <div key={`empty-${idx}`} className="h-9" />;
                  }
                  const isSelected = selectedCalendarDate === cell.isoDate;
                  const hasMemory = cell.count > 0;
                  return (
                    <button
                      key={cell.isoDate}
                      type="button"
                      onClick={() =>
                        setSelectedCalendarDate((prev) =>
                          prev === cell.isoDate ? '' : cell.isoDate || ''
                        )
                      }
                      className={`h-9 rounded-lg text-xs font-mono-num flex flex-col items-center justify-center relative transition-colors cursor-pointer border ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                          : hasMemory
                            ? 'bg-emerald-500/20 text-emerald-100 border-emerald-400/50 hover:bg-emerald-500/30 font-semibold'
                            : cell.isSaturday
                              ? 'bg-[#0B1221] text-amber-200/80 border-amber-400/20 hover:border-amber-400/50'
                              : 'bg-[#0B1221]/60 text-slate-400 border-white/5 hover:border-white/20'
                      }`}
                      title={
                        hasMemory
                          ? `${cell.count} memoria(s) registrada(s) el ${cell.isoDate}`
                          : cell.isoDate
                      }
                    >
                      <span>{cell.dayNum}</span>
                      {hasMemory && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                            isSelected ? 'bg-slate-950' : 'bg-emerald-400'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-1">
                <span>
                  {selectedCalendarDate
                    ? `Filtrando fecha: ${selectedCalendarDate}`
                    : 'Sábados resaltados · Verde = con memoria'}
                </span>
                {selectedCalendarDate && (
                  <button
                    type="button"
                    onClick={() => setSelectedCalendarDate('')}
                    className="text-amber-300 hover:underline cursor-pointer"
                  >
                    Ver todos
                  </button>
                )}
              </div>
            </section>

            {/* Search by theme or date */}
            <section className="bg-[#111A2E] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-base text-white flex items-center gap-2">
                  <Search className="w-4 h-4 text-amber-300" />
                  Buscador por Fecha o Tema
                </h2>
                {(searchQuery || dateFrom || dateTo || selectedCalendarDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setDateFrom('');
                      setDateTo('');
                      setSelectedCalendarDate('');
                    }}
                    className="text-xs text-amber-300 hover:underline cursor-pointer"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar tema, texto bíblico, actividad o director..."
                className="w-full bg-[#0B1221] border border-white/15 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
              />

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Desde
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full bg-[#0B1221] border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Hasta
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full bg-[#0B1221] border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
              </div>
            </section>

            {/* List of Saturday Records */}
            <section className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Registros ({filteredMemories.length})
                </span>
                {selectedCalendarDate && canEdit && (
                  <button
                    type="button"
                    onClick={() =>
                      setEditorState({
                        open: true,
                        memory: null,
                        initialDate: selectedCalendarDate,
                      })
                    }
                    className="text-xs text-amber-300 hover:underline cursor-pointer"
                  >
                    + Registrar {selectedCalendarDate}
                  </button>
                )}
              </div>

              {filteredMemories.length === 0 ? (
                <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-6 text-center space-y-3">
                  <BookOpen className="w-8 h-8 text-amber-300/70 mx-auto" />
                  <p className="text-sm text-slate-300">
                    {activeMemories.length === 0
                      ? 'Aún no hay sábados archivados en Nuestras Memorias.'
                      : 'No hay memorias que coincidan con los filtros actuales.'}
                  </p>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() =>
                        setEditorState({
                          open: true,
                          memory: null,
                          initialDate:
                            selectedCalendarDate ||
                            new Date().toISOString().slice(0, 10),
                        })
                      }
                      className="inline-flex items-center gap-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl px-4 py-2 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      Registrar o Recuperar un Sábado
                    </button>
                  )}
                </div>
              ) : (
                filteredMemories.map((mem) => {
                  const isCurrent = selectedMemory?.id === mem.id;
                  return (
                    <button
                      key={mem.id}
                      type="button"
                      onClick={() => setSelectedMemoryId(mem.id)}
                      className={`w-full text-left rounded-2xl p-4 border transition-colors cursor-pointer space-y-1.5 ${
                        isCurrent
                          ? 'bg-[#16213B] border-amber-400/70'
                          : 'bg-[#111A2E] border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-mono-num text-amber-300 font-semibold">
                          {mem.date}
                        </span>
                        <span className="text-slate-400">
                          {mem.activities.length} act. · {mem.photos.length}{' '}
                          fotos
                        </span>
                      </div>
                      <h3 className="font-display font-bold text-base text-white leading-snug">
                        {mem.title}
                      </h3>
                      <p className="text-xs text-slate-300 line-clamp-1">
                        {mem.theme} · {mem.bibleText}
                      </p>
                    </button>
                  );
                })
              )}
            </section>
          </aside>

          {/* Right column: Selected Saturday Archival Sheet */}
          <main className="lg:col-span-7">
            {!selectedMemory ? (
              <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-10 text-center space-y-3">
                <FolderHeart className="w-10 h-10 text-amber-300/70 mx-auto" />
                <h2 className="font-display font-bold text-xl text-white">
                  Selecciona o registra un sábado
                </h2>
                <p className="text-sm text-slate-400 max-w-md mx-auto">
                  Cada sábado se conserva como un registro histórico
                  independiente sin sobrescribir semanas anteriores. Puedes
                  crear uno nuevo o importar directamente desde Programa del
                  Sábado, Juegos, Retos, Ruleta o Cabina de Sorpresas.
                </p>
              </div>
            ) : (
              <article className="bg-[#111A2E] border border-white/10 rounded-2xl p-5 sm:p-7 space-y-6">
                {/* Header & actions */}
                <div className="border-b border-white/10 pb-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-mono-num font-semibold text-amber-300 uppercase tracking-wider">
                      {formatMemoryDateEs(selectedMemory.date)}
                    </span>
                    <span className="text-xs text-slate-400">
                      {selectedMemory.visibility === 'authorized_public'
                        ? 'Público autorizado'
                        : selectedMemory.visibility === 'internal_only'
                          ? 'Solo miembros'
                          : 'Solo administradores'}
                      {selectedMemory.revisionCount
                        ? ` · Rev. ${selectedMemory.revisionCount}`
                        : ''}
                    </span>
                  </div>

                  <h2 className="font-display font-bold text-2xl sm:text-3xl text-white text-balance">
                    {selectedMemory.title}
                  </h2>

                  <div className="text-sm text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      <strong className="text-white">Tema:</strong>{' '}
                      {selectedMemory.theme}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span>
                      <strong className="text-white">Texto bíblico:</strong>{' '}
                      {selectedMemory.bibleText}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span>
                      <strong className="text-white">Director:</strong>{' '}
                      {shouldHideNames(selectedMemory)
                        ? 'Dirección de Sociedad de Jóvenes'
                        : selectedMemory.directorName}
                    </span>
                    {typeof selectedMemory.attendanceCount === 'number' && (
                      <>
                        <span className="text-slate-600">·</span>
                        <span className="font-mono-num">
                          <strong className="text-white">Asistencia:</strong>{' '}
                          {selectedMemory.attendanceCount}
                        </span>
                      </>
                    )}
                  </div>

                  {selectedMemory.bibleVerseQuote && (
                    <blockquote className="text-sm italic text-amber-100/90 bg-[#0B1221] border border-amber-400/20 rounded-xl px-4 py-3">
                      “{selectedMemory.bibleVerseQuote}”
                    </blockquote>
                  )}

                  {/* Action Toolbar */}
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handleExportPdf(selectedMemory)}
                      disabled={exportingPdfId === selectedMemory.id}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl px-3.5 py-2 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      {exportingPdfId === selectedMemory.id
                        ? 'Exportando...'
                        : 'Exportar PDF'}
                    </button>

                    {canShare && (
                      <button
                        type="button"
                        onClick={() => setShareModalMemory(selectedMemory)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-200 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 rounded-xl px-3.5 py-2 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        Compartir Resumen Autorizado
                      </button>
                    )}

                    {canEdit && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setEditorState({
                              open: true,
                              memory: selectedMemory,
                            })
                          }
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#0B1221] hover:bg-[#16213B] border border-white/15 rounded-xl px-3.5 py-2 cursor-pointer whitespace-nowrap shrink-0"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRecoverToProgram(selectedMemory)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-200 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/35 rounded-xl px-3.5 py-2 cursor-pointer whitespace-nowrap shrink-0"
                          title="Crear una copia editable en Programa del Sábado"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Recuperar en Programa del Sábado
                        </button>
                      </>
                    )}

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleArchiveMemory(selectedMemory)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 bg-[#0B1221] hover:bg-rose-500/15 hover:text-rose-200 border border-white/15 hover:border-rose-400/40 rounded-xl px-3 py-2 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        Archivar
                      </button>
                    )}
                  </div>
                </div>

                {/* Reflexión del día & Observaciones */}
                {(selectedMemory.dailyReflection ||
                  selectedMemory.observations) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedMemory.dailyReflection && (
                      <div className="bg-[#0B1221] border border-amber-400/20 rounded-xl p-4 space-y-1.5">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                          Reflexión del Día
                        </h3>
                        <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                          {selectedMemory.dailyReflection}
                        </p>
                      </div>
                    )}
                    {selectedMemory.observations && (
                      <div className="bg-[#0B1221] border border-white/10 rounded-xl p-4 space-y-1.5">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                          Observaciones
                        </h3>
                        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                          {selectedMemory.observations}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Actividades / Juegos / Retos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#0B1221] border border-white/10 rounded-xl p-4 space-y-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                      Actividades Realizadas ({selectedMemory.activities.length})
                    </h3>
                    {selectedMemory.activities.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        Sin actividades registradas.
                      </p>
                    ) : (
                      <ul className="space-y-2 text-sm">
                        {selectedMemory.activities.map((a) => (
                          <li
                            key={a.id}
                            className="border-b border-white/5 pb-1.5 last:border-0 last:pb-0"
                          >
                            <div className="font-medium text-white">
                              {a.title}
                            </div>
                            <div className="text-xs text-slate-400">
                              {[
                                a.categoryLabel,
                                a.durationMin ? `${a.durationMin} min` : '',
                                a.notes,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="bg-[#0B1221] border border-white/10 rounded-xl p-4 space-y-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-sky-300">
                      Juegos Realizados ({selectedMemory.gamesPlayed.length})
                    </h3>
                    {selectedMemory.gamesPlayed.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        Sin juegos registrados.
                      </p>
                    ) : (
                      <ul className="space-y-2 text-sm">
                        {selectedMemory.gamesPlayed.map((g) => (
                          <li
                            key={g.id}
                            className="border-b border-white/5 pb-1.5 last:border-0 last:pb-0"
                          >
                            <div className="font-medium text-white">
                              {g.title}
                            </div>
                            <div className="text-xs text-slate-400">
                              {[
                                g.modeLabel,
                                g.winnerOrHighlight
                                  ? shouldHideNames(selectedMemory)
                                    ? 'Resultado protegido'
                                    : g.winnerOrHighlight
                                  : '',
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="bg-[#0B1221] border border-white/10 rounded-xl p-4 space-y-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                      Retos Completados (
                      {selectedMemory.challengesCompleted.length})
                    </h3>
                    {selectedMemory.challengesCompleted.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        Sin retos registrados.
                      </p>
                    ) : (
                      <ul className="space-y-2 text-sm">
                        {selectedMemory.challengesCompleted.map((c, idx) => (
                          <li
                            key={c.id}
                            className="border-b border-white/5 pb-1.5 last:border-0 last:pb-0"
                          >
                            <div className="font-medium text-white">
                              {c.title}
                            </div>
                            <div className="text-xs text-slate-400">
                              {[
                                c.categoryLabel,
                                c.participantOrTeam
                                  ? shouldHideNames(selectedMemory)
                                    ? anonymizeDisplayName(
                                        c.participantOrTeam,
                                        idx
                                      )
                                    : c.participantOrTeam
                                  : '',
                                c.outcome,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="bg-[#0B1221] border border-white/10 rounded-xl p-4 space-y-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                      Equipos Participantes y Resultados
                    </h3>
                    {selectedMemory.resultsSummary && (
                      <p className="text-xs text-slate-200 leading-relaxed">
                        {selectedMemory.resultsSummary}
                      </p>
                    )}
                    {selectedMemory.teams.length > 0 ? (
                      <div className="space-y-1.5 text-sm">
                        {selectedMemory.teams.map((t, idx) => (
                          <div
                            key={t.id}
                            className="flex items-center justify-between"
                          >
                            <span className="text-slate-200">
                              {shouldHideNames(selectedMemory)
                                ? `Equipo #${idx + 1}`
                                : t.name}
                            </span>
                            {typeof t.score === 'number' && (
                              <span className="font-mono-num text-amber-300 text-xs font-semibold">
                                {t.score} pts
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      !selectedMemory.resultsSummary && (
                        <p className="text-xs text-slate-500">
                          Sin equipos ni resultados registrados.
                        </p>
                      )
                    )}

                    {selectedMemory.rankings.length > 0 && (
                      <div className="pt-2 border-t border-white/10 space-y-1">
                        <div className="text-[11px] font-semibold text-slate-400 uppercase">
                          Posiciones Destacadas
                        </div>
                        {selectedMemory.rankings.map((r, idx) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between text-xs text-slate-300"
                          >
                            <span>
                              #{r.position}{' '}
                              {shouldHideNames(selectedMemory)
                                ? anonymizeDisplayName(r.name, idx)
                                : r.name}
                            </span>
                            <span className="font-mono-num text-emerald-300">
                              {r.points} pts
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Reconocimientos del Sábado */}
                {selectedMemory.recognitions.length > 0 && (
                  <div className="bg-[#0B1221] border border-amber-400/20 rounded-xl p-4 space-y-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                      <Award className="w-4 h-4" />
                      Reconocimientos ({selectedMemory.recognitions.length})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {selectedMemory.recognitions.map((r, idx) => (
                        <div
                          key={r.id}
                          className="bg-[#111A2E] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm"
                        >
                          <div className="font-semibold text-white">
                            {shouldHideNames(selectedMemory)
                              ? anonymizeDisplayName(
                                  r.recipientName,
                                  idx,
                                  'Joven'
                                )
                              : r.recipientName}
                          </div>
                          <div className="text-xs text-amber-300">
                            {r.title}
                          </div>
                          {r.reason && (
                            <div className="text-xs text-slate-400 mt-0.5">
                              {r.reason}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fotografías Autorizadas & Upload */}
                <section className="space-y-4 pt-2 border-t border-white/10">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-amber-300 flex items-center gap-2">
                      <Images className="w-4 h-4" />
                      Fotografías Autorizadas
                    </h3>
                    <span className="text-xs text-slate-400">
                      Menores requieren consentimiento de representantes
                    </span>
                  </div>

                  {canEdit && (
                    <div className="bg-[#0B1221] border border-white/10 rounded-xl p-4 space-y-3">
                      <div className="text-xs font-semibold text-white">
                        Agregar fotografía al sábado ({selectedMemory.date})
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={photoCaption}
                          onChange={(e) => setPhotoCaption(e.target.value)}
                          placeholder="Descripción breve (ej. Dinámica grupal)"
                          className="bg-[#111A2E] border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            ref={photoInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleUploadPhoto}
                            className="hidden"
                          />
                          <button
                            type="button"
                            disabled={uploadingPhoto}
                            onClick={() => photoInputRef.current?.click()}
                            className="inline-flex items-center justify-center gap-2 w-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs rounded-xl px-4 py-2 cursor-pointer disabled:opacity-50"
                          >
                            <ImagePlus className="w-4 h-4" />
                            {uploadingPhoto
                              ? 'Subiendo imagen...'
                              : 'Seleccionar y Subir Foto'}
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={photoIncludesMinors}
                            onChange={(e) => {
                              setPhotoIncludesMinors(e.target.checked);
                              if (!e.target.checked)
                                setPhotoGuardianConsent(false);
                            }}
                            className="accent-amber-400"
                          />
                          Aparecen menores de edad
                        </label>
                        {photoIncludesMinors && (
                          <label className="inline-flex items-center gap-2 cursor-pointer text-amber-200">
                            <input
                              type="checkbox"
                              checked={photoGuardianConsent}
                              onChange={(e) =>
                                setPhotoGuardianConsent(e.target.checked)
                              }
                              className="accent-emerald-400"
                            />
                            Autorización de padres/representantes confirmada
                          </label>
                        )}
                        {isAdmin && (
                          <label className="inline-flex items-center gap-2 cursor-pointer text-emerald-200">
                            <input
                              type="checkbox"
                              checked={photoAutoAuthorize}
                              onChange={(e) =>
                                setPhotoAutoAuthorize(e.target.checked)
                              }
                              className="accent-emerald-400"
                            />
                            Autorizar publicación inmediatamente
                          </label>
                        )}
                      </div>
                    </div>
                  )}

                  {shouldHidePhotos(selectedMemory) ? (
                    <div className="bg-[#0B1221] border border-amber-400/25 rounded-xl p-5 text-center text-xs text-amber-200">
                      Las fotografías de esta memoria están ocultas por
                      configuración de privacidad.
                    </div>
                  ) : selectedMemory.photos.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No hay fotografías autorizadas visibles para este sábado.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {selectedMemory.photos.map((ph) => {
                        const allowedPublic = isPhotoPubliclyAllowed(
                          ph,
                          requireMinorConsent
                        );
                        return (
                          <div
                            key={ph.id}
                            className="bg-[#0B1221] border border-white/10 rounded-xl overflow-hidden flex flex-col"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setLightboxPhoto({
                                  photo: ph,
                                  memoryTitle: selectedMemory.title,
                                  memoryDate: selectedMemory.date,
                                })
                              }
                              className="cursor-pointer overflow-hidden"
                            >
                              <img
                                src={resolvePhotoSrc(
                                  ph.photoUrl,
                                  adminToken,
                                  memberToken
                                )}
                                alt={ph.caption}
                                referrerPolicy="no-referrer"
                                className="w-full h-40 object-cover hover:scale-105 transition-transform"
                              />
                            </button>
                            <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                              <div className="text-xs text-slate-200">
                                {ph.caption}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {allowedPublic
                                  ? 'Autorizada'
                                  : 'Pendiente de autorización'}
                                {ph.includesMinors
                                  ? ph.guardianConsentConfirmed
                                    ? ' · Menores con permiso'
                                    : ' · Falta permiso de menores'
                                  : ''}
                              </div>

                              {isAdmin && (
                                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/5">
                                  {ph.includesMinors &&
                                    !ph.guardianConsentConfirmed && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleTogglePhotoAuth(
                                            selectedMemory.id,
                                            ph,
                                            { guardianConsentConfirmed: true }
                                          )
                                        }
                                        className="text-[11px] px-2 py-1 rounded-lg bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 cursor-pointer"
                                      >
                                        Confirmar permiso padres
                                      </button>
                                    )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleTogglePhotoAuth(
                                        selectedMemory.id,
                                        ph,
                                        { authorized: !ph.authorized }
                                      )
                                    }
                                    className={`text-[11px] px-2 py-1 rounded-lg cursor-pointer ${
                                      ph.authorized
                                        ? 'bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
                                        : 'bg-sky-500/20 text-sky-200 hover:bg-sky-500/30'
                                    }`}
                                  >
                                    {ph.authorized ? 'Revocar' : 'Autorizar'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDeletePhoto(
                                        selectedMemory.id,
                                        ph.id
                                      )
                                    }
                                    className="text-[11px] px-2 py-1 rounded-lg bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 cursor-pointer ml-auto"
                                    aria-label="Eliminar foto"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </article>
            )}
          </main>
        </div>
      )}

      {/* ==================== TAB 2: ÁLBUM DE FOTOS ==================== */}
      {overview && activeTab === 'album' && (
        <section className="bg-[#111A2E] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display font-bold text-xl text-white">
                Álbum de Fotografías Autorizadas
              </h2>
              <p className="text-xs text-slate-400">
                Solo se exhiben fotografías aprobadas por administración y con
                permiso de representantes cuando corresponde.
              </p>
            </div>
            <select
              value={albumMemoryFilter}
              onChange={(e) => setAlbumMemoryFilter(e.target.value)}
              className="bg-[#0B1221] border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
            >
              <option value="all">Todos los sábados</option>
              {activeMemories.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.date} · {m.title}
                </option>
              ))}
            </select>
          </div>

          {quickHideIdentities || (!isAdmin && overview.settings.hidePhotosByDefault) ? (
            <div className="bg-[#0B1221] border border-amber-400/30 rounded-xl p-8 text-center space-y-2">
              <EyeOff className="w-8 h-8 text-amber-300 mx-auto" />
              <p className="text-sm text-amber-200 font-semibold">
                Fotografías ocultas por política de privacidad
              </p>
              <p className="text-xs text-slate-400">
                Desactiva el botón rápido de ocultar nombres/fotos o ajusta la
                política de privacidad en modo administrador para visualizar el
                álbum.
              </p>
            </div>
          ) : albumPhotos.filter((x) => !x.hiddenByPolicy).length === 0 ? (
            <div className="bg-[#0B1221] border border-white/10 rounded-xl p-10 text-center text-sm text-slate-400">
              No hay fotografías autorizadas disponibles con el filtro actual.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {albumPhotos
                .filter((x) => !x.hiddenByPolicy)
                .map(({ photo, memoryTitle, memoryDate }) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() =>
                      setLightboxPhoto({ photo, memoryTitle, memoryDate })
                    }
                    className="text-left bg-[#0B1221] border border-white/10 hover:border-amber-400/50 rounded-xl overflow-hidden transition-colors cursor-pointer group"
                  >
                    <img
                      src={resolvePhotoSrc(
                        photo.photoUrl,
                        adminToken,
                        memberToken
                      )}
                      alt={photo.caption}
                      referrerPolicy="no-referrer"
                      className="w-full h-48 object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="p-3 space-y-1">
                      <div className="text-xs font-semibold text-white">
                        {photo.caption}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        <span className="font-mono-num text-amber-300">
                          {memoryDate}
                        </span>{' '}
                        · {memoryTitle}
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          )}
        </section>
      )}

      {/* ==================== TAB 3: CAMPEONATOS Y RECONOCIMIENTOS ==================== */}
      {overview && activeTab === 'campeonatos' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Historial de Campeonatos */}
          <section className="bg-[#111A2E] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-300" />
              <h2 className="font-display font-bold text-xl text-white">
                Historial de Campeonatos
              </h2>
            </div>

            {overview.championships.length === 0 ? (
              <p className="text-sm text-slate-400">
                Aún no hay campeonatos o torneos registrados.
              </p>
            ) : (
              <div className="space-y-3">
                {overview.championships.map((ch) => (
                  <div
                    key={ch.id}
                    className="bg-[#0B1221] border border-white/10 rounded-xl p-4 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-display font-bold text-base text-white">
                        {ch.name}
                      </h3>
                      <span className="text-xs text-amber-300 font-semibold">
                        {ch.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">
                      <span className="font-mono-num">
                        {ch.startDate} → {ch.endDate}
                      </span>{' '}
                      · {ch.competitionType}
                    </div>
                    {ch.championName && !quickHideIdentities && (
                      <div className="text-xs text-emerald-300 font-semibold">
                        Primer lugar: {ch.championName}
                      </div>
                    )}
                    {ch.topStandings.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-white/5">
                        {ch.topStandings.map((st, idx) => (
                          <div
                            key={`${ch.id}-${idx}`}
                            className="flex items-center justify-between text-xs text-slate-300"
                          >
                            <span>
                              #{idx + 1}{' '}
                              {quickHideIdentities
                                ? `Competidor #${idx + 1}`
                                : st.name}
                            </span>
                            <span className="font-mono-num text-amber-300">
                              {st.points} pts
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Reconocimientos */}
          <section className="bg-[#111A2E] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-300" />
              <h2 className="font-display font-bold text-xl text-white">
                Reconocimientos Juveniles
              </h2>
            </div>

            {overview.recognitions.length === 0 ? (
              <p className="text-sm text-slate-400">
                Aún no hay reconocimientos registrados en memorias, misiones o
                talentos.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
                {overview.recognitions.map((rec, idx) => (
                  <div
                    key={rec.id}
                    className="bg-[#0B1221] border border-white/10 rounded-xl p-3.5 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-white">
                        {quickHideIdentities
                          ? anonymizeDisplayName(
                              rec.recipientName,
                              idx,
                              'Joven'
                            )
                          : rec.recipientName}
                      </span>
                      <span className="text-[11px] font-mono-num text-slate-400">
                        {rec.dateLabel}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-amber-300">
                      {rec.title}
                    </div>
                    <div className="text-xs text-slate-400">
                      {rec.reason} ·{' '}
                      <span className="text-slate-500">{rec.sourceLabel}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ==================== TAB 4: RESUMEN DE PARTICIPACIÓN ==================== */}
      {overview && activeTab === 'participacion' && (
        <section className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              {
                label: 'Sábados Archivados',
                val: overview.stats.totalMemories,
              },
              {
                label: 'Asistencia Acumulada',
                val: overview.stats.totalAttendance,
              },
              {
                label: 'Actividades Realizadas',
                val: overview.stats.totalActivities,
              },
              { label: 'Juegos Realizados', val: overview.stats.totalGames },
              {
                label: 'Retos Completados',
                val: overview.stats.totalChallenges,
              },
              {
                label: 'Fotos Autorizadas',
                val: overview.stats.totalAuthorizedPhotos,
              },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="bg-[#111A2E] border border-white/10 rounded-2xl p-4 space-y-1"
              >
                <div className="font-mono-num font-bold text-2xl text-amber-300">
                  {kpi.val}
                </div>
                <div className="text-xs text-slate-400">{kpi.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-5 space-y-3">
              <h3 className="font-display font-bold text-lg text-white">
                Equipos con Mayor Participación
              </h3>
              {overview.stats.uniqueTeams.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Aún no hay equipos registrados en las memorias.
                </p>
              ) : (
                <div className="space-y-2">
                  {overview.stats.uniqueTeams.map((tm, idx) => (
                    <div
                      key={`${tm.name}-${idx}`}
                      className="flex items-center justify-between bg-[#0B1221] border border-white/10 rounded-xl px-4 py-2.5 text-sm"
                    >
                      <span className="font-medium text-white">
                        {quickHideIdentities ? `Equipo #${idx + 1}` : tm.name}
                      </span>
                      <span className="text-xs text-slate-300 font-mono-num">
                        {tm.appearances} sábados · Mejor: {tm.bestScore} pts
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-5 space-y-3">
              <h3 className="font-display font-bold text-lg text-white">
                Participación por Sábado
              </h3>
              {activeMemories.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Sin registros disponibles.
                </p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {activeMemories.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between bg-[#0B1221] border border-white/10 rounded-xl px-4 py-2.5 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-white">
                          {m.title}
                        </div>
                        <div className="text-slate-400 font-mono-num">
                          {m.date} · {m.theme}
                        </div>
                      </div>
                      <div className="text-right font-mono-num text-amber-300 shrink-0">
                        {m.attendanceCount ?? m.participantNames.length} jóvenes
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ==================== TAB 5: PRIVACIDAD Y RECUPERACIÓN ==================== */}
      {overview && activeTab === 'privacidad' && (
        <div className="space-y-6">
          {!isAdmin ? (
            <div className="bg-[#111A2E] border border-amber-400/30 rounded-2xl p-8 text-center space-y-4">
              <Shield className="w-10 h-10 text-amber-300 mx-auto" />
              <h2 className="font-display font-bold text-xl text-white">
                Control Administrativo de Privacidad y Recuperación
              </h2>
              <p className="text-sm text-slate-300 max-w-lg mx-auto">
                Solo los administradores pueden definir quién puede ver, editar
                y compartir memorias, gestionar el consentimiento de menores,
                ocultar nombres/fotos por defecto y restaurar programas
                archivados.
              </p>
              <button
                type="button"
                onClick={() => {
                  setAuthError(null);
                  setPinInput('');
                  setShowAuthModal('admin');
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-sm cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                Desbloquear Modo Administrador
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Privacy Policy Form */}
              <form
                onSubmit={handleSavePrivacySettings}
                className="bg-[#111A2E] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4"
              >
                <h2 className="font-display font-bold text-lg text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-300" />
                  Políticas de Privacidad y Permisos
                </h2>

                <div className="space-y-3 text-sm">
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">
                      ¿Quién puede ver Nuestras Memorias?
                    </label>
                    <select
                      value={settingsForm.viewAccess}
                      onChange={(e) =>
                        setSettingsForm((p) => ({
                          ...p,
                          viewAccess: e.target.value as MemoryViewAccess,
                        }))
                      }
                      className="w-full bg-[#0B1221] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                    >
                      <option value="public">
                        Público (memorias marcadas como autorizadas)
                      </option>
                      <option value="members_code">
                        Solo miembros con código de acceso
                      </option>
                      <option value="admins_only">Solo administradores</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 mb-1">
                      ¿Quién puede registrar o editar memorias?
                    </label>
                    <select
                      value={settingsForm.editAccess}
                      onChange={(e) =>
                        setSettingsForm((p) => ({
                          ...p,
                          editAccess: e.target.value as MemoryEditAccess,
                        }))
                      }
                      className="w-full bg-[#0B1221] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                    >
                      <option value="admins_only">Solo administradores</option>
                      <option value="directors_code">
                        Administradores y directores con código
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 mb-1">
                      ¿Quién puede autorizar enlaces para compartir?
                    </label>
                    <select
                      value={settingsForm.shareAccess}
                      onChange={(e) =>
                        setSettingsForm((p) => ({
                          ...p,
                          shareAccess: e.target.value as MemoryShareAccess,
                        }))
                      }
                      className="w-full bg-[#0B1221] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                    >
                      <option value="admins_only">Solo administradores</option>
                      <option value="directors_code">
                        Administradores y directores con código
                      </option>
                    </select>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-white/10 text-xs text-slate-200">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settingsForm.hideNamesByDefault}
                        onChange={(e) =>
                          setSettingsForm((p) => ({
                            ...p,
                            hideNamesByDefault: e.target.checked,
                          }))
                        }
                        className="accent-amber-400"
                      />
                      Ocultar nombres personales por defecto en vistas públicas
                      y compartidas
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settingsForm.hidePhotosByDefault}
                        onChange={(e) =>
                          setSettingsForm((p) => ({
                            ...p,
                            hidePhotosByDefault: e.target.checked,
                          }))
                        }
                        className="accent-amber-400"
                      />
                      Ocultar fotografías por defecto en vistas públicas y
                      compartidas
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settingsForm.requireMinorGuardianConsent}
                        onChange={(e) =>
                          setSettingsForm((p) => ({
                            ...p,
                            requireMinorGuardianConsent: e.target.checked,
                          }))
                        }
                        className="accent-emerald-400"
                      />
                      Exigir autorización confirmada de padres/representantes
                      para fotos con menores
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/10">
                    <div>
                      <label className="block text-xs text-slate-300 mb-1">
                        Nuevo código de miembros/directores (opcional)
                      </label>
                      <input
                        type="text"
                        value={settingsForm.memberViewCode}
                        onChange={(e) =>
                          setSettingsForm((p) => ({
                            ...p,
                            memberViewCode: e.target.value,
                          }))
                        }
                        placeholder="Mín. 4 caracteres"
                        className="w-full bg-[#0B1221] border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-300 mb-1">
                        Cambiar PIN de administrador (opcional)
                      </label>
                      <input
                        type="password"
                        value={settingsForm.newAdminPin}
                        onChange={(e) =>
                          setSettingsForm((p) => ({
                            ...p,
                            newAdminPin: e.target.value,
                          }))
                        }
                        placeholder="Mín. 4 caracteres"
                        className="w-full bg-[#0B1221] border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingSettings}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-sm cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {savingSettings
                    ? 'Guardando políticas...'
                    : 'Guardar Políticas de Privacidad'}
                </button>
              </form>

              {/* Recovery & Archived Memories */}
              <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4">
                <h2 className="font-display font-bold text-lg text-white flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-sky-300" />
                  Recuperación de Programas y Archivo Histórico
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Ninguna semana se sobrescribe. Aquí puedes restaurar memorias
                  archivadas o usar el botón &ldquo;Recuperar en Programa del
                  Sábado&rdquo; en cualquier memoria activa para reutilizar su
                  estructura en una nueva fecha.
                </p>

                {archivedMemories.length === 0 ? (
                  <div className="bg-[#0B1221] border border-white/10 rounded-xl p-6 text-center text-xs text-slate-400">
                    No hay memorias archivadas pendientes de recuperación.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                    {archivedMemories.map((m) => (
                      <div
                        key={m.id}
                        className="bg-[#0B1221] border border-white/10 rounded-xl p-3.5 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="text-xs font-mono-num text-amber-300">
                            {m.date}
                          </div>
                          <div className="text-sm font-semibold text-white">
                            {m.title}
                          </div>
                          <div className="text-xs text-slate-400">{m.theme}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRestoreMemory(m.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-semibold cursor-pointer shrink-0"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Recuperar
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() =>
                      setEditorState({ open: true, memory: null })
                    }
                    className="inline-flex items-center gap-2 text-xs font-semibold text-sky-200 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 rounded-xl px-4 py-2.5 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    Importar Programa / Partida Anterior como Nueva Memoria
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== MODALS ==================== */}
      {showAuthModal && (
        <AuthPromptModal
          mode={showAuthModal}
          pinInput={pinInput}
          setPinInput={setPinInput}
          submitting={authSubmitting}
          error={authError}
          onClose={() => setShowAuthModal(null)}
          onSubmit={handleAuthSubmit}
        />
      )}

      {editorState.open && (
        <MemoryEditorModal
          initialMemory={editorState.memory}
          initialDate={editorState.initialDate}
          isAdmin={isAdmin}
          adminToken={adminToken}
          memberToken={memberToken}
          onClose={() => setEditorState({ open: false, memory: null })}
          onSaved={async (saved) => {
            setEditorState({ open: false, memory: null });
            await loadOverview();
            setSelectedMemoryId(saved.id);
            setActiveTab('archivo');
            showToastSuccess(
              `Memoria "${saved.title}" guardada de forma independiente (${saved.date}).`
            );
          }}
        />
      )}

      {shareModalMemory && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111A2E] border border-white/15 rounded-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg text-white flex items-center gap-2">
                <Share2 className="w-5 h-5 text-emerald-300" />
                Compartir Resumen Autorizado
              </h3>
              <button
                type="button"
                onClick={() => setShareModalMemory(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Los resúmenes compartidos respetan automáticamente las reglas de
              privacidad (ocultación de nombres/fotos y consentimiento de
              menores). Puedes activar o revocar el enlace cuando desees.
            </p>

            <div className="bg-[#0B1221] border border-white/10 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-white">
                  Estado del enlace público autorizado:
                </span>
                <span
                  className={`text-xs font-semibold ${
                    shareModalMemory.sharingEnabled
                      ? 'text-emerald-300'
                      : 'text-slate-400'
                  }`}
                >
                  {shareModalMemory.sharingEnabled
                    ? 'Activo y Autorizado'
                    : 'Desactivado'}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleToggleShare(
                      shareModalMemory,
                      !shareModalMemory.sharingEnabled
                    )
                  }
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                    shareModalMemory.sharingEnabled
                      ? 'bg-rose-500/20 text-rose-200 border border-rose-400/40'
                      : 'bg-emerald-500 text-slate-950'
                  }`}
                >
                  {shareModalMemory.sharingEnabled
                    ? 'Revocar Enlace'
                    : 'Autorizar Enlace Compartido'}
                </button>

                {shareModalMemory.sharingEnabled && shareModalMemory.shareToken && (
                  <button
                    type="button"
                    onClick={() =>
                      copyText(
                        'url',
                        `${window.location.origin}/?memoria=${shareModalMemory.shareToken}`
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#16213B] text-white border border-white/15 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copiedKey === 'url' ? 'Enlace copiado' : 'Copiar Enlace'}
                  </button>
                )}
              </div>

              {shareModalMemory.sharingEnabled && shareModalMemory.shareToken && (
                <div className="text-[11px] font-mono-num text-amber-200 break-all bg-[#111A2E] rounded-lg px-3 py-2 border border-white/10">
                  {`${typeof window !== 'undefined' ? window.location.origin : ''}/?memoria=${shareModalMemory.shareToken}`}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() =>
                  copyText('summary', buildShareSummaryText(shareModalMemory))
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                {copiedKey === 'summary'
                  ? 'Resumen copiado'
                  : 'Copiar Texto del Resumen'}
              </button>
              <button
                type="button"
                onClick={() => setShareModalMemory(null)}
                className="text-xs text-slate-300 hover:text-white px-3 py-2 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="max-w-3xl w-full bg-[#111A2E] border border-white/15 rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={resolvePhotoSrc(
                lightboxPhoto.photo.photoUrl,
                adminToken,
                memberToken
              )}
              alt={lightboxPhoto.photo.caption}
              referrerPolicy="no-referrer"
              className="w-full max-h-[70vh] object-contain bg-black"
            />
            <div className="p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">
                  {lightboxPhoto.photo.caption}
                </div>
                <div className="text-xs text-slate-400">
                  {lightboxPhoto.memoryDate} · {lightboxPhoto.memoryTitle}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="px-3.5 py-2 rounded-xl bg-[#0B1221] border border-white/15 text-xs text-white cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AuthPromptModal({
  mode,
  pinInput,
  setPinInput,
  submitting,
  error,
  onClose,
  onSubmit,
}: {
  mode: 'admin' | 'member';
  pinInput: string;
  setPinInput: (v: string) => void;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="bg-[#111A2E] border border-amber-400/35 rounded-2xl w-full max-w-md p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-lg text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-300" />
            {mode === 'admin'
              ? 'Acceso de Administrador'
              : 'Acceso de Miembros / Directores'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          {mode === 'admin'
            ? 'Ingresa la clave de administrador para gestionar privacidad, autorizar fotos de menores, editar memorias y recuperar registros.'
            : 'Ingresa el código de miembros o directores configurado por la administración.'}
        </p>

        {error && (
          <div className="bg-rose-500/15 border border-rose-400/40 text-rose-200 rounded-xl px-3 py-2 text-xs">
            {error}
          </div>
        )}

        <input
          type="password"
          autoFocus
          value={pinInput}
          onChange={(e) => setPinInput(e.target.value)}
          placeholder={
            mode === 'admin'
              ? 'Clave de administrador (por defecto la de director)'
              : 'Código de miembros'
          }
          className="w-full bg-[#0B1221] border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:text-white cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting || !pinInput.trim()}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer disabled:opacity-50"
          >
            {submitting ? 'Verificando...' : 'Desbloquear'}
          </button>
        </div>
      </form>
    </div>
  );
}
