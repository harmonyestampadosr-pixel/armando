import crypto from 'crypto';
import type express from 'express';
import {
  BUILTIN_SATURDAY_CHALLENGES,
  SATURDAY_CHALLENGE_CATEGORIES,
  SATURDAY_CHALLENGE_SUBTYPES,
  type SaturdayChallengeCategory,
  type SaturdayChallengeEvaluationType,
  type SaturdayChallengeHistoryEntry,
  type SaturdayChallengeItem,
  type SaturdayChallengeRoomState,
  type SaturdayChallengeRoomView,
  type SaturdayChallengeSubmissionView,
  type SaturdayChallengeSubType,
  type SaturdayParticipationMode,
  type SaturdayValidationStatus,
} from './src/shared/saturdayChallengesData.js';
import type {
  BibleQuestion,
  GameConfig,
  GameStatus,
  LeaderboardEntry,
  Participant,
} from './src/shared/types.js';

export interface SaturdayChallengeServerSubmission {
  participantId: string;
  selectedIndex?: number;
  submittedText?: string;
  completedSignal?: boolean;
  isAutoCorrect?: boolean;
  validationStatus: SaturdayValidationStatus;
  pointsAwarded: number;
  responseTimeMs: number;
  submittedAt: number;
}

export interface SaturdayChallengeServerInternal {
  currentIndex: number;
  participationMode: SaturdayParticipationMode;
  challengeIds: string[];
  submissions: Record<number, Record<string, SaturdayChallengeServerSubmission>>;
  usedChallengeIds: string[];
  historyLogged?: boolean;
}

export interface SaturdayChallengeStoredParticipant extends Participant {
  token: string;
}

export interface SaturdayChallengeStoredGame {
  id: string;
  code: string;
  config: GameConfig;
  status: GameStatus;
  currentQuestionIndex: number;
  questionStartedAt: number | null;
  questionEndsAt: number | null;
  questionLockReason?: 'timeout' | 'all_answered';
  questions: Array<(BibleQuestion & { isSpecialMultiplier: number; roundStage?: string }) | Record<string, unknown>>;
  participants: Record<string, SaturdayChallengeStoredParticipant>;
  answers: Record<number, Record<string, unknown>>;
  evaluatedEliminations: number[];
  finishedAt: number | null;
  saturdayChallengeInternal?: SaturdayChallengeServerInternal;
}

export interface SaturdayChallengeDatabaseSlice {
  saturdayCustomChallenges: SaturdayChallengeItem[];
  saturdayChallengeFavorites: string[];
  saturdayChallengeRecentIds: string[];
  saturdayChallengeHistory: SaturdayChallengeHistoryEntry[];
}

export interface SaturdayChallengeRoutesDeps {
  getDb: () => SaturdayChallengeDatabaseSlice;
  scheduleSave: () => void;
}

export interface SaturdayChallengeActionHelpers {
  startQuestionAt: (game: any, index: number) => void;
  finishGame: (game: any) => void;
  buildLeaderboard: (game: any) => LeaderboardEntry[];
  broadcastRoom: (code: string) => void;
  scheduleSave: () => void;
  sendWsError: (message: string) => void;
}

const VALID_CATEGORIES = new Set<SaturdayChallengeCategory>([
  'retos_biblicos',
  'representacion',
  'creatividad',
  'integracion',
]);

const VALID_MODES = new Set<SaturdayParticipationMode>([
  'individual',
  'parejas',
  'equipos',
  'competencia_general',
]);

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function ensureSaturdayChallengeSlice(
  db: Partial<SaturdayChallengeDatabaseSlice>
): SaturdayChallengeDatabaseSlice {
  return {
    saturdayCustomChallenges: Array.isArray(db.saturdayCustomChallenges)
      ? db.saturdayCustomChallenges
      : [],
    saturdayChallengeFavorites: Array.isArray(db.saturdayChallengeFavorites)
      ? db.saturdayChallengeFavorites
      : [],
    saturdayChallengeRecentIds: Array.isArray(db.saturdayChallengeRecentIds)
      ? db.saturdayChallengeRecentIds
      : [],
    saturdayChallengeHistory: Array.isArray(db.saturdayChallengeHistory)
      ? db.saturdayChallengeHistory
      : [],
  };
}

export function getCombinedSaturdayChallenges(
  db: SaturdayChallengeDatabaseSlice
): SaturdayChallengeItem[] {
  const favSet = new Set(db.saturdayChallengeFavorites || []);
  const combined = [
    ...(db.saturdayCustomChallenges || []),
    ...BUILTIN_SATURDAY_CHALLENGES,
  ];
  return combined.map((c) => ({
    ...c,
    isFavorite: favSet.has(c.id),
  }));
}

