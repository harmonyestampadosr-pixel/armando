import { useEffect, useState } from 'react';
import { AprendeBibliaView } from './components/AprendeBibliaView';
import { AudioControls } from './components/AudioControls';
import { AventurasBiblicasView } from './components/AventurasBiblicasView';
import { BattleArenaView } from './components/BattleArenaView';
import { BattleSetupView } from './components/BattleSetupView';
import { CabinaSorpresasView } from './components/CabinaSorpresasView';
import { CampeonatoRondasView } from './components/CampeonatoRondasView';
import { CampeonatosJuvenilesView } from './components/CampeonatosJuvenilesView';
import { CentroControlProjectorView } from './components/CentroControlProjectorView';
import { CentroControlSabadoView } from './components/CentroControlSabadoView';
import { CreateGameView } from './components/CreateGameView';
import { EstadisticasView } from './components/EstadisticasView';
import { GrandesTorneosView } from './components/GrandesTorneosView';
import { HistoryLeaderboardView } from './components/HistoryLeaderboardView';
import { AppRoute, HomeView } from './components/HomeView';
import { IaCreativaJuvenilView } from './components/IaCreativaJuvenilView';
import { DirectInviteParams, JoinView } from './components/JoinView';
import { LobbyRoomsView } from './components/LobbyRoomsView';
import { MiSociedadJovenesView } from './components/MiSociedadJovenesView';
import { MiSociedadProyectorView } from './components/MiSociedadProyectorView';
import { MiTrayectoriaView } from './components/MiTrayectoriaView';
import { MisionSemanaView } from './components/MisionSemanaView';
import { NuestrasMemoriasView } from './components/NuestrasMemoriasView';
import { PlayerView } from './components/PlayerView';
import { PresenterView } from './components/PresenterView';
import { ProgramaSabadoView } from './components/ProgramaSabadoView';
import { ProjectorView } from './components/ProjectorView';
import { QuestionBankView } from './components/QuestionBankView';
import { QuienSoyMisterioView } from './components/QuienSoyMisterioView';
import { RankingGeneralView } from './components/RankingGeneralView';
import { RetosBiblicosView } from './components/RetosBiblicosView';
import { RetosSabadoView } from './components/RetosSabadoView';
import { RuletaBiblicaView } from './components/RuletaBiblicaView';
import { RuletaSabadoView } from './components/RuletaSabadoView';
import { TalentosJuvenilesView } from './components/TalentosJuvenilesView';
import { TeamCompetitionSetupView } from './components/TeamCompetitionSetupView';
import { soundFX } from './utils/sound';

function getSavedPresenterToken(code: string): string | null {
  try {
    return localStorage.getItem(`dtqd_presenter_${code.toUpperCase()}`);
  } catch {
    return null;
  }
}

function savePresenterToken(code: string, token: string): void {
  try {
    localStorage.setItem(`dtqd_presenter_${code.toUpperCase()}`, token);
    localStorage.setItem('dtqd_last_presenter_code', code.toUpperCase());
  } catch {
    // ignore
  }
}

function getSavedPlayerToken(identifier: string): string | null {
  try {
    return localStorage.getItem(`dtqd_player_${identifier.toUpperCase()}`);
  } catch {
    return null;
  }
}

function savePlayerToken(
  code: string,
  token: string,
  gameId?: string
): void {
  try {
    localStorage.setItem(`dtqd_player_${code.toUpperCase()}`, token);
    if (gameId) {
      localStorage.setItem(`dtqd_player_${gameId.toUpperCase()}`, token);
      localStorage.setItem(`dtqd_code_for_${gameId.toUpperCase()}`, code.toUpperCase());
    }
  } catch {
    // ignore
  }
}

function getCodeForSavedId(identifier: string): string {
  try {
    return (
      localStorage.getItem(`dtqd_code_for_${identifier.toUpperCase()}`) ||
      identifier.toUpperCase()
    );
  } catch {
    return identifier.toUpperCase();
  }
}

