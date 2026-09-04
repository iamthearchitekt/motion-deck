import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../db/supabase';
import { useDeck, usePages } from '../db/hooks';
import type { Deck, DeckPage, Overlay } from '../types';
import { SLIDE_SIZES } from '../types';
import PageTransitionWrapper from '../components/PageTransitionWrapper';
import PageNavigationControls from '../components/PageNavigationControls';
import CarouselPlayer from '../components/CarouselPlayer';
import MeltGalleryPlayer from '../components/MeltGalleryPlayer';
import { makePlaceholderPage } from '../data/sampleDeck';
import { Box } from 'lucide-react';

function formatUrl(url?: string) {
  if (!url) return '#';
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return 'https://' + url;
  }
  return url;
}

// Global flag: has the user interacted with the page yet?
// iOS Safari requires a user gesture before allowing video playback.
let _userHasInteracted = false;
const _interactionListeners: Set<() => void> = new Set();

if (typeof window !== 'undefined') {
  const markInteracted = () => {
    if (_userHasInteracted) return;
    _userHasInteracted = true;
    _interactionListeners.forEach(fn => fn());
    _interactionListeners.clear();
    window.removeEventListener('touchstart', markInteracted, true);
    window.removeEventListener('click', markInteracted, true);
    window.removeEventListener('scroll', markInteracted, true);
  };
  window.addEventListener('touchstart', markInteracted, { capture: true, passive: true });
  window.addEventListener('click', markInteracted, { capture: true });
  window.addEventListener('scroll', markInteracted, { capture: true, passive: true });
}

function useUserInteracted() {
  const [interacted, setInteracted] = useState(_userHasInteracted);
  useEffect(() => {
    if (_userHasInteracted) { setInteracted(true); return; }
    const cb = () => setInteracted(true);
    _interactionListeners.add(cb);
    return () => { _interactionListeners.delete(cb); };
  }, []);
  return interacted;
}

function AutoPlayVideo({ src, poster, style, className, onClick }: { src: string; poster?: string; style?: React.CSSProperties; className?: string; onClick?: (e: React.MouseEvent) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(poster || null);
  const userInteracted = useUserInteracted();
  
  const isMobile = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  const showVideo = !isMobile || userInteracted;

  // On mobile, extract first frame as a thumbnail before the user interacts
  useEffect(() => {
    if (!isMobile || poster || !src) return;
    
    // Create an offscreen video to grab the first frame
    const offscreen = document.createElement('video');
    offscreen.crossOrigin = 'anonymous';
    offscreen.muted = true;
    offscreen.playsInline = true;
    offscreen.preload = 'metadata';
    offscreen.src = src;
    
    const grabFrame = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = offscreen.videoWidth || 640;
        canvas.height = offscreen.videoHeight || 360;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
          setThumbnailUrl(canvas.toDataURL('image/jpeg', 0.8));
        }
      } catch { /* CORS may block this — that's fine, we'll just show black */ }
      offscreen.removeEventListener('seeked', grabFrame);
      offscreen.src = '';
    };
    
    offscreen.addEventListener('loadeddata', () => {
      offscreen.currentTime = 0.1; // seek to get a frame
    });
    offscreen.addEventListener('seeked', grabFrame);
    offscreen.load();
    
    return () => { offscreen.src = ''; };
  }, [src, poster, isMobile]);

  // Once we show the real video, force play
  useEffect(() => {
    if (!showVideo || !videoRef.current) return;
    const v = videoRef.current;
    v.muted = true;
    const p = v.play();
    if (p) p.catch(() => {});
  }, [showVideo, src]);

  // Mobile: show static thumbnail until user interacts
  if (!showVideo) {
    return (
      <div
        className={`relative w-full h-full ${className || ''}`}
        style={{ ...style, backgroundColor: '#000' }}
        onClick={onClick}
      >
        {thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt=""
            className="w-full h-full"
            style={{ objectFit: style?.objectFit || 'cover' }}
          />
        )}
      </div>
    );
  }

  // Desktop (always) or Mobile (after interaction): render real video
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
      controls={false}
      onClick={(e) => {
        const v = e.target as HTMLVideoElement;
        if (v.paused) v.play();
        else v.pause();
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

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${overlay.x}%`,
    top: `${overlay.y}%`,
    width: `${overlay.width}%`,
    height: `${overlay.height}%`,
    opacity: overlay.opacity,
    borderRadius: `${overlay.borderRadius}px`,
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
          <img src={overlay.mediaUrl} alt={overlay.label || ''} style={{ width: '100%', height: '100%', objectFit: overlay.fitMode || 'contain' }} />
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
  const [size, setSize] = useState({ width: 0, height: 0 });
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!imgRef.current) return;
    const obs = new ResizeObserver(entries => {
      for (const e of entries) {
        setSize({ width: e.contentRect.width, height: e.contentRect.height });
      }
    });
    obs.observe(imgRef.current);
    setSize({ width: imgRef.current.offsetWidth, height: imgRef.current.offsetHeight });
    return () => obs.disconnect();
  }, []);

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
      <div className="w-full flex items-center justify-center bg-transparent relative overflow-hidden" style={{ minHeight: '100dvh' }}>
        <div
          className={`relative bg-black z-10 ${isVertical ? 'shadow-[0_0_80px_rgba(0,0,0,0.8)]' : ''}`}
          style={{
            width: '100%',
            maxWidth: `min(calc(100dvh * ${aspectRatio}), calc(100vw - env(safe-area-inset-left) - env(safe-area-inset-right)))`,
            aspectRatio: `${aspectRatio}`,
            containerType: 'inline-size'
          }}
        >
          <div
            ref={imgRef}
            className="relative w-full h-full"
            style={{ backgroundColor: page.backgroundColor || undefined }}
          >
            <div className="absolute inset-0">
              {placeholderSrc && (
                page.backgroundType === 'video' ? (
                  <AutoPlayVideo src={placeholderSrc} className="w-full h-full object-cover select-none" />
                ) : (
                  <img src={placeholderSrc} alt={page.title} className="w-full h-full object-cover select-none" draggable={false} />
                )
              )}
              {/* Overlays */}
              {size.width > 0 && page.overlays.map(overlay => (
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
  const [deckId, setDeckId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

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

  // Track current page on scroll
  useEffect(() => {
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
  }, [pages]);

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

      {/* Deck pages */}
      <div className="flex flex-col relative z-10" style={{ scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch' }}>
        {pages.map((page: DeckPage, i: number) => (
          <div
            key={page.id}
            ref={el => { pageRefs.current[i] = el; }}
            id={`page-${i}`}
            style={{ scrollSnapAlign: 'start' }}
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


      {/* Navigation controls */}
      <PageNavigationControls
        pages={pages}
        currentIndex={currentIndex}
        onNavigate={scrollToPage}
      />
    </div>
  );
}
