import React from 'react';

export type MysteryBoxVisualState = 'idle' | 'prepared' | 'opening' | 'revealed';

interface MysteryBoxArtworkProps {
  state: MysteryBoxVisualState;
  suspenseNumber?: number | null;
  accentColor?: string;
  size?: number;
  onClick?: () => void;
  disabled?: boolean;
}

export const MysteryBoxArtwork: React.FC<MysteryBoxArtworkProps> = ({
  state,
  suspenseNumber,
  accentColor = '#F59E0B',
  size = 240,
  onClick,
  disabled = false,
}) => {
  const isOpening = state === 'opening';
  const isRevealed = state === 'revealed';
  const isPrepared = state === 'prepared';

  const containerAnimClass = isOpening
    ? 'animate-mystery-rumble'
    : state === 'idle' || isPrepared
      ? 'animate-mystery-float'
      : '';

  return (
    <div
      className="relative inline-flex flex-col items-center justify-center select-none"
      style={{ width: size, height: size }}
    >
      {/* Subtle stage spotlight glow behind box */}
      <div
        className="absolute inset-4 rounded-full blur-2xl transition-opacity duration-500 pointer-events-none"
        style={{
          background: isRevealed
            ? `radial-gradient(circle, ${accentColor}55 0%, transparent 70%)`
            : isOpening || isPrepared
              ? `radial-gradient(circle, #F59E0B44 0%, transparent 70%)`
              : `radial-gradient(circle, #38BDF826 0%, transparent 70%)`,
          opacity: isOpening || isRevealed ? 1 : 0.75,
        }}
      />

      <button
        type="button"
        onClick={onClick}
        disabled={disabled || !onClick}
        aria-label={
          isRevealed
            ? 'Cabina de sorpresas abierta'
            : 'Abrir caja misteriosa de sorpresas'
        }
        className={`relative w-full h-full flex items-center justify-center focus-visible:outline-2 focus-visible:outline-amber-400 rounded-3xl ${
          onClick && !disabled ? 'cursor-pointer' : 'cursor-default'
        } ${containerAnimClass}`}
      >
        <svg
          viewBox="0 0 260 260"
          className="w-full h-full drop-shadow-[0_18px_36px_rgba(0,0,0,0.55)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="boxBodyGrad" x1="40" y1="100" x2="220" y2="225" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1E2B4D" />
              <stop offset="100%" stopColor="#0D1529" />
            </linearGradient>
            <linearGradient id="boxLidGrad" x1="36" y1="68" x2="224" y2="118" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#283966" />
              <stop offset="100%" stopColor="#131E3A" />
            </linearGradient>
            <linearGradient id="goldTrim" x1="0" y1="0" x2="260" y2="260" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#B45309" />
            </linearGradient>
            <linearGradient id="lightBeam" x1="130" y1="120" x2="130" y2="12" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={accentColor} stopOpacity="0.65" />
              <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Pedestal shadow */}
          <ellipse cx="130" cy="228" rx="84" ry="12" fill="#040812" fillOpacity="0.7" />

          {/* Light rays burst when opening or revealed */}
          {(isRevealed || isOpening) && (
            <g opacity={isRevealed ? 0.95 : 0.6}>
              <polygon points="78,118 40,22 106,18" fill="url(#lightBeam)" />
              <polygon points="108,118 106,12 154,12 152,118" fill="url(#lightBeam)" />
              <polygon points="154,118 154,18 220,22 182,118" fill="url(#lightBeam)" />
            </g>
          )}

          {/* Chest / Booth Main Body */}
          <rect
            x="48"
            y="108"
            width="164"
            height="112"
            rx="16"
            fill="url(#boxBodyGrad)"
            stroke="url(#goldTrim)"
            strokeWidth="4"
          />

          {/* Decorative vertical gold bands on chest body */}
          <rect x="74" y="110" width="12" height="108" fill="url(#goldTrim)" fillOpacity="0.22" />
          <rect x="174" y="110" width="12" height="108" fill="url(#goldTrim)" fillOpacity="0.22" />

          {/* Recessed center panel */}
          <rect
            x="92"
            y="124"
            width="76"
            height="80"
            rx="10"
            fill="#0A1224"
            stroke="#334155"
            strokeWidth="1.5"
          />

          {/* Mystery Question Emblem or Star inside */}
          {!isRevealed ? (
            <g>
              <circle
                cx="130"
                cy="164"
                r="26"
                fill={isPrepared || isOpening ? '#F59E0B' : '#1E293B'}
                fillOpacity={isPrepared || isOpening ? '0.22' : '0.8'}
                stroke="url(#goldTrim)"
                strokeWidth="2.5"
              />
              <text
                x="130"
                y="175"
                textAnchor="middle"
                fill="#FDE68A"
                fontSize="34"
                fontWeight="800"
                fontFamily="Outfit, sans-serif"
              >
                ?
              </text>
            </g>
          ) : (
            <g>
              <circle
                cx="130"
                cy="164"
                r="26"
                fill={accentColor}
                fillOpacity="0.25"
                stroke={accentColor}
                strokeWidth="2.5"
              />
              <path
                d="M130 144 L135 157 L149 158 L138 167 L141 180 L130 173 L119 180 L122 167 L111 158 L125 157 Z"
                fill="#FDE68A"
              />
            </g>
          )}

          {/* Chest / Booth Lid */}
          <g className={isRevealed ? 'animate-mystery-lid-open origin-bottom-left' : ''}>
            <path
              d="M40 94 C40 76 54 66 72 66 H188 C206 66 220 76 220 94 V112 H40 V94 Z"
              fill="url(#boxLidGrad)"
              stroke="url(#goldTrim)"
              strokeWidth="4"
            />
            <rect x="74" y="68" width="12" height="42" fill="url(#goldTrim)" fillOpacity="0.28" />
            <rect x="174" y="68" width="12" height="42" fill="url(#goldTrim)" fillOpacity="0.28" />
            {/* Center Gold Clasp */}
            <rect
              x="116"
              y="98"
              width="28"
              height="24"
              rx="6"
              fill="url(#goldTrim)"
              stroke="#78350F"
              strokeWidth="2"
            />
            <circle cx="130" cy="109" r="4" fill="#080E1E" />
          </g>
        </svg>

        {/* Theatrical 3-2-1 suspense countdown overlay */}
        {isOpening && typeof suspenseNumber === 'number' && suspenseNumber > 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-24 h-24 rounded-full bg-[#080E1E]/90 border-2 border-amber-400 shadow-2xl flex items-center justify-center">
              <span className="font-display font-extrabold text-5xl text-amber-300 tabular-nums">
                {suspenseNumber}
              </span>
            </div>
          </div>
        )}
      </button>
    </div>
  );
};
