import crypto from 'crypto';
import type express from 'express';
import {
  BUILTIN_SURPRISE_LIBRARY,
  getSurpriseCategoryMeta,
  SURPRISE_CATEGORIES,
  SURPRISE_OUTCOME_META,
  type SurpriseCategoryId,
  type SurpriseHistoryEntry,
  type SurpriseItem,
  type SurpriseResultOutcome,
} from './src/shared/surpriseBoothData.js';

export interface SurpriseBoothDatabaseSlice {
  surpriseBoothCustomItems: SurpriseItem[];
  surpriseBoothExcludedIds: string[];
  surpriseBoothRecentIds: string[];
  surpriseBoothHistory: SurpriseHistoryEntry[];
}

export interface SurpriseBoothRoutesDeps {
  getDb: () => SurpriseBoothDatabaseSlice;
  scheduleSave: () => void;
}

const VALID_CATEGORIES = new Set<SurpriseCategoryId>(
  SURPRISE_CATEGORIES.map((c) => c.id)
);

const VALID_OUTCOMES = new Set<SurpriseResultOutcome>([
  'destacado',
  'cumplido',
  'participacion',
  'tiempo_agotado',
]);

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function ensureSurpriseBoothSlice(
  db: Partial<SurpriseBoothDatabaseSlice>
): SurpriseBoothDatabaseSlice {
  return {
    surpriseBoothCustomItems: Array.isArray(db.surpriseBoothCustomItems)
      ? db.surpriseBoothCustomItems
      : [],
    surpriseBoothExcludedIds: Array.isArray(db.surpriseBoothExcludedIds)
      ? db.surpriseBoothExcludedIds
      : [],
    surpriseBoothRecentIds: Array.isArray(db.surpriseBoothRecentIds)
      ? db.surpriseBoothRecentIds
      : [],
    surpriseBoothHistory: Array.isArray(db.surpriseBoothHistory)
      ? db.surpriseBoothHistory
      : [],
  };
}

export function getCombinedSurpriseItems(
  db: SurpriseBoothDatabaseSlice
): SurpriseItem[] {
  return [
    ...(db.surpriseBoothCustomItems || []),
    ...BUILTIN_SURPRISE_LIBRARY,
  ];
}

function sanitizeEnabledCategories(raw: unknown): SurpriseCategoryId[] {
  const ordered = SURPRISE_CATEGORIES.map((c) => c.id);
  if (!Array.isArray(raw)) return ordered;
  const set = new Set(
    raw
      .map((val) => String(val || '').trim() as SurpriseCategoryId)
      .filter((id) => VALID_CATEGORIES.has(id))
  );
  const filtered = ordered.filter((id) => set.has(id));
  return filtered.length > 0 ? filtered : ordered;
}

export function drawSurpriseItem(
  db: SurpriseBoothDatabaseSlice,
  opts: {
    enabledCategories: SurpriseCategoryId[];
    excludedIds?: string[];
    sessionUsedIds?: string[];
    allowRepeatRecent?: boolean;
    lastCategoryId?: SurpriseCategoryId | null;
    recordRecent?: boolean;
  }
): {
  surprise: SurpriseItem;
  remainingFreshCount: number;
  poolCount: number;
  recycledPool: boolean;
} | null {
  const all = getCombinedSurpriseItems(db);
  const catSet = new Set(opts.enabledCategories);
  const excludedSet = new Set(
    opts.excludedIds ?? db.surpriseBoothExcludedIds ?? []
  );

  const eligible = all.filter(
    (item) => catSet.has(item.categoryId) && !excludedSet.has(item.id)
  );
  if (eligible.length === 0) return null;

  const recentIds = db.surpriseBoothRecentIds || [];
  const recentSet = new Set(recentIds);
  const sessionSet = new Set(opts.sessionUsedIds || []);
  const allowRepeat = Boolean(opts.allowRepeatRecent);

  // Strict non-repetition pool unless director explicitly requested repeats
  let candidates = allowRepeat
    ? eligible
    : eligible.filter(
        (item) => !recentSet.has(item.id) && !sessionSet.has(item.id)
      );

  let recycledPool = false;

  if (candidates.length === 0 && !allowRepeat) {
    // Fallback 1: items not used in current session (oldest in recent history first)
    const notInSession = eligible.filter((item) => !sessionSet.has(item.id));
    if (notInSession.length > 0) {
      candidates = notInSession;
      recycledPool = true;
    } else {
      // Fallback 2: all eligible items if every single item was already drawn
      candidates = eligible;
      recycledPool = true;
    }
  }

  // Prefer not repeating the exact same category back-to-back if other categories exist in candidates
  if (opts.lastCategoryId) {
    const differentCat = candidates.filter(
      (item) => item.categoryId !== opts.lastCategoryId
    );
    if (differentCat.length > 0) {
      candidates = differentCat;
    }
  }

  // Sort by least recently used when recycled, otherwise uniform random shuffle
  let chosen: SurpriseItem;
  if (recycledPool) {
    const rank = new Map<string, number>();
    recentIds.forEach((id, idx) => rank.set(id, idx));
    const sorted = shuffleArray(candidates).sort(
      (a, b) => (rank.get(a.id) ?? -1) - (rank.get(b.id) ?? -1)
    );
    chosen = sorted[0];
  } else {
    const shuffled = shuffleArray(candidates);
    chosen = shuffled[0];
  }

  if (opts.recordRecent !== false) {
    const maxRecentWindow = Math.max(12, Math.floor(all.length * 0.65));
    const nextRecent = recentIds.filter((id) => id !== chosen.id);
    nextRecent.push(chosen.id);
    db.surpriseBoothRecentIds = nextRecent.slice(-maxRecentWindow);
  }

  const updatedRecentSet = new Set(db.surpriseBoothRecentIds || []);
  const updatedSessionSet = new Set([...sessionSet, chosen.id]);
  const remainingFreshCount = eligible.filter(
    (item) => !updatedRecentSet.has(item.id) && !updatedSessionSet.has(item.id)
  ).length;

  return {
    surprise: chosen,
    remainingFreshCount,
    poolCount: eligible.length,
    recycledPool,
  };
}

