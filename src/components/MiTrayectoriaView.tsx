import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BookOpen,
  Crown,
  Flame,
  Lock,
  Puzzle,
  Shield,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';
import { TRAJECTORY_LEVELS } from '../shared/biblicalModulesData';
import { PlayerTrajectoryProfile } from '../shared/expansionTypes';
import { getOrCreateProfileKey } from '../utils/profileKey';
import { AvatarBadge } from './AvatarBadge';

const BADGE_ICON_MAP: Record<string, typeof Trophy> = {
  trophy: Trophy,
  crown: Crown,
  book: BookOpen,
  flame: Flame,
  users: Users,
  swords: Swords,
  shield: Shield,
  award: Award,
  puzzle: Puzzle,
};

interface ProfileSummaryItem {
  profileKey: string;
  displayName: string;
  avatarId: string;
  totalPoints: number;
  totalGamesPlayed: number;
  totalWins: number;
}

export function MiTrayectoriaView({ onBack }: { onBack: () => void }) {
  const localKey = getOrCreateProfileKey();
  const [activeKey, setActiveKey] = useState(localKey);
  const [profile, setProfile] = useState<PlayerTrajectoryProfile | null>(null);
  const [allProfiles, setAllProfiles] = useState<ProfileSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/expansion/trajectory/${encodeURIComponent(activeKey)}`).then((r) => r.json()),
      fetch('/api/expansion/profiles').then((r) => r.json()),
    ])
      .then(([traj, profs]) => {
        setProfile(traj.profile || null);
        setAllProfiles(profs.profiles || []);
      })
      .finally(() => setLoading(false));
  }, [activeKey]);

  const pctToNext = (() => {
    if (!profile) return 0;
    const lvl = profile.level;
    if (!lvl.nextPoints) return 100;
    const span = lvl.nextPoints - lvl.minPoints;
    const gained = profile.totalPoints - lvl.minPoints;
    return Math.max(4, Math.min(100, Math.round((gained / span) * 100)));
  })();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
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
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
            <Award className="w-4 h-4" />
            Progreso Oficial Verificado por el Servidor
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white">
            Mi Trayectoria, Niveles y Medallas
          </h1>
          <p className="text-slate-400 text-sm">
            Tus medallas y nivel avanzan automáticamente con victorias, aciertos reales y retos superados.
          </p>
        </div>

        {allProfiles.length > 0 && (
          <select
            aria-label="Cambiar perfil consultado"
            value={activeKey}
            onChange={(e) => setActiveKey(e.target.value)}
            className="bg-[#111A2E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white max-w-xs"
          >
            <option value={localKey}>Mi perfil en este dispositivo</option>
            {allProfiles
              .filter((p) => p.profileKey !== localKey)
              .map((p) => (
                <option key={p.profileKey} value={p.profileKey}>
                  {p.displayName} ({p.totalPoints.toLocaleString('es-CO')} pts)
                </option>
              ))}
          </select>
        )}
      </div>

      {loading || !profile ? (
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-10 text-center text-slate-400">
          Cargando trayectoria bíblica...
        </div>
      ) : (
        <div className="space-y-6">
          {/* Level Card */}
          <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <AvatarBadge avatarId={profile.avatarId} name={profile.displayName} size="xl" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: profile.level.color }}>
                    Nivel Actual · {profile.level.name}
                  </p>
                  <h2 className="font-display text-2xl font-extrabold text-white">
                    {profile.displayName}
                  </h2>
                  <p className="text-sm text-slate-400 font-mono-num">
                    {profile.totalPoints.toLocaleString('es-CO')} puntos acumulados
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-[#080E1E] border border-slate-800 rounded-xl px-4 py-2.5">
                  <p className="font-mono-num text-xl font-extrabold text-amber-300">
                    {profile.totalWins}
                  </p>
                  <p className="text-[11px] text-slate-400">Victorias</p>
                </div>
                <div className="bg-[#080E1E] border border-slate-800 rounded-xl px-4 py-2.5">
                  <p className="font-mono-num text-xl font-extrabold text-emerald-300">
                    {profile.totalGamesPlayed}
                  </p>
                  <p className="text-[11px] text-slate-400">Partidas</p>
                </div>
                <div className="bg-[#080E1E] border border-slate-800 rounded-xl px-4 py-2.5">
                  <p className="font-mono-num text-xl font-extrabold text-sky-300">
                    {profile.bestStreak}
                  </p>
                  <p className="text-[11px] text-slate-400">Mejor racha</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Progreso de nivel</span>
                <span className="font-mono-num">
                  {profile.level.nextPoints
                    ? `${profile.totalPoints.toLocaleString('es-CO')} / ${profile.level.nextPoints.toLocaleString('es-CO')} pts`
                    : '¡Nivel máximo alcanzado!'}
                </span>
              </div>
              <div className="h-3 bg-[#080E1E] rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pctToNext}%`,
                    backgroundColor: profile.level.color,
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {TRAJECTORY_LEVELS.map((lvl) => {
                  const reached = profile.totalPoints >= lvl.minPoints;
                  return (
                    <span
                      key={lvl.id}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border font-semibold ${
                        reached
                          ? 'bg-[#080E1E] border-slate-600 text-white'
                          : 'bg-[#080E1E]/40 border-slate-800 text-slate-500'
                      }`}
                    >
                      {lvl.name} ({lvl.minPoints.toLocaleString('es-CO')}+)
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 9 Automatic Medals */}
          <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-white">
                Medallas y Logros ({profile.achievements.filter((a) => a.unlocked).length}/
                {profile.achievements.length})
              </h2>
              <span className="text-xs text-slate-400">
                Otorgados automáticamente al cumplir metas reales
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {profile.achievements.map((badge) => {
                const Icon = BADGE_ICON_MAP[badge.icon] || Award;
                const pct = Math.min(
                  100,
                  Math.round((badge.progressCurrent / badge.progressTarget) * 100)
                );
                return (
                  <div
                    key={badge.id}
                    className={`rounded-2xl p-4 border space-y-3 ${
                      badge.unlocked
                        ? 'bg-[#15203A] border-amber-400/60'
                        : 'bg-[#080E1E] border-slate-800 opacity-80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: badge.unlocked
                            ? `${badge.color}28`
                            : '#1E293B',
                          color: badge.unlocked ? badge.color : '#64748B',
                        }}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      {badge.unlocked ? (
                        <span className="text-[11px] font-bold text-emerald-300">
                          Desbloqueada
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          Bloqueada
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-display font-bold text-white text-base">
                        {badge.name}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {badge.conditionText} · {badge.description}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono-num text-slate-400">
                        <span>Progreso</span>
                        <span>
                          {badge.progressCurrent}/{badge.progressTarget}
                        </span>
                      </div>
                      <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: badge.unlocked ? badge.color : '#475569',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
