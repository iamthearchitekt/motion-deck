import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../db/supabase';
import { useDeck, usePages } from '../db/hooks';
import type { Deck, DeckPage, Overlay } from '../types';
import { SLIDE_SIZES } from '../types';
import PageTransitionWrapper from '../components/PageTransitionWrapper';
import PageNavigationControls from '../components/PageNavigationControls';
import CarouselPlayer from '../components/CarouselPlayer';
import MeltGalleryPlayer from '../components/MeltGalleryPlayer';
import { makePlaceholderPage } from '../data/sampleDeck';
import { Box, Play, ChevronRight, ChevronLeft, Maximize, Minimize, X, Check } from 'lucide-react';

function formatUrl(url?: string) {
  if (!url) return '#';
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return 'https://' + url;
  }
  return url;
}

function AutoPlayVideo({ src, poster, style, className, onClick }: { src: string; poster?: string; style?: React.CSSProperties; className?: string; onClick?: (e: React.MouseEvent) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isIntersectingRef = useRef(false);
  const manuallyPausedRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Strict muted flags required by WebKit / iOS Safari for autoplay
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('x5-playsinline', '');

    const playSafe = () => {
      if (!videoRef.current || manuallyPausedRef.current || !isIntersectingRef.current) return;
      videoRef.current.muted = true;
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // If autoplay was rejected (e.g. low power mode or pre-gesture requirement),
          // retry automatically on the very first user interaction (touch/scroll)
          const onFirstInteraction = () => {
            if (videoRef.current && isIntersectingRef.current && !manuallyPausedRef.current) {
              videoRef.current.muted = true;
              videoRef.current.play().catch(() => {});
            }
          };
          window.addEventListener('touchstart', onFirstInteraction, { once: true, passive: true });
          window.addEventListener('touchend', onFirstInteraction, { once: true, passive: true });
          window.addEventListener('click', onFirstInteraction, { once: true });
          window.addEventListener('scroll', onFirstInteraction, { once: true, passive: true });
        });
      }
    };

    const pauseSafe = () => {
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    };

    // Viewport-aware playback observer
    // rootMargin: '150px 0px 150px 0px' prepares/plays slightly before scrolling into view,
    // and immediately pauses when offscreen to release iOS hardware video decoders (limit 3-4).
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          isIntersectingRef.current = entry.isIntersecting;
          if (entry.isIntersecting) {
            playSafe();
          } else {
            manuallyPausedRef.current = false;
            pauseSafe();
          }
        }
      },
      {
        threshold: 0.05,
        rootMargin: '150px 0px 150px 0px',
      }
    );

    observer.observe(video);

    const onCanPlay = () => {
      if (isIntersectingRef.current && !manuallyPausedRef.current && videoRef.current?.paused) {
        playSafe();
      }
    };
    video.addEventListener('canplay', onCanPlay);

    // Tab visibility handling
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isIntersectingRef.current) {
        playSafe();
      } else if (document.visibilityState === 'hidden') {
        pauseSafe();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      observer.disconnect();
      video.removeEventListener('canplay', onCanPlay);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      pauseSafe();
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      className={className}
      style={style}
      autoPlay
      loop
      muted
      playsInline
      preload="metadata"
      controls={false}
      onClick={(e) => {
        const v = e.currentTarget;
        if (v.paused) {
          manuallyPausedRef.current = false;
          v.play().catch(() => {});
        } else {
          manuallyPausedRef.current = true;
          v.pause();
        }
        if (onClick) onClick(e);
      }}
    />
  );
}

