import type {
  ChampionshipRoomState,
  LearningRoomState,
  MysteryRoomState,
  RetoRoomState,
  RouletteRoomState,
} from './expansionTypes';
import type {
  SaturdayChallengeRoomState,
  SaturdayParticipationMode,
} from './saturdayChallengesData';
import type {
  SaturdayRouletteCategoryId,
  SaturdayRouletteParticipationMode,
  SaturdayRouletteRoomState,
} from './saturdayRouletteData';
import type { TalentRoomState } from './talentShowData';
import type {
  AdventurePlayMode,
  AdventureRoomState,
} from './adventureStoriesData';
import type { AnnouncerRoomState } from './announcerTypes';

export type QuestionGroup =
  | 'Antiguo Testamento'
  | 'Nuevo Testamento'
  | 'Categorías Especiales';

export type Difficulty = 'facil' | 'intermedio' | 'dificil';

export type DifficultySetting = Difficulty | 'combinado';

export type GameMode =
  | 'clasico'
  | 'eliminacion'
  | 'velocidad'
  | 'equipos'
  | 'supervivencia'
  | 'torneo'
  | 'batalla_1v1'
  | 'competencia_equipos'
  | 'ruleta_biblica'
  | 'quien_soy'
  | 'misterio_biblico'
  | 'campeonato_rondas'
  | 'crucigrama_biblico'
  | 'palabras_desordenadas'
  | 'completa_versiculo'
  | 'rompecabezas_biblico'
  | 'aprende_biblia'
  | 'retos_sabado'
  | 'ruleta_sabado'
  | 'talentos_juveniles'
  | 'aventuras_biblicas';

export type GameStatus =
  | 'waiting'
  | 'question_active'
  | 'question_locked'
  | 'answer_revealed'
  | 'paused'
  | 'finished';

export type TeamId = string;

export interface TeamDefinition {
  id: TeamId;
  name: string;
  color: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
}

export interface TeamConfigSlot {
  id: string;
  name: string;
  color: string;
  bgClass?: string;
  borderClass?: string;
  textClass?: string;
  captainParticipantId?: string;
}

export const TEAMS: TeamDefinition[] = [
  {
    id: 'leones',
    name: 'Leones de Judá',
    color: '#F59E0B',
    bgClass: 'bg-amber-500/15',
    borderClass: 'border-amber-400/50',
    textClass: 'text-amber-300',
  },
  {
    id: 'aguilas',
    name: 'Águilas de Sion',
    color: '#0EA5E9',
    bgClass: 'bg-sky-500/15',
    borderClass: 'border-sky-400/50',
    textClass: 'text-sky-300',
  },
  {
    id: 'olivos',
    name: 'Olivos de Paz',
    color: '#10B981',
    bgClass: 'bg-emerald-500/15',
    borderClass: 'border-emerald-400/50',
    textClass: 'text-emerald-300',
  },
  {
    id: 'estrellas',
    name: 'Estrellas de Belén',
    color: '#EC4899',
    bgClass: 'bg-pink-500/15',
    borderClass: 'border-pink-400/50',
    textClass: 'text-pink-300',
  },
];

export const COMPETITION_TEAM_PRESETS: TeamDefinition[] = [
  ...TEAMS,
  {
    id: 'gedeon',
    name: 'Guerreros de Gedeón',
    color: '#A855F7',
    bgClass: 'bg-purple-500/15',
    borderClass: 'border-purple-400/50',
    textClass: 'text-purple-300',
  },
  {
    id: 'valientes',
    name: 'Valientes de David',
    color: '#14B8A6',
    bgClass: 'bg-teal-500/15',
    borderClass: 'border-teal-400/50',
    textClass: 'text-teal-300',
  },
];

export function getTeamDefinition(
  teamId?: string,
  customTeams?: TeamConfigSlot[]
): TeamDefinition | undefined {
  if (!teamId) return undefined;
  const preset = COMPETITION_TEAM_PRESETS.find((t) => t.id === teamId);
  const custom = customTeams?.find((t) => t.id === teamId);
  if (custom) {
    return {
      id: custom.id,
      name: custom.name,
      color: custom.color,
      bgClass: custom.bgClass || preset?.bgClass || 'bg-slate-800/60',
      borderClass: custom.borderClass || preset?.borderClass || 'border-slate-600',
      textClass: custom.textClass || preset?.textClass || 'text-white',
    };
  }
  return preset;
}

export {
  AVATARS,
  AVATAR_CATEGORIES,
  getAvatarById,
  type AvatarCategory,
  type AvatarDefinition,
} from './avatars';

