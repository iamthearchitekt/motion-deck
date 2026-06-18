import { useCallback, useRef } from 'react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Upload, Plus, Trash2, Copy, ImageIcon, RefreshCw } from 'lucide-react';
import type { DeckPage } from '../types';
import { addBlankPage, addPage, deletePage, duplicatePage, reorderPages, updatePage, uploadFile } from '../db/hooks';
import { makePlaceholderPage } from '../data/sampleDeck';

interface Props {
  deckId: string;
  pages: DeckPage[];
  selectedPageId: string | null;
  onSelectPage: (id: string | null) => void;
}

function SortablePageItem({ page, index, isSelected, onSelect, onDelete, onDuplicate, onReplace }: {
  page: DeckPage;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onReplace: (file: File) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id });
  const fileRef = useRef<HTMLInputElement>(null);

  const imgSrc = page.imageDataUrl || page.imageUrl;
  // Generate placeholder if no real image
  const placeholderSrc = (() => {
    if (imgSrc) return imgSrc;
    try {
      const cfg = (page as any)._placeholderConfig;
      if (cfg) return makePlaceholderPage(cfg.pageNumber, cfg.totalPages);
    } catch {}
    return null;
  })();

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={`group page-thumbnail cursor-grab active:cursor-grabbing ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
      {...attributes}
      {...listeners}
    >

      {/* Page number */}
      <div className="absolute top-1.5 right-1.5 z-10 bg-surface-0/80 text-text-muted text-[10px] px-1.5 py-0.5 rounded font-medium">
        {index + 1}
      </div>

      <div 
        className="aspect-video bg-surface-3 overflow-hidden relative"
        style={{ backgroundColor: page.backgroundColor || undefined }}
      >
        {placeholderSrc ? (
          page.backgroundType === 'video' ? (
            <video src={placeholderSrc} className="w-full h-full object-cover" autoPlay loop muted playsInline />
          ) : (
            <img src={placeholderSrc} alt={page.title} className="w-full h-full object-cover" />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon size={18} className="text-text-muted opacity-30" />
          </div>
        )}
      </div>

      {/* Title */}
      <div className="px-2 py-1.5 bg-surface-2">
        <p className="text-[11px] text-text-secondary truncate">
          {!page.title || page.title.startsWith('Page ') || page.title === 'Blank Slide' || page.title.includes('(Copy)') 
            ? `Page ${index + 1}` 
            : page.title}
        </p>
      </div>

      {/* Action buttons on hover */}
      <div
        className="absolute bottom-8 left-0 right-0 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity px-2"
        onClick={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
      >
        <button
          onClick={() => fileRef.current?.click()}
          title="Replace image"
          className="p-1 bg-surface-1/90 rounded text-text-muted hover:text-text-primary transition-colors"
        >
          <RefreshCw size={11} />
        </button>
        <button
          onClick={onDuplicate}
          title="Duplicate page"
          className="p-1 bg-surface-1/90 rounded text-text-muted hover:text-text-primary transition-colors"
        >
          <Copy size={11} />
        </button>
        <button
          onClick={onDelete}
          title="Delete page"
          className="p-1 bg-surface-1/90 rounded text-text-muted hover:text-text-primary transition-colors"
        >
          <Trash2 size={11} />
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,video/mp4"
        className="hidden"
        onChange={e => e.target.files?.[0] && onReplace(e.target.files[0])}
      />
    </div>
  );
}



function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = dataUrl;
  });
}

function getVideoDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise(resolve => {
    const video = document.createElement('video');
    video.onloadedmetadata = () => resolve({ width: video.videoWidth, height: video.videoHeight });
    video.src = dataUrl;
  });
}

export default function PageSidebar({ deckId, pages, selectedPageId, onSelectPage }: Props) {
  const uploadRef = useRef<HTMLInputElement>(null);

  const handleAddBlankSlide = async () => {
    const newPageId = await addBlankPage(deckId, pages.length);
    if (newPageId) onSelectPage(newPageId);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleUpload = useCallback(async (files: FileList) => {
    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith('video/');
      const objectUrl = URL.createObjectURL(file);
      const { width, height } = isVideo ? await getVideoDimensions(objectUrl) : await getImageDimensions(objectUrl);
      const publicUrl = await uploadFile(file, deckId);
      const id = await addPage(deckId, publicUrl, width, height, pages.length, isVideo ? 'video' : 'image');
      onSelectPage(id);
    }
  }, [deckId, pages.length, onSelectPage]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = pages.map(p => p.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    const reordered = arrayMove(ids, oldIndex, newIndex);
    await reorderPages(deckId, reordered);
  };

  const handleDelete = async (page: DeckPage) => {
    await deletePage(page.id, deckId);
    if (selectedPageId === page.id) {
      const remaining = pages.filter(p => p.id !== page.id);
      if (remaining.length > 0) onSelectPage(remaining[0].id);
      else onSelectPage(null);
    }
  };

  const handleReplace = async (page: DeckPage, file: File) => {
    const isVideo = file.type.startsWith('video/');
    const objectUrl = URL.createObjectURL(file);
    const { width, height } = isVideo ? await getVideoDimensions(objectUrl) : await getImageDimensions(objectUrl);
    const publicUrl = await uploadFile(file, deckId);
    await updatePage(page.id, {
      imageUrl: publicUrl,
      imageDataUrl: publicUrl,
      imageWidth: width,
      imageHeight: height,
      aspectRatio: width / height,
      backgroundType: isVideo ? 'video' : 'image',
    });
  };

  return (
    <div className="sidebar-panel w-52 flex-shrink-0 select-none">
      <div className="sidebar-header">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Pages</span>
        <button
          onClick={handleAddBlankSlide}
          className="p-1 rounded-md bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
          title="Add Blank Slide"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Upload zone */}
      {pages.length === 0 && (
        <div
          className="m-3 border-2 border-dashed border-border-default rounded-xl p-6 text-center cursor-pointer hover:border-accent hover:bg-accent-dim transition-all"
          onClick={() => uploadRef.current?.click()}
        >
          <Upload size={20} className="text-text-muted mx-auto mb-2" />
          <p className="text-xs text-text-muted">Drop PNGs here</p>
        </div>
      )}

      {/* Sortable pages */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={pages.map(p => p.id)} strategy={verticalListSortingStrategy}>
            {pages.map((page, i) => (
              <SortablePageItem
                key={page.id}
                page={page}
                index={i}
                isSelected={selectedPageId === page.id}
                onSelect={() => onSelectPage(page.id)}
                onDelete={() => handleDelete(page)}
                onDuplicate={() => duplicatePage(page)}
                onReplace={(file) => handleReplace(page, file)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* Upload PNG button */}
      {pages.length > 0 && (
        <div className="p-2 border-t border-border-subtle">
          <button
            onClick={() => uploadRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-border-default text-text-muted text-xs hover:border-accent hover:text-accent transition-all"
          >
            <Upload size={12} /> Upload Pages
          </button>
        </div>
      )}

      <input
        ref={uploadRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,video/mp4"
        multiple
        className="hidden"
        onChange={e => e.target.files && handleUpload(e.target.files)}
      />
    </div>
  );
}
