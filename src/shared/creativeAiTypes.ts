export type DoctrinalTradition =
  | 'general'
  | 'adventista'
  | 'bautista'
  | 'pentecostal'
  | 'presbiteriana'
  | 'metodista'
  | 'interdenominacional'
  | 'personalizada';

export type BibleTranslationPreference =
  | 'RVR1960'
  | 'NVI'
  | 'NTV'
  | 'LBLA'
  | 'General';

export interface CreativeAiProfile {
  churchName: string;
  denominationalTradition: DoctrinalTradition;
  customTraditionNotes: string;
  bibleTranslation: BibleTranslationPreference;
  youthAgeGroup: string;
  ministryFocus: string;
  requireDoctrinalReviewNotes: boolean;
  updatedAt: number;
}

export const DOCTRINAL_TRADITIONS: Array<{
  id: DoctrinalTradition;
  label: string;
  description: string;
}> = [
  {
    id: 'general',
    label: 'Cristiana Bíblica General',
    description:
      'Enfoque bíblico cristocéntrico amplio. Señala puntos que el director debe revisar según su iglesia local.',
  },
  {
    id: 'adventista',
    label: 'Adventista del Séptimo Día',
    description:
      'Enfoque de Sociedad de Jóvenes sabatina, misión, vida saludable, estudio bíblico y esperanza adventista.',
  },
  {
    id: 'bautista',
    label: 'Bautista',
    description:
      'Énfasis expositivo en las Escrituras, discipulado juvenil, evangelismo y vida congregacional.',
  },
  {
    id: 'pentecostal',
    label: 'Pentecostal / Carismática',
    description:
      'Enfoque en adoración ferviente, obra del Espíritu Santo, testimonio juvenil y servicio misionero.',
  },
  {
    id: 'presbiteriana',
    label: 'Reformada / Presbiteriana',
    description:
      'Enfoque doctrinal estructurado, teología bíblica sólida, pacto, servicio y adoración reverente.',
  },
  {
    id: 'metodista',
    label: 'Metodista / Wesleyana',
    description:
      'Énfasis en santidad práctica, grupos pequeños de discipulado, misericordia y servicio social.',
  },
  {
    id: 'interdenominacional',
    label: 'Interdenominacional Juvenil',
    description:
      'Lenguaje unificador centrado en los fundamentos bíblicos compartidos para congresos o campamentos.',
  },
  {
    id: 'personalizada',
    label: 'Perfil Personalizado',
    description:
      'Usa las indicaciones doctrinales y énfasis particulares definidos por el director.',
  },
];

export type CreativeToolKind =
  | 'program'
  | 'sermon'
  | 'activity'
  | 'script'
  | 'presentation'
  | 'event'
  | 'music';

export const CREATIVE_TOOL_META: Record<
  CreativeToolKind,
  { id: CreativeToolKind; label: string; shortLabel: string; description: string }
> = {
  program: {
    id: 'program',
    label: 'Crear Programa con IA',
    shortLabel: 'Programa Juvenil',
    description:
      'Programas completos de 60, 90 o 120 minutos paso a paso, con guion, dinámicas, juegos y cronograma exacto.',
  },
  sermon: {
    id: 'sermon',
    label: 'Predicaciones y Reflexiones',
    shortLabel: 'Predicación',
    description:
      'Sermones, devocionales, meditaciones, estudios bíblicos, llamados y bosquejos para predicadores jóvenes.',
  },
  activity: {
    id: 'activity',
    label: 'Dinámicas y Juegos Cristianos',
    shortLabel: 'Dinámica / Juego',
    description:
      'Rompehielos, retos por equipos, juegos de memoria, liderazgo y dinámicas conectables a partidas en vivo.',
  },
  script: {
    id: 'script',
    label: 'Guiones y Dramatizaciones',
    shortLabel: 'Guion / Drama',
    description:
      'Dramas bíblicos, entrevistas, representaciones teatrales, aperturas y cierres con distinción bíblica.',
  },
  presentation: {
    id: 'presentation',
    label: 'Presentaciones Juveniles',
    shortLabel: 'Presentación',
    description:
      'Diapositivas editables con portada, texto bíblico, puntos, preguntas, imágenes y exportación a PowerPoint/PDF.',
  },
  event: {
    id: 'event',
    label: 'Organizador de Eventos',
    shortLabel: 'Evento',
    description:
      'Planes completos para semanas de oración, campañas, retiros, campamentos, congresos y encuentros de líderes.',
  },
  music: {
    id: 'music',
    label: 'Música y Alabanza',
    shortLabel: 'Alabanza',
    description:
      'Organización de momentos musicales, atmósfera espiritual, transiciones y guía reverente sin inventar canciones.',
  },
};

