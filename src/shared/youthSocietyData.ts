import type {
  DifficultySetting,
  GameMode,
} from './types';

export type YouthSectionCode =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'L'
  | 'M';

export type YouthExperienceType =
  | 'divertida'
  | 'educativa'
  | 'evangelistica'
  | 'reflexiva'
  | 'combinada';

export type YouthParticipationMode = 'individual' | 'parejas' | 'equipos';

export type YouthSoundMood =
  | 'bienvenida'
  | 'transicion'
  | 'reto'
  | 'ruleta'
  | 'misterio'
  | 'competencia'
  | 'presentacion'
  | 'cuenta_regresiva'
  | 'reconocimiento'
  | 'finalizacion';

export type YouthBiblicalContentType =
  | 'texto_biblico_literal'
  | 'adaptacion_narrativa'
  | 'dinamica_practica';

export type YouthActivityExecutionStatus =
  | 'pendiente'
  | 'en_curso'
  | 'completada'
  | 'omitida';

export interface YouthSectionMeta {
  code: YouthSectionCode;
  label: string;
  description: string;
  defaultDurationMin: number;
  defaultMood: YouthSoundMood;
  suggestedGameModes?: GameMode[];
  accentHex: string;
}

export const YOUTH_SECTIONS: YouthSectionMeta[] = [
  {
    code: 'A',
    label: 'Bienvenida y rompehielos',
    description: 'Recepción cálida y dinámica rápida de integración.',
    defaultDurationMin: 8,
    defaultMood: 'bienvenida',
    accentHex: '#F59E0B',
  },
  {
    code: 'B',
    label: 'Alabanza y participación',
    description: 'Cantos congregacionales, lectura antifonal y adoración.',
    defaultDurationMin: 12,
    defaultMood: 'presentacion',
    accentHex: '#8B5CF6',
  },
  {
    code: 'C',
    label: 'Retos sorpresa',
    description: 'Retos sabatinos creativos o bíblicos de agilidad.',
    defaultDurationMin: 8,
    defaultMood: 'reto',
    suggestedGameModes: ['retos_sabado'],
    accentHex: '#EC4899',
  },
  {
    code: 'D',
    label: 'Ruleta de actividades',
    description: 'Giro interactivo de categorías bíblicas y dinámicas.',
    defaultDurationMin: 9,
    defaultMood: 'ruleta',
    suggestedGameModes: ['ruleta_sabado', 'ruleta_biblica'],
    accentHex: '#0EA5E9',
  },
  {
    code: 'E',
    label: 'Juegos bíblicos existentes',
    description: 'Trivia, ¿Quién Soy?, Misterio, Crucigramas o Aprende con la Biblia.',
    defaultDurationMin: 14,
    defaultMood: 'competencia',
    suggestedGameModes: [
      'clasico',
      'velocidad',
      'quien_soy',
      'misterio_biblico',
      'crucigrama_biblico',
      'completa_versiculo',
      'aprende_biblia',
    ],
    accentHex: '#38BDF8',
  },
  {
    code: 'F',
    label: 'Batallas bíblicas',
    description: 'Duelos frente a frente o por representantes.',
    defaultDurationMin: 10,
    defaultMood: 'competencia',
    suggestedGameModes: ['batalla_1v1'],
    accentHex: '#F43F5E',
  },
  {
    code: 'G',
    label: 'Competencias por equipos',
    description: 'Concurso grupal con marcador y capitanes.',
    defaultDurationMin: 14,
    defaultMood: 'competencia',
    suggestedGameModes: ['competencia_equipos', 'equipos'],
    accentHex: '#10B981',
  },
  {
    code: 'H',
    label: 'Aventuras e historias bíblicas',
    description: 'Relatos bíblicos interactivos por escenas y decisiones.',
    defaultDurationMin: 12,
    defaultMood: 'misterio',
    suggestedGameModes: ['aventuras_biblicas'],
    accentHex: '#14B8A6',
  },
  {
    code: 'I',
    label: 'Talentos juveniles',
    description: 'Presentaciones musicales, poesía, drama o testimonio artístico.',
    defaultDurationMin: 12,
    defaultMood: 'presentacion',
    suggestedGameModes: ['talentos_juveniles'],
    accentHex: '#A855F7',
  },
  {
    code: 'J',
    label: 'Reflexiones espirituales',
    description: 'Exposición bíblica central y diálogo aplicativo.',
    defaultDurationMin: 14,
    defaultMood: 'transicion',
    accentHex: '#6366F1',
  },
  {
    code: 'K',
    label: 'Misiones juveniles',
    description: 'Servicio práctico, evangelismo y compromiso semanal.',
    defaultDurationMin: 6,
    defaultMood: 'reconocimiento',
    accentHex: '#22C55E',
  },
  {
    code: 'L',
    label: 'Cabina de sorpresas',
    description: 'Caja misteriosa con actividad aleatoria sin repetir.',
    defaultDurationMin: 6,
    defaultMood: 'misterio',
    accentHex: '#F97316',
  },
  {
    code: 'M',
    label: 'Despedida y desafío de la semana',
    description: 'Oración final, reto práctico semanal y confraternidad.',
    defaultDurationMin: 6,
    defaultMood: 'finalizacion',
    accentHex: '#94A3B8',
  },
];

