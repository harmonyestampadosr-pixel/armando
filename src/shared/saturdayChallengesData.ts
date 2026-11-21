export type SaturdayChallengeCategory =
  | 'retos_biblicos'
  | 'representacion'
  | 'creatividad'
  | 'integracion';

export type SaturdayChallengeSubType =
  // 1. Retos Bíblicos (8)
  | 'encuentra_versiculo'
  | 'adivina_personaje'
  | 'completa_historia'
  | 'ordena_acontecimientos'
  | 'descifra_mensaje'
  | 'adivina_parabola'
  | 'identifica_libro'
  | 'explica_texto'
  // 2. Retos de Representación (5)
  | 'representar_historia'
  | 'adivinar_escena'
  | 'actuar_sin_hablar'
  | 'representar_personaje'
  | 'dramatizacion_equipo'
  // 3. Retos de Creatividad (4)
  | 'crear_lema'
  | 'inventar_historia_versiculo'
  | 'dibujar_personaje'
  | 'ensenanza_un_minuto'
  // 4. Retos de Integración (4)
  | 'conocer_alguien_nuevo'
  | 'reto_con_otro_equipo'
  | 'reflexion_grupal'
  | 'experiencia_positiva';

export type SaturdayParticipationMode =
  | 'individual'
  | 'parejas'
  | 'equipos'
  | 'competencia_general';

export type SaturdayChallengeEvaluationType = 'auto_choice' | 'director_review';

export type SaturdayValidationStatus =
  | 'pending'
  | 'approved'
  | 'featured'
  | 'participation'
  | 'rejected';

export interface SaturdayChallengeItem {
  id: string;
  category: SaturdayChallengeCategory;
  subType: SaturdayChallengeSubType;
  subTypeLabel: string;
  title: string;
  prompt: string;
  instructions: string;
  reference: string;
  suggestedSec: number;
  evaluationType: SaturdayChallengeEvaluationType;
  options?: string[];
  correctIndex?: number;
  guideAnswer?: string;
  recommendedModes: SaturdayParticipationMode[];
  isCustom?: boolean;
  isFavorite?: boolean;
}

export interface SaturdayChallengeHistoryEntry {
  id: string;
  challengeId: string;
  challengeTitle: string;
  category: SaturdayChallengeCategory;
  subTypeLabel: string;
  participationMode: SaturdayParticipationMode;
  executedAt: number;
  roomCode?: string;
  roomTitle?: string;
  participantCount: number;
  winnerName: string;
  winnerScore: number;
  resultSummary: string;
  directorNote?: string;
}

export interface SaturdayChallengeSubmissionView {
  participantId: string;
  participantName: string;
  avatarId: string;
  photoUrl?: string;
  teamId?: string;
  submittedText?: string;
  selectedIndex?: number;
  completedSignal?: boolean;
  isAutoCorrect?: boolean;
  validationStatus: SaturdayValidationStatus;
  pointsAwarded: number;
  responseTimeMs: number;
}

export interface SaturdayChallengeRoomView {
  id: string;
  category: SaturdayChallengeCategory;
  subType: SaturdayChallengeSubType;
  subTypeLabel: string;
  title: string;
  prompt: string;
  instructions: string;
  suggestedSec: number;
  evaluationType: SaturdayChallengeEvaluationType;
  options?: string[];
  correctIndex?: number;
  reference?: string;
  guideAnswer?: string;
}

export interface SaturdayChallengeRoomState {
  currentIndex: number;
  totalChallenges: number;
  participationMode: SaturdayParticipationMode;
  currentChallenge: SaturdayChallengeRoomView | null;
  mySubmission: SaturdayChallengeSubmissionView | null;
  submissions: SaturdayChallengeSubmissionView[];
  usedChallengeIds: string[];
}

export const SATURDAY_CHALLENGE_CATEGORIES: Record<
  SaturdayChallengeCategory,
  {
    id: SaturdayChallengeCategory;
    label: string;
    shortDesc: string;
    badgeClass: string;
    borderClass: string;
    accentHex: string;
  }
> = {
  retos_biblicos: {
    id: 'retos_biblicos',
    label: 'Retos Bíblicos',
    shortDesc:
      'Versículos, personajes, historias, orden cronológico, mensajes cifrados, parábolas y libros.',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-400/40',
    borderClass: 'border-amber-400/35',
    accentHex: '#F59E0B',
  },
  representacion: {
    id: 'representacion',
    label: 'Retos de Representación',
    shortDesc:
      'Mímica sin hablar, actuaciones bíblicas, escenas para adivinar y dramatizaciones en equipo.',
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-400/40',
    borderClass: 'border-sky-400/35',
    accentHex: '#0EA5E9',
  },
  creatividad: {
    id: 'creatividad',
    label: 'Retos de Creatividad',
    shortDesc:
      'Lemas bíblicos, historias originales, dibujos rápidos de personajes y micro-enseñanzas.',
    badgeClass: 'bg-violet-500/15 text-violet-300 border-violet-400/40',
    borderClass: 'border-violet-400/35',
    accentHex: '#8B5CF6',
  },
  integracion: {
    id: 'integracion',
    label: 'Retos de Integración',
    shortDesc:
      'Conocer a alguien nuevo, alianzas entre equipos, reflexión grupal y experiencias positivas.',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40',
    borderClass: 'border-emerald-400/35',
    accentHex: '#10B981',
  },
};

export const SATURDAY_CHALLENGE_SUBTYPES: Array<{
  id: SaturdayChallengeSubType;
  category: SaturdayChallengeCategory;
  label: string;
}> = [
  // 1. Retos Bíblicos
  { id: 'encuentra_versiculo', category: 'retos_biblicos', label: 'Encuentra el versículo' },
  { id: 'adivina_personaje', category: 'retos_biblicos', label: 'Adivina el personaje' },
  { id: 'completa_historia', category: 'retos_biblicos', label: 'Completa la historia' },
  { id: 'ordena_acontecimientos', category: 'retos_biblicos', label: 'Ordena los acontecimientos' },
  { id: 'descifra_mensaje', category: 'retos_biblicos', label: 'Descifra el mensaje' },
  { id: 'adivina_parabola', category: 'retos_biblicos', label: 'Adivina la parábola' },
  { id: 'identifica_libro', category: 'retos_biblicos', label: 'Identifica el libro bíblico' },
  { id: 'explica_texto', category: 'retos_biblicos', label: 'Explica el texto con tus propias palabras' },
  // 2. Representación
  { id: 'representar_historia', category: 'representacion', label: 'Representar una historia bíblica' },
  { id: 'adivinar_escena', category: 'representacion', label: 'Adivinar una escena' },
  { id: 'actuar_sin_hablar', category: 'representacion', label: 'Actuar sin hablar' },
  { id: 'representar_personaje', category: 'representacion', label: 'Representar un personaje' },
  { id: 'dramatizacion_equipo', category: 'representacion', label: 'Crear una dramatización en equipo' },
  // 3. Creatividad
  { id: 'crear_lema', category: 'creatividad', label: 'Crear un lema bíblico' },
  { id: 'inventar_historia_versiculo', category: 'creatividad', label: 'Inventar una historia basada en un versículo' },
  { id: 'dibujar_personaje', category: 'creatividad', label: 'Dibujar un personaje' },
  { id: 'ensenanza_un_minuto', category: 'creatividad', label: 'Crear una enseñanza en un minuto' },
  // 4. Integración
  { id: 'conocer_alguien_nuevo', category: 'integracion', label: 'Conocer a alguien nuevo' },
  { id: 'reto_con_otro_equipo', category: 'integracion', label: 'Resolver un reto con otro equipo' },
  { id: 'reflexion_grupal', category: 'integracion', label: 'Presentar una reflexión grupal' },
  { id: 'experiencia_positiva', category: 'integracion', label: 'Compartir una experiencia positiva' },
];