export type ProgramBlockType =
  | 'bienvenida'
  | 'oracion_inicial'
  | 'alabanza'
  | 'rompehielos'
  | 'desarrollo_principal'
  | 'actividad_biblica'
  | 'juego_competencia'
  | 'participacion_juvenil'
  | 'reflexion'
  | 'aplicacion_espiritual'
  | 'llamado_compromiso'
  | 'oracion_final'
  | 'despedida';

export interface ProgramStepDetail {
  id: string;
  order: number;
  blockType: ProgramBlockType;
  blockLabel: string;
  title: string;
  durationMin: number;
  whatDirectorDoes: string;
  whatPresenterSays: string;
  whatParticipantsDo: string;
  howToOrganize: string;
  howToStart: string;
  howToDevelop: string;
  howToFinish: string;
  materials: string[];
  spiritualTeaching: string;
  biblicalReference?: string;
  contentDistinction: 'biblico_textual' | 'adaptacion_creativa' | 'dinamica_practica';
  compatibleGameMode?: string;
}

export interface AiCreativeProgram {
  title: string;
  subtitle: string;
  centralTheme: string;
  motto: string;
  spiritualObjective: string;
  targetAudience: string;
  mainBibleText: string;
  mainBibleVerseQuote: string;
  complementaryTexts: string[];
  centralIdea: string;
  durationMinutes: 60 | 90 | 120;
  scheduledDate: string;
  eventType: string;
  allInclusiveMode: boolean;
  introduction: string;
  presenterMasterScript: string;
  steps: ProgramStepDetail[];
  questionsForAudience: string[];
  developedReflection: string;
  materialsChecklist: string[];
  imagePromptsSuggested: string[];
  presentationOutlineSummary: string[];
  weeklySpiritualChallenge: string;
  farewellMessage: string;
  doctrinalReviewPoints: string[];
  verificationNotes: string[];
}

export type SermonFormatType =
  | 'sermon_juvenil'
  | 'reflexion_corta'
  | 'meditacion'
  | 'mensaje_evangelistico'
  | 'devocional'
  | 'estudio_biblico'
  | 'llamado_espiritual'
  | 'semana_oracion'
  | 'mensaje_campana'
  | 'bosquejo_jovenes';

export interface SermonMainPoint {
  heading: string;
  bibleSupport: string;
  explanation: string;
  illustrationExample: string;
  youthApplication: string;
}

export interface AiCreativeSermon {
  title: string;
  sermonType: SermonFormatType;
  durationMinutes: number;
  depth: 'breve' | 'intermedia' | 'profunda';
  objective: string;
  mainBibleText: string;
  passageContext: string;
  introduction: string;
  mainPoints: SermonMainPoint[];
  complementaryReferences: string[];
  dailyLifeApplication: string;
  conclusion: string;
  spiritualCall: string;
  suggestedPrayer: string;
  biblicalVerificationNote: string;
  doctrinalReviewPoints: string[];
}

export type ActivityCategoryType =
  | 'rompehielos'
  | 'integracion'
  | 'juegos_biblicos'
  | 'retos_equipos'
  | 'dramatizaciones'
  | 'memoria'
  | 'competencias'
  | 'misioneras'
  | 'reflexion'
  | 'liderazgo'
  | 'grupos_pequenos'
  | 'grupos_numerosos';

export interface AiCreativeActivity {
  name: string;
  category: ActivityCategoryType;
  objective: string;
  participantCount: string;
  durationMinutes: number;
  materials: string[];
  preparation: string;
  rules: string[];
  stepByStep: string[];
  howToDetermineResult: string;
  spiritualReflection: string;
  biblicalReference?: string;
  variants: string[];
  compatibleGameMode?: string;
  compatibleGameReason?: string;
}

export type ScriptFormatType =
  | 'drama_biblico'
  | 'representacion_teatral'
  | 'entrevista_ficticia'
  | 'conversacion_personajes'
  | 'presentacion_especial'
  | 'apertura_programa'
  | 'cierre_programa'
  | 'video_juvenil';

export interface ScriptCharacter {
  name: string;
  role: string;
  wardrobeSuggestion: string;
}

export interface ScriptDialogueLine {
  speaker: string;
  actingCue: string;
  dialogue: string;
}

export interface ScriptScene {
  sceneNumber: number;
  sceneTitle: string;
  stageSetting: string;
  lines: ScriptDialogueLine[];
}

