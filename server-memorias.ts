import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type express from 'express';
import type {
  MemoryActivityItem,
  MemoryChallengeItem,
  MemoryChampionshipSummary,
  MemoryEditAccess,
  MemoryGameItem,
  MemoryGlobalSettings,
  MemoryImportSourcesBundle,
  MemoryParticipationStats,
  MemoryPhotoItem,
  MemoryPlatformRecognitionSummary,
  MemoryRecognitionItem,
  MemoryResultRankItem,
  MemoryShareAccess,
  MemoryTeamItem,
  MemoryViewAccess,
  MemoryVisibility,
  SaturdayMemoryRecord,
} from './src/shared/memoriesData.js';
import {
  anonymizeDisplayName,
  isPhotoPubliclyAllowed,
} from './src/shared/memoriesData.js';
import type { ChurchTournament } from './src/shared/expansionTypes.js';
import type { SaturdayProgram } from './src/shared/saturdayProgramTypes.js';
import type { SaturdayChallengeHistoryEntry } from './src/shared/saturdayChallengesData.js';
import type { SaturdayRouletteHistoryEntry } from './src/shared/saturdayRouletteData.js';
import type { SurpriseHistoryEntry } from './src/shared/surpriseBoothData.js';
import type { TalentShowcaseSession } from './src/shared/talentShowData.js';
import type { GameHistorySummary } from './src/shared/types.js';
import type { MissionRecognition } from './src/shared/weeklyMissionsData.js';
import {
  computeSeasonStandings,
  type YouthChampionshipSeason,
} from './src/shared/youthChampionshipsData.js';

export interface StoredMemorySettings {
  viewAccess: MemoryViewAccess;
  editAccess: MemoryEditAccess;
  shareAccess: MemoryShareAccess;
  hideNamesByDefault: boolean;
  hidePhotosByDefault: boolean;
  requireMinorGuardianConsent: boolean;
  memberViewCode: string;
  adminPin: string;
}

export interface StoredMemoryPhotoInternal extends MemoryPhotoItem {
  fileName?: string;
}

export interface StoredSaturdayMemoryRecord
  extends Omit<SaturdayMemoryRecord, 'photos'> {
  photos: StoredMemoryPhotoInternal[];
}

export interface MemoriesDatabaseSlice {
  saturdayMemories: StoredSaturdayMemoryRecord[];
  memorySettings: StoredMemorySettings;
}

