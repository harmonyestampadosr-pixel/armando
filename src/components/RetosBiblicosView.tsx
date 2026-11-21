import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Grid,
  Link2,
  Puzzle,
  Shuffle,
  Sparkles,
  User,
  Users,
  XCircle,
} from 'lucide-react';
import { RetoCompetitionKind } from '../shared/expansionTypes';
import { Difficulty } from '../shared/types';
import { getOrCreateProfileKey } from '../utils/profileKey';
import { soundFX } from '../utils/sound';
import { CompetitionSetupForm } from './CompetitionSetupForm';

interface ClientCrosswordWord {
  id: string;
  number: number;
  direction: 'H' | 'V';
  row: number;
  col: number;
  length: number;
  clue: string;
  reference: string;
}

interface ClientCrossword {
  id: string;
  title: string;
  difficulty: Difficulty;
  rows: number;
  cols: number;
  words: ClientCrosswordWord[];
}

interface ClientScramble {
  id: string;
  scrambledLetters: string;
  wordLength: number;
  category: string;
  difficulty: Difficulty;
  hint: string;
  reference: string;
}

interface ClientVerse {
  id: string;
  verseBefore: string;
  verseAfter: string;
  options: string[];
  reference: string;
  difficulty: Difficulty;
}

interface ClientMatchPuzzle {
  id: string;
  title: string;
  kind: string;
  difficulty: Difficulty;
  description: string;
  leftItems: Array<{ id: string; label: string }>;
  rightItems: Array<{ right: string; reference: string }>;
}

interface RetosPayload {
  crosswords: ClientCrossword[];
  scrambles: ClientScramble[];
  verses: ClientVerse[];
  matches: ClientMatchPuzzle[];
}