function PublishedOverlay({ overlay }: {
  overlay: Overlay;
}) {
  const [isFlipped, setIsFlipped] = useState(false);

  if (!overlay.visible) return null;

  // Full-slide frame templates cover the entire page
  const isFullSlide = overlay.x <= 1 && overlay.y <= 1 && overlay.width >= 98 && overlay.height >= 98;

  const style: React.CSSProperties = {
    position: 'absolute',
    // 1px bleed for full-slide frames completely eliminates mobile subpixel gaps along the edges
    left: isFullSlide ? '-1px' : `${overlay.x}%`,
    top: isFullSlide ? '-1px' : `${overlay.y}%`,
    width: isFullSlide ? 'calc(100% + 2px)' : `${overlay.width}%`,
    height: isFullSlide ? 'calc(100% + 2px)' : `${overlay.height}%`,
    opacity: overlay.opacity,
    // Full-slide frames must never have rounded corners that expose videos underneath
    borderRadius: isFullSlide ? '0px' : `${overlay.borderRadius || 0}px`,
    overflow: overlay.type === 'flip' ? 'visible' : 'hidden',
  };

  const content = () => {
    switch (overlay.type) {
      case 'flip':
        return (
          <div 
            className="w-full h-full cursor-pointer"
            style={{ perspective: '1000px' }}
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <div 
              className="w-full h-full relative transition-transform duration-700 ease-in-out"
              style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
            >
              {/* Front Side */}
              <div className="absolute inset-0 w-full h-full" style={{ backfaceVisibility: 'hidden', borderRadius: `${overlay.borderRadius || 0}px`, overflow: 'hidden' }}>
                {overlay.flipFrontUrl && <img src={overlay.flipFrontUrl} alt="Front" className="w-full h-full pointer-events-none" style={{ objectFit: overlay.fitMode || 'contain' }} />}
              </div>
              {/* Back Side */}
              <div className="absolute inset-0 w-full h-full" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', borderRadius: `${overlay.borderRadius || 0}px`, overflow: 'hidden' }}>
                {overlay.flipBackUrl && <img src={overlay.flipBackUrl} alt="Back" className="w-full h-full pointer-events-none" style={{ objectFit: overlay.fitMode || 'contain' }} />}
              </div>
            </div>
          </div>
        );

      case 'image':
      case 'gif':
        return overlay.mediaUrl ? (
          <img
            src={overlay.mediaUrl}
            alt={overlay.label || ''}
            style={{
              width: '100%',
              height: '100%',
              // Full slide overlays use cover so subpixel rounding cannot leave empty gaps
              objectFit: isFullSlide ? 'cover' : (overlay.fitMode || 'contain'),
              display: 'block',
              pointerEvents: isFullSlide ? 'none' : undefined,
            }}
          />
        ) : null;

      case 'mp4':
        return overlay.mediaUrl ? (
          <AutoPlayVideo
            src={overlay.mediaUrl}
            style={{ width: '100%', height: '100%', objectFit: overlay.fitMode || 'contain' }}
            poster={overlay.posterUrl}
          />
        ) : null;

      case 'link': {
        const isInvisible = overlay.buttonStyle === 'invisible' || !overlay.buttonStyle;
        return (
          <a
            href={formatUrl(overlay.url)}
            target={overlay.openInNewTab ? '_blank' : '_self'}
            rel="noopener noreferrer"
            className={isInvisible ? 'hotspot-invisible' : ''}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              textDecoration: 'none',
              cursor: overlay.url ? 'pointer' : 'default',
              background: isInvisible ? 'transparent' : (overlay.buttonColor || 'rgba(201,162,81,0.15)'),
              border: isInvisible ? 'none' : '1px solid rgba(201,162,81,0.4)',
              color: overlay.textColor || '#fff',
              fontSize: '13px',
              fontFamily: 'Inter, sans-serif',
            } as React.CSSProperties}
          >
            {overlay.label && !isInvisible ? overlay.label : null}
          </a>
        );
      }

      case 'model3d':
        return overlay.mediaUrl ? (
          <a
            href={`/viewer?url=${encodeURIComponent(overlay.mediaUrl)}&time=${overlay.envTimeOfDay || 'noon'}&season=${overlay.envSeason || 'summer'}${overlay.hdriUrl ? `&hdri=${encodeURIComponent(overlay.hdriUrl)}` : ''}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-full flex items-center justify-center transition-all group"
            style={{ borderRadius: `${overlay.borderRadius || 0}px`, textDecoration: 'none' }}
          >
             <div 
               className="flex items-center justify-center rounded-full font-bold shadow-2xl pointer-events-none group-hover:scale-[1.05] transition-transform whitespace-nowrap"
               style={{
                 backgroundColor: overlay.buttonColor || '#ffffff',
                 color: overlay.textColor || '#000000',
                 scale: overlay.buttonScale || 1,
                 fontSize: '2.25cqw',
                 padding: '1.25cqw 2.5cqw',
                 gap: '0.75cqw'
               }}
             >
               <Box style={{ width: '1.2em', height: '1.2em' }} /> View 3D Space
             </div>
          </a>
        ) : null;

      case 'carousel':
        return <CarouselPlayer overlay={overlay} />;

      case 'melt':
        return <MeltGalleryPlayer overlay={overlay} />;
    }
  };

  return (
    <div style={style}>
      {content()}
    </div>
  );
}

function PublishedPage({ deck, page, transitionStyle, transitionSpeed }: {
  deck: Deck;
  page: DeckPage;
  transitionStyle: any;
  transitionSpeed: any;
}) {
  const imgSrc = page.imageDataUrl || page.imageUrl;
  const placeholderSrc = (() => {
    if (imgSrc) return imgSrc;
    try {
      const cfg = (page as any)._placeholderConfig;
      if (cfg) return makePlaceholderPage(cfg.pageNumber, cfg.totalPages);
    } catch {}
    return null;
  })();

  const slideSize = deck?.slideSize || '16:9';
  const aspectRatio = SLIDE_SIZES[slideSize].aspectRatio;
  const isVertical = aspectRatio < 1;

  return (
    <PageTransitionWrapper transitionStyle={transitionStyle} transitionSpeed={transitionSpeed}>
      <div className="deck-slide-page-wrapper">
        <div
          className={`relative bg-black z-10 overflow-hidden ${isVertical ? 'shadow-[0_0_80px_rgba(0,0,0,0.8)]' : ''}`}
          style={{
            width: '100%',
            maxWidth: `min(calc(100dvh * ${aspectRatio}), calc(100vw - env(safe-area-inset-left) - env(safe-area-inset-right)))`,
            aspectRatio: `${aspectRatio}`,
            containerType: 'inline-size'
          }}
        >
          <div
            className="relative w-full h-full overflow-hidden"
            style={{ backgroundColor: page.backgroundColor || undefined }}
          >
            <div className="absolute inset-0 overflow-hidden">
              {placeholderSrc && (
                page.backgroundType === 'video' ? (
                  <AutoPlayVideo src={placeholderSrc} className="w-full h-full object-cover select-none" />
                ) : (
                  <img src={placeholderSrc} alt={page.title} className="w-full h-full object-cover select-none" draggable={false} />
                )
              )}
              {/* Overlays rendered synchronously with zero delay */}
              {page.overlays.map(overlay => (
                <PublishedOverlay
                  key={overlay.id}
                  overlay={overlay}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageTransitionWrapper>
  );
}

export default function PublishedDeckView() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const [deckId, setDeckId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);

  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const controlsFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasNativeFullscreenRef = useRef(false);
  const isThrottledRef = useRef(false);

  // Resolve slug → deckId
  useEffect(() => {
    if (!slug) { setNotFound(true); return; }
    supabase.from('decks').select('id').eq('slug', slug).single().then(({ data: deck }) => {
      if (deck) setDeckId(deck.id);
      else setNotFound(true);
    });
  }, [slug]);

  const deck = useDeck(deckId || undefined);
  const pages = usePages(deckId || undefined);

  const scrollToPage = useCallback((index: number) => {
    setCurrentIndex(index);
    pageRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Track current page on scroll in normal view
  useEffect(() => {
    if (isPresentationMode) return;
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const i = pageRefs.current.indexOf(entry.target as HTMLDivElement);
            if (i !== -1) setCurrentIndex(i);
          }
        });
      },
      { threshold: 0.5 }
    );
    pageRefs.current.forEach(ref => { if (ref) observer.observe(ref); });
    return () => observer.disconnect();
  }, [pages, isPresentationMode]);

  // Controls auto-fade timer in presentation mode
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsFadeTimer.current) clearTimeout(controlsFadeTimer.current);
    controlsFadeTimer.current = setTimeout(() => {
      setShowControls(false);
    }, 3500);
  }, []);

  const exitPresentationMode = useCallback(() => {
    setIsPresentationMode(false);
    const doc = document as any;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      if (doc.exitFullscreen) doc.exitFullscreen().catch(() => {});
      else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen().catch(() => {});
    }
    wasNativeFullscreenRef.current = false;
    setIsNativeFullscreen(false);

    // Scroll normal scroll view smoothly to current slide
    setTimeout(() => {
      pageRefs.current[currentIndex]?.scrollIntoView({ behavior: 'instant', block: 'start' });
    }, 60);
  }, [currentIndex]);

  const goToNextSlide = useCallback(() => {
    if (!pages || pages.length === 0) return;
    if (currentIndex < pages.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else if (isPresentationMode) {
      // Completed presentation
      exitPresentationMode();
    }
  }, [pages, currentIndex, isPresentationMode, exitPresentationMode]);

  const goToPrevSlide = useCallback(() => {
    if (!pages || pages.length === 0) return;
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [pages, currentIndex]);

  const enterPresentationMode = useCallback(async (startIdx?: number) => {
    if (!pages || pages.length === 0) return;
    const idx = typeof startIdx === 'number' ? startIdx : currentIndex;
    setCurrentIndex(idx);
    setIsPresentationMode(true);
    setShowControls(true);

    try {
      const el = document.documentElement as any;
      if (el.requestFullscreen) {
        await el.requestFullscreen();
        wasNativeFullscreenRef.current = true;
        setIsNativeFullscreen(true);
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
        wasNativeFullscreenRef.current = true;
        setIsNativeFullscreen(true);
      }
    } catch {
      // Mobile Safari / permissions
      wasNativeFullscreenRef.current = false;
      setIsNativeFullscreen(false);
    }
  }, [pages, currentIndex]);

  const toggleFullscreen = useCallback(async () => {
    const doc = document as any;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      if (doc.exitFullscreen) await doc.exitFullscreen().catch(() => {});
      else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen().catch(() => {});
      setIsNativeFullscreen(false);
    } else {
      const el = document.documentElement as any;
      if (el.requestFullscreen) await el.requestFullscreen().catch(() => {});
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen().catch(() => {});
      setIsNativeFullscreen(true);
    }
  }, []);

  // Listen for fullscreen change (e.g. user pressed Esc)
  useEffect(() => {
    const onFsChange = () => {
      const doc = document as any;
      const isFs = !!(doc.fullscreenElement || doc.webkitFullscreenElement);
      setIsNativeFullscreen(isFs);
      if (!isFs && wasNativeFullscreenRef.current && isPresentationMode) {
        exitPresentationMode();
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, [isPresentationMode, exitPresentationMode]);

  // Mouse activity in presentation mode
  useEffect(() => {
    if (!isPresentationMode) return;
    resetControlsTimer();
    const onActivity = () => resetControlsTimer();
    window.addEventListener('mousemove', onActivity);
    window.addEventListener('touchstart', onActivity);
    return () => {
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('touchstart', onActivity);
      if (controlsFadeTimer.current) clearTimeout(controlsFadeTimer.current);
    };
  }, [isPresentationMode, resetControlsTimer]);

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;

      if (isPresentationMode) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'Enter' || e.key === 'PageDown') {
          e.preventDefault();
          goToNextSlide();
          resetControlsTimer();
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'Backspace' || e.key === 'PageUp') {
          e.preventDefault();
          goToPrevSlide();
          resetControlsTimer();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          exitPresentationMode();
        } else if (e.key.toLowerCase() === 'f') {
          e.preventDefault();
          toggleFullscreen();
        }
      } else {
        if (e.key.toLowerCase() === 'p') {
          e.preventDefault();
          enterPresentationMode(currentIndex);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPresentationMode, currentIndex, goToNextSlide, goToPrevSlide, exitPresentationMode, toggleFullscreen, enterPresentationMode, resetControlsTimer]);

  // Debounced wheel & touch swipe in presentation mode to prevent skipping slides
  useEffect(() => {
    if (!isPresentationMode) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (isThrottledRef.current) return;
      if (Math.abs(e.deltaY) > 25) {
        isThrottledRef.current = true;
        if (e.deltaY > 0) {
          goToNextSlide();
        } else {
          goToPrevSlide();
        }
        resetControlsTimer();
        setTimeout(() => {
          isThrottledRef.current = false;
        }, 450);
      }
    };

    let touchStartX: number | null = null;
    let touchStartY: number | null = null;

    const onTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (touchStartX === null || touchStartY === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;

      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) {
          goToNextSlide();
        } else {
          goToPrevSlide();
        }
        resetControlsTimer();
      } else if (Math.abs(dy) > 50 && Math.abs(dy) > Math.abs(dx)) {
        if (dy < 0) {
          goToNextSlide();
        } else {
          goToPrevSlide();
        }
        resetControlsTimer();
      }
      touchStartX = null;
      touchStartY = null;
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isPresentationMode, goToNextSlide, goToPrevSlide, resetControlsTimer]);

  // Direct link ?present=true
  useEffect(() => {
    if (pages && pages.length > 0 && (searchParams.get('present') === 'true' || searchParams.get('present') === '1')) {
      enterPresentationMode(0);
    }
  }, [pages, searchParams, enterPresentationMode]);

  const handlePresentationClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea, [role="button"], .hotspot-invisible')) {
      return;
    }
    goToNextSlide();
    resetControlsTimer();
  };

  if (notFound || (!deck && !deckId)) {
    return (
      <div className="bg-black flex flex-col items-center justify-center gap-4" style={{ minHeight: '100dvh' }}>
        <img src="/motion-deck-logo.png" alt="Motion Deck" className="h-8 w-auto opacity-30 mb-2" />
        <p style={{ color: '#444', fontSize: 14 }}>Deck not found.</p>
      </div>
    );
  }

  if (!deck || !pages) {
    return (
      <div className="bg-black flex flex-col items-center justify-center gap-6" style={{ minHeight: '100dvh' }}>
        <img src="/motion-deck-logo.png" alt="Motion Deck" className="h-8 w-auto opacity-30 animate-pulse" />
        <div className="w-5 h-5 border-2 border-[#333] border-t-accent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="bg-black flex flex-col items-center justify-center gap-4" style={{ minHeight: '100dvh' }}>
        <p className="text-gray-500 text-sm">This deck has no pages yet.</p>
      </div>
    );
  }

  const isVertical = deck && SLIDE_SIZES[deck.slideSize || '16:9'].aspectRatio < 1;
  const brandingImageUrl = deck?.brandingImageDataUrl || deck?.brandingImageUrl;
  const aspectRatio = deck ? SLIDE_SIZES[deck.slideSize || '16:9'].aspectRatio : 16 / 9;

  return (
    <div className="bg-surface-3 relative" style={{ minHeight: '100dvh' }}>
      {/* Global Fixed Background Branding */}
      {isVertical && deck?.showPaddingBranding && brandingImageUrl && (
        <div className="fixed inset-0 flex pointer-events-none z-0">
          <div className="flex-1 relative">
            <img src={brandingImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
          </div>
          <div className="flex-none" style={{ width: `calc(100dvh * ${aspectRatio})`, maxWidth: '100vw' }} />
          <div className="flex-1 relative">
            <img src={brandingImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
          </div>
        </div>
      )}

      {/* Normal Mode: Launch Presentation Button in Top Right (Outside Slide Canvas) */}
      {!isPresentationMode && (
        <div className="fixed top-4 right-4 z-40 flex items-center gap-2">
          <button
            onClick={() => enterPresentationMode(currentIndex)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-black/85 hover:bg-black text-white border border-white/20 hover:border-accent shadow-2xl backdrop-blur-md transition-all duration-200 cursor-pointer text-xs font-semibold group hover:shadow-glow-accent active:scale-95"
            title="Start Presentation Mode (P)"
          >
            <Play size={13} className="text-accent fill-accent group-hover:scale-110 transition-transform" />
            <span>Present</span>
            <span className="text-[10px] text-white/60 px-1.5 py-0.5 rounded bg-white/10 font-mono">
              {currentIndex + 1}/{pages.length}
            </span>
          </button>
        </div>
      )}

      {/* Standard Deck pages (Vertical Scroll View) */}
      <div className="deck-slides-container">
        {pages.map((page: DeckPage, i: number) => (
          <div
            key={page.id}
            ref={el => { pageRefs.current[i] = el; }}
            id={`page-${i}`}
            className="deck-slide-snap-item"
          >
            <PublishedPage
              deck={deck}
              page={page}
              transitionStyle={deck.transitionStyle}
              transitionSpeed={deck.transitionSpeed}
            />
          </div>
        ))}
      </div>

      {/* Standard Navigation controls (when not presenting) */}
      {!isPresentationMode && (
        <PageNavigationControls
          pages={pages}
          currentIndex={currentIndex}
          onNavigate={scrollToPage}
        />
      )}

      {/* ─── Presentation Mode Overlay ─────────────────────────────────────── */}
      {isPresentationMode && pages[currentIndex] && (
        <div
          className="fixed inset-0 z-50 bg-black flex items-center justify-center select-none overflow-hidden"
          onClick={handlePresentationClick}
          style={{ cursor: showControls ? 'default' : 'none' }}
        >
          {/* Side Branding for Vertical Presentation */}
          {isVertical && deck?.showPaddingBranding && brandingImageUrl && (
            <div className="fixed inset-0 flex pointer-events-none z-0">
              <div className="flex-1 relative">
                <img src={brandingImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
              </div>
              <div className="flex-none" style={{ width: `calc(100dvh * ${aspectRatio})`, maxWidth: '100vw' }} />
              <div className="flex-1 relative">
                <img src={brandingImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
              </div>
            </div>
          )}

          {/* Active Single Slide Display */}
          <div
            key={`pres-page-${pages[currentIndex].id}`}
            className="relative z-10 w-full h-full flex items-center justify-center animate-fade-in"
          >
            <PublishedPage
              deck={deck}
              page={pages[currentIndex]}
              transitionStyle={deck.transitionStyle}
              transitionSpeed={deck.transitionSpeed}
            />
          </div>

          {/* Top Right Floating Toolbar (Outside Slide Deck Space) */}
          <div
            className={`fixed top-4 right-4 z-50 flex items-center gap-2 transition-opacity duration-300 ${
              showControls ? 'opacity-100 pointer-events-auto' : 'opacity-35 hover:opacity-100 pointer-events-auto'
            }`}
          >
            {/* Previous Slide Button */}
            <button
              onClick={(e) => { e.stopPropagation(); goToPrevSlide(); }}
              disabled={currentIndex === 0}
              className="p-2 rounded-full bg-black/80 hover:bg-black text-white border border-white/15 hover:border-accent shadow-xl backdrop-blur-md transition-all cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed active:scale-95"
              title="Previous Slide (← / ↑)"
            >
              <ChevronLeft size={16} />
            </button>

            {/* Next Slide / Advance Button */}
            <button
              onClick={(e) => { e.stopPropagation(); goToNextSlide(); }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-accent hover:bg-accent-hover text-black shadow-2xl transition-all duration-200 cursor-pointer text-xs font-bold shadow-glow-accent active:scale-95"
              title="Next Slide (Space / → / Click)"
            >
              <span>{currentIndex === pages.length - 1 ? 'End' : 'Next'}</span>
              <span className="text-[11px] bg-black/15 px-1.5 py-0.5 rounded-full font-mono font-medium">
                {currentIndex + 1}/{pages.length}
              </span>
              {currentIndex < pages.length - 1 ? <ChevronRight size={15} /> : <Check size={15} />}
            </button>

            {/* Toggle Fullscreen Button */}
            <button
              onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
              className="p-2 rounded-full bg-black/80 hover:bg-black text-white border border-white/15 hover:border-accent shadow-xl backdrop-blur-md transition-all cursor-pointer active:scale-95 hidden sm:flex"
              title="Toggle Fullscreen (F)"
            >
              {isNativeFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>

            {/* Exit Presentation Button */}
            <button
              onClick={(e) => { e.stopPropagation(); exitPresentationMode(); }}
              className="p-2 rounded-full bg-black/80 hover:bg-black text-white border border-white/15 hover:border-accent shadow-xl backdrop-blur-md transition-all cursor-pointer active:scale-95"
              title="Exit Presentation (Esc)"
            >
              <X size={16} />
            </button>
          </div>

          {/* Side Arrows on Desktop */}
          {currentIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); goToPrevSlide(); }}
              className={`fixed left-4 top-1/2 -translate-y-1/2 z-40 p-3 rounded-full bg-black/60 hover:bg-black text-white/80 hover:text-white border border-white/15 hover:border-accent shadow-2xl backdrop-blur-md transition-all duration-200 cursor-pointer hidden md:flex ${
                showControls ? 'opacity-100' : 'opacity-0 hover:opacity-100'
              }`}
              title="Previous Slide"
            >
              <ChevronLeft size={24} />
            </button>
          )}

          {currentIndex < pages.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); goToNextSlide(); }}
              className={`fixed right-4 top-1/2 -translate-y-1/2 z-40 p-3 rounded-full bg-black/60 hover:bg-black text-white/80 hover:text-white border border-white/15 hover:border-accent shadow-2xl backdrop-blur-md transition-all duration-200 cursor-pointer hidden md:flex ${
                showControls ? 'opacity-100' : 'opacity-0 hover:opacity-100'
              }`}
              title="Next Slide"
            >
              <ChevronRight size={24} />
            </button>
          )}

          {/* Bottom Progress Line */}
          <div className="fixed bottom-0 left-0 right-0 h-[3px] bg-white/10 pointer-events-none z-50">
            <div
              className="h-full bg-accent transition-all duration-300 ease-out"
              style={{ width: `${((currentIndex + 1) / pages.length) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
