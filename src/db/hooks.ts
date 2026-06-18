import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabase';
import type { Deck, DeckPage, Overlay, MediaItem, DeckStatus, TransitionStyle, TransitionSpeed } from '../types';

// ─── Query Helper ────────────────────────────────────────────────────────────

function useSupabaseQuery<T>(
  queryFn: () => Promise<{ data: T[] | null; error: any }>,
  deps: any[],
  table: string,
  skip = false
) {
  const [data, setData] = useState<T[] | undefined>(undefined);

  useEffect(() => {
    if (skip) {
      setData(undefined);
      return;
    }
    
    let mounted = true;
    const fetchData = async () => {
      const res = await queryFn();
      if (mounted) setData(res.data || []);
    };
    fetchData();

    const channel = supabase.channel(`public:${table}-${deps.join('-')}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => fetchData())
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return data;
}

// ─── Deck Hooks ──────────────────────────────────────────────────────────────

export function useDecks() {
  return useSupabaseQuery<Deck>(
    () => supabase.from('decks').select('*').order('updatedAt', { ascending: false }) as any,
    [],
    'decks'
  );
}

export function useDeck(id: string | undefined) {
  const [deck, setDeck] = useState<Deck | undefined>(undefined);

  useEffect(() => {
    if (!id) {
      setDeck(undefined);
      return;
    }
    let mounted = true;
    const fetchDeck = async () => {
      const { data } = await supabase.from('decks').select('*').eq('id', id).single();
      if (mounted) setDeck(data as Deck);
    };
    fetchDeck();

    const channel = supabase.channel(`public:decks-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'decks', filter: `id=eq.${id}` }, () => fetchDeck())
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [id]);

  return deck;
}

export async function createDeck(partial: Partial<Deck> = {}): Promise<string> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const deck: Deck = {
    id,
    title: 'Untitled Deck',
    clientName: '',
    projectName: '',
    preparedBy: '',
    proposalDate: '',
    internalNotes: '',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    slug: id,
    transitionStyle: 'fade',
    transitionSpeed: 'medium',
    slideSize: '16:9',
    ...partial,
  };
  await supabase.from('decks').insert(deck);
  return id;
}

export async function updateDeck(id: string, changes: Partial<Deck>) {
  await supabase.from('decks').update({ ...changes, updatedAt: new Date().toISOString() }).eq('id', id);
}

export async function deleteDeck(id: string) {
  await supabase.from('decks').delete().eq('id', id);
}

export async function duplicateDeck(id: string): Promise<string> {
  const { data: deck } = await supabase.from('decks').select('*').eq('id', id).single();
  if (!deck) throw new Error('Deck not found');

  const newDeckId = uuidv4();
  const now = new Date().toISOString();
  await supabase.from('decks').insert({
    ...deck,
    id: newDeckId,
    title: `${deck.title} (Copy)`,
    status: 'draft',
    slug: newDeckId,
    createdAt: now,
    updatedAt: now,
  });

  const { data: pages } = await supabase.from('pages').select('*').eq('deckId', id).order('order');
  if (pages) {
    for (const page of pages) {
      const newPageId = uuidv4();
      const newOverlays = (page.overlays || []).map((o: any) => ({ ...o, id: uuidv4(), pageId: newPageId }));
      await supabase.from('pages').insert({
        ...page,
        id: newPageId,
        deckId: newDeckId,
        overlays: newOverlays,
      });
    }
  }

  const { data: media } = await supabase.from('media').select('*').eq('deckId', id);
  if (media) {
    for (const m of media) {
      await supabase.from('media').insert({ ...m, id: uuidv4(), deckId: newDeckId });
    }
  }

  return newDeckId;
}

export async function archiveDeck(id: string) {
  await updateDeck(id, { status: 'archived' });
}

// ─── Page Hooks ──────────────────────────────────────────────────────────────

export function usePages(deckId: string | undefined) {
  return useSupabaseQuery<DeckPage>(
    () => supabase.from('pages').select('*').eq('deckId', deckId).order('order') as any,
    [deckId],
    'pages',
    !deckId
  );
}

