import { useState } from 'react';
import {
  Award,
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  Compass,
  Crown,
  Disc,
  FolderHeart,
  GraduationCap,
  HeartHandshake,
  History,
  LogIn,
  Medal,
  MonitorPlay,
  PackageOpen,
  Play,
  Puzzle,
  Search,
  Shield,
  Sliders,
  Sparkles,
  Star,
  Swords,
  Trophy,
  Tv,
  Users,
  Wand2,
} from 'lucide-react';
import heroStageImg from '../assets/images/hero_quiz_stage_1794687579504.jpg';

export type AppRoute =
  | 'home'
  | 'create'
  | 'join'
  | 'lobby'
  | 'bank'
  | 'leaderboard'
  | 'history'
  | 'presenter'
  | 'player'
  | 'projector'
  | 'battle_setup'
  | 'team_setup'
  | 'battle'
  | 'roulette'
  | 'retos'
  | 'mystery'
  | 'trajectory'
  | 'learning'
  | 'tournaments'
  | 'championship'
  | 'stats'
  | 'ranking'
  | 'saturday_program'
  | 'retos_sabado'
  | 'ruleta_sabado'
  | 'talentos_juveniles'
  | 'aventuras_biblicas'
  | 'mision_semana'
  | 'campeonatos_juveniles'
  | 'cabina_sorpresas'
  | 'nuestras_memorias'
  | 'centro_control'
  | 'cc_proyector'
  | 'mi_sociedad'
  | 'mi_sociedad_proyector'
  | 'ia_creativa';

interface HomeViewProps {
  onNavigate: (route: AppRoute, code?: string) => void;
  recentPresenterCode?: string | null;
}

