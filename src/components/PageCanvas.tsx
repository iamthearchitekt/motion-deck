import { useState, useRef, useCallback, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { Link, Image, Film, MousePointer, Plus, Move } from 'lucide-react';
import type { Deck, DeckPage, Overlay, OverlayType } from '../types';
import { SLIDE_SIZES } from '../types';
import { addOverlay, updateOverlay } from '../db/hooks';
import { makePlaceholderPage } from '../data/sampleDeck';

interface Props {
  deck: Deck;
  page: DeckPage;
  selectedOverlayId: string | null;
  onSelectOverlay: (id: string | null) => void;
}

const OVERLAY_ICONS: Record<OverlayType, React.ReactNode> = {
  link: <Link size={16} />,
  image: <Image size={16} />,
  gif: <Image size={16} />,
  mp4: <Film size={16} />,
  carousel: <div className="flex -space-x-2"><Image size={16}/><Image size={16}/></div>,
  flip: <Move size={16} />,
};

const OVERLAY_COLORS: Record<OverlayType, string> = {
  link: '#3b82f6',
  image: '#10b981',
  gif: '#f59e0b',
  mp4: '#ef4444',
  carousel: '#8b5cf6',
  flip: '#ec4899',
};

function OverlayItem({
  overlay, isSelected, containerWidth, containerHeight, onSelect, onChange,
}: {
  overlay: Overlay;
  isSelected: boolean;
  containerWidth: number;
  containerHeight: number;
  onSelect: () => void;
  onChange: (changes: Partial<Overlay>) => void;
}) {
  if (!overlay.visible) return null;

  const px = (Number(overlay.x) || 0) / 100 * containerWidth;
  const py = (Number(overlay.y) || 0) / 100 * containerHeight;
  const pw = (Number(overlay.width) || 50) / 100 * containerWidth;
  const ph = (Number(overlay.height) || 50) / 100 * containerHeight;
  const color = OVERLAY_COLORS[overlay.type] || '#c9a251';

  const [isDragging, setIsDragging] = useState(false);
  const rndRef = useRef<any>(null);

  useEffect(() => {
    if (!isDragging && rndRef.current) {
      rndRef.current.updatePosition({ x: px, y: py });
      rndRef.current.updateSize({ width: pw, height: ph });
    }
  }, [px, py, pw, ph, isDragging]);

  const renderContent = () => {
    switch (overlay.type) {
      case 'image':
      case 'gif':
        return overlay.mediaUrl ? (
          <img src={overlay.mediaUrl} alt={overlay.label || (overlay.type === 'gif' ? 'GIF' : 'Image')} className="w-full h-full pointer-events-none" style={{ objectFit: overlay.fitMode || 'contain' }} draggable={false} />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 opacity-60">
            <Image size={20} style={{ color }} />
            <span className="text-[10px] font-medium uppercase" style={{ color }}>{overlay.type}</span>
          </div>
        );
      case 'mp4':
        return overlay.mediaUrl ? (
          <video
            src={overlay.mediaUrl}
            autoPlay
            loop
            muted
            controls={false}
            className="w-full h-full pointer-events-none"
            style={{ objectFit: overlay.fitMode || 'contain' }}
            playsInline
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 opacity-60">
            <Film size={20} style={{ color }} />
            <span className="text-[10px] font-medium" style={{ color }}>MP4</span>
          </div>
        );

      case 'carousel': {
        const hasImages = overlay.carouselImages && overlay.carouselImages.length > 0;
        return hasImages ? (
          <div className="w-full h-full relative select-none">
            <img src={overlay.carouselImages![0]} alt="Carousel slide 1" className="w-full h-full pointer-events-none" style={{ objectFit: overlay.fitMode || 'contain' }} draggable={false} />
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
              1 / {overlay.carouselImages!.length}
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 opacity-60">
            <div className="flex gap-1">
              <Image size={14} style={{ color }} />
              <Image size={14} style={{ color }} />
            </div>
            <span className="text-[10px] font-medium" style={{ color }}>Carousel</span>
          </div>
        );
      }
      case 'flip':
        return overlay.flipFrontUrl ? (
          <img src={overlay.flipFrontUrl} alt="Flip Front" className="w-full h-full pointer-events-none" style={{ objectFit: overlay.fitMode || 'contain' }} draggable={false} />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 opacity-60">
            <Move size={20} style={{ color }} />
            <span className="text-[10px] font-medium uppercase" style={{ color }}>FLIP CARD</span>
          </div>
        );
      default: // link
        return overlay.label ? (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-[10px] font-medium text-white/60">{overlay.label}</span>
          </div>
        ) : null;
    }
  };

  const getBg = () => {
    if (overlay.type === 'gif' || overlay.type === 'image' || overlay.type === 'mp4' || overlay.type === 'carousel' || overlay.type === 'flip') return 'transparent';
    if (overlay.type === 'link' && overlay.buttonStyle === 'invisible') return 'transparent';
    return `${color}18`;
  };

  const getBorder = () => {
    if (overlay.type === 'gif' || overlay.type === 'image' || overlay.type === 'mp4' || overlay.type === 'carousel' || overlay.type === 'flip') return isSelected ? `2px solid ${color}` : 'none';
    return isSelected ? `2px solid ${color}` : `1px dashed ${color}60`;
  };

  return (
    <Rnd
      ref={rndRef}
      default={{ x: px, y: py, width: pw, height: ph }}
      minWidth={20}
      minHeight={20}
      lockAspectRatio={false}
      className="rnd-overlay"
      onDragStart={() => {
        setIsDragging(true);
        onSelect();
      }}
      onDragStop={(_e, d) => {
        setIsDragging(false);
        onChange({
          x: (d.x / containerWidth) * 100,
          y: (d.y / containerHeight) * 100,
        });
      }}
      onResizeStart={() => {
        setIsDragging(true);
        onSelect();
      }}
      onResizeStop={(_e, _dir, _ref, _delta, position) => {
        setIsDragging(false);
        const el = _ref as HTMLElement;
        onChange({
          x: (position.x / containerWidth) * 100,
          y: (position.y / containerHeight) * 100,
          width: (el.offsetWidth / containerWidth) * 100,
          height: (el.offsetHeight / containerHeight) * 100,
        });
      }}
      enableResizing={isSelected}
      disableDragging={false}
      style={{ zIndex: isSelected ? 20 : 10 }}
    >
      <div
        className="select-none"
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          opacity: overlay.opacity,
          borderRadius: `${overlay.borderRadius}px`,
          background: getBg(),
          border: getBorder(),
          overflow: 'hidden',
          cursor: 'move',
          transition: 'border 0.15s',
        }}
      >
        {renderContent()}
        {/* Type label badge */}
        {isSelected && (
          <div className="absolute top-1 left-1 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider text-white" style={{ background: color }}>
            {OVERLAY_ICONS[overlay.type] || <MousePointer size={12} />} {String(overlay.type || 'unknown')}
          </div>
        )}
      </div>
    </Rnd>
  );
}