interface InitialRouteState {
  route: AppRoute;
  activeCode: string;
  activeGameId: string;
  directInvite: DirectInviteParams | null;
  presenterToken: string;
  playerToken: string;
  tournamentId?: string;
  tournamentSig?: string;
  sharedMemoryToken?: string;
  ccSessionId?: string;
  ccParticipantMode?: boolean;
  ysProgramId?: string;
}

function resolveInitialRouteState(): InitialRouteState {
  if (typeof window === 'undefined') {
    return {
      route: 'home',
      activeCode: '',
      activeGameId: '',
      directInvite: null,
      presenterToken: '',
      playerToken: '',
    };
  }

  const pathname = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  const sig = params.get('s') || undefined;

  const memoriaPathMatch = pathname.match(/^\/memorias\/([^/]+)\/?$/i);
  if (memoriaPathMatch) {
    return {
      route: 'nuestras_memorias',
      activeCode: '',
      activeGameId: '',
      directInvite: null,
      presenterToken: '',
      playerToken: '',
      sharedMemoryToken: decodeURIComponent(memoriaPathMatch[1]),
    };
  }

  const memoriaQuery = params.get('memoria');
  if (memoriaQuery) {
    return {
      route: 'nuestras_memorias',
      activeCode: '',
      activeGameId: '',
      directInvite: null,
      presenterToken: '',
      playerToken: '',
      sharedMemoryToken: memoriaQuery.trim(),
    };
  }

  const ccProyector = params.get('cc_proyector');
  if (ccProyector) {
    return {
      route: 'cc_proyector',
      activeCode: '',
      activeGameId: '',
      directInvite: null,
      presenterToken: '',
      playerToken: '',
      ccSessionId: ccProyector.trim(),
    };
  }

  const ccParticipante = params.get('cc_participante');
  if (ccParticipante) {
    return {
      route: 'centro_control',
      activeCode: '',
      activeGameId: '',
      directInvite: null,
      presenterToken: '',
      playerToken: '',
      ccSessionId: ccParticipante.trim(),
      ccParticipantMode: true,
    };
  }

  const ccSession = params.get('cc');
  if (ccSession) {
    return {
      route: 'centro_control',
      activeCode: '',
      activeGameId: '',
      directInvite: null,
      presenterToken: '',
      playerToken: '',
      ccSessionId: ccSession.trim(),
      ccParticipantMode: false,
    };
  }

  const sjProyector = params.get('sj_proyector');
  if (sjProyector) {
    return {
      route: 'mi_sociedad_proyector',
      activeCode: '',
      activeGameId: '',
      directInvite: null,
      presenterToken: '',
      playerToken: '',
      ysProgramId: sjProyector.trim(),
    };
  }

  const sjProgram = params.get('sj');
  if (sjProgram) {
    return {
      route: 'mi_sociedad',
      activeCode: '',
      activeGameId: '',
      directInvite: null,
      presenterToken: '',
      playerToken: '',
      ysProgramId: sjProgram.trim(),
    };
  }

  const torneoMatch = pathname.match(/^\/torneo\/([^/]+)\/?$/i);
  if (torneoMatch) {
    return {
      route: 'tournaments',
      activeCode: '',
      activeGameId: '',
      directInvite: null,
      presenterToken: '',
      playerToken: '',
      tournamentId: decodeURIComponent(torneoMatch[1]).toUpperCase(),
      tournamentSig: sig,
    };
  }

  const unirseMatch = pathname.match(/^\/(?:partida|unirse|join)\/([^/]+)\/?$/i);
  if (unirseMatch) {
    const identifier = decodeURIComponent(unirseMatch[1]).toUpperCase();
    const existingPlayerToken = getSavedPlayerToken(identifier);
    if (existingPlayerToken) {
      const resolvedCode = getCodeForSavedId(identifier);
      return {
        route: 'player',
        activeCode: resolvedCode,
        activeGameId: identifier,
        directInvite: { identifier, signature: sig },
        presenterToken: '',
        playerToken: existingPlayerToken,
      };
    }
    return {
      route: 'join',
      activeCode: identifier,
      activeGameId: identifier,
      directInvite: { identifier, signature: sig },
      presenterToken: '',
      playerToken: '',
    };
  }

  const projectorPathMatch = pathname.match(/^\/proyeccion\/([^/]+)\/?$/i);
  if (projectorPathMatch) {
    return {
      route: 'projector',
      activeCode: decodeURIComponent(projectorPathMatch[1]).toUpperCase(),
      activeGameId: '',
      directInvite: null,
      presenterToken: '',
      playerToken: '',
    };
  }

  const joinCode = params.get('join');
  const hasProjectorParam = params.has('projector');
  const projectorCode = params.get('projector');
  const presenterCode = params.get('presenter');

  if (hasProjectorParam) {
    return {
      route: 'projector',
      activeCode: (projectorCode || '').toUpperCase(),
      activeGameId: '',
      directInvite: null,
      presenterToken: '',
      playerToken: '',
    };
  }

  if (presenterCode) {
    const upper = presenterCode.toUpperCase();
    const saved = getSavedPresenterToken(upper);
    if (saved) {
      return {
        route: 'presenter',
        activeCode: upper,
        activeGameId: '',
        directInvite: null,
        presenterToken: saved,
        playerToken: '',
      };
    }
  }

  if (joinCode) {
    const upper = joinCode.toUpperCase();
    const existingPlayerToken = getSavedPlayerToken(upper);
    if (existingPlayerToken) {
      return {
        route: 'player',
        activeCode: upper,
        activeGameId: '',
        directInvite: { identifier: upper, signature: sig },
        presenterToken: '',
        playerToken: existingPlayerToken,
      };
    }
    return {
      route: 'join',
      activeCode: upper,
      activeGameId: '',
      directInvite: { identifier: upper, signature: sig },
      presenterToken: '',
      playerToken: '',
    };
  }

  return {
    route: 'home',
    activeCode: '',
    activeGameId: '',
    directInvite: null,
    presenterToken: '',
    playerToken: '',
  };
}

