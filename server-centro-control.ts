import crypto from 'crypto';
import type express from 'express';
import { WebSocket } from 'ws';
import {
  formatTimerMMSS,
  mapKindToModuleId,
  type ControlCenterBlockKind,
  type ControlCenterLiveClientView,
  type ControlCenterLiveGameSnapshot,
  type ControlCenterLiveSession,
  type ControlCenterModuleId,
  type ControlCenterParticipantVisibility,
  type ControlCenterSeparatedResults,
  type ControlCenterTimelineBlock,
  type ControlCenterVarietyRecommendation,
} from './src/shared/controlCenterData.js';
import {
  getUpcomingSaturdayIso,
  type SaturdayProgram,
  type SaturdayProgramDuration,
} from './src/shared/saturdayProgramTypes.js';
import type { SaturdayChallengeHistoryEntry } from './src/shared/saturdayChallengesData.js';
import type { SaturdayRouletteHistoryEntry } from './src/shared/saturdayRouletteData.js';
import {
  getTalentCategoryMeta,
  type TalentShowcaseSession,
} from './src/shared/talentShowData.js';
import type { AdventureProgressRecord } from './src/shared/adventureStoriesData.js';
import type {
  MissionRegistration,
  WeeklyMission,
} from './src/shared/weeklyMissionsData.js';
import {
  computeSeasonStandings,
  type YouthChampionshipSeason,
} from './src/shared/youthChampionshipsData.js';
import {
  BUILTIN_SURPRISE_LIBRARY,
  getSurpriseCategoryMeta,
  SURPRISE_CATEGORIES,
  SURPRISE_OUTCOME_META,
  type SurpriseHistoryEntry,
  type SurpriseItem,
  type SurpriseResultOutcome,
} from './src/shared/surpriseBoothData.js';
import { drawSurpriseItem } from './server-cabina-sorpresas.js';
import type { StoredSaturdayMemoryRecord } from './server-memorias.js';
import {
  GAME_MODE_INFO,
  type GameHistorySummary,
  type GameMode,
} from './src/shared/types.js';

export interface ControlCenterDatabaseSlice {
  controlCenterSessions: Record<string, ControlCenterLiveSession>;
  activeControlSessionId: string | null;
}

export interface ControlCenterRoutesDeps {
  getDb: () => ControlCenterDatabaseSlice & {
    serverSecret?: string;
    weeklyDirectorSecret?: string;
    games?: Record<string, any>;
    archivedGames?: Record<string, any>;
    history?: GameHistorySummary[];
    saturdayPrograms?: Record<string, SaturdayProgram>;
    saturdayChallengeHistory?: SaturdayChallengeHistoryEntry[];
    saturdayRouletteHistory?: SaturdayRouletteHistoryEntry[];
    talentShowcase?: TalentShowcaseSession;
    adventureProgress?: AdventureProgressRecord[];
    weeklyCustomMissions?: WeeklyMission[];
    weeklyFeaturedMissionId?: string | null;
    weeklyMissionRegistrations?: MissionRegistration[];
    youthChampionshipSeasons?: YouthChampionshipSeason[];
    surpriseBoothCustomItems?: SurpriseItem[];
    surpriseBoothExcludedIds?: string[];
    surpriseBoothRecentIds?: string[];
    surpriseBoothHistory?: SurpriseHistoryEntry[];
    saturdayMemories?: StoredSaturdayMemoryRecord[];
  };
  scheduleSave: () => void;
  buildGameLeaderboard: (game: any) => Array<{
    participantId: string;
    name: string;
    avatarId: string;
    score: number;
    correctCount: number;
  }>;
  buildGameTeamLeaderboard: (game: any) => Array<{
    teamId: string;
    name: string;
    color: string;
    score: number;
    memberCount: number;
  }>;
}

interface ControlSocketClient {
  ws: WebSocket;
  sessionId: string;
  role: 'director' | 'projector' | 'participant';
  participantName?: string;
}

const ccSocketsBySession = new Map<string, Set<ControlSocketClient>>();
const ccSocketMetaMap = new Map<WebSocket, ControlSocketClient>();

export function ensureControlCenterSlice(
  raw: Partial<ControlCenterDatabaseSlice> | undefined
): ControlCenterDatabaseSlice {
  return {
    controlCenterSessions:
      raw?.controlCenterSessions && typeof raw.controlCenterSessions === 'object'
        ? raw.controlCenterSessions
        : {},
    activeControlSessionId:
      typeof raw?.activeControlSessionId === 'string' &&
      raw.activeControlSessionId.trim()
        ? raw.activeControlSessionId.trim()
        : null,
  };
}

