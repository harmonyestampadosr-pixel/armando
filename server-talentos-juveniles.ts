import crypto from 'crypto';
import type express from 'express';
import {
  getTalentCategoryMeta,
  TALENT_CATEGORIES,
  TALENT_ENCOURAGEMENT_MESSAGES,
  TALENT_POSITIVE_REACTIONS,
  TALENT_RECOGNITION_TITLES,
  type TalentAudienceAppreciation,
  type TalentCategoryId,
  type TalentCertificateRecord,
  type TalentEntry,
  type TalentEntryStatus,
  type TalentJuryEvaluation,
  type TalentJuryMember,
  type TalentPrivacyControls,
  type TalentPublicEntryView,
  type TalentReactionId,
  type TalentRoomState,
  type TalentShowcaseSession,
  type TalentStageScreen,
} from './src/shared/talentShowData.js';
import type {
  BibleQuestion,
  GameConfig,
  GameStatus,
  LeaderboardEntry,
  Participant,
} from './src/shared/types.js';

export interface TalentDatabaseSlice {
  talentShowcase: TalentShowcaseSession;
}

export interface TalentStoredParticipant extends Participant {
  token: string;
}

export interface TalentStoredGame {
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
  participants: Record<string, TalentStoredParticipant>;
  answers: Record<number, Record<string, unknown>>;
  evaluatedEliminations: number[];
  finishedAt: number | null;
  talentRoomInternal?: TalentShowcaseSession;
}

export interface TalentRoutesDeps {
  getDb: () => TalentDatabaseSlice;
  scheduleSave: () => void;
}

export interface TalentActionHelpers {
  finishGame: (game: any) => void;
  buildLeaderboard: (game: any) => LeaderboardEntry[];
  broadcastRoom: (code: string) => void;
  scheduleSave: () => void;
  sendWsError: (message: string) => void;
}

const VALID_CATEGORIES = new Set<TalentCategoryId>(
  TALENT_CATEGORIES.map((c) => c.id)
);

const VALID_REACTIONS = new Set<TalentReactionId>(
  TALENT_POSITIVE_REACTIONS.map((r) => r.id)
);

const VALID_SCREENS = new Set<TalentStageScreen>([
  'waiting',
  'presentation',
  'recognition',
]);

const DISALLOWED_NEGATIVE_WORDS = [
  'tonto',
  'estupido',
  'horrible',
  'feo',
  'malo',
  'basura',
  'idiota',
  'ridiculo',
  'asqueroso',
  'aburrido',
  'pesimo',
  'inutil',
  'perdedor',
  'fracaso',
];

function createDefaultPrivacy(): TalentPrivacyControls {
  return {
    showNamesOnScreen: true,
    showPhotosOnScreen: false,
    showDescriptionsOnScreen: true,
    showJuryFeedbackOnScreen: false,
    showAudiencePraiseOnFinal: true,
  };
}

export function createEmptyTalentShowcaseSession(): TalentShowcaseSession {
  return {
    id: `ts-${Date.now().toString(36)}`,
    programTitle: 'Noche de Talentos Juveniles — Sociedad de Jóvenes',
    directorName: 'Dirección de Sociedad de Jóvenes',
    currentScreen: 'waiting',
    activeEntryId: null,
    openingNonce: 0,
    timerRunning: false,
    timerStartedAt: null,
    timerEndsAt: null,
    timerPausedRemainingSec: null,
    audienceVotingEnabled: false,
    juryEnabled: false,
    privacy: createDefaultPrivacy(),
    entries: [],
    juryMembers: [
      { id: 'jury-1', name: 'Pastor / Consejero', roleTitle: 'Evaluación Espiritual' },
      { id: 'jury-2', name: 'Director de Jóvenes', roleTitle: 'Preparación y Entrega' },
    ],
    juryEvaluations: [],
    appreciations: [],
    certificates: [],
    updatedAt: Date.now(),
  };
}

export function ensureTalentDatabaseSlice(
  db: Partial<TalentDatabaseSlice>
): TalentDatabaseSlice {
  const existing = db.talentShowcase;
  if (!existing || typeof existing !== 'object') {
    const fresh = createEmptyTalentShowcaseSession();
    db.talentShowcase = fresh;
    return { talentShowcase: fresh };
  }
  const defaults = createEmptyTalentShowcaseSession();
  existing.id = existing.id || defaults.id;
  existing.programTitle = existing.programTitle || defaults.programTitle;
  existing.directorName = existing.directorName || defaults.directorName;
  existing.currentScreen = existing.currentScreen || defaults.currentScreen;
  if (existing.activeEntryId === undefined) existing.activeEntryId = null;
  if (typeof existing.openingNonce !== 'number') existing.openingNonce = 0;
  if (typeof existing.timerRunning !== 'boolean') existing.timerRunning = false;
  if (existing.timerStartedAt === undefined) existing.timerStartedAt = null;
  if (existing.timerEndsAt === undefined) existing.timerEndsAt = null;
  if (existing.timerPausedRemainingSec === undefined) {
    existing.timerPausedRemainingSec = null;
  }
  if (typeof existing.audienceVotingEnabled !== 'boolean') {
    existing.audienceVotingEnabled = false;
  }
  if (typeof existing.juryEnabled !== 'boolean') {
    existing.juryEnabled = false;
  }
  existing.privacy = {
    ...createDefaultPrivacy(),
    ...(existing.privacy || {}),
  };
  if (!Array.isArray(existing.entries)) existing.entries = [];
  if (!Array.isArray(existing.juryMembers)) {
    existing.juryMembers = defaults.juryMembers;
  }
  if (!Array.isArray(existing.juryEvaluations)) existing.juryEvaluations = [];
  if (!Array.isArray(existing.appreciations)) existing.appreciations = [];
  if (!Array.isArray(existing.certificates)) existing.certificates = [];
  if (typeof existing.updatedAt !== 'number') existing.updatedAt = Date.now();
  return { talentShowcase: existing };
}

function validateSafeImageDataUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const match = trimmed.match(
    /^data:image\/(webp|jpeg|jpg|png);base64,([A-Za-z0-9+/=]+)$/
  );
  if (!match) return undefined;
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length < 64 || bytes.length > 350 * 1024) return undefined;
  return trimmed;
}

function sanitizeRespectfulComment(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const cleaned = raw.trim().slice(0, 260);
  if (!cleaned) return fallback;
  const normalized = cleaned
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (DISALLOWED_NEGATIVE_WORDS.some((bad) => normalized.includes(bad))) {
    return fallback;
  }
  return cleaned;
}

function resolvePublicName(
  entry: TalentEntry,
  privacy: TalentPrivacyControls,
  fallbackIndex: number
): string {
  if (
    privacy.showNamesOnScreen &&
    entry.consentNamePublic &&
    entry.directorApprovedDisplay
  ) {
    return entry.participantName;
  }
  return entry.displayAlias || `Joven Participante #${fallbackIndex + 1}`;
}

function computeRemainingSec(session: TalentShowcaseSession): number {
  const activeEntry = session.activeEntryId
    ? session.entries.find((e) => e.id === session.activeEntryId)
    : undefined;
  const defaultSec = activeEntry?.durationSec || 120;

  if (session.timerRunning && session.timerEndsAt) {
    return Math.max(0, Math.ceil((session.timerEndsAt - Date.now()) / 1000));
  }
  if (typeof session.timerPausedRemainingSec === 'number') {
    return Math.max(0, session.timerPausedRemainingSec);
  }
  return defaultSec;
}

export function buildPublicEntriesView(
  session: TalentShowcaseSession
): TalentPublicEntryView[] {
  const sorted = [...session.entries].sort((a, b) => a.orderIndex - b.orderIndex);

  return sorted.map((entry, idx) => {
    const cat = getTalentCategoryMeta(entry.categoryId);
    const entryPraise = session.appreciations.filter((a) => a.entryId === entry.id);
    const breakdown: Record<TalentReactionId, number> = {
      edificante: 0,
      inspirador: 0,
      dedicacion: 0,
      gloria_a_dios: 0,
    };
    const msgSet = new Set<string>();
    for (const p of entryPraise) {
      if (VALID_REACTIONS.has(p.reactionId)) {
        breakdown[p.reactionId] += 1;
      }
      if (p.curatedMessage) {
        msgSet.add(p.curatedMessage);
      }
    }

    const canShowPhoto = Boolean(
      session.privacy.showPhotosOnScreen &&
        entry.consentMediaPublic &&
        entry.directorApprovedMedia &&
        entry.mediaDataUrl
    );

    const juryNotes = session.privacy.showJuryFeedbackOnScreen
      ? session.juryEvaluations
          .filter((ev) => ev.entryId === entry.id && ev.encouragingComment)
          .map((ev) => `${ev.juryName}: "${ev.encouragingComment}"`)
      : undefined;

    return {
      id: entry.id,
      orderIndex: idx,
      publicName: resolvePublicName(entry, session.privacy, idx),
      categoryId: entry.categoryId,
      categoryLabel: cat.label,
      categoryColor: cat.color,
      presentationTitle: entry.presentationTitle,
      ...(session.privacy.showDescriptionsOnScreen
        ? { description: entry.description }
        : {}),
      ...(entry.verseReference ? { verseReference: entry.verseReference } : {}),
      durationSec: entry.durationSec,
      status: entry.status,
      ...(canShowPhoto
        ? {
            authorizedMediaUrl: entry.mediaDataUrl,
            ...(entry.mediaCaption ? { mediaCaption: entry.mediaCaption } : {}),
          }
        : {}),
      recognitionTitle: entry.recognitionTitle || cat.defaultRecognitionTitle,
      ...(entry.directorEncouragementNote
        ? { directorEncouragementNote: entry.directorEncouragementNote }
        : {}),
      praiseCount: entryPraise.length,
      reactionBreakdown: breakdown,
      curatedMessages: Array.from(msgSet).slice(0, 6),
      ...(juryNotes && juryNotes.length > 0 ? { juryHighlights: juryNotes } : {}),
    };
  });
}

