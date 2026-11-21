export type SaturdayRouletteCategoryId =
  | 'canta_alabanza'
  | 'pregunta_biblica'
  | 'personaje_misterioso'
  | 'representacion_biblica'
  | 'desafio_relampago'
  | 'reflexion_espiritual'
  | 'testimonio'
  | 'reto_pareja'
  | 'competencia_equipos'
  | 'versiculo_sorpresa'
  | 'mision_servicio'
  | 'actividad_creatividad';

export type SaturdayRouletteParticipationMode =
  | 'individual'
  | 'parejas'
  | 'equipos'
  | 'congregacion';

export type SaturdayRoulettePhase =
  | 'lobby'
  | 'spinning_revealed'
  | 'challenge_active'
  | 'result_recorded';

export type SaturdayRouletteValidationGrade =
  | 'pending'
  | 'featured'
  | 'approved'
  | 'participation'
  | 'rejected';

export interface SaturdayRouletteCategoryMeta {
  id: SaturdayRouletteCategoryId;
  label: string;
  shortLabel: string;
  color: string;
  accentBg: string;
  description: string;
  defaultSec: number;
}

export const SATURDAY_ROULETTE_CATEGORIES: SaturdayRouletteCategoryMeta[] = [
  {
    id: 'canta_alabanza',
    label: 'Canta una alabanza',
    shortLabel: 'Alabanza',
    color: '#D97706',
    accentBg: 'bg-amber-500/15 border-amber-400/50 text-amber-200',
    description: 'Entona un coro o himno cristiano con alegría junto a los jóvenes.',
    defaultSec: 45,
  },
  {
    id: 'pregunta_biblica',
    label: 'Pregunta bíblica',
    shortLabel: 'Pregunta',
    color: '#0284C7',
    accentBg: 'bg-sky-500/15 border-sky-400/50 text-sky-200',
    description: 'Responde con precisión antes de que se agote el cronómetro.',
    defaultSec: 30,
  },
  {
    id: 'personaje_misterioso',
    label: 'Personaje misterioso',
    shortLabel: 'Personaje',
    color: '#7C3AED',
    accentBg: 'bg-violet-500/15 border-violet-400/50 text-violet-200',
    description: 'Identifica al héroe o figura bíblica a partir de sus pistas.',
    defaultSec: 40,
  },
  {
    id: 'representacion_biblica',
    label: 'Representación bíblica',
    shortLabel: 'Actuación',
    color: '#0D9488',
    accentBg: 'bg-teal-500/15 border-teal-400/50 text-teal-200',
    description: 'Escenifica un pasaje o relato bíblico para edificar a todos.',
    defaultSec: 75,
  },
  {
    id: 'desafio_relampago',
    label: 'Desafío relámpago',
    shortLabel: 'Relámpago',
    color: '#DC2626',
    accentBg: 'bg-rose-500/15 border-rose-400/50 text-rose-200',
    description: 'Prueba veloz de agilidad mental y conocimiento bíblico.',
    defaultSec: 25,
  },
  {
    id: 'reflexion_espiritual',
    label: 'Reflexión espiritual',
    shortLabel: 'Reflexión',
    color: '#4F46E5',
    accentBg: 'bg-indigo-500/15 border-indigo-400/50 text-indigo-200',
    description: 'Comparte una aplicación espiritual clara para la juventud hoy.',
    defaultSec: 60,
  },
  {
    id: 'testimonio',
    label: 'Testimonio',
    shortLabel: 'Testimonio',
    color: '#059669',
    accentBg: 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200',
    description: 'Testifica brevemente una bendición, oración contestada o enseñanza de Dios.',
    defaultSec: 75,
  },
  {
    id: 'reto_pareja',
    label: 'Reto en pareja',
    shortLabel: 'En Pareja',
    color: '#DB2777',
    accentBg: 'bg-pink-500/15 border-pink-400/50 text-pink-200',
    description: 'Dinámica colaborativa para resolver de a dos en armonía.',
    defaultSec: 60,
  },
  {
    id: 'competencia_equipos',
    label: 'Competencia entre equipos',
    shortLabel: 'Equipos',
    color: '#EA580C',
    accentBg: 'bg-orange-500/15 border-orange-400/50 text-orange-200',
    description: 'Desafío colectivo donde todo el grupo aporta para sumar puntos.',
    defaultSec: 60,
  },
  {
    id: 'versiculo_sorpresa',
    label: 'Versículo sorpresa',
    shortLabel: 'Versículo',
    color: '#2563EB',
    accentBg: 'bg-blue-500/15 border-blue-400/50 text-blue-200',
    description: 'Recita, completa o encuentra una cita bíblica clave al instante.',
    defaultSec: 40,
  },
  {
    id: 'mision_servicio',
    label: 'Misión de servicio',
    shortLabel: 'Servicio',
    color: '#16A34A',
    accentBg: 'bg-green-500/15 border-green-400/50 text-green-200',
    description: 'Compromiso práctico de amor cristiano, visita, ayuda u oración.',
    defaultSec: 60,
  },
  {
    id: 'actividad_creatividad',
    label: 'Actividad de creatividad',
    shortLabel: 'Creatividad',
    color: '#9333EA',
    accentBg: 'bg-purple-500/15 border-purple-400/50 text-purple-200',
    description: 'Crea un lema, acróstico, coro breve o enseñanza con ingenio cristiano.',
    defaultSec: 60,
  },
];

