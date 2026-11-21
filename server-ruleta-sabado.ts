import crypto from 'crypto';
import type express from 'express';
import {
  BUILTIN_SATURDAY_ROULETTE_ACTIVITIES,
  getSaturdayRouletteCategoryMeta,
  SATURDAY_ROULETTE_CATEGORIES,
  type SaturdayRouletteActivity,
  type SaturdayRouletteCategoryId,
  type SaturdayRouletteCategoryMeta,
  type SaturdayRouletteHistoryEntry,
  type SaturdayRouletteParticipationMode,
  type SaturdayRoulettePhase,
  type SaturdayRouletteRoomActivityView,
  type SaturdayRouletteRoomState,
  type SaturdayRouletteSubmissionView,
  type SaturdayRouletteValidationGrade,
} from './src/shared/saturdayRouletteData.js';
import type {
  BibleQuestion,
  GameConfig,
  GameStatus,
  LeaderboardEntry,
  Participant,
} from './src/shared/types.js';

export interface SaturdayRouletteServerSubmission {
  participantId: string;
  selectedIndex?: number;
  submittedText?: string;
  completedSignal?: boolean;
  isAutoCorrect?: boolean;
  validationStatus: SaturdayRouletteValidationGrade;
  pointsAwarded: number;
  responseTimeMs: number;
  submittedAt: number;
}

export interface SaturdayRouletteServerInternal {
  phase: SaturdayRoulettePhase;
  participationMode: SaturdayRouletteParticipationMode;
  enabledCategories: SaturdayRouletteCategoryId[];
  allowRespin: boolean;
  configuredTimeSec: number;
  spinNonce: number;
  spinsCount: number;
  targetAngleDeg: number;
  selectedSlotIndex: number;
  selectedCategoryId: SaturdayRouletteCategoryId | null;
  selectedActivityId: string | null;
  targetParticipantId?: string;
  targetTeamId?: string;
  resultRecordedForSpin: boolean;
  recordedSummary?: string;
  submissions: Record<number, Record<string, SaturdayRouletteServerSubmission>>;
  usedActivityIds: string[];
  recentParticipantIds: string[];
  recentTeamIds: string[];
  historyLoggedForSpin: Record<number, boolean>;
}

export interface SaturdayRouletteStoredParticipant extends Participant {
  token: string;
}

export interface SaturdayRouletteStoredGame {
  id: string;
  code: string;
  config: GameConfig;
  status: GameStatus;
  currentQuestionIndex: number;
  questionStartedAt: number | null;
  questionEndsAt: number | null;
  questionLockReason?: 'timeout' | 'all_answered';
  questions: Array<
    (BibleQuestion & { isSpecialMultiplier: number; roundStage?: string }) | Record<string, unknown>
  >;
  participants: Record<string, SaturdayRouletteStoredParticipant>;
  answers: Record<number, Record<string, unknown>>;
  evaluatedEliminations: number[];
  finishedAt: number | null;
  saturdayRouletteInternal?: SaturdayRouletteServerInternal;
}

export interface SaturdayRouletteDatabaseSlice {
  saturdayRouletteCustomActivities: SaturdayRouletteActivity[];
  saturdayRouletteRecentIds: string[];
  saturdayRouletteHistory: SaturdayRouletteHistoryEntry[];
}

export interface SaturdayRouletteRoutesDeps {
  getDb: () => SaturdayRouletteDatabaseSlice;
  scheduleSave: () => void;
}

export interface SaturdayRouletteActionHelpers {
  startQuestionAt: (game: any, index: number) => void;
  finishGame: (game: any) => void;
  buildLeaderboard: (game: any) => LeaderboardEntry[];
  broadcastRoom: (code: string) => void;
  scheduleSave: () => void;
  sendWsError: (message: string) => void;
}

const VALID_CATEGORY_IDS = new Set<SaturdayRouletteCategoryId>(
  SATURDAY_ROULETTE_CATEGORIES.map((c) => c.id)
);

const VALID_MODES = new Set<SaturdayRouletteParticipationMode>([
  'individual',
  'parejas',
  'equipos',
  'congregacion',
]);

const VALID_GRADES = new Set<SaturdayRouletteValidationGrade>([
  'pending',
  'featured',
  'approved',
  'participation',
  'rejected',
]);

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function ensureSaturdayRouletteSlice(
  db: Partial<SaturdayRouletteDatabaseSlice>
): SaturdayRouletteDatabaseSlice {
  return {
    saturdayRouletteCustomActivities: Array.isArray(db.saturdayRouletteCustomActivities)
      ? db.saturdayRouletteCustomActivities
      : [],
    saturdayRouletteRecentIds: Array.isArray(db.saturdayRouletteRecentIds)
      ? db.saturdayRouletteRecentIds
      : [],
    saturdayRouletteHistory: Array.isArray(db.saturdayRouletteHistory)
      ? db.saturdayRouletteHistory
      : [],
  };
}

export function getCombinedSaturdayRouletteActivities(
  db: SaturdayRouletteDatabaseSlice
): SaturdayRouletteActivity[] {
  return [
    ...(db.saturdayRouletteCustomActivities || []),
    ...BUILTIN_SATURDAY_ROULETTE_ACTIVITIES,
  ];
}