export function registerSurpriseBoothRoutes(
  app: express.Express,
  deps: SurpriseBoothRoutesDeps
): void {
  // 1. Full state (library + exclusions + recent + history)
  app.get('/api/surprise-booth/state', (_req, res) => {
    const dbRef = deps.getDb();
    const items = getCombinedSurpriseItems(dbRef);
    res.json({
      categories: SURPRISE_CATEGORIES,
      items,
      excludedIds: dbRef.surpriseBoothExcludedIds || [],
      recentIds: dbRef.surpriseBoothRecentIds || [],
      history: dbRef.surpriseBoothHistory || [],
    });
  });

  // 2. Draw a surprise respecting enabled categories, exclusions, and anti-repeat rules
  app.post('/api/surprise-booth/draw', (req, res) => {
    const dbRef = deps.getDb();
    const body = req.body || {};

    const enabledCategories = sanitizeEnabledCategories(body.enabledCategories);
    const excludedIds = Array.isArray(body.excludedIds)
      ? body.excludedIds.map((id: unknown) => String(id || '').trim()).filter(Boolean)
      : dbRef.surpriseBoothExcludedIds || [];
    const sessionUsedIds = Array.isArray(body.sessionUsedIds)
      ? body.sessionUsedIds.map((id: unknown) => String(id || '').trim()).filter(Boolean)
      : [];
    const allowRepeatRecent = Boolean(body.allowRepeatRecent);
    const lastCategoryId = VALID_CATEGORIES.has(body.lastCategoryId)
      ? (body.lastCategoryId as SurpriseCategoryId)
      : null;

    const result = drawSurpriseItem(dbRef, {
      enabledCategories,
      excludedIds,
      sessionUsedIds,
      allowRepeatRecent,
      lastCategoryId,
      recordRecent: true,
    });

    if (!result) {
      res.status(400).json({
        error:
          'No hay sorpresas disponibles con las categorías y exclusiones actuales. Activa más categorías o quita algunas exclusiones.',
      });
      return;
    }

    deps.scheduleSave();
    res.json({
      surprise: result.surprise,
      category: getSurpriseCategoryMeta(result.surprise.categoryId),
      remainingFreshCount: result.remainingFreshCount,
      poolCount: result.poolCount,
      recycledPool: result.recycledPool,
      recentIds: dbRef.surpriseBoothRecentIds || [],
    });
  });

  // 3. Persist excluded activity IDs
  app.put('/api/surprise-booth/exclusions', (req, res) => {
    const dbRef = deps.getDb();
    const raw = req.body?.excludedIds;
    if (!Array.isArray(raw)) {
      res.status(400).json({ error: 'Formato inválido de exclusiones.' });
      return;
    }
    const validIds = new Set(getCombinedSurpriseItems(dbRef).map((i) => i.id));
    dbRef.surpriseBoothExcludedIds = Array.from(
      new Set(
        raw
          .map((id: unknown) => String(id || '').trim())
          .filter((id) => validIds.has(id))
      )
    );
    deps.scheduleSave();
    res.json({ excludedIds: dbRef.surpriseBoothExcludedIds });
  });

  // 4. Reset recent non-repeat tracking
  app.post('/api/surprise-booth/reset-recent', (_req, res) => {
    const dbRef = deps.getDb();
    dbRef.surpriseBoothRecentIds = [];
    deps.scheduleSave();
    res.json({ recentIds: [] });
  });

  // 5. Add custom surprise activity
  app.post('/api/surprise-booth/custom', (req, res) => {
    const dbRef = deps.getDb();
    const body = req.body || {};

    const rawCat = String(body.categoryId || 'pregunta_biblica') as SurpriseCategoryId;
    const categoryId: SurpriseCategoryId = VALID_CATEGORIES.has(rawCat)
      ? rawCat
      : 'pregunta_biblica';
    const title = String(body.title || '').trim().slice(0, 120);
    const instructions = String(body.instructions || '').trim().slice(0, 500);
    const reference =
      String(body.reference || '').trim().slice(0, 120) || 'Palabra de Dios';
    const guideHint = String(body.guideHint || '').trim().slice(0, 320);
    const suggestedSec = Math.max(
      10,
      Math.min(300, Math.round(Number(body.suggestedSec) || 45))
    );

    if (!title || !instructions) {
      res.status(400).json({
        error: 'Escribe el título y las instrucciones de la sorpresa.',
      });
      return;
    }

    const newItem: SurpriseItem = {
      id: `sbc-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
      categoryId,
      title,
      instructions,
      reference,
      suggestedSec,
      ...(guideHint ? { guideHint } : {}),
      isCustom: true,
    };

    if (!Array.isArray(dbRef.surpriseBoothCustomItems)) {
      dbRef.surpriseBoothCustomItems = [];
    }
    dbRef.surpriseBoothCustomItems.unshift(newItem);
    deps.scheduleSave();
    res.status(201).json({ item: newItem });
  });

  // 6. Delete custom surprise activity
  app.delete('/api/surprise-booth/custom/:id', (req, res) => {
    const id = String(req.params.id || '').trim();
    const dbRef = deps.getDb();
    const before = (dbRef.surpriseBoothCustomItems || []).length;
    dbRef.surpriseBoothCustomItems = (
      dbRef.surpriseBoothCustomItems || []
    ).filter((item) => item.id !== id);

    if (dbRef.surpriseBoothCustomItems.length === before) {
      res.status(404).json({
        error: 'Solo se pueden eliminar sorpresas personalizadas creadas por el director.',
      });
      return;
    }

    dbRef.surpriseBoothExcludedIds = (
      dbRef.surpriseBoothExcludedIds || []
    ).filter((eid) => eid !== id);
    dbRef.surpriseBoothRecentIds = (
      dbRef.surpriseBoothRecentIds || []
    ).filter((rid) => rid !== id);

    deps.scheduleSave();
    res.json({ deleted: true, id });
  });

  // 7. Record surprise result into history
  app.post('/api/surprise-booth/history', (req, res) => {
    const dbRef = deps.getDb();
    const body = req.body || {};

    const rawCat = String(body.categoryId || 'pregunta_biblica') as SurpriseCategoryId;
    const categoryId: SurpriseCategoryId = VALID_CATEGORIES.has(rawCat)
      ? rawCat
      : 'pregunta_biblica';
    const rawOutcome = String(body.outcome || 'cumplido') as SurpriseResultOutcome;
    const outcome: SurpriseResultOutcome = VALID_OUTCOMES.has(rawOutcome)
      ? rawOutcome
      : 'cumplido';

    const title = String(body.title || '').trim().slice(0, 140);
    if (!title) {
      res.status(400).json({ error: 'Falta el título de la sorpresa.' });
      return;
    }

    const participantName =
      String(body.participantName || '').trim().slice(0, 80) ||
      'Sociedad de Jóvenes';
    const pointsAwarded =
      typeof body.pointsAwarded === 'number' && Number.isFinite(body.pointsAwarded)
        ? Math.max(0, Math.round(body.pointsAwarded))
        : SURPRISE_OUTCOME_META[outcome].defaultPoints;
    const durationUsedSec = Math.max(
      1,
      Math.min(600, Math.round(Number(body.durationUsedSec) || 45))
    );
    const note = String(body.note || '').trim().slice(0, 300);
    const programId = String(body.programId || '').trim().slice(0, 64);
    const programTitle = String(body.programTitle || '').trim().slice(0, 120);

    const entry: SurpriseHistoryEntry = {
      id: `sbh-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
      surpriseId: String(body.surpriseId || 'manual'),
      categoryId,
      title,
      participantName,
      outcome,
      pointsAwarded,
      durationUsedSec,
      ...(note ? { note } : {}),
      ...(programId ? { programId } : {}),
      ...(programTitle ? { programTitle } : {}),
      createdAt: Date.now(),
    };

    if (!Array.isArray(dbRef.surpriseBoothHistory)) {
      dbRef.surpriseBoothHistory = [];
    }
    dbRef.surpriseBoothHistory.unshift(entry);
    dbRef.surpriseBoothHistory = dbRef.surpriseBoothHistory.slice(0, 150);

    deps.scheduleSave();
    res.status(201).json({ entry });
  });
}
