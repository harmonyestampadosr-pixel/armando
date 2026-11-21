export type SurpriseCategoryId =
  | 'pregunta_biblica'
  | 'reto_relampago'
  | 'duelo_equipos'
  | 'personaje_misterioso'
  | 'versiculo_sorpresa'
  | 'minuto_testimonios'
  | 'reto_creativo'
  | 'participacion_voluntario'
  | 'reflexion_espiritual'
  | 'actividad_grupal'
  | 'cultura_biblica'
  | 'mision_inesperada';

export type SurpriseResultOutcome =
  | 'destacado'
  | 'cumplido'
  | 'participacion'
  | 'tiempo_agotado';

export interface SurpriseCategoryMeta {
  id: SurpriseCategoryId;
  label: string;
  shortLabel: string;
  color: string;
  badgeClass: string;
  glowClass: string;
  description: string;
  defaultSec: number;
}

export const SURPRISE_CATEGORIES: SurpriseCategoryMeta[] = [
  {
    id: 'pregunta_biblica',
    label: 'Pregunta bíblica',
    shortLabel: 'Pregunta',
    color: '#0EA5E9',
    badgeClass: 'bg-sky-500/15 border-sky-400/50 text-sky-200',
    glowClass: 'from-sky-500/20 to-blue-600/10',
    description: 'Pregunta directa de las Escrituras para responder con claridad.',
    defaultSec: 30,
  },
  {
    id: 'reto_relampago',
    label: 'Reto relámpago',
    shortLabel: 'Relámpago',
    color: '#F43F5E',
    badgeClass: 'bg-rose-500/15 border-rose-400/50 text-rose-200',
    glowClass: 'from-rose-500/20 to-orange-500/10',
    description: 'Desafío de máxima velocidad y agilidad bíblica bajo el reloj.',
    defaultSec: 25,
  },
  {
    id: 'duelo_equipos',
    label: 'Duelo entre equipos',
    shortLabel: 'Duelo',
    color: '#F97316',
    badgeClass: 'bg-orange-500/15 border-orange-400/50 text-orange-200',
    glowClass: 'from-orange-500/20 to-amber-500/10',
    description: 'Enfrentamiento amistoso entre dos bandos o filas del auditorio.',
    defaultSec: 45,
  },
  {
    id: 'personaje_misterioso',
    label: 'Personaje misterioso',
    shortLabel: 'Personaje',
    color: '#8B5CF6',
    badgeClass: 'bg-violet-500/15 border-violet-400/50 text-violet-200',
    glowClass: 'from-violet-500/20 to-indigo-600/10',
    description: 'Adivina el personaje bíblico mediante pistas clave.',
    defaultSec: 40,
  },
  {
    id: 'versiculo_sorpresa',
    label: 'Versículo sorpresa',
    shortLabel: 'Versículo',
    color: '#3B82F6',
    badgeClass: 'bg-blue-500/15 border-blue-400/50 text-blue-200',
    glowClass: 'from-blue-500/20 to-cyan-500/10',
    description: 'Recita, completa o busca una promesa bíblica al instante.',
    defaultSec: 35,
  },
  {
    id: 'minuto_testimonios',
    label: 'Minuto de testimonios',
    shortLabel: 'Testimonios',
    color: '#10B981',
    badgeClass: 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200',
    glowClass: 'from-emerald-500/20 to-teal-500/10',
    description: 'Espacio breve y edificante para agradecer a Dios en público.',
    defaultSec: 60,
  },
  {
    id: 'reto_creativo',
    label: 'Reto creativo',
    shortLabel: 'Creativo',
    color: '#A855F7',
    badgeClass: 'bg-purple-500/15 border-purple-400/50 text-purple-200',
    glowClass: 'from-purple-500/20 to-fuchsia-500/10',
    description: 'Expresa una verdad bíblica con ingenio, arte, mímica o verso.',
    defaultSec: 60,
  },
  {
    id: 'participacion_voluntario',
    label: 'Participación de un voluntario',
    shortLabel: 'Voluntario',
    color: '#F59E0B',
    badgeClass: 'bg-amber-500/15 border-amber-400/50 text-amber-200',
    glowClass: 'from-amber-500/20 to-yellow-500/10',
    description: 'Un joven pasa al frente para liderar o cumplir una encomienda.',
    defaultSec: 45,
  },
  {
    id: 'reflexion_espiritual',
    label: 'Reflexión espiritual',
    shortLabel: 'Reflexión',
    color: '#6366F1',
    badgeClass: 'bg-indigo-500/15 border-indigo-400/50 text-indigo-200',
    glowClass: 'from-indigo-500/20 to-slate-700/20',
    description: 'Pausa profunda para meditar y aplicar la Palabra al corazón.',
    defaultSec: 60,
  },
  {
    id: 'actividad_grupal',
    label: 'Actividad grupal',
    shortLabel: 'Grupal',
    color: '#14B8A6',
    badgeClass: 'bg-teal-500/15 border-teal-400/50 text-teal-200',
    glowClass: 'from-teal-500/20 to-emerald-500/10',
    description: 'Dinámica colectiva donde toda la Sociedad de Jóvenes participa.',
    defaultSec: 75,
  },
  {
    id: 'cultura_biblica',
    label: 'Pregunta de cultura bíblica',
    shortLabel: 'Cultura Bíblica',
    color: '#06B6D4',
    badgeClass: 'bg-cyan-500/15 border-cyan-400/50 text-cyan-200',
    glowClass: 'from-cyan-500/20 to-sky-500/10',
    description: 'Curiosidades, geografía, libros, idiomas y contexto de la Biblia.',
    defaultSec: 35,
  },
  {
    id: 'mision_inesperada',
    label: 'Misión inesperada',
    shortLabel: 'Misión',
    color: '#22C55E',
    badgeClass: 'bg-green-500/15 border-green-400/50 text-green-200',
    glowClass: 'from-green-500/20 to-lime-500/10',
    description: 'Desafío práctico de servicio, ánimo, oración o evangelismo.',
    defaultSec: 60,
  },
];

