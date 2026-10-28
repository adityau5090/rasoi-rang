'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/client/api';
import { useLive } from '@/lib/client/useLive';
import { addToken } from '@/lib/client/myOrders';
import { Header } from '@/components/Chrome';
import { Diya } from '@/components/Ornaments';
import Petals from '@/components/Petals';
import { inr, showLabel, STATUSES, STATUS_LABEL, type Order } from '@/lib/shared';

export default function OrderPage() {
  const { token } = useParams<{ token: string }>();
  const qc = useQueryClient();
  const key = ['order', token];
  const q = useQuery({
    queryKey: key,
    queryFn: () => api<Order>(`/api/orders/${token}`),
    refetchInterval: 30_000, // safety net only; the stream does the real work
    retry: (n, e) => !(e instanceof ApiError && e.status === 404) && n < 2,
  });
  const live = useLive(`/api/orders/${token}/stream`, { order: (o: Order) => qc.setQueryData(key, o) });

  const o = q.data;
  const step = o ? STATUSES.indexOf(o.status) : -1;

  // Opening an order link on a new device adds it to "My orders" there too.
  useEffect(() => { if (o) addToken(o.token); }, [o?.token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Marigold petals when the food is ready or served.
  const [burst, setBurst] = useState(false);
  const prev = useRef<string | null>(null);
  useEffect(() => {
    if (!o) return;
    if (prev.current !== o.status && (o.status === 'ready' || o.status === 'served')) {
      setBurst(true);
      const t = setTimeout(() => setBurst(false), 7000);
      prev.current = o.status;
      return () => clearTimeout(t);
    }
    prev.current = o.status;
  }, [o?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Header sub="Order status" />
      {burst && <Petals />}
      <main className="shell page-in">
        {q.isLoading && <div className="skel" style={{ height: 380, maxWidth: 640, margin: '24px auto', borderRadius: 24 }} aria-label="Finding your order" />}
        {q.isError && (
          <div className="banner" role="alert" style={{ marginTop: 24 }}>
            {(q.error as Error).message} <Link href="/">Back to the menu</Link>
          </div>
        )}
        {o && (
          <article className="track-card">
            <div className="orderno">
              <div className="big">#{o.number}</div>
              <span className="chip">{o.type === 'dine_in' ? `Table ${o.tableNumber}` : `Takeaway${o.customerName ? ` · ${o.customerName}` : ''}`}</span>
              <div style={{ marginTop: 8 }}>
                <span className={`live ${live ? '' : 'off'}`}><i />{live ? 'Live updates on' : 'Reconnecting…'}</span>
              </div>
            </div>
            <ol className="diyas" style={{ listStyle: 'none', padding: 0 }} aria-label="Order progress">
              <div className="thread" style={{ ['--fill' as string]: Math.max(0, step) / 3 }} aria-hidden="true" />
              {STATUSES.map((s, i) => (
                <li key={s} className={`step ${i < step ? 'done' : ''} ${i === step ? 'now done' : ''}`} aria-current={i === step ? 'step' : undefined}>
                  <Diya lit={i <= step} />
                  {STATUS_LABEL[s].en}
                  <span className="hi">{STATUS_LABEL[s].hi}</span>
                </li>
              ))}
            </ol>
            <p key={o.status} className="statusmsg swap" role="status" aria-live="polite">{STATUS_LABEL[o.status].msg}</p>
            <table className="bill">
              <tbody>
                {o.items.map((it, i) => (
                  <tr key={i}>
                    <td>{it.qty} × {it.name}{showLabel(it.variantLabel) && ` (${it.variantLabel})`}</td>
                    <td>{inr(it.unitPricePaise * it.qty)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td>Total</td><td>{inr(o.totalPaise)}</td></tr></tfoot>
            </table>
            {o.note && <p style={{ fontStyle: 'italic' }}>Your note: {o.note}</p>}
            <p style={{ textAlign: 'center', marginTop: 18, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link className="btn small" href="/orders">All my orders</Link>
              <Link className="btn small ghost" href="/">Order something more</Link>
            </p>
          </article>
        )}
      </main>
    </>
  );
}