function sanitizeEnabledCategories(raw: unknown): SaturdayRouletteCategoryId[] {
  const ordered = SATURDAY_ROULETTE_CATEGORIES.map((c) => c.id);
  if (!Array.isArray(raw)) return ordered;
  const rawSet = new Set(
    raw
      .map((id) => String(id || '').trim() as SaturdayRouletteCategoryId)
      .filter((id) => VALID_CATEGORY_IDS.has(id))
  );
  const filtered = ordered.filter((id) => rawSet.has(id));
  return filtered.length >= 2 ? filtered : ordered;
}

export function pickRouletteSpinResult(
  db: SaturdayRouletteDatabaseSlice,
  opts: {
    enabledCategories: SaturdayRouletteCategoryId[];
    sessionUsedIds?: string[];
    lastCategoryId?: SaturdayRouletteCategoryId | null;
    recordRecent?: boolean;
  }
): {
  slotIndex: number;
  category: SaturdayRouletteCategoryMeta;
  activity: SaturdayRouletteActivity;
} {
  const activeCategories =
    opts.enabledCategories.length >= 1
      ? opts.enabledCategories
      : SATURDAY_ROULETTE_CATEGORIES.map((c) => c.id);

  const all = getCombinedSaturdayRouletteActivities(db);
  const sessionUsedSet = new Set(opts.sessionUsedIds || []);
  const recentIds = db.saturdayRouletteRecentIds || [];
  const recentSet = new Set(recentIds);
  const recentRank = new Map<string, number>();
  recentIds.forEach((id, idx) => recentRank.set(id, idx));

  // Prefer active categories that aren't identical to the previous spin when possible
  let candidateCategories =
    activeCategories.length > 1 && opts.lastCategoryId
      ? activeCategories.filter((c) => c !== opts.lastCategoryId)
      : [...activeCategories];
  if (candidateCategories.length === 0) {
    candidateCategories = [...activeCategories];
  }

  // Prefer categories that still have fresh (non-session-used & non-recent) activities
  const categoriesWithFresh = candidateCategories.filter((catId) =>
    all.some(
      (a) =>
        a.categoryId === catId &&
        !sessionUsedSet.has(a.id) &&
        !recentSet.has(a.id)
    )
  );
  const categoriesWithSessionFresh = candidateCategories.filter((catId) =>
    all.some((a) => a.categoryId === catId && !sessionUsedSet.has(a.id))
  );

  const catPool =
    categoriesWithFresh.length > 0
      ? categoriesWithFresh
      : categoriesWithSessionFresh.length > 0
        ? categoriesWithSessionFresh
        : candidateCategories;

  const chosenCategoryId = catPool[Math.floor(Math.random() * catPool.length)];
  const slotIndex = Math.max(0, activeCategories.indexOf(chosenCategoryId));
  const category = getSaturdayRouletteCategoryMeta(chosenCategoryId);

  const catActivities = all.filter((a) => a.categoryId === chosenCategoryId);
  const freshInCat = shuffleArray(
    catActivities.filter((a) => !sessionUsedSet.has(a.id) && !recentSet.has(a.id))
  );
  const notInSessionInCat = shuffleArray(
    catActivities.filter((a) => !sessionUsedSet.has(a.id))
  ).sort((a, b) => (recentRank.get(a.id) ?? -1) - (recentRank.get(b.id) ?? -1));
  const fallbackStale = [...catActivities].sort(
    (a, b) => (recentRank.get(a.id) ?? -1) - (recentRank.get(b.id) ?? -1)
  );

  const activity =
    freshInCat[0] ||
    notInSessionInCat[0] ||
    fallbackStale[0] ||
    BUILTIN_SATURDAY_ROULETTE_ACTIVITIES[0];

  if (opts.recordRecent !== false && activity) {
    const maxRecentWindow = Math.max(12, Math.floor(all.length * 0.72));
    const nextRecent = recentIds.filter((id) => id !== activity.id);
    nextRecent.push(activity.id);
    db.saturdayRouletteRecentIds = nextRecent.slice(-maxRecentWindow);
  }

  return { slotIndex, category, activity };
}

function computeNextWheelAngle(
  prevAngle: number,
  slotIndex: number,
  totalSlots: number
): number {
  const safeTotal = Math.max(1, totalSlots);
  const sliceDeg = 360 / safeTotal;
  const offset = (360 - (slotIndex * sliceDeg + sliceDeg / 2)) % 360;
  return Math.floor(prevAngle / 360) * 360 + 1440 + offset;
}

export function initSaturdayRouletteForGame(
  game: SaturdayRouletteStoredGame,
  body: Record<string, unknown>
): void {
  if (game.config.mode !== 'ruleta_sabado') return;

  const rawMode = String(body.participationMode || 'individual') as SaturdayRouletteParticipationMode;
  const participationMode: SaturdayRouletteParticipationMode = VALID_MODES.has(rawMode)
    ? rawMode
    : 'individual';
  const enabledCategories = sanitizeEnabledCategories(body.enabledCategories);
  const allowRespin = body.allowRespin !== false;
  const configuredTimeSec = Math.max(
    10,
    Math.min(240, Number(body.timeLimitSec) || 45)
  );

  game.config.timeLimitSec = configuredTimeSec;
  game.config.rouletteConfig = {
    enabledCategories,
    allowRespin,
    participationMode,
  };

  // Maintain placeholder first question for clean client metadata display in waiting room
  game.questions = [
    {
      id: 'q-ruleta-sabado-init',
      group: 'Categorías Especiales',
      category: 'Ruleta del Sábado',
      difficulty: 'intermedio',
      prompt: 'Gira la Ruleta del Sábado para revelar la primera actividad.',
      options: ['Completado'],
      correctIndex: 0,
      reference: 'Colosenses 3:16',
      isSpecialMultiplier: 1,
    },
  ];
  game.config.questionCount = Math.max(1, Number(body.questionCount) || 12);

  game.saturdayRouletteInternal = {
    phase: 'lobby',
    participationMode,
    enabledCategories,
    allowRespin,
    configuredTimeSec,
    spinNonce: 0,
    spinsCount: 0,
    targetAngleDeg: 0,
    selectedSlotIndex: 0,
    selectedCategoryId: null,
    selectedActivityId: null,
    resultRecordedForSpin: false,
    submissions: {},
    usedActivityIds: [],
    recentParticipantIds: [],
    recentTeamIds: [],
    historyLoggedForSpin: {},
  };
}