export const SATURDAY_ROULETTE_MODE_INFO: Record<
  SaturdayRouletteParticipationMode,
  { label: string; shortDesc: string }
> = {
  individual: {
    label: 'Participación individual',
    shortDesc: 'Se selecciona a un joven al azar o por elección del director en cada giro.',
  },
  parejas: {
    label: 'Parejas',
    shortDesc: 'Duplas compitiendo juntas para cumplir cada giro de la ruleta.',
  },
  equipos: {
    label: 'Equipos',
    shortDesc: 'Grupos bíblicos con nombre, color propio y marcador acumulado.',
  },
  congregacion: {
    label: 'Toda la congregación',
    shortDesc: 'Toda la Sociedad de Jóvenes participa unida en la actividad del giro.',
  },
};

export interface SaturdayRouletteActivity {
  id: string;
  categoryId: SaturdayRouletteCategoryId;
  title: string;
  instructions: string;
  reference: string;
  suggestedSec: number;
  evaluationType: 'director_review' | 'auto_choice';
  options?: string[];
  correctIndex?: number;
  guideAnswer?: string;
  isCustom?: boolean;
}

export interface SaturdayRouletteRoomActivityView {
  id: string;
  categoryId: SaturdayRouletteCategoryId;
  categoryLabel: string;
  categoryColor: string;
  title: string;
  instructions: string;
  suggestedSec: number;
  evaluationType: 'director_review' | 'auto_choice';
  options?: string[];
  correctIndex?: number;
  reference?: string;
  guideAnswer?: string;
}

export interface SaturdayRouletteSubmissionView {
  participantId: string;
  participantName: string;
  avatarId: string;
  photoUrl?: string;
  teamId?: string;
  selectedIndex?: number;
  submittedText?: string;
  completedSignal?: boolean;
  isAutoCorrect?: boolean;
  validationStatus: SaturdayRouletteValidationGrade;
  pointsAwarded: number;
  responseTimeMs: number;
}

export interface SaturdayRouletteRoomState {
  phase: SaturdayRoulettePhase;
  participationMode: SaturdayRouletteParticipationMode;
  enabledCategories: SaturdayRouletteCategoryId[];
  allowRespin: boolean;
  configuredTimeSec: number;
  spinNonce: number;
  spinsCount: number;
  targetAngleDeg: number;
  selectedSlotIndex: number;
  selectedCategoryId: SaturdayRouletteCategoryId | null;
  currentActivity: SaturdayRouletteRoomActivityView | null;
  targetParticipantId?: string;
  targetParticipantName?: string;
  targetTeamId?: string;
  targetTeamName?: string;
  targetTeamColor?: string;
  resultRecordedForSpin: boolean;
  recordedSummary?: string;
  mySubmission: SaturdayRouletteSubmissionView | null;
  submissions: SaturdayRouletteSubmissionView[];
  usedActivityIds: string[];
}

export interface SaturdayRouletteHistoryEntry {
  id: string;
  spinNumber: number;
  categoryId: SaturdayRouletteCategoryId;
  categoryLabel: string;
  activityId: string;
  activityTitle: string;
  participationMode: SaturdayRouletteParticipationMode;
  participantName: string;
  grade: SaturdayRouletteValidationGrade;
  pointsAwarded: number;
  durationSec: number;
  roomCode?: string;
  note?: string;
  executedAt: number;
}

