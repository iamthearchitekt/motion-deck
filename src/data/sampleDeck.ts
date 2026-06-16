import type { Deck, DeckPage } from '../types';

// Generate a canvas-based placeholder PNG data URL with a clean neutral look
function makePlaceholderPage(
  pageNumber: number,
  totalPages: number,
  width = 1920,
  height = 1080
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Clean dark background
  ctx.fillStyle = '#0f0f11';
  ctx.fillRect(0, 0, width, height);

  // Subtle grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  const gridSize = 60;
  for (let x = 0; x <= width; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = 0; y <= height; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }

  // Center placeholder box
  const boxW = width * 0.5;
  const boxH = height * 0.5;
  const boxX = (width - boxW) / 2;
  const boxY = (height - boxH) / 2;

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  // Diagonal cross lines inside box
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.beginPath(); ctx.moveTo(boxX, boxY); ctx.lineTo(boxX + boxW, boxY + boxH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(boxX + boxW, boxY); ctx.lineTo(boxX, boxY + boxH); ctx.stroke();

  // Page number label
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.font = `500 ${Math.round(height * 0.025)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(`Page ${pageNumber} of ${totalPages}`, width / 2, height / 2 + Math.round(height * 0.015));

  // "Upload your design" hint
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.font = `400 ${Math.round(height * 0.018)}px Inter, system-ui, sans-serif`;
  ctx.fillText('Replace with your PNG design', width / 2, height / 2 + Math.round(height * 0.065));

  return canvas.toDataURL('image/png');
}

export async function seedSampleDeck(): Promise<{ deck: Deck; pages: DeckPage[] }> {
  const deckId = 'sample-deck-starter';
  const now = new Date().toISOString();

  const pageId = 'sample-page-0';

  const pages: DeckPage[] = [
    {
      id: pageId,
      deckId,
      title: 'Page 1',
      order: 0,
      imageUrl: undefined,
      imageDataUrl: undefined,
      imageWidth: 1920,
      imageHeight: 1080,
      aspectRatio: 16 / 9,
      overlays: [],
      _placeholderConfig: { pageNumber: 1, totalPages: 1 },
    } as DeckPage & { _placeholderConfig: { pageNumber: number; totalPages: number } },
  ];

  const deck: Deck = {
    id: deckId,
    title: 'Sample Deck',
    clientName: '',
    projectName: '',
    preparedBy: '',
    proposalDate: '',
    internalNotes: 'This is a starter deck. Upload your PNG pages to replace the placeholders.',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    slug: deckId,
    transitionStyle: 'fade',
    transitionSpeed: 'medium',
    slideSize: '16:9',
  };

  return { deck, pages };
}

export { makePlaceholderPage };
