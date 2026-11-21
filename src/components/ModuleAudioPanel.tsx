import { useEffect, useState } from 'react';
import { Play, Volume2, VolumeX } from 'lucide-react';
import { CONTROL_CENTER_MODULES } from '../shared/controlCenterData';
import {
  moduleSoundController,
  type ModuleAudioChannelId,
  type ModuleAudioPrefsMap,
} from '../utils/sound';

export function ModuleAudioPanel() {
  const [prefs, setPrefs] = useState<ModuleAudioPrefsMap>(() =>
    moduleSoundController.getPrefs()
  );
  const [globalMuted, setGlobalMuted] = useState<boolean>(() =>
    moduleSoundController.isGlobalMuted()
  );

  useEffect(() => {
    return moduleSoundController.subscribe(() => {
      setPrefs(moduleSoundController.getPrefs());
      setGlobalMuted(moduleSoundController.isGlobalMuted());
    });
  }, []);

  return (
    <div className="bg-[#111A2E] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <h2 className="font-display font-bold text-lg text-white">
            Experiencia Sonora Independiente por Módulo
          </h2>
          <p className="text-xs text-slate-400">
            Ajusta el volumen, prueba o silencia cada módulo sin alterar los
            sonidos originales de las partidas.
          </p>
        </div>

        <button
          type="button"
          onClick={() => moduleSoundController.setGlobalMuted(!globalMuted)}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            globalMuted
              ? 'bg-rose-500/20 border-rose-400/50 text-rose-200'
              : 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
          }`}
        >
          {globalMuted ? (
            <VolumeX className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
          {globalMuted
            ? 'Canales de módulo silenciados'
            : 'Audio de módulos activo'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {CONTROL_CENTER_MODULES.map((mod) => {
          const id = mod.id as ModuleAudioChannelId;
          const ch = prefs[id] || { muted: false, volume: 0.8 };
          const pct = Math.round(ch.volume * 100);
          return (
            <div
              key={mod.id}
              className="bg-[#0B1221] border border-white/10 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">
                    {mod.label}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {mod.shortDesc}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => moduleSoundController.playModuleCue(id, 'start')}
                    disabled={globalMuted || ch.muted}
                    className="p-2 rounded-lg bg-[#16213B] border border-white/15 text-amber-300 hover:text-amber-200 disabled:opacity-40 cursor-pointer"
                    title="Probar sonido del módulo"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      moduleSoundController.setModulePref(id, {
                        muted: !ch.muted,
                      })
                    }
                    className={`p-2 rounded-lg border cursor-pointer ${
                      ch.muted
                        ? 'bg-rose-500/20 border-rose-400/40 text-rose-300'
                        : 'bg-emerald-500/15 border-emerald-400/35 text-emerald-300'
                    }`}
                    title={ch.muted ? 'Activar sonido' : 'Silenciar módulo'}
                  >
                    {ch.muted ? (
                      <VolumeX className="w-3.5 h-3.5" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  disabled={ch.muted || globalMuted}
                  value={pct}
                  onChange={(e) =>
                    moduleSoundController.setModulePref(id, {
                      volume: Number(e.target.value) / 100,
                    })
                  }
                  aria-label={`Volumen de ${mod.label}`}
                  className="flex-1 accent-amber-400 cursor-pointer disabled:opacity-40"
                />
                <span className="font-mono-num text-xs text-amber-300 w-10 text-right">
                  {ch.muted ? 'Mute' : `${pct}%`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