export default function PageCanvas({ deck, page, selectedOverlayId, onSelectOverlay }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [showAddMenu, setShowAddMenu] = useState(false);

  const observeSize = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    (containerRef as any).current = node;
    const obs = new ResizeObserver(entries => {
      for (const e of entries) {
        setContainerSize({ width: e.contentRect.width, height: e.contentRect.height });
      }
    });
    obs.observe(node);
    setContainerSize({ width: node.offsetWidth, height: node.offsetHeight });
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

  const handleAddOverlay = async (type: OverlayType) => {
    setShowAddMenu(false);
    const isMedia = type === 'gif' || type === 'mp4' || type === 'carousel' || type === 'image' || type === 'flip';
    const defaults: Omit<Overlay, 'id' | 'pageId'> = {
      type,
      // Media overlays spawn centered
      x: isMedia ? 25 : 30,
      y: isMedia ? 25 : 38,
      width:  isMedia ? 50 : 40,
      height: isMedia ? 50 : 10,
      opacity: 1,
      borderRadius: 4,
      visible: true,
      label: undefined,
      buttonStyle: type === 'link' ? 'invisible' : undefined,
      buttonColor: undefined,
      textColor: '#ffffff',
      openInNewTab: true,
      fitMode: 'contain',
      autoplay: true,
      loop: true,
      muted: true,
      showControls: false,
    };
    const id = await addOverlay(page.id, defaults);
    onSelectOverlay(id);
  };

  const addMenuItems: { type: OverlayType; label: string; icon: React.ReactNode; desc: string }[] = [
    { type: 'link', label: 'Link Hotspot', icon: <Link size={14} />, desc: 'Invisible clickable area' },
    { type: 'image', label: 'Static Image', icon: <Image size={14} />, desc: 'PNG/JPG overlay' },
    { type: 'gif', label: 'GIF Overlay', icon: <Image size={14} />, desc: 'Animated GIF layer' },
    { type: 'mp4', label: 'MP4 Video', icon: <Film size={14} />, desc: 'Inline video player' },
    { type: 'carousel', label: 'Image Carousel', icon: <div className="flex -space-x-1"><Image size={14}/><Image size={14}/></div>, desc: 'Scrollable image gallery' },
    { type: 'flip', label: 'Flip Card', icon: <Move size={14} />, desc: 'Interactive double-sided image' },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-surface-3 canvas-grid overflow-auto p-6 relative">
      {/* Canvas area — always fits fully within the editor area */}
      <div
        className="relative shadow-2xl"
        style={{
          /*
           * Fit the slide within the available space:
           * - If wider than tall (landscape): constrain by width
           * - If taller than wide (portrait/letter): constrain by height
           * We do this by letting the browser pick whichever limit is hit first
           * using max-width + max-height together on the outer box.
           */
          width: '100%',
          maxWidth: aspectRatio >= 1 ? '900px' : `calc((100vh - 160px) * ${aspectRatio})`,
          maxHeight: aspectRatio < 1 ? 'calc(100vh - 160px)' : undefined,
        }}
        onMouseDown={(e) => {
          if (!(e.target as HTMLElement).closest('.rnd-overlay')) {
            onSelectOverlay(null);
          }
        }}
      >
        <div
          ref={observeSize}
          className="relative w-full overflow-hidden"
          style={{ paddingBottom: `${(1 / aspectRatio) * 100}%` }}
        >
          <div className="absolute inset-0 bg-surface-3" style={{ backgroundColor: page.backgroundColor || undefined }}>
            {placeholderSrc ? (
              page.backgroundType === 'video' ? (
                <video
                  src={placeholderSrc}
                  className="w-full h-full"
                  style={{ objectFit: 'cover', display: 'block' }}
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              ) : (
                <img
                  src={placeholderSrc}
                  alt={page.title}
                  className="w-full h-full"
                  style={{ objectFit: 'cover', display: 'block' }}
                  draggable={false}
                />
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center opacity-30">
                  <Move size={32} className="text-text-muted mx-auto mb-2" />
                  <p className="text-text-muted text-sm">Blank Slide</p>
                </div>
              </div>
            )}
            {/* Overlays */}
            {containerSize.width > 0 && (page.overlays || []).map(overlay => {
              const calculatedHeight = containerSize.width / aspectRatio;
              return (
                <OverlayItem
                  key={overlay.id}
                  overlay={overlay}
                  isSelected={selectedOverlayId === overlay.id}
                  containerWidth={containerSize.width}
                  containerHeight={calculatedHeight}
                  onSelect={() => onSelectOverlay(overlay.id)}
                  onChange={changes => updateOverlay(page.id, overlay.id, changes)}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Add overlay FAB */}
      <div className="absolute bottom-6 right-6 flex flex-col items-end gap-2">
        {showAddMenu && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setShowAddMenu(false)} />
            <div className="relative z-30 bg-surface-2 border border-border-default rounded-xl shadow-modal overflow-hidden animate-scale-in min-w-48">
              {addMenuItems.map(item => (
                <button
                  key={item.type}
                  onClick={() => handleAddOverlay(item.type)}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-surface-3 transition-colors text-left"
                >
                  <span className="mt-0.5 text-accent">{item.icon}</span>
                  <div>
                    <div className="text-sm font-medium text-text-primary">{item.label}</div>
                    <div className="text-xs text-text-muted">{item.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
        <button
          onClick={() => setShowAddMenu(p => !p)}
          className="w-11 h-11 rounded-full bg-accent hover:bg-accent-hover flex items-center justify-center shadow-glow-accent transition-all"
          title="Add overlay"
        >
          <Plus size={20} className="text-black" style={{ transform: showAddMenu ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
      </div>

      {/* Page title */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-surface-2/80 backdrop-blur-sm border border-border-subtle px-3 py-1 rounded-full text-xs text-text-muted">
        {!page.title || page.title.startsWith('Page ') || page.title === 'Blank Slide' || page.title.includes('(Copy)') 
          ? `Page ${page.order + 1}` 
          : page.title}
      </div>
    </div>
  );
}
