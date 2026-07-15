// ─── Enums ───────────────────────────────────────────────────────────────────

export type DeckStatus = 'draft' | 'published' | 'archived';

export type OverlayType = 'link' | 'gif' | 'mp4' | 'carousel' | 'image' | 'flip';

export type TransitionStyle = 'none' | 'fade' | 'fadeUp';

export type TransitionSpeed = 'slow' | 'medium' | 'fast';

export type FitMode = 'cover' | 'contain';

export type SlideSize = '16:9' | '4:5' | '8.5x11';

export const SLIDE_SIZES: Record<SlideSize, { label: string; width: number; height: number; aspectRatio: number }> = {
  '16:9':   { label: '16:9 Widescreen',  width: 1920, height: 1080, aspectRatio: 16 / 9 },
  '4:5':    { label: '8×10  (4:5)',       width: 1600, height: 2000, aspectRatio: 4 / 5  },
  '8.5x11': { label: '8.5×11 Letter',    width: 1700, height: 2200, aspectRatio: 8.5 / 11 },
};

// ─── Media ───────────────────────────────────────────────────────────────────

export interface MediaItem {
  id: string;
  deckId: string;
  name: string;
  type: 'gif' | 'mp4' | 'image';
  /** Object URL or data URL for local preview */
  url: string;
  /** Stored as base64 for IndexedDB persistence */
  dataUrl?: string;
  sizeBytes: number;
  uploadedAt: string;
}

// ─── Overlay ─────────────────────────────────────────────────────────────────

export interface Overlay {
  id: string;
  pageId: string;
  type: OverlayType;

  // Position / Size (as % of page dimensions)
  x: number;
  y: number;
  width: number;
  height: number;

  // Appearance
  opacity: number;
  borderRadius: number;
  visible: boolean;
  label?: string;

  // Link / Button
  url?: string;
  openInNewTab?: boolean;
  hoverEffect?: boolean;
  buttonStyle?: 'solid' | 'outline' | 'ghost' | 'invisible';
  buttonColor?: string;
  textColor?: string;

  // Media (GIF / MP4)
  mediaId?: string;
  mediaUrl?: string;
  fitMode?: FitMode;

  // MP4-specific
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  showControls?: boolean;
  posterUrl?: string;

  // Carousel-specific
  carouselImages?: string[];

  // Flip-specific
  flipFrontUrl?: string;
  flipBackUrl?: string;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export interface DeckPage {
  id: string;
  deckId: string;
  title: string;
  order: number;
  /** Object URL or data URL */
  imageUrl?: string;
  imageDataUrl?: string;
  /** Original image dimensions */
  imageWidth?: number;
  imageHeight?: number;
  aspectRatio?: number;
  backgroundColor?: string;
  backgroundType?: 'image' | 'video';
  overlays: Overlay[];
}

// ─── Deck ────────────────────────────────────────────────────────────────────

export interface Deck {
  id: string;
  title: string;
  clientName: string;
  projectName: string;
  preparedBy: string;
  proposalDate: string;
  internalNotes: string;
  status: DeckStatus;
  createdAt: string;
  updatedAt: string;
  slug: string;
  transitionStyle: TransitionStyle;
  transitionSpeed: TransitionSpeed;
  slideSize: SlideSize;
  showPaddingBranding?: boolean;
  brandingImageUrl?: string;
  brandingImageDataUrl?: string;
}
