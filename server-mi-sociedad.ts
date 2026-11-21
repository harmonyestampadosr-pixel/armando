import crypto from 'crypto';
import type express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { WebSocket } from 'ws';
import {
  formatMmSs,
  getSectionMeta,
  rebalanceYouthActivities,
  VERIFIED_BIBLICAL_ANCHORS,
  YOUTH_CONFIG_PRESETS,
  YOUTH_SECTIONS,
  type YouthActivityExecutionStatus,
  type YouthBiblicalContentType,
  type YouthExperienceType,
  type YouthParticipationMode,
  type YouthProgramActivityItem,
  type YouthProgramConfigInput,
  type YouthProgramHistoryEntry,
  type YouthProgramPlan,
  type YouthSectionCode,
  type YouthSocietyStatsSummary,
  type YouthSoundMood,
} from './src/shared/youthSocietyData.js';
import { getUpcomingSaturdayIso, type SaturdayProgram } from './src/shared/saturdayProgramTypes.js';
import { SURPRISE_CATEGORIES, type SurpriseItem } from './src/shared/surpriseBoothData.js';
import { drawSurpriseItem } from './server-cabina-sorpresas.js';
import { GAME_MODE_INFO, type DifficultySetting, type GameMode } from './src/shared/types.js';
import type { StoredSaturdayMemoryRecord } from './server-memorias.js';

export interface YouthSocietyDatabaseSlice {
  youthSocietyPrograms: Record<string, YouthProgramPlan>;
  youthSocietyHistory: YouthProgramHistoryEntry[];
  activeYouthSocietyProgramId: string | null;
}

export interface YouthSocietyRoutesDeps {
  getDb: () => YouthSocietyDatabaseSlice & {
    serverSecret?: string;
    weeklyDirectorSecret?: string;
    games?: Record<string, any>;
    archivedGames?: Record<string, any>;
    saturdayPrograms?: Record<string, SaturdayProgram>;
    saturdayMemories?: StoredSaturdayMemoryRecord[];
    surpriseBoothCustomItems?: SurpriseItem[];
    surpriseBoothExcludedIds?: string[];
    surpriseBoothRecentIds?: string[];
    surpriseBoothHistory?: any[];
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

interface YouthSocketClient {
  ws: WebSocket;
  programId: string;
  role: 'director' | 'projector' | 'participant';
}

const ysSocketsByProgram = new Map<string, Set<YouthSocketClient>>();
const ysSocketMetaMap = new Map<WebSocket, YouthSocketClient>();

export function ensureYouthSocietySlice(
  raw: Partial<YouthSocietyDatabaseSlice> | undefined
): YouthSocietyDatabaseSlice {
  return {
    youthSocietyPrograms:
      raw?.youthSocietyPrograms && typeof raw.youthSocietyPrograms === 'object'
        ? raw.youthSocietyPrograms
        : {},
    youthSocietyHistory: Array.isArray(raw?.youthSocietyHistory)
      ? raw.youthSocietyHistory
      : [],
    activeYouthSocietyProgramId:
      typeof raw?.activeYouthSocietyProgramId === 'string' &&
      raw.activeYouthSocietyProgramId.trim()
        ? raw.activeYouthSocietyProgramId.trim()
        : null,
  };
}

function computeYouthDirectorToken(serverSecret: string, pin: string): string {
  return crypto
    .createHmac('sha256', `${serverSecret}:youth-society-director`)
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

function isAuthorizedYouthDirector(
  req: express.Request,
  db: ReturnType<YouthSocietyRoutesDeps['getDb']>
): boolean {
  const token = String(
    req.headers['x-youth-director-token'] || req.query.ydt || ''
  ).trim();
  if (!token) return false;
  const secret = db.serverSecret || 'dime-tu-youth-secret';
  const pin = db.weeklyDirectorSecret || 'SJ2026';
  return timingSafeMatch(token, computeYouthDirectorToken(secret, pin));
}

function createGeminiClient(): GoogleGenAI | null {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key || key === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function mapGeminiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  if (lower.includes('api_key_invalid') || lower.includes('permission_denied') || lower.includes('403')) {
    return {
      status: 400,
      message: 'La clave de Gemini API no es válida o no tiene permisos. Verifica Settings > Secrets.',
    };
  }
  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota')) {
    return {
      status: 429,
      message: 'Se alcanzó el límite temporal de Gemini API. Puedes reintentar o usar el Generador Curado.',
    };
  }
  return {
    status: 502,
    message: `No se pudo generar con Gemini API en este momento: ${raw.slice(0, 160)}`,
  };
}

const VALID_SECTION_CODES = new Set<YouthSectionCode>([
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
]);

const VALID_MOODS = new Set<YouthSoundMood>([
  'bienvenida',
  'transicion',
  'reto',
  'ruleta',
  'misterio',
  'competencia',
  'presentacion',
  'cuenta_regresiva',
  'reconocimiento',
  'finalizacion',
]);

function normalizeDuration(raw: unknown): 60 | 90 | 120 {
  const n = Number(raw);
  if (n === 60 || n === 90 || n === 120) return n;
  return 90;
}

function sanitizeConfig(raw: any): YouthProgramConfigInput {
  const durationMinutes = normalizeDuration(raw?.durationMinutes);
  const estimatedParticipants = Math.max(
    4,
    Math.min(500, Math.round(Number(raw?.estimatedParticipants) || 35))
  );
  const participationMode: YouthParticipationMode =
    raw?.participationMode === 'individual' || raw?.participationMode === 'parejas'
      ? raw.participationMode
      : 'equipos';
  const difficulty: DifficultySetting =
    raw?.difficulty === 'facil' ||
    raw?.difficulty === 'intermedio' ||
    raw?.difficulty === 'dificil'
      ? raw.difficulty
      : 'combinado';
  const experienceType: YouthExperienceType =
    raw?.experienceType === 'divertida' ||
    raw?.experienceType === 'educativa' ||
    raw?.experienceType === 'evangelistica' ||
    raw?.experienceType === 'reflexiva'
      ? raw.experienceType
      : 'combinada';

  const includeSections = Array.isArray(raw?.includeSections)
    ? (raw.includeSections
        .map((c: unknown) => String(c).toUpperCase().trim() as YouthSectionCode)
        .filter((c: YouthSectionCode) => VALID_SECTION_CODES.has(c)))
    : [];
  const avoidSections = Array.isArray(raw?.avoidSections)
    ? (raw.avoidSections
        .map((c: unknown) => String(c).toUpperCase().trim() as YouthSectionCode)
        .filter((c: YouthSectionCode) => VALID_SECTION_CODES.has(c)))
    : [];

  return {
    durationMinutes,
    estimatedParticipants,
    participationMode,
    difficulty,
    spiritualTheme: String(raw?.spiritualTheme || '').trim().slice(0, 140),
    experienceType,
    includeSections,
    avoidSections,
    includeCompetitions: raw?.includeCompetitions !== false,
    includeTalents: Boolean(raw?.includeTalents),
    includeMission: raw?.includeMission !== false,
    scheduledDate:
      typeof raw?.scheduledDate === 'string' && raw.scheduledDate.trim()
        ? raw.scheduledDate.trim().slice(0, 20)
        : getUpcomingSaturdayIso(),
    directorName:
      String(raw?.directorName || '').trim().slice(0, 80) || 'Dirección Juvenil',
  };
}

function selectSectionsForProgram(
  cfg: YouthProgramConfigInput,
  stats: YouthSocietyStatsSummary
): YouthSectionCode[] {
  const avoidSet = new Set<YouthSectionCode>(cfg.avoidSections);
  if (!cfg.includeCompetitions) {
    avoidSet.add('F');
    avoidSet.add('G');
  }
  if (!cfg.includeTalents) {
    avoidSet.add('I');
  }
  if (!cfg.includeMission) {
    avoidSet.add('K');
  }

  // Always start with A & B and close with J & M unless explicitly avoided
  const chosen = new Set<YouthSectionCode>();
  if (!avoidSet.has('A')) chosen.add('A');
  if (!avoidSet.has('B')) chosen.add('B');

  for (const inc of cfg.includeSections) {
    if (!avoidSet.has(inc)) chosen.add(inc);
  }

  // Experience-tailored balance ensuring non-trivia-only programs
  const priorityByExperience: Record<YouthExperienceType, YouthSectionCode[]> = {
    divertida: ['C', 'D', 'L', 'G', 'E', 'J', 'M'],
    educativa: ['E', 'H', 'J', 'D', 'K', 'M'],
    evangelistica: ['A', 'I', 'H', 'J', 'K', 'L', 'M'],
    reflexiva: ['H', 'J', 'K', 'I', 'M'],
    combinada: ['D', 'E', 'H', 'J', 'L', 'K', 'M'],
  };

  // Favor underused sections from history to maximize weekly variety
  const candidates = [
    ...stats.underusedSections,
    ...priorityByExperience[cfg.experienceType],
    ...YOUTH_SECTIONS.map((s) => s.code),
  ];

  const targetCount =
    cfg.durationMinutes === 60 ? 6 : cfg.durationMinutes === 120 ? 9 : 7;

  for (const code of candidates) {
    if (chosen.size >= targetCount) break;
    if (avoidSet.has(code)) continue;
    if (code === 'F' && cfg.participationMode === 'equipos') continue;
    if (code === 'G' && cfg.participationMode === 'individual') continue;
    chosen.add(code);
  }

  if (!avoidSet.has('J')) chosen.add('J');
  if (!avoidSet.has('M')) chosen.add('M');

  const orderedCodes: YouthSectionCode[] = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'L', 'J', 'K', 'M',
  ];
  return orderedCodes.filter((c) => chosen.has(c));
}

function buildWeeklyDigest(db: ReturnType<YouthSocietyRoutesDeps['getDb']>) {
  const history = (db.youthSocietyHistory || []).slice(0, 12);
  const programs = Object.values(db.youthSocietyPrograms || {})
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 10);
  const satPrograms = Object.values(db.saturdayPrograms || {})
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 6);

  const usedThemes = Array.from(
    new Set([
      ...history.map((h) => h.centralTheme),
      ...programs.map((p) => p.centralTheme),
      ...satPrograms.map((s) => s.centralTheme),
    ].filter(Boolean))
  ).slice(0, 12);

  const usedActivities = Array.from(
    new Set([
      ...history.flatMap((h) => h.completedActivities.map((a) => a.title)),
      ...programs.flatMap((p) => p.activities.map((a) => a.title)),
      ...satPrograms.flatMap((s) => s.activities.map((a) => a.title)),
    ].filter(Boolean))
  ).slice(0, 24);

  const usedGames = Array.from(
    new Set([
      ...history.flatMap((h) => h.gamesUsed.map((g) => `${g.mode}:${g.title}`)),
    ])
  ).slice(0, 12);

  return { usedThemes, usedActivities, usedGames };
}

