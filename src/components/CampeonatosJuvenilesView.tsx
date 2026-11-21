import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Anchor,
  ArrowLeft,
  Award,
  Calendar,
  CheckCircle2,
  Crown,
  Edit3,
  Flame,
  History,
  KeyRound,
  Lock,
  Medal,
  Play,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  Star,
  Trophy,
  Unlock,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { AVATARS } from '../shared/types';
import {
  COMPETITION_TYPE_LABELS,
  POINT_CATEGORY_META,
  TEAM_EMBLEM_OPTIONS,
  type ChampionshipPointCategory,
  type ChampionshipTeamEmblem,
  type ParticipantStandingRow,
  type TeamStandingRow,
  type YouthChampionshipSeason,
  type YouthCompetitionType,
} from '../shared/youthChampionshipsData';
import { getOrCreateProfileKey, getSavedProfileName, saveProfileName } from '../utils/profileKey';
import { soundFX } from '../utils/sound';
import { AvatarBadge } from './AvatarBadge';
import { ParticipantIdentityPicker } from './ParticipantIdentityPicker';

interface AvailableGameItem {
  code: string;
  title: string;
  mode: string;
  status: string;
  participantCount: number;
  createdAt: number;
}

interface SeasonWithStandings extends YouthChampionshipSeason {
  standings: {
    teamStandings: TeamStandingRow[];
    participantStandings: ParticipantStandingRow[];
  };
}

interface ChampionshipsStateResponse {
  seasons: SeasonWithStandings[];
  activeSeason: SeasonWithStandings;
  archivedSeasons: SeasonWithStandings[];
  availableGames: AvailableGameItem[];
  directorAuthorized: boolean;
}

interface CampeonatosJuvenilesViewProps {
  onBack: () => void;
  onCreatedMultiplayerRoom?: (code: string, presenterToken: string) => void;
}

type ChampionshipTab =
  | 'tablero'
  | 'equipos'
  | 'sabados'
  | 'finales'
  | 'temporadas';

const DIRECTOR_TOKEN_KEY = 'dtqd_missions_director_token';