export async function uploadFile(file: File, pathPrefix: string): Promise<string> {
  const filePath = `${pathPrefix}/${uuidv4()}-${Date.now()}`;
  const { error } = await supabase.storage.from('motion-deck-assets').upload(filePath, file);
  if (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
  const { data } = supabase.storage.from('motion-deck-assets').getPublicUrl(filePath);
  return data.publicUrl;
}

export async function addPage(deckId: string, imageUrl: string, width: number, height: number, existingCount: number, backgroundType: 'image' | 'video' = 'image'): Promise<string> {
  const id = uuidv4();
  const page: DeckPage = {
    id,
    deckId,
    title: '',
    order: existingCount,
    imageUrl: imageUrl,
    imageDataUrl: imageUrl,
    imageWidth: width,
    imageHeight: height,
    aspectRatio: width / height,
    backgroundType,
    overlays: [],
  };
  await supabase.from('pages').insert(page);
  await updateDeck(deckId, {});
  return id;
}

export async function addBlankPage(deckId: string, existingCount: number): Promise<string> {
  const id = uuidv4();
  const page: DeckPage = {
    id,
    deckId,
    title: '',
    order: existingCount,
    backgroundColor: '#000000',
    overlays: [],
  };
  await supabase.from('pages').insert(page);
  await updateDeck(deckId, {});
  return id;
}

export async function updatePage(id: string, changes: Partial<DeckPage>) {
  await supabase.from('pages').update(changes).eq('id', id);
}

export async function deletePage(id: string, deckId: string) {
  await supabase.from('pages').delete().eq('id', id);
  // Re-index orders
  const { data: remaining } = await supabase.from('pages').select('*').eq('deckId', deckId).order('order');
  if (remaining) {
    for (let i = 0; i < remaining.length; i++) {
      await supabase.from('pages').update({ order: i }).eq('id', remaining[i].id);
    }
  }
  await updateDeck(deckId, {});
}

export async function duplicatePage(page: DeckPage): Promise<string> {
  const newId = uuidv4();
  const { data: siblings } = await supabase.from('pages').select('*').eq('deckId', page.deckId).order('order');
  const newOrder = page.order + 1;
  
  if (siblings) {
    for (const p of siblings) {
      if (p.order >= newOrder) {
        await supabase.from('pages').update({ order: p.order + 1 }).eq('id', p.id);
      }
    }
  }
  
  const newOverlays = (page.overlays || []).map(o => ({ ...o, id: uuidv4(), pageId: newId }));
  await supabase.from('pages').insert({
    ...page,
    id: newId,
    order: newOrder,
    overlays: newOverlays,
    title: '',
  });
  await updateDeck(page.deckId, {});
  return newId;
}

export async function reorderPages(deckId: string, orderedIds: string[]) {
  for (let i = 0; i < orderedIds.length; i++) {
    await supabase.from('pages').update({ order: i }).eq('id', orderedIds[i]);
  }
  await updateDeck(deckId, {});
}

// ─── Overlay Helpers ─────────────────────────────────────────────────────────

export async function addOverlay(pageId: string, overlay: Omit<Overlay, 'id' | 'pageId'>): Promise<string> {
  const { data: page } = await supabase.from('pages').select('*').eq('id', pageId).single();
  if (!page) throw new Error('Page not found');
  const id = uuidv4();
  const newOverlay: Overlay = { ...overlay, id, pageId } as Overlay;
  await supabase.from('pages').update({ overlays: [...(page.overlays || []), newOverlay] }).eq('id', pageId);
  await updateDeck(page.deckId, {});
  return id;
}

export async function updateOverlay(pageId: string, overlayId: string, changes: Partial<Overlay>) {
  const { data: page } = await supabase.from('pages').select('*').eq('id', pageId).single();
  if (!page) return;
  const overlays = (page.overlays || []).map((o: Overlay) => (o.id === overlayId ? { ...o, ...changes } : o));
  await supabase.from('pages').update({ overlays }).eq('id', pageId);
  await updateDeck(page.deckId, {});
}

export async function deleteOverlay(pageId: string, overlayId: string) {
  const { data: page } = await supabase.from('pages').select('*').eq('id', pageId).single();
  if (!page) return;
  const overlays = (page.overlays || []).filter((o: Overlay) => o.id !== overlayId);
  await supabase.from('pages').update({ overlays }).eq('id', pageId);
  await updateDeck(page.deckId, {});
}

export async function duplicateOverlay(pageId: string, overlayId: string) {
  const { data: page } = await supabase.from('pages').select('*').eq('id', pageId).single();
  if (!page) return;
  const orig = (page.overlays || []).find((o: Overlay) => o.id === overlayId);
  if (!orig) return;
  const newOverlay: Overlay = { ...orig, id: uuidv4(), x: orig.x + 2, y: orig.y + 2 };
  await supabase.from('pages').update({ overlays: [...(page.overlays || []), newOverlay] }).eq('id', pageId);
  await updateDeck(page.deckId, {});
}

// ─── Media Hooks ─────────────────────────────────────────────────────────────

export function useMedia(deckId: string | undefined) {
  return useSupabaseQuery<MediaItem>(
    () => supabase.from('media').select('*').eq('deckId', deckId) as any,
    [deckId],
    'media',
    !deckId
  );
}

export async function addMedia(item: Omit<MediaItem, 'id' | 'uploadedAt'>): Promise<string> {
  const id = uuidv4();
  const media: MediaItem = { 
    ...item, 
    id, 
    dataUrl: item.url, // No more base64
    uploadedAt: new Date().toISOString() 
  };
  await supabase.from('media').insert(media);
  return id;
}

export async function deleteMedia(id: string) {
  await supabase.from('media').delete().eq('id', id);
}

// ─── Status helpers ──────────────────────────────────────────────────────────

export async function setDeckStatus(id: string, status: DeckStatus) {
  await updateDeck(id, { status });
}

export async function setTransition(id: string, style: TransitionStyle, speed: TransitionSpeed) {
  await updateDeck(id, { transitionStyle: style, transitionSpeed: speed });
}
