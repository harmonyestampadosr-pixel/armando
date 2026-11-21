import type { LeaderboardEntry } from './types';
import {
  ANNOUNCER_SUSPENSE_META,
  type AnnouncerAnnouncementPlan,
  type AnnouncerConfig,
  type AnnouncerCue,
  type AnnouncerStage,
  type AnnouncerStyle,
  type SuspenseLevel,
} from './announcerTypes';

export interface ScoreTier {
  competitionRank: number; // 1, 2, 3, etc. (1,1,3 when 2 tie for 1st)
  score: number;
  entries: LeaderboardEntry[];
}

/**
 * Groups authoritative server leaderboard entries into score tiers so ties at any
 * position are accurately identified without altering server rankings or scores.
 */
export function buildScoreTiers(leaderboard: LeaderboardEntry[]): ScoreTier[] {
  if (!Array.isArray(leaderboard) || leaderboard.length === 0) return [];
  const tiers: ScoreTier[] = [];

  for (let i = 0; i < leaderboard.length; i++) {
    const entry = leaderboard[i];
    const prevTier = tiers[tiers.length - 1];
    if (prevTier && prevTier.score === entry.score) {
      prevTier.entries.push(entry);
    } else {
      tiers.push({
        competitionRank: i + 1,
        score: entry.score,
        entries: [entry],
      });
    }
  }

  return tiers;
}

/**
 * Cleans visual symbols/emojis out of a name for crisp TTS reading while
 * preserving accents, ñ, and director-provided phonetic overrides.
 */
export function resolveSpokenParticipantName(
  entry: Pick<LeaderboardEntry, 'participantId' | 'name'>,
  overrides: Record<string, string> = {}
): string {
  const byId = overrides[entry.participantId]?.trim();
  if (byId) return byId;

  const byExactName = overrides[entry.name.trim().toLowerCase()]?.trim();
  if (byExactName) return byExactName;

  // Strip emojis / decorative symbols, collapse excessive whitespace
  const cleaned = entry.name
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/[_|~^*<>#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return entry.name.trim() || 'Participante';

  return cleaned;
}

function startsWithISound(word: string): boolean {
  const normalized = word
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return /^h?i(?!a|e|o|u)/i.test(normalized) || /^y\b/i.test(normalized);
}

export function joinSpanishNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  const last = names[names.length - 1];
  const conj = startsWithISound(last) ? 'e' : 'y';
  if (names.length === 2) {
    return `${names[0]} ${conj} ${last}`;
  }
  return `${names.slice(0, -1).join(', ')} ${conj} ${last}`;
}

export function buildGeminiStyleInstruction(
  style: AnnouncerStyle,
  suspenseLevel: SuspenseLevel
): string {
  const suspenseHint =
    suspenseLevel === 'cinematografico'
      ? 'Observe long, deliberate dramatic pauses at every ellipsis (...), dropping vocal intensity slightly before each name and delivering the reveal with crisp, poised authority.'
      : suspenseLevel === 'alto'
        ? 'Observe clear, deliberate dramatic pauses at every ellipsis (...) and modulate vocal intensity subtly to heighten anticipation before each name.'
        : suspenseLevel === 'medio'
          ? 'Keep measured pacing with clean, perceptible pauses at ellipses (...) before revealing names.'
          : 'Keep crisp, poised pacing with brief, clean pauses at ellipses (...).';

  const femaleLatinBase =
    'Speak in neutral, crystal-clear Latin American Spanish (es-419). Voice identity: consistent young adult female announcer with a clear, slightly bright and youthful feminine pitch, clean studio broadcast clarity without distortion, and natural, perfectly intelligible Spanish pronunciation. Never sound flat or robotic; interpret every phrase with subtle shifts in intensity and poised vocal control.';

  switch (style) {
    case 'misterioso':
      return `${femaleLatinBase} Vocal persona: mysterious, cool, composed, and strictly controlled female competition announcer inspired by high-stakes ceremonial arena broadcasts. Maintain quiet, enigmatic authority and precise, almost ceremonial intonation. ${suspenseHint}`;
    case 'solemne':
      return `${femaleLatinBase} Vocal persona: dignified, serene, ceremonial female awards presenter. Measured cadence, calm authority, and respectful poise fitting a special Christian youth competition. ${suspenseHint}`;
    case 'competitivo':
      return `${femaleLatinBase} Vocal persona: firm, focused, high-stakes female championship announcer. Crisp articulation, controlled rising tension, and poised authority. ${suspenseHint}`;
    case 'juvenil':
      return `${femaleLatinBase} Vocal persona: clear, youthful, poised female host for a Christian youth event. Natural, engaging phrasing with controlled suspense before results. ${suspenseHint}`;
    case 'divertido':
      return `${femaleLatinBase} Vocal persona: bright, articulate, poised female announcer with subtle warmth and controlled dramatic timing. ${suspenseHint}`;
  }
}