export function buildSaturdayRouletteClientView(
  game: SaturdayRouletteStoredGame,
  role: 'presenter' | 'projector' | 'participant',
  participantId: string | undefined,
  db: SaturdayRouletteDatabaseSlice
): SaturdayRouletteRoomState | undefined {
  const internal = game.saturdayRouletteInternal;
  if (!internal) return undefined;

  const all = getCombinedSaturdayRouletteActivities(db);
  const rawActivity = internal.selectedActivityId
    ? all.find((a) => a.id === internal.selectedActivityId) || null
    : null;

  const isRevealed =
    game.status === 'answer_revealed' ||
    game.status === 'finished' ||
    internal.resultRecordedForSpin;
  const showSecretFields = isRevealed || role === 'presenter';

  let currentActivity: SaturdayRouletteRoomActivityView | null = null;
  if (rawActivity) {
    const catMeta = getSaturdayRouletteCategoryMeta(rawActivity.categoryId);
    currentActivity = {
      id: rawActivity.id,
      categoryId: rawActivity.categoryId,
      categoryLabel: catMeta.label,
      categoryColor: catMeta.color,
      title: rawActivity.title,
      instructions: rawActivity.instructions,
      suggestedSec: rawActivity.suggestedSec,
      evaluationType: rawActivity.evaluationType,
      ...(rawActivity.options ? { options: rawActivity.options } : {}),
      ...(showSecretFields
        ? {
            correctIndex: rawActivity.correctIndex,
            reference: rawActivity.reference,
            guideAnswer: rawActivity.guideAnswer,
          }
        : rawActivity.evaluationType === 'director_review'
          ? { reference: rawActivity.reference }
          : {}),
    };
  }

  const spinIdx = Math.max(0, internal.spinsCount - 1);
  const rawSubMap =
    internal.spinsCount > 0 ? internal.submissions[spinIdx] || {} : {};
  const canExposeOutcome =
    isRevealed ||
    role === 'presenter' ||
    rawActivity?.evaluationType === 'director_review';

  const toView = (
    sub: SaturdayRouletteServerSubmission
  ): SaturdayRouletteSubmissionView => {
    const p = game.participants[sub.participantId];
    return {
      participantId: sub.participantId,
      participantName: p?.name || 'Participante',
      avatarId: p?.avatarId || 'crown',
      photoUrl: p?.photoUrl,
      teamId: p?.teamId,
      ...(sub.submittedText !== undefined ? { submittedText: sub.submittedText } : {}),
      ...(canExposeOutcome && sub.selectedIndex !== undefined
        ? { selectedIndex: sub.selectedIndex }
        : {}),
      ...(sub.completedSignal !== undefined
        ? { completedSignal: sub.completedSignal }
        : {}),
      ...(canExposeOutcome && sub.isAutoCorrect !== undefined
        ? { isAutoCorrect: sub.isAutoCorrect }
        : {}),
      validationStatus: sub.validationStatus,
      pointsAwarded: canExposeOutcome ? sub.pointsAwarded : 0,
      responseTimeMs: sub.responseTimeMs,
    };
  };

  let mySubmission: SaturdayRouletteSubmissionView | null = null;
  if (participantId && rawSubMap[participantId]) {
    const rawMine = rawSubMap[participantId];
    mySubmission = {
      ...toView(rawMine),
      ...(rawMine.selectedIndex !== undefined
        ? { selectedIndex: rawMine.selectedIndex }
        : {}),
    };
  }

  const submissions =
    role === 'presenter' ||
    isRevealed ||
    rawActivity?.evaluationType === 'director_review'
      ? Object.values(rawSubMap)
          .sort(
            (a, b) =>
              b.pointsAwarded - a.pointsAwarded || a.responseTimeMs - b.responseTimeMs
          )
          .map(toView)
      : [];

  const targetParticipant = internal.targetParticipantId
    ? game.participants[internal.targetParticipantId]
    : undefined;
  const targetTeam = internal.targetTeamId
    ? game.config.teams?.find((t) => t.id === internal.targetTeamId)
    : undefined;

  return {
    phase: internal.phase,
    participationMode: internal.participationMode,
    enabledCategories: internal.enabledCategories,
    allowRespin: internal.allowRespin,
    configuredTimeSec: internal.configuredTimeSec,
    spinNonce: internal.spinNonce,
    spinsCount: internal.spinsCount,
    targetAngleDeg: internal.targetAngleDeg,
    selectedSlotIndex: internal.selectedSlotIndex,
    selectedCategoryId: internal.selectedCategoryId,
    currentActivity,
    ...(targetParticipant
      ? {
          targetParticipantId: targetParticipant.id,
          targetParticipantName: targetParticipant.name,
        }
      : {}),
    ...(targetTeam
      ? {
          targetTeamId: targetTeam.id,
          targetTeamName: targetTeam.name,
          targetTeamColor: targetTeam.color,
        }
      : {}),
    resultRecordedForSpin: internal.resultRecordedForSpin,
    ...(internal.recordedSummary ? { recordedSummary: internal.recordedSummary } : {}),
    mySubmission,
    submissions,
    usedActivityIds: internal.usedActivityIds,
  };
}

