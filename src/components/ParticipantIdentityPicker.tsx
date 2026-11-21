import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  CheckCircle2,
  ImagePlus,
  Palette,
} from 'lucide-react';
import {
  AVATARS,
  AVATAR_CATEGORIES,
  AvatarCategory,
} from '../shared/types';
import { AvatarBadge } from './AvatarBadge';
import { PhotoCropperModal } from './PhotoCropperModal';

const ACCEPTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export interface IdentityValue {
  name: string;
  avatarId: string;
  photoDataUrl?: string;
}

interface ParticipantIdentityPickerProps {
  name: string;
  onNameChange: (val: string) => void;
  avatarId: string;
  onAvatarIdChange: (val: string) => void;
  identityMode: 'avatar' | 'photo';
  onIdentityModeChange: (mode: 'avatar' | 'photo') => void;
  croppedPhotoDataUrl: string | null;
  onPhotoChange: (dataUrl: string | null) => void;
  nameLabel?: string;
  namePlaceholder?: string;
}

export function ParticipantIdentityPicker({
  name,
  onNameChange,
  avatarId,
  onAvatarIdChange,
  identityMode,
  onIdentityModeChange,
  croppedPhotoDataUrl,
  onPhotoChange,
  nameLabel = 'Tu nombre para la batalla',
  namePlaceholder = 'Escribe tu nombre aquí...',
}: ParticipantIdentityPickerProps) {
  const [selectedCategory, setSelectedCategory] = useState<
    AvatarCategory | 'todas'
  >('personajes');
  const [rawPhotoObjectUrl, setRawPhotoObjectUrl] = useState<string | null>(
    null
  );
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    setRawPhotoObjectUrl(URL.createObjectURL(file));
  };

  const activePhotoUrl =
    identityMode === 'photo' ? croppedPhotoDataUrl || undefined : undefined;
  const trimmedName = name.trim();
  const isReady = trimmedName.length >= 2;

  return (
    <div className="space-y-5">
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
            onPhotoChange(croppedUrl);
            onIdentityModeChange('photo');
            URL.revokeObjectURL(rawPhotoObjectUrl);
            setRawPhotoObjectUrl(null);
          }}
        />
      )}

      <div>
        <label
          htmlFor="creator-participant-name"
          className="block text-sm font-medium text-slate-300 mb-1.5"
        >
          {nameLabel}
        </label>
        <input
          id="creator-participant-name"
          type="text"
          required
          maxLength={28}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={namePlaceholder}
          className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-4 py-3 text-white text-base placeholder-slate-500 focus:outline-none focus:border-amber-400"
        />
      </div>

      <div className="space-y-3">
        <span className="block text-sm font-bold text-white tracking-wide">
          ¿CÓMO QUIERES APARECER EN EL CONCURSO?
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onIdentityModeChange('avatar')}
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
                onIdentityModeChange('photo');
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

        {identityMode === 'avatar' && (
          <div className="bg-[#080E1E] border border-slate-800 rounded-2xl p-4 space-y-3">
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

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 max-h-64 overflow-y-auto pr-1 pt-0.5">
              {visibleAvatars.map((av) => {
                const selected =
                  identityMode === 'avatar' && avatarId === av.id;
                return (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => {
                      onAvatarIdChange(av.id);
                      onIdentityModeChange('avatar');
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
              {croppedPhotoDataUrl ? 'Seleccionar otra foto' : 'Abrir galería'}
            </button>
          </div>
        )}
      </div>

      {/* Live Preview */}
      <div className="bg-[#080E1E] border border-amber-400/40 rounded-2xl p-4 flex items-center gap-4">
        <AvatarBadge
          avatarId={avatarId}
          photoUrl={activePhotoUrl}
          name={trimmedName || 'Participante 1'}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
            Tu ficha en la batalla
          </p>
          <p className="font-display text-lg font-extrabold text-white truncate">
            {trimmedName || 'Escribe tu nombre'}
          </p>
          <p
            className={`text-xs inline-flex items-center gap-1 mt-0.5 ${
              isReady ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {isReady ? 'Listo para competir' : 'Mínimo 2 caracteres'}
          </p>
        </div>
      </div>
    </div>
  );
}