function computeDirectorToken(serverSecret: string, pin: string): string {
  return crypto
    .createHmac('sha256', `${serverSecret}:control-center-director`)
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

function isAuthorizedDirector(
  req: express.Request,
  db: ReturnType<ControlCenterRoutesDeps['getDb']>
): boolean {
  const token = String(
    req.headers['x-control-director-token'] || req.query.dt || ''
  ).trim();
  if (!token) return false;
  const secret = db.serverSecret || 'dime-tu-control-secret';
  const pin = db.weeklyDirectorSecret || 'SJ2026';
  return timingSafeMatch(token, computeDirectorToken(secret, pin));
}

function sanitizeDuration(raw: unknown): SaturdayProgramDuration {
  const n = Number(raw);
  if (n === 60 || n === 90 || n === 120) return n;
  return 90;
}

const VALID_KINDS = new Set<ControlCenterBlockKind>([
  'actividad_programa',
  'juego_existente',
  'nuevo_juego',
  'retos_sabado',
  'ruleta_sabado',
  'talentos_juveniles',
  'aventuras_biblicas',
  'misiones_juveniles',
  'campeonato_juvenil',
  'cabina_sorpresas',
]);

function normalizeBlocks(raw: unknown): ControlCenterTimelineBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: ControlCenterTimelineBlock[] = [];
  raw.forEach((item: any, idx) => {
    if (!item || typeof item !== 'object') return;
    const rawKind = String(item.kind || 'actividad_programa') as ControlCenterBlockKind;
    const kind: ControlCenterBlockKind = VALID_KINDS.has(rawKind)
      ? rawKind
      : 'actividad_programa';
    const moduleId: ControlCenterModuleId =
      typeof item.moduleId === 'string' && item.moduleId.trim()
        ? (item.moduleId.trim() as ControlCenterModuleId)
        : mapKindToModuleId(kind);
    const title = String(item.title || '').trim().slice(0, 140);
    if (!title) return;
    out.push({
      id:
        typeof item.id === 'string' && item.id.trim()
          ? item.id.trim().slice(0, 48)
          : `CCB-${Date.now().toString(36)}-${idx + 1}`,
      order: idx + 1,
      kind,
      moduleId,
      moduleTag: String(item.moduleTag || moduleId).trim().slice(0, 60),
      title,
      instructions: String(item.instructions || '').trim().slice(0, 600),
      durationMin: Math.max(1, Math.min(180, Math.round(Number(item.durationMin) || 8))),
      ...(typeof item.linkedGameCode === 'string' && item.linkedGameCode.trim()
        ? { linkedGameCode: item.linkedGameCode.trim().toUpperCase().slice(0, 20) }
        : {}),
      ...(typeof item.linkedGameMode === 'string' && item.linkedGameMode.trim()
        ? { linkedGameMode: item.linkedGameMode.trim() as GameMode }
        : {}),
      ...(typeof item.linkedGameTitle === 'string' && item.linkedGameTitle.trim()
        ? { linkedGameTitle: item.linkedGameTitle.trim().slice(0, 120) }
        : {}),
      ...(typeof item.linkedInvitePath === 'string' && item.linkedInvitePath.trim()
        ? { linkedInvitePath: item.linkedInvitePath.trim().slice(0, 180) }
        : {}),
      ...(typeof item.linkedProgramActivityId === 'string' &&
      item.linkedProgramActivityId.trim()
        ? { linkedProgramActivityId: item.linkedProgramActivityId.trim().slice(0, 48) }
        : {}),
      ...(typeof item.linkedSeasonId === 'string' && item.linkedSeasonId.trim()
        ? { linkedSeasonId: item.linkedSeasonId.trim().slice(0, 64) }
        : {}),
      ...(typeof item.linkedMissionId === 'string' && item.linkedMissionId.trim()
        ? { linkedMissionId: item.linkedMissionId.trim().slice(0, 64) }
        : {}),
      scoreIsolationNote:
        String(item.scoreIsolationNote || '').trim().slice(0, 160) ||
        'Puntuación conservada en su modalidad original sin mezclar escalas',
      ...(typeof item.completedAt === 'number' ? { completedAt: item.completedAt } : {}),
    });
  });
  return out;
}

function computeRemainingSec(session: ControlCenterLiveSession, now = Date.now()): number {
  if (session.status === 'pausado' && typeof session.timerPausedRemainingSec === 'number') {
    return Math.max(0, Math.round(session.timerPausedRemainingSec));
  }
  if (session.timerRunning && typeof session.timerEndsAt === 'number') {
    return Math.max(0, Math.ceil((session.timerEndsAt - now) / 1000));
  }
  if (typeof session.timerPausedRemainingSec === 'number') {
    return Math.max(0, Math.round(session.timerPausedRemainingSec));
  }
  const block = session.blocks[session.currentBlockIndex];
  return block ? block.durationMin * 60 : 0;
}

function buildSeparatedResults(
  db: ReturnType<ControlCenterRoutesDeps['getDb']>,
  deps: ControlCenterRoutesDeps
): ControlCenterSeparatedResults {
  const gamesByMode: ControlCenterSeparatedResults['gamesByMode'] = [];

  for (const g of Object.values(db.games || {})) {
    const mode = g.config?.mode as GameMode;
    const lb = deps.buildGameLeaderboard(g);
    const tlb = deps.buildGameTeamLeaderboard(g);
    gamesByMode.push({
      mode,
      modeLabel: GAME_MODE_INFO[mode]?.name || mode,
      code: g.code,
      title: g.config?.title || g.code,
      status: g.status === 'finished' ? 'finalizada' : 'activa',
      participantCount: Object.keys(g.participants || {}).length,
      topEntries: lb.slice(0, 6).map((e) => ({ name: e.name, score: e.score })),
      teamEntries: tlb.slice(0, 6).map((t) => ({
        name: t.name,
        color: t.color,
        score: t.score,
      })),
    });
  }

  for (const h of (db.history || []).slice(0, 15)) {
    if (gamesByMode.some((x) => x.code === h.code)) continue;
    gamesByMode.push({
      mode: h.mode,
      modeLabel: GAME_MODE_INFO[h.mode]?.name || h.mode,
      code: h.code,
      title: h.title,
      status: 'finalizada',
      participantCount: h.participantCount,
      topEntries: (h.topThree || []).map((t) => ({ name: t.name, score: t.score })),
      teamEntries: h.winningTeamName
        ? [
            {
              name: h.winningTeamName,
              color: h.winningTeamColor || '#F59E0B',
              score: h.winnerScore,
            },
          ]
        : [],
    });
  }

  const challengesAndRoulette: ControlCenterSeparatedResults['challengesAndRoulette'] = [];
  for (const c of (db.saturdayChallengeHistory || []).slice(0, 15)) {
    challengesAndRoulette.push({
      id: c.id,
      module: 'Retos del Sábado',
      title: c.challengeTitle,
      participantOrWinner: c.winnerName || 'Participantes',
      outcome: c.resultSummary || 'Completado',
      points: c.winnerScore || 0,
      executedAt: c.executedAt,
    });
  }
  for (const r of (db.saturdayRouletteHistory || []).slice(0, 15)) {
    challengesAndRoulette.push({
      id: r.id,
      module: 'Ruleta de Actividades',
      title: r.activityTitle,
      participantOrWinner: r.participantName,
      outcome: r.grade,
      points: r.pointsAwarded,
      executedAt: r.executedAt,
    });
  }
  challengesAndRoulette.sort((a, b) => b.executedAt - a.executedAt);

  const surprises: ControlCenterSeparatedResults['surprises'] = (
    db.surpriseBoothHistory || []
  )
    .slice(0, 20)
    .map((s) => ({
      id: s.id,
      title: s.title,
      categoryId: s.categoryId,
      participantName: s.participantName,
      outcome: SURPRISE_OUTCOME_META[s.outcome]?.label || s.outcome,
      pointsAwarded: s.pointsAwarded,
      createdAt: s.createdAt,
    }));

  const championships: ControlCenterSeparatedResults['championships'] = (
    db.youthChampionshipSeasons || []
  ).map((s) => {
    const { teamStandings, participantStandings } = computeSeasonStandings(s);
    const list =
      teamStandings.length > 0
        ? teamStandings.map((t) => ({
            name: t.team.name,
            points: t.totalPoints,
            color: t.team.color,
          }))
        : participantStandings.map((p) => ({
            name: p.participant.name,
            points: p.totalPoints,
            color: p.teamColor,
          }));
    return {
      seasonId: s.id,
      seasonName: s.name,
      status: s.status === 'archivada' ? 'Finalizada' : 'Activa',
      standings: list.slice(0, 8),
    };
  });

  const talents: ControlCenterSeparatedResults['talents'] = [];
  const showcase = db.talentShowcase;
  if (showcase) {
    for (const entry of showcase.entries || []) {
      const cat = getTalentCategoryMeta(entry.categoryId);
      const votes = (showcase.appreciations || []).filter(
        (a) => a.entryId === entry.id
      ).length;
      talents.push({
        id: entry.id,
        performerName: entry.directorApprovedDisplay
          ? entry.participantName
          : entry.displayAlias,
        categoryLabel: cat.label,
        presentationTitle: entry.presentationTitle,
        positiveVotes: votes,
      });
    }
  }

  const missions: ControlCenterSeparatedResults['missions'] = (
    db.weeklyMissionRegistrations || []
  )
    .slice(0, 20)
    .map((mr) => ({
      id: mr.id,
      participantName: mr.participantName,
      missionTitle: mr.missionTitle,
      verified: mr.status === 'approved',
      dateLabel: new Date(mr.submittedAt || Date.now()).toISOString().slice(0, 10),
    }));

  return {
    gamesByMode,
    challengesAndRoulette: challengesAndRoulette.slice(0, 25),
    surprises,
    championships,
    talents,
    missions,
  };
}

