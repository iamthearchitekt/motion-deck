import { pgTable, text, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import type { Deck, DeckPage, MediaItem } from '../src/types';

// The application data shapes (Deck / DeckPage / MediaItem) are rich and evolve
// frequently, so each row stores the full object as JSONB. A few hot fields are
// promoted to real columns so we can order and filter efficiently in SQL.

export const decks = pgTable(
  'decks',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    data: jsonb('data').$type<Deck>().notNull(),
  },
  (t) => [index('decks_slug_idx').on(t.slug)],
);

export const pages = pgTable(
  'pages',
  {
    id: text('id').primaryKey(),
    deckId: text('deck_id').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    data: jsonb('data').$type<DeckPage>().notNull(),
  },
  (t) => [index('pages_deck_id_idx').on(t.deckId)],
);

export const media = pgTable(
  'media',
  {
    id: text('id').primaryKey(),
    deckId: text('deck_id').notNull(),
    data: jsonb('data').$type<MediaItem>().notNull(),
  },
  (t) => [index('media_deck_id_idx').on(t.deckId)],
);