function buildIntroLine(
  style: AnnouncerStyle,
  gameTitle: string,
  participantCount: number
): { spoken: string; display: string } {
  const cleanTitle = gameTitle.trim() || 'esta competencia bíblica';

  switch (style) {
    case 'misterioso':
      return {
        spoken: `Participantes... la competencia "${cleanTitle}" ha concluido... Escuchen con atención... los resultados oficiales.`,
        display: `Participantes... "${cleanTitle}" ha concluido. Escuchen con atención los resultados oficiales (${participantCount} participantes).`,
      };
    case 'solemne':
      return {
        spoken: `Estimados participantes de "${cleanTitle}"... el tiempo ha concluido. Procedemos ahora a anunciar... los resultados oficiales.`,
        display: `Estimados participantes de "${cleanTitle}". Anunciamos ahora los resultados oficiales.`,
      };
    case 'competitivo':
      return {
        spoken: `Participantes de "${cleanTitle}"... el tiempo ha terminado... Es momento de revelar... el marcador oficial.`,
        display: `"${cleanTitle}" ha terminado. ¡Es momento de revelar el marcador oficial!`,
      };
    case 'juvenil':
      return {
        spoken: `Participantes de "${cleanTitle}"... ya tenemos los puntajes confirmados... Prepárense para escuchar los resultados.`,
        display: `¡Ya tenemos los puntajes confirmados de "${cleanTitle}"!`,
      };
    case 'divertido':
      return {
        spoken: `Participantes de "${cleanTitle}"... respiramos hondo... Ha llegado el momento de conocer cómo quedó el tablero.`,
        display: `¡Llegó el momento de conocer los resultados de "${cleanTitle}"!`,
      };
  }
}

function buildPlaceScript(options: {
  rankKind: 'third' | 'second' | 'first';
  style: AnnouncerStyle;
  spokenNames: string;
  displayNames: string;
  score: number;
  isTie: boolean;
  isSoleParticipant?: boolean;
}): { spoken: string; display: string } {
  const {
    rankKind,
    style,
    spokenNames,
    displayNames,
    score,
    isTie,
    isSoleParticipant,
  } = options;
  const pts = `${score.toLocaleString('es-CO')} puntos`;

  if (rankKind === 'first') {
    if (isSoleParticipant) {
      return {
        spoken: `Participantes... ha llegado el momento de conocer los resultados... Participante destacado... ${spokenNames}.`,
        display: `Participante destacado: ${displayNames} (${pts}).`,
      };
    }

    if (isTie) {
      return {
        spoken: `Participantes... ha llegado el momento de conocer los resultados... Empate en el puesto número uno... ${spokenNames}.`,
        display: `¡Empate en el 1.º puesto con ${pts}: ${displayNames}!`,
      };
    }

    switch (style) {
      case 'misterioso':
      case 'solemne':
      case 'competitivo':
      case 'juvenil':
      case 'divertido':
        return {
          spoken: `Participantes... ha llegado el momento de conocer los resultados... Puesto número uno... ${spokenNames}.`,
          display: `¡Puesto número uno: ${displayNames} (${pts})!`,
        };
    }
  }

  if (rankKind === 'second') {
    if (isTie) {
      return {
        spoken: `Empate en el puesto número dos... ${spokenNames}. Una excelente participación.`,
        display: `¡Empate en el 2.º puesto: ${displayNames} (${pts})! Una excelente participación.`,
      };
    }

    return {
      spoken: `Puesto número dos... ${spokenNames}. Una excelente participación.`,
      display: `2.º Puesto: ${displayNames} (${pts}). Una excelente participación.`,
    };
  }

  // Third place
  if (isTie) {
    return {
      spoken: `Empate en el puesto número tres... ${spokenNames}. Continúan aprendiendo.`,
      display: `¡Empate en el 3.º puesto: ${displayNames} (${pts})! Continúan aprendiendo.`,
    };
  }

  return {
    spoken: `Puesto número tres... ${spokenNames}. Continúa aprendiendo.`,
    display: `3.º Puesto: ${displayNames} (${pts}). Continúa aprendiendo.`,
  };
}