function issueCertificatesInSession(
  session: TalentShowcaseSession,
  targetEntryId?: string
): TalentCertificateRecord[] {
  const sorted = [...session.entries].sort((a, b) => a.orderIndex - b.orderIndex);
  const targets =
    targetEntryId && targetEntryId !== 'all'
      ? sorted.filter((e) => e.id === targetEntryId)
      : sorted;

  const created: TalentCertificateRecord[] = [];
  for (const entry of targets) {
    const idx = sorted.findIndex((s) => s.id === entry.id);
    const cat = getTalentCategoryMeta(entry.categoryId);
    const recipientDisplayName = resolvePublicName(
      entry,
      session.privacy,
      Math.max(0, idx)
    );
    const cert: TalentCertificateRecord = {
      id: `tcert-${entry.id}`,
      entryId: entry.id,
      recipientDisplayName,
      categoryId: entry.categoryId,
      categoryLabel: cat.label,
      presentationTitle: entry.presentationTitle,
      recognitionTitle: entry.recognitionTitle || cat.defaultRecognitionTitle,
      encouragementMessage:
        entry.directorEncouragementNote ||
        `Por compartir con dedicación y reverencia su don en ${cat.label} durante nuestro programa juvenil.`,
      programTitle: session.programTitle,
      directorSignatureName: session.directorName,
      verseText:
        'Cada uno según el don que ha recibido, minístrelo a los otros (1 Pedro 4:10)',
      issuedAt: Date.now(),
    };

    const existingIdx = session.certificates.findIndex(
      (c) => c.entryId === entry.id
    );
    if (existingIdx >= 0) {
      session.certificates[existingIdx] = cert;
    } else {
      session.certificates.push(cert);
    }
    created.push(cert);
  }
  session.updatedAt = Date.now();
  return created;
}

function applyTimerAction(
  session: TalentShowcaseSession,
  timerAction: string,
  durationOverrideSec?: number
): void {
  const activeEntry = session.activeEntryId
    ? session.entries.find((e) => e.id === session.activeEntryId)
    : undefined;
  const baseSec = Math.max(
    15,
    Math.min(900, Number(durationOverrideSec) || activeEntry?.durationSec || 120)
  );

  if (timerAction === 'start') {
    const startSec =
      typeof session.timerPausedRemainingSec === 'number' &&
      session.timerPausedRemainingSec > 0
        ? session.timerPausedRemainingSec
        : baseSec;
    const now = Date.now();
    session.timerRunning = true;
    session.timerStartedAt = now;
    session.timerEndsAt = now + startSec * 1000;
    session.timerPausedRemainingSec = null;
  } else if (timerAction === 'pause') {
    const left = computeRemainingSec(session);
    session.timerRunning = false;
    session.timerEndsAt = null;
    session.timerPausedRemainingSec = left;
  } else if (timerAction === 'reset') {
    session.timerRunning = false;
    session.timerStartedAt = null;
    session.timerEndsAt = null;
    session.timerPausedRemainingSec = baseSec;
  } else if (timerAction === 'add30') {
    if (session.timerRunning && session.timerEndsAt) {
      session.timerEndsAt += 30_000;
    } else {
      const current = computeRemainingSec(session);
      session.timerPausedRemainingSec = Math.min(900, current + 30);
    }
  }
  session.updatedAt = Date.now();
}

export function initTalentRoomForGame(
  game: TalentStoredGame,
  _body: Record<string, unknown>,
  db: TalentDatabaseSlice
): void {
  if (game.config.mode !== 'talentos_juveniles') return;

  const source = ensureTalentDatabaseSlice(db).talentShowcase;
  // Clone current Talentos Juveniles lineup & settings cleanly for live synchronized room
  const cloned: TalentShowcaseSession = JSON.parse(JSON.stringify(source));
  cloned.id = `ts-room-${game.id}`;
  cloned.programTitle = game.config.title || source.programTitle;
  cloned.timerRunning = false;
  cloned.timerStartedAt = null;
  cloned.timerEndsAt = null;
  cloned.timerPausedRemainingSec = null;
  cloned.updatedAt = Date.now();

  game.questions = [
    {
      id: 'q-talentos-live',
      group: 'Categorías Especiales',
      category: 'Talentos Juveniles',
      difficulty: 'intermedio',
      prompt: cloned.programTitle,
      options: ['Presentación en vivo'],
      correctIndex: 0,
      reference: '1 Pedro 4:10',
      isSpecialMultiplier: 1,
    },
  ];
  game.config.questionCount = Math.max(1, cloned.entries.length);
  game.talentRoomInternal = cloned;
}

