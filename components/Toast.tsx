'use client';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Kind = 'info' | 'warn' | 'err';
const ToastCtx = createContext<(msg: string, kind?: Kind) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<{ id: number; msg: string; kind: Kind }[]>([]);
  const push = useCallback((msg: string, kind: Kind = 'info') => {
    const id = Math.random();
    setList((l) => [...l.slice(-3), { id, msg, kind }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 5500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {list.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.msg}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}
