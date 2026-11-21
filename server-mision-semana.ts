import crypto from 'crypto';
import type express from 'express';
import {
  AUTOMATIC_RECOGNITION_MILESTONES,
  buildActiveWeeklyCatalog,
  getWeekWindowDates,
  MISSION_CATEGORIES,
  type MissionCategoryId,
  type MissionParticipantSummary,
  type MissionParticipationType,
  type MissionRecognition,
  type MissionRegistration,
  type WeeklyMission,
} from './src/shared/weeklyMissionsData.js';

export interface WeeklyMissionsDatabaseSlice {
  weeklyCustomMissions: WeeklyMission[];
  weeklyFeaturedMissionId: string | null;
  weeklyMissionRegistrations: MissionRegistration[];
  weeklyMissionRecognitions: MissionRecognition[];
  weeklyDirectorSecret: string;
}

export interface WeeklyMissionsRoutesDeps {
  getDb: () => WeeklyMissionsDatabaseSlice & { serverSecret?: string };
  scheduleSave: () => void;
}

const VALID_CATEGORIES = new Set<MissionCategoryId>([
  'servicio',
  'evangelismo',
  'vida_espiritual',
  'comunidad',
]);

const VALID_PARTICIPATION_TYPES = new Set<MissionParticipationType>([
  'individual',
  'grupal',
  'individual_o_grupal',
]);

export function ensureWeeklyMissionsSlice(
  raw: Partial<WeeklyMissionsDatabaseSlice> | undefined
): WeeklyMissionsDatabaseSlice {
  return {
    weeklyCustomMissions: Array.isArray(raw?.weeklyCustomMissions)
      ? raw.weeklyCustomMissions
      : [],
    weeklyFeaturedMissionId:
      typeof raw?.weeklyFeaturedMissionId === 'string' &&
      raw.weeklyFeaturedMissionId.trim()
        ? raw.weeklyFeaturedMissionId.trim()
        : null,
    weeklyMissionRegistrations: Array.isArray(raw?.weeklyMissionRegistrations)
      ? raw.weeklyMissionRegistrations
      : [],
    weeklyMissionRecognitions: Array.isArray(raw?.weeklyMissionRecognitions)
      ? raw.weeklyMissionRecognitions
      : [],
    weeklyDirectorSecret:
      typeof raw?.weeklyDirectorSecret === 'string' &&
      raw.weeklyDirectorSecret.trim().length >= 4
        ? raw.weeklyDirectorSecret.trim()
        : process.env.MISSION_DIRECTOR_PIN || 'SJ2026',
  };
}