export interface YouthProgramConfigInput {
  durationMinutes: 60 | 90 | 120;
  estimatedParticipants: number;
  participationMode: YouthParticipationMode;
  difficulty: DifficultySetting;
  spiritualTheme: string;
  experienceType: YouthExperienceType;
  includeSections: YouthSectionCode[];
  avoidSections: YouthSectionCode[];
  includeCompetitions: boolean;
  includeTalents: boolean;
  includeMission: boolean;
  scheduledDate: string;
  directorName: string;
}

export interface YouthConfigPreset {
  id: string;
  label: string;
  description: string;
  config: Omit<YouthProgramConfigInput, 'scheduledDate' | 'directorName'>;
}

export const YOUTH_CONFIG_PRESETS: YouthConfigPreset[] = [
  {
    id: 'dinamico_equipos',
    label: 'Sábado Dinámico por Equipos (90 min)',
    description: 'Rompehielos, ruleta, competencia por equipos, reflexión y cabina de sorpresas.',
    config: {
      durationMinutes: 90,
      estimatedParticipants: 45,
      participationMode: 'equipos',
      difficulty: 'combinado',
      spiritualTheme: '',
      experienceType: 'combinada',
      includeSections: ['A', 'B', 'D', 'G', 'J', 'L', 'M'],
      avoidSections: [],
      includeCompetitions: true,
      includeTalents: false,
      includeMission: true,
    },
  },
  {
    id: 'reflexivo_60',
    label: 'Noche Reflexiva y Crecimiento (60 min)',
    description: 'Alabanza, aventura bíblica, reflexión profunda, aplicación y misión semanal.',
    config: {
      durationMinutes: 60,
      estimatedParticipants: 30,
      participationMode: 'individual',
      difficulty: 'intermedio',
      spiritualTheme: '',
      experienceType: 'reflexiva',
      includeSections: ['A', 'B', 'H', 'J', 'K', 'M'],
      avoidSections: ['F'],
      includeCompetitions: false,
      includeTalents: false,
      includeMission: true,
    },
  },
  {
    id: 'evangelistico_talentos_120',
    label: 'Encuentro Evangelístico y Talentos (120 min)',
    description: 'Ideal para invitados: bienvenida, juegos bíblicos, talentos, testimonio, misión y cierre.',
    config: {
      durationMinutes: 120,
      estimatedParticipants: 80,
      participationMode: 'parejas',
      difficulty: 'facil',
      spiritualTheme: '',
      experienceType: 'evangelistica',
      includeSections: ['A', 'B', 'C', 'E', 'I', 'J', 'K', 'L', 'M'],
      avoidSections: [],
      includeCompetitions: true,
      includeTalents: true,
      includeMission: true,
    },
  },
  {
    id: 'educativo_biblico',
    label: 'Sábado Educativo y Desafío Bíblico (90 min)',
    description: 'Juegos bíblicos, duelos 1v1, historia interactiva y estudio aplicativo.',
    config: {
      durationMinutes: 90,
      estimatedParticipants: 35,
      participationMode: 'equipos',
      difficulty: 'dificil',
      spiritualTheme: '',
      experienceType: 'educativa',
      includeSections: ['A', 'B', 'E', 'F', 'H', 'J', 'M'],
      avoidSections: [],
      includeCompetitions: true,
      includeTalents: false,
      includeMission: false,
    },
  },
];