function buildLastPlaceScript(options: {
  spokenNames: string;
  displayNames: string;
  score: number;
  isTie: boolean;
}): { spoken: string; display: string; moralMessage: string } {
  const { spokenNames, displayNames, score, isTie } = options;
  const pts = `${score.toLocaleString('es-CO')} puntos`;

  if (isTie) {
    return {
      spoken: `Y finalmente... nuestros últimos participantes... ${spokenNames}. Parece que todavía tenemos que estudiar un poco más la Palabra de Dios. Nos vemos en la próxima competencia.`,
      display: `Último puesto compartido: ${displayNames} (${pts}).`,
      moralMessage:
        'Parece que todavía tenemos que estudiar un poco más la Palabra de Dios. Nos vemos en la próxima competencia.',
    };
  }

  return {
    spoken: `Y finalmente... nuestro último participante... ${spokenNames}. Parece que todavía tenemos que estudiar un poco más la Palabra de Dios. Nos vemos en la próxima competencia.`,
    display: `Último participante: ${displayNames} (${pts}).`,
    moralMessage:
      'Parece que todavía tenemos que estudiar un poco más la Palabra de Dios. Nos vemos en la próxima competencia.',
  };
}

function buildClosingLine(
  gameTitle: string,
  hasLastPlaceAnnouncement: boolean
): { spoken: string; display: string } {
  const cleanTitle = gameTitle.trim() || 'esta competencia';
  if (hasLastPlaceAnnouncement) {
    return {
      spoken: `La ceremonia de "${cleanTitle}" ha finalizado. Que la Palabra de Dios guíe siempre sus vidas.`,
      display: `Fin de la ceremonia en "${cleanTitle}". Que la Palabra de Dios guíe siempre sus vidas.`,
    };
  }
  return {
    spoken: `La ceremonia de "${cleanTitle}" ha finalizado. Nos vemos en la próxima competencia.`,
    display: `Fin de la ceremonia en "${cleanTitle}". Nos vemos en la próxima competencia.`,
  };
}

/**
 * Builds the deterministic, authoritative announcement sequence strictly from the
 * finished game's server leaderboard. Handles ties, < 4 participants, hard-to-pronounce
 * overrides, and consistent female ceremonial phrasing without ever inventing ranks or duplicating names.
 */
