/** A little marigold bead flies from the Add button to the cart, so people see where the dish went. */
export function flyToCart(from: Element) {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const visible = (e: Element) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  };
  const target = Array.from(document.querySelectorAll('[data-cart-anchor]')).find(visible);
  const a = from.getBoundingClientRect();
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
  let x1 = innerWidth / 2, y1 = innerHeight - 40;
  if (target) { const t = target.getBoundingClientRect(); x1 = t.left + t.width / 2; y1 = t.top + t.height / 2; }
  const dot = document.createElement('div');
  dot.className = 'fly';
  document.body.appendChild(dot);
  dot.animate(
    [
      { transform: `translate(${x0}px, ${y0}px) scale(1)`, opacity: 1 },
      { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - 90}px) scale(1.3)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${x1}px, ${y1}px) scale(.35)`, opacity: 0.3 },
    ],
    { duration: 650, easing: 'cubic-bezier(.45,.05,.55,.95)' },
  ).onfinish = () => dot.remove();
}
