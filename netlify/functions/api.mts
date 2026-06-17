import type { Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { eq, desc, asc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { decks, pages, media } from '../../db/schema.js';
import type { Deck, DeckPage, MediaItem, Overlay } from '../../src/types';

// Single API function backing the app's data layer. It exposes simple REST-ish
// routes for decks / pages / media (stored in Netlify Database) plus an asset
// endpoint that stores uploaded images & video in Netlify Blobs.

const ASSET_STORE = 'motion-deck-assets';

const json = (data: unknown, status = 200) =>
  new Response(data === null ? '' : JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const nowIso = () => new Date().toISOString();

// ─── Asset (Blobs) handlers ──────────────────────────────────────────────────

async function putAsset(req: Request): Promise<Response> {
  const { key, dataUrl } = (await req.json()) as { key: string; dataUrl: string };
  const match = /^data:(.*?);base64,(.*)$/s.exec(dataUrl);
  if (!key || !match) return json({ error: 'Invalid asset payload' }, 400);

  const contentType = match[1] || 'application/octet-stream';
  const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));

  const store = getStore(ASSET_STORE);
  await store.set(key, bytes.buffer, { metadata: { contentType } });
  return json({ url: `/api/assets/${key}` });
}

async function getAsset(key: string): Promise<Response> {
  const store = getStore(ASSET_STORE);
  const result = await store.getWithMetadata(key, { type: 'arrayBuffer' });
  if (!result) return new Response('Not found', { status: 404 });
  return new Response(result.data, {
    headers: {
      'Content-Type': (result.metadata.contentType as string) || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

// ─── Deck handlers ───────────────────────────────────────────────────────────

async function duplicateDeck(id: string): Promise<Response> {
  const [orig] = await db.select({ data: decks.data }).from(decks).where(eq(decks.id, id));
  if (!orig) return json({ error: 'Deck not found' }, 404);

  const newId = crypto.randomUUID();
  const now = nowIso();
  const newDeck: Deck = {
    ...orig.data,
    id: newId,
    title: `${orig.data.title} (Copy)`,
    status: 'draft',
    slug: newId,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(decks).values({ id: newId, slug: newId, updatedAt: new Date(now), data: newDeck });

  const pageRows = await db.select().from(pages).where(eq(pages.deckId, id)).orderBy(asc(pages.sortOrder));
  for (const p of pageRows) {
    const newPageId = crypto.randomUUID();
    const overlays = (p.data.overlays || []).map((o: Overlay) => ({ ...o, id: crypto.randomUUID(), pageId: newPageId }));
    const data: DeckPage = { ...p.data, id: newPageId, deckId: newId, overlays };
    await db.insert(pages).values({ id: newPageId, deckId: newId, sortOrder: p.sortOrder, data });
  }

  const mediaRows = await db.select().from(media).where(eq(media.deckId, id));
  for (const m of mediaRows) {
    const newMediaId = crypto.randomUUID();
    const data: MediaItem = { ...m.data, id: newMediaId, deckId: newId };
    await db.insert(media).values({ id: newMediaId, deckId: newId, data });
  }

  return json({ id: newId }, 201);
}

async function handleDecks(method: string, segments: string[], req: Request): Promise<Response> {
  // segments[0] === 'decks'
  const sub = segments[1];

  if (method === 'GET' && !sub) {
    const rows = await db.select({ data: decks.data }).from(decks).orderBy(desc(decks.updatedAt));
    return json(rows.map((r) => r.data));
  }

  if (method === 'GET' && sub === 'by-slug' && segments[2]) {
    const [row] = await db.select({ data: decks.data }).from(decks).where(eq(decks.slug, segments[2]));
    return row ? json({ id: row.data.id }) : json(null, 404);
  }

  if (method === 'POST' && !sub) {
    const body = (await req.json()) as Deck;
    await db.insert(decks).values({
      id: body.id,
      slug: body.slug,
      updatedAt: new Date(body.updatedAt),
      data: body,
    });
    return json(body, 201);
  }

  if (method === 'POST' && sub && segments[2] === 'duplicate') {
    return duplicateDeck(sub);
  }

  if (method === 'GET' && sub) {
    const [row] = await db.select({ data: decks.data }).from(decks).where(eq(decks.id, sub));
    return row ? json(row.data) : json(null, 404);
  }

  if (method === 'PATCH' && sub) {
    const changes = (await req.json()) as Partial<Deck>;
    const [row] = await db.select({ data: decks.data }).from(decks).where(eq(decks.id, sub));
    if (!row) return json(null, 404);
    const updated: Deck = { ...row.data, ...changes, updatedAt: nowIso() };
    await db
      .update(decks)
      .set({ data: updated, slug: updated.slug, updatedAt: new Date(updated.updatedAt) })
      .where(eq(decks.id, sub));
    return json(updated);
  }

  if (method === 'DELETE' && sub) {
    await db.delete(pages).where(eq(pages.deckId, sub));
    await db.delete(media).where(eq(media.deckId, sub));
    await db.delete(decks).where(eq(decks.id, sub));
    return json({ ok: true });
  }

  return json({ error: 'Not found' }, 404);
}

// ─── Page handlers ───────────────────────────────────────────────────────────

async function handlePages(method: string, segments: string[], req: Request, url: URL): Promise<Response> {
  const sub = segments[1];

  if (method === 'GET' && !sub) {
    const deckId = url.searchParams.get('deckId');
    if (!deckId) return json([]);
    const rows = await db
      .select({ data: pages.data })
      .from(pages)
      .where(eq(pages.deckId, deckId))
      .orderBy(asc(pages.sortOrder));
    return json(rows.map((r) => r.data));
  }

  if (method === 'GET' && sub) {
    const [row] = await db.select({ data: pages.data }).from(pages).where(eq(pages.id, sub));
    return row ? json(row.data) : json(null, 404);
  }

  if (method === 'POST' && !sub) {
    const body = (await req.json()) as DeckPage;
    await db.insert(pages).values({
      id: body.id,
      deckId: body.deckId,
      sortOrder: body.order ?? 0,
      data: body,
    });
    return json(body, 201);
  }

  if (method === 'PATCH' && sub) {
    const changes = (await req.json()) as Partial<DeckPage>;
    const [row] = await db.select({ data: pages.data }).from(pages).where(eq(pages.id, sub));
    if (!row) return json(null, 404);
    const updated: DeckPage = { ...row.data, ...changes };
    await db
      .update(pages)
      .set({ data: updated, sortOrder: updated.order ?? 0 })
      .where(eq(pages.id, sub));
    return json(updated);
  }

  if (method === 'DELETE' && sub) {
    await db.delete(pages).where(eq(pages.id, sub));
    return json({ ok: true });
  }

  return json({ error: 'Not found' }, 404);
}

// ─── Media handlers ──────────────────────────────────────────────────────────

async function handleMedia(method: string, segments: string[], req: Request, url: URL): Promise<Response> {
  const sub = segments[1];

  if (method === 'GET' && !sub) {
    const deckId = url.searchParams.get('deckId');
    if (!deckId) return json([]);
    const rows = await db.select({ data: media.data }).from(media).where(eq(media.deckId, deckId));
    return json(rows.map((r) => r.data));
  }

  if (method === 'POST' && !sub) {
    const body = (await req.json()) as MediaItem;
    await db.insert(media).values({ id: body.id, deckId: body.deckId, data: body });
    return json(body, 201);
  }

  if (method === 'DELETE' && sub) {
    await db.delete(media).where(eq(media.id, sub));
    return json({ ok: true });
  }

  return json({ error: 'Not found' }, 404);
}

// ─── Router ──────────────────────────────────────────────────────────────────

export default async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const segments = url.pathname.replace(/^\/api\//, '').split('/').filter(Boolean);
  const resource = segments[0];
  const method = req.method.toUpperCase();

  try {
    if (resource === 'assets') {
      if (method === 'POST') return await putAsset(req);
      if (method === 'GET') return await getAsset(segments.slice(1).join('/'));
      return json({ error: 'Method not allowed' }, 405);
    }
    if (resource === 'decks') return await handleDecks(method, segments, req);
    if (resource === 'pages') return await handlePages(method, segments, req, url);
    if (resource === 'media') return await handleMedia(method, segments, req, url);
    return json({ error: 'Not found' }, 404);
  } catch (err) {
    console.error('API error', err);
    return json({ error: 'Internal server error' }, 500);
  }
};

export const config: Config = {
  path: '/api/*',
};