function validateSafeOptionalPhoto(raw: unknown): string | undefined {
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

function computeDirectorSessionToken(
  serverSecret: string,
  directorPin: string
): string {
  return crypto
    .createHmac('sha256', `${serverSecret}:weekly-missions-director`)
    .update(directorPin)
    .digest('hex')
    .slice(0, 32);
}

function verifyDirectorToken(
  token: string,
  serverSecret: string,
  directorPin: string
): boolean {
  if (!token) return false;
  const expected = computeDirectorSessionToken(serverSecret, directorPin);
  const a = Buffer.from(expected, 'utf-8');
  const b = Buffer.from(token.trim(), 'utf-8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function sanitizeIsoDate(raw: unknown, fallback: string): string {
  const s = String(raw || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : fallback;
}

function getAllMissions(db: WeeklyMissionsDatabaseSlice): WeeklyMission[] {
  const builtin = buildActiveWeeklyCatalog();
  const custom = Array.isArray(db.weeklyCustomMissions)
    ? db.weeklyCustomMissions
    : [];
  const combined = [...custom, ...builtin];

  const featuredId = db.weeklyFeaturedMissionId;
  if (featuredId && combined.some((m) => m.id === featuredId)) {
    return combined.map((m) => ({
      ...m,
      isFeaturedCurrentWeek: m.id === featuredId,
    }));
  }
  return combined;
}

function syncAutomaticRecognitionsForParticipant(
  db: WeeklyMissionsDatabaseSlice,
  participantKey: string,
  participantName: string
): void {
  const approved = db.weeklyMissionRegistrations.filter(
    (r) =>
      r.participantKey === participantKey && r.status === 'approved'
  );
  if (approved.length === 0) return;

  const cats = new Set<MissionCategoryId>(approved.map((r) => r.category));

  for (const ms of AUTOMATIC_RECOGNITION_MILESTONES) {
    let earned = false;
    if (typeof ms.minCompleted === 'number' && approved.length >= ms.minCompleted) {
      earned = true;
    }
    if (ms.requiredCategory && cats.has(ms.requiredCategory)) {
      earned = true;
    }
    if (ms.requireAllCategories && cats.size >= 4) {
      earned = true;
    }

    if (!earned) continue;
    const alreadyHas = db.weeklyMissionRecognitions.some(
      (rec) =>
        rec.participantKey === participantKey &&
        rec.isAutomatic &&
        rec.title === ms.title
    );
    if (!alreadyHas) {
      db.weeklyMissionRecognitions.unshift({
        id: `mrec-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
        participantKey,
        participantName,
        title: ms.title,
        reason: ms.reason,
        ...(ms.requiredCategory ? { category: ms.requiredCategory } : {}),
        grantedBy: 'Sistema de Misiones Juveniles',
        grantedAt: Date.now(),
        isAutomatic: true,
      });
    }
  }
}

function buildParticipantSummaries(
  db: WeeklyMissionsDatabaseSlice
): MissionParticipantSummary[] {
  const map = new Map<string, MissionParticipantSummary>();

  for (const r of db.weeklyMissionRegistrations) {
    const existing = map.get(r.participantKey) || {
      participantKey: r.participantKey,
      participantName: r.participantName,
      totalPoints: 0,
      completedCount: 0,
      pendingCount: 0,
      categoriesCompleted: [],
      recognitionsCount: 0,
      lastActivityAt: r.submittedAt,
    };

    if (r.status === 'approved') {
      existing.totalPoints += r.pointsAwarded;
      existing.completedCount += 1;
      if (!existing.categoriesCompleted.includes(r.category)) {
        existing.categoriesCompleted.push(r.category);
      }
    } else if (r.status === 'pending_validation') {
      existing.pendingCount += 1;
    }
    if (r.submittedAt > existing.lastActivityAt) {
      existing.lastActivityAt = r.submittedAt;
    }
    existing.participantName = r.participantName;
    map.set(r.participantKey, existing);
  }

  for (const rec of db.weeklyMissionRecognitions) {
    const entry = map.get(rec.participantKey);
    if (entry) {
      entry.recognitionsCount += 1;
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    return b.completedCount - a.completedCount;
  });
}

function sanitizeRegistrationsForPublic(
  registrations: MissionRegistration[]
): Array<Omit<MissionRegistration, 'photoDataUrl'> & { photoDataUrl?: string }> {
  // Never expose photos publicly unless explicitly consented and approved
  return registrations.map((r) => ({
    ...r,
    photoDataUrl:
      r.hasOptionalPhoto && r.photoConsentAuthorized && r.status === 'approved'
        ? r.photoDataUrl
        : undefined,
  }));
}

export function registerWeeklyMissionsRoutes(
  app: express.Express,
  deps: WeeklyMissionsRoutesDeps
): void {
  const ensureDb = () => {
    const db = deps.getDb();
    if (!Array.isArray(db.weeklyCustomMissions)) db.weeklyCustomMissions = [];
    if (!Array.isArray(db.weeklyMissionRegistrations)) {
      db.weeklyMissionRegistrations = [];
    }
    if (!Array.isArray(db.weeklyMissionRecognitions)) {
      db.weeklyMissionRecognitions = [];
    }
    if (!db.weeklyDirectorSecret) {
      db.weeklyDirectorSecret = process.env.MISSION_DIRECTOR_PIN || 'SJ2026';
    }
    return db;
  };

  const isDirectorAuthorized = (req: express.Request): boolean => {
    const db = ensureDb();
    const headerAuth = String(req.headers.authorization || '');
    const bearer = headerAuth.startsWith('Bearer ')
      ? headerAuth.slice(7).trim()
      : '';
    const token =
      bearer || String(req.headers['x-director-token'] || '').trim();
    return verifyDirectorToken(
      token,
      db.serverSecret || 'dime-tu-secret',
      db.weeklyDirectorSecret
    );
  };

  // 1. Get complete weekly missions state (catalog, featured, history, recognitions)
  app.get('/api/missions/state', (req, res) => {
    const db = ensureDb();
    const missions = getAllMissions(db);
    const featuredMission =
      missions.find((m) => m.isFeaturedCurrentWeek) || missions[0];
    const authorized = isDirectorAuthorized(req);

    const registrations = authorized
      ? db.weeklyMissionRegistrations
      : sanitizeRegistrationsForPublic(db.weeklyMissionRegistrations);

    res.json({
      categories: MISSION_CATEGORIES,
      missions,
      featuredMission,
      registrations,
      recognitions: db.weeklyMissionRecognitions,
      summaries: buildParticipantSummaries(db),
      weekWindow: getWeekWindowDates(0),
      directorAuthorized: authorized,
    });
  });

  // 2. Director authorization login (issues HMAC director session token)
  app.post('/api/missions/director/auth', (req, res) => {
    const db = ensureDb();
    const pin = String(req.body?.pin || '').trim();
    const expectedPin = db.weeklyDirectorSecret;
    const a = Buffer.from(pin, 'utf-8');
    const b = Buffer.from(expectedPin, 'utf-8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      res.status(401).json({
        error: 'Clave de director autorizado incorrecta.',
      });
      return;
    }

    const token = computeDirectorSessionToken(
      db.serverSecret || 'dime-tu-secret',
      expectedPin
    );
    res.json({ authorized: true, directorToken: token });
  });

  // 3. Register participation in a weekly mission (voluntary, anti-duplicate, privacy-safe)
  app.post('/api/missions/register', (req, res) => {
    const db = ensureDb();
    const b = req.body || {};

    // Explicitly reject any attempt to send private third-party location/contact fields
    if (
      b.exactLocation ||
      b.gps ||
      b.coordinates ||
      b.address ||
      b.thirdPartyPhone ||
      b.thirdPartyEmail
    ) {
      res.status(400).json({
        error:
          'Por privacidad y seguridad no se permiten ubicaciones exactas, coordenadas GPS ni datos privados de terceros.',
      });
      return;
    }

    const missionId = String(b.missionId || '').trim();
    const missions = getAllMissions(db);
    const mission = missions.find((m) => m.id === missionId);
    if (!mission) {
      res.status(404).json({ error: 'La misión seleccionada no existe.' });
      return;
    }

    const participantName = String(b.participantName || '').trim().slice(0, 60);
    const participantKey = String(b.participantKey || '')
      .trim()
      .slice(0, 80);
    const declarationText = String(b.declarationText || '')
      .trim()
      .slice(0, 500);
    const reflectionNote = String(b.reflectionNote || '')
      .trim()
      .slice(0, 300);

    if (participantName.length < 2 || !participantKey) {
      res.status(400).json({
        error: 'Escribe tu nombre (mínimo 2 caracteres) para registrar tu participación.',
      });
      return;
    }

    if (declarationText.length < 8) {
      res.status(400).json({
        error:
          'Escribe una breve declaración de cumplimiento (mínimo 8 caracteres) sin exponer datos privados de otras personas.',
      });
      return;
    }

    // Strict anti-duplicate protection: same participantKey OR same normalized name for same mission
    const normName = participantName.toLowerCase();
    const duplicate = db.weeklyMissionRegistrations.some(
      (r) =>
        r.missionId === mission.id &&
        r.status !== 'rejected' &&
        (r.participantKey === participantKey ||
          r.participantName.trim().toLowerCase() === normName)
    );
    if (duplicate) {
      res.status(409).json({
        error:
          'Ya registraste esta misión anteriormente. No es posible duplicar puntos por la misma misión.',
      });
      return;
    }

    const modeChosen: 'individual' | 'grupal' =
      b.modeChosen === 'grupal' && mission.participationType !== 'individual'
        ? 'grupal'
        : mission.participationType === 'grupal'
          ? 'grupal'
          : 'individual';

    const groupName =
      modeChosen === 'grupal'
        ? String(b.groupName || '').trim().slice(0, 60) || 'Grupo Juvenil'
        : undefined;
    const groupMemberCount =
      modeChosen === 'grupal'
        ? Math.max(2, Math.min(80, Number(b.groupMemberCount) || 2))
        : undefined;

    // Optional photo requires explicit authorization confirmation
    const rawPhoto = typeof b.photoDataUrl === 'string' ? b.photoDataUrl.trim() : '';
    const photoConsentAuthorized = Boolean(b.photoConsentAuthorized);
    let photoDataUrl: string | undefined;
    if (rawPhoto) {
      if (!photoConsentAuthorized) {
        res.status(400).json({
          error:
            'Debes confirmar la autorización de privacidad para adjuntar una fotografía opcional (sin rostros ni datos de terceros).',
        });
        return;
      }
      photoDataUrl = validateSafeOptionalPhoto(rawPhoto);
      if (!photoDataUrl) {
        res.status(400).json({
          error:
            'La fotografía opcional no es válida o supera el límite permitido (350 KB).',
        });
        return;
      }
    }

    const needsValidation = mission.requiresDirectorValidation;
    const now = Date.now();
    const registration: MissionRegistration = {
      id: `mreg-${now.toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
      missionId: mission.id,
      missionTitle: mission.title,
      category: mission.category,
      participantKey,
      participantName,
      ...(groupName ? { groupName } : {}),
      ...(groupMemberCount ? { groupMemberCount } : {}),
      modeChosen,
      declarationText,
      ...(reflectionNote ? { reflectionNote } : {}),
      hasOptionalPhoto: Boolean(photoDataUrl),
      photoConsentAuthorized: Boolean(photoDataUrl) && photoConsentAuthorized,
      ...(photoDataUrl ? { photoDataUrl } : {}),
      status: needsValidation ? 'pending_validation' : 'approved',
      pointsAwarded: needsValidation ? 0 : mission.pointsReward,
      ...(!needsValidation
        ? {
            validatedBy: 'Declaración de cumplimiento voluntario',
            validatedAt: now,
          }
        : {}),
      submittedAt: now,
    };

    db.weeklyMissionRegistrations.unshift(registration);
    if (!needsValidation) {
      syncAutomaticRecognitionsForParticipant(
        db,
        participantKey,
        participantName
      );
    }
    deps.scheduleSave();

    res.status(201).json({
      registration,
      summaries: buildParticipantSummaries(db),
      recognitions: db.weeklyMissionRecognitions,
    });
  });

  // 4. Authorized director validates (approves or declines) pending participation
  app.post('/api/missions/registrations/:id/validate', (req, res) => {
    if (!isDirectorAuthorized(req)) {
      res.status(403).json({
        error:
          'Solo un director autorizado puede validar misiones pendientes.',
      });
      return;
    }

    const db = ensureDb();
    const id = String(req.params.id || '').trim();
    const reg = db.weeklyMissionRegistrations.find((r) => r.id === id);
    if (!reg) {
      res.status(404).json({ error: 'Registro de misión no encontrado.' });
      return;
    }

    const decision =
      req.body?.decision === 'rejected' ? 'rejected' : 'approved';
    const directorName =
      String(req.body?.directorName || 'Director Autorizado')
        .trim()
        .slice(0, 60) || 'Director Autorizado';
    const directorNote = String(req.body?.directorNote || '')
      .trim()
      .slice(0, 240);

    const mission = getAllMissions(db).find((m) => m.id === reg.missionId);
    const points = mission?.pointsReward || 150;

    if (decision === 'approved') {
      // Guard against awarding points twice if already approved
      if (reg.status !== 'approved') {
        reg.status = 'approved';
        reg.pointsAwarded = points;
        reg.validatedAt = Date.now();
        reg.validatedBy = directorName;
        if (directorNote) reg.directorNote = directorNote;
        syncAutomaticRecognitionsForParticipant(
          db,
          reg.participantKey,
          reg.participantName
        );
      }
    } else {
      reg.status = 'rejected';
      reg.pointsAwarded = 0;
      reg.validatedAt = Date.now();
      reg.validatedBy = directorName;
      reg.directorNote =
        directorNote || 'Pendiente de completar según las instrucciones.';
    }

    deps.scheduleSave();
    res.json({
      registration: reg,
      summaries: buildParticipantSummaries(db),
      recognitions: db.weeklyMissionRecognitions,
    });
  });

  // 5. Authorized director creates a custom weekly mission or sets featured mission
  app.post('/api/missions', (req, res) => {
    if (!isDirectorAuthorized(req)) {
      res.status(403).json({
        error:
          'Se requiere autorización de director para crear misiones semanales.',
      });
      return;
    }

    const db = ensureDb();
    const b = req.body || {};

    const title = String(b.title || '').trim().slice(0, 110);
    const category = String(b.category || 'servicio') as MissionCategoryId;
    const activityType =
      String(b.activityType || '').trim().slice(0, 80) ||
      'Desafío juvenil semanal';
    const description = String(b.description || '').trim().slice(0, 500);
    const biblicalReference = String(b.biblicalReference || '')
      .trim()
      .slice(0, 80);
    const spiritualFocus = String(b.spiritualFocus || '').trim().slice(0, 220);

    if (title.length < 4 || description.length < 10 || !biblicalReference) {
      res.status(400).json({
        error:
          'Completa título, descripción y referencia bíblica para crear la misión.',
      });
      return;
    }

    const validCat: MissionCategoryId = VALID_CATEGORIES.has(category)
      ? category
      : 'servicio';
    const rawType = String(
      b.participationType || 'individual_o_grupal'
    ) as MissionParticipationType;
    const participationType: MissionParticipationType =
      VALID_PARTICIPATION_TYPES.has(rawType)
        ? rawType
        : 'individual_o_grupal';

    const defWeek = getWeekWindowDates(0);
    const startDate = sanitizeIsoDate(b.startDate, defWeek.startDate);
    const endDate = sanitizeIsoDate(b.endDate, defWeek.endDate);
    const instructions = Array.isArray(b.instructions)
      ? b.instructions
          .map((i: unknown) => String(i || '').trim())
          .filter(Boolean)
          .slice(0, 6)
      : [
          'Realiza esta misión voluntariamente con respeto y amor cristiano.',
          'No solicites ni publiques datos privados ni ubicaciones exactas de terceros.',
          'Registra tu declaración de cumplimiento al finalizar.',
        ];

    const newMission: WeeklyMission = {
      id: `mis-custom-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
      title,
      category: validCat,
      activityType,
      description,
      instructions:
        instructions.length > 0
          ? instructions
          : ['Cumple la misión con integridad y registra tu declaración.'],
      participationType,
      biblicalReference,
      spiritualFocus:
        spiritualFocus ||
        `Vivimos la fe de forma práctica inspirados en ${biblicalReference}.`,
      pointsReward: Math.max(
        50,
        Math.min(500, Math.round(Number(b.pointsReward) || 150))
      ),
      requiresDirectorValidation: Boolean(b.requiresDirectorValidation),
      startDate,
      endDate,
      isFeaturedCurrentWeek: Boolean(b.setAsFeatured),
      isCustom: true,
      createdAt: Date.now(),
    };

    db.weeklyCustomMissions.unshift(newMission);
    if (b.setAsFeatured) {
      db.weeklyFeaturedMissionId = newMission.id;
    }
    deps.scheduleSave();
    res.status(201).json({ mission: newMission });
  });

  // 6. Authorized director sets the featured mission of the week
  app.post('/api/missions/featured', (req, res) => {
    if (!isDirectorAuthorized(req)) {
      res.status(403).json({
        error:
          'Solo un director autorizado puede seleccionar la Misión de la Semana.',
      });
      return;
    }
    const db = ensureDb();
    const missionId = String(req.body?.missionId || '').trim();
    const missions = getAllMissions(db);
    if (!missions.some((m) => m.id === missionId)) {
      res.status(404).json({ error: 'Misión no encontrada.' });
      return;
    }
    db.weeklyFeaturedMissionId = missionId;
    deps.scheduleSave();
    res.json({ featuredMissionId: missionId });
  });

  // 7. Authorized director deletes a custom mission
  app.delete('/api/missions/:id', (req, res) => {
    if (!isDirectorAuthorized(req)) {
      res.status(403).json({
        error: 'Se requiere autorización de director para eliminar misiones.',
      });
      return;
    }
    const db = ensureDb();
    const id = String(req.params.id || '').trim();
    if (!id.startsWith('mis-custom-')) {
      res.status(400).json({
        error: 'Solo se pueden eliminar misiones personalizadas.',
      });
      return;
    }
    const before = db.weeklyCustomMissions.length;
    db.weeklyCustomMissions = db.weeklyCustomMissions.filter(
      (m) => m.id !== id
    );
    if (db.weeklyCustomMissions.length === before) {
      res.status(404).json({ error: 'Misión personalizada no encontrada.' });
      return;
    }
    if (db.weeklyFeaturedMissionId === id) {
      db.weeklyFeaturedMissionId = null;
    }
    deps.scheduleSave();
    res.json({ deleted: true });
  });

  // 8. Authorized director grants a special recognition
  app.post('/api/missions/recognitions', (req, res) => {
    if (!isDirectorAuthorized(req)) {
      res.status(403).json({
        error:
          'Solo un director autorizado puede otorgar reconocimientos especiales.',
      });
      return;
    }
    const db = ensureDb();
    const b = req.body || {};
    const participantKey = String(b.participantKey || '').trim();
    const participantName = String(b.participantName || '').trim().slice(0, 60);
    const title = String(b.title || '').trim().slice(0, 80);
    const reason = String(b.reason || '').trim().slice(0, 220);
    const grantedBy =
      String(b.grantedBy || 'Director de Sociedad de Jóvenes')
        .trim()
        .slice(0, 60) || 'Director de Sociedad de Jóvenes';

    if (!participantKey || !participantName || !title || !reason) {
      res.status(400).json({
        error: 'Completa participante, título y motivo del reconocimiento.',
      });
      return;
    }

    const rec: MissionRecognition = {
      id: `mrec-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
      participantKey,
      participantName,
      title,
      reason,
      ...(VALID_CATEGORIES.has(b.category) ? { category: b.category } : {}),
      grantedBy,
      grantedAt: Date.now(),
      isAutomatic: false,
    };

    db.weeklyMissionRecognitions.unshift(rec);
    deps.scheduleSave();
    res.status(201).json({
      recognition: rec,
      recognitions: db.weeklyMissionRecognitions,
    });
  });
}
