export type TalentCategoryId =
  | 'canto'
  | 'instrumentos_musicales'
  | 'poesia'
  | 'predicacion'
  | 'dramatizacion'
  | 'dibujo'
  | 'narracion_biblica'
  | 'memorizacion_versiculos'
  | 'creatividad'
  | 'otros_talentos';

export type TalentStageScreen = 'waiting' | 'presentation' | 'recognition';

export type TalentEntryStatus = 'pending' | 'presenting' | 'completed';

export type TalentReactionId =
  | 'edificante'
  | 'inspirador'
  | 'dedicacion'
  | 'gloria_a_dios';

export interface TalentCategoryMeta {
  id: TalentCategoryId;
  label: string;
  color: string;
  defaultDurationSec: number;
  description: string;
  defaultRecognitionTitle: string;
}

export const TALENT_CATEGORIES: TalentCategoryMeta[] = [
  {
    id: 'canto',
    label: 'Canto',
    color: '#D97706',
    defaultDurationSec: 180,
    description: 'Alabanzas vocales, dúos o solos que elevan la adoración de la iglesia.',
    defaultRecognitionTitle: 'Voz que Glorifica a Dios',
  },
  {
    id: 'instrumentos_musicales',
    label: 'Instrumentos musicales',
    color: '#0284C7',
    defaultDurationSec: 180,
    description: 'Interpretaciones en piano, guitarra, violín, flauta u otro instrumento.',
    defaultRecognitionTitle: 'Melodía Consagrada para el Señor',
  },
  {
    id: 'poesia',
    label: 'Poesía',
    color: '#7C3AED',
    defaultDurationSec: 120,
    description: 'Declamación de poemas cristianos originales o clásicos edificantes.',
    defaultRecognitionTitle: 'Palabra Poética de Fe y Esperanza',
  },
  {
    id: 'predicacion',
    label: 'Predicación',
    color: '#059669',
    defaultDurationSec: 240,
    description: 'Reflexiones y sermones juveniles breves centrados en las Escrituras.',
    defaultRecognitionTitle: 'Portador Fiel de la Palabra',
  },
  {
    id: 'dramatizacion',
    label: 'Dramatización',
    color: '#0D9488',
    defaultDurationSec: 210,
    description: 'Escenas bíblicas, monólogos o reflexiones teatrales para jóvenes.',
    defaultRecognitionTitle: 'Expresión Escénica Edificante',
  },
  {
    id: 'dibujo',
    label: 'Dibujo',
    color: '#DB2777',
    defaultDurationSec: 120,
    description: 'Ilustraciones, arte cristiano, caligrafía bíblica o pintura en vivo.',
    defaultRecognitionTitle: 'Arte y Talento que Refleja al Creador',
  },
  {
    id: 'narracion_biblica',
    label: 'Narración bíblica',
    color: '#4F46E5',
    defaultDurationSec: 150,
    description: 'Relato vivo y expresivo de historias y parábolas de la Biblia.',
    defaultRecognitionTitle: 'Narrador Inspirado de las Escrituras',
  },
  {
    id: 'memorizacion_versiculos',
    label: 'Memorización de versículos',
    color: '#2563EB',
    defaultDurationSec: 90,
    description: 'Recitación fiel de salmos, promesas y capítulos bíblicos completos.',
    defaultRecognitionTitle: 'Tesoro Vivo de la Palabra en el Corazón',
  },
  {
    id: 'creatividad',
    label: 'Creatividad',
    color: '#EA580C',
    defaultDurationSec: 150,
    description: 'Dinámicas originales, audiovisuales, composiciones o proyectos cristianos.',
    defaultRecognitionTitle: 'Ingenio y Creatividad al Servicio Juvenil',
  },
  {
    id: 'otros_talentos',
    label: 'Otros talentos',
    color: '#16A34A',
    defaultDurationSec: 150,
    description: 'Cualquier otro don, habilidad o testimonio creativo puesto en manos de Dios.',
    defaultRecognitionTitle: 'Don Especial Dedicado al Servicio de Dios',
  },
];

export const TALENT_POSITIVE_REACTIONS: Array<{
  id: TalentReactionId;
  label: string;
  encouragement: string;
}> = [
  {
    id: 'edificante',
    label: 'Edificó mi fe',
    encouragement: 'Tu presentación edificó grandemente a la congregación.',
  },
  {
    id: 'inspirador',
    label: 'Inspirador',
    encouragement: '¡Gracias por inspirar a otros jóvenes a usar sus dones!',
  },
  {
    id: 'dedicacion',
    label: 'Gran dedicación',
    encouragement: 'Se nota tu preparación, entrega y respeto por Dios.',
  },
  {
    id: 'gloria_a_dios',
    label: '¡Gloria a Dios!',
    encouragement: '¡Amén! Damos gracias a Dios por el talento que ha puesto en ti.',
  },
];

