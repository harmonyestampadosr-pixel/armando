import { Difficulty, GameMode, LeaderboardEntry } from './types';

export interface RouletteCategorySlot {
  id: string;
  label: string;
  color: string;
  matchCategories: string[];
  matchDifficulty?: Difficulty;
  matchGroup?: 'Antiguo Testamento' | 'Nuevo Testamento';
}

export interface RouletteRoomState {
  spinNonce: number;
  selectedCategoryId: string | null;
  selectedCategoryLabel: string | null;
  targetAngleDeg: number;
  usedQuestionIds: string[];
  spinsCount: number;
}

export interface MysteryClueItem {
  id: string;
  kind: 'quien_soy' | 'misterio_biblico';
  title: string;
  answer: string;
  acceptedAliases: string[];
  options: string[]; // 4 multiple-choice options for fast/accessible play
  correctOptionIndex: number;
  clues: string[]; // 3 to 5 progressive verifiable clues
  reference: string;
  explanation: string;
  difficulty: Difficulty;
  avatarId: string;
}

export interface MysteryRoomState {
  kind: 'quien_soy' | 'misterio_biblico';
  currentItemIndex: number;
  totalItems: number;
  revealedClueCount: number; // 1..clues.length
  itemIds: string[];
  currentItemView: {
    id: string;
    kind: 'quien_soy' | 'misterio_biblico';
    clues: string[]; // only revealed clues
    totalClues: number;
    options: string[];
    avatarId: string;
    difficulty: Difficulty;
    answer?: string;
    correctOptionIndex?: number;
    reference?: string;
    explanation?: string;
  } | null;
  itemSolvedBy: Array<{
    participantId: string;
    name: string;
    points: number;
    clueNumber: number;
  }>;
}

export interface ChampionshipRoundParticipantSnapshot {
  participantId: string;
  name: string;
  avatarId: string;
  photoUrl?: string;
  score: number;
  correctCount: number;
  advanced: boolean;
}

export interface ChampionshipRoundRecord {
  roundNumber: number; // 1..4
  roundName: string;
  standings: ChampionshipRoundParticipantSnapshot[];
  matchups?: Array<{
    id: string;
    playerA: string;
    playerB: string;
  }>;
  completedAt: number;
}

export interface ChampionshipRoomState {
  currentRound: number; // 1: Clasificación, 2: Avanzados, 3: Semifinales, 4: Gran Final
  roundName: string;
  advanceRound2Count: number;
  advanceSemifinalCount: number;
  advanceFinalCount: number;
  questionsPerRound: number;
  qualifiedParticipantIds: string[];
  eliminatedParticipantIds: string[];
  roundHistory: ChampionshipRoundRecord[];
  tiebreakerActive: boolean;
}

// Retos Bíblicos types
export interface CrosswordWordPlacement {
  id: string;
  number: number;
  direction: 'H' | 'V';
  row: number;
  col: number;
  answer: string; // Uppercase A-Z without accents for grid
  displayAnswer: string;
  clue: string;
  reference: string;
}

export interface CrosswordPuzzle {
  id: string;
  title: string;
  difficulty: Difficulty;
  rows: number;
  cols: number;
  words: CrosswordWordPlacement[];
}

export interface ScrambleChallenge {
  id: string;
  word: string;
  displayWord: string;
  category: 'Personaje' | 'Lugar' | 'Libro bíblico';
  difficulty: Difficulty;
  hint: string;
  reference: string;
}

export interface CompleteVerseItem {
  id: string;
  verseBefore: string;
  verseAfter: string;
  missingWord: string;
  options: string[];
  correctIndex: number;
  reference: string;
  difficulty: Difficulty;
  explanation: string;
}

export interface MatchPuzzlePair {
  id: string;
  left: string;
  right: string;
  reference: string;
}

export interface MatchPuzzle {
  id: string;
  title: string;
  kind: 'personaje_evento' | 'libro_autor';
  difficulty: Difficulty;
  description: string;
  pairs: MatchPuzzlePair[];
}

// Aprende con la Biblia types
export interface LearningStudyCard {
  id: string;
  topicId: string;
  topicLabel: string;
  bookOrSection: string;
  chapterRef?: string;
  difficulty: Difficulty;
  prompt: string;
  options: string[];
  correctIndex: number;
  reference: string;
  simpleExplanation: string;
  context: string;
  mainTeaching: string;
  complementaryQuestion?: {
    prompt: string;
    answer: string;
    reference: string;
  };
}

export interface LearningProgressData {
  profileKey: string;
  studiedTopicIds: string[];
  answeredCardIds: string[];
  correctCardIds: string[];
  incorrectQueueIds: string[];
  totalPracticed: number;
  updatedAt: number;
}

