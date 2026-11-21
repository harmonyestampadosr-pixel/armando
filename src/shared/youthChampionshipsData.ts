export type YouthCompetitionType =
  | 'individual'
  | 'equipos'
  | 'grupos_juveniles'
  | 'iglesias';

export type ChampionshipPointCategory =
  | 'participacion'
  | 'respuestas_correctas'
  | 'retos_completados'
  | 'misiones_verificadas'
  | 'colaboracion_grupal';

export type ChampionshipTeamEmblem =
  | 'leon'
  | 'aguila'
  | 'olivo'
  | 'estrella'
  | 'antorcha'
  | 'corona'
  | 'escudo'
  | 'ancla';

export const TEAM_EMBLEM_OPTIONS: Array<{
  id: ChampionshipTeamEmblem;
  label: string;
}> = [
  { id: 'leon', label: 'León' },
  { id: 'aguila', label: 'Águila' },
  { id: 'olivo', label: 'Olivo' },
  { id: 'estrella', label: 'Estrella' },
  { id: 'antorcha', label: 'Antorcha' },
  { id: 'corona', label: 'Corona' },
  { id: 'escudo', label: 'Escudo' },
  { id: 'ancla', label: 'Ancla' },
];

export const POINT_CATEGORY_META: Array<{
  id: ChampionshipPointCategory;
  label: string;
  shortLabel: string;
  defaultPoints: number;
}> = [
  {
    id: 'participacion',
    label: 'Puntos por Participación',
    shortLabel: 'Participación',
    defaultPoints: 50,
  },
  {
    id: 'respuestas_correctas',
    label: 'Puntos por Respuestas Correctas',
    shortLabel: 'Respuestas',
    defaultPoints: 150,
  },
  {
    id: 'retos_completados',
    label: 'Puntos por Retos Completados',
    shortLabel: 'Retos',
    defaultPoints: 120,
  },
  {
    id: 'misiones_verificadas',
    label: 'Puntos por Misiones Verificadas',
    shortLabel: 'Misiones',
    defaultPoints: 150,
  },
  {
    id: 'colaboracion_grupal',
    label: 'Puntos por Colaboración Grupal',
    shortLabel: 'Colaboración',
    defaultPoints: 100,
  },
];

export const COMPETITION_TYPE_LABELS: Record<YouthCompetitionType, string> = {
  individual: 'Individual',
  equipos: 'Equipos',
  grupos_juveniles: 'Entre Grupos Juveniles',
  iglesias: 'Entre Iglesias',
};

export interface ChampionshipTeam {
  id: string;
  name: string;
  color: string;
  emblem: ChampionshipTeamEmblem;
  motto: string;
  entityKind: 'Equipo' | 'Grupo Juvenil' | 'Iglesia';
  churchName?: string;
  captainName?: string;
  createdAt: number;
}

export interface ChampionshipParticipant {
  id: string;
  participantKey: string;
  name: string;
  avatarId: string;
  photoDataUrl?: string;
  teamId?: string;
  churchName?: string;
  joinedAt: number;
}

export interface ChampionshipSaturdaySlot {
  saturdayNumber: number;
  title: string;
  date: string; // YYYY-MM-DD
  stage: 'regular' | 'semifinal' | 'final';
  activityNotes: string;
  linkedGameCodes: string[];
  status: 'upcoming' | 'active' | 'completed';
}

export interface ChampionshipUpcomingActivity {
  id: string;
  saturdayNumber: number;
  title: string;
  kind: 'competencia_biblica' | 'retos' | 'mision' | 'gran_final';
  scheduledDate: string;
  description: string;
}

export interface ChampionshipScoreEntry {
  id: string;
  saturdayNumber: number;
  category: ChampionshipPointCategory;
  points: number;
  teamId?: string;
  participantId?: string;
  participantName?: string;
  sourceLabel: string;
  dedupKey?: string;
  notes?: string;
  createdBy: string;
  createdAt: number;
  voided?: boolean;
  voidedReason?: string;
  updatedAt?: number;
}

export interface ChampionshipAuditLog {
  id: string;
  action: 'create' | 'edit' | 'void' | 'import' | 'playoffs' | 'archive';
  entryId?: string;
  previousPoints?: number;
  newPoints?: number;
  reason: string;
  editedBy: string;
  editedAt: number;
}

export interface PlayoffMatchSlot {
  id: string;
  roundLabel: 'Semifinal 1' | 'Semifinal 2' | 'Gran Final';
  competitorAId: string;
  competitorAName: string;
  competitorAColor: string;
  competitorAScore: number;
  competitorBId: string;
  competitorBName: string;
  competitorBColor: string;
  competitorBScore: number;
  winnerId?: string;
  winnerName?: string;
  linkedGameCode?: string;
  completed: boolean;
}

export interface ChampionshipPlayoffBracket {
  stageStatus:
    | 'temporada_regular'
    | 'semifinales'
    | 'gran_final'
    | 'finalizada';
  competitorMode: 'team' | 'individual';
  semifinals: PlayoffMatchSlot[];
  finalMatch?: PlayoffMatchSlot;
  championId?: string;
  championName?: string;
  runnerUpName?: string;
  thirdPlaceName?: string;
  mvpParticipantName?: string;
}