export const TALENT_ENCOURAGEMENT_MESSAGES: string[] = [
  '¡Dios bendiga grandemente tu talento y ministerio juvenil!',
  'Gracias por compartir este don con tanta entrega y humildad.',
  'Tu preparación fue de gran inspiración para toda la Sociedad de Jóvenes.',
  'Sigue cultivando este regalo de Dios con alegría (1 Pedro 4:10).',
  '¡Qué hermosa manera de honrar al Señor en nuestra juventud!',
];

export const TALENT_RECOGNITION_TITLES: string[] = [
  'Talento que Glorifica a Dios',
  'Dedicación y Espíritu de Servicio',
  'Inspiración para la Juventud',
  'Fidelidad y Excelencia Cristiana',
  'Corazón Dispuesto para la Obra',
  'Creatividad que Edifica la Iglesia',
];

export interface TalentPrivacyControls {
  showNamesOnScreen: boolean;
  showPhotosOnScreen: boolean;
  showDescriptionsOnScreen: boolean;
  showJuryFeedbackOnScreen: boolean;
  showAudiencePraiseOnFinal: boolean;
}

export interface TalentJuryMember {
  id: string;
  name: string;
  roleTitle: string;
}

export interface TalentJuryEvaluation {
  juryMemberId: string;
  juryName: string;
  entryId: string;
  biblicalMessageScore: number; // 1..5 constructive appreciation
  preparationScore: number; // 1..5
  clarityScore: number; // 1..5
  encouragingComment: string;
  suggestedRecognition: string;
  submittedAt: number;
}

export interface TalentAudienceAppreciation {
  id: string;
  entryId: string;
  voterKey: string;
  voterLabel: string;
  reactionId: TalentReactionId;
  curatedMessage?: string;
  submittedAt: number;
}

export interface TalentEntry {
  id: string;
  orderIndex: number;
  participantName: string;
  displayAlias: string;
  categoryId: TalentCategoryId;
  presentationTitle: string;
  description: string;
  verseReference?: string;
  durationSec: number;
  status: TalentEntryStatus;
  consentNamePublic: boolean;
  consentMediaPublic: boolean;
  directorApprovedDisplay: boolean;
  directorApprovedMedia: boolean;
  mediaDataUrl?: string;
  mediaCaption?: string;
  recognitionTitle?: string;
  directorEncouragementNote?: string;
  actualDurationSec?: number;
  completedAt?: number;
  createdAt: number;
}

export interface TalentPublicEntryView {
  id: string;
  orderIndex: number;
  publicName: string;
  categoryId: TalentCategoryId;
  categoryLabel: string;
  categoryColor: string;
  presentationTitle: string;
  description?: string;
  verseReference?: string;
  durationSec: number;
  status: TalentEntryStatus;
  authorizedMediaUrl?: string;
  mediaCaption?: string;
  recognitionTitle: string;
  directorEncouragementNote?: string;
  praiseCount: number;
  reactionBreakdown: Record<TalentReactionId, number>;
  curatedMessages: string[];
  juryHighlights?: string[];
}

export interface TalentCertificateRecord {
  id: string;
  entryId: string;
  recipientDisplayName: string;
  categoryId: TalentCategoryId;
  categoryLabel: string;
  presentationTitle: string;
  recognitionTitle: string;
  encouragementMessage: string;
  programTitle: string;
  directorSignatureName: string;
  verseText: string;
  issuedAt: number;
}

export interface TalentShowcaseSession {
  id: string;
  programTitle: string;
  directorName: string;
  currentScreen: TalentStageScreen;
  activeEntryId: string | null;
  openingNonce: number;
  timerRunning: boolean;
  timerStartedAt: number | null;
  timerEndsAt: number | null;
  timerPausedRemainingSec: number | null;
  audienceVotingEnabled: boolean;
  juryEnabled: boolean;
  privacy: TalentPrivacyControls;
  entries: TalentEntry[];
  juryMembers: TalentJuryMember[];
  juryEvaluations: TalentJuryEvaluation[];
  appreciations: TalentAudienceAppreciation[];
  certificates: TalentCertificateRecord[];
  updatedAt: number;
}

export interface TalentRoomState {
  programTitle: string;
  directorName: string;
  currentScreen: TalentStageScreen;
  activeEntryId: string | null;
  openingNonce: number;
  timerRunning: boolean;
  timerEndsAt: number | null;
  timerRemainingSec: number;
  audienceVotingEnabled: boolean;
  juryEnabled: boolean;
  privacy: TalentPrivacyControls;
  entries: TalentPublicEntryView[];
  myAppreciatedEntryIds: string[];
  certificates: TalentCertificateRecord[];
}

export function getTalentCategoryMeta(id: TalentCategoryId): TalentCategoryMeta {
  return TALENT_CATEGORIES.find((c) => c.id === id) || TALENT_CATEGORIES[0];
}
