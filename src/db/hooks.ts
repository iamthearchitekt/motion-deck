import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Deck, DeckPage, Overlay, MediaItem, DeckStatus, TransitionStyle, TransitionSpeed } from '../types';

// ─── API client ──────────────────────────────────────────────────────────────
// Data lives in Netlify Database (Postgres) and Netlify Blobs, reached through
// the `/api/*` serverless function. These helpers replace the previous direct
// browser-to-database client.

async function api<T = any>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

// Upload a base64 data URL to Blobs and return its public asset URL. Non-data
// URLs (already-hosted assets) are passed through unchanged.
async function uploadAsset(deckId: string, id: string, dataUrl?: string): Promise<string | undefined> {
  if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl;
  const key = `${deckId}/${id}-${Date.now()}`;
  const { url } = await api<{ url: string }>('/assets', {
    method: 'POST',
    body: JSON.stringify({ key, dataUrl }),
  });
  return url;
}

// ─── Lightweight refetch bus ─────────────────────────────────────────────────
// Replaces realtime subscriptions: after a mutation we notify all live queries
// for the affected table(s) so the UI refreshes.

type Listener = () => void;
const listeners: Record<string, Set<Listener>> = {};

function subscribe(table: string, fn: Listener): () => void {
  (listeners[table] ||= new Set()).add(fn);
  return () => listeners[table]?.delete(fn);
}

function notify(...tables: string[]) {
  for (const table of tables) listeners[table]?.forEach((fn) => fn());
}

