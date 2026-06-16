import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { db } from './schema';
import type { Deck, DeckPage, Overlay, MediaItem, DeckStatus, TransitionStyle, TransitionSpeed } from '../types';

// ─── Deck Hooks ──────────────────────────────────────────────────────────────

export function useDecks() {
  return useLiveQuery(() => db.decks.orderBy('updatedAt').reverse().toArray(), []);
}

export function useDeck(id: string | undefined) {
  return useLiveQuery(() => (id ? db.decks.get(id) : undefined), [id]);
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
  await db.decks.add(deck);
  return id;
}

export async function updateDeck(id: string, changes: Partial<Deck>) {
  await db.decks.update(id, { ...changes, updatedAt: new Date().toISOString() });
}

export async function deleteDeck(id: string) {
  const pages = await db.pages.where('deckId').equals(id).toArray();
  for (const p of pages) {
    await db.pages.delete(p.id);
  }
  await db.media.where('deckId').equals(id).delete();
  await db.decks.delete(id);
}

export async function duplicateDeck(id: string): Promise<string> {
  const deck = await db.decks.get(id);
  if (!deck) throw new Error('Deck not found');

  const newDeckId = uuidv4();
  const now = new Date().toISOString();
  await db.decks.add({
    ...deck,
    id: newDeckId,
    title: `${deck.title} (Copy)`,
    status: 'draft',
    slug: newDeckId,
    createdAt: now,
    updatedAt: now,
  });

  const pages = await db.pages.where('deckId').equals(id).sortBy('order');
  for (const page of pages) {
    const newPageId = uuidv4();
    const newOverlays = page.overlays.map(o => ({ ...o, id: uuidv4(), pageId: newPageId }));
    await db.pages.add({
      ...page,
      id: newPageId,
      deckId: newDeckId,
      overlays: newOverlays,
    });
  }

  const media = await db.media.where('deckId').equals(id).toArray();
  for (const m of media) {
    await db.media.add({ ...m, id: uuidv4(), deckId: newDeckId });
  }

  return newDeckId;
}

export async function archiveDeck(id: string) {
  await updateDeck(id, { status: 'archived' });
}

// ─── Page Hooks ──────────────────────────────────────────────────────────────

export function usePages(deckId: string | undefined) {
  return useLiveQuery(
    () => (deckId ? db.pages.where('deckId').equals(deckId).sortBy('order') : undefined as any),
    [deckId]
  );
}

export async function addPage(deckId: string, imageUrl: string, imageDataUrl: string, width: number, height: number, existingCount: number, backgroundType: 'image' | 'video' = 'image'): Promise<string> {
  const id = uuidv4();
  const page: DeckPage = {
    id,
    deckId,
    title: '',
    order: existingCount,
    imageUrl,
    imageDataUrl,
    imageWidth: width,
    imageHeight: height,
    aspectRatio: width / height,
    backgroundType,
    overlays: [],
  };
  await db.pages.add(page);
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
  await db.pages.add(page);
  await updateDeck(deckId, {});
  return id;
}

export async function updatePage(id: string, changes: Partial<DeckPage>) {
  await db.pages.update(id, changes);
}

export async function deletePage(id: string, deckId: string) {
  await db.pages.delete(id);
  // Re-index orders
  const remaining = await db.pages.where('deckId').equals(deckId).sortBy('order');
  for (let i = 0; i < remaining.length; i++) {
    await db.pages.update(remaining[i].id, { order: i });
  }
  await updateDeck(deckId, {});
}

export async function duplicatePage(page: DeckPage): Promise<string> {
  const newId = uuidv4();
  const siblings = await db.pages.where('deckId').equals(page.deckId).sortBy('order');
  // Insert after current page
  const newOrder = page.order + 1;
  // Shift later pages
  for (const p of siblings) {
    if (p.order >= newOrder) {
      await db.pages.update(p.id, { order: p.order + 1 });
    }
  }
  const newOverlays = page.overlays.map(o => ({ ...o, id: uuidv4(), pageId: newId }));
  await db.pages.add({
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
    await db.pages.update(orderedIds[i], { order: i });
  }
  await updateDeck(deckId, {});
}

// ─── Overlay Helpers ─────────────────────────────────────────────────────────

export async function addOverlay(pageId: string, overlay: Omit<Overlay, 'id' | 'pageId'>): Promise<string> {
  const page = await db.pages.get(pageId);
  if (!page) throw new Error('Page not found');
  const id = uuidv4();
  const newOverlay: Overlay = { ...overlay, id, pageId };
  await db.pages.update(pageId, { overlays: [...page.overlays, newOverlay] });
  await updateDeck(page.deckId, {});
  return id;
}

export async function updateOverlay(pageId: string, overlayId: string, changes: Partial<Overlay>) {
  const page = await db.pages.get(pageId);
  if (!page) return;
  const overlays = page.overlays.map(o => (o.id === overlayId ? { ...o, ...changes } : o));
  await db.pages.update(pageId, { overlays });
  await updateDeck(page.deckId, {});
}

export async function deleteOverlay(pageId: string, overlayId: string) {
  const page = await db.pages.get(pageId);
  if (!page) return;
  const overlays = page.overlays.filter(o => o.id !== overlayId);
  await db.pages.update(pageId, { overlays });
  await updateDeck(page.deckId, {});
}

export async function duplicateOverlay(pageId: string, overlayId: string) {
  const page = await db.pages.get(pageId);
  if (!page) return;
  const orig = page.overlays.find(o => o.id === overlayId);
  if (!orig) return;
  const newOverlay: Overlay = { ...orig, id: uuidv4(), x: orig.x + 2, y: orig.y + 2 };
  await db.pages.update(pageId, { overlays: [...page.overlays, newOverlay] });
  await updateDeck(page.deckId, {});
}

// ─── Media Hooks ─────────────────────────────────────────────────────────────

export function useMedia(deckId: string | undefined) {
  return useLiveQuery(
    () => (deckId ? db.media.where('deckId').equals(deckId).toArray() : Promise.resolve([] as import('../types').MediaItem[])),
    [deckId]
  );
}

export async function addMedia(item: Omit<MediaItem, 'id' | 'uploadedAt'>): Promise<string> {
  const id = uuidv4();
  const media: MediaItem = { ...item, id, uploadedAt: new Date().toISOString() };
  await db.media.add(media);
  return id;
}

export async function deleteMedia(id: string) {
  await db.media.delete(id);
}

// ─── Status helpers ──────────────────────────────────────────────────────────

export async function setDeckStatus(id: string, status: DeckStatus) {
  await updateDeck(id, { status });
}

export async function setTransition(id: string, style: TransitionStyle, speed: TransitionSpeed) {
  await updateDeck(id, { transitionStyle: style, transitionSpeed: speed });
}
