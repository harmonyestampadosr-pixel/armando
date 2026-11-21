import crypto from 'crypto';
import type express from 'express';
import {
  ACHIEVEMENT_DEFINITIONS,
  BIBLE_MYSTERY_ITEMS,
  COMPLETE_VERSE_ITEMS,
  CROSSWORD_PUZZLES,
  LEARNING_STUDY_CARDS,
  MATCH_PUZZLES,
  ROULETTE_CATEGORIES,
  SCRAMBLE_CHALLENGES,
  STUDY_TOPICS,
  TRAJECTORY_LEVELS,
  WHO_AM_I_ITEMS,
} from './src/shared/biblicalModulesData.js';
import type {
  AchievementBadgeInfo,
  CategoryStatEntry,
  ChampionshipRoundParticipantSnapshot,
  ChampionshipRoomState,
  ChurchTournament,
  GeneralRankingResponse,
  GlobalStatsOverview,
  LearningCardClientView,
  LearningProgressData,
  LearningReviewCard,
  LearningRoomState,
  MysteryClueItem,
  MysteryRoomState,
  PlayerTrajectoryProfile,
  PresenterQuestionAnalytics,
  RetoChallengeView,
  RetoCompetitionKind,
  RetoMySubmissionState,
  RetoParticipantSubmissionSummary,
  RetoRoomState,
  RouletteRoomState,
  TournamentEntityKind,
  TournamentMatchRound,
  TournamentOrganization,
  TournamentTeamEntry,
  TrajectoryLevelInfo,
} from './src/shared/expansionTypes.js';
import type {
  BibleQuestion,
  Difficulty,
  GameConfig,
  GameMode,
  GameStatus,
  LeaderboardEntry,
  Participant,
  TeamScoreEntry,
} from './src/shared/types.js';
import type { AnnouncerRoomState } from './src/shared/announcerTypes.js';

export interface ServerStoredParticipant extends Participant {
  token: string;
  photoAccessKey?: string;
  photoFile?: string;
}

export interface ServerStoredAnswer {
  participantId: string;
  selectedIndex: number;
  isCorrect: boolean;
  pointsEarned: number;
  responseTimeMs: number;
  submittedAt: number;
}

export interface ServerGameQuestionInstance extends BibleQuestion {
  isSpecialMultiplier: number;
  roundStage?: string;
}

