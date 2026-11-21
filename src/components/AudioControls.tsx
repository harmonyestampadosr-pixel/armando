import { useEffect, useRef, useState } from 'react';
import {
  Music,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AudioManagerSnapshot, soundFX } from '../utils/sound';

interface AudioControlsProps {
  compact?: boolean;
}

export function AudioControls({ compact = false }: AudioControlsProps) {
  const [snap, setSnap] = useState<AudioManagerSnapshot>(() =>
    soundFX.getSnapshot()
  );
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return soundFX.subscribe(setSnap);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const { prefs, autoplayBlocked, isMusicPlaying } = snap;
  const allMuted = !prefs.musicEnabled && !prefs.sfxEnabled;

  return (
    <div ref={containerRef} className="relative flex items-center gap-1.5 shrink-0">
      {autoplayBlocked && (
        <button
          type="button"
          onClick={() => void soundFX.unlockAudio()}
          className="px-2.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
          title="Tu navegador requiere un toque para iniciar la música y los sonidos"
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>Activar audio</span>
        </button>
      )}

      <button
        type="button"
        onClick={() => {
          if (autoplayBlocked) {
            void soundFX.unlockAudio();
            return;
          }
          soundFX.toggleMusic();
        }}
        aria-pressed={prefs.musicEnabled}
        title={
          prefs.musicEnabled
            ? 'Desactivar música ambiental'
            : 'Activar música ambiental'
        }
        className={`px-2.5 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
          prefs.musicEnabled
            ? isMusicPlaying
              ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/25'
              : 'bg-slate-900 border-slate-700 text-sky-300 hover:border-slate-500'
            : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
        }`}
      >
        <Music className="w-3.5 h-3.5 shrink-0" />
        {!compact && (
          <span className="hidden sm:inline">
            {prefs.musicEnabled ? 'Música' : 'Sin música'}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Configuración de audio"
        title="Configurar audio y volúmenes"
        className={`p-2 rounded-xl border text-xs inline-flex items-center gap-1 transition-colors cursor-pointer ${
          open
            ? 'bg-slate-800 border-amber-400/60 text-amber-300'
            : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:border-slate-500'
        }`}
      >
        {allMuted ? (
          <VolumeX className="w-4 h-4 text-rose-400" />
        ) : (
          <SlidersHorizontal className="w-4 h-4" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-[#111A2E] border border-slate-700 rounded-2xl p-4 shadow-2xl z-50 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-amber-400" />
              <h3 className="font-display font-bold text-sm text-white">
                Configuración de Audio
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">Solo en tu dispositivo</span>
          </div>

          {autoplayBlocked && (
            <button
              type="button"
              onClick={() => void soundFX.unlockAudio()}
              className="w-full py-2 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Activar reproducción de audio
            </button>
          )}

          {/* Master Volume */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="audio-master-vol" className="font-medium text-slate-200">
                Volumen general
              </label>
              <span className="font-mono-num text-amber-300 font-semibold">
                {Math.round(prefs.masterVolume * 100)}%
              </span>
            </div>
            <input
              id="audio-master-vol"
              type="range"
              min={0}
              max={100}
              value={Math.round(prefs.masterVolume * 100)}
              onChange={(e) =>
                soundFX.updatePrefs({ masterVolume: Number(e.target.value) / 100 })
              }
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>

          {/* Music Toggle + Volume */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-200">
                Música de bienvenida
              </span>
              <button
                type="button"
                onClick={() => soundFX.toggleMusic()}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                  prefs.musicEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {prefs.musicEnabled ? 'Activada' : 'Desactivada'}
              </button>
            </div>
            <div className="flex items-center gap-2.5">
              <input
                aria-label="Volumen de música"
                type="range"
                min={0}
                max={100}
                disabled={!prefs.musicEnabled}
                value={Math.round(prefs.musicVolume * 100)}
                onChange={(e) =>
                  soundFX.updatePrefs({ musicVolume: Number(e.target.value) / 100 })
                }
                className="flex-1 accent-sky-400 cursor-pointer disabled:opacity-40"
              />
              <span className="font-mono-num text-[11px] text-slate-400 w-9 text-right">
                {Math.round(prefs.musicVolume * 100)}%
              </span>
            </div>
          </div>

          {/* SFX Toggle + Volume */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-200">
                Efectos de sonido (rondas y tiempo)
              </span>
              <button
                type="button"
                onClick={() => soundFX.toggleSfx()}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                  prefs.sfxEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {prefs.sfxEnabled ? 'Activados' : 'Desactivados'}
              </button>
            </div>
            <div className="flex items-center gap-2.5">
              <input
                aria-label="Volumen de efectos"
                type="range"
                min={0}
                max={100}
                disabled={!prefs.sfxEnabled}
                value={Math.round(prefs.sfxVolume * 100)}
                onChange={(e) =>
                  soundFX.updatePrefs({ sfxVolume: Number(e.target.value) / 100 })
                }
                className="flex-1 accent-amber-400 cursor-pointer disabled:opacity-40"
              />
              <span className="font-mono-num text-[11px] text-slate-400 w-9 text-right">
                {Math.round(prefs.sfxVolume * 100)}%
              </span>
            </div>
          </div>

          {/* Didactic Game SFX + Ambient Toggle + Independent Volume */}
          <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-200">
                Sonidos didácticos de juegos
              </span>
              <button
                type="button"
                onClick={() => soundFX.toggleDidacticSfx()}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                  prefs.didacticSfxEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {prefs.didacticSfxEnabled ? 'Activados' : 'Desactivados'}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-200">
                Ambiente estudio y misterio
              </span>
              <button
                type="button"
                onClick={() => soundFX.toggleDidacticAmbient()}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                  prefs.didacticAmbientEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {prefs.didacticAmbientEnabled ? 'Activado' : 'Desactivado'}
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              <input
                aria-label="Volumen de sonidos didácticos y ambiente"
                type="range"
                min={0}
                max={100}
                disabled={
                  !prefs.didacticSfxEnabled && !prefs.didacticAmbientEnabled
                }
                value={Math.round(prefs.didacticVolume * 100)}
                onChange={(e) =>
                  soundFX.updatePrefs({
                    didacticVolume: Number(e.target.value) / 100,
                  })
                }
                className="flex-1 accent-teal-400 cursor-pointer disabled:opacity-40"
              />
              <span className="font-mono-num text-[11px] text-slate-400 w-9 text-right">
                {Math.round(prefs.didacticVolume * 100)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
