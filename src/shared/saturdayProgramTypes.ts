export type SaturdayProgramDuration = 60 | 90 | 120;

export type SaturdayProgramStatus = 'draft' | 'final';

export type SaturdayActivityCategory =
  | 'bienvenida'
  | 'rompehielos'
  | 'alabanza'
  | 'juego'
  | 'actividad_biblica'
  | 'reflexion'
  | 'aplicacion'
  | 'desafio'
  | 'despedida'
  | 'personalizada';

export interface SaturdayProgramActivity {
  id: string;
  category: SaturdayActivityCategory;
  categoryLabel: string;
  title: string;
  description: string;
  leaderHint?: string;
  durationMin: number;
}

export interface SaturdaySimilarityWarning {
  activityId: string;
  activityTitle: string;
  similarToProgramId: string;
  similarToProgramTitle: string;
  similarToDate: string;
  reason: string;
}

export interface SaturdayProgram {
  id: string;
  title: string;
  centralTheme: string;
  mainBibleText: string;
  mainBibleVerseQuote?: string;
  spiritualObjective: string;
  scheduledDate: string;
  durationMinutes: SaturdayProgramDuration;
  status: SaturdayProgramStatus;
  directorName?: string;
  directorNotes: string;
  activities: SaturdayProgramActivity[];
  createdAt: number;
  updatedAt: number;
  finalizedAt?: number;
  duplicatedFromId?: string;
  generatedByAi?: boolean;
  customFocus?: string;
  varietyNotice?: string;
  varietyWarnings?: SaturdaySimilarityWarning[];
}

export interface SaturdayActivityAlternative {
  title: string;
  description: string;
  leaderHint: string;
  durationMin: number;
}

export interface SaturdayCategoryMeta {
  id: SaturdayActivityCategory;
  label: string;
  badgeClass: string;
  accentHex: string;
  defaultRatio: number; // Relative share used to distribute 60 / 90 / 120 min
}

export const SATURDAY_CATEGORY_META: Record<
  SaturdayActivityCategory,
  SaturdayCategoryMeta
> = {
  bienvenida: {
    id: 'bienvenida',
    label: 'Bienvenida creativa',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-400/40',
    accentHex: '#F59E0B',
    defaultRatio: 0.07,
  },
  rompehielos: {
    id: 'rompehielos',
    label: 'Dinámica rompehielos',
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-400/40',
    accentHex: '#0EA5E9',
    defaultRatio: 0.11,
  },
  alabanza: {
    id: 'alabanza',
    label: 'Alabanza',
    badgeClass: 'bg-violet-500/15 text-violet-300 border-violet-400/40',
    accentHex: '#8B5CF6',
    defaultRatio: 0.14,
  },
  juego: {
    id: 'juego',
    label: 'Juego o competencia',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-400/40',
    accentHex: '#F43F5E',
    defaultRatio: 0.15,
  },
  actividad_biblica: {
    id: 'actividad_biblica',
    label: 'Actividad bíblica',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40',
    accentHex: '#10B981',
    defaultRatio: 0.18,
  },
  reflexion: {
    id: 'reflexion',
    label: 'Reflexión espiritual',
    badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-400/40',
    accentHex: '#6366F1',
    defaultRatio: 0.16,
  },
  aplicacion: {
    id: 'aplicacion',
    label: 'Aplicación práctica',
    badgeClass: 'bg-teal-500/15 text-teal-300 border-teal-400/40',
    accentHex: '#14B8A6',
    defaultRatio: 0.08,
  },
  desafio: {
    id: 'desafio',
    label: 'Desafío para la semana',
    badgeClass: 'bg-orange-500/15 text-orange-300 border-orange-400/40',
    accentHex: '#F97316',
    defaultRatio: 0.06,
  },
  despedida: {
    id: 'despedida',
    label: 'Despedida',
    badgeClass: 'bg-slate-500/20 text-slate-200 border-slate-400/40',
    accentHex: '#94A3B8',
    defaultRatio: 0.05,
  },
  personalizada: {
    id: 'personalizada',
    label: 'Actividad propia',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/40',
    accentHex: '#06B6D4',
    defaultRatio: 0.1,
  },
};

export const REQUIRED_SATURDAY_SEQUENCE: SaturdayActivityCategory[] = [
  'bienvenida',
  'rompehielos',
  'alabanza',
  'juego',
  'actividad_biblica',
  'reflexion',
  'aplicacion',
  'desafio',
  'despedida',
];

export function getDefaultActivityDurations(
  totalMinutes: SaturdayProgramDuration
): Record<SaturdayActivityCategory, number> {
  if (totalMinutes === 60) {
    return {
      bienvenida: 4,
      rompehielos: 7,
      alabanza: 9,
      juego: 9,
      actividad_biblica: 10,
      reflexion: 10,
      aplicacion: 5,
      desafio: 3,
      despedida: 3,
      personalizada: 5,
    };
  }
  if (totalMinutes === 120) {
    return {
      bienvenida: 8,
      rompehielos: 14,
      alabanza: 18,
      juego: 18,
      actividad_biblica: 22,
      reflexion: 20,
      aplicacion: 9,
      desafio: 6,
      despedida: 5,
      personalizada: 10,
    };
  }
  // 90 minutes default
  return {
    bienvenida: 6,
    rompehielos: 10,
    alabanza: 13,
    juego: 14,
    actividad_biblica: 16,
    reflexion: 15,
    aplicacion: 7,
    desafio: 5,
    despedida: 4,
    personalizada: 8,
  };
}

/**
 * Rebalances arbitrary activities so their integer durations sum strictly to targetMinutes.
 */
export function rebalanceActivityDurations(
  activities: SaturdayProgramActivity[],
  targetMinutes: SaturdayProgramDuration
): SaturdayProgramActivity[] {
  if (activities.length === 0) return [];
  const baseWeights = activities.map((a) =>
    Math.max(1, Number(a.durationMin) || Math.round((SATURDAY_CATEGORY_META[a.category]?.defaultRatio ?? 0.1) * targetMinutes))
  );
  const weightSum = baseWeights.reduce((acc, w) => acc + w, 0) || activities.length;

  const raw = baseWeights.map((w) => (w / weightSum) * targetMinutes);
  const ints = raw.map((v) => Math.max(1, Math.floor(v)));
  let diff = targetMinutes - ints.reduce((acc, v) => acc + v, 0);

  // Distribute remainder by largest fractional parts first (or trim largest items if negative)
  if (diff > 0) {
    const order = raw
      .map((v, idx) => ({ idx, frac: v - Math.floor(v) }))
      .sort((a, b) => b.frac - a.frac);
    let cursor = 0;
    while (diff > 0) {
      ints[order[cursor % order.length].idx] += 1;
      diff -= 1;
      cursor += 1;
    }
  } else if (diff < 0) {
    const order = ints
      .map((v, idx) => ({ idx, v }))
      .sort((a, b) => b.v - a.v);
    let safety = 0;
    while (diff < 0 && safety < 500) {
      let reduced = false;
      for (const item of order) {
        if (diff === 0) break;
        if (ints[item.idx] > 1) {
          ints[item.idx] -= 1;
          diff += 1;
          reduced = true;
        }
      }
      if (!reduced) break;
      safety += 1;
    }
  }

  return activities.map((a, idx) => ({
    ...a,
    durationMin: ints[idx],
  }));
}

export function getUpcomingSaturdayIso(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun..6=Sat
  const daysUntilSat = day === 6 ? 0 : (6 - day + 7) % 7;
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilSat);
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, '0');
  const d = String(target.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
