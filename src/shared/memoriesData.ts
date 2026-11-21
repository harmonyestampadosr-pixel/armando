export type MemoryViewAccess = 'public' | 'members_code' | 'admins_only';
export type MemoryEditAccess = 'admins_only' | 'directors_code';
export type MemoryShareAccess = 'admins_only' | 'directors_code';
export type MemoryVisibility = 'authorized_public' | 'internal_only' | 'admins_only';

export interface MemoryActivityItem {
  id: string;
  title: string;
  categoryLabel?: string;
  durationMin?: number;
  notes?: string;
}

export interface MemoryGameItem {
  id: string;
  title: string;
  modeLabel?: string;
  winnerOrHighlight?: string;
  participantsCount?: number;
}

export interface MemoryChallengeItem {
  id: string;
  title: string;
  categoryLabel?: string;
  participantOrTeam?: string;
  outcome?: string;
}

export interface MemoryTeamItem {
  id: string;
  name: string;
  color?: string;
  score?: number;
  membersCount?: number;
}

export interface MemoryResultRankItem {
  id: string;
  position: number;
  name: string;
  points: number;
  note?: string;
}

export interface MemoryRecognitionItem {
  id: string;
  recipientName: string;
  title: string;
  reason?: string;
  category?: string;
}

export interface MemoryPhotoItem {
  id: string;
  photoUrl: string;
  caption: string;
  authorized: boolean;
  includesMinors: boolean;
  guardianConsentConfirmed: boolean;
  authorizedByName?: string;
  uploadedAt: number;
  // Internal server-only filename reference is omitted from client payloads
}

export interface MemorySnapshotSummary {
  savedAt: number;
  savedBy: string;
  theme: string;
  date: string;
}

export interface SaturdayMemoryRecord {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  theme: string;
  bibleText: string;
  bibleVerseQuote?: string;
  directorName: string;
  attendanceCount?: number;
  participantNames: string[];
  activities: MemoryActivityItem[];
  gamesPlayed: MemoryGameItem[];
  challengesCompleted: MemoryChallengeItem[];
  teams: MemoryTeamItem[];
  resultsSummary: string;
  rankings: MemoryResultRankItem[];
  recognitions: MemoryRecognitionItem[];
  photos: MemoryPhotoItem[];
  dailyReflection: string;
  observations: string;
  // Privacy & sharing metadata per Saturday
  visibility: MemoryVisibility;
  hideParticipantNames: boolean;
  hidePhotos: boolean;
  sharingEnabled: boolean;
  shareToken?: string;
  shareAuthorizedBy?: string;
  shareAuthorizedAt?: number;
  // Source linkage (optional, when recovered from existing Saturday Program/Games)
  sourceProgramId?: string;
  isArchived?: boolean;
  archivedAt?: number;
  createdAt: number;
  updatedAt: number;
  createdByRole?: string;
  revisionCount?: number;
  snapshots?: MemorySnapshotSummary[];
}

export interface MemoryGlobalSettings {
  viewAccess: MemoryViewAccess;
  editAccess: MemoryEditAccess;
  shareAccess: MemoryShareAccess;
  hideNamesByDefault: boolean;
  hidePhotosByDefault: boolean;
  requireMinorGuardianConsent: boolean;
  hasMemberCodeConfigured: boolean;
}

export interface MemoryChampionshipSummary {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  competitionType: string;
  championName?: string;
  topStandings: Array<{ name: string; points: number; color?: string }>;
  source: 'campeonato_juvenil' | 'gran_torneo' | 'memoria';
}

export interface MemoryPlatformRecognitionSummary {
  id: string;
  recipientName: string;
  title: string;
  reason: string;
  sourceLabel: string;
  dateLabel: string;
  timestamp: number;
}

export interface MemoryParticipationStats {
  totalMemories: number;
  totalActivities: number;
  totalGames: number;
  totalChallenges: number;
  totalRecognitions: number;
  totalAuthorizedPhotos: number;
  totalAttendance: number;
  uniqueDirectors: number;
  uniqueTeams: Array<{ name: string; appearances: number; bestScore: number }>;
}

export interface MemoryImportProgramSource {
  id: string;
  title: string;
  scheduledDate: string;
  centralTheme: string;
  mainBibleText: string;
  mainBibleVerseQuote?: string;
  spiritualObjective?: string;
  directorName?: string;
  directorNotes?: string;
  activities: Array<{
    title: string;
    categoryLabel: string;
    durationMin: number;
    description: string;
  }>;
}

export interface MemoryImportGameSource {
  id: string;
  date: string;
  title: string;
  mode: string;
  participantsCount: number;
  podium: Array<{ name: string; score: number }>;
  teams: Array<{ name: string; color: string; score: number }>;
}

export interface MemoryImportChallengeSource {
  id: string;
  date: string;
  title: string;
  categoryLabel: string;
  participantName: string;
  outcome: string;
  points: number;
  sourceKind: 'retos_sabado' | 'ruleta_sabado' | 'cabina_sorpresas';
}

export interface MemoryImportSourcesBundle {
  programs: MemoryImportProgramSource[];
  games: MemoryImportGameSource[];
  challenges: MemoryImportChallengeSource[];
}

export interface SharedMemoryPublicView {
  memory: SaturdayMemoryRecord;
  authorizedAt?: number;
  authorizedBy?: string;
  privacyNote: string;
}

export function formatMemoryDateEs(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  try {
    const [y, m, d] = isoDate.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return new Intl.DateTimeFormat('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(dt);
  } catch {
    return isoDate;
  }
}

export function isPhotoPubliclyAllowed(
  photo: MemoryPhotoItem,
  requireMinorConsent: boolean
): boolean {
  if (!photo.authorized) return false;
  if (photo.includesMinors && requireMinorConsent && !photo.guardianConsentConfirmed) {
    return false;
  }
  return true;
}

export function anonymizeDisplayName(
  name: string,
  index: number,
  prefix = 'Participante'
): string {
  if (!name.trim()) return `${prefix} ${index + 1}`;
  return `${prefix} #${index + 1}`;
}