export interface YouthChampionshipSeason {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  saturdaysCount: 4 | 5;
  competitionType: YouthCompetitionType;
  allowInterChurch: boolean;
  status: 'activa' | 'archivada';
  teams: ChampionshipTeam[];
  participants: ChampionshipParticipant[];
  saturdays: ChampionshipSaturdaySlot[];
  upcomingActivities: ChampionshipUpcomingActivity[];
  scoreEntries: ChampionshipScoreEntry[];
  auditLogs: ChampionshipAuditLog[];
  playoffs: ChampionshipPlayoffBracket;
  createdAt: number;
  closedAt?: number;
}

export interface TeamStandingRow {
  rank: number;
  team: ChampionshipTeam;
  totalPoints: number;
  byCategory: Record<ChampionshipPointCategory, number>;
  members: ChampionshipParticipant[];
}

export interface ParticipantStandingRow {
  rank: number;
  participant: ChampionshipParticipant;
  teamName?: string;
  teamColor?: string;
  totalPoints: number;
  byCategory: Record<ChampionshipPointCategory, number>;
}

export function buildEmptyCategoryBreakdown(): Record<
  ChampionshipPointCategory,
  number
> {
  return {
    participacion: 0,
    respuestas_correctas: 0,
    retos_completados: 0,
    misiones_verificadas: 0,
    colaboracion_grupal: 0,
  };
}

export function computeSeasonStandings(season: YouthChampionshipSeason): {
  teamStandings: TeamStandingRow[];
  participantStandings: ParticipantStandingRow[];
} {
  const activeEntries = season.scoreEntries.filter((e) => !e.voided);

  // Team map
  const teamTotals = new Map<
    string,
    { total: number; byCat: Record<ChampionshipPointCategory, number> }
  >();
  for (const t of season.teams) {
    teamTotals.set(t.id, { total: 0, byCat: buildEmptyCategoryBreakdown() });
  }

  // Participant map
  const partTotals = new Map<
    string,
    { total: number; byCat: Record<ChampionshipPointCategory, number> }
  >();
  for (const p of season.participants) {
    partTotals.set(p.id, { total: 0, byCat: buildEmptyCategoryBreakdown() });
  }

  for (const entry of activeEntries) {
    if (entry.participantId && partTotals.has(entry.participantId)) {
      const pRow = partTotals.get(entry.participantId)!;
      pRow.total += entry.points;
      pRow.byCat[entry.category] += entry.points;
    }

    // Determine target team (either explicit teamId or participant's team)
    let resolvedTeamId = entry.teamId;
    if (!resolvedTeamId && entry.participantId) {
      const p = season.participants.find((x) => x.id === entry.participantId);
      resolvedTeamId = p?.teamId;
    }
    if (resolvedTeamId && teamTotals.has(resolvedTeamId)) {
      const tRow = teamTotals.get(resolvedTeamId)!;
      tRow.total += entry.points;
      tRow.byCat[entry.category] += entry.points;
    }
  }

  const teamRows: TeamStandingRow[] = season.teams
    .map((team) => {
      const data = teamTotals.get(team.id) || {
        total: 0,
        byCat: buildEmptyCategoryBreakdown(),
      };
      return {
        rank: 0,
        team,
        totalPoints: data.total,
        byCategory: data.byCat,
        members: season.participants.filter((p) => p.teamId === team.id),
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((row, idx) => ({ ...row, rank: idx + 1 }));

  const participantRows: ParticipantStandingRow[] = season.participants
    .map((participant) => {
      const data = partTotals.get(participant.id) || {
        total: 0,
        byCat: buildEmptyCategoryBreakdown(),
      };
      const team = season.teams.find((t) => t.id === participant.teamId);
      return {
        rank: 0,
        participant,
        teamName: team?.name,
        teamColor: team?.color,
        totalPoints: data.total,
        byCategory: data.byCat,
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((row, idx) => ({ ...row, rank: idx + 1 }));

  return {
    teamStandings: teamRows,
    participantStandings: participantRows,
  };
}

export function buildSaturdayDates(
  startIsoDate: string,
  count: 4 | 5
): ChampionshipSaturdaySlot[] {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(startIsoDate)
    ? new Date(`${startIsoDate}T12:00:00Z`)
    : new Date();

  // Advance to next/current Saturday if not already Saturday (UTC day 6)
  const diff = (6 - base.getUTCDay() + 7) % 7;
  base.setUTCDate(base.getUTCDate() + diff);

  const slots: ChampionshipSaturdaySlot[] = [];
  for (let i = 0; i < count; i++) {
    const dt = new Date(base);
    dt.setUTCDate(base.getUTCDate() + i * 7);
    const iso = dt.toISOString().slice(0, 10);
    const num = i + 1;
    const isLast = num === count;
    const isPenultimate = num === count - 1;
    slots.push({
      saturdayNumber: num,
      title: isLast
        ? `Sábado ${num} — Gran Final y Premiación`
        : isPenultimate
          ? `Sábado ${num} — Semifinales y Retos Decisivos`
          : `Sábado ${num} — Jornada de Competencia Bíblica`,
      date: iso,
      stage: isLast ? 'final' : isPenultimate ? 'semifinal' : 'regular',
      activityNotes: isLast
        ? 'Gran Final en vivo con cuenta regresiva y reconocimiento de ganadores.'
        : isPenultimate
          ? 'Clasificación final y duelos semifinales.'
          : 'Preguntas bíblicas, retos del sábado y registro de misiones.',
      linkedGameCodes: [],
      status: i === 0 ? 'active' : 'upcoming',
    });
  }
  return slots;
}
