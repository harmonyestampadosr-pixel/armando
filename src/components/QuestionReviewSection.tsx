import { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Scale,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react';
import {
  DIFFICULTY_LABELS,
  QuestionReviewItem,
  TeamConfigSlot,
  TeamScoreEntry,
  getTeamDefinition,
} from '../shared/types';
import { AvatarBadge } from './AvatarBadge';

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export function TeamWinnerBanner({
  teams,
}: {
  teams: TeamScoreEntry[];
}) {
  if (!teams || teams.length === 0) return null;
  const activeTeams = teams.filter((t) => t.memberCount > 0);
  const ranked = activeTeams.length > 0 ? activeTeams : teams;
  const top = ranked[0];
  const runnerUp = ranked[1];
  const isTie = Boolean(runnerUp && top && runnerUp.score === top.score);
  const tiedTeams = isTie
    ? ranked.filter((t) => t.score === top.score)
    : [];

  return (
    <div
      className={`rounded-2xl p-6 sm:p-7 border text-center space-y-3 ${
        isTie
          ? 'bg-sky-500/10 border-sky-400/60'
          : 'bg-[#15203A] border-amber-400/60 shadow-lg shadow-amber-500/10'
      }`}
    >
      {isTie ? (
        <>
          <div className="inline-flex items-center gap-2 text-sky-300 font-display font-bold text-sm uppercase tracking-wider">
            <Scale className="w-5 h-5" />
            Empate Oficial de Equipos
          </div>
          <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
            ¡Empate en el Primer Puesto!
          </h3>
          <p className="text-slate-200 text-sm sm:text-base">
            {tiedTeams.map((t) => t.name).join(' · ')} —{' '}
            <strong className="font-mono-num text-amber-300">
              {top.score.toLocaleString('es-CO')} puntos
            </strong>{' '}
            cada uno.
          </p>
        </>
      ) : (
        <>
          <div className="inline-flex items-center gap-2 text-amber-300 font-display font-bold text-sm uppercase tracking-wider">
            <Trophy className="w-5 h-5 text-amber-400" />
            Equipo Ganador
          </div>
          <h3
            className="font-display text-3xl sm:text-4xl font-extrabold"
            style={{ color: top.color }}
          >
            {top.name}
          </h3>
          <p className="text-slate-200 text-sm sm:text-base inline-flex flex-wrap items-center justify-center gap-3">
            <span className="font-mono-num font-bold text-amber-300 text-lg">
              {top.score.toLocaleString('es-CO')} puntos totales
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 text-slate-300">
              <Users className="w-4 h-4" />
              {top.memberCount} integrantes
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-300 font-semibold">
              {top.correctCount} aciertos grupales
            </span>
          </p>
        </>
      )}
    </div>
  );
}

export function QuestionReviewSection({
  items,
  customTeams,
}: {
  items?: QuestionReviewItem[];
  customTeams?: TeamConfigSlot[];
}) {
  const [expanded, setExpanded] = useState(true);

  if (!items || items.length === 0) return null;

  return (
    <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-xl text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-400" />
            Revisión de Preguntas y Respuestas
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Consulta cada pregunta, su respuesta correcta, cita bíblica y el
            desempeño de los participantes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
        >
          {expanded ? (
            <>
              Ocultar detalle
              <ChevronUp className="w-4 h-4" />
            </>
          ) : (
            <>
              Ver {items.length} preguntas
              <ChevronDown className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {expanded && (
        <div className="space-y-4">
          {items.map((item) => {
            const correctText =
              item.options[item.correctIndex] ?? 'Respuesta correcta';
            return (
              <div
                key={item.questionIndex}
                className="bg-[#080E1E] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <span className="font-mono-num font-bold text-sky-300">
                    Pregunta {item.questionIndex + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <span>{item.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{DIFFICULTY_LABELS[item.difficulty]}</span>
                    {item.isSpecialMultiplier > 1 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-amber-300 font-bold">
                          Especial x{item.isSpecialMultiplier}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <p className="font-display font-bold text-base sm:text-lg text-white leading-snug">
                  {item.prompt}
                </p>

                <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="inline-flex items-center gap-2 text-emerald-300 font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Correcta ({OPTION_LETTERS[item.correctIndex]}): {correctText}
                  </span>
                  <span className="text-xs text-amber-300 font-medium">
                    {item.reference}
                  </span>
                </div>

                {item.explanation && (
                  <p className="text-xs text-slate-400">{item.explanation}</p>
                )}

                {item.answers.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {item.answers.map((ans) => {
                      const teamDef = getTeamDefinition(
                        ans.teamId,
                        customTeams
                      );
                      return (
                        <div
                          key={ans.participantId}
                          className="flex items-center justify-between gap-2 bg-[#111A2E] border border-slate-800/80 rounded-xl px-3 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <AvatarBadge
                              avatarId={ans.avatarId}
                              photoUrl={ans.photoUrl}
                              name={ans.participantName}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="font-semibold text-white truncate">
                                {ans.participantName}
                                {teamDef && (
                                  <span
                                    className="ml-1.5 font-normal"
                                    style={{ color: teamDef.color }}
                                  >
                                    · {teamDef.name}
                                  </span>
                                )}
                              </p>
                              <p className="text-slate-400 truncate">
                                {ans.selectedLabel}
                                {ans.responseTimeMs !== null
                                  ? ` · ${(ans.responseTimeMs / 1000).toFixed(1)}s`
                                  : ''}
                              </p>
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center gap-1.5 font-mono-num font-bold">
                            {ans.isCorrect ? (
                              <span className="text-emerald-400 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />+
                                {ans.pointsEarned}
                              </span>
                            ) : (
                              <span className="text-rose-400 inline-flex items-center gap-1">
                                <XCircle className="w-3.5 h-3.5" />0
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
