'use client';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/** Fades and lifts its children into view the first time they scroll on screen. `i` staggers neighbours. */
export default function Reveal({ children, i = 0, className = '' }: { children: ReactNode; i?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) { setShown(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`reveal ${shown ? 'in' : ''} ${className}`} style={{ '--i': Math.min(i, 5) } as CSSProperties}>{children}</div>;
}
