import type { Express } from 'express';
import {
  ADVENTURE_AMBIENT_LABELS,
  BUILTIN_ADVENTURE_STORIES,
  type AdventureAmbientStyle,
  type AdventureChoiceOption,
  type AdventurePlayMode,
  type AdventureProgressRecord,
  type AdventureRoomPhase,
  type AdventureRoomState,
  type AdventureSanitizedOption,
  type AdventureScene,
  type AdventureStory,
  type AdventureSubmissionView,
} from './src/shared/adventureStoriesData.js';
import type { LeaderboardEntry } from './src/shared/types.js';
import type { ServerStoredGame } from './server-expansion.js';

export interface AdventureDatabaseSlice {
  customAdventureStories: AdventureStory[];
  adventureProgress: AdventureProgressRecord[];
}

interface StoredAdventureSubmission {
  participantId: string;
  participantName: string;
  avatarId: string;
  photoUrl?: string;
  teamId?: string;
  optionId: string;
  optionLabel: string;
  isBiblicallyFaithful: boolean;
  pointsEarned: number;
  responseTimeMs: number;
  submittedAt: number;
}

export interface AdventureServerInternal {
  storyId: string;
  storyTitle: string;
  storySubtitle: string;
  playMode: AdventurePlayMode;
  ambientStyle: AdventureAmbientStyle;
  ambientLabel: string;
  accentColor: string;
  mainReference: string;
  characters: Array<{ name: string; role: string }>;
  introductionNarrative: string;
  finalReflection: string;
  keyTakeaways: string[];
  scripturalAnchor: string;
  scenes: AdventureScene[];
  currentSceneIndex: number;
  phase: AdventureRoomPhase;
  sceneTransitionNonce: number;
  submissions: Record<number, Record<string, StoredAdventureSubmission>>;
}

export interface AdventureGameDoc extends ServerStoredGame {
  adventureInternal?: AdventureServerInternal;
}

export interface AdventureActionHelpers {
  finishGame: (game: AdventureGameDoc) => void;
  buildLeaderboard: (game: AdventureGameDoc) => LeaderboardEntry[];
  broadcastRoom: (code: string) => void;
  scheduleSave: () => void;
  sendWsError: (message: string) => void;
}

export function ensureAdventureDatabaseSlice(
  raw: Partial<AdventureDatabaseSlice> | undefined
): AdventureDatabaseSlice {
  return {
    customAdventureStories: Array.isArray(raw?.customAdventureStories)
      ? raw.customAdventureStories
      : [],
    adventureProgress: Array.isArray(raw?.adventureProgress)
      ? raw.adventureProgress
      : [],
  };
}

function getAllStories(db: AdventureDatabaseSlice): AdventureStory[] {
  const custom = Array.isArray(db.customAdventureStories)
    ? db.customAdventureStories
    : [];
  return [...BUILTIN_ADVENTURE_STORIES, ...custom];
}

function findStoryById(
  storyId: string,
  db: AdventureDatabaseSlice
): AdventureStory {
  const all = getAllStories(db);
  return all.find((s) => s.id === storyId) || BUILTIN_ADVENTURE_STORIES[0];
}

function normalizeAmbientStyle(raw: unknown): AdventureAmbientStyle {
  const val = String(raw || '').trim();
  if (
    val === 'heroic' ||
    val === 'royal' ||
    val === 'desert' ||
    val === 'pastoral' ||
    val === 'miracle'
  ) {
    return val;
  }
  return 'pastoral';
}

function normalizePlayMode(raw: unknown, hasTeams: boolean): AdventurePlayMode {
  const val = String(raw || '').trim();
  if (val === 'competitive_teams' || (hasTeams && !val)) {
    return 'competitive_teams';
  }
  if (val === 'competitive_players') return 'competitive_players';
  if (val === 'conductor_led') return 'conductor_led';
  if (val === 'individual') return 'individual';
  return hasTeams ? 'competitive_teams' : 'conductor_led';
}