export interface AiCreativeScript {
  title: string;
  scriptType: ScriptFormatType;
  durationMinutes: number;
  participantCount: number;
  biblicalBasis: string;
  characters: ScriptCharacter[];
  scenery: string;
  materials: string[];
  actingNotes: string;
  scenes: ScriptScene[];
  spiritualMessage: string;
  biblicalVsCreativeDistinction: string;
  doctrinalReviewPoints: string[];
}

export type SlideKind =
  | 'portada'
  | 'tema'
  | 'texto_biblico'
  | 'objetivos'
  | 'punto_principal'
  | 'preguntas'
  | 'actividad'
  | 'reflexion_final';

export interface AiCreativeSlide {
  id: string;
  order: number;
  kind: SlideKind;
  title: string;
  subtitle?: string;
  bullets: string[];
  bibleVerse?: string;
  speakerNotes?: string;
  imageId?: string;
  imageUrl?: string;
  accentHex?: string;
}

export interface AiCreativePresentation {
  title: string;
  theme: string;
  mainBibleText: string;
  visualTone: string;
  slides: AiCreativeSlide[];
}

export type ChristianEventType =
  | 'sociedad_jovenes'
  | 'semana_oracion'
  | 'campana_evangelistica'
  | 'congreso_juvenil'
  | 'retiro_espiritual'
  | 'campamento'
  | 'sabado_especial'
  | 'semana_enfasis_juvenil'
  | 'encuentro_lideres'
  | 'actividad_misionera'
  | 'celebracion_talentos';

export interface EventScheduleBlock {
  block: string;
  timeSlot: string;
  activity: string;
  responsibleRole: string;
}

export interface EventBudgetEstimateItem {
  category: string;
  concept: string;
  estimatedAmountNote: string;
}

export interface AiCreativeEvent {
  title: string;
  eventType: ChristianEventType;
  generalTheme: string;
  mainBibleText: string;
  objectives: string[];
  schedule: EventScheduleBlock[];
  suggestedResponsibles: string[];
  activities: string[];
  resourcesNeeded: string[];
  materials: string[];
  promotionPlan: string[];
  includeBudget: boolean;
  estimatedBudget: EventBudgetEstimateItem[];
  budgetDisclaimer?: string;
  finalEvaluationCriteria: string[];
}

export type WorshipMomentType =
  | 'apertura'
  | 'alabanza_congregacional'
  | 'musica_reflexion'
  | 'musica_instrumental'
  | 'cierre';

export interface WorshipMomentPlan {
  moment: WorshipMomentType;
  momentLabel: string;
  spiritualPurpose: string;
  suggestedStyleAndTempo: string;
  biblicalEmphasis: string;
  teamInstructions: string;
  songOrHymnGuidance: Array<{
    suggestion: string;
    verificationRequiredNote: string;
  }>;
}

export interface AiCreativeMusicPlan {
  title: string;
  centralTheme: string;
  mainBibleText: string;
  copyrightComplianceNote: string;
  verificationNotice: string;
  moments: WorshipMomentPlan[];
}

export type CreativePayloadUnion =
  | AiCreativeProgram
  | AiCreativeSermon
  | AiCreativeActivity
  | AiCreativeScript
  | AiCreativePresentation
  | AiCreativeEvent
  | AiCreativeMusicPlan;

export interface AiCreativeSavedVersion {
  versionNumber: number;
  savedAt: number;
  status: 'draft' | 'final';
  note: string;
  payload: CreativePayloadUnion;
}

export interface AiCreativeRecord {
  id: string;
  kind: CreativeToolKind;
  title: string;
  theme: string;
  eventType: string;
  scheduledDate: string;
  status: 'draft' | 'final';
  currentVersion: number;
  versions: AiCreativeSavedVersion[];
  payload: CreativePayloadUnion;
  sentToSaturdayProgramId?: string;
  sentToYouthSocietyProgramId?: string;
  attachedImageIds?: string[];
  createdAt: number;
  updatedAt: number;
}

export type CreativeImageCategory =
  | 'afiche_juvenil'
  | 'invitacion'
  | 'portada_programa'
  | 'fondo_proyector'
  | 'historia_biblica'
  | 'ilustracion_educativa'
  | 'recurso_predicacion'
  | 'banner_evento'
  | 'redes_sociales'
  | 'fondo_presentacion';

export type CreativeImageStyle =
  | 'realismo_cinematografico'
  | 'ilustracion_biblica'
  | 'diseno_moderno_juvenil'
  | 'fotografia_eventos'
  | 'arte_digital'
  | 'diseno_minimalista'
  | 'estilo_editorial';