export function buildAnnouncerPlan(options: {
  leaderboard: LeaderboardEntry[];
  config: AnnouncerConfig;
  gameTitle: string;
  ceremonyRunId: string;
  variationSeed: number;
}): AnnouncerAnnouncementPlan {
  const { leaderboard, config, gameTitle, ceremonyRunId } = options;
  const tiers = buildScoreTiers(leaderboard);
  const participantCount = leaderboard.length;
  const hasAnyTie = tiers.some((t) => t.entries.length > 1);
  const basePause = ANNOUNCER_SUSPENSE_META[config.suspenseLevel].preDelayMs;
  const cues: AnnouncerCue[] = [];

  if (participantCount === 0) {
    cues.push({
      id: `${ceremonyRunId}-empty`,
      stage: 'complete',
      title: 'Partida sin participantes puntuando',
      rankLabel: 'Cierre',
      spokenText:
        'La partida ha finalizado... aunque no se registraron participantes en la clasificación.',
      displayText:
        'La partida ha finalizado sin participantes registrados en la clasificación.',
      highlightedParticipantIds: [],
      highlightedEntries: [],
      isTie: false,
      pauseBeforeMs: 250,
    });
    return {
      ceremonyRunId,
      participantCount: 0,
      hasAnyTie: false,
      cues,
    };
  }

  // 1. Intro suspense
  const intro = buildIntroLine(config.style, gameTitle, participantCount);
  cues.push({
    id: `${ceremonyRunId}-intro`,
    stage: 'intro_suspense',
    title: 'Preparando Resultados Oficiales',
    rankLabel: 'Suspenso',
    spokenText: intro.spoken,
    displayText: intro.display,
    highlightedParticipantIds: [],
    highlightedEntries: [],
    isTie: false,
    preSfx: config.sfxToggles.suspenseMusic ? 'suspense_intro' : undefined,
    pauseBeforeMs: 350,
  });

  const formatTierNames = (entries: LeaderboardEntry[]) => {
    const spokenArr = entries.map((e) =>
      resolveSpokenParticipantName(e, config.pronunciationOverrides)
    );
    const displayArr = entries.map((e) => e.name);
    return {
      spokenNames: joinSpanishNames(spokenArr),
      displayNames: joinSpanishNames(displayArr),
    };
  };

  const tier1 = tiers[0];
  const tier2 = tiers[1];
  const tier3 = tiers[2];

  const announcedIds = new Set<string>();

  const podiumTiers: Array<{
    stage: 'third_place' | 'second_place' | 'first_place';
    tier: ScoreTier;
    rankKind: 'third' | 'second' | 'first';
  }> = [];

  if (tier1) {
    if (tier3 && participantCount >= 3) {
      podiumTiers.push({ stage: 'third_place', tier: tier3, rankKind: 'third' });
    }
    if (tier2 && participantCount >= 2) {
      const rankKind = tier2.competitionRank >= 3 ? 'third' : 'second';
      podiumTiers.push({
        stage: rankKind === 'third' ? 'third_place' : 'second_place',
        tier: tier2,
        rankKind,
      });
    }
    podiumTiers.push({ stage: 'first_place', tier: tier1, rankKind: 'first' });
  }

  for (const item of podiumTiers) {
    const { tier, stage, rankKind } = item;
    const { spokenNames, displayNames } = formatTierNames(tier.entries);
    const isTie = tier.entries.length > 1;
    const isSoleParticipant = participantCount === 1 && rankKind === 'first';
    const script = buildPlaceScript({
      rankKind,
      style: config.style,
      spokenNames,
      displayNames,
      score: tier.score,
      isTie,
      isSoleParticipant,
    });

    for (const entry of tier.entries) {
      announcedIds.add(entry.participantId);
    }

    const rankLabel = isSoleParticipant
      ? 'Participante Destacado'
      : rankKind === 'first'
        ? isTie
          ? 'Empate · 1.º Puesto'
          : '1.º Puesto · Campeón'
        : rankKind === 'second'
          ? isTie
            ? 'Empate · 2.º Puesto'
            : '2.º Puesto'
          : isTie
            ? 'Empate · 3.º Puesto'
            : '3.º Puesto';

    cues.push({
      id: `${ceremonyRunId}-${stage}`,
      stage,
      title: rankLabel,
      rankLabel,
      spokenText: script.spoken,
      displayText: script.display,
      highlightedParticipantIds: tier.entries.map((e) => e.participantId),
      highlightedEntries: tier.entries,
      isTie,
      preSfx: config.sfxToggles.drumroll ? 'drumroll' : undefined,
      postSfx:
        rankKind === 'first'
          ? config.sfxToggles.winnerFanfare
            ? 'winner_fanfare'
            : undefined
          : config.sfxToggles.topThreeSting
            ? 'top3_sting'
            : undefined,
      pauseBeforeMs: basePause,
    });
  }

  // Last place announcement:
  // Only when participantCount >= 4 AND there are unannounced participants in the lowest tier
  let hasLastPlaceCue = false;
  if (participantCount >= 4 && tiers.length >= 2) {
    const lastTier = tiers[tiers.length - 1];
    const unannouncedInLastTier = lastTier.entries.filter(
      (e) => !announcedIds.has(e.participantId)
    );

    if (unannouncedInLastTier.length > 0) {
      hasLastPlaceCue = true;
      const { spokenNames, displayNames } = formatTierNames(unannouncedInLastTier);
      const isTie = unannouncedInLastTier.length > 1;
      const lastScript = buildLastPlaceScript({
        spokenNames,
        displayNames,
        score: lastTier.score,
        isTie,
      });

      cues.push({
        id: `${ceremonyRunId}-last_place`,
        stage: 'last_place',
        title: isTie
          ? 'Mención Especial · Último Puesto Compartido'
          : 'Mención Especial · Último Puesto',
        rankLabel: isTie ? 'Último Puesto (Empate)' : 'Último Puesto',
        spokenText: lastScript.spoken,
        displayText: `${lastScript.display} — ${lastScript.moralMessage}`,
        highlightedParticipantIds: unannouncedInLastTier.map(
          (e) => e.participantId
        ),
        highlightedEntries: unannouncedInLastTier,
        isTie,
        preSfx: config.sfxToggles.lastPlaceSting ? 'last_place_sting' : undefined,
        pauseBeforeMs: Math.round(basePause * 0.8),
      });
    }
  }

  // Final closing
  const closing = buildClosingLine(gameTitle, hasLastPlaceCue);
  cues.push({
    id: `${ceremonyRunId}-complete`,
    stage: 'complete',
    title: 'Cierre Oficial de Premiación',
    rankLabel: 'Tabla Completa',
    spokenText: closing.spoken,
    displayText: closing.display,
    highlightedParticipantIds: [],
    highlightedEntries: [],
    isTie: false,
    postSfx: config.sfxToggles.closingMusic ? 'closing' : undefined,
    pauseBeforeMs: 450,
  });

  return {
    ceremonyRunId,
    participantCount,
    hasAnyTie,
    cues,
  };
}

export function getUnlockedStagesUpToCue(
  plan: AnnouncerAnnouncementPlan,
  cueIndex: number
): AnnouncerStage[] {
  const unlocked = new Set<AnnouncerStage>();
  const capped = Math.min(cueIndex, plan.cues.length - 1);
  for (let i = 0; i <= capped; i++) {
    unlocked.add(plan.cues[i].stage);
  }
  return Array.from(unlocked);
}