export function initAdventureRoomForGame(
  game: AdventureGameDoc,
  body: Record<string, unknown>,
  db: AdventureDatabaseSlice
): void {
  if (game.config.mode !== 'aventuras_biblicas') return;

  const rawAdv =
    body.adventureConfig && typeof body.adventureConfig === 'object'
      ? (body.adventureConfig as Record<string, unknown>)
      : {};

  const storyId = String(rawAdv.storyId || body.storyId || '').trim();
  const story = findStoryById(storyId, db);
  const playMode = normalizePlayMode(
    rawAdv.playMode || body.playMode,
    Boolean(game.config.teamMode)
  );

  game.config.adventureConfig = {
    storyId: story.id,
    playMode,
  };

  if (!body.title) {
    game.config.title = `Aventura: ${story.title}`;
  }

  game.questions = story.scenes.map((sc, idx) => {
    const faithfulOpt = sc.options.find((o) => o.isBiblicallyFaithful);
    return {
      id: `${story.id}-${sc.id}`,
      group:
        story.testament === 'Antiguo Testamento'
          ? 'Antiguo Testamento'
          : 'Nuevo Testamento',
      category: 'Personajes bíblicos',
      difficulty: 'intermedio',
      prompt: `${sc.title}: ${sc.prompt}`,
      options: sc.options.map((o) => o.label),
      correctIndex: Math.max(
        0,
        sc.options.findIndex((o) => o.isBiblicallyFaithful)
      ),
      reference: sc.sceneReference,
      explanation:
        faithfulOpt?.biblicalExplanation || sc.scriptureNote || story.scripturalAnchor,
      isSpecialMultiplier: 1,
      roundStage: `Escena ${idx + 1}`,
    };
  });

  game.adventureInternal = {
    storyId: story.id,
    storyTitle: story.title,
    storySubtitle: story.subtitle,
    playMode,
    ambientStyle: story.ambientStyle,
    ambientLabel:
      story.ambientLabel || ADVENTURE_AMBIENT_LABELS[story.ambientStyle].name,
    accentColor: story.accentColor || '#F59E0B',
    mainReference: story.mainReference,
    characters: story.characters.map((c) => ({ ...c })),
    introductionNarrative: story.introductionNarrative,
    finalReflection: story.finalReflection,
    keyTakeaways: Array.isArray(story.keyTakeaways)
      ? [...story.keyTakeaways]
      : [],
    scripturalAnchor: story.scripturalAnchor,
    scenes: story.scenes.map((sc) => ({
      ...sc,
      options: sc.options.map((o) => ({ ...o })),
    })),
    currentSceneIndex: 0,
    phase: 'narration',
    sceneTransitionNonce: 1,
    submissions: {},
  };
}

