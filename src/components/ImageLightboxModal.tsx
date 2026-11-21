import { useEffect, useState } from 'react';
import { RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useChat } from '../lib/useChatClient.tsx';

export function ImageLightboxModal() {
  const { lightboxImage, closeImageLightbox } = useChat();
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setZoom(1);
  }, [lightboxImage?.src]);

  useEffect(() => {
    if (!lightboxImage) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeImageLightbox();
      } else if (e.key === '+' || e.key === '=') {
        setZoom((z) => Math.min(3, Number((z + 0.5).toFixed(2))));
      } else if (e.key === '-') {
        setZoom((z) => Math.max(1, Number((z - 0.5).toFixed(2))));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxImage, closeImageLightbox]);

  if (!lightboxImage) return null;

  return (
    <div
      data-testid="image-lightbox-modal"
      role="dialog"
      aria-modal="true"
      aria-label={lightboxImage.alt || 'معاينة الصورة'}
      onClick={closeImageLightbox}
      className="fixed inset-0 z-[70] flex flex-col bg-black/92 backdrop-blur-sm animate-in fade-in"
    >
      {/* Top Facebook-style gallery bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-black/60 px-4 py-2.5 text-white"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white/90">
            {lightboxImage.alt || 'عرض الصورة'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            data-action="lightbox-zoom-out"
            disabled={zoom <= 1}
            onClick={() => setZoom((z) => Math.max(1, Number((z - 0.5).toFixed(2))))}
            title="تصغير"
            aria-label="تصغير"
            className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-35 transition cursor-pointer"
          >
            <ZoomOut className="size-4" />
          </button>

          <span className="min-w-[3.2rem] text-center font-mono text-xs text-white/80 tabular-nums">
            {Math.round(zoom * 100)}%
          </span>

          <button
            type="button"
            data-action="lightbox-zoom-in"
            disabled={zoom >= 3}
            onClick={() => setZoom((z) => Math.min(3, Number((z + 0.5).toFixed(2))))}
            title="تكبير"
            aria-label="تكبير"
            className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-35 transition cursor-pointer"
          >
            <ZoomIn className="size-4" />
          </button>

          {zoom > 1 && (
            <button
              type="button"
              data-action="lightbox-zoom-reset"
              onClick={() => setZoom(1)}
              title="الحجم الأصلي"
              aria-label="الحجم الأصلي"
              className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition cursor-pointer"
            >
              <RotateCcw className="size-4" />
            </button>
          )}

          <button
            type="button"
            data-action="close-lightbox"
            onClick={closeImageLightbox}
            title="إغلاق"
            aria-label="إغلاق معرض الصورة"
            className="ms-1 flex size-9 items-center justify-center rounded-full bg-white/15 text-white hover:bg-destructive hover:text-white transition cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      {/* Main Centered Photo Stage */}
      <div className="flex flex-1 min-h-0 items-center justify-center overflow-auto p-3 sm:p-6">
        <img
          src={lightboxImage.src}
          alt={lightboxImage.alt || 'صورة مكبّرة'}
          onClick={(e) => {
            e.stopPropagation();
            setZoom((z) => (z === 1 ? 1.75 : 1));
          }}
          style={{
            transform: `scale(${zoom})`,
          }}
          className={`max-h-[84dvh] max-w-[92vw] rounded-lg object-contain shadow-2xl transition-transform duration-200 select-none ${
            zoom > 1 ? 'cursor-zoom-out' : 'cursor-zoom-in'
          }`}
        />
      </div>
    </div>
  );
}