export interface MemoriesRoutesDeps {
  getDb: () => MemoriesDatabaseSlice & {
    serverSecret?: string;
    weeklyDirectorSecret?: string;
    saturdayPrograms?: Record<string, SaturdayProgram>;
    history?: GameHistorySummary[];
    saturdayChallengeHistory?: SaturdayChallengeHistoryEntry[];
    saturdayRouletteHistory?: SaturdayRouletteHistoryEntry[];
    surpriseBoothHistory?: SurpriseHistoryEntry[];
    youthChampionshipSeasons?: YouthChampionshipSeason[];
    weeklyMissionRecognitions?: MissionRecognition[];
    talentShowcase?: TalentShowcaseSession;
    expansion?: {
      tournaments?: Record<string, ChurchTournament>;
    };
  };
  scheduleSave: () => void;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const MEMORIES_PHOTOS_DIR = path.join(DATA_DIR, 'memories_photos');

const VALID_VIEW_ACCESS = new Set<MemoryViewAccess>([
  'public',
  'members_code',
  'admins_only',
]);
const VALID_EDIT_ACCESS = new Set<MemoryEditAccess>([
  'admins_only',
  'directors_code',
]);
const VALID_SHARE_ACCESS = new Set<MemoryShareAccess>([
  'admins_only',
  'directors_code',
]);
const VALID_VISIBILITY = new Set<MemoryVisibility>([
  'authorized_public',
  'internal_only',
  'admins_only',
]);

function defaultMemorySettings(
  raw?: Partial<StoredMemorySettings>,
  fallbackPin = 'SJ2026'
): StoredMemorySettings {
  return {
    viewAccess: VALID_VIEW_ACCESS.has(raw?.viewAccess as MemoryViewAccess)
      ? (raw!.viewAccess as MemoryViewAccess)
      : 'public',
    editAccess: VALID_EDIT_ACCESS.has(raw?.editAccess as MemoryEditAccess)
      ? (raw!.editAccess as MemoryEditAccess)
      : 'admins_only',
    shareAccess: VALID_SHARE_ACCESS.has(raw?.shareAccess as MemoryShareAccess)
      ? (raw!.shareAccess as MemoryShareAccess)
      : 'admins_only',
    hideNamesByDefault: Boolean(raw?.hideNamesByDefault),
    hidePhotosByDefault: Boolean(raw?.hidePhotosByDefault),
    requireMinorGuardianConsent: raw?.requireMinorGuardianConsent !== false,
    memberViewCode:
      typeof raw?.memberViewCode === 'string' && raw.memberViewCode.trim()
        ? raw.memberViewCode.trim().slice(0, 32)
        : 'JOVENES26',
    adminPin:
      typeof raw?.adminPin === 'string' && raw.adminPin.trim().length >= 4
        ? raw.adminPin.trim().slice(0, 32)
        : process.env.MEMORIES_ADMIN_PIN || fallbackPin,
  };
}

export function ensureMemoriesSlice(
  raw: Partial<MemoriesDatabaseSlice> | undefined,
  fallbackPin = 'SJ2026'
): MemoriesDatabaseSlice {
  return {
    saturdayMemories: Array.isArray(raw?.saturdayMemories)
      ? raw!.saturdayMemories
      : [],
    memorySettings: defaultMemorySettings(raw?.memorySettings, fallbackPin),
  };
}

function sanitizeIdSeg(v: string): string {
  return v.replace(/[^A-Za-z0-9_-]/g, '');
}

function sanitizeIsoDate(raw: unknown, fallback?: string): string {
  const s = String(raw || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return fallback || new Date().toISOString().slice(0, 10);
}

function computeToken(
  serverSecret: string,
  domain: string,
  pin: string
): string {
  return crypto
    .createHmac('sha256', `${serverSecret}:${domain}`)
    .update(pin)
    .digest('hex')
    .slice(0, 32);
}

function timingSafeMatch(aStr: string, bStr: string): boolean {
  if (!aStr || !bStr) return false;
  const a = Buffer.from(aStr, 'utf-8');
  const b = Buffer.from(bStr, 'utf-8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

type ViewerRole = 'admin' | 'member' | 'public';

function resolveViewerRole(
  req: express.Request,
  db: ReturnType<MemoriesRoutesDeps['getDb']>
): ViewerRole {
  const secret = db.serverSecret || 'dime-tu-memories-secret';
  const settings = db.memorySettings;

  const adminHeader = String(
    req.headers['x-memory-admin-token'] || req.query.at || ''
  ).trim();
  if (
    adminHeader &&
    timingSafeMatch(
      adminHeader,
      computeToken(secret, 'memories-admin', settings.adminPin)
    )
  ) {
    return 'admin';
  }

  const memberHeader = String(
    req.headers['x-memory-member-token'] || req.query.mt || ''
  ).trim();
  if (
    memberHeader &&
    timingSafeMatch(
      memberHeader,
      computeToken(secret, 'memories-member', settings.memberViewCode)
    )
  ) {
    return 'member';
  }

  return 'public';
}

function canView(role: ViewerRole, s: StoredMemorySettings): boolean {
  if (role === 'admin') return true;
  if (s.viewAccess === 'admins_only') return false;
  if (s.viewAccess === 'members_code') return role === 'member';
  return true;
}

function canEdit(role: ViewerRole, s: StoredMemorySettings): boolean {
  if (role === 'admin') return true;
  if (s.editAccess === 'directors_code' && role === 'member') return true;
  return false;
}

function canShare(role: ViewerRole, s: StoredMemorySettings): boolean {
  if (role === 'admin') return true;
  if (s.shareAccess === 'directors_code' && role === 'member') return true;
  return false;
}

function toPublicGlobalSettings(s: StoredMemorySettings): MemoryGlobalSettings {
  return {
    viewAccess: s.viewAccess,
    editAccess: s.editAccess,
    shareAccess: s.shareAccess,
    hideNamesByDefault: s.hideNamesByDefault,
    hidePhotosByDefault: s.hidePhotosByDefault,
    requireMinorGuardianConsent: s.requireMinorGuardianConsent,
    hasMemberCodeConfigured: Boolean(s.memberViewCode),
  };
}

function stripPhotoFile(p: StoredMemoryPhotoInternal): MemoryPhotoItem {
  return {
    id: p.id,
    photoUrl: p.photoUrl,
    caption: p.caption,
    authorized: p.authorized,
    includesMinors: p.includesMinors,
    guardianConsentConfirmed: p.guardianConsentConfirmed,
    ...(p.authorizedByName ? { authorizedByName: p.authorizedByName } : {}),
    uploadedAt: p.uploadedAt,
  };
}

function sanitizeMemoryForViewer(
  mem: StoredSaturdayMemoryRecord,
  role: ViewerRole,
  settings: StoredMemorySettings,
  forceSharedPublic = false
): SaturdayMemoryRecord | null {
  if (!forceSharedPublic && role !== 'admin') {
    if (mem.isArchived) return null;
    if (mem.visibility === 'admins_only') return null;
    if (mem.visibility === 'internal_only' && role !== 'member') return null;
  }

  const isAdminView = role === 'admin' && !forceSharedPublic;
  const hideNames =
    !isAdminView &&
    Boolean(settings.hideNamesByDefault || mem.hideParticipantNames);
  const hidePhotos =
    !isAdminView &&
    Boolean(settings.hidePhotosByDefault || mem.hidePhotos);

  const photos: MemoryPhotoItem[] = hidePhotos
    ? []
    : (mem.photos || [])
        .filter(
          (p) =>
            isAdminView ||
            isPhotoPubliclyAllowed(p, settings.requireMinorGuardianConsent)
        )
        .map(stripPhotoFile);

  const rankings: MemoryResultRankItem[] = (mem.rankings || []).map(
    (rk, idx) => ({
      ...rk,
      name: hideNames
        ? anonymizeDisplayName(rk.name, idx, 'Participante')
        : rk.name,
    })
  );

  const recognitions: MemoryRecognitionItem[] = (mem.recognitions || []).map(
    (rec, idx) => ({
      ...rec,
      recipientName: hideNames
        ? anonymizeDisplayName(rec.recipientName, idx, 'Joven')
        : rec.recipientName,
    })
  );

  const challengesCompleted: MemoryChallengeItem[] = (
    mem.challengesCompleted || []
  ).map((ch, idx) => ({
    ...ch,
    ...(ch.participantOrTeam
      ? {
          participantOrTeam: hideNames
            ? anonymizeDisplayName(ch.participantOrTeam, idx, 'Participante')
            : ch.participantOrTeam,
        }
      : {}),
  }));

  const gamesPlayed: MemoryGameItem[] = (mem.gamesPlayed || []).map((g) => ({
    ...g,
    ...(g.winnerOrHighlight
      ? {
          winnerOrHighlight: hideNames
            ? 'Resultado registrado (nombres protegidos)'
            : g.winnerOrHighlight,
        }
      : {}),
  }));

  const participantNames = hideNames
    ? (mem.participantNames || []).map((_, idx) => `Joven #${idx + 1}`)
    : mem.participantNames || [];

  const canSeeShareToken =
    isAdminView || canShare(role, settings);

  return {
    ...mem,
    directorName: hideNames
      ? 'Dirección de Sociedad de Jóvenes'
      : mem.directorName,
    participantNames,
    gamesPlayed,
    challengesCompleted,
    rankings,
    recognitions,
    photos,
    ...(canSeeShareToken && mem.shareToken
      ? { shareToken: mem.shareToken }
      : { shareToken: undefined }),
    ...(isAdminView ? {} : { snapshots: undefined }),
  };
}

function saveMemoryPhotoFile(
  memoryId: string,
  photoId: string,
  photoDataUrl: string
): { fileName: string; photoUrl: string } | null {
  const match = photoDataUrl
    .trim()
    .match(/^data:image\/(webp|jpeg|jpg|png);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;

  const rawExt = match[1].toLowerCase();
  const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
  const buf = Buffer.from(match[2], 'base64');
  if (buf.length < 64 || buf.length > 450 * 1024) {
    return null;
  }

  const safeMem = sanitizeIdSeg(memoryId);
  const safePhoto = sanitizeIdSeg(photoId);
  if (!safeMem || !safePhoto) return null;

  const dir = path.join(MEMORIES_PHOTOS_DIR, safeMem);
  fs.mkdirSync(dir, { recursive: true });
  const relFile = path.join(safeMem, `${safePhoto}.${ext}`);
  fs.writeFileSync(path.join(MEMORIES_PHOTOS_DIR, relFile), buf);

  return {
    fileName: relFile,
    photoUrl: `/api/memories/${encodeURIComponent(memoryId)}/photos/${encodeURIComponent(photoId)}`,
  };
}

function deleteMemoryPhotoFile(fileName?: string): void {
  if (!fileName) return;
  try {
    const resolved = path.resolve(MEMORIES_PHOTOS_DIR, fileName);
    if (
      resolved.startsWith(MEMORIES_PHOTOS_DIR + path.sep) &&
      fs.existsSync(resolved)
    ) {
      fs.unlinkSync(resolved);
    }
  } catch {
    // ignore cleanup error
  }
}

function normalizeActivities(raw: unknown): MemoryActivityItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a: any, idx) => ({
      id: String(a?.id || `act-${idx + 1}`).slice(0, 48),
      title: String(a?.title || '').trim().slice(0, 140),
      ...(a?.categoryLabel
        ? { categoryLabel: String(a.categoryLabel).trim().slice(0, 60) }
        : {}),
      ...(typeof a?.durationMin === 'number' && Number.isFinite(a.durationMin)
        ? { durationMin: Math.max(1, Math.min(240, Math.round(a.durationMin))) }
        : {}),
      ...(a?.notes ? { notes: String(a.notes).trim().slice(0, 300) } : {}),
    }))
    .filter((a) => Boolean(a.title));
}

function normalizeGames(raw: unknown): MemoryGameItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((g: any, idx) => ({
      id: String(g?.id || `gam-${idx + 1}`).slice(0, 48),
      title: String(g?.title || '').trim().slice(0, 140),
      ...(g?.modeLabel
        ? { modeLabel: String(g.modeLabel).trim().slice(0, 60) }
        : {}),
      ...(g?.winnerOrHighlight
        ? { winnerOrHighlight: String(g.winnerOrHighlight).trim().slice(0, 140) }
        : {}),
      ...(typeof g?.participantsCount === 'number' &&
      Number.isFinite(g.participantsCount)
        ? { participantsCount: Math.max(0, Math.round(g.participantsCount)) }
        : {}),
    }))
    .filter((g) => Boolean(g.title));
}

function normalizeChallenges(raw: unknown): MemoryChallengeItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c: any, idx) => ({
      id: String(c?.id || `chl-${idx + 1}`).slice(0, 48),
      title: String(c?.title || '').trim().slice(0, 140),
      ...(c?.categoryLabel
        ? { categoryLabel: String(c.categoryLabel).trim().slice(0, 60) }
        : {}),
      ...(c?.participantOrTeam
        ? { participantOrTeam: String(c.participantOrTeam).trim().slice(0, 90) }
        : {}),
      ...(c?.outcome
        ? { outcome: String(c.outcome).trim().slice(0, 80) }
        : {}),
    }))
    .filter((c) => Boolean(c.title));
}

