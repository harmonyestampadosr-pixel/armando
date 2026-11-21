import { useEffect, useState } from 'react';
import { getAvatarById } from '../shared/avatars';
import { AvatarArtwork } from './AvatarArtwork';

interface AvatarBadgeProps {
  avatarId: string;
  photoUrl?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'w-9 h-9',
  md: 'w-11 h-11',
  lg: 'w-16 h-16',
  xl: 'w-20 h-20',
  '2xl': 'w-24 h-24',
};

export function AvatarBadge({
  avatarId,
  photoUrl,
  name,
  size = 'md',
  className = '',
}: AvatarBadgeProps) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [photoUrl]);

  const avatar = getAvatarById(avatarId);
  const showPhoto = Boolean(photoUrl && !imgFailed);
  const label = name ? `Identificación de ${name}` : `Avatar ${avatar.label}`;

  return (
    <div
      className={`${SIZE_CLASSES[size]} rounded-full overflow-hidden flex items-center justify-center select-none shrink-0 shadow-sm ring-2 ring-white/15 bg-[#080E1E] ${className}`}
      title={name || avatar.label}
      aria-label={label}
    >
      {showPhoto ? (
        <img
          src={photoUrl}
          alt={label}
          className="w-full h-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <AvatarArtwork avatar={avatar} className="w-full h-full" />
      )}
    </div>
  );
}