function buildVarietyRecommendations(
  db: ReturnType<ControlCenterRoutesDeps['getDb']>
): ControlCenterVarietyRecommendation {
  const recentPrograms = Object.values(db.saturdayPrograms || {})
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 6);
  const recentControl = Object.values(db.controlCenterSessions || {})
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 6);

  const recentThemes = Array.from(
    new Set([
      ...recentPrograms.map((p) => p.centralTheme).filter(Boolean),
      ...recentControl.map((c) => c.theme).filter(Boolean),
    ])
  ).slice(0, 6);

  const recentActivityTitles = Array.from(
    new Set([
      ...recentPrograms.flatMap((p) => p.activities.map((a) => a.title)),
      ...recentControl.flatMap((c) => c.blocks.map((b) => b.title)),
      ...(db.saturdayChallengeHistory || []).slice(0, 6).map((c) => c.challengeTitle),
      ...(db.saturdayRouletteHistory || []).slice(0, 6).map((r) => r.activityTitle),
      ...(db.surpriseBoothHistory || []).slice(0, 6).map((s) => s.title),
    ])
  ).slice(0, 12);

  const lowerRecent = new Set(recentActivityTitles.map((t) => t.toLowerCase()));
  const recentSurpriseIds = new Set(db.surpriseBoothRecentIds || []);

  const pool: ControlCenterVarietyRecommendation['suggestedBlocks'] = [
    {
      id: 'rec-bienvenida',
      moduleId: 'programa_sabado',
      kind: 'actividad_programa',
      title: 'Bienvenida con Dinámica de Saludo Bíblico',
      instructions:
        'Cada joven saluda a dos personas nuevas compartiendo un versículo favorito de ánimo.',
      durationMin: 6,
      reason: 'Activa la integración inicial sin repetir dinámicas recientes.',
    },
    {
      id: 'rec-juego-misterio',
      moduleId: 'juegos_biblicos',
      kind: 'nuevo_juego',
      title: 'Juego en Vivo: ¿Quién Soy? Personajes Bíblicos',
      instructions:
        'Lanza una sala en vivo de ¿Quién Soy? para que los jóvenes descubran personajes por pistas.',
      durationMin: 12,
      reason: 'Modalidad deductiva ideal para variar después de trivias clásicas.',
    },
    {
      id: 'rec-retos-sabado',
      moduleId: 'retos_sabado',
      kind: 'retos_sabado',
      title: 'Reto Bíblico de Representación en Equipos',
      instructions:
        'Equipos representan una parábola o escena bíblica mientras la congregación identifica la cita.',
      durationMin: 10,
      reason: 'Fomenta creatividad y trabajo en equipo presencial.',
    },
    {
      id: 'rec-ruleta',
      moduleId: 'ruleta_sabado',
      kind: 'ruleta_sabado',
      title: 'Giro de Ruleta de Actividades Juveniles',
      instructions:
        'Gira la ruleta en pantalla para asignar alabanzas, desafíos relámpago o versículos sorpresa.',
      durationMin: 10,
      reason: 'Aporta ritmo ágil y participación espontánea.',
    },
    {
      id: 'rec-aventura',
      moduleId: 'aventuras_biblicas',
      kind: 'aventuras_biblicas',
      title: 'Aventura Bíblica Interactiva por Decisiones',
      instructions:
        'Recorre una historia bíblica escena por escena tomando decisiones en grupo desde los dispositivos.',
      durationMin: 14,
      reason: 'Conecta relato bíblico y aplicación espiritual práctica.',
    },
    {
      id: 'rec-talento',
      moduleId: 'talentos_juveniles',
      kind: 'talentos_juveniles',
      title: 'Espacio de Talentos Juveniles y Aprecio Positivo',
      instructions:
        'Presentación musical, poesía o narración bíblica con votos positivos constructivos.',
      durationMin: 12,
      reason: 'Involucra los dones artísticos y espirituales de los jóvenes.',
    },
    {
      id: 'rec-mision',
      moduleId: 'misiones_juveniles',
      kind: 'misiones_juveniles',
      title: 'Lanzamiento de la Misión de la Semana',
      instructions:
        'Presenta el reto semanal de servicio o evangelismo y anima al registro voluntario.',
      durationMin: 6,
      reason: 'Prolonga el impacto del sábado durante toda la semana.',
    },
  ];

  const freshSurprise =
    BUILTIN_SURPRISE_LIBRARY.find((s) => !recentSurpriseIds.has(s.id)) ||
    BUILTIN_SURPRISE_LIBRARY[0];
  if (freshSurprise) {
    pool.push({
      id: 'rec-sorpresa',
      moduleId: 'cabina_sorpresas',
      kind: 'cabina_sorpresas',
      title: `Cabina de Sorpresas (${getSurpriseCategoryMeta(freshSurprise.categoryId).label})`,
      instructions:
        'Activa la caja misteriosa en vivo para introducir un momento inesperado en el programa.',
      durationMin: 5,
      reason: 'Actividad sorpresa fresca no repetida en sesiones recientes.',
    });
  }

  const filtered = pool.filter(
    (item) => !lowerRecent.has(item.title.toLowerCase())
  );

  return {
    recentThemesToAvoid: recentThemes,
    recentActivitiesToAvoid: recentActivityTitles.slice(0, 8),
    suggestedBlocks: (filtered.length >= 4 ? filtered : pool).slice(0, 6),
  };
}

