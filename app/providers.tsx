'use client';
import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CartProvider } from '@/lib/client/cart';
import { ToastProvider } from '@/components/Toast';
import { MyOrdersProvider } from '@/lib/client/myOrders';
import ScrollFX from '@/components/ScrollFX';

export default function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: true, retry: 1 } } }));
  return (
    <QueryClientProvider client={qc}>
      <ToastProvider><CartProvider><MyOrdersProvider><ScrollFX />{children}</MyOrdersProvider></CartProvider></ToastProvider>
    </QueryClientProvider>
  );
}
