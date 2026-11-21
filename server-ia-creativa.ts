import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type express from 'express';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import PptxGenJSImport from 'pptxgenjs';
import {
  ActivityCategoryType,
  AiCreativeActivity,
  AiCreativeChatMessage,
  AiCreativeChatSession,
  AiCreativeEvent,
  AiCreativeImageRecord,
  AiCreativeMusicPlan,
  AiCreativePresentation,
  AiCreativeProgram,
  AiCreativeRecord,
  AiCreativeSavedVersion,
  AiCreativeScript,
  AiCreativeSermon,
  AiCreativeStatus,
  AiDiagnosticEvent,
  AiErrorCategory,
  ChatIntentAnalysis,
  ChatResourceAction,
  ChatStructuredArtifact,
  ChristianEventType,
  CreativeAiDatabaseSlice,
  CreativeAiProfile,
  CreativeImageCategory,
  CreativeImageFormat,
  CreativeImageStyle,
  CreativePayloadUnion,
  CreativeToolKind,
  DOCTRINAL_TRADITIONS,
  ProgramBlockType,
  ProgramStepDetail,
  rebalanceProgramStepDurations,
  ScriptFormatType,
  SermonFormatType,
} from './src/shared/creativeAiTypes.js';
import {
  getUpcomingSaturdayIso,
  rebalanceActivityDurations,
  SATURDAY_CATEGORY_META,
  SaturdayActivityCategory,
  SaturdayProgram,
  SaturdayProgramActivity,
  SaturdayProgramDuration,
} from './src/shared/saturdayProgramTypes.js';
import type { YouthProgramPlan } from './src/shared/youthSocietyData.js';

const TEXT_MODEL = 'gemini-4-hydrogen';
const FALLBACK_TEXT_MODEL = 'gemini-3.1-flash-lite';
const IMAGE_MODEL = 'gemini-3.1-flash-lite-image';
const AI_IMAGES_DIR = path.resolve(process.cwd(), 'data', 'ia_images');

export interface IaCreativaRoutesDeps {
  getDb: () => {
    creativeAi?: CreativeAiDatabaseSlice;
    saturdayPrograms?: Record<string, SaturdayProgram>;
    youthSocietyPrograms?: Record<string, YouthProgramPlan>;
  };
  scheduleSave: () => void;
}

export function createEmptyCreativeAiSlice(): CreativeAiDatabaseSlice {
  return {
    profile: {
      churchName: '',
      denominationalTradition: 'general',
      customTraditionNotes: '',
      bibleTranslation: 'RVR1960',
      youthAgeGroup: 'Jóvenes y adolescentes (13 a 28 años)',
      ministryFocus: 'Sociedad de Jóvenes, discipulado bíblico y participación creativa',
      requireDoctrinalReviewNotes: true,
      updatedAt: Date.now(),
    },
    records: {},
    images: [],
    chatSessions: {},
    activeChatSessionId: null,
  };
}

export function ensureCreativeAiSlice(
  raw: Partial<{ creativeAi?: Partial<CreativeAiDatabaseSlice> }>
): { creativeAi: CreativeAiDatabaseSlice } {
  const empty = createEmptyCreativeAiSlice();
  const src = raw?.creativeAi || {};
  return {
    creativeAi: {
      profile: {
        ...empty.profile,
        ...(src.profile && typeof src.profile === 'object' ? src.profile : {}),
      },
      records: src.records && typeof src.records === 'object' ? src.records : {},
      images: Array.isArray(src.images) ? src.images : [],
      chatSessions:
        src.chatSessions && typeof src.chatSessions === 'object' ? src.chatSessions : {},
      activeChatSessionId:
        typeof src.activeChatSessionId === 'string' ? src.activeChatSessionId : null,
    },
  };
}

function getConfiguredApiKey(): string | null {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key || key === 'MY_GEMINI_API_KEY') return null;
  return key;
}

function createGeminiClient(): GoogleGenAI | null {
  const key = getConfiguredApiKey();
  if (!key) return null;
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

let lastDiagnosticEvent: AiDiagnosticEvent | undefined;

function recordDiagnostic(event: Omit<AiDiagnosticEvent, 'id' | 'timestamp'>): AiDiagnosticEvent {
  const full: AiDiagnosticEvent = {
    id: `DIAG-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
    timestamp: Date.now(),
    ...event,
  };
  lastDiagnosticEvent = full;
  return full;
}

function buildAiStatus(): AiCreativeStatus {
  const configured = Boolean(getConfiguredApiKey());
  return {
    geminiConfigured: configured,
    textModel: TEXT_MODEL,
    imageModel: IMAGE_MODEL,
    imageServiceReady: configured,
    imageRequiresPaidKey: true,
    statusMessage: configured
      ? `Conectado al modelo real ${TEXT_MODEL} en servidor.`
      : 'No se detectó GEMINI_API_KEY en el servidor. Configúrala en Settings > Secrets para habilitar la IA.',
    imageStatusMessage: configured
      ? `Modelo ${IMAGE_MODEL} listo (requiere que la clave configurada tenga facturación/cuota habilitada para imágenes).`
      : `Sin clave configurada. Se requiere GEMINI_API_KEY con facturación habilitada en Settings > Secrets para usar ${IMAGE_MODEL}.`,
    lastDiagnostic: lastDiagnosticEvent,
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs = 42000): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('TIMEOUT_AI_REQUEST'));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function withRetries<T>(
  fn: () => Promise<T>,
  maxAttempts = 2,
  timeoutMs = 42000
): Promise<T> {
  let lastErr: unknown;
  const startedAt = Date.now();
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await withTimeout(fn(), timeoutMs);
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const lower = msg.toLowerCase();
      const nonRetryable =
        msg === 'TIMEOUT_AI_REQUEST' ||
        lower.includes('timeout') ||
        lower.includes('aborted') ||
        lower.includes('api_key_invalid') ||
        lower.includes('unauthenticated') ||
        lower.includes('permission_denied') ||
        lower.includes('invalid_argument') ||
        lower.includes('not_found') ||
        lower.includes('resource_exhausted') ||
        lower.includes('400') ||
        lower.includes('401') ||
        lower.includes('403') ||
        lower.includes('404') ||
        lower.includes('429');

      if (nonRetryable || Date.now() - startedAt > 18000) {
        throw err;
      }
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 700 * attempt));
      }
    }
  }
  throw lastErr;
}

async function runWithTextFallback<T>(
  runner: (modelName: string, isFallback: boolean) => Promise<T>,
  timeoutMs = 36000
): Promise<{ result: T; modelUsed: string }> {
  try {
    const result = await withTimeout(runner(TEXT_MODEL, false), timeoutMs);
    return { result, modelUsed: TEXT_MODEL };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const lower = raw.toLowerCase();
    const upstreamStatus = extractHttpStatusFromError(err);
    const shouldFallback =
      raw === 'TIMEOUT_AI_REQUEST' ||
      upstreamStatus === 404 ||
      upstreamStatus === 429 ||
      upstreamStatus === 500 ||
      upstreamStatus === 503 ||
      upstreamStatus === 504 ||
      lower.includes('unavailable') ||
      lower.includes('high demand') ||
      lower.includes('internal') ||
      lower.includes('resource_exhausted') ||
      lower.includes('500') ||
      lower.includes('503') ||
      lower.includes('429') ||
      lower.includes('404') ||
      lower.includes('not_found');

    if (!shouldFallback) {
      throw err;
    }

    const fallbackResult = await withTimeout(
      runner(FALLBACK_TEXT_MODEL, true),
      Math.min(28000, timeoutMs)
    );
    return { result: fallbackResult, modelUsed: FALLBACK_TEXT_MODEL };
  }
}

function extractHttpStatusFromError(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const obj = err as Record<string, unknown>;
  if (typeof obj.status === 'number') return obj.status;
  if (typeof obj.statusCode === 'number') return obj.statusCode;
  if (obj.cause && typeof obj.cause === 'object') {
    const c = obj.cause as Record<string, unknown>;
    if (typeof c.status === 'number') return c.status;
  }
  return undefined;
}

function mapGeminiError(
  err: unknown,
  context: 'text' | 'image' = 'text',
  operation = 'gemini_request'
): {
  status: number;
  code: string;
  errorCategory: AiErrorCategory;
  message: string;
  technicalHint: string;
} {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  const upstreamStatus = extractHttpStatusFromError(err);

  if (
    raw === 'TIMEOUT_AI_REQUEST' ||
    lower.includes('timeout') ||
    lower.includes('etimedout') ||
    lower.includes('aborted') ||
    upstreamStatus === 504
  ) {
    return {
      status: 504,
      code: 'GEMINI_TIMEOUT',
      errorCategory: 'TIMEOUT',
      message:
        'Tiempo de espera agotado al esperar respuesta de Gemini API. Intenta nuevamente o formula una solicitud más concisa.',
      technicalHint: `Timeout en ${operation} (${raw.slice(0, 140)})`,
    };
  }

  if (raw.startsWith('INVALID_JSON_FORMAT') || err instanceof SyntaxError) {
    return {
      status: 502,
      code: 'GEMINI_INVALID_FORMAT',
      errorCategory: 'INVALID_FORMAT',
      message:
        'La IA respondió con un formato incompleto o no estructurado. Vuelve a intentar para regenerar la respuesta correctamente.',
      technicalHint: raw.slice(0, 160),
    };
  }

  if (
    upstreamStatus === 401 ||
    lower.includes('unauthenticated') ||
    lower.includes('unauthorized') ||
    lower.includes(' 401') ||
    lower.includes('"code":401')
  ) {
    return {
      status: 401,
      code: 'GEMINI_401_UNAUTHORIZED',
      errorCategory: 'AUTH_401',
      message:
        'Error 401: La credencial de Gemini API fue rechazada, no está autorizada o expiró. Revisa GEMINI_API_KEY en Settings > Secrets.',
      technicalHint: raw.slice(0, 180),
    };
  }

  if (
    upstreamStatus === 403 ||
    lower.includes('permission_denied') ||
    lower.includes('access_denied') ||
    lower.includes(' 403') ||
    lower.includes('"code":403')
  ) {
    return {
      status: 403,
      code: context === 'image' ? 'PAID_KEY_REQUIRED' : 'GEMINI_403_FORBIDDEN',
      errorCategory: 'FORBIDDEN_403',
      message:
        context === 'image'
          ? `Error 403: El modelo de imágenes (${IMAGE_MODEL}) requiere una clave Gemini con facturación habilitada en Settings > Secrets.`
          : 'Error 403: Permiso denegado por Gemini API. Verifica en Settings > Secrets que tu clave sea válida y tenga habilitada Generative Language API.',
      technicalHint: raw.slice(0, 180),
    };
  }

  if (
    upstreamStatus === 429 ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes(' 429') ||
    lower.includes('"code":429')
  ) {
    return {
      status: 429,
      code: context === 'image' ? 'IMAGE_QUOTA_OR_PAID_KEY' : 'GEMINI_429_RATE_LIMIT',
      errorCategory: 'RATE_LIMIT_429',
      message:
        context === 'image'
          ? `Error 429: Cuota agotada o clave gratuita sin acceso al modelo ${IMAGE_MODEL}. Configura una clave con facturación o espera unos minutos.`
          : 'Error 429: Se alcanzó el límite de solicitudes o cuota de Gemini API. Espera unos segundos e inténtalo de nuevo.',
      technicalHint: raw.slice(0, 180),
    };
  }

  if (
    upstreamStatus === 400 ||
    upstreamStatus === 413 ||
    lower.includes('api_key_invalid') ||
    lower.includes('invalid_argument') ||
    lower.includes('payload too large')
  ) {
    const isKeyInvalid = lower.includes('api_key_invalid') || (lower.includes('api key') && lower.includes('invalid'));
    return {
      status: 400,
      code: isKeyInvalid ? 'API_KEY_INVALID' : 'GEMINI_400_BAD_REQUEST',
      errorCategory: isKeyInvalid ? 'AUTH_401' : 'BAD_REQUEST_400',
      message: isKeyInvalid
        ? 'La clave GEMINI_API_KEY configurada no es válida. Verifícala en Settings > Secrets.'
        : 'Error 400: La solicitud fue demasiado larga o tuvo parámetros inválidos para el modelo. Resume el texto e intenta de nuevo.',
      technicalHint: raw.slice(0, 180),
    };
  }

  if (upstreamStatus === 404 || lower.includes('not_found') || lower.includes('"code":404')) {
    return {
      status: 404,
      code: 'GEMINI_404_MODEL_NOT_FOUND',
      errorCategory: 'MODEL_404',
      message: `Error 404: El modelo configurado (${context === 'image' ? IMAGE_MODEL : TEXT_MODEL}) no está disponible para este proyecto.`,
      technicalHint: raw.slice(0, 180),
    };
  }

  if (
    (upstreamStatus && upstreamStatus >= 500) ||
    lower.includes('internal') ||
    lower.includes('unavailable') ||
    lower.includes('"code":500') ||
    lower.includes('"code":503')
  ) {
    return {
      status: 500,
      code: 'GEMINI_500_SERVER_ERROR',
      errorCategory: 'SERVER_500',
      message:
        'Error 500 del servidor de Gemini API: el proveedor experimentó una falla temporal interna. Reintenta en unos segundos.',
      technicalHint: raw.slice(0, 180),
    };
  }

  if (
    lower.includes('fetch failed') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('econnreset') ||
    lower.includes('ehostunreach') ||
    lower.includes('network')
  ) {
    return {
      status: 502,
      code: 'GEMINI_NETWORK_ERROR',
      errorCategory: 'NETWORK_ERROR',
      message:
        'No se pudo establecer conexión de red desde el servidor hacia Gemini API. Verifica conectividad o reintenta en unos instantes.',
      technicalHint: raw.slice(0, 180),
    };
  }

  return {
    status: 502,
    code: 'AI_UPSTREAM_ERROR',
    errorCategory: 'UNKNOWN',
    message: `Error inesperado al comunicarse con Gemini API: ${raw.slice(0, 200)}`,
    technicalHint: raw.slice(0, 220),
  };
}

function sendMappedError(
  res: express.Response,
  err: unknown,
  context: 'text' | 'image',
  operation: string,
  startedAt: number
): void {
  const mapped = mapGeminiError(err, context, operation);
  const latencyMs = Math.max(1, Date.now() - startedAt);
  console.error('[IA Creativa Error]', {
    operation,
    status: mapped.status,
    errorCategory: mapped.errorCategory,
    code: mapped.code,
    latencyMs,
    hint: mapped.technicalHint,
  });
  const diagnostic = recordDiagnostic({
    operation,
    ok: false,
    httpStatus: mapped.status,
    errorCategory: mapped.errorCategory,
    code: mapped.code,
    latencyMs,
    friendlyMessage: mapped.message,
    technicalHint: mapped.technicalHint,
  });
  res.status(mapped.status).json({
    ok: false,
    code: mapped.code,
    errorCategory: mapped.errorCategory,
    error: mapped.message,
    technicalHint: mapped.technicalHint,
    latencyMs,
    diagnostic,
  });
}

function buildDoctrinalSystemInstruction(profile: CreativeAiProfile): string {
  const trad =
    DOCTRINAL_TRADITIONS.find((t) => t.id === profile.denominationalTradition) ||
    DOCTRINAL_TRADITIONS[0];

  return `Eres "IA CREATIVA JUVENIL", un asistente ministerial cristiano altamente capacitado, respetuoso, creativo y práctico integrado en la plataforma DIME TÚ QUÉ DICES.

TU PROPÓSITO:
Ayudar a directores de Sociedad de Jóvenes, líderes juveniles, pastores, maestros bíblicos y coordinadores de actividades a preparar programas completos, predicaciones, dinámicas, guiones, presentaciones, eventos y momentos musicales edificantes.

PERFIL DOCTRINAL CONFIGURADO POR EL DIRECTOR:
- Iglesia / Ministerio: ${profile.churchName || 'Iglesia local (no especificada)'}
- Tradición doctrinal: ${trad.label} — ${trad.description}
${profile.customTraditionNotes ? `- Notas doctrinales propias: ${profile.customTraditionNotes}` : ''}
- Versión bíblica preferida: ${profile.bibleTranslation}
- Público juvenil: ${profile.youthAgeGroup}
- Enfoque ministerial: ${profile.ministryFocus}

REGLAS BÍBLICAS, ÉTICAS Y DOCTRINALES INQUEBRANTABLES:
1. NUNCA inventes versículos, capítulos ni citas bíblicas. Cita únicamente referencias reales y conocidas con fidelidad.
2. Si no estás completamente seguro de la referencia exacta o de un dato externo (como un autor o enlace de canción), dilo explícitamente con "No verificado / requiere revisión del director".
3. NUNCA atribuyas declaraciones falsas a personajes bíblicos como si estuvieran en la Biblia.
4. Distingue SIEMPRE entre texto bíblico literal, enseñanza doctrinal bíblica general y adaptaciones narrativas o ejemplos ilustrativos creativos.
5. Si el perfil doctrinal es "Cristiana Bíblica General" o hay temas interpretativos sensibles (dones espirituales, escatología, estilo litúrgico, ordenanzas, música), NO impongas una opinión personal como dogma; indica brevemente los puntos para revisión del director.
6. Mantén lenguaje en español cálido, respetuoso, cristiano, juvenil, práctico y edificante.
7. Nunca entregues títulos vacíos ni ideas superficiales: desarrolla instrucciones paso a paso utilizables por el director y presentador.
8. Derechos de autor en música: NUNCA reproduzcas letras completas de canciones protegidas ni inventes enlaces (YouTube/Spotify) o autores falsos.`;
}

function buildHistoryAntiRepeatDigest(db: {
  creativeAi?: CreativeAiDatabaseSlice;
  saturdayPrograms?: Record<string, SaturdayProgram>;
  youthSocietyPrograms?: Record<string, YouthProgramPlan>;
}): string {
  const lines: string[] = [];

  const aiPrograms = Object.values(db.creativeAi?.records || {})
    .filter((r) => r.kind === 'program' || r.kind === 'activity')
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 10);

  for (const r of aiPrograms) {
    let acts = '';
    if (r.kind === 'program') {
      const p = r.payload as AiCreativeProgram;
      acts = (p.steps || [])
        .map((s) => s.title)
        .slice(0, 8)
        .join(', ');
    }
    lines.push(
      `[IA ${r.scheduledDate}] (${r.kind}) "${r.title}" · Tema: "${r.theme}"${acts ? ` · Bloques: ${acts}` : ''}`
    );
  }

  const satProgs = Object.values(db.saturdayPrograms || {})
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 10);
  for (const s of satProgs) {
    lines.push(
      `[Sábado ${s.scheduledDate}] "${s.title}" · Tema: "${s.centralTheme}" · Texto: ${s.mainBibleText} · Actividades: ${s.activities.map((a) => a.title).join(', ')}`
    );
  }

  const ysProgs = Object.values(db.youthSocietyPrograms || {})
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 6);
  for (const y of ysProgs) {
    lines.push(
      `[Mi Sociedad ${y.config.scheduledDate}] "${y.creativeName}" · Tema: "${y.centralTheme}"`
    );
  }

  if (lines.length === 0) {
    return 'No hay historial previo registrado aún.';
  }
  return lines.join('\n');
}

function makeRecordId(kind: CreativeToolKind): string {
  const prefixMap: Record<CreativeToolKind, string> = {
    program: 'IAC-PRG',
    sermon: 'IAC-SER',
    activity: 'IAC-ACT',
    script: 'IAC-GUI',
    presentation: 'IAC-PPT',
    event: 'IAC-EVT',
    music: 'IAC-MUS',
  };
  return `${prefixMap[kind]}-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomBytes(2)
    .toString('hex')
    .toUpperCase()}`;
}

function makeImageId(): string {
  return `IMG-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomBytes(3)
    .toString('hex')
    .toUpperCase()}`;
}

const VALID_PROGRAM_BLOCKS: ProgramBlockType[] = [
  'bienvenida',
  'oracion_inicial',
  'alabanza',
  'rompehielos',
  'desarrollo_principal',
  'actividad_biblica',
  'juego_competencia',
  'participacion_juvenil',
  'reflexion',
  'aplicacion_espiritual',
  'llamado_compromiso',
  'oracion_final',
  'despedida',
];

const BLOCK_DEFAULT_LABELS: Record<ProgramBlockType, string> = {
  bienvenida: 'Bienvenida',
  oracion_inicial: 'Oración inicial',
  alabanza: 'Alabanza',
  rompehielos: 'Dinámica rompehielos',
  desarrollo_principal: 'Desarrollo principal',
  actividad_biblica: 'Actividad bíblica',
  juego_competencia: 'Juego o competencia',
  participacion_juvenil: 'Participación juvenil',
  reflexion: 'Reflexión',
  aplicacion_espiritual: 'Aplicación espiritual',
  llamado_compromiso: 'Llamado o compromiso',
  oracion_final: 'Oración final',
  despedida: 'Despedida',
};

function normalizeProgramDuration(raw: unknown): 60 | 90 | 120 {
  const n = Number(raw);
  if (n === 60 || n === 90 || n === 120) return n;
  return 90;
}

function sanitizeProgramSteps(
  rawSteps: unknown[],
  durationMinutes: 60 | 90 | 120
): ProgramStepDetail[] {
  const mapped: ProgramStepDetail[] = VALID_PROGRAM_BLOCKS.map((blockType, idx) => {
    const raw =
      (rawSteps.find(
        (s) =>
          s &&
          typeof s === 'object' &&
          String((s as Record<string, unknown>).blockType || '').trim() === blockType
      ) as Record<string, unknown> | undefined) ||
      (rawSteps[idx] as Record<string, unknown> | undefined) ||
      {};

    const dist = String(raw.contentDistinction || '');
    const contentDistinction: ProgramStepDetail['contentDistinction'] =
      dist === 'biblico_textual' || dist === 'adaptacion_creativa'
        ? dist
        : 'dinamica_practica';

    return {
      id:
        typeof raw.id === 'string' && raw.id.trim()
          ? raw.id.trim()
          : `STEP-${idx + 1}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
      order: idx + 1,
      blockType,
      blockLabel: BLOCK_DEFAULT_LABELS[blockType],
      title: String(raw.title || BLOCK_DEFAULT_LABELS[blockType]).trim(),
      durationMin: Math.max(1, Math.min(60, Math.round(Number(raw.durationMin) || 5))),
      whatDirectorDoes: String(raw.whatDirectorDoes || '').trim(),
      whatPresenterSays: String(raw.whatPresenterSays || '').trim(),
      whatParticipantsDo: String(raw.whatParticipantsDo || '').trim(),
      howToOrganize: String(raw.howToOrganize || '').trim(),
      howToStart: String(raw.howToStart || '').trim(),
      howToDevelop: String(raw.howToDevelop || '').trim(),
      howToFinish: String(raw.howToFinish || '').trim(),
      materials: Array.isArray(raw.materials)
        ? raw.materials.map((m) => String(m || '').trim()).filter(Boolean)
        : [],
      spiritualTeaching: String(raw.spiritualTeaching || '').trim(),
      biblicalReference: String(raw.biblicalReference || '').trim() || undefined,
      contentDistinction,
      ...(typeof raw.compatibleGameMode === 'string' && raw.compatibleGameMode.trim()
        ? { compatibleGameMode: raw.compatibleGameMode.trim() }
        : {}),
    };
  });

  return rebalanceProgramStepDurations(mapped, durationMinutes);
}

