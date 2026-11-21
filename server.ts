import 'dotenv/config';
import dns from 'dns';
import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

dns.setDefaultResultOrder('ipv4first');
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { BIBLE_QUESTION_BANK } from './src/shared/questionBank.js';
import type { SaturdayProgram } from './src/shared/saturdayProgramTypes.js';
import type {
  SaturdayChallengeHistoryEntry,
  SaturdayChallengeItem,
} from './src/shared/saturdayChallengesData.js';
import { registerSaturdayProgramRoutes } from './server-saturday.js';
import {
  buildSaturdayChallengeClientView,
  ensureSaturdayChallengeSlice,
  handleSaturdayChallengePresenterAction,
  handleSaturdayChallengeSubmission,
  initSaturdayChallengeForGame,
  recordSaturdayChallengeGameHistory,
  registerSaturdayChallengeRoutes,
  type SaturdayChallengeServerInternal,
} from './server-retos-sabado.js';
import type {
  SaturdayRouletteActivity,
  SaturdayRouletteHistoryEntry,
} from './src/shared/saturdayRouletteData.js';
import {
  buildSaturdayRouletteClientView,
  ensureSaturdayRouletteSlice,
  handleSaturdayRoulettePresenterAction,
  handleSaturdayRouletteSubmission,
  initSaturdayRouletteForGame,
  registerSaturdayRouletteRoutes,
  type SaturdayRouletteServerInternal,
} from './server-ruleta-sabado.js';
import type { TalentShowcaseSession } from './src/shared/talentShowData.js';
import {
  buildTalentClientView,
  ensureTalentDatabaseSlice,
  handleTalentAudienceVote,
  handleTalentPresenterAction,
  initTalentRoomForGame,
  registerTalentRoutes,
} from './server-talentos-juveniles.js';
import type {
  AdventureProgressRecord,
  AdventureStory,
} from './src/shared/adventureStoriesData.js';
import {
  buildAdventureClientView,
  ensureAdventureDatabaseSlice,
  handleAdventurePresenterAction,
  handleAdventureSubmission,
  initAdventureRoomForGame,
  registerAdventureRoutes,
  saveAdventureMatchProgress,
  type AdventureServerInternal,
} from './server-aventuras-biblicas.js';
import type {
  MissionRecognition,
  MissionRegistration,
  WeeklyMission,
} from './src/shared/weeklyMissionsData.js';
import {
  ensureWeeklyMissionsSlice,
  registerWeeklyMissionsRoutes,
} from './server-mision-semana.js';
import type { YouthChampionshipSeason } from './src/shared/youthChampionshipsData.js';
import {
  ensureYouthChampionshipsSlice,
  registerYouthChampionshipsRoutes,
} from './server-campeonatos-juveniles.js';
import type {
  SurpriseHistoryEntry,
  SurpriseItem,
} from './src/shared/surpriseBoothData.js';
import {
  ensureSurpriseBoothSlice,
  registerSurpriseBoothRoutes,
} from './server-cabina-sorpresas.js';
import {
  ensureMemoriesSlice,
  registerMemoriesRoutes,
  type StoredMemorySettings,
  type StoredSaturdayMemoryRecord,
} from './server-memorias.js';
import {
  cleanupControlCenterWs,
  ensureControlCenterSlice,
  handleControlCenterWsMessage,
  registerControlCenterRoutes,
  tickControlCenterTimers,
  type ControlCenterDatabaseSlice,
} from './server-centro-control.js';
import {
  cleanupYouthSocietyWs,
  ensureYouthSocietySlice,
  handleYouthSocietyWsMessage,
  registerYouthSocietyRoutes,
  tickYouthSocietyTimers,
  type YouthSocietyDatabaseSlice,
} from './server-mi-sociedad.js';
import {
  ensureCreativeAiSlice,
  registerIaCreativaRoutes,
} from './server-ia-creativa.js';
import {
  ensureGameAnnouncerState,
  handleAnnouncerPresenterAction,
  registerAnnouncerRoutes,
  resetGameAnnouncerCeremony,
} from './server-announcer.js';
import type { CreativeAiDatabaseSlice } from './src/shared/creativeAiTypes.js';
import {
  BibleQuestion,
  COMPETITION_TEAM_PRESETS,
  Difficulty,
  GameConfig,
  GameHistorySummary,
  GameRoomClientState,
  GameStatus,
  InviteTeamSummary,
  LeaderboardEntry,
  Participant,
  PublicGameListing,
  QuestionAnswerSummary,
  QuestionResultStats,
  QuestionReviewItem,
  SanitizedQuestion,
  TEAMS,
  TeamConfigSlot,
  TeamId,
  TeamScoreEntry,
} from './src/shared/types.js';
import {
  buildLearningClientView,
  buildMysteryClientView,
  buildRetoClientView,
  createEmptyExpansionSlice,
  ExpansionActionHelpers,
  ExpansionDatabaseSlice,
  handleExpansionPresenterAction,
  handleExpansionSubmitMysteryGuess,
  handleExpansionSubmitRetoAttempt,
  hydrateExpansionSlice,
  initExpansionStateForGame,
  recordExpansionMatchOutcome,
  registerExpansionRoutes,
  ServerStoredGame,
} from './server-expansion.js';

interface StoredAnswer {
  participantId: string;
  selectedIndex: number;
  isCorrect: boolean;
  pointsEarned: number;
  responseTimeMs: number;
  submittedAt: number;
}

interface GameQuestionInstance extends BibleQuestion {
  isSpecialMultiplier: number;
  roundStage?: string;
}

interface StoredParticipant extends Participant {
  token: string;
  photoAccessKey?: string;
  photoFile?: string;
}

interface StoredGame extends ServerStoredGame {
  saturdayChallengeInternal?: SaturdayChallengeServerInternal;
  saturdayRouletteInternal?: SaturdayRouletteServerInternal;
  talentRoomInternal?: TalentShowcaseSession;
  adventureInternal?: AdventureServerInternal;
}

interface PersistedDatabase {
  serverSecret: string;
  customQuestions: BibleQuestion[];
  games: Record<string, StoredGame>;
  archivedGames: Record<string, StoredGame>;
  history: GameHistorySummary[];
  expansion: ExpansionDatabaseSlice;
  saturdayPrograms: Record<string, SaturdayProgram>;
  saturdayCustomChallenges: SaturdayChallengeItem[];
  saturdayChallengeFavorites: string[];
  saturdayChallengeRecentIds: string[];
  saturdayChallengeHistory: SaturdayChallengeHistoryEntry[];
  saturdayRouletteCustomActivities: SaturdayRouletteActivity[];
  saturdayRouletteRecentIds: string[];
  saturdayRouletteHistory: SaturdayRouletteHistoryEntry[];
  talentShowcase: TalentShowcaseSession;
  customAdventureStories: AdventureStory[];
  adventureProgress: AdventureProgressRecord[];
  weeklyCustomMissions: WeeklyMission[];
  weeklyFeaturedMissionId: string | null;
  weeklyMissionRegistrations: MissionRegistration[];
  weeklyMissionRecognitions: MissionRecognition[];
  weeklyDirectorSecret: string;
  youthChampionshipSeasons: YouthChampionshipSeason[];
  surpriseBoothCustomItems: SurpriseItem[];
  surpriseBoothExcludedIds: string[];
  surpriseBoothRecentIds: string[];
  surpriseBoothHistory: SurpriseHistoryEntry[];
  saturdayMemories: StoredSaturdayMemoryRecord[];
  memorySettings: StoredMemorySettings;
  controlCenterSessions: ControlCenterDatabaseSlice['controlCenterSessions'];
  activeControlSessionId: ControlCenterDatabaseSlice['activeControlSessionId'];
  youthSocietyPrograms: YouthSocietyDatabaseSlice['youthSocietyPrograms'];
  youthSocietyHistory: YouthSocietyDatabaseSlice['youthSocietyHistory'];
  activeYouthSocietyProgramId: YouthSocietyDatabaseSlice['activeYouthSocietyProgramId'];
  creativeAi?: CreativeAiDatabaseSlice;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const PHOTOS_DIR = path.join(DATA_DIR, 'photos');
const DB_PATH = path.join(DATA_DIR, 'dime_tu_db.json');
const SERVER_SERVICE_ID = 'dime-tu-que-dices';

function sanitizeIdSegment(val: string): string {
  return val.replace(/[^A-Za-z0-9_-]/g, '');
}

function saveParticipantPhoto(
  gameId: string,
  participantId: string,
  photoDataUrl: string
): { photoAccessKey: string; photoFile: string; photoUrl: string } | null {
  const match = photoDataUrl
    .trim()
    .match(/^data:image\/(webp|jpeg|jpg|png);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;

  const rawExt = match[1].toLowerCase();
  const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
  const buf = Buffer.from(match[2], 'base64');
  if (buf.length < 64 || buf.length > 220 * 1024) {
    return null;
  }

  const safeGame = sanitizeIdSegment(gameId);
  const safeParticipant = sanitizeIdSegment(participantId);
  if (!safeGame || !safeParticipant) return null;

  const gamePhotoDir = path.join(PHOTOS_DIR, safeGame);
  fs.mkdirSync(gamePhotoDir, { recursive: true });
  const relativeFile = path.join(safeGame, `${safeParticipant}.${ext}`);
  const fullPath = path.join(PHOTOS_DIR, relativeFile);
  fs.writeFileSync(fullPath, buf);

  const photoAccessKey = crypto.randomBytes(10).toString('hex');
  const photoUrl = `/api/games/${encodeURIComponent(gameId)}/participants/${encodeURIComponent(participantId)}/photo/${photoAccessKey}`;
  return { photoAccessKey, photoFile: relativeFile, photoUrl };
}

function deleteParticipantPhoto(participant?: StoredParticipant): void {
  if (!participant?.photoFile) return;
  try {
    const resolved = path.resolve(PHOTOS_DIR, participant.photoFile);
    if (resolved.startsWith(PHOTOS_DIR + path.sep) && fs.existsSync(resolved)) {
      fs.unlinkSync(resolved);
    }
  } catch {
    // ignore cleanup errors
  }
}

let db: PersistedDatabase = {
  serverSecret: crypto.randomBytes(32).toString('hex'),
  customQuestions: [],
  games: {},
  archivedGames: {},
  history: [],
  expansion: createEmptyExpansionSlice(),
  saturdayPrograms: {},
  ...ensureSaturdayChallengeSlice({}),
  ...ensureSaturdayRouletteSlice({}),
  ...ensureTalentDatabaseSlice({}),
  ...ensureAdventureDatabaseSlice({}),
  ...ensureWeeklyMissionsSlice({}),
  ...ensureYouthChampionshipsSlice({}),
  ...ensureSurpriseBoothSlice({}),
  ...ensureMemoriesSlice({}),
  ...ensureControlCenterSlice({}),
  ...ensureYouthSocietySlice({}),
  ...ensureCreativeAiSlice({}),
};

function computeInviteSignature(gameId: string, code: string): string {
  return crypto
    .createHmac('sha256', db.serverSecret)
    .update(`${gameId}:${code}`)
    .digest('hex')
    .slice(0, 10);
}

function verifyInviteSignature(game: StoredGame, sig: string): boolean {
  const expected = computeInviteSignature(game.id, game.code);
  const a = Buffer.from(expected, 'utf-8');
  const b = Buffer.from(sig.trim(), 'utf-8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function loadDatabase(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<PersistedDatabase>;
      db = {
        serverSecret:
          typeof parsed.serverSecret === 'string' && parsed.serverSecret.length >= 16
            ? parsed.serverSecret
            : crypto.randomBytes(32).toString('hex'),
        customQuestions: Array.isArray(parsed.customQuestions) ? parsed.customQuestions : [],
        games: parsed.games && typeof parsed.games === 'object' ? parsed.games : {},
        archivedGames:
          parsed.archivedGames && typeof parsed.archivedGames === 'object'
            ? parsed.archivedGames
            : {},
        history: Array.isArray(parsed.history) ? parsed.history : [],
        expansion: hydrateExpansionSlice(parsed.expansion),
        saturdayPrograms:
          parsed.saturdayPrograms && typeof parsed.saturdayPrograms === 'object'
            ? parsed.saturdayPrograms
            : {},
        ...ensureSaturdayChallengeSlice(parsed),
        ...ensureSaturdayRouletteSlice(parsed),
        ...ensureTalentDatabaseSlice(parsed),
        ...ensureAdventureDatabaseSlice(parsed),
        ...ensureWeeklyMissionsSlice(parsed),
        ...ensureYouthChampionshipsSlice(parsed),
        ...ensureSurpriseBoothSlice(parsed),
        ...ensureMemoriesSlice(parsed, parsed.weeklyDirectorSecret || 'SJ2026'),
        ...ensureControlCenterSlice(parsed),
        ...ensureYouthSocietySlice(parsed),
        ...ensureCreativeAiSlice(parsed),
      };
      // Reset online flags and ensure permanent IDs on fresh server start
      for (const game of [...Object.values(db.games), ...Object.values(db.archivedGames)]) {
        if (!game.id) {
          game.id = `${game.code}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        }
        if (!game.inviteSignature) {
          game.inviteSignature = computeInviteSignature(game.id, game.code);
        }
        for (const p of Object.values(game.participants)) {
          p.online = false;
        }
        if (!Array.isArray(game.evaluatedEliminations)) {
          game.evaluatedEliminations = [];
        }
        if (typeof game.roundNonce !== 'number') {
          game.roundNonce = 0;
        }
      }
    }
  } catch (err) {
    console.error('Error cargando base de datos:', err);
  }
}

let saveTimer: NodeJS.Timeout | null = null;
function scheduleSave(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmpPath = `${DB_PATH}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), 'utf-8');
      fs.renameSync(tmpPath, DB_PATH);
    } catch (err) {
      console.error('Error guardando base de datos:', err);
    }
  }, 150);
}