export const CATEGORY_GROUPS: Record<QuestionGroup, string[]> = {
  'Antiguo Testamento': [
    'Génesis',
    'Éxodo',
    'Levítico',
    'Números',
    'Deuteronomio',
    'Historia de Israel',
    'Jueces y reyes',
    'Profetas mayores',
    'Profetas menores',
    'Personajes bíblicos',
  ],
  'Nuevo Testamento': [
    'Vida de Jesús',
    'Parábolas de Jesús',
    'Milagros de Jesús',
    'Los doce discípulos',
    'Hechos de los apóstoles',
    'Cartas de Pablo',
    'Cartas generales',
    'Apocalipsis',
  ],
  'Categorías Especiales': [
    '¿Quién dijo estas palabras?',
    '¿Quién soy según la Biblia?',
    '¿Dónde sucedió?',
    '¿Qué personaje hizo esto?',
    'Completa el versículo',
    'Encuentra el personaje',
    'Ordena los acontecimientos bíblicos',
    'Verdadero o falso',
    'Mujeres de la Biblia',
    'Hombres de la Biblia',
    'Lugares bíblicos',
    'Reyes y profetas',
    'Genealogías bíblicas',
    'Preguntas difíciles',
    'Historias poco conocidas',
    'Santuarios y profecías bíblicas',
  ],
};

export const ALL_CATEGORIES: string[] = [
  ...CATEGORY_GROUPS['Antiguo Testamento'],
  ...CATEGORY_GROUPS['Nuevo Testamento'],
  ...CATEGORY_GROUPS['Categorías Especiales'],
];

export const GAME_MODE_INFO: Record<
  GameMode,
  { name: string; shortDesc: string; rulesSummary: string }
> = {
  clasico: {
    name: 'Modo Clásico',
    shortDesc: 'Todos responden simultáneamente',
    rulesSummary:
      'Todos los participantes responden las mismas preguntas al mismo tiempo. Acumula puntos por acierto y rapidez.',
  },
  eliminacion: {
    name: 'Modo Eliminación',
    shortDesc: 'Un fallo puede dejarte fuera',
    rulesSummary:
      'Quienes fallen más veces de las permitidas quedan eliminados de las siguientes rondas y pasan a modo espectador.',
  },
  velocidad: {
    name: 'Modo Velocidad',
    shortDesc: 'Bonificación máxima por rapidez',
    rulesSummary:
      'La rapidez en responder correctamente otorga una bonificación extra mayor sin penalizar a los demás aciertos.',
  },
  equipos: {
    name: 'Modo Por Equipos',
    shortDesc: 'Compite sumando puntos grupales',
    rulesSummary:
      'Los participantes se unen a uno de los 4 equipos bíblicos y acumulan puntos tanto individuales como para su equipo.',
  },
  supervivencia: {
    name: 'Supervivencia Bíblica',
    shortDesc: 'Dificultad progresiva',
    rulesSummary:
      'Las preguntas escalan progresivamente de Fácil a Intermedio y culminan con desafíos Difíciles.',
  },
  torneo: {
    name: 'Modo Torneo',
    shortDesc: 'Rondas clasificatorias y Gran Final',
    rulesSummary:
      'Dividido en Clasificatoria, Semifinal y Gran Final con preguntas especiales de doble puntaje al cierre.',
  },
  batalla_1v1: {
    name: 'Batalla 1 contra 1',
    shortDesc: 'Duelo directo en tiempo real',
    rulesSummary:
      'Dos participantes compiten frente a frente con las mismas preguntas, temporizador sincronizado y marcador en vivo.',
  },
  competencia_equipos: {
    name: 'Competencia por Equipos',
    shortDesc: 'Equipos configurables y puntos colectivos',
    rulesSummary:
      'Configura la cantidad de equipos y sus cupos, organiza a los participantes y compite sumando puntos para tu equipo.',
  },
  ruleta_biblica: {
    name: 'Ruleta Bíblica',
    shortDesc: 'Gira la ruleta de 14 categorías bíblicas',
    rulesSummary:
      'Cada giro selecciona una categoría aleatoria de la ruleta sin repetir preguntas en la misma sesión.',
  },
  quien_soy: {
    name: '¿Quién Soy?',
    shortDesc: 'Adivina el personaje bíblico por pistas',
    rulesSummary:
      'Se revelan de 3 a 5 pistas progresivas; quien acierte con menos pistas obtiene mayor puntaje.',
  },
  misterio_biblico: {
    name: 'Misterio Bíblico',
    shortDesc: 'Descubre el relato o evento por pistas',
    rulesSummary:
      'Resuelve enigmas sobre eventos históricos de las Escrituras conforme se descubren pistas paso a paso.',
  },
  campeonato_rondas: {
    name: 'Campeonato por Rondas',
    shortDesc: 'Clasificación, Avanzados, Semifinal y Gran Final',
    rulesSummary:
      'Eliminación progresiva en 4 fases oficiales con sorteo de enfrentamientos, desempates y doble puntaje en la final.',
  },
  crucigrama_biblico: {
    name: 'Crucigramas Bíblicos',
    shortDesc: 'Competencia simultánea de crucigramas',
    rulesSummary:
      'Todos los participantes resuelven el mismo crucigrama bíblico en vivo. Suma puntos por precisión y rapidez.',
  },
  palabras_desordenadas: {
    name: 'Palabras Desordenadas',
    shortDesc: 'Ordena términos bíblicos en tiempo real',
    rulesSummary:
      'Todos reciben las mismas letras mezcladas y compiten por ordenar la palabra bíblica correcta en el menor tiempo.',
  },
  completa_versiculo: {
    name: 'Completa el Versículo',
    shortDesc: 'Completa citas bíblicas en competencia',
    rulesSummary:
      'Todos reciben el versículo incompleto simultáneamente y los resultados con referencia bíblica se revelan al cierre.',
  },
  rompecabezas_biblico: {
    name: 'Rompecabezas Bíblicos',
    shortDesc: 'Relaciona personajes, libros y acontecimientos',
    rulesSummary:
      'Une cada elemento bíblico con su pareja correspondiente en tiempo real y acumula puntos por exactitud y velocidad.',
  },
  aprende_biblia: {
    name: 'Aprende con la Biblia (Competencia)',
    shortDesc: 'Preguntas bíblicas con explicación doctrinal',
    rulesSummary:
      'Competencia formativa con preguntas bíblicas, citas y explicaciones después de cada pregunta o al final de la ronda.',
  },
  retos_sabado: {
    name: 'Retos del Sábado',
    shortDesc: 'Dinámicas juveniles, sorpresas y desafíos en vivo',
    rulesSummary:
      'Retos bíblicos, de representación, creatividad e integración en modo individual, parejas, equipos o competencia general con validación en vivo del director.',
  },
  ruleta_sabado: {
    name: 'Ruleta del Sábado',
    shortDesc: 'Ruleta interactiva juvenil con 12 categorías y controles de director',
    rulesSummary:
      'Gira la ruleta de 12 categorías de Sociedad de Jóvenes, elige participantes, configura el cronómetro, inicia el reto y registra resultados en modo individual, parejas, equipos o toda la congregación.',
  },
  talentos_juveniles: {
    name: 'Talentos Juveniles',
    shortDesc: 'Festival de talentos juveniles con pantalla grande, jurado y votos edificantes',
    rulesSummary:
      'Presenta talentos juveniles en pantalla grande con cronómetro, control de orden, privacidad cuidada, panel de jurado opcional, votaciones respetuosas y certificados digitales.',
  },
  aventuras_biblicas: {
    name: 'Aventuras Bíblicas',
    shortDesc: 'Historias bíblicas interactivas por escenas, decisiones y consecuencias narrativas',
    rulesSummary:
      'Recorre relatos bíblicos escena por escena con música ambiental, decisiones interactivas, consecuencias narrativas, explicación bíblica y reflexión final en modo individual, competitivo o dirigido.',
  },
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  facil: 'Fácil',
  intermedio: 'Intermedio',
  dificil: 'Difícil',
};

