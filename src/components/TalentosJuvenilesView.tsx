import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Award,
  CheckCircle2,
  Clock,
  Eye,
  HeartHandshake,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Plus,
  QrCode,
  RotateCcw,
  Scale,
  ShieldCheck,
  Sparkles,
  Trash2,
  Tv,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  getTalentCategoryMeta,
  TALENT_CATEGORIES,
  TALENT_ENCOURAGEMENT_MESSAGES,
  TALENT_POSITIVE_REACTIONS,
  TALENT_RECOGNITION_TITLES,
  type TalentCategoryId,
  type TalentPublicEntryView,
  type TalentReactionId,
  type TalentRoomState,
  type TalentShowcaseSession,
  type TalentStageScreen as TalentStageScreenMode,
} from '../shared/talentShowData';
import { soundFX } from '../utils/sound';
import { TalentCertificateCard } from './TalentCertificateCard';
import { TalentStageScreen } from './TalentStageScreen';

interface TalentosJuvenilesViewProps {
  onBack: () => void;
  onCreatedMultiplayerRoom: (code: string, presenterToken: string) => void;
  onJoinCode: (code: string) => void;
}

type TalentTab =
  | 'participants'
  | 'stage'
  | 'jury'
  | 'certificates'
  | 'live_qr';

async function compressImageFile(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Archivo de imagen no válido.'));
    i.src = dataUrl;
  });

  const maxSide = 960;
  const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * ratio));
  const h = Math.max(1, Math.round(img.height * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Error al procesar la imagen.');
  ctx.drawImage(img, 0, 0, w, h);

  let compressed = canvas.toDataURL('image/webp', 0.8);
  if (!compressed.startsWith('data:image/webp') || compressed.length > 380_000) {
    compressed = canvas.toDataURL('image/jpeg', 0.78);
  }
  return compressed;
}

export function TalentosJuvenilesView({
  onBack,
  onCreatedMultiplayerRoom,
  onJoinCode,
}: TalentosJuvenilesViewProps) {
  const [activeTab, setActiveTab] = useState<TalentTab>('participants');
  const [session, setSession] = useState<
    (TalentShowcaseSession & { timerRemainingSec?: number }) | null
  >(null);
  const [publicEntries, setPublicEntries] = useState<TalentPublicEntryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Registration Form
  const [participantName, setParticipantName] = useState('');
  const [displayAlias, setDisplayAlias] = useState('');
  const [categoryId, setCategoryId] = useState<TalentCategoryId>('canto');
  const [presentationTitle, setPresentationTitle] = useState('');
  const [description, setDescription] = useState('');
  const [verseReference, setVerseReference] = useState('');
  const [durationSec, setDurationSec] = useState(180);
  const [mediaDataUrl, setMediaDataUrl] = useState<string>('');
  const [mediaCaption, setMediaCaption] = useState('');
  const [consentNamePublic, setConsentNamePublic] = useState(true);
  const [consentMediaPublic, setConsentMediaPublic] = useState(false);
  const [submittingEntry, setSubmittingEntry] = useState(false);

  // Inline deletion / reset confirmation (zero window.confirm)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmResetSession, setConfirmResetSession] = useState(false);

  // Director Stage & Fullscreen Overlay
  const [isFullscreenStage, setIsFullscreenStage] = useState(false);
  const [selectedVoteEntryId, setSelectedVoteEntryId] = useState('');
  const [selectedVoteReaction, setSelectedVoteReaction] =
    useState<TalentReactionId>('edificante');
  const [selectedVoteMsg, setSelectedVoteMsg] = useState(
    TALENT_ENCOURAGEMENT_MESSAGES[0]
  );

  // Result Recording
  const [resultEntryId, setResultEntryId] = useState('');
  const [resultRecognitionTitle, setResultRecognitionTitle] = useState(
    TALENT_RECOGNITION_TITLES[0]
  );
  const [resultNote, setResultNote] = useState(
    '¡Gracias por compartir tu talento con alegría y reverencia!'
  );

  // Jury Form
  const [juryEntryId, setJuryEntryId] = useState('');
  const [juryMemberId, setJuryMemberId] = useState('jury-1');
  const [biblicalMessageScore, setBiblicalMessageScore] = useState(5);
  const [preparationScore, setPreparationScore] = useState(5);
  const [clarityScore, setClarityScore] = useState(5);
  const [juryComment, setJuryComment] = useState(
    'Excelente disposición espiritual, claridad y entrega para edificar a la iglesia.'
  );
  const [jurySuggestedRec, setJurySuggestedRec] = useState(
    TALENT_RECOGNITION_TITLES[0]
  );

  // Multiplayer QR launch
  const [roomTitle, setRoomTitle] = useState('Noche de Talentos Juveniles');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);

  const showNotice = (msg: string) => {
    setErrorMsg(null);
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 3800);
  };

  const fetchTalentState = async () => {
    try {
      const res = await fetch('/api/talents/state');
      const data = await res.json();
      if (data.session) {
        setSession(data.session);
        setPublicEntries(data.publicEntries || []);
        if (!resultEntryId && data.session.activeEntryId) {
          setResultEntryId(data.session.activeEntryId);
        }
        if (!juryEntryId && data.session.entries?.[0]?.id) {
          setJuryEntryId(data.session.entries[0].id);
        }
        if (!selectedVoteEntryId && data.session.activeEntryId) {
          setSelectedVoteEntryId(data.session.activeEntryId);
        }
      }
    } catch {
      setErrorMsg('No se pudo cargar la información de Talentos Juveniles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTalentState();
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreenStage(false);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const enterFullscreenStage = async () => {
    setIsFullscreenStage(true);
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // overlay mode still works inside iframe/preview cleanly
    }
  };

  const exitFullscreenStage = async () => {
    setIsFullscreenStage(false);
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // ignore
    }
  };

  const handleCategoryChange = (nextCat: TalentCategoryId) => {
    setCategoryId(nextCat);
    const meta = getTalentCategoryMeta(nextCat);
    setDurationSec(meta.defaultDurationSec);
  };

  const handleMediaFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      setMediaDataUrl(compressed);
      showNotice(
        'Imagen cargada. Permanecerá privada hasta contar con consentimiento y aprobación del director.'
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No se pudo cargar la imagen.'
      );
    }
  };

  const handleRegisterParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!participantName.trim() || !presentationTitle.trim()) {
      setErrorMsg('Escribe el nombre del participante y el título de su presentación.');
      return;
    }
    setSubmittingEntry(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/talents/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantName: participantName.trim(),
          displayAlias: displayAlias.trim() || undefined,
          categoryId,
          presentationTitle: presentationTitle.trim(),
          description: description.trim(),
          verseReference: verseReference.trim(),
          durationSec,
          mediaDataUrl: mediaDataUrl || undefined,
          mediaCaption: mediaCaption.trim() || undefined,
          consentNamePublic,
          consentMediaPublic,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al registrar participante.');
      }
      setParticipantName('');
      setDisplayAlias('');
      setPresentationTitle('');
      setDescription('');
      setVerseReference('');
      setMediaDataUrl('');
      setMediaCaption('');
      setConsentMediaPublic(false);
      await fetchTalentState();
      showNotice('Participante registrado en el orden del programa.');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No se pudo registrar al participante.'
      );
    } finally {
      setSubmittingEntry(false);
    }
  };

  const handleReorder = async (entryId: string, direction: 'up' | 'down') => {
    await fetch('/api/talents/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryId, direction }),
    });
    await fetchTalentState();
  };

  const handleToggleEntryPrivacy = async (
    entryId: string,
    patch: { directorApprovedDisplay?: boolean; directorApprovedMedia?: boolean }
  ) => {
    await fetch(`/api/talents/participants/${encodeURIComponent(entryId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    await fetchTalentState();
  };

  const handleDeleteEntry = async (entryId: string) => {
    await fetch(`/api/talents/participants/${encodeURIComponent(entryId)}`, {
      method: 'DELETE',
    });
    setConfirmDeleteId(null);
    await fetchTalentState();
    showNotice('Presentación retirada del programa.');
  };

  const applyControls = async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/talents/controls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok && data.session) {
      setSession(data.session);
      setPublicEntries(data.publicEntries || []);
    }
  };

  const handleSwitchStageScreen = async (
    screen: TalentStageScreenMode,
    entryId?: string,
    playCurtain = true
  ) => {
    if (playCurtain) {
      if (screen === 'recognition') {
        soundFX.playTalentCertificateAward();
        soundFX.playTalentApplauseChime();
      } else if (screen === 'presentation') {
        soundFX.playTalentCurtainOpen();
      } else {
        soundFX.playTalentSpotlightTransition();
      }
    }
    await applyControls({
      currentScreen: screen,
      ...(entryId ? { activeEntryId: entryId } : {}),
      triggerOpening: playCurtain,
    });
  };

  const handleRecordResult = async () => {
    const targetId = resultEntryId || session?.activeEntryId;
    if (!targetId) return;
    await fetch(`/api/talents/participants/${encodeURIComponent(targetId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'completed',
        recognitionTitle: resultRecognitionTitle,
        directorEncouragementNote: resultNote,
      }),
    });
    await fetchTalentState();
    showNotice('Resultado y reconocimiento guardados correctamente.');
  };

  const handleIssueAllCertificates = async () => {
    soundFX.playTalentCertificateAward();
    await fetch('/api/talents/certificates/issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryId: 'all' }),
    });
    await fetchTalentState();
    showNotice('Certificados digitales generados respetando la privacidad.');
  };

  const handleSubmitJuryEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = juryEntryId || session?.entries[0]?.id;
    if (!targetId) return;
    const res = await fetch('/api/talents/jury', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entryId: targetId,
        juryMemberId,
        biblicalMessageScore,
        preparationScore,
        clarityScore,
        encouragingComment: juryComment,
        suggestedRecognition: jurySuggestedRec,
      }),
    });
    if (res.ok) {
      await fetchTalentState();
      showNotice('Evaluación edificante del jurado registrada.');
    }
  };

  const handleSendStagePositiveVote = async () => {
    const targetId =
      selectedVoteEntryId || session?.activeEntryId || session?.entries[0]?.id;
    if (!targetId) return;
    const res = await fetch('/api/talents/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entryId: targetId,
        reactionId: selectedVoteReaction,
        curatedMessage: selectedVoteMsg,
        voterKey: `local-${Date.now().toString(36)}`,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error || 'La votación del público está deshabilitada.');
      return;
    }
    soundFX.playTalentApplauseChime();
    setPublicEntries(data.publicEntries || []);
    showNotice('Apreciación positiva registrada en el escenario.');
  };

  const handleLaunchLiveRoom = async () => {
    setCreatingRoom(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: roomTitle.trim() || session?.programTitle || 'Talentos Juveniles',
          mode: 'talentos_juveniles',
          maxParticipants: 200,
          timeLimitSec: 180,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo abrir la sala en vivo.');
      }
      onCreatedMultiplayerRoom(data.code, data.presenterToken);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Error al crear la sala en vivo.'
      );
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleResetSession = async () => {
    await fetch('/api/talents/session/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        programTitle: 'Noche de Talentos Juveniles — Sociedad de Jóvenes',
      }),
    });
    setConfirmResetSession(false);
    await fetchTalentState();
    showNotice('Nuevo programa de Talentos Juveniles preparado.');
  };

  if (loading || !session) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center text-slate-300">
        Cargando sección de Talentos Juveniles...
      </div>
    );
  }

  const stageRoomState: TalentRoomState = {
    programTitle: session.programTitle,
    directorName: session.directorName,
    currentScreen: session.currentScreen,
    activeEntryId: session.activeEntryId,
    openingNonce: session.openingNonce,
    timerRunning: session.timerRunning,
    timerEndsAt: session.timerEndsAt,
    timerRemainingSec: session.timerRemainingSec ?? 120,
    audienceVotingEnabled: session.audienceVotingEnabled,
    juryEnabled: session.juryEnabled,
    privacy: session.privacy,
    entries: publicEntries,
    myAppreciatedEntryIds: [],
    certificates: session.certificates,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Fullscreen Big-Screen Stage Overlay */}
      {isFullscreenStage && (
        <div className="fixed inset-0 z-50 bg-[#080E1E] overflow-y-auto px-4 sm:px-8 py-6 space-y-6">
          <div className="max-w-[1440px] mx-auto space-y-6">
            <TalentStageScreen
              talentState={stageRoomState}
              isFullscreen={true}
              onToggleFullscreen={exitFullscreenStage}
            />

            {/* Discreet Director Dock in Fullscreen */}
            <div className="bg-[#111A2E]/95 border border-slate-700 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSwitchStageScreen('waiting')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                    session.currentScreen === 'waiting'
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-800 text-slate-200'
                  }`}
                >
                  Espera
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleSwitchStageScreen(
                      'presentation',
                      session.activeEntryId || session.entries[0]?.id
                    )
                  }
                  className={`px-3 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                    session.currentScreen === 'presentation'
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-800 text-slate-200'
                  }`}
                >
                  Presentación
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchStageScreen('recognition')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                    session.currentScreen === 'recognition'
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-800 text-slate-200'
                  }`}
                >
                  Reconocimiento Final
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {session.timerRunning ? (
                  <button
                    type="button"
                    onClick={() => applyControls({ timerAction: 'pause' })}
                    className="px-3 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    Pausar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => applyControls({ timerAction: 'start' })}
                    className="px-3 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Iniciar Tiempo
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => applyControls({ timerAction: 'add30' })}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-sky-300 text-xs font-semibold cursor-pointer"
                >
                  +30s
                </button>
                <button
                  type="button"
                  onClick={exitFullscreenStage}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                  Salir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-[#111A2E] border border-amber-400/35 rounded-3xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-semibold text-slate-400 hover:text-amber-300 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio
          </button>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white text-balance">
            TALENTOS JUVENILES
          </h1>
          <p className="text-sm text-slate-300 max-w-2xl">
            Espacio independiente para que los jóvenes descubran, compartan y desarrollen sus talentos en los programas de Sociedad de Jóvenes con respeto, orden y privacidad protegida.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={enterFullscreenStage}
            className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-xs sm:text-sm inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Maximize2 className="w-4 h-4" />
            Proyectar Pantalla Grande
          </button>
          <button
            type="button"
            onClick={() => setConfirmResetSession(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
            Nuevo Programa
          </button>
        </div>
      </div>

      {/* Inline Confirm Reset */}
      {confirmResetSession && (
        <div className="bg-amber-500/15 border border-amber-400/60 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-amber-100 font-medium">
            ¿Iniciar un programa nuevo de Talentos Juveniles? Se limpiará la lista actual de participantes y certificados de esta sesión.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmResetSession(false)}
              className="px-3.5 py-2 rounded-lg bg-slate-800 text-slate-200 text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleResetSession}
              className="px-4 py-2 rounded-lg bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
            >
              Confirmar Nuevo Programa
            </button>
          </div>
        </div>
      )}

      {notice && (
        <div className="bg-emerald-500/15 border border-emerald-400/50 rounded-2xl px-4 py-3 text-sm text-emerald-200">
          {notice}
        </div>
      )}
      {errorMsg && (
        <div className="bg-rose-500/15 border border-rose-400/50 rounded-2xl px-4 py-3 text-sm text-rose-200">
          {errorMsg}
        </div>
      )}

      {/* Navigation Tabs */}
      <nav className="flex flex-wrap gap-2">
        {(
          [
            {
              id: 'participants',
              label: `1. Participantes y Orden (${session.entries.length})`,
              icon: UserPlus,
            },
            {
              id: 'stage',
              label: '2. Dirección y Pantalla Grande',
              icon: Tv,
            },
            {
              id: 'jury',
              label: `3. Panel de Jurado ${session.juryEnabled ? '(Activo)' : '(Opcional)'}`,
              icon: Scale,
            },
            {
              id: 'certificates',
              label: `4. Certificados (${session.certificates.length})`,
              icon: Award,
            },
            {
              id: 'live_qr',
              label: '5. En Vivo con QR',
              icon: QrCode,
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
              className={`px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                active
                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                  : 'bg-[#111A2E] text-slate-200 border-slate-800 hover:border-slate-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* TAB 1: PARTICIPANTES, CATEGORÍAS, DESCRIPCIÓN, PRIVACIDAD Y ORDEN */}
      {activeTab === 'participants' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleRegisterParticipant}
            className="lg:col-span-5 bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-4"
          >
            <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-amber-400" />
              Registrar Participante y Talento
            </h2>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Nombre del Participante *
              </label>
              <input
                type="text"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                placeholder="Ej: Sofía Martínez / Coro Juvenil"
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Categoría (10 disponibles) *
                </label>
                <select
                  value={categoryId}
                  onChange={(e) =>
                    handleCategoryChange(e.target.value as TalentCategoryId)
                  }
                  className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                >
                  {TALENT_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Duración asignada (seg)
                </label>
                <input
                  type="number"
                  min={20}
                  max={900}
                  value={durationSec}
                  onChange={(e) =>
                    setDurationSec(Math.max(20, Number(e.target.value) || 120))
                  }
                  className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono-num focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Título de la Presentación *
              </label>
              <input
                type="text"
                value={presentationTitle}
                onChange={(e) => setPresentationTitle(e.target.value)}
                placeholder="Ej: Cuán Grande Es Él / Salmo 91 de memoria"
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Descripción de la Presentación
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Breve explicación de su talento o mensaje espiritual..."
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Cita Bíblica (opcional)
                </label>
                <input
                  type="text"
                  value={verseReference}
                  onChange={(e) => setVerseReference(e.target.value)}
                  placeholder="Ej: Salmos 150:1-6"
                  className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Alias de privacidad (opcional)
                </label>
                <input
                  type="text"
                  value={displayAlias}
                  onChange={(e) => setDisplayAlias(e.target.value)}
                  placeholder="Ej: Participante Juvenil A"
                  className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Optional Drawing / Authorized Photo */}
            <div className="bg-[#080E1E] border border-slate-800 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-sky-400" />
                  Obra o Fotografía (Opcional)
                </span>
                {mediaDataUrl && (
                  <button
                    type="button"
                    onClick={() => setMediaDataUrl('')}
                    className="text-xs text-rose-400 hover:text-rose-300 cursor-pointer"
                  >
                    Quitar imagen
                  </button>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleMediaFileChange}
                className="block w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-800 file:text-slate-200 file:font-semibold hover:file:bg-slate-700 cursor-pointer"
              />
              {mediaDataUrl && (
                <div className="space-y-2">
                  <img
                    src={mediaDataUrl}
                    alt="Vista previa privada"
                    className="w-full max-h-36 object-contain rounded-lg bg-[#111A2E]"
                  />
                  <input
                    type="text"
                    value={mediaCaption}
                    onChange={(e) => setMediaCaption(e.target.value)}
                    placeholder="Pie de foto o título del dibujo"
                    className="w-full bg-[#111A2E] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
              )}
            </div>

            {/* Strict Privacy Consents */}
            <div className="bg-[#080E1E] border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs text-slate-300">
              <p className="font-bold text-amber-300 inline-flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                Autorizaciones de Privacidad
              </p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentNamePublic}
                  onChange={(e) => setConsentNamePublic(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  El participante autoriza mostrar su nombre en pantalla y certificados.
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentMediaPublic}
                  onChange={(e) => setConsentMediaPublic(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Autoriza proyectar fotografía o dibujo si el director lo aprueba explícitamente.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={submittingEntry}
              className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-sm cursor-pointer disabled:opacity-50"
            >
              {submittingEntry
                ? 'Guardando presentación...'
                : 'Agregar al Orden de Participación'}
            </button>
          </form>

          {/* Ordered Lineup */}
          <div className="lg:col-span-7 bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-sky-400" />
                  Orden de Participación y Control de Privacidad
                </h2>
                <p className="text-xs text-slate-400">
                  Organiza el orden de subida al escenario y aprueba individualmente nombres o imágenes antes de proyectar.
                </p>
              </div>
              <span className="font-mono-num text-sm font-bold text-amber-300">
                {session.entries.length} registrados
              </span>
            </div>

            {session.entries.length === 0 ? (
              <div className="py-16 text-center border border-dashed border-slate-800 rounded-2xl text-slate-400 text-sm">
                Aún no hay talentos registrados. Usa el formulario de la izquierda para agregar a los participantes.
              </div>
            ) : (
              <div className="space-y-3">
                {[...session.entries]
                  .sort((a, b) => a.orderIndex - b.orderIndex)
                  .map((entry, idx, arr) => {
                    const cat = getTalentCategoryMeta(entry.categoryId);
                    const isActive = session.activeEntryId === entry.id;
                    return (
                      <div
                        key={entry.id}
                        className={`bg-[#080E1E] border rounded-2xl p-4 space-y-3 ${
                          isActive ? 'border-amber-400/70' : 'border-slate-800'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-mono-num font-bold text-amber-300">
                                #{idx + 1}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span
                                className="font-bold"
                                style={{ color: cat.color }}
                              >
                                {cat.label}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-num text-slate-400">
                                {entry.durationSec}s
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="text-slate-300">
                                {entry.status === 'completed'
                                  ? 'Completado'
                                  : entry.status === 'presenting'
                                    ? 'En Escenario'
                                    : 'En Espera'}
                              </span>
                            </div>
                            <h3 className="font-display font-bold text-base text-white">
                              {entry.presentationTitle}
                            </h3>
                            <p className="text-xs text-slate-300">
                              Participante:{' '}
                              <strong className="text-white">
                                {entry.participantName}
                              </strong>
                              {entry.verseReference
                                ? ` · ${entry.verseReference}`
                                : ''}
                            </p>
                            {entry.description && (
                              <p className="text-xs text-slate-400">
                                {entry.description}
                              </p>
                            )}
                          </div>

                          {/* Reorder & Remove Actions */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleReorder(entry.id, 'up')}
                              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-35 cursor-pointer"
                              title="Subir en el orden"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === arr.length - 1}
                              onClick={() => handleReorder(entry.id, 'down')}
                              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-35 cursor-pointer"
                              title="Bajar en el orden"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('stage');
                                handleSwitchStageScreen(
                                  'presentation',
                                  entry.id,
                                  true
                                );
                              }}
                              className="px-2.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                            >
                              Presentar
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(entry.id)}
                              className="p-2 rounded-lg bg-slate-800 hover:bg-rose-600/30 text-rose-400 cursor-pointer"
                              title="Retirar participante"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {confirmDeleteId === entry.id && (
                          <div className="bg-rose-500/15 border border-rose-500/40 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs">
                            <span className="text-rose-200">
                              ¿Retirar esta presentación del programa?
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2.5 py-1 rounded bg-slate-800 text-slate-200 cursor-pointer"
                              >
                                No
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteEntry(entry.id)}
                                className="px-2.5 py-1 rounded bg-rose-600 text-white font-bold cursor-pointer"
                              >
                                Sí, retirar
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Per-Entry Director Privacy Approval Row */}
                        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/80 text-xs">
                          <label className="inline-flex items-center gap-1.5 text-slate-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={entry.directorApprovedDisplay}
                              onChange={(e) =>
                                handleToggleEntryPrivacy(entry.id, {
                                  directorApprovedDisplay: e.target.checked,
                                })
                              }
                            />
                            <span>
                              Aprobar nombre público (
                              {entry.consentNamePublic
                                ? 'autorizado por joven'
                                : 'sin autorización'}
                              )
                            </span>
                          </label>

                          {entry.mediaDataUrl && (
                            <label className="inline-flex items-center gap-1.5 text-amber-200 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={entry.directorApprovedMedia}
                                onChange={(e) =>
                                  handleToggleEntryPrivacy(entry.id, {
                                    directorApprovedMedia: e.target.checked,
                                  })
                                }
                              />
                              <span>
                                Aprobar foto/obra en pantalla (
                                {entry.consentMediaPublic
                                  ? 'autorizado por joven'
                                  : 'requiere permiso'}
                                )
                              </span>
                            </label>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DIRECCIÓN, CRONÓMETRO, VOTACIÓN RESPETUOSA, PRIVACIDAD Y PANTALLA GRANDE */}
      {activeTab === 'stage' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Director Controls Column */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-4">
                <h2 className="font-display text-lg font-bold text-white">
                  Control del Programa y Escenario
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs text-slate-400">
                      Título del Programa
                    </label>
                    <input
                      type="text"
                      value={session.programTitle}
                      onChange={(e) =>
                        setSession({ ...session, programTitle: e.target.value })
                      }
                      onBlur={() =>
                        applyControls({ programTitle: session.programTitle })
                      }
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs text-slate-400">
                      Firma de Dirección
                    </label>
                    <input
                      type="text"
                      value={session.directorName}
                      onChange={(e) =>
                        setSession({ ...session, directorName: e.target.value })
                      }
                      onBlur={() =>
                        applyControls({ directorName: session.directorName })
                      }
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {(
                    [
                      { id: 'waiting', label: '1. Pantalla de Espera' },
                      { id: 'presentation', label: '2. Pantalla de Presentación' },
                      { id: 'recognition', label: '3. Pantalla de Reconocimiento Final' },
                    ] as const
                  ).map((scr) => (
                    <button
                      key={scr.id}
                      type="button"
                      onClick={() => handleSwitchStageScreen(scr.id)}
                      className={`w-full px-4 py-2.5 rounded-xl border text-left text-xs sm:text-sm font-bold cursor-pointer transition-colors ${
                        session.currentScreen === scr.id
                          ? 'bg-amber-400 text-slate-950 border-amber-300'
                          : 'bg-[#080E1E] text-slate-200 border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      {scr.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                  <label className="block text-xs font-semibold text-slate-300">
                    Participante Activo
                  </label>
                  <select
                    value={session.activeEntryId || ''}
                    onChange={(e) => {
                      setResultEntryId(e.target.value);
                      setSelectedVoteEntryId(e.target.value);
                      handleSwitchStageScreen('presentation', e.target.value, true);
                    }}
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
                  >
                    {session.entries.length === 0 && (
                      <option value="">Sin participantes registrados</option>
                    )}
                    {session.entries.map((e, i) => (
                      <option key={e.id} value={e.id}>
                        #{i + 1} · {e.participantName} — {e.presentationTitle}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Presentation Timer & Opening */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="font-semibold inline-flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-300" />
                      Cronómetro por Presentación
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleSwitchStageScreen(
                          session.currentScreen,
                          session.activeEntryId || undefined,
                          true
                        )
                      }
                      className="text-amber-300 hover:text-amber-200 font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Repetir apertura
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {session.timerRunning ? (
                      <button
                        type="button"
                        onClick={() => applyControls({ timerAction: 'pause' })}
                        className="px-3.5 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        Pausar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => applyControls({ timerAction: 'start' })}
                        className="px-3.5 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Iniciar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => applyControls({ timerAction: 'reset' })}
                      className="px-3 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold cursor-pointer"
                    >
                      Reiniciar
                    </button>
                    <button
                      type="button"
                      onClick={() => applyControls({ timerAction: 'add30' })}
                      className="px-3 py-2 rounded-xl bg-slate-800 text-sky-300 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      30s
                    </button>
                  </div>
                </div>
              </div>

              {/* Privacy & Audience Voting Controls */}
              <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-3">
                <h3 className="font-display font-bold text-base text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  Control de Privacidad y Votación
                </h3>

                <div className="space-y-2 text-xs">
                  <label className="flex items-center justify-between bg-[#080E1E] border border-slate-800 rounded-xl px-3.5 py-2.5 cursor-pointer">
                    <span className="text-slate-200 font-semibold">
                      Habilitar Votaciones del Público
                    </span>
                    <input
                      type="checkbox"
                      checked={session.audienceVotingEnabled}
                      onChange={(e) =>
                        applyControls({
                          audienceVotingEnabled: e.target.checked,
                        })
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between bg-[#080E1E] border border-slate-800 rounded-xl px-3.5 py-2.5 cursor-pointer">
                    <span className="text-slate-200">
                      Mostrar nombres autorizados en pantalla
                    </span>
                    <input
                      type="checkbox"
                      checked={session.privacy.showNamesOnScreen}
                      onChange={(e) =>
                        applyControls({
                          privacy: { showNamesOnScreen: e.target.checked },
                        })
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between bg-[#080E1E] border border-slate-800 rounded-xl px-3.5 py-2.5 cursor-pointer">
                    <span className="text-slate-200">
                      Mostrar fotos/obras con doble permiso
                    </span>
                    <input
                      type="checkbox"
                      checked={session.privacy.showPhotosOnScreen}
                      onChange={(e) =>
                        applyControls({
                          privacy: { showPhotosOnScreen: e.target.checked },
                        })
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between bg-[#080E1E] border border-slate-800 rounded-xl px-3.5 py-2.5 cursor-pointer">
                    <span className="text-slate-200">
                      Mostrar descripciones en pantalla
                    </span>
                    <input
                      type="checkbox"
                      checked={session.privacy.showDescriptionsOnScreen}
                      onChange={(e) =>
                        applyControls({
                          privacy: {
                            showDescriptionsOnScreen: e.target.checked,
                          },
                        })
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between bg-[#080E1E] border border-slate-800 rounded-xl px-3.5 py-2.5 cursor-pointer">
                    <span className="text-slate-200">
                      Mostrar notas constructivas de jurado en final
                    </span>
                    <input
                      type="checkbox"
                      checked={session.privacy.showJuryFeedbackOnScreen}
                      onChange={(e) =>
                        applyControls({
                          privacy: {
                            showJuryFeedbackOnScreen: e.target.checked,
                          },
                        })
                      }
                    />
                  </label>
                </div>
              </div>

              {/* Record Result & Quick Respectful Praise */}
              {session.entries.length > 0 && (
                <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-3">
                  <h3 className="font-display font-bold text-base text-white">
                    Registrar Resultado de Presentación
                  </h3>
                  <select
                    value={resultEntryId || session.activeEntryId || session.entries[0].id}
                    onChange={(e) => setResultEntryId(e.target.value)}
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    {session.entries.map((e, i) => (
                      <option key={e.id} value={e.id}>
                        #{i + 1} · {e.participantName}
                      </option>
                    ))}
                  </select>
                  <select
                    value={resultRecognitionTitle}
                    onChange={(e) => setResultRecognitionTitle(e.target.value)}
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    {TALENT_RECOGNITION_TITLES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <textarea
                    rows={2}
                    value={resultNote}
                    onChange={(e) => setResultNote(e.target.value)}
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={handleRecordResult}
                    className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Guardar Resultado y Marcar Completado
                  </button>

                  {session.audienceVotingEnabled && (
                    <div className="pt-3 border-t border-slate-800 space-y-2">
                      <p className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                        <HeartHandshake className="w-4 h-4" />
                        Enviar Aplauso desde Mesa de Dirección
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {TALENT_POSITIVE_REACTIONS.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => setSelectedVoteReaction(r.id)}
                            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                              selectedVoteReaction === r.id
                                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                                : 'bg-[#080E1E] border-slate-800 text-slate-300'
                            }`}
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                      <select
                        value={selectedVoteMsg}
                        onChange={(e) => setSelectedVoteMsg(e.target.value)}
                        className="w-full bg-[#080E1E] border border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] text-white"
                      >
                        {TALENT_ENCOURAGEMENT_MESSAGES.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleSendStagePositiveVote}
                        className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold cursor-pointer"
                      >
                        Registrar Apreciación Positiva
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Live Big-Screen Stage Preview */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-200">
                  <Eye className="w-4 h-4 text-sky-400" />
                  Vista Previa de Pantalla Grande
                </span>
                <button
                  type="button"
                  onClick={enterFullscreenStage}
                  className="text-amber-300 hover:text-amber-200 font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  Abrir en Pantalla Completa
                </button>
              </div>
              <TalentStageScreen
                talentState={stageRoomState}
                isFullscreen={false}
                onToggleFullscreen={enterFullscreenStage}
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PANEL DE JURADO OPCIONAL */}
      {activeTab === 'jury' && (
        <div className="space-y-6">
          <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-400" />
                Panel de Jurado Edificante (Opcional)
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
                Actívalo cuando desees retroalimentación constructiva y pastoral por parte de consejeros o líderes juveniles, siempre orientada a animar sin comparaciones negativas.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                applyControls({ juryEnabled: !session.juryEnabled })
              }
              className={`px-5 py-2.5 rounded-xl font-display font-bold text-sm cursor-pointer ${
                session.juryEnabled
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              {session.juryEnabled ? 'Jurado Activado' : 'Activar Panel de Jurado'}
            </button>
          </div>

          {session.juryEnabled && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <form
                onSubmit={handleSubmitJuryEvaluation}
                className="lg:col-span-5 bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-4"
              >
                <h3 className="font-display font-bold text-lg text-white">
                  Registrar Apreciación del Jurado
                </h3>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Miembro del Jurado
                  </label>
                  <select
                    value={juryMemberId}
                    onChange={(e) => setJuryMemberId(e.target.value)}
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
                  >
                    {session.juryMembers.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.name} ({j.roleTitle})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Participante Evaluado
                  </label>
                  <select
                    value={juryEntryId || session.entries[0]?.id || ''}
                    onChange={(e) => setJuryEntryId(e.target.value)}
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
                  >
                    {session.entries.length === 0 && (
                      <option value="">No hay participantes registrados</option>
                    )}
                    {session.entries.map((e, i) => (
                      <option key={e.id} value={e.id}>
                        #{i + 1} · {e.participantName} — {e.presentationTitle}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  {(
                    [
                      {
                        label: 'Mensaje Bíblico',
                        val: biblicalMessageScore,
                        set: setBiblicalMessageScore,
                      },
                      {
                        label: 'Preparación',
                        val: preparationScore,
                        set: setPreparationScore,
                      },
                      {
                        label: 'Claridad / Entrega',
                        val: clarityScore,
                        set: setClarityScore,
                      },
                    ] as const
                  ).map((crit) => (
                    <div key={crit.label} className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-300">
                        {crit.label} (1-5)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={crit.val}
                        onChange={(e) =>
                          crit.set(
                            Math.max(1, Math.min(5, Number(e.target.value) || 5))
                          )
                        }
                        className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono-num"
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Reconocimiento Sugerido
                  </label>
                  <select
                    value={jurySuggestedRec}
                    onChange={(e) => setJurySuggestedRec(e.target.value)}
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
                  >
                    {TALENT_RECOGNITION_TITLES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Palabras Constructivas de Ánimo
                  </label>
                  <textarea
                    rows={3}
                    value={juryComment}
                    onChange={(e) => setJuryComment(e.target.value)}
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={session.entries.length === 0}
                  className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-sm cursor-pointer disabled:opacity-40"
                >
                  Guardar Apreciación del Jurado
                </button>
              </form>

              <div className="lg:col-span-7 bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="font-display font-bold text-lg text-white">
                  Apreciaciones Registradas ({session.juryEvaluations.length})
                </h3>
                {session.juryEvaluations.length === 0 ? (
                  <p className="text-sm text-slate-400 py-8 text-center border border-dashed border-slate-800 rounded-xl">
                    Aún no se han guardado observaciones del jurado.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {session.juryEvaluations.map((ev, idx) => {
                      const entry = session.entries.find(
                        (e) => e.id === ev.entryId
                      );
                      return (
                        <div
                          key={`${ev.entryId}-${ev.juryMemberId}-${idx}`}
                          className="bg-[#080E1E] border border-slate-800 rounded-xl p-4 space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="font-bold text-amber-300">
                              {entry?.participantName || 'Participante'} ·{' '}
                              {ev.juryName}
                            </span>
                            <span className="font-mono-num text-emerald-300">
                              Mensaje {ev.biblicalMessageScore}/5 · Preparación{' '}
                              {ev.preparationScore}/5 · Claridad{' '}
                              {ev.clarityScore}/5
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-sky-300">
                            {ev.suggestedRecognition}
                          </p>
                          <p className="text-sm text-slate-200">
                            “{ev.encouragingComment}”
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: RECONOCIMIENTOS Y CERTIFICADOS DIGITALES */}
      {activeTab === 'certificates' && (
        <div className="space-y-6">
          <div className="bg-[#111A2E] border border-amber-400/35 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                Reconocimientos y Certificados Digitales
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                Genera certificados descargables en PNG y SVG listos para entregar o imprimir para cada joven participante, respetando sus permisos de nombre público.
              </p>
            </div>
            <button
              type="button"
              disabled={session.entries.length === 0}
              onClick={handleIssueAllCertificates}
              className="px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-sm inline-flex items-center gap-2 cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              <Award className="w-4 h-4" />
              Generar Certificados para Todos
            </button>
          </div>

          {session.certificates.length === 0 ? (
            <div className="bg-[#111A2E] border border-dashed border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-sm">
              Registra al menos un participante y haz clic en “Generar Certificados para Todos” para emitir los diplomas digitales.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {session.certificates.map((cert) => (
                <TalentCertificateCard key={cert.id} certificate={cert} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: MODO EN VIVO CON QR (PÚBLICO Y PROYECTOR) */}
      {activeTab === 'live_qr' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
              <QrCode className="w-5 h-5 text-amber-400" />
              Abrir Sala en Vivo con Código QR para Congregación y Proyector
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Reutiliza automáticamente la lista de participantes, orden, categorías, cronómetro y reglas de privacidad que configuraste aquí para sincronizar en tiempo real el Panel del Director, la Pantalla de Proyección y los celulares de los asistentes mediante código QR.
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Nombre del Evento en Vivo
              </label>
              <input
                type="text"
                value={roomTitle}
                onChange={(e) => setRoomTitle(e.target.value)}
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <button
              type="button"
              disabled={creatingRoom}
              onClick={handleLaunchLiveRoom}
              className="w-full py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-base inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Play className="w-5 h-5 fill-current" />
              {creatingRoom
                ? 'Abriendo sala en vivo...'
                : 'Crear Sala en Vivo con QR'}
            </button>
          </div>

          <div className="lg:col-span-5 bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="font-display font-bold text-lg text-white">
              Unirse a una Sala de Talentos Existente
            </h3>
            <p className="text-xs text-slate-400">
              Si otro director ya abrió la sala de Talentos Juveniles, escribe el código para ingresar como público o participante invitado.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={joinCodeInput}
                onChange={(e) =>
                  setJoinCodeInput(
                    e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                  )
                }
                placeholder="Ej: TALENTO2026"
                className="flex-1 bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono-num font-bold"
              />
              <button
                type="button"
                disabled={!joinCodeInput.trim()}
                onClick={() => onJoinCode(joinCodeInput.trim().toUpperCase())}
                className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-extrabold cursor-pointer disabled:opacity-40 whitespace-nowrap"
              >
                Entrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
