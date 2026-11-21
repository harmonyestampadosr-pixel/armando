import { useId } from 'react';
import { AvatarDefinition } from '../shared/avatars';

interface AvatarArtworkProps {
  avatar: AvatarDefinition;
  className?: string;
}

function renderSymbolIllustration(avatar: AvatarDefinition, gradLightId: string) {
  const accent = avatar.accent || '#FDE047';

  switch (avatar.symbolKey) {
    case 'cross-light':
      return (
        <g>
          <circle cx="50" cy="44" r="32" fill={`url(#${gradLightId})`} opacity="0.45" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <line
              key={deg}
              x1="50"
              y1="44"
              x2={50 + Math.cos((deg * Math.PI) / 180) * 34}
              y2={44 + Math.sin((deg * Math.PI) / 180) * 34}
              stroke={accent}
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.55"
            />
          ))}
          <rect x="44" y="18" width="12" height="64" rx="4" fill="#FEF9C3" stroke={accent} strokeWidth="2" />
          <rect x="25" y="34" width="50" height="12" rx="4" fill="#FEF9C3" stroke={accent} strokeWidth="2" />
        </g>
      );

    case 'open-bible':
      return (
        <g>
          <circle cx="50" cy="48" r="30" fill={`url(#${gradLightId})`} opacity="0.28" />
          <path d="M16 32 Q33 24 50 32 L50 74 Q33 66 16 74 Z" fill="#FFFBEB" stroke="#D97706" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M84 32 Q67 24 50 32 L50 74 Q67 66 84 74 Z" fill="#FEF3C7" stroke="#D97706" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M24 41 Q35 37 44 41 M24 50 Q35 46 44 50 M24 59 Q35 55 44 59" stroke="#B45309" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M56 41 Q65 37 76 41 M56 50 Q65 46 76 50 M56 59 Q65 55 76 59" stroke="#B45309" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M48 68 L48 84 L52 80 L56 84 L56 68 Z" fill="#EF4444" />
        </g>
      );

    case 'dove':
      return (
        <g>
          <circle cx="50" cy="50" r="32" fill={`url(#${gradLightId})`} opacity="0.35" />
          <path
            d="M22 46 C26 28 46 28 52 44 C60 22 76 22 78 36 C70 42 66 48 66 54 C74 56 80 60 82 64 C68 68 58 66 50 62 C44 72 30 74 20 66 C30 62 34 54 22 46 Z"
            fill="#FFFFFF"
            stroke="#E0F2FE"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="67" cy="40" r="2" fill="#0F172A" />
          <path d="M74 41 L82 43 L75 46 Z" fill="#F59E0B" />
          <path d="M75 46 Q82 54 88 48" stroke="#22C55E" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
      );

    case 'lamb':
      return (
        <g>
          <circle cx="50" cy="36" r="22" fill={accent} opacity="0.25" />
          <path d="M30 64 C24 56 26 42 36 40 C40 30 58 30 64 40 C74 42 76 56 70 66 C64 72 36 72 30 64 Z" fill="#FFFFFF" />
          <ellipse cx="44" cy="54" rx="11" ry="13" fill="#FDE68A" />
          <ellipse cx="31" cy="50" rx="5" ry="3.5" transform="rotate(-25 31 50)" fill="#FDBA74" />
          <ellipse cx="57" cy="50" rx="5" ry="3.5" transform="rotate(25 57 50)" fill="#FDBA74" />
          <circle cx="40" cy="52" r="2" fill="#1E293B" />
          <circle cx="48" cy="52" r="2" fill="#1E293B" />
          <path d="M41 59 Q44 62 47 59" stroke="#9A3412" strokeWidth="2" fill="none" strokeLinecap="round" />
          <rect x="64" y="24" width="3" height="46" rx="1.5" fill="#FBBF24" />
          <path d="M67 25 L84 31 L67 37 Z" fill="#F8FAFC" />
          <path d="M72 28 L72 34 M69 31 L75 31" stroke="#EF4444" strokeWidth="1.8" />
        </g>
      );

    case 'lion':
      return (
        <g>
          <circle cx="50" cy="54" r="28" fill="#B45309" stroke={accent} strokeWidth="2.5" />
          <circle cx="50" cy="54" r="20" fill="#FBBF24" />
          <polygon points="37,30 43,22 50,28 57,22 63,30" fill="#FDE047" stroke="#92400E" strokeWidth="1.5" />
          <ellipse cx="36" cy="40" rx="5" ry="5" fill="#F59E0B" />
          <ellipse cx="64" cy="40" rx="5" ry="5" fill="#F59E0B" />
          <circle cx="43" cy="51" r="2.6" fill="#1E293B" />
          <circle cx="57" cy="51" r="2.6" fill="#1E293B" />
          <polygon points="46,58 54,58 50,63" fill="#78350F" />
          <path d="M43 66 Q50 70 57 66" stroke="#78350F" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        </g>
      );

    case 'crown':
      return (
        <g>
          <circle cx="50" cy="48" r="30" fill={`url(#${gradLightId})`} opacity="0.28" />
          <path
            d="M18 68 L14 36 L34 50 L50 24 L66 50 L86 36 L82 68 Z"
            fill="#FACC15"
            stroke="#FEF08A"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <rect x="18" y="68" width="64" height="10" rx="4" fill="#D97706" />
          <circle cx="50" cy="53" r="4.5" fill="#EF4444" />
          <circle cx="32" cy="58" r="3.5" fill="#38BDF8" />
          <circle cx="68" cy="58" r="3.5" fill="#10B981" />
          <circle cx="50" cy="22" r="4" fill="#FEF08A" />
        </g>
      );

    case 'ark':
      return (
        <g>
          <path d="M18 52 A32 32 0 0 1 82 52" fill="none" stroke="#EF4444" strokeWidth="4" />
          <path d="M22 52 A28 28 0 0 1 78 52" fill="none" stroke="#FACC15" strokeWidth="4" />
          <path d="M26 52 A24 24 0 0 1 74 52" fill="none" stroke="#22C55E" strokeWidth="4" />
          <rect x="34" y="42" width="32" height="14" rx="2" fill="#92400E" stroke="#FDE68A" strokeWidth="1.5" />
          <polygon points="31,42 50,33 69,42" fill="#B45309" />
          <path d="M16 56 L84 56 L74 74 L26 74 Z" fill="#78350F" stroke="#F59E0B" strokeWidth="2" />
          <path d="M10 76 Q25 70 40 76 T70 76 T90 76" stroke="#38BDF8" strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>
      );

    case 'trumpet':
      return (
        <g transform="rotate(-18 50 50)">
          <rect x="16" y="46" width="40" height="8" rx="4" fill="#FACC15" stroke="#FEF08A" strokeWidth="1.5" />
          <polygon points="54,46 82,30 82,70 54,54" fill="#FBBF24" stroke="#FEF08A" strokeWidth="2" strokeLinejoin="round" />
          <path d="M86 40 Q94 50 86 60" stroke="#FFFFFF" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M90 32 Q100 50 90 68" stroke={accent} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.8" />
        </g>
      );

    case 'lamp':
      return (
        <g>
          <circle cx="50" cy="30" r="22" fill={`url(#${gradLightId})`} opacity="0.5" />
          <path d="M50 16 C58 26 58 36 50 40 C42 36 42 26 50 16 Z" fill="#FDE047" />
          <path d="M50 23 C54 29 54 35 50 38 C46 35 46 29 50 23 Z" fill="#FFFFFF" />
          <path d="M26 54 C26 44 74 44 74 54 L66 72 L34 72 Z" fill="#F59E0B" stroke="#FEF08A" strokeWidth="2" />
          <path d="M74 52 C84 50 84 62 72 62" fill="none" stroke="#FDE047" strokeWidth="4" strokeLinecap="round" />
          <rect x="38" y="72" width="24" height="7" rx="3" fill="#B45309" />
        </g>
      );

    case 'shield':
      return (
        <g>
          <path
            d="M50 16 L80 28 V52 C80 70 64 81 50 86 C36 81 20 70 20 52 V28 Z"
            fill="#1E3A8A"
            stroke="#FBBF24"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <rect x="46" y="29" width="8" height="42" rx="2" fill="#FDE047" />
          <rect x="33" y="42" width="34" height="8" rx="2" fill="#FDE047" />
        </g>
      );

    case 'heart-cross':
      return (
        <g>
          <path
            d="M50 82 C24 66 16 48 16 35 C16 24 25 18 35 18 C42 18 47 22 50 27 C53 22 58 18 65 18 C75 18 84 24 84 35 C84 48 76 66 50 82 Z"
            fill="#F43F5E"
            stroke="#FECDD3"
            strokeWidth="2.5"
          />
          <rect x="46" y="31" width="8" height="32" rx="2" fill="#FEF08A" />
          <rect x="36" y="41" width="28" height="8" rx="2" fill="#FEF08A" />
        </g>
      );

    case 'praying-hands':
      return (
        <g>
          <circle cx="50" cy="38" r="28" fill={`url(#${gradLightId})`} opacity="0.4" />
          <path d="M50 22 L33 58 L46 66 L50 38 Z" fill="#FDBA74" stroke="#9A3412" strokeWidth="2" strokeLinejoin="round" />
          <path d="M50 22 L67 58 L54 66 L50 38 Z" fill="#FED7AA" stroke="#9A3412" strokeWidth="2" strokeLinejoin="round" />
          <path d="M28 74 L46 65 L50 78 L30 82 Z" fill="#E2E8F0" />
          <path d="M72 74 L54 65 L50 78 L70 82 Z" fill="#CBD5E1" />
          <path d="M50 10 L50 18 M36 16 L40 22 M64 16 L60 22" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
        </g>
      );

    case 'calvary':
      return (
        <g>
          <circle cx="50" cy="54" r="26" fill={accent} opacity="0.55" />
          <path d="M12 84 Q50 56 88 84 Z" fill="#0F172A" />
          <rect x="47" y="24" width="6" height="44" rx="1.5" fill="#FEF9C3" />
          <rect x="34" y="34" width="32" height="6" rx="1.5" fill="#FEF9C3" />
        </g>
      );

    case 'glow-bible':
      return (
        <g>
          <circle cx="50" cy="36" r="28" fill={`url(#${gradLightId})`} opacity="0.55" />
          <rect x="26" y="34" width="48" height="44" rx="6" fill="#78350F" stroke="#FDE047" strokeWidth="2.5" />
          <rect x="31" y="34" width="5" height="44" fill="#451A03" />
          <rect x="49" y="43" width="5" height="24" rx="1" fill="#FDE047" />
          <rect x="42" y="49" width="19" height="5" rx="1" fill="#FDE047" />
          <path d="M50 14 L50 24 M30 20 L36 27 M70 20 L64 27" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
        </g>
      );

    case 'thorns-dawn':
      return (
        <g>
          <circle cx="50" cy="50" r="30" fill={`url(#${gradLightId})`} opacity="0.35" />
          <circle cx="50" cy="52" r="23" fill="none" stroke="#FDE047" strokeWidth="5" strokeDasharray="7 4" />
          <circle cx="50" cy="52" r="19" fill="none" stroke="#F59E0B" strokeWidth="3" />
          <polygon points="50,20 53,27 60,27 54,31 56,38 50,34 44,38 46,31 40,27 47,27" fill="#FFFFFF" />
        </g>
      );

    case 'anchor':
      return (
        <g>
          <circle cx="50" cy="24" r="6" fill="none" stroke={accent} strokeWidth="4" />
          <rect x="47" y="30" width="6" height="46" rx="3" fill={accent} />
          <rect x="34" y="38" width="32" height="5" rx="2.5" fill={accent} />
          <path d="M24 58 C24 76 76 76 76 58" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />
          <polygon points="20,62 24,50 32,60" fill="#FFFFFF" />
          <polygon points="80,62 76,50 68,60" fill="#FFFFFF" />
        </g>
      );

    case 'olive':
      return (
        <g>
          <path d="M24 76 Q46 52 76 22" fill="none" stroke="#FEF3C7" strokeWidth="4" strokeLinecap="round" />
          <ellipse cx="42" cy="46" rx="11" ry="5" transform="rotate(-35 42 46)" fill="#4ADE80" />
          <ellipse cx="56" cy="56" rx="11" ry="5" transform="rotate(20 56 56)" fill="#86EFAC" />
          <ellipse cx="58" cy="34" rx="10" ry="4.5" transform="rotate(-25 58 34)" fill="#4ADE80" />
          <ellipse cx="70" cy="40" rx="9" ry="4.5" transform="rotate(25 70 40)" fill="#86EFAC" />
          <ellipse cx="32" cy="58" rx="10" ry="4.5" transform="rotate(-40 32 58)" fill="#86EFAC" />
          <circle cx="48" cy="52" r="4" fill="#FDE047" />
          <circle cx="62" cy="44" r="3.5" fill="#FDE047" />
        </g>
      );

    case 'star':
    default:
      return (
        <g>
          <circle cx="50" cy="48" r="32" fill={`url(#${gradLightId})`} opacity="0.4" />
          <polygon
            points="50,14 58,40 84,48 58,56 50,84 42,56 16,48 42,40"
            fill={accent}
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="50" cy="48" r="7" fill="#FFFFFF" />
        </g>
      );
  }
}

