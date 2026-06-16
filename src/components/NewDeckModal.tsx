import { useState } from 'react';
import { X } from 'lucide-react';
import type { Deck, DeckStatus, SlideSize } from '../types';
import { SLIDE_SIZES } from '../types';

interface Props {
  onClose: () => void;
  onCreate: (data: Partial<Deck>) => void;
  initial?: Partial<Deck>;
}

export default function NewDeckModal({ onClose, onCreate, initial }: Props) {
  const [form, setForm] = useState<Partial<Deck>>({
    title: '',
    clientName: '',
    projectName: '',
    preparedBy: '',
    proposalDate: '',
    internalNotes: '',
    status: 'draft',
    slideSize: '16:9',
    ...initial,
  });

  const set = (field: keyof Deck, value: string) => setForm(p => ({ ...p, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title?.trim()) return;
    onCreate(form);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border-subtle">
          <h2 className="text-base font-bold text-text-primary">New Deck</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="field-group">
            <label className="field-label">Deck Title *</label>
            <input required value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Summer Social Proposal" className="w-full" />
          </div>
          <div className="field-group">
            <label className="field-label">Client Name</label>
            <input value={form.clientName} onChange={e => set('clientName', e.target.value)} placeholder="Client Co." className="w-full" />
          </div>

          <div className="field-group">
            <label className="field-label">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value as DeckStatus)} className="w-full">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="field-group">
            <label className="field-label">Internal Notes</label>
            <textarea
              value={form.internalNotes}
              onChange={e => set('internalNotes', e.target.value)}
              placeholder="Private notes about this proposal..."
              rows={3}
              className="w-full resize-none"
            />
          </div>
          {/* Slide Size */}
          <div className="field-group">
            <label className="field-label">Slide Size</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(SLIDE_SIZES) as [SlideSize, typeof SLIDE_SIZES[SlideSize]][]).map(([key, size]) => {
                const isSelected = (form.slideSize ?? '16:9') === key;
                const ar = size.aspectRatio;
                const isPortrait = ar < 1;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, slideSize: key }))}
                    style={{ borderColor: isSelected ? '#c9a251' : '#1e1e1e', background: isSelected ? 'rgba(201,162,81,0.08)' : '#181818' }}
                    className="flex flex-col items-center gap-2 p-3 rounded-lg border transition-all"
                  >
                    {/* Aspect ratio preview box */}
                    <div className="flex items-center justify-center" style={{ width: 48, height: 36 }}>
                      <div
                        style={{
                          background: isSelected ? 'rgba(201,162,81,0.2)' : '#222',
                          border: `1px solid ${isSelected ? '#c9a251' : '#333'}`,
                          borderRadius: 3,
                          width: isPortrait ? Math.round(36 * ar) : 48,
                          height: isPortrait ? 36 : Math.round(48 / ar),
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: isSelected ? '#c9a251' : '#888', textAlign: 'center', lineHeight: 1.3 }}>
                      {size.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1">Create Deck</button>
          </div>
        </form>
      </div>
    </div>
  );
}