export function pickSurpriseChallenges(
  db: SaturdayChallengeDatabaseSlice,
  opts: {
    count?: number;
    category?: string;
    subType?: string;
    favoritesOnly?: boolean;
    participationMode?: SaturdayParticipationMode;
    excludeIds?: string[];
    recordRecent?: boolean;
  }
): SaturdayChallengeItem[] {
  const all = getCombinedSaturdayChallenges(db);
  const targetCount = Math.max(1, Math.min(30, opts.count ?? 1));
  const excludeSet = new Set(opts.excludeIds || []);

  let pool = all.filter((c) => {
    if (excludeSet.has(c.id)) return false;
    if (opts.category && opts.category !== 'all' && c.category !== opts.category) {
      return false;
    }
    if (opts.subType && opts.subType !== 'all' && c.subType !== opts.subType) {
      return false;
    }
    if (opts.favoritesOnly && !c.isFavorite) {
      return false;
    }
    return true;
  });

  // Fallback gracefully if favoritesOnly or strict filter yields empty
  if (pool.length === 0) {
    pool = all.filter((c) => {
      if (excludeSet.has(c.id)) return false;
      if (opts.category && opts.category !== 'all' && c.category !== opts.category) {
        return false;
      }
      return true;
    });
  }
  if (pool.length === 0) {
    pool = all.filter((c) => !excludeSet.has(c.id));
  }
  if (pool.length === 0) {
    pool = [...all];
  }

  // Prefer challenges suited for the requested participationMode when enough exist
  if (opts.participationMode) {
    const modeMatched = pool.filter((c) =>
      c.recommendedModes.includes(opts.participationMode!)
    );
    if (modeMatched.length >= targetCount) {
      pool = modeMatched;
    }
  }

  const recentIds = db.saturdayChallengeRecentIds || [];
  const recentSet = new Set(recentIds);
  const freshPool = shuffleArray(pool.filter((c) => !recentSet.has(c.id)));

  // Order remaining recent items from least-recently-used to most-recently-used
  const recentOrder = new Map<string, number>();
  recentIds.forEach((id, idx) => recentOrder.set(id, idx));
  const stalePool = pool
    .filter((c) => recentSet.has(c.id))
    .sort((a, b) => (recentOrder.get(a.id) ?? 0) - (recentOrder.get(b.id) ?? 0));

  const picked = [...freshPool, ...stalePool].slice(0, targetCount);

  if (opts.recordRecent !== false && picked.length > 0) {
    const maxRecentWindow = Math.max(10, Math.floor(all.length * 0.72));
    const nextRecent = recentIds.filter((id) => !picked.some((p) => p.id === id));
    for (const p of picked) {
      nextRecent.push(p.id);
    }
    db.saturdayChallengeRecentIds = nextRecent.slice(-maxRecentWindow);
  }

  return picked;
}

export function initSaturdayChallengeForGame(
  game: SaturdayChallengeStoredGame,
  body: Record<string, unknown>,
  db: SaturdayChallengeDatabaseSlice
): void {
  if (game.config.mode !== 'retos_sabado') return;

  const rawMode = String(body.participationMode || 'individual') as SaturdayParticipationMode;
  const participationMode: SaturdayParticipationMode = VALID_MODES.has(rawMode)
    ? rawMode
    : 'individual';
  const category =
    typeof body.challengeCategory === 'string' && body.challengeCategory.trim()
      ? body.challengeCategory.trim()
      : 'all';
  const favoritesOnly = Boolean(body.favoritesOnly);
  const requestedCount = Math.max(1, Math.min(20, Number(body.questionCount) || 5));

  const all = getCombinedSaturdayChallenges(db);
  const explicitIds = Array.isArray(body.selectedChallengeIds)
    ? body.selectedChallengeIds
        .map((id) => String(id || '').trim())
        .filter((id) => all.some((c) => c.id === id))
    : [];

  const chosenIds: string[] = [...explicitIds.slice(0, requestedCount)];
  if (chosenIds.length < requestedCount) {
    const picked = pickSurpriseChallenges(db, {
      count: requestedCount - chosenIds.length,
      category,
      favoritesOnly,
      participationMode,
      excludeIds: chosenIds,
      recordRecent: true,
    });
    for (const c of picked) {
      if (!chosenIds.includes(c.id)) {
        chosenIds.push(c.id);
      }
    }
  }

  const chosenChallenges = chosenIds
    .map((id) => all.find((c) => c.id === id))
    .filter((c): c is SaturdayChallengeItem => Boolean(c));

  // Sync placeholder questions list so totalQuestions matches challenge count cleanly
  game.questions = chosenChallenges.map((c, idx) => ({
    id: `q-rs-${idx}-${c.id}`,
    group: 'Categorías Especiales',
    category: SATURDAY_CHALLENGE_CATEGORIES[c.category].label,
    difficulty: 'intermedio',
    prompt: c.prompt,
    options: c.options || ['Completado'],
    correctIndex: typeof c.correctIndex === 'number' ? c.correctIndex : 0,
    reference: c.reference,
    explanation: c.guideAnswer,
    isSpecialMultiplier: 1,
  }));
  game.config.questionCount = chosenChallenges.length;
  game.config.participationMode = participationMode;
  game.config.challengeCategory = category;
  game.config.favoritesOnly = favoritesOnly;

  game.saturdayChallengeInternal = {
    currentIndex: -1,
    participationMode,
    challengeIds: chosenChallenges.map((c) => c.id),
    submissions: {},
    usedChallengeIds: chosenChallenges.map((c) => c.id),
    historyLogged: false,
  };
}