export function buildAdventureClientView(
  game: AdventureGameDoc,
  role: 'presenter' | 'projector' | 'participant',
  participantId?: string
): AdventureRoomState | undefined {
  const adv = game.adventureInternal;
  if (!adv) return undefined;

  const sceneIdx = Math.max(
    0,
    Math.min(adv.scenes.length - 1, adv.currentSceneIndex)
  );
  const scene = adv.scenes[sceneIdx];
  const isRevealed =
    adv.phase === 'consequence_reveal' ||
    adv.phase === 'reflection' ||
    game.status === 'finished';

  const showAnswers = isRevealed || role === 'presenter';
  const sceneSubsMap = adv.submissions[sceneIdx] || {};
  const rawSubs = Object.values(sceneSubsMap);

  const optionVoteCounts: Record<string, number> = {};
  for (const opt of scene.options) {
    optionVoteCounts[opt.id] = 0;
  }
  for (const s of rawSubs) {
    if (optionVoteCounts[s.optionId] !== undefined) {
      optionVoteCounts[s.optionId] += 1;
    }
  }

  const sanitizedOptions: AdventureSanitizedOption[] = scene.options.map(
    (opt) => ({
      id: opt.id,
      label: opt.label,
      ...(showAnswers
        ? {
            isBiblicallyFaithful: opt.isBiblicallyFaithful,
            pointsDelta: opt.pointsDelta,
            consequenceText: opt.consequenceText,
            biblicalExplanation: opt.biblicalExplanation,
          }
        : {}),
    })
  );

  const submissionsView: AdventureSubmissionView[] = rawSubs
    .map((s) => ({
      participantId: s.participantId,
      participantName: s.participantName,
      avatarId: s.avatarId,
      photoUrl: s.photoUrl,
      teamId: s.teamId,
      optionId: showAnswers ? s.optionId : '',
      optionLabel: showAnswers ? s.optionLabel : 'Respuesta enviada',
      ...(showAnswers
        ? {
            isBiblicallyFaithful: s.isBiblicallyFaithful,
            pointsEarned: s.pointsEarned,
          }
        : {}),
      submittedAt: s.submittedAt,
    }))
    .sort((a, b) => a.submittedAt - b.submittedAt);

  const mySelectedOptionId =
    participantId && sceneSubsMap[participantId]
      ? sceneSubsMap[participantId].optionId
      : null;

  return {
    storyId: adv.storyId,
    storyTitle: adv.storyTitle,
    storySubtitle: adv.storySubtitle,
    ambientStyle: adv.ambientStyle,
    ambientLabel: adv.ambientLabel,
    accentColor: adv.accentColor,
    mainReference: adv.mainReference,
    scripturalAnchor: adv.scripturalAnchor,
    introductionNarrative: adv.introductionNarrative,
    characters: adv.characters,
    playMode: adv.playMode,
    phase: adv.phase,
    currentSceneIndex: sceneIdx,
    totalScenes: adv.scenes.length,
    currentScene: {
      id: scene.id,
      order: scene.order,
      title: scene.title,
      location: scene.location,
      narrativeAdaptation: scene.narrativeAdaptation,
      sceneReference: scene.sceneReference,
      scriptureNote: scene.scriptureNote,
      interactionType: scene.interactionType,
      prompt: scene.prompt,
      options: sanitizedOptions,
    },
    ...(adv.phase === 'reflection' || role === 'presenter' || game.status === 'finished'
      ? {
          finalReflection: adv.finalReflection,
          keyTakeaways: adv.keyTakeaways,
        }
      : {}),
    sceneTransitionNonce: adv.sceneTransitionNonce,
    optionVoteCounts: showAnswers ? optionVoteCounts : {},
    mySelectedOptionId,
    submissionsCount: rawSubs.length,
    submissions: submissionsView,
  };
}

export function saveAdventureMatchProgress(
  game: AdventureGameDoc,
  buildLeaderboard: (g: AdventureGameDoc) => LeaderboardEntry[],
  db: AdventureDatabaseSlice
): void {
  const adv = game.adventureInternal;
  if (!adv) return;
  if (!Array.isArray(db.adventureProgress)) {
    db.adventureProgress = [];
  }
  const lb = buildLeaderboard(game);
  const top = lb[0];
  const rec: AdventureProgressRecord = {
    storyId: adv.storyId,
    storyTitle: adv.storyTitle,
    mode: adv.playMode,
    currentSceneIndex: adv.currentSceneIndex,
    totalScenes: adv.scenes.length,
    completed: game.status === 'finished' || adv.phase === 'reflection',
    score: top?.score || 0,
    faithfulChoices: Object.values(game.participants).reduce(
      (sum, p) => sum + p.correctCount,
      0
    ),
    selectedChoicesByScene: {},
    updatedAt: Date.now(),
  };

  const key = `${adv.storyId}:${adv.playMode}`;
  const idx = db.adventureProgress.findIndex(
    (p) => `${p.storyId}:${p.mode}` === key
  );
  if (idx >= 0) {
    db.adventureProgress[idx] = rec;
  } else {
    db.adventureProgress.unshift(rec);
  }
  db.adventureProgress = db.adventureProgress.slice(0, 80);
}

