import { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Maximize2,
  Minimize2,
  PackageOpen,
  SkipForward,
  Trophy,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  formatMmSs,
  type YouthProgramActivityItem,
  type YouthProgramPlan,
} from '../shared/youthSocietyData';
import { youthSocietyAudio } from '../utils/sound';
import { QrCodeCard } from './QrCodeCard';

interface LiveProjectionState {
  program: YouthProgramPlan;
  remainingSec: number;
  serverNow: number;
  currentActivity: YouthProgramActivityItem | null;
  nextActivity: YouthProgramActivityItem | null;
  linkedLiveGame: {
    code: string;
    gameId: string;
    title: string;
    modeLabel: string;
    status: string;
    participantCount: number;
    leaderboardTop: Array<{ name: string; score: number; correctCount: number }>;
    teamTop: Array<{ name: string; color: string; score: number; memberCount: number }>;
  } | null;
}

interface MiSociedadProyectorViewProps {
  programId: string;
  onBack: () => void;
}

export function MiSociedadProyectorView({
  programId,
  onBack,
}: MiSociedadProyectorViewProps) {
  const [live, setLive] = useState<LiveProjectionState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [wsConnected, setWsConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [audioPrefs, setAudioPrefs] = useState(() =>
    youthSocietyAudio.getPrefs()
  );

  const stageRef = useRef<HTMLDivElement | null>(null);
  const lastCueNonceRef = useRef<number>(-1);
  const lastSurpriseRef = useRef<number>(0);

  useEffect(() => {
    return youthSocietyAudio.subscribe(() => {
      setAudioPrefs(youthSocietyAudio.getPrefs());
    });
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let active = true;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let pollTimer: number | null = null;

    const fetchLatest = async () => {
      try {
        const res = await fetch(
          `/api/mi-sociedad/live/${encodeURIComponent(programId)}`
        );
        if (!res.ok) {
          if (active) setErrorMsg('No se encontró el programa para proyectar.');
          return;
        }
        const data = (await res.json()) as LiveProjectionState;
        if (active) {
          setLive(data);
          setErrorMsg(null);
        }
      } catch {
        // ignore transient errors
      }
    };

    const connectWs = () => {
      if (!active) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${proto}//${window.location.host}/ws`);
      ws = socket;

      socket.onopen = () => {
        if (!active) return;
        setWsConnected(true);
        socket.send(
          JSON.stringify({
            type: 'ys_subscribe',
            programId,
            role: 'projector',
          })
        );
      };

      socket.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(String(ev.data || '{}'));
          if (parsed.type === 'ys_state' && parsed.payload && active) {
            setLive(parsed.payload as LiveProjectionState);
            setErrorMsg(null);
          } else if (parsed.type === 'ys_error' && active) {
            setErrorMsg(parsed.message || 'Error de conexión.');
          }
        } catch {
          // ignore
        }
      };

      socket.onclose = () => {
        if (!active) return;
        setWsConnected(false);
        reconnectTimer = window.setTimeout(connectWs, 2500);
      };

      socket.onerror = () => socket.close();
    };

    fetchLatest();
    connectWs();
    pollTimer = window.setInterval(fetchLatest, 5000);

    return () => {
      active = false;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (pollTimer) window.clearInterval(pollTimer);
      if (ws) ws.close();
    };
  }, [programId]);

  useEffect(() => {
    const prog = live?.program;
    if (!prog) return;
    const nonce = prog.liveState.soundCueNonce || 0;
    if (lastCueNonceRef.current === -1) {
      lastCueNonceRef.current = nonce;
    } else if (nonce > lastCueNonceRef.current) {
      lastCueNonceRef.current = nonce;
      youthSocietyAudio.playMood(prog.liveState.lastSoundMood || 'transicion');
    }

    const sAt = prog.liveState.activeSurprise?.triggeredAt || 0;
    if (sAt > 0 && sAt !== lastSurpriseRef.current) {
      lastSurpriseRef.current = sAt;
      confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });
    }
  }, [live?.program]);

  const remainingSec = useMemo(() => {
    const p = live?.program;
    if (!p) return 0;
    if (
      p.liveState.playbackStatus === 'en_curso' &&
      p.liveState.timerRunning &&
      typeof p.liveState.timerEndsAt === 'number'
    ) {
      return Math.max(0, Math.ceil((p.liveState.timerEndsAt - nowMs) / 1000));
    }
    if (typeof p.liveState.timerPausedRemainingSec === 'number') {
      return Math.max(0, Math.round(p.liveState.timerPausedRemainingSec));
    }
    return live?.remainingSec ?? 0;
  }, [live, nowMs]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && stageRef.current) {
        await stageRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // ignore
    }
  };

  if (errorMsg && !live) {
    return (
      <div className="min-h-screen bg-[#080E1E] text-white flex flex-col items-center justify-center p-8 text-center space-y-4">
        <p className="text-xl font-display font-bold">{errorMsg}</p>
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer"
        >
          Volver a Mi Sociedad de Jóvenes
        </button>
      </div>
    );
  }

  if (!live) {
    return (
      <div className="min-h-screen bg-[#080E1E] text-slate-300 flex items-center justify-center p-8">
        Conectando pantalla de proyección...
      </div>
    );
  }

  const { program, currentActivity, nextActivity, linkedLiveGame } = live;
  const totalSec = (currentActivity?.durationMin || 5) * 60;
  const progressPct =
    totalSec > 0 ? Math.min(100, Math.max(0, (remainingSec / totalSec) * 100)) : 0;
  const surprise = program.liveState.activeSurprise;

  return (
    <div
      ref={stageRef}
      className="min-h-screen bg-[#080E1E] text-slate-100 flex flex-col justify-between p-6 sm:p-10 relative"
    >
      {/* Top Bar */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-xl bg-[#111A2E] hover:bg-[#16213B] border border-white/10 text-slate-200 cursor-pointer shrink-0"
            aria-label="Salir de proyección"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-semibold text-amber-300 truncate">
              {program.config.scheduledDate} · {program.mainBibleText} ·{' '}
              <span className={wsConnected ? 'text-emerald-400' : 'text-amber-300'}>
                {wsConnected ? 'En vivo' : 'Sincronizando'}
              </span>
            </div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-white truncate">
              {program.creativeName}
            </h1>
            <p className="text-sm text-slate-300 truncate">
              Tema: {program.centralTheme}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() =>
              youthSocietyAudio.updatePrefs({ muted: !audioPrefs.muted })
            }
            className="p-2.5 rounded-xl bg-[#111A2E] hover:bg-[#16213B] border border-white/10 text-slate-200 cursor-pointer"
            title={audioPrefs.muted ? 'Activar sonido' : 'Silenciar'}
          >
            {audioPrefs.muted ? (
              <VolumeX className="w-5 h-5 text-rose-400" />
            ) : (
              <Volume2 className="w-5 h-5 text-emerald-400" />
            )}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-[#111A2E] hover:bg-[#16213B] border border-white/10 text-slate-200 cursor-pointer"
            title="Pantalla completa"
          >
            {isFullscreen ? (
              <Minimize2 className="w-5 h-5" />
            ) : (
              <Maximize2 className="w-5 h-5" />
            )}
          </button>
        </div>
      </header>

      {/* Main Stage */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 py-8 items-center">
        <div className="lg:col-span-7 space-y-6">
          {currentActivity ? (
            <>
              <div className="text-sm sm:text-base font-semibold text-sky-300">
                Sección {currentActivity.sectionCode} · {currentActivity.sectionLabel} · Actividad{' '}
                <span className="font-mono-num">
                  {program.liveState.currentActivityIndex + 1}/{program.activities.length}
                </span>
              </div>

              <h2 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl text-white leading-tight text-balance">
                {currentActivity.title}
              </h2>

              <p className="text-xl sm:text-2xl text-slate-200 leading-relaxed max-w-3xl">
                {currentActivity.participantInstructions ||
                  currentActivity.description}
              </p>

              {currentActivity.biblicalReference && (
                <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-5 space-y-1.5 max-w-2xl">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                    <BookOpen className="w-4 h-4" />
                    {currentActivity.biblicalReference} ·{' '}
                    {currentActivity.contentType === 'texto_biblico_literal'
                      ? 'Texto bíblico literal'
                      : currentActivity.contentType === 'adaptacion_narrativa'
                        ? 'Adaptación narrativa basada en las Escrituras'
                        : 'Dinámica práctica'}
                  </div>
                  {currentActivity.scripturalText && (
                    <p className="text-base sm:text-lg text-slate-100 italic leading-relaxed">
                      "{currentActivity.scripturalText}"
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <h2 className="font-display font-extrabold text-4xl text-white">
                {program.creativeName}
              </h2>
              <p className="text-xl text-slate-300">{program.welcomeSpeech}</p>
            </div>
          )}

          {/* Countdown Box */}
          <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-6 max-w-md space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                Tiempo restante
              </span>
              <span className="text-white">
                {program.liveState.playbackStatus === 'en_curso'
                  ? 'En curso'
                  : program.liveState.playbackStatus === 'pausado'
                    ? 'Pausado'
                    : program.liveState.playbackStatus === 'finalizado'
                      ? 'Finalizado'
                      : 'Listo para iniciar'}
              </span>
            </div>
            <div
              className={`font-mono-num font-extrabold text-6xl tracking-tight ${
                remainingSec <= 15 &&
                program.liveState.playbackStatus === 'en_curso'
                  ? 'text-rose-400'
                  : 'text-amber-400'
              }`}
            >
              {formatMmSs(remainingSec)}
            </div>
            <div className="w-full h-2.5 bg-[#080E1E] rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right Side: Live Linked Game QR & Standings OR Next Activity + Spiritual Focus */}
        <div className="lg:col-span-5 space-y-6">
          {currentActivity?.linkedGameCode && (
            <div className="space-y-4">
              <QrCodeCard
                code={currentActivity.linkedGameCode}
                gameId={linkedLiveGame?.gameId}
                title={currentActivity.title}
                compact
                showProjectorLink={false}
              />

              {linkedLiveGame && (
                <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-display font-bold text-white flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-amber-400" />
                      Resultados en Vivo ({linkedLiveGame.modeLabel})
                    </span>
                    <span className="text-xs text-slate-300 inline-flex items-center gap-1 font-mono-num">
                      <Users className="w-3.5 h-3.5 text-sky-400" />
                      {linkedLiveGame.participantCount}
                    </span>
                  </div>

                  {linkedLiveGame.teamTop.length > 0 ? (
                    <div className="divide-y divide-white/10">
                      {linkedLiveGame.teamTop.map((t, i) => (
                        <div
                          key={t.name}
                          className="py-2 flex items-center justify-between text-sm"
                        >
                          <span className="text-white font-semibold">
                            <span className="font-mono-num text-slate-400 mr-2">
                              #{i + 1}
                            </span>
                            {t.name}
                          </span>
                          <span className="font-mono-num font-bold text-amber-300">
                            {t.score} pts
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : linkedLiveGame.leaderboardTop.length > 0 ? (
                    <div className="divide-y divide-white/10">
                      {linkedLiveGame.leaderboardTop.slice(0, 5).map((e, i) => (
                        <div
                          key={`${e.name}-${i}`}
                          className="py-2 flex items-center justify-between text-sm"
                        >
                          <span className="text-white font-semibold">
                            <span className="font-mono-num text-slate-400 mr-2">
                              #{i + 1}
                            </span>
                            {e.name}
                          </span>
                          <span className="font-mono-num font-bold text-amber-300">
                            {e.score} pts
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Esperando respuestas de participantes...
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {!currentActivity?.linkedGameCode && (
            <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-6 space-y-3">
              <div className="text-xs font-semibold text-amber-300">
                Pasaje Lema del Sábado · {program.mainBibleText}
              </div>
              <p className="text-base sm:text-lg text-white leading-relaxed italic">
                "{program.mainBibleVerseQuote}"
              </p>
              <p className="text-xs text-slate-400 pt-1">
                Objetivo: {program.spiritualObjective}
              </p>
            </div>
          )}

          {nextActivity && (
            <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-400 inline-flex items-center gap-1.5">
                  <SkipForward className="w-3.5 h-3.5 text-sky-400" />
                  Próxima actividad · Sección {nextActivity.sectionCode}
                </div>
                <div className="font-display font-bold text-lg text-white truncate">
                  {nextActivity.title}
                </div>
              </div>
              <span className="font-mono-num font-bold text-sm text-sky-300 shrink-0">
                {nextActivity.durationMin} min
              </span>
            </div>
          )}
        </div>
      </main>

      {/* Active Surprise Fullscreen Overlay */}
      {surprise && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-[#111A2E] border border-orange-400/60 rounded-3xl p-8 sm:p-10 max-w-2xl w-full text-center space-y-5">
            <div className="inline-flex items-center gap-2 text-orange-300 text-sm font-bold">
              <PackageOpen className="w-5 h-5" />
              MOMENTO SORPRESA · {surprise.categoryLabel}
            </div>
            <h2 className="font-display font-extrabold text-3xl sm:text-5xl text-white">
              {surprise.title}
            </h2>
            <p className="text-lg sm:text-xl text-slate-200 leading-relaxed">
              {surprise.instructions}
            </p>
            {surprise.reference && (
              <p className="text-sm font-semibold text-amber-300">
                {surprise.reference}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