// Multiplayer Retos Bíblicos & Aprende con la Biblia room state types
export type RetoCompetitionKind =
  | 'crucigrama_biblico'
  | 'palabras_desordenadas'
  | 'completa_versiculo'
  | 'rompecabezas_biblico';

export interface RetoCrosswordWordView {
  id: string;
  number: number;
  direction: 'H' | 'V';
  row: number;
  col: number;
  length: number;
  clue: string;
  reference: string;
  displayAnswer?: string;
}

export type RetoChallengeView =
  | {
      kind: 'crucigrama_biblico';
      id: string;
      title: string;
      difficulty: Difficulty;
      rows: number;
      cols: number;
      words: RetoCrosswordWordView[];
      solutionGrid?: Record<string, string>;
    }
  | {
      kind: 'palabras_desordenadas';
      id: string;
      scrambledLetters: string;
      wordLength: number;
      category: 'Personaje' | 'Lugar' | 'Libro bíblico';
      difficulty: Difficulty;
      hint: string;
      reference: string;
      displayWord?: string;
      word?: string;
    }
  | {
      kind: 'completa_versiculo';
      id: string;
      verseBefore: string;
      verseAfter: string;
      options: string[];
      reference: string;
      difficulty: Difficulty;
      correctIndex?: number;
      missingWord?: string;
      explanation?: string;
    }
  | {
      kind: 'rompecabezas_biblico';
      id: string;
      title: string;
      matchKind: 'personaje_evento' | 'libro_autor';
      difficulty: Difficulty;
      description: string;
      leftItems: Array<{ id: string; label: string }>;
      rightItems: Array<{ right: string; reference: string }>;
      expectedPairs?: Array<{
        id: string;
        left: string;
        right: string;
        reference: string;
      }>;
    };

export interface RetoParticipantSubmissionSummary {
  participantId: string;
  participantName: string;
  avatarId: string;
  photoUrl?: string;
  teamId?: string;
  isCorrect: boolean;
  accuracyPercent: number;
  pointsEarned: number;
  responseTimeMs: number | null;
}

export interface RetoMySubmissionState {
  submitted: boolean;
  isCorrect?: boolean;
  accuracyPercent?: number;
  pointsEarned?: number;
  responseTimeMs?: number;
  selectedIndex?: number;
  typedAnswer?: string;
  wordResults?: Array<{
    wordId: string;
    correct: boolean;
    displayAnswer: string;
    reference: string;
  }>;
  pairResults?: Array<{
    id: string;
    correct: boolean;
    expectedRight: string;
    reference: string;
  }>;
}

export interface RetoRoomState {
  kind: RetoCompetitionKind;
  currentIndex: number;
  totalChallenges: number;
  currentChallenge: RetoChallengeView | null;
  mySubmission: RetoMySubmissionState | null;
  challengeResults: RetoParticipantSubmissionSummary[];
  solvedCount: number;
  reviewItems?: Array<{
    index: number;
    title: string;
    reference: string;
    answerSummary: string;
  }>;
}

export interface LearningCardClientView {
  id: string;
  topicId: string;
  topicLabel: string;
  bookOrSection: string;
  chapterRef?: string;
  difficulty: Difficulty;
  prompt: string;
  options: string[];
  correctIndex?: number;
  reference?: string;
  simpleExplanation?: string;
  context?: string;
  mainTeaching?: string;
  complementaryQuestion?: {
    prompt: string;
    answer: string;
    reference: string;
  } | null;
}

export interface LearningReviewCard {
  index: number;
  id: string;
  topicLabel: string;
  bookOrSection: string;
  chapterRef?: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  reference: string;
  simpleExplanation: string;
  context: string;
  mainTeaching: string;
  complementaryQuestion?: {
    prompt: string;
    answer: string;
    reference: string;
  } | null;
}

export interface LearningRoomState {
  currentIndex: number;
  totalCards: number;
  explanationTiming: 'after_each' | 'end_of_round';
  studyTopicId: string;
  currentCard: LearningCardClientView | null;
  completedCardsReview?: LearningReviewCard[];
}

// Mi Trayectoria (Levels & Medals)
export interface TrajectoryLevelInfo {
  id: string;
  name: string;
  minPoints: number;
  nextPoints: number | null;
  color: string;
}

export interface AchievementBadgeInfo {
  id: string;
  name: string;
  description: string;
  conditionText: string;
  icon: string;
  color: string;
  unlocked: boolean;
  unlockedAt?: number;
  progressCurrent: number;
  progressTarget: number;
}

export interface ScoreEvolutionPoint {
  date: number;
  gameTitle: string;
  mode: GameMode | string;
  score: number;
  correctCount: number;
  won: boolean;
}

export interface CategoryStatEntry {
  category: string;
  answered: number;
  correct: number;
  accuracyPercent: number;
}