function normalizeTeams(raw: unknown): MemoryTeamItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t: any, idx) => ({
      id: String(t?.id || `tm-${idx + 1}`).slice(0, 48),
      name: String(t?.name || '').trim().slice(0, 80),
      ...(t?.color ? { color: String(t.color).trim().slice(0, 20) } : {}),
      ...(typeof t?.score === 'number' && Number.isFinite(t.score)
        ? { score: Math.max(0, Math.round(t.score)) }
        : {}),
      ...(typeof t?.membersCount === 'number' &&
      Number.isFinite(t.membersCount)
        ? { membersCount: Math.max(0, Math.round(t.membersCount)) }
        : {}),
    }))
    .filter((t) => Boolean(t.name));
}

function normalizeRankings(raw: unknown): MemoryResultRankItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r: any, idx) => ({
      id: String(r?.id || `rk-${idx + 1}`).slice(0, 48),
      position: Math.max(1, Math.round(Number(r?.position) || idx + 1)),
      name: String(r?.name || '').trim().slice(0, 90),
      points: Math.max(0, Math.round(Number(r?.points) || 0)),
      ...(r?.note ? { note: String(r.note).trim().slice(0, 140) } : {}),
    }))
    .filter((r) => Boolean(r.name));
}

function normalizeRecognitions(raw: unknown): MemoryRecognitionItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((rec: any, idx) => ({
      id: String(rec?.id || `rec-${idx + 1}`).slice(0, 48),
      recipientName: String(rec?.recipientName || '').trim().slice(0, 90),
      title: String(rec?.title || '').trim().slice(0, 120),
      ...(rec?.reason
        ? { reason: String(rec.reason).trim().slice(0, 240) }
        : {}),
      ...(rec?.category
        ? { category: String(rec.category).trim().slice(0, 60) }
        : {}),
    }))
    .filter((rec) => Boolean(rec.title && rec.recipientName));
}

function buildChampionshipsHistory(
  db: ReturnType<MemoriesRoutesDeps['getDb']>,
  hideNames: boolean
): MemoryChampionshipSummary[] {
  const out: MemoryChampionshipSummary[] = [];
  const seasons = db.youthChampionshipSeasons || [];

  for (const s of seasons) {
    const { teamStandings, participantStandings } = computeSeasonStandings(s);
    const standingsList: Array<{ name: string; points: number; color?: string }> =
      teamStandings.length > 0
        ? teamStandings.map((st) => ({
            name: st.team.name,
            points: st.totalPoints,
            color: st.team.color,
          }))
        : participantStandings.map((ps) => ({
            name: ps.participant.name,
            points: ps.totalPoints,
            color: ps.teamColor,
          }));
    const champion = s.playoffs?.championName || standingsList[0]?.name;
    out.push({
      id: s.id,
      name: s.name,
      startDate: s.startDate,
      endDate: s.endDate,
      status:
        s.status === 'archivada' || s.playoffs?.stageStatus === 'finalizada'
          ? 'Finalizada'
          : 'En curso',
      competitionType: s.competitionType,
      ...(champion
        ? {
            championName: hideNames
              ? 'Participante / Equipo Protegido'
              : champion,
          }
        : {}),
      topStandings: standingsList.slice(0, 5).map((st, idx) => ({
        name: hideNames ? `Competidor #${idx + 1}` : st.name,
        points: st.points,
        ...(st.color ? { color: st.color } : {}),
      })),
      source: 'campeonato_juvenil',
    });
  }

  const tournaments = Object.values(db.expansion?.tournaments || {});
  for (const t of tournaments) {
    const sortedOrgs = [...(t.organizations || [])].sort(
      (a, b) => b.points - a.points
    );
    const dt = new Date(t.createdAt || Date.now()).toISOString().slice(0, 10);
    out.push({
      id: t.id,
      name: t.name,
      startDate: dt,
      endDate: dt,
      status: t.status === 'finished' ? 'Finalizado' : t.currentStage,
      competitionType: t.entityKind || 'Gran Torneo',
      ...(sortedOrgs[0]
        ? {
            championName: hideNames
              ? 'Organización Protegida'
              : sortedOrgs[0].name,
          }
        : {}),
      topStandings: sortedOrgs.slice(0, 5).map((org, idx) => ({
        name: hideNames ? `Finalista #${idx + 1}` : org.name,
        points: org.points,
        color: org.color,
      })),
      source: 'gran_torneo',
    });
  }

  return out;
}

