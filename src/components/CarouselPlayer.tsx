import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause, LayoutGrid, GalleryHorizontal } from 'lucide-react';
import type { Overlay } from '../types';

export default function CarouselPlayer({ overlay }: { overlay: Overlay }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoPlay, setAutoPlay] = useState(true);
  const [activeIndex, setActiveIndex] = useState(1);
  const [isGridMode, setIsGridMode] = useState(false);
  const images = overlay.carouselImages || [];
  const count = images.length;
  const isInfinite = count > 1;

  // We clone the last image to the start, and the first image to the end
  const renderImages = isInfinite ? [images[count - 1], ...images, images[0]] : images;
  
  const SLIDE_RATIO = isInfinite ? 0.60 : 1;
  const PAD_PERCENT = isInfinite ? '20%' : '0%';

  // Mouse Drag State
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Set initial scroll to the first REAL image (index 1)
  useEffect(() => {
    if (isInfinite && scrollRef.current) {
      // Use a short timeout to ensure layout is calculated
      setTimeout(() => {
        if (scrollRef.current) {
          const slideWidth = scrollRef.current.clientWidth * SLIDE_RATIO;
          scrollRef.current.scrollTo({ left: slideWidth, behavior: 'instant' as any });
          setActiveIndex(1);
        }
      }, 50);
    } else if (!isInfinite) {
      setActiveIndex(0);
    }
  }, [isInfinite, SLIDE_RATIO]);

  useEffect(() => {
    if (!autoPlay || count <= 1) return;
    
    const interval = setInterval(() => {
      const container = scrollRef.current;
      if (!container) return;
      
      const slideWidth = container.clientWidth * SLIDE_RATIO;
      const currentScroll = container.scrollLeft;
      const currentIndex = Math.round(currentScroll / slideWidth);
      
      let nextIndex = currentIndex + 1;
      
      container.scrollTo({
        left: nextIndex * slideWidth,
        behavior: 'smooth'
      });
    }, 3000); // 3 seconds per slide

    return () => clearInterval(interval);
  }, [autoPlay, count]);

  const handleManualScroll = (direction: 'next' | 'prev') => {
    setAutoPlay(false);
    const container = scrollRef.current;
    if (!container) return;
    
    const slideWidth = container.clientWidth * SLIDE_RATIO;
    const currentScroll = container.scrollLeft;
    const currentIndex = Math.round(currentScroll / slideWidth);
    
    let targetIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    
    container.scrollTo({
      left: targetIndex * slideWidth,
      behavior: 'smooth'
    });
  };

  const handleScroll = () => {
    if (!isInfinite) return;
    const container = scrollRef.current;
    if (!container) return;
    
    const slideWidth = container.clientWidth * SLIDE_RATIO;
    if (slideWidth === 0) return;
    
    const currentScroll = container.scrollLeft;
    const currentIndex = Math.round(currentScroll / slideWidth);
    if (currentIndex !== activeIndex) {
      setActiveIndex(currentIndex);
    }
    
    // Jump from cloned LAST (index 0) to real LAST (index count)
    if (currentScroll <= 1) {
      container.scrollTo({ left: count * slideWidth, behavior: 'instant' as any });
      setActiveIndex(count);
    }
    // Jump from cloned FIRST (index count + 1) to real FIRST (index 1)
    const maxScroll = container.scrollWidth - container.clientWidth;
    if (currentScroll >= maxScroll - 2) { // allowance for subpixel rounding
      container.scrollTo({ left: slideWidth, behavior: 'instant' as any });
      setActiveIndex(1);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const container = scrollRef.current;
    if (!container) return;
    setIsDragging(true);
    setAutoPlay(false);
    container.style.scrollSnapType = 'none'; // Disable snap during drag
    container.style.scrollBehavior = 'auto'; // Disable smooth scroll during drag
    setStartX(e.pageX - container.offsetLeft);
    setScrollLeft(container.scrollLeft);
  };

  const handleMouseLeaveOrUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const container = scrollRef.current;
    if (!container) return;
    
    // Re-enable snapping to snap to the nearest slide
    container.style.scrollSnapType = 'x mandatory';
    container.style.scrollBehavior = 'smooth';
    
    // Force a small scroll tick to trigger the native snap
    container.scrollBy({ left: 1 });
    container.scrollBy({ left: -1 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const container = scrollRef.current;
    if (!container) return;
    const x = e.pageX - container.offsetLeft;
    const walk = (x - startX) * 1.5; // Drag speed multiplier
    container.scrollLeft = scrollLeft - walk;
  };

  if (count === 0) return null;

  if (isGridMode) {
    return (
      <div className="w-full h-full relative group bg-transparent overflow-hidden flex flex-col pointer-events-auto">
        <style>{`
          /* Hide scrollbar for Chrome, Safari and Opera */
          .hide-scroll::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        <div className="flex-1 w-full overflow-y-auto hide-scroll p-6 pb-20">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 max-w-4xl mx-auto">
            {images.map((img, idx) => (
            <div 
              key={idx} 
              className="aspect-video bg-black/40 rounded-lg overflow-hidden transition-all cursor-pointer flex items-center justify-center hover:scale-[1.02] hover:bg-black/60 shadow-lg" 
              onClick={() => { 
                setIsGridMode(false); 
                setActiveIndex(idx + 1); 
                setAutoPlay(false);
                setTimeout(() => {
                  if (scrollRef.current) {
                    const slideWidth = scrollRef.current.clientWidth * SLIDE_RATIO;
                    scrollRef.current.scrollTo({ left: (idx + 1) * slideWidth, behavior: 'instant' as any });
                  }
                }, 50);
              }}
            >
              <img src={img} className="w-full h-full object-contain" draggable={false} />
            </div>
          ))}
          </div>
        </div>
        
        {/* Controls Bar for Grid Mode */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 pointer-events-auto">
          <button
            onClick={(e) => { e.stopPropagation(); setIsGridMode(false); }}
            className="text-white hover:text-accent transition-colors flex items-center gap-1.5 text-xs font-semibold"
            title="Carousel Mode"
          >
            <GalleryHorizontal size={14} /> Slide Mode
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="w-full h-full relative group"
      onPointerDown={() => setAutoPlay(false)}
      onTouchStart={() => setAutoPlay(false)}
    >
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeaveOrUp}
        onMouseUp={handleMouseLeaveOrUp}
        onMouseMove={handleMouseMove}
        className={`w-full h-full flex overflow-x-auto snap-x snap-mandatory hide-scroll items-center ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', paddingLeft: PAD_PERCENT, paddingRight: PAD_PERCENT }}
      >
        <style>{`
          /* Hide scrollbar for Chrome, Safari and Opera */
          .hide-scroll::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        {renderImages.map((img, idx) => {
          let isActive = idx === activeIndex;
          if (activeIndex === 1 && idx === count + 1) isActive = true;
          if (activeIndex === count + 1 && idx === 1) isActive = true;
          if (activeIndex === count && idx === 0) isActive = true;
          if (activeIndex === 0 && idx === count) isActive = true;
          
          return (
            <div key={idx} className={`flex-none w-full h-full snap-center px-2 flex items-center justify-center`}>
              <img 
                src={img} 
                alt={`Slide ${idx}`} 
                className={`w-full h-full pointer-events-none transition-all duration-500 origin-center ${isActive ? 'scale-100 opacity-100 blur-none' : 'scale-[0.80] opacity-40 blur-[4px]'}`} 
                style={{ objectFit: overlay.fitMode || 'contain' }} 
                draggable={false} 
              />
            </div>
          );
        })}
      </div>
      {/* Controls Bar */}
      {count > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 pointer-events-auto">
          <button
            onClick={(e) => { e.stopPropagation(); setAutoPlay(!autoPlay); }}
            className={`transition-colors ${autoPlay ? 'text-accent' : 'text-white/70 hover:text-white'}`}
            title={autoPlay ? 'Pause Auto-Scroll' : 'Start Auto-Scroll'}
          >
            {autoPlay ? <Pause size={14} /> : <Play size={14} />}
          </button>
          
          <div className="w-px h-3 bg-white/20" />
          
          <button
            onClick={(e) => { e.stopPropagation(); setIsGridMode(true); }}
            className="text-white/70 hover:text-white transition-colors"
            title="Grid Mode"
          >
            <LayoutGrid size={14} />
          </button>
        </div>
      )}

      {/* Ghost Arrows */}
      {count > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); handleManualScroll('prev'); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-black/20 hover:bg-black/50 text-white/50 hover:text-white opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm pointer-events-auto"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleManualScroll('next'); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-black/20 hover:bg-black/50 text-white/50 hover:text-white opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm pointer-events-auto"
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}
    </div>
  );
}
