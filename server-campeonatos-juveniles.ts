import crypto from 'crypto';
import type express from 'express';
import type { MissionRegistration } from './src/shared/weeklyMissionsData.js';
import {
  buildSaturdayDates,
  COMPETITION_TYPE_LABELS,
  computeSeasonStandings,
  POINT_CATEGORY_META,
  type ChampionshipAuditLog,
  type ChampionshipParticipant,
  type ChampionshipPointCategory,
  type ChampionshipScoreEntry,
  type ChampionshipTeam,
  type ChampionshipTeamEmblem,
  type PlayoffMatchSlot,
  type YouthChampionshipSeason,
  type YouthCompetitionType,
} from './src/shared/youthChampionshipsData.js';

export interface YouthChampionshipsDatabaseSlice {
  youthChampionshipSeasons: YouthChampionshipSeason[];
}

export interface YouthChampionshipsRoutesDeps {
  getDb: () => YouthChampionshipsDatabaseSlice & {
    serverSecret?: string;
    weeklyDirectorSecret?: string;
    games?: Record<string, any>;
    archivedGames?: Record<string, any>;
    weeklyMissionRegistrations?: MissionRegistration[];
  };
  scheduleSave: () => void;
}

const VALID_COMPETITION_TYPES = new Set<YouthCompetitionType>([
  'individual',
  'equipos',
  'grupos_juveniles',
  'iglesias',
]);

const VALID_CATEGORIES = new Set<ChampionshipPointCategory>(
  POINT_CATEGORY_META.map((c) => c.id)
);

const VALID_EMBLEMS = new Set<ChampionshipTeamEmblem>([
  'leon',
  'aguila',
  'olivo',
  'estrella',
  'antorcha',
  'corona',
  'escudo',
  'ancla',
]);

function createDefaultStarterSeason(): YouthChampionshipSeason {
  const startDate = new Date().toISOString().slice(0, 10);
  const saturdays = buildSaturdayDates(startDate, 4);
  const endDate = saturdays[saturdays.length - 1]?.date || startDate;

  const teams: ChampionshipTeam[] = [
    {
      id: 'team-leones',
      name: 'Leones de Judá',
      color: '#F59E0B',
      emblem: 'leon',
      motto: 'Firmes en la Palabra y valientes en la fe.',
      entityKind: 'Equipo',
      createdAt: Date.now(),
    },
    {
      id: 'team-aguilas',
      name: 'Águilas de Sion',
      color: '#0EA5E9',
      emblem: 'aguila',
      motto: 'Con alas nuevas servimos con alegría.',
      entityKind: 'Equipo',
      createdAt: Date.now(),
    },
    {
      id: 'team-olivos',
      name: 'Olivos de Paz',
      color: '#10B981',
      emblem: 'olivo',
      motto: 'Unidos en amor, estudio y servicio.',
      entityKind: 'Equipo',
      createdAt: Date.now(),
    },
    {
      id: 'team-estrellas',
      name: 'Estrellas de Belén',
      color: '#EC4899',
      emblem: 'estrella',
      motto: 'Luz y testimonio en nuestra generación.',
      entityKind: 'Equipo',
      createdAt: Date.now(),
    },
  ];

  return {
    id: 'season-inaugural-2026',
    name: 'Temporada 1 — Sociedad de Jóvenes',
    description:
      'Campeonato juvenil de 4 sábados integrando competencias bíblicas en vivo, retos del sábado, misiones semanales y colaboración grupal.',
    startDate: saturdays[0]?.date || startDate,
    endDate,
    saturdaysCount: 4,
    competitionType: 'equipos',
    allowInterChurch: false,
    status: 'activa',
    teams,
    participants: [],
    saturdays,
    upcomingActivities: [
      {
        id: 'up-1',
        saturdayNumber: 1,
        title: 'Apertura: Concurso Bíblico en Equipos',
        kind: 'competencia_biblica',
        scheduledDate: saturdays[0]?.date || startDate,
        description:
          'Primera ronda clasificatoria con preguntas del Antiguo y Nuevo Testamento.',
      },
      {
        id: 'up-2',
        saturdayNumber: 2,
        title: 'Jornada de Retos del Sábado y Misiones',
        kind: 'retos',
        scheduledDate: saturdays[1]?.date || startDate,
        description:
          'Desafíos creativos y sincronización de puntos por misiones verificadas.',
      },
      {
        id: 'up-3',
        saturdayNumber: 3,
        title: 'Semifinales de Campeonato',
        kind: 'competencia_biblica',
        scheduledDate: saturdays[2]?.date || startDate,
        description:
          'Cruces directos 1° vs 4° y 2° vs 3° rumbo a la Gran Final.',
      },
      {
        id: 'up-4',
        saturdayNumber: 4,
        title: 'Gran Final y Premiación de Temporada',
        kind: 'gran_final',
        scheduledDate: saturdays[3]?.date || startDate,
        description:
          'Presentación especial con cuenta regresiva, ganadores y reconocimiento general.',
      },
    ],
    scoreEntries: [],
    auditLogs: [],
    playoffs: {
      stageStatus: 'temporada_regular',
      competitorMode: 'team',
      semifinals: [],
    },
    createdAt: Date.now(),
  };
}