function buildPlatformRecognitions(
  db: ReturnType<MemoriesRoutesDeps['getDb']>,
  memories: SaturdayMemoryRecord[],
  hideNames: boolean
): MemoryPlatformRecognitionSummary[] {
  const list: MemoryPlatformRecognitionSummary[] = [];

  for (const mem of memories) {
    mem.recognitions.forEach((rec, idx) => {
      list.push({
        id: `mem-${mem.id}-${rec.id}`,
        recipientName: hideNames
          ? anonymizeDisplayName(rec.recipientName, idx, 'Joven')
          : rec.recipientName,
        title: rec.title,
        reason: rec.reason || mem.theme,
        sourceLabel: `Memoria del ${mem.date}`,
        dateLabel: mem.date,
        timestamp: mem.updatedAt || mem.createdAt,
      });
    });
  }

  (db.weeklyMissionRecognitions || []).forEach((mr, idx) => {
    const dt = new Date(mr.grantedAt || Date.now()).toISOString().slice(0, 10);
    list.push({
      id: `mis-${mr.id}`,
      recipientName: hideNames
        ? anonymizeDisplayName(mr.participantName, idx, 'Joven')
        : mr.participantName,
      title: mr.title,
      reason: mr.reason,
      sourceLabel: 'Misión de la Semana',
      dateLabel: dt,
      timestamp: mr.grantedAt || Date.now(),
    });
  });

  (db.talentShowcase?.certificates || []).forEach((cert, idx) => {
    const dt = new Date(cert.issuedAt || Date.now()).toISOString().slice(0, 10);
    list.push({
      id: `tal-${cert.id}`,
      recipientName: hideNames
        ? anonymizeDisplayName(cert.recipientDisplayName, idx, 'Joven')
        : cert.recipientDisplayName,
      title: cert.recognitionTitle,
      reason: `${cert.categoryLabel} · ${cert.presentationTitle}`,
      sourceLabel: 'Talentos Juveniles',
      dateLabel: dt,
      timestamp: cert.issuedAt || Date.now(),
    });
  });

  return list.sort((a, b) => b.timestamp - a.timestamp).slice(0, 120);
}

function computeParticipationStats(
  memories: SaturdayMemoryRecord[],
  hideNames: boolean
): MemoryParticipationStats {
  let totalActivities = 0;
  let totalGames = 0;
  let totalChallenges = 0;
  let totalRecognitions = 0;
  let totalAuthorizedPhotos = 0;
  let totalAttendance = 0;
  const directors = new Set<string>();
  const teamMap = new Map<
    string,
    { name: string; appearances: number; bestScore: number }
  >();

  memories.forEach((m) => {
    totalActivities += m.activities.length;
    totalGames += m.gamesPlayed.length;
    totalChallenges += m.challengesCompleted.length;
    totalRecognitions += m.recognitions.length;
    totalAuthorizedPhotos += m.photos.length;
    totalAttendance += Number(m.attendanceCount) || m.participantNames.length || 0;
    if (m.directorName) directors.add(m.directorName.toLowerCase());

    m.teams.forEach((t, idx) => {
      const displayName = hideNames ? `Equipo #${idx + 1}` : t.name;
      const key = displayName.toLowerCase();
      const prev = teamMap.get(key) || {
        name: displayName,
        appearances: 0,
        bestScore: 0,
      };
      prev.appearances += 1;
      prev.bestScore = Math.max(prev.bestScore, Number(t.score) || 0);
      teamMap.set(key, prev);
    });
  });

  return {
    totalMemories: memories.length,
    totalActivities,
    totalGames,
    totalChallenges,
    totalRecognitions,
    totalAuthorizedPhotos,
    totalAttendance,
    uniqueDirectors: hideNames ? (memories.length > 0 ? 1 : 0) : directors.size,
    uniqueTeams: Array.from(teamMap.values())
      .sort((a, b) => b.appearances - a.appearances || b.bestScore - a.bestScore)
      .slice(0, 12),
  };
}