export interface RetoInternalSubmission {
  participantId: string;
  isCorrect: boolean;
  accuracyPercent: number;
  pointsEarned: number;
  responseTimeMs: number;
  submittedAt: number;
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

export interface ServerStoredGame {
  id: string;
  inviteSignature: string;
  code: string;
  presenterToken: string;
  config: GameConfig;
  status: GameStatus;
  previousStatusBeforePause?: GameStatus;
  pausedRemainingMs?: number;
  questions: ServerGameQuestionInstance[];
  currentQuestionIndex: number;
  roundNonce?: number;
  questionLockReason?: 'timeout' | 'all_answered';
  questionStartedAt: number | null;
  questionEndsAt: number | null;
  participants: Record<string, ServerStoredParticipant>;
  answers: Record<number, Record<string, ServerStoredAnswer>>;
  evaluatedEliminations: number[];
  createdAt: number;
  finishedAt: number | null;
  // Additive expansion room states
  rouletteState?: RouletteRoomState;
  mysteryInternal?: {
    kind: 'quien_soy' | 'misterio_biblico';
    currentItemIndex: number;
    revealedClueCount: number;
    itemIds: string[];
    itemSolvedBy: Array<{
      participantId: string;
      name: string;
      points: number;
      clueNumber: number;
    }>;
    guessedInCurrentItem: Record<string, boolean>;
  };
  championshipState?: ChampionshipRoomState & {
    questionOffsetInRound: number;
  };
  retoInternal?: {
    kind: RetoCompetitionKind;
    currentIndex: number;
    challengeIds: string[];
    scrambledLettersByChallengeId: Record<string, string>;
    shuffledRightByChallengeId: Record<
      string,
      Array<{ right: string; reference: string }>
    >;
    submissions: Record<number, Record<string, RetoInternalSubmission>>;
  };
  learningInternal?: {
    currentIndex: number;
    cardIds: string[];
    explanationTiming: 'after_each' | 'end_of_round';
    studyTopicId: string;
  };
  tournamentId?: string;
  tournamentRoundId?: string;
  announcerInternal?: AnnouncerRoomState;
}

export interface ServerPlayerProfile {
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
  completedRetoIds: string[];
  roulettePlayed: number;
  mysteryPlayed: number;
  unlockedAtMap: Record<string, number>;
  recentMatches: Array<{
    date: number;
    gameTitle: string;
    mode: string;
    score: number;
    correctCount: number;
    won: boolean;
  }>;
  categoryStatsMap: Record<string, { answered: number; correct: number }>;
  updatedAt: number;
}

export interface ServerQuestionAnalytic {
  questionId: string;
  prompt: string;
  category: string;
  difficulty: Difficulty;
  attempts: number;
  correctCount: number;
}

export interface ModeMatchRecord {
  id: string;
  mode: GameMode | string;
  modeLabel: string;
  title: string;
  finishedAt: number;
  participantScores: Array<{
    profileKey: string;
    name: string;
    avatarId: string;
    score: number;
    correctCount: number;
    answeredCount: number;
    won: boolean;
  }>;
  teamScores: Array<{
    teamName: string;
    color: string;
    score: number;
    won: boolean;
  }>;
}

export interface ExpansionDatabaseSlice {
  playerProfiles: Record<string, ServerPlayerProfile>;
  learningProgress: Record<string, LearningProgressData>;
  tournaments: Record<string, ChurchTournament>;
  questionAnalytics: Record<string, ServerQuestionAnalytic>;
  modeMatchRecords: ModeMatchRecord[];
  recordedGameIds: string[];
}

export function createEmptyExpansionSlice(): ExpansionDatabaseSlice {
  return {
    playerProfiles: {},
    learningProgress: {},
    tournaments: {},
    questionAnalytics: {},
    modeMatchRecords: [],
    recordedGameIds: [],
  };
}

export function hydrateExpansionSlice(
  raw?: Partial<ExpansionDatabaseSlice>
): ExpansionDatabaseSlice {
  const empty = createEmptyExpansionSlice();
  if (!raw || typeof raw !== 'object') return empty;
  return {
    playerProfiles:
      raw.playerProfiles && typeof raw.playerProfiles === 'object'
        ? raw.playerProfiles
        : {},
    learningProgress:
      raw.learningProgress && typeof raw.learningProgress === 'object'
        ? raw.learningProgress
        : {},
    tournaments:
      raw.tournaments && typeof raw.tournaments === 'object'
        ? raw.tournaments
        : {},
    questionAnalytics:
      raw.questionAnalytics && typeof raw.questionAnalytics === 'object'
        ? raw.questionAnalytics
        : {},
    modeMatchRecords: Array.isArray(raw.modeMatchRecords)
      ? raw.modeMatchRecords
      : [],
    recordedGameIds: Array.isArray(raw.recordedGameIds)
      ? raw.recordedGameIds
      : [],
  };
}

export function normalizeText(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeLettersOnly(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

function shuffleArr<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getOrCreateProfile(
  slice: ExpansionDatabaseSlice,
  profileKey: string,
  displayName?: string,
  avatarId?: string
): ServerPlayerProfile {
  const key = profileKey.trim() || 'guest-default';
  if (!slice.playerProfiles[key]) {
    slice.playerProfiles[key] = {
      profileKey: key,
      displayName: displayName?.trim() || 'Participante Bíblico',
      avatarId: avatarId || 'crown',
      totalGamesPlayed: 0,
      totalWins: 0,
      totalPoints: 0,
      totalCorrect: 0,
      totalIncorrect: 0,
      bestScore: 0,
      bestStreak: 0,
      hardCorrectCount: 0,
      wins1v1: 0,
      teamWins: 0,
      tournamentsPlayed: 0,
      retosCompleted: 0,
      completedRetoIds: [],
      roulettePlayed: 0,
      mysteryPlayed: 0,
      unlockedAtMap: {},
      recentMatches: [],
      categoryStatsMap: {},
      updatedAt: Date.now(),
    };
  } else {
    if (displayName && displayName.trim().length >= 2) {
      slice.playerProfiles[key].displayName = displayName.trim();
    }
    if (avatarId) {
      slice.playerProfiles[key].avatarId = avatarId;
    }
  }
  return slice.playerProfiles[key];
}

function evaluateLevel(totalPoints: number): TrajectoryLevelInfo {
  let current = TRAJECTORY_LEVELS[0];
  for (const lvl of TRAJECTORY_LEVELS) {
    if (totalPoints >= lvl.minPoints) {
      current = lvl;
    }
  }
  return current;
}

function evaluateAchievements(profile: ServerPlayerProfile): AchievementBadgeInfo[] {
  const now = Date.now();
  const metricMap: Record<string, number> = {
    win_5: profile.totalWins,
    win_10: profile.totalWins,
    hard_20: profile.hardCorrectCount,
    streak_10: profile.bestStreak,
    play_10: profile.totalGamesPlayed,
    win_1v1: profile.wins1v1,
    win_team: profile.teamWins,
    play_tournament: profile.tournamentsPlayed,
    retos_5: profile.retosCompleted,
  };

  return ACHIEVEMENT_DEFINITIONS.map((def) => {
    const cur = metricMap[def.id] || 0;
    const unlocked = cur >= def.target || Boolean(profile.unlockedAtMap[def.id]);
    if (cur >= def.target && !profile.unlockedAtMap[def.id]) {
      profile.unlockedAtMap[def.id] = now;
    }
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      conditionText: def.conditionText,
      icon: def.icon,
      color: def.color,
      unlocked,
      unlockedAt: profile.unlockedAtMap[def.id],
      progressCurrent: Math.min(cur, def.target),
      progressTarget: def.target,
    };
  });
}

function buildPublicTrajectory(profile: ServerPlayerProfile): PlayerTrajectoryProfile {
  const achievements = evaluateAchievements(profile);
  const categoryStats: CategoryStatEntry[] = Object.entries(
    profile.categoryStatsMap
  )
    .map(([category, st]) => ({
      category,
      answered: st.answered,
      correct: st.correct,
      accuracyPercent:
        st.answered > 0 ? Math.round((st.correct / st.answered) * 100) : 0,
    }))
    .sort((a, b) => b.answered - a.answered);

  return {
    profileKey: profile.profileKey,
    displayName: profile.displayName,
    avatarId: profile.avatarId,
    totalGamesPlayed: profile.totalGamesPlayed,
    totalWins: profile.totalWins,
    totalPoints: profile.totalPoints,
    totalCorrect: profile.totalCorrect,
    totalIncorrect: profile.totalIncorrect,
    bestScore: profile.bestScore,
    bestStreak: profile.bestStreak,
    hardCorrectCount: profile.hardCorrectCount,
    wins1v1: profile.wins1v1,
    teamWins: profile.teamWins,
    tournamentsPlayed: profile.tournamentsPlayed,
    retosCompleted: profile.retosCompleted,
    roulettePlayed: profile.roulettePlayed,
    mysteryPlayed: profile.mysteryPlayed,
    level: evaluateLevel(profile.totalPoints),
    achievements,
    recentMatches: [...profile.recentMatches].slice(0, 20),
    categoryStats,
    updatedAt: profile.updatedAt,
  };
}

// ---------------- MULTIPLAYER EXPANSION HOOKS ----------------

function pickByDifficultyWithFallback<T extends { difficulty: Difficulty }>(
  items: T[],
  difficulty: GameConfig['difficulty'],
  targetCount: number
): T[] {
  const matched =
    difficulty === 'combinado'
      ? shuffleArr(items)
      : shuffleArr(items.filter((i) => i.difficulty === difficulty));
  const seen = new Set(matched);
  const rest = shuffleArr(items.filter((i) => !seen.has(i)));
  const combined = [...matched, ...rest];
  return combined.slice(0, Math.max(1, Math.min(combined.length, targetCount)));
}

function scrambleWordDeterministic(word: string): string {
  const letters = shuffleArr(word.split(''));
  let joined = letters.join('');
  if (joined === word && word.length > 1) {
    joined = `${word.slice(1)}${word[0]}`;
  }
  return joined;
}

export function isRetoCompetitionMode(mode: string): mode is RetoCompetitionKind {
  return (
    mode === 'crucigrama_biblico' ||
    mode === 'palabras_desordenadas' ||
    mode === 'completa_versiculo' ||
    mode === 'rompecabezas_biblico'
  );
}

export function initExpansionStateForGame(
  game: ServerStoredGame,
  body: Record<string, unknown>
): void {
  const mode = game.config.mode;
  if (mode === 'ruleta_biblica') {
    game.rouletteState = {
      spinNonce: 0,
      selectedCategoryId: null,
      selectedCategoryLabel: null,
      targetAngleDeg: 0,
      usedQuestionIds: [],
      spinsCount: 0,
    };
    // Questions will be dynamically drawn when presenter spins the roulette
    game.questions = [];
  } else if (mode === 'quien_soy' || mode === 'misterio_biblico') {
    const source = mode === 'quien_soy' ? WHO_AM_I_ITEMS : BIBLE_MYSTERY_ITEMS;
    const requestedCount = Math.max(
      3,
      Math.min(source.length, Number(body.questionCount) || Math.min(8, source.length))
    );
    const pickedItems = pickByDifficultyWithFallback(
      source,
      game.config.difficulty,
      requestedCount
    );
    game.config.questionCount = pickedItems.length;
    game.mysteryInternal = {
      kind: mode,
      currentItemIndex: -1,
      revealedClueCount: 1,
      itemIds: pickedItems.map((i) => i.id),
      itemSolvedBy: [],
      guessedInCurrentItem: {},
    };
    // Keep lightweight placeholder questions count synced for UI indicators
    game.questions = pickedItems.map((item) => ({
      id: item.id,
      group: 'Categorías Especiales',
      category: mode === 'quien_soy' ? '¿Quién soy según la Biblia?' : 'Misterio Bíblico',
      difficulty: item.difficulty,
      prompt: item.title,
      options: item.options,
      correctIndex: item.correctOptionIndex,
      reference: item.reference,
      explanation: item.explanation,
      isSpecialMultiplier: 1,
    }));
  } else if (mode === 'crucigrama_biblico') {
    const requestedCount = Math.max(
      1,
      Math.min(CROSSWORD_PUZZLES.length, Number(body.questionCount) || 3)
    );
    const picked = pickByDifficultyWithFallback(
      CROSSWORD_PUZZLES,
      game.config.difficulty,
      requestedCount
    );
    game.config.questionCount = picked.length;
    game.retoInternal = {
      kind: 'crucigrama_biblico',
      currentIndex: -1,
      challengeIds: picked.map((c) => c.id),
      scrambledLettersByChallengeId: {},
      shuffledRightByChallengeId: {},
      submissions: {},
    };
    game.questions = picked.map((cw) => ({
      id: cw.id,
      group: 'Categorías Especiales',
      category: 'Crucigramas Bíblicos',
      difficulty: cw.difficulty,
      prompt: cw.title,
      options: ['Crucigrama completado', 'Incompleto'],
      correctIndex: 0,
      reference: cw.words.map((w) => w.reference).slice(0, 3).join('; '),
      explanation: `${cw.words.length} palabras bíblicas en cuadrícula de ${cw.rows}×${cw.cols}.`,
      isSpecialMultiplier: 1,
    }));
  } else if (mode === 'palabras_desordenadas') {
    const requestedCount = Math.max(
      3,
      Math.min(SCRAMBLE_CHALLENGES.length, Number(body.questionCount) || 10)
    );
    const picked = pickByDifficultyWithFallback(
      SCRAMBLE_CHALLENGES,
      game.config.difficulty,
      requestedCount
    );
    game.config.questionCount = picked.length;
    const scrambledMap: Record<string, string> = {};
    for (const sc of picked) {
      scrambledMap[sc.id] = scrambleWordDeterministic(sc.word);
    }
    game.retoInternal = {
      kind: 'palabras_desordenadas',
      currentIndex: -1,
      challengeIds: picked.map((s) => s.id),
      scrambledLettersByChallengeId: scrambledMap,
      shuffledRightByChallengeId: {},
      submissions: {},
    };
    game.questions = picked.map((sc) => ({
      id: sc.id,
      group: 'Categorías Especiales',
      category: `Palabras Desordenadas · ${sc.category}`,
      difficulty: sc.difficulty,
      prompt: `Ordena las ${sc.word.length} letras: ${sc.hint}`,
      options: [sc.displayWord, 'Otra respuesta'],
      correctIndex: 0,
      reference: sc.reference,
      explanation: sc.hint,
      isSpecialMultiplier: 1,
    }));
  } else if (mode === 'completa_versiculo') {
    const requestedCount = Math.max(
      3,
      Math.min(COMPLETE_VERSE_ITEMS.length, Number(body.questionCount) || 10)
    );
    const picked = pickByDifficultyWithFallback(
      COMPLETE_VERSE_ITEMS,
      game.config.difficulty,
      requestedCount
    );
    game.config.questionCount = picked.length;
    game.retoInternal = {
      kind: 'completa_versiculo',
      currentIndex: -1,
      challengeIds: picked.map((v) => v.id),
      scrambledLettersByChallengeId: {},
      shuffledRightByChallengeId: {},
      submissions: {},
    };
    game.questions = picked.map((v) => ({
      id: v.id,
      group: 'Categorías Especiales',
      category: 'Completa el versículo',
      difficulty: v.difficulty,
      prompt: `${v.verseBefore} _____ ${v.verseAfter}`,
      options: v.options,
      correctIndex: v.correctIndex,
      reference: v.reference,
      explanation: v.explanation,
      isSpecialMultiplier: 1,
    }));
  } else if (mode === 'rompecabezas_biblico') {
    const requestedCount = Math.max(
      1,
      Math.min(MATCH_PUZZLES.length, Number(body.questionCount) || 4)
    );
    const picked = pickByDifficultyWithFallback(
      MATCH_PUZZLES,
      game.config.difficulty,
      requestedCount
    );
    game.config.questionCount = picked.length;
    const shuffledRight: Record<string, Array<{ right: string; reference: string }>> = {};
    for (const mp of picked) {
      shuffledRight[mp.id] = shuffleArr(
        mp.pairs.map((p) => ({ right: p.right, reference: p.reference }))
      );
    }
    game.retoInternal = {
      kind: 'rompecabezas_biblico',
      currentIndex: -1,
      challengeIds: picked.map((m) => m.id),
      scrambledLettersByChallengeId: {},
      shuffledRightByChallengeId: shuffledRight,
      submissions: {},
    };
    game.questions = picked.map((mp) => ({
      id: mp.id,
      group: 'Categorías Especiales',
      category: 'Rompecabezas Bíblicos',
      difficulty: mp.difficulty,
      prompt: mp.title,
      options: ['Relación completada', 'Pendiente'],
      correctIndex: 0,
      reference: mp.pairs.map((p) => p.reference).slice(0, 3).join('; '),
      explanation: mp.description,
      isSpecialMultiplier: 1,
    }));
  } else if (mode === 'aprende_biblia') {
    const studyTopicId = String(body.studyTopicId || game.config.studyTopicId || 'all');
    const explanationTiming =
      body.explanationTiming === 'end_of_round' ||
      game.config.explanationTiming === 'end_of_round'
        ? 'end_of_round'
        : 'after_each';
    const topicFiltered =
      studyTopicId !== 'all'
        ? LEARNING_STUDY_CARDS.filter((c) => c.topicId === studyTopicId)
        : LEARNING_STUDY_CARDS;
    const poolBase = topicFiltered.length > 0 ? topicFiltered : LEARNING_STUDY_CARDS;
    const requestedCount = Math.max(
      1,
      Math.min(LEARNING_STUDY_CARDS.length, Number(body.questionCount) || Math.min(8, poolBase.length))
    );
    let picked = pickByDifficultyWithFallback(
      poolBase,
      game.config.difficulty,
      requestedCount
    );
    if (picked.length < requestedCount) {
      const seen = new Set(picked.map((c) => c.id));
      const extras = shuffleArr(LEARNING_STUDY_CARDS.filter((c) => !seen.has(c.id)));
      picked = [...picked, ...extras].slice(0, requestedCount);
    }
    game.config.questionCount = picked.length;
    game.config.explanationTiming = explanationTiming;
    game.config.studyTopicId = studyTopicId;
    game.learningInternal = {
      currentIndex: -1,
      cardIds: picked.map((c) => c.id),
      explanationTiming,
      studyTopicId,
    };
    game.questions = picked.map((card) => ({
      id: card.id,
      group: 'Categorías Especiales',
      category: card.topicLabel,
      difficulty: card.difficulty,
      prompt: card.prompt,
      options: card.options,
      correctIndex: card.correctIndex,
      reference: card.reference,
      explanation: card.simpleExplanation,
      isSpecialMultiplier: 1,
      roundStage: `${card.bookOrSection}${card.chapterRef ? ` · ${card.chapterRef}` : ''}`,
    }));
  } else if (mode === 'campeonato_rondas') {
    const qPerRound = Math.max(3, Math.min(10, Number(body.questionsPerRound) || 5));
    const r2 = Math.max(2, Math.min(32, Number(body.advanceRound2Count) || 8));
    const semi = Math.max(2, Math.min(r2, Number(body.advanceSemifinalCount) || 4));
    const fin = Math.max(2, Math.min(semi, Number(body.advanceFinalCount) || 2));
    game.championshipState = {
      currentRound: 1,
      roundName: 'Ronda 1 · Clasificación',
      advanceRound2Count: r2,
      advanceSemifinalCount: semi,
      advanceFinalCount: fin,
      questionsPerRound: qPerRound,
      qualifiedParticipantIds: [],
      eliminatedParticipantIds: [],
      roundHistory: [],
      tiebreakerActive: false,
      questionOffsetInRound: 0,
    };
    // Tag initial questions for Round 1
    game.questions = game.questions.slice(0, qPerRound).map((q) => ({
      ...q,
      roundStage: 'Ronda 1 · Clasificatoria',
    }));
  }

  if (typeof body.tournamentId === 'string' && body.tournamentId.trim()) {
    game.tournamentId = body.tournamentId.trim();
  }
  if (typeof body.tournamentRoundId === 'string' && body.tournamentRoundId.trim()) {
    game.tournamentRoundId = body.tournamentRoundId.trim();
  }
}

export function buildMysteryClientView(
  game: ServerStoredGame,
  role: 'presenter' | 'projector' | 'participant'
): MysteryRoomState | undefined {
  const internal = game.mysteryInternal;
  if (!internal) return undefined;
  const source = internal.kind === 'quien_soy' ? WHO_AM_I_ITEMS : BIBLE_MYSTERY_ITEMS;
  const itemId =
    internal.currentItemIndex >= 0
      ? internal.itemIds[internal.currentItemIndex]
      : undefined;
  const item: MysteryClueItem | undefined = itemId
    ? source.find((x) => x.id === itemId)
    : undefined;
  const showAnswer =
    game.status === 'answer_revealed' ||
    game.status === 'finished' ||
    role === 'presenter';

  return {
    kind: internal.kind,
    currentItemIndex: internal.currentItemIndex,
    totalItems: internal.itemIds.length,
    revealedClueCount: internal.revealedClueCount,
    itemIds: internal.itemIds,
    currentItemView: item
      ? {
          id: item.id,
          kind: item.kind,
          clues: item.clues.slice(0, internal.revealedClueCount),
          totalClues: item.clues.length,
          options: item.options,
          avatarId: item.avatarId,
          difficulty: item.difficulty,
          ...(showAnswer
            ? {
                answer: item.answer,
                correctOptionIndex: item.correctOptionIndex,
                reference: item.reference,
                explanation: item.explanation,
              }
            : {}),
        }
      : null,
    itemSolvedBy: internal.itemSolvedBy,
  };
}

function getMysteryPointsForClueCount(clueCount: number): number {
  const table = [1500, 1200, 950, 750, 550];
  return table[Math.max(0, Math.min(table.length - 1, clueCount - 1))] || 500;
}

export function buildRetoClientView(
  game: ServerStoredGame,
  role: 'presenter' | 'projector' | 'participant',
  participantId?: string
): RetoRoomState | undefined {
  const internal = game.retoInternal;
  if (!internal) return undefined;

  const isRevealed =
    game.status === 'answer_revealed' || game.status === 'finished';
  const showSolution = isRevealed || role === 'presenter';
  const idx = internal.currentIndex;
  const challengeId =
    idx >= 0 && idx < internal.challengeIds.length
      ? internal.challengeIds[idx]
      : undefined;

  let currentChallenge: RetoChallengeView | null = null;

  if (challengeId) {
    if (internal.kind === 'crucigrama_biblico') {
      const cw = CROSSWORD_PUZZLES.find((c) => c.id === challengeId);
      if (cw) {
        const solutionGrid: Record<string, string> = {};
        if (showSolution) {
          for (const w of cw.words) {
            for (let i = 0; i < w.answer.length; i++) {
              const r = w.direction === 'H' ? w.row : w.row + i;
              const c = w.direction === 'H' ? w.col + i : w.col;
              solutionGrid[`${r},${c}`] = w.answer[i];
            }
          }
        }
        currentChallenge = {
          kind: 'crucigrama_biblico',
          id: cw.id,
          title: cw.title,
          difficulty: cw.difficulty,
          rows: cw.rows,
          cols: cw.cols,
          words: cw.words.map((w) => ({
            id: w.id,
            number: w.number,
            direction: w.direction,
            row: w.row,
            col: w.col,
            length: w.answer.length,
            clue: w.clue,
            reference: w.reference,
            ...(showSolution ? { displayAnswer: w.displayAnswer } : {}),
          })),
          ...(showSolution ? { solutionGrid } : {}),
        };
      }
    } else if (internal.kind === 'palabras_desordenadas') {
      const sc = SCRAMBLE_CHALLENGES.find((s) => s.id === challengeId);
      if (sc) {
        currentChallenge = {
          kind: 'palabras_desordenadas',
          id: sc.id,
          scrambledLetters:
            internal.scrambledLettersByChallengeId[sc.id] ||
            scrambleWordDeterministic(sc.word),
          wordLength: sc.word.length,
          category: sc.category,
          difficulty: sc.difficulty,
          hint: sc.hint,
          reference: sc.reference,
          ...(showSolution
            ? { displayWord: sc.displayWord, word: sc.word }
            : {}),
        };
      }
    } else if (internal.kind === 'completa_versiculo') {
      const cv = COMPLETE_VERSE_ITEMS.find((v) => v.id === challengeId);
      if (cv) {
        currentChallenge = {
          kind: 'completa_versiculo',
          id: cv.id,
          verseBefore: cv.verseBefore,
          verseAfter: cv.verseAfter,
          options: cv.options,
          reference: isRevealed || role === 'presenter' ? cv.reference : 'Cita bíblica (se revela al cierre)',
          difficulty: cv.difficulty,
          ...(showSolution
            ? {
                correctIndex: cv.correctIndex,
                missingWord: cv.missingWord,
                explanation: cv.explanation,
              }
            : {}),
        };
      }
    } else if (internal.kind === 'rompecabezas_biblico') {
      const mp = MATCH_PUZZLES.find((m) => m.id === challengeId);
      if (mp) {
        const rightItems =
          internal.shuffledRightByChallengeId[mp.id] ||
          mp.pairs.map((p) => ({ right: p.right, reference: p.reference }));
        currentChallenge = {
          kind: 'rompecabezas_biblico',
          id: mp.id,
          title: mp.title,
          matchKind: mp.kind,
          difficulty: mp.difficulty,
          description: mp.description,
          leftItems: mp.pairs.map((p) => ({ id: p.id, label: p.left })),
          rightItems,
          ...(showSolution ? { expectedPairs: mp.pairs } : {}),
        };
      }
    }
  }

  const subMap = (idx >= 0 ? internal.submissions[idx] : undefined) || {};
  const myRawSub = participantId ? subMap[participantId] : undefined;
  let mySubmission: RetoMySubmissionState | null = null;
  if (myRawSub) {
    mySubmission = {
      submitted: true,
      selectedIndex: myRawSub.selectedIndex,
      typedAnswer: myRawSub.typedAnswer,
      responseTimeMs: myRawSub.responseTimeMs,
      ...(isRevealed
        ? {
            isCorrect: myRawSub.isCorrect,
            accuracyPercent: myRawSub.accuracyPercent,
            pointsEarned: myRawSub.pointsEarned,
            wordResults: myRawSub.wordResults,
            pairResults: myRawSub.pairResults,
          }
        : {}),
    };
  }

  const includeDetails = isRevealed || role === 'presenter';
  const challengeResults: RetoParticipantSubmissionSummary[] = includeDetails
    ? Object.values(game.participants)
        .map((p) => {
          const s = subMap[p.id];
          if (!s) {
            return {
              participantId: p.id,
              participantName: p.name,
              avatarId: p.avatarId,
              photoUrl: p.photoUrl,
              teamId: p.teamId,
              isCorrect: false,
              accuracyPercent: 0,
              pointsEarned: 0,
              responseTimeMs: null,
            };
          }
          return {
            participantId: p.id,
            participantName: p.name,
            avatarId: p.avatarId,
            photoUrl: p.photoUrl,
            teamId: p.teamId,
            isCorrect: s.isCorrect,
            accuracyPercent: s.accuracyPercent,
            pointsEarned: s.pointsEarned,
            responseTimeMs: s.responseTimeMs,
          };
        })
        .sort((a, b) => {
          if (b.pointsEarned !== a.pointsEarned) return b.pointsEarned - a.pointsEarned;
          if (b.accuracyPercent !== a.accuracyPercent) {
            return b.accuracyPercent - a.accuracyPercent;
          }
          return (a.responseTimeMs ?? 999999) - (b.responseTimeMs ?? 999999);
        })
    : [];

  const solvedCount = Object.values(subMap).filter((s) => s.isCorrect).length;

  let reviewItems: RetoRoomState['reviewItems'];
  if (game.status === 'finished') {
    reviewItems = internal.challengeIds.map((cid, cIdx) => {
      if (internal.kind === 'crucigrama_biblico') {
        const cw = CROSSWORD_PUZZLES.find((c) => c.id === cid);
        return {
          index: cIdx,
          title: cw?.title || 'Crucigrama',
          reference: cw?.words.map((w) => w.reference).join(' · ') || '',
          answerSummary: cw?.words.map((w) => w.displayAnswer).join(', ') || '',
        };
      }
      if (internal.kind === 'palabras_desordenadas') {
        const sc = SCRAMBLE_CHALLENGES.find((s) => s.id === cid);
        return {
          index: cIdx,
          title: `${sc?.category || 'Palabra'}: ${sc?.hint || ''}`,
          reference: sc?.reference || '',
          answerSummary: sc?.displayWord || '',
        };
      }
      if (internal.kind === 'completa_versiculo') {
        const cv = COMPLETE_VERSE_ITEMS.find((v) => v.id === cid);
        return {
          index: cIdx,
          title: `${cv?.verseBefore || ''} ${cv?.missingWord || ''} ${cv?.verseAfter || ''}`,
          reference: cv?.reference || '',
          answerSummary: cv?.explanation || '',
        };
      }
      const mp = MATCH_PUZZLES.find((m) => m.id === cid);
      return {
        index: cIdx,
        title: mp?.title || 'Rompecabezas',
        reference: mp?.pairs.map((p) => p.reference).join(' · ') || '',
        answerSummary:
          mp?.pairs.map((p) => `${p.left} → ${p.right}`).join(' | ') || '',
      };
    });
  }

  return {
    kind: internal.kind,
    currentIndex: internal.currentIndex,
    totalChallenges: internal.challengeIds.length,
    currentChallenge,
    mySubmission,
    challengeResults,
    solvedCount,
    ...(reviewItems ? { reviewItems } : {}),
  };
}

export function buildLearningClientView(
  game: ServerStoredGame,
  role: 'presenter' | 'projector' | 'participant'
): LearningRoomState | undefined {
  const internal = game.learningInternal;
  if (!internal) return undefined;

  const isRevealed =
    game.status === 'answer_revealed' || game.status === 'finished';
  const isAfterEach = internal.explanationTiming === 'after_each';
  const showExplanationNow =
    (isRevealed && isAfterEach) ||
    game.status === 'finished' ||
    role === 'presenter';
  const showCorrect = isRevealed || role === 'presenter';

  const cardId =
    internal.currentIndex >= 0 && internal.currentIndex < internal.cardIds.length
      ? internal.cardIds[internal.currentIndex]
      : undefined;
  const card = cardId
    ? LEARNING_STUDY_CARDS.find((c) => c.id === cardId)
    : undefined;

  const currentCard: LearningCardClientView | null = card
    ? {
        id: card.id,
        topicId: card.topicId,
        topicLabel: card.topicLabel,
        bookOrSection: card.bookOrSection,
        chapterRef: card.chapterRef,
        difficulty: card.difficulty,
        prompt: card.prompt,
        options: card.options,
        ...(showCorrect ? { correctIndex: card.correctIndex } : {}),
        ...(showExplanationNow
          ? {
              reference: card.reference,
              simpleExplanation: card.simpleExplanation,
              context: card.context,
              mainTeaching: card.mainTeaching,
              complementaryQuestion: card.complementaryQuestion ?? null,
            }
          : {}),
      }
    : null;

  let completedCardsReview: LearningReviewCard[] | undefined;
  if (game.status === 'finished') {
    const reachedCount = Math.max(
      internal.currentIndex + 1,
      Object.keys(game.answers).length
    );
    const sliceIds = internal.cardIds.slice(
      0,
      Math.max(1, Math.min(internal.cardIds.length, reachedCount))
    );
    completedCardsReview = sliceIds
      .map((cid, cIdx): LearningReviewCard | null => {
        const c = LEARNING_STUDY_CARDS.find((x) => x.id === cid);
        if (!c) return null;
        return {
          index: cIdx,
          id: c.id,
          topicLabel: c.topicLabel,
          bookOrSection: c.bookOrSection,
          ...(c.chapterRef ? { chapterRef: c.chapterRef } : {}),
          prompt: c.prompt,
          options: c.options,
          correctIndex: c.correctIndex,
          reference: c.reference,
          simpleExplanation: c.simpleExplanation,
          context: c.context,
          mainTeaching: c.mainTeaching,
          complementaryQuestion: c.complementaryQuestion ?? null,
        };
      })
      .filter((x): x is LearningReviewCard => x !== null);
  }

  return {
    currentIndex: internal.currentIndex,
    totalCards: internal.cardIds.length,
    explanationTiming: internal.explanationTiming,
    studyTopicId: internal.studyTopicId,
    currentCard,
    ...(completedCardsReview ? { completedCardsReview } : {}),
  };
}

export interface ExpansionActionHelpers {
  allQuestionsBank: () => BibleQuestion[];
  prepareQuestion: (
    q: BibleQuestion,
    index: number,
    total: number,
    config: GameConfig
  ) => ServerGameQuestionInstance;
  selectQuestions: (config: GameConfig) => ServerGameQuestionInstance[];
  startQuestionAt: (game: ServerStoredGame, index: number) => void;
  finishGame: (game: ServerStoredGame) => void;
  buildLeaderboard: (game: ServerStoredGame) => LeaderboardEntry[];
  broadcastRoom: (code: string) => void;
  scheduleSave: () => void;
  sendWsError: (message: string) => void;
}

function pickRouletteQuestion(
  allQuestions: BibleQuestion[],
  slotId: string,
  usedIds: string[]
): BibleQuestion | null {
  const slot = ROULETTE_CATEGORIES.find((s) => s.id === slotId) || ROULETTE_CATEGORIES[0];
  const usedSet = new Set(usedIds);
  const unusedAll = allQuestions.filter((q) => !usedSet.has(q.id));
  if (unusedAll.length === 0) return null;

  const matching = unusedAll.filter((q) => {
    if (slot.matchDifficulty && q.difficulty === slot.matchDifficulty) return true;
    if (slot.matchGroup && q.group === slot.matchGroup) return true;
    if (slot.matchCategories.length > 0 && slot.matchCategories.includes(q.category)) {
      return true;
    }
    return false;
  });

  const pool = matching.length > 0 ? matching : unusedAll;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function handleExpansionPresenterAction(
  game: ServerStoredGame,
  action: string,
  msg: Record<string, unknown>,
  helpers: ExpansionActionHelpers
): boolean {
  // 1. Ruleta Bíblica spin
  if (action === 'spin_roulette' && game.config.mode === 'ruleta_biblica') {
    if (!game.rouletteState) {
      game.rouletteState = {
        spinNonce: 0,
        selectedCategoryId: null,
        selectedCategoryLabel: null,
        targetAngleDeg: 0,
        usedQuestionIds: [],
        spinsCount: 0,
      };
    }

    const slotIdx = Math.floor(Math.random() * ROULETTE_CATEGORIES.length);
    const slot = ROULETTE_CATEGORIES[slotIdx];
    const sliceDeg = 360 / ROULETTE_CATEGORIES.length;
    const sliceCenterOffset = (360 - (slotIdx * sliceDeg + sliceDeg / 2)) % 360;
    const prevBase =
      Math.floor(game.rouletteState.targetAngleDeg / 360) * 360;
    const nextAngle = prevBase + 1440 + sliceCenterOffset;

    const picked = pickRouletteQuestion(
      helpers.allQuestionsBank(),
      slot.id,
      game.rouletteState.usedQuestionIds
    );
    if (!picked) {
      helpers.finishGame(game);
      helpers.scheduleSave();
      helpers.broadcastRoom(game.code);
      return true;
    }

    const qIdx = game.questions.length;
    const instance = helpers.prepareQuestion(
      picked,
      qIdx,
      game.config.questionCount,
      game.config
    );
    instance.roundStage = `Ruleta · ${slot.label}`;
    game.questions.push(instance);

    game.rouletteState.spinNonce += 1;
    game.rouletteState.spinsCount += 1;
    game.rouletteState.selectedCategoryId = slot.id;
    game.rouletteState.selectedCategoryLabel = slot.label;
    game.rouletteState.targetAngleDeg = nextAngle;
    game.rouletteState.usedQuestionIds.push(picked.id);

    helpers.startQuestionAt(game, qIdx);
    helpers.scheduleSave();
    helpers.broadcastRoom(game.code);
    return true;
  }

  // 2. Who Am I / Mystery controls
  if (
    game.config.mode === 'quien_soy' ||
    game.config.mode === 'misterio_biblico'
  ) {
    const internal = game.mysteryInternal;
    if (!internal) return false;
    const source = internal.kind === 'quien_soy' ? WHO_AM_I_ITEMS : BIBLE_MYSTERY_ITEMS;

    if (action === 'start_game' || action === 'mystery_next_item' || action === 'next_question') {
      const nextItemIdx = internal.currentItemIndex + 1;
      if (nextItemIdx >= internal.itemIds.length) {
        helpers.finishGame(game);
      } else {
        internal.currentItemIndex = nextItemIdx;
        internal.revealedClueCount = 1;
        internal.itemSolvedBy = [];
        internal.guessedInCurrentItem = {};
        helpers.startQuestionAt(game, nextItemIdx);
      }
      helpers.scheduleSave();
      helpers.broadcastRoom(game.code);
      return true;
    }

    if (action === 'mystery_next_clue') {
      const item = source.find((x) => x.id === internal.itemIds[internal.currentItemIndex]);
      if (item && internal.revealedClueCount < item.clues.length) {
        internal.revealedClueCount += 1;
      }
      helpers.scheduleSave();
      helpers.broadcastRoom(game.code);
      return true;
    }

    if (action === 'mystery_reveal' || action === 'reveal_answer') {
      game.status = 'answer_revealed';
      helpers.scheduleSave();
      helpers.broadcastRoom(game.code);
      return true;
    }
  }

  // 3. Championship by Rounds controls
  if (game.config.mode === 'campeonato_rondas' && game.championshipState) {
    const cs = game.championshipState;
    if (action === 'start_game') {
      cs.currentRound = 1;
      cs.roundName = 'Ronda 1 · Clasificatoria';
      cs.qualifiedParticipantIds = Object.keys(game.participants);
      cs.eliminatedParticipantIds = [];
      cs.tiebreakerActive = false;
      for (const p of Object.values(game.participants)) {
        p.eliminated = false;
      }
      if (game.questions.length === 0) {
        game.questions = helpers.selectQuestions(game.config).slice(0, cs.questionsPerRound);
      }
      helpers.startQuestionAt(game, 0);
      helpers.scheduleSave();
      helpers.broadcastRoom(game.code);
      return true;
    }

    if (action === 'championship_advance_round') {
      const activeIds = new Set(
        cs.qualifiedParticipantIds.length > 0
          ? cs.qualifiedParticipantIds
          : Object.keys(game.participants)
      );
      const lb = helpers.buildLeaderboard(game);
      const contenders = lb.filter((e) => activeIds.has(e.participantId));

      let targetAdvanceCount = cs.advanceRound2Count;
      let nextRoundName = 'Ronda 2 · Avanzados';
      if (cs.currentRound === 2) {
        targetAdvanceCount = cs.advanceSemifinalCount;
        nextRoundName = 'Ronda 3 · Semifinales';
      } else if (cs.currentRound === 3) {
        targetAdvanceCount = cs.advanceFinalCount;
        nextRoundName = 'Ronda 4 · Gran Final';
      }

      if (cs.currentRound >= 4 || contenders.length <= 1) {
        // Record final round snapshot & finish
        const snap: ChampionshipRoundParticipantSnapshot[] = lb.map((e, idx) => ({
          participantId: e.participantId,
          name: e.name,
          avatarId: e.avatarId,
          photoUrl: e.photoUrl,
          score: e.score,
          correctCount: e.correctCount,
          advanced: activeIds.has(e.participantId) && idx === 0,
        }));
        cs.roundHistory.push({
          roundNumber: cs.currentRound,
          roundName: cs.roundName,
          standings: snap,
          completedAt: Date.now(),
        });
        helpers.finishGame(game);
        helpers.scheduleSave();
        helpers.broadcastRoom(game.code);
        return true;
      }

      const effectiveCutoff = Math.min(targetAdvanceCount, Math.max(2, contenders.length - 1));
      const advancingSet = new Set(
        contenders.slice(0, effectiveCutoff).map((c) => c.participantId)
      );

      // Snapshot ALL participants so eliminated players retain every stat across rounds
      const standingsSnap: ChampionshipRoundParticipantSnapshot[] = lb.map((e) => ({
        participantId: e.participantId,
        name: e.name,
        avatarId: e.avatarId,
        photoUrl: e.photoUrl,
        score: e.score,
        correctCount: e.correctCount,
        advanced: advancingSet.has(e.participantId),
      }));

      // Generate matchups when entering Semifinals or Gran Final
      const advancingList = contenders.slice(0, effectiveCutoff);
      const matchups: Array<{ id: string; playerA: string; playerB: string }> = [];
      for (let i = 0; i < Math.floor(advancingList.length / 2); i++) {
        matchups.push({
          id: `m-${cs.currentRound + 1}-${i + 1}`,
          playerA: advancingList[i].name,
          playerB: advancingList[advancingList.length - 1 - i].name,
        });
      }

      cs.roundHistory.push({
        roundNumber: cs.currentRound,
        roundName: cs.roundName,
        standings: standingsSnap,
        ...(matchups.length > 0 ? { matchups } : {}),
        completedAt: Date.now(),
      });

      cs.currentRound += 1;
      cs.roundName = nextRoundName;
      cs.qualifiedParticipantIds = Array.from(advancingSet);
      cs.tiebreakerActive = false;

      for (const p of Object.values(game.participants)) {
        if (!advancingSet.has(p.id)) {
          p.eliminated = true;
          if (!cs.eliminatedParticipantIds.includes(p.id)) {
            cs.eliminatedParticipantIds.push(p.id);
          }
        } else {
          p.eliminated = false;
        }
      }

      // Add fresh questions for next round (Gran Final gets 2x Special Points!)
      const usedIds = new Set(game.questions.map((q) => q.id));
      const freshPool = shuffleArr(
        helpers.allQuestionsBank().filter((q) => !usedIds.has(q.id))
      );
      const fallbackPool =
        freshPool.length >= cs.questionsPerRound
          ? freshPool
          : [...freshPool, ...shuffleArr(helpers.allQuestionsBank())];

      const isGranFinal = cs.currentRound === 4;
      const startIndex = game.questions.length;
      const nextRoundQuestions = fallbackPool
        .slice(0, cs.questionsPerRound)
        .map((q, idx) => {
          const inst = helpers.prepareQuestion(
            q,
            startIndex + idx,
            startIndex + cs.questionsPerRound,
            game.config
          );
          return {
            ...inst,
            isSpecialMultiplier: isGranFinal ? 2 : inst.isSpecialMultiplier,
            roundStage: isGranFinal ? 'Gran Final · Doble Puntaje' : nextRoundName,
          };
        });

      game.questions.push(...nextRoundQuestions);
      helpers.startQuestionAt(game, startIndex);
      helpers.scheduleSave();
      helpers.broadcastRoom(game.code);
      return true;
    }

    if (action === 'championship_tiebreaker') {
      const usedIds = new Set(game.questions.map((q) => q.id));
      const pool = shuffleArr(
        helpers.allQuestionsBank().filter((q) => !usedIds.has(q.id))
      );
      const q = pool[0] || helpers.allQuestionsBank()[0];
      const nextIdx = game.questions.length;
      const inst = helpers.prepareQuestion(q, nextIdx, nextIdx + 1, game.config);
      inst.isSpecialMultiplier = 2;
      inst.roundStage = `${cs.roundName} · Desempate Oficial`;
      cs.tiebreakerActive = true;
      game.questions.push(inst);
      helpers.startQuestionAt(game, nextIdx);
      helpers.scheduleSave();
      helpers.broadcastRoom(game.code);
      return true;
    }
  }

  // Team captain selection + tiebreaker (supports competencia_equipos and any mode with teamMode)
  const usesTeams =
    game.config.mode === 'competencia_equipos' || Boolean(game.config.teamMode);

  if (action === 'assign_captain' && usesTeams) {
    const teamId = String(msg.teamId || '');
    const participantId = String(msg.participantId || '');
    const team = game.config.teams?.find((t) => t.id === teamId);
    const p = game.participants[participantId];
    if (team && p && p.teamId === teamId) {
      team.captainParticipantId = participantId;
      helpers.scheduleSave();
      helpers.broadcastRoom(game.code);
    }
    return true;
  }

  if (action === 'start_tiebreaker' && usesTeams) {
    const usedIds = new Set(game.questions.map((q) => q.id));
    const pool = shuffleArr(
      helpers.allQuestionsBank().filter((q) => !usedIds.has(q.id))
    );
    const q = pool[0] || helpers.allQuestionsBank()[0];
    const nextIdx = game.questions.length;
    const inst = helpers.prepareQuestion(q, nextIdx, nextIdx + 1, game.config);
    inst.isSpecialMultiplier = 2;
    inst.roundStage = 'Desempate Oficial por Equipos';
    game.questions.push(inst);
    game.finishedAt = null;
    helpers.startQuestionAt(game, nextIdx);
    helpers.scheduleSave();
    helpers.broadcastRoom(game.code);
    return true;
  }

  // Validate team readiness before starting any game with configurable teamMode
  if (action === 'start_game' && Boolean(game.config.teamMode)) {
    const pList = Object.values(game.participants);
    if (pList.length < 2) {
      helpers.sendWsError(
        'Se necesitan al menos 2 participantes para iniciar la competencia por equipos.'
      );
      return true;
    }
    const activeTeams = new Set(pList.map((p) => p.teamId).filter(Boolean));
    if (activeTeams.size < 2) {
      helpers.sendWsError(
        'Debe haber participantes en al menos 2 equipos distintos para iniciar.'
      );
      return true;
    }
  }

  // 4. Retos Bíblicos Multiplayer Controls
  if (isRetoCompetitionMode(game.config.mode) && game.retoInternal) {
    const internal = game.retoInternal;
    if (action === 'start_game' || action === 'next_question') {
      const nextIdx = action === 'start_game' ? 0 : internal.currentIndex + 1;
      if (nextIdx >= internal.challengeIds.length) {
        helpers.finishGame(game);
      } else {
        internal.currentIndex = nextIdx;
        helpers.startQuestionAt(game, nextIdx);
      }
      helpers.scheduleSave();
      helpers.broadcastRoom(game.code);
      return true;
    }
    if (action === 'reveal_answer') {
      if (game.status === 'question_active' || game.status === 'question_locked') {
        game.status = 'answer_revealed';
        helpers.scheduleSave();
        helpers.broadcastRoom(game.code);
      }
      return true;
    }
  }

  // 5. Aprende con la Biblia Multiplayer Controls
  if (game.config.mode === 'aprende_biblia' && game.learningInternal) {
    const internal = game.learningInternal;
    if (action === 'start_game' || action === 'next_question') {
      const nextIdx = action === 'start_game' ? 0 : internal.currentIndex + 1;
      if (nextIdx >= internal.cardIds.length) {
        helpers.finishGame(game);
      } else {
        internal.currentIndex = nextIdx;
        helpers.startQuestionAt(game, nextIdx);
      }
      helpers.scheduleSave();
      helpers.broadcastRoom(game.code);
      return true;
    }
    if (action === 'reveal_answer') {
      if (game.status === 'question_active' || game.status === 'question_locked') {
        game.status = 'answer_revealed';
        helpers.scheduleSave();
        helpers.broadcastRoom(game.code);
      }
      return true;
    }
    if (action === 'toggle_explanation_timing') {
      const nextTiming =
        internal.explanationTiming === 'after_each' ? 'end_of_round' : 'after_each';
      internal.explanationTiming = nextTiming;
      game.config.explanationTiming = nextTiming;
      helpers.scheduleSave();
      helpers.broadcastRoom(game.code);
      return true;
    }
  }

  // 6. Clean reset_game for expansion modes (classic modes keep server.ts reset_game)
  if (
    action === 'reset_game' &&
    (game.config.mode === 'ruleta_biblica' ||
      game.config.mode === 'quien_soy' ||
      game.config.mode === 'misterio_biblico' ||
      game.config.mode === 'campeonato_rondas' ||
      isRetoCompetitionMode(game.config.mode) ||
      game.config.mode === 'aprende_biblia')
  ) {
    game.status = 'waiting';
    game.previousStatusBeforePause = undefined;
    game.pausedRemainingMs = undefined;
    game.currentQuestionIndex = -1;
    game.questionLockReason = undefined;
    game.questionStartedAt = null;
    game.questionEndsAt = null;
    game.answers = {};
    game.evaluatedEliminations = [];
    game.finishedAt = null;
    for (const p of Object.values(game.participants)) {
      p.score = 0;
      p.correctCount = 0;
      p.answeredCount = 0;
      p.streak = 0;
      p.mistakes = 0;
      p.eliminated = false;
      p.totalResponseMs = 0;
    }
    if (game.config.mode === 'campeonato_rondas') {
      game.questions = helpers.selectQuestions(game.config);
    }
    initExpansionStateForGame(game, {
      questionCount: game.config.questionCount,
      explanationTiming: game.config.explanationTiming,
      studyTopicId: game.config.studyTopicId,
      questionsPerRound: game.championshipState?.questionsPerRound,
      advanceRound2Count: game.championshipState?.advanceRound2Count,
      advanceSemifinalCount: game.championshipState?.advanceSemifinalCount,
      advanceFinalCount: game.championshipState?.advanceFinalCount,
    });
    helpers.scheduleSave();
    helpers.broadcastRoom(game.code);
    return true;
  }

  return false;
}

export function handleExpansionSubmitMysteryGuess(
  game: ServerStoredGame,
  participant: ServerStoredParticipant,
  msg: Record<string, unknown>,
  helpers: ExpansionActionHelpers
): boolean {
  if (
    game.config.mode !== 'quien_soy' &&
    game.config.mode !== 'misterio_biblico'
  ) {
    return false;
  }
  const internal = game.mysteryInternal;
  if (!internal || game.status !== 'question_active') return true;
  if (internal.guessedInCurrentItem[participant.id]) return true;

  const source = internal.kind === 'quien_soy' ? WHO_AM_I_ITEMS : BIBLE_MYSTERY_ITEMS;
  const item = source.find((x) => x.id === internal.itemIds[internal.currentItemIndex]);
  if (!item) return true;

  const selectedIndex =
    typeof msg.selectedIndex === 'number' ? Number(msg.selectedIndex) : -1;
  const typedAnswer =
    typeof msg.typedAnswer === 'string' ? normalizeText(msg.typedAnswer) : '';

  let isCorrect = false;
  if (selectedIndex >= 0 && selectedIndex < item.options.length) {
    isCorrect = selectedIndex === item.correctOptionIndex;
  } else if (typedAnswer.length >= 2) {
    isCorrect = item.acceptedAliases.some(
      (al) => normalizeText(al) === typedAnswer
    );
  } else {
    return true;
  }

  internal.guessedInCurrentItem[participant.id] = true;
  participant.answeredCount += 1;

  const startedAt = game.questionStartedAt || Date.now();
  const elapsedMs = Math.max(0, Date.now() - startedAt);
  participant.totalResponseMs += elapsedMs;

  if (isCorrect) {
    const pts = getMysteryPointsForClueCount(internal.revealedClueCount);
    participant.score += pts;
    participant.correctCount += 1;
    participant.streak += 1;
    internal.itemSolvedBy.push({
      participantId: participant.id,
      name: participant.name,
      points: pts,
      clueNumber: internal.revealedClueCount,
    });
  } else {
    participant.streak = 0;
  }

  // Record answer entry so round stats remain populated
  const qIdx = game.currentQuestionIndex;
  if (!game.answers[qIdx]) game.answers[qIdx] = {};
  game.answers[qIdx][participant.id] = {
    participantId: participant.id,
    selectedIndex: selectedIndex >= 0 ? selectedIndex : isCorrect ? item.correctOptionIndex : 0,
    isCorrect,
    pointsEarned: isCorrect
      ? getMysteryPointsForClueCount(internal.revealedClueCount)
      : 0,
    responseTimeMs: elapsedMs,
    submittedAt: Date.now(),
  };

  // Lock item when all online participants have answered
  const onlinePlayers = Object.values(game.participants).filter((p) => p.online);
  const allGuessed =
    onlinePlayers.length > 0 &&
    onlinePlayers.every((p) => Boolean(internal.guessedInCurrentItem[p.id]));
  if (allGuessed) {
    game.status = 'question_locked';
    game.questionLockReason = 'all_answered';
  }

  helpers.scheduleSave();
  helpers.broadcastRoom(game.code);
  return true;
}

export function handleExpansionSubmitRetoAttempt(
  game: ServerStoredGame,
  participant: ServerStoredParticipant,
  msg: Record<string, unknown>,
  helpers: ExpansionActionHelpers
): boolean {
  if (!isRetoCompetitionMode(game.config.mode) || !game.retoInternal) {
    return false;
  }
  const internal = game.retoInternal;
  const idx = internal.currentIndex;

  if (participant.eliminated) {
    helpers.sendWsError('Estás en modo espectador en esta partida.');
    return true;
  }

  if (
    game.status !== 'question_active' ||
    idx < 0 ||
    idx !== game.currentQuestionIndex
  ) {
    helpers.sendWsError('El tiempo para este desafío ha finalizado.');
    return true;
  }

  const now = Date.now();
  if (game.questionEndsAt && now > game.questionEndsAt + 600) {
    helpers.sendWsError('Tiempo agotado para este desafío.');
    return true;
  }

  const challengeIndex =
    typeof msg.challengeIndex === 'number' ? Number(msg.challengeIndex) : idx;
  if (challengeIndex !== idx) {
    helpers.sendWsError('El desafío enviado no corresponde a la ronda activa.');
    return true;
  }

  if (!internal.submissions[idx]) internal.submissions[idx] = {};
  if (internal.submissions[idx][participant.id]) {
    // Duplicate submission protection
    return true;
  }

  const challengeId = internal.challengeIds[idx];
  const startedAt = game.questionStartedAt || now;
  const totalMs = Math.max(1000, game.config.timeLimitSec * 1000);
  const elapsedMs = Math.max(0, Math.min(totalMs, now - startedAt));
  const speedRatio = Math.max(0, Math.min(1, 1 - elapsedMs / totalMs));

  let isCorrect = false;
  let accuracyPercent = 0;
  let pointsEarned = 0;
  let selectedIndex: number | undefined;
  let typedAnswer: string | undefined;
  let wordResults: RetoInternalSubmission['wordResults'];
  let pairResults: RetoInternalSubmission['pairResults'];

  if (internal.kind === 'crucigrama_biblico') {
    const cw = CROSSWORD_PUZZLES.find((c) => c.id === challengeId);
    if (!cw) return true;
    const gridAnswers =
      msg.grid && typeof msg.grid === 'object'
        ? (msg.grid as Record<string, string>)
        : {};
    wordResults = cw.words.map((w) => {
      let userWord = '';
      for (let i = 0; i < w.answer.length; i++) {
        const r = w.direction === 'H' ? w.row : w.row + i;
        const c = w.direction === 'H' ? w.col + i : w.col;
        const cellVal = normalizeLettersOnly(String(gridAnswers[`${r},${c}`] || ''));
        userWord += cellVal[0] || '_';
      }
      return {
        wordId: w.id,
        correct: userWord === w.answer,
        displayAnswer: w.displayAnswer,
        reference: w.reference,
      };
    });
    const correctWords = wordResults.filter((w) => w.correct).length;
    accuracyPercent = Math.round((correctWords / Math.max(1, cw.words.length)) * 100);
    isCorrect = cw.words.length > 0 && correctWords === cw.words.length;
    if (isCorrect) {
      pointsEarned =
        game.config.basePoints + Math.round(game.config.speedBonusMax * speedRatio);
    } else if (correctWords > 0) {
      pointsEarned = Math.round(
        game.config.basePoints * 0.65 * (correctWords / cw.words.length)
      );
    }
  } else if (internal.kind === 'palabras_desordenadas') {
    const sc = SCRAMBLE_CHALLENGES.find((s) => s.id === challengeId);
    if (!sc) return true;
    const answerRaw = String(msg.answer || '');
    typedAnswer = answerRaw.trim();
    const cleaned = normalizeLettersOnly(answerRaw);
    if (!cleaned) return true;
    isCorrect = cleaned === normalizeLettersOnly(sc.word);
    accuracyPercent = isCorrect ? 100 : 0;
    if (isCorrect) {
      pointsEarned =
        game.config.basePoints + Math.round(game.config.speedBonusMax * speedRatio);
    }
  } else if (internal.kind === 'completa_versiculo') {
    const cv = COMPLETE_VERSE_ITEMS.find((v) => v.id === challengeId);
    if (!cv) return true;
    const selIdx =
      typeof msg.selectedIndex === 'number' ? Number(msg.selectedIndex) : -1;
    const typed =
      typeof msg.typedAnswer === 'string' ? normalizeText(msg.typedAnswer) : '';
    if (selIdx >= 0 && selIdx < cv.options.length) {
      selectedIndex = selIdx;
      isCorrect = selIdx === cv.correctIndex;
    } else if (typed.length >= 2) {
      typedAnswer = String(msg.typedAnswer || '').trim();
      isCorrect = typed === normalizeText(cv.missingWord);
    } else {
      return true;
    }
    accuracyPercent = isCorrect ? 100 : 0;
    if (isCorrect) {
      pointsEarned =
        game.config.basePoints + Math.round(game.config.speedBonusMax * speedRatio);
    }
  } else if (internal.kind === 'rompecabezas_biblico') {
    const mp = MATCH_PUZZLES.find((m) => m.id === challengeId);
    if (!mp) return true;
    const pairings =
      msg.pairings && typeof msg.pairings === 'object'
        ? (msg.pairings as Record<string, string>)
        : {};
    pairResults = mp.pairs.map((p) => ({
      id: p.id,
      correct: String(pairings[p.id] || '').trim() === p.right.trim(),
      expectedRight: p.right,
      reference: p.reference,
    }));
    const correctPairs = pairResults.filter((r) => r.correct).length;
    accuracyPercent = Math.round((correctPairs / Math.max(1, mp.pairs.length)) * 100);
    isCorrect = mp.pairs.length > 0 && correctPairs === mp.pairs.length;
    if (isCorrect) {
      pointsEarned =
        game.config.basePoints + Math.round(game.config.speedBonusMax * speedRatio);
    } else if (correctPairs > 0) {
      pointsEarned = Math.round(
        game.config.basePoints * 0.65 * (correctPairs / mp.pairs.length)
      );
    }
  }

  participant.score += pointsEarned;
  participant.answeredCount += 1;
  participant.totalResponseMs += elapsedMs;
  if (isCorrect) {
    participant.correctCount += 1;
    participant.streak += 1;
  } else {
    participant.streak = 0;
  }

  internal.submissions[idx][participant.id] = {
    participantId: participant.id,
    isCorrect,
    accuracyPercent,
    pointsEarned,
    responseTimeMs: elapsedMs,
    submittedAt: now,
    ...(selectedIndex !== undefined ? { selectedIndex } : {}),
    ...(typedAnswer !== undefined ? { typedAnswer } : {}),
    ...(wordResults ? { wordResults } : {}),
    ...(pairResults ? { pairResults } : {}),
  };

  if (!game.answers[idx]) game.answers[idx] = {};
  game.answers[idx][participant.id] = {
    participantId: participant.id,
    selectedIndex: selectedIndex !== undefined ? selectedIndex : isCorrect ? 0 : 1,
    isCorrect,
    pointsEarned,
    responseTimeMs: elapsedMs,
    submittedAt: now,
  };

  const activeOnline = Object.values(game.participants).filter(
    (p) => p.online && !p.eliminated
  );
  const allSubmitted =
    activeOnline.length > 0 &&
    activeOnline.every((p) => Boolean(internal.submissions[idx][p.id]));
  if (allSubmitted) {
    game.status = 'question_locked';
    game.questionLockReason = 'all_answered';
  }

  helpers.scheduleSave();
  helpers.broadcastRoom(game.code);
  return true;
}

// ---------------- OUTCOME & ANALYTICS ENGINE ----------------

const MODE_LABELS: Record<string, string> = {
  clasico: 'Modo Clásico',
  eliminacion: 'Modo Eliminación',
  velocidad: 'Modo Velocidad',
  equipos: 'Modo Por Equipos',
  supervivencia: 'Supervivencia Bíblica',
  torneo: 'Modo Torneo',
  batalla_1v1: 'Batalla 1 contra 1',
  competencia_equipos: 'Competencia por Equipos',
  ruleta_biblica: 'Ruleta Bíblica',
  quien_soy: '¿Quién Soy?',
  misterio_biblico: 'Misterio Bíblico',
  campeonato_rondas: 'Campeonato por Rondas',
  crucigrama_biblico: 'Crucigramas Bíblicos',
  palabras_desordenadas: 'Palabras Desordenadas',
  completa_versiculo: 'Completa el Versículo',
  rompecabezas_biblico: 'Rompecabezas Bíblicos',
  aprende_biblia: 'Aprende con la Biblia',
};

export function recordExpansionMatchOutcome(
  slice: ExpansionDatabaseSlice,
  game: ServerStoredGame,
  leaderboard: LeaderboardEntry[],
  teamLeaderboard: TeamScoreEntry[]
): void {
  const uniqueKey = `${game.id}:${game.finishedAt || game.createdAt}`;
  if (slice.recordedGameIds.includes(uniqueKey)) {
    return;
  }
  slice.recordedGameIds.push(uniqueKey);
  if (slice.recordedGameIds.length > 500) {
    slice.recordedGameIds = slice.recordedGameIds.slice(-500);
  }

  const finishedAt = game.finishedAt || Date.now();
  const winnerScore = leaderboard[0]?.score ?? 0;
  const topTeamScore = teamLeaderboard[0]?.score ?? 0;
  const isTeamMode =
    game.config.mode === 'equipos' ||
    game.config.mode === 'competencia_equipos' ||
    Boolean(game.config.teamMode);

  // 1. Update Question Analytics across every asked question
  game.questions.forEach((q, qIdx) => {
    const answersMap = game.answers[qIdx];
    if (!answersMap || Object.keys(answersMap).length === 0) return;
    if (!slice.questionAnalytics[q.id]) {
      slice.questionAnalytics[q.id] = {
        questionId: q.id,
        prompt: q.prompt,
        category: q.category,
        difficulty: q.difficulty,
        attempts: 0,
        correctCount: 0,
      };
    }
    const qa = slice.questionAnalytics[q.id];
    for (const ans of Object.values(answersMap)) {
      qa.attempts += 1;
      if (ans.isCorrect) qa.correctCount += 1;
    }
  });

  // 2. Update Player Profiles (real stats, wins, streaks, hard correct count)
  const participantScoresForRecord: ModeMatchRecord['participantScores'] = [];

  for (const p of Object.values(game.participants)) {
    const pKey =
      p.profileKey && p.profileKey.trim().length >= 4
        ? p.profileKey.trim()
        : `name:${normalizeText(p.name)}`;
    const profile = getOrCreateProfile(slice, pKey, p.name, p.avatarId);

    const wonIndividual =
      leaderboard.length > 0 && p.score === winnerScore && p.score > 0;
    const isTie1v1 =
      game.config.mode === 'batalla_1v1' &&
      leaderboard.length >= 2 &&
      leaderboard[0].score === leaderboard[1].score;
    const wonSole1v1 = wonIndividual && !isTie1v1;

    const myTeamWon =
      isTeamMode &&
      Boolean(p.teamId) &&
      teamLeaderboard.some(
        (t) => t.teamId === p.teamId && t.score === topTeamScore && t.score > 0
      );

    profile.totalGamesPlayed += 1;
    if (wonSole1v1 || (game.config.mode !== 'batalla_1v1' && wonIndividual)) {
      profile.totalWins += 1;
    }
    if (game.config.mode === 'batalla_1v1' && wonSole1v1) {
      profile.wins1v1 += 1;
    }
    if (myTeamWon) {
      profile.teamWins += 1;
    }
    if (
      game.config.mode === 'torneo' ||
      game.config.mode === 'campeonato_rondas' ||
      Boolean(game.tournamentId)
    ) {
      profile.tournamentsPlayed += 1;
    }
    if (game.config.mode === 'ruleta_biblica') {
      profile.roulettePlayed += 1;
    }
    if (
      game.config.mode === 'quien_soy' ||
      game.config.mode === 'misterio_biblico'
    ) {
      profile.mysteryPlayed += 1;
    }

    profile.totalPoints += p.score;
    profile.totalCorrect += p.correctCount;
    profile.totalIncorrect += Math.max(0, p.answeredCount - p.correctCount);
    profile.bestScore = Math.max(profile.bestScore, p.score);

    // Inspect answers per question for max streak in game + hard difficulty count + category stats
    let runningStreak = 0;
    let bestInGame = 0;
    game.questions.forEach((q, qIdx) => {
      const ans = game.answers[qIdx]?.[p.id];
      if (!ans) return;
      if (!profile.categoryStatsMap[q.category]) {
        profile.categoryStatsMap[q.category] = { answered: 0, correct: 0 };
      }
      profile.categoryStatsMap[q.category].answered += 1;
      if (ans.isCorrect) {
        profile.categoryStatsMap[q.category].correct += 1;
        if (q.difficulty === 'dificil') {
          profile.hardCorrectCount += 1;
        }
        runningStreak += 1;
        if (runningStreak > bestInGame) bestInGame = runningStreak;
      } else {
        runningStreak = 0;
      }
    });
    profile.bestStreak = Math.max(profile.bestStreak, bestInGame, p.streak);
    profile.recentMatches.unshift({
      date: finishedAt,
      gameTitle: game.config.title,
      mode: game.config.mode,
      score: p.score,
      correctCount: p.correctCount,
      won: wonSole1v1 || (game.config.mode !== 'batalla_1v1' && wonIndividual),
    });
    profile.recentMatches = profile.recentMatches.slice(0, 30);
    profile.updatedAt = finishedAt;
    evaluateAchievements(profile);

    participantScoresForRecord.push({
      profileKey: pKey,
      name: p.name,
      avatarId: p.avatarId,
      score: p.score,
      correctCount: p.correctCount,
      answeredCount: p.answeredCount,
      won: wonSole1v1 || (game.config.mode !== 'batalla_1v1' && wonIndividual),
    });
  }

  // 3. Save mode match record for filtered General Ranking
  const teamScoresForRecord: ModeMatchRecord['teamScores'] = teamLeaderboard
    .filter((t) => t.memberCount > 0)
    .map((t) => ({
      teamName: t.name,
      color: t.color,
      score: t.score,
      won: t.score === topTeamScore && t.score > 0,
    }));

  slice.modeMatchRecords.unshift({
    id: uniqueKey,
    mode: game.config.mode,
    modeLabel: MODE_LABELS[game.config.mode] || game.config.mode,
    title: game.config.title,
    finishedAt,
    participantScores: participantScoresForRecord,
    teamScores: teamScoresForRecord,
  });
  slice.modeMatchRecords = slice.modeMatchRecords.slice(0, 300);

  // 4. If linked to a Church Tournament round, propagate real scores to the tournament!
  if (game.tournamentId && slice.tournaments[game.tournamentId]) {
    const t = slice.tournaments[game.tournamentId];
    const orgPointsDelta: Record<string, number> = {};
    for (const p of Object.values(game.participants)) {
      const tPart = t.participants.find(
        (tp) =>
          tp.name.trim().toLowerCase() === p.name.trim().toLowerCase() ||
          (p.profileKey && tp.profileKey === p.profileKey)
      );
      if (tPart) {
        tPart.score += p.score;
        tPart.correctCount += p.correctCount;
        orgPointsDelta[tPart.orgId] = (orgPointsDelta[tPart.orgId] || 0) + p.score;
        if (tPart.teamId) {
          const team = t.teams.find((tm) => tm.id === tPart.teamId);
          if (team) {
            team.points += p.score;
            team.correctCount += p.correctCount;
          }
        }
      }
    }
    for (const [orgId, pts] of Object.entries(orgPointsDelta)) {
      const org = t.organizations.find((o) => o.id === orgId);
      if (org) {
        org.points += pts;
        org.matchesPlayed += 1;
      }
    }
    if (game.tournamentRoundId) {
      const round = t.rounds.find((r) => r.id === game.tournamentRoundId);
      if (round) {
        round.status = 'finished';
        round.finishedAt = finishedAt;
        round.orgScores = Object.entries(orgPointsDelta).map(([orgId, points]) => ({
          orgId,
          orgName: t.organizations.find((o) => o.id === orgId)?.name || 'Equipo',
          points,
        }));
      }
    }
  }
}

// ---------------- TOURNAMENT HELPERS ----------------

function computeTournamentSig(secret: string, id: string, code: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`torneo:${id}:${code}`)
    .digest('hex')
    .slice(0, 10);
}

function verifyTournamentSig(
  secret: string,
  t: ChurchTournament,
  sig: string
): boolean {
  const expected = computeTournamentSig(secret, t.id, t.code);
  const a = Buffer.from(expected, 'utf-8');
  const b = Buffer.from(sig.trim(), 'utf-8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------------- SOLO ROULETTE SESSION TRACKER ----------------

const soloRouletteSpins = new Map<
  string,
  {
    profileKey: string;
    questionId: string;
    correctIndex: number;
    category: string;
    difficulty: Difficulty;
    slotLabel: string;
    answered: boolean;
  }
>();

// ---------------- REGISTER ALL REST ENDPOINTS ----------------

export interface ExpansionRouteDeps {
  getDb: () => {
    serverSecret: string;
    customQuestions: BibleQuestion[];
    games: Record<string, ServerStoredGame>;
    archivedGames: Record<string, ServerStoredGame>;
    expansion: ExpansionDatabaseSlice;
  };
  allQuestionsBank: () => BibleQuestion[];
  resolvePublicOriginInfo: (
    req: express.Request,
    bypassCache?: boolean
  ) => Promise<{ origin: string | null; reason: string; detectedHost: string }>;
  scheduleSave: () => void;
}

export function registerExpansionRoutes(
  app: express.Express,
  deps: ExpansionRouteDeps
): void {
  // 1. RETOS BÍBLICOS (GET + Server Verification POST)
  app.get('/api/expansion/retos', (_req, res) => {
    res.json({
      crosswords: CROSSWORD_PUZZLES.map((cw) => ({
        ...cw,
        // Never leak letters into initial puzzle payload if you want strict mode;
        // actually crossword needs grid structure & word lengths + clues, so strip answers from client!
        words: cw.words.map((w) => ({
          id: w.id,
          number: w.number,
          direction: w.direction,
          row: w.row,
          col: w.col,
          length: w.answer.length,
          clue: w.clue,
          reference: w.reference,
        })),
      })),
      scrambles: SCRAMBLE_CHALLENGES.map((s) => ({
        id: s.id,
        scrambledLetters: shuffleArr(s.word.split('')).join(''),
        wordLength: s.word.length,
        category: s.category,
        difficulty: s.difficulty,
        hint: s.hint,
        reference: s.reference,
      })),
      verses: COMPLETE_VERSE_ITEMS.map((v) => ({
        id: v.id,
        verseBefore: v.verseBefore,
        verseAfter: v.verseAfter,
        options: v.options,
        reference: v.reference,
        difficulty: v.difficulty,
      })),
      matches: MATCH_PUZZLES.map((m) => ({
        id: m.id,
        title: m.title,
        kind: m.kind,
        difficulty: m.difficulty,
        description: m.description,
        leftItems: m.pairs.map((p) => ({ id: p.id, label: p.left })),
        rightItems: shuffleArr(m.pairs.map((p) => ({ right: p.right, reference: p.reference }))),
      })),
    });
  });

  app.post('/api/expansion/retos/verify', (req, res) => {
    const { expansion } = deps.getDb();
    const body = req.body || {};
    const profileKey = String(body.profileKey || '').trim() || 'guest-local';
    const kind = String(body.kind || '');
    const challengeId = String(body.challengeId || '');

    const profile = getOrCreateProfile(
      expansion,
      profileKey,
      typeof body.displayName === 'string' ? body.displayName : undefined
    );

    let passed = false;
    let pointsAwarded = 0;
    let feedback: Record<string, unknown> = {};

    if (kind === 'crossword') {
      const cw = CROSSWORD_PUZZLES.find((c) => c.id === challengeId);
      if (!cw) {
        res.status(404).json({ error: 'Crucigrama no encontrado.' });
        return;
      }
      const gridAnswers =
        body.grid && typeof body.grid === 'object'
          ? (body.grid as Record<string, string>)
          : {};
      const wordResults = cw.words.map((w) => {
        let userWord = '';
        for (let i = 0; i < w.answer.length; i++) {
          const r = w.direction === 'H' ? w.row : w.row + i;
          const c = w.direction === 'H' ? w.col + i : w.col;
          const cellVal = normalizeLettersOnly(String(gridAnswers[`${r},${c}`] || ''));
          userWord += cellVal[0] || '_';
        }
        const ok = userWord === w.answer;
        return {
          wordId: w.id,
          number: w.number,
          direction: w.direction,
          correct: ok,
          displayAnswer: w.displayAnswer,
          reference: w.reference,
        };
      });
      const correctWords = wordResults.filter((r) => r.correct).length;
      passed = correctWords === cw.words.length;
      if (passed) {
        pointsAwarded =
          cw.difficulty === 'dificil'
            ? 800
            : cw.difficulty === 'intermedio'
              ? 600
              : 450;
      }
      feedback = { wordResults, correctWords, totalWords: cw.words.length };
    } else if (kind === 'scramble') {
      const sc = SCRAMBLE_CHALLENGES.find((s) => s.id === challengeId);
      if (!sc) {
        res.status(404).json({ error: 'Palabra no encontrada.' });
        return;
      }
      const userWord = normalizeLettersOnly(String(body.answer || ''));
      passed = userWord === sc.word;
      if (passed) {
        pointsAwarded =
          sc.difficulty === 'dificil'
            ? 350
            : sc.difficulty === 'intermedio'
              ? 250
              : 180;
      }
      feedback = {
        displayWord: sc.displayWord,
        reference: sc.reference,
      };
    } else if (kind === 'verse') {
      const cv = COMPLETE_VERSE_ITEMS.find((v) => v.id === challengeId);
      if (!cv) {
        res.status(404).json({ error: 'Versículo no encontrado.' });
        return;
      }
      const selectedIdx = Number(body.selectedIndex);
      passed = selectedIdx === cv.correctIndex;
      if (passed) {
        pointsAwarded =
          cv.difficulty === 'dificil'
            ? 300
            : cv.difficulty === 'intermedio'
              ? 220
              : 150;
      }
      feedback = {
        correctIndex: cv.correctIndex,
        missingWord: cv.missingWord,
        reference: cv.reference,
        explanation: cv.explanation,
      };
    } else if (kind === 'match') {
      const mp = MATCH_PUZZLES.find((m) => m.id === challengeId);
      if (!mp) {
        res.status(404).json({ error: 'Rompecabezas no encontrado.' });
        return;
      }
      const pairings =
        body.pairings && typeof body.pairings === 'object'
          ? (body.pairings as Record<string, string>)
          : {};
      const pairResults = mp.pairs.map((p) => ({
        id: p.id,
        left: p.left,
        expectedRight: p.right,
        reference: p.reference,
        correct: normalizeText(String(pairings[p.id] || '')) === normalizeText(p.right),
      }));
      const correctCount = pairResults.filter((r) => r.correct).length;
      passed = correctCount === mp.pairs.length;
      if (passed) {
        pointsAwarded =
          mp.difficulty === 'dificil'
            ? 500
            : mp.difficulty === 'intermedio'
              ? 380
              : 280;
      }
      feedback = { pairResults, correctCount, totalPairs: mp.pairs.length };
    } else {
      res.status(400).json({ error: 'Tipo de reto inválido.' });
      return;
    }

    const retoKey = `${kind}:${challengeId}`;
    let firstTimeCompleted = false;
    if (passed && !profile.completedRetoIds.includes(retoKey)) {
      profile.completedRetoIds.push(retoKey);
      profile.retosCompleted += 1;
      profile.totalPoints += pointsAwarded;
      profile.totalCorrect += 1;
      firstTimeCompleted = true;
    } else if (passed) {
      pointsAwarded = 0; // Already credited previously; prevent farming same puzzle
    } else {
      profile.totalIncorrect += 1;
    }

    profile.updatedAt = Date.now();
    const badges = evaluateAchievements(profile);
    deps.scheduleSave();

    res.json({
      passed,
      pointsAwarded,
      firstTimeCompleted,
      feedback,
      retosCompleted: profile.retosCompleted,
      completedRetoIds: profile.completedRetoIds,
      unlockedAchievementIds: badges.filter((b) => b.unlocked).map((b) => b.id),
    });
  });

  // 2. APRENDE CON LA BIBLIA (Topics + Untimed Study Cards + Incorrect Repetition)
  app.get('/api/expansion/learning', (req, res) => {
    const { expansion } = deps.getDb();
    const profileKey = String(req.query.profileKey || '').trim() || 'guest-local';
    const progress: LearningProgressData = expansion.learningProgress[profileKey] || {
      profileKey,
      studiedTopicIds: [],
      answeredCardIds: [],
      correctCardIds: [],
      incorrectQueueIds: [],
      totalPracticed: 0,
      updatedAt: Date.now(),
    };

    res.json({
      topics: STUDY_TOPICS,
      cards: LEARNING_STUDY_CARDS.map((c) => ({
        id: c.id,
        topicId: c.topicId,
        topicLabel: c.topicLabel,
        bookOrSection: c.bookOrSection,
        chapterRef: c.chapterRef,
        difficulty: c.difficulty,
        prompt: c.prompt,
        options: c.options,
      })),
      progress,
    });
  });

  app.post('/api/expansion/learning/answer', (req, res) => {
    const { expansion } = deps.getDb();
    const body = req.body || {};
    const profileKey = String(body.profileKey || '').trim() || 'guest-local';
    const cardId = String(body.cardId || '');
    const selectedIndex = Number(body.selectedIndex);

    const card = LEARNING_STUDY_CARDS.find((c) => c.id === cardId);
    if (!card) {
      res.status(404).json({ error: 'Tarjeta de estudio no encontrada.' });
      return;
    }

    if (!expansion.learningProgress[profileKey]) {
      expansion.learningProgress[profileKey] = {
        profileKey,
        studiedTopicIds: [],
        answeredCardIds: [],
        correctCardIds: [],
        incorrectQueueIds: [],
        totalPracticed: 0,
        updatedAt: Date.now(),
      };
    }

    const prog = expansion.learningProgress[profileKey];
    const isCorrect = selectedIndex === card.correctIndex;
    prog.totalPracticed += 1;
    prog.updatedAt = Date.now();

    if (!prog.studiedTopicIds.includes(card.topicId)) {
      prog.studiedTopicIds.push(card.topicId);
    }
    if (!prog.answeredCardIds.includes(card.id)) {
      prog.answeredCardIds.push(card.id);
    }

    if (isCorrect) {
      if (!prog.correctCardIds.includes(card.id)) {
        prog.correctCardIds.push(card.id);
      }
      prog.incorrectQueueIds = prog.incorrectQueueIds.filter((id) => id !== card.id);
    } else if (!prog.incorrectQueueIds.includes(card.id)) {
      prog.incorrectQueueIds.push(card.id);
    }

    deps.scheduleSave();

    res.json({
      isCorrect,
      correctIndex: card.correctIndex,
      correctOptionText: card.options[card.correctIndex],
      reference: card.reference,
      simpleExplanation: card.simpleExplanation,
      context: card.context,
      mainTeaching: card.mainTeaching,
      complementaryQuestion: card.complementaryQuestion || null,
      progress: prog,
    });
  });

  // 3. MI TRAYECTORIA & PROFILES (Read-Only Server Evaluation)
  app.get('/api/expansion/trajectory/:profileKey', (req, res) => {
    const { expansion } = deps.getDb();
    const key = String(req.params.profileKey || '').trim() || 'guest-local';
    const profile = getOrCreateProfile(expansion, key);
    res.json({ profile: buildPublicTrajectory(profile) });
  });

  app.get('/api/expansion/profiles', (_req, res) => {
    const { expansion } = deps.getDb();
    const list = Object.values(expansion.playerProfiles)
      .filter((p) => p.totalGamesPlayed > 0 || p.retosCompleted > 0 || p.totalPoints > 0)
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, 40)
      .map((p) => ({
        profileKey: p.profileKey,
        displayName: p.displayName,
        avatarId: p.avatarId,
        totalPoints: p.totalPoints,
        totalGamesPlayed: p.totalGamesPlayed,
        totalWins: p.totalWins,
      }));
    res.json({ profiles: list });
  });

  // 4. SOLO RULETA BÍBLICA
  app.post('/api/expansion/roulette/solo-spin', (req, res) => {
    const body = req.body || {};
    const profileKey = String(body.profileKey || '').trim() || 'guest-local';
    const usedQuestionIds: string[] = Array.isArray(body.usedQuestionIds)
      ? body.usedQuestionIds.map((x: unknown) => String(x))
      : [];

    const slotIdx = Math.floor(Math.random() * ROULETTE_CATEGORIES.length);
    const slot = ROULETTE_CATEGORIES[slotIdx];
    const picked = pickRouletteQuestion(
      deps.allQuestionsBank(),
      slot.id,
      usedQuestionIds
    );
    if (!picked) {
      res.status(400).json({ error: 'Ya respondiste todas las preguntas disponibles en esta sesión.' });
      return;
    }

    const spinId = `rspin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    // Shuffle options cleanly for solo spin
    const tagged = picked.options.map((text, idx) => ({
      text,
      isCorrect: idx === picked.correctIndex,
    }));
    const shuffled = picked.options.length > 2 ? shuffleArr(tagged) : tagged;
    const options = shuffled.map((t) => t.text);
    const correctIndex = shuffled.findIndex((t) => t.isCorrect);

    soloRouletteSpins.set(spinId, {
      profileKey,
      questionId: picked.id,
      correctIndex,
      category: picked.category,
      difficulty: picked.difficulty,
      slotLabel: slot.label,
      answered: false,
    });

    res.json({
      spinId,
      slotIndex: slotIdx,
      slot,
      question: {
        id: picked.id,
        category: picked.category,
        difficulty: picked.difficulty,
        prompt: picked.prompt,
        options,
      },
    });
  });

  app.post('/api/expansion/roulette/solo-answer', (req, res) => {
    const { expansion } = deps.getDb();
    const body = req.body || {};
    const spinId = String(body.spinId || '');
    const selectedIndex = Number(body.selectedIndex);
    const session = soloRouletteSpins.get(spinId);
    if (!session || session.answered) {
      res.status(400).json({ error: 'Turno de ruleta inválido o ya respondido.' });
      return;
    }
    session.answered = true;

    const origQ = deps
      .allQuestionsBank()
      .find((q) => q.id === session.questionId);
    const isCorrect = selectedIndex === session.correctIndex;
    const pointsEarned = isCorrect
      ? session.difficulty === 'dificil'
        ? 1200
        : session.difficulty === 'intermedio'
          ? 1000
          : 800
      : 0;

    const profile = getOrCreateProfile(expansion, session.profileKey);
    profile.roulettePlayed += 1;
    profile.totalPoints += pointsEarned;
    if (isCorrect) {
      profile.totalCorrect += 1;
      if (session.difficulty === 'dificil') profile.hardCorrectCount += 1;
    } else {
      profile.totalIncorrect += 1;
    }
    if (!profile.categoryStatsMap[session.category]) {
      profile.categoryStatsMap[session.category] = { answered: 0, correct: 0 };
    }
    profile.categoryStatsMap[session.category].answered += 1;
    if (isCorrect) profile.categoryStatsMap[session.category].correct += 1;
    profile.updatedAt = Date.now();
    evaluateAchievements(profile);
    deps.scheduleSave();

    res.json({
      isCorrect,
      correctIndex: session.correctIndex,
      pointsEarned,
      reference: origQ?.reference || '',
      explanation: origQ?.explanation || '',
    });
  });

  // 5. SOLO ¿QUIÉN SOY? & MISTERIO BÍBLICO
  app.get('/api/expansion/mystery/solo', (req, res) => {
    const kind =
      req.query.kind === 'misterio_biblico' ? 'misterio_biblico' : 'quien_soy';
    const source = kind === 'quien_soy' ? WHO_AM_I_ITEMS : BIBLE_MYSTERY_ITEMS;
    res.json({
      items: shuffleArr(source).map((item) => ({
        id: item.id,
        kind: item.kind,
        title: item.title,
        clues: item.clues,
        options: item.options,
        difficulty: item.difficulty,
        avatarId: item.avatarId,
      })),
    });
  });

  app.post('/api/expansion/mystery/solo-guess', (req, res) => {
    const { expansion } = deps.getDb();
    const body = req.body || {};
    const profileKey = String(body.profileKey || '').trim() || 'guest-local';
    const itemId = String(body.itemId || '');
    const revealedClueCount = Math.max(1, Number(body.revealedClueCount) || 1);
    const selectedIndex =
      typeof body.selectedIndex === 'number' ? Number(body.selectedIndex) : -1;
    const typedAnswer =
      typeof body.typedAnswer === 'string' ? normalizeText(body.typedAnswer) : '';

    const item = [...WHO_AM_I_ITEMS, ...BIBLE_MYSTERY_ITEMS].find(
      (i) => i.id === itemId
    );
    if (!item) {
      res.status(404).json({ error: 'Desafío no encontrado.' });
      return;
    }

    let isCorrect = false;
    if (selectedIndex >= 0 && selectedIndex < item.options.length) {
      isCorrect = selectedIndex === item.correctOptionIndex;
    } else if (typedAnswer.length >= 2) {
      isCorrect = item.acceptedAliases.some(
        (al) => normalizeText(al) === typedAnswer
      );
    }

    const pointsEarned = isCorrect
      ? getMysteryPointsForClueCount(revealedClueCount)
      : 0;

    const profile = getOrCreateProfile(expansion, profileKey);
    profile.mysteryPlayed += 1;
    profile.totalPoints += pointsEarned;
    if (isCorrect) {
      profile.totalCorrect += 1;
      if (item.difficulty === 'dificil') profile.hardCorrectCount += 1;
    } else {
      profile.totalIncorrect += 1;
    }
    profile.updatedAt = Date.now();
    evaluateAchievements(profile);
    deps.scheduleSave();

    res.json({
      isCorrect,
      pointsEarned,
      answer: item.answer,
      correctOptionIndex: item.correctOptionIndex,
      reference: item.reference,
      explanation: item.explanation,
    });
  });

  // 6. GRANDES TORNEOS (IGLESIAS, DISTRITOS, CONGREGACIONES, GRUPOS JUVENILES)
  app.get('/api/expansion/tournaments', (_req, res) => {
    const { expansion } = deps.getDb();
    const list = Object.values(expansion.tournaments).sort(
      (a, b) => b.createdAt - a.createdAt
    );
    res.json({ tournaments: list });
  });

  app.post('/api/expansion/tournaments', async (req, res) => {
    const dbRef = deps.getDb();
    const { expansion, serverSecret } = dbRef;
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const description = String(body.description || '').trim();
    const entityKind = (String(body.entityKind || 'Iglesia') as TournamentEntityKind);
    const scheduledAt = String(body.scheduledAt || '').trim();
    const rulesSummary = String(body.rulesSummary || '').trim() || 'Rondas clasificatorias, semifinales y Gran Final en vivo.';
    const totalRounds = Math.max(2, Math.min(8, Number(body.totalRounds) || 3));
    const orgInputs: unknown[] = Array.isArray(body.organizations)
      ? (body.organizations as unknown[])
      : [];

    if (name.length < 3) {
      res.status(400).json({ error: 'Escribe un nombre válido para el torneo (mínimo 3 caracteres).' });
      return;
    }
    if (orgInputs.length < 2) {
      res.status(400).json({ error: 'Agrega al menos 2 iglesias, distritos o equipos para competir.' });
      return;
    }

    const id = `TOR-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const code = `TORNEO${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const inviteSignature = computeTournamentSig(serverSecret, id, code);
    const palette = ['#F59E0B', '#0EA5E9', '#10B981', '#EC4899', '#A855F7', '#EF4444'];

    const organizations: TournamentOrganization[] = orgInputs
      .map((o: unknown, idx: number): TournamentOrganization => {
        const rec = (o && typeof o === 'object' ? o : {}) as Record<string, unknown>;
        const orgName = String(rec.name || `Delegación ${idx + 1}`).trim();
        return {
          id: `org-${idx + 1}-${crypto.randomBytes(2).toString('hex')}`,
          name: orgName,
          kind: (String(rec.kind || entityKind) as TournamentEntityKind),
          color: String(rec.color || palette[idx % palette.length]),
          points: 0,
          wins: 0,
          matchesPlayed: 0,
        };
      })
      .filter((o: TournamentOrganization) => o.name.length > 0);

    const teams: TournamentTeamEntry[] = organizations.map((org) => ({
      id: `tm-${org.id}`,
      name: `Equipo ${org.name}`,
      orgId: org.id,
      color: org.color,
      points: 0,
      correctCount: 0,
      memberIds: [],
    }));

    const tournament: ChurchTournament = {
      id,
      code,
      inviteSignature,
      name,
      description,
      entityKind,
      scheduledAt: scheduledAt || new Date().toISOString().slice(0, 16).replace('T', ' '),
      rulesSummary,
      totalRounds,
      currentStage: 'Inscripción',
      status: 'open',
      organizations,
      teams,
      participants: [],
      rounds: [],
      createdAt: Date.now(),
      finishedAt: null,
    };

    expansion.tournaments[id] = tournament;
    deps.scheduleSave();

    const pub = await deps.resolvePublicOriginInfo(req);
    const inviteUrl = pub.origin
      ? `${pub.origin}/torneo/${encodeURIComponent(id)}?s=${encodeURIComponent(inviteSignature)}`
      : null;

    res.status(201).json({ tournament, inviteUrl, hasPublicUrl: Boolean(pub.origin) });
  });

  app.get('/api/expansion/tournaments/:id', (req, res) => {
    const { expansion } = deps.getDb();
    const id = String(req.params.id || '').trim().toUpperCase();
    const t =
      expansion.tournaments[id] ||
      Object.values(expansion.tournaments).find((x) => x.code === id);
    if (!t) {
      res.status(404).json({ error: 'Torneo no encontrado.' });
      return;
    }
    res.json({ tournament: t });
  });

  app.get('/api/expansion/tournaments/:id/invite-info', async (req, res) => {
    const { expansion } = deps.getDb();
    const id = String(req.params.id || '').trim().toUpperCase();
    const t =
      expansion.tournaments[id] ||
      Object.values(expansion.tournaments).find((x) => x.code === id);
    if (!t) {
      res.status(404).json({ error: 'Torneo no encontrado.' });
      return;
    }
    const bypassCache = req.query.refresh === '1';
    const pub = await deps.resolvePublicOriginInfo(req, bypassCache);
    const inviteUrl = pub.origin
      ? `${pub.origin}/torneo/${encodeURIComponent(t.id)}?s=${encodeURIComponent(t.inviteSignature)}`
      : null;
    res.json({
      gameId: t.id,
      code: t.code,
      title: t.name,
      status: t.status,
      signature: t.inviteSignature,
      hasPublicUrl: Boolean(pub.origin),
      publicOrigin: pub.origin,
      publicUrlReason: pub.reason,
      detectedHost: pub.detectedHost,
      inviteUrl,
      projectorUrl: pub.origin ? `${pub.origin}/torneo/${encodeURIComponent(t.id)}?s=${encodeURIComponent(t.inviteSignature)}` : '',
    });
  });

  app.get('/api/expansion/tournaments/:id/validate', (req, res) => {
    const { expansion, serverSecret } = deps.getDb();
    const id = String(req.params.id || '').trim().toUpperCase();
    const sig = String(req.query.s || '').trim();
    const t =
      expansion.tournaments[id] ||
      Object.values(expansion.tournaments).find((x) => x.code === id);
    if (!t) {
      res.status(404).json({ error: 'Torneo no encontrado.' });
      return;
    }
    if (sig && !verifyTournamentSig(serverSecret, t, sig)) {
      res.status(403).json({ error: 'Firma de invitación de torneo no válida.' });
      return;
    }
    res.json({ tournament: t });
  });

  app.post('/api/expansion/tournaments/:id/join', (req, res) => {
    const { expansion } = deps.getDb();
    const id = String(req.params.id || '').trim().toUpperCase();
    const t =
      expansion.tournaments[id] ||
      Object.values(expansion.tournaments).find((x) => x.code === id);
    if (!t) {
      res.status(404).json({ error: 'Torneo no encontrado.' });
      return;
    }
    if (t.status === 'finished') {
      res.status(400).json({ error: 'Este torneo ya finalizó.' });
      return;
    }

    const body = req.body || {};
    const name = String(body.name || '').trim();
    const avatarId = String(body.avatarId || 'crown').trim();
    const orgId = String(body.orgId || t.organizations[0]?.id || '');
    const profileKey = String(body.profileKey || '').trim() || undefined;

    if (name.length < 2 || name.length > 32) {
      res.status(400).json({ error: 'Escribe tu nombre (entre 2 y 32 caracteres).' });
      return;
    }
    const org = t.organizations.find((o) => o.id === orgId) || t.organizations[0];
    if (!org) {
      res.status(400).json({ error: 'Selecciona una iglesia o equipo válido.' });
      return;
    }

    const duplicate = t.participants.some(
      (p) => p.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      res.status(409).json({ error: `El participante "${name}" ya está inscrito en este torneo.` });
      return;
    }

    const pid = `tp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const team = t.teams.find((tm) => tm.orgId === org.id);
    if (team) team.memberIds.push(pid);

    t.participants.push({
      id: pid,
      name,
      avatarId,
      orgId: org.id,
      teamId: team?.id,
      profileKey,
      score: 0,
      correctCount: 0,
      joinedAt: Date.now(),
    });

    if (profileKey) {
      const profile = getOrCreateProfile(expansion, profileKey, name, avatarId);
      profile.tournamentsPlayed += 1;
      evaluateAchievements(profile);
    }

    deps.scheduleSave();
    res.status(201).json({ tournament: t, participantId: pid });
  });

  app.post('/api/expansion/tournaments/:id/round', (req, res) => {
    const { expansion } = deps.getDb();
    const id = String(req.params.id || '').trim().toUpperCase();
    const t =
      expansion.tournaments[id] ||
      Object.values(expansion.tournaments).find((x) => x.code === id);
    if (!t) {
      res.status(404).json({ error: 'Torneo no encontrado.' });
      return;
    }

    const body = req.body || {};
    const action = String(body.action || 'create_round');

    if (action === 'record_round_scores') {
      const roundId = String(body.roundId || '');
      const round = t.rounds.find((r) => r.id === roundId);
      if (!round) {
        res.status(404).json({ error: 'Ronda no encontrada.' });
        return;
      }
      const orgScoresInput: Array<{ orgId: string; points: number }> = Array.isArray(
        body.orgScores
      )
        ? body.orgScores
        : [];
      const resultRows: Array<{ orgId: string; orgName: string; points: number }> = [];
      let topPts = -1;
      let winnerOrgId = '';
      for (const entry of orgScoresInput) {
        const org = t.organizations.find((o) => o.id === entry.orgId);
        if (!org) continue;
        const pts = Math.max(0, Number(entry.points) || 0);
        org.points += pts;
        org.matchesPlayed += 1;
        const team = t.teams.find((tm) => tm.orgId === org.id);
        if (team) team.points += pts;
        if (pts > topPts) {
          topPts = pts;
          winnerOrgId = org.id;
        }
        resultRows.push({ orgId: org.id, orgName: org.name, points: pts });
      }
      if (winnerOrgId && topPts > 0) {
        const winOrg = t.organizations.find((o) => o.id === winnerOrgId);
        if (winOrg) winOrg.wins += 1;
      }
      round.status = 'finished';
      round.finishedAt = Date.now();
      round.orgScores = resultRows;
      deps.scheduleSave();
      res.json({ tournament: t });
      return;
    }

    if (action === 'finish_tournament') {
      t.status = 'finished';
      t.currentStage = 'Finalizado';
      t.finishedAt = Date.now();
      const sortedOrgs = [...t.organizations].sort((a, b) => b.points - a.points);
      if (sortedOrgs[0] && sortedOrgs[0].wins === 0 && sortedOrgs[0].points > 0) {
        sortedOrgs[0].wins += 1;
      }
      deps.scheduleSave();
      res.json({ tournament: t });
      return;
    }

    // Create new round (Clasificatoria -> Semifinal -> Gran Final)
    const stage = (String(body.stage || 'Clasificatoria') as TournamentMatchRound['stage']);
    const title =
      String(body.title || '').trim() ||
      `${stage} #${t.rounds.length + 1}`;
    const gameCode = String(body.gameCode || '').trim().toUpperCase() || undefined;

    const round: TournamentMatchRound = {
      id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      roundNumber: t.rounds.length + 1,
      stage,
      title,
      gameCode,
      status: 'active',
      orgScores: [],
      createdAt: Date.now(),
    };

    t.rounds.push(round);
    t.status = 'active';
    t.currentStage =
      stage === 'Gran Final'
        ? 'Gran Final'
        : stage === 'Semifinal'
          ? 'Semifinales'
          : 'Clasificatoria';

    deps.scheduleSave();
    res.status(201).json({ tournament: t, round });
  });

  // 7. ESTADÍSTICAS AVANZADAS (Presenter Analytics + Personal Stats)
  app.get('/api/expansion/stats', (req, res) => {
    const dbRef = deps.getDb();
    const { expansion, games, archivedGames } = dbRef;
    const allGames = [
      ...Object.values(games),
      ...Object.values(archivedGames),
    ];

    const finishedGames = allGames.filter((g) => g.status === 'finished');
    let totalParticipants = 0;
    let totalQuestionsAsked = 0;
    let totalResponseMsSum = 0;
    let totalResponseCount = 0;

    const catAgg: Record<string, { answered: number; correct: number }> = {};

    for (const g of allGames) {
      const parts = Object.values(g.participants);
      if (g.status === 'finished') {
        totalParticipants += parts.length;
        for (const p of parts) {
          totalResponseMsSum += p.totalResponseMs;
          totalResponseCount += p.answeredCount;
        }
      }
      g.questions.forEach((q, qIdx) => {
        const answers = g.answers[qIdx];
        if (!answers || Object.keys(answers).length === 0) return;
        totalQuestionsAsked += 1;
        if (!catAgg[q.category]) catAgg[q.category] = { answered: 0, correct: 0 };
        for (const a of Object.values(answers)) {
          catAgg[q.category].answered += 1;
          if (a.isCorrect) catAgg[q.category].correct += 1;
        }
      });
    }

    const qaList: PresenterQuestionAnalytics[] = Object.values(
      expansion.questionAnalytics
    )
      .filter((q) => q.attempts > 0)
      .map((q) => {
        const acc = Math.round((q.correctCount / q.attempts) * 100);
        return {
          questionId: q.questionId,
          prompt: q.prompt,
          category: q.category,
          difficulty: q.difficulty,
          attempts: q.attempts,
          correctCount: q.correctCount,
          accuracyPercent: acc,
          errorPercent: 100 - acc,
        };
      });

    const hardestQuestions = [...qaList]
      .sort((a, b) => b.errorPercent - a.errorPercent || b.attempts - a.attempts)
      .slice(0, 10);
    const easiestQuestions = [...qaList]
      .sort((a, b) => b.accuracyPercent - a.accuracyPercent || b.attempts - a.attempts)
      .slice(0, 10);

    const categoryPerformance: CategoryStatEntry[] = Object.entries(catAgg)
      .map(([category, v]) => ({
        category,
        answered: v.answered,
        correct: v.correct,
        accuracyPercent:
          v.answered > 0 ? Math.round((v.correct / v.answered) * 100) : 0,
      }))
      .sort((a, b) => b.accuracyPercent - a.accuracyPercent);

    const topParticipants = Object.values(expansion.playerProfiles)
      .filter((p) => p.totalGamesPlayed > 0 || p.totalPoints > 0)
      .map((p) => {
        const totalAns = p.totalCorrect + p.totalIncorrect;
        return {
          name: p.displayName,
          avatarId: p.avatarId,
          totalScore: p.totalPoints,
          gamesPlayed: p.totalGamesPlayed,
          wins: p.totalWins,
          accuracyPercent:
            totalAns > 0 ? Math.round((p.totalCorrect / totalAns) * 100) : 0,
        };
      })
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 15);

    const teamAgg: Record<
      string,
      { name: string; color: string; totalScore: number; wins: number; gamesPlayed: number }
    > = {};
    for (const rec of expansion.modeMatchRecords) {
      for (const tm of rec.teamScores) {
        if (!teamAgg[tm.teamName]) {
          teamAgg[tm.teamName] = {
            name: tm.teamName,
            color: tm.color,
            totalScore: 0,
            wins: 0,
            gamesPlayed: 0,
          };
        }
        teamAgg[tm.teamName].totalScore += tm.score;
        teamAgg[tm.teamName].gamesPlayed += 1;
        if (tm.won) teamAgg[tm.teamName].wins += 1;
      }
    }

    const overview: GlobalStatsOverview = {
      totalGames: finishedGames.length,
      totalParticipants,
      totalQuestionsAsked,
      avgResponseMs:
        totalResponseCount > 0
          ? Math.round(totalResponseMsSum / totalResponseCount)
          : 0,
      hardestQuestions,
      easiestQuestions,
      categoryPerformance,
      topParticipants,
      topTeams: Object.values(teamAgg)
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 10),
    };

    const profileKey = String(req.query.profileKey || '').trim();
    const personal =
      profileKey && expansion.playerProfiles[profileKey]
        ? buildPublicTrajectory(expansion.playerProfiles[profileKey])
        : null;

    res.json({ overview, personal });
  });

  // 8. RANKING GENERAL (With Period & Competition Type Filters + Separated Points)
  app.get('/api/expansion/ranking', (req, res) => {
    const { expansion } = deps.getDb();
    const period = (String(req.query.period || 'all') as GeneralRankingResponse['period']);
    const competitionType = String(req.query.type || 'all');

    const now = Date.now();
    const cutoffMs =
      period === 'week'
        ? now - 7 * 86400_000
        : period === 'month'
          ? now - 30 * 86400_000
          : period === 'season'
            ? now - 90 * 86400_000
            : period === 'year'
              ? now - 365 * 86400_000
              : 0;

    const filteredRecords = expansion.modeMatchRecords.filter((rec) => {
      if (cutoffMs > 0 && rec.finishedAt < cutoffMs) return false;
      if (competitionType !== 'all' && rec.mode !== competitionType) return false;
      return true;
    });

    // Aggregate strictly from filteredRecords so individual vs team points never mix!
    const pAgg: Record<
      string,
      {
        name: string;
        avatarId: string;
        totalScore: number;
        wins: number;
        correctCount: number;
        gamesPlayed: number;
        modeLabel: string;
      }
    > = {};

    const tAgg: Record<
      string,
      {
        teamName: string;
        color: string;
        totalScore: number;
        wins: number;
        gamesPlayed: number;
      }
    > = {};

    for (const rec of filteredRecords) {
      for (const ps of rec.participantScores) {
        const key = normalizeText(ps.name) || ps.profileKey;
        if (!pAgg[key]) {
          pAgg[key] = {
            name: ps.name,
            avatarId: ps.avatarId,
            totalScore: 0,
            wins: 0,
            correctCount: 0,
            gamesPlayed: 0,
            modeLabel: rec.modeLabel,
          };
        }
        pAgg[key].totalScore += ps.score;
        pAgg[key].correctCount += ps.correctCount;
        pAgg[key].gamesPlayed += 1;
        if (ps.won) pAgg[key].wins += 1;
      }
      for (const ts of rec.teamScores) {
        const tKey = normalizeText(ts.teamName);
        if (!tAgg[tKey]) {
          tAgg[tKey] = {
            teamName: ts.teamName,
            color: ts.color,
            totalScore: 0,
            wins: 0,
            gamesPlayed: 0,
          };
        }
        tAgg[tKey].totalScore += ts.score;
        tAgg[tKey].gamesPlayed += 1;
        if (ts.won) tAgg[tKey].wins += 1;
      }
    }

    const pList = Object.values(pAgg);
    const bestParticipants = [...pList]
      .sort((a, b) => b.totalScore - a.totalScore || b.wins - a.wins)
      .slice(0, 25)
      .map((p, idx) => ({ rank: idx + 1, ...p }));

    const mostWins = [...pList]
      .sort((a, b) => b.wins - a.wins || b.totalScore - a.totalScore)
      .slice(0, 25)
      .map((p, idx) => ({
        rank: idx + 1,
        name: p.name,
        avatarId: p.avatarId,
        wins: p.wins,
        totalScore: p.totalScore,
      }));

    const mostCorrect = [...pList]
      .sort((a, b) => b.correctCount - a.correctCount || b.totalScore - a.totalScore)
      .slice(0, 25)
      .map((p, idx) => ({
        rank: idx + 1,
        name: p.name,
        avatarId: p.avatarId,
        correctCount: p.correctCount,
        totalScore: p.totalScore,
      }));

    const bestTeams = Object.values(tAgg)
      .sort((a, b) => b.totalScore - a.totalScore || b.wins - a.wins)
      .slice(0, 20)
      .map((t, idx) => ({ rank: idx + 1, ...t }));

    // Churches / Congregations separated strictly in their tournament bucket
    const churchAgg: Record<
      string,
      {
        orgName: string;
        kind: string;
        color: string;
        totalPoints: number;
        wins: number;
        tournamentCount: number;
      }
    > = {};
    const tournamentChampions: GeneralRankingResponse['tournamentChampions'] = [];

    for (const t of Object.values(expansion.tournaments)) {
      if (cutoffMs > 0 && t.createdAt < cutoffMs) continue;
      for (const org of t.organizations) {
        const key = `${org.kind}:${normalizeText(org.name)}`;
        if (!churchAgg[key]) {
          churchAgg[key] = {
            orgName: org.name,
            kind: org.kind,
            color: org.color,
            totalPoints: 0,
            wins: 0,
            tournamentCount: 0,
          };
        }
        churchAgg[key].totalPoints += org.points;
        churchAgg[key].wins += org.wins;
        churchAgg[key].tournamentCount += 1;
      }
      if (t.status === 'finished') {
        const topOrg = [...t.organizations].sort((a, b) => b.points - a.points)[0];
        if (topOrg) {
          tournamentChampions.push({
            tournamentName: t.name,
            championName: topOrg.name,
            kind: topOrg.kind,
            points: topOrg.points,
            finishedAt: t.finishedAt || t.createdAt,
          });
        }
      }
    }

    const bestChurches = Object.values(churchAgg)
      .sort((a, b) => b.totalPoints - a.totalPoints || b.wins - a.wins)
      .slice(0, 20)
      .map((c, idx) => ({ rank: idx + 1, ...c }));

    const response: GeneralRankingResponse = {
      period,
      competitionType,
      bestParticipants,
      bestTeams,
      bestChurches,
      tournamentChampions: tournamentChampions.sort(
        (a, b) => b.finishedAt - a.finishedAt
      ),
      mostWins,
      mostCorrect,
    };

    res.json(response);
  });
}
