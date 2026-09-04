import { useState, useEffect } from 'react';
import type { Overlay } from '../types';

interface Props {
  overlay: Overlay;
  isEditor?: boolean;
}

export default function MeltGalleryPlayer({ overlay, isEditor = false }: Props) {
  const images = overlay.carouselImages || [];
  const count = images.length;
  
  const [activeIdx, setActiveIdx] = useState(0);
  const [prevIdx, setPrevIdx] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Default melt duration (transition length) is 2s; hold time is 4s
  const meltDuration = overlay.meltDuration ?? 2;
  const slideDuration = overlay.slideDuration ?? 4;
  const fitMode = overlay.fitMode || 'contain';
  const kenBurns = overlay.kenBurns ?? false;
  const totalDuration = slideDuration + meltDuration;

  // Ensure activeIdx is valid if images are deleted
  useEffect(() => {
    if (activeIdx >= count) {
      setActiveIdx(Math.max(0, count - 1));
      setPrevIdx(null);
    }
  }, [count, activeIdx]);

  // Autoplay cycle with smooth dissolve melt
  useEffect(() => {
    if (count <= 1 || isPaused) return;

    const timer = setTimeout(() => {
      setPrevIdx(activeIdx);
      setActiveIdx(current => (current + 1) % count);
    }, slideDuration * 1000);

    return () => clearTimeout(timer);
  }, [activeIdx, isPaused, count, slideDuration]);

  // Clean up outgoing slide after the melt transition finishes
  useEffect(() => {
    if (prevIdx === null) return;
    const cleanTimer = setTimeout(() => {
      setPrevIdx(null);
    }, meltDuration * 1000);
    return () => clearTimeout(cleanTimer);
  }, [prevIdx, meltDuration]);

  const handleGoTo = (idx: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (idx === activeIdx || idx < 0 || idx >= count) return;
    setPrevIdx(activeIdx);
    setActiveIdx(idx);
  };

  const handleNext = (e?: React.MouseEvent) => {
    if (count <= 1) return;
    if (e) e.stopPropagation();
    setPrevIdx(activeIdx);
    setActiveIdx(c => (c + 1) % count);
  };

  if (count === 0) {
    return null;
  }

  // Single image case: render directly with optional gentle breathe if Ken Burns enabled
  if (count === 1) {
    return (
      <div className="w-full h-full relative overflow-hidden select-none">
        <style>{`
          @keyframes kenburns-single {
            0% { transform: scale(1); }
            50% { transform: scale(1.035); }
            100% { transform: scale(1); }
          }
        `}</style>
        <img
          src={images[0]}
          alt="Gallery Slide"
          className="w-full h-full pointer-events-none"
          style={{
            objectFit: fitMode,
            borderRadius: `${overlay.borderRadius ?? 0}px`,
            transformOrigin: 'center center',
            animation: kenBurns ? 'kenburns-single 12s ease-in-out infinite' : 'none',
            willChange: kenBurns ? 'transform' : undefined,
          }}
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div
      className="w-full h-full relative overflow-hidden select-none group cursor-pointer"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onClick={handleNext}
      title={isEditor ? undefined : 'Click to advance slide'}
    >
      <style>{`
        @keyframes kenburns-drift {
          0% { transform: scale(1); }
          100% { transform: scale(1.035); }
        }
      `}</style>

      {/* Stacked Images for Pure Dissolve Melt */}
      {images.map((img, idx) => {
        const isCurrent = idx === activeIdx;
        const isPrev = idx === prevIdx;
        const isActiveOrPrev = isCurrent || isPrev;

        let zIndex = 0;
        let opacity = 0;

        if (isCurrent) {
          zIndex = 2;
          opacity = 1;
        } else if (isPrev) {
          zIndex = 1;
          opacity = 0; // Smoothly fades out to 0 so outgoing slide never sticks out underneath
        }

        const transition = `opacity ${meltDuration}s cubic-bezier(0.4, 0, 0.2, 1)`;
        const animation = kenBurns && isActiveOrPrev
          ? `kenburns-drift ${totalDuration}s ease-out forwards`
          : 'none';
        const animationPlayState = isPaused || isPrev ? 'paused' : 'running';

        return (
          <div
            key={`${img}-${idx}`}
            className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none overflow-hidden"
            style={{
              zIndex,
              opacity,
              transition,
              visibility: isActiveOrPrev ? 'visible' : 'hidden',
            }}
          >
            <img
              src={img}
              alt={`Slide ${idx + 1}`}
              className="w-full h-full pointer-events-none"
              style={{
                objectFit: fitMode,
                borderRadius: `${overlay.borderRadius ?? 0}px`,
                transformOrigin: 'center center',
                animation,
                animationPlayState,
                willChange: kenBurns ? 'transform, opacity' : 'opacity',
              }}
              draggable={false}
            />
          </div>
        );
      })}

      {/* Elegant minimalist bottom indicators */}
      <div
        className={`absolute bottom-2.5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10 transition-opacity duration-300 ${
          isEditor ? 'opacity-90' : 'opacity-0 group-hover:opacity-100'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {images.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={(e) => handleGoTo(idx, e)}
            className={`transition-all duration-300 rounded-full ${
              idx === activeIdx
                ? 'w-4 h-1.5 bg-accent'
                : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/70'
            }`}
            aria-label={`Slide ${idx + 1}`}
          />
        ))}
      </div>

      {/* Subtle editor indicator */}
      {isEditor && (
        <div className="absolute top-2 right-2 z-10 bg-black/60 backdrop-blur-sm text-white/90 text-[10px] font-medium px-2 py-0.5 rounded-full border border-white/10 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          {activeIdx + 1} / {count}
          {kenBurns && <span className="text-[9px] text-accent/80 font-normal">KB</span>}
        </div>
      )}
    </div>
  );
}
