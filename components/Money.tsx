'use client';
import { useEffect, useRef, useState } from 'react';
import { inr } from '@/lib/shared';

/** Rupee amount that counts smoothly up or down to its new value. */
export default function Money({ paise }: { paise: number }) {
  const [v, setV] = useState(paise);
  const from = useRef(paise);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(paise); from.current = paise; return; }
    const start = performance.now(), a = from.current, d = 420;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / d);
      const val = Math.round(a + (paise - a) * (1 - Math.pow(1 - k, 3)));
      setV(val); from.current = val;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paise]);
  return <>{inr(v)}</>;
}
