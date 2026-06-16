import { useEffect, useRef, useState } from 'react';
import type { TransitionStyle, TransitionSpeed } from '../types';

const SPEED_MAP: Record<TransitionSpeed, string> = {
  slow: '0.9s',
  medium: '0.55s',
  fast: '0.3s',
};

interface Props {
  transitionStyle: TransitionStyle;
  transitionSpeed: TransitionSpeed;
  children: React.ReactNode;
}

export default function PageTransitionWrapper({ transitionStyle, transitionSpeed, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(transitionStyle === 'none');

  useEffect(() => {
    if (transitionStyle === 'none') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setVisible(true);
          }
        });
      },
      { threshold: 0.08 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [transitionStyle]);

  const duration = SPEED_MAP[transitionSpeed] || '0.55s';

  const cls = {
    none: 'deck-page-transition-none',
    fade: `deck-page-fade${visible ? ' visible' : ''}`,
    fadeUp: `deck-page-fade-up${visible ? ' visible' : ''}`,
  }[transitionStyle];

  return (
    <div
      ref={ref}
      className={cls}
      style={{ '--transition-duration': duration } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
