import crypto from 'crypto';
import type express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import {
  getDefaultActivityDurations,
  getUpcomingSaturdayIso,
  rebalanceActivityDurations,
  REQUIRED_SATURDAY_SEQUENCE,
  SATURDAY_CATEGORY_META,
  SaturdayActivityAlternative,
  SaturdayActivityCategory,
  SaturdayProgram,
  SaturdayProgramActivity,
  SaturdayProgramDuration,
  SaturdaySimilarityWarning,
} from './src/shared/saturdayProgramTypes.js';

export interface SaturdayProgramRoutesDeps {
  getDb: () => {
    saturdayPrograms: Record<string, SaturdayProgram>;
  };
  scheduleSave: () => void;
}

const VALID_DURATIONS: SaturdayProgramDuration[] = [60, 90, 120];
const VALID_CATEGORIES = new Set<SaturdayActivityCategory>([
  'bienvenida',
  'rompehielos',
  'alabanza',
  'juego',
  'actividad_biblica',
  'reflexion',
  'aplicacion',
  'desafio',
  'despedida',
  'personalizada',
]);

function normalizeDuration(raw: unknown): SaturdayProgramDuration {
  const n = Number(raw);
  if (n === 60 || n === 90 || n === 120) return n;
  return 90;
}

function normalizeForComparison(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al',
  'en', 'con', 'por', 'para', 'sobre', 'entre', 'y', 'o', 'a', 'que', 'se',
  'su', 'sus', 'es', 'son', 'como', 'mas', 'muy', 'tu', 'mi', 'nos', 'este',
  'esta', 'sabado', 'jovenes', 'sociedad', 'actividad', 'dinamica', 'juego',
  'biblico', 'biblica', 'tema', 'programa', 'dios', 'jesus', 'cristo', 'biblia',
]);

function extractKeywords(text: string): Set<string> {
  const tokens = normalizeForComparison(text).split(' ');
  const out = new Set<string>();
  for (const t of tokens) {
    if (t.length >= 3 && !STOPWORDS.has(t)) {
      out.add(t);
    }
  }
  return out;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function computeSimilarityWarnings(
  candidate: {
    id?: string;
    title: string;
    centralTheme: string;
    activities: SaturdayProgramActivity[];
  },
  existingPrograms: SaturdayProgram[]
): SaturdaySimilarityWarning[] {
  const warnings: SaturdaySimilarityWarning[] = [];
  const recentOthers = existingPrograms
    .filter((p) => p.id !== candidate.id)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 15);

  if (recentOthers.length === 0) return warnings;

  const candTitleKw = extractKeywords(`${candidate.title} ${candidate.centralTheme}`);
  for (const prev of recentOthers) {
    const prevTitleKw = extractKeywords(`${prev.title} ${prev.centralTheme}`);
    const titleNormA = normalizeForComparison(candidate.title);
    const titleNormB = normalizeForComparison(prev.title);
    const titleSim = jaccardSimilarity(candTitleKw, prevTitleKw);
    if (
      (titleNormA && titleNormA === titleNormB) ||
      titleSim >= 0.62
    ) {
      warnings.push({
        activityId: '__program_title__',
        activityTitle: candidate.title || candidate.centralTheme,
        similarToProgramId: prev.id,
        similarToProgramTitle: prev.title,
        similarToDate: prev.scheduledDate,
        reason: `Título o tema central similar al programa "${prev.title}" (${prev.scheduledDate}).`,
      });
      break;
    }
  }

  for (const act of candidate.activities) {
    // Check dynamic/participatory categories most strictly + all others by exact title
    const actNorm = normalizeForComparison(act.title);
    const actKw = extractKeywords(`${act.title} ${act.description}`);

    for (const prev of recentOthers) {
      let matched = false;
      for (const prevAct of prev.activities) {
        const prevNorm = normalizeForComparison(prevAct.title);
        if (actNorm && prevNorm && actNorm === prevNorm) {
          warnings.push({
            activityId: act.id,
            activityTitle: act.title,
            similarToProgramId: prev.id,
            similarToProgramTitle: prev.title,
            similarToDate: prev.scheduledDate,
            reason: `El título coincide con "${prevAct.title}" del programa del ${prev.scheduledDate}.`,
          });
          matched = true;
          break;
        }

        if (
          act.category === prevAct.category &&
          (act.category === 'rompehielos' ||
            act.category === 'juego' ||
            act.category === 'actividad_biblica' ||
            act.category === 'desafio')
        ) {
          const sim = jaccardSimilarity(actKw, extractKeywords(`${prevAct.title} ${prevAct.description}`));
          if (sim >= 0.45) {
            warnings.push({
              activityId: act.id,
              activityTitle: act.title,
              similarToProgramId: prev.id,
              similarToProgramTitle: prev.title,
              similarToDate: prev.scheduledDate,
              reason: `Dinámica parecida a "${prevAct.title}" (${prev.title}, ${prev.scheduledDate}).`,
            });
            matched = true;
            break;
          }
        }
      }
      if (matched) break;
    }
  }

  return warnings;
}

