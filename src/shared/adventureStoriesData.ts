export type AdventureAmbientStyle =
  | 'heroic'
  | 'royal'
  | 'desert'
  | 'pastoral'
  | 'miracle';

export type AdventurePlayMode =
  | 'individual'
  | 'competitive_players'
  | 'competitive_teams'
  | 'conductor_led';

export type AdventureRoomPhase =
  | 'narration'
  | 'decision_open'
  | 'consequence_reveal'
  | 'reflection';

export interface AdventureChoiceOption {
  id: string;
  label: string;
  isBiblicallyFaithful: boolean;
  pointsDelta: number;
  consequenceText: string;
  biblicalExplanation: string;
}

export interface AdventureScene {
  id: string;
  order: number;
  title: string;
  location: string;
  narrativeAdaptation: string;
  sceneReference: string;
  scriptureNote: string;
  interactionType: 'decision' | 'question';
  prompt: string;
  options: AdventureChoiceOption[];
}

export interface AdventureCharacter {
  name: string;
  role: string;
}

export interface AdventureStory {
  id: string;
  title: string;
  subtitle: string;
  testament: 'Antiguo Testamento' | 'Nuevo Testamento';
  ambientStyle: AdventureAmbientStyle;
  ambientLabel: string;
  accentColor: string;
  mainReference: string;
  scripturalAnchor: string;
  introductionNarrative: string;
  characters: AdventureCharacter[];
  scenes: AdventureScene[];
  finalReflection: string;
  keyTakeaways: string[];
  isCustom?: boolean;
  createdAt?: number;
}

export interface AdventureProgressRecord {
  storyId: string;
  storyTitle: string;
  mode: AdventurePlayMode;
  currentSceneIndex: number;
  totalScenes: number;
  completed: boolean;
  score: number;
  faithfulChoices: number;
  selectedChoicesByScene: Record<string, string>;
  updatedAt: number;
}

export interface AdventureSubmissionView {
  participantId: string;
  participantName: string;
  avatarId: string;
  photoUrl?: string;
  teamId?: string;
  optionId: string;
  optionLabel: string;
  isBiblicallyFaithful?: boolean;
  pointsEarned?: number;
  submittedAt: number;
}

export interface AdventureSanitizedOption {
  id: string;
  label: string;
  isBiblicallyFaithful?: boolean;
  pointsDelta?: number;
  consequenceText?: string;
  biblicalExplanation?: string;
}

export interface AdventureSanitizedScene {
  id: string;
  order: number;
  title: string;
  location: string;
  narrativeAdaptation: string;
  sceneReference: string;
  scriptureNote: string;
  interactionType: 'decision' | 'question';
  prompt: string;
  options: AdventureSanitizedOption[];
}

export interface AdventureRoomState {
  storyId: string;
  storyTitle: string;
  storySubtitle: string;
  ambientStyle: AdventureAmbientStyle;
  ambientLabel: string;
  accentColor: string;
  mainReference: string;
  scripturalAnchor: string;
  introductionNarrative: string;
  characters: AdventureCharacter[];
  playMode: AdventurePlayMode;
  phase: AdventureRoomPhase;
  currentSceneIndex: number;
  totalScenes: number;
  currentScene: AdventureSanitizedScene | null;
  finalReflection?: string;
  keyTakeaways?: string[];
  sceneTransitionNonce: number;
  optionVoteCounts: Record<string, number>;
  mySelectedOptionId?: string | null;
  submissionsCount: number;
  submissions: AdventureSubmissionView[];
}

export const ADVENTURE_AMBIENT_LABELS: Record<
  AdventureAmbientStyle,
  { name: string; description: string }
> = {
  heroic: {
    name: 'Arpa y Valor Épico',
    description: 'Acordes luminosos en quinta justa con pulso solemne de valentía.',
  },
  royal: {
    name: 'Corte y Fidelidad',
    description: 'Cuerdas serenas y arpegio regio en modo dórico reflexivo.',
  },
  desert: {
    name: 'Senda del Desierto',
    description: 'Textura cálida de cuerdas pulsadas y brisa ambiental pausada.',
  },
  pastoral: {
    name: 'Prados de Gracia',
    description: 'Guitarra pastoral en 6/8 y campanas suaves de esperanza.',
  },
  miracle: {
    name: 'Mar en Calma',
    description: 'Pad cristalino y armonía serena sobre el agua y la tormenta.',
  },
};