loadDatabase();
// Backfill any previously finished real games into expansion analytics/ranking once
for (const g of [...Object.values(db.games), ...Object.values(db.archivedGames)]) {
  if (g.status === 'finished') {
    recordExpansionMatchOutcome(
      db.expansion,
      g,
      buildLeaderboard(g),
      buildTeamLeaderboard(g)
    );
  }
}

function randomToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

function isLocalOrPrivateHost(host: string): boolean {
  const hostname = host.replace(/^\[|\]$/g, '').split(':')[0].toLowerCase();
  return (
    !hostname ||
    !hostname.includes('.') ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('127.') ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('169.254.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(hostname) ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan') ||
    hostname.endsWith('.home') ||
    hostname.startsWith('ais-dev-') ||
    hostname === 'aistudio.google.com' ||
    hostname.endsWith('.aistudio.google.com') ||
    hostname === 'idx.google.com' ||
    hostname.endsWith('.idx.google.com') ||
    hostname === 'cloudshell.dev' ||
    hostname.endsWith('.cloudshell.dev')
  );
}

function validatePublicUrlString(rawUrl: string): string | null {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    if (isLocalOrPrivateHost(parsed.host)) {
      return null;
    }
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

type PublicOriginReason =
  | 'OK'
  | 'AI_STUDIO_PRIVATE_PREVIEW'
  | 'LOCALHOST_ONLY'
  | 'AUTH_REQUIRED'
  | 'UNREACHABLE_OR_NOT_DEPLOYED'
  | 'UNCONFIGURED';

interface PublicOriginResolution {
  origin: string | null;
  reason: PublicOriginReason;
  detectedHost: string;
}

interface ProbeCacheEntry {
  accessible: boolean;
  reason: PublicOriginReason;
  resolvedOrigin?: string;
  expiresAt: number;
}

const publicProbeCache = new Map<string, ProbeCacheEntry>();

function isAuthRedirectLocation(location: string): 'AI_STUDIO' | 'AUTH' | null {
  const lower = location.toLowerCase();
  if (
    lower.includes('__cookie_check.html') ||
    lower.includes('aistudio.google.com') ||
    lower.includes('applet-auth-bridge')
  ) {
    return 'AI_STUDIO';
  }
  if (
    lower.includes('accounts.google.com') ||
    lower.includes('/oauth') ||
    lower.includes('/login') ||
    lower.includes('/signin')
  ) {
    return 'AUTH';
  }
  return null;
}

function isSameDomainRedirect(fromOrigin: string, targetUrl: URL): boolean {
  try {
    const fromHost = new URL(fromOrigin).hostname.toLowerCase().replace(/^www\./, '');
    const toHost = targetUrl.hostname.toLowerCase().replace(/^www\./, '');
    return fromHost === toHost && !isLocalOrPrivateHost(targetUrl.host);
  } catch {
    return false;
  }
}

async function fetchHealthOnce(url: string): Promise<Response> {
  return fetch(url, {
    redirect: 'manual',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'DimeTuQueDices-PublicCheck/1.0',
    },
    signal: AbortSignal.timeout(5000),
  });
}

async function verifyOriginPublicAccess(
  origin: string,
  bypassCache = false
): Promise<{ accessible: boolean; reason: PublicOriginReason; resolvedOrigin?: string }> {
  const normalized = validatePublicUrlString(origin);
  if (!normalized) {
    return { accessible: false, reason: 'LOCALHOST_ONLY' };
  }

  const now = Date.now();
  if (!bypassCache) {
    const cached = publicProbeCache.get(normalized);
    if (cached && cached.expiresAt > now) {
      return {
        accessible: cached.accessible,
        reason: cached.reason,
        resolvedOrigin: cached.resolvedOrigin,
      };
    }
  }

  const saveCache = (
    accessible: boolean,
    reason: PublicOriginReason,
    resolvedOrigin?: string
  ) => {
    publicProbeCache.set(normalized, {
      accessible,
      reason,
      resolvedOrigin,
      expiresAt: Date.now() + (accessible ? 60_000 : 10_000),
    });
    return { accessible, reason, resolvedOrigin };
  };

  try {
    let currentOrigin = normalized;
    let res: Response | null = null;

    for (let hop = 0; hop < 3; hop++) {
      try {
        res = await fetchHealthOnce(`${currentOrigin}/api/health`);
      } catch {
        // Retry once on transient cold-start/network error
        res = await fetchHealthOnce(`${currentOrigin}/api/health`);
      }

      if (res.status === 200) {
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          service?: string;
        } | null;
        if (data?.ok === true && data?.service === SERVER_SERVICE_ID) {
          return saveCache(true, 'OK', currentOrigin);
        }
        return saveCache(false, 'UNREACHABLE_OR_NOT_DEPLOYED');
      }

      if (res.status >= 300 && res.status < 400) {
        const location = String(res.headers.get('location') || '').trim();
        const authKind = isAuthRedirectLocation(location);

        if (location.toLowerCase().includes('__cookie_check.html')) {
          try {
            const resWithCookie = await fetch(`${currentOrigin}/api/health`, {
              redirect: 'manual',
              headers: {
                Cookie: '__SECURE-aistudio_auth_flow_may_set_cookies=true',
                Accept: 'application/json',
              },
              signal: AbortSignal.timeout(4000),
            });
            const loc2 = String(resWithCookie.headers.get('location') || '');
            if (isAuthRedirectLocation(loc2) || resWithCookie.status === 401 || resWithCookie.status === 403) {
              return saveCache(false, 'AI_STUDIO_PRIVATE_PREVIEW');
            }
          } catch {
            return saveCache(false, 'AI_STUDIO_PRIVATE_PREVIEW');
          }
          return saveCache(false, 'AI_STUDIO_PRIVATE_PREVIEW');
        }

        if (authKind === 'AI_STUDIO') {
          return saveCache(false, 'AI_STUDIO_PRIVATE_PREVIEW');
        }
        if (authKind === 'AUTH') {
          return saveCache(false, 'AUTH_REQUIRED');
        }

        // Allow safe same-domain redirect (e.g. apex <-> www or http -> https)
        try {
          const target = new URL(location, currentOrigin);
          if (
            (target.protocol === 'https:' || target.protocol === 'http:') &&
            target.pathname === '/api/health' &&
            isSameDomainRedirect(currentOrigin, target)
          ) {
            currentOrigin = `${target.protocol}//${target.host}`;
            continue;
          }
        } catch {
          // ignore malformed redirect
        }

        return saveCache(false, 'AUTH_REQUIRED');
      }

      if (res.status === 401 || res.status === 403) {
        return saveCache(false, 'AUTH_REQUIRED');
      }

      return saveCache(false, 'UNREACHABLE_OR_NOT_DEPLOYED');
    }

    return saveCache(false, 'UNREACHABLE_OR_NOT_DEPLOYED');
  } catch {
    return saveCache(false, 'UNREACHABLE_OR_NOT_DEPLOYED');
  }
}

function extractForwardedHost(forwardedHeader: string): string {
  if (!forwardedHeader) return '';
  const match = forwardedHeader.match(/host=([^;,\s"]+|"[^"]+")/i);
  if (!match) return '';
  return match[1].replace(/^"|"$/g, '').trim();
}

function extractOriginFromHeaderUrl(raw: string): string {
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return '';
  }
}

async function resolvePublicOriginInfo(
  req: express.Request,
  bypassCache = false
): Promise<PublicOriginResolution> {
  const forwardedHost = String(req.headers['x-forwarded-host'] || '')
    .split(',')[0]
    .trim();
  const rfcForwardedHost = extractForwardedHost(
    String(req.headers.forwarded || '')
  );
  const hostHeader = String(req.headers.host || '').trim();
  const reqHost = forwardedHost || rfcForwardedHost || hostHeader;
  const protoHeader =
    String(req.headers['x-forwarded-proto'] || '')
      .split(',')[0]
      .trim()
      .toLowerCase() || 'https';
  const queryOrigin = String(req.query.origin || '').trim();
  const headerOrigin = String(req.headers.origin || '').trim();
  const refererOrigin = extractOriginFromHeaderUrl(
    String(req.headers.referer || '').trim()
  );

  const rawCandidates: string[] = [];
  const pushHostCandidates = (h: string) => {
    if (!h) return;
    rawCandidates.push(`https://${h}`);
    if (protoHeader !== 'https') {
      rawCandidates.push(`${protoHeader}://${h}`);
    }
  };

  pushHostCandidates(forwardedHost);
  pushHostCandidates(rfcForwardedHost);
  pushHostCandidates(hostHeader);
  if (queryOrigin) rawCandidates.push(queryOrigin);
  if (headerOrigin) rawCandidates.push(headerOrigin);
  if (refererOrigin) rawCandidates.push(refererOrigin);
  if (process.env.PUBLIC_APP_URL) rawCandidates.push(String(process.env.PUBLIC_APP_URL));
  if (process.env.APP_URL) rawCandidates.push(String(process.env.APP_URL));

  const seen = new Set<string>();
  let sawAiStudio = false;
  let sawLocalhost = false;
  let lastFailureReason: PublicOriginReason = 'UNCONFIGURED';

  for (const raw of rawCandidates) {
    const trimmed = raw.trim().replace(/\/+$/, '');
    if (!trimmed) continue;

    const lower = trimmed.toLowerCase();
    if (
      lower.includes('ais-dev-') ||
      lower.includes('aistudio.google.com') ||
      lower.includes('idx.google.com') ||
      lower.includes('cloudshell.dev')
    ) {
      sawAiStudio = true;
      continue;
    }

    const validFormat = validatePublicUrlString(trimmed);
    if (!validFormat) {
      if (
        lower.includes('localhost') ||
        lower.includes('127.0.0.1') ||
        lower.includes('0.0.0.0')
      ) {
        sawLocalhost = true;
      }
      continue;
    }

    if (seen.has(validFormat)) continue;
    seen.add(validFormat);

    const probe = await verifyOriginPublicAccess(validFormat, bypassCache);
    if (probe.accessible) {
      const resolved = probe.resolvedOrigin || validFormat;
      return {
        origin: resolved,
        reason: 'OK',
        detectedHost: reqHost || new URL(resolved).host,
      };
    }

    if (probe.reason === 'AI_STUDIO_PRIVATE_PREVIEW') {
      sawAiStudio = true;
    }
    lastFailureReason = probe.reason;
  }

  if (sawAiStudio) {
    return {
      origin: null,
      reason: 'AI_STUDIO_PRIVATE_PREVIEW',
      detectedHost: reqHost || String(process.env.APP_URL || ''),
    };
  }

  if (sawLocalhost && lastFailureReason === 'UNCONFIGURED') {
    return {
      origin: null,
      reason: 'LOCALHOST_ONLY',
      detectedHost: reqHost,
    };
  }

  return {
    origin: null,
    reason: lastFailureReason,
    detectedHost: reqHost,
  };
}

function findGameByIdentifier(identifier: string): StoredGame | undefined {
  const upper = identifier.trim().toUpperCase();
  if (!upper) return undefined;
  if (db.archivedGames[upper]) return db.archivedGames[upper];
  const activeById = Object.values(db.games).find((g) => g.id === upper);
  if (activeById) return activeById;
  return db.games[upper];
}

function generateGameCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 20; attempt++) {
    let suffix = '';
    for (let i = 0; i < 4; i++) {
      suffix += chars[Math.floor(Math.random() * chars.length)];
    }
    const candidate = `BIBLIA${suffix}`;
    if (!db.games[candidate] || db.games[candidate].status === 'finished') {
      return candidate;
    }
  }
  return `BIBLIA${Date.now().toString().slice(-4)}`;
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function prepareQuestionInstance(
  q: BibleQuestion,
  index: number,
  total: number,
  config: GameConfig
): GameQuestionInstance {
  let options = [...q.options];
  let correctIndex = q.correctIndex;

  // Shuffle options unless it's True/False
  const isTrueFalse =
    q.category === 'Verdadero o falso' ||
    (options.length === 2 &&
      options[0].toLowerCase() === 'verdadero' &&
      options[1].toLowerCase() === 'falso');

  if (!isTrueFalse && options.length > 1) {
    const tagged = options.map((text, idx) => ({
      text,
      isCorrect: idx === q.correctIndex,
    }));
    const shuffled = shuffleArray(tagged);
    options = shuffled.map((t) => t.text);
    correctIndex = shuffled.findIndex((t) => t.isCorrect);
  }

  let isSpecialMultiplier = 1;
  if (config.specialEveryN > 0 && (index + 1) % config.specialEveryN === 0) {
    isSpecialMultiplier = 2;
  }

  let roundStage: string | undefined;
  if (config.mode === 'torneo') {
    const progress = (index + 1) / total;
    if (progress <= 0.4) {
      roundStage = 'Ronda 1 · Clasificatoria';
    } else if (progress <= 0.75) {
      roundStage = 'Ronda 2 · Semifinal';
    } else {
      roundStage = 'Gran Final · Doble Puntaje';
      isSpecialMultiplier = 2;
    }
  }

  return {
    ...q,
    options,
    correctIndex,
    isSpecialMultiplier,
    roundStage,
  };
}