function pickRandomTargetForSpin(
  game: SaturdayRouletteStoredGame,
  internal: SaturdayRouletteServerInternal,
  explicitParticipantId?: string,
  explicitTeamId?: string
): { targetParticipantId?: string; targetTeamId?: string } {
  const participants = Object.values(game.participants).filter((p) => !p.eliminated);
  const onlineParticipants = participants.filter((p) => p.online);
  const candidatePlayers =
    onlineParticipants.length > 0 ? onlineParticipants : participants;

  if (internal.participationMode === 'congregacion') {
    return {};
  }

  if (
    internal.participationMode === 'parejas' ||
    internal.participationMode === 'equipos'
  ) {
    if (explicitTeamId && game.config.teams?.some((t) => t.id === explicitTeamId)) {
      return { targetTeamId: explicitTeamId };
    }
    const teams = game.config.teams || [];
    const populated = teams.filter((t) =>
      candidatePlayers.some((p) => p.teamId === t.id)
    );
    const pool = populated.length > 0 ? populated : teams;
    if (pool.length === 0) return {};

    const unpicked = pool.filter((t) => !internal.recentTeamIds.includes(t.id));
    const choicePool = unpicked.length > 0 ? unpicked : pool;
    const chosen = choicePool[Math.floor(Math.random() * choicePool.length)];
    internal.recentTeamIds = [
      ...internal.recentTeamIds.filter((id) => id !== chosen.id),
      chosen.id,
    ].slice(-Math.max(1, pool.length - 1));
    return { targetTeamId: chosen.id };
  }

  // Individual mode
  if (explicitParticipantId && game.participants[explicitParticipantId]) {
    return { targetParticipantId: explicitParticipantId };
  }
  if (candidatePlayers.length === 0) return {};
  const unpicked = candidatePlayers.filter(
    (p) => !internal.recentParticipantIds.includes(p.id)
  );
  const choicePool = unpicked.length > 0 ? unpicked : candidatePlayers;
  const chosen = choicePool[Math.floor(Math.random() * choicePool.length)];
  internal.recentParticipantIds = [
    ...internal.recentParticipantIds.filter((id) => id !== chosen.id),
    chosen.id,
  ].slice(-Math.max(1, candidatePlayers.length - 1));
  return { targetParticipantId: chosen.id };
}

function getAwardedPoints(
  grade: SaturdayRouletteValidationGrade,
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

  if (grade === 'featured') return Math.round(basePoints * 1.3) + speedBonus;
  if (grade === 'approved') return basePoints + speedBonus;
  if (grade === 'participation') return Math.round(basePoints * 0.5);
  return 0;
}