export function getSurpriseCategoryMeta(
  categoryId: SurpriseCategoryId
): SurpriseCategoryMeta {
  return (
    SURPRISE_CATEGORIES.find((c) => c.id === categoryId) ||
    SURPRISE_CATEGORIES[0]
  );
}

export interface SurpriseItem {
  id: string;
  categoryId: SurpriseCategoryId;
  title: string;
  instructions: string;
  reference: string;
  suggestedSec: number;
  guideHint?: string;
  isCustom?: boolean;
}

export interface SurpriseHistoryEntry {
  id: string;
  surpriseId: string;
  categoryId: SurpriseCategoryId;
  title: string;
  participantName: string;
  outcome: SurpriseResultOutcome;
  pointsAwarded: number;
  durationUsedSec: number;
  note?: string;
  programId?: string;
  programTitle?: string;
  createdAt: number;
}

export const SURPRISE_OUTCOME_META: Record<
  SurpriseResultOutcome,
  { label: string; colorClass: string; defaultPoints: number }
> = {
  destacado: {
    label: '¡Logrado / Destacado!',
    colorClass: 'bg-amber-400/20 border-amber-400/60 text-amber-200',
    defaultPoints: 1000,
  },
  cumplido: {
    label: 'Cumplido con éxito',
    colorClass: 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200',
    defaultPoints: 600,
  },
  participacion: {
    label: 'Participación valiosa',
    colorClass: 'bg-sky-500/20 border-sky-400/60 text-sky-200',
    defaultPoints: 300,
  },
  tiempo_agotado: {
    label: 'Tiempo agotado / Pendiente',
    colorClass: 'bg-slate-700/60 border-slate-600 text-slate-300',
    defaultPoints: 100,
  },
};