export function buildSaturdayChallengeClientView(
  game: SaturdayChallengeStoredGame,
  role: 'presenter' | 'projector' | 'participant',
  participantId: string | undefined,
  db: SaturdayChallengeDatabaseSlice
): SaturdayChallengeRoomState | undefined {
  const internal = game.saturdayChallengeInternal;
  if (!internal) return undefined;

  const all = getCombinedSaturdayChallenges(db);
  const qIdx = internal.currentIndex;
  const currentId =
    qIdx >= 0 && qIdx < internal.challengeIds.length
      ? internal.challengeIds[qIdx]
      : null;
  const rawChallenge = currentId
    ? all.find((c) => c.id === currentId) || null
    : null;

  const isRevealed =
    game.status === 'answer_revealed' || game.status === 'finished';
  const showSecretFields = isRevealed || role === 'presenter';

  let currentChallenge: SaturdayChallengeRoomView | null = null;
  if (rawChallenge) {
    currentChallenge = {
      id: rawChallenge.id,
      category: rawChallenge.category,
      subType: rawChallenge.subType,
      subTypeLabel: rawChallenge.subTypeLabel,
      title: rawChallenge.title,
      prompt: rawChallenge.prompt,
      instructions: rawChallenge.instructions,
      suggestedSec: rawChallenge.suggestedSec,
      evaluationType: rawChallenge.evaluationType,
      ...(rawChallenge.options ? { options: rawChallenge.options } : {}),
      ...(showSecretFields
        ? {
            correctIndex: rawChallenge.correctIndex,
            reference: rawChallenge.reference,
            guideAnswer: rawChallenge.guideAnswer,
          }
        : rawChallenge.evaluationType === 'director_review' &&
            rawChallenge.subType !== 'adivinar_escena'
          ? { reference: rawChallenge.reference }
          : {}),
    };
  }

  const rawSubMap = qIdx >= 0 ? internal.submissions[qIdx] || {} : {};
  const canExposeAutoOutcome =
    isRevealed ||
    role === 'presenter' ||
    rawChallenge?.evaluationType === 'director_review';

  const toView = (sub: SaturdayChallengeServerSubmission): SaturdayChallengeSubmissionView => {
    const p = game.participants[sub.participantId];
    return {
      participantId: sub.participantId,
      participantName: p?.name || 'Participante',
      avatarId: p?.avatarId || 'crown',
      photoUrl: p?.photoUrl,
      teamId: p?.teamId,
      ...(sub.submittedText !== undefined ? { submittedText: sub.submittedText } : {}),
      ...(canExposeAutoOutcome && sub.selectedIndex !== undefined
        ? { selectedIndex: sub.selectedIndex }
        : {}),
      ...(sub.completedSignal !== undefined
        ? { completedSignal: sub.completedSignal }
        : {}),
      ...(canExposeAutoOutcome && sub.isAutoCorrect !== undefined
        ? { isAutoCorrect: sub.isAutoCorrect }
        : {}),
      validationStatus: sub.validationStatus,
      pointsAwarded: canExposeAutoOutcome ? sub.pointsAwarded : 0,
      responseTimeMs: sub.responseTimeMs,
    };
  };

  let mySubmission: SaturdayChallengeSubmissionView | null = null;
  if (participantId && rawSubMap[participantId]) {
    const rawMine = rawSubMap[participantId];
    mySubmission = {
      ...toView(rawMine),
      // Participant can see which option button they tapped immediately
      ...(rawMine.selectedIndex !== undefined
        ? { selectedIndex: rawMine.selectedIndex }
        : {}),
    };
  }

  const submissions: SaturdayChallengeSubmissionView[] =
    role === 'presenter' ||
    isRevealed ||
    rawChallenge?.evaluationType === 'director_review'
      ? Object.values(rawSubMap)
          .sort((a, b) => b.pointsAwarded - a.pointsAwarded || a.responseTimeMs - b.responseTimeMs)
          .map(toView)
      : [];

  return {
    currentIndex: internal.currentIndex,
    totalChallenges: internal.challengeIds.length,
    participationMode: internal.participationMode,
    currentChallenge,
    mySubmission,
    submissions,
    usedChallengeIds: internal.usedChallengeIds,
  };
}

