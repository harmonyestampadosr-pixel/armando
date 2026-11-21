export type MissionCategoryId =
  | 'servicio'
  | 'evangelismo'
  | 'vida_espiritual'
  | 'comunidad';

export type MissionParticipationType =
  | 'individual'
  | 'grupal'
  | 'individual_o_grupal';

export type MissionRegistrationStatus =
  | 'approved'
  | 'pending_validation'
  | 'rejected';

export interface MissionCategoryMeta {
  id: MissionCategoryId;
  label: string;
  subtitle: string;
  accentColor: string;
  suggestedActivities: string[];
}

export const MISSION_CATEGORIES: MissionCategoryMeta[] = [
  {
    id: 'servicio',
    label: 'Servicio',
    subtitle: 'Amor práctico hacia el prójimo, familias y comunidad',
    accentColor: '#10B981',
    suggestedActivities: [
      'Ayudar a una persona',
      'Visitar a alguien que necesite compañía',
      'Participar en una actividad comunitaria',
      'Colaborar con una familia',
    ],
  },
  {
    id: 'evangelismo',
    label: 'Evangelismo',
    subtitle: 'Compartir las buenas nuevas con respeto, amor y testimonio',
    accentColor: '#F59E0B',
    suggestedActivities: [
      'Invitar a un amigo a una actividad juvenil',
      'Compartir un mensaje bíblico',
      'Participar en una jornada misionera',
      'Colaborar en una actividad de evangelismo',
    ],
  },
  {
    id: 'vida_espiritual',
    label: 'Vida Espiritual',
    subtitle: 'Crecer en la Palabra, la oración y la reflexión diaria',
    accentColor: '#0EA5E9',
    suggestedActivities: [
      'Leer un pasaje bíblico',
      'Dedicar tiempo a la oración',
      'Memorizar un versículo',
      'Compartir una reflexión bíblica',
    ],
  },
  {
    id: 'comunidad',
    label: 'Comunidad',
    subtitle: 'Acoger, integrar y fortalecer el compañerismo cristiano',
    accentColor: '#A855F7',
    suggestedActivities: [
      'Conocer a un joven nuevo',
      'Ayudar a integrar a alguien',
      'Organizar una actividad de compañerismo',
    ],
  },
];

export interface WeeklyMission {
  id: string;
  title: string;
  category: MissionCategoryId;
  activityType: string;
  description: string;
  instructions: string[];
  participationType: MissionParticipationType;
  biblicalReference: string;
  spiritualFocus: string;
  pointsReward: number;
  requiresDirectorValidation: boolean;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  isFeaturedCurrentWeek?: boolean;
  isCustom?: boolean;
  createdAt?: number;
}

export interface MissionRegistration {
  id: string;
  missionId: string;
  missionTitle: string;
  category: MissionCategoryId;
  participantKey: string;
  participantName: string;
  groupName?: string;
  groupMemberCount?: number;
  modeChosen: 'individual' | 'grupal';
  declarationText: string;
  reflectionNote?: string;
  hasOptionalPhoto: boolean;
  photoConsentAuthorized: boolean;
  photoDataUrl?: string;
  status: MissionRegistrationStatus;
  pointsAwarded: number;
  validatedBy?: string;
  directorNote?: string;
  submittedAt: number;
  validatedAt?: number;
}

export interface MissionRecognition {
  id: string;
  participantKey: string;
  participantName: string;
  title: string;
  reason: string;
  category?: MissionCategoryId;
  grantedBy: string;
  grantedAt: number;
  isAutomatic: boolean;
}

export interface MissionParticipantSummary {
  participantKey: string;
  participantName: string;
  totalPoints: number;
  completedCount: number;
  pendingCount: number;
  categoriesCompleted: MissionCategoryId[];
  recognitionsCount: number;
  lastActivityAt: number;
}

export function getMissionCategoryMeta(
  category: MissionCategoryId
): MissionCategoryMeta {
  return (
    MISSION_CATEGORIES.find((c) => c.id === category) || MISSION_CATEGORIES[0]
  );
}