export interface YouthProgramActivityItem {
  id: string;
  order: number;
  sectionCode: YouthSectionCode;
  sectionLabel: string;
  title: string;
  description: string;
  durationMin: number;
  materials: string;
  directorInstructions: string;
  participantInstructions: string;
  transitionText: string;
  biblicalReference: string;
  scripturalText: string;
  contentType: YouthBiblicalContentType;
  directorReviewed: boolean;
  soundMood: YouthSoundMood;
  linkedGameMode?: GameMode;
  linkedGameCode?: string;
  linkedGameId?: string;
  linkedInvitePath?: string;
  requiresOnsiteValidation?: boolean;
  onsiteValidated?: boolean;
  onsiteResultNote?: string;
  status: YouthActivityExecutionStatus;
}

export interface YouthProgramPlan {
  id: string;
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
  config: YouthProgramConfigInput;
  activities: YouthProgramActivityItem[];
  totalDurationMin: number;
  status: 'draft' | 'final';
  generationSource: 'gemini_ai' | 'curated_library';
  varietySummary: string;
  repetitionWarnings: string[];
  directorObservations: string;
  liveState: {
    playbackStatus: 'preparacion' | 'en_curso' | 'pausado' | 'finalizado';
    currentActivityIndex: number;
    timerRunning: boolean;
    timerEndsAt: number | null;
    timerPausedRemainingSec: number | null;
    activeSurprise: {
      title: string;
      categoryLabel: string;
      instructions: string;
      reference: string;
      durationSec: number;
      triggeredAt: number;
    } | null;
    soundCueNonce: number;
    lastSoundMood: YouthSoundMood;
    startedAt?: number;
    finishedAt?: number;
  };
  createdAt: number;
  updatedAt: number;
}

export interface YouthProgramHistoryEntry {
  id: string;
  programId: string;
  date: string;
  creativeName: string;
  centralTheme: string;
  mainBibleText: string;
  durationMinutes: number;
  experienceType: YouthExperienceType;
  participationMode: YouthParticipationMode;
  estimatedParticipants: number;
  completedActivities: Array<{
    sectionCode: YouthSectionCode;
    title: string;
    durationMin: number;
    onsiteResultNote?: string;
  }>;
  skippedActivities: Array<{
    sectionCode: YouthSectionCode;
    title: string;
  }>;
  gamesUsed: Array<{ mode: string; code?: string; title: string }>;
  challengesUsed: string[];
  roulettesUsed: string[];
  storiesUsed: string[];
  dynamicsUsed: string[];
  resultsSummary: string;
  teamsSummary: string[];
  directorObservations: string;
  recordedAt: number;
}

export interface YouthSocietyStatsSummary {
  totalProgramsCreated: number;
  totalExecutedPrograms: number;
  sectionFrequency: Array<{
    code: YouthSectionCode;
    label: string;
    count: number;
    sharePercent: number;
  }>;
  underusedSections: YouthSectionCode[];
  recentThemes: string[];
  recentGames: string[];
}

export interface VerifiedBiblicalAnchor {
  reference: string;
  literalVerse: string;
  theme: string;
  objective: string;
  reflectionGuide: string;
  applicationGuide: string;
  weeklyChallengeGuide: string;
}

/**
 * Curated database of verified Scripture citations & literal verses (Reina-Valera 1960)
 * so reliable biblical references are never hallucinated.
 */