function getAwardedPointsForGrade(
  grade: SaturdayValidationStatus,
  basePoints: number,
  speedBonusMax: number,
  responseTimeMs: number,
  timeLimitSec: number,
  usedPhoneTimer: boolean
): number {
  const totalMs = Math.max(1000, timeLimitSec * 1000);
  const speedRatio = usedPhoneTimer
    ? Math.max(0, Math.min(1, 1 - responseTimeMs / totalMs))
    : 0.4;
  const speedBonus = Math.round(speedBonusMax * speedRatio);

  if (grade === 'featured') {
    return Math.round(basePoints * 1.3) + speedBonus;
  }
  if (grade === 'approved') {
    return basePoints + speedBonus;
  }
  if (grade === 'participation') {
    return Math.round(basePoints * 0.5);
  }
  return 0;
}

export function handleSaturdayChallengePresenterAction(
  game: SaturdayChallengeStoredGame,
  action: string,
  msg: Record<string, unknown>,
  helpers: SaturdayChallengeActionHelpers,
  db: SaturdayChallengeDatabaseSlice
): boolean {
  const internal = game.saturdayChallengeInternal;
  if (game.config.mode !== 'retos_sabado' || !internal) {
    return false;
  }

  if (action === 'start_game') {
    if (game.config.teamMode) {
      const pList = Object.values(game.participants);
      if (pList.length < 2) {
        helpers.sendWsError(
          'Se necesitan al menos 2 participantes en la sala para iniciar en modo parejas o equipos.'
        );
        return true;
      }
      const activeTeams = new Set(pList.map((p) => p.teamId).filter(Boolean));
      if (activeTeams.size < 2) {
        helpers.sendWsError(
          'Debe haber participantes en al menos 2 parejas o equipos distintos antes de iniciar.'
        );
        return true;
      }
    }
    if (internal.challengeIds.length === 0) {
      initSaturdayChallengeForGame(game, game.config as unknown as Record<string, unknown>, db);
    }
    internal.currentIndex = 0;
    helpers.startQuestionAt(game, 0);
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

  if (action === 'next_question') {
    const nextIdx = internal.currentIndex + 1;
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

  if (action === 'surprise_next_challenge') {
    const targetIdx = internal.currentIndex >= 0 ? internal.currentIndex : 0;
    const categoryFilter =
      typeof msg.category === 'string' && msg.category.trim()
        ? msg.category.trim()
        : game.config.challengeCategory || 'all';
    const pickedList = pickSurpriseChallenges(db, {
      count: 1,
      category: categoryFilter,
      favoritesOnly: Boolean(game.config.favoritesOnly),
      participationMode: internal.participationMode,
      excludeIds: internal.usedChallengeIds,
      recordRecent: true,
    });
    const picked = pickedList[0];
    if (!picked) {
      helpers.sendWsError('No hay retos disponibles en este momento.');
      return true;
    }

    // Reverse any points already scored strictly inside targetIdx before swapping it out
    const prevSubs = internal.submissions[targetIdx] || {};
    for (const sub of Object.values(prevSubs)) {
      const p = game.participants[sub.participantId];
      if (p) {
        p.score = Math.max(0, p.score - (sub.pointsAwarded || 0));
        if (
          sub.isAutoCorrect ||
          sub.validationStatus === 'approved' ||
          sub.validationStatus === 'featured'
        ) {
          p.correctCount = Math.max(0, p.correctCount - 1);
        }
        p.answeredCount = Math.max(0, p.answeredCount - 1);
      }
    }
    internal.submissions[targetIdx] = {};
    internal.challengeIds[targetIdx] = picked.id;
    if (!internal.usedChallengeIds.includes(picked.id)) {
      internal.usedChallengeIds.push(picked.id);
    }
    game.questions[targetIdx] = {
      id: `q-rs-${targetIdx}-${picked.id}`,
      group: 'Categorías Especiales',
      category: SATURDAY_CHALLENGE_CATEGORIES[picked.category].label,
      difficulty: 'intermedio',
      prompt: picked.prompt,
      options: picked.options || ['Completado'],
      correctIndex: typeof picked.correctIndex === 'number' ? picked.correctIndex : 0,
      reference: picked.reference,
      explanation: picked.guideAnswer,
      isSpecialMultiplier: 1,
    };

    if (game.status !== 'waiting' && game.status !== 'finished') {
      internal.currentIndex = targetIdx;
      helpers.startQuestionAt(game, targetIdx);
    }

    helpers.scheduleSave();
    helpers.broadcastRoom(game.code);
    return true;
  }

  if (action === 'director_validate_challenge') {
    const qIdx = internal.currentIndex;
    if (qIdx < 0 || qIdx >= internal.challengeIds.length) {
      return true;
    }
    const targetPid = String(msg.participantId || '').trim();
    const applyToTeam = Boolean(msg.applyToTeam);
    const rawGrade = String(msg.validationStatus || 'approved') as SaturdayValidationStatus;
    const validGrades: SaturdayValidationStatus[] = [
      'pending',
      'approved',
      'featured',
      'participation',
      'rejected',
    ];
    const grade: SaturdayValidationStatus = validGrades.includes(rawGrade)
      ? rawGrade
      : 'approved';

    const baseTarget = game.participants[targetPid];
    if (!baseTarget) {
      helpers.sendWsError('No se encontró al participante para validar.');
      return true;
    }

    const targetParticipants =
      applyToTeam && baseTarget.teamId
        ? Object.values(game.participants).filter((p) => p.teamId === baseTarget.teamId)
        : [baseTarget];

    if (!internal.submissions[qIdx]) {
      internal.submissions[qIdx] = {};
    }

    const now = Date.now();
    const startedAt = game.questionStartedAt || now;
    const elapsedFallback = Math.max(1000, now - startedAt);

    for (const participant of targetParticipants) {
      const existing = internal.submissions[qIdx][participant.id];
      const usedPhone = Boolean(existing);
      const responseTimeMs = existing ? existing.responseTimeMs : elapsedFallback;
      const newPoints = getAwardedPointsForGrade(
        grade,
        game.config.basePoints,
        game.config.speedBonusMax,
        responseTimeMs,
        game.config.timeLimitSec,
        usedPhone
      );

      const oldPoints = existing?.pointsAwarded || 0;
      const delta = newPoints - oldPoints;
      participant.score = Math.max(0, participant.score + delta);

      const wasCorrect = Boolean(
        existing &&
          (existing.validationStatus === 'approved' ||
            existing.validationStatus === 'featured' ||
            existing.isAutoCorrect)
      );
      const nowCorrect = grade === 'approved' || grade === 'featured';

      if (!wasCorrect && nowCorrect) {
        participant.correctCount += 1;
        participant.streak += 1;
      } else if (wasCorrect && !nowCorrect) {
        participant.correctCount = Math.max(0, participant.correctCount - 1);
        participant.streak = 0;
      }

      if (!existing) {
        participant.answeredCount += 1;
      }

      internal.submissions[qIdx][participant.id] = {
        participantId: participant.id,
        selectedIndex: existing?.selectedIndex,
        submittedText: existing?.submittedText || (usedPhone ? undefined : 'Participación presencial en vivo'),
        completedSignal: existing?.completedSignal ?? true,
        isAutoCorrect: nowCorrect,
        validationStatus: grade,
        pointsAwarded: newPoints,
        responseTimeMs,
        submittedAt: existing?.submittedAt || now,
      };
    }

    helpers.scheduleSave();
    helpers.broadcastRoom(game.code);
    return true;
  }

  if (action === 'reset_game') {
    game.status = 'waiting';
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
    initSaturdayChallengeForGame(
      game,
      {
        questionCount: internal.challengeIds.length || game.config.questionCount,
        participationMode: internal.participationMode,
        challengeCategory: game.config.challengeCategory || 'all',
        favoritesOnly: Boolean(game.config.favoritesOnly),
      },
      db
    );
    helpers.scheduleSave();
    helpers.broadcastRoom(game.code);
    return true;
  }

  return false;
}

export function handleSaturdayChallengeSubmission(
  game: SaturdayChallengeStoredGame,
  participant: SaturdayChallengeStoredParticipant,
  msg: Record<string, unknown>,
  helpers: SaturdayChallengeActionHelpers,
  db: SaturdayChallengeDatabaseSlice
): void {
  const internal = game.saturdayChallengeInternal;
  if (game.config.mode !== 'retos_sabado' || !internal) return;

  if (participant.eliminated) {
    helpers.sendWsError('No puedes enviar respuestas en modo espectador.');
    return;
  }

  if (game.status !== 'question_active') {
    helpers.sendWsError('El tiempo para enviar en este reto ha finalizado.');
    return;
  }

  const qIdx = internal.currentIndex;
  const challengeId =
    qIdx >= 0 && qIdx < internal.challengeIds.length
      ? internal.challengeIds[qIdx]
      : null;
  if (!challengeId) return;

  const all = getCombinedSaturdayChallenges(db);
  const challenge = all.find((c) => c.id === challengeId);
  if (!challenge) return;

  if (!internal.submissions[qIdx]) {
    internal.submissions[qIdx] = {};
  }
  if (internal.submissions[qIdx][participant.id]) {
    return;
  }

  const now = Date.now();
  const startedAt = game.questionStartedAt || now;
  const totalMs = Math.max(1000, game.config.timeLimitSec * 1000);
  const elapsedMs = Math.max(0, Math.min(totalMs, now - startedAt));

  if (challenge.evaluationType === 'auto_choice') {
    const selectedIndex = Number(msg.selectedIndex);
    const options = challenge.options || [];
    if (
      !Number.isInteger(selectedIndex) ||
      selectedIndex < 0 ||
      selectedIndex >= options.length
    ) {
      return;
    }

    const isCorrect = selectedIndex === (challenge.correctIndex ?? 0);
    let pointsAwarded = 0;
    if (isCorrect) {
      const speedRatio = Math.max(0, Math.min(1, 1 - elapsedMs / totalMs));
      const speedBonus = Math.round(game.config.speedBonusMax * speedRatio);
      pointsAwarded = game.config.basePoints + speedBonus;
      participant.score += pointsAwarded;
      participant.correctCount += 1;
      participant.streak += 1;
    } else {
      participant.streak = 0;
    }
    participant.answeredCount += 1;
    participant.totalResponseMs += elapsedMs;

    internal.submissions[qIdx][participant.id] = {
      participantId: participant.id,
      selectedIndex,
      isAutoCorrect: isCorrect,
      validationStatus: isCorrect ? 'approved' : 'rejected',
      pointsAwarded,
      responseTimeMs: elapsedMs,
      submittedAt: now,
    };

    // Auto-lock if all active online participants answered on auto_choice
    const activeOnline = Object.values(game.participants).filter(
      (p) => p.online && !p.eliminated
    );
    const answeredOnlineCount = activeOnline.filter(
      (p) => Boolean(internal.submissions[qIdx][p.id])
    ).length;

    if (activeOnline.length > 0 && answeredOnlineCount === activeOnline.length) {
      game.status = 'question_locked';
      game.questionLockReason = 'all_answered';
    }
  } else {
    const submittedText =
      typeof msg.submittedText === 'string'
        ? msg.submittedText.trim().slice(0, 400)
        : '';
    const completedSignal = msg.completedSignal !== false;

    participant.answeredCount += 1;
    participant.totalResponseMs += elapsedMs;

    internal.submissions[qIdx][participant.id] = {
      participantId: participant.id,
      ...(submittedText ? { submittedText } : {}),
      completedSignal,
      validationStatus: 'pending',
      pointsAwarded: 0,
      responseTimeMs: elapsedMs,
      submittedAt: now,
    };
  }

  helpers.scheduleSave();
  helpers.broadcastRoom(game.code);
}

export function recordSaturdayChallengeGameHistory(
  game: SaturdayChallengeStoredGame,
  buildLeaderboard: (game: any) => LeaderboardEntry[],
  db: SaturdayChallengeDatabaseSlice
): void {
  const internal = game.saturdayChallengeInternal;
  if (game.config.mode !== 'retos_sabado' || !internal || internal.historyLogged) {
    return;
  }

  internal.historyLogged = true;
  const all = getCombinedSaturdayChallenges(db);
  const lastIdx = Math.max(0, internal.currentIndex);
  const primaryId =
    internal.challengeIds[lastIdx] || internal.challengeIds[0] || '';
  const primaryChallenge = all.find((c) => c.id === primaryId);
  const executedTitles = internal.challengeIds
    .slice(0, Math.max(1, internal.currentIndex + 1))
    .map((id) => all.find((c) => c.id === id)?.title)
    .filter((t): t is string => Boolean(t));

  const lb = buildLeaderboard(game);
  const top = lb[0];

  const entry: SaturdayChallengeHistoryEntry = {
    id: `rsh-${game.id}`,
    challengeId: primaryId || `room-${game.code}`,
    challengeTitle:
      executedTitles.length > 1
        ? `${executedTitles[0]} (+${executedTitles.length - 1} retos)`
        : primaryChallenge?.title || game.config.title,
    category: primaryChallenge?.category || 'retos_biblicos',
    subTypeLabel: primaryChallenge?.subTypeLabel || 'Retos del Sábado',
    participationMode: internal.participationMode,
    executedAt: game.finishedAt || Date.now(),
    roomCode: game.code,
    roomTitle: game.config.title,
    participantCount: lb.length,
    winnerName: top ? top.name : 'Sin participantes',
    winnerScore: top ? top.score : 0,
    resultSummary:
      executedTitles.length > 0
        ? `Retos realizados: ${executedTitles.join(' · ')}`
        : 'Competencia completada en sala en vivo.',
  };

  if (!Array.isArray(db.saturdayChallengeHistory)) {
    db.saturdayChallengeHistory = [];
  }
  db.saturdayChallengeHistory.unshift(entry);
  db.saturdayChallengeHistory = db.saturdayChallengeHistory.slice(0, 150);
}

export function registerSaturdayChallengeRoutes(
  app: express.Express,
  deps: SaturdayChallengeRoutesDeps
): void {
  // 1. Full challenge library (built-in + custom + favorites hydrated)
  app.get('/api/saturday-challenges/library', (_req, res) => {
    const dbRef = deps.getDb();
    const challenges = getCombinedSaturdayChallenges(dbRef);
    res.json({
      challenges,
      categories: SATURDAY_CHALLENGE_CATEGORIES,
      subTypes: SATURDAY_CHALLENGE_SUBTYPES,
      recentIds: dbRef.saturdayChallengeRecentIds || [],
      totalCount: challenges.length,
    });
  });

  // 2. Surprise picker ("Elegir reto sorpresa") avoiding recently used ones
  app.post('/api/saturday-challenges/surprise', (req, res) => {
    const dbRef = deps.getDb();
    const body = req.body || {};
    const count = Math.max(1, Math.min(10, Number(body.count) || 1));
    const category =
      typeof body.category === 'string' && body.category.trim()
        ? body.category.trim()
        : 'all';
    const subType =
      typeof body.subType === 'string' && body.subType.trim()
        ? body.subType.trim()
        : 'all';
    const favoritesOnly = Boolean(body.favoritesOnly);
    const participationMode = VALID_MODES.has(body.participationMode)
      ? (body.participationMode as SaturdayParticipationMode)
      : undefined;
    const excludeIds = Array.isArray(body.excludeIds)
      ? body.excludeIds.map((id: unknown) => String(id || ''))
      : [];

    const picked = pickSurpriseChallenges(dbRef, {
      count,
      category,
      subType,
      favoritesOnly,
      participationMode,
      excludeIds,
      recordRecent: true,
    });

    deps.scheduleSave();
    res.json({
      challenge: picked[0] || null,
      challenges: picked,
      recentCount: (dbRef.saturdayChallengeRecentIds || []).length,
    });
  });

  // 3. Toggle favorite challenge
  app.post('/api/saturday-challenges/favorites/:id', (req, res) => {
    const id = String(req.params.id || '').trim();
    if (!id) {
      res.status(400).json({ error: 'ID de reto inválido.' });
      return;
    }
    const dbRef = deps.getDb();
    const all = getCombinedSaturdayChallenges(dbRef);
    if (!all.some((c) => c.id === id)) {
      res.status(404).json({ error: 'Reto no encontrado.' });
      return;
    }

    if (!Array.isArray(dbRef.saturdayChallengeFavorites)) {
      dbRef.saturdayChallengeFavorites = [];
    }
    const idx = dbRef.saturdayChallengeFavorites.indexOf(id);
    let isFavorite = false;
    if (idx >= 0) {
      dbRef.saturdayChallengeFavorites.splice(idx, 1);
      isFavorite = false;
    } else {
      dbRef.saturdayChallengeFavorites.push(id);
      isFavorite = true;
    }

    deps.scheduleSave();
    res.json({ id, isFavorite });
  });

  // 4. Add custom youth-safe director challenge
  app.post('/api/saturday-challenges/custom', (req, res) => {
    const dbRef = deps.getDb();
    const body = req.body || {};

    const rawCat = String(body.category || 'retos_biblicos') as SaturdayChallengeCategory;
    const category: SaturdayChallengeCategory = VALID_CATEGORIES.has(rawCat)
      ? rawCat
      : 'retos_biblicos';

    const rawSubType = String(body.subType || '') as SaturdayChallengeSubType;
    const subTypeMeta =
      SATURDAY_CHALLENGE_SUBTYPES.find((s) => s.id === rawSubType && s.category === category) ||
      SATURDAY_CHALLENGE_SUBTYPES.find((s) => s.category === category) ||
      SATURDAY_CHALLENGE_SUBTYPES[0];

    const title = String(body.title || '').trim().slice(0, 120);
    const prompt = String(body.prompt || '').trim().slice(0, 500);
    const instructions =
      String(body.instructions || '').trim().slice(0, 350) ||
      'Participa con respeto, creatividad y base bíblica antes de que finalice el tiempo.';
    const reference =
      String(body.reference || '').trim().slice(0, 120) || 'Palabra de Dios';
    const guideAnswer = String(body.guideAnswer || '').trim().slice(0, 350);
    const suggestedSec = Math.max(15, Math.min(180, Number(body.suggestedSec) || 60));

    const evaluationType: SaturdayChallengeEvaluationType =
      body.evaluationType === 'auto_choice' ? 'auto_choice' : 'director_review';

    const options =
      evaluationType === 'auto_choice' && Array.isArray(body.options)
        ? body.options.map((o: unknown) => String(o || '').trim()).filter(Boolean)
        : undefined;
    const correctIndex =
      evaluationType === 'auto_choice' ? Number(body.correctIndex) : undefined;

    if (!title || !prompt) {
      res.status(400).json({
        error: 'Escribe un título y una consigna clara para tu reto personalizado.',
      });
      return;
    }

    if (
      evaluationType === 'auto_choice' &&
      (!options ||
        options.length < 2 ||
        correctIndex === undefined ||
        isNaN(correctIndex) ||
        correctIndex < 0 ||
        correctIndex >= options.length)
    ) {
      res.status(400).json({
        error: 'Para retos de selección múltiple, agrega al menos 2 opciones y marca la correcta.',
      });
      return;
    }

    const recommendedModes: SaturdayParticipationMode[] = Array.isArray(
      body.recommendedModes
    )
      ? body.recommendedModes.filter((m: unknown) =>
          VALID_MODES.has(m as SaturdayParticipationMode)
        )
      : ['individual', 'parejas', 'equipos', 'competencia_general'];

    const newChallenge: SaturdayChallengeItem = {
      id: `rsc-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
      category,
      subType: subTypeMeta.id,
      subTypeLabel: subTypeMeta.label,
      title,
      prompt,
      instructions,
      reference,
      suggestedSec,
      evaluationType,
      ...(options ? { options, correctIndex } : {}),
      ...(guideAnswer ? { guideAnswer } : {}),
      recommendedModes:
        recommendedModes.length > 0
          ? recommendedModes
          : ['individual', 'parejas', 'equipos', 'competencia_general'],
      isCustom: true,
      isFavorite: Boolean(body.isFavorite),
    };

    if (!Array.isArray(dbRef.saturdayCustomChallenges)) {
      dbRef.saturdayCustomChallenges = [];
    }
    dbRef.saturdayCustomChallenges.unshift(newChallenge);

    if (body.isFavorite) {
      if (!Array.isArray(dbRef.saturdayChallengeFavorites)) {
        dbRef.saturdayChallengeFavorites = [];
      }
      dbRef.saturdayChallengeFavorites.push(newChallenge.id);
    }

    deps.scheduleSave();
    res.status(201).json({ challenge: newChallenge });
  });

  // 5. Delete custom director challenge
  app.delete('/api/saturday-challenges/custom/:id', (req, res) => {
    const id = String(req.params.id || '').trim();
    const dbRef = deps.getDb();
    const before = (dbRef.saturdayCustomChallenges || []).length;
    dbRef.saturdayCustomChallenges = (dbRef.saturdayCustomChallenges || []).filter(
      (c) => c.id !== id
    );
    if (dbRef.saturdayCustomChallenges.length === before) {
      res.status(404).json({
        error: 'Solo se pueden eliminar retos personalizados agregados por el director.',
      });
      return;
    }
    dbRef.saturdayChallengeFavorites = (
      dbRef.saturdayChallengeFavorites || []
    ).filter((fid) => fid !== id);
    dbRef.saturdayChallengeRecentIds = (
      dbRef.saturdayChallengeRecentIds || []
    ).filter((rid) => rid !== id);

    deps.scheduleSave();
    res.json({ deleted: true, id });
  });

  // 6. Challenge execution history
  app.get('/api/saturday-challenges/history', (_req, res) => {
    const dbRef = deps.getDb();
    res.json({
      history: dbRef.saturdayChallengeHistory || [],
    });
  });

  app.post('/api/saturday-challenges/history', (req, res) => {
    const dbRef = deps.getDb();
    const body = req.body || {};
    const challengeTitle = String(body.challengeTitle || '').trim();
    if (!challengeTitle) {
      res.status(400).json({ error: 'Falta el título del reto ejecutado.' });
      return;
    }

    const rawCat = String(body.category || 'retos_biblicos') as SaturdayChallengeCategory;
    const category: SaturdayChallengeCategory = VALID_CATEGORIES.has(rawCat)
      ? rawCat
      : 'retos_biblicos';
    const rawMode = String(body.participationMode || 'individual') as SaturdayParticipationMode;
    const participationMode: SaturdayParticipationMode = VALID_MODES.has(rawMode)
      ? rawMode
      : 'individual';

    const entry: SaturdayChallengeHistoryEntry = {
      id: `rsh-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
      challengeId: String(body.challengeId || 'stage'),
      challengeTitle: challengeTitle.slice(0, 140),
      category,
      subTypeLabel: String(body.subTypeLabel || SATURDAY_CHALLENGE_CATEGORIES[category].label).slice(0, 90),
      participationMode,
      executedAt: Date.now(),
      ...(typeof body.roomCode === 'string' && body.roomCode.trim()
        ? { roomCode: body.roomCode.trim().slice(0, 16) }
        : {}),
      ...(typeof body.roomTitle === 'string' && body.roomTitle.trim()
        ? { roomTitle: body.roomTitle.trim().slice(0, 100) }
        : {}),
      participantCount: Math.max(0, Number(body.participantCount) || 0),
      winnerName: String(body.winnerName || 'Grupo Juvenil').trim().slice(0, 80),
      winnerScore: Math.max(0, Number(body.winnerScore) || 0),
      resultSummary:
        String(body.resultSummary || '').trim().slice(0, 300) ||
        'Dinámica juvenil realizada en Sociedad de Jóvenes.',
      ...(typeof body.directorNote === 'string' && body.directorNote.trim()
        ? { directorNote: body.directorNote.trim().slice(0, 240) }
        : {}),
    };

    if (!Array.isArray(dbRef.saturdayChallengeHistory)) {
      dbRef.saturdayChallengeHistory = [];
    }
    dbRef.saturdayChallengeHistory.unshift(entry);
    dbRef.saturdayChallengeHistory = dbRef.saturdayChallengeHistory.slice(0, 150);
    deps.scheduleSave();
    res.status(201).json({ entry });
  });
}