export const BUILTIN_ADVENTURE_STORIES: AdventureStory[] = [
  {
    id: 'adv-david-goliat',
    title: 'David y Goliat',
    subtitle: 'La victoria de la fe sobre el temor en el valle de Ela',
    testament: 'Antiguo Testamento',
    ambientStyle: 'heroic',
    ambientLabel: 'Arpa y Valor Épico',
    accentColor: '#D97706',
    mainReference: '1 Samuel 17:1-51',
    scripturalAnchor:
      '1 Samuel 17:45-47 — David respondió al filisteo que venía en nombre de Jehová de los ejércitos, el Dios de los escuadrones de Israel, para que toda la tierra supiera que hay Dios en Israel y que Jehová no salva con espada ni con lanza.',
    introductionNarrative:
      'Adaptación narrativa: El valle de Ela permanece en tenso silencio. En una ladera acampa el ejército de Israel; en la opuesta, el campeón filisteo Goliat lanza su desafío durante cuarenta días. Un joven pastor llega enviado por su padre con provisiones para sus hermanos, sin imaginar que ese día la confianza en Dios cambiaría la historia de la nación.',
    characters: [
      { name: 'David', role: 'Joven pastor de Belén que confió en el Dios de Israel' },
      { name: 'Goliat', role: 'Campeón filisteo de Gat que desafió a los escuadrones de Israel' },
      { name: 'Saúl', role: 'Rey de Israel que dudaba pero permitió a David salir al encuentro' },
      { name: 'Eliab', role: 'Hermano mayor de David que subestimó la intención del joven' },
    ],
    scenes: [
      {
        id: 'dg-s1',
        order: 1,
        title: 'El clamor en el campamento',
        location: 'Campamento de Israel en el valle de Ela',
        narrativeAdaptation:
          'Adaptación narrativa: Al escuchar los insultos de Goliat, los soldados retroceden atemorizados. Eliab reprende con dureza a David por acercarse al frente de batalla, mientras otros murmuran sobre las recompensas ofrecidas por el rey.',
        sceneReference: '1 Samuel 17:26-32',
        scriptureNote:
          'Referencia bíblica: David preguntó quién era aquel filisteo para provocar al Dios viviente y se ofreció ante Saúl para ir a pelear (1 Samuel 17:26, 32).',
        interactionType: 'decision',
        prompt:
          'Ante la crítica de Eliab y el miedo generalizado en el campamento, ¿qué postura reflejó la fe de David?',
        options: [
          {
            id: 'dg-s1-a',
            label: 'Responder con calma, recordar que la honra de Dios está en juego y presentarse ante el rey',
            isBiblicallyFaithful: true,
            pointsDelta: 1000,
            consequenceText:
              'David se aparta sin dejarse provocar por el enojo de su hermano y declara su disposición de defender el nombre del Señor.',
            biblicalExplanation:
              '1 Samuel 17:29-32 relata que David respondió con serenidad ("¿Qué he hecho yo ahora? ¿No es esto mero hablar?") y mantuvo su propósito.',
          },
          {
            id: 'dg-s1-b',
            label: 'Discutir largamente con Eliab hasta abandonar el campamento sin hablar con Saúl',
            isBiblicallyFaithful: false,
            pointsDelta: 200,
            consequenceText:
              'Una discusión familiar habría desviado la atención del verdadero desafío espiritual del valle.',
            biblicalExplanation:
              'En 1 Samuel 17:30 David se apartó de Eliab hacia otro y continuó preguntando para actuar conforme a su convicción en Dios.',
          },
          {
            id: 'dg-s1-c',
            label: 'Esconderse entre las tiendas esperando que otro soldado más alto acepte el reto',
            isBiblicallyFaithful: false,
            pointsDelta: 150,
            consequenceText:
              'El temor paralizaba al ejército entero; hacía falta una fe apoyada en experiencias pasadas con Dios.',
            biblicalExplanation:
              'David dijo a Saúl en 1 Samuel 17:32: "No desmaye el corazón de ninguno a causa de él; tu siervo irá y peleará".',
          },
        ],
      },
      {
        id: 'dg-s2',
        order: 2,
        title: 'La armadura de Saúl y las piedras del arroyo',
        location: 'Tienda real y orilla del arroyo',
        narrativeAdaptation:
          'Adaptación narrativa: El rey Saúl viste a David con su propia túnica de guerra, un casco de bronce y una coraza pesada. Al intentar dar unos pasos, el joven siente que aquel equipo no le permite moverse con libertad.',
        sceneReference: '1 Samuel 17:38-40',
        scriptureNote:
          'Referencia bíblica: David se quitó la armadura porque no estaba acostumbrado a ella, tomó su cayado, cinco piedras lisas del arroyo y su honda (1 Samuel 17:39-40).',
        interactionType: 'question',
        prompt:
          'Según 1 Samuel 17:39-40, ¿por qué dejó David la armadura de Saúl y qué llevó al encuentro?',
        options: [
          {
            id: 'dg-s2-a',
            label: 'Porque no estaba acostumbrado a ella; llevó su cayado, cinco piedras lisas del arroyo y su honda',
            isBiblicallyFaithful: true,
            pointsDelta: 1000,
            consequenceText:
              'Con paso ligero, David desciende al torrente, escoge cinco piedras lisas y avanza con las herramientas que Dios ya había bendecido en el campo.',
            biblicalExplanation:
              '1 Samuel 17:39-40 indica literalmente que David no había probado esa armadura y prefirió su cayado, su zurrón pastoral, cinco piedras lisas y su honda.',
          },
          {
            id: 'dg-s2-b',
            label: 'Llevó la espada del rey escondida bajo la túnica y diez flechas de bronce',
            isBiblicallyFaithful: false,
            pointsDelta: 150,
            consequenceText:
              'Ese dato no aparece en el relato bíblico; David no confió en armas convencionales de guerra.',
            biblicalExplanation:
              'David mismo declaró en 1 Samuel 17:47 que Jehová no salva con espada ni con lanza.',
          },
          {
            id: 'dg-s2-c',
            label: 'Usó un carro de guerra prestado por el rey para acercarse rápidamente',
            isBiblicallyFaithful: false,
            pointsDelta: 100,
            consequenceText:
              'David caminó a pie hasta el arroyo y luego corrió hacia la línea de batalla.',
            biblicalExplanation:
              'En 1 Samuel 17:40, 48 David se acercó a pie con su cayado y su honda.',
          },
        ],
      },
      {
        id: 'dg-s3',
        order: 3,
        title: 'Frente al gigante en nombre de Dios',
        location: 'Centro del valle de Ela',
        narrativeAdaptation:
          'Adaptación narrativa: Goliat se burla al ver llegar a un muchacho sin escudo ni lanza. Las miradas de ambos ejércitos se clavan en aquel momento decisivo mientras David alza la voz con firmeza.',
        sceneReference: '1 Samuel 17:45-50',
        scriptureNote:
          'Referencia bíblica: David corrió al encuentro del filisteo, metió la mano en la bolsa, tomó una piedra y la tiró con la honda hiriéndolo en la frente (1 Samuel 17:48-49).',
        interactionType: 'decision',
        prompt:
          'En el momento del enfrentamiento, ¿cuál fue la declaración y acción central de David según la Escritura?',
        options: [
          {
            id: 'dg-s3-a',
            label: 'Proclamar que la batalla es de Jehová y correr con fe a lanzar la piedra con su honda',
            isBiblicallyFaithful: true,
            pointsDelta: 1200,
            consequenceText:
              'La piedra da en la frente del gigante, quien cae a tierra, confirmando ante todos que la salvación proviene del Señor y no de la fuerza humana.',
            biblicalExplanation:
              '1 Samuel 17:45-50 registra la confesión de fe de David ("de Jehová es la batalla") y cómo venció con una honda y una piedra.',
          },
          {
            id: 'dg-s3-b',
            label: 'Negociar una tregua de siete días antes de iniciar el combate',
            isBiblicallyFaithful: false,
            pointsDelta: 150,
            consequenceText:
              'No hubo tregua; David avanzó con convicción inmediata porque sabía quién peleaba por Israel.',
            biblicalExplanation:
              'Según 1 Samuel 17:48, cuando el filisteo se levantó para ir contra él, David se dio prisa y corrió hacia la línea de batalla.',
          },
          {
            id: 'dg-s3-c',
            label: 'Presumir ante ambos ejércitos de ser el mejor tirador de toda Judá',
            isBiblicallyFaithful: false,
            pointsDelta: 150,
            consequenceText:
              'La gloria de David no estaba en su puntería personal sino en el Dios viviente.',
            biblicalExplanation:
              'En 1 Samuel 17:46-47 David enfatiza: "para que toda la tierra sepa que hay Dios en Israel".',
          },
        ],
      },
    ],
    finalReflection:
      'Dios sigue preparando a jóvenes fieles en tareas sencillas antes de llamarlos a grandes desafíos. No enfrentamos nuestros temores con nuestra propia fuerza, sino confiando en el nombre del Señor.',
    keyTakeaways: [
      'La fidelidad en lo pequeño (cuidar las ovejas) prepara para desafíos mayores.',
      'No necesitamos imitar armaduras ajenas cuando Dios ya nos equipó con dones propios.',
      'Toda victoria espiritual da la gloria a Dios y anima a otros a confiar.',
    ],
  },
  {
    id: 'adv-daniel-leones',
    title: 'Daniel y los leones',
    subtitle: 'Constancia en la oración aun bajo decreto adverso',
    testament: 'Antiguo Testamento',
    ambientStyle: 'royal',
    ambientLabel: 'Corte y Fidelidad',
    accentColor: '#0284C7',
    mainReference: 'Daniel 6:1-28',
    scripturalAnchor:
      'Daniel 6:10, 22 — Cuando Daniel supo que el edicto había sido firmado, entró en su casa, y abiertas las ventanas de su cámara que daban hacia Jerusalén, se arrodillaba tres veces al día y oraba y daba gracias delante de su Dios, como lo solía hacer antes. Dios envió su ángel y cerró la boca de los leones.',
    introductionNarrative:
      'Adaptación narrativa: En el palacio de Babilonia bajo el reinado de Darío el medopersa, la integridad de Daniel como gobernador despierta la envidia de otros sátrapas. Incapaces de hallar corrupción en su trabajo, traman un decreto que prohíba orar a cualquier dios o ser humano que no sea el rey durante treinta días.',
    characters: [
      { name: 'Daniel', role: 'Estadista fiel que mantuvo su vida diaria de oración sin temor' },
      { name: 'Rey Darío', role: 'Monarca que apreciaba a Daniel pero quedó atrapado por su propio decreto' },
      { name: 'Sátrapas y gobernadores', role: 'Rivales que promovieron el edicto contra la fe de Daniel' },
    ],
    scenes: [
      {
        id: 'dl-s1',
        order: 1,
        title: 'El edicto firmado en el palacio',
        location: 'Aposento superior de Daniel',
        narrativeAdaptation:
          'Adaptación narrativa: El pregón real resuena por las plazas: quien eleve una petición a otro dios será arrojado al foso de los leones. Al caer la tarde, Daniel regresa a su casa sabiendo exactamente lo que dice la ley.',
        sceneReference: 'Daniel 6:6-10',
        scriptureNote:
          'Referencia bíblica: Daniel entró en su casa y, abiertas las ventanas hacia Jerusalén, oró y dio gracias tres veces al día como lo solía hacer antes (Daniel 6:10).',
        interactionType: 'decision',
        prompt:
          'Al enterarse del edicto firmado por el rey, ¿cómo actúa Daniel ante esta prueba de conciencia?',
        options: [
          {
            id: 'dl-s1-a',
            label: 'Mantener con humildad y constancia su costumbre de orar y dar gracias a Dios tres veces al día',
            isBiblicallyFaithful: true,
            pointsDelta: 1000,
            consequenceText:
              'Daniel no adopta una actitud provocadora ni esconde su devoción por miedo; simplemente permanece fiel a la comunión que siempre tuvo con Dios.',
            biblicalExplanation:
              'Daniel 6:10 destaca que oraba y daba gracias "como lo solía hacer antes". Su fidelidad venía de una vida constante, no de improvisación.',
          },
          {
            id: 'dl-s1-b',
            label: 'Suspender toda oración durante un mes para conservar su cargo político sin riesgos',
            isBiblicallyFaithful: false,
            pointsDelta: 150,
            consequenceText:
              'Negar la devoción al único Dios habría validado la idolatría exigida por el edicto.',
            biblicalExplanation:
              'Para Daniel, la obediencia a Dios estaba por encima de cualquier decreto humano que contradijera la adoración al Señor.',
          },
          {
            id: 'dl-s1-c',
            label: 'Huir de la ciudad esa misma noche abandonando su responsabilidad',
            isBiblicallyFaithful: false,
            pointsDelta: 200,
            consequenceText:
              'Daniel permaneció firme en su puesto y en su fe, confiando el desenlace al Señor.',
            biblicalExplanation:
              'Daniel 6:10 muestra a Daniel permaneciendo en su casa en paz, confiando en Dios.',
          },
        ],
      },
      {
        id: 'dl-s2',
        order: 2,
        title: 'La acusación ante Darío',
        location: 'Salón del trono',
        narrativeAdaptation:
          'Adaptación narrativa: Los conspiradores acuden apresurados ante Darío recordándole la ley irrevocable de los medos y los persas. El rey busca hasta la puesta del sol una salida legal para librar a su fiel colaborador, pero la presión del edicto lo acorrala.',
        sceneReference: 'Daniel 6:12-16',
        scriptureNote:
          'Referencia bíblica: El rey deseaba librar a Daniel, pero al confirmarse la ley ordenó llevarlo al foso diciendo: "El Dios tuyo, a quien tú continuamente sirves, él te libre" (Daniel 6:14, 16).',
        interactionType: 'question',
        prompt:
          '¿Qué cualidad del carácter de Daniel notó incluso el propio rey Darío antes de enviarlo al foso?',
        options: [
          {
            id: 'dl-s2-a',
            label: 'Que Daniel servía continuamente a su Dios con integridad irreprochable',
            isBiblicallyFaithful: true,
            pointsDelta: 1000,
            consequenceText:
              'El testimonio diario de Daniel habló más fuerte que mil discursos y llevó al rey a pasar la noche en vela y ayuno.',
            biblicalExplanation:
              'Daniel 6:4, 16, 18 muestra que no hallaron en Daniel vicio ni falta, y el rey reconoció su servicio continuo a Dios.',
          },
          {
            id: 'dl-s2-b',
            label: 'Que Daniel tenía un ejército secreto listo para rescatarlo',
            isBiblicallyFaithful: false,
            pointsDelta: 100,
            consequenceText:
              'Daniel no dependía de conspiraciones armadas sino del Dios viviente.',
            biblicalExplanation:
              'El rescate vino únicamente por la intervención del ángel de Dios en Daniel 6:22.',
          },
          {
            id: 'dl-s2-c',
            label: 'Que Daniel había pedido amnistía a cambio de renunciar a sus escritos',
            isBiblicallyFaithful: false,
            pointsDelta: 100,
            consequenceText:
              'Daniel no negoció sus principios ante el peligro.',
            biblicalExplanation:
              'En Daniel 6:23 se resume que "ninguna lesión se halló en él, porque había confiado en su Dios".',
          },
        ],
      },
      {
        id: 'dl-s3',
        order: 3,
        title: 'El amanecer en el foso',
        location: 'Boca del foso de los leones al alba',
        narrativeAdaptation:
          'Adaptación narrativa: Con los primeros rayos de luz, Darío corre hasta la piedra sellada y llama con voz angustiada. Desde la profundidad del foso se escucha una respuesta serena y respetuosa.',
        sceneReference: 'Daniel 6:19-24',
        scriptureNote:
          'Referencia bíblica: Daniel testificó que Dios envió su ángel, el cual cerró la boca de los leones para que no le hicieran daño, y fue sacado ileso porque confió en su Dios (Daniel 6:22-23).',
        interactionType: 'decision',
        prompt:
          'Al ser liberado al amanecer, ¿a quién atribuye Daniel su preservación y cómo responde al rey?',
        options: [
          {
            id: 'dl-s3-a',
            label: 'Saluda con respeto al rey y da toda la gloria a Dios por enviar a su ángel',
            isBiblicallyFaithful: true,
            pointsDelta: 1200,
            consequenceText:
              'El testimonio de Daniel lleva al rey Darío a reconocer públicamente el reino eterno y la grandeza del Dios viviente.',
            biblicalExplanation:
              'En Daniel 6:21-22 Daniel responde con cortesía ("Oh rey, vive para siempre") y declara que Dios envió a su ángel.',
          },
          {
            id: 'dl-s3-b',
            label: 'Reprocha amargamente al rey y promete no volver a servir en el gobierno',
            isBiblicallyFaithful: false,
            pointsDelta: 150,
            consequenceText:
              'Daniel mantuvo la mansedumbre y continuó prosperando como testimonio en el reino.',
            biblicalExplanation:
              'Daniel 6:21 y 6:28 muestran su respeto al rey y su continuidad en tiempos de Darío y Ciro.',
          },
          {
            id: 'dl-s3-c',
            label: 'Afirma que logró calmar a los leones por su propia habilidad física',
            isBiblicallyFaithful: false,
            pointsDelta: 100,
            consequenceText:
              'La Escritura aclara que el milagro fue obra directa de Dios.',
            biblicalExplanation:
              'Daniel 6:22-23 atribuye la liberación completamente a Dios y a su ángel.',
          },
        ],
      },
    ],
    finalReflection:
      'Una vida diaria de oración y excelencia en nuestras responsabilidades nos prepara para permanecer firmes cuando nuestra fe es probada ante la sociedad.',
    keyTakeaways: [
      'La constancia diaria en la oración sostiene en tiempos de crisis.',
      'La integridad en el estudio o trabajo es un testimonio silencioso muy poderoso.',
      'Dios acompaña fielmente a quienes ponen su confianza en Él.',
    ],
  },
  {
    id: 'adv-jose-hermanos',
    title: 'José y sus hermanos',
    subtitle: 'Del pozo y la traición al perdón y la provisión de Dios',
    testament: 'Antiguo Testamento',
    ambientStyle: 'desert',
    ambientLabel: 'Senda del Desierto',
    accentColor: '#EA580C',
    mainReference: 'Génesis 37, 41–45',
    scripturalAnchor:
      'Génesis 45:5, 7-8; 50:20 — José dijo a sus hermanos que no se entristecieran por haberlo vendido, porque para preservación de vida lo envió Dios delante de ellos; lo que pensaron para mal, Dios lo encaminó a bien.',
    introductionNarrative:
      'Adaptación narrativa: Vendido por sus propios hermanos rumbo a Egipto y probado durante años de servicio y cárcel injusta, José llega a ser gobernador bajo Faraón. Cuando el hambre azota Canaán, sus hermanos se inclinan ante él sin reconocerlo.',
    characters: [
      { name: 'José', role: 'Hijo de Jacob convertido en gobernador de Egipto que perdonó a su familia' },
      { name: 'Judá y los hermanos', role: 'Hermanos arrepentidos que años atrás vendieron a José' },
      { name: 'Benjamín', role: 'Hermano menor de José amado por su padre Jacob' },
    ],
    scenes: [
      {
        id: 'jh-s1',
        order: 1,
        title: 'La tentación en casa de Potifar',
        location: 'Egipto',
        narrativeAdaptation:
          'Adaptación narrativa: Aunque es esclavo lejos de su tierra, José administra con honestidad la casa de Potifar. Un día enfrenta una fuerte tentación oculta que nadie más en la casa descubriría.',
        sceneReference: 'Génesis 39:7-12',
        scriptureNote:
          'Referencia bíblica: José rehusó pecar diciendo: "¿Cómo, pues, haría yo este grande mal, y pecaría contra Dios?" (Génesis 39:9).',
        interactionType: 'decision',
        prompt:
          'Cuando nadie de su familia está mirando, ¿qué principio guía la decisión de José?',
        options: [
          {
            id: 'jh-s1-a',
            label: 'Rechazar el pecado por lealtad a Dios y fidelidad a la confianza depositada en él',
            isBiblicallyFaithful: true,
            pointsDelta: 1000,
            consequenceText:
              'Aunque sufre calumnia y prisión temporal, la presencia de Dios permanece con José en la cárcel y lo prepara para servir a toda una nación.',
            biblicalExplanation:
              'Génesis 39:9, 21 muestra que José temía a Dios en lo privado y que "Jehová estaba con José" aun en la cárcel.',
          },
          {
            id: 'jh-s1-b',
            label: 'Ceder en secreto pensando que nadie en Canaán se enterará',
            isBiblicallyFaithful: false,
            pointsDelta: 100,
            consequenceText:
              'Comprometer su conciencia habría roto la integridad que caracterizó toda su vida.',
            biblicalExplanation:
              'José reconoció en Génesis 39:9 que todo pecado es primeramente delante de Dios.',
          },
          {
            id: 'jh-s1-c',
            label: 'Exigir dinero a Potifar para guardar silencio',
            isBiblicallyFaithful: false,
            pointsDelta: 100,
            consequenceText:
              'José huyó de la tentación con limpieza moral.',
            biblicalExplanation:
              'En Génesis 39:12 José dejó su ropa en mano de ella y huyó fuera.',
          },
        ],
      },
      {
        id: 'jh-s2',
        order: 2,
        title: 'El reencuentro en Egipto',
        location: 'Palacio de administración del trigo',
        narrativeAdaptation:
          'Adaptación narrativa: Años después, los hermanos de José llegan pidiendo alimento. Ahora José tiene poder absoluto para castigarlos o probar si su corazón ha cambiado de verdad.',
        sceneReference: 'Génesis 44:18-34; 45:1-8',
        scriptureNote:
          'Referencia bíblica: Judá se ofreció como siervo en lugar de Benjamín por amor a su padre; entonces José no pudo contenerse, se dio a conocer llorando y los perdonó (Génesis 44:33; 45:1-5).',
        interactionType: 'question',
        prompt:
          'Al ver el arrepentimiento de sus hermanos y el sacrificio de Judá por Benjamín, ¿qué hizo José?',
        options: [
          {
            id: 'jh-s2-a',
            label: 'Se dio a conocer con lágrimas, los perdonó y reconoció que Dios lo envió para preservar vidas',
            isBiblicallyFaithful: true,
            pointsDelta: 1200,
            consequenceText:
              'El perdón sana una herida de décadas, reúne a Jacob con su hijo y salva del hambre a toda la familia del pacto.',
            biblicalExplanation:
              'Génesis 45:1-8 narra cómo José consoló a sus hermanos explicando el propósito providencial de Dios.',
          },
          {
            id: 'jh-s2-b',
            label: 'Los encarceló de por vida en venganza por lo que hicieron en Dotán',
            isBiblicallyFaithful: false,
            pointsDelta: 100,
            consequenceText:
              'José eligió la misericordia en lugar del rencor.',
            biblicalExplanation:
              'Génesis 45:5 y 50:19 muestran que José rechazó tomar el lugar de juez vengativo.',
          },
          {
            id: 'jh-s2-c',
            label: 'Les vendió grano al triple del precio sin revelar jamás su identidad',
            isBiblicallyFaithful: false,
            pointsDelta: 150,
            consequenceText:
              'José mandó devolver su dinero y luego trajo a toda su familia a vivir en Gosén.',
            biblicalExplanation:
              'Génesis 45:9-11 relata la invitación amorosa de José para cuidar de su padre y hermanos.',
          },
        ],
      },
    ],
    finalReflection:
      'Las heridas más difíciles pueden transformarse en instrumentos de servicio cuando caminamos con integridad y dejamos la justicia y el perdón en manos de Dios.',
    keyTakeaways: [
      'La pureza moral se demuestra cuando nadie nos observa.',
      'Perdonar libera el corazón y restaura familias.',
      'Dios puede tornar en bien aun las pruebas injustas (Génesis 50:20).',
    ],
  },
  {
    id: 'adv-ester-mision',
    title: 'Ester y su misión',
    subtitle: 'Valentía y ayuno: ¿y si para esta hora has llegado al reino?',
    testament: 'Antiguo Testamento',
    ambientStyle: 'royal',
    ambientLabel: 'Corte y Fidelidad',
    accentColor: '#7C3AED',
    mainReference: 'Ester 4:1–7:10',
    scripturalAnchor:
      'Ester 4:14, 16 — Mardoqueo envió a decir a Ester: "¿Y quién sabe si para esta hora has llegado al reino?" Ester pidió que ayunaran por ella tres días y respondió: "Y si perezco, que perezca".',
    introductionNarrative:
      'Adaptación narrativa: Un decreto firmado en Susa amenaza la vida de todo el pueblo judío. Dentro del palacio, la reina Ester disfruta de seguridad aparente, pero Mardoqueo le recuerda que su posición no es casualidad sino una oportunidad dada por Dios.',
    characters: [
      { name: 'Ester', role: 'Reina que arriesgó su vida para interceder por su pueblo' },
      { name: 'Mardoqueo', role: 'Pariente fiel que animó a Ester a cumplir su propósito' },
      { name: 'Rey Asuero', role: 'Monarca ante quien Ester se presentó sin ser llamada' },
    ],
    scenes: [
      {
        id: 'em-s1',
        order: 1,
        title: 'El llamado urgente de Mardoqueo',
        location: 'Aposentos reales de Susa',
        narrativeAdaptation:
          'Adaptación narrativa: Nadie puede entrar al patio interior del rey sin ser llamado bajo pena de muerte, salvo que el monarca extienda su cetro de oro. Ester sabe que lleva treinta días sin ser convocada.',
        sceneReference: 'Ester 4:10-16',
        scriptureNote:
          'Referencia bíblica: Ester pidió ayuno comunitario de tres días sin comer ni beber antes de entrar ante el rey conforme a su decisión valiente (Ester 4:16).',
        interactionType: 'decision',
        prompt:
          'Antes de acudir ante el rey arriesgando su vida, ¿qué preparación espiritual busca Ester?',
        options: [
          {
            id: 'em-s1-a',
            label: 'Convocar a todo el pueblo judío en Susa a tres días de ayuno junto con ella y sus doncellas',
            isBiblicallyFaithful: true,
            pointsDelta: 1000,
            consequenceText:
              'Unida en oración y ayuno con su comunidad, Ester vence el temor y se dispone a presentarse delante del rey.',
            biblicalExplanation:
              'Ester 4:16 registra su petición de ayuno solidario antes de dar el paso decisivo.',
          },
          {
            id: 'em-s1-b',
            label: 'Guardar silencio dentro del palacio esperando que el decreto se olvide solo',
            isBiblicallyFaithful: false,
            pointsDelta: 100,
            consequenceText:
              'Callar en tiempos críticos habría dejado indefensa a su comunidad.',
            biblicalExplanation:
              'Mardoqueo advirtió en Ester 4:14 que la liberación vendría de otra parte si ella callaba completamente.',
          },
          {
            id: 'em-s1-c',
            label: 'Entrar impulsivamente sin pedir oración ni planificar cómo hablar al rey',
            isBiblicallyFaithful: false,
            pointsDelta: 200,
            consequenceText:
              'Ester unió la valentía con la dependencia espiritual y la prudencia.',
            biblicalExplanation:
              'En Ester 4:16 y 5:4-8 combinó el ayuno espiritual con sabiduría al invitar al rey y a Amán.',
          },
        ],
      },
      {
        id: 'em-s2',
        order: 2,
        title: 'El cetro extendido y la verdad',
        location: 'Patio interior y sala del banquete',
        narrativeAdaptation:
          'Adaptación narrativa: Al tercer día, Ester se viste con sus ropas reales y avanza hacia el patio interior. El silencio llena el salón mientras las miradas siguen al rey en su trono.',
        sceneReference: 'Ester 5:1-3; 7:3-6',
        scriptureNote:
          'Referencia bíblica: Cuando el rey vio a la reina Ester, ella obtuvo gracia ante sus ojos y le extendió el cetro de oro; luego expuso con claridad la amenaza contra su pueblo (Ester 5:2; 7:3-4).',
        interactionType: 'question',
        prompt:
          '¿Qué pidió finalmente Ester al rey durante el segundo banquete en Ester 7:3?',
        options: [
          {
            id: 'em-s2-a',
            label: 'Su propia vida y la vida de su pueblo, exponiendo con verdad el complot de Amán',
            isBiblicallyFaithful: true,
            pointsDelta: 1200,
            consequenceText:
              'El rey escucha su clamor, se descubre la injusticia y el pueblo judío recibe derecho a defenderse y vivir.',
            biblicalExplanation:
              'Ester 7:3 dice textualmente: "Séame dada mi vida por mi petición, y mi pueblo por mi demanda".',
          },
          {
            id: 'em-s2-b',
            label: 'Más riquezas y provincias para su palacio personal',
            isBiblicallyFaithful: false,
            pointsDelta: 100,
            consequenceText:
              'Ester no buscó beneficio personal; intercedió por toda su nación.',
            biblicalExplanation:
              'Ester 7:3-4 muestra su amor solidario por la salvación de su pueblo.',
          },
          {
            id: 'em-s2-c',
            label: 'Permiso para abandonar Susa e irse a vivir a otra región sola',
            isBiblicallyFaithful: false,
            pointsDelta: 100,
            consequenceText:
              'Ester permaneció en su lugar de influencia hasta ver asegurada la paz de su pueblo.',
            biblicalExplanation:
              'En Ester 8:3-8 Ester siguió intercediendo hasta que se revocó el peligro sobre los judíos.',
          },
        ],
      },
    ],
    finalReflection:
      'Cada lugar de estudio, iglesia o trabajo donde Dios nos coloca tiene un propósito. Cuando oramos y actuamos con valor, podemos ser bendición para muchas personas.',
    keyTakeaways: [
      'Los privilegios y oportunidades son llamados a servir a otros.',
      'El ayuno y la oración preceden a las decisiones valientes.',
      'La prudencia y el valor van de la mano en la obra de Dios.',
    ],
  },
  {
    id: 'adv-moises-israel',
    title: 'Moisés y el pueblo de Israel',
    subtitle: 'Confianza en el Señor frente al Mar Rojo',
    testament: 'Antiguo Testamento',
    ambientStyle: 'desert',
    ambientLabel: 'Senda del Desierto',
    accentColor: '#0EA5E9',
    mainReference: 'Éxodo 14:1-31',
    scripturalAnchor:
      'Éxodo 14:13-14 — Moisés dijo al pueblo: "No temáis; estad firmes, y ved la salvación que Jehová hará hoy con vosotros... Jehová peleará por vosotros, y vosotros estaréis tranquilos".',
    introductionNarrative:
      'Adaptación narrativa: Recién salidos de Egipto, los israelitas acampan junto a la orilla del Mar Rojo. De pronto, el horizonte se llena de polvo: los carros de Faraón se acercan velozmente por la retaguardia. Frente a ellos, solo hay agua profunda; detrás, persecución.',
    characters: [
      { name: 'Moisés', role: 'Líder escogido por Dios para guiar a Israel fuera de la esclavitud' },
      { name: 'Pueblo de Israel', role: 'Multitud liberada que debía aprender a confiar en Dios' },
      { name: 'Ángel de Dios / Columna de nube', role: 'Presencia protectora que separó a Egipto de Israel' },
    ],
    scenes: [
      {
        id: 'mi-s1',
        order: 1,
        title: 'Encerrados frente al mar',
        location: 'Orilla de Pi-hahirot junto al Mar Rojo',
        narrativeAdaptation:
          'Adaptación narrativa: Algunos claman asustados que habría sido mejor permanecer sirviendo en Egipto antes que morir en el desierto. Las miradas de miles de familias se vuelven hacia Moisés buscando dirección.',
        sceneReference: 'Éxodo 14:10-15',
        scriptureNote:
          'Referencia bíblica: Moisés animó al pueblo a no temer y ver la salvación de Jehová, y Dios dijo a Moisés: "Di a los hijos de Israel que marchen" (Éxodo 14:13, 15).',
        interactionType: 'decision',
        prompt:
          'Cuando el pueblo entra en pánico ante el mar y el ejército perseguidor, ¿qué responde Moisés y qué ordena Dios?',
        options: [
          {
            id: 'mi-s1-a',
            label: 'Llamar al pueblo a estar firme sin temor mientras Dios abre camino para marchar adelante',
            isBiblicallyFaithful: true,
            pointsDelta: 1000,
            consequenceText:
              'La columna de nube se interpone entre ambos campamentos durante la noche y Moisés extiende su vara sobre el mar conforme a la palabra de Dios.',
            biblicalExplanation:
              'Éxodo 14:13-16 une la exhortación de fe ("estad firmes") con el paso obediente ("di a los hijos de Israel que marchen").',
          },
          {
            id: 'mi-s1-b',
            label: 'Rendirse ante Faraón para regresar pacíficamente a la esclavitud',
            isBiblicallyFaithful: false,
            pointsDelta: 100,
            consequenceText:
              'Dios no los sacó de Egipto con brazo extendido para devolverlos a la servidumbre.',
            biblicalExplanation:
              'En Éxodo 14:13 Moisés afirmó: "porque los egipcios que hoy habéis visto, nunca más para siempre los veréis".',
          },
          {
            id: 'mi-s1-c',
            label: 'Construir balsas improvisadas esa noche sin esperar la instrucción del Señor',
            isBiblicallyFaithful: false,
            pointsDelta: 150,
            consequenceText:
              'La solución humana habría sido insuficiente; Dios preparaba una liberación imposible para el hombre.',
            biblicalExplanation:
              'Éxodo 14:21 muestra que Jehová hizo retirar el mar mediante un recio viento oriental toda aquella noche.',
          },
        ],
      },
      {
        id: 'mi-s2',
        order: 2,
        title: 'El paso en seco y el cántico de liberación',
        location: 'Lecho seco del Mar Rojo y la otra orilla',
        narrativeAdaptation:
          'Adaptación narrativa: Un muro de agua se levanta a diestra y siniestra mientras hombres, mujeres y niños avanzan por tierra seca en medio de la noche iluminada por la columna de fuego.',
        sceneReference: 'Éxodo 14:22-31; 15:1-2',
        scriptureNote:
          'Referencia bíblica: Los hijos de Israel entraron por en medio del mar, en seco; al amanecer fueron salvos y cantaron: "Jehová es mi fortaleza y mi cántico" (Éxodo 14:22, 30; 15:2).',
        interactionType: 'question',
        prompt:
          'Según Éxodo 14:31 y 15:1, ¿qué produjo en Israel ver la gran obra que Jehová hizo contra los egipcios?',
        options: [
          {
            id: 'mi-s2-a',
            label: 'El pueblo temió a Jehová, creyó en Él y en Moisés su siervo, y entonó un cántico de alabanza',
            isBiblicallyFaithful: true,
            pointsDelta: 1200,
            consequenceText:
              'A la orilla opuesta, Moisés, María y todo el pueblo elevan un himno de gratitud recordando las maravillas de Dios.',
            biblicalExplanation:
              'Éxodo 14:31 y 15:1-21 relatan la fe renovada de Israel y el cántico dirigido por Moisés y María la profetisa.',
          },
          {
            id: 'mi-s2-b',
            label: 'Decidieron regresar a Egipto para conquistar sus palacios',
            isBiblicallyFaithful: false,
            pointsDelta: 100,
            consequenceText:
              'Israel siguió su marcha hacia el desierto de Shur rumbo a Sinaí.',
            biblicalExplanation:
              'Éxodo 15:22 indica que Moisés hizo partir a Israel del Mar Rojo hacia el desierto.',
          },
          {
            id: 'mi-s2-c',
            label: 'Guardaron silencio total durante siete semanas por tristeza',
            isBiblicallyFaithful: false,
            pointsDelta: 100,
            consequenceText:
              'Al contrario, celebraron con panderos, danzas y alabanza.',
            biblicalExplanation:
              'Éxodo 15:1, 20 registra inmediatamente el cántico de gratitud.',
          },
        ],
      },
    ],
    finalReflection:
      'Cuando delante parece haber un obstáculo imposible y detrás persigue la dificultad, Dios abre sendas donde no existían para quienes confían y avanzan conforme a Su palabra.',
    keyTakeaways: [
      'En los momentos sin salida humana se manifiesta el poder de Dios.',
      'La fe escucha la promesa de Dios y da el paso de obediencia.',
      'Nunca debemos olvidar agradecer con alabanza por las liberaciones recibidas.',
    ],
  },
  {
    id: 'adv-rut-noemi',
    title: 'Rut y Noemí',
    subtitle: 'Lealtad, fe y redención en tiempos difíciles',
    testament: 'Antiguo Testamento',
    ambientStyle: 'pastoral',
    ambientLabel: 'Prados de Gracia',
    accentColor: '#10B981',
    mainReference: 'Rut 1:1–4:17',
    scripturalAnchor:
      'Rut 1:16 — Respondió Rut: "No me ruegues que te deje, y me aparte de ti; porque a dondequiera que tú fueres, iré yo, y dondequiera que vivieres, viviré. Tu pueblo será mi pueblo, y tu Dios será mi Dios".',
    introductionNarrative:
      'Adaptación narrativa: Tras diez años en Moab y la pérdida de su esposo y sus dos hijos, Noemí decide regresar a Belén al enterarse de que el Señor ha bendecido nuevamente la tierra con pan. En el camino, insta a sus nueras a volver con sus familias.',
    characters: [
      { name: 'Rut', role: 'Joven moabita cuya lealtad y fe en Dios fueron ejemplo en Israel' },
      { name: 'Noemí', role: 'Suegra de Rut que regresó a Belén tras el duelo' },
      { name: 'Booz', role: 'Pariente generoso y redentor en Belén que protegió a Rut y Noemí' },
    ],
    scenes: [
      {
        id: 'rn-s1',
        order: 1,
        title: 'La encrucijada camino a Judá',
        location: 'Sendero entre Moab y Judá',
        narrativeAdaptation:
          'Adaptación narrativa: Noemí besa con lágrimas a sus dos nueras y les dice que regresen a casa de sus madres. Orfa se despide entre sollozos, pero Rut permanece aferrada al lado de Noemí.',
        sceneReference: 'Rut 1:14-18',
        scriptureNote:
          'Referencia bíblica: Rut se quedó con Noemí declarando que su pueblo sería su pueblo y su Dios sería su Dios (Rut 1:14, 16).',
        interactionType: 'decision',
        prompt:
          'Frente a un futuro incierto junto a una viuda anciana en tierra extranjera, ¿qué motiva la decisión de Rut?',
        options: [
          {
            id: 'rn-s1-a',
            label: 'Un amor leal hacia Noemí y una fe genuina en el Dios de Israel',
            isBiblicallyFaithful: true,
            pointsDelta: 1000,
            consequenceText:
              'Juntas llegan a Belén en el tiempo de la siega de la cebada, y la fidelidad de Rut pronto es conocida por toda la ciudad.',
            biblicalExplanation:
              'En Rut 1:16 y 2:12 se resalta tanto su bondad hacia Noemí como el haberse acogido "bajo las alas de Jehová Dios de Israel".',
          },
          {
            id: 'rn-s1-b',
            label: 'La promesa de una herencia millonaria inmediata en Belén',
            isBiblicallyFaithful: false,
            pointsDelta: 100,
            consequenceText:
              'Noemí misma le advirtió que no tenía bienes ni hijos qué ofrecer; llegaron con gran pobreza.',
            biblicalExplanation:
              'En Rut 1:21 Noemí expresó haber vuelto "con las manos vacías".',
          },
          {
            id: 'rn-s1-c',
            label: 'El deseo de regresar a Moab después de un par de días',
            isBiblicallyFaithful: false,
            pointsDelta: 100,
            consequenceText:
              'El voto de Rut fue de por vida ("donde tú murieres, moriré yo").',
            biblicalExplanation:
              'Rut 1:17 confirma su compromiso definitivo.',
          },
        ],
      },
      {
        id: 'rn-s2',
        order: 2,
        title: 'Espigando en el campo de Booz',
        location: 'Campos de cebada en Belén',
        narrativeAdaptation:
          'Adaptación narrativa: Para sustentar a Noemí y a sí misma, Rut sale humildemente a recoger espigas tras los segadores, conforme a la ley de Israel para los necesitados y extranjeros.',
        sceneReference: 'Rut 2:2-12',
        scriptureNote:
          'Referencia bíblica: Booz trató con bondad a Rut al saber todo lo que había hecho por su suegra y pidió que Jehová recompensara su obra (Rut 2:11-12).',
        interactionType: 'question',
        prompt:
          '¿Cómo culmina la historia de fidelidad de Rut, Noemí y Booz en Rut 4:13-17?',
        options: [
          {
            id: 'rn-s2-a',
            label: 'Booz redime la heredad y se casa con Rut; su hijo Obed llegó a ser abuelo del rey David',
            isBiblicallyFaithful: true,
            pointsDelta: 1200,
            consequenceText:
              'La tristeza de Noemí se transforma en gozo al sostener a su nieto Obed, y Rut pasa a formar parte de la genealogía del Mesías.',
            biblicalExplanation:
              'Rut 4:13-17 registra el nacimiento de Obed, padre de Isaí, padre de David (también mencionado en Mateo 1:5).',
          },
          {
            id: 'rn-s2-b',
            label: 'Rut regresa sola a Moab tras terminar la cosecha de cebada',
            isBiblicallyFaithful: false,
            pointsDelta: 100,
            consequenceText:
              'Rut permaneció en Belén formando un hogar bendecido con Booz.',
            biblicalExplanation:
              'Rut 4:13 confirma su matrimonio con Booz y la bendición de Dios.',
          },
          {
            id: 'rn-s2-c',
            label: 'Booz prohíbe a los pobres recoger espigas en sus tierras',
            isBiblicallyFaithful: false,
            pointsDelta: 100,
            consequenceText:
              'Al contrario, Booz fue aún más generoso dejando caer manojos adrede para ayudarla.',
            biblicalExplanation:
              'Rut 2:15-16 muestra la generosidad de Booz.',
          },
        ],
      },
    ],
    finalReflection:
      'La lealtad familiar, el trabajo humilde y la fe sincera en Dios nunca pasan desapercibidos delante de Él; quien se refugia bajo Sus alas recibe gracia abundante.',
    keyTakeaways: [
      'Acompañar y cuidar al necesitado refleja el amor de Dios.',
      'La diligencia y humildad abren puertas de provisión.',
      'Dios integra en Su gran plan aun a quienes parecían extranjeros o sin esperanza.',
    ],
  },
  {
    id: 'adv-nehemias',
    title: 'Nehemías',
    subtitle: 'Oración, planificación y manos firmes para reconstruir',
    testament: 'Antiguo Testamento',
    ambientStyle: 'heroic',
    ambientLabel: 'Arpa y Valor Épico',
    accentColor: '#059669',
    mainReference: 'Nehemías 1:1–6:16',
    scripturalAnchor:
      'Nehemías 2:17-18; 6:3 — Dijo Nehemías: "Venid, y edifiquemos el muro de Jerusalén, y no estemos más en oprobio". Ante las distracciones respondió: "Yo hago una gran obra, y no puedo ir".',
    introductionNarrative:
      'Adaptación narrativa: Al escuchar que los muros de Jerusalén siguen derribados y sus puertas quemadas, Nehemías —copero del rey Artajerjes en Susa— llora, ayuna y ora. Con el favor de Dios viaja a Judá para organizar una obra colectiva sin precedentes.',
    characters: [
      { name: 'Nehemías', role: 'Líder de oración y acción que dirigió la reconstrucción de los muros' },
      { name: 'Familias de Jerusalén', role: 'Obreros que trabajaron hombro a hombro cada uno frente a su casa' },
      { name: 'Sanbalat y Tobías', role: 'Opositores que intentaron desanimar y distraer la obra' },
    ],
    scenes: [
      {
        id: 'nh-s1',
        order: 1,
        title: 'La carga por la ciudad y la oración',
        location: 'Palacio de Susa y Jerusalén de noche',
        narrativeAdaptation:
          'Adaptación narrativa: Antes de proponer soluciones rápidas, Nehemías ora por días confesando pecados y confiando en las promesas de Dios. Ya en Jerusalén, inspecciona en silencio las ruinas durante la noche.',
        sceneReference: 'Nehemías 1:4-11; 2:11-18',
        scriptureNote:
          'Referencia bíblica: Nehemías oró antes de hablar al rey y luego compartió con el pueblo la mano benéfica de Dios animándolos a edificar (Nehemías 1:4; 2:4, 18).',
        interactionType: 'decision',
        prompt:
          'Cuando un proyecto en la iglesia o sociedad juvenil enfrenta grandes necesidades, ¿qué ejemplo práctico deja Nehemías?',
        options: [
          {
            id: 'nh-s1-a',
            label: 'Orar primero con sinceridad, evaluar la situación con sabiduría y motivar el trabajo unido',
            isBiblicallyFaithful: true,
            pointsDelta: 1000,
            consequenceText:
              'El pueblo responde con entusiasmo diciendo "Levantémonos y edifiquemos", y cada familia asume un tramo de la muralla.',
            biblicalExplanation:
              'Nehemías 1–3 muestra el equilibrio entre oración constante, inspección cuidadosa y organización comunitaria.',
          },
          {
            id: 'nh-s1-b',
            label: 'Criticar a los habitantes anteriores sin participar en el trabajo',
            isBiblicallyFaithful: false,
            pointsDelta: 100,
            consequenceText:
              'La crítica sin compromiso no levanta una sola piedra.',
            biblicalExplanation:
              'Nehemías se incluyó con el pueblo diciendo "edifiquemos" en primera persona plural (Nehemías 2:17).',
          },
          {
            id: 'nh-s1-c',
            label: 'Esperar a tener cero dificultades y apoyo de los enemigos antes de empezar',
            isBiblicallyFaithful: false,
            pointsDelta: 150,
            consequenceText:
              'La obra se levantó en medio de oposición constante gracias a la fe y vigilancia.',
            biblicalExplanation:
              'En Nehemías 4:9 oraron a Dios y pusieron guarda de día y de noche.',
          },
        ],
      },
      {
        id: 'nh-s2',
        order: 2,
        title: 'Firmeza frente a burlas y distracciones',
        location: 'Muralla de Jerusalén',
        narrativeAdaptation:
          'Adaptación narrativa: Al ver avanzar la construcción, Sanbalat y Tobías primero se burlan y luego envían invitaciones insistentes para hacer bajar a Nehemías al valle de Ono con el fin de detener la obra.',
        sceneReference: 'Nehemías 4:6-9; 6:1-16',
        scriptureNote:
          'Referencia bíblica: Nehemías respondió: "Yo hago una gran obra, y no puedo ir; porque cesaría la obra, dejándola yo para ir a vosotros" y el muro se terminó en 52 días (Nehemías 6:3, 15).',
        interactionType: 'question',
        prompt:
          'Según Nehemías 6:15-16, ¿en cuánto tiempo fue terminado el muro y qué reconocieron incluso las naciones vecinas?',
        options: [
          {
            id: 'nh-s2-a',
            label: 'En 52 días; comprendieron que por Dios había sido hecha aquella obra',
            isBiblicallyFaithful: true,
            pointsDelta: 1200,
            consequenceText:
              'Con el muro concluido, Esdras lee la Ley ante todo el pueblo reunido y celebran con gozo espiritual.',
            biblicalExplanation:
              'Nehemías 6:15-16 especifica los 52 días y que aun sus enemigos reconocieron la mano de Dios.',
          },
          {
            id: 'nh-s2-b',
            label: 'En 12 años porque abandonaron los trabajos por causa de las cartas',
            isBiblicallyFaithful: false,
            pointsDelta: 100,
            consequenceText:
              'El trabajo nunca se detuvo por las distracciones de Sanbalat.',
            biblicalExplanation:
              'Nehemías 6:3-4 registra que rechazó cuatro veces bajar del muro.',
          },
          {
            id: 'nh-s2-c',
            label: 'Solo reconstruyeron una puerta debido a la falta de obreros',
            isBiblicallyFaithful: false,
            pointsDelta: 100,
            consequenceText:
              'Toda la muralla quedó unida y completada.',
            biblicalExplanation:
              'Nehemías 4:6 y 6:1 confirman que el pueblo tuvo ánimo para trabajar y no quedó portillo en el muro.',
          },
        ],
      },
    ],
    finalReflection:
      'Cuando los jóvenes unen la oración ferviente con el trabajo disciplinado y evitan las distracciones, Dios bendice obras que parecen imposibles.',
    keyTakeaways: [
      'Orar y planificar trabajan juntos en el servicio cristiano.',
      'Mantener el enfoque frente a críticas o distracciones es clave ("Hago una gran obra").',
      'La unidad de la iglesia logra en semanas lo que parecía estancado por años.',
    ],
  },
  {
    id: 'adv-buen-samaritano',
    title: 'El buen samaritano',
    subtitle: '¿Quién es mi prójimo? Misericordia en el camino a Jericó',
    testament: 'Nuevo Testamento',
    ambientStyle: 'pastoral',
    ambientLabel: 'Prados de Gracia',
    accentColor: '#14B8A6',
    mainReference: 'Lucas 10:25-37',
    scripturalAnchor:
      'Lucas 10:33, 36-37 — Un samaritano que iba de camino vino cerca de él, y viéndole, fue movido a misericordia. Jesús concluyó: "Ve, y haz tú lo mismo".',
    introductionNarrative:
      'Adaptación narrativa: En respuesta a un intérprete de la ley que deseaba justificarse preguntando "¿Y quién es mi prójimo?", Jesús relata una parábola situada en el peligroso descenso empinado entre Jerusalén y Jericó.',
    characters: [
      { name: 'Jesús', role: 'Maestro que enseñó el verdadero alcance del amor al prójimo' },
      { name: 'El viajero herido', role: 'Hombre asaltado y dejado medio muerto en el camino' },
      { name: 'El samaritano', role: 'Forastero que actuó con compasión práctica y generosidad' },
    ],
    scenes: [
      {
        id: 'bs-s1',
        order: 1,
        title: 'El herido junto al sendero',
        location: 'Camino solitario de Jerusalén a Jericó',
        narrativeAdaptation:
          'Adaptación narrativa: Un hombre yace golpeado al borde del camino tras ser atacado por ladrones. Dos viajeros religiosos pasan por el mismo lugar, miran de lejos y siguen de largo por la acera opuesta.',
        sceneReference: 'Lucas 10:30-35',
        scriptureNote:
          'Referencia bíblica: El samaritano se acercó, vendó sus heridas echándoles aceite y vino, lo puso en su cabalgadura, lo llevó al mesón y cuidó de él (Lucas 10:33-34).',
        interactionType: 'decision',
        prompt:
          'Al encontrar a alguien en necesidad aunque pertenezca a otro grupo o cueste tiempo y recursos, ¿qué enseña la acción del samaritano?',
        options: [
          {
            id: 'bs-s1-a',
            label: 'Acercarse con misericordia activa, atender sus heridas y cubrir lo necesario para su cuidado',
            isBiblicallyFaithful: true,
            pointsDelta: 1000,
            consequenceText:
              'La compasión pasa de la emoción a hechos concretos: cuidado personal, transporte, hospedaje y compromiso económico hasta su recuperación.',
            biblicalExplanation:
              'Lucas 10:33-35 detalla cinco acciones concretas de amor práctico realizadas por el samaritano.',
          },
          {
            id: 'bs-s1-b',
            label: 'Pasar de largo diciendo que alguien más tiene la responsabilidad de ayudarlo',
            isBiblicallyFaithful: false,
            pointsDelta: 100,
            consequenceText:
              'Esa indiferencia reflejó la actitud de quienes pasaron de largo en la parábola.',
            biblicalExplanation:
              'En Lucas 10:31-32 el sacerdote y el levita pasaron de largo sin socorrerlo.',
          },
          {
            id: 'bs-s1-c',
            label: 'Preguntar primero si el herido merece ayuda por su origen o profesión',
            isBiblicallyFaithful: false,
            pointsDelta: 100,
            consequenceText:
              'Jesús rompió las barreras culturales al poner por ejemplo a un samaritano.',
            biblicalExplanation:
              'El amor al prójimo según Lucas 10:36-37 no discrimina por fronteras sociales ni culturales.',
          },
        ],
      },
      {
        id: 'bs-s2',
        order: 2,
        title: 'La pregunta de Jesús al corazón',
        location: 'Diálogo con el intérprete de la ley',
        narrativeAdaptation:
          'Adaptación narrativa: Terminado el relato, el Señor vuelve la mirada hacia quien le preguntó al inicio y le pide identificar quién demostró ser verdadero prójimo del hombre caído.',
        sceneReference: 'Lucas 10:36-37',
        scriptureNote:
          'Referencia bíblica: El intérprete respondió: "El que usó de misericordia con él". Entonces Jesús le dijo: "Ve, y haz tú lo mismo" (Lucas 10:37).',
        interactionType: 'question',
        prompt:
          '¿Cuál fue la conclusión práctica con la que Jesús cerró la parábola en Lucas 10:37?',
        options: [
          {
            id: 'bs-s2-a',
            label: 'Reconocer que el prójimo es quien muestra misericordia y obedecer: "Ve, y haz tú lo mismo"',
            isBiblicallyFaithful: true,
            pointsDelta: 1200,
            consequenceText:
              'La enseñanza deja de ser una discusión teórica y se convierte en una misión diaria de servicio cristiano.',
            biblicalExplanation:
              'Lucas 10:37 transforma el conocimiento de la Ley en servicio activo ("Ve, y haz tú lo mismo").',
          },
          {
            id: 'bs-s2-b',
            label: 'Memorizar las distancias del camino a Jericó sin ayudar a nadie',
            isBiblicallyFaithful: false,
            pointsDelta: 100,
            consequenceText:
              'Jesús llamó a la práctica de la misericordia, no solo al debate.',
            biblicalExplanation:
              'Lucas 10:28, 37 enfatiza el hacer ("Haz esto... Ve, y haz tú lo mismo").',
          },
          {
            id: 'bs-s2-c',
            label: 'Limitar la ayuda únicamente a quienes ya son amigos cercanos',
            isBiblicallyFaithful: false,
            pointsDelta: 100,
            consequenceText:
              'La parábola demostró justamente lo contrario al elegir a un samaritano ayudando a un desconocido.',
            biblicalExplanation:
              'Lucas 10:33-37 amplía el concepto de prójimo a todo necesitado en nuestro camino.',
          },
        ],
      },
    ],
    finalReflection:
      'La pregunta más importante no es quién merece ser nuestro prójimo, sino si estamos dispuestos a ser prójimos compasivos para quien Dios ponga en nuestro camino hoy.',
    keyTakeaways: [
      'La verdadera fe se expresa en misericordia tangible.',
      'El servicio cristiano supera prejuicios y barreras.',
      'Escuchar la Palabra nos llama siempre a actuar: "Ve, y haz tú lo mismo".',
    ],
  },
  {
    id: 'adv-hijo-prodigo',
    title: 'El hijo pródigo',
    subtitle: 'Arrepentimiento sincero y el abrazo incomparable del Padre',
    testament: 'Nuevo Testamento',
    ambientStyle: 'pastoral',
    ambientLabel: 'Prados de Gracia',
    accentColor: '#EC4899',
    mainReference: 'Lucas 15:11-32',
    scripturalAnchor:
      'Lucas 15:20-24 — Cuando aún estaba lejos, lo vio su padre, y fue movido a misericordia, y corrió, y se echó sobre su cuello, y le besó... "porque este mi hijo muerto era, y ha revivido; se había perdido, y es hallado".',
    introductionNarrative:
      'Adaptación narrativa: Frente a quienes murmuraban porque Jesús recibía a los pecadores y comía con ellos, el Señor contó la parábola de un padre con dos hijos: uno que se alejó malgastando su herencia en tierra lejana, y otro que permaneció en casa pero luchaba con el rencor.',
    characters: [
      { name: 'El Padre', role: 'Imagen del amor compasivo de Dios que espera y restaura al arrepentido' },
      { name: 'El Hijo Menor', role: 'Joven que volvió en sí y regresó con humildad pidiendo perdón' },
      { name: 'El Hijo Mayor', role: 'Hermano que debía aprender a alegrarse por la gracia del Padre' },
    ],
    scenes: [
      {
        id: 'hp-s1',
        order: 1,
        title: 'Volver en sí en la provincia apartada',
        location: 'Campos lejanos donde apacentaba cerdos',
        narrativeAdaptation:
          'Adaptación narrativa: Habiendo malgastado todos sus bienes y sintiendo hambre extrema en tierra lejana, el joven recuerda la abundancia y bondad del hogar de su padre.',
        sceneReference: 'Lucas 15:17-19',
        scriptureNote:
          'Referencia bíblica: Volviendo en sí dijo: "Me levantaré e iré a mi padre, y le diré: Padre, he pecado contra el cielo y contra ti. Ya no soy digno de ser llamado tu hijo" (Lucas 15:17-19).',
        interactionType: 'decision',
        prompt:
          'Al reconocer su error lejos de casa, ¿qué paso demuestra un arrepentimiento genuino?',
        options: [
          {
            id: 'hp-s1-a',
            label: 'Reconocer su pecado sin excusas, levantarse y regresar con humildad al Padre',
            isBiblicallyFaithful: true,
            pointsDelta: 1000,
            consequenceText:
              'Aun antes de que alcance a terminar su discurso de confesión, el Padre corre a su encuentro, lo abraza y restaura su dignidad de hijo.',
            biblicalExplanation:
              'Lucas 15:18-22 muestra que el arrepentimiento verdadero implica confesar la falta con humildad y dar pasos de regreso hacia el Padre.',
          },
          {
            id: 'hp-s1-b',
            label: 'Permanecer lejos por vergüenza pensando que Dios jamás perdona',
            isBiblicallyFaithful: false,
            pointsDelta: 100,
            consequenceText:
              'La culpa sin regreso habría privado al joven del abrazo restaurador del Padre.',
            biblicalExplanation:
              'En Lucas 15:20 el Padre ya lo estaba esperando y salió corriendo al verlo lejos.',
          },
          {
            id: 'hp-s1-c',
            label: 'Regresar exigiendo una nueva parte de la herencia como si nada hubiera ocurrido',
            isBiblicallyFaithful: false,
            pointsDelta: 100,
            consequenceText:
              'Sin humildad no hay verdadera restauración del corazón.',
            biblicalExplanation:
              'El hijo dijo humildemente en Lucas 15:21: "No soy digno de ser llamado tu hijo".',
          },
        ],
      },
      {
        id: 'hp-s2',
        order: 2,
        title: 'La invitación al hermano mayor',
        location: 'Entrada de la casa durante la celebración',
        narrativeAdaptation:
          'Adaptación narrativa: Al volver del campo y oír la música del recibimiento, el hermano mayor se enoja y no quiere entrar. El padre sale también a rogarle con amor que comparta la alegría.',
        sceneReference: 'Lucas 15:25-32',
        scriptureNote:
          'Referencia bíblica: El padre le dijo: "Hijo, tú siempre estás conmigo, y todas mis cosas son tuyas. Mas era necesario hacer fiesta y regocijarnos, porque este tu hermano era muerto, y ha revivido" (Lucas 15:31-32).',
        interactionType: 'question',
        prompt:
          '¿Qué enseña la actitud del padre hacia el hermano mayor en el cierre de la parábola?',
        options: [
          {
            id: 'hp-s2-a',
            label: 'Dios ama tanto al que regresa como al que permanece en casa, y nos llama a alegrarnos por quien vuelve a Él',
            isBiblicallyFaithful: true,
            pointsDelta: 1200,
            consequenceText:
              'La parábola invita a toda la congregación a tener el corazón compasivo del Padre hacia cada alma que regresa.',
            biblicalExplanation:
              'Lucas 15:7, 10, 32 une las tres parábolas del capítulo en un mismo tema: el gozo del cielo por un pecador que se arrepiente.',
          },
          {
            id: 'hp-s2-b',
            label: 'El padre expulsó de la casa al hermano menor para contentar al mayor',
            isBiblicallyFaithful: false,
            pointsDelta: 100,
            consequenceText:
              'El padre reafirmó la celebración y llamó hermano suyo al recién llegado.',
            biblicalExplanation:
              'Lucas 15:32 subraya: "este tu hermano... se había perdido, y es hallado".',
          },
          {
            id: 'hp-s2-c',
            label: 'La gracia de Dios se gana únicamente trabajando sin gozo como siervo',
            isBiblicallyFaithful: false,
            pointsDelta: 100,
            consequenceText:
              'La relación con el Padre es de hijos amados, no de servidumbre amarga.',
            biblicalExplanation:
              'En Lucas 15:31 el padre le recuerda: "tú siempre estás conmigo, y todas mis cosas son tuyas".',
          },
        ],
      },
    ],
    finalReflection:
      'Nunca estamos demasiado lejos para volver al abrazo de Dios, ni debemos permitir que el orgullo nos impida celebrar cuando otro joven decide volver a Cristo.',
    keyTakeaways: [
      'El arrepentimiento sincero abre las puertas a la restauración total.',
      'El Padre corre al encuentro del que regresa humildemente.',
      'La iglesia debe ser un hogar de alegría por cada vida rescatada.',
    ],
  },
  {
    id: 'adv-discipulos-jesus',
    title: 'Los discípulos de Jesús',
    subtitle: 'Fe y calma en medio de la tormenta sobre el mar de Galilea',
    testament: 'Nuevo Testamento',
    ambientStyle: 'miracle',
    ambientLabel: 'Mar en Calma',
    accentColor: '#3B82F6',
    mainReference: 'Mateo 14:22-33; Marcos 4:35-41',
    scripturalAnchor:
      'Mateo 14:27, 30-32 — Pero en seguida Jesús les habló, diciendo: "¡Tened ánimo; yo soy, no temáis!" Cuando Pedro gritó: "¡Señor, sálvame!", al momento Jesús extendió la mano, asió de él... y cuando ellos subieron en la barca, se calmó el viento.',
    introductionNarrative:
      'Adaptación narrativa: Tras alimentar a la multitud, Jesús envía a sus discípulos en la barca hacia la otra orilla mientras Él sube al monte a orar. En la cuarta vigilia de la noche, un viento contrario azota las olas en mitad del mar de Galilea.',
    characters: [
      { name: 'Jesús', role: 'Señor de la creación que camina sobre las aguas y sostiene al que duda' },
      { name: 'Pedro', role: 'Discípulo impulsivo que dio el paso sobre el agua y aprendió a mirar a Jesús' },
      { name: 'Los discípulos', role: 'Grupo en la barca que adoró a Jesús al ver su autoridad sobre la tormenta' },
    ],
    scenes: [
      {
        id: 'dj-s1',
        order: 1,
        title: 'La cuarta vigilia de la noche',
        location: 'Barca en medio del mar de Galilea',
        narrativeAdaptation:
          'Adaptación narrativa: El viento contrario impide avanzar y el cansancio pesa sobre los remos. De pronto, entre la bruma nocturna ven acercarse una figura caminando sobre el mar y los invade el temor.',
        sceneReference: 'Mateo 14:24-29',
        scriptureNote:
          'Referencia bíblica: Jesús los tranquilizó diciendo "¡Tened ánimo; yo soy, no temáis!" y cuando Pedro pidió ir hacia Él sobre las aguas, Jesús le dijo: "Ven" (Mateo 14:27, 29).',
        interactionType: 'decision',
        prompt:
          'Cuando Jesús llama en medio de la tormenta y Pedro siente la fuerza del viento al empezar a hundirse, ¿qué salva al discípulo?',
        options: [
          {
            id: 'dj-s1-a',
            label: 'Volver los ojos a Jesús y clamar con fe: "¡Señor, sálvame!"',
            isBiblicallyFaithful: true,
            pointsDelta: 1000,
            consequenceText:
              'Al instante Jesús extiende su mano, sostiene a Pedro y ambos suben a la barca mientras el viento amaina.',
            biblicalExplanation:
              'Mateo 14:30-31 muestra que quitar la mirada de Cristo para ver el viento causó temor, y clamar a Él trajo rescate inmediato.',
          },
          {
            id: 'dj-s1-b',
            label: 'Intentar nadar por su cuenta sin pedir ayuda al Maestro',
            isBiblicallyFaithful: false,
            pointsDelta: 100,
            consequenceText:
              'En medio de la tempestad, la autosuficiencia no sostiene; necesitamos la mano del Señor.',
            biblicalExplanation:
              'Pedro reconoció su necesidad inmediata clamando a Jesús en Mateo 14:30.',
          },
          {
            id: 'dj-s1-c',
            label: 'Culpar a los demás discípulos que se quedaron remando en la barca',
            isBiblicallyFaithful: false,
            pointsDelta: 100,
            consequenceText:
              'La prueba invitaba a fortalecer la fe personal en Cristo, no a señalar a otros.',
            biblicalExplanation:
              'Jesús corrigió suavemente la poca fe de Pedro señalando la duda en Mateo 14:31.',
          },
        ],
      },
      {
        id: 'dj-s2',
        order: 2,
        title: 'Calma en la barca y adoración',
        location: 'A bordo de la barca rumbo a Genesaret',
        narrativeAdaptation:
          'Adaptación narrativa: Apenas Jesús y Pedro ponen un pie en la barca, la tempestad se detiene por completo y un silencio asombrado cubre el lago.',
        sceneReference: 'Mateo 14:32-33',
        scriptureNote:
          'Referencia bíblica: "Entonces los que estaban en la barca vinieron y le adoraron, diciendo: Verdaderamente eres Hijo de Dios" (Mateo 14:33).',
        interactionType: 'question',
        prompt:
          '¿Cuál fue la confesión unánime de los discípulos en la barca al cesar el viento (Mateo 14:33)?',
        options: [
          {
            id: 'dj-s2-a',
            label: 'Le adoraron confesando: "Verdaderamente eres Hijo de Dios"',
            isBiblicallyFaithful: true,
            pointsDelta: 1200,
            consequenceText:
              'La tormenta se convirtió en escuela de adoración y convicción profunda sobre quién es Jesús.',
            biblicalExplanation:
              'Mateo 14:33 registra esta primera confesión conjunta de los discípulos adorando a Cristo como Hijo de Dios.',
          },
          {
            id: 'dj-s2-b',
            label: 'Decidieron no volver a navegar nunca más junto a Jesús',
            isBiblicallyFaithful: false,
            pointsDelta: 100,
            consequenceText:
              'Siguieron sirviendo y predicando junto al Señor hasta Galilea y Judea.',
            biblicalExplanation:
              'Mateo 14:34-36 muestra que cruzaron a Genesaret donde muchos enfermos fueron sanados.',
          },
          {
            id: 'dj-s2-c',
            label: 'Atribuyeron la calma del lago únicamente a un cambio casual del clima',
            isBiblicallyFaithful: false,
            pointsDelta: 100,
            consequenceText:
              'Reconocieron la autoridad divina de Jesús sobre la creación.',
            biblicalExplanation:
              'En Mateo 14:33 y Marcos 4:41 queda claro su asombro ante el poder soberano de Cristo.',
          },
        ],
      },
    ],
    finalReflection:
      'Las tormentas de la vida no significan que Jesús nos haya olvidado; muchas veces son el escenario donde aprendemos a mantener fija la mirada en Él y adorarle con fe.',
    keyTakeaways: [
      'La presencia de Cristo ("Yo soy, no temáis") vence el miedo nocturno.',
      'Mirar las olas produce duda; mirar a Jesús sostiene la fe.',
      'Aun cuando tropezamos, un clamor sincero encuentra su mano extendida.',
    ],
  },
];

export function getAdventureStoryById(
  storyId: string,
  customStories: AdventureStory[] = []
): AdventureStory {
  const all = [...BUILTIN_ADVENTURE_STORIES, ...customStories];
  return all.find((s) => s.id === storyId) || BUILTIN_ADVENTURE_STORIES[0];
}