export interface BibleQuestion {
  id: string;
  group: QuestionGroup;
  category: string;
  difficulty: Difficulty;
  prompt: string;
  options: string[];
  correctIndex: number;
  reference: string;
  explanation?: string;
  isCustom?: boolean;
}

export interface SanitizedQuestion {
  id: string;
  group: QuestionGroup;
  category: string;
  difficulty: Difficulty;
  prompt: string;
  options: string[];
  isSpecialMultiplier: number;
  roundStage?: string;
  // Only included after answer reveal or for presenter preview
  correctIndex?: number;
  reference?: string;
  explanation?: string;
}

export interface GameConfig {
  title: string;
  code: string;
  mode: GameMode;
  categories: string[];
  difficulty: DifficultySetting;
  questionCount: number;
  timeLimitSec: number;
  maxParticipants: number;
  basePoints: number;
  speedBonusMax: number;
  specialEveryN: number; // 0 = none, or every N questions worth 2x
  eliminationLives: number; // 1 or 2 mistakes allowed before elimination
  teamCount?: number;
  teamCapacity?: number;
  teams?: TeamConfigSlot[];
  teamMode?: boolean;
  explanationTiming?: 'after_each' | 'end_of_round';
  studyTopicId?: string;
  participationMode?: SaturdayParticipationMode;
  challengeCategory?: string;
  favoritesOnly?: boolean;
  rouletteConfig?: {
    enabledCategories: SaturdayRouletteCategoryId[];
    allowRespin: boolean;
    participationMode: SaturdayRouletteParticipationMode;
  };
  adventureConfig?: {
    storyId: string;
    playMode: AdventurePlayMode;
  };
}