function createGeminiClient(): GoogleGenAI | null {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key || key === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withRetries<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      // Do not retry non-transient auth/bad-request errors
      if (
        msg.includes('API_KEY_INVALID') ||
        msg.includes('PERMISSION_DENIED') ||
        msg.includes('400') ||
        msg.includes('403')
      ) {
        throw err;
      }
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 700 * attempt));
      }
    }
  }
  throw lastErr;
}

function mapGeminiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  if (lower.includes('api_key_invalid') || lower.includes('permission_denied') || lower.includes('403')) {
    return {
      status: 400,
      message:
        'La clave de Gemini API no es válida o no tiene permisos. Verifica tu clave en el panel Settings > Secrets.',
    };
  }
  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota')) {
    return {
      status: 429,
      message:
        'Se alcanzó temporalmente el límite de solicitudes de Gemini API. Espera unos segundos e inténtalo nuevamente.',
    };
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return {
      status: 502,
      message:
        'El modelo de IA solicitado no estuvo disponible temporalmente. Inténtalo de nuevo.',
    };
  }
  return {
    status: 502,
    message: `No se pudo generar el programa con IA en este momento: ${raw.slice(0, 180)}`,
  };
}

function makeProgramId(): string {
  return `PRG-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomBytes(3)
    .toString('hex')
    .toUpperCase()}`;
}

