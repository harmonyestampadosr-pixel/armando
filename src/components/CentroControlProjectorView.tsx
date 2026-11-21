import { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Maximize2,
  Minimize2,
  PackageOpen,
  Pause,
  Play,
  SkipForward,
  Sparkles,
  Trophy,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  formatTimerMMSS,
  type ControlCenterLiveClientView,
} from '../shared/controlCenterData';
import {
  moduleSoundController,
  type ModuleAudioChannelId,
} from '../utils/sound';
import { MysteryBoxArtwork } from './MysteryBoxArtwork';
import { QrCodeCard } from './QrCodeCard';

interface CentroControlProjectorViewProps {
  sessionId: string;
  onBack: () => void;
}

export function CentroControlProjectorView({
  sessionId,
  onBack,
}: CentroControlProjectorViewProps) {
  const [live, setLive] = useState<ControlCenterLiveClientView | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [wsConnected, setWsConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [globalMuted, setGlobalMuted] = useState(() =>
    moduleSoundController.isGlobalMuted()
  );

  const stageRef = useRef<HTMLDivElement | null>(null);
  const lastCueNonceRef = useRef<number>(-1);
  const lastSurpriseTriggeredRef = useRef<number>(0);

  useEffect(() => {
    return moduleSoundController.subscribe(() => {
      setGlobalMuted(moduleSoundController.isGlobalMuted());
    });
  }, []);

  // Local 250ms clock tick for smooth countdown sync between server broadcasts
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  // Initial HTTP fetch + WebSocket real-time subscription + resilient reconnection
  useEffect(() => {
    let active = true;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let pollTimer: number | null = null;

    const fetchLatest = async () => {
      try {
        const res = await fetch(
          `/api/control-center/live/${encodeURIComponent(sessionId)}`
        );
        if (!res.ok) {
          if (active) setErrorMsg('No se encontró la sesión de proyección.');
          return;
        }
        const data = (await res.json()) as ControlCenterLiveClientView;
        if (active) {
          setLive(data);
          setErrorMsg(null);
        }
      } catch {
        // keep last snapshot
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
            type: 'cc_subscribe',
            sessionId,
            role: 'projector',
          })
        );
      };

      socket.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(String(ev.data || '{}'));
          if (parsed.type === 'cc_state' && parsed.payload && active) {
            setLive(parsed.payload as ControlCenterLiveClientView);
            setErrorMsg(null);
          } else if (parsed.type === 'cc_error' && active) {
            setErrorMsg(parsed.message || 'Error de sincronización.');
          }
        } catch {
          // ignore malformed frames
        }
      };

      socket.onclose = () => {
        if (!active) return;
        setWsConnected(false);
        reconnectTimer = window.setTimeout(connectWs, 2000);
      };
    };

    void fetchLatest();
    connectWs();
    // Periodic safety refresh for live linked game scores
    pollTimer = window.setInterval(() => {
      void fetchLatest();
    }, 3500);

    return () => {
      active = false;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (pollTimer) window.clearInterval(pollTimer);
      try {
        ws?.close();
      } catch {
        // ignore
      }
    };
  }, [sessionId]);

  // Trigger module-specific sound cue & celebration confetti when director advances/triggers surprise
  useEffect(() => {
    if (!live?.session) return;
    const nonce = live.session.soundCueNonce || 0;
    if (lastCueNonceRef.current === -1) {
      lastCueNonceRef.current = nonce;
      if (live.session.activeSurprise) {
        lastSurpriseTriggeredRef.current = live.session.activeSurprise.triggeredAt;
      }
      return;
    }
    if (nonce !== lastCueNonceRef.current) {
      lastCueNonceRef.current = nonce;
      const cue = live.session.lastSoundCue;
      if (cue) {
        moduleSoundController.playModuleCue(
          cue.moduleId as ModuleAudioChannelId,
          cue.action
        );
      }
    }
    const sup = live.session.activeSurprise;
    if (sup && sup.triggeredAt !== lastSurpriseTriggeredRef.current) {
      lastSurpriseTriggeredRef.current = sup.triggeredAt;
      try {
        void confetti({
          particleCount: 70,
          spread: 75,
          origin: { y: 0.6 },
        });
      } catch {
        // ignore confetti error
      }
    }
  }, [live?.session]);

  const displayRemainingSec = useMemo(() => {
    if (!live) return 0;
    const s = live.session;
    if (s.status === 'en_curso' && s.timerRunning && s.timerEndsAt) {
      return Math.max(0, Math.ceil((s.timerEndsAt - nowMs) / 1000));
    }
    if (typeof s.timerPausedRemainingSec === 'number') {
      return Math.max(0, Math.round(s.timerPausedRemainingSec));
    }
    return live.remainingSec;
  }, [live, nowMs]);

  const surpriseRemainingSec = useMemo(() => {
    const sup = live?.session.activeSurprise;
    if (!sup) return 0;
    const endsAt = sup.triggeredAt + sup.durationSec * 1000;
    return Math.max(0, Math.ceil((endsAt - nowMs) / 1000));
  }, [live?.session.activeSurprise, nowMs]);

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
      // ignore fullscreen restrictions
    }
  };

  if (errorMsg && !live) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white bg-[#111A2E] border border-white/10 rounded-xl px-4 py-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>
        <div className="bg-[#111A2E] border border-rose-400/30 rounded-2xl p-8 text-center text-rose-200">
          {errorMsg}
        </div>
      </div>
    );
  }

  if (!live) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-slate-300">
        Conectando Pantalla de Proyección en tiempo real...
      </div>
    );
  }

  const { session, currentBlock, nextBlock, linkedLiveGame, championshipStandings } =
    live;
  const totalBlockSec = (currentBlock?.durationMin || 5) * 60;
  const progressPct =
    totalBlockSec > 0
      ? Math.max(0, Math.min(100, (displayRemainingSec / totalBlockSec) * 100))
      : 0;
  const surprise = session.activeSurprise;

  return (
    <div
      ref={stageRef}
      className="min-h-screen bg-[#070B16] text-white px-4 sm:px-8 py-6 flex flex-col justify-between gap-6 relative overflow-x-hidden"
    >
      {/* Top Projector Bar */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white bg-[#111A2E] border border-white/10 rounded-xl px-3.5 py-2 cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            Salir de Proyección
          </button>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-300">
              {session.scheduledDate} · {session.bibleText}
            </div>
            <h1 className="font-display font-extrabold text-xl sm:text-2xl text-white">
              {session.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <span
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${
              wsConnected
                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                : 'bg-amber-500/15 border-amber-400/40 text-amber-200'
            }`}
          >
            {wsConnected ? 'Sincronizado en vivo' : 'Reconectando'}
          </span>

          <button
            type="button"
            onClick={() => moduleSoundController.setGlobalMuted(!globalMuted)}
            className="p-2.5 rounded-xl bg-[#111A2E] border border-white/15 text-slate-200 hover:text-white cursor-pointer"
            title={globalMuted ? 'Activar audio' : 'Silenciar avisos'}
          >
            {globalMuted ? (
              <VolumeX className="w-4 h-4 text-rose-300" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-300" />
            )}
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-[#111A2E] border border-white/15 text-slate-200 hover:text-white cursor-pointer"
            title="Pantalla completa"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </header>

      {/* Main Projector Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-stretch">
        {/* Centerpiece: Current Activity + Instructions + Countdown */}
        <section className="lg:col-span-8 bg-[#111A2E] border border-amber-400/25 rounded-3xl p-6 sm:p-10 flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider">
              <span className="text-amber-300">
                {currentBlock
                  ? `${currentBlock.moduleTag} · Bloque ${session.currentBlockIndex + 1} de ${session.blocks.length}`
                  : 'Agenda del Sábado'}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 ${
                  session.status === 'en_curso'
                    ? 'text-emerald-300'
                    : session.status === 'pausado'
                      ? 'text-amber-300'
                      : 'text-slate-300'
                }`}
              >
                {session.status === 'en_curso' ? (
                  <Play className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Pause className="w-3.5 h-3.5" />
                )}
                {session.status === 'en_curso'
                  ? 'En curso'
                  : session.status === 'pausado'
                    ? 'En pausa'
                    : session.status === 'finalizado'
                      ? 'Programa finalizado'
                      : 'Preparado para iniciar'}
              </span>
            </div>

            <h2 className="font-display font-extrabold text-3xl sm:text-5xl text-white leading-tight text-balance">
              {currentBlock?.title || session.theme}
            </h2>

            {currentBlock?.instructions && (
              <p className="text-base sm:text-xl text-slate-200 leading-relaxed max-w-3xl">
                {currentBlock.instructions}
              </p>
            )}

            {session.bibleVerseQuote && !currentBlock?.linkedGameCode && (
              <blockquote className="text-sm sm:text-base italic text-amber-100/85 bg-[#080E1E] border border-amber-400/20 rounded-2xl px-5 py-3.5">
                “{session.bibleVerseQuote}” — {session.bibleText}
              </blockquote>
            )}
          </div>

          {/* Big Countdown Bar */}
          <div className="bg-[#080E1E] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <Clock className="w-4 h-4 text-amber-300" />
                Tiempo de Actividad
              </div>
              <div
                className={`font-mono-num font-extrabold text-5xl sm:text-6xl tracking-tight ${
                  displayRemainingSec <= 15 && session.status === 'en_curso'
                    ? 'text-rose-400'
                    : 'text-amber-300'
                }`}
              >
                {formatTimerMMSS(displayRemainingSec)}
              </div>
            </div>
            <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  displayRemainingSec <= 15 ? 'bg-rose-500' : 'bg-amber-400'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Next Activity */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10 text-sm">
            <div className="flex items-center gap-2 text-slate-300">
              <SkipForward className="w-4 h-4 text-sky-300 shrink-0" />
              <span className="text-slate-400">Próxima actividad:</span>
              <span className="font-semibold text-white">
                {nextBlock
                  ? `${nextBlock.title} (${nextBlock.durationMin} min)`
                  : 'Cierre del programa'}
              </span>
            </div>
            <span className="text-xs text-slate-400">
              Tema: {session.theme}
            </span>
          </div>
        </section>

        {/* Right Side: Live Linked Game QR / Results / Championship Standings */}
        <aside className="lg:col-span-4 flex flex-col gap-5">
          {linkedLiveGame && (
            <div className="bg-[#111A2E] border border-sky-400/35 rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold uppercase tracking-wider text-sky-300">
                  Juego Conectado en Vivo
                </div>
                <span className="font-mono-num text-xs font-bold text-white bg-sky-500/20 border border-sky-400/40 rounded-lg px-2.5 py-1">
                  {linkedLiveGame.code}
                </span>
              </div>

              <div className="text-sm font-semibold text-white">
                {linkedLiveGame.title}
              </div>

              <QrCodeCard
                code={linkedLiveGame.code}
                gameId={linkedLiveGame.gameId}
                title={linkedLiveGame.title}
                compact
              />

              {linkedLiveGame.teamTop.length > 0 ? (
                <div className="space-y-1.5 pt-2 border-t border-white/10">
                  <div className="text-xs font-semibold text-slate-300">
                    Marcador de Equipos ({linkedLiveGame.participantCount}{' '}
                    conectados)
                  </div>
                  {linkedLiveGame.teamTop.slice(0, 4).map((t, idx) => (
                    <div
                      key={`${t.name}-${idx}`}
                      className="flex items-center justify-between text-xs bg-[#080E1E] rounded-lg px-3 py-2"
                    >
                      <span className="font-medium text-white">{t.name}</span>
                      <span className="font-mono-num text-amber-300 font-bold">
                        {t.score} pts
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                linkedLiveGame.leaderboardTop.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-white/10">
                    <div className="text-xs font-semibold text-slate-300">
                      Resultados de la Partida
                    </div>
                    {linkedLiveGame.leaderboardTop.slice(0, 5).map((p, idx) => (
                      <div
                        key={`${p.name}-${idx}`}
                        className="flex items-center justify-between text-xs bg-[#080E1E] rounded-lg px-3 py-2"
                      >
                        <span className="text-white">
                          #{idx + 1} {p.name}
                        </span>
                        <span className="font-mono-num text-amber-300 font-bold">
                          {p.score} pts
                        </span>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          )}

          {/* Championship Standings */}
          {championshipStandings.length > 0 && (
            <div className="bg-[#111A2E] border border-amber-400/25 rounded-3xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
                <Trophy className="w-4 h-4" />
                Clasificación · {championshipStandings[0].seasonName}
              </div>
              <div className="space-y-1.5">
                {championshipStandings[0].standings.slice(0, 5).map((st, idx) => (
                  <div
                    key={`${st.name}-${idx}`}
                    className="flex items-center justify-between text-xs bg-[#080E1E] border border-white/5 rounded-xl px-3.5 py-2"
                  >
                    <span className="font-medium text-white">
                      #{idx + 1} {st.name}
                    </span>
                    <span className="font-mono-num font-bold text-amber-300">
                      {st.points} pts
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400">
                Clasificación oficial del campeonato (independiente de los
                marcadores rápidos).
              </p>
            </div>
          )}

          {/* Recent surprises or program overview */}
          {!linkedLiveGame && championshipStandings.length === 0 && (
            <div className="bg-[#111A2E] border border-white/10 rounded-3xl p-5 space-y-3 flex-1">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-300">
                <Users className="w-4 h-4" />
                Orden del Programa
              </div>
              <div className="space-y-1.5">
                {session.blocks.slice(0, 8).map((b, idx) => (
                  <div
                    key={b.id}
                    className={`flex items-center justify-between text-xs rounded-xl px-3 py-2 border ${
                      idx === session.currentBlockIndex
                        ? 'bg-amber-400/15 border-amber-400/50 text-white font-semibold'
                        : b.completedAt
                          ? 'bg-[#080E1E]/60 border-white/5 text-slate-500'
                          : 'bg-[#080E1E] border-white/10 text-slate-300'
                    }`}
                  >
                    <span className="truncate pr-2">
                      {idx + 1}. {b.title}
                    </span>
                    <span className="font-mono-num shrink-0">
                      {b.durationMin}m
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Active Cabina de Sorpresas Live Overlay */}
      {surprise && (
        <div className="fixed inset-0 z-50 bg-[#050914]/92 backdrop-blur-md flex items-center justify-center p-4 sm:p-8">
          <div className="max-w-3xl w-full bg-[#111A2E] border-2 border-amber-400/70 rounded-3xl p-6 sm:p-10 text-center space-y-6 shadow-2xl">
            <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-300">
              <PackageOpen className="w-5 h-5" />
              Cabina de Sorpresas en Vivo · {surprise.categoryLabel}
            </div>

            <div className="max-w-[180px] mx-auto">
              <MysteryBoxArtwork state="revealed" />
            </div>

            <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-white text-balance">
              {surprise.title}
            </h2>

            <p className="text-base sm:text-xl text-slate-200 leading-relaxed max-w-2xl mx-auto">
              {surprise.instructions}
            </p>

            {surprise.reference && (
              <div className="inline-flex items-center gap-2 text-sm text-amber-200 bg-[#080E1E] border border-amber-400/30 rounded-xl px-4 py-2">
                <BookOpen className="w-4 h-4" />
                {surprise.reference}
              </div>
            )}

            <div className="bg-[#080E1E] border border-white/10 rounded-2xl px-6 py-4 inline-flex items-center gap-4">
              <Sparkles className="w-5 h-5 text-amber-300" />
              <span className="text-xs uppercase tracking-wider text-slate-400">
                Tiempo disponible:
              </span>
              <span className="font-mono-num font-extrabold text-3xl text-amber-300">
                {formatTimerMMSS(surpriseRemainingSec)}
              </span>
            </div>

            {surprise.outcome && (
              <div className="text-sm font-semibold text-emerald-300">
                Resultado registrado: {surprise.outcome} ·{' '}
                {surprise.participantName} ({surprise.pointsAwarded} pts)
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