export function buildTalentClientView(
  game: TalentStoredGame,
  _role: 'presenter' | 'projector' | 'participant',
  participantId: string | undefined
): TalentRoomState | undefined {
  const session = game.talentRoomInternal;
  if (!session) return undefined;

  const myAppreciatedEntryIds = participantId
    ? Array.from(
        new Set(
          session.appreciations
            .filter((a) => a.voterKey === participantId)
            .map((a) => a.entryId)
        )
      )
    : [];

  return {
    programTitle: session.programTitle,
    directorName: session.directorName,
    currentScreen: session.currentScreen,
    activeEntryId: session.activeEntryId,
    openingNonce: session.openingNonce,
    timerRunning: session.timerRunning,
    timerEndsAt: session.timerEndsAt,
    timerRemainingSec: computeRemainingSec(session),
    audienceVotingEnabled: session.audienceVotingEnabled,
    juryEnabled: session.juryEnabled,
    privacy: session.privacy,
    entries: buildPublicEntriesView(session),
    myAppreciatedEntryIds,
    certificates: session.certificates,
  };
}

export function handleTalentPresenterAction(
  game: TalentStoredGame,
  action: string,
  msg: Record<string, unknown>,
  helpers: TalentActionHelpers,
  db: TalentDatabaseSlice
): boolean {
  const session = game.talentRoomInternal;
  if (game.config.mode !== 'talentos_juveniles' || !session) {
    return false;
  }

  if (action === 'start_game') {
    game.status = 'question_active';
    game.currentQuestionIndex = 0;
    game.questionStartedAt = Date.now();
    // Important: keep game.questionEndsAt null so general quiz timer does not prematurely lock the talent program
    game.questionEndsAt = null;
    if (session.entries.length > 0 && !session.activeEntryId) {
      session.activeEntryId = session.entries[0].id;
    }
    session.openingNonce += 1;
    session.updatedAt = Date.now();
    helpers.scheduleSave();
    helpers.broadcastRoom(game.code);
    return true;
  }

  if (action === 'talent_set_screen') {
    const nextScreen = String(msg.screen || 'waiting') as TalentStageScreen;
    if (VALID_SCREENS.has(nextScreen)) {
      session.currentScreen = nextScreen;
    }
    if (typeof msg.activeEntryId === 'string') {
      const exists = session.entries.some((e) => e.id === msg.activeEntryId);
      if (exists) {
        session.activeEntryId = msg.activeEntryId;
        session.entries.forEach((e) => {
          if (e.id === msg.activeEntryId) {
            e.status = 'presenting';
          } else if (e.status === 'presenting') {
            e.status = 'pending';
          }
        });
        const targetEntry = session.entries.find(
          (e) => e.id === msg.activeEntryId
        );
        if (targetEntry) {
          session.timerRunning = false;
          session.timerEndsAt = null;
          session.timerPausedRemainingSec = targetEntry.durationSec;
        }
      }
    }
    if (msg.triggerOpening === true || nextScreen === 'presentation') {
      session.openingNonce += 1;
    }
    session.updatedAt = Date.now();
    helpers.scheduleSave();
    helpers.broadcastRoom(game.code);
    return true;
  }

  if (action === 'talent_timer_action') {
    const timerAction = String(msg.timerAction || 'start');
    applyTimerAction(session, timerAction, Number(msg.durationSec) || undefined);
    helpers.scheduleSave();
    helpers.broadcastRoom(game.code);
    return true;
  }

  if (action === 'talent_set_controls') {
    if (typeof msg.audienceVotingEnabled === 'boolean') {
      session.audienceVotingEnabled = msg.audienceVotingEnabled;
    }
    if (typeof msg.juryEnabled === 'boolean') {
      session.juryEnabled = msg.juryEnabled;
    }
    if (msg.privacy && typeof msg.privacy === 'object') {
      session.privacy = {
        ...session.privacy,
        ...(msg.privacy as Partial<TalentPrivacyControls>),
      };
    }
    if (typeof msg.toggleEntryPrivacyId === 'string') {
      const target = session.entries.find(
        (e) => e.id === msg.toggleEntryPrivacyId
      );
      if (target) {
        if (typeof msg.directorApprovedDisplay === 'boolean') {
          target.directorApprovedDisplay = msg.directorApprovedDisplay;
        }
        if (typeof msg.directorApprovedMedia === 'boolean') {
          target.directorApprovedMedia = msg.directorApprovedMedia;
        }
      }
    }
    session.updatedAt = Date.now();
    helpers.scheduleSave();
    helpers.broadcastRoom(game.code);
    return true;
  }

  if (action === 'talent_record_result') {
    const entryId = String(msg.entryId || session.activeEntryId || '');
    const target = session.entries.find((e) => e.id === entryId);
    if (!target) return true;

    target.status = 'completed';
    target.completedAt = Date.now();
    if (typeof msg.recognitionTitle === 'string' && msg.recognitionTitle.trim()) {
      target.recognitionTitle = msg.recognitionTitle.trim().slice(0, 100);
    }
    if (typeof msg.directorEncouragementNote === 'string') {
      target.directorEncouragementNote = sanitizeRespectfulComment(
        msg.directorEncouragementNote,
        '¡Gracias por compartir tu don para glorificar a Dios!'
      );
    }
    session.timerRunning = false;
    session.timerEndsAt = null;
    session.updatedAt = Date.now();

    // Sync result back to global talentShowcase if matching entry exists
    const globalEntry = db.talentShowcase.entries.find((e) => e.id === entryId);
    if (globalEntry) {
      globalEntry.status = target.status;
      globalEntry.recognitionTitle = target.recognitionTitle;
      globalEntry.directorEncouragementNote = target.directorEncouragementNote;
      globalEntry.completedAt = target.completedAt;
    }

    helpers.scheduleSave();
    helpers.broadcastRoom(game.code);
    return true;
  }

  if (action === 'talent_issue_certificates') {
    const entryId =
      typeof msg.entryId === 'string' ? msg.entryId : 'all';
    const issued = issueCertificatesInSession(session, entryId);
    // Also persist issued certificates to main talentShowcase
    for (const c of issued) {
      const idx = db.talentShowcase.certificates.findIndex(
        (x) => x.entryId === c.entryId
      );
      if (idx >= 0) db.talentShowcase.certificates[idx] = c;
      else db.talentShowcase.certificates.push(c);
    }
    if (msg.openRecognitionScreen !== false) {
      session.currentScreen = 'recognition';
      session.openingNonce += 1;
    }
    helpers.scheduleSave();
    helpers.broadcastRoom(game.code);
    return true;
  }

  if (action === 'reset_game') {
    game.status = 'waiting';
    game.currentQuestionIndex = -1;
    game.questionStartedAt = null;
    game.questionEndsAt = null;
    game.finishedAt = null;
    session.currentScreen = 'waiting';
    session.timerRunning = false;
    session.timerEndsAt = null;
    session.timerPausedRemainingSec = null;
    helpers.scheduleSave();
    helpers.broadcastRoom(game.code);
    return true;
  }

  return false;
}