export const VERIFIED_BIBLICAL_ANCHORS: VerifiedBiblicalAnchor[] = [
  {
    reference: '1 Timoteo 4:12',
    literalVerse:
      'Ninguno tenga en poco tu juventud, sino sé ejemplo de los creyentes en palabra, conducta, amor, espíritu, fe y pureza.',
    theme: 'Juventud que inspira con el ejemplo',
    objective: 'Animar a cada joven a vivir con integridad en su hablar, conducta, amor, fe y pureza.',
    reflectionGuide:
      'Pablo exhorta al joven Timoteo a no intimidarse por su edad, sino a reflejar el carácter de Cristo en seis áreas prácticas de la vida diaria.',
    applicationGuide:
      'Identifica una de las seis áreas (palabra, conducta, amor, espíritu, fe o pureza) para fortalecerla intencionalmente esta semana.',
    weeklyChallengeGuide:
      'Comparte una palabra de ánimo sincero con alguien de tu colegio, trabajo o familia y ora por esa persona durante 5 días.',
  },
  {
    reference: 'Josué 1:9',
    literalVerse:
      'Mira que te mando que te esfuerces y seas valiente; no temas ni desmayes, porque Jehová tu Dios estará contigo en dondequiera que vayas.',
    theme: 'Valentía que vence el temor',
    objective: 'Recordar que la valentía cristiana nace de la presencia fiel de Dios en toda circunstancia.',
    reflectionGuide:
      'Antes de cruzar el Jordán, Dios recuerda a Josué que la fortaleza no proviene de la ausencia de retos, sino de la certeza de Su compañía.',
    applicationGuide:
      'Anota una decisión o reto que has postergado por temor y entrégalo hoy en oración dando un primer paso concreto.',
    weeklyChallengeGuide:
      'Realiza una acción de servicio o testimonio que normalmente te daría timidez, confiando en la promesa de Josué 1:9.',
  },
  {
    reference: 'Mateo 5:14-16',
    literalVerse:
      'Vosotros sois la luz del mundo; una ciudad asentada sobre un monte no se puede esconder... Así alumbre vuestra luz delante de los hombres, para que vean vuestras buenas obras, y glorifiquen a vuestro Padre que está en los cielos.',
    theme: 'Luz visible en nuestra generación',
    objective: 'Despertar en los jóvenes un testimonio práctico que apunte a la gloria de Dios.',
    reflectionGuide:
      'Jesús afirma que sus discípulos ya son luz; la luz no hace ruido para llamar la atención sobre sí misma, sino que ilumina con buenas obras para gloria del Padre.',
    applicationGuide:
      'Sirve de forma discreta y generosa en tu hogar o comunidad esta semana sin esperar reconocimiento.',
    weeklyChallengeGuide:
      'Invita a un amigo a la próxima reunión juvenil o comparte un gesto concreto de apoyo solidario con alguien cercano.',
  },
  {
    reference: 'Salmos 119:9-11',
    literalVerse:
      '¿Con qué limpiará el joven su camino? Con guardar tu palabra... En mi corazón he guardado tus dichos, para no pecar contra ti.',
    theme: 'Decisiones guiadas por la Palabra',
    objective: 'Fomentar el amor por la lectura y memorización bíblica como brújula diaria.',
    reflectionGuide:
      'El salmista responde a la pregunta más urgente de la juventud: una vida limpia y firme se construye atesorando la Escritura en el corazón.',
    applicationGuide:
      'Reserva 10 minutos diarios antes de usar el celular en la mañana para leer un capítulo breve de Proverbios o los Evangelios.',
    weeklyChallengeGuide:
      'Memoriza un versículo de Salmos 119 y compártelo en el grupo juvenil el próximo sábado.',
  },
  {
    reference: 'Filipenses 4:6-7',
    literalVerse:
      'Por nada estéis afanosos, sino sean conocidas vuestras peticiones delante de Dios en toda oración y ruego, con acción de gracias. Y la paz de Dios, que sobrepasa todo entendimiento, guardará vuestros corazones y vuestros pensamientos en Cristo Jesús.',
    theme: 'Paz verdadera en medio de la ansiedad',
    objective: 'Enseñar a entregar las preocupaciones juveniles en oración agradecida.',
    reflectionGuide:
      'Pablo escribe desde la prisión enseñando que la gratitud y la oración sustituyen la ansiedad por una paz que custodia la mente y el corazón.',
    applicationGuide:
      'Cada vez que sientas presión por estudios, futuro o familia esta semana, convierte la preocupación en una oración específica con acción de gracias.',
    weeklyChallengeGuide:
      'Lleva una lista de tres motivos de gratitud diarios durante toda la semana y ora por un compañero que esté pasando estrés.',
  },
  {
    reference: 'Romanos 12:10-12',
    literalVerse:
      'Amaos los unos a los otros con amor fraternal; en cuanto a honra, prefiriéndoos los unos a los otros. En lo que requiere diligencia, no perezosos; fervientes en espíritu, sirviendo al Señor.',
    theme: 'Comunidad que honra y sirve con alegría',
    objective: 'Fortalecer la unidad, el respeto mutuo y el entusiasmo en el servicio cristiano.',
    reflectionGuide:
      'La iglesia juvenil crece cuando nadie compite por protagonismo, sino cuando cada uno se adelanta a honrar y servir a los demás con fervor.',
    applicationGuide:
      'Busca hoy a un joven nuevo o poco integrado del grupo y dedícale tiempo genuino de conversación y amistad.',
    weeklyChallengeGuide:
      'Organiza o apóyate con otro compañero para ayudar a una persona o familia de la congregación esta semana.',
  },
  {
    reference: 'Efesios 2:10',
    literalVerse:
      'Porque somos hechura suya, creados en Cristo Jesús para buenas obras, las cuales Dios preparó de antemano para que anduviésemos en ellas.',
    theme: 'Propósito diseñado por Dios',
    objective: 'Ayudar a los jóvenes a descubrir su identidad y dones al servicio del Reino.',
    reflectionGuide:
      'No somos producto del azar; en Cristo somos obra maestra de Dios con dones únicos preparados para bendecir a otros.',
    applicationGuide:
      'Escribe dos talentos o habilidades que Dios te ha dado y piensa en cómo ponerlos al servicio de la Sociedad de Jóvenes.',
    weeklyChallengeGuide:
      'Pon en práctica uno de tus dones ayudando en algún ministerio o preparando un aporte para el próximo programa.',
  },
];

