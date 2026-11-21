import type { SaturdayProgramDuration } from './saturdayProgramTypes';
import type {
  SurpriseCategoryId,
  SurpriseResultOutcome,
} from './surpriseBoothData';
import type { GameMode } from './types';

export type ControlCenterModuleId =
  | 'programa_sabado'
  | 'retos_sabado'
  | 'ruleta_sabado'
  | 'talentos_juveniles'
  | 'aventuras_biblicas'
  | 'misiones_juveniles'
  | 'campeonatos_juveniles'
  | 'cabina_sorpresas'
  | 'nuestras_memorias'
  | 'juegos_biblicos';

export type ControlCenterBlockKind =
  | 'actividad_programa'
  | 'juego_existente'
  | 'nuevo_juego'
  | 'retos_sabado'
  | 'ruleta_sabado'
  | 'talentos_juveniles'
  | 'aventuras_biblicas'
  | 'misiones_juveniles'
  | 'campeonato_juvenil'
  | 'cabina_sorpresas';

export interface ControlCenterModuleMeta {
  id: ControlCenterModuleId;
  label: string;
  shortDesc: string;
  accentHex: string;
  scorePolicy: string;
}

export const CONTROL_CENTER_MODULES: ControlCenterModuleMeta[] = [
  {
    id: 'programa_sabado',
    label: 'Programa del Sábado',
    shortDesc: 'Agenda espiritual, alabanza, bienvenida, reflexión y tiempos.',
    accentHex: '#F59E0B',
    scorePolicy: 'Sin puntuación competitiva',
  },
  {
    id: 'juegos_biblicos',
    label: 'Juegos Bíblicos en Vivo',
    shortDesc: 'Trivia, Equipos, Ruleta Bíblica, ¿Quién Soy?, Misterio y Retos.',
    accentHex: '#0EA5E9',
    scorePolicy: 'Puntuación propia de cada partida y modalidad',
  },
  {
    id: 'retos_sabado',
    label: 'Retos del Sábado',
    shortDesc: 'Dinámicas bíblicas, dramatización, creatividad e integración.',
    accentHex: '#10B981',
    scorePolicy: 'Puntos independientes de retos sabatinos',
  },
  {
    id: 'ruleta_sabado',
    label: 'Ruleta de Actividades',
    shortDesc: 'Giros aleatorios de 12 categorías con validación de director.',
    accentHex: '#EC4899',
    scorePolicy: 'Puntos independientes por giro de ruleta',
  },
  {
    id: 'talentos_juveniles',
    label: 'Talentos Juveniles',
    shortDesc: 'Presentaciones artísticas, votos positivos y certificados.',
    accentHex: '#8B5CF6',
    scorePolicy: 'Reconocimientos y votos positivos independientes',
  },
  {
    id: 'aventuras_biblicas',
    label: 'Aventuras Bíblicas',
    shortDesc: 'Historias interactivas por escenas, decisiones y enseñanza.',
    accentHex: '#14B8A6',
    scorePolicy: 'Progreso narrativo independiente',
  },
  {
    id: 'misiones_juveniles',
    label: 'Misiones Juveniles',
    shortDesc: 'Misión de la semana con servicio práctico y verificación.',
    accentHex: '#22C55E',
    scorePolicy: 'Cumplimiento verificado y reconocimientos',
  },
  {
    id: 'campeonatos_juveniles',
    label: 'Campeonatos Juveniles',
    shortDesc: 'Tabla general de temporada por equipos, grupos o iglesias.',
    accentHex: '#EAB308',
    scorePolicy: 'Tabla oficial de temporada (reglas propias)',
  },
  {
    id: 'cabina_sorpresas',
    label: 'Cabina de Sorpresas',
    shortDesc: 'Caja misteriosa aleatoria para momentos inesperados en vivo.',
    accentHex: '#F97316',
    scorePolicy: 'Registro propio de sorpresas realizadas',
  },
  {
    id: 'nuestras_memorias',
    label: 'Memorias de la Sociedad',
    shortDesc: 'Archivo histórico semanal, fotos autorizadas y exportación PDF.',
    accentHex: '#D97706',
    scorePolicy: 'Archivo histórico (solo registro)',
  },
];

export interface ControlCenterTimelineBlock {
  id: string;
  order: number;
  kind: ControlCenterBlockKind;
  moduleId: ControlCenterModuleId;
  moduleTag: string;
  title: string;
  instructions: string;
  durationMin: number;
  linkedGameCode?: string;
  linkedGameMode?: GameMode;
  linkedGameTitle?: string;
  linkedInvitePath?: string;
  linkedProgramActivityId?: string;
  linkedSeasonId?: string;
  linkedMissionId?: string;
  scoreIsolationNote: string;
  completedAt?: number;
}

export interface ControlCenterSurprisePayload {
  surpriseId: string;
  categoryId: SurpriseCategoryId;
  categoryLabel: string;
  categoryColor: string;
  title: string;
  instructions: string;
  reference: string;
  durationSec: number;
  triggeredAt: number;
  outcome?: SurpriseResultOutcome;
  participantName?: string;
  pointsAwarded?: number;
}