function renderProp(prop?: AvatarDefinition['prop']) {
  switch (prop) {
    case 'tablets':
      return (
        <g>
          <rect x="64" y="56" width="12" height="18" rx="5" fill="#CBD5E1" stroke="#475569" strokeWidth="1.5" />
          <rect x="74" y="56" width="12" height="18" rx="5" fill="#E2E8F0" stroke="#475569" strokeWidth="1.5" />
          <line x1="67" y1="63" x2="73" y2="63" stroke="#64748B" strokeWidth="1.5" />
          <line x1="77" y1="63" x2="83" y2="63" stroke="#64748B" strokeWidth="1.5" />
        </g>
      );
    case 'harp':
      return (
        <g>
          <path d="M68 54 C80 50 86 64 78 76 L68 76 Z" fill="none" stroke="#FBBF24" strokeWidth="3" strokeLinejoin="round" />
          <line x1="72" y1="57" x2="72" y2="75" stroke="#FEF08A" strokeWidth="1.2" />
          <line x1="76" y1="58" x2="76" y2="75" stroke="#FEF08A" strokeWidth="1.2" />
        </g>
      );
    case 'scroll':
      return (
        <g>
          <rect x="65" y="57" width="18" height="20" rx="2" fill="#FEF3C7" stroke="#B45309" strokeWidth="1.5" />
          <rect x="63" y="56" width="22" height="4" rx="2" fill="#D97706" />
          <rect x="63" y="74" width="22" height="4" rx="2" fill="#D97706" />
        </g>
      );
    case 'coat-stripes':
      return (
        <g>
          <rect x="33" y="72" width="6" height="18" fill="#FACC15" />
          <rect x="43" y="70" width="6" height="20" fill="#EC4899" />
          <rect x="53" y="70" width="6" height="20" fill="#38BDF8" />
          <rect x="63" y="72" width="6" height="18" fill="#22C55E" />
        </g>
      );
    case 'wheat':
      return (
        <g>
          <line x1="76" y1="80" x2="76" y2="54" stroke="#FDE047" strokeWidth="2.5" strokeLinecap="round" />
          <ellipse cx="72" cy="60" rx="4" ry="2.5" transform="rotate(-30 72 60)" fill="#FBBF24" />
          <ellipse cx="80" cy="60" rx="4" ry="2.5" transform="rotate(30 80 60)" fill="#FBBF24" />
          <ellipse cx="72" cy="67" rx="4" ry="2.5" transform="rotate(-30 72 67)" fill="#FBBF24" />
          <ellipse cx="80" cy="67" rx="4" ry="2.5" transform="rotate(30 80 67)" fill="#FBBF24" />
        </g>
      );
    case 'palm':
    case 'olive-twig':
      return (
        <g>
          <path d="M74 82 Q76 66 84 54" stroke="#86EFAC" strokeWidth="2.5" fill="none" />
          <ellipse cx="73" cy="62" rx="6" ry="2.5" transform="rotate(-30 73 62)" fill="#4ADE80" />
          <ellipse cx="81" cy="65" rx="6" ry="2.5" transform="rotate(20 81 65)" fill="#22C55E" />
        </g>
      );
    case 'stars':
      return (
        <g fill="#FEF08A">
          <polygon points="20,22 22,26 26,27 22,29 20,33 18,29 14,27 18,26" />
          <polygon points="80,24 82,28 86,29 82,31 80,35 78,31 74,29 78,28" />
        </g>
      );
    case 'ark-mini':
      return (
        <g>
          <path d="M64 68 L88 68 L84 77 L68 77 Z" fill="#92400E" stroke="#FDE68A" strokeWidth="1.2" />
          <rect x="70" y="62" width="12" height="6" fill="#B45309" />
        </g>
      );
    case 'horn':
      return (
        <path d="M66 68 Q78 72 86 58 L81 55 Q74 65 66 64 Z" fill="#FDE68A" stroke="#B45309" strokeWidth="1.5" />
      );
    case 'keys':
      return (
        <g>
          <circle cx="75" cy="60" r="5" fill="none" stroke="#FACC15" strokeWidth="2.5" />
          <line x1="75" y1="65" x2="75" y2="79" stroke="#FACC15" strokeWidth="2.5" />
          <line x1="75" y1="73" x2="81" y2="73" stroke="#FACC15" strokeWidth="2.5" />
        </g>
      );
    case 'lily':
      return (
        <g>
          <circle cx="76" cy="64" r="6" fill="#FFFFFF" />
          <circle cx="76" cy="64" r="2.2" fill="#FACC15" />
          <line x1="76" y1="70" x2="76" y2="82" stroke="#4ADE80" strokeWidth="2.5" />
        </g>
      );
    case 'pitcher':
      return (
        <g>
          <ellipse cx="76" cy="69" rx="7" ry="9" fill="#EA580C" stroke="#FED7AA" strokeWidth="1.5" />
          <rect x="73" y="57" width="6" height="4" rx="1" fill="#FDBA74" />
        </g>
      );
    case 'shield-mini':
      return (
        <path d="M76 56 L86 60 V69 C86 76 80 80 76 82 C72 80 66 76 66 69 V60 Z" fill="#1E3A8A" stroke="#FBBF24" strokeWidth="2" />
      );
    case 'pillars':
      return (
        <g fill="#E2E8F0">
          <rect x="65" y="56" width="6" height="24" rx="1" />
          <rect x="77" y="56" width="6" height="24" rx="1" />
        </g>
      );
    case 'flame':
      return (
        <path d="M76 52 C84 62 84 74 76 78 C68 74 68 62 76 52 Z" fill="#FACC15" stroke="#EF4444" strokeWidth="2" />
      );
    case 'temple':
      return (
        <g>
          <polygon points="64,64 76,55 88,64" fill="#FACC15" />
          <rect x="66" y="64" width="20" height="14" fill="#FEF3C7" />
        </g>
      );
    case 'bible':
    case 'notes':
      return (
        <g>
          <rect x="33" y="68" width="34" height="22" rx="3" fill="#1E293B" stroke="#FBBF24" strokeWidth="2" />
          <rect x="48" y="73" width="4" height="12" fill="#FDE047" />
          <rect x="44" y="76" width="12" height="3.5" fill="#FDE047" />
        </g>
      );
    case 'praying':
      return (
        <g>
          <path d="M50 58 L41 78 L50 82 Z" fill="#FED7AA" stroke="#9A3412" strokeWidth="1.2" />
          <path d="M50 58 L59 78 L50 82 Z" fill="#FDBA74" stroke="#9A3412" strokeWidth="1.2" />
        </g>
      );
    case 'mic':
      return (
        <g>
          <circle cx="76" cy="59" r="5.5" fill="#E2E8F0" stroke="#475569" strokeWidth="1.5" />
          <rect x="74" y="64" width="4" height="16" rx="1.5" fill="#0F172A" />
          <path d="M20 28 Q26 22 30 28" stroke="#FDE047" strokeWidth="2" fill="none" />
        </g>
      );
    case 'guitar':
      return (
        <g>
          <ellipse cx="64" cy="76" rx="11" ry="9" transform="rotate(-25 64 76)" fill="#B45309" stroke="#FDE68A" strokeWidth="1.5" />
          <circle cx="64" cy="76" r="3" fill="#451A03" />
          <line x1="70" y1="68" x2="84" y2="54" stroke="#FDE68A" strokeWidth="3.5" strokeLinecap="round" />
        </g>
      );
    case 'keyboard':
      return (
        <g>
          <rect x="26" y="72" width="48" height="14" rx="2" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2" />
          <rect x="33" y="72" width="4" height="8" fill="#0F172A" />
          <rect x="41" y="72" width="4" height="8" fill="#0F172A" />
          <rect x="53" y="72" width="4" height="8" fill="#0F172A" />
          <rect x="61" y="72" width="4" height="8" fill="#0F172A" />
        </g>
      );
    case 'tambourine':
      return (
        <g>
          <circle cx="74" cy="67" r="10" fill="#FDE68A" stroke="#B45309" strokeWidth="3" />
          <circle cx="74" cy="57" r="2" fill="#E2E8F0" />
          <circle cx="84" cy="67" r="2" fill="#E2E8F0" />
          <circle cx="74" cy="77" r="2" fill="#E2E8F0" />
        </g>
      );
    case 'podium':
      return (
        <g>
          <polygon points="30,72 70,72 64,92 36,92" fill="#0F172A" stroke="#38BDF8" strokeWidth="1.5" />
          <rect x="42" y="67" width="16" height="5" rx="1.5" fill="#FBBF24" />
        </g>
      );
    case 'backpack':
      return (
        <g>
          <circle cx="77" cy="67" r="9" fill="#0EA5E9" stroke="#FFFFFF" strokeWidth="1.5" />
          <path d="M71 67 Q77 62 83 67 M77 58 V76" stroke="#4ADE80" strokeWidth="1.8" fill="none" />
        </g>
      );
    case 'compass':
      return (
        <g>
          <circle cx="77" cy="67" r="9" fill="#1E293B" stroke="#FBBF24" strokeWidth="2" />
          <polygon points="77,60 80,67 77,74 74,67" fill="#EF4444" />
        </g>
      );
    case 'campfire':
      return (
        <g>
          <path d="M76 58 C83 66 82 75 76 78 C70 75 69 66 76 58 Z" fill="#FACC15" stroke="#EA580C" strokeWidth="2" />
          <rect x="68" y="78" width="16" height="4" rx="2" fill="#78350F" />
        </g>
      );
    default:
      return null;
  }
}