function computeStats(db: ReturnType<YouthSocietyRoutesDeps['getDb']>): YouthSocietyStatsSummary {
  const programs = Object.values(db.youthSocietyPrograms || {});
  const history = db.youthSocietyHistory || [];

  const counts: Record<YouthSectionCode, number> = {
    A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0, J: 0, K: 0, L: 0, M: 0,
  };

  let totalActs = 0;
  for (const h of history) {
    for (const a of h.completedActivities || []) {
      if (VALID_SECTION_CODES.has(a.sectionCode)) {
        counts[a.sectionCode] += 1;
        totalActs += 1;
      }
    }
  }
  if (totalActs === 0) {
    for (const p of programs) {
      for (const a of p.activities || []) {
        if (VALID_SECTION_CODES.has(a.sectionCode)) {
          counts[a.sectionCode] += 1;
          totalActs += 1;
        }
      }
    }
  }

  const sectionFrequency = YOUTH_SECTIONS.map((s) => ({
    code: s.code,
    label: s.label,
    count: counts[s.code],
    sharePercent: totalActs > 0 ? Math.round((counts[s.code] / totalActs) * 100) : 0,
  }));

  const sortedByLeast = [...sectionFrequency].sort((a, b) => a.count - b.count);
  const underusedSections = sortedByLeast.slice(0, 5).map((s) => s.code);
  const digest = buildWeeklyDigest(db);

  return {
    totalProgramsCreated: programs.length,
    totalExecutedPrograms: history.length,
    sectionFrequency,
    underusedSections,
    recentThemes: digest.usedThemes.slice(0, 6),
    recentGames: digest.usedGames.slice(0, 6),
  };
}

function computeRepetitionWarnings(
  plan: { centralTheme: string; activities: YouthProgramActivityItem[] },
  digest: { usedThemes: string[]; usedActivities: string[] }
): string[] {
  const warnings: string[] = [];
  const themeNorm = plan.centralTheme.toLowerCase().trim();
  if (
    themeNorm &&
    digest.usedThemes.some((t) => t.toLowerCase().trim() === themeNorm)
  ) {
    warnings.push(`El tema "${plan.centralTheme}" ya fue utilizado en programas previos.`);
  }
  const prevSet = new Set(digest.usedActivities.map((t) => t.toLowerCase().trim()));
  for (const a of plan.activities) {
    if (prevSet.has(a.title.toLowerCase().trim())) {
      warnings.push(`La actividad "${a.title}" apareció en un programa anterior.`);
    }
  }
  return warnings;
}

function pickAnchorForTheme(themeInput: string, usedThemes: string[]) {
  if (themeInput) {
    const low = themeInput.toLowerCase();
    const matched = VERIFIED_BIBLICAL_ANCHORS.find(
      (a) =>
        a.theme.toLowerCase().includes(low) ||
        a.reference.toLowerCase().includes(low)
    );
    if (matched) return matched;
  }
  const usedLower = new Set(usedThemes.map((t) => t.toLowerCase()));
  return (
    VERIFIED_BIBLICAL_ANCHORS.find((a) => !usedLower.has(a.theme.toLowerCase())) ||
    VERIFIED_BIBLICAL_ANCHORS[Math.floor(Math.random() * VERIFIED_BIBLICAL_ANCHORS.length)]
  );
}

