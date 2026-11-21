import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BookOpen,
  CalendarRange,
  CheckCircle2,
  Clock,
  HeartHandshake,
  History,
  ImagePlus,
  KeyRound,
  Lock,
  Megaphone,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
  Unlock,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import type {
  MissionCategoryId,
  MissionCategoryMeta,
  MissionParticipantSummary,
  MissionParticipationType,
  MissionRecognition,
  MissionRegistration,
  WeeklyMission,
} from '../shared/weeklyMissionsData';
import {
  getOrCreateProfileKey,
  getSavedProfileName,
  saveProfileName,
} from '../utils/profileKey';

interface MisionSemanaViewProps {
  onBack: () => void;
}

type ActiveTab = 'misiones' | 'historial' | 'reconocimientos' | 'director';

interface MissionsStateResponse {
  categories: MissionCategoryMeta[];
  missions: WeeklyMission[];
  featuredMission: WeeklyMission;
  registrations: MissionRegistration[];
  recognitions: MissionRecognition[];
  summaries: MissionParticipantSummary[];
  weekWindow: { startDate: string; endDate: string; weekIndex: number };
  directorAuthorized: boolean;
}

const DIRECTOR_TOKEN_KEY = 'dtqd_missions_director_token';

function readDirectorToken(): string {
  try {
    return localStorage.getItem(DIRECTOR_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

function writeDirectorToken(token: string): void {
  try {
    if (token) {
      localStorage.setItem(DIRECTOR_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(DIRECTOR_TOKEN_KEY);
    }
  } catch {
    // ignore
  }
}

async function compressOptionalMissionPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagen no válido.'));
      img.onload = () => {
        const maxSide = 760;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.max(120, Math.round(img.width * scale));
        const h = Math.max(120, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo procesar la fotografía.'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);

        for (const q of [0.8, 0.65, 0.5, 0.35]) {
          const dataUrl = canvas.toDataURL('image/jpeg', q);
          const approxBytes = Math.round((dataUrl.length * 3) / 4);
          if (approxBytes <= 250 * 1024) {
            resolve(dataUrl);
            return;
          }
        }
        reject(
          new Error(
            'La imagen sigue superando el límite de 250 KB. Prueba con otra imagen más ligera.'
          )
        );
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

function getCategoryLabel(
  categories: MissionCategoryMeta[],
  id: MissionCategoryId
): string {
  return categories.find((c) => c.id === id)?.label || 'Misión';
}

function getCategoryIcon(id: MissionCategoryId) {
  switch (id) {
    case 'servicio':
      return HeartHandshake;
    case 'evangelismo':
      return Megaphone;
    case 'vida_espiritual':
      return BookOpen;
    case 'comunidad':
      return Users;
  }
}

function formatParticipationType(t: MissionParticipationType): string {
  if (t === 'individual') return 'Individual';
  if (t === 'grupal') return 'Grupal';
  return 'Individual o Grupal';
}

export function MisionSemanaView({ onBack }: MisionSemanaViewProps) {
  const localProfileKey = useMemo(() => getOrCreateProfileKey(), []);
  const [activeTab, setActiveTab] = useState<ActiveTab>('misiones');
  const [state, setState] = useState<MissionsStateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<
    MissionCategoryId | 'todas'
  >('todas');
  const [modeFilter, setModeFilter] = useState<
    'todas' | 'individual' | 'grupal'
  >('todas');
  const [searchQuery, setSearchQuery] = useState('');

  // History view toggle
  const [historyScope, setHistoryScope] = useState<'mis_misiones' | 'comunidad'>(
    'mis_misiones'
  );

  // Registration modal state
  const [selectedMission, setSelectedMission] = useState<WeeklyMission | null>(
    null
  );
  const [participantName, setParticipantName] = useState(() =>
    getSavedProfileName()
  );
  const [modeChosen, setModeChosen] = useState<'individual' | 'grupal'>(
    'individual'
  );
  const [groupName, setGroupName] = useState('');
  const [groupMemberCount, setGroupMemberCount] = useState(3);
  const [declarationText, setDeclarationText] = useState('');
  const [reflectionNote, setReflectionNote] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [photoConsentAuthorized, setPhotoConsentAuthorized] = useState(false);
  const [submittingRegistration, setSubmittingRegistration] = useState(false);

  // Director controls state
  const [directorToken, setDirectorToken] = useState(() => readDirectorToken());
  const [directorAuthorized, setDirectorAuthorized] = useState(false);
  const [directorPinInput, setDirectorPinInput] = useState('');
  const [directorNameInput, setDirectorNameInput] = useState(
    'Director de Jóvenes'
  );
  const [directorNoteDrafts, setDirectorNoteDrafts] = useState<
    Record<string, string>
  >({});

  // Custom mission creation form (Director)
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] =
    useState<MissionCategoryId>('servicio');
  const [newActivityType, setNewActivityType] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newBiblicalRef, setNewBiblicalRef] = useState('');
  const [newSpiritualFocus, setNewSpiritualFocus] = useState('');
  const [newParticipationType, setNewParticipationType] =
    useState<MissionParticipationType>('individual_o_grupal');
  const [newPointsReward, setNewPointsReward] = useState(160);
  const [newRequiresValidation, setNewRequiresValidation] = useState(false);
  const [newSetAsFeatured, setNewSetAsFeatured] = useState(true);
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newInstructionsRaw, setNewInstructionsRaw] = useState('');

  // Special recognition form (Director)
  const [recParticipantKey, setRecParticipantKey] = useState('');
  const [recTitle, setRecTitle] = useState('');
  const [recReason, setRecReason] = useState('');

  const loadState = useCallback(
    async (tokenOverride?: string) => {
      const tok = tokenOverride !== undefined ? tokenOverride : directorToken;
      try {
        const res = await fetch('/api/missions/state', {
          headers: tok ? { Authorization: `Bearer ${tok}` } : undefined,
        });
        if (!res.ok) throw new Error('No se pudo cargar Misión de la Semana.');
        const data = (await res.json()) as MissionsStateResponse;
        setState(data);
        setDirectorAuthorized(Boolean(data.directorAuthorized));
        if (!newStartDate && data.weekWindow?.startDate) {
          setNewStartDate(data.weekWindow.startDate);
        }
        if (!newEndDate && data.weekWindow?.endDate) {
          setNewEndDate(data.weekWindow.endDate);
        }
      } catch (err) {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Error cargando Misión de la Semana.'
        );
      } finally {
        setLoading(false);
      }
    },
    [directorToken, newStartDate, newEndDate]
  );

  useEffect(() => {
    loadState();
  }, [loadState]);

  const registeredMissionIdsForMe = useMemo(() => {
    const ids = new Set<string>();
    if (!state) return ids;
    const normMyName = participantName.trim().toLowerCase();
    for (const r of state.registrations) {
      if (r.status === 'rejected') continue;
      if (
        r.participantKey === localProfileKey ||
        (normMyName && r.participantName.trim().toLowerCase() === normMyName)
      ) {
        ids.add(r.missionId);
      }
    }
    return ids;
  }, [state, localProfileKey, participantName]);

  const mySummary = useMemo(() => {
    if (!state) return null;
    return (
      state.summaries.find((s) => s.participantKey === localProfileKey) || null
    );
  }, [state, localProfileKey]);

  const pendingRegistrations = useMemo(() => {
    if (!state) return [];
    return state.registrations.filter((r) => r.status === 'pending_validation');
  }, [state]);

  const filteredMissions = useMemo(() => {
    if (!state) return [];
    const q = searchQuery.trim().toLowerCase();
    return state.missions.filter((m) => {
      if (categoryFilter !== 'todas' && m.category !== categoryFilter) {
        return false;
      }
      if (
        modeFilter === 'individual' &&
        m.participationType === 'grupal'
      ) {
        return false;
      }
      if (
        modeFilter === 'grupal' &&
        m.participationType === 'individual'
      ) {
        return false;
      }
      if (q) {
        const hay = `${m.title} ${m.activityType} ${m.description} ${m.biblicalReference}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [state, categoryFilter, modeFilter, searchQuery]);

  const visibleRegistrations = useMemo(() => {
    if (!state) return [];
    if (historyScope === 'comunidad') return state.registrations;
    const normMyName = participantName.trim().toLowerCase();
    return state.registrations.filter(
      (r) =>
        r.participantKey === localProfileKey ||
        (normMyName && r.participantName.trim().toLowerCase() === normMyName)
    );
  }, [state, historyScope, localProfileKey, participantName]);

  const openRegistrationModal = (mission: WeeklyMission) => {
    setErrorMsg('');
    setSuccessMsg('');
    setSelectedMission(mission);
    setModeChosen(
      mission.participationType === 'grupal' ? 'grupal' : 'individual'
    );
    setGroupName('');
    setGroupMemberCount(3);
    setDeclarationText('');
    setReflectionNote('');
    setPhotoDataUrl('');
    setPhotoConsentAuthorized(false);
  };

  const handlePhotoFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg('');
    try {
      const compressed = await compressOptionalMissionPhoto(file);
      setPhotoDataUrl(compressed);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No se pudo cargar la fotografía.'
      );
    }
  };

  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMission) return;
    setErrorMsg('');
    setSuccessMsg('');

    if (photoDataUrl && !photoConsentAuthorized) {
      setErrorMsg(
        'Debes confirmar la autorización de privacidad para adjuntar una fotografía opcional.'
      );
      return;
    }

    setSubmittingRegistration(true);
    try {
      const cleanName = participantName.trim();
      saveProfileName(cleanName);

      const res = await fetch('/api/missions/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          missionId: selectedMission.id,
          participantKey: localProfileKey,
          participantName: cleanName,
          modeChosen,
          groupName: modeChosen === 'grupal' ? groupName : undefined,
          groupMemberCount:
            modeChosen === 'grupal' ? groupMemberCount : undefined,
          declarationText,
          reflectionNote,
          photoDataUrl: photoDataUrl || undefined,
          photoConsentAuthorized: Boolean(photoDataUrl) && photoConsentAuthorized,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'No se pudo registrar la participación.');
      }

      const reg: MissionRegistration = data.registration;
      setSuccessMsg(
        reg.status === 'approved'
          ? `¡Misión registrada con éxito! Ganaste +${reg.pointsAwarded} puntos de participación.`
          : '¡Registro enviado! Quedó en revisión para validación de un director autorizado.'
      );
      setSelectedMission(null);
      await loadState();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Error al registrar misión.'
      );
    } finally {
      setSubmittingRegistration(false);
    }
  };

  const handleDirectorAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/missions/director/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: directorPinInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Clave incorrecta.');
      }
      writeDirectorToken(data.directorToken);
      setDirectorToken(data.directorToken);
      setDirectorAuthorized(true);
      setDirectorPinInput('');
      setSuccessMsg('Acceso de director autorizado habilitado.');
      await loadState(data.directorToken);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Error de autenticación.'
      );
    }
  };

  const handleDirectorLogout = async () => {
    writeDirectorToken('');
    setDirectorToken('');
    setDirectorAuthorized(false);
    await loadState('');
  };

  const handleValidateRegistration = async (
    regId: string,
    decision: 'approved' | 'rejected'
  ) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/missions/registrations/${regId}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${directorToken}`,
        },
        body: JSON.stringify({
          decision,
          directorName: directorNameInput,
          directorNote: directorNoteDrafts[regId] || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo validar.');
      setSuccessMsg(
        decision === 'approved'
          ? 'Participación aprobada y puntos acreditados.'
          : 'Participación devuelta con observación.'
      );
      await loadState();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al validar.');
    }
  };

  const handleSetFeatured = async (missionId: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/missions/featured', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${directorToken}`,
        },
        body: JSON.stringify({ missionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo actualizar.');
      setSuccessMsg('Misión de la Semana actualizada para toda la iglesia.');
      await loadState();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Error fijando misión destacada.'
      );
    }
  };

  const handleCreateCustomMission = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const instructions = newInstructionsRaw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      const res = await fetch('/api/missions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${directorToken}`,
        },
        body: JSON.stringify({
          title: newTitle,
          category: newCategory,
          activityType: newActivityType || 'Desafío juvenil semanal',
          description: newDescription,
          biblicalReference: newBiblicalRef,
          spiritualFocus: newSpiritualFocus,
          participationType: newParticipationType,
          pointsReward: newPointsReward,
          requiresDirectorValidation: newRequiresValidation,
          setAsFeatured: newSetAsFeatured,
          startDate: newStartDate,
          endDate: newEndDate,
          instructions: instructions.length > 0 ? instructions : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'No se pudo crear la misión.');
      }
      setNewTitle('');
      setNewActivityType('');
      setNewDescription('');
      setNewBiblicalRef('');
      setNewSpiritualFocus('');
      setNewInstructionsRaw('');
      setSuccessMsg('Nueva misión semanal creada y publicada.');
      await loadState();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Error creando misión semanal.'
      );
    }
  };

  const handleDeleteCustomMission = async (id: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/missions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${directorToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo eliminar.');
      setSuccessMsg('Misión personalizada eliminada.');
      await loadState();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Error eliminando misión.'
      );
    }
  };

  const handleGrantRecognition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state) return;
    setErrorMsg('');
    setSuccessMsg('');
    const target = state.summaries.find(
      (s) => s.participantKey === recParticipantKey
    );
    if (!target) {
      setErrorMsg('Selecciona un participante activo de la lista.');
      return;
    }
    try {
      const res = await fetch('/api/missions/recognitions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${directorToken}`,
        },
        body: JSON.stringify({
          participantKey: target.participantKey,
          participantName: target.participantName,
          title: recTitle,
          reason: recReason,
          grantedBy: directorNameInput || 'Director de Jóvenes',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'No se pudo otorgar el reconocimiento.');
      }
      setRecTitle('');
      setRecReason('');
      setSuccessMsg(
        `Reconocimiento otorgado a ${target.participantName}.`
      );
      await loadState();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Error otorgando reconocimiento.'
      );
    }
  };

  if (loading || !state) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-8 text-center text-slate-300">
          Cargando Misión de la Semana...
        </div>
      </div>
    );
  }

  const featured = state.featuredMission;
  const FeaturedIcon = getCategoryIcon(featured.category);
  const featuredAlreadyRegistered = registeredMissionIdsForMe.has(featured.id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800 pb-6">
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer mb-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio
          </button>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight text-balance">
            Misión de la Semana
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Desafíos semanales voluntarios para vivir la fe en servicio,
            evangelismo, vida espiritual y comunidad. Participación segura,
            sin penalizaciones y sin exposición de datos privados.
          </p>
        </div>

        {/* Personal KPI summary strip (clean, tabular, zero pill clutter) */}
        <div className="grid grid-cols-3 gap-4 bg-[#111A2E] border border-slate-800 rounded-2xl px-5 py-3.5 shrink-0">
          <div>
            <p className="text-[11px] font-semibold text-slate-400">
              Mis Puntos
            </p>
            <p className="font-mono-num text-xl font-extrabold text-amber-300 tabular-nums">
              {mySummary?.totalPoints || 0}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-400">
              Cumplidas
            </p>
            <p className="font-mono-num text-xl font-extrabold text-emerald-400 tabular-nums">
              {mySummary?.completedCount || 0}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-400">
              Semana {state.weekWindow.weekIndex}
            </p>
            <p className="font-mono-num text-xs font-bold text-slate-200 mt-1 tabular-nums">
              {state.weekWindow.startDate}
            </p>
          </div>
        </div>
      </header>

      {/* Privacy & Voluntary Commitment Banner */}
      <div className="bg-[#0E172A] border border-emerald-500/25 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          <strong className="text-white">Compromiso de Privacidad y Gracia:</strong>{' '}
          La participación es 100% voluntaria y no resta puntos si una semana no
          puedes participar. Nunca solicitamos ubicaciones exactas ni fotografías
          de terceros; registra tu misión mediante declaración de cumplimiento o
          validación del director.
        </p>
      </div>

      {/* Feedback alerts */}
      {errorMsg && (
        <div className="bg-rose-500/15 border border-rose-500/40 text-rose-200 rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-3">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg('')}
            className="text-rose-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-3">
          <span>{successMsg}</span>
          <button
            type="button"
            onClick={() => setSuccessMsg('')}
            className="text-emerald-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <nav className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('misiones')}
          className={`px-4 py-2.5 rounded-xl text-sm font-bold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'misiones'
              ? 'bg-amber-400 text-slate-950'
              : 'bg-[#111A2E] text-slate-300 hover:text-white border border-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Misión y Desafíos
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('historial')}
          className={`px-4 py-2.5 rounded-xl text-sm font-bold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'historial'
              ? 'bg-amber-400 text-slate-950'
              : 'bg-[#111A2E] text-slate-300 hover:text-white border border-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          Historial ({state.registrations.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reconocimientos')}
          className={`px-4 py-2.5 rounded-xl text-sm font-bold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'reconocimientos'
              ? 'bg-amber-400 text-slate-950'
              : 'bg-[#111A2E] text-slate-300 hover:text-white border border-slate-800'
          }`}
        >
          <Trophy className="w-4 h-4" />
          Reconocimientos ({state.recognitions.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('director')}
          className={`px-4 py-2.5 rounded-xl text-sm font-bold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'director'
              ? 'bg-amber-400 text-slate-950'
              : 'bg-[#111A2E] text-slate-300 hover:text-white border border-slate-800'
          }`}
        >
          {directorAuthorized ? (
            <Unlock className="w-4 h-4" />
          ) : (
            <Lock className="w-4 h-4" />
          )}
          Director Autorizado
          {pendingRegistrations.length > 0 && (
            <span className="font-mono-num text-xs font-extrabold px-1.5 py-0.5 rounded bg-rose-500 text-white">
              {pendingRegistrations.length}
            </span>
          )}
        </button>
      </nav>

      {/* TAB 1: FEATURED WEEKLY MISSION + CATALOG */}
      {activeTab === 'misiones' && (
        <div className="space-y-8">
          {/* Featured Mission of the Week */}
          <section className="bg-gradient-to-br from-[#16223D] to-[#0E1629] border border-amber-400/40 rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
              <div className="space-y-3 max-w-3xl">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-300 flex flex-wrap items-center gap-2">
                  <FeaturedIcon className="w-4 h-4" />
                  Misión Destacada de la Semana ·{' '}
                  {getCategoryLabel(state.categories, featured.category)} ·{' '}
                  {formatParticipationType(featured.participationType)}
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white text-balance">
                  {featured.title}
                </h2>
                <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
                  {featured.description}
                </p>
              </div>

              <div className="bg-[#080E1E]/80 border border-slate-800 rounded-2xl p-4 min-w-[230px] space-y-2 shrink-0">
                <div className="flex items-center gap-2 text-xs text-slate-300 font-mono-num tabular-nums">
                  <CalendarRange className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    {featured.startDate} al {featured.endDate}
                  </span>
                </div>
                <p className="font-mono-num text-2xl font-extrabold text-amber-300 tabular-nums">
                  +{featured.pointsReward} pts
                </p>
                <p className="text-xs text-slate-400">
                  {featured.requiresDirectorValidation
                    ? 'Requiere validación de director'
                    : 'Registro directo por declaración'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 bg-[#080E1E]/60 border border-slate-800 rounded-2xl p-5 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Instrucciones claras de participación
                </h3>
                <ol className="space-y-2.5 text-sm text-slate-200">
                  {featured.instructions.map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="font-mono-num w-6 h-6 rounded-lg bg-amber-400/15 text-amber-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="lg:col-span-5 space-y-4">
                <div className="bg-[#080E1E]/60 border border-slate-800 rounded-2xl p-5 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-sky-300">
                    Enfoque Bíblico · {featured.biblicalReference}
                  </p>
                  <p className="text-sm text-slate-200 leading-relaxed">
                    {featured.spiritualFocus}
                  </p>
                </div>

                {featuredAlreadyRegistered ? (
                  <div className="w-full px-5 py-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-200 font-bold text-sm inline-flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Ya registraste tu participación en esta misión
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openRegistrationModal(featured)}
                    className="w-full px-6 py-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-base inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Registrar Mi Participación
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* 4 Categories Summary Strip */}
          <section className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-extrabold text-white">
                  Catálogo de Misiones por Categoría
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Elige cualquier desafío activo esta semana según tu categoría
                  y disponibilidad.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar misión o cita..."
                    className="bg-[#111A2E] border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <select
                  value={modeFilter}
                  onChange={(e) =>
                    setModeFilter(
                      e.target.value as 'todas' | 'individual' | 'grupal'
                    )
                  }
                  className="bg-[#111A2E] border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="todas">Todas las modalidades</option>
                  <option value="individual">Individual</option>
                  <option value="grupal">Grupal</option>
                </select>
              </div>
            </div>

            {/* Category filter bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <button
                type="button"
                onClick={() => setCategoryFilter('todas')}
                className={`text-left rounded-2xl p-4 border transition-colors cursor-pointer ${
                  categoryFilter === 'todas'
                    ? 'bg-amber-400/15 border-amber-400 text-white'
                    : 'bg-[#111A2E] border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <p className="font-display font-bold text-sm">
                  Todas las Categorías
                </p>
                <p className="text-xs text-slate-400 mt-1 font-mono-num tabular-nums">
                  {state.missions.length} misiones activas
                </p>
              </button>

              {state.categories.map((cat) => {
                const Icon = getCategoryIcon(cat.id);
                const count = state.missions.filter(
                  (m) => m.category === cat.id
                ).length;
                const active = categoryFilter === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`text-left rounded-2xl p-4 border transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#172340] border-amber-400 text-white'
                        : 'bg-[#111A2E] border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display font-bold text-sm text-white">
                        {cat.label}
                      </span>
                      <Icon
                        className="w-4 h-4 shrink-0"
                        style={{ color: cat.accentColor }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {cat.subtitle}
                    </p>
                    <p className="text-[11px] font-mono-num text-slate-400 mt-2 tabular-nums">
                      {count} desafíos
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Mission Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredMissions.map((mission) => {
                const Icon = getCategoryIcon(mission.category);
                const alreadyRegistered = registeredMissionIdsForMe.has(
                  mission.id
                );
                return (
                  <article
                    key={mission.id}
                    className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-5"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-200">
                          <Icon className="w-4 h-4 text-amber-400 shrink-0" />
                          {getCategoryLabel(state.categories, mission.category)}
                        </span>
                        <span className="font-mono-num font-bold text-amber-300 tabular-nums">
                          +{mission.pointsReward} pts
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-sky-300">
                          {mission.activityType}
                        </p>
                        <h3 className="font-display font-bold text-lg text-white leading-snug">
                          {mission.title}
                        </h3>
                        <p className="text-sm text-slate-300 leading-relaxed">
                          {mission.description}
                        </p>
                      </div>

                      <div className="text-xs text-slate-400 space-y-1 pt-2 border-t border-slate-800/80">
                        <p className="font-mono-num tabular-nums">
                          Vigencia: {mission.startDate} al {mission.endDate}
                        </p>
                        <p>
                          Modalidad:{' '}
                          <span className="text-slate-200 font-medium">
                            {formatParticipationType(mission.participationType)}
                          </span>{' '}
                          · Cita:{' '}
                          <span className="text-slate-200 font-medium">
                            {mission.biblicalReference}
                          </span>
                        </p>
                        <p>
                          Validación:{' '}
                          <span className="text-slate-200">
                            {mission.requiresDirectorValidation
                              ? 'Requiere director autorizado'
                              : 'Declaración de cumplimiento'}
                          </span>
                        </p>
                      </div>
                    </div>

                    {alreadyRegistered ? (
                      <div className="w-full px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-200 text-xs font-bold inline-flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        Participación ya registrada
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openRegistrationModal(mission)}
                        className="w-full px-4 py-3 rounded-xl bg-slate-800 hover:bg-amber-400 hover:text-slate-950 text-white font-bold text-sm transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Participar en esta misión
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: HISTORIAL DE MISIONES */}
      {activeTab === 'historial' && (
        <section className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-extrabold text-white">
                Historial de Misiones Cumplidas
              </h2>
              <p className="text-sm text-slate-400">
                Cada registro evita duplicación de puntos y protege la
                privacidad de los participantes.
              </p>
            </div>

            <div className="inline-flex bg-[#111A2E] border border-slate-800 rounded-xl p-1">
              <button
                type="button"
                onClick={() => setHistoryScope('mis_misiones')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap ${
                  historyScope === 'mis_misiones'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Mis Misiones
              </button>
              <button
                type="button"
                onClick={() => setHistoryScope('comunidad')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap ${
                  historyScope === 'comunidad'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Comunidad
              </button>
            </div>
          </div>

          {visibleRegistrations.length === 0 ? (
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-8 text-center space-y-2">
              <p className="font-display font-bold text-lg text-white">
                Aún no hay misiones registradas en esta vista
              </p>
              <p className="text-sm text-slate-400">
                Elige un desafío en la pestaña &ldquo;Misión y Desafíos&rdquo;
                para registrar tu primera participación voluntaria.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleRegistrations.map((reg) => (
                <div
                  key={reg.id}
                  className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-start md:justify-between gap-4"
                >
                  <div className="space-y-2 max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="font-bold text-white">
                        {reg.participantName}
                      </span>
                      <span>·</span>
                      <span>
                        {getCategoryLabel(state.categories, reg.category)}
                      </span>
                      <span>·</span>
                      <span>
                        {reg.modeChosen === 'grupal'
                          ? `Grupal (${reg.groupName || 'Equipo'} · ${reg.groupMemberCount || 2} jóvenes)`
                          : 'Individual'}
                      </span>
                      <span>·</span>
                      <span className="font-mono-num tabular-nums">
                        {new Date(reg.submittedAt).toLocaleDateString('es-ES')}
                      </span>
                    </div>

                    <h3 className="font-display font-bold text-lg text-white">
                      {reg.missionTitle}
                    </h3>

                    <p className="text-sm text-slate-300 leading-relaxed">
                      {reg.declarationText}
                    </p>

                    {reg.reflectionNote && (
                      <p className="text-xs text-sky-300">
                        Reflexión: {reg.reflectionNote}
                      </p>
                    )}

                    {reg.directorNote && (
                      <p className="text-xs text-amber-300">
                        Nota del director: {reg.directorNote}
                      </p>
                    )}

                    {reg.photoDataUrl && (
                      <div className="pt-2">
                        <img
                          src={reg.photoDataUrl}
                          alt="Evidencia opcional autorizada"
                          className="w-40 h-28 object-cover rounded-xl border border-slate-700"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex md:flex-col items-center md:items-end justify-between gap-2 shrink-0">
                    {reg.status === 'approved' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                        <CheckCircle2 className="w-4 h-4" />
                        Validada
                      </span>
                    ) : reg.status === 'pending_validation' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300">
                        <Clock className="w-4 h-4" />
                        Pendiente de validación
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-rose-300">
                        Observada
                      </span>
                    )}

                    <p className="font-mono-num text-xl font-extrabold text-amber-300 tabular-nums">
                      +{reg.pointsAwarded} pts
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 3: RECONOCIMIENTOS Y PARTICIPACIÓN */}
      {activeTab === 'reconocimientos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-7 space-y-4">
            <div>
              <h2 className="font-display text-2xl font-extrabold text-white">
                Reconocimientos Desbloqueados y Especiales
              </h2>
              <p className="text-sm text-slate-400">
                Se otorgan automáticamente por constancia y categorías, o por
                mención especial del director juvenil.
              </p>
            </div>

            {state.recognitions.length === 0 ? (
              <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 text-sm text-slate-400">
                Aún no hay reconocimientos otorgados. Completa tu primera misión
                para desbloquear &ldquo;Paso de Fe&rdquo;.
              </div>
            ) : (
              <div className="space-y-3">
                {state.recognitions.map((rec) => (
                  <div
                    key={rec.id}
                    className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 flex items-start gap-4"
                  >
                    <div className="w-10 h-10 rounded-xl bg-amber-400/15 text-amber-300 flex items-center justify-center shrink-0">
                      <Award className="w-5 h-5" />
                    </div>
                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-display font-bold text-base text-white">
                          {rec.title}
                        </h3>
                        <span className="text-xs text-slate-400 font-mono-num tabular-nums">
                          {new Date(rec.grantedAt).toLocaleDateString('es-ES')}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-amber-300">
                        {rec.participantName} ·{' '}
                        {rec.isAutomatic ? 'Hito Automático' : rec.grantedBy}
                      </p>
                      <p className="text-sm text-slate-300">{rec.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="lg:col-span-5 space-y-4">
            <div>
              <h2 className="font-display text-2xl font-extrabold text-white">
                Participación Voluntaria
              </h2>
              <p className="text-sm text-slate-400">
                Puntos acumulados por servicio y desafíos cumplidos (sin
                penalizaciones).
              </p>
            </div>

            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl divide-y divide-slate-800">
              {state.summaries.length === 0 ? (
                <p className="p-6 text-sm text-slate-400">
                  Sé el primero en registrar una misión esta semana.
                </p>
              ) : (
                state.summaries.map((s, idx) => (
                  <div
                    key={s.participantKey}
                    className="p-4 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono-num text-sm font-extrabold text-slate-400 w-6 tabular-nums">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-white truncate">
                          {s.participantName}
                        </p>
                        <p className="text-xs text-slate-400 font-mono-num tabular-nums">
                          {s.completedCount} cumplidas · {s.recognitionsCount}{' '}
                          reconocimientos
                        </p>
                      </div>
                    </div>
                    <p className="font-mono-num text-base font-extrabold text-amber-300 tabular-nums shrink-0">
                      {s.totalPoints} pts
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {/* TAB 4: PANEL DE DIRECTOR AUTORIZADO */}
      {activeTab === 'director' && (
        <section className="space-y-8">
          {!directorAuthorized ? (
            <form
              onSubmit={handleDirectorAuth}
              className="max-w-md bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-4"
            >
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h2 className="font-display text-xl font-extrabold text-white">
                  Acceso de Director Autorizado
                </h2>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                Solo los directores autorizados pueden validar misiones
                grupales, fijar la Misión de la Semana, crear nuevos desafíos u
                otorgar reconocimientos especiales.
              </p>
              <p className="text-xs text-slate-400">
                Clave predeterminada de coordinación juvenil:{' '}
                <span className="font-mono-num font-bold text-slate-200">
                  SJ2026
                </span>
              </p>
              <input
                type="password"
                value={directorPinInput}
                onChange={(e) => setDirectorPinInput(e.target.value)}
                placeholder="Ingresa clave de director"
                required
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                className="w-full px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm transition-colors cursor-pointer"
              >
                Desbloquear Panel de Director
              </button>
            </form>
          ) : (
            <div className="space-y-8">
              <div className="flex flex-wrap items-center justify-between gap-4 bg-[#111A2E] border border-emerald-500/30 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <UserCheck className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-sm font-bold text-white">
                      Sesión de Director Autorizado activa
                    </p>
                    <p className="text-xs text-slate-400">
                      Tus validaciones y publicaciones quedan firmadas con tu
                      nombre de coordinación.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={directorNameInput}
                    onChange={(e) => setDirectorNameInput(e.target.value)}
                    placeholder="Tu nombre de director"
                    className="bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={handleDirectorLogout}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer whitespace-nowrap"
                  >
                    Cerrar sesión
                  </button>
                </div>
              </div>

              {/* 1. Validation Queue */}
              <div className="space-y-4">
                <h3 className="font-display text-xl font-extrabold text-white">
                  Misiones Pendientes de Validación ({pendingRegistrations.length})
                </h3>
                {pendingRegistrations.length === 0 ? (
                  <p className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 text-sm text-slate-400">
                    No hay registros pendientes por validar en este momento.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {pendingRegistrations.map((reg) => (
                      <div
                        key={reg.id}
                        className="bg-[#111A2E] border border-amber-400/30 rounded-2xl p-5 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-bold text-base text-white">
                              {reg.participantName} · {reg.missionTitle}
                            </p>
                            <p className="text-xs text-slate-400">
                              {reg.modeChosen === 'grupal'
                                ? `Grupal (${reg.groupName} · ${reg.groupMemberCount} jóvenes)`
                                : 'Individual'}
                            </p>
                          </div>
                          <span className="font-mono-num text-xs font-bold text-amber-300">
                            {new Date(reg.submittedAt).toLocaleDateString(
                              'es-ES'
                            )}
                          </span>
                        </div>

                        <p className="text-sm text-slate-200">
                          {reg.declarationText}
                        </p>

                        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                          <input
                            type="text"
                            value={directorNoteDrafts[reg.id] || ''}
                            onChange={(e) =>
                              setDirectorNoteDrafts((prev) => ({
                                ...prev,
                                [reg.id]: e.target.value,
                              }))
                            }
                            placeholder="Nota opcional del director..."
                            className="flex-1 bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleValidateRegistration(reg.id, 'approved')
                            }
                            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer whitespace-nowrap"
                          >
                            Aprobar y otorgar puntos
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleValidateRegistration(reg.id, 'rejected')
                            }
                            className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 font-bold text-xs cursor-pointer whitespace-nowrap"
                          >
                            Devolver con observación
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Featured selector & Create Custom Mission + Grant Recognition */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <form
                  onSubmit={handleCreateCustomMission}
                  className="lg:col-span-7 bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-4"
                >
                  <div className="flex items-center gap-2">
                    <Plus className="w-5 h-5 text-amber-400" />
                    <h3 className="font-display text-xl font-extrabold text-white">
                      Crear Nueva Misión Semanal
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Título de la misión"
                      className="bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                    />
                    <select
                      value={newCategory}
                      onChange={(e) =>
                        setNewCategory(e.target.value as MissionCategoryId)
                      }
                      className="bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                    >
                      {state.categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={newActivityType}
                      onChange={(e) => setNewActivityType(e.target.value)}
                      placeholder="Tipo de actividad (ej: Visitar a alguien)"
                      className="bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                    />
                    <input
                      type="text"
                      required
                      value={newBiblicalRef}
                      onChange={(e) => setNewBiblicalRef(e.target.value)}
                      placeholder="Cita bíblica (ej: Mateo 5:16)"
                      className="bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                    />
                  </div>

                  <textarea
                    required
                    rows={3}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Descripción clara de la misión..."
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                  />

                  <textarea
                    rows={2}
                    value={newInstructionsRaw}
                    onChange={(e) => setNewInstructionsRaw(e.target.value)}
                    placeholder="Instrucciones (una por línea, opcional)"
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                  />

                  <input
                    type="text"
                    value={newSpiritualFocus}
                    onChange={(e) => setNewSpiritualFocus(e.target.value)}
                    placeholder="Enfoque espiritual (opcional)"
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Inicio
                      </label>
                      <input
                        type="date"
                        value={newStartDate}
                        onChange={(e) => setNewStartDate(e.target.value)}
                        className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Finalización
                      </label>
                      <input
                        type="date"
                        value={newEndDate}
                        onChange={(e) => setNewEndDate(e.target.value)}
                        className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Puntos
                      </label>
                      <input
                        type="number"
                        min={50}
                        max={500}
                        value={newPointsReward}
                        onChange={(e) =>
                          setNewPointsReward(Number(e.target.value) || 150)
                        }
                        className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono-num"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
                    <select
                      value={newParticipationType}
                      onChange={(e) =>
                        setNewParticipationType(
                          e.target.value as MissionParticipationType
                        )
                      }
                      className="bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      <option value="individual_o_grupal">
                        Individual o Grupal
                      </option>
                      <option value="individual">Solo Individual</option>
                      <option value="grupal">Solo Grupal</option>
                    </select>

                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newRequiresValidation}
                        onChange={(e) =>
                          setNewRequiresValidation(e.target.checked)
                        }
                      />
                      Requiere validación del director
                    </label>

                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newSetAsFeatured}
                        onChange={(e) => setNewSetAsFeatured(e.target.checked)}
                      />
                      Fijar como Misión de la Semana
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm transition-colors cursor-pointer"
                  >
                    Publicar Misión Semanal
                  </button>
                </form>

                <div className="lg:col-span-5 space-y-6">
                  {/* Grant special recognition */}
                  <form
                    onSubmit={handleGrantRecognition}
                    className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-3"
                  >
                    <h3 className="font-display text-lg font-extrabold text-white">
                      Otorgar Reconocimiento Especial
                    </h3>
                    <select
                      value={recParticipantKey}
                      onChange={(e) => setRecParticipantKey(e.target.value)}
                      required
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
                    >
                      <option value="">Selecciona participante...</option>
                      {state.summaries.map((s) => (
                        <option key={s.participantKey} value={s.participantKey}>
                          {s.participantName} ({s.totalPoints} pts)
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      required
                      value={recTitle}
                      onChange={(e) => setRecTitle(e.target.value)}
                      placeholder="Título (ej: Espíritu de Servicio)"
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
                    />
                    <input
                      type="text"
                      required
                      value={recReason}
                      onChange={(e) => setRecReason(e.target.value)}
                      placeholder="Motivo edificante..."
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
                    />
                    <button
                      type="submit"
                      className="w-full px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm cursor-pointer"
                    >
                      Otorgar Reconocimiento
                    </button>
                  </form>

                  {/* Choose featured mission from catalog */}
                  <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-3">
                    <h3 className="font-display text-lg font-extrabold text-white">
                      Elegir Misión Destacada
                    </h3>
                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                      {state.missions.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between gap-2 bg-[#080E1E] border border-slate-800 rounded-xl px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">
                              {m.title}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {getCategoryLabel(state.categories, m.category)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleSetFeatured(m.id)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer whitespace-nowrap ${
                                m.isFeaturedCurrentWeek
                                  ? 'bg-amber-400 text-slate-950'
                                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                              }`}
                            >
                              {m.isFeaturedCurrentWeek ? 'Activa' : 'Destacar'}
                            </button>
                            {m.isCustom && (
                              <button
                                type="button"
                                onClick={() => handleDeleteCustomMission(m.id)}
                                className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15 cursor-pointer"
                                title="Eliminar misión personalizada"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* REGISTRATION MODAL */}
      {selectedMission && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111A2E] border border-slate-700 rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-amber-300">
                  Registro Voluntario · +{selectedMission.pointsReward} pts
                </p>
                <h2 className="font-display text-xl font-extrabold text-white mt-0.5">
                  {selectedMission.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMission(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRegistration} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Tu nombre o apodo de participación
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={60}
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  placeholder="Ej: Sofía Ramírez"
                  className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {selectedMission.participationType === 'individual_o_grupal' && (
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setModeChosen('individual')}
                    className={`py-2.5 rounded-xl text-xs font-bold border cursor-pointer ${
                      modeChosen === 'individual'
                        ? 'bg-amber-400 text-slate-950 border-amber-400'
                        : 'bg-[#080E1E] text-slate-300 border-slate-700'
                    }`}
                  >
                    Participación Individual
                  </button>
                  <button
                    type="button"
                    onClick={() => setModeChosen('grupal')}
                    className={`py-2.5 rounded-xl text-xs font-bold border cursor-pointer ${
                      modeChosen === 'grupal'
                        ? 'bg-amber-400 text-slate-950 border-amber-400'
                        : 'bg-[#080E1E] text-slate-300 border-slate-700'
                    }`}
                  >
                    Participación Grupal
                  </button>
                </div>
              )}

              {modeChosen === 'grupal' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Nombre del grupo o equipo juvenil
                    </label>
                    <input
                      type="text"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="Ej: Equipo Caleb"
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Integrantes
                    </label>
                    <input
                      type="number"
                      min={2}
                      max={80}
                      value={groupMemberCount}
                      onChange={(e) =>
                        setGroupMemberCount(Number(e.target.value) || 2)
                      }
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono-num"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Declaración de cumplimiento (sin ubicaciones exactas ni datos
                  privados de terceros)
                </label>
                <textarea
                  required
                  minLength={8}
                  maxLength={500}
                  rows={3}
                  value={declarationText}
                  onChange={(e) => setDeclarationText(e.target.value)}
                  placeholder="Cuéntanos brevemente cómo cumpliste la misión y qué edificó tu fe..."
                  className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Reflexión o versículo que te inspiró (opcional)
                </label>
                <input
                  type="text"
                  maxLength={300}
                  value={reflectionNote}
                  onChange={(e) => setReflectionNote(e.target.value)}
                  placeholder="Ej: Dios nos recordó el valor de escuchar con amor"
                  className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                />
              </div>

              {/* Strictly Optional Photo with Mandatory Privacy Authorization */}
              <div className="bg-[#080E1E] border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-200">
                      Fotografía ilustrativa (estrictamente opcional)
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Nunca subas rostros de terceros ni datos privados. Puedes
                      registrar solo con tu declaración.
                    </p>
                  </div>
                  <label className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0">
                    <ImagePlus className="w-4 h-4" />
                    Adjuntar
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePhotoFileChange}
                      className="hidden"
                    />
                  </label>
                </div>

                {photoDataUrl && (
                  <div className="space-y-2.5 pt-1">
                    <div className="flex items-center gap-3">
                      <img
                        src={photoDataUrl}
                        alt="Vista previa opcional"
                        className="w-20 h-16 object-cover rounded-lg border border-slate-700"
                        referrerPolicy="no-referrer"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoDataUrl('');
                          setPhotoConsentAuthorized(false);
                        }}
                        className="text-xs font-bold text-rose-300 hover:text-rose-200 cursor-pointer"
                      >
                        Quitar fotografía
                      </button>
                    </div>

                    <label className="flex items-start gap-2.5 text-xs text-amber-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={photoConsentAuthorized}
                        onChange={(e) =>
                          setPhotoConsentAuthorized(e.target.checked)
                        }
                        className="mt-0.5"
                      />
                      <span>
                        Confirmo que cuento con autorización explícita y que
                        esta fotografía NO expone rostros de terceros ni datos
                        privados.
                      </span>
                    </label>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedMission(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-bold text-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingRegistration}
                  className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 font-bold text-sm cursor-pointer"
                >
                  {submittingRegistration
                    ? 'Registrando...'
                    : selectedMission.requiresDirectorValidation
                      ? 'Enviar para Validación'
                      : 'Registrar Participación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