export default function App() {
  const [initial] = useState<InitialRouteState>(() => resolveInitialRouteState());
  const [route, setRoute] = useState<AppRoute>(initial.route);
  const [activeCode, setActiveCode] = useState<string>(initial.activeCode);
  const [activeGameId, setActiveGameId] = useState<string>(initial.activeGameId);
  const [directInvite, setDirectInvite] = useState<DirectInviteParams | null>(
    initial.directInvite
  );
  const [presenterToken, setPresenterToken] = useState<string>(
    initial.presenterToken
  );
  const [playerToken, setPlayerToken] = useState<string>(initial.playerToken);
  const [activeTournamentId, setActiveTournamentId] = useState<string>(
    initial.tournamentId || ''
  );
  const [activeTournamentSig, setActiveTournamentSig] = useState<string>(
    initial.tournamentSig || ''
  );
  const [sharedMemoryToken, setSharedMemoryToken] = useState<string>(
    initial.sharedMemoryToken || ''
  );
  const [ccSessionId, setCcSessionId] = useState<string>(
    initial.ccSessionId || ''
  );
  const [ccParticipantMode, setCcParticipantMode] = useState<boolean>(
    Boolean(initial.ccParticipantMode)
  );
  const [ysProgramId, setYsProgramId] = useState<string>(
    initial.ysProgramId || ''
  );
  const [recentPresenterCode, setRecentPresenterCode] = useState<string | null>(
    () => {
      try {
        return localStorage.getItem('dtqd_last_presenter_code');
      } catch {
        return null;
      }
    }
  );

  const [projectorFromPresenter, setProjectorFromPresenter] = useState(false);
  const [selectedSaturdayProgramId, setSelectedSaturdayProgramId] =
    useState<string>('');

  useEffect(() => {
    if (
      route !== 'presenter' &&
      route !== 'player' &&
      route !== 'projector' &&
      route !== 'battle'
    ) {
      soundFX.setWelcomeMusicActive(true);
    }
  }, [route]);

  const openCreatedPresenterRoom = (code: string, token: string) => {
    savePresenterToken(code, token);
    setRecentPresenterCode(code);
    setActiveCode(code);
    setPresenterToken(token);
    setProjectorFromPresenter(false);
    setRoute('presenter');
    window.history.replaceState(
      null,
      '',
      `/?presenter=${encodeURIComponent(code)}`
    );
  };

  const openProjectorFromPresenter = (code: string) => {
    const upper = code.trim().toUpperCase();
    setProjectorFromPresenter(true);
    setActiveCode(upper);
    setRoute('projector');
    window.history.replaceState(
      null,
      '',
      `/?projector=${encodeURIComponent(upper)}`
    );
  };

  const navigate = (nextRoute: AppRoute, code?: string) => {
    const upperCode = code ? code.toUpperCase() : '';
    if (nextRoute !== 'tournaments') {
      setActiveTournamentId('');
      setActiveTournamentSig('');
    }
    if (nextRoute !== 'nuestras_memorias' && sharedMemoryToken) {
      setSharedMemoryToken('');
    }
    if (nextRoute !== 'projector') {
      setProjectorFromPresenter(false);
    }
    if (nextRoute !== 'saturday_program') {
      setSelectedSaturdayProgramId('');
    }

    if (nextRoute === 'projector') {
      setProjectorFromPresenter(false);
      setActiveCode(upperCode);
      setRoute('projector');
      window.history.replaceState(
        null,
        '',
        upperCode ? `/?projector=${encodeURIComponent(upperCode)}` : '/?projector'
      );
      return;
    }

    if (nextRoute === 'presenter' && upperCode) {
      const saved = getSavedPresenterToken(upperCode);
      if (saved) {
        setActiveCode(upperCode);
        setPresenterToken(saved);
        setRoute('presenter');
        window.history.replaceState(
          null,
          '',
          `/?presenter=${encodeURIComponent(upperCode)}`
        );
        return;
      }
      setRoute('create');
      return;
    }

    if (nextRoute === 'join') {
      if (upperCode) {
        const existingPlayerToken = getSavedPlayerToken(upperCode);
        setActiveCode(upperCode);
        if (existingPlayerToken) {
          setPlayerToken(existingPlayerToken);
          setRoute('player');
          window.history.replaceState(
            null,
            '',
            `/partida/${encodeURIComponent(upperCode)}`
          );
          return;
        }
        setDirectInvite({ identifier: upperCode });
        window.history.replaceState(
          null,
          '',
          `/partida/${encodeURIComponent(upperCode)}`
        );
      } else {
        setActiveCode('');
        setDirectInvite(null);
        window.history.replaceState(null, '', '/');
      }
      setRoute('join');
      return;
    }

    setDirectInvite(null);
    setRoute(nextRoute);
    if (nextRoute === 'home') {
      window.history.replaceState(null, '', '/');
    }
  };

  // Dedicated full-screen projection route without standard header
  if (route === 'projector') {
    const canReturnToPresenter =
      projectorFromPresenter &&
      Boolean(presenterToken || (activeCode && getSavedPresenterToken(activeCode)));
    return (
      <ProjectorView
        code={activeCode}
        onBack={() => navigate('home')}
        onReturnToPresenter={
          canReturnToPresenter
            ? () => {
                const tok = presenterToken || getSavedPresenterToken(activeCode) || '';
                if (tok && activeCode) {
                  setPresenterToken(tok);
                  setProjectorFromPresenter(false);
                  setRoute('presenter');
                  window.history.replaceState(
                    null,
                    '',
                    `/?presenter=${encodeURIComponent(activeCode)}`
                  );
                } else {
                  navigate('home');
                }
              }
            : undefined
        }
        onSelectCode={(newCode) => {
          const upper = newCode.trim().toUpperCase();
          setProjectorFromPresenter(false);
          setActiveCode(upper);
          window.history.replaceState(
            null,
            '',
            upper ? `/?projector=${encodeURIComponent(upper)}` : '/?projector'
          );
        }}
      />
    );
  }

  if (route === 'cc_proyector' && (ccSessionId || activeCode)) {
    return (
      <CentroControlProjectorView
        sessionId={ccSessionId || activeCode}
        onBack={() => {
          setRoute('centro_control');
          window.history.replaceState(null, '', '/');
        }}
      />
    );
  }

  if (route === 'mi_sociedad_proyector' && (ysProgramId || activeCode)) {
    return (
      <MiSociedadProyectorView
        programId={ysProgramId || activeCode}
        onBack={() => {
          setRoute('mi_sociedad');
          window.history.replaceState(null, '', '/');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#080E1E] text-slate-100 flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="border-b border-slate-800/80 bg-[#080E1E]/95 sticky top-0 z-30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => navigate('home')}
            className="font-display font-extrabold text-lg sm:text-xl tracking-tight text-amber-400 whitespace-nowrap shrink-0 cursor-pointer"
          >
            DIME TÚ QUÉ DICES
          </button>

          {/* Zone 2: 5 concise single-line nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            <button
              type="button"
              onClick={() => navigate('home')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                route === 'home' ? 'text-white underline underline-offset-8 decoration-amber-400' : ''
              }`}
            >
              Inicio
            </button>
            <button
              type="button"
              onClick={() => navigate('lobby')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                route === 'lobby' ? 'text-white underline underline-offset-8 decoration-amber-400' : ''
              }`}
            >
              Sala de Juegos
            </button>
            <button
              type="button"
              onClick={() => navigate('bank')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                route === 'bank' ? 'text-white underline underline-offset-8 decoration-amber-400' : ''
              }`}
            >
              Banco Bíblico
            </button>
            <button
              type="button"
              onClick={() => navigate('leaderboard')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                route === 'leaderboard' ? 'text-white underline underline-offset-8 decoration-amber-400' : ''
              }`}
            >
              Clasificación
            </button>
            <button
              type="button"
              onClick={() => navigate('history')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                route === 'history' ? 'text-white underline underline-offset-8 decoration-amber-400' : ''
              }`}
            >
              Historial
            </button>
          </nav>

          {/* Zone 3: Audio Controls + 1 Primary CTA */}
          <div className="shrink-0 flex items-center gap-2 sm:gap-2.5">
            <AudioControls />
            <button
              type="button"
              onClick={() => navigate('create')}
              className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Crear Partida
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {route === 'home' && (
          <HomeView
            onNavigate={navigate}
            recentPresenterCode={recentPresenterCode}
          />
        )}

        {route === 'create' && (
          <CreateGameView
            onCreated={(code, token) => {
              savePresenterToken(code, token);
              setRecentPresenterCode(code);
              setActiveCode(code);
              setPresenterToken(token);
              setRoute('presenter');
              window.history.replaceState(
                null,
                '',
                `/?presenter=${encodeURIComponent(code)}`
              );
            }}
            onCancel={() => navigate('home')}
          />
        )}

        {route === 'battle_setup' && (
          <BattleSetupView
            onCreated={(
              code,
              pPresenterToken,
              pParticipantToken,
              _pid,
              gameId
            ) => {
              savePresenterToken(code, pPresenterToken);
              savePlayerToken(code, pParticipantToken, gameId);
              setRecentPresenterCode(code);
              setActiveCode(code);
              setActiveGameId(gameId);
              setPresenterToken(pPresenterToken);
              setPlayerToken(pParticipantToken);
              setRoute('battle');
              window.history.replaceState(
                null,
                '',
                `/partida/${encodeURIComponent(gameId)}`
              );
            }}
            onCancel={() => navigate('home')}
          />
        )}

        {route === 'team_setup' && (
          <TeamCompetitionSetupView
            onCreated={(code, token) => {
              savePresenterToken(code, token);
              setRecentPresenterCode(code);
              setActiveCode(code);
              setPresenterToken(token);
              setRoute('presenter');
              window.history.replaceState(
                null,
                '',
                `/?presenter=${encodeURIComponent(code)}`
              );
            }}
            onCancel={() => navigate('home')}
          />
        )}

        {route === 'join' && (
          <JoinView
            initialCode={activeCode}
            directInvite={directInvite}
            onJoined={(code, token, _pid, gameId, mode) => {
              savePlayerToken(code, token, gameId);
              setActiveCode(code);
              if (gameId) setActiveGameId(gameId);
              setPlayerToken(token);
              setRoute(mode === 'batalla_1v1' ? 'battle' : 'player');
              const targetId = gameId || code;
              const qs = window.location.search || '';
              window.history.replaceState(
                null,
                '',
                `/partida/${encodeURIComponent(targetId)}${qs}`
              );
            }}
            onBack={() => navigate('home')}
          />
        )}

        {route === 'presenter' && activeCode && presenterToken && (
          <PresenterView
            code={activeCode}
            token={presenterToken}
            onNewGame={() => navigate('create')}
            onExit={() => navigate('home')}
            onOpenProjector={openProjectorFromPresenter}
          />
        )}

        {route === 'battle' && activeCode && playerToken && (
          <BattleArenaView
            code={activeCode}
            playerToken={playerToken}
            presenterToken={
              presenterToken || getSavedPresenterToken(activeCode) || undefined
            }
            onExit={(rejoinDirect) => {
              try {
                localStorage.removeItem(`dtqd_player_${activeCode}`);
                if (activeGameId) {
                  localStorage.removeItem(`dtqd_player_${activeGameId}`);
                  localStorage.removeItem(`dtqd_code_for_${activeGameId}`);
                }
              } catch {
                // ignore
              }
              if (rejoinDirect && directInvite?.identifier) {
                setPlayerToken('');
                setRoute('join');
                return;
              }
              navigate('home');
            }}
          />
        )}

        {route === 'player' && activeCode && playerToken && (
          <PlayerView
            code={activeCode}
            token={playerToken}
            presenterToken={
              presenterToken || getSavedPresenterToken(activeCode) || undefined
            }
            onExit={(rejoinDirect) => {
              try {
                localStorage.removeItem(`dtqd_player_${activeCode}`);
                if (activeGameId) {
                  localStorage.removeItem(`dtqd_player_${activeGameId}`);
                  localStorage.removeItem(`dtqd_code_for_${activeGameId}`);
                }
              } catch {
                // ignore
              }
              if (rejoinDirect && directInvite?.identifier) {
                setPlayerToken('');
                setRoute('join');
                return;
              }
              navigate('home');
            }}
          />
        )}

        {route === 'lobby' && (
          <LobbyRoomsView
            onJoinCode={(code) => navigate('join', code)}
            onCreateGame={() => navigate('create')}
          />
        )}

        {route === 'bank' && <QuestionBankView />}

        {route === 'leaderboard' && (
          <HistoryLeaderboardView initialTab="clasificacion" />
        )}

        {route === 'history' && (
          <HistoryLeaderboardView initialTab="historial" />
        )}

        {route === 'roulette' && (
          <RuletaBiblicaView
            onBack={() => navigate('home')}
            onCreatedMultiplayerRoom={openCreatedPresenterRoom}
            onJoinCode={(c) => navigate('join', c)}
          />
        )}

        {route === 'retos' && (
          <RetosBiblicosView
            onBack={() => navigate('home')}
            onCreatedMultiplayerRoom={openCreatedPresenterRoom}
            onJoinCode={(c) => navigate('join', c)}
          />
        )}

        {route === 'mystery' && (
          <QuienSoyMisterioView
            onBack={() => navigate('home')}
            onCreatedMultiplayerRoom={openCreatedPresenterRoom}
            onJoinCode={(c) => navigate('join', c)}
          />
        )}

        {route === 'trajectory' && (
          <MiTrayectoriaView onBack={() => navigate('home')} />
        )}

        {route === 'learning' && (
          <AprendeBibliaView
            onBack={() => navigate('home')}
            onCreatedMultiplayerRoom={openCreatedPresenterRoom}
            onJoinCode={(c) => navigate('join', c)}
          />
        )}

        {route === 'tournaments' && (
          <GrandesTorneosView
            initialTournamentId={activeTournamentId || undefined}
            initialSignature={activeTournamentSig || undefined}
            onBack={() => navigate('home')}
          />
        )}

        {route === 'championship' && (
          <CampeonatoRondasView
            onBack={() => navigate('home')}
            onCreatedRoom={openCreatedPresenterRoom}
          />
        )}

        {route === 'stats' && (
          <EstadisticasView onBack={() => navigate('home')} />
        )}

        {route === 'ranking' && (
          <RankingGeneralView onBack={() => navigate('home')} />
        )}

        {route === 'saturday_program' && (
          <ProgramaSabadoView
            onBack={() => navigate('home')}
            initialProgramId={selectedSaturdayProgramId || undefined}
          />
        )}

        {route === 'ia_creativa' && (
          <IaCreativaJuvenilView
            onBack={() => navigate('home')}
            onOpenSaturdayProgram={(satProgramId) => {
              setSelectedSaturdayProgramId(satProgramId || '');
              setRoute('saturday_program');
            }}
            onCreatedMultiplayerRoom={openCreatedPresenterRoom}
          />
        )}

        {route === 'retos_sabado' && (
          <RetosSabadoView
            onBack={() => navigate('home')}
            onCreatedMultiplayerRoom={openCreatedPresenterRoom}
            onJoinCode={(c) => navigate('join', c)}
          />
        )}

        {route === 'ruleta_sabado' && (
          <RuletaSabadoView
            onBack={() => navigate('home')}
            onCreatedMultiplayerRoom={openCreatedPresenterRoom}
            onJoinCode={(c) => navigate('join', c)}
          />
        )}

        {route === 'talentos_juveniles' && (
          <TalentosJuvenilesView
            onBack={() => navigate('home')}
            onCreatedMultiplayerRoom={openCreatedPresenterRoom}
            onJoinCode={(c) => navigate('join', c)}
          />
        )}

        {route === 'aventuras_biblicas' && (
          <AventurasBiblicasView
            onBack={() => navigate('home')}
            onCreatedMultiplayerRoom={openCreatedPresenterRoom}
            onJoinCode={(c) => navigate('join', c)}
          />
        )}

        {route === 'mision_semana' && (
          <MisionSemanaView onBack={() => navigate('home')} />
        )}

        {route === 'campeonatos_juveniles' && (
          <CampeonatosJuvenilesView
            onBack={() => navigate('home')}
            onCreatedMultiplayerRoom={openCreatedPresenterRoom}
          />
        )}

        {route === 'cabina_sorpresas' && (
          <CabinaSorpresasView onBack={() => navigate('home')} />
        )}

        {route === 'nuestras_memorias' && (
          <NuestrasMemoriasView
            onBack={() => navigate('home')}
            sharedToken={sharedMemoryToken || undefined}
          />
        )}

        {route === 'centro_control' && (
          <CentroControlSabadoView
            onBack={() => navigate('home')}
            initialSessionId={ccSessionId || undefined}
            initialParticipantMode={ccParticipantMode}
            onOpenProjector={(sid) => {
              setCcSessionId(sid);
              setRoute('cc_proyector');
              window.history.replaceState(
                null,
                '',
                `/?cc_proyector=${encodeURIComponent(sid)}`
              );
            }}
            onOpenGamePresenter={(code, token) =>
              openCreatedPresenterRoom(code, token)
            }
            onOpenGameProjector={(code) => navigate('projector', code)}
            onJoinGameCode={(code) => navigate('join', code)}
          />
        )}

        {route === 'mi_sociedad' && (
          <MiSociedadJovenesView
            onBack={() => navigate('home')}
            initialProgramId={ysProgramId || undefined}
            onOpenProjector={(pid) => {
              setYsProgramId(pid);
              setRoute('mi_sociedad_proyector');
              window.history.replaceState(
                null,
                '',
                `/?sj_proyector=${encodeURIComponent(pid)}`
              );
            }}
            onOpenGamePresenter={(code, token) =>
              openCreatedPresenterRoom(code, token)
            }
            onOpenGameProjector={(code) => navigate('projector', code)}
            onJoinGameCode={(code) => navigate('join', code)}
          />
        )}
      </main>
    </div>
  );
}
