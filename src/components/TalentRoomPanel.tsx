import { useEffect, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  Eye,
  HeartHandshake,
  Lock,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Tv,
  Users,
} from 'lucide-react';
import {
  TALENT_ENCOURAGEMENT_MESSAGES,
  TALENT_POSITIVE_REACTIONS,
  TALENT_RECOGNITION_TITLES,
  type TalentReactionId,
} from '../shared/talentShowData';
import type { GameRoomClientState } from '../shared/types';
import { soundFX } from '../utils/sound';
import { TalentCertificateCard } from './TalentCertificateCard';
import { TalentStageScreen } from './TalentStageScreen';

interface TalentRoomPanelProps {
  state: GameRoomClientState;
  role: 'presenter' | 'projector' | 'participant';
  clockOffsetMs: number;
  onPresenterAction?: (action: string, extra?: Record<string, unknown>) => void;
  onSubmitTalentVote?: (payload: {
    entryId: string;
    reactionId: string;
    curatedMessage?: string;
  }) => void;
}

export function TalentRoomPanel({
  state,
  role,
  clockOffsetMs,
  onPresenterAction,
  onSubmitTalentVote,
}: TalentRoomPanelProps) {
  const tr = state.talentRoomState;
  const [selectedEntryIdForNote, setSelectedEntryIdForNote] = useState<string>('');
  const [recTitle, setRecTitle] = useState<string>(TALENT_RECOGNITION_TITLES[0]);
  const [recNote, setRecNote] = useState<string>(
    '¡Gracias por compartir tu talento con alegría y reverencia!'
  );
  const [selectedReaction, setSelectedReaction] =
    useState<TalentReactionId>('edificante');
  const [selectedCuratedMsg, setSelectedCuratedMsg] = useState<string>(
    TALENT_ENCOURAGEMENT_MESSAGES[0]
  );
  const [voteSentNotice, setVoteSentNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!tr) return;
    if (tr.activeEntryId && tr.activeEntryId !== selectedEntryIdForNote) {
      setSelectedEntryIdForNote(tr.activeEntryId);
      const found = tr.entries.find((e) => e.id === tr.activeEntryId);
      if (found) {
        setRecTitle(found.recognitionTitle);
        if (found.directorEncouragementNote) {
          setRecNote(found.directorEncouragementNote);
        }
      }
    }
  }, [tr?.activeEntryId]);

  if (!tr) return null;

  // PROJECTOR VIEW: Full editorial stage presentation screen
  if (role === 'projector') {
    return (
      <TalentStageScreen
        talentState={tr}
        clockOffsetMs={clockOffsetMs}
      />
    );
  }

  // PARTICIPANT VIEW: Audience mobile screen synced + gated positive voting
  if (role === 'participant') {
    const activeEntry =
      tr.entries.find((e) => e.id === tr.activeEntryId) || tr.entries[0];
    const alreadySupported = activeEntry
      ? tr.myAppreciatedEntryIds.includes(activeEntry.id)
      : false;

    const handleSendVote = (entryId: string) => {
      soundFX.playTalentApplauseChime();
      onSubmitTalentVote?.({
        entryId,
        reactionId: selectedReaction,
        curatedMessage: selectedCuratedMsg || undefined,
      });
      setVoteSentNotice(
        '¡Tu muestra de ánimo y apreciación fue enviada con éxito!'
      );
      window.setTimeout(() => setVoteSentNotice(null), 3500);
    };

    return (
      <div className="space-y-5">
        <div className="bg-[#111A2E] border border-amber-400/35 rounded-2xl p-5 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
            Talentos Juveniles en Vivo
          </p>
          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-white text-balance">
            {tr.programTitle}
          </h2>
          <p className="text-xs text-slate-400">
            {tr.currentScreen === 'waiting'
              ? 'Pantalla de espera · Preparando el escenario'
              : tr.currentScreen === 'presentation'
                ? 'Presentación en curso'
                : 'Reconocimiento final a todos los jóvenes'}
          </p>
        </div>

        {/* Waiting screen for mobile */}
        {tr.currentScreen === 'waiting' && (
          <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 className="font-display font-bold text-base text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" />
              Programa de Presentaciones ({tr.entries.length})
            </h3>
            {tr.entries.length === 0 ? (
              <p className="text-sm text-slate-400">
                El director está organizando el orden de presentaciones.
              </p>
            ) : (
              <div className="space-y-2">
                {tr.entries.map((e, i) => (
                  <div
                    key={e.id}
                    className="bg-[#080E1E] border border-slate-800 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold" style={{ color: e.categoryColor }}>
                        #{i + 1} · {e.categoryLabel}
                      </p>
                      <p className="text-sm font-semibold text-white truncate">
                        {e.presentationTitle}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {e.publicName}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Active Presentation + Gated Positive Voting */}
        {tr.currentScreen === 'presentation' && activeEntry && (
          <div className="space-y-4">
            <div
              className="bg-[#111A2E] border-2 rounded-2xl p-5 space-y-3"
              style={{ borderColor: activeEntry.categoryColor }}
            >
              <p
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: activeEntry.categoryColor }}
              >
                En Escenario · {activeEntry.categoryLabel}
              </p>
              <h3 className="font-display text-2xl font-extrabold text-white">
                {activeEntry.presentationTitle}
              </h3>
              <p className="text-base font-semibold text-amber-300">
                {activeEntry.publicName}
              </p>
              {activeEntry.description && (
                <p className="text-sm text-slate-300 leading-relaxed">
                  {activeEntry.description}
                </p>
              )}
              {activeEntry.authorizedMediaUrl && (
                <img
                  src={activeEntry.authorizedMediaUrl}
                  alt={activeEntry.presentationTitle}
                  className="w-full max-h-60 object-contain rounded-xl bg-[#080E1E] p-2"
                />
              )}
            </div>

            {tr.audienceVotingEnabled ? (
              <div className="bg-[#111A2E] border border-emerald-500/40 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-display font-bold text-base text-white inline-flex items-center gap-2">
                    <HeartHandshake className="w-5 h-5 text-emerald-400" />
                    Enviar Apreciación Positiva
                  </h4>
                  {alreadySupported && (
                    <span className="text-xs font-semibold text-emerald-300 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Enviada
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-400">
                  Elige una reacción edificante y un mensaje de ánimo para honrar el esfuerzo de este participante.
                </p>

                <div className="grid grid-cols-2 gap-2">
                  {TALENT_POSITIVE_REACTIONS.map((react) => (
                    <button
                      key={react.id}
                      type="button"
                      onClick={() => setSelectedReaction(react.id)}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                        selectedReaction === react.id
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                          : 'bg-[#080E1E] border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      {react.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Frase de ánimo (opcional)
                  </label>
                  <select
                    value={selectedCuratedMsg}
                    onChange={(e) => setSelectedCuratedMsg(e.target.value)}
                    className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                  >
                    <option value="">Solo enviar reacción positiva</option>
                    {TALENT_ENCOURAGEMENT_MESSAGES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => handleSendVote(activeEntry.id)}
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-sm cursor-pointer transition-colors"
                >
                  {alreadySupported
                    ? 'Actualizar Mi Apreciación Positiva'
                    : 'Enviar Apreciación Positiva'}
                </button>

                {voteSentNotice && (
                  <p className="text-xs text-emerald-300 text-center font-semibold">
                    {voteSentNotice}
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 text-center space-y-1">
                <p className="text-xs font-semibold text-slate-300 inline-flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-300" />
                  Votación del público en espera
                </p>
                <p className="text-xs text-slate-400">
                  El director habilitará las votaciones positivas del público cuando corresponda.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Final Recognition Screen on Mobile */}
        {tr.currentScreen === 'recognition' && (
          <div className="space-y-4">
            <div className="bg-[#111A2E] border border-amber-400/40 rounded-2xl p-5 text-center space-y-1.5">
              <Award className="w-8 h-8 text-amber-400 mx-auto" />
              <h3 className="font-display text-xl font-extrabold text-white">
                ¡Gracias a Todos los Participantes!
              </h3>
              <p className="text-xs text-slate-300">
                Cada talento compartido hoy glorificó a Dios y edificó a los jóvenes.
              </p>
            </div>

            {tr.entries.map((e, i) => (
              <div
                key={e.id}
                className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 space-y-1.5"
              >
                <p className="text-xs font-bold" style={{ color: e.categoryColor }}>
                  #{i + 1} · {e.categoryLabel}
                </p>
                <p className="font-display font-bold text-base text-white">
                  {e.publicName}
                </p>
                <p className="text-xs font-semibold text-amber-300">
                  {e.recognitionTitle}
                </p>
                {e.directorEncouragementNote && (
                  <p className="text-xs text-slate-300">
                    {e.directorEncouragementNote}
                  </p>
                )}
              </div>
            ))}

            {tr.certificates.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-display font-bold text-base text-white">
                  Certificados Digitales Disponibles
                </h4>
                {tr.certificates.map((cert) => (
                  <TalentCertificateCard
                    key={cert.id}
                    certificate={cert}
                    compact
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // PRESENTER LIVE DIRECTOR CONSOLE
  const activeEntry =
    tr.entries.find((e) => e.id === tr.activeEntryId) || tr.entries[0];

  return (
    <div className="space-y-5">
      {/* Live Stage Navigation & Opening Animation Controls */}
      <div className="bg-[#111A2E] border border-amber-400/40 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
              Dirección de Talentos Juveniles en Vivo
            </p>
            <h3 className="font-display text-lg font-extrabold text-white">
              Control de Pantalla Grande, Tiempo y Privacidad
            </h3>
          </div>
          <button
            type="button"
            onClick={() =>
              onPresenterAction?.('talent_set_screen', {
                screen: tr.currentScreen,
                triggerOpening: true,
              })
            }
            className="px-3.5 py-2 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-amber-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Animación y Sonido de Apertura
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {(
            [
              { id: 'waiting', label: '1. Pantalla de Espera' },
              { id: 'presentation', label: '2. Pantalla de Presentación' },
              { id: 'recognition', label: '3. Reconocimiento Final' },
            ] as const
          ).map((scr) => (
            <button
              key={scr.id}
              type="button"
              onClick={() =>
                onPresenterAction?.('talent_set_screen', {
                  screen: scr.id,
                  triggerOpening: true,
                })
              }
              className={`px-4 py-3 rounded-xl border text-xs sm:text-sm font-bold cursor-pointer transition-colors ${
                tr.currentScreen === scr.id
                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                  : 'bg-[#080E1E] text-slate-200 border-slate-800 hover:border-slate-600'
              }`}
            >
              {scr.label}
            </button>
          ))}
        </div>

        {/* Participant Selector & Presentation Timer Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              Participante en Turno ({tr.entries.length})
            </label>
            <select
              value={tr.activeEntryId || ''}
              onChange={(e) =>
                onPresenterAction?.('talent_set_screen', {
                  screen: 'presentation',
                  activeEntryId: e.target.value,
                  triggerOpening: true,
                })
              }
              className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
            >
              {tr.entries.length === 0 && (
                <option value="">No hay participantes registrados aún</option>
              )}
              {tr.entries.map((e, i) => (
                <option key={e.id} value={e.id}>
                  #{i + 1} · {e.publicName} — {e.presentationTitle}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <span className="block text-xs font-semibold text-slate-300">
              Cronómetro de Presentación
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {tr.timerRunning ? (
                <button
                  type="button"
                  onClick={() =>
                    onPresenterAction?.('talent_timer_action', {
                      timerAction: 'pause',
                    })
                  }
                  className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Pause className="w-3.5 h-3.5" />
                  Pausar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    onPresenterAction?.('talent_timer_action', {
                      timerAction: 'start',
                    })
                  }
                  className="px-3.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Iniciar
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  onPresenterAction?.('talent_timer_action', {
                    timerAction: 'reset',
                  })
                }
                className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reiniciar
              </button>
              <button
                type="button"
                onClick={() =>
                  onPresenterAction?.('talent_timer_action', {
                    timerAction: 'add30',
                  })
                }
                className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                30s
              </button>
            </div>
          </div>
        </div>

        {/* Audience Voting & Strict Privacy Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() =>
              onPresenterAction?.('talent_set_controls', {
                audienceVotingEnabled: !tr.audienceVotingEnabled,
              })
            }
            className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 cursor-pointer ${
              tr.audienceVotingEnabled
                ? 'bg-emerald-500/15 border-emerald-400 text-emerald-200'
                : 'bg-[#080E1E] border-slate-800 text-slate-300'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <HeartHandshake className="w-4 h-4" />
              Votación del Público
            </span>
            <span>{tr.audienceVotingEnabled ? 'ACTIVA' : 'Pausada'}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onPresenterAction?.('talent_set_controls', {
                privacy: {
                  showNamesOnScreen: !tr.privacy.showNamesOnScreen,
                },
              })
            }
            className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 cursor-pointer ${
              tr.privacy.showNamesOnScreen
                ? 'bg-sky-500/15 border-sky-400 text-sky-200'
                : 'bg-[#080E1E] border-slate-800 text-slate-300'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Eye className="w-4 h-4" />
              Nombres en Pantalla
            </span>
            <span>{tr.privacy.showNamesOnScreen ? 'Visible' : 'Alias'}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onPresenterAction?.('talent_set_controls', {
                privacy: {
                  showPhotosOnScreen: !tr.privacy.showPhotosOnScreen,
                },
              })
            }
            className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 cursor-pointer ${
              tr.privacy.showPhotosOnScreen
                ? 'bg-amber-500/15 border-amber-400 text-amber-200'
                : 'bg-[#080E1E] border-slate-800 text-slate-300'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              Fotos Autorizadas
            </span>
            <span>{tr.privacy.showPhotosOnScreen ? 'Permitidas' : 'Ocultas'}</span>
          </button>
        </div>
      </div>

      {/* Record Recognition & Issue Certificates */}
      {activeEntry && (
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-display font-bold text-base text-white">
              Registrar Resultado y Reconocimiento — {activeEntry.publicName}
            </h4>
            <span className="text-xs text-slate-400">
              {activeEntry.status === 'completed' ? 'Completado' : 'En programa'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={recTitle}
              onChange={(e) => setRecTitle(e.target.value)}
              placeholder="Título de reconocimiento"
              className="bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
            />
            <input
              type="text"
              value={recNote}
              onChange={(e) => setRecNote(e.target.value)}
              placeholder="Nota positiva del director"
              className="bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() =>
                onPresenterAction?.('talent_record_result', {
                  entryId: activeEntry.id,
                  recognitionTitle: recTitle,
                  directorEncouragementNote: recNote,
                })
              }
              className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              Guardar Resultado del Participante
            </button>

            <button
              type="button"
              onClick={() => {
                soundFX.playTalentCertificateAward();
                onPresenterAction?.('talent_issue_certificates', {
                  entryId: 'all',
                  openRecognitionScreen: true,
                });
              }}
              className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Award className="w-4 h-4" />
              Emitir Certificados y Mostrar Reconocimiento Final
            </button>
          </div>
        </div>
      )}

      {/* Compact Stage Monitor Preview */}
      <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-200">
            <Tv className="w-4 h-4 text-sky-400" />
            Monitor en Tiempo Real de Pantalla Grande
          </span>
          <span className="inline-flex items-center gap-1 font-mono-num">
            <Clock className="w-3.5 h-3.5" />
            {tr.timerRemainingSec}s
          </span>
        </div>
        <TalentStageScreen
          talentState={tr}
          clockOffsetMs={clockOffsetMs}
        />
      </div>
    </div>
  );
}