export const SOUND_MOOD_LABELS: Record<YouthSoundMood, string> = {
  bienvenida: 'Bienvenida',
  transicion: 'Transición',
  reto: 'Retos',
  ruleta: 'Ruletas',
  misterio: 'Misterios',
  competencia: 'Competencias',
  presentacion: 'Presentaciones',
  cuenta_regresiva: 'Cuenta regresiva',
  reconocimiento: 'Reconocimientos',
  finalizacion: 'Finalización',
};

export function getSectionMeta(code: YouthSectionCode): YouthSectionMeta {
  return YOUTH_SECTIONS.find((s) => s.code === code) || YOUTH_SECTIONS[0];
}

export function rebalanceYouthActivities(
  activities: YouthProgramActivityItem[],
  targetMinutes: 60 | 90 | 120
): YouthProgramActivityItem[] {
  if (activities.length === 0) return [];
  const weights = activities.map((a) =>
    Math.max(
      2,
      Number(a.durationMin) || getSectionMeta(a.sectionCode).defaultDurationMin
    )
  );
  const sum = weights.reduce((acc, w) => acc + w, 0) || activities.length;
  const raw = weights.map((w) => (w / sum) * targetMinutes);
  const ints = raw.map((v) => Math.max(2, Math.floor(v)));
  let diff = targetMinutes - ints.reduce((acc, v) => acc + v, 0);

  if (diff > 0) {
    const order = raw
      .map((v, idx) => ({ idx, frac: v - Math.floor(v) }))
      .sort((a, b) => b.frac - a.frac);
    let i = 0;
    while (diff > 0) {
      ints[order[i % order.length].idx] += 1;
      diff -= 1;
      i += 1;
    }
  } else if (diff < 0) {
    const order = ints
      .map((v, idx) => ({ idx, v }))
      .sort((a, b) => b.v - a.v);
    let guard = 0;
    while (diff < 0 && guard < 400) {
      let reduced = false;
      for (const item of order) {
        if (diff === 0) break;
        if (ints[item.idx] > 2) {
          ints[item.idx] -= 1;
          diff += 1;
          reduced = true;
        }
      }
      if (!reduced) break;
      guard += 1;
    }
  }

  return activities.map((act, idx) => ({
    ...act,
    order: idx + 1,
    durationMin: ints[idx],
  }));
}

export function formatMmSs(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
