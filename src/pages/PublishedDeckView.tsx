import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../db/supabase';
import { useDeck, usePages } from '../db/hooks';
import type { Deck, DeckPage, Overlay } from '../types';
import { SLIDE_SIZES } from '../types';
import PageTransitionWrapper from '../components/PageTransitionWrapper';
import PageNavigationControls from '../components/PageNavigationControls';
import CarouselPlayer from '../components/CarouselPlayer';
import { makePlaceholderPage } from '../data/sampleDeck';

function formatUrl(url?: string) {
  if (!url) return '#';
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return 'https://' + url;
  }
  return url;
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
          <video
            src={overlay.mediaUrl}
            autoPlay
            loop
            muted
            controls={false}
            playsInline
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

      case 'carousel':
        return <CarouselPlayer overlay={overlay} />;
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
      <div className="w-full flex items-center justify-center bg-transparent relative overflow-hidden">
        <div
          className={`relative bg-black z-10 ${isVertical ? 'shadow-[0_0_80px_rgba(0,0,0,0.8)]' : ''}`}
          style={{
            width: '100%',
            maxWidth: `calc(100dvh * ${aspectRatio})`,
            aspectRatio: `${aspectRatio}`,
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
                  <video src={placeholderSrc} className="w-full h-full object-cover select-none" autoPlay loop muted playsInline />
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
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <img src="/motion-deck-logo.png" alt="Motion Deck" className="h-8 w-auto opacity-30 mb-2" />
        <p style={{ color: '#444', fontSize: 14 }}>Deck not found.</p>
      </div>
    );
  }

  if (!deck || !pages) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6">
        <img src="/motion-deck-logo.png" alt="Motion Deck" className="h-8 w-auto opacity-30 animate-pulse" />
        <div className="w-5 h-5 border-2 border-[#333] border-t-accent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500 text-sm">This deck has no pages yet.</p>
      </div>
    );
  }

  const isVertical = deck && SLIDE_SIZES[deck.slideSize || '16:9'].aspectRatio < 1;
  const brandingImageUrl = deck?.brandingImageDataUrl || deck?.brandingImageUrl;
  const aspectRatio = deck ? SLIDE_SIZES[deck.slideSize || '16:9'].aspectRatio : 16 / 9;

  return (
    <div className="min-h-screen bg-surface-3 relative">
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
      <div className="flex flex-col relative z-10">
        {pages.map((page: DeckPage, i: number) => (
          <div
            key={page.id}
            ref={el => { pageRefs.current[i] = el; }}
            id={`page-${i}`}
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

      {/* Subtle branding */}
      <div className="fixed top-4 left-4 z-30 opacity-40 hover:opacity-80 transition-opacity">
        <img src="/motion-deck-logo.png" alt="Motion Deck" className="h-5 w-auto" />
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
