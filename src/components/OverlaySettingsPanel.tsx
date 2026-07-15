import { useRef, useCallback, useEffect, useState } from 'react';
import { Trash2, Copy, Eye, EyeOff, X, ExternalLink, Upload, Maximize } from 'lucide-react';
import type { DeckPage, Overlay } from '../types';
import { updateOverlay, deleteOverlay, duplicateOverlay, addMedia, updatePage, uploadFile } from '../db/hooks';

interface Props {
  page: DeckPage;
  overlayId: string | null;
  deckId: string;
}

function NumberInput({ label, value, onChange, min = 0, max = 100, step = 0.5, unit = '%' }: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; unit?: string;
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={Math.round(value * 10) / 10}
          min={min} max={max} step={step}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="w-full text-right"
        />
        {unit && <span className="text-text-muted text-xs flex-shrink-0">{unit}</span>}
      </div>
    </div>
  );
}


function TextInput({ label, value, onChange, placeholder, renderExtra }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; renderExtra?: (val: string) => React.ReactNode }) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);

  return (
    <div className="field-group">
      {label && <label className="field-label">{label}</label>}
      <input
        type="text"
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={() => onChange(local)}
        onKeyDown={e => { if (e.key === 'Enter') onChange(local); }}
        placeholder={placeholder}
        className="w-full"
      />
      {renderExtra && renderExtra(local)}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer py-1">
      <span className="text-xs text-text-secondary">{label}</span>
      <div
        onClick={() => onChange(!checked)}
        className={`relative w-8 h-4 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-surface-4'}`}
      >
        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
    </label>
  );
}


function formatUrl(url?: string) {
  if (!url) return '#';
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return 'https://' + url;
  }
  return url;
}