export type CreativeImageFormat = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

export interface AiCreativeImageRecord {
  id: string;
  prompt: string;
  modelUsed: string;
  category: CreativeImageCategory;
  format: CreativeImageFormat;
  style: CreativeImageStyle;
  mimeType: string;
  imageUrl: string;
  localFile: string;
  linkedRecordId?: string;
  note?: string;
  createdAt: number;
}

export type AiErrorCategory =
  | 'NONE'
  | 'OFFLINE'
  | 'SERVER_UNREACHABLE'
  | 'MISSING_KEY'
  | 'AUTH_401'
  | 'FORBIDDEN_403'
  | 'RATE_LIMIT_429'
  | 'BAD_REQUEST_400'
  | 'MODEL_404'
  | 'SERVER_500'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'INVALID_FORMAT'
  | 'UNKNOWN';

export interface AiDiagnosticEvent {
  id: string;
  timestamp: number;
  operation: string;
  ok: boolean;
  httpStatus: number;
  errorCategory: AiErrorCategory;
  code: string;
  latencyMs: number;
  friendlyMessage: string;
  technicalHint?: string;
}

export type ChatResourceAction =
  | 'none'
  | 'create_program'
  | 'update_program'
  | 'create_sermon'
  | 'create_activity'
  | 'create_script'
  | 'create_presentation'
  | 'create_event'
  | 'create_music'
  | 'suggest_image';

export interface ChatIntentAnalysis {
  goal: string;
  mainTheme: string;
  spiritualMessage: string;
  experienceType: string;
  participantEstimate?: number;
  durationMinutes?: number;
  assumedDefaults: string[];
}

export interface ChatStructuredArtifact {
  kind: CreativeToolKind;
  title: string;
  theme: string;
  eventType: string;
  scheduledDate: string;
  payload: CreativePayloadUnion;
}

export interface AiCreativeChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;
  activeRecordId?: string;
  modelUsed?: string;
  intentAnalysis?: ChatIntentAnalysis;
  resourceAction?: ChatResourceAction;
  structuredArtifact?: ChatStructuredArtifact;
  suggestedImagePrompt?: string;
}

export interface AiCreativeChatSession {
  id: string;
  title: string;
  activeRecordId?: string;
  messages: AiCreativeChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface AiCreativeStatus {
  geminiConfigured: boolean;
  textModel: string;
  imageModel: string;
  imageServiceReady: boolean;
  imageRequiresPaidKey: boolean;
  statusMessage: string;
  imageStatusMessage: string;
  lastDiagnostic?: AiDiagnosticEvent;
}

export interface CreativeAiDatabaseSlice {
  profile: CreativeAiProfile;
  records: Record<string, AiCreativeRecord>;
  images: AiCreativeImageRecord[];
  chatSessions: Record<string, AiCreativeChatSession>;
  activeChatSessionId: string | null;
}

export function rebalanceProgramStepDurations(
  steps: ProgramStepDetail[],
  targetMinutes: 60 | 90 | 120
): ProgramStepDetail[] {
  if (steps.length === 0) return [];
  const weights = steps.map((s) => Math.max(1, Number(s.durationMin) || 5));
  const sum = weights.reduce((acc, n) => acc + n, 0) || steps.length;
  const raw = weights.map((w) => (w / sum) * targetMinutes);
  const ints = raw.map((v) => Math.max(1, Math.floor(v)));
  let diff = targetMinutes - ints.reduce((acc, v) => acc + v, 0);

  if (diff > 0) {
    const order = raw
      .map((v, idx) => ({ idx, frac: v - Math.floor(v) }))
      .sort((a, b) => b.frac - a.frac);
    let cursor = 0;
    while (diff > 0) {
      ints[order[cursor % order.length].idx] += 1;
      diff -= 1;
      cursor += 1;
    }
  } else if (diff < 0) {
    const order = ints
      .map((v, idx) => ({ idx, v }))
      .sort((a, b) => b.v - a.v);
    let safety = 0;
    while (diff < 0 && safety < 500) {
      let reduced = false;
      for (const item of order) {
        if (diff === 0) break;
        if (ints[item.idx] > 1) {
          ints[item.idx] -= 1;
          diff += 1;
          reduced = true;
        }
      }
      if (!reduced) break;
      safety += 1;
    }
  }

  return steps.map((s, idx) => ({
    ...s,
    order: idx + 1,
    durationMin: ints[idx],
  }));
}
