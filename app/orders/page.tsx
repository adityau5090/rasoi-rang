'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { clearTokens, useMyOrders } from '@/lib/client/myOrders';
import { Header } from '@/components/Chrome';
import { Mandala } from '@/components/Ornaments';
import OrderProgress from '@/components/OrderProgress';
import Reveal from '@/components/Reveal';
import { clock, timeAgo } from '@/lib/client/time';
import { inr, STATUS_LABEL, type Order } from '@/lib/shared';

function OrderCard({ o, i, now }: { o: Order; i: number; now: number }) {
  const lines = o.items.slice(0, 3).map((it) => `${it.qty}× ${it.name}`).join(', ');
  const more = o.items.length - 3;
  const open = o.status !== 'served';
  return (
    <Reveal i={i}>
      <Link href={`/order/${o.token}`} className={`ocard ${open ? 'open' : ''} s-${o.status}`}>
        <div className="onum"><span className="hi">#{o.number}</span><small>{clock(o.createdAt)}</small></div>
        <div className="obody">
          <div className="orow">
            <b>{o.type === 'dine_in' ? `Table ${o.tableNumber}` : `Takeaway${o.customerName ? ` · ${o.customerName}` : ''}`}</b>
            <span className={`pill ${o.status}`}>{STATUS_LABEL[o.status].en}</span>
          </div>
          <p className="olines">{lines}{more > 0 && ` +${more} more`}</p>
          <OrderProgress status={o.status} />
          <div className="orow foot-row">
            <span className="muted">{timeAgo(o.createdAt, now)}</span>
            <span><b className="price" style={{ fontSize: '1.2rem' }}>{inr(o.totalPaise)}</b> <span className="trk">{open ? 'Track' : 'View'}</span></span>
          </div>
        </div>
      </Link>
    </Reveal>
  );
}

export default function MyOrders() {
  const { orders, active, loading, live, hasHistory, error, refetch } = useMyOrders();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  const past = orders.filter((o) => o.status === 'served');

  return (
    <>
      <Header sub="My orders" />
      <main className="shell page-in">
        <div className="page-title">
          <h2>My orders</h2>
          {hasHistory && <span className={`live ${live ? '' : 'off'}`}><i />{live ? 'Updating live' : 'Reconnecting…'}</span>}
        </div>
        {loading && <div className="skel-list" aria-hidden="true">{[0, 1, 2].map((k) => <div key={k} className="skel" style={{ height: 140, marginBottom: 14, borderRadius: 14 }} />)}</div>}
        {error && <div className="banner" role="alert">{error.message} <button className="btn small" onClick={refetch}>Try again</button></div>}

        {!loading && !hasHistory && (
          <div className="empty-state">
            <div className="spin-slow"><Mandala size={96} /></div>
            <h3>No orders yet</h3>
            <p>Orders you place on this device appear here, and update live as the kitchen cooks them.</p>
            <Link className="btn" href="/">Browse the menu</Link>
          </div>
        )}

        {active.length > 0 && (
          <section aria-label="Active orders">
            <h3 className="sect">In the kitchen <span className="count">{active.length}</span></h3>
            {active.map((o, i) => <OrderCard key={o.token} o={o} i={i} now={now} />)}
          </section>
        )}
        {past.length > 0 && (
          <section aria-label="Past orders">
            <h3 className="sect">Past orders <span className="count">{past.length}</span></h3>
            {past.map((o, i) => <OrderCard key={o.token} o={o} i={i} now={now} />)}
          </section>
        )}
        {!loading && hasHistory && orders.length === 0 && !error && <p className="empty">We could not find those orders any more.</p>}

        {hasHistory && (
          <p className="muted" style={{ textAlign: 'center', fontSize: '.9rem', margin: '24px 0 40px' }}>
            Your orders are remembered on this device only.{' '}
            <button className="linklike" onClick={() => { if (confirm('Remove all orders from this device? The restaurant keeps its records.')) clearTokens(); }}>Clear history</button>
          </p>
        )}
      </main>
    </>
  );
}