export function RetosBiblicosView({
  onBack,
  onCreatedMultiplayerRoom,
  onJoinCode,
}: {
  onBack: () => void;
  onCreatedMultiplayerRoom?: (code: string, presenterToken: string) => void;
  onJoinCode?: (code: string) => void;
}) {
  const [tab, setTab] = useState<'crucigrama' | 'desordenadas' | 'versiculo' | 'relacion'>('crucigrama');
  const [activityMode, setActivityMode] = useState<'solo' | 'multiplayer'>('solo');
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | 'todas'>('todas');
  const [data, setData] = useState<RetosPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [completedKeys, setCompletedKeys] = useState<string[]>([]);
  const [retosCount, setRetosCount] = useState(0);

  // Crossword state
  const [cwIdx, setCwIdx] = useState(0);
  const [cwGrid, setCwGrid] = useState<Record<string, string>>({});
  const [cwResult, setCwResult] = useState<{
    passed: boolean;
    pointsAwarded: number;
    wordResults?: Array<{ wordId: string; correct: boolean; displayAnswer: string; reference: string }>;
  } | null>(null);

  // Scramble state
  const [scIdx, setScIdx] = useState(0);
  const [scAnswer, setScAnswer] = useState('');
  const [scResult, setScResult] = useState<{
    passed: boolean;
    pointsAwarded: number;
    feedback: { displayWord: string; reference: string };
  } | null>(null);

  // Verse state
  const [cvIdx, setCvIdx] = useState(0);
  const [cvSelected, setCvSelected] = useState<number | null>(null);
  const [cvResult, setCvResult] = useState<{
    passed: boolean;
    pointsAwarded: number;
    feedback: { correctIndex: number; missingWord: string; reference: string; explanation: string };
  } | null>(null);

  // Match state
  const [mpIdx, setMpIdx] = useState(0);
  const [pairings, setPairings] = useState<Record<string, string>>({});
  const [mpResult, setMpResult] = useState<{
    passed: boolean;
    pointsAwarded: number;
    feedback: { pairResults: Array<{ id: string; correct: boolean; expectedRight: string; reference: string }> };
  } | null>(null);

  const profileKey = getOrCreateProfileKey();

  useEffect(() => {
    Promise.all([
      fetch('/api/expansion/retos').then((r) => r.json()),
      fetch(`/api/expansion/trajectory/${encodeURIComponent(profileKey)}`).then((r) => r.json()),
    ])
      .then(([retosData, trajData]) => {
        setData(retosData);
        if (trajData?.profile) {
          setRetosCount(trajData.profile.retosCompleted || 0);
        }
      })
      .finally(() => setLoading(false));
  }, [profileKey]);

  const filterByDiff = <T extends { difficulty: Difficulty }>(items: T[]) =>
    difficultyFilter === 'todas'
      ? items
      : items.filter((i) => i.difficulty === difficultyFilter);

  const crosswords = data ? filterByDiff(data.crosswords) : [];
  const scrambles = data ? filterByDiff(data.scrambles) : [];
  const verses = data ? filterByDiff(data.verses) : [];
  const matches = data ? filterByDiff(data.matches) : [];

  const activeCw = crosswords[cwIdx % Math.max(1, crosswords.length)];
  const activeSc = scrambles[scIdx % Math.max(1, scrambles.length)];
  const activeCv = verses[cvIdx % Math.max(1, verses.length)];
  const activeMp = matches[mpIdx % Math.max(1, matches.length)];

  const submitVerify = async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/expansion/retos/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileKey, ...payload }),
    });
    const out = await res.json();
    if (out.completedRetoIds) setCompletedKeys(out.completedRetoIds);
    if (typeof out.retosCompleted === 'number') setRetosCount(out.retosCompleted);
    const kind = String(payload.kind || '');
    if (out.passed) {
      if (kind === 'crossword') soundFX.playCrosswordComplete();
      else if (kind === 'scramble') soundFX.playWordSolved();
      else if (kind === 'verse') soundFX.playVerseCorrect();
      else if (kind === 'match') soundFX.playPuzzleComplete();
      else soundFX.playCorrect();
    } else {
      if (
        kind === 'crossword' &&
        Array.isArray(out.feedback?.wordResults) &&
        out.feedback.wordResults.some((w: { correct: boolean }) => w.correct)
      ) {
        soundFX.playCrosswordWord();
      } else {
        soundFX.playDiscreetError();
      }
    }
    return out;
  };

  // Build active crossword coordinate map
  const cwCellMap = new Map<string, { numbers: number[] }>();
  if (activeCw) {
    for (const w of activeCw.words) {
      for (let i = 0; i < w.length; i++) {
        const r = w.direction === 'H' ? w.row : w.row + i;
        const c = w.direction === 'H' ? w.col + i : w.col;
        const key = `${r},${c}`;
        const existing = cwCellMap.get(key) || { numbers: [] };
        if (i === 0 && !existing.numbers.includes(w.number)) {
          existing.numbers.push(w.number);
        }
        cwCellMap.set(key, existing);
      }
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al inicio
      </button>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-300">
            <Puzzle className="w-4 h-4" />
            Crucigramas y Rompecabezas Bíblicos
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white">
            Retos Bíblicos
          </h1>
          <p className="text-slate-400 text-sm">
            Desafíos verificados por el servidor para sumar puntos y desbloquear tu medalla Maestro de Retos ({retosCount} completados).
          </p>
        </div>

        <select
          value={difficultyFilter}
          onChange={(e) => {
            setDifficultyFilter(e.target.value as Difficulty | 'todas');
            setCwIdx(0);
            setScIdx(0);
            setCvIdx(0);
            setMpIdx(0);
          }}
          className="bg-[#111A2E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
        >
          <option value="todas">Todas las dificultades</option>
          <option value="facil">Fácil</option>
          <option value="intermedio">Intermedio</option>
          <option value="dificil">Difícil</option>
        </select>
      </div>

      {/* 4 Sub-mode Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { id: 'crucigrama' as const, label: 'Crucigramas', icon: Grid },
          { id: 'desordenadas' as const, label: 'Palabras Desordenadas', icon: Shuffle },
          { id: 'versiculo' as const, label: 'Completa el Versículo', icon: BookOpen },
          { id: 'relacion' as const, label: 'Rompecabezas Relación', icon: Link2 },
        ].map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`p-3.5 rounded-2xl border text-left flex items-center gap-2.5 text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                active
                  ? 'bg-teal-500/20 border-teal-400 text-white'
                  : 'bg-[#111A2E] border-slate-800 text-slate-300 hover:border-slate-600'
              }`}
            >
              <Icon className="w-4 h-4 text-teal-400 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {onCreatedMultiplayerRoom && (
        <div className="flex flex-wrap gap-2 bg-[#111A2E] border border-slate-800 p-1.5 rounded-2xl w-fit">
          <button
            type="button"
            onClick={() => setActivityMode('solo')}
            className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
              activityMode === 'solo'
                ? 'bg-amber-400 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Práctica Individual
          </button>
          <button
            type="button"
            onClick={() => setActivityMode('multiplayer')}
            className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
              activityMode === 'multiplayer'
                ? 'bg-sky-400 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Competencia Multijugador con QR
          </button>
        </div>
      )}

      {activityMode === 'multiplayer' && onCreatedMultiplayerRoom ? (
        (() => {
          const setupByTab: Record<
            'crucigrama' | 'desordenadas' | 'versiculo' | 'relacion',
            {
              mode: RetoCompetitionKind;
              title: string;
              desc: string;
              countLabel: string;
              countOptions: number[];
              defaultCount: number;
              timeOptions: Array<{ value: number; label: string }>;
              defaultTime: number;
            }
          > = {
            crucigrama: {
              mode: 'crucigrama_biblico',
              title: 'Crucigrama Bíblico en Vivo',
              desc: 'Todos los participantes o equipos resuelven el mismo crucigrama simultáneamente antes de que termine el tiempo.',
              countLabel: 'Cantidad de crucigramas',
              countOptions: [1, 2, 3, 4, 6],
              defaultCount: 3,
              timeOptions: [
                { value: 60, label: '60 segundos' },
                { value: 90, label: '90 segundos' },
                { value: 120, label: '120 segundos' },
                { value: 180, label: '180 segundos' },
                { value: 240, label: '240 segundos' },
              ],
              defaultTime: 120,
            },
            desordenadas: {
              mode: 'palabras_desordenadas',
              title: 'Palabras Desordenadas en Vivo',
              desc: 'Las mismas letras mezcladas aparecen para toda la sala. Gana quien ordene la palabra bíblica con mayor rapidez.',
              countLabel: 'Cantidad de palabras',
              countOptions: [5, 8, 10, 12],
              defaultCount: 8,
              timeOptions: [
                { value: 20, label: '20 segundos' },
                { value: 30, label: '30 segundos' },
                { value: 45, label: '45 segundos' },
                { value: 60, label: '60 segundos' },
              ],
              defaultTime: 30,
            },
            versiculo: {
              mode: 'completa_versiculo',
              title: 'Completa el Versículo en Vivo',
              desc: 'Todos ven el pasaje incompleto al mismo tiempo y responden por puntos de precisión y velocidad.',
              countLabel: 'Cantidad de versículos',
              countOptions: [5, 8, 12, 16],
              defaultCount: 8,
              timeOptions: [
                { value: 15, label: '15 segundos' },
                { value: 20, label: '20 segundos' },
                { value: 30, label: '30 segundos' },
                { value: 45, label: '45 segundos' },
              ],
              defaultTime: 25,
            },
            relacion: {
              mode: 'rompecabezas_biblico',
              title: 'Rompecabezas Bíblico en Vivo',
              desc: 'Conecta personajes, acontecimientos y libros bíblicos contra reloj. Se evalúa precisión y tiempo.',
              countLabel: 'Cantidad de rompecabezas',
              countOptions: [2, 3, 4, 6],
              defaultCount: 4,
              timeOptions: [
                { value: 30, label: '30 segundos' },
                { value: 45, label: '45 segundos' },
                { value: 60, label: '60 segundos' },
                { value: 90, label: '90 segundos' },
              ],
              defaultTime: 45,
            },
          };
          const cfg = setupByTab[tab];
          return (
            <CompetitionSetupForm
              key={tab}
              mode={cfg.mode}
              defaultTitle={cfg.title}
              description={cfg.desc}
              countLabel={cfg.countLabel}
              countOptions={cfg.countOptions}
              defaultCount={cfg.defaultCount}
              timeOptions={cfg.timeOptions}
              defaultTimeSec={cfg.defaultTime}
              onCreated={onCreatedMultiplayerRoom}
              onJoinCode={onJoinCode}
            />
          );
        })()
      ) : loading ? (
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-10 text-center text-slate-400">
          Cargando retos bíblicos...
        </div>
      ) : (
        <>
          {/* TAB 1: CRUCIGRAMAS */}
          {tab === 'crucigrama' && activeCw && (
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-bold text-white">
                    {activeCw.title}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Escribe las letras sin tildes.{' '}
                    {completedKeys.includes(`crossword:${activeCw.id}`) && (
                      <span className="text-emerald-400 font-semibold">· Ya superado</span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  {crosswords.map((cw, i) => (
                    <button
                      key={cw.id}
                      type="button"
                      onClick={() => {
                        setCwIdx(i);
                        setCwGrid({});
                        setCwResult(null);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                        cw.id === activeCw.id
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      #{i + 1}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-6 overflow-x-auto">
                  <div
                    className="inline-grid gap-1 bg-[#080E1E] p-3 rounded-xl border border-slate-800"
                    style={{
                      gridTemplateColumns: `repeat(${activeCw.cols}, minmax(30px, 38px))`,
                    }}
                  >
                    {Array.from({ length: activeCw.rows }).map((_, r) =>
                      Array.from({ length: activeCw.cols }).map((__, c) => {
                        const coord = `${r},${c}`;
                        const meta = cwCellMap.get(coord);
                        if (!meta) {
                          return <div key={coord} className="w-8 h-8 sm:w-9 sm:h-9" />;
                        }
                        return (
                          <div key={coord} className="relative w-8 h-8 sm:w-9 sm:h-9">
                            {meta.numbers.length > 0 && (
                              <span className="absolute top-0.5 left-1 text-[9px] font-mono-num font-bold text-amber-300 pointer-events-none">
                                {meta.numbers[0]}
                              </span>
                            )}
                            <input
                              type="text"
                              maxLength={1}
                              value={cwGrid[coord] || ''}
                              onChange={(e) => {
                                const val = e.target.value
                                  .normalize('NFD')
                                  .replace(/[\u0300-\u036f]/g, '')
                                  .toUpperCase()
                                  .replace(/[^A-Z]/g, '');
                                setCwGrid((prev) => ({ ...prev, [coord]: val }));
                                setCwResult(null);
                              }}
                              className="w-full h-full bg-[#15203A] border border-slate-600 focus:border-amber-400 rounded-md text-center font-mono-num font-extrabold text-sm sm:text-base text-white uppercase focus:outline-none"
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="lg:col-span-6 space-y-4">
                  <div className="space-y-2.5">
                    {activeCw.words.map((w) => {
                      const wordRes = cwResult?.wordResults?.find((r) => r.wordId === w.id);
                      return (
                        <div
                          key={w.id}
                          className={`p-3 rounded-xl border text-xs sm:text-sm ${
                            wordRes
                              ? wordRes.correct
                                ? 'bg-emerald-500/15 border-emerald-400 text-emerald-100'
                                : 'bg-rose-500/15 border-rose-400 text-rose-100'
                              : 'bg-[#080E1E] border-slate-800 text-slate-200'
                          }`}
                        >
                          <p className="font-bold text-amber-300">
                            {w.number}. {w.direction === 'H' ? 'Horizontal' : 'Vertical'} ({w.length} letras)
                          </p>
                          <p className="mt-0.5">{w.clue}</p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Cita: {w.reference}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      const out = await submitVerify({
                        kind: 'crossword',
                        challengeId: activeCw.id,
                        grid: cwGrid,
                      });
                      setCwResult({
                        passed: out.passed,
                        pointsAwarded: out.pointsAwarded,
                        wordResults: out.feedback?.wordResults,
                      });
                    }}
                    className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-sm cursor-pointer"
                  >
                    Verificar Crucigrama
                  </button>

                  {cwResult && (
                    <div
                      className={`p-3.5 rounded-xl border text-sm font-semibold ${
                        cwResult.passed
                          ? 'bg-emerald-500/15 border-emerald-400 text-emerald-200'
                          : 'bg-rose-500/15 border-rose-400 text-rose-200'
                      }`}
                    >
                      {cwResult.passed
                        ? `¡Crucigrama completado! ${
                            cwResult.pointsAwarded > 0
                              ? `+${cwResult.pointsAwarded} pts sumados a tu trayectoria.`
                              : 'Ya acreditado previamente.'
                          }`
                        : 'Algunas palabras aún tienen letras faltantes o incorrectas. ¡Revisa las pistas!'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PALABRAS DESORDENADAS */}
          {tab === 'desordenadas' && activeSc && (
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 max-w-2xl space-y-5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  Categoría: <strong className="text-sky-300">{activeSc.category}</strong>
                </span>
                <span>
                  Reto {(scIdx % scrambles.length) + 1} de {scrambles.length}
                </span>
              </div>

              <div className="bg-[#080E1E] border border-slate-800 rounded-2xl p-6 text-center space-y-3">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">
                  Ordena las {activeSc.wordLength} letras
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {activeSc.scrambledLetters.split('').map((ch, i) => (
                    <span
                      key={i}
                      className="w-10 h-11 rounded-xl bg-amber-400/15 border border-amber-400/50 text-amber-300 font-mono-num font-extrabold text-xl flex items-center justify-center"
                    >
                      {ch}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-slate-300 pt-2">Pista: {activeSc.hint}</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={scAnswer}
                  onChange={(e) => {
                    soundFX.playTileMove();
                    setScAnswer(e.target.value);
                    setScResult(null);
                  }}
                  placeholder="Escribe la palabra ordenada..."
                  className="flex-1 bg-[#080E1E] border border-slate-700 rounded-xl px-4 py-3 text-white font-semibold uppercase"
                />
                <button
                  type="button"
                  onClick={async () => {
                    const out = await submitVerify({
                      kind: 'scramble',
                      challengeId: activeSc.id,
                      answer: scAnswer,
                    });
                    setScResult(out);
                  }}
                  className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-sm cursor-pointer"
                >
                  Comprobar
                </button>
              </div>

              {scResult && (
                <div
                  className={`p-4 rounded-xl border text-sm ${
                    scResult.passed
                      ? 'bg-emerald-500/15 border-emerald-400 text-emerald-200'
                      : 'bg-rose-500/15 border-rose-400 text-rose-200'
                  }`}
                >
                  {scResult.passed
                    ? `¡Correcto: ${scResult.feedback.displayWord}! (${scResult.feedback.reference}) ${
                        scResult.pointsAwarded > 0 ? `+${scResult.pointsAwarded} pts` : ''
                      }`
                    : 'No coincide aún. Revisa las letras y la pista.'}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setScIdx((i) => i + 1);
                    setScAnswer('');
                    setScResult(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white cursor-pointer"
                >
                  Siguiente palabra →
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: COMPLETA EL VERSÍCULO */}
          {tab === 'versiculo' && activeCv && (
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 max-w-2xl space-y-5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="text-amber-300 font-bold">{activeCv.reference}</span>
                <span>
                  Versículo {(cvIdx % verses.length) + 1} de {verses.length}
                </span>
              </div>

              <p className="font-display text-xl sm:text-2xl font-bold text-white leading-relaxed bg-[#080E1E] border border-slate-800 rounded-2xl p-6">
                «{activeCv.verseBefore}{' '}
                <span className="inline-block px-3 py-0.5 rounded-lg border border-dashed border-amber-400 text-amber-300 mx-1">
                  {cvResult ? cvResult.feedback.missingWord : '_______'}
                </span>{' '}
                {activeCv.verseAfter}»
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {activeCv.options.map((opt, idx) => {
                  const isPicked = cvSelected === idx;
                  const isRight = cvResult && cvResult.feedback.correctIndex === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={cvResult !== null}
                      onClick={async () => {
                        soundFX.playVerseSelect();
                        setCvSelected(idx);
                        const out = await submitVerify({
                          kind: 'verse',
                          challengeId: activeCv.id,
                          selectedIndex: idx,
                        });
                        setCvResult(out);
                      }}
                      className={`p-3.5 rounded-xl border text-left font-semibold text-sm flex items-center justify-between cursor-pointer ${
                        cvResult
                          ? isRight
                            ? 'bg-emerald-600/25 border-emerald-400 text-emerald-100'
                            : isPicked
                              ? 'bg-rose-600/25 border-rose-400 text-rose-100'
                              : 'bg-[#080E1E] border-slate-800 text-slate-500'
                          : 'bg-[#080E1E] hover:bg-slate-800 border-slate-700 text-white'
                      }`}
                    >
                      <span>{opt}</span>
                      {cvResult && isRight && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      )}
                      {cvResult && isPicked && !isRight && (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      )}
                    </button>
                  );
                })}
              </div>

              {cvResult && (
                <div className="p-4 rounded-xl bg-[#080E1E] border border-slate-700 space-y-1">
                  <p
                    className={`font-bold text-sm ${
                      cvResult.passed ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {cvResult.passed
                      ? `¡Versículo completado! ${
                          cvResult.pointsAwarded > 0 ? `+${cvResult.pointsAwarded} pts` : ''
                        }`
                      : `La palabra correcta es «${cvResult.feedback.missingWord}».`}
                  </p>
                  <p className="text-xs text-slate-300">{cvResult.feedback.explanation}</p>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setCvIdx((i) => i + 1);
                    setCvSelected(null);
                    setCvResult(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white cursor-pointer"
                >
                  Siguiente versículo →
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: ROMPECABEZAS DE RELACIÓN */}
          {tab === 'relacion' && activeMp && (
            <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-xl font-bold text-white">
                    {activeMp.title}
                  </h2>
                  <p className="text-xs text-slate-400">{activeMp.description}</p>
                </div>
                <div className="flex gap-2">
                  {matches.map((m, i) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setMpIdx(i);
                        setPairings({});
                        setMpResult(null);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                        m.id === activeMp.id
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      #{i + 1}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {activeMp.leftItems.map((left) => {
                  const resItem = mpResult?.feedback.pairResults.find((r) => r.id === left.id);
                  return (
                    <div
                      key={left.id}
                      className={`p-3.5 rounded-xl border grid grid-cols-1 md:grid-cols-12 gap-3 items-center ${
                        resItem
                          ? resItem.correct
                            ? 'bg-emerald-500/15 border-emerald-400'
                            : 'bg-rose-500/15 border-rose-400'
                          : 'bg-[#080E1E] border-slate-800'
                      }`}
                    >
                      <div className="md:col-span-4 font-display font-bold text-white text-sm">
                        {left.label}
                      </div>
                      <div className="md:col-span-8">
                        <select
                          value={pairings[left.id] || ''}
                          onChange={(e) => {
                            soundFX.playPuzzleSnap();
                            setPairings((prev) => ({
                              ...prev,
                              [left.id]: e.target.value,
                            }));
                            setMpResult(null);
                          }}
                          className="w-full bg-[#111A2E] border border-slate-700 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-slate-200"
                        >
                          <option value="">Selecciona su pareja correspondiente...</option>
                          {activeMp.rightItems.map((r) => (
                            <option key={r.right} value={r.right}>
                              {r.right}
                            </option>
                          ))}
                        </select>
                        {resItem && !resItem.correct && (
                          <p className="text-[11px] text-amber-300 mt-1">
                            Correcto: {resItem.expectedRight} ({resItem.reference})
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={async () => {
                  const out = await submitVerify({
                    kind: 'match',
                    challengeId: activeMp.id,
                    pairings,
                  });
                  setMpResult(out);
                }}
                className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-sm inline-flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                Verificar Relaciones
              </button>

              {mpResult && (
                <div
                  className={`p-3.5 rounded-xl border text-sm font-semibold ${
                    mpResult.passed
                      ? 'bg-emerald-500/15 border-emerald-400 text-emerald-200'
                      : 'bg-rose-500/15 border-rose-400 text-rose-200'
                  }`}
                >
                  {mpResult.passed
                    ? `¡Todas las relaciones correctas! ${
                        mpResult.pointsAwarded > 0 ? `+${mpResult.pointsAwarded} pts` : ''
                      }`
                    : 'Revisa las parejas marcadas en rojo e intenta nuevamente.'}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