export default function OverlaySettingsPanel({ page, overlayId, deckId }: Props) {
  const overlay = overlayId ? (page.overlays || []).find(o => o.id === overlayId) : null;
  const mediaRef = useRef<HTMLInputElement>(null);
  const carouselRef = useRef<HTMLInputElement>(null);
  const flipFrontRef = useRef<HTMLInputElement>(null);
  const flipBackRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const update = useCallback((changes: Partial<Overlay>) => {
    if (!overlayId) return;
    updateOverlay(page.id, overlayId, changes);
  }, [page.id, overlayId]);

  const handleDelete = async () => {
    if (!overlayId) return;
    await deleteOverlay(page.id, overlayId);
  };

  const handleDuplicate = async () => {
    if (!overlayId) return;
    await duplicateOverlay(page.id, overlayId);
  };

  const handleMediaUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const type = file.type.includes('gif') ? 'gif' : file.type.includes('image') ? 'image' : 'mp4';
      const publicUrl = await uploadFile(file, deckId);
      const mediaId = await addMedia({
        deckId,
        name: file.name,
        type,
        url: publicUrl,
        sizeBytes: file.size,
      });
      update({ mediaUrl: publicUrl, mediaId });
      if (file.size > 50 * 1024 * 1024) {
        alert('⚠️ This file is over 50MB. For best web playback, use H.264 MP4 compressed for web.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  if (!overlay) {
    const isBlank = !page.imageUrl && !page.imageDataUrl;
    
    return (
      <div className="sidebar-panel w-64 flex-shrink-0">
        <div className="sidebar-header">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Slide Settings</span>
        </div>
        <div className="flex-1 flex flex-col p-4">
          {isBlank ? (
            <div className="space-y-4">
              <div className="field-group">
                <label className="field-label">Background Color</label>
                <div className="flex gap-2 items-center">
                  <input 
                    type="color" 
                    value={page.backgroundColor || '#000000'} 
                    onChange={e => updatePage(page.id, { backgroundColor: e.target.value })} 
                    className="w-8 h-8 p-0 border-0 rounded cursor-pointer bg-transparent" 
                  />
                  <input 
                    value={page.backgroundColor || '#000000'} 
                    onChange={e => updatePage(page.id, { backgroundColor: e.target.value })} 
                    className="flex-1 font-mono text-xs" 
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 opacity-60">
              <div className="w-10 h-10 rounded-xl bg-surface-3 flex items-center justify-center">
                <X size={16} className="text-text-muted" />
              </div>
              <div>
                <p className="text-sm text-text-secondary font-medium mb-1">No overlay selected</p>
                <p className="text-[11px] text-text-muted">Click an overlay on the canvas or add a new one.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="sidebar-panel w-64 flex-shrink-0 overflow-y-auto">
      <div className="sidebar-header">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider capitalize">{overlay.type} Overlay</span>
        <div className="flex gap-1">
          <button onClick={() => update({ visible: !overlay.visible })} className="p-1 rounded text-text-muted hover:text-text-primary transition-colors" title="Toggle visibility">
            {overlay.visible ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
          <button onClick={handleDuplicate} className="p-1 rounded text-text-muted hover:text-text-primary transition-colors" title="Duplicate">
            <Copy size={13} />
          </button>
          <button onClick={handleDelete} className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors" title="Delete overlay">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-4">
        {/* Layout Shortcuts */}
        <div>
          <button
            onClick={() => update({ x: 0, y: 0, width: 100, height: 100 })}
            className="w-full flex items-center justify-center gap-2 py-2 bg-surface-3 hover:bg-surface-4 text-text-primary rounded text-xs font-medium border border-border-default hover:border-border-subtle transition-all"
          >
            <Maximize size={14} />
            Fill Frame
          </button>
        </div>

        {/* Label */}
        {overlay.type !== 'link' && overlay.type !== 'image' && overlay.type !== 'gif' && overlay.type !== 'mp4' && overlay.type !== 'carousel' && overlay.type !== 'flip' && (
          <TextInput label="Label" value={overlay.label || ''} onChange={v => update({ label: v })} placeholder="Optional label..." />
        )}

        {/* Position & Size */}
        {overlay.type !== 'link' && overlay.type !== 'image' && overlay.type !== 'gif' && overlay.type !== 'mp4' && overlay.type !== 'carousel' && overlay.type !== 'flip' && (
          <div>
            <p className="field-label mb-2">Position & Size</p>
            <div className="grid grid-cols-2 gap-2">
              <NumberInput label="X" value={overlay.x} onChange={v => update({ x: v })} />
              <NumberInput label="Y" value={overlay.y} onChange={v => update({ y: v })} />
              <NumberInput label="Width" value={overlay.width} onChange={v => update({ width: v })} />
              <NumberInput label="Height" value={overlay.height} onChange={v => update({ height: v })} />
            </div>
          </div>
        )}

        {/* Appearance */}
        {overlay.type !== 'link' && overlay.type !== 'image' && overlay.type !== 'gif' && overlay.type !== 'mp4' && overlay.type !== 'carousel' && overlay.type !== 'flip' && (
          <div>
            <p className="field-label mb-2">Appearance</p>
            <div className="space-y-2">
              <NumberInput label="Opacity" value={overlay.opacity * 100} onChange={v => update({ opacity: v / 100 })} max={100} unit="%" />
              <NumberInput label="Border Radius" value={overlay.borderRadius} onChange={v => update({ borderRadius: v })} max={100} unit="px" />
            </div>
            <div className="mt-2">
              <Toggle label="Visible" checked={overlay.visible} onChange={v => update({ visible: v })} />
            </div>
            {(overlay.type === 'image' || overlay.type === 'gif' || overlay.type === 'mp4' || overlay.type === 'carousel' || overlay.type === 'flip') && (
              <div className="mt-3 field-group">
                <label className="field-label">Image Fit</label>
                <select value={overlay.fitMode || 'contain'} onChange={e => update({ fitMode: e.target.value as 'contain' | 'cover' })} className="w-full">
                  <option value="contain">Contain (Fit to bounds)</option>
                  <option value="cover">Cover (Fill bounds)</option>
                </select>
              </div>
            )}
          </div>
        )}

        {/* ── Link Hotspot ── */}
        {overlay.type === 'link' && (
          <div>
            <p className="field-label mb-2">Link</p>
            <div className="space-y-2">
              <TextInput 
                label="Destination URL" 
                value={overlay.url || ''} 
                onChange={v => update({ url: v })} 
                placeholder="https://" 
                renderExtra={(val) => val ? (
                  <a href={formatUrl(val)} target="_blank" rel="noopener noreferrer" className="text-xs text-accent flex items-center gap-1 mt-1 hover:underline">
                    <ExternalLink size={10} /> Test link
                  </a>
                ) : null}
              />
              <Toggle label="Open in New Tab" checked={overlay.openInNewTab ?? true} onChange={v => update({ openInNewTab: v })} />
              {overlay.type === 'link' && (
                <>
                  <Toggle label="Hover Effect" checked={overlay.hoverEffect ?? false} onChange={v => update({ hoverEffect: v })} />
                  <div className="field-group">
                    <label className="field-label">Style</label>
                    <select value={overlay.buttonStyle || 'invisible'} onChange={e => update({ buttonStyle: e.target.value as any })} className="w-full">
                      <option value="invisible">Invisible</option>
                      <option value="solid">Solid</option>
                      <option value="outline">Outline</option>
                      <option value="ghost">Ghost</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── GIF / MP4 / Image Media ── */}
        {(overlay.type === 'gif' || overlay.type === 'mp4' || overlay.type === 'image') && (
          <div>
            <p className="field-label mb-2">Media</p>
            {overlay.mediaUrl ? (
              <div className="rounded-lg overflow-hidden bg-surface-3 relative group">
                {overlay.type === 'gif' || overlay.type === 'image' ? (
                  <img src={overlay.mediaUrl} alt="Media" className="w-full h-24" style={{ objectFit: 'contain' }} />
                ) : (
                  <video src={overlay.mediaUrl} className="w-full h-24" style={{ objectFit: 'contain' }} muted playsInline />
                )}
                <button
                  onClick={() => mediaRef.current?.click()}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-medium transition-opacity"
                >
                  Replace
                </button>
              </div>
            ) : (
              <button
                onClick={() => mediaRef.current?.click()}
                disabled={isUploading}
                className={`w-full border border-dashed rounded-lg py-4 flex flex-col items-center gap-2 transition-all ${isUploading ? 'border-border-default opacity-50 cursor-not-allowed' : 'border-border-default text-text-muted hover:border-accent hover:text-accent'}`}
              >
                <Upload size={16} />
                <span className="text-xs">{isUploading ? 'Uploading...' : `Upload ${overlay.type === 'gif' ? 'GIF' : overlay.type === 'image' ? 'Image' : 'MP4'}`}</span>
              </button>
            )}
            <p className="text-[10px] text-text-muted mt-2">Drag corners on canvas to scale. Maintains natural aspect ratio.</p>
          </div>
        )}
        {/* ── Carousel ── */}
        {overlay.type === 'carousel' && (
          <div>
            <p className="field-label mb-2">Carousel Images (Max 10)</p>
            
            <div className="space-y-2">
              {/* Thumbnail Grid */}
              {(overlay.carouselImages || []).length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {(overlay.carouselImages || []).map((img, idx) => (
                    <div key={idx} className="relative group bg-surface-3 rounded overflow-hidden h-16 border border-border-subtle">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => {
                          const newImages = [...(overlay.carouselImages || [])];
                          newImages.splice(idx, 1);
                          update({ carouselImages: newImages });
                        }}
                        className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Button */}
              {(overlay.carouselImages || []).length < 10 ? (
                <>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    multiple
                    className="hidden"
                    ref={carouselRef}
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (!files.length) return;
                      const currentCount = (overlay.carouselImages || []).length;
                      const allowedFiles = files.slice(0, 10 - currentCount);
                      
                      Promise.all(allowedFiles.map(f => uploadFile(f, deckId))).then(publicUrls => {
                        update({ carouselImages: [...(overlay.carouselImages || []), ...publicUrls] });
                      });
                      
                      if (carouselRef.current) carouselRef.current.value = '';
                    }}
                  />
                  <button
                    onClick={() => carouselRef.current?.click()}
                    className="w-full border border-dashed border-border-default rounded-lg py-4 flex flex-col items-center gap-2 text-text-muted hover:border-accent hover:text-accent transition-all"
                  >
                    <Upload size={16} />
                    <span className="text-xs">Add Images ({(overlay.carouselImages || []).length}/10)</span>
                  </button>
                </>
              ) : (
                <div className="text-center p-2 bg-surface-3 rounded border border-border-default text-xs text-text-muted">
                  Maximum of 10 images reached.
                </div>
              )}
            </div>
            <p className="text-[10px] text-text-muted mt-2">Auto-plays in presentation mode until clicked. Drag canvas corners to scale.</p>
          </div>
        )}
        {/* ── Flip Card ── */}
        {overlay.type === 'flip' && (
          <div>
            <p className="field-label mb-2">Front & Back Images</p>
            <div className="space-y-3">
              {/* Front Image */}
              <div>
                <span className="text-xs text-text-muted mb-1 block">Front Side</span>
                {overlay.flipFrontUrl ? (
                  <div className="rounded-lg overflow-hidden bg-surface-3 relative group h-20">
                    <img src={overlay.flipFrontUrl} alt="Front" className="w-full h-full object-contain" />
                    <button
                      onClick={() => flipFrontRef.current?.click()}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-medium transition-opacity"
                    >
                      Replace Front
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => flipFrontRef.current?.click()}
                    disabled={isUploading}
                    className={`w-full border border-dashed rounded-lg py-3 flex flex-col items-center gap-1 transition-all ${isUploading ? 'border-border-default opacity-50 cursor-not-allowed' : 'border-border-default text-text-muted hover:border-accent hover:text-accent'}`}
                  >
                    <Upload size={14} />
                    <span className="text-xs">Upload Front</span>
                  </button>
                )}
              </div>

              {/* Back Image */}
              <div>
                <span className="text-xs text-text-muted mb-1 block">Back Side</span>
                {overlay.flipBackUrl ? (
                  <div className="rounded-lg overflow-hidden bg-surface-3 relative group h-20">
                    <img src={overlay.flipBackUrl} alt="Back" className="w-full h-full object-contain" />
                    <button
                      onClick={() => flipBackRef.current?.click()}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-medium transition-opacity"
                    >
                      Replace Back
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => flipBackRef.current?.click()}
                    disabled={isUploading}
                    className={`w-full border border-dashed rounded-lg py-3 flex flex-col items-center gap-1 transition-all ${isUploading ? 'border-border-default opacity-50 cursor-not-allowed' : 'border-border-default text-text-muted hover:border-accent hover:text-accent'}`}
                  >
                    <Upload size={14} />
                    <span className="text-xs">Upload Back</span>
                  </button>
                )}
              </div>
            </div>
            <p className="text-[10px] text-text-muted mt-2">Images will flip interactively in the published presentation when clicked.</p>
          </div>
        )}
      </div>

      <input
        ref={mediaRef}
        type="file"
        accept={overlay.type === 'gif' ? 'image/gif' : overlay.type === 'image' ? 'image/png,image/jpeg,image/webp' : 'video/mp4,video/*'}
        className="hidden"
        onChange={e => e.target.files?.[0] && handleMediaUpload(e.target.files[0])}
      />
      
      <input
        ref={flipFrontRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={async e => {
          if (!e.target.files?.[0]) return;
          setIsUploading(true);
          try {
            const publicUrl = await uploadFile(e.target.files[0], deckId);
            update({ flipFrontUrl: publicUrl });
          } finally {
            setIsUploading(false);
            if (flipFrontRef.current) flipFrontRef.current.value = '';
          }
        }}
      />

      <input
        ref={flipBackRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={async e => {
          if (!e.target.files?.[0]) return;
          setIsUploading(true);
          try {
            const publicUrl = await uploadFile(e.target.files[0], deckId);
            update({ flipBackUrl: publicUrl });
          } finally {
            setIsUploading(false);
            if (flipBackRef.current) flipBackRef.current.value = '';
          }
        }}
      />
    </div>
  );
}