export function handleAdventurePresenterAction(
  game: AdventureGameDoc,
  action: string,
  msg: Record<string, unknown>,
  helpers: AdventureActionHelpers,
  db: AdventureDatabaseSlice
): boolean {
  const adv = game.adventureInternal;
  if (game.config.mode !== 'aventuras_biblicas' || !adv) return false;

  if (action === 'start_game') {
    game.status = 'question_active';
    game.currentQuestionIndex = 0;
    game.questionStartedAt = Date.now();
    game.questionEndsAt = null;
    adv.currentSceneIndex = 0;
    adv.phase = 'narration';
    adv.sceneTransitionNonce += 1;
    helpers.scheduleSave();
    helpers.broadcastRoom(game.code);
    return true;
  }

  if (action === 'adventure_open_decision') {
    adv.phase = 'decision_open';
    adv.sceneTransitionNonce += 1;
    game.status = 'question_active';
    game.questionStartedAt = Date.now();
    game.questionEndsAt = null;
    helpers.scheduleSave();
    helpers.broadcastRoom(game.code);
    return true;
  }

  if (action === 'adventure_reveal_consequence') {
    adv.phase = 'consequence_reveal';
    adv.sceneTransitionNonce += 1;
    game.status = 'answer_revealed';
    game.questionEndsAt = null;
    helpers.scheduleSave();
    helpers.broadcastRoom(game.code);
    return true;
  }

  if (action === 'adventure_next_scene') {
    if (adv.currentSceneIndex + 1 < adv.scenes.length) {
      adv.currentSceneIndex += 1;
      adv.phase = 'narration';
      game.currentQuestionIndex = adv.currentSceneIndex;
      game.status = 'question_active';
      game.questionStartedAt = Date.now();
      game.questionEndsAt = null;
    } else {
      adv.phase = 'reflection';
      game.status = 'answer_revealed';
      game.questionEndsAt = null;
    }
    adv.sceneTransitionNonce += 1;
    helpers.scheduleSave();
    helpers.broadcastRoom(game.code);
    return true;
  }

  if (action === 'adventure_prev_scene') {
    if (adv.currentSceneIndex > 0) {
      adv.currentSceneIndex -= 1;
      adv.phase = 'narration';
      game.currentQuestionIndex = adv.currentSceneIndex;
      game.status = 'question_active';
      game.questionStartedAt = Date.now();
      game.questionEndsAt = null;
      adv.sceneTransitionNonce += 1;
    }
    helpers.scheduleSave();
    helpers.broadcastRoom(game.code);
    return true;
  }

  if (action === 'adventure_jump_scene') {
    const idx = Number(msg.sceneIndex);
    if (!Number.isFinite(idx) || idx < 0 || idx >= adv.scenes.length) {
      helpers.sendWsError('Número de escena no válido.');
      return true;
    }
    adv.currentSceneIndex = Math.floor(idx);
    adv.phase = 'narration';
    game.currentQuestionIndex = adv.currentSceneIndex;
    game.status = 'question_active';
    game.questionStartedAt = Date.now();
    game.questionEndsAt = null;
    adv.sceneTransitionNonce += 1;
    helpers.scheduleSave();
    helpers.broadcastRoom(game.code);
    return true;
  }

  if (action === 'adventure_show_reflection') {
    adv.phase = 'reflection';
    adv.sceneTransitionNonce += 1;
    game.status = 'answer_revealed';
    game.questionEndsAt = null;
    helpers.scheduleSave();
    helpers.broadcastRoom(game.code);
    return true;
  }

  if (action === 'adventure_finish' || action === 'end_game') {
    adv.phase = 'reflection';
    adv.sceneTransitionNonce += 1;
    helpers.finishGame(game);
    saveAdventureMatchProgress(game, helpers.buildLeaderboard, db);
    helpers.scheduleSave();
    helpers.broadcastRoom(game.code);
    return true;
  }

  if (action === 'reset_game') {
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
    adv.currentSceneIndex = 0;
    adv.phase = 'narration';
    adv.submissions = {};
    adv.sceneTransitionNonce += 1;
    for (const p of Object.values(game.participants)) {
      p.score = 0;
      p.correctCount = 0;
      p.answeredCount = 0;
      p.streak = 0;
      p.mistakes = 0;
      p.eliminated = false;
      p.totalResponseMs = 0;
    }
    helpers.scheduleSave();
    helpers.broadcastRoom(game.code);
    return true;
  }

  return false;
}

