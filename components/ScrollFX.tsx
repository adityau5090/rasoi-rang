'use client';
import { useEffect } from 'react';

/** Publishes scroll position as CSS variables (--sy, --p) and a data-scrolled flag; the stylesheet does the rest. */
export default function ScrollFX() {
  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;
    const update = () => {
      raf = 0;
      const y = window.scrollY;
      const max = Math.max(1, root.scrollHeight - window.innerHeight);
      root.style.setProperty('--p', String(Math.min(1, y / max)));
      root.style.setProperty('--sy', String(Math.min(y, 900)));
      if (y > 12) root.setAttribute('data-scrolled', ''); else root.removeAttribute('data-scrolled');
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return null;
}
