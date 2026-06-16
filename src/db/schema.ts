import Dexie, { type Table } from 'dexie';
import type { Deck, DeckPage, MediaItem } from '../types';

export class MotionDeckDB extends Dexie {
  decks!: Table<Deck>;
  pages!: Table<DeckPage>;
  media!: Table<MediaItem>;

  constructor() {
    super('MotionDeckDB');
    this.version(1).stores({
      decks: 'id, status, clientName, updatedAt',
      pages: 'id, deckId, order',
      media: 'id, deckId, type',
    });
    // Version 2: adds slideSize field — migrate existing decks to default '16:9'
    this.version(2).stores({
      decks: 'id, status, clientName, updatedAt, slideSize, slug',
      pages: 'id, deckId, order',
      media: 'id, deckId, type',
    }).upgrade(tx => {
      return tx.table('decks').toCollection().modify(deck => {
        if (!deck.slideSize) deck.slideSize = '16:9';
      });
    });
    // Version 3: adds showPaddingBranding
    this.version(3).stores({
      decks: 'id, status, clientName, updatedAt, slideSize, slug, showPaddingBranding',
      pages: 'id, deckId, order',
      media: 'id, deckId, type',
    }).upgrade(tx => {
      return tx.table('decks').toCollection().modify(deck => {
        if (deck.showPaddingBranding === undefined) deck.showPaddingBranding = false;
      });
    });
    // Version 4: adds brandingImageUrl and brandingImageDataUrl
    this.version(4).stores({
      decks: 'id, status, clientName, updatedAt, slideSize, slug, showPaddingBranding, brandingImageUrl, brandingImageDataUrl',
      pages: 'id, deckId, order',
      media: 'id, deckId, type',
    });
  }
}

export const db = new MotionDeckDB();