export function handleAdventureSubmission(
  game: AdventureGameDoc,
  participant: {
    id: string;
    name: string;
    avatarId: string;
    photoUrl?: string;
    teamId?: string;
    score: number;
    correctCount: number;
    answeredCount: number;
    streak: number;
    totalResponseMs: number;
  },
  msg: Record<string, unknown>,
  helpers: AdventureActionHelpers
): boolean {
  const adv = game.adventureInternal;
  if (game.config.mode !== 'aventuras_biblicas' || !adv) return false;

  if (adv.phase !== 'decision_open') {
    helpers.sendWsError(
      'La votación de esta escena aún no está abierta o ya fue revelada.'
    );
    return true;
  }

  const sceneIdx = adv.currentSceneIndex;
  const scene = adv.scenes[sceneIdx];
  if (!scene) return true;

  const optionId = String(msg.optionId || '').trim();
  const chosen = scene.options.find((o) => o.id === optionId);
  if (!chosen) {
    helpers.sendWsError('Selecciona una opción válida para continuar.');
    return true;
  }

  if (!adv.submissions[sceneIdx]) {
    adv.submissions[sceneIdx] = {};
  }
  if (adv.submissions[sceneIdx][participant.id]) {
    return true;
  }

  const now = Date.now();
  const startedAt = game.questionStartedAt || now;
  const elapsedMs = Math.max(0, Math.min(60000, now - startedAt));

  let pointsEarned = 0;
  if (adv.playMode === 'conductor_led') {
    pointsEarned = chosen.isBiblicallyFaithful ? 250 : 100;
  } else {
    const base = chosen.isBiblicallyFaithful
      ? Math.max(300, chosen.pointsDelta || 500)
      : 100;
    const speedRatio = Math.max(0, Math.min(1, 1 - elapsedMs / 35000));
    const bonus = chosen.isBiblicallyFaithful
      ? Math.round(250 * speedRatio)
      : 0;
    pointsEarned = base + bonus;
  }

  participant.score += pointsEarned;
  participant.answeredCount += 1;
  participant.totalResponseMs += elapsedMs;
  if (chosen.isBiblicallyFaithful) {
    participant.correctCount += 1;
    participant.streak += 1;
  } else {
    participant.streak = 0;
  }

  adv.submissions[sceneIdx][participant.id] = {
    participantId: participant.id,
    participantName: participant.name,
    avatarId: participant.avatarId,
    photoUrl: participant.photoUrl,
    teamId: participant.teamId,
    optionId: chosen.id,
    optionLabel: chosen.label,
    isBiblicallyFaithful: chosen.isBiblicallyFaithful,
    pointsEarned,
    responseTimeMs: elapsedMs,
    submittedAt: now,
  };

  helpers.scheduleSave();
  helpers.broadcastRoom(game.code);
  return true;
}