export function HomeView({
  onNavigate,
  recentPresenterCode,
}: HomeViewProps) {
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [projectorCodeInput, setProjectorCodeInput] = useState('');
  const [projectorError, setProjectorError] = useState<string | null>(null);
  const [checkingProjector, setCheckingProjector] = useState(false);
  const [imgError, setImgError] = useState(false);

  const handleQuickJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = joinCodeInput.trim().toUpperCase();
    onNavigate('join', clean);
  };

  const handleOpenProjector = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = projectorCodeInput.trim().toUpperCase();
    if (!clean) {
      setProjectorError('El código está vacío. Ingresa el código real de la partida.');
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setProjectorError('Sin conexión con el servidor. Verifica tu red.');
      return;
    }

    setCheckingProjector(true);
    setProjectorError(null);
    try {
      const res = await fetch(`/api/games/${encodeURIComponent(clean)}/exists`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProjectorError(
          data.error || 'Código incorrecto o la partida no existe.'
        );
        return;
      }
      onNavigate('projector', data.code || clean);
    } catch {
      setProjectorError('Sin conexión con el servidor al verificar la partida.');
    } finally {
      setCheckingProjector(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-14">
      {/* Hero Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-amber-300">
              Concursos Bíblicos Interactivos en Tiempo Real
            </p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.08] tracking-tight text-balance">
              DIME TÚ QUÉ DICES
            </h1>
            <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">
              Crea una partida en vivo, proyecta las preguntas en pantalla
              grande y deja que decenas o cientos de personas compitan
              simultáneamente desde sus celulares.
            </p>
          </div>

          {/* Primary Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('create')}
              className="px-6 py-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-base inline-flex items-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Play className="w-5 h-5 fill-current" />
              Crear Partida
            </button>

            <button
              type="button"
              onClick={() => onNavigate('join')}
              className="px-6 py-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-display font-extrabold text-base inline-flex items-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <LogIn className="w-5 h-5" />
              Unirme a una Partida
            </button>
          </div>

          {/* Quick Code Entry */}
          <form
            onSubmit={handleQuickJoin}
            className="bg-[#111A2E] border border-slate-800 rounded-2xl p-3 flex flex-col sm:flex-row gap-2.5 max-w-lg"
          >
            <input
              type="text"
              value={joinCodeInput}
              onChange={(e) =>
                setJoinCodeInput(
                  e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                )
              }
              placeholder="Ingresa código de partida (ej: BIBLIA2026)"
              className="flex-1 bg-[#080E1E] border border-slate-700 rounded-xl px-4 py-3 text-sm text-white font-mono-num font-bold placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              className="px-5 py-3 rounded-xl bg-white hover:bg-slate-200 text-slate-950 font-bold text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Entrar ahora
            </button>
          </form>
        </div>

        <div className="lg:col-span-6">
          <div className="relative h-full min-h-[280px] sm:min-h-[360px] rounded-2xl overflow-hidden border border-slate-800 bg-[#111A2E]">
            {!imgError ? (
              <img
                src={heroStageImg}
                alt="Escenario televisivo de concurso bíblico en vivo"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-[#131F3A] to-[#080E1E]">
                <MonitorPlay className="w-14 h-14 text-amber-400 mb-3" />
                <p className="font-display font-bold text-xl text-white">
                  Escenario en Vivo
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  Sincronización instantánea entre presentador, pantalla y
                  jugadores
                </p>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#080E1E]/90 via-[#080E1E]/25 to-transparent flex items-end p-6">
              <div className="space-y-1">
                <p className="font-display font-bold text-lg text-white">
                  Ideal para iglesias, jóvenes, campamentos y congresos
                </p>
                <p className="text-xs sm:text-sm text-slate-300">
                  6 modalidades de juego · 34 categorías bíblicas · Código QR
                  instantáneo
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Platform Access Grid */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
              Espacios de la Plataforma
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Accede directamente a cada herramienta del concurso.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => onNavigate('lobby')}
            className="text-left bg-[#111A2E] hover:bg-[#16213B] border border-slate-800 rounded-2xl p-6 space-y-3 transition-colors cursor-pointer"
          >
            <Users className="w-7 h-7 text-sky-400" />
            <h3 className="font-display font-bold text-xl text-white">
              Sala de Juegos
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Explora las partidas activas en este momento y únete con un solo
              toque.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('bank')}
            className="text-left bg-[#111A2E] hover:bg-[#16213B] border border-slate-800 rounded-2xl p-6 space-y-3 transition-colors cursor-pointer"
          >
            <BookOpen className="w-7 h-7 text-amber-400" />
            <h3 className="font-display font-bold text-xl text-white">
              Banco de Preguntas Bíblicas
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Consulta preguntas del Antiguo y Nuevo Testamento con cita bíblica
              y agrega las tuyas.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('leaderboard')}
            className="text-left bg-[#111A2E] hover:bg-[#16213B] border border-slate-800 rounded-2xl p-6 space-y-3 transition-colors cursor-pointer"
          >
            <Trophy className="w-7 h-7 text-emerald-400" />
            <h3 className="font-display font-bold text-xl text-white">
              Clasificación y Puntuaciones
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Revisa los mejores puntajes históricos y el cuadro de honor de
              campeones.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('history')}
            className="text-left bg-[#111A2E] hover:bg-[#16213B] border border-slate-800 rounded-2xl p-6 space-y-3 transition-colors cursor-pointer"
          >
            <History className="w-7 h-7 text-indigo-400" />
            <h3 className="font-display font-bold text-xl text-white">
              Historial de Partidas
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Consulta los podios, participantes y fechas de todos los concursos
              finalizados.
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              recentPresenterCode
                ? onNavigate('presenter', recentPresenterCode)
                : onNavigate('create')
            }
            className="text-left bg-[#111A2E] hover:bg-[#16213B] border border-slate-800 rounded-2xl p-6 space-y-3 transition-colors cursor-pointer"
          >
            <Sliders className="w-7 h-7 text-amber-300" />
            <h3 className="font-display font-bold text-xl text-white">
              Panel del Presentador
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              {recentPresenterCode
                ? `Retomar control de tu partida activa (${recentPresenterCode}) o crear una nueva.`
                : 'Dirige las preguntas, controla el tiempo, revela respuestas y gestiona jugadores.'}
            </p>
          </button>

          <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-3">
            <Tv className="w-7 h-7 text-rose-400" />
            <h3 className="font-display font-bold text-xl text-white">
              Pantalla de Proyección
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Proyecta una sala en televisor o videobeam sin controles privados.
            </p>
            <form onSubmit={handleOpenProjector} className="space-y-2 pt-1">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={projectorCodeInput}
                  onChange={(e) => {
                    setProjectorCodeInput(
                      e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                    );
                    if (projectorError) setProjectorError(null);
                  }}
                  placeholder="Código de partida"
                  className="flex-1 min-w-0 bg-[#080E1E] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono-num font-bold placeholder-slate-500 focus:outline-none focus:border-rose-400"
                />
                <button
                  type="submit"
                  disabled={checkingProjector}
                  className="px-3.5 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  {checkingProjector ? 'Validando...' : 'Abrir'}
                </button>
              </div>
              {projectorError && (
                <p className="text-xs text-rose-400">{projectorError}</p>
              )}
            </form>
            {recentPresenterCode && (
              <button
                type="button"
                onClick={() => onNavigate('projector', recentPresenterCode)}
                className="text-xs font-semibold text-sky-400 hover:text-sky-300 cursor-pointer"
              >
                Abrir proyección de partida activa ({recentPresenterCode})
              </button>
            )}
          </div>
        </div>
      </section>

      {/* New Games & Competitions Section */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
              Nuevos Juegos y Competencias
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Duelos, equipos, ruleta, enigmas, retos bíblicos, torneos, estudio sin tiempo y estadísticas completas.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => onNavigate('battle_setup')}
            className="text-left bg-[#111A2E] hover:bg-[#16213B] border border-amber-400/35 hover:border-amber-400/70 rounded-2xl p-6 space-y-3 transition-colors cursor-pointer"
          >
            <Swords className="w-7 h-7 text-amber-400" />
            <h3 className="font-display font-bold text-xl text-white">
              Batalla 1 contra 1
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Crea una batalla con código y código QR exclusivo. Dos
              participantes compiten en tiempo real con marcador en vivo,
              tiempos de respuesta y resultado final o empate.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('team_setup')}
            className="text-left bg-[#111A2E] hover:bg-[#16213B] border border-emerald-400/35 hover:border-emerald-400/70 rounded-2xl p-6 space-y-3 transition-colors cursor-pointer"
          >
            <Shield className="w-7 h-7 text-emerald-400" />
            <h3 className="font-display font-bold text-xl text-white">
              Competencia por equipos
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Configura equipos, colores personalizados, capitanes y desempates en vivo, suma puntos grupales y revisa cada respuesta al final.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('roulette')}
            className="text-left bg-[#111A2E] hover:bg-[#16213B] border border-sky-400/35 hover:border-sky-400/70 rounded-2xl p-6 space-y-3 transition-colors cursor-pointer"
          >
            <Disc className="w-7 h-7 text-sky-400" />
            <h3 className="font-display font-bold text-xl text-white">
              Ruleta Bíblica
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Ruleta animada de 14 categorías bíblicas sin repetir preguntas. Juega individual, por equipos o en sala en vivo con QR.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('retos')}
            className="text-left bg-[#111A2E] hover:bg-[#16213B] border border-violet-400/35 hover:border-violet-400/70 rounded-2xl p-6 space-y-3 transition-colors cursor-pointer"
          >
            <Puzzle className="w-7 h-7 text-violet-400" />
            <h3 className="font-display font-bold text-xl text-white">
              Retos Bíblicos
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Crucigramas, palabras desordenadas, completa el versículo y rompecabezas de relación bíblica con verificación inmediata.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('mystery')}
            className="text-left bg-[#111A2E] hover:bg-[#16213B] border border-purple-400/35 hover:border-purple-400/70 rounded-2xl p-6 space-y-3 transition-colors cursor-pointer"
          >
            <Search className="w-7 h-7 text-purple-400" />
            <h3 className="font-display font-bold text-xl text-white">
              ¿Quién Soy? y Misterio Bíblico
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Adivina personajes y sucesos bíblicos mediante pistas progresivas. Acierta en las primeras pistas para obtener mayor puntaje.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('learning')}
            className="text-left bg-[#111A2E] hover:bg-[#16213B] border border-teal-400/35 hover:border-teal-400/70 rounded-2xl p-6 space-y-3 transition-colors cursor-pointer"
          >
            <GraduationCap className="w-7 h-7 text-teal-400" />
            <h3 className="font-display font-bold text-xl text-white">
              Aprende con la Biblia
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Estudio sin cronómetro con 10 temas, ficha doctrinal, cita bíblica, contexto histórico y repaso de preguntas falladas.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('tournaments')}
            className="text-left bg-[#111A2E] hover:bg-[#16213B] border border-rose-400/35 hover:border-rose-400/70 rounded-2xl p-6 space-y-3 transition-colors cursor-pointer"
          >
            <Building2 className="w-7 h-7 text-rose-400" />
            <h3 className="font-display font-bold text-xl text-white">
              Grandes Torneos
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Organiza torneos entre iglesias, distritos o grupos juveniles con código QR propio, rondas oficiales y tabla de campeones.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('championship')}
            className="text-left bg-[#111A2E] hover:bg-[#16213B] border border-amber-500/35 hover:border-amber-500/70 rounded-2xl p-6 space-y-3 transition-colors cursor-pointer"
          >
            <Crown className="w-7 h-7 text-amber-300" />
            <h3 className="font-display font-bold text-xl text-white">
              Campeonato por Rondas
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              4 fases eliminatorias (Clasificación, Avanzados, Semifinales y Gran Final x2) con cruces automáticos y desempate oficial.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('trajectory')}
            className="text-left bg-[#111A2E] hover:bg-[#16213B] border border-indigo-400/35 hover:border-indigo-400/70 rounded-2xl p-6 space-y-3 transition-colors cursor-pointer"
          >
            <Award className="w-7 h-7 text-indigo-400" />
            <h3 className="font-display font-bold text-xl text-white">
              Mi Trayectoria y Medallas
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Progreso acumulado por niveles (Aprendiz a Maestro Bíblico), medallas desbloqueadas, precisión e historial personal.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('stats')}
            className="text-left bg-[#111A2E] hover:bg-[#16213B] border border-cyan-400/35 hover:border-cyan-400/70 rounded-2xl p-6 space-y-3 transition-colors cursor-pointer"
          >
            <BarChart3 className="w-7 h-7 text-cyan-400" />
            <h3 className="font-display font-bold text-xl text-white">
              Estadísticas Avanzadas
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Análisis para presentadores y jugadores: preguntas más fáciles y difíciles, tiempos promedio y rendimiento por categoría.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('ranking')}
            className="text-left bg-[#111A2E] hover:bg-[#16213B] border border-yellow-400/35 hover:border-yellow-400/70 rounded-2xl p-6 space-y-3 transition-colors cursor-pointer"
          >
            <Medal className="w-7 h-7 text-yellow-400" />
            <h3 className="font-display font-bold text-xl text-white">
              Ranking General
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Clasificación por semana, mes, temporada o año separando puntos individuales, por equipos y por iglesias o congregaciones.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('saturday_program')}
            className="text-left bg-[#111A2E] hover:bg-[#16213B] border border-amber-400/45 hover:border-amber-400/80 rounded-2xl p-6 space-y-3 transition-colors cursor-pointer"
          >
            <CalendarDays className="w-7 h-7 text-amber-400" />
            <h3 className="font-display font-bold text-xl text-white">
              Programa del Sábado
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Genera con IA programas juveniles de 60, 90 o 120 minutos sin repetir temas, edita bloques, controla tiempos y proyecta en vivo con cronómetro.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('retos_sabado')}
            className="text-left bg-[#111A2E] hover:bg-[#16213B] border border-violet-400/45 hover:border-violet-400/80 rounded-2xl p-6 space-y-3 transition-colors cursor-pointer"
          >
            <Sparkles className="w-7 h-7 text-violet-400" />
            <h3 className="font-display font-bold text-xl text-white">
              Retos del Sábado
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Retos sorpresa y dinámicas juveniles de Biblia, representación, creatividad e integración por parejas, equipos o competencia con QR y validación del director.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('ruleta_sabado')}
            className="text-left bg-[#111A2E] hover:bg-[#16213B] border border-amber-400/45 hover:border-amber-400/80 rounded-2xl p-6 space-y-3 transition-colors cursor-pointer"
          >
            <Disc className="w-7 h-7 text-amber-400" />
            <h3 className="font-display font-bold text-xl text-white">
              Ruleta del Sábado
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Ruleta interactiva juvenil de 12 categorías con pantalla completa para proyector, controles de director, cronómetro configurable y modo multijugador QR.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('talentos_juveniles')}
            className="text-left bg-[#111A2E] hover:bg-[#16213B] border border-emerald-400/45 hover:border-emerald-400/80 rounded-2xl p-6 space-y-3 transition-colors cursor-pointer"
          >
            <Star className="w-7 h-7 text-emerald-400" />
            <h3 className="font-display font-bold text-xl text-white">
              Talentos Juveniles
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Descubre y celebra los talentos de Sociedad de Jóvenes: 10 categorías, orden de participación, pantalla grande, jurado opcional, votaciones positivas y certificados digitales.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('aventuras_biblicas')}
            className="text-left bg-[#111A2E] hover:bg-[#16213B] border border-sky-400/45 hover:border-sky-400/80 rounded-2xl p-6 space-y-3 transition-colors cursor-pointer"
          >
            <Compass className="w-7 h-7 text-sky-400" />
            <h3 className="font-display font-bold text-xl text-white">
              Aventuras Bíblicas
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Historias bíblicas interactivas por escenas con decisiones, consecuencias narrativas, referencia bíblica, música ambiental y modo individual, competitivo o dirigido.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('mision_semana')}
            className="text-left bg-[#111A2E] hover:bg-[#16213B] border border-emerald-400/45 hover:border-emerald-400/80 rounded-2xl p-6 space-y-3 transition-colors cursor-pointer"
          >
            <HeartHandshake className="w-7 h-7 text-emerald-400" />
            <h3 className="font-display font-bold text-xl text-white">
              Misión de la Semana
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Desafíos semanales voluntarios de servicio, evangelismo, vida espiritual y comunidad con registro seguro, validación de director y reconocimientos.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('campeonatos_juveniles')}
            className="text-left bg-[#111A2E] hover:bg-[#16213B] border border-amber-400/50 hover:border-amber-400/85 rounded-2xl p-6 space-y-3 transition-colors cursor-pointer"
          >
            <Trophy className="w-7 h-7 text-amber-400" />
            <h3 className="font-display font-bold text-xl text-white">
              Campeonatos Juveniles
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Temporadas de 4 o 5 sábados para equipos, grupos o iglesias: puntos por participación, partidas, retos y misiones, semifinales, Gran Final y archivo histórico.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('cabina_sorpresas')}
            className="text-left bg-[#111A2E] hover:bg-[#16213B] border border-amber-400/50 hover:border-amber-400/85 rounded-2xl p-6 space-y-3 transition-colors cursor-pointer"
          >
            <PackageOpen className="w-7 h-7 text-amber-300" />
            <h3 className="font-display font-bold text-xl text-white">
              Cabina de Sorpresas
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Caja misteriosa para momentos inesperados del sábado: 12 tipos de sorpresas, sonido de misterio, cuenta regresiva, proyección en vivo y control de variedad.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('nuestras_memorias')}
            className="text-left bg-[#111A2E] hover:bg-[#16213B] border border-amber-400/50 hover:border-amber-400/85 rounded-2xl p-6 space-y-3 transition-colors cursor-pointer"
          >
            <FolderHeart className="w-7 h-7 text-amber-400" />
            <h3 className="font-display font-bold text-xl text-white">
              Nuestras Memorias
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Archivo histórico independiente de cada sábado: calendario, buscador, álbum autorizado, campeonatos, reconocimientos, privacidad, recuperación y exportación en PDF.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('centro_control')}
            className="text-left bg-[#111A2E] hover:bg-[#16213B] border border-sky-400/55 hover:border-sky-400/90 rounded-2xl p-6 space-y-3 transition-colors cursor-pointer"
          >
            <Sliders className="w-7 h-7 text-sky-400" />
            <h3 className="font-display font-bold text-xl text-white">
              Centro de Control del Sábado
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Integra y dirige todo el programa desde un solo panel: agenda, juegos en vivo con QR, sorpresas, cronómetro sincronizado, audio por módulo, proyección integrada y guardado en memorias.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('mi_sociedad')}
            className="text-left bg-gradient-to-br from-[#13203C] to-[#111A2E] hover:from-[#18294D] hover:to-[#16213B] border-2 border-amber-400/75 hover:border-amber-300 rounded-2xl p-6 space-y-3 transition-colors cursor-pointer sm:col-span-2 lg:col-span-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Wand2 className="w-7 h-7 text-amber-400" />
                <h3 className="font-display font-bold text-xl sm:text-2xl text-white">
                  MI SOCIEDAD DE JÓVENES
                </h3>
              </div>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-display font-extrabold text-xs sm:text-sm">
                <Sparkles className="w-4 h-4" />
                CREAR PROGRAMA AUTOMÁTICO
              </span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed max-w-4xl">
              Organizador inteligente y automático para cada sábado (60, 90 o 120 min): combina actividades bíblicas, rompehielos, alabanza, retos, ruleta, batallas, talentos, misiones y sorpresas con modo director en vivo, proyector, QR y variedad semanal sin repeticiones.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('ia_creativa')}
            className="text-left bg-gradient-to-br from-[#171B36] to-[#111A2E] hover:from-[#1E2547] hover:to-[#16213B] border-2 border-indigo-400/75 hover:border-indigo-300 rounded-2xl p-6 space-y-3 transition-colors cursor-pointer sm:col-span-2 lg:col-span-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Sparkles className="w-7 h-7 text-indigo-300" />
                <h3 className="font-display font-bold text-xl sm:text-2xl text-white">
                  IA CREATIVA JUVENIL
                </h3>
              </div>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 text-white font-display font-extrabold text-xs sm:text-sm">
                <Wand2 className="w-4 h-4" />
                ABRIR ASISTENTE DE IA
              </span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed max-w-4xl">
              Asistente cristiano avanzado para directores y líderes juveniles: chat conversacional, creación de programas paso a paso (60, 90 o 120 min), predicaciones, dinámicas convertibles en salas en vivo, guiones, presentaciones PPTX/PDF, eventos, música, editor con versiones e integración directa con Programa del Sábado.
            </p>
          </button>
        </div>
      </section>
    </div>
  );
}