function readDirectorToken(): string {
  try {
    return localStorage.getItem(DIRECTOR_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

function writeDirectorToken(token: string): void {
  try {
    if (token) localStorage.setItem(DIRECTOR_TOKEN_KEY, token);
    else localStorage.removeItem(DIRECTOR_TOKEN_KEY);
  } catch {
    // ignore
  }
}

function getEmblemIcon(emblem: ChampionshipTeamEmblem) {
  switch (emblem) {
    case 'leon':
      return Crown;
    case 'aguila':
      return Sparkles;
    case 'olivo':
      return Shield;
    case 'estrella':
      return Star;
    case 'antorcha':
      return Flame;
    case 'corona':
      return Trophy;
    case 'escudo':
      return Shield;
    case 'ancla':
      return Anchor;
  }
}

const PRESET_COLORS = [
  '#F59E0B',
  '#0EA5E9',
  '#10B981',
  '#EC4899',
  '#A855F7',
  '#EF4444',
  '#14B8A6',
  '#3B82F6',
];

export function CampeonatosJuvenilesView({
  onBack,
  onCreatedMultiplayerRoom,
}: CampeonatosJuvenilesViewProps) {
  const localProfileKey = useMemo(() => getOrCreateProfileKey(), []);
  const [activeTab, setActiveTab] = useState<ChampionshipTab>('tablero');
  const [state, setState] = useState<ChampionshipsStateResponse | null>(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Director session
  const [directorToken, setDirectorToken] = useState(() => readDirectorToken());
  const [directorAuthorized, setDirectorAuthorized] = useState(false);
  const [directorPinInput, setDirectorPinInput] = useState('');
  const [directorNameInput, setDirectorNameInput] = useState(
    'Director de Campeonato'
  );

  // Join / incorporate participant via existing identity picker
  const [joinName, setJoinName] = useState(() => getSavedProfileName());
  const [joinAvatarId, setJoinAvatarId] = useState(AVATARS[0]?.id || 'david');
  const [joinIdentityMode, setJoinIdentityMode] = useState<'avatar' | 'photo'>(
    'avatar'
  );
  const [joinPhotoDataUrl, setJoinPhotoDataUrl] = useState<string | null>(null);
  const [joinTeamId, setJoinTeamId] = useState('');
  const [joinChurchName, setJoinChurchName] = useState('');
  const [joining, setJoining] = useState(false);

  // Director: add team
  const [teamName, setTeamName] = useState('');
  const [teamColor, setTeamColor] = useState('#10B981');
  const [teamEmblem, setTeamEmblem] =
    useState<ChampionshipTeamEmblem>('escudo');
  const [teamMotto, setTeamMotto] = useState('');
  const [teamEntityKind, setTeamEntityKind] = useState<
    'Equipo' | 'Grupo Juvenil' | 'Iglesia'
  >('Equipo');

  // Director: Saturday points & live game
  const [selectedSaturdayNum, setSelectedSaturdayNum] = useState(1);
  const [pointCategory, setPointCategory] =
    useState<ChampionshipPointCategory>('participacion');
  const [pointTeamId, setPointTeamId] = useState('');
  const [pointParticipantId, setPointParticipantId] = useState('');
  const [pointAmount, setPointAmount] = useState(100);
  const [pointSourceLabel, setPointSourceLabel] = useState('');
  const [importGameCode, setImportGameCode] = useState('');
  const [launchingGame, setLaunchingGame] = useState(false);

  // Director: Audit correction
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editPointsVal, setEditPointsVal] = useState(100);
  const [editReason, setEditReason] = useState('');

  // Director: New season form
  const [newSeasonName, setNewSeasonName] = useState('');
  const [newSeasonDesc, setNewSeasonDesc] = useState('');
  const [newSeasonStart, setNewSeasonStart] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [newSeasonSaturdays, setNewSeasonSaturdays] = useState<4 | 5>(4);
  const [newSeasonType, setNewSeasonType] =
    useState<YouthCompetitionType>('equipos');
  const [newSeasonAllowChurch, setNewSeasonAllowChurch] = useState(false);
  const [copyTeamsFromActive, setCopyTeamsFromActive] = useState(true);

  // Director: Upcoming competition
  const [upTitle, setUpTitle] = useState('');
  const [upKind, setUpKind] = useState<
    'competencia_biblica' | 'retos' | 'mision' | 'gran_final'
  >('competencia_biblica');
  const [upSat, setUpSat] = useState(1);
  const [upDesc, setUpDesc] = useState('');

  // Playoff score drafts
  const [playoffScores, setPlayoffScores] = useState<
    Record<string, { a: number; b: number }>
  >({});

  // Gran Final special show overlay
  const [granFinalShowOpen, setGranFinalShowOpen] = useState(false);
  const [countdownVal, setCountdownVal] = useState<number | null>(null);
  const [finalStageStep, setFinalStageStep] = useState<
    'countdown' | 'ceremony'
  >('countdown');

  const loadState = useCallback(
    async (tokenOverride?: string) => {
      const tok = tokenOverride !== undefined ? tokenOverride : directorToken;
      try {
        const res = await fetch('/api/championships/state', {
          headers: tok ? { Authorization: `Bearer ${tok}` } : undefined,
        });
        if (!res.ok) {
          throw new Error('No se pudo cargar Campeonatos Juveniles.');
        }
        const data = (await res.json()) as ChampionshipsStateResponse;
        setState(data);
        setDirectorAuthorized(Boolean(data.directorAuthorized));
        setSelectedSeasonId((prev) => {
          if (prev && data.seasons.some((s) => s.id === prev)) return prev;
          return data.activeSeason?.id || data.seasons[0]?.id || '';
        });
        if (!importGameCode && data.availableGames.length > 0) {
          setImportGameCode(data.availableGames[0].code);
        }
      } catch (err) {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Error cargando campeonatos.'
        );
      } finally {
        setLoading(false);
      }
    },
    [directorToken, importGameCode]
  );

  useEffect(() => {
    loadState();
  }, [loadState]);

  const currentSeason = useMemo(() => {
    if (!state) return null;
    return (
      state.seasons.find((s) => s.id === selectedSeasonId) ||
      state.activeSeason ||
      state.seasons[0] ||
      null
    );
  }, [state, selectedSeasonId]);

  useEffect(() => {
    if (!currentSeason) return;
    if (!joinTeamId && currentSeason.teams.length > 0) {
      setJoinTeamId(currentSeason.teams[0].id);
    }
    if (!pointTeamId && currentSeason.teams.length > 0) {
      setPointTeamId(currentSeason.teams[0].id);
    }
  }, [currentSeason, joinTeamId, pointTeamId]);

  // Gran Final countdown timer & sound effects
  useEffect(() => {
    if (!granFinalShowOpen || finalStageStep !== 'countdown') return;
    if (countdownVal === null) return;

    if (countdownVal > 0) {
      soundFX.playTick();
      const t = window.setTimeout(() => {
        setCountdownVal((c) => (c !== null ? c - 1 : null));
      }, 950);
      return () => window.clearTimeout(t);
    } else {
      soundFX.playProgramStageEnd();
      const t = window.setTimeout(() => {
        soundFX.playVictory();
        setFinalStageStep('ceremony');
      }, 650);
      return () => window.clearTimeout(t);
    }
  }, [granFinalShowOpen, finalStageStep, countdownVal]);

  const startGranFinalShow = () => {
    setGranFinalShowOpen(true);
    setFinalStageStep('countdown');
    setCountdownVal(3);
  };

  const handleDirectorAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/championships/director/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: directorPinInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Clave incorrecta.');
      writeDirectorToken(data.directorToken);
      setDirectorToken(data.directorToken);
      setDirectorAuthorized(true);
      setDirectorPinInput('');
      setSuccessMsg('Acceso de director autorizado habilitado.');
      await loadState(data.directorToken);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Error de autenticación.'
      );
    }
  };

  const handleJoinParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSeason) return;
    setErrorMsg('');
    setSuccessMsg('');
    setJoining(true);
    try {
      const cleanName = joinName.trim();
      saveProfileName(cleanName);
      const res = await fetch(
        `/api/championships/seasons/${currentSeason.id}/join`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: cleanName,
            participantKey: localProfileKey,
            avatarId: joinAvatarId,
            photoDataUrl:
              joinIdentityMode === 'photo' ? joinPhotoDataUrl : undefined,
            teamId:
              currentSeason.competitionType !== 'individual'
                ? joinTeamId || undefined
                : undefined,
            churchName: joinChurchName.trim() || undefined,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo inscribir.');
      setSuccessMsg(
        `¡${cleanName} se incorporó a la temporada "${currentSeason.name}"!`
      );
      await loadState();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Error al incorporar participante.'
      );
    } finally {
      setJoining(false);
    }
  };

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSeason) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(
        `/api/championships/seasons/${currentSeason.id}/teams`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${directorToken}`,
          },
          body: JSON.stringify({
            name: teamName,
            color: teamColor,
            emblem: teamEmblem,
            motto: teamMotto,
            entityKind: teamEntityKind,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo crear el equipo.');
      setTeamName('');
      setTeamMotto('');
      setSuccessMsg(`Equipo "${data.team.name}" agregado correctamente.`);
      await loadState();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Error creando equipo.'
      );
    }
  };

  const handleRecordPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSeason) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(
        `/api/championships/seasons/${currentSeason.id}/scores`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${directorToken}`,
          },
          body: JSON.stringify({
            saturdayNumber: selectedSaturdayNum,
            category: pointCategory,
            points: pointAmount,
            teamId: pointTeamId || undefined,
            participantId: pointParticipantId || undefined,
            sourceLabel:
              pointSourceLabel.trim() ||
              `Sábado ${selectedSaturdayNum} — ${POINT_CATEGORY_META.find((c) => c.id === pointCategory)?.shortLabel}`,
            editedBy: directorNameInput,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'No se pudo registrar el puntaje.');
      }
      setPointSourceLabel('');
      setSuccessMsg(`+${pointAmount} pts registrados sin duplicados.`);
      await loadState();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Error registrando puntos.'
      );
    }
  };

  const handleLaunchChampionshipLiveGame = async () => {
    if (!currentSeason) return;
    setErrorMsg('');
    setSuccessMsg('');
    setLaunchingGame(true);
    try {
      const useTeams =
        currentSeason.competitionType !== 'individual' &&
        currentSeason.teams.length >= 2;
      const teamSlice = currentSeason.teams.slice(0, 6);

      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${currentSeason.name} · Sábado ${selectedSaturdayNum}`,
          mode: useTeams ? 'competencia_equipos' : 'clasico',
          difficulty: 'combinado',
          questionCount: 15,
          timeLimitSec: 20,
          teamMode: useTeams,
          teamCount: useTeams ? teamSlice.length : undefined,
          teamCapacity: useTeams ? 15 : undefined,
          teamNames: useTeams ? teamSlice.map((t) => t.name) : undefined,
          teamColors: useTeams ? teamSlice.map((t) => t.color) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'No se pudo crear la partida en vivo.');
      }

      // Link code to Saturday if director authorized
      if (directorToken) {
        await fetch(
          `/api/championships/seasons/${currentSeason.id}/saturdays/${selectedSaturdayNum}/link-game`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${directorToken}`,
            },
            body: JSON.stringify({ code: data.code }),
          }
        );
      }

      if (onCreatedMultiplayerRoom) {
        onCreatedMultiplayerRoom(data.code, data.presenterToken);
      } else {
        setSuccessMsg(`Partida en vivo creada con código ${data.code}.`);
        await loadState();
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Error creando partida en vivo.'
      );
    } finally {
      setLaunchingGame(false);
    }
  };

  const handleImportGameScores = async () => {
    if (!currentSeason || !importGameCode) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(
        `/api/championships/seasons/${currentSeason.id}/import-game`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${directorToken}`,
          },
          body: JSON.stringify({
            gameCode: importGameCode,
            saturdayNumber: selectedSaturdayNum,
            editedBy: directorNameInput,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo importar.');
      setSuccessMsg(
        `Se importaron ${data.importedCount} resultados de la partida ${importGameCode} al Sábado ${selectedSaturdayNum}.`
      );
      await loadState();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Error importando partida.'
      );
    }
  };

  const handleImportVerifiedMissions = async () => {
    if (!currentSeason) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(
        `/api/championships/seasons/${currentSeason.id}/import-missions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${directorToken}`,
          },
          body: JSON.stringify({
            saturdayNumber: selectedSaturdayNum,
            editedBy: directorNameInput,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo sincronizar.');
      setSuccessMsg(
        data.importedCount > 0
          ? `Se sincronizaron ${data.importedCount} misiones verificadas al Sábado ${selectedSaturdayNum}.`
          : data.message || 'No hay misiones nuevas por sincronizar.'
      );
      await loadState();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Error sincronizando misiones.'
      );
    }
  };

  const handleSaveScoreEdit = async (entryId: string, voidEntry = false) => {
    if (!currentSeason) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(
        `/api/championships/seasons/${currentSeason.id}/scores/${entryId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${directorToken}`,
          },
          body: JSON.stringify({
            ...(voidEntry ? { voided: true } : { points: editPointsVal }),
            reason: editReason,
            editedBy: directorNameInput,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo actualizar.');
      setEditingEntryId(null);
      setEditReason('');
      setSuccessMsg(
        voidEntry
          ? 'Puntaje anulado y registrado en auditoría.'
          : 'Puntaje corregido y guardado en historial de cambios.'
      );
      await loadState();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Error corrigiendo puntaje.'
      );
    }
  };

  const handleGeneratePlayoffs = async () => {
    if (!currentSeason) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(
        `/api/championships/seasons/${currentSeason.id}/playoffs/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${directorToken}`,
          },
          body: JSON.stringify({ editedBy: directorNameInput }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo generar llave.');
      setSuccessMsg('Semifinales y llave final generadas según clasificación.');
      await loadState();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Error generando playoffs.'
      );
    }
  };

  const handleUpdatePlayoffMatch = async (
    matchId: string,
    scoreA: number,
    scoreB: number,
    completeMatch: boolean,
    winnerSide?: 'A' | 'B'
  ) => {
    if (!currentSeason) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(
        `/api/championships/seasons/${currentSeason.id}/playoffs/update`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${directorToken}`,
          },
          body: JSON.stringify({
            matchId,
            scoreA,
            scoreB,
            completeMatch,
            winnerSide,
            editedBy: directorNameInput,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo actualizar.');
      setSuccessMsg('Resultado de fase final guardado.');
      await loadState();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Error actualizando fase final.'
      );
    }
  };

  const handleArchiveSeason = async () => {
    if (!currentSeason) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(
        `/api/championships/seasons/${currentSeason.id}/archive`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${directorToken}`,
          },
          body: JSON.stringify({ editedBy: directorNameInput }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo archivar.');
      setSuccessMsg(
        `Temporada "${data.season.name}" finalizada y guardada en Temporadas Anteriores.`
      );
      await loadState();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Error archivando temporada.'
      );
    }
  };

  const handleCreateSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/championships/seasons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${directorToken}`,
        },
        body: JSON.stringify({
          name: newSeasonName,
          description: newSeasonDesc,
          startDate: newSeasonStart,
          saturdaysCount: newSeasonSaturdays,
          competitionType: newSeasonType,
          allowInterChurch: newSeasonAllowChurch,
          copyTeamsFromActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo crear.');
      setNewSeasonName('');
      setNewSeasonDesc('');
      setSelectedSeasonId(data.season.id);
      setActiveTab('tablero');
      setSuccessMsg(`Temporada "${data.season.name}" creada y activada.`);
      await loadState();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Error creando temporada.'
      );
    }
  };

  const handleAddUpcoming = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSeason) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(
        `/api/championships/seasons/${currentSeason.id}/upcoming`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${directorToken}`,
          },
          body: JSON.stringify({
            title: upTitle,
            kind: upKind,
            saturdayNumber: upSat,
            description: upDesc,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo programar.');
      setUpTitle('');
      setUpDesc('');
      setSuccessMsg('Próxima competencia programada.');
      await loadState();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Error programando competencia.'
      );
    }
  };

  if (loading || !state || !currentSeason) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-8 text-center text-slate-300">
          Cargando Campeonatos Juveniles...
        </div>
      </div>
    );
  }

  const teamRows = currentSeason.standings.teamStandings;
  const partRows = currentSeason.standings.participantStandings;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
      {/* Top Header */}
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800 pb-6">
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer mb-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio
          </button>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight text-balance">
            Campeonatos Juveniles
          </h1>
          <p className="text-sm text-slate-400">
            {currentSeason.name} ·{' '}
            <span className="font-mono-num tabular-nums">
              {currentSeason.startDate} al {currentSeason.endDate}
            </span>{' '}
            · {currentSeason.saturdaysCount} sábados · Modalidad{' '}
            {COMPETITION_TYPE_LABELS[currentSeason.competitionType]}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <select
            value={currentSeason.id}
            onChange={(e) => setSelectedSeasonId(e.target.value)}
            aria-label="Seleccionar temporada"
            className="bg-[#111A2E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-amber-400"
          >
            {state.seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.status === 'archivada' ? 'Archivada' : 'Activa'})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={startGranFinalShow}
            className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-sm inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Trophy className="w-4 h-4" />
            Gran Final en Vivo
          </button>
        </div>
      </header>

      {/* Feedback alerts */}
      {errorMsg && (
        <div className="bg-rose-500/15 border border-rose-500/40 text-rose-200 rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-3">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg('')}
            className="text-rose-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-3">
          <span>{successMsg}</span>
          <button
            type="button"
            onClick={() => setSuccessMsg('')}
            className="text-emerald-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <nav className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        {(
          [
            { id: 'tablero', label: 'Pantalla de Campeonato', icon: Trophy },
            { id: 'equipos', label: 'Equipos y Participantes', icon: Users },
            { id: 'sabados', label: 'Sábados y Puntos', icon: Calendar },
            { id: 'finales', label: 'Semifinales y Final', icon: Crown },
            { id: 'temporadas', label: 'Temporadas', icon: History },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-[#111A2E] text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 inline-flex items-center gap-1.5">
            {directorAuthorized ? (
              <>
                <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                Modo Director Activo
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                Vista Pública
              </>
            )}
          </span>
        </div>
      </nav>

      {/* Director Unlock Bar if locked and in management tabs */}
      {!directorAuthorized && activeTab !== 'tablero' && (
        <form
          onSubmit={handleDirectorAuth}
          className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-300">
            <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Desbloquea los controles de director para crear equipos,
              registrar puntos, corregir puntajes o cerrar temporadas (clave
              predeterminada: <strong className="font-mono-num text-white">SJ2026</strong>).
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="password"
              value={directorPinInput}
              onChange={(e) => setDirectorPinInput(e.target.value)}
              placeholder="Clave de director"
              required
              className="bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white w-40"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs cursor-pointer whitespace-nowrap"
            >
              Desbloquear
            </button>
          </div>
        </form>
      )}

      {/* TAB 1: PANTALLA DE CAMPEONATO */}
      {activeTab === 'tablero' && (
        <div className="space-y-8">
          {/* Season KPI strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4">
              <p className="text-xs text-slate-400">Equipos / Delegaciones</p>
              <p className="font-mono-num text-2xl font-extrabold text-white mt-1 tabular-nums">
                {currentSeason.teams.length}
              </p>
            </div>
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4">
              <p className="text-xs text-slate-400">Participantes</p>
              <p className="font-mono-num text-2xl font-extrabold text-sky-300 mt-1 tabular-nums">
                {currentSeason.participants.length}
              </p>
            </div>
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4">
              <p className="text-xs text-slate-400">Duración</p>
              <p className="font-mono-num text-2xl font-extrabold text-amber-300 mt-1 tabular-nums">
                {currentSeason.saturdaysCount} Sábados
              </p>
            </div>
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4">
              <p className="text-xs text-slate-400">Fase Actual</p>
              <p className="font-display text-lg font-extrabold text-emerald-300 mt-1">
                {currentSeason.playoffs.stageStatus === 'finalizada'
                  ? 'Campeón Coronado'
                  : currentSeason.playoffs.stageStatus === 'gran_final'
                    ? 'Gran Final'
                    : currentSeason.playoffs.stageStatus === 'semifinales'
                      ? 'Semifinales'
                      : 'Temporada Regular'}
              </p>
            </div>
          </div>

          {/* Winner Banner if crowned */}
          {currentSeason.playoffs.championName && (
            <section className="bg-gradient-to-br from-[#1C2541] to-[#0D1527] border border-amber-400/50 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Cuadro de Honor Oficial
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                  Campeón: {currentSeason.playoffs.championName}
                </h2>
                <p className="text-sm text-slate-300">
                  {currentSeason.playoffs.runnerUpName
                    ? `Subcampeón: ${currentSeason.playoffs.runnerUpName}`
                    : ''}{' '}
                  {currentSeason.playoffs.thirdPlaceName
                    ? `· 3er Lugar: ${currentSeason.playoffs.thirdPlaceName}`
                    : ''}{' '}
                  {currentSeason.playoffs.mvpParticipantName
                    ? `· Líder Individual: ${currentSeason.playoffs.mvpParticipantName}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={startGranFinalShow}
                className="px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Crown className="w-4 h-4" />
                Ver Premiación
              </button>
            </section>
          )}

          {/* Standings: Teams / Groups / Churches */}
          {currentSeason.competitionType !== 'individual' &&
            teamRows.length > 0 && (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-2xl font-extrabold text-white">
                      Clasificación de{' '}
                      {COMPETITION_TYPE_LABELS[currentSeason.competitionType]}
                    </h2>
                    <p className="text-xs text-slate-400">
                      Desglose por participación, respuestas correctas, retos,
                      misiones verificadas y colaboración grupal.
                    </p>
                  </div>
                </div>

                <div className="bg-[#111A2E] border border-slate-800 rounded-2xl overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                        <th className="py-3.5 px-4">Pos</th>
                        <th className="py-3.5 px-4">Equipo / Identidad</th>
                        <th className="py-3.5 px-4">Integrantes</th>
                        {POINT_CATEGORY_META.map((cat) => (
                          <th
                            key={cat.id}
                            className="py-3.5 px-3 text-right font-mono-num"
                          >
                            {cat.shortLabel}
                          </th>
                        ))}
                        <th className="py-3.5 px-4 text-right font-mono-num text-amber-300">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-sm">
                      {teamRows.map((row) => {
                        const EmblemIcon = getEmblemIcon(row.team.emblem);
                        return (
                          <tr
                            key={row.team.id}
                            className="hover:bg-slate-800/30 transition-colors"
                          >
                            <td className="py-3.5 px-4 font-mono-num font-extrabold text-white tabular-nums">
                              #{row.rank}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border border-white/10"
                                  style={{
                                    backgroundColor: `${row.team.color}22`,
                                    color: row.team.color,
                                  }}
                                >
                                  <EmblemIcon className="w-5 h-5" />
                                </div>
                                <div>
                                  <p className="font-bold text-white">
                                    {row.team.name}
                                  </p>
                                  <p className="text-xs text-slate-400">
                                    {row.team.entityKind} · {row.team.motto}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              {row.members.length === 0 ? (
                                <span className="text-xs text-slate-500">
                                  Sin inscritos
                                </span>
                              ) : (
                                <div className="flex items-center -space-x-2">
                                  {row.members.slice(0, 5).map((m) => (
                                    <AvatarBadge
                                      key={m.id}
                                      avatarId={m.avatarId}
                                      photoUrl={m.photoDataUrl}
                                      name={m.name}
                                      size="sm"
                                    />
                                  ))}
                                  {row.members.length > 5 && (
                                    <span className="pl-3 text-xs font-mono-num text-slate-400">
                                      +{row.members.length - 5}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            {POINT_CATEGORY_META.map((cat) => (
                              <td
                                key={cat.id}
                                className="py-3.5 px-3 text-right font-mono-num text-slate-300 tabular-nums"
                              >
                                {row.byCategory[cat.id]}
                              </td>
                            ))}
                            <td className="py-3.5 px-4 text-right font-mono-num font-extrabold text-lg text-amber-300 tabular-nums">
                              {row.totalPoints}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

          {/* Individual Standings & Upcoming Schedule */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-xl font-extrabold text-white">
                  Tabla de Participantes ({partRows.length})
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('equipos')}
                  className="text-xs font-bold text-amber-300 hover:text-amber-200 cursor-pointer"
                >
                  + Incorporarme ahora
                </button>
              </div>

              {partRows.length === 0 ? (
                <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 text-sm text-slate-400 space-y-3">
                  <p>
                    Aún no hay participantes inscritos en esta temporada.
                    Inscríbete con tu avatar o fotografía personal en la pestaña
                    &ldquo;Equipos y Participantes&rdquo;.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('equipos')}
                    className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                  >
                    Inscribir primer participante
                  </button>
                </div>
              ) : (
                <div className="bg-[#111A2E] border border-slate-800 rounded-2xl divide-y divide-slate-800">
                  {partRows.map((row) => (
                    <div
                      key={row.participant.id}
                      className="p-4 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono-num text-sm font-extrabold text-slate-400 w-7 tabular-nums">
                          #{row.rank}
                        </span>
                        <AvatarBadge
                          avatarId={row.participant.avatarId}
                          photoUrl={row.participant.photoDataUrl}
                          name={row.participant.name}
                          size="md"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-white truncate">
                            {row.participant.name}
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            {row.teamName || 'Participación Individual'}
                          </p>
                        </div>
                      </div>
                      <p className="font-mono-num text-lg font-extrabold text-amber-300 tabular-nums shrink-0">
                        {row.totalPoints} pts
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Right column: Upcoming & Recent Results */}
            <section className="lg:col-span-5 space-y-6">
              <div className="space-y-3">
                <h2 className="font-display text-xl font-extrabold text-white">
                  Calendario de {currentSeason.saturdaysCount} Sábados
                </h2>
                <div className="space-y-2.5">
                  {currentSeason.saturdays.map((sat) => (
                    <div
                      key={sat.saturdayNumber}
                      className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-amber-300">
                          {sat.title}
                        </span>
                        <span className="font-mono-num text-slate-400 tabular-nums">
                          {sat.date}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">
                        {sat.activityNotes}
                      </p>
                      {sat.linkedGameCodes.length > 0 && (
                        <p className="text-[11px] font-mono-num text-emerald-300">
                          Partidas vinculadas: {sat.linkedGameCodes.join(', ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="font-display text-xl font-extrabold text-white">
                  Resultados Recientes
                </h2>
                {currentSeason.scoreEntries.filter((e) => !e.voided).length ===
                0 ? (
                  <p className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 text-xs text-slate-400">
                    Todavía no se han registrado puntos en esta temporada.
                  </p>
                ) : (
                  <div className="bg-[#111A2E] border border-slate-800 rounded-2xl divide-y divide-slate-800">
                    {currentSeason.scoreEntries
                      .filter((e) => !e.voided)
                      .slice(0, 6)
                      .map((entry) => {
                        const team = currentSeason.teams.find(
                          (t) => t.id === entry.teamId
                        );
                        return (
                          <div
                            key={entry.id}
                            className="p-3.5 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-white truncate">
                                {entry.participantName || team?.name || 'Equipo'}
                              </p>
                              <p className="text-slate-400 truncate">
                                Sábado {entry.saturdayNumber} ·{' '}
                                {entry.sourceLabel}
                              </p>
                            </div>
                            <span className="font-mono-num font-extrabold text-emerald-300 shrink-0 tabular-nums">
                              +{entry.points}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* TAB 2: EQUIPOS Y PARTICIPANTES */}
      {activeTab === 'equipos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Incorporate participant using existing ParticipantIdentityPicker */}
          <form
            onSubmit={handleJoinParticipant}
            className="lg:col-span-7 bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-5"
          >
            <div className="flex items-center gap-2.5">
              <UserPlus className="w-5 h-5 text-amber-400" />
              <h2 className="font-display text-xl font-extrabold text-white">
                Incorporar Participante con Avatar o Fotografía
              </h2>
            </div>

            <ParticipantIdentityPicker
              name={joinName}
              onNameChange={setJoinName}
              avatarId={joinAvatarId}
              onAvatarIdChange={setJoinAvatarId}
              identityMode={joinIdentityMode}
              onIdentityModeChange={setJoinIdentityMode}
              croppedPhotoDataUrl={joinPhotoDataUrl}
              onPhotoChange={setJoinPhotoDataUrl}
              nameLabel="Nombre del participante"
              namePlaceholder="Escribe el nombre completo o apodo..."
            />

            {currentSeason.competitionType !== 'individual' &&
              currentSeason.teams.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Equipo / Delegación asignada
                  </label>
                  <select
                    value={joinTeamId}
                    onChange={(e) => setJoinTeamId(e.target.value)}
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                  >
                    {currentSeason.teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.entityKind})
                      </option>
                    ))}
                  </select>
                </div>
              )}

            {currentSeason.allowInterChurch && (
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Iglesia o congregación (opcional)
                </label>
                <input
                  type="text"
                  value={joinChurchName}
                  onChange={(e) => setJoinChurchName(e.target.value)}
                  placeholder="Ej: Iglesia Central"
                  className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={joining}
              className="w-full px-5 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 font-display font-extrabold text-sm cursor-pointer"
            >
              {joining
                ? 'Incorporando...'
                : 'Incorporar Participante al Campeonato'}
            </button>
          </form>

          {/* Teams list & Director Team Creator */}
          <div className="lg:col-span-5 space-y-6">
            {directorAuthorized && (
              <form
                onSubmit={handleAddTeam}
                className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-4"
              >
                <h3 className="font-display text-lg font-extrabold text-white">
                  Crear Nuevo Equipo o Delegación
                </h3>

                <input
                  type="text"
                  required
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Nombre del equipo / grupo / iglesia"
                  className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                />

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Identidad / Emblema
                    </label>
                    <select
                      value={teamEmblem}
                      onChange={(e) =>
                        setTeamEmblem(e.target.value as ChampionshipTeamEmblem)
                      }
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      {TEAM_EMBLEM_OPTIONS.map((em) => (
                        <option key={em.id} value={em.id}>
                          {em.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Tipo de entidad
                    </label>
                    <select
                      value={teamEntityKind}
                      onChange={(e) =>
                        setTeamEntityKind(
                          e.target.value as
                            | 'Equipo'
                            | 'Grupo Juvenil'
                            | 'Iglesia'
                        )
                      }
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      <option value="Equipo">Equipo</option>
                      <option value="Grupo Juvenil">Grupo Juvenil</option>
                      {(currentSeason.allowInterChurch ||
                        currentSeason.competitionType === 'iglesias') && (
                        <option value="Iglesia">Iglesia</option>
                      )}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1.5">
                    Color del equipo
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {PRESET_COLORS.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setTeamColor(hex)}
                        className={`w-7 h-7 rounded-lg cursor-pointer border-2 ${
                          teamColor === hex
                            ? 'border-white scale-110'
                            : 'border-transparent'
                        }`}
                        style={{ backgroundColor: hex }}
                        aria-label={`Color ${hex}`}
                      />
                    ))}
                    <input
                      type="color"
                      value={teamColor}
                      onChange={(e) => setTeamColor(e.target.value)}
                      className="w-8 h-8 rounded bg-transparent cursor-pointer"
                    />
                  </div>
                </div>

                <input
                  type="text"
                  value={teamMotto}
                  onChange={(e) => setTeamMotto(e.target.value)}
                  placeholder="Lema espiritual del equipo (opcional)"
                  className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                />

                <button
                  type="submit"
                  className="w-full px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm cursor-pointer"
                >
                  Agregar Equipo
                </button>
              </form>
            )}

            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-3">
              <h3 className="font-display text-lg font-extrabold text-white">
                Equipos Inscritos ({currentSeason.teams.length})
              </h3>
              {currentSeason.teams.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Esta temporada es en modalidad Individual.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {currentSeason.teams.map((t) => {
                    const Icon = getEmblemIcon(t.emblem);
                    const count = currentSeason.participants.filter(
                      (p) => p.teamId === t.id
                    ).length;
                    return (
                      <div
                        key={t.id}
                        className="bg-[#080E1E] border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                            style={{
                              backgroundColor: `${t.color}25`,
                              color: t.color,
                            }}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate">
                              {t.name}
                            </p>
                            <p className="text-xs text-slate-400 truncate">
                              {t.entityKind} · {count} integrantes
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SÁBADOS, PUNTOS, PARTIDAS EN VIVO Y AUDITORÍA */}
      {activeTab === 'sabados' && (
        <div className="space-y-8">
          {/* Saturday Selector */}
          <div className="flex flex-wrap items-center gap-2">
            {currentSeason.saturdays.map((sat) => (
              <button
                key={sat.saturdayNumber}
                type="button"
                onClick={() => setSelectedSaturdayNum(sat.saturdayNumber)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap ${
                  selectedSaturdayNum === sat.saturdayNumber
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-[#111A2E] text-slate-300 border border-slate-800'
                }`}
              >
                Sábado {sat.saturdayNumber} · {sat.date}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Launch live biblical competition & import existing systems */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-4">
                <h2 className="font-display text-xl font-extrabold text-white">
                  Competencias Bíblicas y Retos
                </h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Lanza una partida real en vivo usando los equipos del
                  campeonato o importa resultados ya jugados sin duplicar
                  puntos.
                </p>

                <button
                  type="button"
                  disabled={launchingGame}
                  onClick={handleLaunchChampionshipLiveGame}
                  className="w-full px-4 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  {launchingGame
                    ? 'Abriendo sala...'
                    : `Iniciar Partida Bíblica (Sábado ${selectedSaturdayNum})`}
                </button>

                {directorAuthorized && (
                  <div className="pt-3 border-t border-slate-800 space-y-3">
                    <label className="block text-xs font-bold text-slate-300">
                      Importar puntos desde partida existente
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={importGameCode}
                        onChange={(e) => setImportGameCode(e.target.value)}
                        className="flex-1 bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                      >
                        {state.availableGames.length === 0 ? (
                          <option value="">Sin partidas disponibles</option>
                        ) : (
                          state.availableGames.map((g) => (
                            <option key={g.code} value={g.code}>
                              {g.code} · {g.title} ({g.participantCount} jug.)
                            </option>
                          ))
                        )}
                      </select>
                      <button
                        type="button"
                        onClick={handleImportGameScores}
                        disabled={!importGameCode}
                        className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-bold text-xs cursor-pointer whitespace-nowrap"
                      >
                        Importar
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleImportVerifiedMissions}
                      className="w-full px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 font-bold text-xs inline-flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Sincronizar Misiones Verificadas (Etapa 6)
                    </button>
                  </div>
                )}
              </div>

              {/* Upcoming Competition Scheduler */}
              {directorAuthorized && (
                <form
                  onSubmit={handleAddUpcoming}
                  className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-3"
                >
                  <h3 className="font-display text-lg font-extrabold text-white">
                    Programar Próxima Competencia / Reto
                  </h3>
                  <input
                    type="text"
                    required
                    value={upTitle}
                    onChange={(e) => setUpTitle(e.target.value)}
                    placeholder="Ej: Reto Sorpresa de Parábolas"
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={upKind}
                      onChange={(e) => setUpKind(e.target.value as any)}
                      className="bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      <option value="competencia_biblica">
                        Competencia Bíblica
                      </option>
                      <option value="retos">Retos del Sábado</option>
                      <option value="mision">Misión Semanal</option>
                      <option value="gran_final">Gran Final</option>
                    </select>
                    <select
                      value={upSat}
                      onChange={(e) => setUpSat(Number(e.target.value))}
                      className="bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      {currentSeason.saturdays.map((s) => (
                        <option key={s.saturdayNumber} value={s.saturdayNumber}>
                          Sábado {s.saturdayNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="text"
                    value={upDesc}
                    onChange={(e) => setUpDesc(e.target.value)}
                    placeholder="Detalle corto de la actividad..."
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                  <button
                    type="submit"
                    className="w-full px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
                  >
                    Agregar al Calendario
                  </button>
                </form>
              )}
            </div>

            {/* Record Saturday Points & Audit Corrections */}
            <div className="lg:col-span-7 space-y-6">
              {directorAuthorized && (
                <form
                  onSubmit={handleRecordPoints}
                  className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-xl font-extrabold text-white">
                      Registrar Puntos · Sábado {selectedSaturdayNum}
                    </h2>
                    <input
                      type="text"
                      value={directorNameInput}
                      onChange={(e) => setDirectorNameInput(e.target.value)}
                      aria-label="Nombre del director"
                      className="bg-[#080E1E] border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white w-44"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Categoría de Puntos
                      </label>
                      <select
                        value={pointCategory}
                        onChange={(e) => {
                          const cat = e.target
                            .value as ChampionshipPointCategory;
                          setPointCategory(cat);
                          const meta = POINT_CATEGORY_META.find(
                            (m) => m.id === cat
                          );
                          if (meta) setPointAmount(meta.defaultPoints);
                        }}
                        className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
                      >
                        {POINT_CATEGORY_META.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Cantidad de Puntos
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10000}
                        required
                        value={pointAmount}
                        onChange={(e) =>
                          setPointAmount(Number(e.target.value) || 0)
                        }
                        className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono-num"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Equipo / Grupo
                      </label>
                      <select
                        value={pointTeamId}
                        onChange={(e) => setPointTeamId(e.target.value)}
                        className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
                      >
                        <option value="">Ninguno / Solo participante</option>
                        {currentSeason.teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Participante (opcional)
                      </label>
                      <select
                        value={pointParticipantId}
                        onChange={(e) => setPointParticipantId(e.target.value)}
                        className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
                      >
                        <option value="">Puntos grupales al equipo</option>
                        {currentSeason.participants.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <input
                    type="text"
                    required
                    value={pointSourceLabel}
                    onChange={(e) => setPointSourceLabel(e.target.value)}
                    placeholder="Descripción única del logro (ej: Reto de Ordenar Libros #1)"
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                  />

                  <button
                    type="submit"
                    className="px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm cursor-pointer"
                  >
                    Acreditar Puntos del Sábado
                  </button>
                </form>
              )}

              {/* Score Review & Audit Log */}
              <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="font-display text-lg font-extrabold text-white">
                  Revisión de Puntajes y Registro de Cambios
                </h3>

                {currentSeason.scoreEntries.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No hay puntajes registrados todavía.
                  </p>
                ) : (
                  <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                    {currentSeason.scoreEntries.map((entry) => {
                      const team = currentSeason.teams.find(
                        (t) => t.id === entry.teamId
                      );
                      const isEditing = editingEntryId === entry.id;
                      return (
                        <div
                          key={entry.id}
                          className={`bg-[#080E1E] border rounded-xl p-3 space-y-2 ${
                            entry.voided
                              ? 'border-rose-500/30 opacity-60'
                              : 'border-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <div className="min-w-0">
                              <p className="font-bold text-white truncate">
                                {entry.participantName || team?.name || 'Equipo'}{' '}
                                · Sáb. {entry.saturdayNumber}
                              </p>
                              <p className="text-slate-400 truncate">
                                {entry.sourceLabel}
                              </p>
                              {entry.voided && entry.voidedReason && (
                                <p className="text-rose-300">
                                  Anulado: {entry.voidedReason}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono-num font-extrabold text-amber-300 text-sm tabular-nums">
                                {entry.voided ? '0' : `+${entry.points}`} pts
                              </span>
                              {directorAuthorized && !entry.voided && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingEntryId(
                                      isEditing ? null : entry.id
                                    );
                                    setEditPointsVal(entry.points);
                                    setEditReason('');
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                                  title="Corregir o anular"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {isEditing && (
                            <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row gap-2">
                              <input
                                type="number"
                                min={1}
                                max={10000}
                                value={editPointsVal}
                                onChange={(e) =>
                                  setEditPointsVal(Number(e.target.value) || 0)
                                }
                                className="w-24 bg-[#111A2E] border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono-num"
                              />
                              <input
                                type="text"
                                value={editReason}
                                onChange={(e) => setEditReason(e.target.value)}
                                placeholder="Motivo obligatorio de corrección..."
                                className="flex-1 bg-[#111A2E] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleSaveScoreEdit(entry.id, false)
                                }
                                className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs cursor-pointer whitespace-nowrap"
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleSaveScoreEdit(entry.id, true)
                                }
                                className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-200 font-bold text-xs cursor-pointer whitespace-nowrap"
                              >
                                Anular
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {currentSeason.auditLogs.length > 0 && (
                  <div className="pt-3 border-t border-slate-800 space-y-1.5">
                    <p className="text-xs font-bold text-slate-300">
                      Historial de Auditoría ({currentSeason.auditLogs.length})
                    </p>
                    <div className="max-h-36 overflow-y-auto space-y-1 text-[11px] text-slate-400">
                      {currentSeason.auditLogs.slice(0, 12).map((log) => (
                        <p key={log.id}>
                          <span className="font-mono-num text-slate-500">
                            {new Date(log.editedAt).toLocaleDateString('es-ES')}
                          </span>{' '}
                          · <strong className="text-slate-200">{log.editedBy}</strong>:{' '}
                          {log.reason}{' '}
                          {typeof log.previousPoints === 'number' &&
                            typeof log.newPoints === 'number' &&
                            `(${log.previousPoints} → ${log.newPoints})`}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SEMIFINALES Y GRAN FINAL */}
      {activeTab === 'finales' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-[#111A2E] border border-slate-800 rounded-2xl p-5">
            <div>
              <h2 className="font-display text-2xl font-extrabold text-white">
                Fase Eliminatoria: Semifinales y Gran Final
              </h2>
              <p className="text-sm text-slate-400">
                Cruces oficiales basados en la clasificación acumulada de la
                temporada.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {directorAuthorized && (
                <button
                  type="button"
                  onClick={handleGeneratePlayoffs}
                  className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs cursor-pointer whitespace-nowrap"
                >
                  Generar / Actualizar Llaves
                </button>
              )}
              <button
                type="button"
                onClick={startGranFinalShow}
                className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4" />
                Presentación Especial Gran Final
              </button>
            </div>
          </div>

          {currentSeason.playoffs.semifinals.length === 0 &&
          !currentSeason.playoffs.finalMatch ? (
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-8 text-center space-y-2">
              <p className="font-display font-bold text-lg text-white">
                Las llaves eliminatorias aún no se han generado
              </p>
              <p className="text-sm text-slate-400">
                Cuando concluyan los sábados clasificatorios, el director puede
                generar Semifinales y Gran Final con un clic.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {currentSeason.playoffs.semifinals.map((sf) => {
                const draft = playoffScores[sf.id] || {
                  a: sf.competitorAScore,
                  b: sf.competitorBScore,
                };
                return (
                  <div
                    key={sf.id}
                    className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-4"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                      <span>{sf.roundLabel}</span>
                      <span>
                        {sf.completed
                          ? `Ganador: ${sf.winnerName}`
                          : 'Por definir'}
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between bg-[#080E1E] border border-slate-800 rounded-xl p-3">
                        <span className="font-bold text-sm text-white">
                          {sf.competitorAName}
                        </span>
                        <input
                          type="number"
                          disabled={!directorAuthorized}
                          value={draft.a}
                          onChange={(e) =>
                            setPlayoffScores((prev) => ({
                              ...prev,
                              [sf.id]: {
                                ...draft,
                                a: Number(e.target.value) || 0,
                              },
                            }))
                          }
                          className="w-20 bg-[#111A2E] border border-slate-700 rounded-lg px-2 py-1 text-right font-mono-num text-sm text-white"
                        />
                      </div>

                      <div className="flex items-center justify-between bg-[#080E1E] border border-slate-800 rounded-xl p-3">
                        <span className="font-bold text-sm text-white">
                          {sf.competitorBName}
                        </span>
                        <input
                          type="number"
                          disabled={!directorAuthorized}
                          value={draft.b}
                          onChange={(e) =>
                            setPlayoffScores((prev) => ({
                              ...prev,
                              [sf.id]: {
                                ...draft,
                                b: Number(e.target.value) || 0,
                              },
                            }))
                          }
                          className="w-20 bg-[#111A2E] border border-slate-700 rounded-lg px-2 py-1 text-right font-mono-num text-sm text-white"
                        />
                      </div>
                    </div>

                    {directorAuthorized && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdatePlayoffMatch(
                              sf.id,
                              draft.a,
                              draft.b,
                              true
                            )
                          }
                          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
                        >
                          Cerrar Semifinal y Avanzar Ganador
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {currentSeason.playoffs.finalMatch && (
                <div className="lg:col-span-2 bg-gradient-to-br from-[#192440] to-[#0D1527] border border-amber-400/50 rounded-3xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                      Gran Final del Campeonato
                    </span>
                    {currentSeason.playoffs.finalMatch.completed && (
                      <span className="text-xs font-bold text-emerald-300">
                        Campeón: {currentSeason.playoffs.championName}
                      </span>
                    )}
                  </div>

                  {(() => {
                    const fm = currentSeason.playoffs.finalMatch!;
                    const draft = playoffScores[fm.id] || {
                      a: fm.competitorAScore,
                      b: fm.competitorBScore,
                    };
                    return (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-[#080E1E]/80 border border-slate-700 rounded-2xl p-4 flex items-center justify-between">
                            <span className="font-display font-bold text-lg text-white">
                              {fm.competitorAName}
                            </span>
                            <input
                              type="number"
                              disabled={!directorAuthorized}
                              value={draft.a}
                              onChange={(e) =>
                                setPlayoffScores((prev) => ({
                                  ...prev,
                                  [fm.id]: {
                                    ...draft,
                                    a: Number(e.target.value) || 0,
                                  },
                                }))
                              }
                              className="w-24 bg-[#111A2E] border border-slate-600 rounded-xl px-3 py-2 text-right font-mono-num text-lg font-extrabold text-amber-300"
                            />
                          </div>

                          <div className="bg-[#080E1E]/80 border border-slate-700 rounded-2xl p-4 flex items-center justify-between">
                            <span className="font-display font-bold text-lg text-white">
                              {fm.competitorBName}
                            </span>
                            <input
                              type="number"
                              disabled={!directorAuthorized}
                              value={draft.b}
                              onChange={(e) =>
                                setPlayoffScores((prev) => ({
                                  ...prev,
                                  [fm.id]: {
                                    ...draft,
                                    b: Number(e.target.value) || 0,
                                  },
                                }))
                              }
                              className="w-24 bg-[#111A2E] border border-slate-600 rounded-xl px-3 py-2 text-right font-mono-num text-lg font-extrabold text-amber-300"
                            />
                          </div>
                        </div>

                        {directorAuthorized && (
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdatePlayoffMatch(
                                  fm.id,
                                  draft.a,
                                  draft.b,
                                  true
                                )
                              }
                              className="px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm cursor-pointer"
                            >
                              Coronar Campeón de Temporada
                            </button>

                            {currentSeason.status === 'activa' && (
                              <button
                                type="button"
                                onClick={handleArchiveSeason}
                                className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm cursor-pointer"
                              >
                                Guardar y Archivar Temporada
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: TEMPORADAS ANTERIORES Y NUEVA TEMPORADA */}
      {activeTab === 'temporadas' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {directorAuthorized && (
            <form
              onSubmit={handleCreateSeason}
              className="lg:col-span-6 bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-4"
            >
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400" />
                <h2 className="font-display text-xl font-extrabold text-white">
                  Crear Nueva Temporada (4 o 5 Sábados)
                </h2>
              </div>

              <input
                type="text"
                required
                value={newSeasonName}
                onChange={(e) => setNewSeasonName(e.target.value)}
                placeholder="Ej: Temporada Primavera Juvenil"
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
              />

              <textarea
                rows={2}
                value={newSeasonDesc}
                onChange={(e) => setNewSeasonDesc(e.target.value)}
                placeholder="Descripción o tema espiritual de la temporada..."
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Fecha de inicio
                  </label>
                  <input
                    type="date"
                    value={newSeasonStart}
                    onChange={(e) => setNewSeasonStart(e.target.value)}
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Duración
                  </label>
                  <select
                    value={newSeasonSaturdays}
                    onChange={(e) =>
                      setNewSeasonSaturdays(
                        Number(e.target.value) === 5 ? 5 : 4
                      )
                    }
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value={4}>4 Sábados</option>
                    <option value={5}>5 Sábados</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Tipo de competencia
                  </label>
                  <select
                    value={newSeasonType}
                    onChange={(e) =>
                      setNewSeasonType(e.target.value as YouthCompetitionType)
                    }
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="equipos">Equipos</option>
                    <option value="individual">Individual</option>
                    <option value="grupos_juveniles">
                      Entre Grupos Juveniles
                    </option>
                    <option value="iglesias">Entre Iglesias</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-300">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      newSeasonType === 'iglesias' || newSeasonAllowChurch
                    }
                    onChange={(e) => setNewSeasonAllowChurch(e.target.checked)}
                  />
                  Habilitar participación entre iglesias
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={copyTeamsFromActive}
                    onChange={(e) => setCopyTeamsFromActive(e.target.checked)}
                  />
                  Mantener los equipos de la temporada actual como base
                </label>
              </div>

              <button
                type="submit"
                className="w-full px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm cursor-pointer"
              >
                Crear Temporada de Campeonato
              </button>
            </form>
          )}

          <div
            className={`${
              directorAuthorized ? 'lg:col-span-6' : 'lg:col-span-12'
            } space-y-4`}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-xl font-extrabold text-white">
                Historial de Temporadas ({state.seasons.length})
              </h2>
              {directorAuthorized && currentSeason.status === 'activa' && (
                <button
                  type="button"
                  onClick={handleArchiveSeason}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white cursor-pointer"
                >
                  Cerrar y Guardar Temporada Actual
                </button>
              )}
            </div>

            <div className="space-y-3">
              {state.seasons.map((s) => (
                <div
                  key={s.id}
                  className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span
                        className={`font-bold ${
                          s.status === 'archivada'
                            ? 'text-slate-300'
                            : 'text-emerald-300'
                        }`}
                      >
                        {s.status === 'archivada' ? 'Archivada' : 'Activa'}
                      </span>
                      <span>·</span>
                      <span className="font-mono-num tabular-nums">
                        {s.startDate} al {s.endDate}
                      </span>
                      <span>·</span>
                      <span>{s.saturdaysCount} sábados</span>
                    </div>
                    <h3 className="font-display font-bold text-lg text-white">
                      {s.name}
                    </h3>
                    {s.playoffs.championName && (
                      <p className="text-xs font-bold text-amber-300">
                        Campeón: {s.playoffs.championName}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSeasonId(s.id);
                      setActiveTab('tablero');
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-amber-400 hover:text-slate-950 text-white text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Ver Tabla
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* GRAN FINAL CINEMATIC SHOW MODAL */}
      {granFinalShowOpen && (
        <div className="fixed inset-0 z-50 bg-[#050914] text-white flex flex-col justify-between p-6 sm:p-10 overflow-y-auto">
          <div className="flex items-center justify-between gap-4 max-w-6xl w-full mx-auto">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-300">
                Gran Final · {currentSeason.name}
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                Ceremonia de Ganadores y Reconocimiento
              </h2>
            </div>

            <button
              type="button"
              onClick={() => {
                setGranFinalShowOpen(false);
                setCountdownVal(null);
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white inline-flex items-center gap-2 cursor-pointer"
            >
              <X className="w-4 h-4" />
              Salir de presentación
            </button>
          </div>

          <div className="max-w-5xl w-full mx-auto my-auto py-8">
            {finalStageStep === 'countdown' ? (
              <div className="text-center space-y-6">
                <p className="text-sm uppercase tracking-widest text-amber-300 font-bold">
                  Preparando Proyección de Gran Final
                </p>
                <div className="font-mono-num text-8xl sm:text-9xl font-extrabold text-amber-300 tabular-nums animate-bounce">
                  {countdownVal === 0 ? '¡YA!' : countdownVal}
                </div>
                <p className="text-base text-slate-300">
                  Celebramos el esfuerzo bíblico, la unidad y el servicio de
                  todos los jóvenes.
                </p>
              </div>
            ) : (
              <div className="space-y-10">
                {/* Podium */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end">
                  {/* 2nd Place */}
                  <div className="bg-[#111A2E] border border-sky-400/40 rounded-3xl p-6 text-center space-y-2 order-2 md:order-1">
                    <Medal className="w-10 h-10 text-sky-300 mx-auto" />
                    <p className="text-xs font-bold uppercase text-sky-300">
                      2° Lugar · Subcampeón
                    </p>
                    <h3 className="font-display text-xl font-extrabold text-white">
                      {currentSeason.playoffs.runnerUpName ||
                        teamRows[1]?.team.name ||
                        partRows[1]?.participant.name ||
                        'Por definir'}
                    </h3>
                    <p className="font-mono-num text-sm text-slate-300 tabular-nums">
                      {(teamRows[1]?.totalPoints ?? partRows[1]?.totalPoints ?? 0)}{' '}
                      pts
                    </p>
                  </div>

                  {/* 1st Place Champion */}
                  <div className="bg-gradient-to-b from-amber-500/20 to-[#111A2E] border-2 border-amber-400 rounded-3xl p-8 text-center space-y-3 order-1 md:order-2">
                    <Crown className="w-14 h-14 text-amber-300 mx-auto" />
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                      Campeón de Temporada
                    </p>
                    <h3 className="font-display text-3xl font-extrabold text-white">
                      {currentSeason.playoffs.championName ||
                        teamRows[0]?.team.name ||
                        partRows[0]?.participant.name ||
                        'Por definir'}
                    </h3>
                    <p className="font-mono-num text-lg font-extrabold text-amber-300 tabular-nums">
                      {(teamRows[0]?.totalPoints ?? partRows[0]?.totalPoints ?? 0)}{' '}
                      pts totales
                    </p>
                  </div>

                  {/* 3rd Place */}
                  <div className="bg-[#111A2E] border border-emerald-400/40 rounded-3xl p-6 text-center space-y-2 order-3">
                    <Award className="w-10 h-10 text-emerald-300 mx-auto" />
                    <p className="text-xs font-bold uppercase text-emerald-300">
                      3° Lugar
                    </p>
                    <h3 className="font-display text-xl font-extrabold text-white">
                      {currentSeason.playoffs.thirdPlaceName ||
                        teamRows[2]?.team.name ||
                        partRows[2]?.participant.name ||
                        'Por definir'}
                    </h3>
                    <p className="font-mono-num text-sm text-slate-300 tabular-nums">
                      {(teamRows[2]?.totalPoints ?? partRows[2]?.totalPoints ?? 0)}{' '}
                      pts
                    </p>
                  </div>
                </div>

                {/* All Participants Recognition Wall */}
                <div className="bg-[#111A2E] border border-slate-800 rounded-3xl p-6 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-lg font-extrabold text-white">
                      Reconocimiento Especial a Todos los Participantes
                    </h3>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>
                  {partRows.length === 0 ? (
                    <p className="text-sm text-slate-400">
                      Todos los equipos participantes reciben honra por su
                      dedicación en la Palabra y el servicio.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {partRows.map((row) => (
                        <div
                          key={row.participant.id}
                          className="bg-[#080E1E] border border-slate-800 rounded-2xl p-3 flex items-center gap-3"
                        >
                          <AvatarBadge
                            avatarId={row.participant.avatarId}
                            photoUrl={row.participant.photoDataUrl}
                            name={row.participant.name}
                            size="md"
                          />
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-white truncate">
                              {row.participant.name}
                            </p>
                            <p className="text-xs text-amber-300 font-mono-num tabular-nums">
                              {row.totalPoints} pts · {row.teamName || 'Individual'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-slate-500">
            Dime Tú Qué Dices · Sociedad de Jóvenes
          </p>
        </div>
      )}
    </div>
  );
}