export interface ControlCenterParticipantVisibility {
  showSchedule: boolean;
  showOwnResults: boolean;
  showStandings: boolean;
}

export type ControlCenterSessionStatus =
  | 'preparacion'
  | 'en_curso'
  | 'pausado'
  | 'finalizado';

export interface ControlCenterSoundCue {
  moduleId: ControlCenterModuleId;
  action: 'start' | 'pause' | 'next' | 'surprise' | 'finish' | 'warning';
  at: number;
}

export interface ControlCenterLiveSession {
  id: string;
  title: string;
  theme: string;
  bibleText: string;
  bibleVerseQuote?: string;
  scheduledDate: string;
  durationMinutes: SaturdayProgramDuration;
  directorName: string;
  sourceProgramId?: string;
  linkedSeasonId?: string;
  status: ControlCenterSessionStatus;
  blocks: ControlCenterTimelineBlock[];
  currentBlockIndex: number;
  timerRunning: boolean;
  timerEndsAt: number | null;
  timerPausedRemainingSec: number | null;
  activeSurprise: ControlCenterSurprisePayload | null;
  soundCueNonce: number;
  lastSoundCue?: ControlCenterSoundCue;
  participantVisibility: ControlCenterParticipantVisibility;
  savedProgramId?: string;
  savedMemoryId?: string;
  createdAt: number;
  updatedAt: number;
  finishedAt?: number;
}

export interface ControlCenterLiveGameSnapshot {
  code: string;
  gameId: string;
  title: string;
  mode: GameMode;
  status: string;
  participantCount: number;
  invitePath: string;
  leaderboardTop: Array<{
    name: string;
    avatarId: string;
    score: number;
    correctCount: number;
  }>;
  teamTop: Array<{
    name: string;
    color: string;
    score: number;
    memberCount: number;
  }>;
}

export interface ControlCenterSeparatedResults {
  gamesByMode: Array<{
    mode: string;
    modeLabel: string;
    code: string;
    title: string;
    status: 'activa' | 'finalizada';
    participantCount: number;
    topEntries: Array<{ name: string; score: number }>;
    teamEntries: Array<{ name: string; color: string; score: number }>;
  }>;
  challengesAndRoulette: Array<{
    id: string;
    module: 'Retos del Sábado' | 'Ruleta de Actividades';
    title: string;
    participantOrWinner: string;
    outcome: string;
    points: number;
    executedAt: number;
  }>;
  surprises: Array<{
    id: string;
    title: string;
    categoryId: string;
    participantName: string;
    outcome: string;
    pointsAwarded: number;
    createdAt: number;
  }>;
  championships: Array<{
    seasonId: string;
    seasonName: string;
    status: string;
    standings: Array<{ name: string; points: number; color?: string }>;
  }>;
  talents: Array<{
    id: string;
    performerName: string;
    categoryLabel: string;
    presentationTitle: string;
    positiveVotes: number;
  }>;
  missions: Array<{
    id: string;
    participantName: string;
    missionTitle: string;
    verified: boolean;
    dateLabel: string;
  }>;
}

export interface ControlCenterVarietyRecommendation {
  recentThemesToAvoid: string[];
  recentActivitiesToAvoid: string[];
  suggestedBlocks: Array<{
    id: string;
    moduleId: ControlCenterModuleId;
    kind: ControlCenterBlockKind;
    title: string;
    instructions: string;
    durationMin: number;
    reason: string;
  }>;
}

export interface ControlCenterLiveClientView {
  session: ControlCenterLiveSession;
  remainingSec: number;
  serverNow: number;
  currentBlock: ControlCenterTimelineBlock | null;
  nextBlock: ControlCenterTimelineBlock | null;
  linkedLiveGame: ControlCenterLiveGameSnapshot | null;
  championshipStandings: Array<{
    seasonName: string;
    standings: Array<{ name: string; points: number; color?: string }>;
  }>;
  recentSurpriseOutcomes: ControlCenterSeparatedResults['surprises'];
  myResults?: Array<{
    moduleLabel: string;
    contextTitle: string;
    detail: string;
    scoreLabel: string;
  }>;
}

export function getModuleMetaById(
  id: ControlCenterModuleId
): ControlCenterModuleMeta {
  return (
    CONTROL_CENTER_MODULES.find((m) => m.id === id) ||
    CONTROL_CENTER_MODULES[0]
  );
}

export function mapKindToModuleId(
  kind: ControlCenterBlockKind
): ControlCenterModuleId {
  switch (kind) {
    case 'actividad_programa':
      return 'programa_sabado';
    case 'juego_existente':
    case 'nuevo_juego':
      return 'juegos_biblicos';
    case 'retos_sabado':
      return 'retos_sabado';
    case 'ruleta_sabado':
      return 'ruleta_sabado';
    case 'talentos_juveniles':
      return 'talentos_juveniles';
    case 'aventuras_biblicas':
      return 'aventuras_biblicas';
    case 'misiones_juveniles':
      return 'misiones_juveniles';
    case 'campeonato_juvenil':
      return 'campeonatos_juveniles';
    case 'cabina_sorpresas':
      return 'cabina_sorpresas';
    default:
      return 'programa_sabado';
  }
}

export function formatTimerMMSS(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