export function ensureYouthChampionshipsSlice(
  raw: Partial<YouthChampionshipsDatabaseSlice> | undefined
): YouthChampionshipsDatabaseSlice {
  const seasons = Array.isArray(raw?.youthChampionshipSeasons)
    ? raw!.youthChampionshipSeasons
    : [];
  return {
    youthChampionshipSeasons:
      seasons.length > 0 ? seasons : [createDefaultStarterSeason()],
  };
}

function computeDirectorSessionToken(
  serverSecret: string,
  directorPin: string
): string {
  // Share same signing domain as weekly missions so one director unlock covers coordination
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

function sanitizeSafePhotoDataUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const match = trimmed.match(
    /^data:image\/(webp|jpeg|jpg|png);base64,([A-Za-z0-9+/=]+)$/
  );
  if (!match) return undefined;
  const buf = Buffer.from(match[2], 'base64');
  if (buf.length < 64 || buf.length > 260 * 1024) return undefined;
  return trimmed;
}

export function registerYouthChampionshipsRoutes(
  app: express.Express,
  deps: YouthChampionshipsRoutesDeps
): void {
  const ensureDb = () => {
    const db = deps.getDb();
    if (
      !Array.isArray(db.youthChampionshipSeasons) ||
      db.youthChampionshipSeasons.length === 0
    ) {
      db.youthChampionshipSeasons = [createDefaultStarterSeason()];
    }
    return db;
  };

  const getDirectorPin = () =>
    deps.getDb().weeklyDirectorSecret ||
    process.env.MISSION_DIRECTOR_PIN ||
    'SJ2026';

  const isDirectorAuthorized = (req: express.Request): boolean => {
    const db = ensureDb();
    const authHeader = String(req.headers.authorization || '');
    const bearer = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';
    const token =
      bearer || String(req.headers['x-director-token'] || '').trim();
    return verifyDirectorToken(
      token,
      db.serverSecret || 'dime-tu-secret',
      getDirectorPin()
    );
  };

  const findSeason = (id: string): YouthChampionshipSeason | undefined => {
    const db = ensureDb();
    return db.youthChampionshipSeasons.find((s) => s.id === id);
  };

  const buildAvailableGamesList = () => {
    const db = ensureDb();
    const all = [
      ...Object.values(db.games || {}),
      ...Object.values(db.archivedGames || {}),
    ];
    const seen = new Set<string>();
    const list: Array<{
      code: string;
      title: string;
      mode: string;
      status: string;
      participantCount: number;
      createdAt: number;
    }> = [];
    for (const g of all) {
      if (!g || !g.code || seen.has(g.code)) continue;
      seen.add(g.code);
      list.push({
        code: String(g.code),
        title: String(g.config?.title || g.code),
        mode: String(g.config?.mode || 'clasico'),
        status: String(g.status || 'waiting'),
        participantCount: Object.keys(g.participants || {}).length,
        createdAt: Number(g.createdAt || 0),
      });
    }
    return list.sort((a, b) => b.createdAt - a.createdAt).slice(0, 30);
  };

  // 1. State endpoint
  app.get('/api/championships/state', (req, res) => {
    const db = ensureDb();
    const seasonsWithStandings = db.youthChampionshipSeasons.map((s) => ({
      ...s,
      standings: computeSeasonStandings(s),
    }));
    const activeSeason =
      seasonsWithStandings.find((s) => s.status === 'activa') ||
      seasonsWithStandings[0];

    res.json({
      seasons: seasonsWithStandings,
      activeSeason,
      archivedSeasons: seasonsWithStandings.filter(
        (s) => s.status === 'archivada'
      ),
      availableGames: buildAvailableGamesList(),
      directorAuthorized: isDirectorAuthorized(req),
      competitionTypes: COMPETITION_TYPE_LABELS,
      pointCategories: POINT_CATEGORY_META,
    });
  });

  // 2. Director authentication
  app.post('/api/championships/director/auth', (req, res) => {
    const db = ensureDb();
    const pin = String(req.body?.pin || '').trim();
    const expected = getDirectorPin();
    const a = Buffer.from(pin, 'utf-8');
    const b = Buffer.from(expected, 'utf-8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      res.status(401).json({ error: 'Clave de director incorrecta.' });
      return;
    }
    const directorToken = computeDirectorSessionToken(
      db.serverSecret || 'dime-tu-secret',
      expected
    );
    res.json({ authorized: true, directorToken });
  });

  // 3. Create new season (4 or 5 Saturdays)
  app.post('/api/championships/seasons', (req, res) => {
    if (!isDirectorAuthorized(req)) {
      res.status(403).json({
        error: 'Solo un director autorizado puede crear nuevas temporadas.',
      });
      return;
    }
    const db = ensureDb();
    const b = req.body || {};
    const name = String(b.name || '').trim().slice(0, 90);
    if (name.length < 3) {
      res.status(400).json({
        error: 'Escribe un nombre válido para la temporada.',
      });
      return;
    }

    const saturdaysCount: 4 | 5 = Number(b.saturdaysCount) === 5 ? 5 : 4;
    const rawComp = String(b.competitionType || 'equipos') as YouthCompetitionType;
    const competitionType: YouthCompetitionType = VALID_COMPETITION_TYPES.has(
      rawComp
    )
      ? rawComp
      : 'equipos';
    const allowInterChurch =
      competitionType === 'iglesias' ? true : Boolean(b.allowInterChurch);

    const startInput = /^\d{4}-\d{2}-\d{2}$/.test(String(b.startDate || ''))
      ? String(b.startDate)
      : new Date().toISOString().slice(0, 10);
    const saturdays = buildSaturdayDates(startInput, saturdaysCount);
    const endDate =
      /^\d{4}-\d{2}-\d{2}$/.test(String(b.endDate || ''))
        ? String(b.endDate)
        : saturdays[saturdays.length - 1]?.date || startInput;

    const copyTeamsFromActive = Boolean(b.copyTeamsFromActive);
    const currentActive = db.youthChampionshipSeasons.find(
      (s) => s.status === 'activa'
    );

    const defaultTeams: ChampionshipTeam[] =
      copyTeamsFromActive && currentActive
        ? currentActive.teams.map((t) => ({
            ...t,
            id: `team-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
            createdAt: Date.now(),
          }))
        : competitionType === 'individual'
          ? []
          : [
              {
                id: `team-${Date.now().toString(36)}-a`,
                name:
                  competitionType === 'iglesias'
                    ? 'Iglesia Central'
                    : competitionType === 'grupos_juveniles'
                      ? 'Grupo Jóvenes Luz'
                      : 'Leones de Judá',
                color: '#F59E0B',
                emblem: 'leon',
                motto: 'Firmes en la Palabra.',
                entityKind:
                  competitionType === 'iglesias'
                    ? 'Iglesia'
                    : competitionType === 'grupos_juveniles'
                      ? 'Grupo Juvenil'
                      : 'Equipo',
                createdAt: Date.now(),
              },
              {
                id: `team-${Date.now().toString(36)}-b`,
                name:
                  competitionType === 'iglesias'
                    ? 'Iglesia Monte Sion'
                    : competitionType === 'grupos_juveniles'
                      ? 'Grupo Semilla Viva'
                      : 'Águilas de Sion',
                color: '#0EA5E9',
                emblem: 'aguila',
                motto: 'Con fuerza espiritual.',
                entityKind:
                  competitionType === 'iglesias'
                    ? 'Iglesia'
                    : competitionType === 'grupos_juveniles'
                      ? 'Grupo Juvenil'
                      : 'Equipo',
                createdAt: Date.now(),
              },
            ];

    const newSeason: YouthChampionshipSeason = {
      id: `season-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
      name,
      description:
        String(b.description || '').trim().slice(0, 320) ||
        `Temporada oficial de ${saturdaysCount} sábados en modalidad ${COMPETITION_TYPE_LABELS[competitionType]}.`,
      startDate: saturdays[0]?.date || startInput,
      endDate,
      saturdaysCount,
      competitionType,
      allowInterChurch,
      status: 'activa',
      teams: defaultTeams,
      participants: [],
      saturdays,
      upcomingActivities: [],
      scoreEntries: [],
      auditLogs: [],
      playoffs: {
        stageStatus: 'temporada_regular',
        competitorMode:
          competitionType === 'individual' ? 'individual' : 'team',
        semifinals: [],
      },
      createdAt: Date.now(),
    };

    db.youthChampionshipSeasons.unshift(newSeason);
    deps.scheduleSave();
    res.status(201).json({ season: newSeason });
  });

  // 4. Add team / youth group / church to season
  app.post('/api/championships/seasons/:id/teams', (req, res) => {
    if (!isDirectorAuthorized(req)) {
      res.status(403).json({
        error: 'Solo un director autorizado puede crear equipos.',
      });
      return;
    }
    const season = findSeason(String(req.params.id || ''));
    if (!season) {
      res.status(404).json({ error: 'Temporada no encontrada.' });
      return;
    }
    if (season.status === 'archivada') {
      res.status(400).json({ error: 'Esta temporada ya está archivada.' });
      return;
    }

    const b = req.body || {};
    const name = String(b.name || '').trim().slice(0, 50);
    if (name.length < 2) {
      res.status(400).json({ error: 'Escribe el nombre del equipo o grupo.' });
      return;
    }
    if (
      season.teams.some(
        (t) => t.name.trim().toLowerCase() === name.toLowerCase()
      )
    ) {
      res.status(409).json({ error: 'Ya existe un equipo con ese nombre.' });
      return;
    }

    const entityKind: ChampionshipTeam['entityKind'] =
      b.entityKind === 'Iglesia'
        ? 'Iglesia'
        : b.entityKind === 'Grupo Juvenil'
          ? 'Grupo Juvenil'
          : 'Equipo';

    if (entityKind === 'Iglesia' && !season.allowInterChurch && season.competitionType !== 'iglesias') {
      res.status(400).json({
        error:
          'Las competencias entre iglesias no están habilitadas en esta temporada.',
      });
      return;
    }

    const rawColor = String(b.color || '').trim();
    const color = /^#[0-9A-Fa-f]{6}$/.test(rawColor) ? rawColor : '#10B981';
    const rawEmblem = String(b.emblem || 'escudo') as ChampionshipTeamEmblem;
    const emblem: ChampionshipTeamEmblem = VALID_EMBLEMS.has(rawEmblem)
      ? rawEmblem
      : 'escudo';

    const team: ChampionshipTeam = {
      id: `team-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
      name,
      color,
      emblem,
      motto: String(b.motto || '').trim().slice(0, 120) || 'Unidos para servir y aprender.',
      entityKind,
      ...(b.churchName ? { churchName: String(b.churchName).trim().slice(0, 60) } : {}),
      ...(b.captainName ? { captainName: String(b.captainName).trim().slice(0, 50) } : {}),
      createdAt: Date.now(),
    };

    season.teams.push(team);
    deps.scheduleSave();
    res.status(201).json({ team, season });
  });

  // 5. Join / incorporate participant using current identity (avatar/photo/profileKey)
  app.post('/api/championships/seasons/:id/join', (req, res) => {
    const season = findSeason(String(req.params.id || ''));
    if (!season) {
      res.status(404).json({ error: 'Temporada no encontrada.' });
      return;
    }
    if (season.status === 'archivada') {
      res.status(400).json({ error: 'Esta temporada ya finalizó.' });
      return;
    }

    const b = req.body || {};
    const name = String(b.name || '').trim().slice(0, 48);
    const participantKey = String(b.participantKey || '').trim().slice(0, 80);
    const avatarId = String(b.avatarId || 'david').trim().slice(0, 50);
    const photoDataUrl = sanitizeSafePhotoDataUrl(b.photoDataUrl);
    const teamId = b.teamId ? String(b.teamId).trim() : undefined;

    if (name.length < 2 || !participantKey) {
      res.status(400).json({
        error: 'Ingresa tu nombre (mínimo 2 caracteres) para incorporarte.',
      });
      return;
    }

    if (teamId && !season.teams.some((t) => t.id === teamId)) {
      res.status(400).json({ error: 'El equipo seleccionado no existe.' });
      return;
    }

    const normName = name.toLowerCase();
    const existing = season.participants.find(
      (p) =>
        p.participantKey === participantKey ||
        p.name.trim().toLowerCase() === normName
    );
    if (existing) {
      res.status(409).json({
        error:
          'Este participante ya está inscrito en la temporada actual.',
      });
      return;
    }

    const participant: ChampionshipParticipant = {
      id: `cpart-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
      participantKey,
      name,
      avatarId,
      ...(photoDataUrl ? { photoDataUrl } : {}),
      ...(teamId ? { teamId } : {}),
      ...(b.churchName ? { churchName: String(b.churchName).trim().slice(0, 60) } : {}),
      joinedAt: Date.now(),
    };

    season.participants.push(participant);
    deps.scheduleSave();
    res.status(201).json({ participant, season });
  });

  // 6. Record Saturday points (strict anti-duplication + audit log)
  app.post('/api/championships/seasons/:id/scores', (req, res) => {
    if (!isDirectorAuthorized(req)) {
      res.status(403).json({
        error: 'Solo un director autorizado puede registrar puntos.',
      });
      return;
    }
    const season = findSeason(String(req.params.id || ''));
    if (!season) {
      res.status(404).json({ error: 'Temporada no encontrada.' });
      return;
    }

    const b = req.body || {};
    const saturdayNumber = Math.max(
      1,
      Math.min(season.saturdaysCount, Number(b.saturdayNumber) || 1)
    );
    const category = String(b.category || 'participacion') as ChampionshipPointCategory;
    if (!VALID_CATEGORIES.has(category)) {
      res.status(400).json({ error: 'Categoría de puntaje no válida.' });
      return;
    }

    const points = Math.round(Number(b.points) || 0);
    if (points <= 0 || points > 10000) {
      res.status(400).json({
        error: 'Ingresa una cantidad de puntos válida entre 1 y 10,000.',
      });
      return;
    }

    const participantId = b.participantId
      ? String(b.participantId).trim()
      : undefined;
    let teamId = b.teamId ? String(b.teamId).trim() : undefined;

    const participant = participantId
      ? season.participants.find((p) => p.id === participantId)
      : undefined;
    if (participant && !teamId) {
      teamId = participant.teamId;
    }

    if (!teamId && !participant) {
      res.status(400).json({
        error: 'Selecciona un participante o un equipo para asignar puntos.',
      });
      return;
    }

    const sourceLabel =
      String(b.sourceLabel || '').trim().slice(0, 90) ||
      `Registro Sábado ${saturdayNumber}`;
    const dedupKey = b.dedupKey
      ? String(b.dedupKey).trim().slice(0, 120)
      : `manual:sat${saturdayNumber}:${category}:${participantId || 'none'}:${teamId || 'none'}:${sourceLabel.toLowerCase()}`;

    const duplicate = season.scoreEntries.some(
      (e) => !e.voided && e.dedupKey === dedupKey
    );
    if (duplicate) {
      res.status(409).json({
        error:
          'Este puntaje ya fue registrado anteriormente (protección anti-duplicados). Si necesitas ajustarlo, edítalo en la auditoría.',
      });
      return;
    }

    const editedBy =
      String(b.editedBy || 'Director Autorizado').trim().slice(0, 50) ||
      'Director Autorizado';

    const entry: ChampionshipScoreEntry = {
      id: `cscr-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
      saturdayNumber,
      category,
      points,
      ...(teamId ? { teamId } : {}),
      ...(participant ? { participantId: participant.id, participantName: participant.name } : {}),
      sourceLabel,
      dedupKey,
      ...(b.notes ? { notes: String(b.notes).trim().slice(0, 220) } : {}),
      createdBy: editedBy,
      createdAt: Date.now(),
    };

    season.scoreEntries.unshift(entry);
    const satSlot = season.saturdays.find(
      (s) => s.saturdayNumber === saturdayNumber
    );
    if (satSlot && satSlot.status === 'upcoming') {
      satSlot.status = 'active';
    }

    const log: ChampionshipAuditLog = {
      id: `caud-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
      action: 'create',
      entryId: entry.id,
      previousPoints: 0,
      newPoints: points,
      reason: `Registro en Sábado ${saturdayNumber}: ${sourceLabel}`,
      editedBy,
      editedAt: Date.now(),
    };
    season.auditLogs.unshift(log);

    deps.scheduleSave();
    res.status(201).json({ entry, standings: computeSeasonStandings(season) });
  });

  // 7. Import real scores from an existing game room (anti-duplicate)
  app.post('/api/championships/seasons/:id/import-game', (req, res) => {
    if (!isDirectorAuthorized(req)) {
      res.status(403).json({
        error: 'Solo un director autorizado puede importar resultados de partidas.',
      });
      return;
    }
    const db = ensureDb();
    const season = findSeason(String(req.params.id || ''));
    if (!season) {
      res.status(404).json({ error: 'Temporada no encontrada.' });
      return;
    }

    const b = req.body || {};
    const gameCode = String(b.gameCode || '').trim().toUpperCase();
    const saturdayNumber = Math.max(
      1,
      Math.min(season.saturdaysCount, Number(b.saturdayNumber) || 1)
    );
    const editedBy =
      String(b.editedBy || 'Director Autorizado').trim().slice(0, 50) ||
      'Director Autorizado';

    const game =
      db.games?.[gameCode] ||
      Object.values(db.archivedGames || {}).find((g: any) => g.code === gameCode);

    if (!game) {
      res.status(404).json({ error: 'Partida no encontrada.' });
      return;
    }

    const participants = Object.values(game.participants || {}) as Array<any>;
    if (participants.length === 0) {
      res.status(400).json({
        error: 'La partida aún no tiene participantes con puntaje.',
      });
      return;
    }

    let importedCount = 0;
    const skippedDuplicates: string[] = [];

    for (const gp of participants) {
      const gpName = String(gp.name || '').trim();
      if (!gpName) continue;
      const gpNorm = gpName.toLowerCase();

      // Match enrolled participant or auto-match team by name
      let matchedPart = season.participants.find(
        (sp) => sp.name.trim().toLowerCase() === gpNorm
      );
      let matchedTeam = matchedPart?.teamId
        ? season.teams.find((t) => t.id === matchedPart!.teamId)
        : undefined;

      if (!matchedTeam && gp.teamId && Array.isArray(game.config?.teams)) {
        const gameTeam = game.config.teams.find((t: any) => t.id === gp.teamId);
        if (gameTeam) {
          matchedTeam = season.teams.find(
            (st) => st.name.trim().toLowerCase() === String(gameTeam.name || '').trim().toLowerCase()
          );
        }
      }

      // If neither participant nor team exists in season yet, enroll participant automatically so existing system flows seamlessly
      if (!matchedPart) {
        matchedPart = {
          id: `cpart-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
          participantKey: String(gp.profileKey || `game-${gp.id}`),
          name: gpName,
          avatarId: String(gp.avatarId || 'david'),
          ...(matchedTeam ? { teamId: matchedTeam.id } : {}),
          joinedAt: Date.now(),
        };
        season.participants.push(matchedPart);
      }

      const rawScore = Math.max(0, Math.round(Number(gp.score) || 0));
      const normalizedPts = rawScore > 0 ? Math.max(50, Math.round(rawScore / 10)) : 50;
      const dedupKey = `game:${game.code}:${gpNorm}`;

      if (season.scoreEntries.some((e) => !e.voided && e.dedupKey === dedupKey)) {
        skippedDuplicates.push(gpName);
        continue;
      }

      const entry: ChampionshipScoreEntry = {
        id: `cscr-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
        saturdayNumber,
        category: rawScore > 0 ? 'respuestas_correctas' : 'participacion',
        points: normalizedPts,
        ...(matchedTeam ? { teamId: matchedTeam.id } : {}),
        participantId: matchedPart.id,
        participantName: matchedPart.name,
        sourceLabel: `Partida en vivo ${game.code} (${game.config?.title || 'Concurso'})`,
        dedupKey,
        createdBy: editedBy,
        createdAt: Date.now(),
      };

      season.scoreEntries.unshift(entry);
      importedCount += 1;
    }

    if (importedCount === 0) {
      res.status(409).json({
        error: `Los resultados de la partida ${game.code} ya fueron importados anteriormente.`,
      });
      return;
    }

    const satSlot = season.saturdays.find(
      (s) => s.saturdayNumber === saturdayNumber
    );
    if (satSlot && !satSlot.linkedGameCodes.includes(game.code)) {
      satSlot.linkedGameCodes.push(game.code);
      satSlot.status = 'completed';
    }

    season.auditLogs.unshift({
      id: `caud-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
      action: 'import',
      newPoints: importedCount,
      reason: `Importación de ${importedCount} resultados desde partida ${game.code} en Sábado ${saturdayNumber}.`,
      editedBy,
      editedAt: Date.now(),
    });

    deps.scheduleSave();
    res.json({
      importedCount,
      skippedDuplicates,
      standings: computeSeasonStandings(season),
    });
  });

  // 8. Import verified weekly missions (Stage 6 integration, zero duplication)
  app.post('/api/championships/seasons/:id/import-missions', (req, res) => {
    if (!isDirectorAuthorized(req)) {
      res.status(403).json({
        error: 'Solo un director autorizado puede sincronizar misiones verificadas.',
      });
      return;
    }
    const db = ensureDb();
    const season = findSeason(String(req.params.id || ''));
    if (!season) {
      res.status(404).json({ error: 'Temporada no encontrada.' });
      return;
    }

    const saturdayNumber = Math.max(
      1,
      Math.min(season.saturdaysCount, Number(req.body?.saturdayNumber) || 1)
    );
    const editedBy =
      String(req.body?.editedBy || 'Director Autorizado').trim().slice(0, 50) ||
      'Director Autorizado';

    const approvedMissions = (db.weeklyMissionRegistrations || []).filter(
      (m) => m.status === 'approved' && m.pointsAwarded > 0
    );

    let importedCount = 0;
    for (const reg of approvedMissions) {
      const part = season.participants.find(
        (p) =>
          p.participantKey === reg.participantKey ||
          p.name.trim().toLowerCase() === reg.participantName.trim().toLowerCase()
      );
      if (!part) continue;

      const dedupKey = `mission:${reg.id}`;
      if (season.scoreEntries.some((e) => !e.voided && e.dedupKey === dedupKey)) {
        continue;
      }

      season.scoreEntries.unshift({
        id: `cscr-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
        saturdayNumber,
        category: 'misiones_verificadas',
        points: reg.pointsAwarded,
        ...(part.teamId ? { teamId: part.teamId } : {}),
        participantId: part.id,
        participantName: part.name,
        sourceLabel: `Misión verificada: ${reg.missionTitle}`,
        dedupKey,
        createdBy: editedBy,
        createdAt: Date.now(),
      });
      importedCount += 1;
    }

    if (importedCount === 0) {
      res.json({
        importedCount: 0,
        message: 'No hay nuevas misiones verificadas pendientes de sincronizar.',
        standings: computeSeasonStandings(season),
      });
      return;
    }

    season.auditLogs.unshift({
      id: `caud-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
      action: 'import',
      newPoints: importedCount,
      reason: `Sincronización de ${importedCount} misiones verificadas en Sábado ${saturdayNumber}.`,
      editedBy,
      editedAt: Date.now(),
    });
    deps.scheduleSave();
    res.json({ importedCount, standings: computeSeasonStandings(season) });
  });

  // 9. Director corrects or voids a score entry with mandatory audit reason
  app.patch('/api/championships/seasons/:id/scores/:entryId', (req, res) => {
    if (!isDirectorAuthorized(req)) {
      res.status(403).json({
        error: 'Solo un director autorizado puede corregir o anular puntajes.',
      });
      return;
    }
    const season = findSeason(String(req.params.id || ''));
    if (!season) {
      res.status(404).json({ error: 'Temporada no encontrada.' });
      return;
    }
    const entry = season.scoreEntries.find(
      (e) => e.id === String(req.params.entryId || '')
    );
    if (!entry) {
      res.status(404).json({ error: 'Registro de puntaje no encontrado.' });
      return;
    }

    const reason = String(req.body?.reason || '').trim().slice(0, 220);
    if (reason.length < 5) {
      res.status(400).json({
        error:
          'Indica un motivo claro (mínimo 5 caracteres) para registrar la corrección en el historial de cambios.',
      });
      return;
    }

    const editedBy =
      String(req.body?.editedBy || 'Director Autorizado').trim().slice(0, 50) ||
      'Director Autorizado';
    const prevPoints = entry.points;

    if (req.body?.voided === true) {
      entry.voided = true;
      entry.voidedReason = reason;
      entry.updatedAt = Date.now();
      season.auditLogs.unshift({
        id: `caud-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
        action: 'void',
        entryId: entry.id,
        previousPoints: prevPoints,
        newPoints: 0,
        reason,
        editedBy,
        editedAt: Date.now(),
      });
    } else {
      const nextPoints = Math.round(Number(req.body?.points) || 0);
      if (nextPoints <= 0 || nextPoints > 10000) {
        res.status(400).json({ error: 'Puntaje corregido fuera de rango.' });
        return;
      }
      entry.points = nextPoints;
      entry.updatedAt = Date.now();
      season.auditLogs.unshift({
        id: `caud-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
        action: 'edit',
        entryId: entry.id,
        previousPoints: prevPoints,
        newPoints: nextPoints,
        reason,
        editedBy,
        editedAt: Date.now(),
      });
    }

    deps.scheduleSave();
    res.json({ entry, standings: computeSeasonStandings(season) });
  });

  // 10. Generate Semifinals & Final Bracket
  app.post('/api/championships/seasons/:id/playoffs/generate', (req, res) => {
    if (!isDirectorAuthorized(req)) {
      res.status(403).json({
        error: 'Solo un director autorizado puede organizar semifinales y finales.',
      });
      return;
    }
    const season = findSeason(String(req.params.id || ''));
    if (!season) {
      res.status(404).json({ error: 'Temporada no encontrada.' });
      return;
    }

    const { teamStandings, participantStandings } =
      computeSeasonStandings(season);
    const useTeams =
      season.competitionType !== 'individual' && teamStandings.length >= 2;

    const competitors = useTeams
      ? teamStandings.map((r) => ({
          id: r.team.id,
          name: r.team.name,
          color: r.team.color,
        }))
      : participantStandings.map((r) => ({
          id: r.participant.id,
          name: r.participant.name,
          color: r.teamColor || '#F59E0B',
        }));

    if (competitors.length < 2) {
      res.status(400).json({
        error:
          'Necesitas al menos 2 equipos o participantes inscritos para generar las fases finales.',
      });
      return;
    }

    const editedBy =
      String(req.body?.editedBy || 'Director Autorizado').trim().slice(0, 50) ||
      'Director Autorizado';

    if (competitors.length >= 4) {
      const sf1: PlayoffMatchSlot = {
        id: 'sf-1',
        roundLabel: 'Semifinal 1',
        competitorAId: competitors[0].id,
        competitorAName: competitors[0].name,
        competitorAColor: competitors[0].color,
        competitorAScore: 0,
        competitorBId: competitors[3].id,
        competitorBName: competitors[3].name,
        competitorBColor: competitors[3].color,
        competitorBScore: 0,
        completed: false,
      };
      const sf2: PlayoffMatchSlot = {
        id: 'sf-2',
        roundLabel: 'Semifinal 2',
        competitorAId: competitors[1].id,
        competitorAName: competitors[1].name,
        competitorAColor: competitors[1].color,
        competitorAScore: 0,
        competitorBId: competitors[2].id,
        competitorBName: competitors[2].name,
        competitorBColor: competitors[2].color,
        competitorBScore: 0,
        completed: false,
      };
      season.playoffs = {
        stageStatus: 'semifinales',
        competitorMode: useTeams ? 'team' : 'individual',
        semifinals: [sf1, sf2],
        mvpParticipantName: participantStandings[0]?.participant.name,
      };
    } else {
      season.playoffs = {
        stageStatus: 'gran_final',
        competitorMode: useTeams ? 'team' : 'individual',
        semifinals: [],
        finalMatch: {
          id: 'grand-final',
          roundLabel: 'Gran Final',
          competitorAId: competitors[0].id,
          competitorAName: competitors[0].name,
          competitorAColor: competitors[0].color,
          competitorAScore: 0,
          competitorBId: competitors[1].id,
          competitorBName: competitors[1].name,
          competitorBColor: competitors[1].color,
          competitorBScore: 0,
          completed: false,
        },
        thirdPlaceName: competitors[2]?.name,
        mvpParticipantName: participantStandings[0]?.participant.name,
      };
    }

    season.auditLogs.unshift({
      id: `caud-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
      action: 'playoffs',
      reason: `Llave de ${season.playoffs.stageStatus} generada automáticamente por clasificación.`,
      editedBy,
      editedAt: Date.now(),
    });

    deps.scheduleSave();
    res.json({ playoffs: season.playoffs });
  });

  // 11. Update Semifinals / Final results & crown winners
  app.post('/api/championships/seasons/:id/playoffs/update', (req, res) => {
    if (!isDirectorAuthorized(req)) {
      res.status(403).json({
        error: 'Solo un director autorizado puede actualizar resultados finales.',
      });
      return;
    }
    const season = findSeason(String(req.params.id || ''));
    if (!season) {
      res.status(404).json({ error: 'Temporada no encontrada.' });
      return;
    }

    const b = req.body || {};
    const matchId = String(b.matchId || '');
    const scoreA = Math.max(0, Math.round(Number(b.scoreA) || 0));
    const scoreB = Math.max(0, Math.round(Number(b.scoreB) || 0));
    const completeMatch = Boolean(b.completeMatch);
    const editedBy =
      String(b.editedBy || 'Director Autorizado').trim().slice(0, 50) ||
      'Director Autorizado';

    const sf = season.playoffs.semifinals.find((m) => m.id === matchId);
    if (sf) {
      sf.competitorAScore = scoreA;
      sf.competitorBScore = scoreB;
      if (completeMatch) {
        const winnerIsA =
          b.winnerSide === 'B'
            ? false
            : b.winnerSide === 'A'
              ? true
              : scoreA >= scoreB;
        sf.winnerId = winnerIsA ? sf.competitorAId : sf.competitorBId;
        sf.winnerName = winnerIsA ? sf.competitorAName : sf.competitorBName;
        sf.completed = true;

        // If both semifinals are complete, automatically create Grand Final
        const [sf1, sf2] = season.playoffs.semifinals;
        if (sf1?.completed && sf2?.completed) {
          const finA =
            sf1.winnerId === sf1.competitorAId
              ? { id: sf1.competitorAId, name: sf1.competitorAName, color: sf1.competitorAColor }
              : { id: sf1.competitorBId, name: sf1.competitorBName, color: sf1.competitorBColor };
          const finB =
            sf2.winnerId === sf2.competitorAId
              ? { id: sf2.competitorAId, name: sf2.competitorAName, color: sf2.competitorAColor }
              : { id: sf2.competitorBId, name: sf2.competitorBName, color: sf2.competitorBColor };

          season.playoffs.stageStatus = 'gran_final';
          season.playoffs.finalMatch = {
            id: 'grand-final',
            roundLabel: 'Gran Final',
            competitorAId: finA.id,
            competitorAName: finA.name,
            competitorAColor: finA.color,
            competitorAScore: 0,
            competitorBId: finB.id,
            competitorBName: finB.name,
            competitorBColor: finB.color,
            competitorBScore: 0,
            completed: false,
          };
        }
      }
    } else if (
      season.playoffs.finalMatch &&
      season.playoffs.finalMatch.id === matchId
    ) {
      const fm = season.playoffs.finalMatch;
      fm.competitorAScore = scoreA;
      fm.competitorBScore = scoreB;
      if (completeMatch) {
        const winnerIsA =
          b.winnerSide === 'B'
            ? false
            : b.winnerSide === 'A'
              ? true
              : scoreA >= scoreB;
        fm.winnerId = winnerIsA ? fm.competitorAId : fm.competitorBId;
        fm.winnerName = winnerIsA ? fm.competitorAName : fm.competitorBName;
        fm.completed = true;

        season.playoffs.stageStatus = 'finalizada';
        season.playoffs.championId = fm.winnerId;
        season.playoffs.championName = fm.winnerName;
        season.playoffs.runnerUpName = winnerIsA
          ? fm.competitorBName
          : fm.competitorAName;
        const { participantStandings, teamStandings } =
          computeSeasonStandings(season);
        season.playoffs.mvpParticipantName =
          participantStandings[0]?.participant.name;
        if (!season.playoffs.thirdPlaceName && teamStandings[2]) {
          season.playoffs.thirdPlaceName = teamStandings[2].team.name;
        }
      }
    } else {
      res.status(404).json({ error: 'Encuentro de fase final no encontrado.' });
      return;
    }

    season.auditLogs.unshift({
      id: `caud-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
      action: 'playoffs',
      reason: `Actualización de ${matchId}: ${scoreA} - ${scoreB}.`,
      editedBy,
      editedAt: Date.now(),
    });

    deps.scheduleSave();
    res.json({ playoffs: season.playoffs });
  });

  // 12. Archive season (save previous seasons permanently)
  app.post('/api/championships/seasons/:id/archive', (req, res) => {
    if (!isDirectorAuthorized(req)) {
      res.status(403).json({
        error: 'Solo un director autorizado puede cerrar y guardar temporadas.',
      });
      return;
    }
    const season = findSeason(String(req.params.id || ''));
    if (!season) {
      res.status(404).json({ error: 'Temporada no encontrada.' });
      return;
    }

    const { teamStandings, participantStandings } =
      computeSeasonStandings(season);
    if (!season.playoffs.championName) {
      if (season.competitionType !== 'individual' && teamStandings[0]) {
        season.playoffs.championId = teamStandings[0].team.id;
        season.playoffs.championName = teamStandings[0].team.name;
        season.playoffs.runnerUpName = teamStandings[1]?.team.name;
        season.playoffs.thirdPlaceName = teamStandings[2]?.team.name;
      } else if (participantStandings[0]) {
        season.playoffs.championId = participantStandings[0].participant.id;
        season.playoffs.championName =
          participantStandings[0].participant.name;
        season.playoffs.runnerUpName =
          participantStandings[1]?.participant.name;
        season.playoffs.thirdPlaceName =
          participantStandings[2]?.participant.name;
      }
    }

    season.playoffs.stageStatus = 'finalizada';
    season.status = 'archivada';
    season.closedAt = Date.now();
    for (const s of season.saturdays) {
      s.status = 'completed';
    }

    season.auditLogs.unshift({
      id: `caud-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
      action: 'archive',
      reason: 'Temporada cerrada y guardada en el archivo histórico.',
      editedBy:
        String(req.body?.editedBy || 'Director Autorizado').trim().slice(0, 50) ||
        'Director Autorizado',
      editedAt: Date.now(),
    });

    deps.scheduleSave();
    res.json({ season });
  });

  // 13. Add upcoming competition/activity & link live game codes
  app.post('/api/championships/seasons/:id/upcoming', (req, res) => {
    if (!isDirectorAuthorized(req)) {
      res.status(403).json({
        error: 'Solo un director autorizado puede programar próximas competencias.',
      });
      return;
    }
    const season = findSeason(String(req.params.id || ''));
    if (!season) {
      res.status(404).json({ error: 'Temporada no encontrada.' });
      return;
    }
    const b = req.body || {};
    const title = String(b.title || '').trim().slice(0, 90);
    if (title.length < 3) {
      res.status(400).json({ error: 'Escribe el título de la competencia.' });
      return;
    }
    const saturdayNumber = Math.max(
      1,
      Math.min(season.saturdaysCount, Number(b.saturdayNumber) || 1)
    );
    const sat = season.saturdays.find(
      (s) => s.saturdayNumber === saturdayNumber
    );
    const item = {
      id: `up-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
      saturdayNumber,
      title,
      kind: (['competencia_biblica', 'retos', 'mision', 'gran_final'].includes(
        String(b.kind)
      )
        ? b.kind
        : 'competencia_biblica') as any,
      scheduledDate: sat?.date || season.startDate,
      description: String(b.description || '').trim().slice(0, 220),
    };
    season.upcomingActivities.push(item);
    deps.scheduleSave();
    res.status(201).json({ upcomingActivity: item });
  });

  app.post(
    '/api/championships/seasons/:id/saturdays/:satNum/link-game',
    (req, res) => {
      if (!isDirectorAuthorized(req)) {
        res.status(403).json({
          error: 'Solo un director autorizado puede vincular partidas.',
        });
        return;
      }
      const season = findSeason(String(req.params.id || ''));
      if (!season) {
        res.status(404).json({ error: 'Temporada no encontrada.' });
        return;
      }
      const satNum = Number(req.params.satNum);
      const sat = season.saturdays.find((s) => s.saturdayNumber === satNum);
      const code = String(req.body?.code || '').trim().toUpperCase();
      if (!sat || !code) {
        res.status(400).json({ error: 'Sábado o código de partida inválido.' });
        return;
      }
      if (!sat.linkedGameCodes.includes(code)) {
        sat.linkedGameCodes.push(code);
      }
      sat.status = 'active';
      deps.scheduleSave();
      res.json({ saturday: sat });
    }
  );
}