export function registerAdventureRoutes(
  app: Express,
  deps: {
    getDb: () => AdventureDatabaseSlice;
    scheduleSave: () => void;
  }
): void {
  const ensureArrays = () => {
    const db = deps.getDb();
    if (!Array.isArray(db.customAdventureStories)) {
      db.customAdventureStories = [];
    }
    if (!Array.isArray(db.adventureProgress)) {
      db.adventureProgress = [];
    }
    return db;
  };

  app.get('/api/adventures/stories', (_req, res) => {
    const db = ensureArrays();
    res.json({
      builtinStories: BUILTIN_ADVENTURE_STORIES,
      customStories: db.customAdventureStories,
      stories: getAllStories(db),
      progress: db.adventureProgress,
      ambientLabels: ADVENTURE_AMBIENT_LABELS,
    });
  });

  app.post('/api/adventures/stories', (req, res) => {
    const db = ensureArrays();
    const b = req.body || {};

    const title = String(b.title || '').trim();
    const subtitle =
      String(b.subtitle || '').trim() || 'Historia bíblica interactiva';
    const mainReference = String(b.mainReference || '').trim();
    const introductionNarrative = String(b.introductionNarrative || '').trim();
    const finalReflection = String(b.finalReflection || '').trim();
    const scripturalAnchor =
      String(b.scripturalAnchor || '').trim() || mainReference;
    const testament =
      b.testament === 'Nuevo Testamento'
        ? 'Nuevo Testamento'
        : 'Antiguo Testamento';

    if (title.length < 3 || mainReference.length < 3 || !introductionNarrative) {
      res.status(400).json({
        error:
          'Completa el título, la referencia bíblica principal y la introducción narrativa.',
      });
      return;
    }

    const rawCharacters = Array.isArray(b.characters) ? b.characters : [];
    const characters = rawCharacters
      .map((c: unknown) => {
        const obj = (c || {}) as Record<string, unknown>;
        return {
          name: String(obj.name || '').trim(),
          role: String(obj.role || '').trim() || 'Personaje bíblico',
        };
      })
      .filter((c: { name: string }) => c.name.length > 0);

    const rawScenes = Array.isArray(b.scenes) ? b.scenes : [];
    if (rawScenes.length === 0) {
      res.status(400).json({
        error: 'Agrega al menos una escena con su decisión o pregunta.',
      });
      return;
    }

    const scenes: AdventureScene[] = [];
    for (let i = 0; i < rawScenes.length; i++) {
      const s = (rawScenes[i] || {}) as Record<string, unknown>;
      const sTitle = String(s.title || '').trim();
      const narrativeAdaptation = String(s.narrativeAdaptation || '').trim();
      const sceneReference = String(s.sceneReference || '').trim();
      const prompt = String(s.prompt || '').trim();
      const rawOptions = Array.isArray(s.options) ? s.options : [];

      const options: AdventureChoiceOption[] = rawOptions
        .map((o: unknown, oIdx: number) => {
          const obj = (o || {}) as Record<string, unknown>;
          const faithful = Boolean(obj.isBiblicallyFaithful);
          return {
            id: `opt-${i + 1}-${oIdx + 1}`,
            label: String(obj.label || '').trim(),
            isBiblicallyFaithful: faithful,
            pointsDelta:
              typeof obj.pointsDelta === 'number'
                ? obj.pointsDelta
                : faithful
                  ? 500
                  : 100,
            consequenceText:
              String(obj.consequenceText || '').trim() ||
              'El relato continúa mostrando las consecuencias de esta elección.',
            biblicalExplanation:
              String(obj.biblicalExplanation || '').trim() ||
              `Consulta el pasaje bíblico de ${sceneReference || mainReference}.`,
          };
        })
        .filter((o: AdventureChoiceOption) => o.label.length > 0);

      if (
        !sTitle ||
        !narrativeAdaptation ||
        !sceneReference ||
        !prompt ||
        options.length < 2
      ) {
        res.status(400).json({
          error: `La escena ${i + 1} requiere título, adaptación narrativa, referencia bíblica, pregunta/decisión y al menos 2 opciones.`,
        });
        return;
      }

      if (!options.some((o) => o.isBiblicallyFaithful)) {
        options[0].isBiblicallyFaithful = true;
      }

      scenes.push({
        id: `scene-${i + 1}`,
        order: i + 1,
        title: sTitle,
        location:
          String(s.location || s.settingLabel || '').trim() || `Escena ${i + 1}`,
        narrativeAdaptation,
        sceneReference,
        scriptureNote:
          String(s.scriptureNote || '').trim() ||
          `Referencia directa: ${sceneReference}`,
        interactionType:
          s.interactionType === 'question' ? 'question' : 'decision',
        prompt,
        options,
      });
    }

    const ambientStyle = normalizeAmbientStyle(b.ambientStyle);
    const accentByAmbient: Record<AdventureAmbientStyle, string> = {
      heroic: '#F59E0B',
      royal: '#A855F7',
      desert: '#EAB308',
      pastoral: '#10B981',
      miracle: '#0EA5E9',
    };

    const newStory: AdventureStory = {
      id: `adv-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      subtitle,
      testament,
      ambientStyle,
      ambientLabel: ADVENTURE_AMBIENT_LABELS[ambientStyle].name,
      accentColor: accentByAmbient[ambientStyle],
      mainReference,
      scripturalAnchor,
      characters:
        characters.length > 0
          ? characters
          : [{ name: 'Protagonista', role: 'Personaje principal del relato' }],
      introductionNarrative,
      scenes,
      finalReflection:
        finalReflection ||
        `Reflexiona sobre cómo los principios de ${mainReference} fortalecen nuestra fe hoy.`,
      keyTakeaways: [
        `Lectura recomendada: ${mainReference}`,
        'Confianza práctica en la Palabra de Dios en cada decisión.',
      ],
      isCustom: true,
      createdAt: Date.now(),
    };

    db.customAdventureStories.unshift(newStory);
    deps.scheduleSave();
    res.status(201).json({ story: newStory });
  });

  app.delete('/api/adventures/stories/:id', (req, res) => {
    const db = ensureArrays();
    const id = String(req.params.id || '').trim();
    if (!id.startsWith('adv-custom-')) {
      res.status(400).json({
        error: 'Solo se pueden eliminar historias personalizadas.',
      });
      return;
    }
    const before = db.customAdventureStories.length;
    db.customAdventureStories = db.customAdventureStories.filter(
      (s) => s.id !== id
    );
    if (db.customAdventureStories.length === before) {
      res.status(404).json({ error: 'Historia personalizada no encontrada.' });
      return;
    }
    deps.scheduleSave();
    res.json({ deleted: true });
  });

  app.get('/api/adventures/progress', (_req, res) => {
    const db = ensureArrays();
    res.json({ progress: db.adventureProgress });
  });

  app.post('/api/adventures/progress', (req, res) => {
    const db = ensureArrays();
    const b = req.body || {};
    const storyId = String(b.storyId || '').trim();
    if (!storyId) {
      res.status(400).json({ error: 'Falta storyId.' });
      return;
    }
    const story = getAllStories(db).find((s) => s.id === storyId);
    if (!story) {
      res.status(404).json({ error: 'Historia bíblica no encontrada.' });
      return;
    }
    const mode = normalizePlayMode(b.mode || 'individual', false);

    const record: AdventureProgressRecord = {
      storyId: story.id,
      storyTitle: story.title,
      mode,
      currentSceneIndex: Math.max(
        0,
        Math.min(story.scenes.length - 1, Number(b.currentSceneIndex) || 0)
      ),
      totalScenes: story.scenes.length,
      completed: Boolean(b.completed),
      score: Math.max(0, Number(b.score) || 0),
      faithfulChoices: Math.max(
        0,
        Number(b.faithfulChoices ?? b.faithfulChoicesCount) || 0
      ),
      selectedChoicesByScene:
        b.selectedChoicesByScene && typeof b.selectedChoicesByScene === 'object'
          ? (b.selectedChoicesByScene as Record<string, string>)
          : {},
      updatedAt: Date.now(),
    };

    const key = `${record.storyId}:${record.mode}`;
    const idx = db.adventureProgress.findIndex(
      (p) => `${p.storyId}:${p.mode}` === key
    );
    if (idx >= 0) {
      db.adventureProgress[idx] = record;
    } else {
      db.adventureProgress.unshift(record);
    }
    db.adventureProgress = db.adventureProgress.slice(0, 80);
    deps.scheduleSave();
    res.json({ progress: record, list: db.adventureProgress });
  });
}