export function registerMemoriesRoutes(
  app: express.Express,
  deps: MemoriesRoutesDeps
): void {
  const ensureDb = () => {
    const db = deps.getDb();
    const fallbackPin = db.weeklyDirectorSecret || 'SJ2026';
    if (!Array.isArray(db.saturdayMemories)) {
      db.saturdayMemories = [];
    }
    if (!db.memorySettings) {
      db.memorySettings = defaultMemorySettings(undefined, fallbackPin);
    }
    return db;
  };

  // 1. Authenticate as Admin or Member/Director
  app.post('/api/memories/auth/login', (req, res) => {
    const db = ensureDb();
    const secret = db.serverSecret || 'dime-tu-memories-secret';
    const settings = db.memorySettings;
    const pin = String(req.body?.pin || '').trim();
    const kind = String(req.body?.kind || 'admin');

    if (!pin) {
      res.status(400).json({ error: 'Ingresa la clave de acceso.' });
      return;
    }

    if (kind === 'admin') {
      if (!timingSafeMatch(pin, settings.adminPin)) {
        res.status(401).json({ error: 'Clave de administrador incorrecta.' });
        return;
      }
      const token = computeToken(secret, 'memories-admin', settings.adminPin);
      res.json({ role: 'admin', token });
      return;
    }

    if (!timingSafeMatch(pin, settings.memberViewCode)) {
      res.status(401).json({ error: 'Código de acceso de miembros incorrecto.' });
      return;
    }
    const token = computeToken(
      secret,
      'memories-member',
      settings.memberViewCode
    );
    res.json({ role: 'member', token });
  });

  // 2. Overview: Memories, privacy settings, championships, recognitions, stats
  app.get('/api/memories/overview', (req, res) => {
    const db = ensureDb();
    const role = resolveViewerRole(req, db);
    const settings = db.memorySettings;
    const includeArchived =
      role === 'admin' && req.query.includeArchived === '1';

    if (!canView(role, settings)) {
      res.json({
        accessDenied: true,
        requiredAccess: settings.viewAccess,
        role,
        canEdit: false,
        canShare: false,
        settings: toPublicGlobalSettings(settings),
        memories: [],
        championships: [],
        recognitions: [],
        stats: computeParticipationStats([], true),
      });
      return;
    }

    const sorted = [...db.saturdayMemories].sort((a, b) =>
      b.date.localeCompare(a.date) || b.createdAt - a.createdAt
    );

    const visibleMemories: SaturdayMemoryRecord[] = [];
    for (const rawMem of sorted) {
      if (!includeArchived && rawMem.isArchived) continue;
      const sanitized = sanitizeMemoryForViewer(rawMem, role, settings, false);
      if (sanitized) visibleMemories.push(sanitized);
    }

    const hideGlobalNames =
      role !== 'admin' && settings.hideNamesByDefault;

    res.json({
      accessDenied: false,
      role,
      canEdit: canEdit(role, settings),
      canShare: canShare(role, settings),
      settings: toPublicGlobalSettings(settings),
      memories: visibleMemories,
      championships: buildChampionshipsHistory(db, hideGlobalNames),
      recognitions: buildPlatformRecognitions(
        db,
        visibleMemories.filter((m) => !m.isArchived),
        hideGlobalNames
      ),
      stats: computeParticipationStats(
        visibleMemories.filter((m) => !m.isArchived),
        hideGlobalNames
      ),
    });
  });

  // 3. Update global privacy & access settings (Admin only)
  app.put('/api/memories/settings', (req, res) => {
    const db = ensureDb();
    const role = resolveViewerRole(req, db);
    if (role !== 'admin') {
      res.status(403).json({
        error: 'Solo los administradores pueden modificar las políticas de privacidad.',
      });
      return;
    }

    const body = req.body || {};
    const s = db.memorySettings;

    if (VALID_VIEW_ACCESS.has(body.viewAccess)) s.viewAccess = body.viewAccess;
    if (VALID_EDIT_ACCESS.has(body.editAccess)) s.editAccess = body.editAccess;
    if (VALID_SHARE_ACCESS.has(body.shareAccess)) s.shareAccess = body.shareAccess;
    if (typeof body.hideNamesByDefault === 'boolean') {
      s.hideNamesByDefault = body.hideNamesByDefault;
    }
    if (typeof body.hidePhotosByDefault === 'boolean') {
      s.hidePhotosByDefault = body.hidePhotosByDefault;
    }
    if (typeof body.requireMinorGuardianConsent === 'boolean') {
      s.requireMinorGuardianConsent = body.requireMinorGuardianConsent;
    }
    if (typeof body.memberViewCode === 'string' && body.memberViewCode.trim().length >= 4) {
      s.memberViewCode = body.memberViewCode.trim().slice(0, 32);
    }
    let rotatedAdminToken: string | undefined;
    if (typeof body.newAdminPin === 'string' && body.newAdminPin.trim().length >= 4) {
      s.adminPin = body.newAdminPin.trim().slice(0, 32);
      const secret = db.serverSecret || 'dime-tu-memories-secret';
      rotatedAdminToken = computeToken(secret, 'memories-admin', s.adminPin);
    }

    deps.scheduleSave();
    res.json({
      settings: toPublicGlobalSettings(s),
      ...(rotatedAdminToken ? { newAdminToken: rotatedAdminToken } : {}),
    });
  });

  // 4. Import / Recovery sources from existing modules (Programa del Sábado, Games, Retos, Ruleta, Cabina)
  app.get('/api/memories/import-sources', (req, res) => {
    const db = ensureDb();
    const role = resolveViewerRole(req, db);
    if (!canEdit(role, db.memorySettings)) {
      res.status(403).json({
        error: 'Se requiere acceso de administrador o director autorizado para recuperar programas.',
      });
      return;
    }

    const programs = Object.values(db.saturdayPrograms || {})
      .sort((a, b) => (b.scheduledDate || '').localeCompare(a.scheduledDate || ''))
      .slice(0, 30)
      .map((p) => ({
        id: p.id,
        title: p.title,
        scheduledDate: p.scheduledDate,
        centralTheme: p.centralTheme,
        mainBibleText: p.mainBibleText,
        ...(p.mainBibleVerseQuote ? { mainBibleVerseQuote: p.mainBibleVerseQuote } : {}),
        ...(p.spiritualObjective ? { spiritualObjective: p.spiritualObjective } : {}),
        ...(p.directorName ? { directorName: p.directorName } : {}),
        ...(p.directorNotes ? { directorNotes: p.directorNotes } : {}),
        activities: (p.activities || []).map((a) => ({
          title: a.title,
          categoryLabel: a.categoryLabel,
          durationMin: a.durationMin,
          description: a.description,
        })),
      }));

    const games = [...(db.history || [])]
      .sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0))
      .slice(0, 30)
      .map((g) => ({
        id: g.code,
        date: new Date(g.finishedAt || Date.now()).toISOString().slice(0, 10),
        title: g.title,
        mode: g.mode,
        participantsCount: g.participantCount || 0,
        podium: (g.topThree || []).map((p) => ({ name: p.name, score: p.score })),
        teams: g.winningTeamName
          ? [
              {
                name: g.winningTeamName,
                color: g.winningTeamColor || '#F59E0B',
                score: g.winnerScore,
              },
            ]
          : [],
      }));

    const challenges: MemoryImportSourcesBundle['challenges'] = [];
    for (const c of (db.saturdayChallengeHistory || []).slice(0, 20)) {
      challenges.push({
        id: c.id,
        date: new Date(c.executedAt || Date.now()).toISOString().slice(0, 10),
        title: c.challengeTitle,
        categoryLabel: c.subTypeLabel || c.category,
        participantName: c.winnerName || 'Participantes',
        outcome: c.resultSummary || 'Completado',
        points: c.winnerScore || 0,
        sourceKind: 'retos_sabado',
      });
    }
    for (const r of (db.saturdayRouletteHistory || []).slice(0, 20)) {
      challenges.push({
        id: r.id,
        date: new Date(r.executedAt || Date.now()).toISOString().slice(0, 10),
        title: r.activityTitle,
        categoryLabel: r.categoryLabel || r.categoryId,
        participantName: r.participantName,
        outcome: r.grade,
        points: r.pointsAwarded,
        sourceKind: 'ruleta_sabado',
      });
    }
    for (const s of (db.surpriseBoothHistory || []).slice(0, 20)) {
      challenges.push({
        id: s.id,
        date: new Date(s.createdAt || Date.now()).toISOString().slice(0, 10),
        title: s.title,
        categoryLabel: s.categoryId,
        participantName: s.participantName,
        outcome: s.outcome,
        points: s.pointsAwarded,
        sourceKind: 'cabina_sorpresas',
      });
    }

    const bundle: MemoryImportSourcesBundle = { programs, games, challenges };
    res.json(bundle);
  });

  // 5. Create an independent Saturday Memory (never overwrites existing weeks!)
  app.post('/api/memories', (req, res) => {
    const db = ensureDb();
    const role = resolveViewerRole(req, db);
    if (!canEdit(role, db.memorySettings)) {
      res.status(403).json({
        error: 'No tienes permiso para crear memorias. Desbloquea el modo administrador.',
      });
      return;
    }

    const body = req.body || {};
    const date = sanitizeIsoDate(body.date);
    const theme = String(body.theme || '').trim().slice(0, 160);
    const rawTitle = String(body.title || '').trim().slice(0, 160);

    if (!theme && !rawTitle) {
      res.status(400).json({ error: 'Ingresa el tema o título del programa.' });
      return;
    }

    const title = rawTitle || `Sábado: ${theme}`;

    const now = Date.now();
    const id = `MEM-${date.replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const rawVisibility = String(body.visibility || 'authorized_public') as MemoryVisibility;
    const visibility: MemoryVisibility = VALID_VISIBILITY.has(rawVisibility)
      ? rawVisibility
      : 'authorized_public';

    const participantNames = Array.isArray(body.participantNames)
      ? body.participantNames
          .map((n: unknown) => String(n || '').trim().slice(0, 80))
          .filter(Boolean)
      : [];

    const record: StoredSaturdayMemoryRecord = {
      id,
      date,
      title,
      theme: theme || title,
      bibleText: String(body.bibleText || '').trim().slice(0, 120) || 'Palabra de Dios',
      ...(typeof body.bibleVerseQuote === 'string' && body.bibleVerseQuote.trim()
        ? { bibleVerseQuote: body.bibleVerseQuote.trim().slice(0, 500) }
        : {}),
      directorName: String(body.directorName || '').trim().slice(0, 90) || 'Dirección Juvenil',
      ...(typeof body.attendanceCount === 'number' && Number.isFinite(body.attendanceCount)
        ? { attendanceCount: Math.max(0, Math.round(body.attendanceCount)) }
        : {}),
      participantNames,
      activities: normalizeActivities(body.activities),
      gamesPlayed: normalizeGames(body.gamesPlayed),
      challengesCompleted: normalizeChallenges(body.challengesCompleted),
      teams: normalizeTeams(body.teams),
      resultsSummary: String(body.resultsSummary || '').trim().slice(0, 600),
      rankings: normalizeRankings(body.rankings),
      recognitions: normalizeRecognitions(body.recognitions),
      photos: [],
      dailyReflection: String(body.dailyReflection || '').trim().slice(0, 1600),
      observations: String(body.observations || '').trim().slice(0, 1200),
      visibility,
      hideParticipantNames: Boolean(body.hideParticipantNames),
      hidePhotos: Boolean(body.hidePhotos),
      sharingEnabled: false,
      ...(typeof body.sourceProgramId === 'string' && body.sourceProgramId.trim()
        ? { sourceProgramId: body.sourceProgramId.trim().slice(0, 64) }
        : {}),
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      createdByRole: role,
      revisionCount: 1,
      snapshots: [],
    };

    db.saturdayMemories.unshift(record);
    deps.scheduleSave();

    const sanitized = sanitizeMemoryForViewer(record, role, db.memorySettings, false);
    res.status(201).json({ memory: sanitized });
  });

  // 6. Update an existing Saturday Memory (stores snapshot before mutating for safe recovery)
  app.put('/api/memories/:id', (req, res) => {
    const db = ensureDb();
    const role = resolveViewerRole(req, db);
    if (!canEdit(role, db.memorySettings)) {
      res.status(403).json({ error: 'Acceso denegado para editar memorias.' });
      return;
    }

    const id = String(req.params.id || '').trim();
    const target = db.saturdayMemories.find((m) => m.id === id);
    if (!target) {
      res.status(404).json({ error: 'Memoria no encontrada.' });
      return;
    }

    const body = req.body || {};

    // Keep lightweight snapshot of previous state
    if (!Array.isArray(target.snapshots)) target.snapshots = [];
    target.snapshots.unshift({
      savedAt: target.updatedAt || Date.now(),
      savedBy: role === 'admin' ? 'Administrador' : 'Director',
      theme: target.theme,
      date: target.date,
    });
    target.snapshots = target.snapshots.slice(0, 12);

    if (body.date !== undefined) target.date = sanitizeIsoDate(body.date, target.date);
    if (typeof body.title === 'string' && body.title.trim()) {
      target.title = body.title.trim().slice(0, 160);
    }
    if (typeof body.theme === 'string' && body.theme.trim()) {
      target.theme = body.theme.trim().slice(0, 160);
    }
    if (typeof body.bibleText === 'string') {
      target.bibleText = body.bibleText.trim().slice(0, 120) || target.bibleText;
    }
    if (typeof body.bibleVerseQuote === 'string') {
      target.bibleVerseQuote = body.bibleVerseQuote.trim().slice(0, 500) || undefined;
    }
    if (typeof body.directorName === 'string') {
      target.directorName = body.directorName.trim().slice(0, 90) || target.directorName;
    }
    if (typeof body.attendanceCount === 'number' && Number.isFinite(body.attendanceCount)) {
      target.attendanceCount = Math.max(0, Math.round(body.attendanceCount));
    }
    if (Array.isArray(body.participantNames)) {
      target.participantNames = body.participantNames
        .map((n: unknown) => String(n || '').trim().slice(0, 80))
        .filter(Boolean);
    }
    if (body.activities !== undefined) target.activities = normalizeActivities(body.activities);
    if (body.gamesPlayed !== undefined) target.gamesPlayed = normalizeGames(body.gamesPlayed);
    if (body.challengesCompleted !== undefined) {
      target.challengesCompleted = normalizeChallenges(body.challengesCompleted);
    }
    if (body.teams !== undefined) target.teams = normalizeTeams(body.teams);
    if (typeof body.resultsSummary === 'string') {
      target.resultsSummary = body.resultsSummary.trim().slice(0, 600);
    }
    if (body.rankings !== undefined) target.rankings = normalizeRankings(body.rankings);
    if (body.recognitions !== undefined) {
      target.recognitions = normalizeRecognitions(body.recognitions);
    }
    if (typeof body.dailyReflection === 'string') {
      target.dailyReflection = body.dailyReflection.trim().slice(0, 1600);
    }
    if (typeof body.observations === 'string') {
      target.observations = body.observations.trim().slice(0, 1200);
    }

    // Only admin can alter visibility or privacy flags
    if (role === 'admin') {
      if (VALID_VISIBILITY.has(body.visibility)) {
        target.visibility = body.visibility;
      }
      if (typeof body.hideParticipantNames === 'boolean') {
        target.hideParticipantNames = body.hideParticipantNames;
      }
      if (typeof body.hidePhotos === 'boolean') {
        target.hidePhotos = body.hidePhotos;
      }
    }

    target.updatedAt = Date.now();
    target.revisionCount = (target.revisionCount || 1) + 1;
    deps.scheduleSave();

    res.json({
      memory: sanitizeMemoryForViewer(target, role, db.memorySettings, false),
    });
  });

  // 7. Upload an authorized / minor-consented photograph to a Saturday Memory
  app.post('/api/memories/:id/photos', (req, res) => {
    const db = ensureDb();
    const role = resolveViewerRole(req, db);
    if (!canEdit(role, db.memorySettings)) {
      res.status(403).json({ error: 'Se requiere permiso de edición para subir fotografías.' });
      return;
    }

    const id = String(req.params.id || '').trim();
    const target = db.saturdayMemories.find((m) => m.id === id);
    if (!target) {
      res.status(404).json({ error: 'Memoria no encontrada.' });
      return;
    }

    const body = req.body || {};
    const photoDataUrl = String(body.photoDataUrl || '');
    const caption = String(body.caption || '').trim().slice(0, 200) || 'Recuerdo de Sociedad de Jóvenes';
    const includesMinors = Boolean(body.includesMinors);
    const guardianConsentConfirmed = Boolean(body.guardianConsentConfirmed);
    // Only admin can directly authorize; if minors included and minor consent is required, guardianConsentConfirmed must be true
    const requestedAuth = role === 'admin' ? body.authorized !== false : false;
    const authorized =
      requestedAuth &&
      (!includesMinors ||
        !db.memorySettings.requireMinorGuardianConsent ||
        guardianConsentConfirmed);

    const photoId = `PH-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const saved = saveMemoryPhotoFile(target.id, photoId, photoDataUrl);
    if (!saved) {
      res.status(400).json({
        error: 'Imagen inválida o supera el tamaño permitido (máx 450 KB después de comprimir).',
      });
      return;
    }

    const photoRecord: StoredMemoryPhotoInternal = {
      id: photoId,
      photoUrl: saved.photoUrl,
      fileName: saved.fileName,
      caption,
      authorized,
      includesMinors,
      guardianConsentConfirmed,
      ...(authorized
        ? {
            authorizedByName:
              String(body.authorizedByName || '').trim().slice(0, 80) ||
              'Administrador de Memorias',
          }
        : {}),
      uploadedAt: Date.now(),
    };

    if (!Array.isArray(target.photos)) target.photos = [];
    target.photos.push(photoRecord);
    target.updatedAt = Date.now();
    deps.scheduleSave();

    res.status(201).json({
      photo: stripPhotoFile(photoRecord),
      memory: sanitizeMemoryForViewer(target, role, db.memorySettings, false),
    });
  });

  // 8. Admin photo authorization & minor-consent update
  app.patch('/api/memories/:id/photos/:photoId', (req, res) => {
    const db = ensureDb();
    const role = resolveViewerRole(req, db);
    if (role !== 'admin') {
      res.status(403).json({
        error: 'Solo un administrador puede autorizar fotografías o confirmar permisos de menores.',
      });
      return;
    }

    const id = String(req.params.id || '').trim();
    const photoId = String(req.params.photoId || '').trim();
    const target = db.saturdayMemories.find((m) => m.id === id);
    const photo = target?.photos.find((p) => p.id === photoId);
    if (!target || !photo) {
      res.status(404).json({ error: 'Fotografía no encontrada.' });
      return;
    }

    const body = req.body || {};
    if (typeof body.caption === 'string') {
      photo.caption = body.caption.trim().slice(0, 200);
    }
    if (typeof body.includesMinors === 'boolean') {
      photo.includesMinors = body.includesMinors;
    }
    if (typeof body.guardianConsentConfirmed === 'boolean') {
      photo.guardianConsentConfirmed = body.guardianConsentConfirmed;
    }
    if (typeof body.authorized === 'boolean') {
      if (
        body.authorized &&
        photo.includesMinors &&
        db.memorySettings.requireMinorGuardianConsent &&
        !photo.guardianConsentConfirmed
      ) {
        res.status(400).json({
          error:
            'Las fotografías donde aparecen menores requieren confirmar autorización de padres/representantes antes de publicarse.',
        });
        return;
      }
      photo.authorized = body.authorized;
      if (body.authorized) {
        photo.authorizedByName =
          String(body.authorizedByName || '').trim().slice(0, 80) ||
          'Administrador de Memorias';
      }
    }

    target.updatedAt = Date.now();
    deps.scheduleSave();
    res.json({
      photo: stripPhotoFile(photo),
      memory: sanitizeMemoryForViewer(target, role, db.memorySettings, false),
    });
  });

  // 9. Delete photograph
  app.delete('/api/memories/:id/photos/:photoId', (req, res) => {
    const db = ensureDb();
    const role = resolveViewerRole(req, db);
    if (role !== 'admin') {
      res.status(403).json({ error: 'Solo los administradores pueden eliminar fotografías.' });
      return;
    }

    const id = String(req.params.id || '').trim();
    const photoId = String(req.params.photoId || '').trim();
    const target = db.saturdayMemories.find((m) => m.id === id);
    if (!target) {
      res.status(404).json({ error: 'Memoria no encontrada.' });
      return;
    }
    const idx = target.photos.findIndex((p) => p.id === photoId);
    if (idx === -1) {
      res.status(404).json({ error: 'Fotografía no encontrada.' });
      return;
    }

    const [removed] = target.photos.splice(idx, 1);
    deleteMemoryPhotoFile(removed.fileName);
    target.updatedAt = Date.now();
    deps.scheduleSave();
    res.json({ deleted: true });
  });

  // 10. Serve authorized memory photograph with privacy guard
  app.get('/api/memories/:id/photos/:photoId', (req, res) => {
    const db = ensureDb();
    const role = resolveViewerRole(req, db);
    const settings = db.memorySettings;
    const id = String(req.params.id || '').trim();
    const photoId = String(req.params.photoId || '').trim();
    const shareToken = String(req.query.share || '').trim();

    const mem = db.saturdayMemories.find((m) => m.id === id);
    const photo = mem?.photos.find((p) => p.id === photoId);
    if (!mem || !photo || !photo.fileName) {
      res.status(404).end();
      return;
    }

    const isAdmin = role === 'admin';
    if (!isAdmin) {
      const validShare =
        Boolean(shareToken) &&
        mem.sharingEnabled &&
        Boolean(mem.shareToken) &&
        timingSafeMatch(shareToken, mem.shareToken || '');

      if (!validShare && !canView(role, settings)) {
        res.status(403).end();
        return;
      }
      if (mem.isArchived || mem.visibility === 'admins_only') {
        res.status(403).end();
        return;
      }
      if (!validShare && mem.visibility === 'internal_only' && role !== 'member') {
        res.status(403).end();
        return;
      }
      if (settings.hidePhotosByDefault || mem.hidePhotos) {
        res.status(403).end();
        return;
      }
      if (!isPhotoPubliclyAllowed(photo, settings.requireMinorGuardianConsent)) {
        res.status(403).end();
        return;
      }
    }

    const resolvedPath = path.resolve(MEMORIES_PHOTOS_DIR, photo.fileName);
    if (
      !resolvedPath.startsWith(MEMORIES_PHOTOS_DIR + path.sep) ||
      !fs.existsSync(resolvedPath)
    ) {
      res.status(404).end();
      return;
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    const mime =
      ext === '.webp'
        ? 'image/webp'
        : ext === '.png'
          ? 'image/png'
          : 'image/jpeg';

    res.setHeader('Content-Type', mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.sendFile(resolvedPath);
  });

  // 11. Archive / Restore memory (recovery of previous programs)
  app.post('/api/memories/:id/archive', (req, res) => {
    const db = ensureDb();
    const role = resolveViewerRole(req, db);
    if (role !== 'admin') {
      res.status(403).json({ error: 'Solo los administradores pueden archivar memorias.' });
      return;
    }
    const mem = db.saturdayMemories.find((m) => m.id === req.params.id);
    if (!mem) {
      res.status(404).json({ error: 'Memoria no encontrada.' });
      return;
    }
    mem.isArchived = true;
    mem.archivedAt = Date.now();
    mem.sharingEnabled = false;
    deps.scheduleSave();
    res.json({ archived: true, id: mem.id });
  });

  app.post('/api/memories/:id/restore', (req, res) => {
    const db = ensureDb();
    const role = resolveViewerRole(req, db);
    if (role !== 'admin') {
      res.status(403).json({ error: 'Solo los administradores pueden recuperar memorias.' });
      return;
    }
    const mem = db.saturdayMemories.find((m) => m.id === req.params.id);
    if (!mem) {
      res.status(404).json({ error: 'Memoria no encontrada.' });
      return;
    }
    mem.isArchived = false;
    mem.archivedAt = undefined;
    mem.updatedAt = Date.now();
    deps.scheduleSave();
    res.json({
      restored: true,
      memory: sanitizeMemoryForViewer(mem, role, db.memorySettings, false),
    });
  });

  // 12. Recover a previous memory as a fresh draft in Programa del Sábado
  app.post('/api/memories/:id/recover-to-program', (req, res) => {
    const db = ensureDb();
    const role = resolveViewerRole(req, db);
    if (!canEdit(role, db.memorySettings)) {
      res.status(403).json({ error: 'Acceso requerido para recuperar programas.' });
      return;
    }

    const mem = db.saturdayMemories.find((m) => m.id === req.params.id);
    if (!mem) {
      res.status(404).json({ error: 'Memoria no encontrada.' });
      return;
    }

    if (!db.saturdayPrograms) db.saturdayPrograms = {};
    const now = Date.now();
    const newId = `SP-${now.toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const targetDate = sanitizeIsoDate(req.body?.scheduledDate);

    const activities = (mem.activities.length > 0
      ? mem.activities
      : [{ id: 'a1', title: mem.theme, categoryLabel: 'Actividad bíblica', durationMin: 15 }]
    ).map((a, idx) => ({
      id: `ACT-${now.toString(36)}-${idx + 1}`,
      category: 'personalizada' as const,
      categoryLabel: a.categoryLabel || 'Actividad recuperada',
      title: a.title,
      description: a.notes || `Actividad recuperada de la memoria del ${mem.date}.`,
      durationMin: a.durationMin || 10,
    }));

    const totalMin = activities.reduce((sum, a) => sum + a.durationMin, 0);
    const durationMinutes = totalMin <= 75 ? 60 : totalMin <= 105 ? 90 : 120;

    const recoveredProgram: SaturdayProgram = {
      id: newId,
      title: `Recuperado: ${mem.title}`,
      centralTheme: mem.theme,
      mainBibleText: mem.bibleText,
      ...(mem.bibleVerseQuote ? { mainBibleVerseQuote: mem.bibleVerseQuote } : {}),
      spiritualObjective: mem.dailyReflection || `Recuperado del programa del ${mem.date}.`,
      scheduledDate: targetDate,
      durationMinutes,
      status: 'draft',
      directorName: mem.directorName,
      directorNotes: mem.observations || '',
      activities,
      createdAt: now,
      updatedAt: now,
      generatedByAi: false,
    };

    db.saturdayPrograms[newId] = recoveredProgram;
    deps.scheduleSave();
    res.status(201).json({ program: recoveredProgram });
  });

  // 13. Authorize / Revoke sharing link for a Saturday Memory
  app.post('/api/memories/:id/share', (req, res) => {
    const db = ensureDb();
    const role = resolveViewerRole(req, db);
    if (!canShare(role, db.memorySettings)) {
      res.status(403).json({
        error: 'Solo los administradores autorizados pueden compartir resúmenes de memorias.',
      });
      return;
    }

    const mem = db.saturdayMemories.find((m) => m.id === req.params.id);
    if (!mem) {
      res.status(404).json({ error: 'Memoria no encontrada.' });
      return;
    }

    const enabled = Boolean(req.body?.enabled);
    mem.sharingEnabled = enabled;
    if (enabled) {
      if (!mem.shareToken || req.body?.rotateToken) {
        mem.shareToken = crypto.randomBytes(12).toString('hex');
      }
      mem.shareAuthorizedAt = Date.now();
      mem.shareAuthorizedBy =
        role === 'admin' ? 'Administrador' : 'Director Autorizado';
    }
    mem.updatedAt = Date.now();
    deps.scheduleSave();

    res.json({
      sharingEnabled: mem.sharingEnabled,
      shareToken: mem.sharingEnabled ? mem.shareToken : undefined,
      memory: sanitizeMemoryForViewer(mem, role, db.memorySettings, false),
    });
  });

  // 14. Public read-only view of an authorized shared summary
  app.get('/api/memories/shared/:shareToken', (req, res) => {
    const db = ensureDb();
    const token = String(req.params.shareToken || '').trim();
    if (!token) {
      res.status(404).json({ error: 'Enlace compartido inválido.' });
      return;
    }

    const mem = db.saturdayMemories.find(
      (m) =>
        m.sharingEnabled &&
        !m.isArchived &&
        Boolean(m.shareToken) &&
        timingSafeMatch(token, m.shareToken || '')
    );

    if (!mem) {
      res.status(404).json({
        error: 'Este resumen compartido no existe o su autorización fue revocada por el administrador.',
      });
      return;
    }

    const sanitized = sanitizeMemoryForViewer(
      mem,
      'public',
      db.memorySettings,
      true
    );
    if (!sanitized) {
      res.status(403).json({ error: 'Resumen restringido por privacidad.' });
      return;
    }

    // Append share query parameter to allowed photos so <img> loads cleanly with authorization
    sanitized.photos = sanitized.photos.map((p) => ({
      ...p,
      photoUrl: `${p.photoUrl}?share=${encodeURIComponent(token)}`,
    }));

    const hideNames = Boolean(
      db.memorySettings.hideNamesByDefault || mem.hideParticipantNames
    );
    const hidePhotos = Boolean(
      db.memorySettings.hidePhotosByDefault || mem.hidePhotos
    );

    const privacyParts: string[] = ['Resumen autorizado para compartir'];
    if (hideNames) privacyParts.push('nombres ocultos');
    if (hidePhotos) privacyParts.push('fotografías ocultas');

    res.json({
      memory: sanitized,
      authorizedAt: mem.shareAuthorizedAt,
      authorizedBy: mem.shareAuthorizedBy,
      privacyNote: privacyParts.join(' · '),
    });
  });
}
