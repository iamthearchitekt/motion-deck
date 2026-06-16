import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, Globe, Link2, Save, Settings, Download, Check, ChevronDown, Upload, X } from 'lucide-react';
import { useDeck, usePages, updateDeck, setDeckStatus, setTransition } from '../db/hooks';
import PageSidebar from '../components/PageSidebar';
import PageCanvas from '../components/PageCanvas';
import OverlaySettingsPanel from '../components/OverlaySettingsPanel';
import { ErrorBoundary } from '../components/ErrorBoundary';
import type { TransitionStyle, TransitionSpeed, SlideSize } from '../types';
import { SLIDE_SIZES } from '../types';

type SaveState = 'saved' | 'saving' | 'unsaved';

export default function DeckEditor() {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const deck = useDeck(deckId);
  const pages = usePages(deckId);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [showSettings, setShowSettings] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brandingInputRef = useRef<HTMLInputElement>(null);

  const handleBrandingUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !deckId) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const objectUrl = URL.createObjectURL(file);
      updateDeck(deckId, {
        brandingImageDataUrl: dataUrl,
        brandingImageUrl: objectUrl,
        showPaddingBranding: true,
      });
    };
    reader.readAsDataURL(file);
  };

  // Auto-select first page when pages load
  useEffect(() => {
    if (pages && pages.length > 0 && !selectedPageId) {
      setSelectedPageId(pages[0].id);
    }
  }, [pages, selectedPageId]);

  const selectedPage = pages?.find(p => p.id === selectedPageId) || null;

  // Autosave indicator - triggered by any DB change via live query
  const triggerSave = useCallback(() => {
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaveState('saved'), 20000);
  }, []);

  useEffect(() => {
    if (!deck) return;
    triggerSave();
  }, [deck, pages]);

  const handlePublish = async () => {
    if (!deckId) return;
    await setDeckStatus(deckId, 'published');
    alert(`✅ Deck published!\n\nShare link:\n${window.location.origin}/deck/${deck?.slug}`);
  };

  const handleCopyLink = () => {
    if (!deck) return;
    const url = `${window.location.origin}/deck/${deck.slug}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleTitleChange = async (title: string) => {
    if (!deckId) return;
    await updateDeck(deckId, { title });
  };

  if (!deck || !pages) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6">
        <img src="/motion-deck-logo.png" alt="Motion Deck" className="h-8 w-auto opacity-30 animate-pulse" />
        <div className="w-5 h-5 border-2 border-[#333] border-t-accent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-surface-0 flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="h-12 bg-surface-1 border-b border-border-subtle flex items-center justify-between px-4 flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
            title="Back to library"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="w-px h-4 bg-border-subtle" />
          <img src="/motion-deck-logo.png" alt="Motion Deck" className="h-5 w-auto opacity-80" />
          {/* Editable deck title */}
          <input
            value={deck.title}
            onChange={e => handleTitleChange(e.target.value)}
            className="bg-transparent border-none outline-none text-sm font-semibold text-text-primary w-56 truncate hover:bg-surface-3 px-2 py-1 rounded-lg transition-colors"
          />
          {/* Save state */}
          <div className="flex items-center gap-1.5">
            {saveState === 'saving' && (
              <span className="text-xs text-text-muted flex items-center gap-1">
                <Save size={10} className="animate-spin" /> Saving...
              </span>
            )}
            {saveState === 'saved' && (
              <span className="text-xs text-accent/70 flex items-center gap-1">
                <Check size={10} /> Saved
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Transition settings */}
          <div className="relative">
            <button
              onClick={() => setShowSettings(p => !p)}
              className="btn-ghost flex items-center gap-1.5 text-xs"
            >
              <Settings size={13} /> Settings <ChevronDown size={11} />
            </button>
            {showSettings && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSettings(false)} />
                <div className="absolute right-0 top-9 z-20 bg-surface-2 border border-border-default rounded-xl shadow-modal p-4 w-64 animate-scale-in space-y-4">

                  {/* Slide Size */}
                  <div>
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Slide Size</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(Object.entries(SLIDE_SIZES) as [SlideSize, typeof SLIDE_SIZES[SlideSize]][]).map(([key, size]) => {
                        const isSelected = (deck.slideSize ?? '16:9') === key;
                        const ar = size.aspectRatio;
                        const isPortrait = ar < 1;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => deckId && updateDeck(deckId, { slideSize: key })}
                            style={{ borderColor: isSelected ? '#c9a251' : '#1e1e1e', background: isSelected ? 'rgba(201,162,81,0.08)' : '#181818' }}
                            className="flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all"
                          >
                            <div className="flex items-center justify-center" style={{ width: 36, height: 28 }}>
                              <div style={{
                                background: isSelected ? 'rgba(201,162,81,0.2)' : '#333',
                                border: `1px solid ${isSelected ? '#c9a251' : '#444'}`,
                                borderRadius: 2,
                                width: isPortrait ? Math.round(28 * ar) : 36,
                                height: isPortrait ? 28 : Math.round(36 / ar),
                              }} />
                            </div>
                            <span style={{ fontSize: 9, fontWeight: 600, color: isSelected ? '#c9a251' : '#666', textAlign: 'center', lineHeight: 1.2 }}>
                              {size.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {SLIDE_SIZES[deck.slideSize ?? '16:9'].aspectRatio < 1 && (
                      <div className="mt-4 pt-4 border-t border-border-default space-y-3">
                        <label className="flex items-center justify-between cursor-pointer">
                          <span className="text-xs text-text-secondary">Show Side Branding</span>
                          <div
                            onClick={() => deckId && updateDeck(deckId, { showPaddingBranding: !deck.showPaddingBranding })}
                            className={`relative w-8 h-4 rounded-full transition-colors ${deck.showPaddingBranding ? 'bg-accent' : 'bg-surface-4'}`}
                          >
                            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${deck.showPaddingBranding ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </div>
                        </label>

                        {deck.showPaddingBranding && (
                          <div className="space-y-2">
                            {deck.brandingImageUrl ? (
                              <div className="relative group rounded bg-surface-3 h-16 flex items-center justify-center overflow-hidden border border-border-default">
                                <img src={deck.brandingImageUrl} alt="Branding" className="h-10 w-auto object-contain opacity-70" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <button onClick={() => brandingInputRef.current?.click()} className="p-1 rounded hover:bg-white/20 text-white" title="Replace">
                                    <Upload size={14} />
                                  </button>
                                  <button onClick={() => deckId && updateDeck(deckId, { brandingImageUrl: '', brandingImageDataUrl: '' })} className="p-1 rounded hover:bg-white/20 text-white" title="Remove">
                                    <X size={14} />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => brandingInputRef.current?.click()}
                                className="w-full h-16 border border-dashed border-border-default rounded flex flex-col items-center justify-center gap-1 text-text-muted hover:border-accent hover:text-accent transition-all bg-surface-1"
                              >
                                <Upload size={14} />
                                <span className="text-[10px]">Upload Branding Logo</span>
                              </button>
                            )}
                            <input
                              type="file"
                              ref={brandingInputRef}
                              accept="image/png,image/jpeg,image/svg+xml"
                              onChange={handleBrandingUpload}
                              className="hidden"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Transitions */}
                  <div>
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Page Transitions</p>
                    <div>
                      <label className="field-label">Style</label>
                      <select
                        value={deck.transitionStyle}
                        onChange={e => deckId && setTransition(deckId, e.target.value as TransitionStyle, deck.transitionSpeed)}
                        className="w-full"
                      >
                        <option value="none">None</option>
                        <option value="fade">Soft Fade</option>
                        <option value="fadeUp">Soft Fade Up</option>
                      </select>
                    </div>
                    <div>
                      <label className="field-label">Speed</label>
                      <select
                        value={deck.transitionSpeed}
                        onChange={e => deckId && setTransition(deckId, deck.transitionStyle, e.target.value as TransitionSpeed)}
                        className="w-full"
                      >
                        <option value="slow">Slow</option>
                        <option value="medium">Medium</option>
                        <option value="fast">Fast</option>
                      </select>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Preview */}
          <button
            onClick={() => window.open(`/deck/${deck.slug}`, '_blank')}
            className="btn-ghost flex items-center gap-1.5 text-xs"
          >
            <Eye size={13} /> Preview
          </button>

          {/* Copy link */}
          {deck.status === 'published' && (
            <button onClick={handleCopyLink} className="btn-ghost flex items-center gap-1.5 text-xs">
              {copiedLink ? <Check size={13} className="text-accent" /> : <Link2 size={13} />}
              {copiedLink ? 'Copied!' : 'Copy Link'}
            </button>
          )}

          {/* Publish */}
          <button
            onClick={handlePublish}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
              deck.status === 'published'
                ? 'bg-accent/10 text-accent border border-accent/20'
                : 'btn-primary'
            }`}
          >
            <Globe size={13} />
            {deck.status === 'published' ? 'Published' : 'Publish'}
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Page sidebar */}
        <PageSidebar
          deckId={deck.id}
          pages={pages}
          selectedPageId={selectedPageId}
          onSelectPage={id => {
            setSelectedPageId(id);
            setSelectedOverlayId(null);
          }}
        />

        {/* Center: Canvas */}
        {selectedPage ? (
          <ErrorBoundary>
            <PageCanvas
              deck={deck}
              page={selectedPage}
              selectedOverlayId={selectedOverlayId}
              onSelectOverlay={setSelectedOverlayId}
            />
          </ErrorBoundary>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-surface-0 canvas-grid">
            <div className="text-center">
              <div className="text-text-muted text-sm mb-2">Upload pages to get started</div>
            </div>
          </div>
        )}

        {/* Right: Overlay settings */}
        {selectedPage && (
          <OverlaySettingsPanel
            page={selectedPage}
            overlayId={selectedOverlayId}
            deckId={deck.id}
          />
        )}
      </div>
    </div>
  );
}