export const BUILTIN_SURPRISE_LIBRARY: SurpriseItem[] = [
  // 1. Pregunta bíblica
  {
    id: 'sb-preg-1',
    categoryId: 'pregunta_biblica',
    title: 'Los cinco panes y dos peces',
    instructions:
      '¿Cuántas cestas de pedazos sobrantes recogieron los discípulos después de que Jesús alimentó a los cinco mil hombres? Explica por qué ese detalle demuestra la provisión abundante de Dios.',
    reference: 'Juan 6:11-13',
    suggestedSec: 30,
    guideHint: 'Recogieron 12 cestas llenas (una por cada discípulo/tribu).',
  },
  {
    id: 'sb-preg-2',
    categoryId: 'pregunta_biblica',
    title: 'La armadura de Dios completa',
    instructions:
      'Menciona al menos cuatro piezas de la armadura de Dios descritas por Pablo en Efesios y explica cuál representa la Palabra de Dios.',
    reference: 'Efesios 6:13-17',
    suggestedSec: 35,
    guideHint:
      'Cinturón de verdad, coraza de justicia, calzado del evangelio, escudo de fe, yelmo de salvación y espada del Espíritu (la Palabra de Dios).',
  },
  {
    id: 'sb-preg-3',
    categoryId: 'pregunta_biblica',
    title: 'La fe sin dudar en el mar',
    instructions:
      '¿Qué discípulo caminó sobre las aguas hacia Jesús y qué provocó que comenzara a hundirse?',
    reference: 'Mateo 14:28-31',
    suggestedSec: 25,
    guideHint: 'Pedro; al ver el fuerte viento tuvo miedo y quitó la mirada de Jesús.',
  },
  {
    id: 'sb-preg-4',
    categoryId: 'pregunta_biblica',
    title: 'El primer milagro de Jesús',
    instructions:
      '¿En qué ciudad realizó Jesús su primer milagro público y qué transformó durante aquella celebración?',
    reference: 'Juan 2:1-11',
    suggestedSec: 30,
    guideHint: 'En Caná de Galilea; convirtió el agua en vino nuevo.',
  },

  // 2. Reto relámpago
  {
    id: 'sb-rel-1',
    categoryId: 'reto_relampago',
    title: '7 libros del Nuevo Testamento en 15 segundos',
    instructions:
      'Un participante debe nombrar en voz alta 7 libros del Nuevo Testamento en orden o salteados antes de que termine la cuenta regresiva sin repetir ninguno.',
    reference: '2 Timoteo 3:16',
    suggestedSec: 20,
    guideHint: 'Ej: Mateo, Marcos, Lucas, Juan, Hechos, Romanos, 1 Corintios.',
  },
  {
    id: 'sb-rel-2',
    categoryId: 'reto_relampago',
    title: 'Ráfaga de frutos del Espíritu',
    instructions:
      '¡Sin mirar la Biblia! Enumera los nueve aspectos del fruto del Espíritu descritos en Gálatas antes de que suene el timbre final.',
    reference: 'Gálatas 5:22-23',
    suggestedSec: 25,
    guideHint:
      'Amor, gozo, paz, paciencia, benignidad, bondad, fe, mansedumbre, templanza.',
  },
  {
    id: 'sb-rel-3',
    categoryId: 'reto_relampago',
    title: 'Búsqueda bíblica express',
    instructions:
      'El primer joven en encontrar físicamente o en su Biblia digital el Salmo 121:1-2, ponerse de pie y leerlo en voz alta gana el reto relámpago.',
    reference: 'Salmos 121:1-2',
    suggestedSec: 25,
    guideHint: '“Alzaré mis ojos a los montes; ¿de dónde vendrá mi socorro?...”',
  },
  {
    id: 'sb-rel-4',
    categoryId: 'reto_relampago',
    title: '5 nombres de profetas en 20 segundos',
    instructions:
      'Nombra rápidamente 5 profetas del Antiguo Testamento y menciona al menos un hecho ocurrido en la vida de uno de ellos.',
    reference: 'Amós 3:7',
    suggestedSec: 25,
    guideHint: 'Ej: Isaías, Jeremías, Ezequiel, Daniel, Elías, Eliseo, Jonás.',
  },

  // 3. Duelo entre equipos
  {
    id: 'sb-due-1',
    categoryId: 'duelo_equipos',
    title: 'Ping-Pong de libros de la Biblia',
    instructions:
      'Dos representantes (uno por equipo o por lado del salón) se turnan diciendo un libro de la Biblia sin repetir. Quien tarde más de 4 segundos o repita cede el punto al otro equipo.',
    reference: 'Salmos 119:105',
    suggestedSec: 45,
    guideHint: 'El director cuenta 4 segundos con la mano entre cada turno.',
  },
  {
    id: 'sb-due-2',
    categoryId: 'duelo_equipos',
    title: 'Duelo de himnos y coros',
    instructions:
      'El director dice una palabra bíblica clave (ej: “Gracia”, “Roca”, “Fidelidad”). Cada equipo tiene 10 segundos para cantar al menos 2 líneas de un canto que incluya esa idea.',
    reference: 'Colosenses 3:16',
    suggestedSec: 50,
    guideHint: 'Se alternan rondas rápidas hasta completar el tiempo.',
  },
  {
    id: 'sb-due-3',
    categoryId: 'duelo_equipos',
    title: '¿Antiguo o Nuevo Testamento?',
    instructions:
      'Cada equipo envía 2 jóvenes al frente. El director nombra 6 libros o personajes (ej: Rut, Filemón, Habacuc, Bernabé, Nehemías, Tito) y deben responder al instante a qué Testamento pertenecen.',
    reference: 'Lucas 24:44',
    suggestedSec: 40,
    guideHint: 'Rut (AT), Filemón (NT), Habacuc (AT), Bernabé (NT), Nehemías (AT), Tito (NT).',
  },
  {
    id: 'sb-due-4',
    categoryId: 'duelo_equipos',
    title: 'Relevo de promesas bíblicas',
    instructions:
      'Ambos equipos tienen 45 segundos para escribir o enumerar todas las promesas de Dios que recuerden (con su cita aproximada). Gana quien comparta más promesas claras.',
    reference: '2 Corintios 1:20',
    suggestedSec: 45,
    guideHint: 'Validar que sean citas bíblicas reales y edificantes.',
  },

  // 4. Personaje misterioso
  {
    id: 'sb-per-1',
    categoryId: 'personaje_misterioso',
    title: 'El joven gobernador fiel en tierra extranjera',
    instructions:
      'Pistas: 1) Fui llevado cautivo siendo joven. 2) Decidí no contaminarme con la comida del rey. 3) Oraba tres veces al día junto a mi ventana aunque había un decreto en contra. ¿Quién soy?',
    reference: 'Daniel 1:8; 6:10',
    suggestedSec: 35,
    guideHint: 'Respuesta: Daniel.',
  },
  {
    id: 'sb-per-2',
    categoryId: 'personaje_misterioso',
    title: 'La mujer valiente que habló por su pueblo',
    instructions:
      'Pistas: 1) Mi primo Mardoqueo me crió. 2) Fui elegida reina en Persia. 3) Dije: “Si perezco, que perezca” antes de presentarme sin ser llamada ante el rey. ¿Quién soy?',
    reference: 'Ester 4:14-16',
    suggestedSec: 35,
    guideHint: 'Respuesta: La reina Ester.',
  },
  {
    id: 'sb-per-3',
    categoryId: 'personaje_misterioso',
    title: 'El apóstol consolador que vendió su campo',
    instructions:
      'Pistas: 1) Mi nombre significa “Hijo de consolación”. 2) Presenté a Saulo de Tarso ante los apóstoles cuando todos le temían. 3) Acompañé a Pablo en su primer viaje misionero. ¿Quién soy?',
    reference: 'Hechos 4:36; 9:27',
    suggestedSec: 40,
    guideHint: 'Respuesta: Bernabé.',
  },
  {
    id: 'sb-per-4',
    categoryId: 'personaje_misterioso',
    title: 'El reconstructor de muros con oración y espada',
    instructions:
      'Pistas: 1) Era copero del rey Artajerjes. 2) Lloré al saber que Jerusalén estaba en ruinas. 3) Lideré la reconstrucción de los muros en solo 52 días. ¿Quién soy?',
    reference: 'Nehemías 1:4; 6:15',
    suggestedSec: 35,
    guideHint: 'Respuesta: Nehemías.',
  },

  // 5. Versículo sorpresa
  {
    id: 'sb-ver-1',
    categoryId: 'versiculo_sorpresa',
    title: 'Completa la joya de 1 Timoteo 4:12',
    instructions:
      'Completa en voz alta este versículo para la juventud: “Ninguno tenga en poco tu juventud, sino sé ejemplo de los creyentes en ______, ______, ______, ______, ______ y ______.”',
    reference: '1 Timoteo 4:12',
    suggestedSec: 30,
    guideHint: 'Palabra, conducta, amor, espíritu, fe y pureza.',
  },
  {
    id: 'sb-ver-2',
    categoryId: 'versiculo_sorpresa',
    title: 'Recita Josué 1:9 con convicción',
    instructions:
      'Un participante o todo el grupo recita de memoria Josué 1:9 y comparte en una frase en qué situación actual necesita recordar esa promesa.',
    reference: 'Josué 1:9',
    suggestedSec: 40,
    guideHint:
      '“Mira que te mando que te esfuerces y seas valiente; no temas ni desmayes...”',
  },
  {
    id: 'sb-ver-3',
    categoryId: 'versiculo_sorpresa',
    title: 'El texto oculto en el corazón',
    instructions:
      'Completa el Salmo 119:11: “En mi ______ he guardado tus ______, para no ______ contra ti.” Luego comenta un hábito práctico para memorizar Escritura.',
    reference: 'Salmos 119:11',
    suggestedSec: 35,
    guideHint: 'Corazón / dichos / pecar.',
  },
  {
    id: 'sb-ver-4',
    categoryId: 'versiculo_sorpresa',
    title: 'Todo lo puedo en Cristo',
    instructions:
      'Lee o recita Filipenses 4:13 y explica brevemente qué significa ese versículo dentro de su contexto real (contentamiento tanto en abundancia como en escasez).',
    reference: 'Filipenses 4:11-13',
    suggestedSec: 40,
    guideHint: 'Cristo fortalece al creyente para permanecer fiel en cualquier circunstancia.',
  },

  // 6. Minuto de testimonios
  {
    id: 'sb-tes-1',
    categoryId: 'minuto_testimonios',
    title: 'Una oración contestada recientemente',
    instructions:
      'Dos jóvenes comparten en máximo 30 segundos cada uno una oración que Dios respondió en su vida, familia o estudios durante las últimas semanas.',
    reference: 'Salmos 66:16',
    suggestedSec: 60,
    guideHint: 'Mantener un clima de gratitud, brevedad y edificación.',
  },
  {
    id: 'sb-tes-2',
    categoryId: 'minuto_testimonios',
    title: 'Un versículo que me sostuvo en prueba',
    instructions:
      'Un voluntario comparte brevemente qué pasaje de la Biblia le dio paz en un momento difícil y por qué lo recomienda a otros jóvenes.',
    reference: 'Salmos 119:50',
    suggestedSec: 60,
    guideHint: 'Invitar a dar gloria a Dios por su fidelidad.',
  },
  {
    id: 'sb-tes-3',
    categoryId: 'minuto_testimonios',
    title: 'Gratitud relámpago de la congregación',
    instructions:
      'Durante 60 segundos, cinco jóvenes distintos se ponen de pie por turnos y dicen en una sola frase: “Doy gracias a Dios hoy por...”',
    reference: '1 Tesalonicenses 5:18',
    suggestedSec: 60,
    guideHint: 'Dinámica ágil que involucra varias voces en un minuto.',
  },
  {
    id: 'sb-tes-4',
    categoryId: 'minuto_testimonios',
    title: '¿Cómo llegué a la Sociedad de Jóvenes?',
    instructions:
      'Un joven cuenta en un minuto quién lo invitó o cómo comenzó a crecer espiritualmente dentro de la iglesia.',
    reference: 'Marcos 5:19',
    suggestedSec: 60,
    guideHint: 'Destacar el valor de invitar y acompañar a otros.',
  },

  // 7. Reto creativo
  {
    id: 'sb-cre-1',
    categoryId: 'reto_creativo',
    title: 'Mímica de milagro bíblico',
    instructions:
      'Un participante o pareja representa sin hablar ni hacer sonidos una escena bíblica asignada en secreto por el director (ej: David y Goliat, Jonás, Zaqueo en el árbol) mientras la sala adivina.',
    reference: '1 Corintios 12:7',
    suggestedSec: 60,
    guideHint: 'El director susurra la escena antes de iniciar el cronómetro.',
  },
  {
    id: 'sb-cre-2',
    categoryId: 'reto_creativo',
    title: 'Acróstico juvenil con la palabra FE',
    instructions:
      'En 60 segundos, crea junto a dos compañeros un acróstico o lema breve con las letras J-E-S-Ú-S o F-E que resuma el tema del programa de hoy.',
    reference: 'Hebreos 11:1',
    suggestedSec: 60,
    guideHint: 'Firmeza, Esperanza... ¡Deja brillar la creatividad bíblica!',
  },
  {
    id: 'sb-cre-3',
    categoryId: 'reto_creativo',
    title: 'Titular de noticias desde Jerusalén',
    instructions:
      'Imagina que eres un reportero el día de Pentecostés o cuando cayeron los muros de Jericó. Presenta en 30 segundos un “boletín informativo” fiel al relato bíblico.',
    reference: 'Hechos 2:1-4 / Josué 6:20',
    suggestedSec: 50,
    guideHint: 'Divertido, respetuoso y apegado al texto bíblico.',
  },
  {
    id: 'sb-cre-4',
    categoryId: 'reto_creativo',
    title: 'Coro improvisado de gratitud',
    instructions:
      'Con un ritmo sencillo de palmas, un pequeño grupo compone un coro de 4 líneas basado en el Salmo 100: “Cantad alegres a Dios”.',
    reference: 'Salmos 100:1-2',
    suggestedSec: 60,
    guideHint: 'Todos pueden acompañar marcando el pulso suavemente.',
  },

  // 8. Participación de un voluntario
  {
    id: 'sb-vol-1',
    categoryId: 'participacion_voluntario',
    title: 'Oración espontánea por una petición especial',
    instructions:
      'Un voluntario pasa al frente, recoge 2 peticiones breves de los jóvenes presentes (estudios, familia, salud o misión) y guía una oración sincera por ellas.',
    reference: 'Santiago 5:16',
    suggestedSec: 60,
    guideHint: 'Momento solemne y cercano.',
  },
  {
    id: 'sb-vol-2',
    categoryId: 'participacion_voluntario',
    title: 'Lectura dramática de un Salmo',
    instructions:
      'Un voluntario pasa al micrófono y lee con buena entonación y pausa reverente el Salmo 23 completo o el Salmo 91:1-4 para bendición de todos.',
    reference: 'Salmos 23:1-6',
    suggestedSec: 45,
    guideHint: 'Entregar Biblia o proyectar el texto si es necesario.',
  },
  {
    id: 'sb-vol-3',
    categoryId: 'participacion_voluntario',
    title: 'Consejo en 30 segundos',
    instructions:
      'Un voluntario responde a la pregunta: “Si tuvieras 30 segundos para animar a un amigo que está desanimado en su fe, ¿qué le dirías usando la Biblia?”',
    reference: '1 Tesalonicenses 5:11',
    suggestedSec: 45,
    guideHint: 'Valorar la sinceridad y la base bíblica.',
  },
  {
    id: 'sb-vol-4',
    categoryId: 'participacion_voluntario',
    title: 'Lidera un canto a capela',
    instructions:
      'Un voluntario elige un himno o coro conocido por toda la juventud y dirige una estrofa y el coro junto con la congregación.',
    reference: 'Efesios 5:19',
    suggestedSec: 50,
    guideHint: 'Puede invitar a un compañero a acompañarle.',
  },

  // 9. Reflexión espiritual
  {
    id: 'sb-ref-1',
    categoryId: 'reflexion_espiritual',
    title: '¿Dónde pongo mi confianza cuando hay tormenta?',
    instructions:
      'Lee Marcos 4:39-40 y conversa brevemente con la persona de al lado: ¿qué “viento” intenta robar nuestra paz esta semana y cómo entregárselo a Jesús?',
    reference: 'Marcos 4:39-40',
    suggestedSec: 75,
    guideHint: 'Luego el director pide a 1 o 2 jóvenes resumir una conclusión.',
  },
  {
    id: 'sb-ref-2',
    categoryId: 'reflexion_espiritual',
    title: 'Luz en el colegio, universidad o trabajo',
    instructions:
      'Medita en Mateo 5:14-16: “Vosotros sois la luz del mundo”. Menciona una acción concreta con la que un joven cristiano puede reflejar el carácter de Cristo el lunes por la mañana.',
    reference: 'Mateo 5:14-16',
    suggestedSec: 60,
    guideHint: 'Enfocar en integridad, servicio y amabilidad.',
  },
  {
    id: 'sb-ref-3',
    categoryId: 'reflexion_espiritual',
    title: 'El valor del tiempo con Dios en la mañana',
    instructions:
      'Lee Salmos 5:3. Reflexiona durante un minuto en silencio y comparte un hábito sencillo para no descuidar la oración diaria en medio de las ocupaciones.',
    reference: 'Salmos 5:3',
    suggestedSec: 60,
    guideHint: 'Espacio breve de silencio seguido de una oración corta.',
  },
  {
    id: 'sb-ref-4',
    categoryId: 'reflexion_espiritual',
    title: 'Perdonar como fuimos perdonados',
    instructions:
      'Lee Colosenses 3:13. ¿Por qué guardar rencor frena nuestro crecimiento espiritual? Pide a Dios en silencio un corazón dispuesto a perdonar.',
    reference: 'Colosenses 3:13',
    suggestedSec: 60,
    guideHint: 'Concluir agradeciendo el perdón de Cristo.',
  },

  // 10. Actividad grupal
  {
    id: 'sb-gru-1',
    categoryId: 'actividad_grupal',
    title: 'Cadena de bendición en parejas o tríos',
    instructions:
      'Todos los presentes forman grupos de 3 con quienes están cerca, comparten un motivo breve de oración y oran unos por otros durante un minuto.',
    reference: 'Gálatas 6:2',
    suggestedSec: 75,
    guideHint: 'El director avisa cuando falten 15 segundos para concluir en “Amén”.',
  },
  {
    id: 'sb-gru-2',
    categoryId: 'actividad_grupal',
    title: 'Saludo fraternal con un versículo',
    instructions:
      'Ponte de pie, busca a 3 personas que no hayas saludado hoy y diles: “¡El Señor te bendiga!” compartiendo una palabra de ánimo.',
    reference: 'Romanos 15:7',
    suggestedSec: 60,
    guideHint: 'Ideal para activar la integración y la alegría juvenil.',
  },
  {
    id: 'sb-gru-3',
    categoryId: 'actividad_grupal',
    title: 'Coro bíblico a una sola voz',
    instructions:
      'Toda la Sociedad de Jóvenes lee al unísono Filipenses 2:5-8 o Salmos 103:1-2 con fuerza y reverencia.',
    reference: 'Salmos 103:1-2',
    suggestedSec: 45,
    guideHint: 'El director marca el inicio “1, 2, 3” para leer juntos.',
  },
  {
    id: 'sb-gru-4',
    categoryId: 'actividad_grupal',
    title: 'Lluvia de promesas en el salón',
    instructions:
      'Por filas o sectores, cada grupo dice en voz alta una cualidad de Dios (ej: “¡Dios es fiel!”, “¡Dios es amor!”, “¡Dios es nuestro refugio!”) acompañada de un aplauso.',
    reference: 'Salmos 145:1-3',
    suggestedSec: 45,
    guideHint: 'Ritmo ágil de derecha a izquierda del auditorio.',
  },

  // 11. Pregunta de cultura bíblica
  {
    id: 'sb-cul-1',
    categoryId: 'cultura_biblica',
    title: 'Los idiomas originales de la Biblia',
    instructions:
      '¿En qué tres idiomas originales fueron escritos los libros de la Biblia (Antiguo y Nuevo Testamento)?',
    reference: 'Apocalipsis 14:6',
    suggestedSec: 30,
    guideHint:
      'Hebreo (mayor parte del AT), Arameo (porciones de Daniel y Esdras) y Griego (Nuevo Testamento).',
  },
  {
    id: 'sb-cul-2',
    categoryId: 'cultura_biblica',
    title: 'El capítulo más largo y el más corto',
    instructions:
      '¿Cuál es el capítulo más largo de toda la Biblia y cuál es el capítulo más corto (con solo 2 versículos)?',
    reference: 'Salmos 117 / Salmos 119',
    suggestedSec: 35,
    guideHint: 'Más largo: Salmo 119 (176 versículos). Más corto: Salmo 117 (2 versículos).',
  },
  {
    id: 'sb-cul-3',
    categoryId: 'cultura_biblica',
    title: 'La isla donde Juan recibió el Apocalipsis',
    instructions:
      '¿En qué isla del mar Egeo estuvo desterrado el apóstol Juan cuando recibió las visiones del libro de Apocalipsis?',
    reference: 'Apocalipsis 1:9',
    suggestedSec: 25,
    guideHint: 'Respuesta: La isla de Patmos.',
  },
  {
    id: 'sb-cul-4',
    categoryId: 'cultura_biblica',
    title: 'Cantidad total de libros bíblicos',
    instructions:
      '¿Cuántos libros componen en total la Biblia protestante y cómo se dividen entre el Antiguo y el Nuevo Testamento?',
    reference: '2 Timoteo 3:16-17',
    suggestedSec: 30,
    guideHint: '66 libros en total: 39 en el Antiguo Testamento y 27 en el Nuevo Testamento.',
  },

  // 12. Misión inesperada
  {
    id: 'sb-mis-1',
    categoryId: 'mision_inesperada',
    title: 'Mensaje de ánimo ahora mismo',
    instructions:
      '¡Misión relámpago! Saca tu teléfono durante 45 segundos y envía un mensaje sincero de ánimo o un versículo a un amigo o hermano que no pudo asistir hoy.',
    reference: 'Proverbios 12:25',
    suggestedSec: 50,
    guideHint: 'Al final, todos guardan sus teléfonos y oran por las personas contactadas.',
  },
  {
    id: 'sb-mis-2',
    categoryId: 'mision_inesperada',
    title: 'Plan de visita o llamada solidaria',
    instructions:
      'Dos voluntarios o un equipo asumen el compromiso concreto de visitar, llamar o llevar un detalle esta semana a una persona mayor o enferma de la congregación.',
    reference: 'Mateo 25:36',
    suggestedSec: 60,
    guideHint: 'Anotar el nombre de los responsables para dar seguimiento el próximo sábado.',
  },
  {
    id: 'sb-mis-3',
    categoryId: 'mision_inesperada',
    title: 'Invitación para el próximo sábado',
    instructions:
      'Cada joven elige hoy en su mente el nombre de un amigo, compañero o familiar a quien invitará personalmente al próximo programa juvenil y ora por él en silencio 30 segundos.',
    reference: 'Juan 1:41-42',
    suggestedSec: 45,
    guideHint: 'El director concluye con una oración por los invitados de la próxima semana.',
  },
  {
    id: 'sb-mis-4',
    categoryId: 'mision_inesperada',
    title: 'Nota de gratitud a un servidor de la iglesia',
    instructions:
      'En 60 segundos, el grupo decide a qué servidor de la iglesia (diácono, maestra de niños, sonido, limpieza o pastor) agradecerán hoy con un mensaje o aplauso sincero.',
    reference: 'Hebreos 6:10',
    suggestedSec: 60,
    guideHint: 'Reconocer y honrar a quienes sirven en silencio.',
  },
];