/** Calcula lunes y domingo de la semana relativa (offsetWeeks = 0 es esta semana). */
export function getWeekWindowDates(
  offsetWeeks = 0,
  referenceDate = new Date()
): { startDate: string; endDate: string; weekIndex: number } {
  const d = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate()
    )
  );
  const day = d.getUTCDay(); // 0=Dom..6=Sab
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday + offsetWeeks * 7);

  const monday = new Date(d);
  const sunday = new Date(d);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const fmt = (dt: Date) => dt.toISOString().slice(0, 10);

  // Deterministic week number for rotating weekly featured mission
  const yearStart = new Date(Date.UTC(monday.getUTCFullYear(), 0, 1));
  const weekIndex = Math.max(
    1,
    Math.ceil(
      ((monday.getTime() - yearStart.getTime()) / 86400000 +
        yearStart.getUTCDay() +
        1) /
        7
    )
  );

  return {
    startDate: fmt(monday),
    endDate: fmt(sunday),
    weekIndex,
  };
}

interface MissionTemplate {
  id: string;
  title: string;
  category: MissionCategoryId;
  activityType: string;
  description: string;
  instructions: string[];
  participationType: MissionParticipationType;
  biblicalReference: string;
  spiritualFocus: string;
  pointsReward: number;
  requiresDirectorValidation: boolean;
}