function buildLiveClientView(
  session: ControlCenterLiveSession,
  db: ReturnType<ControlCenterRoutesDeps['getDb']>,
  deps: ControlCenterRoutesDeps,
  participantNameFilter?: string
): ControlCenterLiveClientView {
  const now = Date.now();
  const safeIdx = Math.min(
    Math.max(0, session.currentBlockIndex),
    Math.max(0, session.blocks.length - 1)
  );
  const currentBlock = session.blocks[safeIdx] || null;
  const nextBlock = session.blocks[safeIdx + 1] || null;

  let linkedLiveGame: ControlCenterLiveGameSnapshot | null = null;
  if (currentBlock?.linkedGameCode) {
    const g =
      db.games?.[currentBlock.linkedGameCode] ||
      Object.values(db.archivedGames || {}).find(
        (ag: any) => ag.code === currentBlock.linkedGameCode
      );
    if (g) {
      const lb = deps.buildGameLeaderboard(g);
      const tlb = deps.buildGameTeamLeaderboard(g);
      linkedLiveGame = {
        code: g.code,
        gameId: g.id,
        title: g.config?.title || g.code,
        mode: g.config?.mode,
        status: g.status,
        participantCount: Object.keys(g.participants || {}).length,
        invitePath: `/partida/${encodeURIComponent(g.id)}?s=${encodeURIComponent(g.inviteSignature || '')}`,
        leaderboardTop: lb.slice(0, 8).map((e) => ({
          name: e.name,
          avatarId: e.avatarId,
          score: e.score,
          correctCount: e.correctCount,
        })),
        teamTop: tlb.slice(0, 6).map((t) => ({
          name: t.name,
          color: t.color,
          score: t.score,
          memberCount: t.memberCount,
        })),
      };
    }
  }

  const championshipStandings = session.participantVisibility.showStandings
    ? (db.youthChampionshipSeasons || [])
        .filter((s) =>
          session.linkedSeasonId
            ? s.id === session.linkedSeasonId
            : s.status === 'activa'
        )
        .slice(0, 2)
        .map((s) => {
          const { teamStandings, participantStandings } = computeSeasonStandings(s);
          const standings =
            teamStandings.length > 0
              ? teamStandings.slice(0, 6).map((t) => ({
                  name: t.team.name,
                  points: t.totalPoints,
                  color: t.team.color,
                }))
              : participantStandings.slice(0, 6).map((p) => ({
                  name: p.participant.name,
                  points: p.totalPoints,
                  color: p.teamColor,
                }));
          return { seasonName: s.name, standings };
        })
    : [];

  const recentSurpriseOutcomes = (db.surpriseBoothHistory || [])
    .slice(0, 5)
    .map((s) => ({
      id: s.id,
      title: s.title,
      categoryId: s.categoryId,
      participantName: s.participantName,
      outcome: SURPRISE_OUTCOME_META[s.outcome]?.label || s.outcome,
      pointsAwarded: s.pointsAwarded,
      createdAt: s.createdAt,
    }));

  let myResults: ControlCenterLiveClientView['myResults'] | undefined;
  const cleanSearch = (participantNameFilter || '').trim().toLowerCase();
  if (cleanSearch && session.participantVisibility.showOwnResults) {
    myResults = [];
    for (const g of Object.values(db.games || {})) {
      const lb = deps.buildGameLeaderboard(g);
      const found = lb.find((e) => e.name.toLowerCase().includes(cleanSearch));
      if (found) {
        const modeName = GAME_MODE_INFO[g.config?.mode as GameMode]?.name || g.config?.mode;
        myResults.push({
          moduleLabel: `Juego (${modeName})`,
          contextTitle: g.config?.title || g.code,
          detail: `${found.correctCount} aciertos`,
          scoreLabel: `${found.score} pts`,
        });
      }
    }
    for (const r of db.saturdayRouletteHistory || []) {
      if (r.participantName.toLowerCase().includes(cleanSearch)) {
        myResults.push({
          moduleLabel: 'Ruleta de Actividades',
          contextTitle: r.activityTitle,
          detail: r.grade,
          scoreLabel: `${r.pointsAwarded} pts`,
        });
      }
    }
    for (const mr of db.weeklyMissionRegistrations || []) {
      if (mr.participantName.toLowerCase().includes(cleanSearch)) {
        myResults.push({
          moduleLabel: 'Misiones Juveniles',
          contextTitle: mr.missionTitle,
          detail: mr.status === 'approved' ? 'Verificada' : 'En revisión',
          scoreLabel: `${mr.pointsAwarded} pts`,
        });
      }
    }
  }

  return {
    session,
    remainingSec: computeRemainingSec(session, now),
    serverNow: now,
    currentBlock,
    nextBlock,
    linkedLiveGame,
    championshipStandings,
    recentSurpriseOutcomes,
    ...(myResults ? { myResults: myResults.slice(0, 12) } : {}),
  };
}

export function broadcastControlSession(
  sessionId: string,
  db: ReturnType<ControlCenterRoutesDeps['getDb']>,
  deps: ControlCenterRoutesDeps
): void {
  const session = db.controlCenterSessions?.[sessionId];
  const clients = ccSocketsBySession.get(sessionId);
  if (!session || !clients) return;

  for (const client of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      const payload = buildLiveClientView(
        session,
        db,
        deps,
        client.participantName
      );
      client.ws.send(JSON.stringify({ type: 'cc_state', payload }));
    }
  }
}

export function handleControlCenterWsMessage(
  ws: WebSocket,
  msg: Record<string, unknown>,
  db: ReturnType<ControlCenterRoutesDeps['getDb']>,
  deps: ControlCenterRoutesDeps
): boolean {
  if (msg.type !== 'cc_subscribe') return false;

  const sessionId = String(msg.sessionId || '').trim();
  const session = db.controlCenterSessions?.[sessionId];
  if (!session) {
    ws.send(
      JSON.stringify({
        type: 'cc_error',
        message: 'No se encontró la sesión de Centro de Control solicitada.',
      })
    );
    return true;
  }

  const prev = ccSocketMetaMap.get(ws);
  if (prev) {
    ccSocketsBySession.get(prev.sessionId)?.delete(prev);
  }

  const rawRole = String(msg.role || 'projector');
  const role: ControlSocketClient['role'] =
    rawRole === 'director' || rawRole === 'participant' ? rawRole : 'projector';
  const participantName =
    typeof msg.participantName === 'string'
      ? msg.participantName.trim().slice(0, 60)
      : undefined;

  const meta: ControlSocketClient = { ws, sessionId, role, participantName };
  ccSocketMetaMap.set(ws, meta);
  if (!ccSocketsBySession.has(sessionId)) {
    ccSocketsBySession.set(sessionId, new Set());
  }
  ccSocketsBySession.get(sessionId)!.add(meta);

  const payload = buildLiveClientView(session, db, deps, participantName);
  ws.send(JSON.stringify({ type: 'cc_state', payload }));
  return true;
}