function makeActivityId(): string {
  return `ACT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function sanitizeActivities(rawList: unknown[]): SaturdayProgramActivity[] {
  const sanitized: SaturdayProgramActivity[] = [];
  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const rawCat = String(obj.category || 'personalizada') as SaturdayActivityCategory;
    const category: SaturdayActivityCategory = VALID_CATEGORIES.has(rawCat)
      ? rawCat
      : 'personalizada';
    const meta = SATURDAY_CATEGORY_META[category];
    const title = String(obj.title || '').trim() || meta.label;
    const description = String(obj.description || '').trim();
    const leaderHint = String(obj.leaderHint || '').trim();
    const durationMin = Math.max(1, Math.min(180, Math.round(Number(obj.durationMin) || 5)));

    sanitized.push({
      id: typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : makeActivityId(),
      category,
      categoryLabel:
        typeof obj.categoryLabel === 'string' && obj.categoryLabel.trim()
          ? obj.categoryLabel.trim()
          : meta.label,
      title,
      description,
      ...(leaderHint ? { leaderHint } : {}),
      durationMin,
    });
  }
  return sanitized;
}

function buildRecentHistoryDigest(programs: SaturdayProgram[]): string {
  const recent = [...programs]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 12);

  if (recent.length === 0) {
    return 'No hay programas previos guardados aún. Este será el primer programa del historial.';
  }

  return recent
    .map((p, idx) => {
      const actLines = p.activities
        .map((a) => `${a.categoryLabel}: "${a.title}"`)
        .join(' | ');
      return `${idx + 1}. [${p.scheduledDate}] Título: "${p.title}" | Tema: "${p.centralTheme}" | Texto: "${p.mainBibleText}" | Actividades: ${actLines}`;
    })
    .join('\n');
}

export function registerSaturdayProgramRoutes(
  app: express.Express,
  deps: SaturdayProgramRoutesDeps
): void {
  // List all saved programs (newest scheduled/updated first)
  app.get('/api/saturday-programs', (_req, res) => {
    const dbRef = deps.getDb();
    const list = Object.values(dbRef.saturdayPrograms || {}).sort(
      (a, b) => b.updatedAt - a.updatedAt
    );
    res.json({
      programs: list,
      totalCount: list.length,
    });
  });

  // Get single program with live variety check against other saved programs
  app.get('/api/saturday-programs/:id', (req, res) => {
    const id = String(req.params.id || '').trim();
    const dbRef = deps.getDb();
    const program = dbRef.saturdayPrograms?.[id];
    if (!program) {
      res.status(404).json({ error: 'Programa no encontrado.' });
      return;
    }
    const all = Object.values(dbRef.saturdayPrograms || {});
    const warnings = computeSimilarityWarnings(program, all);
    res.json({
      program: {
        ...program,
        varietyWarnings: warnings,
      },
    });
  });

  // Check similarity of an in-progress draft against historical programs
  app.post('/api/saturday-programs/check-variety', (req, res) => {
    const dbRef = deps.getDb();
    const body = req.body || {};
    const candidate = {
      id: typeof body.id === 'string' ? body.id : undefined,
      title: String(body.title || ''),
      centralTheme: String(body.centralTheme || ''),
      activities: sanitizeActivities(Array.isArray(body.activities) ? body.activities : []),
    };
    const warnings = computeSimilarityWarnings(
      candidate,
      Object.values(dbRef.saturdayPrograms || {})
    );
    res.json({ warnings });
  });

  // Generate a complete Saturday Youth Society program using Gemini AI
  app.post('/api/saturday-programs/generate', async (req, res) => {
    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'No se encontró la clave GEMINI_API_KEY en el servidor. Configura tu clave de Gemini API en Settings > Secrets para usar el generador inteligente.',
      });
      return;
    }

    const durationMinutes = normalizeDuration(req.body?.durationMinutes);
    const scheduledDate =
      typeof req.body?.scheduledDate === 'string' && req.body.scheduledDate.trim()
        ? req.body.scheduledDate.trim()
        : getUpcomingSaturdayIso();
    const customFocus =
      typeof req.body?.customFocus === 'string'
        ? req.body.customFocus.trim().slice(0, 180)
        : '';
    const directorName =
      typeof req.body?.directorName === 'string'
        ? req.body.directorName.trim().slice(0, 80)
        : '';

    const dbRef = deps.getDb();
    const existingPrograms = Object.values(dbRef.saturdayPrograms || {});
    const historyDigest = buildRecentHistoryDigest(existingPrograms);
    const suggestedTimes = getDefaultActivityDurations(durationMinutes);

    const sequenceGuide = REQUIRED_SATURDAY_SEQUENCE.map(
      (cat, idx) =>
        `${idx + 1}. category="${cat}" (${SATURDAY_CATEGORY_META[cat].label}) — referencia aprox: ${suggestedTimes[cat]} min`
    ).join('\n');

    const prompt = `Diseña un programa completo, original, bíblico, participativo y juvenil para la Sociedad de Jóvenes de una iglesia cristiana para el sábado ${scheduledDate}.

Duración total EXACTA del programa: ${durationMinutes} minutos.
${customFocus ? `Enfoque o necesidad solicitada por el director: "${customFocus}".` : 'Elige una temática bíblica juvenil fresca, relevante y edificante (fe práctica, propósito, valentía, comunidad, servicio, discipulado, adoración, etc.).'}

REGLA CRÍTICA DE VARIEDAD AUTOMÁTICA:
Consulta este historial de programas recientes y PROHIBIDO repetir sus títulos, temas centrales, dinámicas rompehielos, juegos o actividades bíblicas:
${historyDigest}

ESTRUCTURA OBLIGATORIA (exactamente las 9 actividades en este orden):
${sequenceGuide}

Requisitos de contenido:
- Todo en español natural, cálido, juvenil y entusiasta (sin lenguaje rígido ni aburrido).
- El campo "mainBibleText" debe incluir la cita bíblica exacta (ej. "1 Timoteo 4:12") y "mainBibleVerseQuote" el texto clave resumido o citado fielmente.
- Cada actividad debe tener:
  - "title": nombre atractivo, creativo y específico (nunca genérico).
  - "description": explicación clara paso a paso de cómo se realiza la actividad con jóvenes participando activamente (2 a 4 oraciones).
  - "leaderHint": consejo práctico para el director, materiales simples, preguntas guía o versículos de apoyo.
  - "durationMin": entero positivo. La suma de los 9 "durationMin" DEBE ser exactamente ${durationMinutes}.
- En la actividad de categoría "juego", puedes proponer tanto dinámicas presenciales divertidas como retos interactivos tipo "Dime Tú Qué Dices" si encajan con el tema.`;

    try {
      const response = await withRetries(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            systemInstruction:
              'Eres un coordinador experto en Ministerio Juvenil y Sociedad de Jóvenes cristiana. Generas programas altamente participativos, doctrinalmente sanos, alegres, modernos y variados, asegurando siempre precisión en tiempos y cero repetición con el historial previo.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: {
                  type: Type.STRING,
                  description: 'Título atractivo del programa del sábado.',
                },
                centralTheme: {
                  type: Type.STRING,
                  description: 'Tema central juvenil del encuentro.',
                },
                mainBibleText: {
                  type: Type.STRING,
                  description: 'Cita bíblica principal (ej. Filipenses 4:13).',
                },
                mainBibleVerseQuote: {
                  type: Type.STRING,
                  description: 'Texto o idea fiel del pasaje principal.',
                },
                spiritualObjective: {
                  type: Type.STRING,
                  description: 'Objetivo espiritual concreto que se busca lograr en los jóvenes.',
                },
                directorNotesSuggestion: {
                  type: Type.STRING,
                  description: 'Recomendación breve de preparación previa para el director.',
                },
                activities: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      category: {
                        type: Type.STRING,
                        description:
                          'Una de: bienvenida, rompehielos, alabanza, juego, actividad_biblica, reflexion, aplicacion, desafio, despedida',
                      },
                      title: { type: Type.STRING },
                      description: { type: Type.STRING },
                      leaderHint: { type: Type.STRING },
                      durationMin: { type: Type.INTEGER },
                    },
                    required: ['category', 'title', 'description', 'leaderHint', 'durationMin'],
                  },
                },
              },
              required: [
                'title',
                'centralTheme',
                'mainBibleText',
                'mainBibleVerseQuote',
                'spiritualObjective',
                'activities',
              ],
            },
          },
        })
      );

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({
          error: 'La IA devolvió una respuesta vacía. Intenta generar nuevamente.',
        });
        return;
      }

      const parsed = JSON.parse(rawText) as {
        title?: string;
        centralTheme?: string;
        mainBibleText?: string;
        mainBibleVerseQuote?: string;
        spiritualObjective?: string;
        directorNotesSuggestion?: string;
        activities?: Array<Record<string, unknown>>;
      };

      const rawActivities = Array.isArray(parsed.activities) ? parsed.activities : [];
      // Map onto exact required sequence when present, preserving extras if model returns them
      const sanitized = sanitizeActivities(
        REQUIRED_SATURDAY_SEQUENCE.map((cat, idx) => {
          const found =
            rawActivities.find((a) => String(a?.category) === cat) || rawActivities[idx] || {};
          return {
            ...found,
            id: makeActivityId(),
            category: cat,
            categoryLabel: SATURDAY_CATEGORY_META[cat].label,
            durationMin: Number(found?.durationMin) || suggestedTimes[cat],
          };
        })
      );

      const balancedActivities = rebalanceActivityDurations(sanitized, durationMinutes);
      const now = Date.now();

      const generatedProgram: SaturdayProgram = {
        id: makeProgramId(),
        title: String(parsed.title || 'Sociedad de Jóvenes: Fe Viva').trim(),
        centralTheme: String(parsed.centralTheme || 'Caminando con propósito en Cristo').trim(),
        mainBibleText: String(parsed.mainBibleText || '1 Timoteo 4:12').trim(),
        mainBibleVerseQuote: String(parsed.mainBibleVerseQuote || '').trim() || undefined,
        spiritualObjective: String(
          parsed.spiritualObjective ||
            'Motivar a los jóvenes a vivir su fe de manera práctica, alegre y comprometida.'
        ).trim(),
        scheduledDate,
        durationMinutes,
        status: 'draft',
        ...(directorName ? { directorName } : {}),
        directorNotes: String(parsed.directorNotesSuggestion || '').trim(),
        activities: balancedActivities,
        createdAt: now,
        updatedAt: now,
        generatedByAi: true,
        ...(customFocus ? { customFocus } : {}),
        varietyNotice:
          existingPrograms.length > 0
            ? `Programa generado evitando repetir los últimos ${Math.min(existingPrograms.length, 12)} programas del historial.`
            : 'Primer programa generado en tu historial de Sociedad de Jóvenes.',
      };

      generatedProgram.varietyWarnings = computeSimilarityWarnings(
        generatedProgram,
        existingPrograms
      );

      res.json({ program: generatedProgram });
    } catch (err) {
      const mapped = mapGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // Suggest 3 fresh AI alternatives for a single activity (e.g. if similar to past or director wants variety)
  app.post('/api/saturday-programs/suggest-alternative', async (req, res) => {
    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'No se encontró la clave GEMINI_API_KEY en el servidor. Configura tu clave de Gemini API en Settings > Secrets.',
      });
      return;
    }

    const categoryRaw = String(req.body?.category || 'personalizada') as SaturdayActivityCategory;
    const category = VALID_CATEGORIES.has(categoryRaw) ? categoryRaw : 'personalizada';
    const meta = SATURDAY_CATEGORY_META[category];
    const currentTitle = String(req.body?.currentTitle || '').trim();
    const programTheme = String(req.body?.centralTheme || '').trim();
    const mainBibleText = String(req.body?.mainBibleText || '').trim();
    const targetDurationMin = Math.max(1, Math.min(60, Math.round(Number(req.body?.durationMin) || 10)));

    const dbRef = deps.getDb();
    const existingPrograms = Object.values(dbRef.saturdayPrograms || {})
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 12);

    const recentCategoryTitles = existingPrograms
      .flatMap((p) => p.activities)
      .filter((a) => a.category === category)
      .map((a) => `"${a.title}"`)
      .slice(0, 18)
      .join(', ');

    const prompt = `Genera exactamente 3 alternativas ORIGINALES y variadas en español para reemplazar la sección "${meta.label}" dentro de un programa juvenil de Sociedad de Jóvenes.

Contexto del programa actual:
- Tema central: "${programTheme || 'Vida cristiana juvenil'}"
- Texto bíblico principal: "${mainBibleText || 'Salmos 119:9'}"
- Duración recomendada de esta actividad: ${targetDurationMin} minutos
- Actividad actual a reemplazar (NO repetir ni parafrasear): "${currentTitle}"
${recentCategoryTitles ? `- Actividades recientes del historial que están PROHIBIDAS repetir: ${recentCategoryTitles}` : ''}

Cada alternativa debe tener un enfoque diferente (por ejemplo: una más dinámica/movimiento, otra creativa/reflexiva, otra en equipos o interactiva) y respetar la duración aproximada de ${targetDurationMin} min.`;

    try {
      const response = await withRetries(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            systemInstruction:
              'Eres un asesor creativo de Sociedad de Jóvenes cristiana. Entregas alternativas claras, participativas, bíblicas y diferentes entre sí en formato JSON estricto.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  leaderHint: { type: Type.STRING },
                  durationMin: { type: Type.INTEGER },
                },
                required: ['title', 'description', 'leaderHint', 'durationMin'],
              },
            },
          },
        })
      );

      const raw = (response.text ?? '[]').trim();
      const parsed = JSON.parse(raw) as Array<Partial<SaturdayActivityAlternative>>;
      const alternatives: SaturdayActivityAlternative[] = (Array.isArray(parsed) ? parsed : [])
        .slice(0, 3)
        .map((alt, i) => ({
          title: String(alt.title || `${meta.label} Alternativa ${i + 1}`).trim(),
          description: String(alt.description || '').trim(),
          leaderHint: String(alt.leaderHint || '').trim(),
          durationMin: Math.max(1, Math.min(60, Math.round(Number(alt.durationMin) || targetDurationMin))),
        }));

      res.json({ alternatives });
    } catch (err) {
      const mapped = mapGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // Create a brand new saved program (NEVER overwrites previous programs)
  app.post('/api/saturday-programs', (req, res) => {
    const dbRef = deps.getDb();
    if (!dbRef.saturdayPrograms) dbRef.saturdayPrograms = {};

    const body = req.body || {};
    const title = String(body.title || '').trim();
    if (!title) {
      res.status(400).json({ error: 'Ingresa un título para el programa.' });
      return;
    }

    const durationMinutes = VALID_DURATIONS.includes(Number(body.durationMinutes) as SaturdayProgramDuration)
      ? (Number(body.durationMinutes) as SaturdayProgramDuration)
      : 90;

    const activities = sanitizeActivities(Array.isArray(body.activities) ? body.activities : []);
    if (activities.length === 0) {
      res.status(400).json({ error: 'El programa debe tener al menos una actividad.' });
      return;
    }

    const status = body.status === 'final' ? 'final' : 'draft';
    const now = Date.now();

    // Always mint a brand new unique ID on POST so prior programs are never overwritten
    let newId = makeProgramId();
    while (dbRef.saturdayPrograms[newId]) {
      newId = makeProgramId();
    }

    const program: SaturdayProgram = {
      id: newId,
      title,
      centralTheme: String(body.centralTheme || 'Encuentro Juvenil').trim(),
      mainBibleText: String(body.mainBibleText || '1 Timoteo 4:12').trim(),
      ...(typeof body.mainBibleVerseQuote === 'string' && body.mainBibleVerseQuote.trim()
        ? { mainBibleVerseQuote: body.mainBibleVerseQuote.trim() }
        : {}),
      spiritualObjective: String(body.spiritualObjective || '').trim(),
      scheduledDate:
        typeof body.scheduledDate === 'string' && body.scheduledDate.trim()
          ? body.scheduledDate.trim()
          : getUpcomingSaturdayIso(),
      durationMinutes,
      status,
      ...(typeof body.directorName === 'string' && body.directorName.trim()
        ? { directorName: body.directorName.trim() }
        : {}),
      directorNotes: String(body.directorNotes || '').trim(),
      activities,
      createdAt: now,
      updatedAt: now,
      ...(status === 'final' ? { finalizedAt: now } : {}),
      ...(typeof body.duplicatedFromId === 'string' && body.duplicatedFromId.trim()
        ? { duplicatedFromId: body.duplicatedFromId.trim() }
        : {}),
      ...(typeof body.generatedByAi === 'boolean'
        ? { generatedByAi: body.generatedByAi }
        : {}),
      ...(typeof body.customFocus === 'string' && body.customFocus.trim()
        ? { customFocus: body.customFocus.trim() }
        : {}),
      ...(typeof body.varietyNotice === 'string' && body.varietyNotice.trim()
        ? { varietyNotice: body.varietyNotice.trim() }
        : {}),
    };

    program.varietyWarnings = computeSimilarityWarnings(
      program,
      Object.values(dbRef.saturdayPrograms)
    );

    dbRef.saturdayPrograms[program.id] = program;
    deps.scheduleSave();
    res.status(201).json({ program });
  });

  // Update an existing saved program by ID (never touches other saved programs)
  app.put('/api/saturday-programs/:id', (req, res) => {
    const id = String(req.params.id || '').trim();
    const dbRef = deps.getDb();
    const existing = dbRef.saturdayPrograms?.[id];
    if (!existing) {
      res.status(404).json({ error: 'Programa no encontrado para actualizar.' });
      return;
    }

    const body = req.body || {};
    const title = String(body.title ?? existing.title).trim();
    if (!title) {
      res.status(400).json({ error: 'El título no puede quedar vacío.' });
      return;
    }

    const durationMinutes = VALID_DURATIONS.includes(Number(body.durationMinutes) as SaturdayProgramDuration)
      ? (Number(body.durationMinutes) as SaturdayProgramDuration)
      : existing.durationMinutes;

    const activities = Array.isArray(body.activities)
      ? sanitizeActivities(body.activities)
      : existing.activities;

    if (activities.length === 0) {
      res.status(400).json({ error: 'El programa debe conservar al menos una actividad.' });
      return;
    }

    const status = body.status === 'final' ? 'final' : body.status === 'draft' ? 'draft' : existing.status;
    const now = Date.now();

    const updated: SaturdayProgram = {
      ...existing,
      title,
      centralTheme: String(body.centralTheme ?? existing.centralTheme).trim(),
      mainBibleText: String(body.mainBibleText ?? existing.mainBibleText).trim(),
      mainBibleVerseQuote:
        typeof body.mainBibleVerseQuote === 'string'
          ? body.mainBibleVerseQuote.trim() || undefined
          : existing.mainBibleVerseQuote,
      spiritualObjective: String(body.spiritualObjective ?? existing.spiritualObjective).trim(),
      scheduledDate:
        typeof body.scheduledDate === 'string' && body.scheduledDate.trim()
          ? body.scheduledDate.trim()
          : existing.scheduledDate,
      durationMinutes,
      status,
      directorName:
        typeof body.directorName === 'string'
          ? body.directorName.trim() || undefined
          : existing.directorName,
      directorNotes: String(body.directorNotes ?? existing.directorNotes).trim(),
      activities,
      updatedAt: now,
      finalizedAt: status === 'final' ? existing.finalizedAt || now : existing.finalizedAt,
    };

    updated.varietyWarnings = computeSimilarityWarnings(
      updated,
      Object.values(dbRef.saturdayPrograms)
    );

    dbRef.saturdayPrograms[id] = updated;
    deps.scheduleSave();
    res.json({ program: updated });
  });

  // Duplicate an existing program into a fresh editable draft without touching the original
  app.post('/api/saturday-programs/:id/duplicate', (req, res) => {
    const id = String(req.params.id || '').trim();
    const dbRef = deps.getDb();
    const source = dbRef.saturdayPrograms?.[id];
    if (!source) {
      res.status(404).json({ error: 'Programa original no encontrado.' });
      return;
    }

    let copyId = makeProgramId();
    while (dbRef.saturdayPrograms[copyId]) {
      copyId = makeProgramId();
    }

    const now = Date.now();
    const copy: SaturdayProgram = {
      ...source,
      id: copyId,
      title: source.title.startsWith('Copia de ')
        ? source.title
        : `Copia de ${source.title}`,
      scheduledDate: getUpcomingSaturdayIso(),
      status: 'draft',
      activities: source.activities.map((a) => ({
        ...a,
        id: makeActivityId(),
      })),
      createdAt: now,
      updatedAt: now,
      finalizedAt: undefined,
      duplicatedFromId: source.id,
      varietyNotice: `Duplicado de "${source.title}" (${source.scheduledDate}). Puedes editarlo y adaptarlo libremente.`,
    };

    copy.varietyWarnings = computeSimilarityWarnings(
      copy,
      Object.values(dbRef.saturdayPrograms)
    );

    dbRef.saturdayPrograms[copy.id] = copy;
    deps.scheduleSave();
    res.status(201).json({ program: copy });
  });

  // Delete a specific program (explicit action only)
  app.delete('/api/saturday-programs/:id', (req, res) => {
    const id = String(req.params.id || '').trim();
    const dbRef = deps.getDb();
    if (!dbRef.saturdayPrograms?.[id]) {
      res.status(404).json({ error: 'Programa no encontrado.' });
      return;
    }
    delete dbRef.saturdayPrograms[id];
    deps.scheduleSave();
    res.json({ ok: true, id });
  });
}
