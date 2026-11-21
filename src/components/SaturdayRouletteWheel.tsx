import {
  getSaturdayRouletteCategoryMeta,
  SATURDAY_ROULETTE_CATEGORIES,
  type SaturdayRouletteCategoryId,
} from '../shared/saturdayRouletteData';

interface SaturdayRouletteWheelProps {
  enabledCategories: SaturdayRouletteCategoryId[];
  angleDeg: number;
  spinning: boolean;
  size?: number;
  selectedCategoryId?: SaturdayRouletteCategoryId | null;
}

export function SaturdayRouletteWheel({
  enabledCategories,
  angleDeg,
  spinning,
  size = 360,
  selectedCategoryId,
}: SaturdayRouletteWheelProps) {
  const slots =
    enabledCategories.length >= 2
      ? enabledCategories.map((id) => getSaturdayRouletteCategoryMeta(id))
      : SATURDAY_ROULETTE_CATEGORIES;

  const count = slots.length;
  const sliceDeg = 360 / count;
  const cx = 210;
  const cy = 210;
  const r = 184;

  const polarToCartesian = (angleInDegrees: number, radius: number) => {
    const rad = ((angleInDegrees - 90) * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  };

  const pegs = Array.from({ length: Math.max(12, count * 2) }).map((_, i) => {
    const deg = (i * 360) / Math.max(12, count * 2);
    return polarToCartesian(deg, 193);
  });

  return (
    <div
      className="relative mx-auto flex items-center justify-center select-none"
      style={{ width: size, height: size, maxWidth: '100%' }}
    >
      {/* Top Pointer */}
      <div
        className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none"
        aria-hidden="true"
      >
        <div className="w-4 h-4 rounded-full bg-amber-300 border-2 border-[#080E1E] shadow-lg -mb-1.5" />
        <div className="w-0 h-0 border-l-[15px] border-r-[15px] border-t-[26px] border-l-transparent border-r-transparent border-t-amber-300 drop-shadow-[0_4px_8px_rgba(0,0,0,0.85)]" />
      </div>

      <svg
        viewBox="0 0 420 420"
        className="w-full h-full drop-shadow-[0_18px_38px_rgba(0,0,0,0.65)]"
        style={{
          transform: `rotate(${angleDeg}deg)`,
          transition: spinning
            ? 'transform 3.4s cubic-bezier(0.14, 0.86, 0.22, 1)'
            : 'transform 0.55s ease-out',
        }}
      >
        {/* Outer stage bezel */}
        <circle
          cx={cx}
          cy={cy}
          r={202}
          fill="#0F172A"
          stroke="#FBBF24"
          strokeWidth="6"
        />

        {/* Slices */}
        {slots.map((slot, idx) => {
          const startAngle = idx * sliceDeg;
          const endAngle = startAngle + sliceDeg;
          const start = polarToCartesian(endAngle, r);
          const end = polarToCartesian(startAngle, r);
          const largeArc = sliceDeg > 180 ? 1 : 0;
          const d = [
            'M',
            cx,
            cy,
            'L',
            end.x,
            end.y,
            'A',
            r,
            r,
            0,
            largeArc,
            1,
            start.x,
            start.y,
            'Z',
          ].join(' ');
          const midAngle = startAngle + sliceDeg / 2;
          const labelPos = polarToCartesian(midAngle, r * 0.64);
          const isSelected = !spinning && selectedCategoryId === slot.id;
          const labelText =
            count <= 6
              ? slot.label.length > 18
                ? `${slot.label.slice(0, 17)}…`
                : slot.label
              : slot.shortLabel;

          return (
            <g key={slot.id}>
              <path
                d={d}
                fill={slot.color}
                stroke={isSelected ? '#FEF08A' : '#080E1E'}
                strokeWidth={isSelected ? '3.5' : '2.5'}
              />
              <text
                x={labelPos.x}
                y={labelPos.y}
                fill="#FFFFFF"
                fontSize={count <= 6 ? '13.5' : count <= 9 ? '12.5' : '11.5'}
                fontWeight="800"
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${midAngle - 90}, ${labelPos.x}, ${labelPos.y})`}
                style={{ textShadow: '0 1.5px 3px rgba(0,0,0,0.85)' }}
              >
                {labelText}
              </text>
            </g>
          );
        })}

        {/* Rim pegs */}
        {pegs.map((pt, i) => (
          <circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r="3.2"
            fill="#FDE68A"
            stroke="#080E1E"
            strokeWidth="1"
          />
        ))}

        {/* Center medallion */}
        <circle
          cx={cx}
          cy={cy}
          r="38"
          fill="#080E1E"
          stroke="#FBBF24"
          strokeWidth="4.5"
        />
        <text
          x={cx}
          y={cy - 5}
          fill="#FBBF24"
          fontSize="10.5"
          fontWeight="900"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          RULETA
        </text>
        <text
          x={cx}
          y={cy + 9}
          fill="#F8FAFC"
          fontSize="9"
          fontWeight="800"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          SÁBADO
        </text>
      </svg>
    </div>
  );
}