function buildCuratedActivity(
  code: YouthSectionCode,
  idx: number,
  anchor: (typeof VERIFIED_BIBLICAL_ANCHORS)[number],
  cfg: YouthProgramConfigInput,
  usedTitlesLower: Set<string>
): YouthProgramActivityItem {
  const meta = getSectionMeta(code);
  const modeHint =
    cfg.participationMode === 'equipos'
      ? 'en equipos'
      : cfg.participationMode === 'parejas'
        ? 'en parejas'
        : 'de manera individual';

  const curatedBySection: Record<
    YouthSectionCode,
    Array<{
      title: string;
      description: string;
      materials: string;
      director: string;
      participant: string;
      transition: string;
      contentType: YouthBiblicalContentType;
      gameMode?: GameMode;
      requiresOnsite?: boolean;
    }>
  > = {
    A: [
      {
        title: 'Bienvenida de Conexión y Versículo Vivo',
        description: `Recepción cálida ${modeHint} donde cada joven comparte su nombre y una palabra clave ligada a ${anchor.reference}.`,
        materials: 'Tarjetas o micrófono',
        director: 'Recibe con entusiasmo, presenta el tema del día y organiza los grupos iniciales.',
        participant: 'Saluda a dos personas que no hayas saludado hoy y comparte qué esperas de este sábado.',
        transition: 'Ahora que nos saludamos, unamos nuestras voces en alabanza a Dios.',
        contentType: 'dinamica_practica',
      },
      {
        title: 'Rompehielos: Cadena de Testimonios Breves',
        description: `Dinámica ágil ${modeHint} compartiendo en 15 segundos un motivo de gratitud de esta semana.`,
        materials: 'Cronómetro visible en pantalla',
        director: 'Marca el ritmo con energía para incluir a invitados y nuevos jóvenes.',
        participant: 'Comparte en una frase algo por lo que agradeces a Dios esta semana.',
        transition: 'Con corazones agradecidos pasamos al tiempo de adoración.',
        contentType: 'dinamica_practica',
      },
    ],
    B: [
      {
        title: 'Alabanza Participativa y Lectura Antifonal',
        description: `Bloque de cantos juveniles alternando la lectura de ${anchor.reference} en voz congregacional.`,
        materials: 'Letras proyectadas y equipo de sonido',
        director: 'Coordina con el grupo de alabanza dos cantos alegres y uno de adoración.',
        participant: 'Participa cantando y lee en voz alta las frases clave del pasaje bíblico.',
        transition: 'Preparamos el ánimo para la siguiente dinámica interactiva.',
        contentType: 'texto_biblico_literal',
      },
    ],
    C: [
      {
        title: 'Reto Relámpago de Aplicación Bíblica',
        description: `Desafío sabatino ${modeHint} representando o respondiendo situaciones reales a la luz de ${anchor.reference}.`,
        materials: 'Sala de Retos del Sábado o tarjetas',
        director: 'Lanza el reto desde la plataforma y valida el cumplimiento presencial.',
        participant: 'Colabora rápidamente con tu grupo para presentar la respuesta antes de que termine el reloj.',
        transition: 'Excelente creatividad. Continuamos con la siguiente experiencia del programa.',
        contentType: 'dinamica_practica',
        gameMode: 'retos_sabado',
        requiresOnsite: true,
      },
    ],
    D: [
      {
        title: 'Ruleta Juvenil de Desafíos y Preguntas',
        description: `Giros en vivo en pantalla grande combinando preguntas bíblicas, mímica, alabanza y versículos sorpresa.`,
        materials: 'Módulo Ruleta del Sábado en proyección',
        director: 'Controla los giros en pantalla y otorga los puntos según la participación.',
        participant: 'Atento al segmento seleccionado por la ruleta para participar con entusiasmo.',
        transition: 'Después de la ruleta avanzamos al bloque central bíblico.',
        contentType: 'dinamica_practica',
        gameMode: 'ruleta_sabado',
        requiresOnsite: true,
      },
    ],
    E: [
      {
        title: `Trivia Interactiva: ${anchor.theme}`,
        description: `Partida en vivo desde celulares (${cfg.difficulty}) usando el banco oficial con código QR y puntuación automática.`,
        materials: 'Celulares de participantes y pantalla de proyección',
        director: 'Lanza la sala oficial de Dime Tú Qué Dices y proyecta el código QR de ingreso.',
        participant: 'Escanea el código QR o ingresa el código de sala con tu avatar para responder.',
        transition: '¡Gran participación! Pasamos del juego a la reflexión del pasaje.',
        contentType: 'dinamica_practica',
        gameMode: cfg.experienceType === 'educativa' ? 'quien_soy' : 'clasico',
      },
    ],
    F: [
      {
        title: 'Duelo Bíblico 1 contra 1 en Vivo',
        description: `Representantes compiten en rondas rápidas de precisión bíblica bajo el reloj oficial.`,
        materials: 'Sala Batalla 1v1 en Dime Tú Qué Dices',
        director: 'Invita a dos voluntarios por ronda y proyecta el marcador en tiempo real.',
        participant: 'Apoya a tu representante y prepárate para la siguiente ronda.',
        transition: 'Agradecemos a quienes pasaron al frente y seguimos adelante.',
        contentType: 'dinamica_practica',
        gameMode: 'batalla_1v1',
      },
    ],
    G: [
      {
        title: 'Gran Competencia por Equipos Bíblicos',
        description: `Los ${cfg.estimatedParticipants} participantes se dividen en equipos para sumar puntos grupales en tiempo real.`,
        materials: 'Módulo Competencia por Equipos y proyección',
        director: 'Asigna los equipos con colores definidos y coordina el marcador grupal.',
        participant: 'Únete a tu equipo escaneando el QR y apoya en cada pregunta.',
        transition: 'Cerramos el marcador grupal y dirigimos la mirada a la historia bíblica.',
        contentType: 'dinamica_practica',
        gameMode: 'competencia_equipos',
      },
    ],
    H: [
      {
        title: 'Aventura Bíblica: Decisiones bajo Presión',
        description: `Adaptación narrativa interactiva por escenas donde los jóvenes eligen la respuesta fiel a la Escritura.`,
        materials: 'Módulo Aventuras Bíblicas en pantalla',
        director: 'Lee cada escena, abre la votación y explica la base bíblica de cada consecuencia.',
        participant: 'Analiza la situación junto al grupo y elige la decisión bíblica correcta.',
        transition: 'Esta historia nos prepara directamente para la reflexión espiritual del día.',
        contentType: 'adaptacion_narrativa',
        gameMode: 'aventuras_biblicas',
      },
    ],
    I: [
      {
        title: 'Espacio de Talentos Juveniles con Propósito',
        description: `Presentaciones musicales, declamación o dramatización breve alineadas con "${anchor.theme}".`,
        materials: 'Módulo Talentos Juveniles y micrófonos',
        director: 'Presenta a cada participante, habilita votos positivos y entrega reconocimiento.',
        participant: 'Apoya con respeto y envía votos constructivos desde tu dispositivo.',
        transition: 'Damos gracias a Dios por estos dones y escuchamos Su Palabra.',
        contentType: 'dinamica_practica',
        gameMode: 'talentos_juveniles',
        requiresOnsite: true,
      },
    ],
    J: [
      {
        title: `Reflexión Central: ${anchor.reference}`,
        description: `${anchor.reflectionGuide} Incluye lectura literal del texto y diálogo breve con los jóvenes.`,
        materials: 'Biblias abiertas y texto proyectado',
        director: 'Lee el texto bíblico literal primero, explica el contexto y formula una pregunta de reflexión.',
        participant: 'Sigue la lectura en tu Biblia y comparte una aplicación personal breve.',
        transition: 'Llevemos esta verdad a la práctica durante toda la semana.',
        contentType: 'texto_biblico_literal',
      },
    ],
    K: [
      {
        title: 'Misión Juvenil de la Semana',
        description: `${anchor.weeklyChallengeGuide} Registro voluntario de compromiso en la plataforma.`,
        materials: 'Módulo Misión de la Semana',
        director: 'Presenta la misión práctica y anima a cada joven o equipo a registrarse.',
        participant: 'Escoge tu modo de participación (individual o grupal) y asume el reto semanal.',
        transition: 'Nos encaminamos al cierre con espíritu de servicio.',
        contentType: 'dinamica_practica',
        requiresOnsite: true,
      },
    ],
    L: [
      {
        title: 'Cabina de Sorpresas del Sábado',
        description: `Momento inesperado en vivo revelando una dinámica, versículo o testimonio de la caja misteriosa.`,
        materials: 'Cabina de Sorpresas en pantalla',
        director: 'Pulsa Revelar Sorpresa en el momento clave y registra el resultado.',
        participant: '¡Prepárate! Cualquiera puede ser llamado a cumplir la sorpresa en vivo.',
        transition: 'Qué gran sorpresa. Vamos cerrando nuestro programa de hoy.',
        contentType: 'dinamica_practica',
        requiresOnsite: true,
      },
    ],
    M: [
      {
        title: 'Desafío Semanal, Oración y Despedida',
        description: `${anchor.applicationGuide} Oración grupal de envío y confraternidad final.`,
        materials: 'Resumen proyectado en pantalla',
        director: 'Resume el compromiso semanal, dirige la oración final y agradece a los equipos.',
        participant: 'Anota el desafío de la semana y despídete orando por un compañero.',
        transition: 'Fin del programa. ¡Nos vemos el próximo sábado!',
        contentType: 'texto_biblico_literal',
      },
    ],
  };

  const options = curatedBySection[code] || curatedBySection.A;
  const picked =
    options.find((o) => !usedTitlesLower.has(o.title.toLowerCase())) || options[0];

  return {
    id: `YSA-${Date.now().toString(36)}-${idx + 1}`,
    order: idx + 1,
    sectionCode: code,
    sectionLabel: meta.label,
    title: picked.title,
    description: picked.description,
    durationMin: meta.defaultDurationMin,
    materials: picked.materials,
    directorInstructions: picked.director,
    participantInstructions: picked.participant,
    transitionText: picked.transition,
    biblicalReference: anchor.reference,
    scripturalText: anchor.literalVerse,
    contentType: picked.contentType,
    directorReviewed: code !== 'J' && code !== 'H',
    soundMood: meta.defaultMood,
    ...(picked.gameMode ? { linkedGameMode: picked.gameMode } : {}),
    ...(picked.requiresOnsite ? { requiresOnsiteValidation: true } : {}),
    status: 'pendiente',
  };
}

function buildPlanEnvelope(
  id: string,
  cfg: YouthProgramConfigInput,
  activities: YouthProgramActivityItem[],
  fields: {
    creativeName: string;
    centralTheme: string;
    mainBibleText: string;
    mainBibleVerseQuote: string;
    spiritualObjective: string;
    introduction: string;
    welcomeSpeech: string;
    biblicalReflection: string;
    practicalApplication: string;
    weeklyChallenge: string;
    closing: string;
    varietySummary: string;
  },
  source: 'gemini_ai' | 'curated_library',
  digest: { usedThemes: string[]; usedActivities: string[] }
): YouthProgramPlan {
  const balanced = rebalanceYouthActivities(activities, cfg.durationMinutes);
  const totalDurationMin = balanced.reduce((s, a) => s + a.durationMin, 0);
  const now = Date.now();
  const plan: YouthProgramPlan = {
    id,
    ...fields,
    config: cfg,
    activities: balanced,
    totalDurationMin,
    status: 'draft',
    generationSource: source,
    repetitionWarnings: computeRepetitionWarnings(
      { centralTheme: fields.centralTheme, activities: balanced },
      digest
    ),
    directorObservations: '',
    liveState: {
      playbackStatus: 'preparacion',
      currentActivityIndex: 0,
      timerRunning: false,
      timerEndsAt: null,
      timerPausedRemainingSec: balanced[0] ? balanced[0].durationMin * 60 : 0,
      activeSurprise: null,
      soundCueNonce: 0,
      lastSoundMood: balanced[0]?.soundMood || 'bienvenida',
    },
    createdAt: now,
    updatedAt: now,
  };
  return plan;
}