function extractReferenceBookKey(reference: string): string {
  const cleaned = reference.trim();
  const match = cleaned.match(/^((?:[1-3]\s+)?[A-Za-zÁÉÍÓÚáéíóúñÑüÜ]+)/);
  return (match ? match[1] : cleaned).toLowerCase();
}

function deduplicateQuestions(questions: BibleQuestion[]): BibleQuestion[] {
  const seenIds = new Set<string>();
  const seenPrompts = new Set<string>();
  const unique: BibleQuestion[] = [];
  for (const q of questions) {
    const normPrompt = q.prompt.trim().toLowerCase().replace(/\s+/g, ' ');
    if (seenIds.has(q.id) || seenPrompts.has(normPrompt)) continue;
    seenIds.add(q.id);
    seenPrompts.add(normPrompt);
    unique.push(q);
  }
  return unique;
}

function pickDiverseQuestions(
  candidates: BibleQuestion[],
  targetCount: number,
  usedIds: Set<string>,
  usedPrompts: Set<string>,
  categoryUsage: Map<string, number>,
  bookUsage: Map<string, number>
): BibleQuestion[] {
  const picked: BibleQuestion[] = [];
  const remaining = shuffleArray(candidates).filter((q) => {
    const normPrompt = q.prompt.trim().toLowerCase().replace(/\s+/g, ' ');
    return !usedIds.has(q.id) && !usedPrompts.has(normPrompt);
  });

  while (picked.length < targetCount && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const q = remaining[i];
      const catCount = categoryUsage.get(q.category) || 0;
      const bookKey = extractReferenceBookKey(q.reference);
      const bookCount = bookUsage.get(bookKey) || 0;
      // Strongly prefer unused categories first, then spread biblical books/characters
      const score = catCount * 12 + bookCount * 4;
      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
        if (score === 0) break;
      }
    }

    const [chosen] = remaining.splice(bestIdx, 1);
    const normPrompt = chosen.prompt.trim().toLowerCase().replace(/\s+/g, ' ');
    usedIds.add(chosen.id);
    usedPrompts.add(normPrompt);
    categoryUsage.set(chosen.category, (categoryUsage.get(chosen.category) || 0) + 1);
    const bookKey = extractReferenceBookKey(chosen.reference);
    bookUsage.set(bookKey, (bookUsage.get(bookKey) || 0) + 1);
    picked.push(chosen);
  }

  return picked;
}

function selectQuestionsForGame(config: GameConfig): GameQuestionInstance[] {
  const allQuestions = deduplicateQuestions([
    ...BIBLE_QUESTION_BANK,
    ...db.customQuestions,
  ]);

  let pool = allQuestions.filter((q) => {
    const catMatch =
      config.categories.length === 0 || config.categories.includes(q.category);
    const diffMatch =
      config.difficulty === 'combinado' || q.difficulty === config.difficulty;
    return catMatch && diffMatch;
  });

  // Ensure enough unique questions when narrow filter yields too few
  if (pool.length === 0) {
    pool = allQuestions.filter(
      (q) => config.categories.length === 0 || config.categories.includes(q.category)
    );
  }
  if (pool.length === 0) {
    pool = [...allQuestions];
  }
  if (pool.length < config.questionCount) {
    const existingIds = new Set(pool.map((q) => q.id));
    const extras = shuffleArray(
      allQuestions.filter((q) => !existingIds.has(q.id))
    );
    pool = [...pool, ...extras];
  }

  const targetTotal = Math.min(config.questionCount, pool.length);
  const usedIds = new Set<string>();
  const usedPrompts = new Set<string>();
  const categoryUsage = new Map<string, number>();
  const bookUsage = new Map<string, number>();

  let selected: BibleQuestion[] = [];

  if (config.difficulty === 'combinado') {
    // Balanced split: for 25 questions -> 8 fácil, 10 intermedio, 7 difícil
    const easyQuota = Math.round(targetTotal * 0.32);
    const midQuota = Math.round(targetTotal * 0.40);
    const hardQuota = Math.max(0, targetTotal - easyQuota - midQuota);

    const easyPool = pool.filter((q) => q.difficulty === 'facil');
    const midPool = pool.filter((q) => q.difficulty === 'intermedio');
    const hardPool = pool.filter((q) => q.difficulty === 'dificil');

    const pickedEasy = pickDiverseQuestions(
      easyPool,
      easyQuota,
      usedIds,
      usedPrompts,
      categoryUsage,
      bookUsage
    );
    const pickedMid = pickDiverseQuestions(
      midPool,
      midQuota,
      usedIds,
      usedPrompts,
      categoryUsage,
      bookUsage
    );
    const pickedHard = pickDiverseQuestions(
      hardPool,
      hardQuota,
      usedIds,
      usedPrompts,
      categoryUsage,
      bookUsage
    );

    if (config.mode === 'supervivencia') {
      selected = [...pickedEasy, ...pickedMid, ...pickedHard];
    } else {
      selected = shuffleArray([...pickedEasy, ...pickedMid, ...pickedHard]);
    }

    if (selected.length < targetTotal) {
      const fill = pickDiverseQuestions(
        pool,
        targetTotal - selected.length,
        usedIds,
        usedPrompts,
        categoryUsage,
        bookUsage
      );
      selected =
        config.mode === 'supervivencia'
          ? [...selected, ...fill]
          : shuffleArray([...selected, ...fill]);
    }
  } else {
    selected = pickDiverseQuestions(
      pool,
      targetTotal,
      usedIds,
      usedPrompts,
      categoryUsage,
      bookUsage
    );
    if (config.mode !== 'supervivencia') {
      selected = shuffleArray(selected);
    }
  }

  return selected.map((q, idx) =>
    prepareQuestionInstance(q, idx, selected.length, config)
  );
}

function buildLeaderboard(game: StoredGame): LeaderboardEntry[] {
  const list = Object.values(game.participants).map((p) => {
    const accuracyPercent =
      p.answeredCount > 0 ? Math.round((p.correctCount / p.answeredCount) * 100) : 0;
    const avgResponseMs =
      p.answeredCount > 0 ? Math.round(p.totalResponseMs / p.answeredCount) : 0;
    return {
      rank: 0,
      participantId: p.id,
      name: p.name,
      avatarId: p.avatarId,
      photoUrl: p.photoUrl,
      teamId: p.teamId,
      score: p.score,
      correctCount: p.correctCount,
      answeredCount: p.answeredCount,
      accuracyPercent,
      avgResponseMs,
      eliminated: p.eliminated,
      online: p.online,
    };
  });

  list.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
    return a.avgResponseMs - b.avgResponseMs;
  });

  return list.map((entry, idx) => ({ ...entry, rank: idx + 1 }));
}

function getConfiguredTeams(game: StoredGame): TeamConfigSlot[] {
  if (Array.isArray(game.config.teams) && game.config.teams.length >= 2) {
    return game.config.teams;
  }
  const count = Math.max(2, Math.min(6, game.config.teamCount || 4));
  return COMPETITION_TEAM_PRESETS.slice(0, count).map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    bgClass: t.bgClass,
    borderClass: t.borderClass,
    textClass: t.textClass,
  }));
}

function usesCustomTeams(game: StoredGame): boolean {
  return (
    game.config.mode === 'competencia_equipos' || Boolean(game.config.teamMode)
  );
}

function buildTeamLeaderboard(game: StoredGame): TeamScoreEntry[] {
  if (usesCustomTeams(game)) {
    const teams = getConfiguredTeams(game);
    const capacity = game.config.teamCapacity;
    const map: Record<string, TeamScoreEntry> = {};
    for (const t of teams) {
      const capParticipant = t.captainParticipantId
        ? game.participants[t.captainParticipantId]
        : undefined;
      map[t.id] = {
        teamId: t.id,
        name: t.name,
        color: t.color,
        score: 0,
        memberCount: 0,
        correctCount: 0,
        capacity,
        ...(capParticipant
          ? {
              captainParticipantId: capParticipant.id,
              captainName: capParticipant.name,
            }
          : {}),
      };
    }

    for (const p of Object.values(game.participants)) {
      if (p.teamId && map[p.teamId]) {
        map[p.teamId].score += p.score;
        map[p.teamId].memberCount += 1;
        map[p.teamId].correctCount += p.correctCount;
      }
    }

    return Object.values(map).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.correctCount - a.correctCount;
    });
  }

  if (game.config.mode !== 'equipos') return [];
  const map: Record<string, TeamScoreEntry> = {
    leones: {
      teamId: 'leones',
      name: TEAMS[0].name,
      color: TEAMS[0].color,
      score: 0,
      memberCount: 0,
      correctCount: 0,
    },
    aguilas: {
      teamId: 'aguilas',
      name: TEAMS[1].name,
      color: TEAMS[1].color,
      score: 0,
      memberCount: 0,
      correctCount: 0,
    },
    olivos: {
      teamId: 'olivos',
      name: TEAMS[2].name,
      color: TEAMS[2].color,
      score: 0,
      memberCount: 0,
      correctCount: 0,
    },
    estrellas: {
      teamId: 'estrellas',
      name: TEAMS[3].name,
      color: TEAMS[3].color,
      score: 0,
      memberCount: 0,
      correctCount: 0,
    },
  };

  for (const p of Object.values(game.participants)) {
    if (p.teamId && map[p.teamId]) {
      map[p.teamId].score += p.score;
      map[p.teamId].memberCount += 1;
      map[p.teamId].correctCount += p.correctCount;
    }
  }

  return Object.values(map)
    .filter((t) => t.memberCount > 0)
    .sort((a, b) => b.score - a.score);
}