function renderCharacterIllustration(avatar: AvatarDefinition) {
  const skin = avatar.skin || '#EAC0A2';
  const hair = avatar.hairColor || '#1E293B';
  const outfit = avatar.outfitColor || '#2563EB';
  const secondary = avatar.secondaryColor || '#FDE047';
  const isFemale = avatar.gender === 'female';

  return (
    <g>
      {/* Back Hair / Veil for long styles */}
      {avatar.hairStyle === 'long' && (
        <path d="M27 36 C25 56 26 70 34 74 L66 74 C74 70 75 56 73 36 Z" fill={hair} />
      )}
      {avatar.hairStyle === 'wavy' && isFemale && (
        <path d="M28 34 C24 52 26 66 34 72 L66 72 C74 66 76 52 72 34 Z" fill={hair} />
      )}
      {avatar.hairStyle === 'afro' && (
        <circle cx="50" cy="36" r="24" fill={hair} />
      )}
      {avatar.hairStyle === 'veil' && (
        <path d="M24 38 C24 20 76 20 76 38 L80 76 L20 76 Z" fill={secondary} opacity="0.95" />
      )}
      {avatar.hairStyle === 'headcloth' && (
        <path d="M25 36 C25 18 75 18 75 36 L78 72 L22 72 Z" fill="#F8FAFC" />
      )}
      {avatar.hairStyle === 'bun' && (
        <circle cx="50" cy="17" r="9" fill={hair} />
      )}
      {avatar.hairStyle === 'braids' && (
        <g fill={hair}>
          <rect x="25" y="42" width="8" height="30" rx="4" />
          <rect x="67" y="42" width="8" height="30" rx="4" />
        </g>
      )}

      {/* Shoulders & Outfit */}
      <path d="M18 92 C18 72 32 64 50 64 C68 64 82 72 82 92 Z" fill={outfit} />
      {avatar.outfitStyle === 'robe' && (
        <path d="M36 65 L50 92 L64 65" fill="none" stroke={secondary} strokeWidth="4" strokeLinejoin="round" />
      )}
      {avatar.outfitStyle === 'hoodie' && (
        <path d="M36 67 Q50 78 64 67" fill="none" stroke="#FFFFFF" strokeWidth="2.5" opacity="0.7" />
      )}
      {avatar.outfitStyle === 'jacket' && (
        <polygon points="42,66 50,86 58,66" fill="#F8FAFC" opacity="0.9" />
      )}

      {/* Neck */}
      <rect x="44" y="55" width="12" height="13" rx="5" fill={skin} />

      {/* Ears */}
      <circle cx="31" cy="43" r="4.2" fill={skin} />
      <circle cx="69" cy="43" r="4.2" fill={skin} />

      {/* Head */}
      <ellipse cx="50" cy="41" rx="18" ry="20" fill={skin} />

      {/* Eyes & Smile */}
      <circle cx="43" cy="41" r="2.2" fill="#0F172A" />
      <circle cx="57" cy="41" r="2.2" fill="#0F172A" />
      <path d="M43 49 Q50 54 57 49" fill="none" stroke="#7C2D12" strokeWidth="2.2" strokeLinecap="round" />

      {/* Beard */}
      {avatar.beard === 'short' && (
        <path d="M34 45 C34 57 42 62 50 62 C58 62 66 57 66 45 C62 52 57 55 50 55 C43 55 38 52 34 45 Z" fill={hair} opacity="0.9" />
      )}
      {avatar.beard === 'patriarch' && (
        <path d="M34 44 C33 60 40 72 50 74 C60 72 67 60 66 44 C61 52 56 54 50 54 C44 54 39 52 34 44 Z" fill={hair} />
      )}

      {/* Glasses */}
      {avatar.glasses && (
        <g fill="none" stroke="#0F172A" strokeWidth="1.8">
          <circle cx="43" cy="41" r="5" />
          <circle cx="57" cy="41" r="5" />
          <line x1="48" y1="41" x2="52" y2="41" />
        </g>
      )}

      {/* Front Hair Styles */}
      {(avatar.hairStyle === 'short' || avatar.hairStyle === 'wavy') && (
        <path d="M32 37 C32 21 68 21 68 37 C62 29 38 29 32 37 Z" fill={hair} />
      )}
      {avatar.hairStyle === 'curly' && (
        <g fill={hair}>
          <circle cx="38" cy="26" r="7" />
          <circle cx="50" cy="23" r="8" />
          <circle cx="62" cy="26" r="7" />
          <circle cx="33" cy="34" r="5" />
          <circle cx="67" cy="34" r="5" />
        </g>
      )}
      {(avatar.hairStyle === 'bob' || avatar.hairStyle === 'long' || avatar.hairStyle === 'bun' || avatar.hairStyle === 'braids') && (
        <path d="M32 37 C32 21 68 21 68 37 C60 28 45 27 32 37 Z" fill={hair} />
      )}
      {avatar.hairStyle === 'bob' && (
        <g fill={hair}>
          <rect x="29" y="34" width="6" height="20" rx="3" />
          <rect x="65" y="34" width="6" height="20" rx="3" />
        </g>
      )}
      {avatar.hairStyle === 'cap' && (
        <g>
          <path d="M31 33 C31 19 69 19 69 33 Z" fill="#F59E0B" />
          <rect x="31" y="30" width="44" height="5" rx="2.5" fill="#B45309" />
        </g>
      )}
      {avatar.hairStyle === 'headcloth' && (
        <rect x="31" y="26" width="38" height="4.5" rx="2" fill="#B45309" />
      )}

      {/* Crowns / Diadems */}
      {avatar.headwear === 'crown' && (
        <polygon points="36,24 38,14 44,19 50,11 56,19 62,14 64,24" fill="#FACC15" stroke="#92400E" strokeWidth="1.2" />
      )}
      {avatar.headwear === 'diadem' && (
        <path d="M34 26 Q50 18 66 26" fill="none" stroke="#FDE047" strokeWidth="3.5" strokeLinecap="round" />
      )}

      {/* Character Prop */}
      {renderProp(avatar.prop)}
    </g>
  );
}

export function AvatarArtwork({ avatar, className = 'w-full h-full' }: AvatarArtworkProps) {
  const uid = useId().replace(/:/g, '');
  const bgId = `bg-${avatar.id}-${uid}`;
  const glowId = `glow-${avatar.id}-${uid}`;

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={bgId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={avatar.bgFrom} />
          <stop offset="100%" stopColor={avatar.bgTo} />
        </linearGradient>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="100%" stopColor={avatar.accent} stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="100" height="100" fill={`url(#${bgId})`} />
      <circle cx="50" cy="50" r="46" fill="none" stroke="#FFFFFF" strokeOpacity="0.14" strokeWidth="2" />

      {avatar.kind === 'symbol'
        ? renderSymbolIllustration(avatar, glowId)
        : renderCharacterIllustration(avatar)}
    </svg>
  );
}