function buildLiveProjectionPayload(
  program: YouthProgramPlan,
  db: ReturnType<YouthSocietyRoutesDeps['getDb']>,
  deps: YouthSocietyRoutesDeps
) {
  const now = Date.now();
  const idx = Math.min(
    Math.max(0, program.liveState.currentActivityIndex),
    Math.max(0, program.activities.length - 1)
  );
  const currentActivity = program.activities[idx] || null;
  const nextActivity = program.activities[idx + 1] || null;

  let remainingSec = 0;
  if (
    program.liveState.playbackStatus === 'pausado' &&
    typeof program.liveState.timerPausedRemainingSec === 'number'
  ) {
    remainingSec = Math.max(0, Math.round(program.liveState.timerPausedRemainingSec));
  } else if (
    program.liveState.timerRunning &&
    typeof program.liveState.timerEndsAt === 'number'
  ) {
    remainingSec = Math.max(0, Math.ceil((program.liveState.timerEndsAt - now) / 1000));
  } else if (typeof program.liveState.timerPausedRemainingSec === 'number') {
    remainingSec = Math.max(0, Math.round(program.liveState.timerPausedRemainingSec));
  } else if (currentActivity) {
    remainingSec = currentActivity.durationMin * 60;
  }

  let linkedLiveGame: {
    code: string;
    gameId: string;
    title: string;
    modeLabel: string;
    status: string;
    participantCount: number;
    leaderboardTop: Array<{ name: string; score: number; correctCount: number }>;
    teamTop: Array<{ name: string; color: string; score: number; memberCount: number }>;
  } | null = null;

  if (currentActivity?.linkedGameCode) {
    const g =
      db.games?.[currentActivity.linkedGameCode] ||
      Object.values(db.archivedGames || {}).find(
        (ag: any) => ag.code === currentActivity.linkedGameCode
      );
    if (g) {
      const lb = deps.buildGameLeaderboard(g);
      const tlb = deps.buildGameTeamLeaderboard(g);
      linkedLiveGame = {
        code: g.code,
        gameId: g.id,
        title: g.config?.title || g.code,
        modeLabel: GAME_MODE_INFO[g.config?.mode as GameMode]?.name || String(g.config?.mode || ''),
        status: g.status,
        participantCount: Object.keys(g.participants || {}).length,
        leaderboardTop: lb.slice(0, 8).map((e) => ({
          name: e.name,
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

  return {
    program,
    remainingSec,
    serverNow: now,
    currentActivity,
    nextActivity,
    linkedLiveGame,
  };
}

export function broadcastYouthProgram(
  programId: string,
  db: ReturnType<YouthSocietyRoutesDeps['getDb']>,
  deps: YouthSocietyRoutesDeps
): void {
  const program = db.youthSocietyPrograms?.[programId];
  const clients = ysSocketsByProgram.get(programId);
  if (!program || !clients) return;
  const payload = buildLiveProjectionPayload(program, db, deps);
  const raw = JSON.stringify({ type: 'ys_state', payload });
  for (const c of clients) {
    if (c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(raw);
    }
  }
}

export function handleYouthSocietyWsMessage(
  ws: WebSocket,
  msg: Record<string, unknown>,
  db: ReturnType<YouthSocietyRoutesDeps['getDb']>,
  deps: YouthSocietyRoutesDeps
): boolean {
  if (msg.type !== 'ys_subscribe') return false;
  const programId = String(msg.programId || '').trim();
  const program = db.youthSocietyPrograms?.[programId];
  if (!program) {
    ws.send(
      JSON.stringify({
        type: 'ys_error',
        message: 'No se encontró el programa de Mi Sociedad de Jóvenes.',
      })
    );
    return true;
  }
  const prev = ysSocketMetaMap.get(ws);
  if (prev) {
    ysSocketsByProgram.get(prev.programId)?.delete(prev);
  }
  const rawRole = String(msg.role || 'projector');
  const role: YouthSocketClient['role'] =
    rawRole === 'director' || rawRole === 'participant' ? rawRole : 'projector';
  const meta: YouthSocketClient = { ws, programId, role };
  ysSocketMetaMap.set(ws, meta);
  if (!ysSocketsByProgram.has(programId)) {
    ysSocketsByProgram.set(programId, new Set());
  }
  ysSocketsByProgram.get(programId)!.add(meta);

  ws.send(
    JSON.stringify({
      type: 'ys_state',
      payload: buildLiveProjectionPayload(program, db, deps),
    })
  );
  return true;
}

export function cleanupYouthSocietyWs(ws: WebSocket): void {
  const meta = ysSocketMetaMap.get(ws);
  if (!meta) return;
  ysSocketsByProgram.get(meta.programId)?.delete(meta);
  ysSocketMetaMap.delete(ws);
}

export function tickYouthSocietyTimers(
  db: ReturnType<YouthSocietyRoutesDeps['getDb']>,
  deps: YouthSocietyRoutesDeps
): void {
  const now = Date.now();
  for (const p of Object.values(db.youthSocietyPrograms || {})) {
    if (
      p.liveState?.playbackStatus === 'en_curso' &&
      p.liveState.timerRunning &&
      typeof p.liveState.timerEndsAt === 'number' &&
      now >= p.liveState.timerEndsAt
    ) {
      p.liveState.timerRunning = false;
      p.liveState.timerEndsAt = null;
      p.liveState.timerPausedRemainingSec = 0;
      p.liveState.soundCueNonce = (p.liveState.soundCueNonce || 0) + 1;
      p.liveState.lastSoundMood = 'cuenta_regresiva';
      p.updatedAt = now;
      deps.scheduleSave();
      broadcastYouthProgram(p.id, db, deps);
    }
  }
}

function recordHistoryForProgram(
  program: YouthProgramPlan,
  db: ReturnType<YouthSocietyRoutesDeps['getDb']>
): YouthProgramHistoryEntry {
  if (!Array.isArray(db.youthSocietyHistory)) db.youthSocietyHistory = [];
  const now = Date.now();
  const completedActivities = program.activities
    .filter((a) => a.status === 'completada' || a.status === 'en_curso')
    .map((a) => ({
      sectionCode: a.sectionCode,
      title: a.title,
      durationMin: a.durationMin,
      ...(a.onsiteResultNote ? { onsiteResultNote: a.onsiteResultNote } : {}),
    }));
  const skippedActivities = program.activities
    .filter((a) => a.status === 'omitida')
    .map((a) => ({
      sectionCode: a.sectionCode,
      title: a.title,
    }));

  const gamesUsed = program.activities
    .filter((a) => a.linkedGameMode || a.linkedGameCode)
    .map((a) => ({
      mode: String(a.linkedGameMode || 'presencial'),
      ...(a.linkedGameCode ? { code: a.linkedGameCode } : {}),
      title: a.title,
    }));

  const entry: YouthProgramHistoryEntry = {
    id: `YSH-${now.toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
    programId: program.id,
    date: program.config.scheduledDate,
    creativeName: program.creativeName,
    centralTheme: program.centralTheme,
    mainBibleText: program.mainBibleText,
    durationMinutes: program.totalDurationMin,
    experienceType: program.config.experienceType,
    participationMode: program.config.participationMode,
    estimatedParticipants: program.config.estimatedParticipants,
    completedActivities,
    skippedActivities,
    gamesUsed,
    challengesUsed: program.activities
      .filter((a) => a.sectionCode === 'C')
      .map((a) => a.title),
    roulettesUsed: program.activities
      .filter((a) => a.sectionCode === 'D')
      .map((a) => a.title),
    storiesUsed: program.activities
      .filter((a) => a.sectionCode === 'H')
      .map((a) => a.title),
    dynamicsUsed: program.activities
      .filter((a) => a.sectionCode === 'A' || a.sectionCode === 'L')
      .map((a) => a.title),
    resultsSummary:
      program.activities
        .filter((a) => a.onsiteResultNote)
        .map((a) => `${a.title}: ${a.onsiteResultNote}`)
        .join(' | ') || `${completedActivities.length} actividades realizadas.`,
    teamsSummary: [],
    directorObservations: program.directorObservations || '',
    recordedAt: now,
  };

  // Never overwrite other Saturdays' entries; update only if same programId already recorded
  const existingIdx = db.youthSocietyHistory.findIndex(
    (h) => h.programId === program.id
  );
  if (existingIdx >= 0) {
    db.youthSocietyHistory[existingIdx] = entry;
  } else {
    db.youthSocietyHistory.unshift(entry);
  }
  return entry;
}

export function registerYouthSocietyRoutes(
  app: express.Express,
  deps: YouthSocietyRoutesDeps
): void {
  const ensureDb = () => {
    const db = deps.getDb();
    if (!db.youthSocietyPrograms || typeof db.youthSocietyPrograms !== 'object') {
      db.youthSocietyPrograms = {};
    }
    if (!Array.isArray(db.youthSocietyHistory)) {
      db.youthSocietyHistory = [];
    }
    if (db.activeYouthSocietyProgramId === undefined) {
      db.activeYouthSocietyProgramId = null;
    }
    return db;
  };

  // 1. Director auth
  app.post('/api/mi-sociedad/auth/login', (req, res) => {
    const db = ensureDb();
    const pin = String(req.body?.pin || '').trim();
    const expected = db.weeklyDirectorSecret || 'SJ2026';
    if (!pin || !timingSafeMatch(pin, expected)) {
      res.status(401).json({ error: 'Clave de director incorrecta.' });
      return;
    }
    const token = computeYouthDirectorToken(
      db.serverSecret || 'dime-tu-youth-secret',
      expected
    );
    res.json({ role: 'director', token });
  });

  // 2. Overview + History + Statistics + Recoverable past activities
  app.get('/api/mi-sociedad/overview', (req, res) => {
    const db = ensureDb();
    const isDirector = isAuthorizedYouthDirector(req, db);
    const programs = Object.values(db.youthSocietyPrograms).sort(
      (a, b) => b.updatedAt - a.updatedAt
    );
    const history = [...db.youthSocietyHistory].sort(
      (a, b) => b.recordedAt - a.recordedAt
    );
    const stats = computeStats(db);

    const recoverableActivities = programs
      .slice(0, 12)
      .flatMap((p) =>
        p.activities.map((a) => ({
          sourceProgramId: p.id,
          sourceProgramName: p.creativeName,
          sourceDate: p.config.scheduledDate,
          activity: a,
        }))
      )
      .slice(0, 30);

    res.json({
      isDirector,
      activeProgramId: db.activeYouthSocietyProgramId || programs[0]?.id || null,
      programs,
      history,
      stats,
      recoverableActivities,
      presets: YOUTH_CONFIG_PRESETS,
      sections: YOUTH_SECTIONS,
    });
  });

  // 3. Intelligent Automatic Program Generator (AI Gemini OR explicit Curated Library mode)
  app.post('/api/mi-sociedad/generate', async (req, res) => {
    const db = ensureDb();
    if (!isAuthorizedYouthDirector(req, db)) {
      res.status(403).json({
        error: 'Solo un director autorizado puede generar y modificar programas automáticos.',
      });
      return;
    }

    const cfg = sanitizeConfig(req.body?.config || req.body);
    const engine: 'ai' | 'curated' =
      req.body?.engine === 'curated' ? 'curated' : 'ai';

    const stats = computeStats(db);
    const digest = buildWeeklyDigest(db);
    const sectionOrder = selectSectionsForProgram(cfg, stats);
    const id = `YSP-${Date.now().toString(36).toUpperCase()}-${crypto
      .randomBytes(2)
      .toString('hex')
      .toUpperCase()}`;

    if (engine === 'curated') {
      const anchor = pickAnchorForTheme(cfg.spiritualTheme, digest.usedThemes);
      const usedLower = new Set(digest.usedActivities.map((t) => t.toLowerCase()));
      const activities = sectionOrder.map((code, idx) =>
        buildCuratedActivity(code, idx, anchor, cfg, usedLower)
      );
      const plan = buildPlanEnvelope(
        id,
        cfg,
        activities,
        {
          creativeName: `Sábado Juvenil: ${anchor.theme}`,
          centralTheme: cfg.spiritualTheme || anchor.theme,
          mainBibleText: anchor.reference,
          mainBibleVerseQuote: anchor.literalVerse,
          spiritualObjective: anchor.objective,
          introduction: `Encuentro juvenil de ${cfg.durationMinutes} minutos diseñado para ${cfg.estimatedParticipants} jóvenes bajo enfoque ${cfg.experienceType} (${cfg.participationMode}).`,
          welcomeSpeech: `¡Bienvenidos a Sociedad de Jóvenes! Hoy celebramos la Palabra alrededor de ${anchor.reference} con dinámicas variadas y crecimiento espiritual.`,
          biblicalReflection: anchor.reflectionGuide,
          practicalApplication: anchor.applicationGuide,
          weeklyChallenge: anchor.weeklyChallengeGuide,
          closing: `Oremos juntos dando gracias por lo aprendido en ${anchor.reference} y comprometámonos a vivirlo esta semana.`,
          varietySummary: `Combinación equilibrada de ${sectionOrder.length} secciones (${sectionOrder.join(', ')}) basada en citas bíblicas verificadas y evitando ${digest.usedThemes.length} temas previos.`,
        },
        'curated_library',
        digest
      );

      db.youthSocietyPrograms[id] = plan;
      db.activeYouthSocietyProgramId = id;
      deps.scheduleSave();
      res.status(201).json({ program: plan });
      return;
    }

    // AI generation with @google/genai (strictly server-side)
    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'No se detectó GEMINI_API_KEY en el servidor. Configura la clave en Settings > Secrets o usa la opción "Generar con Biblioteca Curada".',
      });
      return;
    }

    const sectionGuide = sectionOrder
      .map((c) => {
        const meta = getSectionMeta(c);
        return `- Sección ${c} (${meta.label}): ref ${meta.defaultDurationMin} min${meta.suggestedGameModes ? ` · modalidades sugeridas: ${meta.suggestedGameModes.join(', ')}` : ''}`;
      })
      .join('\n');

    const prompt = `Diseña un programa completo, equilibrado, bíblico y juvenil para la Sociedad de Jóvenes de una iglesia cristiana para el sábado ${cfg.scheduledDate}.

CONFIGURACIÓN DEL DIRECTOR:
- Duración total EXACTA: ${cfg.durationMinutes} minutos.
- Participantes aproximados: ${cfg.estimatedParticipants} personas.
- Modalidad: ${cfg.participationMode}.
- Dificultad bíblica: ${cfg.difficulty}.
- Tema espiritual solicitado: ${cfg.spiritualTheme || 'Elige un tema espiritual fresco que NO esté en el historial reciente'}.
- Tipo de experiencia: ${cfg.experienceType}.

MEMORIA SEMANAL (PROHIBIDO REPETIR):
- Temas recientes usados: ${digest.usedThemes.join(' | ') || 'Ninguno aún'}
- Actividades recientes usadas: ${digest.usedActivities.slice(0, 14).join(' | ') || 'Ninguna aún'}

SECCIONES SELECCIONADAS (genera exactamente una actividad para cada una en este orden):
${sectionGuide}

REGLAS DE CONTENIDO BÍBLICO CONFIABLE:
- PROHIBIDO inventar citas bíblicas o textos falsos. Usa citas reales y fieles de la Biblia Reina-Valera 1960.
- En cada actividad indica "contentType": "texto_biblico_literal" cuando cites versículos literales, "adaptacion_narrativa" cuando sea un relato dramatizado o historia adaptada, o "dinamica_practica" cuando sea dinámica participativa.
- No hagas un programa únicamente de preguntas bíblicas ni competencias; equilibra diversión, aprendizaje, participación y crecimiento espiritual.
- La suma de durationMin debe aproximarse a ${cfg.durationMinutes} minutos.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'Eres un coordinador experto de Sociedad de Jóvenes cristiana. Entregas programas juveniles creativos, doctrinalmente fieles y variados en JSON estricto en español.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              creativeName: { type: Type.STRING },
              centralTheme: { type: Type.STRING },
              mainBibleText: { type: Type.STRING },
              mainBibleVerseQuote: { type: Type.STRING },
              spiritualObjective: { type: Type.STRING },
              introduction: { type: Type.STRING },
              welcomeSpeech: { type: Type.STRING },
              biblicalReflection: { type: Type.STRING },
              practicalApplication: { type: Type.STRING },
              weeklyChallenge: { type: Type.STRING },
              closing: { type: Type.STRING },
              activities: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sectionCode: { type: Type.STRING },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    durationMin: { type: Type.INTEGER },
                    materials: { type: Type.STRING },
                    directorInstructions: { type: Type.STRING },
                    participantInstructions: { type: Type.STRING },
                    transitionText: { type: Type.STRING },
                    biblicalReference: { type: Type.STRING },
                    scripturalText: { type: Type.STRING },
                    contentType: { type: Type.STRING },
                  },
                  required: [
                    'sectionCode',
                    'title',
                    'description',
                    'durationMin',
                    'materials',
                    'directorInstructions',
                    'participantInstructions',
                    'transitionText',
                    'biblicalReference',
                    'scripturalText',
                    'contentType',
                  ],
                },
              },
            },
            required: [
              'creativeName',
              'centralTheme',
              'mainBibleText',
              'mainBibleVerseQuote',
              'spiritualObjective',
              'introduction',
              'welcomeSpeech',
              'biblicalReflection',
              'practicalApplication',
              'weeklyChallenge',
              'closing',
              'activities',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as any;
      const rawActs = Array.isArray(parsed.activities) ? parsed.activities : [];

      const mapped: YouthProgramActivityItem[] = sectionOrder.map((code, idx) => {
        const meta = getSectionMeta(code);
        const found =
          rawActs.find(
            (a: any) => String(a?.sectionCode || '').toUpperCase().trim() === code
          ) ||
          rawActs[idx] ||
          {};
        const rawCt = String(found.contentType || '');
        const contentType: YouthBiblicalContentType =
          rawCt === 'texto_biblico_literal' || rawCt === 'adaptacion_narrativa'
            ? rawCt
            : 'dinamica_practica';

        return {
          id: `YSA-${Date.now().toString(36)}-${idx + 1}`,
          order: idx + 1,
          sectionCode: code,
          sectionLabel: meta.label,
          title: String(found.title || meta.label).trim().slice(0, 140),
          description: String(found.description || meta.description).trim().slice(0, 700),
          durationMin: Math.max(2, Math.round(Number(found.durationMin) || meta.defaultDurationMin)),
          materials: String(found.materials || 'Biblias y proyección').trim().slice(0, 200),
          directorInstructions: String(found.directorInstructions || '').trim().slice(0, 450),
          participantInstructions: String(found.participantInstructions || '').trim().slice(0, 450),
          transitionText: String(found.transitionText || '').trim().slice(0, 260),
          biblicalReference: String(found.biblicalReference || parsed.mainBibleText || '1 Timoteo 4:12').trim().slice(0, 100),
          scripturalText: String(found.scripturalText || '').trim().slice(0, 500),
          contentType,
          directorReviewed: false,
          soundMood: meta.defaultMood,
          ...(meta.suggestedGameModes?.[0]
            ? { linkedGameMode: meta.suggestedGameModes[0] }
            : {}),
          ...(code === 'C' || code === 'D' || code === 'I' || code === 'K' || code === 'L'
            ? { requiresOnsiteValidation: true }
            : {}),
          status: 'pendiente',
        };
      });

      const plan = buildPlanEnvelope(
        id,
        cfg,
        mapped,
        {
          creativeName: String(parsed.creativeName || 'Sábado de Jóvenes en Acción').trim(),
          centralTheme: String(parsed.centralTheme || cfg.spiritualTheme || 'Fe viva').trim(),
          mainBibleText: String(parsed.mainBibleText || '1 Timoteo 4:12').trim(),
          mainBibleVerseQuote: String(parsed.mainBibleVerseQuote || '').trim(),
          spiritualObjective: String(parsed.spiritualObjective || '').trim(),
          introduction: String(parsed.introduction || '').trim(),
          welcomeSpeech: String(parsed.welcomeSpeech || '').trim(),
          biblicalReflection: String(parsed.biblicalReflection || '').trim(),
          practicalApplication: String(parsed.practicalApplication || '').trim(),
          weeklyChallenge: String(parsed.weeklyChallenge || '').trim(),
          closing: String(parsed.closing || '').trim(),
          varietySummary: `Generado con IA evitando ${digest.usedThemes.length} temas y ${digest.usedActivities.length} actividades recientes.`,
        },
        'gemini_ai',
        digest
      );

      db.youthSocietyPrograms[id] = plan;
      db.activeYouthSocietyProgramId = id;
      deps.scheduleSave();
      res.status(201).json({ program: plan });
    } catch (err) {
      const mapped = mapGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // 4. Editor updates (even while live without losing execution state or results)
  app.put('/api/mi-sociedad/programs/:id', (req, res) => {
    const db = ensureDb();
    if (!isAuthorizedYouthDirector(req, db)) {
      res.status(403).json({ error: 'Solo un director autorizado puede modificar el programa.' });
      return;
    }

    const id = String(req.params.id || '').trim();
    const existing = db.youthSocietyPrograms[id];
    if (!existing) {
      res.status(404).json({ error: 'Programa no encontrado.' });
      return;
    }

    const body = req.body || {};
    if (typeof body.creativeName === 'string' && body.creativeName.trim()) {
      existing.creativeName = body.creativeName.trim().slice(0, 140);
    }
    if (typeof body.centralTheme === 'string' && body.centralTheme.trim()) {
      existing.centralTheme = body.centralTheme.trim().slice(0, 140);
    }
    if (typeof body.mainBibleText === 'string' && body.mainBibleText.trim()) {
      existing.mainBibleText = body.mainBibleText.trim().slice(0, 100);
    }
    if (typeof body.mainBibleVerseQuote === 'string') {
      existing.mainBibleVerseQuote = body.mainBibleVerseQuote.trim().slice(0, 500);
    }
    if (typeof body.spiritualObjective === 'string') {
      existing.spiritualObjective = body.spiritualObjective.trim().slice(0, 400);
    }
    if (typeof body.introduction === 'string') {
      existing.introduction = body.introduction.trim().slice(0, 600);
    }
    if (typeof body.welcomeSpeech === 'string') {
      existing.welcomeSpeech = body.welcomeSpeech.trim().slice(0, 600);
    }
    if (typeof body.biblicalReflection === 'string') {
      existing.biblicalReflection = body.biblicalReflection.trim().slice(0, 1200);
    }
    if (typeof body.practicalApplication === 'string') {
      existing.practicalApplication = body.practicalApplication.trim().slice(0, 600);
    }
    if (typeof body.weeklyChallenge === 'string') {
      existing.weeklyChallenge = body.weeklyChallenge.trim().slice(0, 500);
    }
    if (typeof body.closing === 'string') {
      existing.closing = body.closing.trim().slice(0, 500);
    }
    if (typeof body.directorObservations === 'string') {
      existing.directorObservations = body.directorObservations.trim().slice(0, 1000);
    }
    if (body.status === 'draft' || body.status === 'final') {
      existing.status = body.status;
    }

    if (Array.isArray(body.activities)) {
      const prevById = new Map(existing.activities.map((a) => [a.id, a]));
      existing.activities = body.activities.map((rawAct: any, idx: number) => {
        const old = prevById.get(String(rawAct?.id || ''));
        const codeRaw = String(rawAct?.sectionCode || old?.sectionCode || 'A')
          .toUpperCase()
          .trim() as YouthSectionCode;
        const sectionCode: YouthSectionCode = VALID_SECTION_CODES.has(codeRaw)
          ? codeRaw
          : 'A';
        const meta = getSectionMeta(sectionCode);
        const moodRaw = String(rawAct?.soundMood || meta.defaultMood) as YouthSoundMood;
        const statusRaw = String(
          rawAct?.status || old?.status || 'pendiente'
        ) as YouthActivityExecutionStatus;

        return {
          id: String(rawAct?.id || `YSA-${Date.now().toString(36)}-${idx + 1}`),
          order: idx + 1,
          sectionCode,
          sectionLabel: meta.label,
          title: String(rawAct?.title || meta.label).trim().slice(0, 140),
          description: String(rawAct?.description || '').trim().slice(0, 700),
          durationMin: Math.max(1, Math.min(90, Math.round(Number(rawAct?.durationMin) || 5))),
          materials: String(rawAct?.materials || '').trim().slice(0, 200),
          directorInstructions: String(rawAct?.directorInstructions || '').trim().slice(0, 450),
          participantInstructions: String(rawAct?.participantInstructions || '').trim().slice(0, 450),
          transitionText: String(rawAct?.transitionText || '').trim().slice(0, 260),
          biblicalReference: String(rawAct?.biblicalReference || existing.mainBibleText).trim().slice(0, 100),
          scripturalText: String(rawAct?.scripturalText || '').trim().slice(0, 500),
          contentType:
            rawAct?.contentType === 'texto_biblico_literal' ||
            rawAct?.contentType === 'adaptacion_narrativa'
              ? rawAct.contentType
              : 'dinamica_practica',
          directorReviewed: Boolean(rawAct?.directorReviewed),
          soundMood: VALID_MOODS.has(moodRaw) ? moodRaw : meta.defaultMood,
          ...(rawAct?.linkedGameMode ? { linkedGameMode: rawAct.linkedGameMode as GameMode } : {}),
          ...(rawAct?.linkedGameCode || old?.linkedGameCode
            ? { linkedGameCode: String(rawAct?.linkedGameCode || old?.linkedGameCode) }
            : {}),
          ...(rawAct?.linkedGameId || old?.linkedGameId
            ? { linkedGameId: String(rawAct?.linkedGameId || old?.linkedGameId) }
            : {}),
          ...(rawAct?.linkedInvitePath || old?.linkedInvitePath
            ? { linkedInvitePath: String(rawAct?.linkedInvitePath || old?.linkedInvitePath) }
            : {}),
          requiresOnsiteValidation: Boolean(rawAct?.requiresOnsiteValidation),
          onsiteValidated: old?.onsiteValidated ?? Boolean(rawAct?.onsiteValidated),
          ...(old?.onsiteResultNote || rawAct?.onsiteResultNote
            ? { onsiteResultNote: String(old?.onsiteResultNote || rawAct?.onsiteResultNote) }
            : {}),
          status:
            statusRaw === 'completada' ||
            statusRaw === 'omitida' ||
            statusRaw === 'en_curso'
              ? statusRaw
              : 'pendiente',
        };
      });
      existing.totalDurationMin = existing.activities.reduce(
        (sum, a) => sum + a.durationMin,
        0
      );
      if (existing.liveState.currentActivityIndex >= existing.activities.length) {
        existing.liveState.currentActivityIndex = Math.max(
          0,
          existing.activities.length - 1
        );
      }
    }

    existing.updatedAt = Date.now();
    db.activeYouthSocietyProgramId = id;
    deps.scheduleSave();
    broadcastYouthProgram(id, db, deps);
    res.json({ program: existing });
  });

  // 5. "REEMPLAZAR ESTA ACTIVIDAD" -> 3 same-duration & same-section alternatives
  app.post('/api/mi-sociedad/suggest-replacements', async (req, res) => {
    const db = ensureDb();
    if (!isAuthorizedYouthDirector(req, db)) {
      res.status(403).json({ error: 'Acceso exclusivo de director.' });
      return;
    }

    const codeRaw = String(req.body?.sectionCode || 'A').toUpperCase().trim() as YouthSectionCode;
    const sectionCode: YouthSectionCode = VALID_SECTION_CODES.has(codeRaw) ? codeRaw : 'A';
    const meta = getSectionMeta(sectionCode);
    const durationMin = Math.max(2, Math.round(Number(req.body?.durationMin) || meta.defaultDurationMin));
    const currentTitle = String(req.body?.currentTitle || '').trim();
    const centralTheme = String(req.body?.centralTheme || 'Fe Juvenil').trim();
    const digest = buildWeeklyDigest(db);

    const ai = createGeminiClient();
    if (ai && req.body?.useAi !== false) {
      try {
        const resp = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Sugiere exactamente 3 alternativas frescas en español para la sección ${sectionCode} (${meta.label}) de ${durationMin} minutos sobre el tema "${centralTheme}". NO repitas "${currentTitle}" ni estas actividades previas: ${digest.usedActivities.slice(0, 12).join(', ')}. Incluye referencia bíblica real.`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  materials: { type: Type.STRING },
                  directorInstructions: { type: Type.STRING },
                  participantInstructions: { type: Type.STRING },
                  biblicalReference: { type: Type.STRING },
                },
                required: [
                  'title',
                  'description',
                  'materials',
                  'directorInstructions',
                  'participantInstructions',
                  'biblicalReference',
                ],
              },
            },
          },
        });
        const arr = JSON.parse((resp.text ?? '[]').trim());
        if (Array.isArray(arr) && arr.length > 0) {
          res.json({
            alternatives: arr.slice(0, 3).map((item: any) => ({
              sectionCode,
              durationMin,
              title: String(item.title || meta.label),
              description: String(item.description || ''),
              materials: String(item.materials || 'Biblias'),
              directorInstructions: String(item.directorInstructions || ''),
              participantInstructions: String(item.participantInstructions || ''),
              biblicalReference: String(item.biblicalReference || '1 Timoteo 4:12'),
            })),
          });
          return;
        }
      } catch {
        // Fall through cleanly to curated alternatives below if AI fails
      }
    }

    const usedLower = new Set([
      currentTitle.toLowerCase(),
      ...digest.usedActivities.map((t) => t.toLowerCase()),
    ]);
    const anchors = VERIFIED_BIBLICAL_ANCHORS.slice(0, 3);
    const curatedAlts = anchors.map((anc, i) => {
      const dummyCfg: YouthProgramConfigInput = {
        durationMinutes: 90,
        estimatedParticipants: 30,
        participationMode: i === 1 ? 'equipos' : 'parejas',
        difficulty: 'combinado',
        spiritualTheme: centralTheme,
        experienceType: 'combinada',
        includeSections: [sectionCode],
        avoidSections: [],
        includeCompetitions: true,
        includeTalents: true,
        includeMission: true,
        scheduledDate: getUpcomingSaturdayIso(),
        directorName: 'Dirección Juvenil',
      };
      const built = buildCuratedActivity(sectionCode, i, anc, dummyCfg, usedLower);
      return {
        sectionCode,
        durationMin,
        title: `${built.title} (${anc.reference})`,
        description: built.description,
        materials: built.materials,
        directorInstructions: built.directorInstructions,
        participantInstructions: built.participantInstructions,
        biblicalReference: anc.reference,
        scripturalText: anc.literalVerse,
      };
    });

    res.json({ alternatives: curatedAlts });
  });

  // 6. "SORPRÉNDEME" -> swap an activity with an unexpected non-repeated activity preserving duration
  app.post('/api/mi-sociedad/surprise-activity', (req, res) => {
    const db = ensureDb();
    if (!isAuthorizedYouthDirector(req, db)) {
      res.status(403).json({ error: 'Acceso exclusivo de director.' });
      return;
    }

    const durationMin = Math.max(2, Math.round(Number(req.body?.durationMin) || 8));
    const slice = {
      surpriseBoothCustomItems: db.surpriseBoothCustomItems || [],
      surpriseBoothExcludedIds: db.surpriseBoothExcludedIds || [],
      surpriseBoothRecentIds: db.surpriseBoothRecentIds || [],
      surpriseBoothHistory: db.surpriseBoothHistory || [],
    };
    const draw = drawSurpriseItem(slice, {
      enabledCategories: SURPRISE_CATEGORIES.map((c) => c.id),
      recordRecent: true,
    });
    if (!draw) {
      res.status(400).json({ error: 'No hay sorpresas disponibles.' });
      return;
    }
    db.surpriseBoothRecentIds = slice.surpriseBoothRecentIds;
    deps.scheduleSave();

    const s = draw.surprise;
    const replacement: YouthProgramActivityItem = {
      id: `YSA-${Date.now().toString(36)}-SUR`,
      order: 1,
      sectionCode: 'L',
      sectionLabel: 'Cabina de sorpresas',
      title: `Sorpresa: ${s.title}`,
      description: s.instructions,
      durationMin,
      materials: 'Proyector / Biblias',
      directorInstructions: `Actividad sorpresa (${formatMmSs(s.suggestedSec)} sugeridos en vivo). Modera y valida participación.`,
      participantInstructions: s.instructions,
      transitionText: '¡Excelente sorpresa! Continuamos con el programa.',
      biblicalReference: s.reference || 'Salmos 119:105',
      scripturalText: '',
      contentType: 'dinamica_practica',
      directorReviewed: true,
      soundMood: 'misterio',
      requiresOnsiteValidation: true,
      status: 'pendiente',
    };

    res.json({ activity: replacement });
  });

  // 7. Live Director Playback Controls & Onsite Validation
  app.post('/api/mi-sociedad/programs/:id/live', (req, res) => {
    const db = ensureDb();
    if (!isAuthorizedYouthDirector(req, db)) {
      res.status(403).json({ error: 'Solo un director autorizado puede controlar el programa en vivo.' });
      return;
    }

    const id = String(req.params.id || '').trim();
    const p = db.youthSocietyPrograms[id];
    if (!p) {
      res.status(404).json({ error: 'Programa no encontrado.' });
      return;
    }

    const action = String(req.body?.action || '').trim();
    const now = Date.now();
    db.activeYouthSocietyProgramId = id;

    const loadIndex = (targetIdx: number, keepRunning: boolean) => {
      if (p.activities.length === 0) return;
      const clamped = Math.min(Math.max(0, targetIdx), p.activities.length - 1);
      p.liveState.currentActivityIndex = clamped;
      const act = p.activities[clamped];
      act.status = 'en_curso';
      const sec = act.durationMin * 60;
      if (keepRunning) {
        p.liveState.playbackStatus = 'en_curso';
        p.liveState.timerRunning = true;
        p.liveState.timerEndsAt = now + sec * 1000;
        p.liveState.timerPausedRemainingSec = null;
      } else {
        p.liveState.timerRunning = false;
        p.liveState.timerEndsAt = null;
        p.liveState.timerPausedRemainingSec = sec;
      }
      p.liveState.soundCueNonce = (p.liveState.soundCueNonce || 0) + 1;
      p.liveState.lastSoundMood = act.soundMood || 'transicion';
    };

    if (action === 'start') {
      if (!p.liveState.startedAt) p.liveState.startedAt = now;
      const curAct = p.activities[p.liveState.currentActivityIndex];
      if (curAct) curAct.status = 'en_curso';
      const rem =
        typeof p.liveState.timerPausedRemainingSec === 'number' &&
        p.liveState.timerPausedRemainingSec > 0
          ? p.liveState.timerPausedRemainingSec
          : (curAct?.durationMin || 5) * 60;
      p.liveState.playbackStatus = 'en_curso';
      p.liveState.timerRunning = true;
      p.liveState.timerEndsAt = now + rem * 1000;
      p.liveState.timerPausedRemainingSec = null;
      p.liveState.soundCueNonce = (p.liveState.soundCueNonce || 0) + 1;
      p.liveState.lastSoundMood = curAct?.soundMood || 'bienvenida';
    } else if (action === 'pause') {
      const rem =
        p.liveState.timerRunning && typeof p.liveState.timerEndsAt === 'number'
          ? Math.max(0, Math.ceil((p.liveState.timerEndsAt - now) / 1000))
          : p.liveState.timerPausedRemainingSec || 0;
      p.liveState.playbackStatus = 'pausado';
      p.liveState.timerRunning = false;
      p.liveState.timerEndsAt = null;
      p.liveState.timerPausedRemainingSec = rem;
    } else if (action === 'resume') {
      const rem = p.liveState.timerPausedRemainingSec || 60;
      p.liveState.playbackStatus = 'en_curso';
      p.liveState.timerRunning = true;
      p.liveState.timerEndsAt = now + rem * 1000;
      p.liveState.timerPausedRemainingSec = null;
    } else if (action === 'complete_next') {
      const cur = p.activities[p.liveState.currentActivityIndex];
      if (cur) cur.status = 'completada';
      if (p.liveState.currentActivityIndex < p.activities.length - 1) {
        loadIndex(
          p.liveState.currentActivityIndex + 1,
          p.liveState.playbackStatus === 'en_curso'
        );
      }
    } else if (action === 'skip_next') {
      const cur = p.activities[p.liveState.currentActivityIndex];
      if (cur) cur.status = 'omitida';
      if (p.liveState.currentActivityIndex < p.activities.length - 1) {
        loadIndex(
          p.liveState.currentActivityIndex + 1,
          p.liveState.playbackStatus === 'en_curso'
        );
      }
    } else if (action === 'jump') {
      loadIndex(Number(req.body?.index ?? 0), p.liveState.playbackStatus === 'en_curso');
    } else if (action === 'reset_timer') {
      const cur = p.activities[p.liveState.currentActivityIndex];
      const sec = (cur?.durationMin || 5) * 60;
      if (p.liveState.playbackStatus === 'en_curso' && p.liveState.timerRunning) {
        p.liveState.timerEndsAt = now + sec * 1000;
        p.liveState.timerPausedRemainingSec = null;
      } else {
        p.liveState.timerEndsAt = null;
        p.liveState.timerPausedRemainingSec = sec;
      }
    } else if (action === 'adjust_timer') {
      const delta = Number(req.body?.deltaSec || 60);
      const curRem =
        p.liveState.timerRunning && typeof p.liveState.timerEndsAt === 'number'
          ? Math.max(0, Math.ceil((p.liveState.timerEndsAt - now) / 1000))
          : p.liveState.timerPausedRemainingSec || 0;
      const nextRem = Math.max(0, curRem + delta);
      if (p.liveState.playbackStatus === 'en_curso' && p.liveState.timerRunning) {
        p.liveState.timerEndsAt = now + nextRem * 1000;
      } else {
        p.liveState.timerPausedRemainingSec = nextRem;
      }
    } else if (action === 'insert_surprise') {
      const slice = {
        surpriseBoothCustomItems: db.surpriseBoothCustomItems || [],
        surpriseBoothExcludedIds: db.surpriseBoothExcludedIds || [],
        surpriseBoothRecentIds: db.surpriseBoothRecentIds || [],
        surpriseBoothHistory: db.surpriseBoothHistory || [],
      };
      const draw = drawSurpriseItem(slice, {
        enabledCategories: SURPRISE_CATEGORIES.map((c) => c.id),
        recordRecent: true,
      });
      if (draw) {
        db.surpriseBoothRecentIds = slice.surpriseBoothRecentIds;
        p.liveState.activeSurprise = {
          title: draw.surprise.title,
          categoryLabel:
            SURPRISE_CATEGORIES.find((c) => c.id === draw.surprise.categoryId)?.label ||
            'Sorpresa',
          instructions: draw.surprise.instructions,
          reference: draw.surprise.reference,
          durationSec: draw.surprise.suggestedSec || 45,
          triggeredAt: now,
        };
        p.liveState.soundCueNonce = (p.liveState.soundCueNonce || 0) + 1;
        p.liveState.lastSoundMood = 'misterio';
      }
    } else if (action === 'dismiss_surprise') {
      p.liveState.activeSurprise = null;
    } else if (action === 'validate_onsite') {
      const activityId = String(req.body?.activityId || '');
      const act =
        p.activities.find((a) => a.id === activityId) ||
        p.activities[p.liveState.currentActivityIndex];
      if (act) {
        act.onsiteValidated = true;
        act.onsiteResultNote = String(req.body?.note || 'Validado presencialmente').slice(0, 260);
        p.liveState.soundCueNonce = (p.liveState.soundCueNonce || 0) + 1;
        p.liveState.lastSoundMood = 'reconocimiento';
      }
    } else if (action === 'link_game') {
      const activityId = String(req.body?.activityId || '');
      const act =
        p.activities.find((a) => a.id === activityId) ||
        p.activities[p.liveState.currentActivityIndex];
      if (act) {
        act.linkedGameCode = String(req.body?.code || '').toUpperCase().slice(0, 20);
        if (req.body?.gameId) act.linkedGameId = String(req.body.gameId);
        if (req.body?.invitePath) act.linkedInvitePath = String(req.body.invitePath);
        if (req.body?.mode) act.linkedGameMode = req.body.mode as GameMode;
      }
    } else if (action === 'finish') {
      const cur = p.activities[p.liveState.currentActivityIndex];
      if (cur && cur.status === 'en_curso') cur.status = 'completada';
      p.liveState.playbackStatus = 'finalizado';
      p.liveState.timerRunning = false;
      p.liveState.timerEndsAt = null;
      p.liveState.timerPausedRemainingSec = 0;
      p.liveState.finishedAt = now;
      p.liveState.soundCueNonce = (p.liveState.soundCueNonce || 0) + 1;
      p.liveState.lastSoundMood = 'finalizacion';
      p.status = 'final';
      if (typeof req.body?.directorObservations === 'string') {
        p.directorObservations = req.body.directorObservations.trim().slice(0, 1000);
      }
      recordHistoryForProgram(p, db);
    } else {
      res.status(400).json({ error: 'Acción en vivo no reconocida.' });
      return;
    }

    p.updatedAt = now;
    deps.scheduleSave();
    broadcastYouthProgram(id, db, deps);
    res.json({ program: p });
  });

  // 8. Public Live / Projection state
  app.get('/api/mi-sociedad/live/:id', (req, res) => {
    const db = ensureDb();
    const id = String(req.params.id || '').trim();
    const p = db.youthSocietyPrograms[id];
    if (!p) {
      res.status(404).json({ error: 'Programa no encontrado.' });
      return;
    }
    res.json(buildLiveProjectionPayload(p, db, deps));
  });
}