function logSpinHistoryEntry(
  db: SaturdayRouletteDatabaseSlice,
  params: {
    spinNumber: number;
    categoryId: SaturdayRouletteCategoryId;
    activityId: string;
    activityTitle: string;
    participationMode: SaturdayRouletteParticipationMode;
    participantName: string;
    grade: SaturdayRouletteValidationGrade;
    pointsAwarded: number;
    durationSec: number;
    roomCode?: string;
    note?: string;
  }
): SaturdayRouletteHistoryEntry {
  const catMeta = getSaturdayRouletteCategoryMeta(params.categoryId);
  const entry: SaturdayRouletteHistoryEntry = {
    id: `srh-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
    spinNumber: params.spinNumber,
    categoryId: params.categoryId,
    categoryLabel: catMeta.label,
    activityId: params.activityId,
    activityTitle: params.activityTitle.slice(0, 140),
    participationMode: params.participationMode,
    participantName: params.participantName.slice(0, 80) || 'Participación en vivo',
    grade: params.grade,
    pointsAwarded: Math.max(0, params.pointsAwarded),
    durationSec: Math.max(10, params.durationSec),
    ...(params.roomCode ? { roomCode: params.roomCode } : {}),
    ...(params.note ? { note: params.note.slice(0, 220) } : {}),
    executedAt: Date.now(),
  };

  if (!Array.isArray(db.saturdayRouletteHistory)) {
    db.saturdayRouletteHistory = [];
  }
  db.saturdayRouletteHistory.unshift(entry);
  db.saturdayRouletteHistory = db.saturdayRouletteHistory.slice(0, 200);
  return entry;
}

export function handleSaturdayRoulettePresenterAction(
  game: SaturdayRouletteStoredGame,
  action: string,
  msg: Record<string, unknown>,
  helpers: SaturdayRouletteActionHelpers,
  db: SaturdayRouletteDatabaseSlice
): boolean {
  const internal = game.saturdayRouletteInternal;
  if (game.config.mode !== 'ruleta_sabado' || !internal) {
    return false;
  }

  if (action === 'set_roulette_config') {
    if (Array.isArray(msg.enabledCategories)) {
      const sanitized = sanitizeEnabledCategories(msg.enabledCategories);
      internal.enabledCategories = sanitized;
      if (game.config.rouletteConfig) {
        game.config.rouletteConfig.enabledCategories = sanitized;
      }
    }
    if (typeof msg.allowRespin === 'boolean') {
      internal.allowRespin = msg.allowRespin;
      if (game.config.rouletteConfig) {
        game.config.rouletteConfig.allowRespin = msg.allowRespin;
      }
    }
    if (typeof msg.configuredTimeSec === 'number') {
      const clamped = Math.max(10, Math.min(240, Math.round(msg.configuredTimeSec)));
      internal.configuredTimeSec = clamped;
      game.config.timeLimitSec = clamped;
    }
    if (typeof msg.targetParticipantId === 'string') {
      const pid = msg.targetParticipantId.trim();
      internal.targetParticipantId =
        pid && game.participants[pid] ? pid : undefined;
    }
    if (typeof msg.targetTeamId === 'string') {
      const tid = msg.targetTeamId.trim();
      internal.targetTeamId =
        tid && game.config.teams?.some((t) => t.id === tid) ? tid : undefined;
    }
    if (typeof msg.selectedActivityId === 'string') {
      const all = getCombinedSaturdayRouletteActivities(db);
      const found = all.find((a) => a.id === msg.selectedActivityId);
      if (found) {
        internal.selectedActivityId = found.id;
        internal.selectedCategoryId = found.categoryId;
        const slotIdx = internal.enabledCategories.indexOf(found.categoryId);
        if (slotIdx >= 0) {
          internal.selectedSlotIndex = slotIdx;
          internal.targetAngleDeg = computeNextWheelAngle(
            internal.targetAngleDeg,
            slotIdx,
            internal.enabledCategories.length
          );
        }
        if (!internal.usedActivityIds.includes(found.id)) {
          internal.usedActivityIds.push(found.id);
        }
      }
    }

    helpers.scheduleSave();
    helpers.broadcastRoom(game.code);
    return true;
  }

  if (action === 'spin_saturday_roulette' || action === 'start_game') {
    const isRespinAction =
      internal.spinsCount > 0 &&
      internal.phase === 'spinning_revealed' &&
      !internal.resultRecordedForSpin;

    if (isRespinAction && !internal.allowRespin) {
      helpers.sendWsError(
        'El permiso para girar nuevamente está desactivado por el director. Inicia el reto o habilita el regiro en controles.'
      );
      return true;
    }

    if (
      action === 'start_game' &&
      (internal.participationMode === 'parejas' ||
        internal.participationMode === 'equipos')
    ) {
      const pList = Object.values(game.participants);
      if (pList.length < 2) {
        helpers.sendWsError(
          'Se necesitan al menos 2 participantes en la sala para iniciar en modo parejas o equipos.'
        );
        return true;
      }
    }

    const picked = pickRouletteSpinResult(db, {
      enabledCategories: internal.enabledCategories,
      sessionUsedIds: internal.usedActivityIds,
      lastCategoryId: internal.selectedCategoryId,
      recordRecent: true,
    });

    const spinIndex = internal.spinsCount;
    internal.spinsCount += 1;
    internal.spinNonce += 1;
    internal.selectedSlotIndex = picked.slotIndex;
    internal.selectedCategoryId = picked.category.id;
    internal.selectedActivityId = picked.activity.id;
    internal.targetAngleDeg = computeNextWheelAngle(
      internal.targetAngleDeg,
      picked.slotIndex,
      internal.enabledCategories.length
    );

    if (!internal.usedActivityIds.includes(picked.activity.id)) {
      internal.usedActivityIds.push(picked.activity.id);
    }

    const targetSelection = pickRandomTargetForSpin(
      game,
      internal,
      typeof msg.targetParticipantId === 'string' ? msg.targetParticipantId : undefined,
      typeof msg.targetTeamId === 'string' ? msg.targetTeamId : undefined
    );
    internal.targetParticipantId = targetSelection.targetParticipantId;
    internal.targetTeamId = targetSelection.targetTeamId;

    if (typeof msg.timeLimitSec === 'number') {
      internal.configuredTimeSec = Math.max(
        10,
        Math.min(240, Math.round(msg.timeLimitSec))
      );
    } else if (msg.useSuggestedTime !== false) {
      internal.configuredTimeSec = picked.activity.suggestedSec;
    }
    game.config.timeLimitSec = internal.configuredTimeSec;

    internal.phase = 'spinning_revealed';
    internal.resultRecordedForSpin = false;
    internal.recordedSummary = undefined;

    game.questions[spinIndex] = {
      id: `q-rsab-${spinIndex}-${picked.activity.id}`,
      group: 'Categorías Especiales',
      category: picked.category.label,
      difficulty: 'intermedio',
      prompt: `${picked.activity.title}: ${picked.activity.instructions}`,
      options: picked.activity.options || ['Actividad completada'],
      correctIndex:
        typeof picked.activity.correctIndex === 'number'
          ? picked.activity.correctIndex
          : 0,
      reference: picked.activity.reference,
      explanation: picked.activity.guideAnswer,
      isSpecialMultiplier: 1,
    };

    game.currentQuestionIndex = spinIndex;
    game.questionLockReason = undefined;
    game.questionStartedAt = null;
    game.questionEndsAt = null;
    game.status = 'question_locked';

    helpers.scheduleSave();
    helpers.broadcastRoom(game.code);
    return true;
  }

  if (action === 'start_roulette_challenge') {
    if (internal.spinsCount === 0 || !internal.selectedActivityId) {
      helpers.sendWsError('Primero gira la ruleta para seleccionar una actividad.');
      return true;
    }

    if (typeof msg.timeLimitSec === 'number') {
      internal.configuredTimeSec = Math.max(
        10,
        Math.min(240, Math.round(msg.timeLimitSec))
      );
    }
    game.config.timeLimitSec = internal.configuredTimeSec;
    internal.phase = 'challenge_active';

    helpers.startQuestionAt(game, Math.max(0, internal.spinsCount - 1));
    helpers.scheduleSave();
    helpers.broadcastRoom(game.code);
    return true;
  }

  if (action === 'reveal_answer') {
    if (
      game.status === 'question_active' ||
      game.status === 'question_locked'
    ) {
      game.status = 'answer_revealed';
      helpers.scheduleSave();
      helpers.broadcastRoom(game.code);
    }
    return true;
  }

  if (
    action === 'record_roulette_result' ||
    action === 'validate_roulette_result'
  ) {
    const spinIdx = Math.max(0, internal.spinsCount - 1);
    if (!internal.selectedActivityId || !internal.selectedCategoryId) {
      return true;
    }

    const rawGrade = String(
      msg.validationStatus || msg.grade || 'approved'
    ) as SaturdayRouletteValidationGrade;
    const grade: SaturdayRouletteValidationGrade = VALID_GRADES.has(rawGrade)
      ? rawGrade
      : 'approved';

    const applyToAll = Boolean(msg.applyToAll);
    const applyToTeam = Boolean(msg.applyToTeam);
    const explicitPid = String(
      msg.participantId || internal.targetParticipantId || ''
    ).trim();
    const explicitTeamId = String(
      msg.teamId || internal.targetTeamId || ''
    ).trim();

    let targetParticipants: SaturdayRouletteStoredParticipant[] = [];
    if (applyToAll) {
      targetParticipants = Object.values(game.participants).filter(
        (p) => !p.eliminated
      );
    } else if (applyToTeam && explicitTeamId) {
      targetParticipants = Object.values(game.participants).filter(
        (p) => p.teamId === explicitTeamId && !p.eliminated
      );
    } else if (explicitPid && game.participants[explicitPid]) {
      const base = game.participants[explicitPid];
      targetParticipants =
        applyToTeam && base.teamId
          ? Object.values(game.participants).filter(
              (p) => p.teamId === base.teamId && !p.eliminated
            )
          : [base];
    } else if (explicitTeamId) {
      targetParticipants = Object.values(game.participants).filter(
        (p) => p.teamId === explicitTeamId && !p.eliminated
      );
    }

    if (!internal.submissions[spinIdx]) {
      internal.submissions[spinIdx] = {};
    }

    const now = Date.now();
    const startedAt = game.questionStartedAt || now;
    const elapsedFallback = Math.max(1000, now - startedAt);
    let maxPointsAwarded = 0;

    for (const participant of targetParticipants) {
      const existing = internal.submissions[spinIdx][participant.id];
      const usedPhone = Boolean(existing);
      const responseTimeMs = existing ? existing.responseTimeMs : elapsedFallback;
      const newPoints = getAwardedPoints(
        grade,
        game.config.basePoints,
        game.config.speedBonusMax,
        responseTimeMs,
        internal.configuredTimeSec,
        usedPhone
      );
      maxPointsAwarded = Math.max(maxPointsAwarded, newPoints);

      const oldPoints = existing?.pointsAwarded || 0;
      participant.score = Math.max(0, participant.score + (newPoints - oldPoints));

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

      internal.submissions[spinIdx][participant.id] = {
        participantId: participant.id,
        selectedIndex: existing?.selectedIndex,
        submittedText:
          existing?.submittedText ||
          (usedPhone ? undefined : 'Participación presencial en vivo'),
        completedSignal: existing?.completedSignal ?? true,
        isAutoCorrect: nowCorrect,
        validationStatus: grade,
        pointsAwarded: newPoints,
        responseTimeMs,
        submittedAt: existing?.submittedAt || now,
      };
    }

    // If explicitly recording final result of spin (button "Registrar resultado")
    const finalizeSpin = action === 'record_roulette_result' || Boolean(msg.finalizeSpin);
    if (finalizeSpin) {
      const all = getCombinedSaturdayRouletteActivities(db);
      const act = all.find((a) => a.id === internal.selectedActivityId);
      const catMeta = getSaturdayRouletteCategoryMeta(internal.selectedCategoryId);
      const note = typeof msg.note === 'string' ? msg.note.trim() : '';

      const teamObj = explicitTeamId
        ? game.config.teams?.find((t) => t.id === explicitTeamId)
        : undefined;
      const performerName = applyToAll
        ? 'Toda la congregación'
        : teamObj
          ? teamObj.name
          : targetParticipants[0]?.name || 'Participación en vivo';

      internal.resultRecordedForSpin = true;
      internal.phase = 'result_recorded';
      internal.recordedSummary = `${catMeta.label} · ${performerName}${
        maxPointsAwarded > 0 ? ` (+${maxPointsAwarded.toLocaleString('es-CO')} pts)` : ''
      }`;
      game.status = 'answer_revealed';

      if (!internal.historyLoggedForSpin[spinIdx]) {
        internal.historyLoggedForSpin[spinIdx] = true;
        logSpinHistoryEntry(db, {
          spinNumber: internal.spinsCount,
          categoryId: internal.selectedCategoryId,
          activityId: internal.selectedActivityId,
          activityTitle: act?.title || catMeta.label,
          participationMode: internal.participationMode,
          participantName: performerName,
          grade,
          pointsAwarded:
            maxPointsAwarded ||
            getAwardedPoints(
              grade,
              game.config.basePoints,
              0,
              0,
              internal.configuredTimeSec,
              false
            ),
          durationSec: internal.configuredTimeSec,
          roomCode: game.code,
          note,
        });
      }
    }

    helpers.scheduleSave();
    helpers.broadcastRoom(game.code);
    return true;
  }

  if (action === 'next_question') {
    // Convenience alias: spins next round if already recorded or respin permitted
    return handleSaturdayRoulettePresenterAction(
      game,
      'spin_saturday_roulette',
      msg,
      helpers,
      db
    );
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
    initSaturdayRouletteForGame(game, {
      participationMode: internal.participationMode,
      enabledCategories: internal.enabledCategories,
      allowRespin: internal.allowRespin,
      timeLimitSec: internal.configuredTimeSec,
      questionCount: game.config.questionCount,
    });
    helpers.scheduleSave();
    helpers.broadcastRoom(game.code);
    return true;
  }

  return false;
}

export function handleSaturdayRouletteSubmission(
  game: SaturdayRouletteStoredGame,
  participant: SaturdayRouletteStoredParticipant,
  msg: Record<string, unknown>,
  helpers: SaturdayRouletteActionHelpers,
  db: SaturdayRouletteDatabaseSlice
): void {
  const internal = game.saturdayRouletteInternal;
  if (game.config.mode !== 'ruleta_sabado' || !internal) return;

  if (participant.eliminated) {
    helpers.sendWsError('No puedes enviar respuestas en modo espectador.');
    return;
  }

  if (
    game.status !== 'question_active' ||
    internal.phase !== 'challenge_active'
  ) {
    helpers.sendWsError('El reto de este giro aún no ha comenzado o ya finalizó.');
    return;
  }

  const spinIdx = Math.max(0, internal.spinsCount - 1);
  if (!internal.selectedActivityId) return;

  const all = getCombinedSaturdayRouletteActivities(db);
  const activity = all.find((a) => a.id === internal.selectedActivityId);
  if (!activity) return;

  if (!internal.submissions[spinIdx]) {
    internal.submissions[spinIdx] = {};
  }
  if (internal.submissions[spinIdx][participant.id]) {
    return;
  }

  const now = Date.now();
  const startedAt = game.questionStartedAt || now;
  const totalMs = Math.max(1000, internal.configuredTimeSec * 1000);
  const elapsedMs = Math.max(0, Math.min(totalMs, now - startedAt));

  if (activity.evaluationType === 'auto_choice') {
    const selectedIndex = Number(msg.selectedIndex);
    const options = activity.options || [];
    if (
      !Number.isInteger(selectedIndex) ||
      selectedIndex < 0 ||
      selectedIndex >= options.length
    ) {
      return;
    }

    const isCorrect = selectedIndex === (activity.correctIndex ?? 0);
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

    internal.submissions[spinIdx][participant.id] = {
      participantId: participant.id,
      selectedIndex,
      isAutoCorrect: isCorrect,
      validationStatus: isCorrect ? 'approved' : 'rejected',
      pointsAwarded,
      responseTimeMs: elapsedMs,
      submittedAt: now,
    };

    const activeOnline = Object.values(game.participants).filter(
      (p) => p.online && !p.eliminated
    );
    const answeredOnline = activeOnline.filter((p) =>
      Boolean(internal.submissions[spinIdx][p.id])
    ).length;

    if (activeOnline.length > 0 && answeredOnline === activeOnline.length) {
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

    internal.submissions[spinIdx][participant.id] = {
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

export function registerSaturdayRouletteRoutes(
  app: express.Express,
  deps: SaturdayRouletteRoutesDeps
): void {
  // 1. Library of all 12 categories + built-in & custom activities + recent tracking
  app.get('/api/saturday-roulette/library', (_req, res) => {
    const dbRef = deps.getDb();
    const activities = getCombinedSaturdayRouletteActivities(dbRef);
    res.json({
      categories: SATURDAY_ROULETTE_CATEGORIES,
      activities,
      recentIds: dbRef.saturdayRouletteRecentIds || [],
      totalCount: activities.length,
    });
  });

  // 2. Stage spin with anti-repeat tracking and active category filter
  app.post('/api/saturday-roulette/spin', (req, res) => {
    const dbRef = deps.getDb();
    const body = req.body || {};
    const enabledCategories = sanitizeEnabledCategories(body.enabledCategories);
    const sessionUsedIds = Array.isArray(body.sessionUsedIds)
      ? body.sessionUsedIds.map((id: unknown) => String(id || ''))
      : [];
    const lastCategoryId = VALID_CATEGORY_IDS.has(body.lastCategoryId)
      ? (body.lastCategoryId as SaturdayRouletteCategoryId)
      : null;

    const picked = pickRouletteSpinResult(dbRef, {
      enabledCategories,
      sessionUsedIds,
      lastCategoryId,
      recordRecent: true,
    });

    deps.scheduleSave();
    res.json({
      slotIndex: picked.slotIndex,
      category: picked.category,
      activity: picked.activity,
      recentCount: (dbRef.saturdayRouletteRecentIds || []).length,
    });
  });

  // 3. Add custom activity to any of the 12 categories
  app.post('/api/saturday-roulette/custom', (req, res) => {
    const dbRef = deps.getDb();
    const body = req.body || {};

    const rawCat = String(body.categoryId || 'pregunta_biblica') as SaturdayRouletteCategoryId;
    const categoryId: SaturdayRouletteCategoryId = VALID_CATEGORY_IDS.has(rawCat)
      ? rawCat
      : 'pregunta_biblica';
    const title = String(body.title || '').trim().slice(0, 120);
    const instructions = String(body.instructions || '').trim().slice(0, 500);
    const reference =
      String(body.reference || '').trim().slice(0, 120) || 'Palabra de Dios';
    const guideAnswer = String(body.guideAnswer || '').trim().slice(0, 350);
    const suggestedSec = Math.max(
      10,
      Math.min(240, Number(body.suggestedSec) || 45)
    );
    const evaluationType =
      body.evaluationType === 'auto_choice' ? 'auto_choice' : 'director_review';

    const options =
      evaluationType === 'auto_choice' && Array.isArray(body.options)
        ? body.options.map((o: unknown) => String(o || '').trim()).filter(Boolean)
        : undefined;
    const correctIndex =
      evaluationType === 'auto_choice' ? Number(body.correctIndex) : undefined;

    if (!title || !instructions) {
      res.status(400).json({
        error: 'Escribe un título y las instrucciones claras para la actividad.',
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
        error:
          'Si usas opción múltiple, agrega al menos 2 respuestas y selecciona la correcta.',
      });
      return;
    }

    const newAct: SaturdayRouletteActivity = {
      id: `src-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
      categoryId,
      title,
      instructions,
      reference,
      suggestedSec,
      evaluationType,
      ...(options ? { options, correctIndex } : {}),
      ...(guideAnswer ? { guideAnswer } : {}),
      isCustom: true,
    };

    if (!Array.isArray(dbRef.saturdayRouletteCustomActivities)) {
      dbRef.saturdayRouletteCustomActivities = [];
    }
    dbRef.saturdayRouletteCustomActivities.unshift(newAct);
    deps.scheduleSave();
    res.status(201).json({ activity: newAct });
  });

  // 4. Delete custom activity
  app.delete('/api/saturday-roulette/custom/:id', (req, res) => {
    const id = String(req.params.id || '').trim();
    const dbRef = deps.getDb();
    const before = (dbRef.saturdayRouletteCustomActivities || []).length;
    dbRef.saturdayRouletteCustomActivities = (
      dbRef.saturdayRouletteCustomActivities || []
    ).filter((a) => a.id !== id);
    if (dbRef.saturdayRouletteCustomActivities.length === before) {
      res.status(404).json({
        error: 'Solo se pueden eliminar actividades personalizadas creadas por el director.',
      });
      return;
    }
    dbRef.saturdayRouletteRecentIds = (
      dbRef.saturdayRouletteRecentIds || []
    ).filter((rid) => rid !== id);
    deps.scheduleSave();
    res.json({ deleted: true, id });
  });

  // 5. History of spins & recorded results
  app.get('/api/saturday-roulette/history', (_req, res) => {
    const dbRef = deps.getDb();
    res.json({
      history: dbRef.saturdayRouletteHistory || [],
    });
  });

  app.post('/api/saturday-roulette/history', (req, res) => {
    const dbRef = deps.getDb();
    const body = req.body || {};

    const rawCat = String(body.categoryId || 'pregunta_biblica') as SaturdayRouletteCategoryId;
    const categoryId: SaturdayRouletteCategoryId = VALID_CATEGORY_IDS.has(rawCat)
      ? rawCat
      : 'pregunta_biblica';
    const rawMode = String(body.participationMode || 'individual') as SaturdayRouletteParticipationMode;
    const participationMode: SaturdayRouletteParticipationMode = VALID_MODES.has(rawMode)
      ? rawMode
      : 'individual';
    const rawGrade = String(body.grade || 'approved') as SaturdayRouletteValidationGrade;
    const grade: SaturdayRouletteValidationGrade = VALID_GRADES.has(rawGrade)
      ? rawGrade
      : 'approved';

    const activityTitle = String(body.activityTitle || '').trim();
    if (!activityTitle) {
      res.status(400).json({ error: 'Falta el título de la actividad registrada.' });
      return;
    }

    const entry = logSpinHistoryEntry(dbRef, {
      spinNumber: Math.max(1, Number(body.spinNumber) || 1),
      categoryId,
      activityId: String(body.activityId || 'stage'),
      activityTitle,
      participationMode,
      participantName: String(body.participantName || 'Sociedad de Jóvenes').trim(),
      grade,
      pointsAwarded: Math.max(0, Number(body.pointsAwarded) || 0),
      durationSec: Math.max(10, Number(body.durationSec) || 45),
      ...(typeof body.roomCode === 'string' && body.roomCode.trim()
        ? { roomCode: body.roomCode.trim().slice(0, 16) }
        : {}),
      ...(typeof body.note === 'string' && body.note.trim()
        ? { note: body.note.trim() }
        : {}),
    });

    deps.scheduleSave();
    res.status(201).json({ entry });
  });
}
