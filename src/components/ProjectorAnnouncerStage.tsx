import { useEffect, useMemo, useRef, useState } from 'react';
import { Crown, HeartHandshake, Lock, Medal, Mic, Sparkles, Trophy, Volume2 } from 'lucide-react';
import { buildAnnouncerPlan } from '../shared/announcerEngine';
import {
  createDefaultAnnouncerConfig,
  type AnnouncerCue,
  type AnnouncerStage,
} from '../shared/announcerTypes';
import type { GameRoomClientState, LeaderboardEntry } from '../shared/types';
import {
  announcerAudio,
  shouldPlayAudioHere,
  type AnnouncerPlaybackStatus,
} from '../utils/announcerAudio';
import { AvatarBadge } from './AvatarBadge';

interface ProjectorAnnouncerStageProps {
  state: GameRoomClientState;
  renderFullSummary: () => React.ReactNode;
}

function ProgressiveRankCard({
  rankLabel,
  entries,
  revealed,
  isHighlighted,
  accent,
}: {
  rankLabel: string;
  entries: LeaderboardEntry[];
  revealed: boolean;
  isHighlighted: boolean;
  accent: 'gold' | 'silver' | 'bronze';
}) {
  const borderClass = !revealed
    ? 'border-slate-800 bg-[#0D1528]/90'
    : accent === 'gold'
      ? isHighlighted
        ? 'border-amber-400 bg-[#1B2748] shadow-2xl shadow-amber-500/20 scale-[1.03]'
        : 'border-amber-400/70 bg-[#182340]'
      : accent === 'silver'
        ? isHighlighted
          ? 'border-sky-300 bg-[#16223D] shadow-xl shadow-sky-400/15 scale-[1.02]'
          : 'border-slate-500 bg-[#131D35]'
        : isHighlighted
          ? 'border-amber-500 bg-[#17213B] shadow-xl shadow-amber-600/15 scale-[1.02]'
          : 'border-slate-700 bg-[#131D35]';

  const Icon = accent === 'gold' ? Trophy : Medal;
  const iconColor =
    accent === 'gold'
      ? 'text-amber-400'
      : accent === 'silver'
        ? 'text-slate-300'
        : 'text-amber-500';

  if (!revealed) {
    return (
      <div
        className={`rounded-2xl border p-6 text-center flex flex-col items-center justify-center gap-3 min-h-[220px] transition-all duration-500 ${borderClass}`}
      >
        <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400">
          <Lock className="w-5 h-5" />
        </div>
        <p className="font-display font-bold text-base text-slate-300">
          {rankLabel}
        </p>
        <p className="text-xs text-slate-500">Por revelar...</p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border p-6 text-center flex flex-col items-center justify-center gap-3 transition-all duration-500 ${
        accent === 'gold' ? 'min-h-[270px]' : 'min-h-[225px]'
      } ${borderClass}`}
    >
      <div
        className={`flex items-center gap-2 text-sm font-bold ${
          accent === 'gold'
            ? 'text-amber-300 text-base'
            : accent === 'silver'
              ? 'text-slate-200'
              : 'text-amber-400'
        }`}
      >
        <Icon className={`w-5 h-5 ${iconColor}`} />
        {entries.length > 1 ? `Empate · ${rankLabel}` : rankLabel}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4">
        {entries.map((entry) => (
          <div
            key={entry.participantId}
            className="flex flex-col items-center gap-2"
          >
            <div className="relative">
              <AvatarBadge
                avatarId={entry.avatarId}
                photoUrl={entry.photoUrl}
                name={entry.name}
                size={accent === 'gold' ? 'xl' : 'lg'}
              />
              {accent === 'gold' && (
                <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-md">
                  <Crown className="w-4 h-4" />
                </span>
              )}
            </div>
            <p
              className={`font-display font-extrabold text-white ${
                accent === 'gold' ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl'
              }`}
            >
              {entry.name}
            </p>
          </div>
        ))}
      </div>

      {entries[0] && (
        <div>
          <p
            className={`font-mono-num font-extrabold ${
              accent === 'gold'
                ? 'text-3xl text-amber-300'
                : accent === 'silver'
                  ? 'text-2xl text-slate-200'
                  : 'text-2xl text-amber-200'
            }`}
          >
            {entries[0].score.toLocaleString('es-CO')} pts
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {entries[0].correctCount} correctas · {entries[0].accuracyPercent}% precisión
          </p>
        </div>
      )}
    </div>
  );
}

export function ProjectorAnnouncerStage({
  state,
  renderFullSummary,
}: ProjectorAnnouncerStageProps) {
  const [playbackStatus, setPlaybackStatus] = useState<AnnouncerPlaybackStatus>(
    () => announcerAudio.getStatus()
  );
  const lastPlayedCueKeyRef = useRef<string | null>(null);

  useEffect(() => {
    return announcerAudio.subscribe(() => {
      setPlaybackStatus(announcerAudio.getStatus());
    });
  }, []);

  const announcerState = state.announcerState;
  const config = announcerState?.config || createDefaultAnnouncerConfig();
  const ceremonyRunId = announcerState?.ceremonyRunId || '';
  const variationSeed = announcerState?.ceremonyVariationSeed || 0;

  const plan = useMemo(() => {
    if (!ceremonyRunId) return null;
    return buildAnnouncerPlan({
      leaderboard: state.leaderboard,
      config,
      gameTitle: state.config.title,
      ceremonyRunId,
      variationSeed,
    });
  }, [state.leaderboard, config, state.config.title, ceremonyRunId, variationSeed]);

  // Apply config updates live (volume, mute, music toggle)
  useEffect(() => {
    announcerAudio.applyConfig(config);
  }, [config]);

  // Stop projector announcer audio immediately if game resets or unmounts
  useEffect(() => {
    if (state.status !== 'finished') {
      lastPlayedCueKeyRef.current = null;
      announcerAudio.stopAll();
    }
  }, [state.status]);

  useEffect(() => {
    return () => {
      announcerAudio.stopAll();
    };
  }, []);

  // Synchronized Projector audio playback triggered exclusively by authoritative room cue index
  useEffect(() => {
    if (
      state.status !== 'finished' ||
      !announcerState ||
      !plan ||
      !config.enabled ||
      !ceremonyRunId
    ) {
      return;
    }

    const activeIdx = announcerState.activeCueIndex;
    if (activeIdx < 0 || activeIdx >= plan.cues.length) {
      if (announcerState.stage === 'complete') {
        announcerAudio.stopSuspenseMusic();
      }
      return;
    }

    const playHere = shouldPlayAudioHere({
      role: 'projector',
      audioTarget: config.audioTarget,
      projectorConnectedCount: state.projectorConnectedCount ?? 1,
    });

    if (!playHere) return;

    const cueKey = `${ceremonyRunId}:${activeIdx}`;
    if (lastPlayedCueKeyRef.current === cueKey) return;
    lastPlayedCueKeyRef.current = cueKey;

    const cue = plan.cues[activeIdx];
    void announcerAudio.playSynchronizedProjectorCue({
      cue,
      config,
      isStartOfCeremony: activeIdx === 0,
      isEndOfCeremony: activeIdx === plan.cues.length - 1,
    });
  }, [
    state.status,
    announcerState,
    plan,
    config,
    ceremonyRunId,
    state.projectorConnectedCount,
  ]);

  const unlockedSet = useMemo(
    () => new Set<AnnouncerStage>(announcerState?.unlockedStages || []),
    [announcerState?.unlockedStages]
  );

  const stage = announcerState?.stage || 'idle';
  const activeCue: AnnouncerCue | undefined =
    plan &&
    announcerState &&
    announcerState.activeCueIndex >= 0 &&
    announcerState.activeCueIndex < plan.cues.length
      ? plan.cues[announcerState.activeCueIndex]
      : undefined;

  const isProgressiveActive =
    Boolean(config.enabled) &&
    Boolean(config.progressiveReveal) &&
    Boolean(plan) &&
    stage !== 'idle' &&
    stage !== 'complete' &&
    !unlockedSet.has('complete');

  if (!isProgressiveActive) {
    return (
      <div className="space-y-6">
        {activeCue && stage !== 'idle' && stage !== 'complete' && (
          <div className="max-w-4xl mx-auto bg-[#111A2E] border border-amber-400/60 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0">
              <Mic className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Locutor IA · {activeCue.rankLabel}
              </p>
              <p className="text-base sm:text-lg font-medium text-white mt-0.5">
                {activeCue.displayText}
              </p>
            </div>
          </div>
        )}
        {renderFullSummary()}
      </div>
    );
  }

  // Extract cues for progressive podium display
  const thirdCue = plan?.cues.find((c) => c.stage === 'third_place');
  const secondCue = plan?.cues.find((c) => c.stage === 'second_place');
  const firstCue = plan?.cues.find((c) => c.stage === 'first_place');
  const lastCue = plan?.cues.find((c) => c.stage === 'last_place');

  const showThird = unlockedSet.has('third_place') && Boolean(thirdCue);
  const showSecond = unlockedSet.has('second_place') && Boolean(secondCue);
  const showFirst = unlockedSet.has('first_place') && Boolean(firstCue);
  const showLast = unlockedSet.has('last_place') && Boolean(lastCue);

  return (
    <div className="space-y-8 py-4">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 text-amber-300 text-sm font-bold uppercase tracking-widest">
          <Sparkles className="w-4 h-4" />
          Ceremonia Oficial de Resultados
        </div>
        <h2 className="font-display text-4xl sm:text-5xl font-extrabold text-white">
          {state.config.title}
        </h2>
        <p className="text-slate-300 text-base sm:text-lg">
          {state.leaderboard.length} participante(s) ·{' '}
          {playbackStatus.isSpeaking
            ? 'Locutor anunciando en vivo'
            : 'Revelando posiciones oficiales'}
        </p>
      </div>

      {/* Live Spoken Caption Spotlight Banner */}
      {activeCue && (
        <div
          className={`max-w-4xl mx-auto rounded-2xl border p-5 sm:p-6 transition-all duration-300 ${
            stage === 'first_place'
              ? 'bg-[#1D2847] border-amber-400 shadow-2xl shadow-amber-500/15'
              : stage === 'last_place'
                ? 'bg-[#15223C] border-sky-400/70'
                : 'bg-[#111A2E] border-slate-700'
          }`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                stage === 'first_place'
                  ? 'bg-amber-400 text-slate-950'
                  : stage === 'last_place'
                    ? 'bg-sky-400 text-slate-950'
                    : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
              }`}
            >
              {playbackStatus.isSpeaking ? (
                <Volume2 className="w-6 h-6 animate-pulse" />
              ) : (
                <Mic className="w-6 h-6" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                {activeCue.rankLabel}
              </p>
              <p className="font-display text-xl sm:text-2xl font-bold text-white leading-snug">
                {activeCue.displayText}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Progressive Podium Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end max-w-5xl mx-auto pt-2">
        {secondCue ? (
          <div className="order-2 md:order-1">
            <ProgressiveRankCard
              rankLabel="2.º Puesto"
              entries={secondCue.highlightedEntries}
              revealed={showSecond}
              isHighlighted={stage === 'second_place'}
              accent="silver"
            />
          </div>
        ) : (
          <div className="order-2 md:order-1 hidden md:block" />
        )}

        {firstCue && (
          <div className="order-1 md:order-2">
            <ProgressiveRankCard
              rankLabel={
                state.leaderboard.length === 1
                  ? 'Participante Destacado'
                  : '1.º Puesto · Campeón'
              }
              entries={firstCue.highlightedEntries}
              revealed={showFirst}
              isHighlighted={stage === 'first_place'}
              accent="gold"
            />
          </div>
        )}

        {thirdCue ? (
          <div className="order-3">
            <ProgressiveRankCard
              rankLabel="3.º Puesto"
              entries={thirdCue.highlightedEntries}
              revealed={showThird}
              isHighlighted={stage === 'third_place'}
              accent="bronze"
            />
          </div>
        ) : (
          <div className="order-3 hidden md:block" />
        )}
      </div>

      {/* Encouraging Last Place Spotlight Card */}
      {showLast && lastCue && (
        <div
          className={`max-w-3xl mx-auto rounded-2xl border p-6 transition-all duration-500 ${
            stage === 'last_place'
              ? 'bg-[#152441] border-sky-400 shadow-2xl shadow-sky-500/15 scale-[1.01]'
              : 'bg-[#111A2E] border-slate-700'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
              {lastCue.highlightedEntries.map((entry) => (
                <AvatarBadge
                  key={entry.participantId}
                  avatarId={entry.avatarId}
                  photoUrl={entry.photoUrl}
                  name={entry.name}
                  size="lg"
                />
              ))}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-300">
                <HeartHandshake className="w-4 h-4" />
                {lastCue.rankLabel}
              </div>
              <h3 className="font-display text-2xl font-extrabold text-white">
                {lastCue.highlightedEntries.map((e) => e.name).join(' · ')}
                {lastCue.highlightedEntries[0] && (
                  <span className="ml-3 font-mono-num text-lg text-amber-300 font-bold">
                    {lastCue.highlightedEntries[0].score.toLocaleString('es-CO')} pts
                  </span>
                )}
              </h3>
              <p className="text-sm sm:text-base text-slate-200">
                {lastCue.displayText}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