export function cleanupControlCenterWs(ws: WebSocket): void {
  const meta = ccSocketMetaMap.get(ws);
  if (!meta) return;
  ccSocketsBySession.get(meta.sessionId)?.delete(meta);
  ccSocketMetaMap.delete(ws);
}

export function tickControlCenterTimers(
  db: ReturnType<ControlCenterRoutesDeps['getDb']>,
  deps: ControlCenterRoutesDeps
): void {
  const now = Date.now();
  for (const session of Object.values(db.controlCenterSessions || {})) {
    if (
      session.status === 'en_curso' &&
      session.timerRunning &&
      typeof session.timerEndsAt === 'number' &&
      now >= session.timerEndsAt
    ) {
      session.timerRunning = false;
      session.timerEndsAt = null;
      session.timerPausedRemainingSec = 0;
      const curBlock = session.blocks[session.currentBlockIndex];
      if (curBlock && !curBlock.completedAt) {
        curBlock.completedAt = now;
      }
      session.soundCueNonce = (session.soundCueNonce || 0) + 1;
      session.lastSoundCue = {
        moduleId: curBlock?.moduleId || 'programa_sabado',
        action: 'warning',
        at: now,
      };
      session.updatedAt = now;
      deps.scheduleSave();
      broadcastControlSession(session.id, db, deps);
    }
  }
}