export const PARTICIPATION_MODE_META: Record<
  SaturdayParticipationMode,
  { id: SaturdayParticipationMode; label: string; shortDesc: string }
> = {
  individual: {
    id: 'individual',
    label: 'Individual',
    shortDesc: 'Cada joven participa y suma puntos por cuenta propia.',
  },
  parejas: {
    id: 'parejas',
    label: 'Parejas',
    shortDesc: 'Dúos colaborando en tiempo real y acumulando puntos en pareja.',
  },
  equipos: {
    id: 'equipos',
    label: 'Equipos',
    shortDesc: 'Grupos con nombre y color compitiendo por el marcador colectivo.',
  },
  competencia_general: {
    id: 'competencia_general',
    label: 'Competencia general',
    shortDesc: 'Toda la Sociedad de Jóvenes compite simultáneamente en una gran sala.',
  },
};

export const BUILTIN_SATURDAY_CHALLENGES: SaturdayChallengeItem[] = [
  // ==================== 1. RETOS BÍBLICOS ====================
  // Encuentra el versículo
  {
    id: 'rs-bib-enc-1',
    category: 'retos_biblicos',
    subType: 'encuentra_versiculo',
    subTypeLabel: 'Encuentra el versículo',
    title: 'Esgrima Bíblica: "Esfuérzate y sé valiente"',
    prompt: '¿Dónde dice exactamente: "Mira que te mando que te esfuerces y seas valiente; no temas ni desmayes..."?',
    instructions: 'Encuentra la cita en tu Biblia física o selecciona la referencia correcta antes de que acabe el tiempo.',
    reference: 'Josué 1:9',
    suggestedSec: 35,
    evaluationType: 'auto_choice',
    options: ['Josué 1:9', 'Deuteronomio 31:8', 'Salmos 27:1', 'Isaías 41:10'],
    correctIndex: 0,
    guideAnswer: 'Josué 1:9 — Palabras de Dios a Josué al asumir el liderazgo hacia la tierra prometida.',
    recommendedModes: ['individual', 'parejas', 'equipos', 'competencia_general'],
  },
  {
    id: 'rs-bib-enc-2',
    category: 'retos_biblicos',
    subType: 'encuentra_versiculo',
    subTypeLabel: 'Encuentra el versículo',
    title: 'Búsqueda Relámpago: "Todo lo puedo en Cristo"',
    prompt: 'Localiza la cita bíblica exacta del versículo: "Todo lo puedo en Cristo que me fortalece".',
    instructions: 'Si juegan con Biblias en mano, el primero en hallarlo se pone de pie y lee el versículo completo.',
    reference: 'Filipenses 4:13',
    suggestedSec: 30,
    evaluationType: 'auto_choice',
    options: ['Efesios 6:10', 'Filipenses 4:13', '2 Timoteo 1:7', 'Romanos 8:37'],
    correctIndex: 1,
    guideAnswer: 'Filipenses 4:13 — Escrito por Pablo desde prisión, enseñando el contentamiento en Cristo.',
    recommendedModes: ['individual', 'parejas', 'equipos', 'competencia_general'],
  },
  {
    id: 'rs-bib-enc-3',
    category: 'retos_biblicos',
    subType: 'encuentra_versiculo',
    subTypeLabel: 'Encuentra el versículo',
    title: 'Carrera al Salmo de la Juventud',
    prompt: '¿En qué cita se pregunta: "¿Con qué limpiará el joven su camino? Con guardar tu palabra"?',
    instructions: 'Encuentra el Salmo y el versículo exacto.',
    reference: 'Salmos 119:9',
    suggestedSec: 40,
    evaluationType: 'auto_choice',
    options: ['Salmos 23:3', 'Proverbios 3:5', 'Salmos 119:9', 'Eclesiastés 12:1'],
    correctIndex: 2,
    guideAnswer: 'Salmos 119:9 — Inicio de la sección "Bet" del salmo más largo de la Biblia.',
    recommendedModes: ['individual', 'parejas', 'equipos', 'competencia_general'],
  },

  // Adivina el personaje
  {
    id: 'rs-bib-per-1',
    category: 'retos_biblicos',
    subType: 'adivina_personaje',
    subTypeLabel: 'Adivina el personaje',
    title: 'El Joven de la Túnica y los Sueños',
    prompt: 'Fui vendido por mis propios hermanos, serví fielmente en Egipto, resistí la tentación y llegué a ser gobernador para salvar a mi familia del hambre.',
    instructions: 'Identifica al personaje bíblico lo más rápido posible.',
    reference: 'Génesis 37–45',
    suggestedSec: 30,
    evaluationType: 'auto_choice',
    options: ['Daniel', 'José', 'Samuel', 'David'],
    correctIndex: 1,
    guideAnswer: 'José, hijo de Jacob.',
    recommendedModes: ['individual', 'parejas', 'equipos', 'competencia_general'],
  },
  {
    id: 'rs-bib-per-2',
    category: 'retos_biblicos',
    subType: 'adivina_personaje',
    subTypeLabel: 'Adivina el personaje',
    title: 'Valentía Real: "Y si perezco, que perezca"',
    prompt: 'Huérfana criada por mi primo Mardoqueo, llegué a ser reina y arriesgué mi vida presentándome ante el rey sin ser llamada para salvar a mi pueblo.',
    instructions: 'Elige el personaje bíblico que pronunció esa valiente decisión.',
    reference: 'Ester 4:16',
    suggestedSec: 30,
    evaluationType: 'auto_choice',
    options: ['Rut', 'Débora', 'Ester', 'Abigail'],
    correctIndex: 2,
    guideAnswer: 'La reina Ester.',
    recommendedModes: ['individual', 'parejas', 'equipos', 'competencia_general'],
  },
  {
    id: 'rs-bib-per-3',
    category: 'retos_biblicos',
    subType: 'adivina_personaje',
    subTypeLabel: 'Adivina el personaje',
    title: 'Discípulo Joven de Listra',
    prompt: 'Mi madre Eunice y mi abuela Loida me enseñaron las Escrituras desde niño; acompañé a Pablo y recibí el consejo: "Ninguno tenga en poco tu juventud".',
    instructions: 'Descubre de qué joven líder de la iglesia primitiva se trata.',
    reference: '1 Timoteo 4:12 / 2 Timoteo 1:5',
    suggestedSec: 30,
    evaluationType: 'auto_choice',
    options: ['Tito', 'Timoteo', 'Bernabé', 'Silas'],
    correctIndex: 1,
    guideAnswer: 'Timoteo.',
    recommendedModes: ['individual', 'parejas', 'equipos', 'competencia_general'],
  },

  // Completa la historia
  {
    id: 'rs-bib-com-1',
    category: 'retos_biblicos',
    subType: 'completa_historia',
    subTypeLabel: 'Completa la historia',
    title: 'Los Tres Jóvenes en Babilonia',
    prompt: 'Cuando Sadrac, Mesac y Abed-nego se negaron a adorar la estatua de oro, el rey ordenó calentar el horno siete veces más, pero al mirar adentro vio...',
    instructions: 'Completa el desenlace fiel de la historia.',
    reference: 'Daniel 3:24-25',
    suggestedSec: 35,
    evaluationType: 'auto_choice',
    options: [
      'Que el fuego se apagó al instante antes de abrirse la puerta.',
      'A cuatro varones sueltos paseando en medio del fuego sin sufrir daño.',
      'Un ángel llevándolos fuera de la ciudad en una nube.',
      'Que la estatua cayó derribada por un viento fuerte.',
    ],
    correctIndex: 1,
    guideAnswer: 'El rey vio a cuatro hombres sueltos caminando en el fuego, y el cuarto era semejante a hijo de los dioses.',
    recommendedModes: ['individual', 'parejas', 'equipos', 'competencia_general'],
  },
  {
    id: 'rs-bib-com-2',
    category: 'retos_biblicos',
    subType: 'completa_historia',
    subTypeLabel: 'Completa la historia',
    title: 'Cinco Panes y Dos Peces',
    prompt: 'Un muchacho entregó cinco panes de cebada y dos pececillos a Jesús. Después de alimentar a más de cinco mil personas, los discípulos recogieron...',
    instructions: 'Selecciona exactamente cuántas cestas sobraron.',
    reference: 'Juan 6:9-13',
    suggestedSec: 30,
    evaluationType: 'auto_choice',
    options: [
      'Siete canastas llenas de pedazos.',
      'Tres bolsas grandes de cebada.',
      'Doce cestas llenas de los pedazos que sobraron.',
      'No sobró nada porque todo se repartió por igual.',
    ],
    correctIndex: 2,
    guideAnswer: 'Recogieron doce cestas llenas de los pedazos que sobraron.',
    recommendedModes: ['individual', 'parejas', 'equipos', 'competencia_general'],
  },
  {
    id: 'rs-bib-com-3',
    category: 'retos_biblicos',
    subType: 'completa_historia',
    subTypeLabel: 'Completa la historia',
    title: 'El Joven Eutico en Troas',
    prompt: 'Mientras Pablo hablaba hasta la medianoche, un joven llamado Eutico se durmió en una ventana del tercer piso, cayó... y ¿cómo terminó la historia?',
    instructions: 'Recuerda lo sucedido en Hechos capítulo 20.',
    reference: 'Hechos 20:9-12',
    suggestedSec: 35,
    evaluationType: 'auto_choice',
    options: [
      'Pablo bajó, lo abrazó y Dios lo devolvió a la vida, consolando a toda la iglesia.',
      'Se fracturó un brazo y tuvieron que suspender la reunión.',
      'Lucio lo llevó a casa en una camilla sin poder volver.',
      'Cayeron las lámparas y salieron todos corriendo.',
    ],
    correctIndex: 0,
    guideAnswer: 'Pablo se echó sobre él, lo abrazó y dijo que su alma estaba en él; llevaron al joven vivo y fueron consolados.',
    recommendedModes: ['individual', 'parejas', 'equipos', 'competencia_general'],
  },

  // Ordena los acontecimientos
  {
    id: 'rs-bib-ord-1',
    category: 'retos_biblicos',
    subType: 'ordena_acontecimientos',
    subTypeLabel: 'Ordena los acontecimientos',
    title: 'Línea de Tiempo del Éxodo',
    prompt: '¿Cuál es el orden cronológico correcto de estos eventos en la vida de Moisés?',
    instructions: 'Analiza los 4 momentos y elige la secuencia exacta de principio a fin.',
    reference: 'Éxodo 2 – 20',
    suggestedSec: 40,
    evaluationType: 'auto_choice',
    options: [
      'Zarza ardiente → Paso del Mar Rojo → Diez Mandamientos en Sinaí → Cesta en el Nilo',
      'Cesta en el Nilo → Zarza ardiente → Paso del Mar Rojo → Diez Mandamientos en Sinaí',
      'Cesta en el Nilo → Paso del Mar Rojo → Zarza ardiente → Diez Mandamientos en Sinaí',
      'Zarza ardiente → Cesta en el Nilo → Paso del Mar Rojo → Diez Mandamientos en Sinaí',
    ],
    correctIndex: 1,
    guideAnswer: '1) Cesta en el Nilo (Éxodo 2), 2) Zarza ardiente (Éxodo 3), 3) Paso del Mar Rojo (Éxodo 14), 4) Diez Mandamientos (Éxodo 20).',
    recommendedModes: ['individual', 'parejas', 'equipos', 'competencia_general'],
  },
  {
    id: 'rs-bib-ord-2',
    category: 'retos_biblicos',
    subType: 'ordena_acontecimientos',
    subTypeLabel: 'Ordena los acontecimientos',
    title: 'Del Llamado al Triunfo de David',
    prompt: 'Ordena correctamente los siguientes acontecimientos en la historia de David:',
    instructions: 'Identifica la secuencia cronológica verdadera.',
    reference: '1 Samuel 16 – 2 Samuel 5',
    suggestedSec: 40,
    evaluationType: 'auto_choice',
    options: [
      'Unción por Samuel → Derrota a Goliat → Amistad con Jonatán → Rey de todo Israel',
      'Derrota a Goliat → Unción por Samuel → Rey de todo Israel → Amistad con Jonatán',
      'Amistad con Jonatán → Unción por Samuel → Derrota a Goliat → Rey de todo Israel',
      'Unción por Samuel → Rey de todo Israel → Derrota a Goliat → Amistad con Jonatán',
    ],
    correctIndex: 0,
    guideAnswer: 'Samuel unge a David (1 Sam 16), vence a Goliat (1 Sam 17), pacta con Jonatán (1 Sam 18) y luego reina en Jerusalén (2 Sam 5).',
    recommendedModes: ['individual', 'parejas', 'equipos', 'competencia_general'],
  },
  {
    id: 'rs-bib-ord-3',
    category: 'retos_biblicos',
    subType: 'ordena_acontecimientos',
    subTypeLabel: 'Ordena los acontecimientos',
    title: 'Camino de la Iglesia Primitiva',
    prompt: '¿En qué orden ocurrieron estos hechos registrados en el libro de los Hechos?',
    instructions: 'Selecciona la línea de tiempo correcta.',
    reference: 'Hechos 1 – 9',
    suggestedSec: 40,
    evaluationType: 'auto_choice',
    options: [
      'Conversión de Saulo → Pentecostés → Martirio de Esteban → Ascensión de Jesús',
      'Ascensión de Jesús → Pentecostés → Martirio de Esteban → Conversión de Saulo',
      'Pentecostés → Ascensión de Jesús → Conversión de Saulo → Martirio de Esteban',
      'Ascensión de Jesús → Martirio de Esteban → Pentecostés → Conversión de Saulo',
    ],
    correctIndex: 1,
    guideAnswer: 'Ascensión (Hch 1) → Pentecostés (Hch 2) → Esteban (Hch 7) → Conversión de Saulo camino a Damasco (Hch 9).',
    recommendedModes: ['individual', 'parejas', 'equipos', 'competencia_general'],
  },

  // Descifra el mensaje
  {
    id: 'rs-bib-des-1',
    category: 'retos_biblicos',
    subType: 'descifra_mensaje',
    subTypeLabel: 'Descifra el mensaje',
    title: 'Código Iniciales: L-D-M-P',
    prompt: 'Descifra este mensaje bíblico oculto leyendo solo las iniciales de cuatro palabras de Salmos 119:105: "L__ es a mis pies tu palabra, y L__ a mi camino". ¿Cuál es la frase completa?',
    instructions: 'Observa las claves "Lámpara" y "Lumbrera" y selecciona la respuesta exacta.',
    reference: 'Salmos 119:105',
    suggestedSec: 35,
    evaluationType: 'auto_choice',
    options: [
      'Luz es a mis pies tu palabra, y Libertad a mi camino.',
      'Lámpara es a mis pies tu palabra, y lumbrera a mi camino.',
      'Ley es a mis pies tu palabra, y límite a mi camino.',
      'Lluvia es a mis pies tu palabra, y alegría a mi camino.',
    ],
    correctIndex: 1,
    guideAnswer: 'Lámpara es a mis pies tu palabra, y lumbrera a mi camino (Salmos 119:105).',
    recommendedModes: ['individual', 'parejas', 'equipos', 'competencia_general'],
  },
  {
    id: 'rs-bib-des-2',
    category: 'retos_biblicos',
    subType: 'descifra_mensaje',
    subTypeLabel: 'Descifra el mensaje',
    title: 'Mensaje Cifrado en Babilonia',
    prompt: '¿Qué significaba en esencia el mensaje misterioso escrito en la pared durante el banquete del rey Belsasar ("MENE, MENE, TEKEL, UPARSIN")?',
    instructions: 'Descifra la interpretación que Daniel dio con sabiduría de Dios.',
    reference: 'Daniel 5:25-28',
    suggestedSec: 40,
    evaluationType: 'auto_choice',
    options: [
      'Contado fue tu reino, pesado fuiste en balanza y hallado falto, y tu reino ha sido dividido.',
      'Construirás un nuevo templo en setenta días de paz.',
      'Vendrán siete años de abundancia seguidos de siete de escasez.',
      'Tu ejército vencerá antes del amanecer si oras tres veces.',
    ],
    correctIndex: 0,
    guideAnswer: 'MENE (contó Dios tu reino), TEKEL (pesado fuiste en balanza y hallado falto), PERES (roto/dividido a medos y persas).',
    recommendedModes: ['individual', 'parejas', 'equipos', 'competencia_general'],
  },
  {
    id: 'rs-bib-des-3',
    category: 'retos_biblicos',
    subType: 'descifra_mensaje',
    subTypeLabel: 'Descifra el mensaje',
    title: 'Clave Numérica del Fruto',
    prompt: 'Descifra qué versículo resume los 9 rasgos del Fruto del Espíritu si el código dice: "A-G-P-P-B-B-F-M-T" (Amor, Gozo, Paz, Paciencia, Benignidad, Bondad, Fe, Mansedumbre, Templanza). ¿En qué libro y capítulo está?',
    instructions: 'Identifica la cita exacta del código.',
    reference: 'Gálatas 5:22-23',
    suggestedSec: 35,
    evaluationType: 'auto_choice',
    options: ['1 Corintios 13:4-7', 'Gálatas 5:22-23', 'Efesios 4:2-3', 'Colosenses 3:12-14'],
    correctIndex: 1,
    guideAnswer: 'Gálatas 5:22-23.',
    recommendedModes: ['individual', 'parejas', 'equipos', 'competencia_general'],
  },

  // Adivina la parábola
  {
    id: 'rs-bib-par-1',
    category: 'retos_biblicos',
    subType: 'adivina_parabola',
    subTypeLabel: 'Adivina la parábola',
    title: 'Cuatro Terrenos y Una Semilla',
    prompt: 'Jesús contó sobre un hombre que salió a sembrar; parte cayó junto al camino, parte en pedregales, parte entre espinos y parte en buena tierra que dio fruto al ciento por uno.',
    instructions: 'Identifica el nombre de esta parábola de Jesús.',
    reference: 'Mateo 13:3-23',
    suggestedSec: 30,
    evaluationType: 'auto_choice',
    options: [
      'La parábola del grano de mostaza',
      'La parábola del sembrador',
      'La parábola del trigo y la cizaña',
      'La parábola de los obreros de la viña',
    ],
    correctIndex: 1,
    guideAnswer: 'La parábola del sembrador.',
    recommendedModes: ['individual', 'parejas', 'equipos', 'competencia_general'],
  },
  {
    id: 'rs-bib-par-2',
    category: 'retos_biblicos',
    subType: 'adivina_parabola',
    subTypeLabel: 'Adivina la parábola',
    title: 'El Prójimo Inesperado en el Camino',
    prompt: 'Un viajero herido quedó medio muerto entre Jerusalén y Jericó. Dos líderes religiosos pasaron de largo, pero un extranjero se detuvo, vendó sus heridas y pagó su cuidado.',
    instructions: 'Adivina qué parábola enseña quién es nuestro prójimo.',
    reference: 'Lucas 10:30-37',
    suggestedSec: 30,
    evaluationType: 'auto_choice',
    options: [
      'El buen samaritano',
      'El hijo pródigo',
      'La oveja perdida',
      'El siervo vigilante',
    ],
    correctIndex: 0,
    guideAnswer: 'La parábola del buen samaritano.',
    recommendedModes: ['individual', 'parejas', 'equipos', 'competencia_general'],
  },
  {
    id: 'rs-bib-par-3',
    category: 'retos_biblicos',
    subType: 'adivina_parabola',
    subTypeLabel: 'Adivina la parábola',
    title: 'Dos Cimientos Frente a la Tormenta',
    prompt: 'Al cerrar el Sermón del Monte, Jesús comparó a quien oye y hace sus palabras con un hombre prudente, y a quien las oye y no las hace con un insensato. ¿Qué construyeron ambos?',
    instructions: 'Adivina esta parábola sobre la obediencia.',
    reference: 'Mateo 7:24-27',
    suggestedSec: 30,
    evaluationType: 'auto_choice',
    options: [
      'Los dos deudores',
      'Los dos hijos en la viña',
      'La casa sobre la roca y sobre la arena',
      'Las diez vírgenes',
    ],
    correctIndex: 2,
    guideAnswer: 'La parábola de los dos cimientos (casa sobre la roca y casa sobre la arena).',
    recommendedModes: ['individual', 'parejas', 'equipos', 'competencia_general'],
  },

  // Identifica el libro bíblico
  {
    id: 'rs-bib-lib-1',
    category: 'retos_biblicos',
    subType: 'identifica_libro',
    subTypeLabel: 'Identifica el libro bíblico',
    title: 'El Libro de la Sabiduría Práctica',
    prompt: '"Fíate de Jehová de todo tu corazón, y no te apoyes en tu propia prudencia. Reconócelo en todos tus caminos, y él enderezará tus veredas." ¿A qué libro pertenece?',
    instructions: 'Identifica el libro bíblico exacto.',
    reference: 'Proverbios 3:5-6',
    suggestedSec: 30,
    evaluationType: 'auto_choice',
    options: ['Salmos', 'Proverbios', 'Eclesiastés', 'Job'],
    correctIndex: 1,
    guideAnswer: 'Proverbios (3:5-6).',
    recommendedModes: ['individual', 'parejas', 'equipos', 'competencia_general'],
  },
  {
    id: 'rs-bib-lib-2',
    category: 'retos_biblicos',
    subType: 'identifica_libro',
    subTypeLabel: 'Identifica el libro bíblico',
    title: 'Fe Sin Obras y Lengua Controlada',
    prompt: 'Este breve libro del Nuevo Testamento contiene capítulos famosos sobre pedir sabiduría a Dios, refrenar la lengua y demostrar la fe con obras de amor.',
    instructions: 'Selecciona el libro correcto.',
    reference: 'Santiago 1 – 3',
    suggestedSec: 30,
    evaluationType: 'auto_choice',
    options: ['Hebreos', '1 Pedro', 'Santiago', '1 Juan'],
    correctIndex: 2,
    guideAnswer: 'Epístola universal de Santiago.',
    recommendedModes: ['individual', 'parejas', 'equipos', 'competencia_general'],
  },
  {
    id: 'rs-bib-lib-3',
    category: 'retos_biblicos',
    subType: 'identifica_libro',
    subTypeLabel: 'Identifica el libro bíblico',
    title: 'Reconstrucción en 52 Días',
    prompt: 'Relata cómo un copero del rey regresó a Jerusalén con oración, liderazgo y trabajo en equipo para reedificar los muros en medio de oposición.',
    instructions: '¿Qué libro histórico del Antiguo Testamento narra esta hazaña?',
    reference: 'Nehemías 1 – 6',
    suggestedSec: 30,
    evaluationType: 'auto_choice',
    options: ['Esdras', 'Nehemías', 'Hageo', 'Crónicas'],
    correctIndex: 1,
    guideAnswer: 'El libro de Nehemías.',
    recommendedModes: ['individual', 'parejas', 'equipos', 'competencia_general'],
  },

  // Explica el texto con tus propias palabras
  {
    id: 'rs-bib-exp-1',
    category: 'retos_biblicos',
    subType: 'explica_texto',
    subTypeLabel: 'Explica el texto con tus propias palabras',
    title: 'Luz y Sal en el Mundo Juvenil',
    prompt: '"Vosotros sois la sal de la tierra... Vosotros sois la luz del mundo; una ciudad asentada sobre un monte no se puede esconder" (Mateo 5:13-14).',
    instructions: 'Explica en 30 segundos (por escrito en tu celular o al micrófono) cómo aplica este versículo en el colegio, universidad o trabajo.',
    reference: 'Mateo 5:13-16',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Validar claridad bíblica y aplicación práctica: influir con buen carácter, servicio e integridad sin esconder la fe.',
    recommendedModes: ['individual', 'parejas', 'equipos', 'competencia_general'],
  },
  {
    id: 'rs-bib-exp-2',
    category: 'retos_biblicos',
    subType: 'explica_texto',
    subTypeLabel: 'Explica el texto con tus propias palabras',
    title: 'Ejemplo en Seis Áreas',
    prompt: '"Ninguno tenga en poco tu juventud, sino sé ejemplo de los creyentes en palabra, conducta, amor, espíritu, fe y pureza" (1 Timoteo 4:12).',
    instructions: 'Explica con tus propias palabras dos de esas áreas y un ejemplo concreto para esta semana.',
    reference: '1 Timoteo 4:12',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Validar comprensión fiel del versículo y honestidad práctica para la vida cotidiana del joven.',
    recommendedModes: ['individual', 'parejas', 'equipos', 'competencia_general'],
  },
  {
    id: 'rs-bib-exp-3',
    category: 'retos_biblicos',
    subType: 'explica_texto',
    subTypeLabel: 'Explica el texto con tus propias palabras',
    title: 'Renovar la Mente Hoy',
    prompt: '"No os conforméis a este siglo, sino transformaos por medio de la renovación de vuestro entendimiento..." (Romanos 12:2).',
    instructions: 'Resume el significado de este texto con palabras sencillas para alguien de tu edad.',
    reference: 'Romanos 12:2',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'No copiar automáticamente las modas/valores contrarios a Dios; dejar que Su Palabra moldee criterios y decisiones.',
    recommendedModes: ['individual', 'parejas', 'equipos', 'competencia_general'],
  },

  // ==================== 2. RETOS DE REPRESENTACIÓN ====================
  // Representar una historia bíblica
  {
    id: 'rs-rep-his-1',
    category: 'representacion',
    subType: 'representar_historia',
    subTypeLabel: 'Representar una historia bíblica',
    title: 'El Cruce del Mar Rojo en 60 Segundos',
    prompt: 'Representen en escena el momento en que Moisés extiende su vara, el mar se abre en dos y el pueblo cruza agradeciendo a Dios.',
    instructions: 'Participan los jóvenes asignados usando creatividad con objetos simples o formación humana. El director evalúa entrega y fidelidad bíblica.',
    reference: 'Éxodo 14:21-31',
    suggestedSec: 75,
    evaluationType: 'director_review',
    guideAnswer: 'Pueden formar dos filas que se abren como muros de agua mientras cruza el pueblo con alegría.',
    recommendedModes: ['parejas', 'equipos', 'competencia_general'],
  },
  {
    id: 'rs-rep-his-2',
    category: 'representacion',
    subType: 'representar_historia',
    subTypeLabel: 'Representar una historia bíblica',
    title: 'Los Amigos del Techo en Capernaúm',
    prompt: 'Actúen la escena de los cuatro amigos que abrieron el techo para bajar a su amigo paralítico delante de Jesús.',
    instructions: 'Resalten la fe perseverante y el trabajo en equipo. ¡El director valida la representación!',
    reference: 'Marcos 2:1-12',
    suggestedSec: 75,
    evaluationType: 'director_review',
    guideAnswer: 'Mostrar el esfuerzo coordinado de los amigos y la compasión restauradora de Jesús.',
    recommendedModes: ['parejas', 'equipos', 'competencia_general'],
  },
  {
    id: 'rs-rep-his-3',
    category: 'representacion',
    subType: 'representar_historia',
    subTypeLabel: 'Representar una historia bíblica',
    title: 'Zaqueo Sube al Sicómoro',
    prompt: 'Escenifiquen a Zaqueo abriéndose paso entre la multitud, subiendo al árbol y bajando apresurado para recibir a Jesús en su casa.',
    instructions: 'Representación breve, alegre y expresiva frente a la sala.',
    reference: 'Lucas 19:1-10',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Mostrar el cambio de corazón de Zaqueo y la alegría del encuentro con Jesús.',
    recommendedModes: ['individual', 'parejas', 'equipos'],
  },

  // Adivinar una escena
  {
    id: 'rs-rep-esc-1',
    category: 'representacion',
    subType: 'adivinar_escena',
    subTypeLabel: 'Adivinar una escena',
    title: 'Escena Secreta: La Pesca Milagrosa',
    prompt: 'Un participante o equipo recibe en privado la escena "La pesca milagrosa de Lucas 5" y debe representarla para que los demás adivinen el relato.',
    instructions: 'Los demás escriben en su celular o levantan la mano para decir la escena exacta; el director valida aciertos.',
    reference: 'Lucas 5:4-11',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Lanzar redes vacías toda la noche → obedecer la palabra de Jesús → redes llenas a punto de romperse.',
    recommendedModes: ['individual', 'parejas', 'equipos', 'competencia_general'],
  },
  {
    id: 'rs-rep-esc-2',
    category: 'representacion',
    subType: 'adivinar_escena',
    subTypeLabel: 'Adivinar una escena',
    title: 'Escena Secreta: La Zarza Ardiente',
    prompt: 'Representen el asombro de Moisés quitándose el calzado frente a una zarza que arde pero no se consume.',
    instructions: 'Los observadores adivinan el pasaje bíblico y su mensaje central.',
    reference: 'Éxodo 3:1-6',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Moisés ante la zarza ardiente en Horeb.',
    recommendedModes: ['individual', 'parejas', 'equipos'],
  },
  {
    id: 'rs-rep-esc-3',
    category: 'representacion',
    subType: 'adivinar_escena',
    subTypeLabel: 'Adivinar una escena',
    title: 'Escena Secreta: Muros de Jericó',
    prompt: 'Representen la marcha silenciosa por seis días y el toque de trompetas con grito de victoria al séptimo día.',
    instructions: 'Adivinen qué escena bíblica está siendo interpretada.',
    reference: 'Josué 6:12-20',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'La toma de Jericó por obediencia y fe.',
    recommendedModes: ['parejas', 'equipos', 'competencia_general'],
  },

  // Actuar sin hablar (mímica)
  {
    id: 'rs-rep-mim-1',
    category: 'representacion',
    subType: 'actuar_sin_hablar',
    subTypeLabel: 'Actuar sin hablar',
    title: 'Mímica Silenciosa: David y la Honda',
    prompt: 'Sin pronunciar ninguna palabra ni sonido, actúa cómo David escogió cinco piedras lisas del arroyo, giró la honda y venció al gigante.',
    instructions: 'Cero palabras. Si habla, se reinicia. El director valida cuando el grupo o pareja adivina.',
    reference: '1 Samuel 17:40-49',
    suggestedSec: 45,
    evaluationType: 'director_review',
    guideAnswer: 'Mímica clara de recoger piedras, usar la honda y celebrar con las manos en alto.',
    recommendedModes: ['individual', 'parejas', 'equipos'],
  },
  {
    id: 'rs-rep-mim-2',
    category: 'representacion',
    subType: 'actuar_sin_hablar',
    subTypeLabel: 'Actuar sin hablar',
    title: 'Mímica Silenciosa: Jonás y el Gran Pez',
    prompt: 'Actúa únicamente con gestos corporales: huir en barco, dormir en la tormenta, ser lanzado al mar y orar dentro del gran pez.',
    instructions: 'Solo lenguaje corporal y expresiones faciales.',
    reference: 'Jonás 1 – 2',
    suggestedSec: 50,
    evaluationType: 'director_review',
    guideAnswer: 'Jonás en la tormenta y el gran pez.',
    recommendedModes: ['individual', 'parejas', 'equipos'],
  },
  {
    id: 'rs-rep-mim-3',
    category: 'representacion',
    subType: 'actuar_sin_hablar',
    subTypeLabel: 'Actuar sin hablar',
    title: 'Mímica Silenciosa: Pedro Camina Sobre el Agua',
    prompt: 'Representa sin palabras remar en la barca de noche, salir a caminar sobre las olas mirando a Jesús, dudar al ver el viento y ser tomado de la mano.',
    instructions: '¡Expresa el miedo y la fe sin hablar!',
    reference: 'Mateo 14:25-31',
    suggestedSec: 45,
    evaluationType: 'director_review',
    guideAnswer: 'Jesús rescata a Pedro caminando sobre el mar.',
    recommendedModes: ['individual', 'parejas', 'equipos'],
  },

  // Representar un personaje
  {
    id: 'rs-rep-per-1',
    category: 'representacion',
    subType: 'representar_personaje',
    subTypeLabel: 'Representar un personaje',
    title: 'Entrevista en Vivo con Noé',
    prompt: 'Un participante asume el papel de Noé respondiendo dos preguntas del director sobre cómo fue construir el arca cuando nadie creía que llovería.',
    instructions: 'Mantente en personaje con respeto, buen humor y base bíblica.',
    reference: 'Génesis 6:14-22',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Destacar la obediencia perseverante de Noé aunque otros se burlaran.',
    recommendedModes: ['individual', 'parejas', 'equipos'],
  },
  {
    id: 'rs-rep-per-2',
    category: 'representacion',
    subType: 'representar_personaje',
    subTypeLabel: 'Representar un personaje',
    title: 'Monólogo Breve de Rut la Moabita',
    prompt: 'Representa el momento en que Rut decide acompañar a Noemí diciendo: "Tu pueblo será mi pueblo, y tu Dios será mi Dios".',
    instructions: 'Expresa con convicción lealtad y amor familiar en 30 segundos.',
    reference: 'Rut 1:16-17',
    suggestedSec: 45,
    evaluationType: 'director_review',
    guideAnswer: 'Lealtad, humildad y fe en el Dios de Israel.',
    recommendedModes: ['individual', 'parejas'],
  },
  {
    id: 'rs-rep-per-3',
    category: 'representacion',
    subType: 'representar_personaje',
    subTypeLabel: 'Representar un personaje',
    title: 'Testimonio de Pablo en Prisión',
    prompt: 'Interpreta al apóstol Pablo cantando himnos a Dios a medianoche junto a Silas mientras los demás presos escuchan.',
    instructions: 'Representar el gozo en medio de la prueba.',
    reference: 'Hechos 16:25-31',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Alabanza genuina en la adversidad que abre puertas de salvación.',
    recommendedModes: ['individual', 'parejas', 'equipos'],
  },

  // Crear una dramatización en equipo
  {
    id: 'rs-rep-dra-1',
    category: 'representacion',
    subType: 'dramatizacion_equipo',
    subTypeLabel: 'Crear una dramatización en equipo',
    title: 'Parábola Moderna del Buen Samaritano',
    prompt: 'Creen una mini-dramatización de 1 minuto adaptando el Buen Samaritano a una situación escolar, laboral o juvenil actual.',
    instructions: 'Todos los integrantes deben tener un papel breve (narra, ayuda, pasa de largo o agradece).',
    reference: 'Lucas 10:30-37',
    suggestedSec: 90,
    evaluationType: 'director_review',
    guideAnswer: 'Compasión práctica frente a la indiferencia en la vida diaria de los jóvenes.',
    recommendedModes: ['equipos', 'parejas', 'competencia_general'],
  },
  {
    id: 'rs-rep-dra-2',
    category: 'representacion',
    subType: 'dramatizacion_equipo',
    subTypeLabel: 'Crear una dramatización en equipo',
    title: 'El Regreso del Hijo Pródigo en Escena',
    prompt: 'Dramaticen en equipo el abrazo del padre, la bienvenida festiva y el mensaje sobre la gracia de Dios.',
    instructions: 'Organicen los personajes rápido y presenten la escena con claridad.',
    reference: 'Lucas 15:20-24',
    suggestedSec: 90,
    evaluationType: 'director_review',
    guideAnswer: 'El amor incondicional de Dios que recibe al que vuelve arrepentido.',
    recommendedModes: ['equipos', 'competencia_general'],
  },
  {
    id: 'rs-rep-dra-3',
    category: 'representacion',
    subType: 'dramatizacion_equipo',
    subTypeLabel: 'Crear una dramatización en equipo',
    title: 'Armadura de Dios en Acción',
    prompt: 'Escenifiquen en equipo a un joven poniéndose cada pieza de la armadura de Dios antes de enfrentar presiones diarias.',
    instructions: 'Cada integrante representa una pieza (verdad, justicia, paz, fe, salvación, Palabra).',
    reference: 'Efesios 6:13-17',
    suggestedSec: 90,
    evaluationType: 'director_review',
    guideAnswer: 'Identificar correctamente al menos 4 piezas de Efesios 6 aplicadas a la vida juvenil.',
    recommendedModes: ['equipos', 'parejas'],
  },

  // ==================== 3. RETOS DE CREATIVIDAD ====================
  // Crear un lema bíblico
  {
    id: 'rs-cre-lem-1',
    category: 'creatividad',
    subType: 'crear_lema',
    subTypeLabel: 'Crear un lema bíblico',
    title: 'Lema Juvenil de Valentía',
    prompt: 'Crea un lema corto (máximo 10 palabras), pegadizo y cristiano inspirado en Josué 1:9 para la Sociedad de Jóvenes.',
    instructions: 'Escríbelo en tu dispositivo o compártelo en voz alta; el director premiará originalidad y fidelidad bíblica.',
    reference: 'Josué 1:9',
    suggestedSec: 45,
    evaluationType: 'director_review',
    guideAnswer: 'Ejemplo: "Sin miedo al gigante: Dios camina delante de nosotros".',
    recommendedModes: ['individual', 'parejas', 'equipos', 'competencia_general'],
  },
  {
    id: 'rs-cre-lem-2',
    category: 'creatividad',
    subType: 'crear_lema',
    subTypeLabel: 'Crear un lema bíblico',
    title: 'Slogan de Amistad y Unidad',
    prompt: 'Inventa un lema juvenil basado en Eclesiastés 4:9-10 ("Mejores son dos que uno") o Juan 13:34.',
    instructions: 'Envía tu lema antes de que termine el cronómetro.',
    reference: 'Eclesiastés 4:9-10',
    suggestedSec: 45,
    evaluationType: 'director_review',
    guideAnswer: 'Buscar rima o impacto positivo que invite a apoyarse mutuamente en Cristo.',
    recommendedModes: ['individual', 'parejas', 'equipos', 'competencia_general'],
  },
  {
    id: 'rs-cre-lem-3',
    category: 'creatividad',
    subType: 'crear_lema',
    subTypeLabel: 'Crear un lema bíblico',
    title: 'Lema Misionero Juvenil',
    prompt: 'Redacta una frase lema para animar a los jóvenes a compartir el evangelio esta semana basada en Isaías 6:8 ("Heme aquí, envíame a mí").',
    instructions: 'Breve, directo y memorable.',
    reference: 'Isaías 6:8',
    suggestedSec: 45,
    evaluationType: 'director_review',
    guideAnswer: 'Lema centrado en disponibilidad y servicio con alegría.',
    recommendedModes: ['individual', 'parejas', 'equipos', 'competencia_general'],
  },

  // Inventar una historia basada en un versículo
  {
    id: 'rs-cre-his-1',
    category: 'creatividad',
    subType: 'inventar_historia_versiculo',
    subTypeLabel: 'Inventar una historia basada en un versículo',
    title: 'Micro-Cuento de la Respuesta Blanda',
    prompt: 'Inventa una breve historia cotidiana (3 a 5 líneas) donde se cumpla Proverbios 15:1: "La blanda respuesta quita la ira".',
    instructions: 'Escríbela o cuéntala en 45 segundos con un inicio, conflicto resuelto en paz y enseñanza.',
    reference: 'Proverbios 15:1',
    suggestedSec: 75,
    evaluationType: 'director_review',
    guideAnswer: 'Situación real (ej. desacuerdo en clase o redes) resuelta con calma y respeto.',
    recommendedModes: ['individual', 'parejas', 'equipos'],
  },
  {
    id: 'rs-cre-his-2',
    category: 'creatividad',
    subType: 'inventar_historia_versiculo',
    subTypeLabel: 'Inventar una historia basada en un versículo',
    title: 'Historia de Confianza en Tormenta',
    prompt: 'Crea un relato breve inspirado en Salmos 56:3 ("En el día que temo, yo en ti confío") sobre un joven que vence una preocupación.',
    instructions: 'Comparte el relato destacando el papel de la oración.',
    reference: 'Salmos 56:3',
    suggestedSec: 75,
    evaluationType: 'director_review',
    guideAnswer: 'Mostrar cómo orar y confiar en Dios cambia el ánimo ante un examen, cambio o dificultad.',
    recommendedModes: ['individual', 'parejas', 'equipos'],
  },
  {
    id: 'rs-cre-his-3',
    category: 'creatividad',
    subType: 'inventar_historia_versiculo',
    subTypeLabel: 'Inventar una historia basada en un versículo',
    title: 'Relato del Dar con Alegría',
    prompt: 'Inventa una historia corta ilustrando Hechos 20:35: "Más bienaventurado es dar que recibir".',
    instructions: 'Participa individualmente o en pareja armando la historia.',
    reference: 'Hechos 20:35',
    suggestedSec: 75,
    evaluationType: 'director_review',
    guideAnswer: 'Generosidad voluntaria y el gozo que produce bendecir a alguien más.',
    recommendedModes: ['individual', 'parejas', 'equipos'],
  },

  // Dibujar un personaje
  {
    id: 'rs-cre-dib-1',
    category: 'creatividad',
    subType: 'dibujar_personaje',
    subTypeLabel: 'Dibujar un personaje',
    title: 'Retrato Express: Sansón',
    prompt: 'En 45 segundos, dibuja en papel o pizarra a Sansón con pistas visuales claras (cabello largo, columnas, fuerza) sin escribir letras ni números.',
    instructions: 'Muestra tu dibujo al grupo o cámara para que adivinen y el director valide.',
    reference: 'Jueces 16:17-30',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Prohibido escribir palabras; usar solo dibujo simbólico.',
    recommendedModes: ['individual', 'parejas', 'equipos'],
  },
  {
    id: 'rs-cre-dib-2',
    category: 'creatividad',
    subType: 'dibujar_personaje',
    subTypeLabel: 'Dibujar un personaje',
    title: 'Retrato Express: Daniel y los Leones',
    prompt: 'Dibuja en tiempo récord a Daniel orando rodeado de leones tranquilos.',
    instructions: 'Sin letras. El primer equipo o participante en lograr que adivinen gana puntos extra.',
    reference: 'Daniel 6:16-22',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Dibujo claro sin texto.',
    recommendedModes: ['individual', 'parejas', 'equipos'],
  },
  {
    id: 'rs-cre-dib-3',
    category: 'creatividad',
    subType: 'dibujar_personaje',
    subTypeLabel: 'Dibujar un personaje',
    title: 'Retrato Express: Juan el Bautista',
    prompt: 'Dibuja pistas visuales de Juan el Bautista junto al río Jordán bautizando y predicando en el desierto.',
    instructions: '45–60 segundos de dibujo libre sin escribir nombres.',
    reference: 'Mateo 3:1-6',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Río, paloma o desierto como señales visuales.',
    recommendedModes: ['individual', 'parejas', 'equipos'],
  },
  {
    id: 'rs-cre-dib-4',
    category: 'creatividad',
    subType: 'dibujar_personaje',
    subTypeLabel: 'Dibujar un personaje',
    title: 'Retrato Express: Elías en el Monte Carmelo',
    prompt: 'Dibuja un altar de piedras, agua alrededor y fuego descendiendo del cielo para representar al profeta Elías.',
    instructions: 'Dibuja sin usar palabras y espera la validación del director.',
    reference: '1 Reyes 18:30-38',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Altar + agua + fuego del cielo = Elías.',
    recommendedModes: ['individual', 'parejas', 'equipos'],
  },

  // Crear una enseñanza en un minuto
  {
    id: 'rs-cre-ens-1',
    category: 'creatividad',
    subType: 'ensenanza_un_minuto',
    subTypeLabel: 'Crear una enseñanza en un minuto',
    title: 'Devocional Express: Filipenses 4:6-7',
    prompt: 'Prepara y presenta en 60 segundos una enseñanza práctica sobre vencer la ansiedad mediante la oración y la gratitud.',
    instructions: 'Estructura sugerida: 1) Idea clave, 2) Versículo, 3) Un paso práctico para mañana.',
    reference: 'Filipenses 4:6-7',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Claridad, tono alentador y fidelidad al texto bíblico.',
    recommendedModes: ['individual', 'parejas', 'equipos'],
  },
  {
    id: 'rs-cre-ens-2',
    category: 'creatividad',
    subType: 'ensenanza_un_minuto',
    subTypeLabel: 'Crear una enseñanza en un minuto',
    title: 'Micro-Enseñanza: Cuidar Nuestras Palabras',
    prompt: 'Comparte en máximo 1 minuto por qué las palabras pueden construir o herir según Efesios 4:29.',
    instructions: 'Enfócate en cómo hablamos en persona y en grupos de chat.',
    reference: 'Efesios 4:29',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Hablar para edificar y dar gracia a los oyentes.',
    recommendedModes: ['individual', 'parejas', 'equipos'],
  },
  {
    id: 'rs-cre-ens-3',
    category: 'creatividad',
    subType: 'ensenanza_un_minuto',
    subTypeLabel: 'Crear una enseñanza en un minuto',
    title: 'Micro-Enseñanza: El Valor de la Sabiduría',
    prompt: 'Explica en un minuto cómo aplicar Santiago 1:5 ("Si alguno tiene falta de sabiduría, pídala a Dios") al tomar decisiones juveniles.',
    instructions: 'Puede enviarse en resumen escrito o exponerse frente a la sala.',
    reference: 'Santiago 1:5',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Acudir a Dios antes de decidir estudios, amistades o proyectos.',
    recommendedModes: ['individual', 'parejas', 'equipos'],
  },

  // ==================== 4. RETOS DE INTEGRACIÓN ====================
  // Conocer a alguien nuevo
  {
    id: 'rs-int-con-1',
    category: 'integracion',
    subType: 'conocer_alguien_nuevo',
    subTypeLabel: 'Conocer a alguien nuevo',
    title: 'Puente de Amistad Cristiana',
    prompt: 'Acércate a alguien con quien casi no hayas conversado hoy, pregúntale su nombre, cuál es su libro o historia bíblica favorita y qué comida le alegra el día.',
    instructions: 'Regresa o escribe en tu teléfono qué historia bíblica le gusta a tu nuevo amigo (solo primer nombre, sin datos sensibles).',
    reference: 'Romanos 15:7',
    suggestedSec: 75,
    evaluationType: 'director_review',
    guideAnswer: 'Fomentar hospitalidad sincera, respeto y trato amable hacia visitantes o nuevos jóvenes.',
    recommendedModes: ['individual', 'parejas', 'competencia_general'],
  },
  {
    id: 'rs-int-con-2',
    category: 'integracion',
    subType: 'conocer_alguien_nuevo',
    subTypeLabel: 'Conocer a alguien nuevo',
    title: 'Tres Cosas en Común en Cristo',
    prompt: 'Forma pareja o trío con alguien fuera de tu círculo habitual y descubran en 60 segundos 3 intereses sanos o metas positivas que tengan en común.',
    instructions: 'Compártanlo brevemente con alegría y marquen el reto completado.',
    reference: 'Salmos 133:1',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Destacar gustos saludables (música, deporte, estudio, versículo favorito, servicio).',
    recommendedModes: ['individual', 'parejas', 'competencia_general'],
  },
  {
    id: 'rs-int-con-3',
    category: 'integracion',
    subType: 'conocer_alguien_nuevo',
    subTypeLabel: 'Conocer a alguien nuevo',
    title: 'Saludo de Ánimo y Oración Breve',
    prompt: 'Saluda a un compañero diferente, pregúntale por una meta positiva para esta semana y dile una palabra de ánimo bíblica.',
    instructions: 'Respetuoso, breve y edificante; marca tu reto completado para validación.',
    reference: '1 Tesalonicenses 5:11',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: '"Animaos unos a otros, y edificaos unos a otros".',
    recommendedModes: ['individual', 'parejas', 'competencia_general'],
  },

  // Resolver un reto con otro equipo
  {
    id: 'rs-int-eqp-1',
    category: 'integracion',
    subType: 'reto_con_otro_equipo',
    subTypeLabel: 'Resolver un reto con otro equipo',
    title: 'Alianza Bíblica: 5 Libros de Sabiduría y 4 Evangelios',
    prompt: 'Dos equipos (o parejas) se unen por 60 segundos para escribir o recitar juntos en orden los 5 libros poéticos/sapienciales y los 4 Evangelios.',
    instructions: 'Solo ganan los puntos si ambos grupos participan juntos de forma coordinada.',
    reference: 'Job – Cantares / Mateo – Juan',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Job, Salmos, Proverbios, Eclesiastés, Cantares + Mateo, Marcos, Lucas, Juan.',
    recommendedModes: ['parejas', 'equipos', 'competencia_general'],
  },
  {
    id: 'rs-int-eqp-2',
    category: 'integracion',
    subType: 'reto_con_otro_equipo',
    subTypeLabel: 'Resolver un reto con otro equipo',
    title: 'Puente Entre Equipos: Acróstico "JOVEN"',
    prompt: 'Únanse con otro equipo para crear en 1 minuto un acróstico cristiano con las letras J-O-V-E-N usando valores bíblicos.',
    instructions: 'Un integrante de cada equipo presenta la mitad del acróstico.',
    reference: 'Colosenses 3:12-14',
    suggestedSec: 75,
    evaluationType: 'director_review',
    guideAnswer: 'Ejemplo: Justo, Obediente, Valiente, Esforzado, Noble.',
    recommendedModes: ['parejas', 'equipos', 'competencia_general'],
  },
  {
    id: 'rs-int-eqp-3',
    category: 'integracion',
    subType: 'reto_con_otro_equipo',
    subTypeLabel: 'Resolver un reto con otro equipo',
    title: 'Desafío Unido: Tres Milagros y Su Lección',
    prompt: 'En alianza con otro equipo, nombren 3 milagros distintos de Jesús y expliquen en una frase qué enseña cada uno sobre Su corazón.',
    instructions: 'Trabajo colaborativo sin rivalidad; el director valida ambos equipos.',
    reference: 'Evangelios',
    suggestedSec: 75,
    evaluationType: 'director_review',
    guideAnswer: 'Ejemplos válidos: multiplicar panes (provisión), calmar la tempestad (paz), sanar al ciego (compasión).',
    recommendedModes: ['parejas', 'equipos', 'competencia_general'],
  },

  // Presentar una reflexión grupal
  {
    id: 'rs-int-ref-1',
    category: 'integracion',
    subType: 'reflexion_grupal',
    subTypeLabel: 'Presentar una reflexión grupal',
    title: 'Mesa Redonda Express: ¿Cómo Vivimos la Fe Hoy?',
    prompt: 'En grupo o pareja, conversen 45 segundos y presenten una sola frase poderosa que responda: "¿Cómo se nota que un joven sigue a Jesús?"',
    instructions: 'Escuchen a todos los integrantes antes de enviar o exponer la conclusión.',
    reference: 'Juan 13:35',
    suggestedSec: 75,
    evaluationType: 'director_review',
    guideAnswer: 'En este conocerán todos que sois mis discípulos, si tuviereis amor los unos con los otros.',
    recommendedModes: ['parejas', 'equipos', 'competencia_general'],
  },
  {
    id: 'rs-int-ref-2',
    category: 'integracion',
    subType: 'reflexion_grupal',
    subTypeLabel: 'Presentar una reflexión grupal',
    title: 'Propósito en Comunidad',
    prompt: 'Reflexionen juntos sobre 1 Corintios 12:12-27 ("un cuerpo, muchos miembros") y presenten dos formas en que distintos talentos se complementan en la iglesia.',
    instructions: 'Incluyan dones diversos (música, bienvenida, enseñanza, apoyo técnico, intercesión).',
    reference: '1 Corintios 12:12-27',
    suggestedSec: 75,
    evaluationType: 'director_review',
    guideAnswer: 'Todos los dones son necesarios y valiosos para edificar la iglesia.',
    recommendedModes: ['parejas', 'equipos', 'competencia_general'],
  },
  {
    id: 'rs-int-ref-3',
    category: 'integracion',
    subType: 'reflexion_grupal',
    subTypeLabel: 'Presentar una reflexión grupal',
    title: 'Decisiones Con Sabiduría',
    prompt: 'Compartan como equipo 3 criterios bíblicos sencillos para elegir buenas amistades, contenido o hábitos saludables.',
    instructions: 'Resumen breve, práctico y respetuoso.',
    reference: 'Salmos 1:1-3 / Proverbios 13:20',
    suggestedSec: 75,
    evaluationType: 'director_review',
    guideAnswer: '¿Me acerca a Dios? ¿Edifica mi carácter? ¿Honra a mi familia y prójimo?',
    recommendedModes: ['parejas', 'equipos', 'competencia_general'],
  },

  // Compartir una experiencia positiva
  {
    id: 'rs-int-exp-1',
    category: 'integracion',
    subType: 'experiencia_positiva',
    subTypeLabel: 'Compartir una experiencia positiva',
    title: 'Motivo de Gratitud de la Semana',
    prompt: 'Comparte en 30 segundos (en persona o escrito en pantalla) una cosa buena por la que das gracias a Dios esta semana.',
    instructions: 'Mantén privacidad: comparte gratitud personal general sin mencionar datos sensibles de terceros.',
    reference: '1 Tesalonicenses 5:18',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Celebrar juntos la fidelidad cotidiana de Dios en estudios, salud, familia o paz.',
    recommendedModes: ['individual', 'parejas', 'equipos', 'competencia_general'],
  },
  {
    id: 'rs-int-exp-2',
    category: 'integracion',
    subType: 'experiencia_positiva',
    subTypeLabel: 'Compartir una experiencia positiva',
    title: 'Un Versículo Que Me Dio Paz',
    prompt: 'Cuéntanos qué promesa bíblica te fortaleció recientemente y cómo te ayudó a mantener la calma o la alegría.',
    instructions: 'Comparte de forma breve y edificante.',
    reference: 'Salmos 119:50',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Fomentar el aprecio por la Palabra como fuente de consuelo real.',
    recommendedModes: ['individual', 'parejas', 'equipos', 'competencia_general'],
  },
  {
    id: 'rs-int-exp-3',
    category: 'integracion',
    subType: 'experiencia_positiva',
    subTypeLabel: 'Compartir una experiencia positiva',
    title: 'Alegría de Servir a Otros',
    prompt: 'Comparte una experiencia positiva ayudando a alguien en casa, en la escuela o en la iglesia, y cómo te hizo sentir.',
    instructions: 'Relato respetuoso sin exponer nombres privados de terceros.',
    reference: 'Gálatas 5:13',
    suggestedSec: 60,
    evaluationType: 'director_review',
    guideAnswer: 'Inspirar a otros jóvenes a practicar el servicio con amor.',
    recommendedModes: ['individual', 'parejas', 'equipos', 'competencia_general'],
  },
];
