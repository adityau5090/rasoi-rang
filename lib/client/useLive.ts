'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Subscribes to a Server-Sent Events stream. The browser's EventSource reconnects by itself;
 * `onOpen` fires on every (re)connect so callers can re-sync anything they missed while offline.
 */
export function useLive(url: string | null, handlers: Record<string, (data: any) => void>, onOpen?: () => void) {
  const h = useRef(handlers); h.current = handlers;
  const o = useRef(onOpen); o.current = onOpen;
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!url) return;
    const es = new EventSource(url);
    es.onopen = () => { setConnected(true); o.current?.(); };
    es.onerror = () => setConnected(false);
    for (const name of Object.keys(h.current)) {
      es.addEventListener(name, (e) => {
        try { h.current[name](JSON.parse((e as MessageEvent).data)); } catch { /* ignore bad frame */ }
      });
    }
    return () => es.close();
  }, [url]);
  return connected;
}