export interface Participant {
  id: string;
  name: string;
  avatarId: string;
  photoUrl?: string;
  teamId?: TeamId;
  score: number;
  correctCount: number;
  answeredCount: number;
  streak: number;
  mistakes: number;
  eliminated: boolean;
  online: boolean;
  totalResponseMs: number;
  joinedAt: number;
  ready?: boolean;
  isCreator?: boolean;
  profileKey?: string;
}

export interface QuestionAnswerSummary {
  participantId: string;
  participantName: string;
  avatarId: string;
  photoUrl?: string;
  teamId?: TeamId;
  selectedIndex: number | null;
  selectedLabel: string;
  isCorrect: boolean;
  pointsEarned: number;
  responseTimeMs: number | null;
}

export interface QuestionResultStats {
  questionIndex: number;
  totalParticipants: number;
  totalAnswered: number;
  correctCount: number;
  incorrectCount: number;
  correctPercent: number;
  incorrectPercent: number;
  optionCounts: number[];
  optionPercents: number[];
  rows: QuestionAnswerSummary[];
}

export interface LeaderboardEntry {
  rank: number;
  participantId: string;
  name: string;
  avatarId: string;
  photoUrl?: string;
  teamId?: TeamId;
  score: number;
  correctCount: number;
  answeredCount: number;
  accuracyPercent: number;
  avgResponseMs: number;
  eliminated: boolean;
  online: boolean;
}

export interface TeamScoreEntry {
  teamId: TeamId;
  name: string;
  color: string;
  score: number;
  memberCount: number;
  correctCount: number;
  capacity?: number;
  captainParticipantId?: string;
  captainName?: string;
}

export interface QuestionReviewItem {
  questionIndex: number;
  category: string;
  difficulty: Difficulty;
  prompt: string;
  options: string[];
  correctIndex: number;
  reference: string;
  explanation?: string;
  isSpecialMultiplier: number;
  answers: QuestionAnswerSummary[];
}

export interface GameRoomClientState {
  gameId: string;
  code: string;
  invitePath: string;
  config: GameConfig;
  status: GameStatus;
  previousStatusBeforePause?: GameStatus;
  currentQuestionIndex: number;
  totalQuestions: number;
  currentQuestion: SanitizedQuestion | null;
  questionStartedAt: number | null;
  questionEndsAt: number | null;
  remainingSec: number;
  serverNow: number;
  participants: Participant[];
  answeredParticipantIds: string[];
  questionStats: QuestionResultStats | null;
  leaderboard: LeaderboardEntry[];
  teamLeaderboard: TeamScoreEntry[];
  myParticipant?: Participant | null;
  myCurrentAnswer?: {
    selectedIndex: number;
    isCorrect?: boolean;
    pointsEarned?: number;
  } | null;
  questionReview?: QuestionReviewItem[];
  createdAt: number;
  finishedAt?: number | null;
  roundEventId?: string;
  questionLockReason?: 'timeout' | 'all_answered';
  rouletteState?: RouletteRoomState;
  mysteryState?: MysteryRoomState;
  championshipState?: ChampionshipRoomState;
  retoState?: RetoRoomState;
  learningState?: LearningRoomState;
  saturdayChallengeState?: SaturdayChallengeRoomState;
  saturdayRouletteState?: SaturdayRouletteRoomState;
  talentRoomState?: TalentRoomState;
  adventureState?: AdventureRoomState;
  projectorConnectedCount?: number;
  announcerState?: AnnouncerRoomState;
}

export interface InviteTeamSummary {
  id: string;
  name: string;
  color: string;
  memberCount: number;
  capacity?: number;
}

export interface InviteValidationInfo {
  gameId: string;
  code: string;
  title: string;
  mode: GameMode;
  status: GameStatus;
  participantCount: number;
  maxParticipants: number;
  questionCount: number;
  signature: string;
  teamMode?: boolean;
  teams?: InviteTeamSummary[];
  teamCapacity?: number;
}

export interface PublicGameListing {
  code: string;
  title: string;
  mode: GameMode;
  status: GameStatus;
  participantCount: number;
  maxParticipants: number;
  questionCount: number;
  currentQuestionIndex: number;
  createdAt: number;
}

export interface GameHistorySummary {
  id: string;
  code: string;
  title: string;
  mode: GameMode;
  questionCount: number;
  participantCount: number;
  winnerName: string;
  winnerAvatarId: string;
  winnerPhotoUrl?: string;
  winnerScore: number;
  isTie?: boolean;
  winningTeamName?: string;
  winningTeamColor?: string;
  teamTie?: boolean;
  topThree: Array<{
    rank: number;
    name: string;
    avatarId: string;
    photoUrl?: string;
    score: number;
    correctCount: number;
    accuracyPercent: number;
  }>;
  finishedAt: number;
}
