import { useEffect, useRef, useState } from 'react';
import { Check, ImagePlus, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';

interface PhotoCropperModalProps {
  imageSrc: string;
  onChangePhoto: () => void;
  onCancel: () => void;
  onConfirm: (croppedDataUrl: string) => void;
}

const VIEWPORT_PX = 240;
const OUTPUT_PX = 256;

export function PhotoCropperModal({
  imageSrc,
  onChangePhoto,
  onCancel,
  onConfirm,
}: PhotoCropperModalProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  }>({ active: false, startX: 0, startY: 0, origX: 0, origY: 0 });

  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setNatural(null);
  }, [imageSrc]);

  const baseScale = natural
    ? VIEWPORT_PX / Math.min(natural.w, natural.h)
    : 1;
  const displayW = natural ? natural.w * baseScale * zoom : VIEWPORT_PX;
  const displayH = natural ? natural.h * baseScale * zoom : VIEWPORT_PX;
  const maxX = Math.max(0, (displayW - VIEWPORT_PX) / 2);
  const maxY = Math.max(0, (displayH - VIEWPORT_PX) / 2);

  const clampOffset = (x: number, y: number, mX = maxX, mY = maxY) => ({
    x: Math.max(-mX, Math.min(mX, x)),
    y: Math.max(-mY, Math.min(mY, y)),
  });

  const handleZoomChange = (nextZoom: number) => {
    const clampedZoom = Math.max(1, Math.min(3, nextZoom));
    setZoom(clampedZoom);
    if (natural) {
      const nextW = natural.w * baseScale * clampedZoom;
      const nextH = natural.h * baseScale * clampedZoom;
      const nextMaxX = Math.max(0, (nextW - VIEWPORT_PX) / 2);
      const nextMaxY = Math.max(0, (nextH - VIEWPORT_PX) / 2);
      setOffset((prev) => clampOffset(prev.x, prev.y, nextMaxX, nextMaxY));
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: offset.x,
      origY: offset.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset(clampOffset(dragRef.current.origX + dx, dragRef.current.origY + dy));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current.active) {
      dragRef.current.active = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const handleSave = () => {
    const img = imgRef.current;
    if (!img || !natural) return;
    setSaving(true);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_PX;
      canvas.height = OUTPUT_PX;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setSaving(false);
        return;
      }

      ctx.fillStyle = '#080E1E';
      ctx.fillRect(0, 0, OUTPUT_PX, OUTPUT_PX);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const ratio = OUTPUT_PX / VIEWPORT_PX;
      const drawW = displayW * ratio;
      const drawH = displayH * ratio;
      const drawX = OUTPUT_PX / 2 + offset.x * ratio - drawW / 2;
      const drawY = OUTPUT_PX / 2 + offset.y * ratio - drawH / 2;

      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      let dataUrl = canvas.toDataURL('image/webp', 0.82);
      if (!dataUrl.startsWith('data:image/webp')) {
        dataUrl = canvas.toDataURL('image/jpeg', 0.84);
      }
      onConfirm(dataUrl);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cropper-title"
    >
      <div className="bg-[#111A2E] border border-slate-700 rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2
              id="cropper-title"
              className="font-display text-lg sm:text-xl font-bold text-white"
            >
              Ajustar tu fotografía
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Arrastra para centrar tu rostro dentro del círculo y ajusta el zoom.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cerrar editor de foto"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Circular Interactive Crop Viewport */}
        <div className="flex justify-center">
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="relative overflow-hidden rounded-2xl bg-[#080E1E] border border-slate-700 select-none touch-none cursor-grab active:cursor-grabbing"
            style={{ width: VIEWPORT_PX, height: VIEWPORT_PX }}
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Vista previa para recorte"
              draggable={false}
              onLoad={(e) => {
                const target = e.currentTarget;
                setNatural({
                  w: target.naturalWidth || VIEWPORT_PX,
                  h: target.naturalHeight || VIEWPORT_PX,
                });
              }}
              className="absolute max-w-none pointer-events-none select-none"
              style={{
                width: `${displayW}px`,
                height: `${displayH}px`,
                left: '50%',
                top: '50%',
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
              }}
            />

            {/* Circular guide ring */}
            <div
              className="absolute inset-0 pointer-events-none rounded-full border-2 border-amber-400"
              style={{
                boxShadow: '0 0 0 999px rgba(8, 14, 30, 0.72)',
              }}
            />
          </div>
        </div>

        {/* Zoom & Center Controls */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <ZoomOut className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="range"
              aria-label="Nivel de acercamiento"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => handleZoomChange(Number(e.target.value))}
              className="flex-1 accent-amber-400 cursor-pointer"
            />
            <ZoomIn className="w-4 h-4 text-slate-400 shrink-0" />
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setOffset({ x: 0, y: 0 });
              }}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Centrar
            </button>

            <button
              type="button"
              onClick={onChangePhoto}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-sky-300 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              Cambiar fotografía
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!natural || saving}
            onClick={handleSave}
            className="flex-[1.5] py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            {saving ? 'Optimizando...' : 'GUARDAR Y CONTINUAR'}
          </button>
        </div>
      </div>
    </div>
  );
}