export function registerControlCenterRoutes(
  app: express.Express,
  deps: ControlCenterRoutesDeps
): void {
  const ensureDb = () => {
    const db = deps.getDb();
    if (!db.controlCenterSessions || typeof db.controlCenterSessions !== 'object') {
      db.controlCenterSessions = {};
    }
    if (db.activeControlSessionId === undefined) {
      db.activeControlSessionId = null;
    }
    return db;
  };

  // 1. Director authentication (reuses platform weeklyDirectorSecret, zero separate user table)
  app.post('/api/control-center/auth/login', (req, res) => {
    const db = ensureDb();
    const pin = String(req.body?.pin || '').trim();
    const expectedPin = db.weeklyDirectorSecret || 'SJ2026';
    if (!pin || !timingSafeMatch(pin, expectedPin)) {
      res.status(401).json({ error: 'Clave de director incorrecta.' });
      return;
    }
    const secret = db.serverSecret || 'dime-tu-control-secret';
    const token = computeDirectorToken(secret, expectedPin);
    res.json({ role: 'director', token });
  });

  // 2. Overview aggregating all 9 modules + variety + separated results
  app.get('/api/control-center/overview', (req, res) => {
    const db = ensureDb();
    const isDirector = isAuthorizedDirector(req, db);
    const sessions = Object.values(db.controlCenterSessions).sort(
      (a, b) => b.updatedAt - a.updatedAt
    );

    const activeSession =
      (db.activeControlSessionId &&
        db.controlCenterSessions[db.activeControlSessionId]) ||
      sessions[0] ||
      null;

    const savedPrograms = Object.values(db.saturdayPrograms || {})
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 25);

    const activeGames = Object.values(db.games || {})
      .filter((g: any) => g.status !== 'finished')
      .map((g: any) => ({
        code: g.code,
        gameId: g.id,
        title: g.config?.title || g.code,
        mode: g.config?.mode as GameMode,
        modeLabel: GAME_MODE_INFO[g.config?.mode as GameMode]?.name || g.config?.mode,
        status: g.status,
        participantCount: Object.keys(g.participants || {}).length,
        invitePath: `/partida/${encodeURIComponent(g.id)}?s=${encodeURIComponent(g.inviteSignature || '')}`,
      }));

    res.json({
      isDirector,
      activeSessionId: activeSession?.id || null,
      sessions,
      savedPrograms,
      activeGames,
      championshipSeasons: (db.youthChampionshipSeasons || []).map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
      })),
      weeklyMissions: [
        ...(db.weeklyCustomMissions || []),
      ].slice(0, 10),
      surpriseCategories: SURPRISE_CATEGORIES,
      varietyRecommendations: buildVarietyRecommendations(db),
      separatedResults: buildSeparatedResults(db, deps),
    });
  });

  // 3. Create new Control Center Saturday Session
  app.post('/api/control-center/sessions', (req, res) => {
    const db = ensureDb();
    if (!isAuthorizedDirector(req, db)) {
      res.status(403).json({
        error: 'Solo un director autorizado puede crear o iniciar programas.',
      });
      return;
    }

    const body = req.body || {};
    const now = Date.now();
    const id = `CC-${now.toString(36).toUpperCase()}-${crypto
      .randomBytes(2)
      .toString('hex')
      .toUpperCase()}`;

    let blocks = normalizeBlocks(body.blocks);
    let title = String(body.title || '').trim().slice(0, 140);
    let theme = String(body.theme || '').trim().slice(0, 140);
    let bibleText = String(body.bibleText || '').trim().slice(0, 120);
    let bibleVerseQuote = String(body.bibleVerseQuote || '').trim().slice(0, 400);
    let scheduledDate = String(body.scheduledDate || '').trim() || getUpcomingSaturdayIso();
    let directorName = String(body.directorName || '').trim().slice(0, 80) || 'Dirección Juvenil';
    let durationMinutes = sanitizeDuration(body.durationMinutes);
    const sourceProgramId =
      typeof body.sourceProgramId === 'string' && body.sourceProgramId.trim()
        ? body.sourceProgramId.trim()
        : undefined;

    if (sourceProgramId && db.saturdayPrograms?.[sourceProgramId]) {
      const prog = db.saturdayPrograms[sourceProgramId];
      title = title || prog.title;
      theme = theme || prog.centralTheme;
      bibleText = bibleText || prog.mainBibleText;
      bibleVerseQuote = bibleVerseQuote || prog.mainBibleVerseQuote || '';
      scheduledDate = prog.scheduledDate || scheduledDate;
      directorName = prog.directorName || directorName;
      durationMinutes = prog.durationMinutes;
      if (blocks.length === 0) {
        blocks = prog.activities.map((a, idx) => ({
          id: `CCB-${now.toString(36)}-${idx + 1}`,
          order: idx + 1,
          kind: a.category === 'juego' ? 'nuevo_juego' : 'actividad_programa',
          moduleId: a.category === 'juego' ? 'juegos_biblicos' : 'programa_sabado',
          moduleTag: a.categoryLabel,
          title: a.title,
          instructions: a.description,
          durationMin: a.durationMin,
          linkedProgramActivityId: a.id,
          scoreIsolationNote:
            a.category === 'juego'
              ? 'Puntuación propia de partida en vivo'
              : 'Bloque de agenda sin mezcla de puntos',
        }));
      }
    }

    if (!title) title = `Programa de Sábado · ${scheduledDate}`;
    if (!theme) theme = 'Encuentro Juvenil en Cristo';
    if (!bibleText) bibleText = '1 Timoteo 4:12';

    const session: ControlCenterLiveSession = {
      id,
      title,
      theme,
      bibleText,
      ...(bibleVerseQuote ? { bibleVerseQuote } : {}),
      scheduledDate,
      durationMinutes,
      directorName,
      ...(sourceProgramId ? { sourceProgramId } : {}),
      ...(typeof body.linkedSeasonId === 'string' && body.linkedSeasonId.trim()
        ? { linkedSeasonId: body.linkedSeasonId.trim() }
        : {}),
      status: 'preparacion',
      blocks,
      currentBlockIndex: 0,
      timerRunning: false,
      timerEndsAt: null,
      timerPausedRemainingSec: blocks[0] ? blocks[0].durationMin * 60 : 0,
      activeSurprise: null,
      soundCueNonce: 0,
      participantVisibility: {
        showSchedule: body.participantVisibility?.showSchedule !== false,
        showOwnResults: body.participantVisibility?.showOwnResults !== false,
        showStandings: body.participantVisibility?.showStandings !== false,
      },
      createdAt: now,
      updatedAt: now,
    };

    db.controlCenterSessions[id] = session;
    db.activeControlSessionId = id;
    deps.scheduleSave();
    res.status(201).json({ session });
  });

  // 4. Update session metadata, blocks, order, durations, permissions
  app.put('/api/control-center/sessions/:id', (req, res) => {
    const db = ensureDb();
    if (!isAuthorizedDirector(req, db)) {
      res.status(403).json({ error: 'Solo los directores autorizados pueden editar.' });
      return;
    }

    const id = String(req.params.id || '').trim();
    const session = db.controlCenterSessions[id];
    if (!session) {
      res.status(404).json({ error: 'Sesión no encontrada.' });
      return;
    }

    const body = req.body || {};
    if (typeof body.title === 'string' && body.title.trim()) {
      session.title = body.title.trim().slice(0, 140);
    }
    if (typeof body.theme === 'string' && body.theme.trim()) {
      session.theme = body.theme.trim().slice(0, 140);
    }
    if (typeof body.bibleText === 'string' && body.bibleText.trim()) {
      session.bibleText = body.bibleText.trim().slice(0, 120);
    }
    if (typeof body.bibleVerseQuote === 'string') {
      session.bibleVerseQuote = body.bibleVerseQuote.trim().slice(0, 400) || undefined;
    }
    if (typeof body.scheduledDate === 'string' && body.scheduledDate.trim()) {
      session.scheduledDate = body.scheduledDate.trim().slice(0, 20);
    }
    if (typeof body.directorName === 'string' && body.directorName.trim()) {
      session.directorName = body.directorName.trim().slice(0, 80);
    }
    if (body.durationMinutes !== undefined) {
      session.durationMinutes = sanitizeDuration(body.durationMinutes);
    }
    if (body.linkedSeasonId !== undefined) {
      session.linkedSeasonId =
        typeof body.linkedSeasonId === 'string' && body.linkedSeasonId.trim()
          ? body.linkedSeasonId.trim()
          : undefined;
    }
    if (body.blocks !== undefined) {
      session.blocks = normalizeBlocks(body.blocks);
      if (session.currentBlockIndex >= session.blocks.length) {
        session.currentBlockIndex = Math.max(0, session.blocks.length - 1);
      }
      if (!session.timerRunning && session.blocks[session.currentBlockIndex]) {
        if (session.status === 'preparacion') {
          session.timerPausedRemainingSec =
            session.blocks[session.currentBlockIndex].durationMin * 60;
        }
      }
    }
    if (body.participantVisibility && typeof body.participantVisibility === 'object') {
      const pv = body.participantVisibility as Partial<ControlCenterParticipantVisibility>;
      session.participantVisibility = {
        showSchedule:
          typeof pv.showSchedule === 'boolean'
            ? pv.showSchedule
            : session.participantVisibility.showSchedule,
        showOwnResults:
          typeof pv.showOwnResults === 'boolean'
            ? pv.showOwnResults
            : session.participantVisibility.showOwnResults,
        showStandings:
          typeof pv.showStandings === 'boolean'
            ? pv.showStandings
            : session.participantVisibility.showStandings,
      };
    }

    db.activeControlSessionId = id;
    session.updatedAt = Date.now();
    deps.scheduleSave();
    broadcastControlSession(id, db, deps);
    res.json({ session });
  });

  // 5. Director live playback controls (start, pause, resume, next, prev, jump, reset_timer, adjust_timer, finish_and_save)
  app.post('/api/control-center/sessions/:id/control', (req, res) => {
    const db = ensureDb();
    if (!isAuthorizedDirector(req, db)) {
      res.status(403).json({
        error: 'Solo un director autorizado puede controlar la ejecución del programa.',
      });
      return;
    }

    const id = String(req.params.id || '').trim();
    const session = db.controlCenterSessions[id];
    if (!session) {
      res.status(404).json({ error: 'Sesión no encontrada.' });
      return;
    }

    const action = String(req.body?.action || '').trim();
    const now = Date.now();
    db.activeControlSessionId = id;

    const loadBlockAt = (idx: number, keepRunning: boolean) => {
      if (session.blocks.length === 0) return;
      const clamped = Math.min(Math.max(0, idx), session.blocks.length - 1);
      session.currentBlockIndex = clamped;
      const sec = session.blocks[clamped].durationMin * 60;
      if (keepRunning) {
        session.status = 'en_curso';
        session.timerRunning = true;
        session.timerEndsAt = now + sec * 1000;
        session.timerPausedRemainingSec = null;
      } else {
        session.timerRunning = false;
        session.timerEndsAt = null;
        session.timerPausedRemainingSec = sec;
      }
      session.soundCueNonce = (session.soundCueNonce || 0) + 1;
      session.lastSoundCue = {
        moduleId: session.blocks[clamped].moduleId,
        action: 'next',
        at: now,
      };
    };

    if (action === 'start') {
      const curSec =
        typeof session.timerPausedRemainingSec === 'number' &&
        session.timerPausedRemainingSec > 0
          ? session.timerPausedRemainingSec
          : (session.blocks[session.currentBlockIndex]?.durationMin || 5) * 60;
      session.status = 'en_curso';
      session.timerRunning = true;
      session.timerEndsAt = now + curSec * 1000;
      session.timerPausedRemainingSec = null;
      session.soundCueNonce = (session.soundCueNonce || 0) + 1;
      session.lastSoundCue = {
        moduleId:
          session.blocks[session.currentBlockIndex]?.moduleId || 'programa_sabado',
        action: 'start',
        at: now,
      };
    } else if (action === 'pause') {
      const rem = computeRemainingSec(session, now);
      session.status = 'pausado';
      session.timerRunning = false;
      session.timerEndsAt = null;
      session.timerPausedRemainingSec = rem;
      session.soundCueNonce = (session.soundCueNonce || 0) + 1;
      session.lastSoundCue = {
        moduleId:
          session.blocks[session.currentBlockIndex]?.moduleId || 'programa_sabado',
        action: 'pause',
        at: now,
      };
    } else if (action === 'resume') {
      const rem = computeRemainingSec(session, now) || 60;
      session.status = 'en_curso';
      session.timerRunning = true;
      session.timerEndsAt = now + rem * 1000;
      session.timerPausedRemainingSec = null;
      session.soundCueNonce = (session.soundCueNonce || 0) + 1;
      session.lastSoundCue = {
        moduleId:
          session.blocks[session.currentBlockIndex]?.moduleId || 'programa_sabado',
        action: 'start',
        at: now,
      };
    } else if (action === 'next') {
      const cur = session.blocks[session.currentBlockIndex];
      if (cur && !cur.completedAt) cur.completedAt = now;
      loadBlockAt(session.currentBlockIndex + 1, session.status === 'en_curso');
    } else if (action === 'prev') {
      loadBlockAt(session.currentBlockIndex - 1, session.status === 'en_curso');
    } else if (action === 'jump') {
      const idx = Number(req.body?.index ?? 0);
      loadBlockAt(idx, session.status === 'en_curso');
    } else if (action === 'reset_timer') {
      const cur = session.blocks[session.currentBlockIndex];
      const sec = (cur?.durationMin || 5) * 60;
      if (session.status === 'en_curso' && session.timerRunning) {
        session.timerEndsAt = now + sec * 1000;
        session.timerPausedRemainingSec = null;
      } else {
        session.timerEndsAt = null;
        session.timerPausedRemainingSec = sec;
      }
    } else if (action === 'adjust_timer') {
      const deltaSec = Number(req.body?.deltaSec || 0);
      const nextRem = Math.max(0, computeRemainingSec(session, now) + deltaSec);
      if (session.status === 'en_curso' && session.timerRunning) {
        session.timerEndsAt = now + nextRem * 1000;
      } else {
        session.timerPausedRemainingSec = nextRem;
      }
    } else if (action === 'finish_and_save') {
      session.status = 'finalizado';
      session.timerRunning = false;
      session.timerEndsAt = null;
      session.timerPausedRemainingSec = 0;
      session.finishedAt = now;
      session.soundCueNonce = (session.soundCueNonce || 0) + 1;
      session.lastSoundCue = {
        moduleId: 'nuestras_memorias',
        action: 'finish',
        at: now,
      };

      // Save an independent SaturdayProgram snapshot if requested or not yet saved
      if (!db.saturdayPrograms) db.saturdayPrograms = {};
      const progId =
        session.savedProgramId ||
        `PRG-${now.toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      const savedProg: SaturdayProgram = {
        id: progId,
        title: session.title,
        centralTheme: session.theme,
        mainBibleText: session.bibleText,
        ...(session.bibleVerseQuote
          ? { mainBibleVerseQuote: session.bibleVerseQuote }
          : {}),
        spiritualObjective: `Programa dirigido desde el Centro de Control el ${session.scheduledDate}.`,
        scheduledDate: session.scheduledDate,
        durationMinutes: session.durationMinutes,
        status: 'final',
        directorName: session.directorName,
        directorNotes: 'Guardado y finalizado desde el Centro de Control del Sábado.',
        activities: session.blocks.map((b, idx) => ({
          id: b.linkedProgramActivityId || `ACT-${now.toString(36)}-${idx + 1}`,
          category: b.moduleId === 'juegos_biblicos' ? 'juego' : 'personalizada',
          categoryLabel: b.moduleTag,
          title: b.title,
          description: b.instructions || b.title,
          durationMin: b.durationMin,
        })),
        createdAt: session.createdAt,
        updatedAt: now,
        finalizedAt: now,
      };
      db.saturdayPrograms[progId] = savedProg;
      session.savedProgramId = progId;

      // Also archive an independent SaturdayMemoryRecord if requested (default true)
      if (req.body?.alsoArchiveMemory !== false) {
        if (!Array.isArray(db.saturdayMemories)) db.saturdayMemories = [];
        const memId =
          session.savedMemoryId ||
          `MEM-${session.scheduledDate.replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const separated = buildSeparatedResults(db, deps);
        const linkedCodes = new Set(
          session.blocks.map((b) => b.linkedGameCode).filter(Boolean)
        );
        const memoryGames = separated.gamesByMode
          .filter((g) => linkedCodes.has(g.code))
          .map((g, idx) => ({
            id: `gam-${idx + 1}`,
            title: g.title,
            modeLabel: g.modeLabel,
            participantsCount: g.participantCount,
            ...(g.topEntries[0]
              ? {
                  winnerOrHighlight: `${g.topEntries[0].name} (${g.topEntries[0].score} pts)`,
                }
              : {}),
          }));

        const memoryRecord: StoredSaturdayMemoryRecord = {
          id: memId,
          date: session.scheduledDate,
          title: session.title,
          theme: session.theme,
          bibleText: session.bibleText,
          ...(session.bibleVerseQuote
            ? { bibleVerseQuote: session.bibleVerseQuote }
            : {}),
          directorName: session.directorName,
          participantNames: [],
          activities: session.blocks
            .filter(
              (b) =>
                b.kind !== 'juego_existente' &&
                b.kind !== 'nuevo_juego'
            )
            .map((b, idx) => ({
              id: `act-${idx + 1}`,
              title: b.title,
              categoryLabel: b.moduleTag,
              durationMin: b.durationMin,
              notes: b.instructions,
            })),
          gamesPlayed: memoryGames,
          challengesCompleted: session.blocks
            .filter(
              (b) =>
                b.kind === 'retos_sabado' ||
                b.kind === 'ruleta_sabado' ||
                b.kind === 'cabina_sorpresas'
            )
            .map((b, idx) => ({
              id: `chl-${idx + 1}`,
              title: b.title,
              categoryLabel: b.moduleTag,
              outcome: b.completedAt ? 'Realizado en vivo' : 'Programado',
            })),
          teams: [],
          resultsSummary:
            String(req.body?.resultsSummary || '').trim() ||
            `Programa dirigido desde el Centro de Control del Sábado con ${session.blocks.length} bloques integrados.`,
          rankings: [],
          recognitions: [],
          photos: [],
          dailyReflection:
            String(req.body?.dailyReflection || '').trim() ||
            `Tema central: ${session.theme} (${session.bibleText}).`,
          observations:
            String(req.body?.observations || '').trim() ||
            'Puntuaciones de cada modalidad conservadas por separado.',
          visibility: 'authorized_public',
          hideParticipantNames: false,
          hidePhotos: false,
          sharingEnabled: false,
          sourceProgramId: progId,
          isArchived: false,
          createdAt: now,
          updatedAt: now,
          createdByRole: 'admin',
          revisionCount: 1,
          snapshots: [],
        };

        const existingMemIdx = db.saturdayMemories.findIndex(
          (m) => m.id === memId
        );
        if (existingMemIdx >= 0) {
          db.saturdayMemories[existingMemIdx] = memoryRecord;
        } else {
          db.saturdayMemories.unshift(memoryRecord);
        }
        session.savedMemoryId = memId;
      }
    } else {
      res.status(400).json({ error: 'Acción de control no reconocida.' });
      return;
    }

    session.updatedAt = now;
    deps.scheduleSave();
    broadcastControlSession(id, db, deps);
    res.json({
      session,
      remainingSec: computeRemainingSec(session, now),
    });
  });

  // 6. Trigger / record / dismiss Cabina de Sorpresas synced across Control Center & Projection
  app.post('/api/control-center/sessions/:id/surprise', (req, res) => {
    const db = ensureDb();
    if (!isAuthorizedDirector(req, db)) {
      res.status(403).json({
        error: 'Solo un director autorizado puede activar sorpresas en el programa.',
      });
      return;
    }

    const id = String(req.params.id || '').trim();
    const session = db.controlCenterSessions[id];
    if (!session) {
      res.status(404).json({ error: 'Sesión no encontrada.' });
      return;
    }

    const action = String(req.body?.action || 'draw');
    const now = Date.now();

    if (action === 'dismiss') {
      session.activeSurprise = null;
      session.updatedAt = now;
      deps.scheduleSave();
      broadcastControlSession(id, db, deps);
      res.json({ session });
      return;
    }

    if (action === 'record_outcome' && session.activeSurprise) {
      const outcomeRaw = String(req.body?.outcome || 'cumplido') as SurpriseResultOutcome;
      const outcome: SurpriseResultOutcome = SURPRISE_OUTCOME_META[outcomeRaw]
        ? outcomeRaw
        : 'cumplido';
      const participantName =
        String(req.body?.participantName || '').trim().slice(0, 60) ||
        'Sociedad de Jóvenes';
      const pointsAwarded =
        typeof req.body?.pointsAwarded === 'number'
          ? Math.max(0, Math.round(req.body.pointsAwarded))
          : SURPRISE_OUTCOME_META[outcome].defaultPoints;

      session.activeSurprise = {
        ...session.activeSurprise,
        outcome,
        participantName,
        pointsAwarded,
      };

      if (!Array.isArray(db.surpriseBoothHistory)) db.surpriseBoothHistory = [];
      db.surpriseBoothHistory.unshift({
        id: `SUR-${now.toString(36).toUpperCase()}`,
        surpriseId: session.activeSurprise.surpriseId,
        categoryId: session.activeSurprise.categoryId,
        title: session.activeSurprise.title,
        participantName,
        outcome,
        pointsAwarded,
        durationUsedSec: session.activeSurprise.durationSec,
        programId: session.savedProgramId || session.sourceProgramId,
        programTitle: session.title,
        createdAt: now,
      });
      db.surpriseBoothHistory = db.surpriseBoothHistory.slice(0, 100);

      session.updatedAt = now;
      deps.scheduleSave();
      broadcastControlSession(id, db, deps);
      res.json({ session });
      return;
    }

    // Draw surprise via existing Cabina de Sorpresas variety engine
    const surpriseSlice = {
      surpriseBoothCustomItems: db.surpriseBoothCustomItems || [],
      surpriseBoothExcludedIds: db.surpriseBoothExcludedIds || [],
      surpriseBoothRecentIds: db.surpriseBoothRecentIds || [],
      surpriseBoothHistory: db.surpriseBoothHistory || [],
    };
    const draw = drawSurpriseItem(surpriseSlice, {
      enabledCategories: Array.isArray(req.body?.enabledCategories)
        ? req.body.enabledCategories
        : SURPRISE_CATEGORIES.map((c) => c.id),
      allowRepeatRecent: req.body?.avoidRecent === false,
      recordRecent: true,
    });

    if (!draw) {
      res.status(400).json({ error: 'No hay sorpresas disponibles con los filtros actuales.' });
      return;
    }

    db.surpriseBoothRecentIds = surpriseSlice.surpriseBoothRecentIds;
    const picked = draw.surprise;

    const catMeta = getSurpriseCategoryMeta(picked.categoryId);
    const durationSec = Math.max(
      10,
      Math.min(300, Math.round(Number(req.body?.durationSec) || picked.suggestedSec || 45))
    );

    session.activeSurprise = {
      surpriseId: picked.id,
      categoryId: picked.categoryId,
      categoryLabel: catMeta.label,
      categoryColor: catMeta.color,
      title: picked.title,
      instructions: picked.instructions,
      reference: picked.reference,
      durationSec,
      triggeredAt: now,
    };
    session.soundCueNonce = (session.soundCueNonce || 0) + 1;
    session.lastSoundCue = {
      moduleId: 'cabina_sorpresas',
      action: 'surprise',
      at: now,
    };
    session.updatedAt = now;
    deps.scheduleSave();
    broadcastControlSession(id, db, deps);

    res.json({
      session,
      recycledPool: draw.recycledPool,
      remainingFreshCount: draw.remainingFreshCount,
      formattedDuration: formatTimerMMSS(durationSec),
    });
  });

  // 7. Public / Projector / Participant live state endpoint
  app.get('/api/control-center/live/:id', (req, res) => {
    const db = ensureDb();
    const id = String(req.params.id || '').trim();
    const session = db.controlCenterSessions[id];
    if (!session) {
      res.status(404).json({ error: 'Sesión de programa en vivo no encontrada.' });
      return;
    }
    const participantName = String(req.query.participantName || '').trim();
    res.json(buildLiveClientView(session, db, deps, participantName));
  });
}