export const BUILTIN_WEEKLY_MISSION_TEMPLATES: MissionTemplate[] = [
  // 1. SERVICIO
  {
    id: 'mis-srv-ayudar-persona',
    title: 'Manos Dispuestas: Ayudar a una Persona',
    category: 'servicio',
    activityType: 'Ayudar a una persona',
    description:
      'Brinda ayuda práctica y desinteresada a alguien que atraviesa una necesidad cotidiana (compras, quehaceres, estudio o apoyo escolar).',
    instructions: [
      'Identifica con sensibilidad a alguien cercano (familiar, vecino o miembro de la congregación) que necesite ayuda práctica.',
      'Ofrece tu apoyo con humildad y respeto, cuidando siempre tu seguridad y la privacidad de la otra persona.',
      'Registra tu declaración de cumplimiento contando brevemente lo que aprendiste al servir, sin incluir datos privados ni fotografías de terceros.',
    ],
    participationType: 'individual_o_grupal',
    biblicalReference: 'Gálatas 5:13',
    spiritualFocus: 'Servir por amor unos a otros refleja el carácter de Cristo.',
    pointsReward: 150,
    requiresDirectorValidation: false,
  },
  {
    id: 'mis-srv-visita-compania',
    title: 'Presencia que Consuela: Visitar a Quien Necesita Compañía',
    category: 'servicio',
    activityType: 'Visitar a alguien que necesite compañía',
    description:
      'Acompaña con tu presencia o una conversación fraterna a un adulto mayor, enfermo o persona que se sienta sola durante esta semana.',
    instructions: [
      'Coordina con tu familia o el director juvenil una visita breve y respetuosa (o llamada afectuosa si es a distancia).',
      'Escucha con atención, comparte palabras de ánimo y ora brevemente si la persona lo desea.',
      'Al registrar tu participación, no escribas direcciones ni nombres privados completos de la persona visitada.',
    ],
    participationType: 'grupal',
    biblicalReference: 'Mateo 25:36',
    spiritualFocus: 'Acompañar al que sufre o está solo es ministrar con compasión.',
    pointsReward: 200,
    requiresDirectorValidation: true,
  },
  {
    id: 'mis-srv-actividad-comunitaria',
    title: 'Brigada Solidaria: Actividad Comunitaria',
    category: 'servicio',
    activityType: 'Participar en una actividad comunitaria',
    description:
      'Únete junto a otros jóvenes en una jornada de limpieza, recolección de víveres, embellecimiento o apoyo comunitario.',
    instructions: [
      'Participa voluntariamente en la iniciativa comunitaria organizada por tu iglesia, escuela o grupo juvenil.',
      'Colabora en equipo manteniendo un testimonio amable y servicial en todo momento.',
      'Solicita validación del director autorizado si participaste en brigada grupal.',
    ],
    participationType: 'grupal',
    biblicalReference: 'Tito 3:14',
    spiritualFocus: 'Aprender a ocuparse en buenas obras para casos de necesidad.',
    pointsReward: 220,
    requiresDirectorValidation: true,
  },
  {
    id: 'mis-srv-colaborar-familia',
    title: 'Hogar Fortalecido: Colaborar con una Familia',
    category: 'servicio',
    activityType: 'Colaborar con una familia',
    description:
      'Apoya de forma práctica a una familia de la iglesia o comunidad con alimentos, cuidado del hogar o una ayuda específica.',
    instructions: [
      'Coordina una acción concreta de ayuda junto a tu familia o grupo pequeño.',
      'Mantén absoluta discreción para honrar la dignidad de quienes reciben el apoyo.',
      'Completa tu declaración de cumplimiento enfocándote en el aprendizaje espiritual vivido.',
    ],
    participationType: 'individual_o_grupal',
    biblicalReference: '1 Juan 3:18',
    spiritualFocus: 'Amar no solo de palabra, sino con hechos y verdad.',
    pointsReward: 180,
    requiresDirectorValidation: true,
  },

  // 2. EVANGELISMO
  {
    id: 'mis-evg-invitar-amigo',
    title: 'Puertas Abiertas: Invitar a un Amigo',
    category: 'evangelismo',
    activityType: 'Invitar a un amigo a una actividad juvenil',
    description:
      'Extiende una invitación cordial y sincera a un amigo, compañero o familiar para asistir al próximo programa de Sociedad de Jóvenes.',
    instructions: [
      'Ora por un amigo o conocido durante la semana antes de invitarle.',
      'Compártele la invitación de forma amable, sin presiones, explicándole qué harán en la reunión juvenil.',
      'Si tu amigo acepta asistir, recíbelo a la entrada y preséntale al grupo.',
    ],
    participationType: 'individual',
    biblicalReference: 'Juan 1:46',
    spiritualFocus: 'La invitación personal "Ven y ve" sigue transformando vidas.',
    pointsReward: 160,
    requiresDirectorValidation: false,
  },
  {
    id: 'mis-evg-mensaje-biblico',
    title: 'Semilla de Esperanza: Compartir un Mensaje Bíblico',
    category: 'evangelismo',
    activityType: 'Compartir un mensaje bíblico',
    description:
      'Comparte un versículo bíblico y un mensaje positivo de fe con alguien que necesite esperanza esta semana.',
    instructions: [
      'Elige un pasaje bíblico de aliento (por ejemplo Salmos 23, Filipenses 4:6-7 o Isaías 41:10).',
      'Comparte el mensaje por nota escrita, tarjeta o conversación personal edificante.',
      'Registra el versículo elegido y tu experiencia sin exponer conversaciones privadas.',
    ],
    participationType: 'individual',
    biblicalReference: 'Romanos 1:16',
    spiritualFocus: 'El evangelio es poder de Dios para salvación y esperanza.',
    pointsReward: 140,
    requiresDirectorValidation: false,
  },
  {
    id: 'mis-evg-jornada-misionera',
    title: 'Embajadores en Marcha: Jornada Misionera',
    category: 'evangelismo',
    activityType: 'Participar en una jornada misionera',
    description:
      'Participa con el grupo juvenil en una salida misionera para distribuir literatura, orar por personas o realizar cantos evangelísticos.',
    instructions: [
      'Asiste a la convocatoria misionera con actitud reverente, alegre y respetuosa.',
      'Trabaja en pareja o equipo siguiendo las orientaciones de seguridad de los líderes.',
      'El director autorizado validará la participación del equipo al concluir la jornada.',
    ],
    participationType: 'grupal',
    biblicalReference: 'Mateo 28:19-20',
    spiritualFocus: 'Ir juntos compartiendo la enseñanza y promesa de Jesús.',
    pointsReward: 240,
    requiresDirectorValidation: true,
  },
  {
    id: 'mis-evg-actividad-evangelismo',
    title: 'Voces de Salvación: Colaborar en Evangelismo',
    category: 'evangelismo',
    activityType: 'Colaborar en una actividad de evangelismo',
    description:
      'Apoya en logística, alabanza, recepción, medios digitales o estudios bíblicos dentro de una campaña o actividad evangelística.',
    instructions: [
      'Ofrece tus dones en el área que más necesite apoyo dentro de la actividad evangelística.',
      'Mantén fidelidad, puntualidad y trato amable hacia todos los visitantes.',
      'Registra tu área de apoyo para validación del director.',
    ],
    participationType: 'individual_o_grupal',
    biblicalReference: 'Hechos 1:8',
    spiritualFocus: 'Ser testigos fieles con la guía del Espíritu Santo.',
    pointsReward: 200,
    requiresDirectorValidation: true,
  },

  // 3. VIDA ESPIRITUAL
  {
    id: 'mis-esp-leer-pasaje',
    title: 'Lámpara a Mis Pies: Leer un Pasaje Bíblico',
    category: 'vida_espiritual',
    activityType: 'Leer un pasaje bíblico',
    description:
      'Aparta 15 minutos diarios durante la semana para leer y meditar en un libro corto o capítulo bíblico (como Filipenses, Salmos o Marcos).',
    instructions: [
      'Elige una hora fija cada día para leer con calma sin distracciones.',
      'Anota una enseñanza principal que Dios haya puesto en tu corazón a partir del pasaje.',
      'Declara tu cumplimiento compartiendo la idea central que edificó tu fe.',
    ],
    participationType: 'individual',
    biblicalReference: 'Salmos 119:105',
    spiritualFocus: 'La Palabra de Dios ilumina cada paso y decisión juvenil.',
    pointsReward: 130,
    requiresDirectorValidation: false,
  },
  {
    id: 'mis-esp-oracion',
    title: 'Altar Vivo: Dedicar Tiempo a la Oración',
    category: 'vida_espiritual',
    activityType: 'Dedicar tiempo a la oración',
    description:
      'Separa momentos específicos durante la semana para orar por tu iglesia, tus amigos, familias necesitadas y tu propósito espiritual.',
    instructions: [
      'Prepara una lista personal de motivos de gratitud e intercesión (sin exponer secretos de otros).',
      'Dedica tiempo tranquilo en oración personal o en grupo juvenil de oración.',
      'Confirma tu participación describiendo cómo fortaleció tu semana espiritual.',
    ],
    participationType: 'individual_o_grupal',
    biblicalReference: '1 Tesalonicenses 5:17',
    spiritualFocus: 'La oración constante conecta nuestro corazón con la voluntad divina.',
    pointsReward: 130,
    requiresDirectorValidation: false,
  },
  {
    id: 'mis-esp-memorizar-versiculo',
    title: 'Tesoro en el Corazón: Memorizar un Versículo',
    category: 'vida_espiritual',
    activityType: 'Memorizar un versículo',
    description:
      'Memoriza un versículo bíblico completo con su cita y compártelo de memoria en la reunión o con tu grupo pequeño.',
    instructions: [
      'Escoge un versículo significativo (por ejemplo Josué 1:9, Proverbios 3:5-6 o 1 Timoteo 4:12).',
      'Repásalo en voz alta cada mañana hasta dominarlo con exactitud.',
      'Si gustas, recítalo frente a tu director para que valide tu logro o regístralo por declaración.',
    ],
    participationType: 'individual',
    biblicalReference: 'Salmos 119:11',
    spiritualFocus: 'Guardar la Palabra en el corazón fortalece en tiempos de prueba.',
    pointsReward: 150,
    requiresDirectorValidation: false,
  },
  {
    id: 'mis-esp-compartir-reflexion',
    title: 'Palabra que Edifica: Compartir una Reflexión Bíblica',
    category: 'vida_espiritual',
    activityType: 'Compartir una reflexión bíblica',
    description:
      'Prepara y comparte una reflexión bíblica breve (en grupo pequeño, familia o devocional juvenil) basada en un texto de la Escritura.',
    instructions: [
      'Estudia el contexto del versículo seleccionado para explicar su enseñanza con claridad.',
      'Comparte tu reflexión con sencillez y aplicación práctica para los jóvenes.',
      'Registra el pasaje bíblico y la enseñanza principal compartida.',
    ],
    participationType: 'individual_o_grupal',
    biblicalReference: 'Colosenses 3:16',
    spiritualFocus: 'Que la palabra de Cristo abunde en nosotros al enseñarnos unos a otros.',
    pointsReward: 170,
    requiresDirectorValidation: false,
  },

  // 4. COMUNIDAD
  {
    id: 'mis-com-conocer-joven',
    title: 'Hospitalidad Cristiana: Conocer a un Joven Nuevo',
    category: 'comunidad',
    activityType: 'Conocer a un joven nuevo',
    description:
      'Acércate con amabilidad a alguien nuevo o poco frecuente en la congregación para darle la bienvenida y conocer sus intereses.',
    instructions: [
      'Saluda con calidez antes o después de la reunión juvenil.',
      'Conversa con empatía, escucha su historia sin invadir su privacidad y preséntale al grupo.',
      'Declara tu cumplimiento sin publicar datos privados ni contactos personales.',
    ],
    participationType: 'individual',
    biblicalReference: 'Romanos 15:7',
    spiritualFocus: 'Recibirnos unos a otros como Cristo nos recibió para gloria de Dios.',
    pointsReward: 150,
    requiresDirectorValidation: false,
  },
  {
    id: 'mis-com-integrar-alguien',
    title: 'Puente de Amistad: Ayudar a Integrar a Alguien',
    category: 'comunidad',
    activityType: 'Ayudar a integrar a alguien',
    description:
      'Asegúrate de que nadie quede aislado durante los juegos, dinámicas o refrigerios, integrándolo activamente a un equipo o conversación.',
    instructions: [
      'Observa con atención quién pudiera sentirse tímido o apartado durante la actividad.',
      'Invítale a sentarse contigo o a formar parte de tu equipo en las dinámicas.',
      'Registra brevemente cómo se vivió la experiencia de inclusión fraternal.',
    ],
    participationType: 'individual_o_grupal',
    biblicalReference: '1 Corintios 12:25-26',
    spiritualFocus: 'En el cuerpo de Cristo cada miembro es valioso y cuidado por todos.',
    pointsReward: 160,
    requiresDirectorValidation: false,
  },
  {
    id: 'mis-com-actividad-companerismo',
    title: 'Unidad Alegre: Organizar Actividad de Compañerismo',
    category: 'comunidad',
    activityType: 'Organizar una actividad de compañerismo',
    description:
      'Planifica o colabora en un encuentro sano de compañerismo (merienda compartida, noche de juegos bíblicos, caminata o fogata juvenil).',
    instructions: [
      'Coordina con los líderes juveniles una actividad sana, inclusiva y edificante.',
      'Promueve un ambiente respetuoso donde todos los asistentes se sientan valorados.',
      'El director autorizado validará la realización de la actividad grupal.',
    ],
    participationType: 'grupal',
    biblicalReference: 'Salmos 133:1',
    spiritualFocus: 'Cuan bueno y delicioso es habitar los hermanos juntos en armonía.',
    pointsReward: 210,
    requiresDirectorValidation: true,
  },
];

