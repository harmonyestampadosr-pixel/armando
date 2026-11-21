import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  Edit3,
  ImagePlus,
  LogIn,
  Palette,
  Users,
} from 'lucide-react';
import {
  AVATARS,
  AVATAR_CATEGORIES,
  AvatarCategory,
  GAME_MODE_INFO,
  GameMode,
  InviteValidationInfo,
  TEAMS,
  TeamId,
} from '../shared/types';
import { AvatarBadge } from './AvatarBadge';
import { PhotoCropperModal } from './PhotoCropperModal';
import { getOrCreateProfileKey, saveProfileName } from '../utils/profileKey';

export interface DirectInviteParams {
  identifier: string;
  signature?: string;
}

interface JoinViewProps {
  initialCode?: string;
  directInvite?: DirectInviteParams | null;
  onJoined: (
    code: string,
    participantToken: string,
    participantId: string,
    gameId?: string,
    mode?: GameMode
  ) => void;
  onBack: () => void;
}

const ACCEPTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export function JoinView({
  initialCode = '',
  directInvite = null,
  onJoined,
  onBack,
}: JoinViewProps) {
  const isDirectMode = Boolean(directInvite?.identifier);
  const [code, setCode] = useState(
    (directInvite?.identifier || initialCode).toUpperCase()
  );
  const [gameInfo, setGameInfo] = useState<InviteValidationInfo | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [checking, setChecking] = useState(isDirectMode);

  const [name, setName] = useState('');
  const [identityMode, setIdentityMode] = useState<'avatar' | 'photo'>('avatar');
  const [selectedCategory, setSelectedCategory] = useState<
    AvatarCategory | 'todas'
  >('personajes');
  const [avatarId, setAvatarId] = useState(AVATARS[0].id);
  const [croppedPhotoDataUrl, setCroppedPhotoDataUrl] = useState<string | null>(
    null
  );
  const [rawPhotoObjectUrl, setRawPhotoObjectUrl] = useState<string | null>(
    null
  );
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [teamId, setTeamId] = useState<TeamId | undefined>(undefined);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (rawPhotoObjectUrl) {
        URL.revokeObjectURL(rawPhotoObjectUrl);
      }
    };
  }, [rawPhotoObjectUrl]);

  const visibleAvatars = useMemo(() => {
    if (selectedCategory === 'todas') return AVATARS;
    return AVATARS.filter((a) => a.category === selectedCategory);
  }, [selectedCategory]);

  const validateDirectInvite = async (
    identifier: string,
    signature?: string
  ) => {
    setChecking(true);
    setLookupError(null);
    try {
      const qs = signature ? `?s=${encodeURIComponent(signature)}` : '';
      const res = await fetch(
        `/api/invite/${encodeURIComponent(identifier.trim().toUpperCase())}${qs}`
      );
      const data = await res.json();
      if (!res.ok) {
        setGameInfo(null);
        setLookupError(
          data.error || 'El enlace de invitación no es válido o expiró.'
        );
      } else {
        setGameInfo(data);
        setCode(data.code);
      }
    } catch {
      setLookupError('Error de conexión al validar la invitación.');
    } finally {
      setChecking(false);
    }
  };

  const checkGameByCode = async (targetCode: string) => {
    const clean = targetCode.trim().toUpperCase();
    if (!clean) return;
    setChecking(true);
    setLookupError(null);
    try {
      const res = await fetch(`/api/games/${encodeURIComponent(clean)}/exists`);
      const data = await res.json();
      if (!res.ok) {
        setGameInfo(null);
        setLookupError(data.error || 'Partida no encontrada.');
      } else {
        setGameInfo(data);
        setCode(data.code);
      }
    } catch {
      setLookupError('No pudimos verificar el código en este momento.');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (directInvite?.identifier) {
      validateDirectInvite(directInvite.identifier, directInvite.signature);
    } else if (initialCode) {
      checkGameByCode(initialCode);
    }
  }, [directInvite?.identifier, directInvite?.signature, initialCode]);

  const openGalleryPicker = () => {
    setPhotoError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoError(null);
    const mimeOk =
      ACCEPTED_MIME_TYPES.has(file.type.toLowerCase()) ||
      /\.(jpe?g|png|webp)$/i.test(file.name);

    if (!mimeOk) {
      setPhotoError(
        'Formato no compatible. Selecciona una fotografía JPG, JPEG, PNG o WEBP.'
      );
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setPhotoError(
        'La fotografía es demasiado pesada (máximo 15 MB antes de optimizar).'
      );
      return;
    }

    if (rawPhotoObjectUrl) {
      URL.revokeObjectURL(rawPhotoObjectUrl);
    }
    const objUrl = URL.createObjectURL(file);
    setRawPhotoObjectUrl(objUrl);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameInfo) return;
    setJoinError(null);

    if (name.trim().length < 2) {
      setJoinError('Escribe tu nombre (mínimo 2 caracteres).');
      nameInputRef.current?.focus();
      return;
    }

    setJoining(true);
    try {
      const targetIdentifier = gameInfo.gameId || gameInfo.code;
      const res = await fetch(
        `/api/games/${encodeURIComponent(targetIdentifier)}/join`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            avatarId,
            photoDataUrl:
              identityMode === 'photo' && croppedPhotoDataUrl
                ? croppedPhotoDataUrl
                : undefined,
            teamId:
              gameInfo.mode === 'equipos' ||
              gameInfo.mode === 'competencia_equipos' ||
              Boolean(gameInfo.teamMode)
                ? teamId
                : undefined,
            gameId: gameInfo.gameId,
            signature: gameInfo.signature,
            profileKey: getOrCreateProfileKey(),
          }),
        }
      );
      saveProfileName(name.trim());
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error || 'No pudimos unirte a la partida.');
        setJoining(false);
        return;
      }
      onJoined(
        data.code || gameInfo.code,
        data.participantToken,
        data.participantId,
        data.gameId || gameInfo.gameId,
        data.mode || gameInfo.mode
      );
    } catch {
      setJoinError('Error de red al intentar entrar al juego.');
      setJoining(false);
    }
  };

  const activePhotoUrl =
    identityMode === 'photo' ? croppedPhotoDataUrl || undefined : undefined;
  const trimmedName = name.trim();
  const isReadyToPlay = trimmedName.length >= 2;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-10">
      {/* Hidden Gallery Picker (Android, iPhone, Tablet, Desktop) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleFileSelected}
        className="hidden"
      />

      {rawPhotoObjectUrl && (
        <PhotoCropperModal
          imageSrc={rawPhotoObjectUrl}
          onChangePhoto={openGalleryPicker}
          onCancel={() => {
            URL.revokeObjectURL(rawPhotoObjectUrl);
            setRawPhotoObjectUrl(null);
          }}
          onConfirm={(croppedUrl) => {
            setCroppedPhotoDataUrl(croppedUrl);
            setIdentityMode('photo');
            URL.revokeObjectURL(rawPhotoObjectUrl);
            setRawPhotoObjectUrl(null);
          }}
        />
      )}

      {!isDirectMode && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-6 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>
      )}

      <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 sm:p-8 space-y-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
            {isDirectMode ? 'Invitación al Concurso' : 'Unirme a una Partida'}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {isDirectMode
              ? 'Escribe tu nombre, elige tu avatar cristiano o sube tu fotografía para entrar al instante.'
              : 'No necesitas crear cuenta ni contraseña. Personaliza tu perfil y entra a jugar.'}
          </p>
        </div>

        {/* Manual code entry only shown when NOT arriving from a direct QR/invite link */}
        {!isDirectMode && (
          <div className="space-y-2">
            <label
              htmlFor="join-code"
              className="block text-sm font-medium text-slate-300"
            >
              Código de la partida
            </label>
            <div className="flex gap-2">
              <input
                id="join-code"
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(
                    e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                  );
                  if (gameInfo) setGameInfo(null);
                }}
                placeholder="Ej: BIBLIA2026"
                className="flex-1 bg-[#080E1E] border border-slate-700 rounded-xl px-4 py-3 text-amber-300 font-mono-num font-bold text-lg tracking-wider placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
              <button
                type="button"
                disabled={checking || !code.trim()}
                onClick={() => checkGameByCode(code)}
                className="px-5 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {checking ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
            {lookupError && (
              <p className="text-sm text-rose-400 pt-1">{lookupError}</p>
            )}
          </div>
        )}

        {/* Direct Invite Loading / Error State */}
        {isDirectMode && checking && (
          <div className="py-10 text-center text-slate-300 text-sm">
            Conectando con la partida...
          </div>
        )}

        {isDirectMode && !checking && lookupError && (
          <div className="bg-rose-500/15 border border-rose-500/50 rounded-2xl p-5 space-y-4">
            <div className="flex items-start gap-3 text-rose-200">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
              <div className="space-y-1">
                <p className="font-semibold text-sm">
                  No se pudo validar esta invitación
                </p>
                <p className="text-xs sm:text-sm text-rose-200/90">
                  {lookupError}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
            >
              Ir al inicio
            </button>
          </div>
        )}

        {/* Game Found -> Finished Notice OR Direct Name & Identity Setup */}
        {gameInfo && gameInfo.status === 'finished' && (
          <div className="bg-amber-500/15 border border-amber-400/50 rounded-2xl p-6 space-y-4 text-center">
            <h2 className="font-display text-xl font-bold text-white">
              {gameInfo.title}
            </h2>
            <p className="text-sm text-amber-200">
              Este concurso ya ha finalizado y ya no se aceptan nuevos
              participantes.
            </p>
            <button
              type="button"
              onClick={onBack}
              className="px-5 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer"
            >
              Volver al inicio
            </button>
          </div>
        )}

        {gameInfo && gameInfo.status !== 'finished' && (
          <form
            onSubmit={handleJoin}
            className={`space-y-6 ${
              !isDirectMode ? 'pt-4 border-t border-slate-800' : ''
            }`}
          >
            {/* Room Summary */}
            <div className="bg-[#080E1E] border border-slate-800 rounded-xl p-4 space-y-1">
              <p className="font-display font-bold text-lg text-white">
                {gameInfo.title}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="font-mono-num text-amber-300 font-bold">
                  {gameInfo.code}
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-sky-300 font-medium">
                  {GAME_MODE_INFO[gameInfo.mode].name}
                </span>
                <span aria-hidden="true">·</span>
                <span>{gameInfo.questionCount} preguntas</span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 font-mono-num">
                  <Users className="w-3.5 h-3.5" />
                  {gameInfo.participantCount}/{gameInfo.maxParticipants} jugadores
                </span>
              </div>
            </div>

            {/* Participant Name */}
            <div>
              <label
                htmlFor="player-name"
                className="block text-sm font-medium text-slate-300 mb-1.5"
              >
                Tu nombre para el concurso
              </label>
              <input
                ref={nameInputRef}
                id="player-name"
                type="text"
                autoFocus
                required
                maxLength={28}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Escribe tu nombre aquí..."
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-4 py-3.5 text-white text-base placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Visual Identity Mode Selector */}
            <div ref={avatarSectionRef} className="space-y-3">
              <span className="block text-sm font-bold text-white tracking-wide">
                ¿CÓMO QUIERES APARECER EN EL CONCURSO?
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIdentityMode('avatar')}
                  className={`p-4 rounded-2xl border text-left flex items-center gap-3.5 transition-all cursor-pointer ${
                    identityMode === 'avatar'
                      ? 'bg-amber-400/15 border-amber-400 text-white shadow-sm'
                      : 'bg-[#080E1E] border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      identityMode === 'avatar'
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-slate-800 text-amber-300'
                    }`}
                  >
                    <Palette className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-display font-bold text-sm text-white">
                      OPCIÓN 1: ELEGIR AVATAR
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {AVATARS.length} diseños cristianos y bíblicos
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!croppedPhotoDataUrl) {
                      openGalleryPicker();
                    } else {
                      setIdentityMode('photo');
                    }
                  }}
                  className={`p-4 rounded-2xl border text-left flex items-center gap-3.5 transition-all cursor-pointer ${
                    identityMode === 'photo'
                      ? 'bg-sky-500/15 border-sky-400 text-white shadow-sm'
                      : 'bg-[#080E1E] border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      identityMode === 'photo'
                        ? 'bg-sky-400 text-slate-950'
                        : 'bg-slate-800 text-sky-300'
                    }`}
                  >
                    <Camera className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-display font-bold text-sm text-white">
                      OPCIÓN 2: SUBIR MI FOTOGRAFÍA
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Desde la galería de tu dispositivo
                    </p>
                  </div>
                </button>
              </div>

              {photoError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs sm:text-sm">
                  {photoError}
                </div>
              )}

              {/* Option 1: Categorized Illustrated Avatar Gallery */}
              {identityMode === 'avatar' && (
                <div className="bg-[#080E1E] border border-slate-800 rounded-2xl p-4 space-y-3.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {AVATAR_CATEGORIES.map((cat) => {
                      const count = AVATARS.filter(
                        (a) => a.category === cat.id
                      ).length;
                      const active = selectedCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedCategory(cat.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                            active
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-[#111A2E] text-slate-300 hover:text-white border border-slate-800'
                          }`}
                        >
                          {cat.label} ({count})
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('todas')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                        selectedCategory === 'todas'
                          ? 'bg-sky-400 text-slate-950'
                          : 'bg-[#111A2E] text-slate-300 hover:text-white border border-slate-800'
                      }`}
                    >
                      Todos ({AVATARS.length})
                    </button>
                  </div>

                  {selectedCategory !== 'todas' && (
                    <p className="text-xs text-slate-400">
                      {
                        AVATAR_CATEGORIES.find((c) => c.id === selectedCategory)
                          ?.description
                      }
                    </p>
                  )}

                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5 max-h-72 overflow-y-auto pr-1 pt-0.5">
                    {visibleAvatars.map((av) => {
                      const selected =
                        identityMode === 'avatar' && avatarId === av.id;
                      return (
                        <button
                          key={av.id}
                          type="button"
                          onClick={() => {
                            setAvatarId(av.id);
                            setIdentityMode('avatar');
                          }}
                          className={`relative p-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                            selected
                              ? 'border-amber-400 bg-amber-400/15 ring-1 ring-amber-400'
                              : 'border-slate-800 bg-[#111A2E] hover:border-slate-600'
                          }`}
                          title={av.label}
                        >
                          {selected && (
                            <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </span>
                          )}
                          <AvatarBadge avatarId={av.id} size="md" />
                          <span className="text-[11px] font-medium text-slate-200 text-center leading-tight line-clamp-2">
                            {av.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Option 2: Photo Selection Panel */}
              {identityMode === 'photo' && (
                <div className="bg-[#080E1E] border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <AvatarBadge
                      avatarId={avatarId}
                      photoUrl={croppedPhotoDataUrl || undefined}
                      size="lg"
                    />
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-white">
                        {croppedPhotoDataUrl
                          ? 'Fotografía recortada y optimizada'
                          : 'Aún no has seleccionado una fotografía'}
                      </p>
                      <p className="text-xs text-slate-400">
                        Formatos compatibles: JPG, JPEG, PNG o WEBP
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={openGalleryPicker}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2 cursor-pointer shrink-0"
                  >
                    <ImagePlus className="w-4 h-4" />
                    {croppedPhotoDataUrl
                      ? 'Seleccionar otra foto'
                      : 'Abrir galería'}
                  </button>
                </div>
              )}
            </div>

            {/* Team Choice when Equipos mode */}
            {gameInfo.mode === 'equipos' && (
              <div>
                <span className="block text-sm font-medium text-slate-300 mb-2">
                  Elige tu equipo (o deja asignación automática)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {TEAMS.map((t) => {
                    const selected = teamId === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() =>
                          setTeamId(selected ? undefined : t.id)
                        }
                        className={`px-3.5 py-2.5 rounded-xl border text-left text-sm font-semibold transition-colors cursor-pointer ${
                          selected
                            ? `${t.bgClass} ${t.borderClass} text-white`
                            : 'bg-[#080E1E] border-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <span style={{ color: t.color }}>{t.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Team Choice when Competencia por Equipos or teamMode enabled */}
            {(gameInfo.mode === 'competencia_equipos' ||
              Boolean(gameInfo.teamMode)) &&
              gameInfo.teams &&
              gameInfo.teams.length > 0 && (
                <div>
                  <span className="block text-sm font-medium text-slate-300 mb-2">
                    Elige tu equipo (o deja asignación automática)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {gameInfo.teams.map((t) => {
                      const selected = teamId === t.id;
                      const isFull =
                        typeof t.capacity === 'number' &&
                        t.memberCount >= t.capacity;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          disabled={isFull}
                          onClick={() =>
                            setTeamId(selected ? undefined : t.id)
                          }
                          className={`px-3.5 py-3 rounded-xl border text-left text-sm font-semibold transition-colors flex items-center justify-between gap-2 ${
                            isFull
                              ? 'bg-[#080E1E]/60 border-slate-800/70 opacity-50 cursor-not-allowed'
                              : selected
                                ? 'bg-emerald-500/15 border-emerald-400 text-white cursor-pointer'
                                : 'bg-[#080E1E] border-slate-800 text-slate-300 hover:border-slate-600 cursor-pointer'
                          }`}
                        >
                          <span className="truncate" style={{ color: t.color }}>
                            {t.name}
                          </span>
                          <span className="text-xs font-mono-num text-slate-400 shrink-0">
                            {t.capacity
                              ? `${t.memberCount}/${t.capacity}`
                              : t.memberCount}
                            {isFull ? ' (Lleno)' : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* Pre-entry Participant Preview Card */}
            <div className="bg-[#080E1E] border border-amber-400/40 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold tracking-wider uppercase text-amber-300">
                  Vista previa del participante
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                    isReadyToPlay ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {isReadyToPlay ? 'Listo para jugar' : 'Escribe tu nombre'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <AvatarBadge
                  avatarId={avatarId}
                  photoUrl={activePhotoUrl}
                  name={trimmedName || 'Participante'}
                  size="2xl"
                  className="mx-auto sm:mx-0"
                />

                <div className="flex-1 text-center sm:text-left space-y-1">
                  <p className="text-xs text-slate-400">
                    {activePhotoUrl
                      ? 'Identificación con fotografía personal'
                      : `Avatar seleccionado: ${
                          AVATARS.find((a) => a.id === avatarId)?.label ||
                          'Cristiano'
                        }`}
                  </p>
                  <p className="font-display text-xl font-extrabold text-white break-words">
                    Nombre: {trimmedName || 'Tu nombre aquí'}
                  </p>
                  <p className="text-xs text-emerald-300 font-medium">
                    Estado: {isReadyToPlay ? 'Listo para jugar' : 'Falta completar el nombre'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={openGalleryPicker}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-sky-300 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Cambiar foto
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIdentityMode('avatar');
                    avatarSectionRef.current?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'nearest',
                    });
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-amber-300 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Palette className="w-3.5 h-3.5" />
                  Elegir otro avatar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    nameInputRef.current?.focus();
                    nameInputRef.current?.select();
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Cambiar nombre
                </button>
              </div>
            </div>

            {joinError && (
              <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/50 text-rose-200 text-sm">
                {joinError}
              </div>
            )}

            <button
              type="submit"
              disabled={joining}
              className="w-full py-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-lg inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 min-h-[56px]"
            >
              <LogIn className="w-5 h-5" />
              {joining ? 'Entrando...' : 'ENTRAR AL JUEGO'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
