'use client';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useLive } from './useLive';
import type { Order } from '../shared';

/**
 * A customer's order history. There are no customer accounts: the browser remembers the private
 * token of each order it placed (localStorage) and asks the server for those orders, live.
 */
const KEY = 'rr_orders_v2';
const EVENT = 'rr-orders';

export function readTokens(): string[] {
  try {
    const list: string[] = JSON.parse(localStorage.getItem(KEY) || '[]');
    const legacy = localStorage.getItem('rr_last_order'); // saved by the first version
    const out = Array.isArray(list) ? list.filter((t) => typeof t === 'string') : [];
    if (legacy && !out.includes(legacy)) out.unshift(legacy);
    return out.slice(0, 20);
  } catch { return []; }
}
export function addToken(token: string) {
  try {
    const next = [token, ...readTokens().filter((t) => t !== token)].slice(0, 20);
    localStorage.setItem(KEY, JSON.stringify(next));
    localStorage.removeItem('rr_last_order');
    window.dispatchEvent(new Event(EVENT));
  } catch { /* private mode: history just won't persist */ }
}
export function clearTokens() {
  try { localStorage.removeItem(KEY); localStorage.removeItem('rr_last_order'); window.dispatchEvent(new Event(EVENT)); } catch { /* ignore */ }
}

type Ctx = { orders: Order[]; active: Order[]; loading: boolean; live: boolean; hasHistory: boolean; error: Error | null; refetch: () => void };
const MyOrdersCtx = createContext<Ctx>({ orders: [], active: [], loading: true, live: false, hasHistory: false, error: null, refetch: () => {} });
export const useMyOrders = () => useContext(MyOrdersCtx);

export function MyOrdersProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [tokens, setTokens] = useState<string[] | null>(null);
  useEffect(() => {
    const sync = () => setTokens(readTokens());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);

  const list = tokens ?? [];
  const key = ['my-orders', list.join(',')];
  const q = useQuery({
    queryKey: key,
    enabled: list.length > 0,
    queryFn: async () => (await api<{ orders: Order[] }>('/api/my-orders', { method: 'POST', body: { tokens: list } })).orders,
    refetchInterval: 60_000, // safety net; the stream does the real work
  });
  const live = useLive(
    list.length ? `/api/my-orders/stream?tokens=${encodeURIComponent(list.join(','))}` : null,
    { order: (o: Order) => qc.setQueryData<Order[]>(key, (prev) => prev?.map((x) => (x.token === o.token ? o : x))) },
    () => qc.invalidateQueries({ queryKey: key }),
  );

  const value = useMemo<Ctx>(() => {
    const orders = q.data ?? [];
    return {
      orders, active: orders.filter((o) => o.status !== 'served'),
      loading: tokens === null || (list.length > 0 && q.isLoading), live, hasHistory: list.length > 0,
      error: (q.error as Error) ?? null, refetch: () => { void q.refetch(); },
    };
  }, [q.data, q.isLoading, q.error, tokens, live]); // eslint-disable-line react-hooks/exhaustive-deps
  return <MyOrdersCtx.Provider value={value}>{children}</MyOrdersCtx.Provider>;
}