export function handleTalentAudienceVote(
  game: TalentStoredGame,
  participant: TalentStoredParticipant,
  msg: Record<string, unknown>,
  helpers: TalentActionHelpers
): void {
  const session = game.talentRoomInternal;
  if (game.config.mode !== 'talentos_juveniles' || !session) return;

  if (!session.audienceVotingEnabled) {
    helpers.sendWsError(
      'Las votaciones del público no están habilitadas en este momento por el director.'
    );
    return;
  }

  const entryId = String(msg.entryId || session.activeEntryId || '').trim();
  const entry = session.entries.find((e) => e.id === entryId);
  if (!entry) return;

  const reactionId = String(msg.reactionId || 'edificante') as TalentReactionId;
  if (!VALID_REACTIONS.has(reactionId)) return;

  const rawCurated =
    typeof msg.curatedMessage === 'string' ? msg.curatedMessage.trim() : '';
  const curatedMessage = TALENT_ENCOURAGEMENT_MESSAGES.includes(rawCurated)
    ? rawCurated
    : undefined;

  const existingIdx = session.appreciations.findIndex(
    (a) => a.entryId === entryId && a.voterKey === participant.id
  );
  const appreciation: TalentAudienceAppreciation = {
    id: `tapp-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
    entryId,
    voterKey: participant.id,
    voterLabel: 'Congregación',
    reactionId,
    ...(curatedMessage ? { curatedMessage } : {}),
    submittedAt: Date.now(),
  };

  if (existingIdx >= 0) {
    session.appreciations[existingIdx] = appreciation;
  } else {
    session.appreciations.push(appreciation);
  }
  session.updatedAt = Date.now();

  helpers.scheduleSave();
  helpers.broadcastRoom(game.code);
}

export function registerTalentRoutes(
  app: express.Express,
  deps: TalentRoutesDeps
): void {
  const getSession = () => ensureTalentDatabaseSlice(deps.getDb()).talentShowcase;

  // 1. Get complete director state + public sanitized view
  app.get('/api/talents/state', (_req, res) => {
    const session = getSession();
    res.json({
      session: {
        ...session,
        timerRemainingSec: computeRemainingSec(session),
      },
      publicEntries: buildPublicEntriesView(session),
      categories: TALENT_CATEGORIES,
      reactions: TALENT_POSITIVE_REACTIONS,
      encouragementMessages: TALENT_ENCOURAGEMENT_MESSAGES,
      recognitionTitles: TALENT_RECOGNITION_TITLES,
    });
  });

  // 2. Register a talent participant
  app.post('/api/talents/participants', (req, res) => {
    const session = getSession();
    const body = req.body || {};

    const participantName = String(body.participantName || '').trim().slice(0, 80);
    const presentationTitle = String(body.presentationTitle || '').trim().slice(0, 120);
    const description = String(body.description || '').trim().slice(0, 500);
    const rawCat = String(body.categoryId || 'canto') as TalentCategoryId;
    const categoryId: TalentCategoryId = VALID_CATEGORIES.has(rawCat)
      ? rawCat
      : 'canto';

    if (!participantName || !presentationTitle) {
      res.status(400).json({
        error: 'Escribe el nombre del participante y el título de su presentación.',
      });
      return;
    }

    const catMeta = getTalentCategoryMeta(categoryId);
    const durationSec = Math.max(
      20,
      Math.min(900, Number(body.durationSec) || catMeta.defaultDurationSec)
    );
    const mediaDataUrl = validateSafeImageDataUrl(body.mediaDataUrl);
    if (body.mediaDataUrl && !mediaDataUrl) {
      res.status(400).json({
        error: 'La imagen adjunta no es válida o excede el límite permitido (350 KB).',
      });
      return;
    }

    const nextIndex = session.entries.length;
    const displayAlias =
      String(body.displayAlias || '').trim().slice(0, 50) ||
      `Joven Participante #${nextIndex + 1}`;

    const newEntry: TalentEntry = {
      id: `tal-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
      orderIndex: nextIndex,
      participantName,
      displayAlias,
      categoryId,
      presentationTitle,
      description:
        description ||
        `Presentación especial en la categoría de ${catMeta.label}.`,
      ...(typeof body.verseReference === 'string' && body.verseReference.trim()
        ? { verseReference: body.verseReference.trim().slice(0, 90) }
        : {}),
      durationSec,
      status: 'pending',
      consentNamePublic: body.consentNamePublic !== false,
      consentMediaPublic: Boolean(body.consentMediaPublic),
      directorApprovedDisplay: body.consentNamePublic !== false,
      directorApprovedMedia: false, // Requires explicit director approval too for double privacy protection!
      ...(mediaDataUrl ? { mediaDataUrl } : {}),
      ...(typeof body.mediaCaption === 'string' && body.mediaCaption.trim()
        ? { mediaCaption: body.mediaCaption.trim().slice(0, 120) }
        : {}),
      recognitionTitle: catMeta.defaultRecognitionTitle,
      createdAt: Date.now(),
    };

    session.entries.push(newEntry);
    if (!session.activeEntryId) {
      session.activeEntryId = newEntry.id;
    }
    session.updatedAt = Date.now();
    deps.scheduleSave();

    res.status(201).json({ entry: newEntry });
  });

  // 3. Update participant details, privacy approvals, or record final result
  app.patch('/api/talents/participants/:id', (req, res) => {
    const session = getSession();
    const id = String(req.params.id || '').trim();
    const entry = session.entries.find((e) => e.id === id);
    if (!entry) {
      res.status(404).json({ error: 'Participante no encontrado.' });
      return;
    }

    const body = req.body || {};
    if (typeof body.participantName === 'string' && body.participantName.trim()) {
      entry.participantName = body.participantName.trim().slice(0, 80);
    }
    if (typeof body.displayAlias === 'string' && body.displayAlias.trim()) {
      entry.displayAlias = body.displayAlias.trim().slice(0, 50);
    }
    if (VALID_CATEGORIES.has(body.categoryId)) {
      entry.categoryId = body.categoryId;
    }
    if (typeof body.presentationTitle === 'string' && body.presentationTitle.trim()) {
      entry.presentationTitle = body.presentationTitle.trim().slice(0, 120);
    }
    if (typeof body.description === 'string') {
      entry.description = body.description.trim().slice(0, 500);
    }
    if (typeof body.verseReference === 'string') {
      entry.verseReference = body.verseReference.trim().slice(0, 90);
    }
    if (typeof body.durationSec === 'number') {
      entry.durationSec = Math.max(20, Math.min(900, Math.round(body.durationSec)));
    }
    if (typeof body.consentNamePublic === 'boolean') {
      entry.consentNamePublic = body.consentNamePublic;
    }
    if (typeof body.consentMediaPublic === 'boolean') {
      entry.consentMediaPublic = body.consentMediaPublic;
    }
    if (typeof body.directorApprovedDisplay === 'boolean') {
      entry.directorApprovedDisplay = body.directorApprovedDisplay;
    }
    if (typeof body.directorApprovedMedia === 'boolean') {
      entry.directorApprovedMedia = body.directorApprovedMedia;
    }
    if (
      body.status === 'pending' ||
      body.status === 'presenting' ||
      body.status === 'completed'
    ) {
      entry.status = body.status as TalentEntryStatus;
      if (body.status === 'completed') {
        entry.completedAt = Date.now();
      }
    }
    if (typeof body.recognitionTitle === 'string' && body.recognitionTitle.trim()) {
      entry.recognitionTitle = body.recognitionTitle.trim().slice(0, 100);
    }
    if (typeof body.directorEncouragementNote === 'string') {
      entry.directorEncouragementNote = sanitizeRespectfulComment(
        body.directorEncouragementNote,
        '¡Gracias por glorificar a Dios con tu talento!'
      );
    }
    if (typeof body.actualDurationSec === 'number') {
      entry.actualDurationSec = Math.max(0, Math.round(body.actualDurationSec));
    }

    session.updatedAt = Date.now();
    deps.scheduleSave();
    res.json({ entry });
  });

  // 4. Delete participant
  app.delete('/api/talents/participants/:id', (req, res) => {
    const session = getSession();
    const id = String(req.params.id || '').trim();
    const before = session.entries.length;
    session.entries = session.entries.filter((e) => e.id !== id);
    if (session.entries.length === before) {
      res.status(404).json({ error: 'Participante no encontrado.' });
      return;
    }
    session.entries.forEach((e, idx) => {
      e.orderIndex = idx;
    });
    if (session.activeEntryId === id) {
      session.activeEntryId = session.entries[0]?.id || null;
    }
    session.juryEvaluations = session.juryEvaluations.filter(
      (ev) => ev.entryId !== id
    );
    session.appreciations = session.appreciations.filter(
      (ap) => ap.entryId !== id
    );
    session.certificates = session.certificates.filter((c) => c.entryId !== id);
    session.updatedAt = Date.now();
    deps.scheduleSave();
    res.json({ deleted: true, id });
  });

  // 5. Reorder participation lineup
  app.post('/api/talents/order', (req, res) => {
    const session = getSession();
    const body = req.body || {};

    if (Array.isArray(body.orderedIds)) {
      const idSet = new Map(session.entries.map((e) => [e.id, e]));
      const reordered: TalentEntry[] = [];
      for (const id of body.orderedIds) {
        const found = idSet.get(String(id));
        if (found && !reordered.includes(found)) {
          reordered.push(found);
        }
      }
      for (const e of session.entries) {
        if (!reordered.includes(e)) reordered.push(e);
      }
      reordered.forEach((e, idx) => {
        e.orderIndex = idx;
      });
      session.entries = reordered;
    } else if (typeof body.entryId === 'string' && (body.direction === 'up' || body.direction === 'down')) {
      const sorted = [...session.entries].sort((a, b) => a.orderIndex - b.orderIndex);
      const idx = sorted.findIndex((e) => e.id === body.entryId);
      if (idx >= 0) {
        const swapWith = body.direction === 'up' ? idx - 1 : idx + 1;
        if (swapWith >= 0 && swapWith < sorted.length) {
          [sorted[idx], sorted[swapWith]] = [sorted[swapWith], sorted[idx]];
          sorted.forEach((e, i) => {
            e.orderIndex = i;
          });
          session.entries = sorted;
        }
      }
    }

    session.updatedAt = Date.now();
    deps.scheduleSave();
    res.json({ entries: session.entries });
  });

  // 6. Director stage, timer, voting, jury, and privacy controls
  app.post('/api/talents/controls', (req, res) => {
    const session = getSession();
    const body = req.body || {};

    if (typeof body.programTitle === 'string' && body.programTitle.trim()) {
      session.programTitle = body.programTitle.trim().slice(0, 120);
    }
    if (typeof body.directorName === 'string' && body.directorName.trim()) {
      session.directorName = body.directorName.trim().slice(0, 80);
    }
    if (VALID_SCREENS.has(body.currentScreen)) {
      session.currentScreen = body.currentScreen;
    }
    if (typeof body.activeEntryId === 'string') {
      const found = session.entries.find((e) => e.id === body.activeEntryId);
      if (found) {
        session.activeEntryId = found.id;
        session.entries.forEach((e) => {
          if (e.id === found.id && body.currentScreen === 'presentation') {
            e.status = 'presenting';
          } else if (e.status === 'presenting') {
            e.status = 'pending';
          }
        });
        session.timerRunning = false;
        session.timerEndsAt = null;
        session.timerPausedRemainingSec = found.durationSec;
      }
    }
    if (body.triggerOpening === true) {
      session.openingNonce += 1;
    }
    if (typeof body.audienceVotingEnabled === 'boolean') {
      session.audienceVotingEnabled = body.audienceVotingEnabled;
    }
    if (typeof body.juryEnabled === 'boolean') {
      session.juryEnabled = body.juryEnabled;
    }
    if (body.privacy && typeof body.privacy === 'object') {
      session.privacy = {
        ...session.privacy,
        ...(body.privacy as Partial<TalentPrivacyControls>),
      };
    }
    if (Array.isArray(body.juryMembers)) {
      const cleaned: TalentJuryMember[] = body.juryMembers
        .slice(0, 8)
        .map((m: any, i: number): TalentJuryMember => ({
          id: String(m?.id || `jury-${i + 1}`),
          name: String(m?.name || `Jurado ${i + 1}`).trim().slice(0, 60),
          roleTitle: String(m?.roleTitle || 'Evaluador').trim().slice(0, 60),
        }))
        .filter((m: TalentJuryMember) => m.name.length > 0);
      if (cleaned.length > 0) {
        session.juryMembers = cleaned;
      }
    }
    if (typeof body.timerAction === 'string') {
      applyTimerAction(
        session,
        body.timerAction,
        Number(body.durationSec) || undefined
      );
    }

    session.updatedAt = Date.now();
    deps.scheduleSave();
    res.json({
      session: {
        ...session,
        timerRemainingSec: computeRemainingSec(session),
      },
      publicEntries: buildPublicEntriesView(session),
    });
  });

  // 7. Respectful constructive jury evaluation
  app.post('/api/talents/jury', (req, res) => {
    const session = getSession();
    const body = req.body || {};
    const entryId = String(body.entryId || '').trim();
    const juryMemberId = String(body.juryMemberId || 'jury-1').trim();
    const entry = session.entries.find((e) => e.id === entryId);
    if (!entry) {
      res.status(404).json({ error: 'Participante no encontrado.' });
      return;
    }

    const juryMember =
      session.juryMembers.find((j) => j.id === juryMemberId) ||
      session.juryMembers[0];

    const clampScore = (v: unknown) => Math.max(1, Math.min(5, Math.round(Number(v) || 5)));
    const evaluation: TalentJuryEvaluation = {
      juryMemberId: juryMember?.id || juryMemberId,
      juryName: String(body.juryName || juryMember?.name || 'Jurado').trim().slice(0, 60),
      entryId,
      biblicalMessageScore: clampScore(body.biblicalMessageScore),
      preparationScore: clampScore(body.preparationScore),
      clarityScore: clampScore(body.clarityScore),
      encouragingComment: sanitizeRespectfulComment(
        body.encouragingComment,
        'Excelente disposición y talento dedicado para edificar a los jóvenes.'
      ),
      suggestedRecognition:
        String(body.suggestedRecognition || '').trim().slice(0, 100) ||
        getTalentCategoryMeta(entry.categoryId).defaultRecognitionTitle,
      submittedAt: Date.now(),
    };

    const existingIdx = session.juryEvaluations.findIndex(
      (ev) => ev.entryId === entryId && ev.juryMemberId === evaluation.juryMemberId
    );
    if (existingIdx >= 0) {
      session.juryEvaluations[existingIdx] = evaluation;
    } else {
      session.juryEvaluations.push(evaluation);
    }
    session.updatedAt = Date.now();
    deps.scheduleSave();
    res.json({ evaluation });
  });

  // 8. Standalone respectful audience vote (only when director enabled)
  app.post('/api/talents/vote', (req, res) => {
    const session = getSession();
    if (!session.audienceVotingEnabled) {
      res.status(403).json({
        error:
          'La votación del público debe ser habilitada primero por el director.',
      });
      return;
    }

    const body = req.body || {};
    const entryId = String(body.entryId || '').trim();
    const voterKey = String(body.voterKey || 'anon').trim().slice(0, 64);
    const reactionId = String(body.reactionId || 'edificante') as TalentReactionId;
    if (!session.entries.some((e) => e.id === entryId)) {
      res.status(404).json({ error: 'Presentación no encontrada.' });
      return;
    }
    if (!VALID_REACTIONS.has(reactionId)) {
      res.status(400).json({ error: 'Reacción positiva inválida.' });
      return;
    }

    const rawMsg =
      typeof body.curatedMessage === 'string' ? body.curatedMessage.trim() : '';
    const curatedMessage = TALENT_ENCOURAGEMENT_MESSAGES.includes(rawMsg)
      ? rawMsg
      : undefined;

    const existingIdx = session.appreciations.findIndex(
      (a) => a.entryId === entryId && a.voterKey === voterKey
    );
    const appreciation: TalentAudienceAppreciation = {
      id: `tapp-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
      entryId,
      voterKey,
      voterLabel: 'Público',
      reactionId,
      ...(curatedMessage ? { curatedMessage } : {}),
      submittedAt: Date.now(),
    };

    if (existingIdx >= 0) {
      session.appreciations[existingIdx] = appreciation;
    } else {
      session.appreciations.push(appreciation);
    }
    session.updatedAt = Date.now();
    deps.scheduleSave();
    res.json({
      appreciation,
      publicEntries: buildPublicEntriesView(session),
    });
  });

  // 9. Issue digital certificates respecting privacy rules
  app.post('/api/talents/certificates/issue', (req, res) => {
    const session = getSession();
    const body = req.body || {};
    const entryId = typeof body.entryId === 'string' ? body.entryId : 'all';
    const issued = issueCertificatesInSession(session, entryId);
    deps.scheduleSave();
    res.json({
      certificates: session.certificates,
      issuedNow: issued,
    });
  });

  // 10. Reset session cleanly when organizing a brand new program
  app.post('/api/talents/session/reset', (req, res) => {
    const dbRef = deps.getDb();
    const keepTitle =
      typeof req.body?.programTitle === 'string' && req.body.programTitle.trim()
        ? req.body.programTitle.trim()
        : 'Noche de Talentos Juveniles — Sociedad de Jóvenes';
    dbRef.talentShowcase = {
      ...createEmptyTalentShowcaseSession(),
      programTitle: keepTitle,
    };
    deps.scheduleSave();
    res.json({ session: dbRef.talentShowcase });
  });
}
