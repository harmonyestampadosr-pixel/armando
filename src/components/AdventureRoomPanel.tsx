import { useMemo } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Compass,
  Eye,
  Flag,
  HelpCircle,
  MessageSquare,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  ADVENTURE_AMBIENT_LABELS,
  type AdventurePlayMode,
} from '../shared/adventureStoriesData';
import type { GameRoomClientState } from '../shared/types';
import { AvatarBadge } from './AvatarBadge';

interface AdventureRoomPanelProps {
  state: GameRoomClientState;
  role: 'presenter' | 'projector' | 'participant';
  onPresenterAction?: (action: string, extra?: Record<string, unknown>) => void;
  onSubmitChoice?: (payload: { sceneId: string; optionId: string }) => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

const PLAY_MODE_LABELS: Record<AdventurePlayMode, string> = {
  individual: 'Modo Individual',
  competitive_players: 'Competencia entre jugadores',
  competitive_teams: 'Competencia por equipos',
  conductor_led: 'Presentación dirigida por el conductor',
};

export function AdventureRoomPanel({
  state,
  role,
  onPresenterAction,
  onSubmitChoice,
}: AdventureRoomPanelProps) {
  const adv = state.adventureState;
  const phase = adv?.phase;
  const scene = adv?.currentScene;
  const myChoiceId = adv?.mySelectedOptionId || null;
  const isRevealed =
    phase === 'consequence_reveal' ||
    phase === 'reflection' ||
    state.status === 'finished';

  const chosenOptionRevealed = useMemo(() => {
    if (!adv || !scene || !myChoiceId) return null;
    return scene.options.find((o) => o.id === myChoiceId) || null;
  }, [adv, scene, myChoiceId]);

  if (!adv || !scene) return null;

  const isDecisionOpen = phase === 'decision_open';
  const totalVotes = Object.values(adv.optionVoteCounts || {}).reduce(
    (a, b) => a + b,
    0
  );
  const ambientInfo = ADVENTURE_AMBIENT_LABELS[adv.ambientStyle];

  // ---------------- REFLECTION VIEW (FINAL STORY WRAP-UP) ----------------
  if (adv.phase === 'reflection') {
    return (
      <div className="space-y-6">
        <div className="bg-[#111A2E] border border-amber-400/40 rounded-3xl p-6 sm:p-8 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Reflexión Final · {adv.storyTitle}
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white text-balance">
                Enseñanza y Aplicación Espiritual
              </h2>
            </div>
            <span className="text-xs font-medium text-slate-400">
              {PLAY_MODE_LABELS[adv.playMode]} · {adv.mainReference}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-8 bg-[#080E1E] border border-slate-800 rounded-2xl p-5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-sky-300 inline-flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                Reflexión para hoy
              </p>
              <p className="text-base sm:text-lg text-slate-100 leading-relaxed">
                {adv.finalReflection ||
                  `Meditamos en las enseñanzas de ${adv.storyTitle} (${adv.mainReference}).`}
              </p>
              {Array.isArray(adv.keyTakeaways) && adv.keyTakeaways.length > 0 && (
                <ul className="space-y-1.5 pt-2 border-t border-slate-800 text-xs sm:text-sm text-slate-300">
                  {adv.keyTakeaways.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="md:col-span-4 bg-amber-500/10 border border-amber-400/40 rounded-2xl p-5 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-300 inline-flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" />
                Texto bíblico de referencia
              </p>
              <p className="font-display font-bold text-lg text-white">
                {adv.mainReference}
              </p>
              <p className="text-sm text-amber-100/90 leading-relaxed">
                {adv.scripturalAnchor}
              </p>
            </div>
          </div>

          {role === 'presenter' && onPresenterAction && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() =>
                  onPresenterAction('adventure_jump_scene', {
                    sceneIndex: adv.totalScenes - 1,
                  })
                }
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver a la última escena
              </button>

              <button
                type="button"
                onClick={() => onPresenterAction('adventure_finish')}
                className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-sm inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Flag className="w-4 h-4" />
                Concluir Aventura y Mostrar Podio
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Story Progress & Mode Strip */}
      <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="text-amber-300 font-semibold">
              {adv.storyTitle}
            </span>
            <span aria-hidden="true">·</span>
            <span>{PLAY_MODE_LABELS[adv.playMode]}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num text-sky-300 font-semibold">
              Escena {adv.currentSceneIndex + 1} de {adv.totalScenes}
            </span>
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-white truncate">
            {scene.title}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 shrink-0">
          <span>{scene.location}</span>
          <span aria-hidden="true">·</span>
          <span>{ambientInfo.name}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-num text-emerald-300 font-semibold inline-flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {adv.submissionsCount}/{state.participants.length} respuestas
          </span>
        </div>
      </div>

      {/* Narrative Adaptation vs Biblical Reference (Strict Separation) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 bg-[#111A2E] border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-sky-300 inline-flex items-center gap-1.5">
            <Compass className="w-4 h-4" />
            Adaptación narrativa de la escena
          </p>
          <p
            className={`${
              role === 'projector' ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg'
            } text-slate-100 leading-relaxed`}
          >
            {scene.narrativeAdaptation}
          </p>
        </div>

        <div className="lg:col-span-4 bg-amber-500/10 border border-amber-400/35 rounded-2xl p-5 space-y-2.5">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-300 inline-flex items-center gap-1.5">
            <BookOpen className="w-4 h-4" />
            Texto bíblico de referencia
          </p>
          <p className="font-display font-bold text-lg text-white">
            {scene.sceneReference}
          </p>
          <p className="text-sm text-amber-100/90 leading-relaxed">
            {scene.scriptureNote}
          </p>
          <p className="text-xs text-slate-400 pt-1 border-t border-amber-400/20">
            Referencia general: {adv.mainReference}
          </p>
        </div>
      </div>

      {/* Scene Interaction: Decision / Question */}
      <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-300 inline-flex items-center gap-1.5">
            {scene.interactionType === 'question' ? (
              <HelpCircle className="w-4 h-4" />
            ) : (
              <MessageSquare className="w-4 h-4" />
            )}
            {scene.interactionType === 'question'
              ? 'Pregunta de la escena'
              : 'Decisión interactiva'}
          </p>
          <span className="text-xs font-medium text-slate-400">
            {adv.phase === 'narration'
              ? 'Escuchando narración de la escena'
              : adv.phase === 'decision_open'
                ? 'Votación abierta en dispositivos'
                : 'Consecuencia narrativa y explicación reveladas'}
          </span>
        </div>

        <h3
          className={`font-display font-bold text-white leading-snug ${
            role === 'projector' ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl'
          }`}
        >
          {scene.prompt}
        </h3>

        {adv.phase === 'narration' && role !== 'presenter' && (
          <div className="bg-[#080E1E] border border-slate-800 rounded-xl p-4 text-sm text-slate-300">
            Atiende la lectura o proyección de la escena. El conductor habilitará
            las opciones en unos momentos.
          </div>
        )}

        {/* Decision Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {scene.options.map((opt, idx) => {
            const letter = OPTION_LETTERS[idx] || String(idx + 1);
            const voteCount = adv.optionVoteCounts?.[opt.id] || 0;
            const votePct =
              totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
            const isMine = myChoiceId === opt.id;
            const canClick =
              role === 'participant' &&
              isDecisionOpen &&
              !myChoiceId &&
              Boolean(onSubmitChoice);

            let cardStyle =
              'bg-[#080E1E] border-slate-800 text-slate-200';
            if (isRevealed) {
              if (opt.isBiblicallyFaithful) {
                cardStyle =
                  'bg-emerald-500/15 border-emerald-400/70 text-white';
              } else if (isMine) {
                cardStyle = 'bg-amber-500/15 border-amber-400/60 text-white';
              } else {
                cardStyle =
                  'bg-[#080E1E]/80 border-slate-800/80 text-slate-400';
              }
            } else if (isMine) {
              cardStyle = 'bg-sky-500/20 border-sky-400 text-white';
            } else if (canClick) {
              cardStyle =
                'bg-[#080E1E] border-slate-700 hover:border-amber-400 hover:bg-[#13203B] text-white cursor-pointer';
            }

            return (
              <button
                key={opt.id}
                type="button"
                disabled={!canClick}
                onClick={() =>
                  canClick &&
                  onSubmitChoice?.({ sceneId: scene.id, optionId: opt.id })
                }
                className={`text-left rounded-2xl border p-4 space-y-2.5 transition-colors ${cardStyle}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-lg bg-slate-800 text-amber-300 font-mono-num font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      {letter}
                    </span>
                    <span className="font-semibold text-sm sm:text-base leading-snug">
                      {opt.label}
                    </span>
                  </div>
                  {(isRevealed || role === 'presenter') && (
                    <span className="font-mono-num text-xs text-slate-300 shrink-0">
                      {voteCount} ({votePct}%)
                    </span>
                  )}
                </div>

                {(isRevealed || role === 'presenter') &&
                  opt.consequenceText && (
                    <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-xs sm:text-sm">
                      {opt.isBiblicallyFaithful && (
                        <p className="text-emerald-300 font-bold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Decisión fiel al relato bíblico
                        </p>
                      )}
                      <p className="text-slate-200 leading-relaxed">
                        <strong className="text-amber-300">Consecuencia:</strong>{' '}
                        {opt.consequenceText}
                      </p>
                      {opt.biblicalExplanation && (
                        <p className="text-slate-300 leading-relaxed">
                          <strong className="text-sky-300">
                            Explicación bíblica:
                          </strong>{' '}
                          {opt.biblicalExplanation}
                        </p>
                      )}
                    </div>
                  )}
              </button>
            );
          })}
        </div>

        {/* Participant Submitted Confirmation */}
        {role === 'participant' && myChoiceId && !isRevealed && (
          <div className="bg-sky-500/15 border border-sky-400/50 rounded-xl p-4 text-sm text-sky-100">
            Tu elección fue registrada. Esperando que el conductor revele la
            consecuencia y explicación bíblica.
          </div>
        )}

        {/* Participant Own Choice Feedback after Reveal */}
        {role === 'participant' && isRevealed && chosenOptionRevealed && (
          <div
            className={`rounded-xl border p-4 space-y-1.5 ${
              chosenOptionRevealed.isBiblicallyFaithful
                ? 'bg-emerald-500/15 border-emerald-400/60 text-emerald-100'
                : 'bg-amber-500/15 border-amber-400/60 text-amber-100'
            }`}
          >
            <p className="font-bold text-sm">
              {chosenOptionRevealed.isBiblicallyFaithful
                ? 'Excelente discernimiento bíblico'
                : 'Tu elección registró puntos por participación'}
            </p>
            <p className="text-xs sm:text-sm leading-relaxed">
              {chosenOptionRevealed.consequenceText}
            </p>
          </div>
        )}

        {/* Presenter Control Bar */}
        {role === 'presenter' && onPresenterAction && (
          <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {adv.currentSceneIndex > 0 && (
                <button
                  type="button"
                  onClick={() => onPresenterAction('adventure_prev_scene')}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Escena anterior
                </button>
              )}

              {adv.phase === 'narration' && (
                <button
                  type="button"
                  onClick={() => onPresenterAction('adventure_open_decision')}
                  className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-display font-extrabold text-sm inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <MessageSquare className="w-4 h-4" />
                  Abrir Decisión a Participantes
                </button>
              )}

              {(adv.phase === 'narration' || adv.phase === 'decision_open') && (
                <button
                  type="button"
                  onClick={() =>
                    onPresenterAction('adventure_reveal_consequence')
                  }
                  className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-sm inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Eye className="w-4 h-4" />
                  Revelar Consecuencia y Explicación
                </button>
              )}

              {adv.phase === 'consequence_reveal' && (
                <button
                  type="button"
                  onClick={() => onPresenterAction('adventure_next_scene')}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-sm inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <ArrowRight className="w-4 h-4" />
                  {adv.currentSceneIndex + 1 < adv.totalScenes
                    ? 'Siguiente Escena'
                    : 'Ir a Reflexión Final'}
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => onPresenterAction('adventure_show_reflection')}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
            >
              Saltar a Reflexión Final
            </button>
          </div>
        )}
      </div>

      {/* Live Participant Responses Strip (Presenter / Reveal) */}
      {(role === 'presenter' || isRevealed) && adv.submissions.length > 0 && (
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-display font-bold text-sm text-white">
              Participación en esta escena
            </h4>
            <span className="font-mono-num text-xs text-slate-400">
              {adv.submissions.length} respuestas recibidas
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {adv.submissions.map((s) => (
              <div
                key={s.participantId}
                className="bg-[#080E1E] border border-slate-800 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <AvatarBadge
                    avatarId={s.avatarId}
                    photoUrl={s.photoUrl}
                    name={s.participantName}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">
                      {s.participantName}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {s.optionLabel}
                    </p>
                  </div>
                </div>
                {typeof s.pointsEarned === 'number' && (
                  <span className="font-mono-num text-xs font-bold text-amber-300 shrink-0">
                    +{s.pointsEarned}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
