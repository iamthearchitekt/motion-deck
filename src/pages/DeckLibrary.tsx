import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, LayoutGrid, Archive, Layers, Copy, Trash2, ExternalLink, Edit3, Eye, Link2, MoreHorizontal } from 'lucide-react';
import { useDecks, usePages, createDeck, deleteDeck, duplicateDeck, archiveDeck, updateDeck } from '../db/hooks';
import type { Deck, DeckStatus } from '../types';
import NewDeckModal from '../components/NewDeckModal';

const STATUS_TABS: { label: string; value: DeckStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Published', value: 'published' },
  { label: 'Archived', value: 'archived' },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusBadge({ status }: { status: DeckStatus }) {
  const cls = {
    draft: 'badge-draft',
    published: 'badge-published',
    archived: 'badge-archived',
  }[status];
  return <span className={cls}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
}

function DeckCard({ deck, onOpen, onDuplicate, onDelete, onArchive, onPublish, onCopyLink }: {
  deck: Deck;
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onPublish: () => void;
  onCopyLink: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(deck.title);
  const navigate = useNavigate();
  const pages = usePages(deck.id);
  const coverPage = pages?.[0];
  const coverImage = coverPage?.imageDataUrl || coverPage?.imageUrl;
  const coverIsVideo = coverPage?.backgroundType === 'video';

  const saveTitle = () => {
    if (title.trim()) updateDeck(deck.id, { title: title.trim() });
    setEditing(false);
  };

  return (
    <div className="panel hover:border-border-default transition-all duration-200 group animate-fade-up relative flex flex-col">
      {/* Thumbnail area */}
      <div
        className="relative overflow-hidden rounded-t-xl cursor-pointer bg-surface-1"
        style={{ aspectRatio: '16/9' }}
        onClick={onOpen}
      >
        {coverImage ? (
          coverIsVideo ? (
            <video src={coverImage} className="w-full h-full object-cover" autoPlay loop muted playsInline />
          ) : (
            <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
          )
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #141414 100%)' }}>
            <Layers size={28} className="text-accent opacity-40" />
            <span className="text-text-muted text-xs">{deck.clientName || 'No client'}</span>
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <div className="flex gap-2">
            <button onClick={e => { e.stopPropagation(); onOpen(); }} className="bg-surface-2/90 border border-border-default px-3 py-1.5 rounded-lg text-xs font-semibold text-text-primary flex items-center gap-1.5 hover:bg-accent hover:border-accent transition-all">
              <Edit3 size={12} /> Edit
            </button>
            <button onClick={e => { e.stopPropagation(); navigate(`/deck/${deck.slug}`); }} className="bg-surface-2/90 border border-border-default px-3 py-1.5 rounded-lg text-xs font-semibold text-text-primary flex items-center gap-1.5 hover:bg-surface-3 transition-all">
              <Eye size={12} /> Preview
            </button>
          </div>
        </div>
      </div>

      {/* Card body */}
      <div className="p-4 flex flex-col flex-1 gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                autoFocus
                value={title}
                onChange={e => setTitle(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitle(deck.title); setEditing(false); } }}
                className="w-full text-sm font-semibold bg-transparent border-b border-accent outline-none text-text-primary pb-0.5"
              />
            ) : (
              <h3
                className="text-sm font-semibold text-text-primary truncate cursor-pointer hover:text-accent transition-colors"
                onClick={() => setEditing(true)}
                title="Click to rename"
              >
                {deck.title}
              </h3>
            )}
            <p className="text-xs text-text-muted mt-0.5 truncate">{deck.clientName || '—'} {deck.projectName ? `· ${deck.projectName}` : ''}</p>
          </div>
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setMenuOpen(p => !p)}
              className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-3 transition-all"
            >
              <MoreHorizontal size={16} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 z-20 bg-surface-2 border border-border-default rounded-xl shadow-modal w-44 overflow-hidden animate-scale-in">
                  <button onClick={() => { onOpen(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors">
                    <Edit3 size={13} /> Open Editor
                  </button>
                  <button onClick={() => { navigate(`/deck/${deck.slug}`); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors">
                    <Eye size={13} /> Preview
                  </button>
                  {deck.status === 'published' && (
                    <button onClick={() => { onCopyLink(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors">
                      <Link2 size={13} /> Copy Link
                    </button>
                  )}
                  <button onClick={() => { onDuplicate(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors">
                    <Copy size={13} /> Duplicate
                  </button>
                  {deck.status !== 'published' && (
                    <button onClick={() => { onPublish(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-accent hover:text-accent-hover hover:bg-surface-3 transition-colors">
                      <ExternalLink size={13} /> Publish
                    </button>
                  )}
                  {deck.status !== 'archived' && (
                    <button onClick={() => { onArchive(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors">
                      <Archive size={13} /> Archive
                    </button>
                  )}
                  <div className="border-t border-border-subtle mx-2 my-1" />
                  <button onClick={() => { onDelete(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors">
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-auto pt-2 border-t border-border-subtle">
          <StatusBadge status={deck.status} />
          <span className="text-xs text-text-muted">
            {formatDate(deck.updatedAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function DeckLibrary() {
  const navigate = useNavigate();
  const decks = useDecks();
  const [showNewModal, setShowNewModal] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DeckStatus | 'all'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!decks) return [];
    return decks.filter(d => {
      const matchStatus = statusFilter === 'all' || d.status === statusFilter;
      const q = search.toLowerCase();
      const matchSearch = !q || d.title.toLowerCase().includes(q) || d.clientName.toLowerCase().includes(q) || d.projectName.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [decks, statusFilter, search]);

  const handleNew = async (data: Partial<Deck>) => {
    const id = await createDeck(data);
    navigate(`/editor/${id}`);
  };

  const handleDuplicate = async (id: string) => {
    const newId = await duplicateDeck(id);
    navigate(`/editor/${newId}`);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this deck? This cannot be undone.')) {
      await deleteDeck(id);
    }
  };

  const handlePublish = async (id: string) => {
    await updateDeck(id, { status: 'published' });
  };

  const handleCopyLink = (deck: Deck) => {
    const url = `${window.location.origin}/deck/${deck.slug}`;
    navigator.clipboard.writeText(url);
    setCopiedId(deck.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-surface-0">
      {/* Header */}
      <header className="border-b border-border-subtle bg-surface-1/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center">
              <img src="/motion-deck-logo.png" alt="Motion Deck" className="h-7 w-auto" />
            </div>
          <button onClick={() => setShowNewModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> New Deck
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-primary mb-1">Deck Library</h1>
          <p className="text-text-secondary text-sm">Create, manage, and share your proposal decks.</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, client..."
              className="w-full pl-9 pr-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-1 bg-surface-2 rounded-lg p-1 border border-border-subtle">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  statusFilter === tab.value
                    ? 'bg-accent text-black shadow-glow-accent'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Deck grid */}
        {!decks ? (
          <div className="text-text-muted text-sm text-center py-16">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {/* Create New Deck Card (Only in All/Drafts) */}
            {(statusFilter === 'all' || statusFilter === 'draft') && !search && (
              <button
                onClick={() => setShowNewModal(true)}
                className="panel flex flex-col items-center justify-center gap-3 hover:border-accent hover:bg-surface-1 transition-all duration-200 group h-full min-h-[220px]"
              >
                <div className="w-12 h-12 rounded-full bg-surface-2 border border-border-default group-hover:border-accent flex items-center justify-center text-text-muted group-hover:text-accent transition-all">
                  <Plus size={24} />
                </div>
                <span className="text-sm font-semibold text-text-secondary group-hover:text-accent transition-colors">Create New Deck</span>
              </button>
            )}

            {filtered.map((deck, i) => (
              <div key={deck.id} style={{ animationDelay: `${i * 60}ms` }}>
                {copiedId === deck.id && (
                  <div className="fixed top-4 right-4 z-50 bg-accent text-black text-sm font-medium px-4 py-2 rounded-lg shadow-modal animate-fade-in">
                    Link copied!
                  </div>
                )}
                <DeckCard
                  deck={deck}
                  onOpen={() => navigate(`/editor/${deck.id}`)}
                  onDuplicate={() => handleDuplicate(deck.id)}
                  onDelete={() => handleDelete(deck.id)}
                  onArchive={() => archiveDeck(deck.id)}
                  onPublish={() => handlePublish(deck.id)}
                  onCopyLink={() => handleCopyLink(deck)}
                />
              </div>
            ))}

            {filtered.length === 0 && (statusFilter !== 'all' && statusFilter !== 'draft' || search) && (
              <div className="col-span-full py-16 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-2 border border-border-subtle flex items-center justify-center">
                  <LayoutGrid size={24} className="text-text-muted" />
                </div>
                <p className="text-text-primary font-semibold mb-1">No decks found</p>
                <p className="text-text-muted text-sm">Try adjusting your filters or search.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {showNewModal && (
        <NewDeckModal onClose={() => setShowNewModal(false)} onCreate={handleNew} />
      )}
    </div>
  );
}