function mapProgramBlockToSaturdayCategory(block: ProgramBlockType): SaturdayActivityCategory {
  switch (block) {
    case 'bienvenida':
    case 'oracion_inicial':
      return 'bienvenida';
    case 'rompehielos':
      return 'rompehielos';
    case 'alabanza':
      return 'alabanza';
    case 'juego_competencia':
      return 'juego';
    case 'actividad_biblica':
    case 'desarrollo_principal':
    case 'participacion_juvenil':
      return 'actividad_biblica';
    case 'reflexion':
      return 'reflexion';
    case 'aplicacion_espiritual':
      return 'aplicacion';
    case 'llamado_compromiso':
      return 'desafio';
    case 'oracion_final':
    case 'despedida':
      return 'despedida';
    default:
      return 'personalizada';
  }
}

function stripJsonMarkdownFences(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  return cleaned;
}

function parseJsonSafe<T>(text: string | undefined, fallbackMsg: string): T {
  const cleaned = stripJsonMarkdownFences(text || '');
  if (!cleaned) {
    throw new Error(`INVALID_JSON_FORMAT: ${fallbackMsg}`);
  }
  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    const startIdx = cleaned.indexOf('{');
    const endIdx = cleaned.lastIndexOf('}');
    if (startIdx >= 0 && endIdx > startIdx) {
      try {
        return JSON.parse(cleaned.slice(startIdx, endIdx + 1)) as T;
      } catch {
        // throw structured format error below
      }
    }
    throw new Error(
      `INVALID_JSON_FORMAT: ${e instanceof Error ? e.message : fallbackMsg}`
    );
  }
}

function saveRecordVersioned(
  slice: CreativeAiDatabaseSlice,
  params: {
    id?: string;
    kind: CreativeToolKind;
    title: string;
    theme: string;
    eventType: string;
    scheduledDate: string;
    status: 'draft' | 'final';
    payload: CreativePayloadUnion;
    note?: string;
    saveMode?: 'new_version' | 'overwrite_draft';
  }
): AiCreativeRecord {
  const now = Date.now();
  const existing = params.id ? slice.records[params.id] : undefined;

  if (!existing) {
    const newId = makeRecordId(params.kind);
    const v1: AiCreativeSavedVersion = {
      versionNumber: 1,
      savedAt: now,
      status: params.status,
      note: params.note || (params.status === 'final' ? 'Versión definitiva inicial' : 'Borrador inicial'),
      payload: JSON.parse(JSON.stringify(params.payload)),
    };
    const record: AiCreativeRecord = {
      id: newId,
      kind: params.kind,
      title: params.title,
      theme: params.theme,
      eventType: params.eventType,
      scheduledDate: params.scheduledDate,
      status: params.status,
      currentVersion: 1,
      versions: [v1],
      payload: params.payload,
      createdAt: now,
      updatedAt: now,
    };
    slice.records[newId] = record;
    return record;
  }

  // Never automatically overwrite an existing 'final' version; always create a new version snapshot!
  const canOverwriteDraft =
    params.saveMode === 'overwrite_draft' &&
    existing.status === 'draft' &&
    params.status === 'draft' &&
    existing.versions.length > 0;

  if (canOverwriteDraft) {
    const updatedVersions = [...existing.versions];
    updatedVersions[updatedVersions.length - 1] = {
      ...updatedVersions[updatedVersions.length - 1],
      savedAt: now,
      note: params.note || updatedVersions[updatedVersions.length - 1].note,
      payload: JSON.parse(JSON.stringify(params.payload)),
    };
    const updated: AiCreativeRecord = {
      ...existing,
      title: params.title,
      theme: params.theme,
      eventType: params.eventType,
      scheduledDate: params.scheduledDate,
      payload: params.payload,
      versions: updatedVersions,
      updatedAt: now,
    };
    slice.records[existing.id] = updated;
    return updated;
  }

  const nextVer = (existing.versions[existing.versions.length - 1]?.versionNumber || existing.currentVersion || 1) + 1;
  const newSnap: AiCreativeSavedVersion = {
    versionNumber: nextVer,
    savedAt: now,
    status: params.status,
    note:
      params.note ||
      (params.status === 'final'
        ? `Versión definitiva v${nextVer}`
        : `Versión borrador v${nextVer}`),
    payload: JSON.parse(JSON.stringify(params.payload)),
  };

  const updated: AiCreativeRecord = {
    ...existing,
    title: params.title,
    theme: params.theme,
    eventType: params.eventType,
    scheduledDate: params.scheduledDate,
    status: params.status,
    currentVersion: nextVer,
    versions: [...existing.versions, newSnap],
    payload: params.payload,
    updatedAt: now,
  };
  slice.records[existing.id] = updated;
  return updated;
}