export const BUILTIN_SATURDAY_ROULETTE_ACTIVITIES: SaturdayRouletteActivity[] = [
  // 1. CANTA UNA ALABANZA
  {
    id: 'sr-alb-1',
    categoryId: 'canta_alabanza',
    title: 'Coro de Gratitud a Dos Voces',
    instructions:
      'Elige o improvisa el coro de una alabanza conocida de gratitud y cántalo con entusiasmo invitando a toda la sala a acompañarte con las palmas.',
    reference: 'Salmos 100:1-2',
    suggestedSec: 45,
    evaluationType: 'director_review',
    guideAnswer: 'Sugerencias: "Bueno es alabar", "Gracias Cristo", "Te doy gloria" o un himno congregacional.',
  },
  {
    id: 'sr-alb-2',
    categoryId: 'canta_alabanza',
    title: 'Alabanza por Palabra Clave: "Gozo"',
    instructions:
      'Canta al menos 4 líneas de cualquier alabanza cristiana que mencione las palabras "gozo", "alegría" o "cantar".',
    reference: 'Filipenses 4:4',
    suggestedSec: 40,
    evaluationType: 'director_review',
    guideAnswer: 'Cualquier coro o himno juvenil que contenga gozo/alegría/cantar entonado con ánimo.',
  },
  {
    id: 'sr-alb-3',
    categoryId: 'canta_alabanza',
    title: 'Salmo Cantado en Vivo',
    instructions:
      'Escoge un versículo corto de los Salmos (como Salmos 23:1 o Salmos 150:6) y cántalo con melodía libre o un coro basado en él.',
    reference: 'Salmos 150:6',
    suggestedSec: 45,
    evaluationType: 'director_review',
    guideAnswer: 'Ejemplo: "Todo lo que respira alabe al Señor" o "Jehová es mi pastor".',
  },
  {
    id: 'sr-alb-4',
    categoryId: 'canta_alabanza',
    title: 'Relevo de Himno Favorito',
    instructions:
      'Comienza cantando la primera estrofa de un himno clásico o alabanza juvenil y señala a otro participante para que continúe el coro.',
    reference: 'Colosenses 3:16',
    suggestedSec: 50,
    evaluationType: 'director_review',
    guideAnswer: 'Se evalúa el entusiasmo, participación y el pase fluido al compañero.',
  },

  // 2. PREGUNTA BÍBLICA
  {
    id: 'sr-prg-1',
    categoryId: 'pregunta_biblica',
    title: 'Los Jóvenes Fieles en Babilonia',
    instructions:
      '¿Cómo se llamaban los tres amigos de Daniel que fueron arrojados al horno de fuego por no adorar la estatua de oro?',
    reference: 'Daniel 3:12-25',
    suggestedSec: 30,
    evaluationType: 'auto_choice',
    options: [
      'Sadrac, Mesac y Abed-nego',
      'Pedro, Jacobo y Juan',
      'Sem, Cam y Jafet',
      'Gedeón, Sansón y Jefté',
    ],
    correctIndex: 0,
    guideAnswer: 'Sadrac, Mesac y Abed-nego permanecieron fieles a Dios en medio del fuego.',
  },
  {
    id: 'sr-prg-2',
    categoryId: 'pregunta_biblica',
    title: 'El Primer Milagro de Jesús',
    instructions:
      '¿En qué ciudad realizó Jesús su primer milagro público al convertir el agua en vino durante una boda?',
    reference: 'Juan 2:1-11',
    suggestedSec: 25,
    evaluationType: 'auto_choice',
    options: ['Nazaret', 'Caná de Galilea', 'Capernaúm', 'Jericó'],
    correctIndex: 1,
    guideAnswer: 'Fue en las bodas de Caná de Galilea.',
  },
  {
    id: 'sr-prg-3',
    categoryId: 'pregunta_biblica',
    title: 'Armadura de Dios',
    instructions:
      'Según Efesios 6, ¿qué pieza de la armadura espiritual representa la Palabra de Dios?',
    reference: 'Efesios 6:17',
    suggestedSec: 25,
    evaluationType: 'auto_choice',
    options: [
      'El yelmo de la salvación',
      'La espada del Espíritu',
      'El escudo de la fe',
      'La coraza de justicia',
    ],
    correctIndex: 1,
    guideAnswer: 'La espada del Espíritu, que es la palabra de Dios.',
  },
  {
    id: 'sr-prg-4',
    categoryId: 'pregunta_biblica',
    title: 'La Sabiduría de Timoteo',
    instructions:
      '¿Qué le escribió Pablo al joven Timoteo para recordarle que su juventud no es excusa para no servir a Dios?',
    reference: '1 Timoteo 4:12',
    suggestedSec: 30,
    evaluationType: 'auto_choice',
    options: [
      'Ninguno tenga en poco tu juventud, sino sé ejemplo de los creyentes',
      'Espera hasta tener cuarenta años para enseñar',
      'Guarda tu talento solamente para tu familia',
      'Habla solo cuando los ancianos te pregunten',
    ],
    correctIndex: 0,
    guideAnswer: 'Sé ejemplo en palabra, conducta, amor, espíritu, fe y pureza.',
  },

  // 3. PERSONAJE MISTERIOSO
  {
    id: 'sr-per-1',
    categoryId: 'personaje_misterioso',
    title: 'El Soñador Vestido de Colores',
    instructions:
      'Adivina este personaje antes de que termine el tiempo: 1) Recibió una túnica especial de su padre. 2) Sus hermanos lo vendieron por envidia. 3) Interpretó los sueños del faraón en Egipto y perdonó a su familia.',
    reference: 'Génesis 37-45',
    suggestedSec: 35,
    evaluationType: 'auto_choice',
    options: ['José', 'Samuel', 'David', 'Benjamín'],
    correctIndex: 0,
    guideAnswer: 'José, hijo de Jacob, ejemplo de perdón y fidelidad en tiempos difíciles.',
  },
  {
    id: 'sr-per-2',
    categoryId: 'personaje_misterioso',
    title: 'La Reina Valiente',
    instructions:
      'Descubre quién es: 1) Su primo Mardoqueo la animó a no callar. 2) Ayunó tres días antes de presentarse ante el rey sin ser llamada. 3) Dijo: "Si perezco, que perezca", salvando a su pueblo.',
    reference: 'Ester 4:14-16',
    suggestedSec: 35,
    evaluationType: 'auto_choice',
    options: ['Rut', 'Débora', 'Ester', 'Miriam'],
    correctIndex: 2,
    guideAnswer: 'La reina Ester, puesta por Dios "para esta hora".',
  },
  {
    id: 'sr-per-3',
    categoryId: 'personaje_misterioso',
    title: 'El Niño que Escuchó la Voz de Dios',
    instructions:
      'Identifica al personaje: 1) Su madre Ana oró fervientemente por él y lo consagró al templo. 2) Vivió bajo el cuidado del sacerdote Elí. 3) Respondió de noche: "Habla, porque tu siervo oye".',
    reference: '1 Samuel 3:1-10',
    suggestedSec: 35,
    evaluationType: 'auto_choice',
    options: ['Isaías', 'Samuel', 'Josías', 'Timoteo'],
    correctIndex: 1,
    guideAnswer: 'El profeta Samuel desde su niñez escuchó el llamado de Dios.',
  },
  {
    id: 'sr-per-4',
    categoryId: 'personaje_misterioso',
    title: 'El Apóstol de los Gentiles',
    instructions:
      'Adivina al personaje: 1) Antes se llamaba Saulo y era de Tarso. 2) Tuvo un encuentro glorioso con Jesús camino a Damasco. 3) Escribió gran parte de las cartas del Nuevo Testamento.',
    reference: 'Hechos 9:1-20',
    suggestedSec: 30,
    evaluationType: 'auto_choice',
    options: ['Pedro', 'Bernabé', 'Pablo', 'Esteban'],
    correctIndex: 2,
    guideAnswer: 'El apóstol Pablo.',
  },

  // 4. REPRESENTACIÓN BÍBLICA
  {
    id: 'sr-rep-1',
    categoryId: 'representacion_biblica',
    title: 'Zaqueo en el Árbol de Sicómoro',
    instructions:
      'Representa con gestos y expresión corporal (puedes pedir 1 o 2 voluntarios si estás en grupo) a Zaqueo abriéndose paso entre la multitud, subiendo al árbol y recibiendo a Jesús con alegría.',
    reference: 'Lucas 19:1-10',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Evaluar creatividad, claridad de la escena y aplicación alegre del pasaje.',
  },
  {
    id: 'sr-rep-2',
    categoryId: 'representacion_biblica',
    title: 'La Tempestad Calmada',
    instructions:
      'Actúa la escena de los discípulos en la barca remando en medio de la tormenta, despertando a Jesús y el momento de paz absoluta cuando Él dice: "¡Calla, enmudece!".',
    reference: 'Marcos 4:35-41',
    suggestedSec: 70,
    evaluationType: 'director_review',
    guideAnswer: 'Escena corta en vivo con contraste claro entre la tormenta y la calma.',
  },
  {
    id: 'sr-rep-3',
    categoryId: 'representacion_biblica',
    title: 'Mímica: El Buen Samaritano',
    instructions:
      'Sin pronunciar palabras, representa la compasión del buen samaritano auxiliando al hombre herido en el camino mientras otros pasaron de largo.',
    reference: 'Lucas 10:30-37',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Mímica expresiva; la congregación o equipos pueden comentar la enseñanza al cerrar.',
  },
  {
    id: 'sr-rep-4',
    categoryId: 'representacion_biblica',
    title: 'Gedeón y las Antorchas',
    instructions:
      'Representa en 45 segundos la estrategia de los 300 valientes de Gedeón con sus cántaros, antorchas escondidas y trompetas proclamando la victoria de Dios.',
    reference: 'Jueces 7:16-21',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Representación dinámica de obediencia y valentía.',
  },

  // 5. DESAFÍO RELÁMPAGO
  {
    id: 'sr-rel-1',
    categoryId: 'desafio_relampago',
    title: '5 Libros del Nuevo Testamento en 15s',
    instructions:
      'Sin mirar tu Biblia ni el celular, nombra en voz alta o escribe 5 cartas escritas por el apóstol Pablo antes de que el cronómetro llegue a cero.',
    reference: 'Romanos – Filemón',
    suggestedSec: 25,
    evaluationType: 'director_review',
    guideAnswer: 'Ejemplos válidos: Romanos, 1 Corintios, 2 Corintios, Gálatas, Efesios, Filipenses, Colosenses, 1-2 Tesalonicenses, 1-2 Timoteo, Tito, Filemón.',
  },
  {
    id: 'sr-rel-2',
    categoryId: 'desafio_relampago',
    title: 'Carrera Bíblica: Salmos 119:105',
    instructions:
      '¡Desafío relámpago con Biblia en mano! El primero o equipo que encuentre Salmos 119:105 y lo lea en voz alta con energía gana el reto.',
    reference: 'Salmos 119:105',
    suggestedSec: 25,
    evaluationType: 'director_review',
    guideAnswer: '"Lámpara es a mis pies tu palabra, y lumbrera a mi camino."',
  },
  {
    id: 'sr-rel-3',
    categoryId: 'desafio_relampago',
    title: 'Orden Relámpago: Los 4 Evangelios',
    instructions:
      'Menciona de corrido los primeros 5 libros del Nuevo Testamento en orden exacto sin equivocarte.',
    reference: 'Mateo – Hechos',
    suggestedSec: 20,
    evaluationType: 'director_review',
    guideAnswer: 'Mateo, Marcos, Lucas, Juan y Hechos de los Apóstoles.',
  },
  {
    id: 'sr-rel-4',
    categoryId: 'desafio_relampago',
    title: '3 Milagros de Jesús en 20 Segundos',
    instructions:
      'Di rápidamente 3 milagros distintos que realizó Jesús en los Evangelios y dónde ocurrieron si lo recuerdas.',
    reference: 'Evangelios',
    suggestedSec: 25,
    evaluationType: 'director_review',
    guideAnswer: 'Por ejemplo: multiplicación de panes, sanidad del ciego Bartimeo, resurrección de Lázaro, caminar sobre el mar.',
  },

  // 6. REFLEXIÓN ESPIRITUAL
  {
    id: 'sr-rfx-1',
    categoryId: 'reflexion_espiritual',
    title: 'Luz en el Colegio, Universidad o Trabajo',
    instructions:
      'Lee Mateo 5:14-16 ("Vosotros sois la luz del mundo") y comparte en 45 segundos una manera concreta en la que un joven cristiano brilla esta semana ante sus compañeros.',
    reference: 'Mateo 5:14-16',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Se valora claridad práctica, honestidad, servicio o respeto hacia los demás.',
  },
  {
    id: 'sr-rfx-2',
    categoryId: 'reflexion_espiritual',
    title: 'Cuidar el Corazón Más que Nada',
    instructions:
      'Reflexiona brevemente sobre Proverbios 4:23 ("Sobre toda cosa guardada, guarda tu corazón"). ¿Qué hábitos ayudan a un joven a cuidar su mente y corazón hoy?',
    reference: 'Proverbios 4:23',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Oración diaria, lectura bíblica, buenas amistades y contenido sano.',
  },
  {
    id: 'sr-rfx-3',
    categoryId: 'reflexion_espiritual',
    title: 'Fidelidad en lo Poco',
    instructions:
      '¿Por qué crees que Dios valora tanto las pequeñas acciones diarias de obediencia antes de confiarnos responsabilidades mayores?',
    reference: 'Lucas 16:10',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'La constancia diaria forja el carácter cristiano auténtico.',
  },
  {
    id: 'sr-rfx-4',
    categoryId: 'reflexion_espiritual',
    title: 'Renovar las Fuerzas en Dios',
    instructions:
      'Comparte una palabra de ánimo inspirada en Isaías 40:31 para alguien que haya tenido una semana agotadora.',
    reference: 'Isaías 40:31',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Los que esperan en Jehová tendrán nuevas fuerzas y levantarán alas como las águilas.',
  },

  // 7. TESTIMONIO
  {
    id: 'sr-tes-1',
    categoryId: 'testimonio',
    title: 'Una Oración Contestada',
    instructions:
      'Comparte brevemente una ocasión en tu vida (o en tu familia) en la que Dios respondió una oración de forma especial y fortaleció tu fe.',
    reference: 'Salmos 66:16',
    suggestedSec: 75,
    evaluationType: 'director_review',
    guideAnswer: 'Testimonio edificante centrado en la fidelidad y bondad de Dios.',
  },
  {
    id: 'sr-tes-2',
    categoryId: 'testimonio',
    title: 'Un Versículo que Cambió mi Semana',
    instructions:
      'Cuenta qué versículo o promesa bíblica te dio paz en un momento difícil y por qué te marcó tanto.',
    reference: 'Salmos 119:50',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Breve relato personal conectado a una enseñanza bíblica.',
  },
  {
    id: 'sr-tes-3',
    categoryId: 'testimonio',
    title: 'Motivo de Gratitud Hoy',
    instructions:
      'Menciona 3 cosas concretas por las cuales le das gracias a Dios en este sábado y anima a otro hermano a agradecer también.',
    reference: '1 Tesalonicenses 5:18',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Actitud de gratitud y gozo contagioso en la Sociedad de Jóvenes.',
  },
  {
    id: 'sr-tes-4',
    categoryId: 'testimonio',
    title: 'Cómo Conocí el Amor de Jesús',
    instructions:
      'Resume en un minuto quién fue el instrumento que Dios usó (familia, amigo, campamento, iglesia) para acercarte a Cristo.',
    reference: 'Marcos 5:19',
    suggestedSec: 75,
    evaluationType: 'director_review',
    guideAnswer: 'Gratitud por la comunidad cristiana y llamado a ser luz para otros.',
  },

  // 8. RETO EN PAREJA
  {
    id: 'sr-par-1',
    categoryId: 'reto_pareja',
    title: 'Lectura Alternada y Enseñanza Dúo',
    instructions:
      'En pareja, uno lee en voz alta Proverbios 27:17 ("Hierro con hierro se aguza") y el otro explica en 20 segundos qué significa ser una buena amistad cristiana.',
    reference: 'Proverbios 27:17',
    suggestedSec: 50,
    evaluationType: 'director_review',
    guideAnswer: 'Ambos participan en sincronía explicando el valor de edificar a nuestros amigos.',
  },
  {
    id: 'sr-par-2',
    categoryId: 'reto_pareja',
    title: 'Diálogo Bíblico Improvisado',
    instructions:
      'Uno asume el papel de Rut y el otro de Noemí (o David y Jonatán) y representan en 35 segundos un diálogo de lealtad y fe en Dios.',
    reference: 'Rut 1:16',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: '"Tu pueblo será mi pueblo, y tu Dios será mi Dios."',
  },
  {
    id: 'sr-par-3',
    categoryId: 'reto_pareja',
    title: 'Oración Mutua de Bendición',
    instructions:
      'En pareja, pregúntense brevemente un motivo de oración para esta semana y hagan una oración corta de 20 segundos pidiendo bendición uno por el otro.',
    reference: 'Eclesiastés 4:9-10',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Mejores son dos que uno; fortalece la comunión juvenil.',
  },
  {
    id: 'sr-par-4',
    categoryId: 'reto_pareja',
    title: 'Adivinanza Bíblica en Dúo',
    instructions:
      'Un integrante describe un objeto bíblico (ej: arca, honda de David, lámpara, pez) sin decir su nombre mientras su pareja tiene 30 segundos para adivinarlo.',
    reference: '1 Samuel 17 / Mateo 25',
    suggestedSec: 45,
    evaluationType: 'director_review',
    guideAnswer: 'Comunicación ágil, limpia y divertida entre la pareja.',
  },

  // 9. COMPETENCIA ENTRE EQUIPOS
  {
    id: 'sr-eqp-1',
    categoryId: 'competencia_equipos',
    title: 'Cadena Alfabeto Bíblico por Equipos',
    instructions:
      'Cada equipo dice o escribe personajes bíblicos en orden alfabético (A: Abraham, B: Bernabé, C: Caleb...) hasta donde logren llegar antes del tiempo límite.',
    reference: 'Hebreos 11',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Gana el equipo que avance más letras correctamente sin repetir personajes.',
  },
  {
    id: 'sr-eqp-2',
    categoryId: 'competencia_equipos',
    title: 'Coro Temático Grupal',
    instructions:
      'Cada equipo tiene 45 segundos para ponerse de pie y cantar al unísono un coro cristiano sobre la fidelidad o el amor de Dios sin repetir el de otro equipo.',
    reference: 'Salmos 95:1',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Se evalúa coordinación, ánimo y participación de todos los integrantes.',
  },
  {
    id: 'sr-eqp-3',
    categoryId: 'competencia_equipos',
    title: 'Relevo de Citas de Ánimo',
    instructions:
      'Cada equipo reúne 3 versículos de ánimo o promesa (de memoria o con Biblia) y 3 miembros distintos pasan a declararlos en menos de 60 segundos.',
    reference: 'Josué 1:9 / Salmos 46:1',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Trabajo en equipo para buscar, recordar y proclamar la Palabra.',
  },
  {
    id: 'sr-eqp-4',
    categoryId: 'competencia_equipos',
    title: 'Escena Congelada Bíblica',
    instructions:
      'Todo el equipo forma una "estatua humana" de un pasaje bíblico (como Daniel en el foso de los leones o Jesús bendiciendo a los niños) y los demás adivinan la historia.',
    reference: 'Daniel 6 / Marcos 10',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Escena clara y participativa con todo el equipo involucrado.',
  },

  // 10. VERSÍCULO SORPRESA
  {
    id: 'sr-ver-1',
    categoryId: 'versiculo_sorpresa',
    title: 'Completa Filipenses 4:13',
    instructions:
      'Completa exactamente la promesa de Pablo: "Todo lo puedo en _______ que me _______."',
    reference: 'Filipenses 4:13',
    suggestedSec: 25,
    evaluationType: 'auto_choice',
    options: [
      'Cristo / fortalece',
      'la fe / guarda',
      'oración / ilumina',
      'la gracia / bendice',
    ],
    correctIndex: 0,
    guideAnswer: '"Todo lo puedo en Cristo que me fortalece."',
  },
  {
    id: 'sr-ver-2',
    categoryId: 'versiculo_sorpresa',
    title: 'Completa Josué 1:9',
    instructions:
      'Completa el llamado que Dios hizo a Josué: "Mira que te mando que te esfuerces y seas _______; no temas ni _______..."',
    reference: 'Josué 1:9',
    suggestedSec: 25,
    evaluationType: 'auto_choice',
    options: [
      'valiente / desmayes',
      'prudente / vaciles',
      'fuerte / retrocedas',
      'sabio / dudes',
    ],
    correctIndex: 0,
    guideAnswer: '"...esfuérzate y sé valiente; no temas ni desmayes, porque Jehová tu Dios estará contigo."',
  },
  {
    id: 'sr-ver-3',
    categoryId: 'versiculo_sorpresa',
    title: 'Declara Romanos 8:28',
    instructions:
      'Recita de memoria (o léelo y explícalo en una frase) el versículo de Romanos 8:28 sobre el propósito de Dios.',
    reference: 'Romanos 8:28',
    suggestedSec: 40,
    evaluationType: 'director_review',
    guideAnswer: '"Y sabemos que a los que aman a Dios, todas las cosas les ayudan a bien..."',
  },
  {
    id: 'sr-ver-4',
    categoryId: 'versiculo_sorpresa',
    title: 'Completa Jeremías 29:11',
    instructions:
      '¿Qué dice Dios respecto al futuro de Sus hijos en Jeremías 29:11? Completa: "Porque yo sé los pensamientos que tengo acerca de vosotros... pensamientos de ______, y no de mal, para daros el fin que esperáis."',
    reference: 'Jeremías 29:11',
    suggestedSec: 25,
    evaluationType: 'auto_choice',
    options: ['paz', 'riqueza', 'reposo', 'fama'],
    correctIndex: 0,
    guideAnswer: '"...pensamientos de paz, y no de mal, para daros el fin que esperáis."',
  },

  // 11. MISIÓN DE SERVICIO
  {
    id: 'sr-mis-1',
    categoryId: 'mision_servicio',
    title: 'Mensaje de Ánimo a un Joven Ausente',
    instructions:
      'Propón y asume el compromiso (o escríbelo ahora para enviarlo al terminar el culto) de saludar y animar con un texto bíblico a un joven que no pudo asistir hoy.',
    reference: 'Gálatas 6:2',
    suggestedSec: 50,
    evaluationType: 'director_review',
    guideAnswer: 'Acción concreta de cuidado fraternal y amistad cristiana.',
  },
  {
    id: 'sr-mis-2',
    categoryId: 'mision_servicio',
    title: 'Plan Express de Ayuda Comunitaria',
    instructions:
      'Diseña en 45 segundos una idea práctica de servicio que la Sociedad de Jóvenes pueda realizar este mes (ej: visita a enfermos, limpieza del templo, canasta solidaria).',
    reference: 'Mateo 25:35-40',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Propuesta viable, concreta y con fecha o responsables sugeridos.',
  },
  {
    id: 'sr-mis-3',
    categoryId: 'mision_servicio',
    title: 'Oración por Necesidades del Barrio o Iglesia',
    instructions:
      'Menciona dos necesidades reales de tu comunidad o iglesia y dirige una oración breve intercediendo por ellas con fe.',
    reference: 'Santiago 5:16',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Oración intercesora sincera y enfocada en el prójimo.',
  },
  {
    id: 'sr-mis-4',
    categoryId: 'mision_servicio',
    title: 'Desafío de Amabilidad en Casa',
    instructions:
      'Elige un acto concreto de servicio para hacer por tus padres, abuelos o familia esta misma noche al llegar a casa y compártelo aquí.',
    reference: 'Efesios 6:1-2 / Juan 13:14',
    suggestedSec: 45,
    evaluationType: 'director_review',
    guideAnswer: 'Servicio silencioso y amor práctico en el hogar.',
  },

  // 12. ACTIVIDAD DE CREATIVIDAD
  {
    id: 'sr-cre-1',
    categoryId: 'actividad_creatividad',
    title: 'Acróstico Juvenil con la Palabra "FE"',
    instructions:
      'Crea un acróstico o lema corto usando las letras de "F - E" o "J - E - S - Ú - S" que resuma el ánimo de nuestra Sociedad de Jóvenes.',
    reference: 'Hebreos 11:1',
    suggestedSec: 55,
    evaluationType: 'director_review',
    guideAnswer: 'Ejemplo: F = Firmeza en la Palabra, E = Esperanza viva en Cristo.',
  },
  {
    id: 'sr-cre-2',
    categoryId: 'actividad_creatividad',
    title: 'Título de Película para una Historia Bíblica',
    instructions:
      'Inventa un título moderno y atractivo para la historia de David y Goliat (o Daniel en el foso) y explica en una línea su mensaje para los jóvenes.',
    reference: '1 Samuel 17:45',
    suggestedSec: 45,
    evaluationType: 'director_review',
    guideAnswer: 'Título ingenioso y fiel a la enseñanza de confiar en Dios ante los gigantes.',
  },
  {
    id: 'sr-cre-3',
    categoryId: 'actividad_creatividad',
    title: 'Mini Rap o Poema de 4 Versos',
    instructions:
      'Compón 4 líneas rimadas o rítmicas sobre la alegría de caminar con Cristo en la juventud.',
    reference: 'Eclesiastés 12:1',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Rima fresca, respetuosa y edificante.',
  },
  {
    id: 'sr-cre-4',
    categoryId: 'actividad_creatividad',
    title: 'Enseñanza en 60 Segundos con un Objeto',
    instructions:
      'Toma un objeto común que tengas cerca (un celular, una botella de agua, una llave o un cuaderno) y úsalo como ilustración espiritual en menos de 1 minuto.',
    reference: 'Mateo 13:34',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Como las parábolas de Jesús: partir de algo cotidiano hacia una verdad eterna.',
  },
];

export function getSaturdayRouletteCategoryMeta(
  id: SaturdayRouletteCategoryId
): SaturdayRouletteCategoryMeta {
  return (
    SATURDAY_ROULETTE_CATEGORIES.find((c) => c.id === id) ||
    SATURDAY_ROULETTE_CATEGORIES[0]
  );
}