function useQuery<T>(fetchFn: () => Promise<T[]>, deps: any[], table: string, skip = false): T[] | undefined {
  const [data, setData] = useState<T[] | undefined>(undefined);

  useEffect(() => {
    if (skip) {
      setData(undefined);
      return;
    }
    let mounted = true;
    const run = () =>
      fetchFn()
        .then((d) => mounted && setData(d || []))
        .catch(() => mounted && setData([]));
    run();
    const unsub = subscribe(table, run);
    return () => {
      mounted = false;
      unsub();
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return data;
}

// ─── Deck Hooks ──────────────────────────────────────────────────────────────

export function useDecks() {
  return useQuery<Deck>(() => api('/decks'), [], 'decks');
}

export function useDeck(id: string | undefined) {
  const [deck, setDeck] = useState<Deck | undefined>(undefined);

  useEffect(() => {
    if (!id) {
      setDeck(undefined);
      return;
    }
    let mounted = true;
    const run = () =>
      api<Deck | null>(`/decks/${id}`)
        .then((d) => mounted && setDeck(d || undefined))
        .catch(() => {});
    run();
    const unsub = subscribe('decks', run);
    return () => {
      mounted = false;
      unsub();
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
  await api('/decks', { method: 'POST', body: JSON.stringify(deck) });
  notify('decks');
  return id;
}

export async function updateDeck(id: string, changes: Partial<Deck>) {
  await api(`/decks/${id}`, { method: 'PATCH', body: JSON.stringify(changes) });
  notify('decks');
}

export async function deleteDeck(id: string) {
  await api(`/decks/${id}`, { method: 'DELETE' });
  notify('decks', 'pages', 'media');
}

export async function duplicateDeck(id: string): Promise<string> {
  const { id: newId } = await api<{ id: string }>(`/decks/${id}/duplicate`, { method: 'POST' });
  notify('decks', 'pages', 'media');
  return newId;
}

export async function archiveDeck(id: string) {
  await updateDeck(id, { status: 'archived' });
}

// ─── Page Hooks ──────────────────────────────────────────────────────────────

export function usePages(deckId: string | undefined) {
  return useQuery<DeckPage>(() => api(`/pages?deckId=${deckId}`), [deckId], 'pages', !deckId);
}

export async function addPage(deckId: string, imageUrl: string, imageDataUrl: string, width: number, height: number, existingCount: number, backgroundType: 'image' | 'video' = 'image'): Promise<string> {
  const id = uuidv4();

  // Upload base64 from the browser file picker to Blobs and keep the public URL.
  const finalImageUrl = (await uploadAsset(deckId, id, imageDataUrl)) || imageUrl;

  const page: DeckPage = {
    id,
    deckId,
    title: '',
    order: existingCount,
    imageUrl: finalImageUrl,
    imageDataUrl: finalImageUrl,
    imageWidth: width,
    imageHeight: height,
    aspectRatio: width / height,
    backgroundType,
    overlays: [],
  };
  await api('/pages', { method: 'POST', body: JSON.stringify(page) });
  await updateDeck(deckId, {});
  notify('pages');
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
  await api('/pages', { method: 'POST', body: JSON.stringify(page) });
  await updateDeck(deckId, {});
  notify('pages');
  return id;
}

export async function updatePage(id: string, changes: Partial<DeckPage>) {
  await api(`/pages/${id}`, { method: 'PATCH', body: JSON.stringify(changes) });
  notify('pages');
}

export async function deletePage(id: string, deckId: string) {
  await api(`/pages/${id}`, { method: 'DELETE' });
  // Re-index orders
  const remaining = await api<DeckPage[]>(`/pages?deckId=${deckId}`);
  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i].order !== i) {
      await api(`/pages/${remaining[i].id}`, { method: 'PATCH', body: JSON.stringify({ order: i }) });
    }
  }
  await updateDeck(deckId, {});
  notify('pages');
}

export async function duplicatePage(page: DeckPage): Promise<string> {
  const newId = uuidv4();
  const siblings = await api<DeckPage[]>(`/pages?deckId=${page.deckId}`);
  const newOrder = page.order + 1;

  for (const p of siblings) {
    if (p.order >= newOrder) {
      await api(`/pages/${p.id}`, { method: 'PATCH', body: JSON.stringify({ order: p.order + 1 }) });
    }
  }

  const newOverlays = (page.overlays || []).map((o) => ({ ...o, id: uuidv4(), pageId: newId }));
  const newPage: DeckPage = {
    ...page,
    id: newId,
    order: newOrder,
    overlays: newOverlays,
    title: '',
  };
  await api('/pages', { method: 'POST', body: JSON.stringify(newPage) });
  await updateDeck(page.deckId, {});
  notify('pages');
  return newId;
}

export async function reorderPages(deckId: string, orderedIds: string[]) {
  for (let i = 0; i < orderedIds.length; i++) {
    await api(`/pages/${orderedIds[i]}`, { method: 'PATCH', body: JSON.stringify({ order: i }) });
  }
  await updateDeck(deckId, {});
  notify('pages');
}

// ─── Overlay Helpers ─────────────────────────────────────────────────────────

export async function addOverlay(pageId: string, overlay: Omit<Overlay, 'id' | 'pageId'>): Promise<string> {
  const page = await api<DeckPage | null>(`/pages/${pageId}`);
  if (!page) throw new Error('Page not found');
  const id = uuidv4();
  const newOverlay: Overlay = { ...overlay, id, pageId } as Overlay;
  await api(`/pages/${pageId}`, { method: 'PATCH', body: JSON.stringify({ overlays: [...(page.overlays || []), newOverlay] }) });
  await updateDeck(page.deckId, {});
  notify('pages');
  return id;
}

export async function updateOverlay(pageId: string, overlayId: string, changes: Partial<Overlay>) {
  const page = await api<DeckPage | null>(`/pages/${pageId}`);
  if (!page) return;
  const overlays = (page.overlays || []).map((o) => (o.id === overlayId ? { ...o, ...changes } : o));
  await api(`/pages/${pageId}`, { method: 'PATCH', body: JSON.stringify({ overlays }) });
  await updateDeck(page.deckId, {});
  notify('pages');
}

export async function deleteOverlay(pageId: string, overlayId: string) {
  const page = await api<DeckPage | null>(`/pages/${pageId}`);
  if (!page) return;
  const overlays = (page.overlays || []).filter((o) => o.id !== overlayId);
  await api(`/pages/${pageId}`, { method: 'PATCH', body: JSON.stringify({ overlays }) });
  await updateDeck(page.deckId, {});
  notify('pages');
}

export async function duplicateOverlay(pageId: string, overlayId: string) {
  const page = await api<DeckPage | null>(`/pages/${pageId}`);
  if (!page) return;
  const orig = (page.overlays || []).find((o) => o.id === overlayId);
  if (!orig) return;
  const newOverlay: Overlay = { ...orig, id: uuidv4(), x: orig.x + 2, y: orig.y + 2 };
  await api(`/pages/${pageId}`, { method: 'PATCH', body: JSON.stringify({ overlays: [...(page.overlays || []), newOverlay] }) });
  await updateDeck(page.deckId, {});
  notify('pages');
}

// ─── Media Hooks ─────────────────────────────────────────────────────────────

export function useMedia(deckId: string | undefined) {
  return useQuery<MediaItem>(() => api(`/media?deckId=${deckId}`), [deckId], 'media', !deckId);
}

export async function addMedia(item: Omit<MediaItem, 'id' | 'uploadedAt'>): Promise<string> {
  const id = uuidv4();
  const finalUrl = (await uploadAsset(item.deckId, id, item.dataUrl)) || item.url;

  const media: MediaItem = {
    ...item,
    id,
    url: finalUrl,
    dataUrl: finalUrl,
    uploadedAt: new Date().toISOString(),
  };
  await api('/media', { method: 'POST', body: JSON.stringify(media) });
  notify('media');
  return id;
}

export async function deleteMedia(id: string) {
  await api(`/media/${id}`, { method: 'DELETE' });
  notify('media');
}

// ─── Status helpers ──────────────────────────────────────────────────────────

export async function setDeckStatus(id: string, status: DeckStatus) {
  await updateDeck(id, { status });
}

export async function setTransition(id: string, style: TransitionStyle, speed: TransitionSpeed) {
  await updateDeck(id, { transitionStyle: style, transitionSpeed: speed });
}
