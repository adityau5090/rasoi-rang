'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/** The cart stores ONLY ids and quantities. Prices shown in the UI come from the live menu; the server recomputes at checkout. */
export type CartLine = { itemId: number; variantId: number; qty: number };
type Ctx = {
  lines: CartLine[]; ready: boolean;
  add: (itemId: number, variantId: number) => void;
  setQty: (variantId: number, qty: number) => void;
  removeMany: (variantIds: number[]) => void;
  clear: () => void;
};
const KEY = 'rr_cart_v1';
const CartCtx = createContext<Ctx>(null as unknown as Ctx);
export const useCart = () => useContext(CartCtx);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (Array.isArray(raw)) setLines(raw.filter((l) => Number.isInteger(l?.itemId) && Number.isInteger(l?.variantId) && l.qty >= 1 && l.qty <= 20));
    } catch { /* corrupted storage: start empty */ }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* private mode */ } }, [lines, ready]);

  const add = useCallback((itemId: number, variantId: number) =>
    setLines((ls) => {
      const f = ls.find((l) => l.variantId === variantId);
      if (!f) return [...ls, { itemId, variantId, qty: 1 }];
      return ls.map((l) => (l.variantId === variantId ? { ...l, qty: Math.min(20, l.qty + 1) } : l));
    }), []);
  const setQty = useCallback((variantId: number, qty: number) =>
    setLines((ls) => (qty <= 0 ? ls.filter((l) => l.variantId !== variantId) : ls.map((l) => (l.variantId === variantId ? { ...l, qty: Math.min(20, qty) } : l)))), []);
  const removeMany = useCallback((ids: number[]) => setLines((ls) => ls.filter((l) => !ids.includes(l.variantId))), []);
  const clear = useCallback(() => setLines([]), []);
  const value = useMemo(() => ({ lines, ready, add, setQty, removeMany, clear }), [lines, ready, add, setQty, removeMany, clear]);
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}
