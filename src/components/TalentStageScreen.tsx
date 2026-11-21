import { useEffect, useRef, useState } from 'react';
import {
  Award,
  BookOpen,
  Clock,
  HeartHandshake,
  Maximize2,
  Minimize2,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  TALENT_POSITIVE_REACTIONS,
  type TalentCertificateRecord,
  type TalentPublicEntryView,
  type TalentRoomState,
} from '../shared/talentShowData';
import { soundFX } from '../utils/sound';
import { TalentCertificateCard } from './TalentCertificateCard';

interface TalentStageScreenProps {
  talentState: TalentRoomState;
  clockOffsetMs?: number;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  qrSlot?: React.ReactNode;
  certificates?: TalentCertificateRecord[];
}

function formatClock(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function TalentStageScreen({
  talentState,
  clockOffsetMs = 0,
  isFullscreen = false,
  onToggleFullscreen,
  qrSlot,
  certificates,
}: TalentStageScreenProps) {
  const [liveRemainingSec, setLiveRemainingSec] = useState<number>(
    talentState.timerRemainingSec
  );
  const lastTickSecRef = useRef<number | null>(null);
  const zeroPlayedRef = useRef<boolean>(false);

  useEffect(() => {
    const syncTime = () => {
      if (talentState.timerRunning && talentState.timerEndsAt) {
        const nowServerApprox = Date.now() + clockOffsetMs;
        const left = Math.max(
          0,
          Math.ceil((talentState.timerEndsAt - nowServerApprox) / 1000)
        );
        setLiveRemainingSec(left);

        if (left > 0 && left <= 5 && lastTickSecRef.current !== left) {
          lastTickSecRef.current = left;
          soundFX.playTick();
        }
        if (left === 0 && !zeroPlayedRef.current) {
          zeroPlayedRef.current = true;
          soundFX.playTimeUp();
        }
      } else {
        setLiveRemainingSec(talentState.timerRemainingSec);
        lastTickSecRef.current = null;
        zeroPlayedRef.current = false;
      }
    };

    syncTime();
    if (!talentState.timerRunning) return;
    const id = window.setInterval(syncTime, 250);
    return () => window.clearInterval(id);
  }, [
    talentState.timerRunning,
    talentState.timerEndsAt,
    talentState.timerRemainingSec,
    clockOffsetMs,
  ]);

  const entries = talentState.entries;
  const activeEntry: TalentPublicEntryView | undefined =
    entries.find((e) => e.id === talentState.activeEntryId) || entries[0];
  const issuedCertificates = certificates || talentState.certificates || [];

  return (
    <div className="space-y-6">
      {/* Stage Masthead */}
      <div className="bg-[#111A2E] border border-amber-400/35 rounded-3xl p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-300">
            Talentos Juveniles · Sociedad de Jóvenes
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white text-balance">
            {talentState.programTitle}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300">
            1 Pedro 4:10 · Cada uno según el don que ha recibido, minístrelo a los otros
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-[#080E1E] border border-slate-800 text-xs sm:text-sm text-slate-200 font-semibold">
            {talentState.currentScreen === 'waiting'
              ? 'Pantalla de Espera'
              : talentState.currentScreen === 'presentation'
                ? 'Presentación en Escenario'
                : 'Reconocimiento Final'}
          </div>
          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-4 h-4" />
                  Salir de Pantalla Grande
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4" />
                  Pantalla Completa
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 1. PANTALLA DE ESPERA */}
      {talentState.currentScreen === 'waiting' && (
        <div
          key={`wait-${talentState.openingNonce}`}
          className="animate-talent-curtain grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
        >
          <div className={`${qrSlot ? 'lg:col-span-5' : 'lg:col-span-4'} space-y-4`}>
            <div className="bg-[#111A2E] border border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-400/15 text-amber-300 flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="font-display text-2xl font-extrabold text-white text-balance">
                ¡Bienvenidos a Nuestra Noche de Talentos!
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Un espacio preparado con reverencia, gozo y compañerismo para que los jóvenes descubran, desarrollen y compartan los dones que Dios ha puesto en sus vidas.
              </p>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Dirección: {talentState.directorName}</span>
                <span className="font-mono-num font-bold text-amber-300">
                  {entries.length} presentaciones
                </span>
              </div>
            </div>
            {qrSlot}
          </div>

          <div className={`${qrSlot ? 'lg:col-span-7' : 'lg:col-span-8'} bg-[#111A2E] border border-slate-800 rounded-3xl p-6 space-y-4`}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-xl font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-sky-400" />
                Orden de Participación
              </h3>
              <span className="text-xs text-slate-400">
                Preparando escenario
              </span>
            </div>

            {entries.length === 0 ? (
              <div className="py-16 text-center border border-dashed border-slate-800 rounded-2xl text-slate-400 text-sm">
                El director está registrando las presentaciones de esta jornada.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {entries.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className={`bg-[#080E1E] border rounded-2xl p-4 space-y-1.5 ${
                      entry.id === talentState.activeEntryId
                        ? 'border-amber-400/70'
                        : 'border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span
                        className="font-bold"
                        style={{ color: entry.categoryColor }}
                      >
                        #{idx + 1} · {entry.categoryLabel}
                      </span>
                      <span className="font-mono-num text-slate-400">
                        {formatClock(entry.durationSec)}
                      </span>
                    </div>
                    <p className="font-display font-bold text-base text-white truncate">
                      {entry.presentationTitle}
                    </p>
                    <p className="text-xs text-slate-300 truncate">
                      {entry.publicName}
                    </p>
                    {entry.description && (
                      <p className="text-xs text-slate-400 line-clamp-2">
                        {entry.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. PANTALLA DE PRESENTACIÓN */}
      {talentState.currentScreen === 'presentation' && (
        <div
          key={`pres-${talentState.openingNonce}-${activeEntry?.id || 'none'}`}
          className="animate-talent-reveal space-y-6"
        >
          {!activeEntry ? (
            <div className="bg-[#111A2E] border border-slate-800 rounded-3xl p-12 text-center space-y-3">
              <p className="font-display text-2xl font-bold text-white">
                Escenario Listo
              </p>
              <p className="text-sm text-slate-400">
                Selecciona una presentación desde el panel de dirección para anunciarla aquí.
              </p>
            </div>
          ) : (
            <div className="bg-[#111A2E] border-2 rounded-3xl p-6 sm:p-10 space-y-6 shadow-2xl" style={{ borderColor: activeEntry.categoryColor }}>
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div className="space-y-1">
                  <p
                    className="text-sm font-bold uppercase tracking-wider"
                    style={{ color: activeEntry.categoryColor }}
                  >
                    Presentación #{activeEntry.orderIndex + 1} de {entries.length} ·{' '}
                    {activeEntry.categoryLabel}
                  </p>
                  <h3 className="font-display text-3xl sm:text-5xl font-extrabold text-white text-balance">
                    {activeEntry.presentationTitle}
                  </h3>
                  <p className="text-lg sm:text-2xl font-semibold text-amber-300">
                    {activeEntry.publicName}
                  </p>
                </div>

                {/* Live Stage Timer */}
                <div className="bg-[#080E1E] border border-slate-700 rounded-2xl px-6 py-4 text-center min-w-[165px]">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-300" />
                    {talentState.timerRunning ? 'Tiempo en Curso' : 'Cronómetro'}
                  </p>
                  <p
                    className={`font-mono-num text-4xl sm:text-5xl font-extrabold mt-1 ${
                      liveRemainingSec <= 10 && talentState.timerRunning
                        ? 'text-amber-300'
                        : 'text-white'
                    }`}
                  >
                    {formatClock(liveRemainingSec)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                <div
                  className={`${
                    activeEntry.authorizedMediaUrl ? 'lg:col-span-7' : 'lg:col-span-12'
                  } space-y-4`}
                >
                  {activeEntry.description && (
                    <p className="text-base sm:text-xl text-slate-200 leading-relaxed">
                      {activeEntry.description}
                    </p>
                  )}
                  {activeEntry.verseReference && (
                    <div className="inline-flex items-center gap-2 text-sm sm:text-base font-semibold text-sky-300 bg-[#080E1E] border border-slate-800 rounded-xl px-4 py-2.5">
                      <BookOpen className="w-4 h-4 shrink-0" />
                      Cita bíblica de inspiración: {activeEntry.verseReference}
                    </div>
                  )}
                </div>

                {/* Strict Double-Approved Authorized Photo / Artwork Only */}
                {activeEntry.authorizedMediaUrl && (
                  <div className="lg:col-span-5">
                    <div className="bg-[#080E1E] border border-slate-800 rounded-2xl p-3 space-y-2">
                      <img
                        src={activeEntry.authorizedMediaUrl}
                        alt={
                          activeEntry.mediaCaption ||
                          `Imagen autorizada de ${activeEntry.presentationTitle}`
                        }
                        className="w-full max-h-[320px] object-contain rounded-xl mx-auto"
                      />
                      {activeEntry.mediaCaption && (
                        <p className="text-xs text-center text-slate-400">
                          {activeEntry.mediaCaption}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Respectful Congregation Appreciation Strip */}
              {(talentState.audienceVotingEnabled || activeEntry.praiseCount > 0) && (
                <div className="bg-[#080E1E] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm font-bold text-emerald-300 inline-flex items-center gap-1.5">
                      <HeartHandshake className="w-4 h-4" />
                      {talentState.audienceVotingEnabled
                        ? 'Apreciación del público habilitada en vivo'
                        : 'Apreciación recibida de la congregación'}
                    </span>
                    <span className="font-mono-num text-xs sm:text-sm text-amber-300 font-bold">
                      {activeEntry.praiseCount} muestras de ánimo
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {TALENT_POSITIVE_REACTIONS.map((react) => (
                      <div
                        key={react.id}
                        className="bg-[#111A2E] border border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-xs sm:text-sm"
                      >
                        <span className="text-slate-200 font-medium truncate">
                          {react.label}
                        </span>
                        <span className="font-mono-num font-bold text-amber-300 shrink-0">
                          {activeEntry.reactionBreakdown[react.id] || 0}
                        </span>
                      </div>
                    ))}
                  </div>
                  {activeEntry.curatedMessages.length > 0 && (
                    <p className="text-xs sm:text-sm text-sky-200 italic pt-1">
                      “{activeEntry.curatedMessages[activeEntry.curatedMessages.length - 1]}”
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. PANTALLA DE RECONOCIMIENTO FINAL */}
      {talentState.currentScreen === 'recognition' && (
        <div
          key={`rec-${talentState.openingNonce}`}
          className="animate-talent-curtain space-y-6"
        >
          <div className="bg-[#111A2E] border border-amber-400/50 rounded-3xl p-6 sm:p-8 text-center space-y-2">
            <Award className="w-10 h-10 text-amber-400 mx-auto" />
            <h3 className="font-display text-3xl sm:text-4xl font-extrabold text-white text-balance">
              Reconocimiento y Gratitud a Nuestros Jóvenes
            </h3>
            <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto">
              Cada don compartido hoy edificó a nuestra Sociedad de Jóvenes. Celebramos la dedicación, valentía y servicio de cada participante para la gloria de Dios.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {entries.map((entry, idx) => (
              <div
                key={entry.id}
                className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <p
                      className="text-xs font-bold uppercase tracking-wider"
                      style={{ color: entry.categoryColor }}
                    >
                      Participación #{idx + 1} · {entry.categoryLabel}
                    </p>
                    <h4 className="font-display text-xl font-extrabold text-white truncate">
                      {entry.publicName}
                    </h4>
                    <p className="text-sm font-semibold text-amber-300 truncate">
                      {entry.recognitionTitle}
                    </p>
                  </div>
                  <Award className="w-6 h-6 text-amber-400 shrink-0" />
                </div>

                <p className="text-xs text-slate-300">
                  Presentación: <strong className="text-white">{entry.presentationTitle}</strong>
                </p>

                {entry.directorEncouragementNote && (
                  <p className="text-xs sm:text-sm text-emerald-200 bg-[#080E1E] border border-slate-800 rounded-xl p-3">
                    {entry.directorEncouragementNote}
                  </p>
                )}

                {talentState.privacy.showAudiencePraiseOnFinal &&
                  entry.praiseCount > 0 && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-sky-300 pt-1">
                      <span className="font-semibold">
                        {entry.praiseCount} aplausos de ánimo
                      </span>
                      {TALENT_POSITIVE_REACTIONS.filter(
                        (r) => (entry.reactionBreakdown[r.id] || 0) > 0
                      ).map((r) => (
                        <span key={r.id} className="text-slate-300">
                          {r.label}: {entry.reactionBreakdown[r.id]}
                        </span>
                      ))}
                    </div>
                  )}

                {talentState.privacy.showJuryFeedbackOnScreen &&
                  entry.juryHighlights &&
                  entry.juryHighlights.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-slate-800">
                      {entry.juryHighlights.map((note, jIdx) => (
                        <p key={jIdx} className="text-xs text-slate-300 italic">
                          {note}
                        </p>
                      ))}
                    </div>
                  )}
              </div>
            ))}
          </div>

          {issuedCertificates.length > 0 && (
            <div className="space-y-4 pt-2">
              <h4 className="font-display text-xl font-bold text-white">
                Certificados Digitales Emitidos ({issuedCertificates.length})
              </h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {issuedCertificates.map((cert) => (
                  <TalentCertificateCard
                    key={cert.id}
                    certificate={cert}
                    compact
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