export function registerIaCreativaRoutes(
  app: express.Express,
  deps: IaCreativaRoutesDeps
): void {
  const ensureDb = () => {
    const dbRef = deps.getDb();
    if (!dbRef.creativeAi) {
      dbRef.creativeAi = createEmptyCreativeAiSlice();
    } else {
      dbRef.creativeAi = ensureCreativeAiSlice({ creativeAi: dbRef.creativeAi }).creativeAi;
    }
    return dbRef as Required<Pick<typeof dbRef, 'creativeAi'>> & typeof dbRef;
  };

  // 1. Real AI Status & Configuration Check
  app.get('/api/ia-creativa/status', (_req, res) => {
    res.json({ status: buildAiStatus() });
  });

  // 1B. Real Live Connection Test (Probe)
  app.post('/api/ia-creativa/test-connection', async (_req, res) => {
    const startedAt = Date.now();
    const ai = createGeminiClient();
    if (!ai) {
      const diag = recordDiagnostic({
        operation: 'test_connection',
        ok: false,
        httpStatus: 503,
        errorCategory: 'MISSING_KEY',
        code: 'MISSING_API_KEY',
        latencyMs: Math.max(1, Date.now() - startedAt),
        friendlyMessage:
          'No se detectó GEMINI_API_KEY en el servidor. Configúrala en Settings > Secrets para habilitar la IA.',
      });
      res.status(503).json({
        ok: false,
        code: diag.code,
        errorCategory: diag.errorCategory,
        error: diag.friendlyMessage,
        diagnostic: diag,
        status: buildAiStatus(),
      });
      return;
    }

    try {
      const { result: response, modelUsed } = await runWithTextFallback(
        (modelName, isFallback) =>
          ai.models.generateContent({
            model: modelName,
            contents: 'Responde únicamente con dos palabras: CONEXION OK',
            config: isFallback
              ? undefined
              : { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
          }),
        16000
      );
      const preview = (response.text ?? '').trim();
      const latencyMs = Math.max(1, Date.now() - startedAt);
      const diag = recordDiagnostic({
        operation: 'test_connection',
        ok: true,
        httpStatus: 200,
        errorCategory: 'NONE',
        code: 'OK',
        latencyMs,
        friendlyMessage: `Conexión real verificada con ${modelUsed} en ${latencyMs} ms.`,
        technicalHint: preview ? `Respuesta: "${preview.slice(0, 60)}"` : undefined,
      });
      res.json({
        ok: true,
        modelUsed,
        latencyMs,
        responsePreview: preview,
        diagnostic: diag,
        status: buildAiStatus(),
      });
    } catch (err) {
      sendMappedError(res, err, 'text', 'test_connection', startedAt);
    }
  });

  // 2. Full overview (profile, saved records, generated images, chat sessions)
  app.get('/api/ia-creativa/overview', (_req, res) => {
    const db = ensureDb();
    const records = Object.values(db.creativeAi.records).sort(
      (a, b) => b.updatedAt - a.updatedAt
    );
    const images = [...db.creativeAi.images].sort((a, b) => b.createdAt - a.createdAt);
    const chatSessions = Object.values(db.creativeAi.chatSessions).sort(
      (a, b) => b.updatedAt - a.updatedAt
    );

    res.json({
      status: buildAiStatus(),
      profile: db.creativeAi.profile,
      records,
      images,
      chatSessions,
      activeChatSessionId: db.creativeAi.activeChatSessionId,
    });
  });

  // 3. Doctrinal Profile Update
  app.put('/api/ia-creativa/profile', (req, res) => {
    const db = ensureDb();
    const body = req.body || {};
    const validTradition = DOCTRINAL_TRADITIONS.some(
      (t) => t.id === body.denominationalTradition
    )
      ? body.denominationalTradition
      : db.creativeAi.profile.denominationalTradition;

    const allowedTranslations = ['RVR1960', 'NVI', 'NTV', 'LBLA', 'General'];
    const translation = allowedTranslations.includes(body.bibleTranslation)
      ? body.bibleTranslation
      : db.creativeAi.profile.bibleTranslation;

    db.creativeAi.profile = {
      churchName: String(body.churchName ?? db.creativeAi.profile.churchName)
        .trim()
        .slice(0, 120),
      denominationalTradition: validTradition,
      customTraditionNotes: String(
        body.customTraditionNotes ?? db.creativeAi.profile.customTraditionNotes
      )
        .trim()
        .slice(0, 800),
      bibleTranslation: translation,
      youthAgeGroup: String(body.youthAgeGroup ?? db.creativeAi.profile.youthAgeGroup)
        .trim()
        .slice(0, 120),
      ministryFocus: String(body.ministryFocus ?? db.creativeAi.profile.ministryFocus)
        .trim()
        .slice(0, 240),
      requireDoctrinalReviewNotes:
        typeof body.requireDoctrinalReviewNotes === 'boolean'
          ? body.requireDoctrinalReviewNotes
          : db.creativeAi.profile.requireDoctrinalReviewNotes,
      updatedAt: Date.now(),
    };
    deps.scheduleSave();
    res.json({ profile: db.creativeAi.profile });
  });

  // 4. GENERAR PROGRAMA COMPLETO CON IA (60 / 90 / 120 min, estándar o todo incluido)
  app.post('/api/ia-creativa/generate/program', async (req, res) => {
    const startedAt = Date.now();
    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        code: 'MISSING_API_KEY',
        errorCategory: 'MISSING_KEY',
        error:
          'No se detectó GEMINI_API_KEY en el servidor. Configura una clave en Settings > Secrets para activar IA CREATIVA JUVENIL.',
      });
      return;
    }

    const db = ensureDb();
    const body = req.body || {};
    const durationMinutes = normalizeProgramDuration(body.durationMinutes);
    const scheduledDate =
      typeof body.scheduledDate === 'string' && body.scheduledDate.trim()
        ? body.scheduledDate.trim()
        : getUpcomingSaturdayIso();
    const topicOrRequest = String(body.topicOrRequest || '').trim().slice(0, 400);
    const eventType = String(body.eventType || 'Sociedad de Jóvenes').trim().slice(0, 80);
    const targetAudience = String(
      body.targetAudience || db.creativeAi.profile.youthAgeGroup || 'Jóvenes cristianos (14-28 años)'
    )
      .trim()
      .slice(0, 120);
    const participantCount = Math.max(4, Math.min(1000, Number(body.participantCount) || 30));
    const allInclusiveMode = Boolean(body.allInclusiveMode);

    const historyDigest = buildHistoryAntiRepeatDigest(db);
    const blockGuide = VALID_PROGRAM_BLOCKS.map(
      (b, i) => `${i + 1}. blockType="${b}" (${BLOCK_DEFAULT_LABELS[b]})`
    ).join('\n');

    const prompt = `Crea un programa COMPLETO, profundo, creativo, bíblico y totalmente ejecutable para: ${eventType}.
Fecha prevista: ${scheduledDate}
Duración total EXACTA: ${durationMinutes} minutos (la suma de los 13 bloques "steps[].durationMin" DEBE sumar exactamente ${durationMinutes}).
Cantidad estimada de participantes: ${participantCount} jóvenes.
Público objetivo: ${targetAudience}.
Solicitud del director: ${topicOrRequest || 'Propón un tema juvenil relevante, fresco, edificante y bíblicamente fundamentado.'}
Modo solicitado: ${allInclusiveMode ? 'PAQUETE TODO INCLUIDO (19 apartados completos con guion maestro del presentador, preguntas para el público, reflexión desarrollada, materiales, ideas de imágenes, esquema de diapositivas y desafío semanal)' : 'PROGRAMA COMPLETO PASO A PASO'}.

HISTORIAL RECIENTE (PROHIBIDO repetir títulos, temas, dinámicas o juegos recientes):
${historyDigest}

ORGANIZACIÓN OBLIGATORIA DE LOS 13 BLOQUES EN "steps" (exactamente en este orden):
${blockGuide}

REQUISITOS DE DESARROLLO PASO A PASO PARA CADA BLOQUE:
- No pongas títulos vacíos. Desarrolla cada bloque con instrucciones reales:
  * "whatDirectorDoes": qué prepara y coordina el director.
  * "whatPresenterSays": guion o palabras concretas que dice el presentador para introducir/conducir.
  * "whatParticipantsDo": acción concreta de los jóvenes.
  * "howToOrganize": logística, grupos, disposición del salón.
  * "howToStart", "howToDevelop", "howToFinish": ejecución de inicio, desarrollo y cierre.
  * "materials": lista real de materiales necesarios.
  * "spiritualTeaching": enseñanza espiritual clave del bloque.
  * "contentDistinction": "biblico_textual", "adaptacion_creativa" o "dinamica_practica".
  * "compatibleGameMode": si el bloque de juego/actividad bíblica encaja con un juego existente de la app ("clasico", "equipos", "velocidad", "ruleta_biblica", "quien_soy", "misterio_biblico", "crucigrama_biblico", "completa_versiculo", "retos_sabado", "ruleta_sabado", "aventuras_biblicas"), indícalo; si es presencial sin pantalla, déjalo vacío "".`;

    try {
      const { result: response, modelUsed } = await runWithTextFallback(
        (modelName, isFallback) =>
          ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              systemInstruction: buildDoctrinalSystemInstruction(db.creativeAi.profile),
              ...(isFallback
                ? {}
                : { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }),
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  subtitle: { type: Type.STRING },
                  centralTheme: { type: Type.STRING },
                  motto: { type: Type.STRING },
                  spiritualObjective: { type: Type.STRING },
                  mainBibleText: { type: Type.STRING },
                  mainBibleVerseQuote: { type: Type.STRING },
                  complementaryTexts: { type: Type.ARRAY, items: { type: Type.STRING } },
                  centralIdea: { type: Type.STRING },
                  introduction: { type: Type.STRING },
                  presenterMasterScript: { type: Type.STRING },
                  steps: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        blockType: { type: Type.STRING },
                        title: { type: Type.STRING },
                        durationMin: { type: Type.INTEGER },
                        whatDirectorDoes: { type: Type.STRING },
                        whatPresenterSays: { type: Type.STRING },
                        whatParticipantsDo: { type: Type.STRING },
                        howToOrganize: { type: Type.STRING },
                        howToStart: { type: Type.STRING },
                        howToDevelop: { type: Type.STRING },
                        howToFinish: { type: Type.STRING },
                        materials: { type: Type.ARRAY, items: { type: Type.STRING } },
                        spiritualTeaching: { type: Type.STRING },
                        biblicalReference: { type: Type.STRING },
                        contentDistinction: { type: Type.STRING },
                        compatibleGameMode: { type: Type.STRING },
                      },
                      required: [
                        'blockType',
                        'title',
                        'durationMin',
                        'whatDirectorDoes',
                        'whatPresenterSays',
                        'whatParticipantsDo',
                        'howToOrganize',
                        'howToStart',
                        'howToDevelop',
                        'howToFinish',
                        'materials',
                        'spiritualTeaching',
                        'contentDistinction',
                      ],
                    },
                  },
                  questionsForAudience: { type: Type.ARRAY, items: { type: Type.STRING } },
                  developedReflection: { type: Type.STRING },
                  materialsChecklist: { type: Type.ARRAY, items: { type: Type.STRING } },
                  imagePromptsSuggested: { type: Type.ARRAY, items: { type: Type.STRING } },
                  presentationOutlineSummary: { type: Type.ARRAY, items: { type: Type.STRING } },
                  weeklySpiritualChallenge: { type: Type.STRING },
                  farewellMessage: { type: Type.STRING },
                  doctrinalReviewPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                  verificationNotes: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: [
                  'title',
                  'subtitle',
                  'centralTheme',
                  'motto',
                  'spiritualObjective',
                  'mainBibleText',
                  'mainBibleVerseQuote',
                  'complementaryTexts',
                  'centralIdea',
                  'introduction',
                  'presenterMasterScript',
                  'steps',
                  'questionsForAudience',
                  'developedReflection',
                  'materialsChecklist',
                  'imagePromptsSuggested',
                  'presentationOutlineSummary',
                  'weeklySpiritualChallenge',
                  'farewellMessage',
                  'doctrinalReviewPoints',
                ],
              },
            },
          }),
        44000
      );

      const parsed = parseJsonSafe<Partial<AiCreativeProgram>>(
        response.text,
        'La IA devolvió una respuesta vacía al generar el programa.'
      );

      const program: AiCreativeProgram = {
        title: String(parsed.title || 'Programa Juvenil Cristiano').trim(),
        subtitle: String(parsed.subtitle || 'Encuentro de Sociedad de Jóvenes').trim(),
        centralTheme: String(parsed.centralTheme || topicOrRequest || 'Fe viva en acción').trim(),
        motto: String(parsed.motto || 'Fieles en palabra, conducta y amor').trim(),
        spiritualObjective: String(parsed.spiritualObjective || '').trim(),
        targetAudience,
        mainBibleText: String(parsed.mainBibleText || '1 Timoteo 4:12').trim(),
        mainBibleVerseQuote: String(parsed.mainBibleVerseQuote || '').trim(),
        complementaryTexts: Array.isArray(parsed.complementaryTexts)
          ? parsed.complementaryTexts.map(String).filter(Boolean)
          : [],
        centralIdea: String(parsed.centralIdea || '').trim(),
        durationMinutes,
        scheduledDate,
        eventType,
        allInclusiveMode,
        introduction: String(parsed.introduction || '').trim(),
        presenterMasterScript: String(parsed.presenterMasterScript || '').trim(),
        steps: sanitizeProgramSteps(
          Array.isArray(parsed.steps) ? parsed.steps : [],
          durationMinutes
        ),
        questionsForAudience: Array.isArray(parsed.questionsForAudience)
          ? parsed.questionsForAudience.map(String).filter(Boolean)
          : [],
        developedReflection: String(parsed.developedReflection || '').trim(),
        materialsChecklist: Array.isArray(parsed.materialsChecklist)
          ? parsed.materialsChecklist.map(String).filter(Boolean)
          : [],
        imagePromptsSuggested: Array.isArray(parsed.imagePromptsSuggested)
          ? parsed.imagePromptsSuggested.map(String).filter(Boolean)
          : [],
        presentationOutlineSummary: Array.isArray(parsed.presentationOutlineSummary)
          ? parsed.presentationOutlineSummary.map(String).filter(Boolean)
          : [],
        weeklySpiritualChallenge: String(parsed.weeklySpiritualChallenge || '').trim(),
        farewellMessage: String(parsed.farewellMessage || '').trim(),
        doctrinalReviewPoints: Array.isArray(parsed.doctrinalReviewPoints)
          ? parsed.doctrinalReviewPoints.map(String).filter(Boolean)
          : [],
        verificationNotes: Array.isArray(parsed.verificationNotes)
          ? parsed.verificationNotes.map(String).filter(Boolean)
          : [],
      };

      recordDiagnostic({
        operation: 'generate_program',
        ok: true,
        httpStatus: 200,
        errorCategory: 'NONE',
        code: 'OK',
        latencyMs: Math.max(1, Date.now() - startedAt),
        friendlyMessage: `Programa "${program.title}" generado con ${modelUsed}.`,
      });
      res.json({
        kind: 'program',
        payload: program,
        modelUsed,
        latencyMs: Math.max(1, Date.now() - startedAt),
      });
    } catch (err) {
      sendMappedError(res, err, 'text', 'generate_program', startedAt);
    }
  });

  // 5. GENERAR PREDICACIÓN / REFLEXIÓN / DEVOCIONAL / ESTUDIO BÍBLICO
  app.post('/api/ia-creativa/generate/sermon', async (req, res) => {
    const startedAt = Date.now();
    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        code: 'MISSING_API_KEY',
        errorCategory: 'MISSING_KEY',
        error: 'No se detectó GEMINI_API_KEY en el servidor. Configura tu clave en Settings > Secrets.',
      });
      return;
    }

    const db = ensureDb();
    const body = req.body || {};
    const sermonType = String(body.sermonType || 'sermon_juvenil') as SermonFormatType;
    const durationMinutes = Math.max(5, Math.min(90, Math.round(Number(body.durationMinutes) || 20)));
    const depth = (['breve', 'intermedia', 'profunda'].includes(body.depth)
      ? body.depth
      : 'intermedia') as AiCreativeSermon['depth'];
    const topic = String(body.topic || '').trim().slice(0, 350);
    const bibleTextPreference = String(body.bibleTextPreference || '').trim().slice(0, 120);

    const prompt = `Prepara un contenido homilético/bíblico completo de tipo "${sermonType}".
Duración aproximada de exposición: ${durationMinutes} minutos.
Nivel de profundidad: ${depth}.
Tema o necesidad juvenil: ${topic || 'Tema bíblico edificante y práctico para jóvenes cristianos.'}
${bibleTextPreference ? `Texto bíblico base solicitado: ${bibleTextPreference}` : 'Selecciona un pasaje bíblico real y apropiado.'}

IMPORTANTE:
- No inventes citas ni referencias bíblicas. Si una referencia requiere verificación del pasaje en su Biblia local, indícalo en "biblicalVerificationNote".
- Identifica claramente todas las ilustraciones o anécdotas como ejemplos ilustrativos ("Ejemplo ilustrativo: ...") y nunca como hechos históricos si son figurados.
- Incluye contexto histórico/literario fiel del pasaje, desarrollo claro por puntos, aplicación práctica cotidiana para jóvenes, conclusión, llamado respetuoso y oración sugerida.`;

    try {
      const { result: response, modelUsed } = await runWithTextFallback(
        (modelName, isFallback) =>
          ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              systemInstruction: buildDoctrinalSystemInstruction(db.creativeAi.profile),
              ...(isFallback
                ? {}
                : { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }),
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  objective: { type: Type.STRING },
                  mainBibleText: { type: Type.STRING },
                  passageContext: { type: Type.STRING },
                  introduction: { type: Type.STRING },
                  mainPoints: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        heading: { type: Type.STRING },
                        bibleSupport: { type: Type.STRING },
                        explanation: { type: Type.STRING },
                        illustrationExample: { type: Type.STRING },
                        youthApplication: { type: Type.STRING },
                      },
                      required: [
                        'heading',
                        'bibleSupport',
                        'explanation',
                        'illustrationExample',
                        'youthApplication',
                      ],
                    },
                  },
                  complementaryReferences: { type: Type.ARRAY, items: { type: Type.STRING } },
                  dailyLifeApplication: { type: Type.STRING },
                  conclusion: { type: Type.STRING },
                  spiritualCall: { type: Type.STRING },
                  suggestedPrayer: { type: Type.STRING },
                  biblicalVerificationNote: { type: Type.STRING },
                  doctrinalReviewPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: [
                  'title',
                  'objective',
                  'mainBibleText',
                  'passageContext',
                  'introduction',
                  'mainPoints',
                  'complementaryReferences',
                  'dailyLifeApplication',
                  'conclusion',
                  'spiritualCall',
                  'suggestedPrayer',
                  'biblicalVerificationNote',
                  'doctrinalReviewPoints',
                ],
              },
            },
          }),
        38000
      );

      const parsed = parseJsonSafe<Partial<AiCreativeSermon>>(
        response.text,
        'La IA devolvió una respuesta vacía al generar la predicación.'
      );

      const sermon: AiCreativeSermon = {
        title: String(parsed.title || 'Mensaje Juvenil').trim(),
        sermonType,
        durationMinutes,
        depth,
        objective: String(parsed.objective || '').trim(),
        mainBibleText: String(parsed.mainBibleText || bibleTextPreference || 'Salmos 119:9').trim(),
        passageContext: String(parsed.passageContext || '').trim(),
        introduction: String(parsed.introduction || '').trim(),
        mainPoints: Array.isArray(parsed.mainPoints) ? parsed.mainPoints : [],
        complementaryReferences: Array.isArray(parsed.complementaryReferences)
          ? parsed.complementaryReferences.map(String).filter(Boolean)
          : [],
        dailyLifeApplication: String(parsed.dailyLifeApplication || '').trim(),
        conclusion: String(parsed.conclusion || '').trim(),
        spiritualCall: String(parsed.spiritualCall || '').trim(),
        suggestedPrayer: String(parsed.suggestedPrayer || '').trim(),
        biblicalVerificationNote: String(parsed.biblicalVerificationNote || '').trim(),
        doctrinalReviewPoints: Array.isArray(parsed.doctrinalReviewPoints)
          ? parsed.doctrinalReviewPoints.map(String).filter(Boolean)
          : [],
      };

      recordDiagnostic({
        operation: 'generate_sermon',
        ok: true,
        httpStatus: 200,
        errorCategory: 'NONE',
        code: 'OK',
        latencyMs: Math.max(1, Date.now() - startedAt),
        friendlyMessage: `Predicación "${sermon.title}" generada con ${modelUsed}.`,
      });
      res.json({ kind: 'sermon', payload: sermon, modelUsed, latencyMs: Math.max(1, Date.now() - startedAt) });
    } catch (err) {
      sendMappedError(res, err, 'text', 'generate_sermon', startedAt);
    }
  });

  // 6. GENERAR DINÁMICA O JUEGO CRISTIANO
  app.post('/api/ia-creativa/generate/activity', async (req, res) => {
    const startedAt = Date.now();
    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        code: 'MISSING_API_KEY',
        errorCategory: 'MISSING_KEY',
        error: 'No se detectó GEMINI_API_KEY en el servidor.',
      });
      return;
    }

    const db = ensureDb();
    const body = req.body || {};
    const category = String(body.category || 'rompehielos') as ActivityCategoryType;
    const participantCount = String(body.participantCount || '20 a 35 jóvenes').trim();
    const durationMinutes = Math.max(3, Math.min(90, Math.round(Number(body.durationMinutes) || 15)));
    const topic = String(body.topic || '').trim().slice(0, 300);
    const historyDigest = buildHistoryAntiRepeatDigest(db);

    const prompt = `Diseña una dinámica o juego cristiano juvenil completo de la categoría "${category}".
Cantidad de participantes: ${participantCount}
Duración estimada: ${durationMinutes} minutos.
Tema / enfoque solicitado: ${topic || 'Edificación, trabajo en equipo y conocimiento bíblico.'}

No repitas estas dinámicas recientes:
${historyDigest}

Modos de juego reales existentes en DIME TÚ QUÉ DICES que se pueden lanzar en vivo si la dinámica encaja con competencia/trivia/retos:
"clasico", "velocidad", "equipos", "competencia_equipos", "ruleta_biblica", "quien_soy", "misterio_biblico", "crucigrama_biblico", "completa_versiculo", "retos_sabado", "ruleta_sabado", "aventuras_biblicas".
Si aplica, pon el ID exacto en "compatibleGameMode" y explica brevemente por qué en "compatibleGameReason". Si es una dinámica puramente física/presencial, deja "compatibleGameMode" como "".`;

    try {
      const { result: response, modelUsed } = await runWithTextFallback(
        (modelName, isFallback) =>
          ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              systemInstruction: buildDoctrinalSystemInstruction(db.creativeAi.profile),
              ...(isFallback
                ? {}
                : { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }),
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  objective: { type: Type.STRING },
                  participantCount: { type: Type.STRING },
                  durationMinutes: { type: Type.INTEGER },
                  materials: { type: Type.ARRAY, items: { type: Type.STRING } },
                  preparation: { type: Type.STRING },
                  rules: { type: Type.ARRAY, items: { type: Type.STRING } },
                  stepByStep: { type: Type.ARRAY, items: { type: Type.STRING } },
                  howToDetermineResult: { type: Type.STRING },
                  spiritualReflection: { type: Type.STRING },
                  biblicalReference: { type: Type.STRING },
                  variants: { type: Type.ARRAY, items: { type: Type.STRING } },
                  compatibleGameMode: { type: Type.STRING },
                  compatibleGameReason: { type: Type.STRING },
                },
                required: [
                  'name',
                  'objective',
                  'participantCount',
                  'durationMinutes',
                  'materials',
                  'preparation',
                  'rules',
                  'stepByStep',
                  'howToDetermineResult',
                  'spiritualReflection',
                  'variants',
                ],
              },
            },
          }),
        36000
      );

      const parsed = parseJsonSafe<Partial<AiCreativeActivity>>(
        response.text,
        'La IA devolvió una respuesta vacía al generar la dinámica.'
      );

      const activity: AiCreativeActivity = {
        name: String(parsed.name || 'Dinámica Juvenil').trim(),
        category,
        objective: String(parsed.objective || '').trim(),
        participantCount: String(parsed.participantCount || participantCount).trim(),
        durationMinutes: Number(parsed.durationMinutes) || durationMinutes,
        materials: Array.isArray(parsed.materials) ? parsed.materials.map(String) : [],
        preparation: String(parsed.preparation || '').trim(),
        rules: Array.isArray(parsed.rules) ? parsed.rules.map(String) : [],
        stepByStep: Array.isArray(parsed.stepByStep) ? parsed.stepByStep.map(String) : [],
        howToDetermineResult: String(parsed.howToDetermineResult || '').trim(),
        spiritualReflection: String(parsed.spiritualReflection || '').trim(),
        biblicalReference: String(parsed.biblicalReference || '').trim() || undefined,
        variants: Array.isArray(parsed.variants) ? parsed.variants.map(String) : [],
        compatibleGameMode: String(parsed.compatibleGameMode || '').trim() || undefined,
        compatibleGameReason: String(parsed.compatibleGameReason || '').trim() || undefined,
      };

      recordDiagnostic({
        operation: 'generate_activity',
        ok: true,
        httpStatus: 200,
        errorCategory: 'NONE',
        code: 'OK',
        latencyMs: Math.max(1, Date.now() - startedAt),
        friendlyMessage: `Dinámica "${activity.name}" generada con ${modelUsed}.`,
      });
      res.json({ kind: 'activity', payload: activity, modelUsed, latencyMs: Math.max(1, Date.now() - startedAt) });
    } catch (err) {
      sendMappedError(res, err, 'text', 'generate_activity', startedAt);
    }
  });

  // 7. GENERAR GUION Y DRAMATIZACIÓN
  app.post('/api/ia-creativa/generate/script', async (req, res) => {
    const startedAt = Date.now();
    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        code: 'MISSING_API_KEY',
        errorCategory: 'MISSING_KEY',
        error: 'No se detectó GEMINI_API_KEY en el servidor.',
      });
      return;
    }

    const db = ensureDb();
    const body = req.body || {};
    const scriptType = String(body.scriptType || 'drama_biblico') as ScriptFormatType;
    const participantCount = Math.max(1, Math.min(25, Math.round(Number(body.participantCount) || 4)));
    const durationMinutes = Math.max(2, Math.min(45, Math.round(Number(body.durationMinutes) || 10)));
    const topic = String(body.topic || '').trim().slice(0, 350);

    const prompt = `Redacta un guion completo de tipo "${scriptType}".
Cantidad de actores/participantes: ${participantCount}.
Duración estimada en escena: ${durationMinutes} minutos.
Tema / historia bíblica: ${topic || 'Historia o situación juvenil con enseñanza bíblica clara.'}

REGLA CRÍTICA DE INTEGRIDAD BÍBLICA:
- En "biblicalVsCreativeDistinction", explica explícitamente qué parte de la historia corresponde fielmente al relato bíblico real y qué diálogos o detalles escénicos son adaptación dramática creativa.
- Nunca hagas pasar una licencia dramática o diálogo moderno como cita textual de la Biblia.`;

    try {
      const { result: response, modelUsed } = await runWithTextFallback(
        (modelName, isFallback) =>
          ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              systemInstruction: buildDoctrinalSystemInstruction(db.creativeAi.profile),
              ...(isFallback
                ? {}
                : { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }),
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  biblicalBasis: { type: Type.STRING },
                  characters: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        role: { type: Type.STRING },
                        wardrobeSuggestion: { type: Type.STRING },
                      },
                      required: ['name', 'role', 'wardrobeSuggestion'],
                    },
                  },
                  scenery: { type: Type.STRING },
                  materials: { type: Type.ARRAY, items: { type: Type.STRING } },
                  actingNotes: { type: Type.STRING },
                  scenes: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        sceneNumber: { type: Type.INTEGER },
                        sceneTitle: { type: Type.STRING },
                        stageSetting: { type: Type.STRING },
                        lines: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              speaker: { type: Type.STRING },
                              actingCue: { type: Type.STRING },
                              dialogue: { type: Type.STRING },
                            },
                            required: ['speaker', 'actingCue', 'dialogue'],
                          },
                        },
                      },
                      required: ['sceneNumber', 'sceneTitle', 'stageSetting', 'lines'],
                    },
                  },
                  spiritualMessage: { type: Type.STRING },
                  biblicalVsCreativeDistinction: { type: Type.STRING },
                  doctrinalReviewPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: [
                  'title',
                  'biblicalBasis',
                  'characters',
                  'scenery',
                  'materials',
                  'actingNotes',
                  'scenes',
                  'spiritualMessage',
                  'biblicalVsCreativeDistinction',
                  'doctrinalReviewPoints',
                ],
              },
            },
          }),
        38000
      );

      const parsed = parseJsonSafe<Partial<AiCreativeScript>>(
        response.text,
        'La IA devolvió una respuesta vacía al generar el guion.'
      );

      const script: AiCreativeScript = {
        title: String(parsed.title || 'Guion Juvenil').trim(),
        scriptType,
        durationMinutes,
        participantCount,
        biblicalBasis: String(parsed.biblicalBasis || '').trim(),
        characters: Array.isArray(parsed.characters) ? parsed.characters : [],
        scenery: String(parsed.scenery || '').trim(),
        materials: Array.isArray(parsed.materials) ? parsed.materials.map(String) : [],
        actingNotes: String(parsed.actingNotes || '').trim(),
        scenes: Array.isArray(parsed.scenes) ? parsed.scenes : [],
        spiritualMessage: String(parsed.spiritualMessage || '').trim(),
        biblicalVsCreativeDistinction: String(parsed.biblicalVsCreativeDistinction || '').trim(),
        doctrinalReviewPoints: Array.isArray(parsed.doctrinalReviewPoints)
          ? parsed.doctrinalReviewPoints.map(String)
          : [],
      };

      recordDiagnostic({
        operation: 'generate_script',
        ok: true,
        httpStatus: 200,
        errorCategory: 'NONE',
        code: 'OK',
        latencyMs: Math.max(1, Date.now() - startedAt),
        friendlyMessage: `Guion "${script.title}" generado con ${modelUsed}.`,
      });
      res.json({ kind: 'script', payload: script, modelUsed, latencyMs: Math.max(1, Date.now() - startedAt) });
    } catch (err) {
      sendMappedError(res, err, 'text', 'generate_script', startedAt);
    }
  });

  // 8. GENERAR PRESENTACIÓN DE DIAPOSITIVAS
  app.post('/api/ia-creativa/generate/presentation', async (req, res) => {
    const startedAt = Date.now();
    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        code: 'MISSING_API_KEY',
        errorCategory: 'MISSING_KEY',
        error: 'No se detectó GEMINI_API_KEY en el servidor.',
      });
      return;
    }

    const db = ensureDb();
    const body = req.body || {};
    const topic = String(body.topic || '').trim().slice(0, 400);
    const slideCount = Math.max(6, Math.min(14, Math.round(Number(body.slideCount) || 8)));
    const sourceRecordId = String(body.sourceRecordId || '').trim();
    const sourceRecord = sourceRecordId ? db.creativeAi.records[sourceRecordId] : undefined;

    const sourceContext = sourceRecord
      ? `\nCONTENIDO BASE DEL RECURSO SELECCIONADO ("${sourceRecord.title}"):\n${JSON.stringify(sourceRecord.payload).slice(0, 4500)}`
      : '';

    const prompt = `Genera una presentación estructurada para proyectar en Sociedad de Jóvenes o culto juvenil.
Cantidad aproximada de diapositivas: ${slideCount}.
Tema o enfoque: ${topic || sourceRecord?.title || 'Fe y propósito juvenil en Cristo'}.${sourceContext}

Debe cubrir en orden lógico:
1. Portada (kind="portada")
2. Tema (kind="tema")
3. Texto bíblico (kind="texto_biblico")
4. Objetivos (kind="objetivos")
5. Puntos principales (kind="punto_principal")
6. Preguntas para el público (kind="preguntas")
7. Actividades (kind="actividad")
8. Reflexión final (kind="reflexion_final")

Cada diapositiva debe ser clara y legible para proyector (bullets cortos y precisos, versículo exacto cuando corresponda, y notas del presentador en speakerNotes). No inventes URLs de imágenes.`;

    try {
      const { result: response, modelUsed } = await runWithTextFallback(
        (modelName, isFallback) =>
          ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              systemInstruction: buildDoctrinalSystemInstruction(db.creativeAi.profile),
              ...(isFallback
                ? {}
                : { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }),
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  theme: { type: Type.STRING },
                  mainBibleText: { type: Type.STRING },
                  visualTone: { type: Type.STRING },
                  slides: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        kind: { type: Type.STRING },
                        title: { type: Type.STRING },
                        subtitle: { type: Type.STRING },
                        bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
                        bibleVerse: { type: Type.STRING },
                        speakerNotes: { type: Type.STRING },
                        accentHex: { type: Type.STRING },
                      },
                      required: ['kind', 'title', 'bullets', 'speakerNotes'],
                    },
                  },
                },
                required: ['title', 'theme', 'mainBibleText', 'visualTone', 'slides'],
              },
            },
          }),
        38000
      );

      const parsed = parseJsonSafe<Partial<AiCreativePresentation>>(
        response.text,
        'La IA devolvió una respuesta vacía al generar la presentación.'
      );

      const rawSlides = Array.isArray(parsed.slides) ? parsed.slides : [];
      const presentation: AiCreativePresentation = {
        title: String(parsed.title || 'Presentación Juvenil').trim(),
        theme: String(parsed.theme || topic || 'Sociedad de Jóvenes').trim(),
        mainBibleText: String(parsed.mainBibleText || '1 Timoteo 4:12').trim(),
        visualTone: String(parsed.visualTone || 'Moderno nocturno con acentos dorados').trim(),
        slides: rawSlides.map((s, idx) => ({
          id: `SLD-${idx + 1}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
          order: idx + 1,
          kind: (s.kind as AiCreativePresentation['slides'][number]['kind']) || 'punto_principal',
          title: String(s.title || `Diapositiva ${idx + 1}`).trim(),
          subtitle: s.subtitle ? String(s.subtitle).trim() : undefined,
          bullets: Array.isArray(s.bullets) ? s.bullets.map(String).filter(Boolean) : [],
          bibleVerse: s.bibleVerse ? String(s.bibleVerse).trim() : undefined,
          speakerNotes: s.speakerNotes ? String(s.speakerNotes).trim() : undefined,
          accentHex: /^#[0-9A-Fa-f]{6}$/.test(String(s.accentHex || ''))
            ? String(s.accentHex)
            : '#F59E0B',
        })),
      };

      recordDiagnostic({
        operation: 'generate_presentation',
        ok: true,
        httpStatus: 200,
        errorCategory: 'NONE',
        code: 'OK',
        latencyMs: Math.max(1, Date.now() - startedAt),
        friendlyMessage: `Presentación "${presentation.title}" generada con ${modelUsed}.`,
      });
      res.json({ kind: 'presentation', payload: presentation, modelUsed, latencyMs: Math.max(1, Date.now() - startedAt) });
    } catch (err) {
      sendMappedError(res, err, 'text', 'generate_presentation', startedAt);
    }
  });

  // 9. ORGANIZADOR DE EVENTOS CRISTIANOS
  app.post('/api/ia-creativa/generate/event', async (req, res) => {
    const startedAt = Date.now();
    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        code: 'MISSING_API_KEY',
        errorCategory: 'MISSING_KEY',
        error: 'No se detectó GEMINI_API_KEY en el servidor.',
      });
      return;
    }

    const db = ensureDb();
    const body = req.body || {};
    const eventType = String(body.eventType || 'semana_oracion') as ChristianEventType;
    const topic = String(body.topic || '').trim().slice(0, 350);
    const participantCount = Math.max(10, Math.min(2000, Number(body.participantCount) || 60));
    const includeBudget = Boolean(body.includeBudget);
    const currencyNote = String(body.currencyNote || 'USD (referencial)').trim().slice(0, 40);

    const prompt = `Diseña un plan organizativo completo para el evento cristiano tipo "${eventType}".
Público estimado: ${participantCount} asistentes.
Tema / enfoque: ${topic || 'Avivamiento juvenil, unidad y servicio misionero.'}
Incluir presupuesto estimado: ${includeBudget ? `SÍ, en formato referencial (${currencyNote}), aclarando explícitamente que los montos son estimaciones orientativas que deben ajustarse al país y cotizaciones locales` : 'NO incluir montos de presupuesto (devolver lista vacía en estimatedBudget)'}.

Debe incluir tema general, objetivos medibles, cronograma detallado, responsables sugeridos por rol, actividades clave, recursos, materiales, plan de promoción y criterios de evaluación final.`;

    try {
      const { result: response, modelUsed } = await runWithTextFallback(
        (modelName, isFallback) =>
          ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              systemInstruction: buildDoctrinalSystemInstruction(db.creativeAi.profile),
              ...(isFallback
                ? {}
                : { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }),
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  generalTheme: { type: Type.STRING },
                  mainBibleText: { type: Type.STRING },
                  objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
                  schedule: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        block: { type: Type.STRING },
                        timeSlot: { type: Type.STRING },
                        activity: { type: Type.STRING },
                        responsibleRole: { type: Type.STRING },
                      },
                      required: ['block', 'timeSlot', 'activity', 'responsibleRole'],
                    },
                  },
                  suggestedResponsibles: { type: Type.ARRAY, items: { type: Type.STRING } },
                  activities: { type: Type.ARRAY, items: { type: Type.STRING } },
                  resourcesNeeded: { type: Type.ARRAY, items: { type: Type.STRING } },
                  materials: { type: Type.ARRAY, items: { type: Type.STRING } },
                  promotionPlan: { type: Type.ARRAY, items: { type: Type.STRING } },
                  estimatedBudget: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        category: { type: Type.STRING },
                        concept: { type: Type.STRING },
                        estimatedAmountNote: { type: Type.STRING },
                      },
                      required: ['category', 'concept', 'estimatedAmountNote'],
                    },
                  },
                  budgetDisclaimer: { type: Type.STRING },
                  finalEvaluationCriteria: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: [
                  'title',
                  'generalTheme',
                  'mainBibleText',
                  'objectives',
                  'schedule',
                  'suggestedResponsibles',
                  'activities',
                  'resourcesNeeded',
                  'materials',
                  'promotionPlan',
                  'estimatedBudget',
                  'finalEvaluationCriteria',
                ],
              },
            },
          }),
        38000
      );

      const parsed = parseJsonSafe<Partial<AiCreativeEvent>>(
        response.text,
        'La IA devolvió una respuesta vacía al generar el plan del evento.'
      );

      const eventPlan: AiCreativeEvent = {
        title: String(parsed.title || 'Plan de Evento Juvenil').trim(),
        eventType,
        generalTheme: String(parsed.generalTheme || topic || 'Generación con Propósito').trim(),
        mainBibleText: String(parsed.mainBibleText || 'Romanos 12:1-2').trim(),
        objectives: Array.isArray(parsed.objectives) ? parsed.objectives.map(String) : [],
        schedule: Array.isArray(parsed.schedule) ? parsed.schedule : [],
        suggestedResponsibles: Array.isArray(parsed.suggestedResponsibles)
          ? parsed.suggestedResponsibles.map(String)
          : [],
        activities: Array.isArray(parsed.activities) ? parsed.activities.map(String) : [],
        resourcesNeeded: Array.isArray(parsed.resourcesNeeded)
          ? parsed.resourcesNeeded.map(String)
          : [],
        materials: Array.isArray(parsed.materials) ? parsed.materials.map(String) : [],
        promotionPlan: Array.isArray(parsed.promotionPlan)
          ? parsed.promotionPlan.map(String)
          : [],
        includeBudget,
        estimatedBudget: includeBudget && Array.isArray(parsed.estimatedBudget)
          ? parsed.estimatedBudget
          : [],
        budgetDisclaimer: includeBudget
          ? String(
              parsed.budgetDisclaimer ||
                'Presupuesto referencial estimado: ajusta los valores según cotizaciones reales locales.'
            )
          : undefined,
        finalEvaluationCriteria: Array.isArray(parsed.finalEvaluationCriteria)
          ? parsed.finalEvaluationCriteria.map(String)
          : [],
      };

      recordDiagnostic({
        operation: 'generate_event',
        ok: true,
        httpStatus: 200,
        errorCategory: 'NONE',
        code: 'OK',
        latencyMs: Math.max(1, Date.now() - startedAt),
        friendlyMessage: `Evento "${eventPlan.title}" generado con ${modelUsed}.`,
      });
      res.json({ kind: 'event', payload: eventPlan, modelUsed, latencyMs: Math.max(1, Date.now() - startedAt) });
    } catch (err) {
      sendMappedError(res, err, 'text', 'generate_event', startedAt);
    }
  });

  // 10. ASISTENTE DE MÚSICA Y ALABANZA
  app.post('/api/ia-creativa/generate/music', async (req, res) => {
    const startedAt = Date.now();
    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        code: 'MISSING_API_KEY',
        errorCategory: 'MISSING_KEY',
        error: 'No se detectó GEMINI_API_KEY en el servidor.',
      });
      return;
    }

    const db = ensureDb();
    const body = req.body || {};
    const topic = String(body.topic || '').trim().slice(0, 300);
    const mainBibleText = String(body.mainBibleText || '').trim().slice(0, 80);
    const congregationStyle = String(body.congregationStyle || 'Juvenil congregacional equilibrado')
      .trim()
      .slice(0, 120);

    const prompt = `Organiza los momentos musicales de un programa de Sociedad de Jóvenes alrededor del tema "${topic || 'Gratitud y fidelidad a Dios'}"${mainBibleText ? ` (texto guía: ${mainBibleText})` : ''}.
Estilo congregacional: ${congregationStyle}.

Los 5 momentos obligatorios en "moments":
1. moment="apertura" (Apertura)
2. moment="alabanza_congregacional" (Alabanza congregacional)
3. moment="musica_reflexion" (Música de reflexión)
4. moment="musica_instrumental" (Música instrumental)
5. moment="cierre" (Cierre)

REGLAS ESTRICTAS DE HONESTIDAD Y DERECHOS DE AUTOR:
- PROHIBIDO inventar títulos de canciones, autores o enlaces (URLs).
- PROHIBIDO reproducir letras completas de canciones protegidas por derechos de autor.
- En "songOrHymnGuidance", propón enfoques temáticos/líricos o himnos clásicos ampliamente conocidos o criterios de selección, indicando siempre en "verificationRequiredNote" que el ministerio de alabanza debe verificar el título, autor y licencia oficial en el himnario o catálogo CCLI de la iglesia.`;

    try {
      const { result: response, modelUsed } = await runWithTextFallback(
        (modelName, isFallback) =>
          ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              systemInstruction: buildDoctrinalSystemInstruction(db.creativeAi.profile),
              ...(isFallback
                ? {}
                : { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }),
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  centralTheme: { type: Type.STRING },
                  mainBibleText: { type: Type.STRING },
                  copyrightComplianceNote: { type: Type.STRING },
                  verificationNotice: { type: Type.STRING },
                  moments: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        moment: { type: Type.STRING },
                        momentLabel: { type: Type.STRING },
                        spiritualPurpose: { type: Type.STRING },
                        suggestedStyleAndTempo: { type: Type.STRING },
                        biblicalEmphasis: { type: Type.STRING },
                        teamInstructions: { type: Type.STRING },
                        songOrHymnGuidance: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              suggestion: { type: Type.STRING },
                              verificationRequiredNote: { type: Type.STRING },
                            },
                            required: ['suggestion', 'verificationRequiredNote'],
                          },
                        },
                      },
                      required: [
                        'moment',
                        'momentLabel',
                        'spiritualPurpose',
                        'suggestedStyleAndTempo',
                        'biblicalEmphasis',
                        'teamInstructions',
                        'songOrHymnGuidance',
                      ],
                    },
                  },
                },
                required: [
                  'title',
                  'centralTheme',
                  'mainBibleText',
                  'copyrightComplianceNote',
                  'verificationNotice',
                  'moments',
                ],
              },
            },
          }),
        36000
      );

      const parsed = parseJsonSafe<Partial<AiCreativeMusicPlan>>(
        response.text,
        'La IA devolvió una respuesta vacía al organizar la música.'
      );

      const musicPlan: AiCreativeMusicPlan = {
        title: String(parsed.title || 'Plan Musical del Sábado').trim(),
        centralTheme: String(parsed.centralTheme || topic || 'Adoración en espíritu y verdad').trim(),
        mainBibleText: String(parsed.mainBibleText || mainBibleText || 'Salmos 100:1-5').trim(),
        copyrightComplianceNote: String(
          parsed.copyrightComplianceNote ||
            'Este plan respeta los derechos de autor: no incluye letras completas ni enlaces externos no verificados.'
        ).trim(),
        verificationNotice: String(
          parsed.verificationNotice ||
            'El director de alabanza debe verificar cada canto o himno en su himnario oficial o catálogo autorizado de la iglesia.'
        ).trim(),
        moments: Array.isArray(parsed.moments) ? parsed.moments : [],
      };

      recordDiagnostic({
        operation: 'generate_music',
        ok: true,
        httpStatus: 200,
        errorCategory: 'NONE',
        code: 'OK',
        latencyMs: Math.max(1, Date.now() - startedAt),
        friendlyMessage: `Guía de alabanza "${musicPlan.title}" generada con ${modelUsed}.`,
      });
      res.json({ kind: 'music', payload: musicPlan, modelUsed, latencyMs: Math.max(1, Date.now() - startedAt) });
    } catch (err) {
      sendMappedError(res, err, 'text', 'generate_music', startedAt);
    }
  });

  // 11. EDITOR INTELIGENTE — REFINAR / REGENERAR SECCIÓN / MODIFICAR CON IA
  app.post('/api/ia-creativa/refine', async (req, res) => {
    const startedAt = Date.now();
    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        code: 'MISSING_API_KEY',
        errorCategory: 'MISSING_KEY',
        error: 'No se detectó GEMINI_API_KEY en el servidor.',
      });
      return;
    }

    const db = ensureDb();
    const body = req.body || {};
    const kind = String(body.kind || '') as CreativeToolKind;
    const payload = body.payload as CreativePayloadUnion | undefined;
    const instruction = String(body.instruction || '').trim().slice(0, 600);
    const targetStepId = String(body.targetStepId || '').trim();
    const requestedDuration = Number(body.requestedDuration || 0);

    if (!kind || !payload || !instruction) {
      res.status(400).json({
        error: 'Faltan parámetros requeridos (tipo de recurso, contenido actual e instrucción de mejora).',
      });
      return;
    }

    const historyDigest = buildHistoryAntiRepeatDigest(db);
    const durationTarget =
      requestedDuration === 60 || requestedDuration === 90 || requestedDuration === 120
        ? requestedDuration
        : kind === 'program'
          ? (payload as AiCreativeProgram).durationMinutes || 90
          : 0;

    const prompt = `Eres el EDITOR INTELIGENTE de "IA CREATIVA JUVENIL".
Tu tarea es modificar ÚNICAMENTE lo solicitado por el director sobre el recurso existente de tipo "${kind}", conservando exactamente la misma estructura JSON y todos los demás campos intactos y coherentes.

INSTRUCCIÓN DEL DIRECTOR:
"${instruction}"
${targetStepId ? `Nota: El cambio se enfoca especialmente en el bloque/paso o elemento con id="${targetStepId}".` : ''}
${kind === 'program' && durationTarget ? `Duración total obligatoria del programa tras el ajuste: ${durationTarget} minutos.` : ''}

HISTORIAL A EVITAR REPETIR:
${historyDigest}

JSON ACTUAL DEL RECURSO A EDITAR:
${JSON.stringify(payload)}

DEVUELVE EXCLUSIVAMENTE EL OBJETO JSON ACTUALIZADO (mismo esquema que el JSON actual, sin bloques markdown).`;

    try {
      const { result: response, modelUsed } = await runWithTextFallback(
        (modelName, isFallback) =>
          ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              systemInstruction: buildDoctrinalSystemInstruction(db.creativeAi.profile),
              ...(isFallback
                ? {}
                : { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }),
              responseMimeType: 'application/json',
            },
          }),
        38000
      );

      const updated = parseJsonSafe<Record<string, unknown>>(
        response.text,
        'La IA devolvió una respuesta vacía al editar el recurso.'
      );

      if (kind === 'program') {
        const currentProg = payload as AiCreativeProgram;
        const dur = normalizeProgramDuration(durationTarget || updated.durationMinutes || currentProg.durationMinutes);
        const normalized: AiCreativeProgram = {
          ...currentProg,
          ...(updated as Partial<AiCreativeProgram>),
          durationMinutes: dur,
          steps: sanitizeProgramSteps(
            Array.isArray(updated.steps) ? updated.steps : currentProg.steps,
            dur
          ),
        };
        recordDiagnostic({
          operation: 'refine_resource',
          ok: true,
          httpStatus: 200,
          errorCategory: 'NONE',
          code: 'OK',
          latencyMs: Math.max(1, Date.now() - startedAt),
          friendlyMessage: `Programa actualizado con ${modelUsed}.`,
        });
        res.json({ kind, payload: normalized, modelUsed, latencyMs: Math.max(1, Date.now() - startedAt) });
        return;
      }

      if (kind === 'presentation') {
        const currentPres = payload as AiCreativePresentation;
        const nextSlides = Array.isArray(updated.slides)
          ? (updated.slides as AiCreativePresentation['slides']).map((s, idx) => ({
              ...s,
              id: s.id || `SLD-${idx + 1}`,
              order: idx + 1,
              bullets: Array.isArray(s.bullets) ? s.bullets.map(String) : [],
            }))
          : currentPres.slides;
        recordDiagnostic({
          operation: 'refine_resource',
          ok: true,
          httpStatus: 200,
          errorCategory: 'NONE',
          code: 'OK',
          latencyMs: Math.max(1, Date.now() - startedAt),
          friendlyMessage: `Presentación actualizada con ${modelUsed}.`,
        });
        res.json({
          kind,
          payload: {
            ...currentPres,
            ...(updated as Partial<AiCreativePresentation>),
            slides: nextSlides,
          },
          modelUsed,
          latencyMs: Math.max(1, Date.now() - startedAt),
        });
        return;
      }

      recordDiagnostic({
        operation: 'refine_resource',
        ok: true,
        httpStatus: 200,
        errorCategory: 'NONE',
        code: 'OK',
        latencyMs: Math.max(1, Date.now() - startedAt),
        friendlyMessage: `Recurso "${kind}" actualizado con ${modelUsed}.`,
      });
      res.json({
        kind,
        payload: { ...(payload as unknown as Record<string, unknown>), ...updated },
        modelUsed,
        latencyMs: Math.max(1, Date.now() - startedAt),
      });
    } catch (err) {
      sendMappedError(res, err, 'text', 'refine_resource', startedAt);
    }
  });

  // 12. CHAT CONVERSACIONAL INTELIGENTE CRISTIANO (COMPRENSIÓN LIBRE + PLANIFICACIÓN + RECURSOS ESTRUCTURADOS)
  app.post('/api/ia-creativa/chat', async (req, res) => {
    const startedAt = Date.now();
    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        code: 'MISSING_API_KEY',
        errorCategory: 'MISSING_KEY',
        error:
          'No se detectó GEMINI_API_KEY en el servidor. Configura tu clave en Settings > Secrets para conversar con la IA.',
      });
      return;
    }

    const db = ensureDb();
    const body = req.body || {};
    const message = String(body.message || '').trim().slice(0, 4000);
    if (!message) {
      res.status(400).json({
        code: 'EMPTY_MESSAGE',
        errorCategory: 'BAD_REQUEST_400',
        error: 'Escribe una idea o mensaje para conversar con la IA.',
      });
      return;
    }

    const sessionIdParam = String(body.sessionId || '').trim();
    const activeRecordId = String(body.activeRecordId || '').trim() || undefined;
    const activeContextPayload = body.activeContextPayload;
    const activeContextKind = String(body.activeContextKind || '').trim();

    let session: AiCreativeChatSession | undefined = sessionIdParam
      ? db.creativeAi.chatSessions[sessionIdParam]
      : undefined;

    const now = Date.now();
    if (!session) {
      const newSid = `CHAT-${now.toString(36).toUpperCase()}-${crypto
        .randomBytes(2)
        .toString('hex')
        .toUpperCase()}`;
      session = {
        id: newSid,
        title: message.slice(0, 56) + (message.length > 56 ? '…' : ''),
        activeRecordId,
        messages: [],
        createdAt: now,
        updatedAt: now,
      };
      db.creativeAi.chatSessions[newSid] = session;
    }

    const historyForGemini = session.messages.slice(-14).map((m) => ({
      role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: m.text }],
    }));

    const activeRecord = activeRecordId
      ? db.creativeAi.records[activeRecordId]
      : undefined;
    const lastChatArtifact = [...session.messages]
      .reverse()
      .find((m) => m.structuredArtifact)?.structuredArtifact;

    const effectiveContextKind =
      activeContextKind || activeRecord?.kind || lastChatArtifact?.kind || '';
    const effectiveContextPayload =
      activeContextPayload || activeRecord?.payload || lastChatArtifact?.payload;

    const contextSummary = effectiveContextPayload
      ? `RECURSO ACTUAL DE TRABAJO (${effectiveContextKind || 'programa'}):\n${JSON.stringify(effectiveContextPayload).slice(0, 7500)}`
      : 'No hay un recurso abierto todavía; si el director pide crear un programa, dinámica, drama, reflexión, evento, música o presentación, créalo desde cero.';

    const historyDigest = buildHistoryAntiRepeatDigest(db);
    const systemInstruction = `${buildDoctrinalSystemInstruction(db.creativeAi.profile)}

CAPACIDAD DE COMPRENSIÓN LIBRE Y PLANIFICACIÓN:
El director puede escribir con ideas desordenadas, informales, incompletas, con faltas de ortografía o combinando varias cosas a la vez. NUNCA rechaces ni limites su petición a plantillas rígidas.
Antes de responder, analiza internamente:
1. Qué quiere conseguir el director, cuál es el tema principal y qué mensaje espiritual desea transmitir.
2. Qué tipo de experiencia busca (reflexiva, evangelística, competitiva, dramática, participativa, económica/bajo presupuesto, etc.).
3. Duración estimada y número de participantes (si faltan datos secundarios, asume valores razonables —por ejemplo 90 min, ~30 jóvenes— y explícalos brevemente sin abrumar con preguntas; haz UNA sola pregunta aclaratoria únicamente si un dato cambia radicalmente todo).

CONTEXTO ACTUAL DE CONVERSACIÓN Y EDICIÓN:
${contextSummary}

HISTORIAL RECIENTE A EVITAR REPETIR (NO repitas dinámicas cambiando solo el nombre):
${historyDigest}

JUEGOS EN VIVO EXISTENTES EN "DIME TÚ QUÉ DICES" (reutilízalos si propone juegos/competencias):
clasico, equipos, velocidad, ruleta_biblica, quien_soy, misterio_biblico, crucigrama_biblico, completa_versiculo, retos_sabado, ruleta_sabado, aventuras_biblicas.

REGLAS PARA "resourceAction" Y "structuredDataJson":
- Si es una pregunta sencilla, consejo rápido o lluvia de ideas corta -> "resourceAction": "none", "structuredDataJson": "".
- Si pide crear un programa completo (ej: "Hazme un programa...", "Quiero un programa evangelístico...", "Tenemos poco dinero...") -> "resourceAction": "create_program".
- Si pide modificar, adaptar, cambiar duración, cambiar número de jóvenes o sustituir un bloque del programa actual -> "resourceAction": "update_program" (conserva las partes aprobadas que no pidió cambiar y actualiza lo solicitado y los tiempos!).
- Si pide crear específicamente una dinámica/juego ("create_activity"), dramatización/guion ("create_script"), predicación/reflexión ("create_sermon"), presentación ("create_presentation"), evento ("create_event") o momento musical ("create_music") -> usa esa acción exacta.
- Si pide generar un afiche/imagen -> "resourceAction": "suggest_image" y coloca una descripción visual detallada en "suggestedImagePrompt" (aclarando en assistantMessage que puede generarla con 1 clic en la pestaña Imágenes; NUNCA digas que ya se creó la imagen).
- Cuando "resourceAction" sea distinto de "none" y "suggest_image", "structuredDataJson" DEBE contener un JSON válido (como texto) listo para cargarse en el Editor:
  * Para "program": { title, subtitle, centralTheme, motto, spiritualObjective, mainBibleText, mainBibleVerseQuote, complementaryTexts[], centralIdea, introduction, durationMinutes (60|90|120), targetAudience, eventType, allInclusiveMode, materialsChecklist[], presenterMasterScript, questionsForAudience[], developedReflection, steps: [{ blockType ("bienvenida"|"oracion_inicial"|"alabanza"|"rompehielos"|"desarrollo_principal"|"actividad_biblica"|"juego_competencia"|"participacion_juvenil"|"reflexion"|"aplicacion_espiritual"|"llamado_compromiso"|"oracion_final"|"despedida"), title, durationMin, whatDirectorDoes, whatPresenterSays, whatParticipantsDo, howToOrganize, howToStart, howToDevelop, howToFinish, materials[], spiritualTeaching, biblicalReference, contentDistinction, compatibleGameMode }], weeklySpiritualChallenge, farewellMessage, doctrinalReviewPoints[], verificationNotes[] }.
  * Para "activity": { name, category, objective, participantCount, durationMinutes, materials[], preparation, rules[], stepByStep[], howToDetermineResult, spiritualReflection, biblicalReference, variants[], compatibleGameMode, compatibleGameReason }.
  * Para "script": { title, scriptType, durationMinutes, participantCount, biblicalBasis, characters: [{ name, role, wardrobeSuggestion }], scenery, materials[], actingNotes, scenes: [{ sceneNumber, sceneTitle, stageSetting, lines: [{ speaker, actingCue, dialogue }] }], spiritualMessage, biblicalVsCreativeDistinction, doctrinalReviewPoints[] }.
  * Para "sermon": { title, sermonType, durationMinutes, depth ("breve"|"intermedia"|"profunda"), objective, mainBibleText, passageContext, introduction, mainPoints: [{ heading, bibleSupport, explanation, illustrationExample, youthApplication }], complementaryReferences[], dailyLifeApplication, conclusion, spiritualCall, suggestedPrayer, biblicalVerificationNote, doctrinalReviewPoints[] }.
  * Para "event": { title, eventType, generalTheme, mainBibleText, objectives[], schedule: [{ block, timeSlot, activity, responsibleRole }], suggestedResponsibles[], activities[], resourcesNeeded[], materials[], promotionPlan[], includeBudget, estimatedBudget: [{ category, concept, estimatedAmountNote }], finalEvaluationCriteria[] }.
  * Para "presentation": { title, theme, mainBibleText, visualTone, slides: [{ order, kind ("portada"|"tema"|"texto_biblico"|"objetivos"|"punto_principal"|"preguntas"|"actividad"|"reflexion_final"), title, subtitle, bibleVerse, bullets[], speakerNotes, accentHex }] }.
  * Para "music": { title, centralTheme, mainBibleText, copyrightComplianceNote, verificationNotice, moments: [{ moment, momentLabel, spiritualPurpose, suggestedStyleAndTempo, biblicalEmphasis, teamInstructions, songOrHymnGuidance: [{ suggestion, verificationRequiredNote }] }] }.

IMPORTANTE: Tu "assistantMessage" SIEMPRE debe estar redactado en español cálido, claro y bien formateado para el director (NO pegues JSON crudo dentro de assistantMessage).`;

    try {
      const { result: aiResponse, modelUsed } = await runWithTextFallback(
        (modelName, isFallback) => {
          const chat = ai.chats.create({
            model: modelName,
            history: historyForGemini,
            config: {
              systemInstruction,
              ...(isFallback
                ? {}
                : { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }),
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  intentAnalysis: {
                    type: Type.OBJECT,
                    properties: {
                      goal: { type: Type.STRING },
                      mainTheme: { type: Type.STRING },
                      spiritualMessage: { type: Type.STRING },
                      experienceType: { type: Type.STRING },
                      participantEstimate: { type: Type.INTEGER },
                      durationMinutes: { type: Type.INTEGER },
                      assumedDefaults: { type: Type.ARRAY, items: { type: Type.STRING } },
                    },
                    required: ['goal', 'mainTheme', 'spiritualMessage', 'experienceType', 'assumedDefaults'],
                  },
                  assistantMessage: { type: Type.STRING },
                  resourceAction: { type: Type.STRING },
                  suggestedImagePrompt: { type: Type.STRING },
                  structuredDataJson: { type: Type.STRING },
                },
                required: ['intentAnalysis', 'assistantMessage', 'resourceAction', 'structuredDataJson'],
              },
            },
          });
          return chat.sendMessage({ message });
        },
        34000
      );
      const parsedChat = parseJsonSafe<{
        intentAnalysis?: ChatIntentAnalysis;
        assistantMessage?: string;
        resourceAction?: string;
        suggestedImagePrompt?: string;
        structuredDataJson?: string;
      }>(aiResponse.text, 'La IA devolvió una respuesta vacía.');

      const replyText = String(parsedChat.assistantMessage || '').trim();
      if (!replyText) {
        throw new Error('INVALID_JSON_FORMAT: Respuesta de asistente vacía.');
      }

      const validActions = new Set<ChatResourceAction>([
        'none',
        'create_program',
        'update_program',
        'create_sermon',
        'create_activity',
        'create_script',
        'create_presentation',
        'create_event',
        'create_music',
        'suggest_image',
      ]);
      const resourceAction: ChatResourceAction = validActions.has(
        parsedChat.resourceAction as ChatResourceAction
      )
        ? (parsedChat.resourceAction as ChatResourceAction)
        : 'none';

      let structuredArtifact: ChatStructuredArtifact | undefined;
      if (
        resourceAction !== 'none' &&
        resourceAction !== 'suggest_image' &&
        parsedChat.structuredDataJson &&
        parsedChat.structuredDataJson.trim().startsWith('{')
      ) {
        try {
          const rawObj = JSON.parse(stripJsonMarkdownFences(parsedChat.structuredDataJson)) as Record<
            string,
            unknown
          >;
          const todayIso = getUpcomingSaturdayIso();
          if (resourceAction === 'create_program' || resourceAction === 'update_program') {
            const basePrev =
              effectiveContextKind === 'program' && effectiveContextPayload
                ? (effectiveContextPayload as AiCreativeProgram)
                : undefined;
            const dur = normalizeProgramDuration(
              rawObj.durationMinutes ||
                parsedChat.intentAnalysis?.durationMinutes ||
                basePrev?.durationMinutes ||
                90
            );
            const rawSteps = Array.isArray(rawObj.steps)
              ? rawObj.steps
              : basePrev?.steps || [];
            const progPayload: AiCreativeProgram = {
              title: String(rawObj.title || basePrev?.title || parsedChat.intentAnalysis?.mainTheme || 'Programa Juvenil').trim(),
              subtitle: String(rawObj.subtitle || basePrev?.subtitle || '').trim(),
              centralTheme: String(rawObj.centralTheme || basePrev?.centralTheme || parsedChat.intentAnalysis?.mainTheme || '').trim(),
              motto: String(rawObj.motto || basePrev?.motto || '').trim(),
              spiritualObjective: String(rawObj.spiritualObjective || basePrev?.spiritualObjective || parsedChat.intentAnalysis?.spiritualMessage || '').trim(),
              targetAudience: String(rawObj.targetAudience || rawObj.audience || basePrev?.targetAudience || db.creativeAi.profile.youthAgeGroup).trim(),
              mainBibleText: String(rawObj.mainBibleText || basePrev?.mainBibleText || '').trim(),
              mainBibleVerseQuote: String(rawObj.mainBibleVerseQuote || basePrev?.mainBibleVerseQuote || '').trim(),
              complementaryTexts: Array.isArray(rawObj.complementaryTexts)
                ? rawObj.complementaryTexts.map(String).filter(Boolean)
                : basePrev?.complementaryTexts || [],
              centralIdea: String(rawObj.centralIdea || basePrev?.centralIdea || '').trim(),
              durationMinutes: dur,
              scheduledDate: String(rawObj.scheduledDate || basePrev?.scheduledDate || todayIso),
              eventType: String(rawObj.eventType || basePrev?.eventType || 'Sociedad de Jóvenes').trim(),
              allInclusiveMode: Boolean(rawObj.allInclusiveMode ?? rawObj.allInclusivePackage ?? basePrev?.allInclusiveMode),
              introduction: String(rawObj.introduction || basePrev?.introduction || '').trim(),
              presenterMasterScript: String(rawObj.presenterMasterScript || basePrev?.presenterMasterScript || '').trim(),
              steps: sanitizeProgramSteps(rawSteps, dur),
              questionsForAudience: Array.isArray(rawObj.questionsForAudience || rawObj.publicQuestions)
                ? ((rawObj.questionsForAudience || rawObj.publicQuestions) as unknown[]).map(String).filter(Boolean)
                : basePrev?.questionsForAudience || [],
              developedReflection: String(rawObj.developedReflection || basePrev?.developedReflection || '').trim(),
              materialsChecklist: Array.isArray(rawObj.materialsChecklist || rawObj.materialsNeeded)
                ? ((rawObj.materialsChecklist || rawObj.materialsNeeded) as unknown[]).map(String).filter(Boolean)
                : basePrev?.materialsChecklist || [],
              imagePromptsSuggested: Array.isArray(rawObj.imagePromptsSuggested)
                ? rawObj.imagePromptsSuggested.map(String).filter(Boolean)
                : basePrev?.imagePromptsSuggested || [],
              presentationOutlineSummary: Array.isArray(rawObj.presentationOutlineSummary)
                ? rawObj.presentationOutlineSummary.map(String).filter(Boolean)
                : basePrev?.presentationOutlineSummary || [],
              weeklySpiritualChallenge: String(rawObj.weeklySpiritualChallenge || basePrev?.weeklySpiritualChallenge || '').trim(),
              farewellMessage: String(rawObj.farewellMessage || basePrev?.farewellMessage || '').trim(),
              doctrinalReviewPoints: Array.isArray(rawObj.doctrinalReviewPoints)
                ? rawObj.doctrinalReviewPoints.map(String).filter(Boolean)
                : basePrev?.doctrinalReviewPoints || [],
              verificationNotes: Array.isArray(rawObj.verificationNotes)
                ? rawObj.verificationNotes.map(String).filter(Boolean)
                : basePrev?.verificationNotes || [],
            };
            structuredArtifact = {
              kind: 'program',
              title: progPayload.title,
              theme: progPayload.centralTheme || progPayload.title,
              eventType: progPayload.eventType,
              scheduledDate: progPayload.scheduledDate,
              payload: progPayload,
            };
          } else {
            const kindMap: Record<string, CreativeToolKind> = {
              create_sermon: 'sermon',
              create_activity: 'activity',
              create_script: 'script',
              create_presentation: 'presentation',
              create_event: 'event',
              create_music: 'music',
            };
            const artKind = kindMap[resourceAction];
            if (artKind) {
              let normalizedPayload: CreativePayloadUnion;
              let artTitle = String(
                rawObj.title || rawObj.name || parsedChat.intentAnalysis?.mainTheme || 'Recurso generado en chat'
              ).trim();
              let artTheme = String(
                rawObj.centralTheme || rawObj.theme || rawObj.generalTheme || parsedChat.intentAnalysis?.mainTheme || artTitle
              ).trim();

              if (artKind === 'activity') {
                const act: AiCreativeActivity = {
                  name: String(rawObj.name || rawObj.title || artTitle).trim(),
                  category: (String(rawObj.category || 'dinamicas_participativas') as ActivityCategoryType),
                  objective: String(rawObj.objective || parsedChat.intentAnalysis?.spiritualMessage || '').trim(),
                  participantCount: String(rawObj.participantCount || parsedChat.intentAnalysis?.participantEstimate || '25 a 35 jóvenes').trim(),
                  durationMinutes: Math.max(3, Math.round(Number(rawObj.durationMinutes || rawObj.durationMin || parsedChat.intentAnalysis?.durationMinutes || 15))),
                  materials: Array.isArray(rawObj.materials) ? rawObj.materials.map(String).filter(Boolean) : [],
                  preparation: String(rawObj.preparation || '').trim(),
                  rules: Array.isArray(rawObj.rules) ? rawObj.rules.map(String).filter(Boolean) : [],
                  stepByStep: Array.isArray(rawObj.stepByStep || rawObj.steps)
                    ? ((rawObj.stepByStep || rawObj.steps) as unknown[]).map(String).filter(Boolean)
                    : [],
                  howToDetermineResult: String(rawObj.howToDetermineResult || rawObj.winnerLogic || rawObj.scoringSystem || '').trim(),
                  spiritualReflection: String(rawObj.spiritualReflection || parsedChat.intentAnalysis?.spiritualMessage || '').trim(),
                  biblicalReference: String(rawObj.biblicalReference || rawObj.mainBibleText || '').trim() || undefined,
                  variants: Array.isArray(rawObj.variants || rawObj.adaptationVariants)
                    ? ((rawObj.variants || rawObj.adaptationVariants) as unknown[]).map(String).filter(Boolean)
                    : [],
                  compatibleGameMode: String(rawObj.compatibleGameMode || '').trim() || undefined,
                  compatibleGameReason: String(rawObj.compatibleGameReason || '').trim() || undefined,
                };
                artTitle = act.name;
                normalizedPayload = act;
              } else if (artKind === 'script') {
                const rawScenes = Array.isArray(rawObj.scenes) ? (rawObj.scenes as Array<Record<string, unknown>>) : [];
                const scr: AiCreativeScript = {
                  title: artTitle,
                  scriptType: (String(rawObj.scriptType || 'drama_biblico') as ScriptFormatType),
                  durationMinutes: Math.max(2, Math.round(Number(rawObj.durationMinutes || rawObj.estimatedDurationMin || 10))),
                  participantCount: Math.max(1, Math.round(Number(rawObj.participantCount || parsedChat.intentAnalysis?.participantEstimate || 4))),
                  biblicalBasis: String(rawObj.biblicalBasis || rawObj.mainBibleReference || '').trim(),
                  characters: Array.isArray(rawObj.characters)
                    ? (rawObj.characters as Array<Record<string, unknown>>).map((c) => ({
                        name: String(c?.name || 'Personaje').trim(),
                        role: String(c?.role || '').trim(),
                        wardrobeSuggestion: String(c?.wardrobeSuggestion || '').trim(),
                      }))
                    : [],
                  scenery: String(rawObj.scenery || '').trim(),
                  materials: Array.isArray(rawObj.materials) ? rawObj.materials.map(String).filter(Boolean) : [],
                  actingNotes: String(rawObj.actingNotes || '').trim(),
                  scenes: rawScenes.map((sc, sIdx) => ({
                    sceneNumber: Number(sc?.sceneNumber) || sIdx + 1,
                    sceneTitle: String(sc?.sceneTitle || sc?.title || `Escena ${sIdx + 1}`).trim(),
                    stageSetting: String(sc?.stageSetting || sc?.setting || '').trim(),
                    lines: Array.isArray(sc?.lines)
                      ? (sc.lines as Array<Record<string, unknown>>).map((ln) => ({
                          speaker: String(ln?.speaker || 'Narrador').trim(),
                          actingCue: String(ln?.actingCue || ln?.cue || '').trim(),
                          dialogue: String(ln?.dialogue || '').trim(),
                        }))
                      : [],
                  })),
                  spiritualMessage: String(rawObj.spiritualMessage || rawObj.spiritualClosingPrompt || '').trim(),
                  biblicalVsCreativeDistinction: String(rawObj.biblicalVsCreativeDistinction || rawObj.historicalVsCreativeNote || '').trim(),
                  doctrinalReviewPoints: Array.isArray(rawObj.doctrinalReviewPoints)
                    ? rawObj.doctrinalReviewPoints.map(String).filter(Boolean)
                    : [],
                };
                normalizedPayload = scr;
              } else if (artKind === 'sermon') {
                const rawPoints = Array.isArray(rawObj.mainPoints || rawObj.centralPoints)
                  ? ((rawObj.mainPoints || rawObj.centralPoints) as Array<Record<string, unknown>>)
                  : [];
                const ser: AiCreativeSermon = {
                  title: artTitle,
                  sermonType: (String(rawObj.sermonType || 'sermon_juvenil') as SermonFormatType),
                  durationMinutes: Math.max(5, Math.round(Number(rawObj.durationMinutes || 20))),
                  depth: (['breve', 'intermedia', 'profunda'].includes(String(rawObj.depth))
                    ? String(rawObj.depth)
                    : 'intermedia') as AiCreativeSermon['depth'],
                  objective: String(rawObj.objective || parsedChat.intentAnalysis?.spiritualMessage || '').trim(),
                  mainBibleText: String(rawObj.mainBibleText || '').trim(),
                  passageContext: String(rawObj.passageContext || rawObj.historicalBiblicalContext || '').trim(),
                  introduction: String(rawObj.introduction || '').trim(),
                  mainPoints: rawPoints.map((pt) => ({
                    heading: String(pt?.heading || '').trim(),
                    bibleSupport: String(pt?.bibleSupport || pt?.biblicalSupport || '').trim(),
                    explanation: String(pt?.explanation || '').trim(),
                    illustrationExample: String(pt?.illustrationExample || pt?.illustrativeExample || '').trim(),
                    youthApplication: String(pt?.youthApplication || '').trim(),
                  })),
                  complementaryReferences: Array.isArray(rawObj.complementaryReferences || rawObj.complementaryTexts)
                    ? ((rawObj.complementaryReferences || rawObj.complementaryTexts) as unknown[]).map(String).filter(Boolean)
                    : [],
                  dailyLifeApplication: String(rawObj.dailyLifeApplication || rawObj.practicalApplication || '').trim(),
                  conclusion: String(rawObj.conclusion || '').trim(),
                  spiritualCall: String(rawObj.spiritualCall || rawObj.youthCallToAction || '').trim(),
                  suggestedPrayer: String(rawObj.suggestedPrayer || rawObj.closingPrayerGuide || '').trim(),
                  biblicalVerificationNote: String(rawObj.biblicalVerificationNote || '').trim(),
                  doctrinalReviewPoints: Array.isArray(rawObj.doctrinalReviewPoints)
                    ? rawObj.doctrinalReviewPoints.map(String).filter(Boolean)
                    : [],
                };
                normalizedPayload = ser;
              } else if (artKind === 'event') {
                const rawSchedule = Array.isArray(rawObj.schedule || rawObj.scheduleBlocks)
                  ? ((rawObj.schedule || rawObj.scheduleBlocks) as Array<Record<string, unknown>>)
                  : [];
                const ev: AiCreativeEvent = {
                  title: artTitle,
                  eventType: (String(rawObj.eventType || 'retiro') as ChristianEventType),
                  generalTheme: artTheme,
                  mainBibleText: String(rawObj.mainBibleText || rawObj.centralBibleText || '').trim(),
                  objectives: Array.isArray(rawObj.objectives) ? rawObj.objectives.map(String).filter(Boolean) : [],
                  schedule: rawSchedule.map((b, i) => ({
                    block: String(b?.block || `Bloque ${i + 1}`).trim(),
                    timeSlot: String(b?.timeSlot || '').trim(),
                    activity: String(b?.activity || '').trim(),
                    responsibleRole: String(b?.responsibleRole || 'Director').trim(),
                  })),
                  suggestedResponsibles: Array.isArray(rawObj.suggestedResponsibles || rawObj.teamRolesNeeded)
                    ? ((rawObj.suggestedResponsibles || rawObj.teamRolesNeeded) as unknown[]).map(String).filter(Boolean)
                    : [],
                  activities: Array.isArray(rawObj.activities) ? rawObj.activities.map(String).filter(Boolean) : [],
                  resourcesNeeded: Array.isArray(rawObj.resourcesNeeded) ? rawObj.resourcesNeeded.map(String).filter(Boolean) : [],
                  materials: Array.isArray(rawObj.materials || rawObj.materialsList)
                    ? ((rawObj.materials || rawObj.materialsList) as unknown[]).map(String).filter(Boolean)
                    : [],
                  promotionPlan: Array.isArray(rawObj.promotionPlan || rawObj.promotionIdeas)
                    ? ((rawObj.promotionPlan || rawObj.promotionIdeas) as unknown[]).map(String).filter(Boolean)
                    : [],
                  includeBudget: Boolean(rawObj.includeBudget),
                  estimatedBudget: Array.isArray(rawObj.estimatedBudget)
                    ? (rawObj.estimatedBudget as AiCreativeEvent['estimatedBudget'])
                    : [],
                  budgetDisclaimer: rawObj.budgetDisclaimer ? String(rawObj.budgetDisclaimer).trim() : undefined,
                  finalEvaluationCriteria: Array.isArray(rawObj.finalEvaluationCriteria)
                    ? rawObj.finalEvaluationCriteria.map(String).filter(Boolean)
                    : [],
                };
                normalizedPayload = ev;
              } else if (artKind === 'presentation') {
                const rawSlides = Array.isArray(rawObj.slides) ? (rawObj.slides as Array<Record<string, unknown>>) : [];
                const pres: AiCreativePresentation = {
                  title: artTitle,
                  theme: artTheme,
                  mainBibleText: String(rawObj.mainBibleText || '').trim(),
                  visualTone: String(rawObj.visualTone || 'Moderno nocturno con acentos dorados').trim(),
                  slides: rawSlides.map((s, idx) => ({
                    id: String(s?.id || `SLD-${idx + 1}`),
                    order: idx + 1,
                    kind: (String(s?.kind || s?.slideType || 'punto_principal') as AiCreativePresentation['slides'][number]['kind']),
                    title: String(s?.title || `Diapositiva ${idx + 1}`).trim(),
                    subtitle: s?.subtitle ? String(s.subtitle).trim() : undefined,
                    bullets: Array.isArray(s?.bullets) ? s.bullets.map(String).filter(Boolean) : [],
                    bibleVerse: s?.bibleVerse || s?.bibleReference ? String(s.bibleVerse || s.bibleReference).trim() : undefined,
                    speakerNotes: s?.speakerNotes ? String(s.speakerNotes).trim() : undefined,
                    accentHex: /^#[0-9A-Fa-f]{6}$/.test(String(s?.accentHex || '')) ? String(s.accentHex) : '#F59E0B',
                  })),
                };
                normalizedPayload = pres;
              } else {
                const rawMoments = Array.isArray(rawObj.moments) ? (rawObj.moments as Array<Record<string, unknown>>) : [];
                const mus: AiCreativeMusicPlan = {
                  title: artTitle,
                  centralTheme: artTheme,
                  mainBibleText: String(rawObj.mainBibleText || '').trim(),
                  copyrightComplianceNote: String(
                    rawObj.copyrightComplianceNote || rawObj.copyrightNotice || 'Respeta derechos de autor: sin letras completas ni enlaces inventados.'
                  ).trim(),
                  verificationNotice: String(
                    rawObj.verificationNotice || 'El equipo de alabanza debe verificar cada canto en su himnario o catálogo oficial.'
                  ).trim(),
                  moments: rawMoments.map((mo) => ({
                    moment: (String(mo?.moment || mo?.momentType || 'alabanza_congregacional') as AiCreativeMusicPlan['moments'][number]['moment']),
                    momentLabel: String(mo?.momentLabel || 'Momento musical').trim(),
                    spiritualPurpose: String(mo?.spiritualPurpose || mo?.objective || '').trim(),
                    suggestedStyleAndTempo: String(mo?.suggestedStyleAndTempo || '').trim(),
                    biblicalEmphasis: String(mo?.biblicalEmphasis || '').trim(),
                    teamInstructions: String(mo?.teamInstructions || mo?.technicalTips || '').trim(),
                    songOrHymnGuidance: Array.isArray(mo?.songOrHymnGuidance)
                      ? (mo.songOrHymnGuidance as AiCreativeMusicPlan['moments'][number]['songOrHymnGuidance'])
                      : [],
                  })),
                };
                normalizedPayload = mus;
              }

              structuredArtifact = {
                kind: artKind,
                title: artTitle,
                theme: artTheme,
                eventType: String(rawObj.eventType || artKind).trim(),
                scheduledDate: todayIso,
                payload: normalizedPayload,
              };
            }
          }
        } catch {
          // Non-fatal: keep rich assistantMessage cleanly without breaking chat
        }
      }

      const userMsg: AiCreativeChatMessage = {
        id: `MSG-${now}-U`,
        role: 'user',
        text: message,
        createdAt: now,
        activeRecordId,
      };
      const assistantMsg: AiCreativeChatMessage = {
        id: `MSG-${Date.now()}-A`,
        role: 'assistant',
        text: replyText,
        createdAt: Date.now(),
        activeRecordId,
        modelUsed,
        intentAnalysis: parsedChat.intentAnalysis,
        resourceAction,
        structuredArtifact,
        suggestedImagePrompt: String(parsedChat.suggestedImagePrompt || '').trim() || undefined,
      };

      session.messages.push(userMsg, assistantMsg);
      if (session.messages.length > 60) {
        session.messages = session.messages.slice(-60);
      }
      session.activeRecordId = activeRecordId || session.activeRecordId;
      session.updatedAt = Date.now();
      db.creativeAi.activeChatSessionId = session.id;
      deps.scheduleSave();

      recordDiagnostic({
        operation: 'chat',
        ok: true,
        httpStatus: 200,
        errorCategory: 'NONE',
        code: 'OK',
        latencyMs: Math.max(1, Date.now() - startedAt),
        friendlyMessage: `Respuesta de chat generada con ${modelUsed} (${resourceAction}).`,
      });

      res.json({
        session,
        reply: assistantMsg,
        modelUsed,
        latencyMs: Math.max(1, Date.now() - startedAt),
      });
    } catch (err) {
      sendMappedError(res, err, 'text', 'chat', startedAt);
    }
  });

  app.delete('/api/ia-creativa/chat/:id', (req, res) => {
    const db = ensureDb();
    const id = String(req.params.id || '').trim();
    if (!db.creativeAi.chatSessions[id]) {
      res.status(404).json({ error: 'Conversación no encontrada.' });
      return;
    }
    delete db.creativeAi.chatSessions[id];
    if (db.creativeAi.activeChatSessionId === id) {
      db.creativeAi.activeChatSessionId = null;
    }
    deps.scheduleSave();
    res.json({ ok: true });
  });

  // 13. GUARDAR / VERSIONAR / RESTAURAR RECURSOS EN MEMORIA E HISTORIAL
  app.post('/api/ia-creativa/records', (req, res) => {
    const db = ensureDb();
    const body = req.body || {};
    const kind = String(body.kind || '') as CreativeToolKind;
    const title = String(body.title || '').trim();
    if (!kind || !title || !body.payload) {
      res.status(400).json({ error: 'Faltan datos obligatorios para guardar el contenido.' });
      return;
    }

    const status = body.status === 'final' ? 'final' : 'draft';
    const record = saveRecordVersioned(db.creativeAi, {
      kind,
      title,
      theme: String(body.theme || title).trim(),
      eventType: String(body.eventType || 'Sociedad de Jóvenes').trim(),
      scheduledDate: String(body.scheduledDate || getUpcomingSaturdayIso()).trim(),
      status,
      payload: body.payload as CreativePayloadUnion,
      note: typeof body.note === 'string' ? body.note.trim() : undefined,
    });

    deps.scheduleSave();
    res.status(201).json({ record });
  });

  app.put('/api/ia-creativa/records/:id', (req, res) => {
    const db = ensureDb();
    const id = String(req.params.id || '').trim();
    const existing = db.creativeAi.records[id];
    if (!existing) {
      res.status(404).json({ error: 'Registro no encontrado.' });
      return;
    }

    const body = req.body || {};
    const status = body.status === 'final' ? 'final' : 'draft';
    const record = saveRecordVersioned(db.creativeAi, {
      id,
      kind: existing.kind,
      title: String(body.title ?? existing.title).trim() || existing.title,
      theme: String(body.theme ?? existing.theme).trim() || existing.theme,
      eventType: String(body.eventType ?? existing.eventType).trim() || existing.eventType,
      scheduledDate:
        String(body.scheduledDate ?? existing.scheduledDate).trim() || existing.scheduledDate,
      status,
      payload: (body.payload || existing.payload) as CreativePayloadUnion,
      note: typeof body.note === 'string' ? body.note.trim() : undefined,
      saveMode: body.saveMode === 'overwrite_draft' ? 'overwrite_draft' : 'new_version',
    });

    deps.scheduleSave();
    res.json({ record });
  });

  app.post('/api/ia-creativa/records/:id/restore-version', (req, res) => {
    const db = ensureDb();
    const id = String(req.params.id || '').trim();
    const existing = db.creativeAi.records[id];
    if (!existing) {
      res.status(404).json({ error: 'Registro no encontrado.' });
      return;
    }

    const versionNumber = Number(req.body?.versionNumber);
    const targetSnap = existing.versions.find((v) => v.versionNumber === versionNumber);
    if (!targetSnap) {
      res.status(404).json({ error: 'La versión solicitada no existe en el historial.' });
      return;
    }

    const restored = saveRecordVersioned(db.creativeAi, {
      id,
      kind: existing.kind,
      title: existing.title,
      theme: existing.theme,
      eventType: existing.eventType,
      scheduledDate: existing.scheduledDate,
      status: 'draft',
      payload: JSON.parse(JSON.stringify(targetSnap.payload)) as CreativePayloadUnion,
      note: `Restaurada desde versión v${versionNumber}`,
      saveMode: 'new_version',
    });

    deps.scheduleSave();
    res.json({ record: restored });
  });

  app.delete('/api/ia-creativa/records/:id', (req, res) => {
    const db = ensureDb();
    const id = String(req.params.id || '').trim();
    if (!db.creativeAi.records[id]) {
      res.status(404).json({ error: 'Elemento no encontrado en el historial.' });
      return;
    }
    delete db.creativeAi.records[id];
    deps.scheduleSave();
    res.json({ ok: true, id });
  });

  // 14. ENVIAR PROGRAMA DE IA AL MÓDULO "PROGRAMA DEL SÁBADO" (con revisión del director)
  app.post('/api/ia-creativa/send-to-saturday', (req, res) => {
    const db = ensureDb();
    if (!db.saturdayPrograms) db.saturdayPrograms = {};

    const body = req.body || {};
    const recordId = typeof body.recordId === 'string' ? body.recordId.trim() : '';
    const programPayload = (body.program ||
      (recordId ? db.creativeAi.records[recordId]?.payload : undefined)) as
      | AiCreativeProgram
      | undefined;

    if (!programPayload || !Array.isArray(programPayload.steps) || programPayload.steps.length === 0) {
      res.status(400).json({ error: 'No hay un programa válido para enviar al organizador semanal.' });
      return;
    }

    const durationMinutes = (
      programPayload.durationMinutes === 60 ||
      programPayload.durationMinutes === 90 ||
      programPayload.durationMinutes === 120
        ? programPayload.durationMinutes
        : 90
    ) as SaturdayProgramDuration;

    const rawActivities: SaturdayProgramActivity[] = programPayload.steps.map((step, idx) => {
      const satCat = mapProgramBlockToSaturdayCategory(step.blockType);
      const meta = SATURDAY_CATEGORY_META[satCat];
      const materialsTxt = step.materials?.length
        ? `Materiales: ${step.materials.join(', ')}. `
        : '';
      const leaderHint = `${materialsTxt}Director: ${step.whatDirectorDoes}. Presentador: ${step.whatPresenterSays}. Enseñanza: ${step.spiritualTeaching}${step.biblicalReference ? ` (${step.biblicalReference})` : ''}`.trim();

      return {
        id: `ACT-${Date.now().toString(36).toUpperCase()}-${idx + 1}`,
        category: satCat,
        categoryLabel: step.blockLabel || meta.label,
        title: step.title,
        description: `${step.howToOrganize} ${step.howToStart} ${step.howToDevelop} ${step.howToFinish}`.trim(),
        leaderHint,
        durationMin: Math.max(1, Math.round(Number(step.durationMin) || 5)),
      };
    });

    const balancedActivities = rebalanceActivityDurations(rawActivities, durationMinutes);
    const satId = `PRG-${Date.now().toString(36).toUpperCase()}-${crypto
      .randomBytes(3)
      .toString('hex')
      .toUpperCase()}`;
    const now = Date.now();

    const saturdayProgram: SaturdayProgram = {
      id: satId,
      title: programPayload.title || 'Programa Creado con IA Creativa Juvenil',
      centralTheme: programPayload.centralTheme || 'Encuentro Juvenil',
      mainBibleText: programPayload.mainBibleText || '1 Timoteo 4:12',
      mainBibleVerseQuote: programPayload.mainBibleVerseQuote || undefined,
      spiritualObjective: programPayload.spiritualObjective || '',
      scheduledDate: programPayload.scheduledDate || getUpcomingSaturdayIso(),
      durationMinutes,
      status: 'draft', // Always enters as draft so the director reviews and approves before finalizing
      directorName: db.creativeAi.profile.churchName || undefined,
      directorNotes: `Enviado desde IA Creativa Juvenil para revisión del director.\nLema: ${programPayload.motto}\nDesafío semanal: ${programPayload.weeklySpiritualChallenge}\nMateriales: ${(programPayload.materialsChecklist || []).join(', ')}`,
      activities: balancedActivities,
      createdAt: now,
      updatedAt: now,
      generatedByAi: true,
      customFocus: programPayload.centralIdea || programPayload.subtitle,
      varietyNotice:
        'Importado desde IA Creativa Juvenil como borrador para revisión y aprobación del director.',
    };

    db.saturdayPrograms[satId] = saturdayProgram;

    if (recordId && db.creativeAi.records[recordId]) {
      db.creativeAi.records[recordId].sentToSaturdayProgramId = satId;
      db.creativeAi.records[recordId].updatedAt = now;
    }

    deps.scheduleSave();
    res.status(201).json({ saturdayProgram });
  });

  // 15. GENERADOR REAL DE IMÁGENES CRISTIANAS (gemini-3.1-flash-lite-image)
  app.post('/api/ia-creativa/images/generate', async (req, res) => {
    const startedAt = Date.now();
    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        code: 'MISSING_API_KEY',
        errorCategory: 'MISSING_KEY',
        error:
          'El servicio de generación de imágenes no está configurado: falta GEMINI_API_KEY en Settings > Secrets (requiere clave con facturación habilitada para gemini-3.1-flash-lite-image).',
      });
      return;
    }

    const db = ensureDb();
    const body = req.body || {};
    const userPrompt = String(body.prompt || '').trim().slice(0, 600);
    if (!userPrompt) {
      res.status(400).json({ error: 'Describe la imagen cristiana o recurso visual que deseas generar.' });
      return;
    }

    const category = String(body.category || 'afiche_juvenil') as CreativeImageCategory;
    const style = String(body.style || 'diseno_moderno_juvenil') as CreativeImageStyle;
    const allowedFormats: CreativeImageFormat[] = ['1:1', '16:9', '9:16', '4:3', '3:4'];
    const format: CreativeImageFormat = allowedFormats.includes(body.format)
      ? body.format
      : '16:9';
    const sourceImageId = String(body.sourceImageId || '').trim();
    const linkedRecordId = String(body.linkedRecordId || '').trim() || undefined;

    const stylePromptMap: Record<CreativeImageStyle, string> = {
      realismo_cinematografico: 'cinematic realism, dramatic warm natural lighting, shallow depth of field',
      ilustracion_biblica: 'reverent artistic biblical illustration, rich painterly texture, warm atmospheric light, clearly artistic and non-photographic',
      diseno_moderno_juvenil: 'modern Christian youth ministry graphic design aesthetic, clean bold visual composition, inspiring warm gold and deep navy atmosphere',
      fotografia_eventos: 'authentic uplifting youth gathering atmosphere photography, warm stage illumination',
      arte_digital: 'refined contemporary digital artwork, balanced composition, clean lighting',
      diseno_minimalista: 'minimalist editorial composition with generous clean negative space suitable for screen projection',
      estilo_editorial: 'high-craft editorial visual art, refined color grading, timeless composition',
    };

    const biblicalIntegrityGuard =
      category === 'historia_biblica' || category === 'ilustracion_educativa'
        ? ' Artistic painterly illustration only — do NOT portray this biblical scene as a real historical photograph.'
        : '';

    const composedPrompt = `Christian youth ministry visual asset (${category.replace(/_/g, ' ')}): ${userPrompt}. Visual style: ${stylePromptMap[style] || stylePromptMap.diseno_moderno_juvenil}.${biblicalIntegrityGuard} Clean reverent aesthetic, no garbled unreadable text.`;

    try {
      const parts: Array<
        { text: string } | { inlineData: { data: string; mimeType: string } }
      > = [];

      if (sourceImageId) {
        const existingImg = db.creativeAi.images.find((im) => im.id === sourceImageId);
        if (existingImg?.localFile) {
          const resolved = path.resolve(AI_IMAGES_DIR, existingImg.localFile);
          if (resolved.startsWith(AI_IMAGES_DIR + path.sep) && fs.existsSync(resolved)) {
            const bytes = fs.readFileSync(resolved);
            parts.push({
              inlineData: {
                data: bytes.toString('base64'),
                mimeType: existingImg.mimeType || 'image/png',
              },
            });
          }
        }
      }
      parts.push({ text: composedPrompt });

      const response = await withTimeout(
        ai.models.generateContent({
          model: IMAGE_MODEL,
          contents: { parts },
          config: {
            imageConfig: {
              aspectRatio: format,
            },
          },
        }),
        60000
      );

      let foundBase64: string | null = null;
      let foundMime = 'image/png';
      let noteText = '';

      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data && !foundBase64) {
          foundBase64 = part.inlineData.data;
          foundMime = part.inlineData.mimeType || 'image/png';
        } else if (part.text) {
          noteText += part.text + ' ';
        }
      }

      if (!foundBase64) {
        res.status(502).json({
          code: 'NO_IMAGE_RETURNED',
          error:
            'El modelo no devolvió datos de imagen en la respuesta. Verifica los permisos o reformula la descripción.',
        });
        return;
      }

      const imageId = makeImageId();
      const ext = foundMime.includes('jpeg') || foundMime.includes('jpg')
        ? 'jpg'
        : foundMime.includes('webp')
          ? 'webp'
          : 'png';
      fs.mkdirSync(AI_IMAGES_DIR, { recursive: true });
      const fileName = `${imageId}.${ext}`;
      const fullPath = path.join(AI_IMAGES_DIR, fileName);
      fs.writeFileSync(fullPath, Buffer.from(foundBase64, 'base64'));

      const imgRecord: AiCreativeImageRecord = {
        id: imageId,
        prompt: userPrompt,
        modelUsed: IMAGE_MODEL,
        category,
        format,
        style,
        mimeType: foundMime,
        imageUrl: `/api/ia-creativa/images/${encodeURIComponent(imageId)}/file`,
        localFile: fileName,
        linkedRecordId,
        note: noteText.trim() || undefined,
        createdAt: Date.now(),
      };

      db.creativeAi.images.unshift(imgRecord);
      if (linkedRecordId && db.creativeAi.records[linkedRecordId]) {
        const prevIds = db.creativeAi.records[linkedRecordId].attachedImageIds || [];
        db.creativeAi.records[linkedRecordId].attachedImageIds = [imageId, ...prevIds];
        db.creativeAi.records[linkedRecordId].updatedAt = Date.now();
      }

      deps.scheduleSave();
      recordDiagnostic({
        operation: 'generate_image',
        ok: true,
        httpStatus: 200,
        errorCategory: 'NONE',
        code: 'OK',
        latencyMs: Math.max(1, Date.now() - startedAt),
        friendlyMessage: `Imagen cristiana generada con ${IMAGE_MODEL}.`,
      });
      res.status(201).json({ image: imgRecord, latencyMs: Math.max(1, Date.now() - startedAt) });
    } catch (err) {
      sendMappedError(res, err, 'image', 'generate_image', startedAt);
    }
  });

  app.get('/api/ia-creativa/images/:id/file', (req, res) => {
    const db = ensureDb();
    const id = String(req.params.id || '').trim();
    const img = db.creativeAi.images.find((i) => i.id === id);
    if (!img || !img.localFile) {
      res.status(404).end();
      return;
    }
    const resolved = path.resolve(AI_IMAGES_DIR, img.localFile);
    if (!resolved.startsWith(AI_IMAGES_DIR + path.sep) || !fs.existsSync(resolved)) {
      res.status(404).end();
      return;
    }
    res.setHeader('Content-Type', img.mimeType || 'image/png');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(resolved);
  });

  app.delete('/api/ia-creativa/images/:id', (req, res) => {
    const db = ensureDb();
    const id = String(req.params.id || '').trim();
    const idx = db.creativeAi.images.findIndex((i) => i.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Imagen no encontrada.' });
      return;
    }
    const [removed] = db.creativeAi.images.splice(idx, 1);
    if (removed?.localFile) {
      try {
        const resolved = path.resolve(AI_IMAGES_DIR, removed.localFile);
        if (resolved.startsWith(AI_IMAGES_DIR + path.sep) && fs.existsSync(resolved)) {
          fs.unlinkSync(resolved);
        }
      } catch {
        // ignore cleanup failure
      }
    }
    deps.scheduleSave();
    res.json({ ok: true, id });
  });

  // 16. EXPORTACIÓN REAL A POWERPOINT (.PPTX) DE PRESENTACIONES
  app.post('/api/ia-creativa/presentations/export-pptx', async (req, res) => {
    const db = ensureDb();
    const presentation = req.body?.presentation as AiCreativePresentation | undefined;
    if (!presentation || !Array.isArray(presentation.slides) || presentation.slides.length === 0) {
      res.status(400).json({ error: 'La presentación no contiene diapositivas para exportar.' });
      return;
    }

    try {
      const PptxGen = PptxGenJSImport as unknown as new () => {
        layout: string;
        author: string;
        title: string;
        subject: string;
        addSlide: () => {
          background: { color: string };
          addShape: (shape: string, opts: Record<string, unknown>) => void;
          addText: (text: string | Array<{ text: string; options?: Record<string, unknown> }>, opts: Record<string, unknown>) => void;
          addImage: (opts: Record<string, unknown>) => void;
          addNotes: (notes: string) => void;
        };
        write: (opts: { outputType: 'nodebuffer' }) => Promise<Buffer>;
      };

      const pptx = new PptxGen();
      pptx.layout = 'LAYOUT_16x9';
      pptx.author = db.creativeAi.profile.churchName || 'IA Creativa Juvenil · Dime Tú Qué Dices';
      pptx.title = presentation.title || 'Presentación Juvenil';
      pptx.subject = presentation.theme || 'Sociedad de Jóvenes';

      for (const sld of presentation.slides) {
        const slide = pptx.addSlide();
        slide.background = { color: '080E1E' };

        const accent = (sld.accentHex || '#F59E0B').replace('#', '');
        // Top accent bar
        slide.addShape('rect', {
          x: 0,
          y: 0,
          w: 10,
          h: 0.14,
          fill: { color: accent },
        });

        // Header kicker
        slide.addText(`${presentation.title}  ·  ${presentation.mainBibleText}`.toUpperCase(), {
          x: 0.6,
          y: 0.3,
          w: 8.8,
          h: 0.3,
          fontSize: 10,
          bold: true,
          color: 'FBBF24',
          fontFace: 'Arial',
        });

        // Resolve attached local image if any
        let localImgData: string | null = null;
        if (sld.imageId) {
          const imgMeta = db.creativeAi.images.find((im) => im.id === sld.imageId);
          if (imgMeta?.localFile) {
            const resolved = path.resolve(AI_IMAGES_DIR, imgMeta.localFile);
            if (resolved.startsWith(AI_IMAGES_DIR + path.sep) && fs.existsSync(resolved)) {
              const buf = fs.readFileSync(resolved);
              localImgData = `${imgMeta.mimeType || 'image/png'};base64,${buf.toString('base64')}`;
            }
          }
        }

        const textWidth = localImgData ? 5.3 : 8.8;

        // Slide Title
        slide.addText(sld.title || 'Diapositiva', {
          x: 0.6,
          y: 0.72,
          w: textWidth,
          h: 0.85,
          fontSize: sld.kind === 'portada' ? 32 : 24,
          bold: true,
          color: 'FFFFFF',
          fontFace: 'Arial',
        });

        let cursorY = 1.65;
        if (sld.subtitle) {
          slide.addText(sld.subtitle, {
            x: 0.6,
            y: cursorY,
            w: textWidth,
            h: 0.45,
            fontSize: 14,
            color: '7DD3FC',
            fontFace: 'Arial',
          });
          cursorY += 0.55;
        }

        if (sld.bibleVerse) {
          slide.addText(`"${sld.bibleVerse}"`, {
            x: 0.6,
            y: cursorY,
            w: textWidth,
            h: 0.8,
            fontSize: 13,
            italic: true,
            color: 'FDE68A',
            fontFace: 'Arial',
          });
          cursorY += 0.85;
        }

        if (Array.isArray(sld.bullets) && sld.bullets.length > 0) {
          const bulletRows = sld.bullets.map((b) => ({
            text: b,
            options: { bullet: true, color: 'E2E8F0', fontSize: 15, breakLine: true },
          }));
          slide.addText(bulletRows, {
            x: 0.6,
            y: cursorY,
            w: textWidth,
            h: 5.2 - cursorY,
            valign: 'top',
            fontFace: 'Arial',
            paraSpaceAfter: 8,
          });
        }

        if (localImgData) {
          slide.addImage({
            data: localImgData,
            x: 6.15,
            y: 0.85,
            w: 3.3,
            h: 4.1,
            sizing: { type: 'contain', w: 3.3, h: 4.1 },
          });
        }

        if (sld.speakerNotes) {
          slide.addNotes(sld.speakerNotes);
        }
      }

      const buffer = await pptx.write({ outputType: 'nodebuffer' });
      const safeName = (presentation.title || 'presentacion-juvenil')
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${safeName || 'presentacion-juvenil'}.pptx"`
      );
      res.send(buffer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `No se pudo construir el archivo PowerPoint (.pptx): ${msg}` });
    }
  });
}