function buildInviteTeamsSummary(game: StoredGame): InviteTeamSummary[] | undefined {
  if (!usesCustomTeams(game)) return undefined;
  const teams = getConfiguredTeams(game);
  const capacity = game.config.teamCapacity;
  const counts: Record<string, number> = {};
  for (const t of teams) counts[t.id] = 0;
  for (const p of Object.values(game.participants)) {
    if (p.teamId && counts[p.teamId] !== undefined) {
      counts[p.teamId] += 1;
    }
  }
  return teams.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    memberCount: counts[t.id] || 0,
    capacity,
  }));
}

function buildQuestionReview(game: StoredGame): QuestionReviewItem[] | undefined {
  if (game.status !== 'finished') return undefined;
  if (
    game.config.mode !== 'batalla_1v1' &&
    game.config.mode !== 'competencia_equipos'
  ) {
    return undefined;
  }

  return game.questions.map((q, idx) => {
    const stats = buildQuestionStats(game, idx, true);
    return {
      questionIndex: idx,
      category: q.category,
      difficulty: q.difficulty,
      prompt: q.prompt,
      options: q.options,
      correctIndex: q.correctIndex,
      reference: q.reference,
      explanation: q.explanation,
      isSpecialMultiplier: q.isSpecialMultiplier,
      answers: stats ? stats.rows : [],
    };
  });
}

function buildQuestionStats(
  game: StoredGame,
  questionIndex: number,
  includeDetails: boolean
): QuestionResultStats | null {
  if (questionIndex < 0 || questionIndex >= game.questions.length) return null;
  const q = game.questions[questionIndex];
  const answersMap = game.answers[questionIndex] || {};
  const participants = Object.values(game.participants);

  const optionCounts = q.options.map(() => 0);
  let correctCount = 0;
  let incorrectCount = 0;

  const rows: QuestionAnswerSummary[] = participants.map((p) => {
    const ans = answersMap[p.id];
    if (!ans) {
      incorrectCount += 1;
      return {
        participantId: p.id,
        participantName: p.name,
        avatarId: p.avatarId,
        photoUrl: p.photoUrl,
        teamId: p.teamId,
        selectedIndex: null,
        selectedLabel: 'Sin responder',
        isCorrect: false,
        pointsEarned: 0,
        responseTimeMs: null,
      };
    }
    if (ans.selectedIndex >= 0 && ans.selectedIndex < optionCounts.length) {
      optionCounts[ans.selectedIndex] += 1;
    }
    if (ans.isCorrect) correctCount += 1;
    else incorrectCount += 1;

    return {
      participantId: p.id,
      participantName: p.name,
      avatarId: p.avatarId,
      photoUrl: p.photoUrl,
      teamId: p.teamId,
      selectedIndex: ans.selectedIndex,
      selectedLabel: q.options[ans.selectedIndex] ?? 'Opción',
      isCorrect: ans.isCorrect,
      pointsEarned: ans.pointsEarned,
      responseTimeMs: ans.responseTimeMs,
    };
  });

  rows.sort((a, b) => {
    if (b.pointsEarned !== a.pointsEarned) return b.pointsEarned - a.pointsEarned;
    return (a.responseTimeMs ?? 999999) - (b.responseTimeMs ?? 999999);
  });

  const totalAnswered = Object.keys(answersMap).length;
  const totalParticipants = participants.length;
  const optionPercents = optionCounts.map((c) =>
    totalAnswered > 0 ? Math.round((c / totalAnswered) * 100) : 0
  );

  return {
    questionIndex,
    totalParticipants,
    totalAnswered,
    correctCount: includeDetails ? correctCount : 0,
    incorrectCount: includeDetails ? incorrectCount : 0,
    correctPercent:
      includeDetails && totalParticipants > 0
        ? Math.round((correctCount / totalParticipants) * 100)
        : 0,
    incorrectPercent:
      includeDetails && totalParticipants > 0
        ? Math.round((incorrectCount / totalParticipants) * 100)
        : 0,
    optionCounts: includeDetails ? optionCounts : q.options.map(() => 0),
    optionPercents: includeDetails ? optionPercents : q.options.map(() => 0),
    rows: includeDetails ? rows : [],
  };
}

function buildClientState(
  game: StoredGame,
  role: 'presenter' | 'projector' | 'participant',
  participantId?: string
): GameRoomClientState {
  const now = Date.now();
  const qIdx = game.currentQuestionIndex;
  const rawQ =
    qIdx >= 0 && qIdx < game.questions.length ? game.questions[qIdx] : null;

  const isRevealed =
    game.status === 'answer_revealed' || game.status === 'finished';

  // SECURITY: Never send correctIndex or explanation to participants or projector while active!
  const showAnswerFields = isRevealed || role === 'presenter';

  let currentQuestion: SanitizedQuestion | null = null;
  if (rawQ) {
    currentQuestion = {
      id: rawQ.id,
      group: rawQ.group,
      category: rawQ.category,
      difficulty: rawQ.difficulty,
      prompt: rawQ.prompt,
      options: rawQ.options,
      isSpecialMultiplier: rawQ.isSpecialMultiplier,
      roundStage: rawQ.roundStage,
      ...(showAnswerFields
        ? {
            correctIndex: rawQ.correctIndex,
            reference: rawQ.reference,
            explanation: rawQ.explanation,
          }
        : {}),
    };
  }

  let remainingSec = 0;
  if (game.status === 'question_active' && game.questionEndsAt) {
    remainingSec = Math.max(0, Math.ceil((game.questionEndsAt - now) / 1000));
  } else if (game.status === 'paused' && game.pausedRemainingMs) {
    remainingSec = Math.max(0, Math.ceil(game.pausedRemainingMs / 1000));
  }

  const publicParticipants: Participant[] = Object.values(game.participants).map(
    ({
      token: _t,
      photoAccessKey: _pk,
      photoFile: _pf,
      profileKey: _prk,
      ...rest
    }) => rest
  );

  const answersMap = game.answers[qIdx] || {};
  const answeredParticipantIds = Object.keys(answersMap);

  const includeStatsDetails = isRevealed || role === 'presenter';
  const questionStats =
    qIdx >= 0 ? buildQuestionStats(game, qIdx, includeStatsDetails) : null;

  let myParticipant: Participant | null = null;
  let myCurrentAnswer: GameRoomClientState['myCurrentAnswer'] = null;
  if (participantId && game.participants[participantId]) {
    const {
      token: _t,
      photoAccessKey: _pk,
      photoFile: _pf,
      profileKey: _prk,
      ...rest
    } = game.participants[participantId];
    myParticipant = rest;
    const ans = answersMap[participantId];
    if (ans) {
      myCurrentAnswer = {
        selectedIndex: ans.selectedIndex,
        ...(isRevealed
          ? {
              isCorrect: ans.isCorrect,
              pointsEarned: ans.pointsEarned,
            }
          : {}),
      };
    }
  }

  return {
    gameId: game.id,
    code: game.code,
    invitePath: `/partida/${encodeURIComponent(game.id)}?s=${encodeURIComponent(game.inviteSignature)}`,
    config: game.config,
    status: game.status,
    previousStatusBeforePause: game.previousStatusBeforePause,
    currentQuestionIndex: game.currentQuestionIndex,
    roundEventId:
      game.currentQuestionIndex >= 0
        ? `${game.id}:q${game.currentQuestionIndex}:r${game.roundNonce || 0}`
        : undefined,
    questionLockReason: game.questionLockReason,
    totalQuestions: game.questions.length,
    currentQuestion,
    questionStartedAt: game.questionStartedAt,
    questionEndsAt: game.questionEndsAt,
    remainingSec,
    serverNow: now,
    participants: publicParticipants,
    answeredParticipantIds,
    questionStats,
    leaderboard: buildLeaderboard(game),
    teamLeaderboard: buildTeamLeaderboard(game),
    myParticipant,
    myCurrentAnswer,
    questionReview: buildQuestionReview(game),
    createdAt: game.createdAt,
    finishedAt: game.finishedAt,
    ...(game.rouletteState ? { rouletteState: game.rouletteState } : {}),
    ...(game.mysteryInternal
      ? { mysteryState: buildMysteryClientView(game, role) }
      : {}),
    ...(game.championshipState
      ? { championshipState: game.championshipState }
      : {}),
    ...(game.retoInternal
      ? { retoState: buildRetoClientView(game, role, participantId) }
      : {}),
    ...(game.learningInternal
      ? { learningState: buildLearningClientView(game, role) }
      : {}),
    ...(game.saturdayChallengeInternal
      ? {
          saturdayChallengeState: buildSaturdayChallengeClientView(
            game,
            role,
            participantId,
            db
          ),
        }
      : {}),
    ...(game.saturdayRouletteInternal
      ? {
          saturdayRouletteState: buildSaturdayRouletteClientView(
            game,
            role,
            participantId,
            db
          ),
        }
      : {}),
    ...(game.talentRoomInternal
      ? {
          talentRoomState: buildTalentClientView(
            game,
            role,
            participantId
          ),
        }
      : {}),
    ...(game.adventureInternal
      ? {
          adventureState: buildAdventureClientView(
            game,
            role,
            participantId
          ),
        }
      : {}),
    projectorConnectedCount: Array.from(roomSockets.get(game.code) || []).filter(
      (c) => c.role === 'projector'
    ).length,
    announcerState: ensureGameAnnouncerState(game),
  };
}

function evaluateEliminationsForQuestion(game: StoredGame, qIdx: number): void {
  if (game.config.mode !== 'eliminacion') return;
  if (qIdx < 0 || qIdx >= game.questions.length) return;
  if (game.evaluatedEliminations.includes(qIdx)) return;

  game.evaluatedEliminations.push(qIdx);
  const answersMap = game.answers[qIdx] || {};
  const lives = Math.max(1, game.config.eliminationLives || 1);

  for (const p of Object.values(game.participants)) {
    if (p.eliminated) continue;
    const ans = answersMap[p.id];
    if (!ans || !ans.isCorrect) {
      p.mistakes += 1;
      if (p.mistakes >= lives) {
        p.eliminated = true;
      }
    }
  }
}

function recordGameHistory(game: StoredGame): void {
  const existingIdx = db.history.findIndex((h) => h.id === `${game.code}-${game.createdAt}`);
  const lb = buildLeaderboard(game);
  const winner = lb[0];
  const isTie =
    game.config.mode === 'batalla_1v1' &&
    lb.length >= 2 &&
    lb[0].score === lb[1].score;

  let winningTeamName: string | undefined;
  let winningTeamColor: string | undefined;
  let teamTie: boolean | undefined;
  if (usesCustomTeams(game)) {
    const activeTeams = buildTeamLeaderboard(game).filter((t) => t.memberCount > 0);
    if (activeTeams.length >= 2 && activeTeams[0].score === activeTeams[1].score) {
      teamTie = true;
      winningTeamName = `Empate (${activeTeams[0].name} / ${activeTeams[1].name})`;
      winningTeamColor = activeTeams[0].color;
    } else if (activeTeams[0]) {
      teamTie = false;
      winningTeamName = activeTeams[0].name;
      winningTeamColor = activeTeams[0].color;
    }
  }

  const summary: GameHistorySummary = {
    id: `${game.code}-${game.createdAt}`,
    code: game.code,
    title: game.config.title,
    mode: game.config.mode,
    questionCount: game.questions.length,
    participantCount: lb.length,
    winnerName: isTie
      ? `Empate (${lb[0].name} vs ${lb[1].name})`
      : winner
        ? winner.name
        : 'Sin participantes',
    winnerAvatarId: winner ? winner.avatarId : 'crown',
    winnerPhotoUrl: isTie ? undefined : winner ? winner.photoUrl : undefined,
    winnerScore: winner ? winner.score : 0,
    isTie: isTie || undefined,
    winningTeamName,
    winningTeamColor,
    teamTie,
    topThree: lb.slice(0, 3).map((e) => ({
      rank: e.rank,
      name: e.name,
      avatarId: e.avatarId,
      photoUrl: e.photoUrl,
      score: e.score,
      correctCount: e.correctCount,
      accuracyPercent: e.accuracyPercent,
    })),
    finishedAt: game.finishedAt || Date.now(),
  };

  if (existingIdx >= 0) {
    db.history[existingIdx] = summary;
  } else {
    db.history.unshift(summary);
  }
  db.history = db.history.slice(0, 100);
}