export function buildActiveWeeklyCatalog(
  referenceDate = new Date()
): WeeklyMission[] {
  const currentWin = getWeekWindowDates(0, referenceDate);
  const featuredIdx =
    (currentWin.weekIndex - 1) % BUILTIN_WEEKLY_MISSION_TEMPLATES.length;

  return BUILTIN_WEEKLY_MISSION_TEMPLATES.map((tpl, idx) => {
    // Rotate active weeks cleanly while keeping current week featured
    const offset = idx === featuredIdx ? 0 : idx < 4 ? 0 : idx < 10 ? 1 : -1;
    const win = getWeekWindowDates(offset, referenceDate);
    return {
      ...tpl,
      startDate: win.startDate,
      endDate: win.endDate,
      isFeaturedCurrentWeek: idx === featuredIdx,
      isCustom: false,
    };
  });
}

export const AUTOMATIC_RECOGNITION_MILESTONES = [
  {
    id: 'rec-primera-mision',
    title: 'Paso de Fe',
    reason: 'Completó su primera Misión de la Semana con espíritu voluntario.',
    minCompleted: 1,
  },
  {
    id: 'rec-constancia',
    title: 'Corazón Constante',
    reason: 'Completó 3 o más misiones semanales edificando a otros.',
    minCompleted: 3,
  },
  {
    id: 'rec-servicio',
    title: 'Manos de Compasión',
    reason: 'Cumplió misiones prácticas en la categoría de Servicio.',
    requiredCategory: 'servicio' as MissionCategoryId,
  },
  {
    id: 'rec-evangelismo',
    title: 'Mensajero de Esperanza',
    reason: 'Compartió el evangelio en la categoría de Evangelismo.',
    requiredCategory: 'evangelismo' as MissionCategoryId,
  },
  {
    id: 'rec-vida-espiritual',
    title: 'Discípulo en la Palabra',
    reason: 'Fortaleció su devoción diaria en Vida Espiritual.',
    requiredCategory: 'vida_espiritual' as MissionCategoryId,
  },
  {
    id: 'rec-comunidad',
    title: 'Constructor de Unidad',
    reason: 'Promovió la integración fraterna en Comunidad.',
    requiredCategory: 'comunidad' as MissionCategoryId,
  },
  {
    id: 'rec-cuatro-pilares',
    title: 'Embajador Integral del Reino',
    reason:
      'Cumplió al menos una misión en las 4 categorías: Servicio, Evangelismo, Vida Espiritual y Comunidad.',
    requireAllCategories: true,
  },
];
