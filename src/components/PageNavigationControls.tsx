import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, LayoutGrid, X } from 'lucide-react';
import type { DeckPage } from '../types';
import { makePlaceholderPage } from '../data/sampleDeck';

interface Props {
  pages: DeckPage[];
  currentIndex: number;
  onNavigate: (index: number) => void;
}

export default function PageNavigationControls({ pages, currentIndex, onNavigate }: Props) {
  const [showThumbs, setShowThumbs] = useState(false);
  const [visible, setVisible] = useState(true);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetFade = useCallback(() => {
    setVisible(true);
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    fadeTimer.current = setTimeout(() => setVisible(false), 3500);
  }, []);

  useEffect(() => {
    resetFade();
    const onMove = () => resetFade();
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchstart', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchstart', onMove);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, [resetFade]);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        onNavigate(Math.min(currentIndex + 1, pages.length - 1));
        resetFade();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        onNavigate(Math.max(currentIndex - 1, 0));
        resetFade();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentIndex, pages.length, onNavigate, resetFade]);

  // Touch swipe
  useEffect(() => {
    let startX: number | null = null;
    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
    };
    const handleTouchEnd = (e: TouchEvent) => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) {
        onNavigate(dx < 0
          ? Math.min(currentIndex + 1, pages.length - 1)
          : Math.max(currentIndex - 1, 0));
        resetFade();
      }
      startX = null;
    };
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [currentIndex, pages.length, onNavigate, resetFade]);

  return null;
}