export interface PlayerTrajectoryProfile {
  profileKey: string;
  displayName: string;
  avatarId: string;
  totalGamesPlayed: number;
  totalWins: number;
  totalPoints: number;
  totalCorrect: number;
  totalIncorrect: number;
  bestScore: number;
  bestStreak: number;
  hardCorrectCount: number;
  wins1v1: number;
  teamWins: number;
  tournamentsPlayed: number;
  retosCompleted: number;
  roulettePlayed: number;
  mysteryPlayed: number;
  level: TrajectoryLevelInfo;
  achievements: AchievementBadgeInfo[];
  recentMatches: ScoreEvolutionPoint[];
  categoryStats: CategoryStatEntry[];
  updatedAt: number;
}

// Grandes Torneos (Iglesias y Distritos)
export type TournamentEntityKind =
  | 'Iglesia'
  | 'Distrito'
  | 'Congregación'
  | 'Grupo Juvenil'
  | 'Familia'
  | 'Ministerio';

export interface TournamentOrganization {
  id: string;
  name: string;
  kind: TournamentEntityKind;
  color: string;
  points: number;
  wins: number;
  matchesPlayed: number;
}

export interface TournamentTeamEntry {
  id: string;
  name: string;
  orgId: string;
  color: string;
  points: number;
  correctCount: number;
  memberIds: string[];
}

export interface TournamentParticipant {
  id: string;
  name: string;
  avatarId: string;
  photoUrl?: string;
  orgId: string;
  teamId?: string;
  profileKey?: string;
  score: number;
  correctCount: number;
  joinedAt: number;
}

export interface TournamentMatchRound {
  id: string;
  roundNumber: number;
  stage: 'Clasificatoria' | 'Semifinal' | 'Gran Final';
  title: string;
  gameCode?: string;
  status: 'pending' | 'active' | 'finished';
  orgScores: Array<{ orgId: string; orgName: string; points: number }>;
  createdAt: number;
  finishedAt?: number;
}

export interface ChurchTournament {
  id: string;
  code: string;
  inviteSignature: string;
  name: string;
  description: string;
  entityKind: TournamentEntityKind;
  scheduledAt: string;
  rulesSummary: string;
  totalRounds: number;
  currentStage: 'Inscripción' | 'Clasificatoria' | 'Semifinales' | 'Gran Final' | 'Finalizado';
  status: 'open' | 'active' | 'finished';
  organizations: TournamentOrganization[];
  teams: TournamentTeamEntry[];
  participants: TournamentParticipant[];
  rounds: TournamentMatchRound[];
  createdAt: number;
  finishedAt?: number | null;
}

// Estadísticas Avanzadas & Ranking General
export interface PresenterQuestionAnalytics {
  questionId: string;
  prompt: string;
  category: string;
  difficulty: Difficulty;
  attempts: number;
  correctCount: number;
  errorPercent: number;
  accuracyPercent: number;
}

export interface GlobalStatsOverview {
  totalGames: number;
  totalParticipants: number;
  totalQuestionsAsked: number;
  avgResponseMs: number;
  hardestQuestions: PresenterQuestionAnalytics[];
  easiestQuestions: PresenterQuestionAnalytics[];
  categoryPerformance: CategoryStatEntry[];
  topParticipants: Array<{
    name: string;
    avatarId: string;
    totalScore: number;
    gamesPlayed: number;
    wins: number;
    accuracyPercent: number;
  }>;
  topTeams: Array<{
    name: string;
    color: string;
    totalScore: number;
    wins: number;
    gamesPlayed: number;
  }>;
}

export interface GeneralRankingResponse {
  period: 'week' | 'month' | 'year' | 'season' | 'all';
  competitionType: string;
  bestParticipants: Array<{
    rank: number;
    name: string;
    avatarId: string;
    totalScore: number;
    wins: number;
    correctCount: number;
    gamesPlayed: number;
    modeLabel: string;
  }>;
  bestTeams: Array<{
    rank: number;
    teamName: string;
    color: string;
    totalScore: number;
    wins: number;
    gamesPlayed: number;
  }>;
  bestChurches: Array<{
    rank: number;
    orgName: string;
    kind: string;
    color: string;
    totalPoints: number;
    wins: number;
    tournamentCount: number;
  }>;
  tournamentChampions: Array<{
    tournamentName: string;
    championName: string;
    kind: string;
    points: number;
    finishedAt: number;
  }>;
  mostWins: Array<{
    rank: number;
    name: string;
    avatarId: string;
    wins: number;
    totalScore: number;
  }>;
  mostCorrect: Array<{
    rank: number;
    name: string;
    avatarId: string;
    correctCount: number;
    totalScore: number;
  }>;
}

export type ExpansionLeaderboardEntry = LeaderboardEntry;