interface ClientMeta {
  ws: WebSocket;
  code: string;
  role: 'presenter' | 'projector' | 'participant';
  participantId?: string;
}

const roomSockets = new Map<string, Set<ClientMeta>>();
const socketMetaMap = new WeakMap<WebSocket, ClientMeta>();

function broadcastRoom(code: string): void {
  const game = db.games[code];
  const clients = roomSockets.get(code);
  if (!game || !clients) return;

  for (const client of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      const payload = buildClientState(game, client.role, client.participantId);
      client.ws.send(JSON.stringify({ type: 'state', payload }));
    }
  }
}

function startQuestionAt(game: StoredGame, index: number): void {
  const now = Date.now();
  game.currentQuestionIndex = index;
  game.roundNonce = (game.roundNonce || 0) + 1;
  game.questionLockReason = undefined;
  game.status = 'question_active';
  game.previousStatusBeforePause = undefined;
  game.pausedRemainingMs = undefined;
  game.questionStartedAt = now;
  game.questionEndsAt = now + game.config.timeLimitSec * 1000;
}

function finishGame(game: StoredGame): void {
  if (game.currentQuestionIndex >= 0) {
    evaluateEliminationsForQuestion(game, game.currentQuestionIndex);
  }
  game.status = 'finished';
  game.finishedAt = Date.now();
  recordGameHistory(game);
  recordExpansionMatchOutcome(
    db.expansion,
    game,
    buildLeaderboard(game),
    buildTeamLeaderboard(game)
  );
  recordSaturdayChallengeGameHistory(game, buildLeaderboard, db);
  saveAdventureMatchProgress(game, buildLeaderboard, db);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  const ccDeps = {
    getDb: () => db,
    scheduleSave,
    buildGameLeaderboard: buildLeaderboard,
    buildGameTeamLeaderboard: buildTeamLeaderboard,
  };

  // Authoritative Timer Loop
  setInterval(() => {
    const now = Date.now();
    for (const game of Object.values(db.games)) {
      if (
        game.status === 'question_active' &&
        game.questionEndsAt !== null &&
        now >= game.questionEndsAt
      ) {
        game.status = 'question_locked';
        game.questionLockReason = 'timeout';
        evaluateEliminationsForQuestion(game, game.currentQuestionIndex);
        scheduleSave();
        broadcastRoom(game.code);
      }
    }
    tickControlCenterTimers(db, ccDeps);
    tickYouthSocietyTimers(db, ccDeps);
  }, 150);

  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (handleControlCenterWsMessage(ws, msg, db, ccDeps)) {
          return;
        }
        if (handleYouthSocietyWsMessage(ws, msg, db, ccDeps)) {
          return;
        }

        if (msg.type === 'subscribe') {
          const code = String(msg.code || '').trim().toUpperCase();
          const role = msg.role as 'presenter' | 'projector' | 'participant';
          const token = String(msg.token || '');
          const game = db.games[code];

          if (!game) {
            ws.send(
              JSON.stringify({
                type: 'error',
                code: 'ROOM_NOT_FOUND',
                message: 'No se encontró ninguna partida con ese código.',
              })
            );
            return;
          }

          // Clean previous subscription if re-subscribing
          const oldMeta = socketMetaMap.get(ws);
          if (oldMeta) {
            roomSockets.get(oldMeta.code)?.delete(oldMeta);
          }

          let verifiedRole: 'presenter' | 'projector' | 'participant' = 'projector';
          let participantId: string | undefined;

          if (role === 'presenter') {
            if (token && token === game.presenterToken) {
              verifiedRole = 'presenter';
            } else {
              ws.send(
                JSON.stringify({
                  type: 'error',
                  code: 'INVALID_PRESENTER_TOKEN',
                  message: 'Credencial de presentador no válida.',
                })
              );
              return;
            }
          } else if (role === 'participant') {
            const found = Object.values(game.participants).find(
              (p) => p.token === token
            );
            if (!found) {
              ws.send(
                JSON.stringify({
                  type: 'kicked',
                  message: 'Tu sesión en esta partida ya no está activa.',
                })
              );
              return;
            }
            verifiedRole = 'participant';
            participantId = found.id;
            found.online = true;
            scheduleSave();
          } else {
            verifiedRole = 'projector';
          }

          const meta: ClientMeta = {
            ws,
            code,
            role: verifiedRole,
            participantId,
          };
          socketMetaMap.set(ws, meta);
          if (!roomSockets.has(code)) {
            roomSockets.set(code, new Set());
          }
          roomSockets.get(code)!.add(meta);

          broadcastRoom(code);
          return;
        }

        if (msg.type === 'presenter_action') {
          const code = String(msg.code || '').trim().toUpperCase();
          const token = String(msg.token || '');
          const action = String(msg.action || '');
          const game = db.games[code];

          if (!game || token !== game.presenterToken) {
            ws.send(
              JSON.stringify({
                type: 'error',
                message: 'No autorizado para controlar esta partida.',
              })
            );
            return;
          }

          const expansionHelpers: ExpansionActionHelpers = {
            allQuestionsBank: () =>
              deduplicateQuestions([...BIBLE_QUESTION_BANK, ...db.customQuestions]),
            prepareQuestion: prepareQuestionInstance,
            selectQuestions: selectQuestionsForGame,
            startQuestionAt,
            finishGame,
            buildLeaderboard,
            broadcastRoom,
            scheduleSave,
            sendWsError: (message: string) =>
              ws.send(JSON.stringify({ type: 'error', message })),
          };

          if (
            handleExpansionPresenterAction(
              game,
              action,
              msg as Record<string, unknown>,
              expansionHelpers
            )
          ) {
            return;
          }

          if (
            handleSaturdayChallengePresenterAction(
              game,
              action,
              msg as Record<string, unknown>,
              {
                startQuestionAt,
                finishGame,
                buildLeaderboard,
                broadcastRoom,
                scheduleSave,
                sendWsError: (message: string) =>
                  ws.send(JSON.stringify({ type: 'error', message })),
              },
              db
            )
          ) {
            return;
          }

          if (
            handleSaturdayRoulettePresenterAction(
              game,
              action,
              msg as Record<string, unknown>,
              {
                startQuestionAt,
                finishGame,
                buildLeaderboard,
                broadcastRoom,
                scheduleSave,
                sendWsError: (message: string) =>
                  ws.send(JSON.stringify({ type: 'error', message })),
              },
              db
            )
          ) {
            return;
          }

          if (
            handleTalentPresenterAction(
              game,
              action,
              msg as Record<string, unknown>,
              {
                finishGame,
                buildLeaderboard,
                broadcastRoom,
                scheduleSave,
                sendWsError: (message: string) =>
                  ws.send(JSON.stringify({ type: 'error', message })),
              },
              db
            )
          ) {
            return;
          }

          if (
            handleAdventurePresenterAction(
              game,
              action,
              msg as Record<string, unknown>,
              {
                finishGame,
                buildLeaderboard,
                broadcastRoom,
                scheduleSave,
                sendWsError: (message: string) =>
                  ws.send(JSON.stringify({ type: 'error', message })),
              },
              db
            )
          ) {
            return;
          }

          if (
            handleAnnouncerPresenterAction(
              game,
              action,
              msg as Record<string, unknown>,
              {
                broadcastRoom,
                scheduleSave,
                sendWsError: (message: string) =>
                  ws.send(JSON.stringify({ type: 'error', message })),
              }
            )
          ) {
            return;
          }

          if (action === 'start_game') {
            if (game.config.mode === 'batalla_1v1') {
              const pList = Object.values(game.participants);
              if (pList.length < 2) {
                ws.send(
                  JSON.stringify({
                    type: 'error',
                    message:
                      'Se necesitan 2 participantes en la sala para iniciar la Batalla 1 contra 1.',
                  })
                );
                return;
              }
              if (pList.some((p) => p.ready === false)) {
                ws.send(
                  JSON.stringify({
                    type: 'error',
                    message:
                      'Ambos participantes deben marcarse como preparados antes de iniciar.',
                  })
                );
                return;
              }
            } else if (game.config.mode === 'competencia_equipos') {
              const pList = Object.values(game.participants);
              if (pList.length < 2) {
                ws.send(
                  JSON.stringify({
                    type: 'error',
                    message:
                      'Se necesitan al menos 2 participantes para iniciar la Competencia por Equipos.',
                  })
                );
                return;
              }
              const activeTeams = new Set(
                pList.map((p) => p.teamId).filter(Boolean)
              );
              if (activeTeams.size < 2) {
                ws.send(
                  JSON.stringify({
                    type: 'error',
                    message:
                      'Debe haber participantes en al menos 2 equipos distintos para iniciar.',
                  })
                );
                return;
              }
            }
            if (game.questions.length === 0) {
              game.questions = selectQuestionsForGame(game.config);
            }
            startQuestionAt(game, 0);
          } else if (action === 'pause_game') {
            if (
              game.status === 'question_active' ||
              game.status === 'question_locked' ||
              game.status === 'answer_revealed'
            ) {
              game.previousStatusBeforePause = game.status;
              if (game.status === 'question_active' && game.questionEndsAt) {
                game.pausedRemainingMs = Math.max(
                  1000,
                  game.questionEndsAt - Date.now()
                );
              }
              game.status = 'paused';
            }
          } else if (action === 'resume_game') {
            if (game.status === 'paused') {
              const prev = game.previousStatusBeforePause || 'question_active';
              game.status = prev;
              if (prev === 'question_active') {
                const rem =
                  game.pausedRemainingMs ?? game.config.timeLimitSec * 1000;
                game.questionEndsAt = Date.now() + rem;
                game.questionStartedAt =
                  game.questionEndsAt - game.config.timeLimitSec * 1000;
              }
              game.previousStatusBeforePause = undefined;
              game.pausedRemainingMs = undefined;
            }
          } else if (action === 'reveal_answer') {
            if (
              game.status === 'question_active' ||
              game.status === 'question_locked'
            ) {
              evaluateEliminationsForQuestion(game, game.currentQuestionIndex);
              game.status = 'answer_revealed';
            }
          } else if (action === 'next_question') {
            if (game.currentQuestionIndex >= 0) {
              evaluateEliminationsForQuestion(game, game.currentQuestionIndex);
            }
            const nextIdx = game.currentQuestionIndex + 1;
            if (nextIdx >= game.questions.length) {
              finishGame(game);
            } else {
              // Check if in Elimination mode everyone is eliminated or 1 left? Let presenter continue or end naturally
              startQuestionAt(game, nextIdx);
            }
          } else if (action === 'end_game') {
            finishGame(game);
          } else if (action === 'reset_game') {
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
            game.questions = selectQuestionsForGame(game.config);
            for (const p of Object.values(game.participants)) {
              p.score = 0;
              p.correctCount = 0;
              p.answeredCount = 0;
              p.streak = 0;
              p.mistakes = 0;
              p.eliminated = false;
              p.totalResponseMs = 0;
              if (game.config.mode === 'batalla_1v1') {
                p.ready = Boolean(p.isCreator);
              }
            }
            resetGameAnnouncerCeremony(game);
          } else if (action === 'assign_team') {
            if (game.status === 'waiting' && usesCustomTeams(game)) {
              const targetPid = String(msg.participantId || '');
              const targetTeamId = String(msg.teamId || '');
              const p = game.participants[targetPid];
              const teams = getConfiguredTeams(game);
              const capacity = game.config.teamCapacity || 50;
              const validTeam = teams.some((t) => t.id === targetTeamId);
              if (p && validTeam && p.teamId !== targetTeamId) {
                const targetMembers = Object.values(game.participants).filter(
                  (m) => m.teamId === targetTeamId
                ).length;
                if (targetMembers >= capacity) {
                  ws.send(
                    JSON.stringify({
                      type: 'error',
                      message:
                        'El equipo de destino ya alcanzó su capacidad máxima de participantes.',
                    })
                  );
                  return;
                }
                p.teamId = targetTeamId;
              }
            }
          } else if (action === 'rebalance_teams') {
            if (game.status === 'waiting' && usesCustomTeams(game)) {
              const teams = getConfiguredTeams(game);
              const pList = Object.values(game.participants).sort(
                (a, b) => a.joinedAt - b.joinedAt
              );
              if (teams.length >= 2) {
                pList.forEach((p, idx) => {
                  p.teamId = teams[idx % teams.length].id;
                });
              }
            }
          } else if (action === 'kick_participant') {
            const targetId = String(msg.participantId || '');
            const targetParticipant = game.participants[targetId];
            if (targetParticipant && !targetParticipant.isCreator) {
              deleteParticipantPhoto(targetParticipant);
              delete game.participants[targetId];
              for (const qAnswers of Object.values(game.answers)) {
                delete qAnswers[targetId];
              }
              const clients = roomSockets.get(code);
              if (clients) {
                for (const c of clients) {
                  if (c.participantId === targetId) {
                    c.ws.send(
                      JSON.stringify({
                        type: 'kicked',
                        message: 'El presentador te ha retirado de la partida.',
                      })
                    );
                    clients.delete(c);
                  }
                }
              }
            }
          }

          scheduleSave();
          broadcastRoom(code);
          return;
        }

        if (msg.type === 'participant_action') {
          const code = String(msg.code || '').trim().toUpperCase();
          const token = String(msg.token || '');
          const action = String(msg.action || '');
          const game = db.games[code];
          const meta = socketMetaMap.get(ws);

          if (!game || !meta || meta.code !== code || meta.role !== 'participant') {
            return;
          }

          const participant = Object.values(game.participants).find(
            (p) => p.token === token && p.id === meta.participantId
          );
          if (!participant) return;

          if (action === 'toggle_ready') {
            if (game.status !== 'waiting') return;
            participant.ready =
              typeof msg.ready === 'boolean' ? msg.ready : !participant.ready;
          } else if (action === 'select_team') {
            if (game.status !== 'waiting' || !usesCustomTeams(game)) {
              return;
            }
            const targetTeamId = String(msg.teamId || '');
            const teams = getConfiguredTeams(game);
            const capacity = game.config.teamCapacity || 50;
            if (!teams.some((t) => t.id === targetTeamId)) return;
            if (participant.teamId !== targetTeamId) {
              const count = Object.values(game.participants).filter(
                (m) => m.teamId === targetTeamId
              ).length;
              if (count >= capacity) {
                ws.send(
                  JSON.stringify({
                    type: 'error',
                    message:
                      'Ese equipo ya alcanzó el límite de participantes configurado.',
                  })
                );
                return;
              }
              participant.teamId = targetTeamId;
            }
          }

          scheduleSave();
          broadcastRoom(code);
          return;
        }

        if (msg.type === 'submit_mystery_guess') {
          const code = String(msg.code || '').trim().toUpperCase();
          const token = String(msg.token || '');
          const game = db.games[code];
          if (!game) return;
          const participant = Object.values(game.participants).find(
            (p) => p.token === token
          );
          if (!participant) return;
          handleExpansionSubmitMysteryGuess(
            game,
            participant,
            msg as Record<string, unknown>,
            {
              allQuestionsBank: () =>
                deduplicateQuestions([...BIBLE_QUESTION_BANK, ...db.customQuestions]),
              prepareQuestion: prepareQuestionInstance,
              selectQuestions: selectQuestionsForGame,
              startQuestionAt,
              finishGame,
              buildLeaderboard,
              broadcastRoom,
              scheduleSave,
              sendWsError: (message: string) =>
                ws.send(JSON.stringify({ type: 'error', message })),
            }
          );
          return;
        }

        if (msg.type === 'submit_reto_attempt') {
          const code = String(msg.code || '').trim().toUpperCase();
          const token = String(msg.token || '');
          const game = db.games[code];
          if (!game) return;
          const participant = Object.values(game.participants).find(
            (p) => p.token === token
          );
          if (!participant) return;
          handleExpansionSubmitRetoAttempt(
            game,
            participant,
            msg as Record<string, unknown>,
            {
              allQuestionsBank: () =>
                deduplicateQuestions([...BIBLE_QUESTION_BANK, ...db.customQuestions]),
              prepareQuestion: prepareQuestionInstance,
              selectQuestions: selectQuestionsForGame,
              startQuestionAt,
              finishGame,
              buildLeaderboard,
              broadcastRoom,
              scheduleSave,
              sendWsError: (message: string) =>
                ws.send(JSON.stringify({ type: 'error', message })),
            }
          );
          return;
        }

        if (msg.type === 'submit_saturday_challenge') {
          const code = String(msg.code || '').trim().toUpperCase();
          const token = String(msg.token || '');
          const game = db.games[code];
          if (!game) return;
          const participant = Object.values(game.participants).find(
            (p) => p.token === token
          );
          if (!participant) return;
          handleSaturdayChallengeSubmission(
            game,
            participant,
            msg as Record<string, unknown>,
            {
              startQuestionAt,
              finishGame,
              buildLeaderboard,
              broadcastRoom,
              scheduleSave,
              sendWsError: (message: string) =>
                ws.send(JSON.stringify({ type: 'error', message })),
            },
            db
          );
          return;
        }

        if (msg.type === 'submit_saturday_roulette') {
          const code = String(msg.code || '').trim().toUpperCase();
          const token = String(msg.token || '');
          const game = db.games[code];
          if (!game) return;
          const participant = Object.values(game.participants).find(
            (p) => p.token === token
          );
          if (!participant) return;
          handleSaturdayRouletteSubmission(
            game,
            participant,
            msg as Record<string, unknown>,
            {
              startQuestionAt,
              finishGame,
              buildLeaderboard,
              broadcastRoom,
              scheduleSave,
              sendWsError: (message: string) =>
                ws.send(JSON.stringify({ type: 'error', message })),
            },
            db
          );
          return;
        }

        if (msg.type === 'submit_talent_vote') {
          const code = String(msg.code || '').trim().toUpperCase();
          const token = String(msg.token || '');
          const game = db.games[code];
          if (!game) return;
          const participant = Object.values(game.participants).find(
            (p) => p.token === token
          );
          if (!participant) return;
          handleTalentAudienceVote(
            game,
            participant,
            msg as Record<string, unknown>,
            {
              finishGame,
              buildLeaderboard,
              broadcastRoom,
              scheduleSave,
              sendWsError: (message: string) =>
                ws.send(JSON.stringify({ type: 'error', message })),
            }
          );
          return;
        }

        if (msg.type === 'submit_adventure_choice') {
          const code = String(msg.code || '').trim().toUpperCase();
          const token = String(msg.token || '');
          const game = db.games[code];
          if (!game) return;
          const participant = Object.values(game.participants).find(
            (p) => p.token === token
          );
          if (!participant) return;
          handleAdventureSubmission(
            game,
            participant,
            msg as Record<string, unknown>,
            {
              finishGame,
              buildLeaderboard,
              broadcastRoom,
              scheduleSave,
              sendWsError: (message: string) =>
                ws.send(JSON.stringify({ type: 'error', message })),
            }
          );
          return;
        }

        if (msg.type === 'submit_answer') {
          const code = String(msg.code || '').trim().toUpperCase();
          const token = String(msg.token || '');
          const questionIndex = Number(msg.questionIndex);
          const selectedIndex = Number(msg.selectedIndex);
          const game = db.games[code];

          if (!game) return;
          const participant = Object.values(game.participants).find(
            (p) => p.token === token
          );
          if (!participant) return;

          if (participant.eliminated) {
            ws.send(
              JSON.stringify({
                type: 'error',
                message: 'Fuiste eliminado en una ronda anterior. Estás en modo espectador.',
              })
            );
            return;
          }

          if (
            game.status !== 'question_active' ||
            questionIndex !== game.currentQuestionIndex
          ) {
            ws.send(
              JSON.stringify({
                type: 'error',
                message: 'El tiempo para esta pregunta ha finalizado.',
              })
            );
            return;
          }

          const now = Date.now();
          if (game.questionEndsAt && now > game.questionEndsAt + 500) {
            ws.send(
              JSON.stringify({
                type: 'error',
                message: 'Tiempo agotado.',
              })
            );
            return;
          }

          if (!game.answers[questionIndex]) {
            game.answers[questionIndex] = {};
          }
          // Duplicate answer protection
          if (game.answers[questionIndex][participant.id]) {
            return;
          }

          const q = game.questions[questionIndex];
          if (!q || selectedIndex < 0 || selectedIndex >= q.options.length) {
            return;
          }

          const startedAt = game.questionStartedAt || now;
          const totalMs = Math.max(1000, game.config.timeLimitSec * 1000);
          const elapsedMs = Math.max(0, Math.min(totalMs, now - startedAt));

          const isCorrect = selectedIndex === q.correctIndex;
          let pointsEarned = 0;

          if (isCorrect) {
            const mult = q.isSpecialMultiplier || 1;
            const base = game.config.basePoints * mult;
            const speedBonusCap =
              game.config.mode === 'velocidad'
                ? Math.max(game.config.speedBonusMax, 1000)
                : game.config.speedBonusMax;
            const speedRatio = Math.max(0, Math.min(1, 1 - elapsedMs / totalMs));
            const speedBonus = Math.round(speedBonusCap * mult * speedRatio);
            pointsEarned = base + speedBonus;

            participant.score += pointsEarned;
            participant.correctCount += 1;
            participant.streak += 1;
          } else {
            participant.streak = 0;
          }

          participant.answeredCount += 1;
          participant.totalResponseMs += elapsedMs;

          game.answers[questionIndex][participant.id] = {
            participantId: participant.id,
            selectedIndex,
            isCorrect,
            pointsEarned,
            responseTimeMs: elapsedMs,
            submittedAt: now,
          };

          // Auto-lock if all online non-eliminated participants have answered
          const activeOnline = Object.values(game.participants).filter(
            (p) => p.online && !p.eliminated
          );
          const answeredCountForOnline = activeOnline.filter(
            (p) => Boolean(game.answers[questionIndex][p.id])
          ).length;

          if (activeOnline.length > 0 && answeredCountForOnline === activeOnline.length) {
            game.status = 'question_locked';
            game.questionLockReason = 'all_answered';
            evaluateEliminationsForQuestion(game, questionIndex);
          }

          scheduleSave();
          broadcastRoom(code);
        }
      } catch (err) {
        console.error('Error procesando mensaje WS:', err);
      }
    });

    ws.on('close', () => {
      cleanupControlCenterWs(ws);
      cleanupYouthSocietyWs(ws);
      const meta = socketMetaMap.get(ws);
      if (meta) {
        const set = roomSockets.get(meta.code);
        set?.delete(meta);
        if (meta.role === 'projector') {
          broadcastRoom(meta.code);
        } else if (meta.role === 'participant' && meta.participantId) {
          const game = db.games[meta.code];
          const p = game?.participants[meta.participantId];
          if (p) {
            // Check if participant has another open socket
            const stillConnected = Array.from(set || []).some(
              (c) => c.participantId === meta.participantId
            );
            if (!stillConnected) {
              p.online = false;
              scheduleSave();
              broadcastRoom(meta.code);
            }
          }
        }
      }
    });
  });

  // ---------------- REST API ROUTES ----------------
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: SERVER_SERVICE_ID,
      gamesCount: Object.keys(db.games).length,
    });
  });

  app.get('/api/questions', (req, res) => {
    const group = String(req.query.group || '');
    const category = String(req.query.category || '');
    const difficulty = String(req.query.difficulty || '');
    const search = String(req.query.search || '').trim().toLowerCase();

    const combined = [...db.customQuestions, ...BIBLE_QUESTION_BANK];
    const filtered = combined.filter((q) => {
      if (group && q.group !== group) return false;
      if (category && q.category !== category) return false;
      if (difficulty && q.difficulty !== difficulty) return false;
      if (
        search &&
        !q.prompt.toLowerCase().includes(search) &&
        !q.reference.toLowerCase().includes(search) &&
        !q.category.toLowerCase().includes(search)
      ) {
        return false;
      }
      return true;
    });

    res.json({ total: filtered.length, questions: filtered });
  });

  app.post('/api/questions', (req, res) => {
    const body = req.body || {};
    const prompt = String(body.prompt || '').trim();
    const category = String(body.category || '').trim();
    const group = body.group;
    const difficulty = body.difficulty as Difficulty;
    const options = Array.isArray(body.options)
      ? body.options.map((o: unknown) => String(o || '').trim()).filter(Boolean)
      : [];
    const correctIndex = Number(body.correctIndex);
    const reference = String(body.reference || '').trim();
    const explanation = String(body.explanation || '').trim();

    if (!prompt || !category || !group || options.length < 2 || !reference) {
      res.status(400).json({
        error: 'Completa el enunciado, categoría, opciones y referencia bíblica.',
      });
      return;
    }
    if (isNaN(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
      res.status(400).json({ error: 'Índice de respuesta correcta inválido.' });
      return;
    }

    const newQ: BibleQuestion = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      group,
      category,
      difficulty: difficulty || 'intermedio',
      prompt,
      options,
      correctIndex,
      reference,
      explanation: explanation || undefined,
      isCustom: true,
    };

    db.customQuestions.unshift(newQ);
    scheduleSave();
    res.status(201).json({ question: newQ });
  });

  app.delete('/api/questions/:id', (req, res) => {
    const id = req.params.id;
    const before = db.customQuestions.length;
    db.customQuestions = db.customQuestions.filter((q) => q.id !== id);
    if (db.customQuestions.length === before) {
      res.status(404).json({ error: 'Solo se pueden eliminar preguntas personalizadas.' });
      return;
    }
    scheduleSave();
    res.json({ deleted: true });
  });

  app.get('/api/games', (_req, res) => {
    const listings: PublicGameListing[] = Object.values(db.games)
      .filter((g) => g.status !== 'finished')
      .map((g) => ({
        code: g.code,
        title: g.config.title,
        mode: g.config.mode,
        status: g.status,
        participantCount: Object.keys(g.participants).length,
        maxParticipants: g.config.maxParticipants,
        questionCount: g.questions.length,
        currentQuestionIndex: g.currentQuestionIndex,
        createdAt: g.createdAt,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);

    res.json({ games: listings });
  });

  app.get('/api/history', (_req, res) => {
    // Also compute global top scores across history and active finished games
    res.json({ history: db.history });
  });

  app.post('/api/games', async (req, res) => {
    const body = req.body || {};
    const title = String(body.title || '').trim() || 'Concurso Bíblico en Vivo';
    const rawCode = String(body.code || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

    let code = rawCode.length >= 4 && rawCode.length <= 14 ? rawCode : generateGameCode();
    if (db.games[code] && db.games[code].status !== 'finished') {
      res.status(409).json({
        error: `El código "${code}" ya está activo en otra partida. Elige otro código o déjalo vacío para generar uno automático.`,
      });
      return;
    }

    // Preserve previous finished game under its permanent ID so old QR links remain bound to it
    if (db.games[code] && db.games[code].status === 'finished') {
      const oldGame = db.games[code];
      db.archivedGames[oldGame.id] = oldGame;
    }

    const requestedMode = body.mode || 'clasico';
    let teamCount: number | undefined;
    let teamCapacity: number | undefined;
    let teams: TeamConfigSlot[] | undefined;
    let maxParticipants = Math.max(
      2,
      Math.min(500, Number(body.maxParticipants) || 100)
    );

    const teamModeFlag =
      requestedMode !== 'batalla_1v1' &&
      requestedMode !== 'equipos' &&
      (requestedMode === 'competencia_equipos' || Boolean(body.teamMode));

    if (requestedMode === 'batalla_1v1') {
      maxParticipants = 2;
      if (body.creatorParticipant) {
        const cName = String(body.creatorParticipant.name || '').trim();
        if (cName.length < 2 || cName.length > 28) {
          res.status(400).json({
            error: 'Escribe tu nombre (entre 2 y 28 caracteres) para crear la batalla 1 contra 1.',
          });
          return;
        }
      }
    } else if (teamModeFlag) {
      teamCount = Math.max(2, Math.min(6, Number(body.teamCount) || 2));
      teamCapacity = Math.max(1, Math.min(50, Number(body.teamCapacity) || 5));
      const presets = COMPETITION_TEAM_PRESETS.slice(0, teamCount);
      const customNames: string[] = Array.isArray(body.teamNames)
        ? body.teamNames.map((n: unknown) => String(n || '').trim())
        : [];
      const customColors: string[] = Array.isArray(body.teamColors)
        ? body.teamColors.map((c: unknown) => String(c || '').trim())
        : [];
      teams = presets.map((preset, idx) => ({
        id: preset.id,
        name:
          customNames[idx] && customNames[idx].length >= 2
            ? customNames[idx].slice(0, 32)
            : preset.name,
        color:
          /^#[0-9A-Fa-f]{6}$/.test(customColors[idx] || '')
            ? customColors[idx]
            : preset.color,
        bgClass: preset.bgClass,
        borderClass: preset.borderClass,
        textClass: preset.textClass,
      }));
      maxParticipants = Math.min(500, teamCount * teamCapacity);
    }

    const config: GameConfig = {
      title,
      code,
      mode: requestedMode,
      categories: Array.isArray(body.categories) ? body.categories : [],
      difficulty: body.difficulty || 'combinado',
      questionCount: Math.max(1, Math.min(50, Number(body.questionCount) || 25)),
      timeLimitSec: Math.max(5, Math.min(240, Number(body.timeLimitSec) || 20)),
      maxParticipants,
      basePoints: Math.max(100, Math.min(5000, Number(body.basePoints) || 1000)),
      speedBonusMax: Math.max(0, Math.min(2000, Number(body.speedBonusMax ?? 500))),
      specialEveryN: Math.max(0, Math.min(20, Number(body.specialEveryN ?? 5))),
      eliminationLives: Math.max(1, Math.min(3, Number(body.eliminationLives ?? 1))),
      ...(teamCount !== undefined ? { teamCount } : {}),
      ...(teamCapacity !== undefined ? { teamCapacity } : {}),
      ...(teams !== undefined ? { teams } : {}),
      ...(body.teamMode === true && requestedMode !== 'competencia_equipos'
        ? { teamMode: true }
        : {}),
      ...(requestedMode === 'aprende_biblia'
        ? {
            explanationTiming:
              body.explanationTiming === 'end_of_round'
                ? 'end_of_round'
                : 'after_each',
            studyTopicId: String(body.studyTopicId || 'all'),
          }
        : {}),
    };

    const questions = selectQuestionsForGame(config);
    const presenterToken = randomToken();
    const gameId = `${code}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const inviteSignature = computeInviteSignature(gameId, code);

    const initialParticipants: Record<string, StoredParticipant> = {};
    let creatorParticipantId: string | undefined;
    let creatorParticipantToken: string | undefined;

    if (requestedMode === 'batalla_1v1' && body.creatorParticipant) {
      const cName = String(body.creatorParticipant.name || '').trim();
      const cAvatarId = String(body.creatorParticipant.avatarId || 'crown').trim();
      const pid = `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const pToken = randomToken();

      let photoMeta: {
        photoAccessKey: string;
        photoFile: string;
        photoUrl: string;
      } | null = null;
      if (
        typeof body.creatorParticipant.photoDataUrl === 'string' &&
        body.creatorParticipant.photoDataUrl.trim()
      ) {
        photoMeta = saveParticipantPhoto(
          gameId,
          pid,
          body.creatorParticipant.photoDataUrl
        );
        if (!photoMeta) {
          res.status(400).json({
            error:
              'La fotografía del creador no es válida o excede el tamaño permitido.',
          });
          return;
        }
      }

      initialParticipants[pid] = {
        id: pid,
        token: pToken,
        name: cName,
        avatarId: cAvatarId,
        photoUrl: photoMeta?.photoUrl,
        photoAccessKey: photoMeta?.photoAccessKey,
        photoFile: photoMeta?.photoFile,
        score: 0,
        correctCount: 0,
        answeredCount: 0,
        streak: 0,
        mistakes: 0,
        eliminated: false,
        online: true,
        totalResponseMs: 0,
        joinedAt: Date.now(),
        ready: true,
        isCreator: true,
        ...(typeof body.creatorParticipant.profileKey === 'string' &&
        body.creatorParticipant.profileKey.trim()
          ? { profileKey: body.creatorParticipant.profileKey.trim() }
          : {}),
      };
      creatorParticipantId = pid;
      creatorParticipantToken = pToken;
    }

    const newGame: StoredGame = {
      id: gameId,
      inviteSignature,
      code,
      presenterToken,
      config,
      status: 'waiting',
      questions,
      currentQuestionIndex: -1,
      roundNonce: 0,
      questionStartedAt: null,
      questionEndsAt: null,
      participants: initialParticipants,
      answers: {},
      evaluatedEliminations: [],
      createdAt: Date.now(),
      finishedAt: null,
    };

    initExpansionStateForGame(newGame, body as Record<string, unknown>);
    initSaturdayChallengeForGame(newGame, body as Record<string, unknown>, db);
    initSaturdayRouletteForGame(newGame, body as Record<string, unknown>);
    initTalentRoomForGame(newGame, body as Record<string, unknown>, db);
    initAdventureRoomForGame(newGame, body as Record<string, unknown>, db);
    ensureGameAnnouncerState(newGame);

    db.games[code] = newGame;
    scheduleSave();

    const pub = await resolvePublicOriginInfo(req);
    const inviteUrl = pub.origin
      ? `${pub.origin}/partida/${encodeURIComponent(gameId)}?s=${encodeURIComponent(inviteSignature)}`
      : null;

    res.status(201).json({
      gameId,
      code,
      presenterToken,
      inviteSignature,
      hasPublicUrl: Boolean(pub.origin),
      publicUrlReason: pub.reason,
      inviteUrl,
      questionCount: questions.length,
      ...(creatorParticipantId ? { participantId: creatorParticipantId } : {}),
      ...(creatorParticipantToken
        ? { participantToken: creatorParticipantToken }
        : {}),
    });
  });

  app.get('/api/public-url', async (req, res) => {
    const bypassCache = req.query.refresh === '1';
    const pub = await resolvePublicOriginInfo(req, bypassCache);
    res.json({
      hasPublicUrl: Boolean(pub.origin),
      publicOrigin: pub.origin,
      reason: pub.reason,
      detectedHost: pub.detectedHost,
    });
  });

  app.get('/api/games/:identifier/invite-info', async (req, res) => {
    const game = findGameByIdentifier(req.params.identifier);
    if (!game || !game.id || !game.inviteSignature) {
      res.status(404).json({ error: 'No existe ninguna partida válida con ese identificador.' });
      return;
    }
    const bypassCache = req.query.refresh === '1';
    const pub = await resolvePublicOriginInfo(req, bypassCache);
    const localInvitePath = `/partida/${encodeURIComponent(game.id)}?s=${encodeURIComponent(game.inviteSignature)}`;
    const inviteUrl = pub.origin ? `${pub.origin}${localInvitePath}` : null;
    const projectorUrl = pub.origin
      ? `${pub.origin}/?projector=${encodeURIComponent(game.code)}`
      : `/?projector=${encodeURIComponent(game.code)}`;

    res.json({
      gameId: game.id,
      code: game.code,
      title: game.config.title,
      status: game.status,
      signature: game.inviteSignature,
      hasPublicUrl: Boolean(pub.origin),
      publicOrigin: pub.origin,
      publicUrlReason: pub.reason,
      detectedHost: pub.detectedHost,
      inviteUrl,
      localInvitePath,
      projectorUrl,
    });
  });

  app.get('/api/invite/:identifier', (req, res) => {
    const identifier = String(req.params.identifier || '').trim().toUpperCase();
    const sig = String(req.query.s || '').trim();
    const game = findGameByIdentifier(identifier);

    if (!game) {
      res.status(404).json({
        error: 'La partida solicitada no existe o el código ya no es válido.',
      });
      return;
    }

    // Strict anti-tampering validation when accessed by permanent ID or with signature
    const accessedByPermanentId = identifier === game.id;
    if (accessedByPermanentId || sig) {
      if (!sig || !verifyInviteSignature(game, sig)) {
        res.status(403).json({
          error:
            'El enlace de invitación fue manipulado o no es válido. Escanea nuevamente el código QR del presentador.',
        });
        return;
      }
    }

    res.json({
      gameId: game.id,
      code: game.code,
      title: game.config.title,
      mode: game.config.mode,
      status: game.status,
      participantCount: Object.keys(game.participants).length,
      maxParticipants: game.config.maxParticipants,
      questionCount: game.questions.length,
      signature: game.inviteSignature,
      ...(game.config.teamMode ? { teamMode: true } : {}),
      teams: buildInviteTeamsSummary(game),
      teamCapacity: game.config.teamCapacity,
    });
  });

  app.get('/api/games/:code/exists', (req, res) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    if (!code) {
      res.status(400).json({ error: 'El código de la partida está vacío.' });
      return;
    }
    const game = db.games[code] || findGameByIdentifier(code);
    if (!game) {
      res.status(404).json({ error: 'No existe ninguna partida con ese código.' });
      return;
    }
    res.json({
      gameId: game.id,
      code: game.code,
      title: game.config.title,
      mode: game.config.mode,
      status: game.status,
      participantCount: Object.keys(game.participants).length,
      maxParticipants: game.config.maxParticipants,
      questionCount: game.questions.length,
      signature: game.inviteSignature,
      ...(game.config.teamMode ? { teamMode: true } : {}),
      teams: buildInviteTeamsSummary(game),
      teamCapacity: game.config.teamCapacity,
    });
  });

  app.post('/api/games/:identifier/join', (req, res) => {
    const identifier = String(req.params.identifier || '').trim().toUpperCase();
    const game = findGameByIdentifier(identifier);
    if (!game) {
      res.status(404).json({ error: 'No se encontró la partida solicitada.' });
      return;
    }

    // Verify invite integrity when joining via permanent ID or signature
    const reqGameId = String(req.body?.gameId || '').trim().toUpperCase();
    const reqSig = String(req.body?.signature || '').trim();
    if (identifier === game.id || reqGameId || reqSig) {
      if ((reqGameId && reqGameId !== game.id) || !reqSig || !verifyInviteSignature(game, reqSig)) {
        res.status(403).json({
          error: 'Enlace de invitación inválido o alterado.',
        });
        return;
      }
    }

    if (game.status === 'finished') {
      res.status(400).json({
        error: 'Este concurso ya ha finalizado y ya no acepta participantes.',
      });
      return;
    }

    const name = String(req.body?.name || '').trim();
    const avatarId = String(req.body?.avatarId || 'crown').trim();
    const requestedTeam = req.body?.teamId as TeamId | undefined;
    const reqProfileKey =
      typeof req.body?.profileKey === 'string' ? req.body.profileKey.trim() : '';
    const existingToken =
      typeof req.body?.existingToken === 'string' ? req.body.existingToken.trim() : '';

    if (name.length < 2 || name.length > 28) {
      res.status(400).json({
        error: 'Escribe un nombre válido de entre 2 y 28 caracteres.',
      });
      return;
    }

    const normalized = name.toLowerCase();

    // Prevent duplicate entries on reconnection: reuse existing participant if same token or same browser profile + same name
    const reconnectTarget =
      (existingToken
        ? Object.values(game.participants).find((p) => p.token === existingToken)
        : undefined) ||
      (reqProfileKey
        ? Object.values(game.participants).find(
            (p) =>
              p.profileKey === reqProfileKey &&
              p.name.trim().toLowerCase() === normalized
          )
        : undefined);

    if (reconnectTarget) {
      reconnectTarget.online = true;
      if (game.status === 'waiting' && avatarId) {
        reconnectTarget.avatarId = avatarId;
      }
      scheduleSave();
      broadcastRoom(game.code);
      res.status(200).json({
        participantId: reconnectTarget.id,
        participantToken: reconnectTarget.token,
        code: game.code,
        gameId: game.id,
        mode: game.config.mode,
        photoUrl: reconnectTarget.photoUrl,
        reconnected: true,
      });
      return;
    }

    const currentCount = Object.keys(game.participants).length;
    if (currentCount >= game.config.maxParticipants) {
      res.status(400).json({
        error:
          game.config.mode === 'batalla_1v1'
            ? 'Esta batalla 1 contra 1 ya tiene sus 2 participantes.'
            : 'La partida ha alcanzado el número máximo de participantes.',
      });
      return;
    }

    // Prevent duplicate names in same game
    const duplicate = Object.values(game.participants).some(
      (p) => p.name.trim().toLowerCase() === normalized
    );
    if (duplicate) {
      res.status(409).json({
        error: `El nombre "${name}" ya está ocupado en esta partida. Agrega tu apellido o un número (ej. "${name} 2").`,
      });
      return;
    }

    let teamId: TeamId | undefined;
    if (game.config.mode === 'equipos') {
      const validIds: TeamId[] = ['leones', 'aguilas', 'olivos', 'estrellas'];
      if (requestedTeam && validIds.includes(requestedTeam)) {
        teamId = requestedTeam;
      } else {
        // Auto-balance team with fewest players
        const counts: Record<string, number> = {
          leones: 0,
          aguilas: 0,
          olivos: 0,
          estrellas: 0,
        };
        for (const p of Object.values(game.participants)) {
          if (p.teamId && counts[p.teamId] !== undefined) {
            counts[p.teamId] += 1;
          }
        }
        teamId = validIds.sort((a, b) => counts[a] - counts[b])[0];
      }
    } else if (usesCustomTeams(game)) {
      const configuredTeams = getConfiguredTeams(game);
      const capacity = game.config.teamCapacity || 50;
      const counts: Record<string, number> = {};
      for (const t of configuredTeams) counts[t.id] = 0;
      for (const p of Object.values(game.participants)) {
        if (p.teamId && counts[p.teamId] !== undefined) {
          counts[p.teamId] += 1;
        }
      }

      if (requestedTeam && counts[requestedTeam] !== undefined) {
        if (counts[requestedTeam] >= capacity) {
          res.status(400).json({
            error:
              'El equipo seleccionado ya alcanzó su límite de participantes. Elige otro equipo disponible.',
          });
          return;
        }
        teamId = requestedTeam;
      } else {
        const available = configuredTeams
          .filter((t) => (counts[t.id] || 0) < capacity)
          .sort((a, b) => (counts[a.id] || 0) - (counts[b.id] || 0));
        if (available.length === 0) {
          res.status(400).json({
            error: 'Todos los equipos han alcanzado su límite de participantes.',
          });
          return;
        }
        teamId = available[0].id;
      }
    }

    const id = `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const token = randomToken();

    let photoMeta: {
      photoAccessKey: string;
      photoFile: string;
      photoUrl: string;
    } | null = null;
    if (typeof req.body?.photoDataUrl === 'string' && req.body.photoDataUrl.trim()) {
      photoMeta = saveParticipantPhoto(game.id, id, req.body.photoDataUrl);
      if (!photoMeta) {
        res.status(400).json({
          error:
            'La fotografía no es válida o excede el tamaño permitido. Intenta recortarla nuevamente.',
        });
        return;
      }
    }

    const participant: StoredParticipant = {
      id,
      token,
      name,
      avatarId,
      photoUrl: photoMeta?.photoUrl,
      photoAccessKey: photoMeta?.photoAccessKey,
      photoFile: photoMeta?.photoFile,
      teamId,
      score: 0,
      correctCount: 0,
      answeredCount: 0,
      streak: 0,
      mistakes: 0,
      eliminated: false,
      online: true,
      totalResponseMs: 0,
      joinedAt: Date.now(),
      ...(game.config.mode === 'batalla_1v1' ? { ready: false } : {}),
      ...(typeof req.body?.profileKey === 'string' && req.body.profileKey.trim()
        ? { profileKey: req.body.profileKey.trim() }
        : {}),
    };

    game.participants[id] = participant;
    scheduleSave();
    broadcastRoom(game.code);

    res.status(201).json({
      participantId: id,
      participantToken: token,
      code: game.code,
      gameId: game.id,
      mode: game.config.mode,
      photoUrl: participant.photoUrl,
    });
  });

  app.get('/api/games/:gameId/participants/:participantId/photo/:photoKey', (req, res) => {
    const reqGameId = String(req.params.gameId || '').trim().toUpperCase();
    const participantId = String(req.params.participantId || '').trim();
    const photoKey = String(req.params.photoKey || '').trim();

    const game = findGameByIdentifier(reqGameId);
    if (!game || game.id !== reqGameId) {
      res.status(404).end();
      return;
    }

    const participant = game.participants[participantId];
    if (!participant || !participant.photoAccessKey || !participant.photoFile) {
      res.status(404).end();
      return;
    }

    const expectedBuf = Buffer.from(participant.photoAccessKey, 'utf-8');
    const providedBuf = Buffer.from(photoKey, 'utf-8');
    if (
      expectedBuf.length !== providedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, providedBuf)
    ) {
      res.status(403).end();
      return;
    }

    const resolvedPath = path.resolve(PHOTOS_DIR, participant.photoFile);
    if (!resolvedPath.startsWith(PHOTOS_DIR + path.sep) || !fs.existsSync(resolvedPath)) {
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
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.sendFile(resolvedPath);
  });

  app.get('/api/games/:code/export', (req, res) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const game = db.games[code];
    if (!game) {
      res.status(404).json({ error: 'Partida no encontrada.' });
      return;
    }

    const format = String(req.query.format || 'csv').toLowerCase();
    const lb = buildLeaderboard(game);

    if (format === 'json') {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="resultados-${code}.json"`
      );
      res.json({
        code: game.code,
        title: game.config.title,
        mode: game.config.mode,
        finishedAt: game.finishedAt,
        leaderboard: lb,
        teamLeaderboard: buildTeamLeaderboard(game),
      });
      return;
    }

    const lines = [
      'Puesto,Participante,Equipo,Puntaje,Correctas,Respondidas,Precision %,Tiempo Promedio (ms)',
      ...lb.map((e) =>
        [
          e.rank,
          `"${e.name.replace(/"/g, '""')}"`,
          e.teamId || 'Individual',
          e.score,
          e.correctCount,
          e.answeredCount,
          `${e.accuracyPercent}%`,
          e.avgResponseMs,
        ].join(',')
      ),
    ];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="resultados-${code}.csv"`
    );
    res.send('\uFEFF' + lines.join('\n'));
  });

  registerExpansionRoutes(app, {
    getDb: () => db,
    allQuestionsBank: () =>
      deduplicateQuestions([...BIBLE_QUESTION_BANK, ...db.customQuestions]),
    resolvePublicOriginInfo,
    scheduleSave,
  });

  registerSaturdayProgramRoutes(app, {
    getDb: () => db,
    scheduleSave,
  });

  registerSaturdayChallengeRoutes(app, {
    getDb: () => db,
    scheduleSave,
  });

  registerSaturdayRouletteRoutes(app, {
    getDb: () => db,
    scheduleSave,
  });

  registerTalentRoutes(app, {
    getDb: () => db,
    scheduleSave,
  });

  registerAdventureRoutes(app, {
    getDb: () => db,
    scheduleSave,
  });

  registerWeeklyMissionsRoutes(app, {
    getDb: () => db,
    scheduleSave,
  });

  registerYouthChampionshipsRoutes(app, {
    getDb: () => db,
    scheduleSave,
  });

  registerSurpriseBoothRoutes(app, {
    getDb: () => db,
    scheduleSave,
  });

  registerMemoriesRoutes(app, {
    getDb: () => db,
    scheduleSave,
  });

  registerControlCenterRoutes(app, ccDeps);
  registerYouthSocietyRoutes(app, ccDeps);
  registerIaCreativaRoutes(app, {
    getDb: () => db,
    scheduleSave,
  });
  registerAnnouncerRoutes(app);

  // ---------------- VITE / STATIC SERVING ----------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT || 3000);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Dime Tú Qué Dices ejecutándose en http://0.0.0.0:${PORT}`);
  });
}

startServer();
