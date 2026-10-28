'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/client/api';
import { useLive } from '@/lib/client/useLive';
import { useRequireRole } from '@/lib/client/useMe';
import { alarmLate, chimeNew, enableSound } from '@/lib/client/sound';
import { useToast } from '@/components/Toast';
import { Header, StaffBar } from '@/components/Chrome';
import { STATUSES, STATUS_LABEL, showLabel, type Order, type Status } from '@/lib/shared';

const LATE_MS = (Number(process.env.NEXT_PUBLIC_LATE_MINUTES) || 15) * 60_000;
const NEXT: Record<Status, { to: Status; label: string } | null> = {
  received: { to: 'preparing', label: 'Start preparing' },
  preparing: { to: 'ready', label: 'Mark ready' },
  ready: { to: 'served', label: 'Mark served' },
  served: null,
};

const minutes = (ms: number) => Math.max(0, Math.floor(ms / 60_000));

function Ticket({ o, age, late, busy, onNext }: { o: Order; age: number; late: boolean; busy: boolean; onNext: () => void }) {
  const next = NEXT[o.status];
  return (
    <article className={`ticket ${late ? 'late' : ''}`} aria-label={`Order ${o.number}`}>
      <div className="row">
        <span className="no">#{o.number}</span>
        <span className="where">{o.type === 'dine_in' ? `Table ${o.tableNumber}` : `Takeaway${o.customerName ? ` · ${o.customerName}` : ''}`}</span>
      </div>
      <div className="row">
        <span className="age">{minutes(age)} min ago</span>
        {late && <span className="latetag">Waiting too long</span>}
      </div>
      <ul>
        {o.items.map((it, i) => (
          <li key={i}><b>{it.qty}×</b> {it.name}{showLabel(it.variantLabel) && <em> ({it.variantLabel})</em>}</li>
        ))}
      </ul>
      {o.note && <div className="note">“{o.note}”</div>}
      {o.type === 'dine_in' && o.customerName && <small>For {o.customerName}</small>}
      {next && <button className="btn teal block" disabled={busy} onClick={onNext}>{busy ? 'Updating…' : next.label}</button>}
    </article>
  );
}

export default function Kitchen() {
  const { me, allowed, loading } = useRequireRole(['kitchen', 'admin'], '/kitchen');
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<Status>('received');
  const [sound, setSound] = useState(false);
  const soundRef = useRef(false); soundRef.current = sound;
  const [tick, setTick] = useState(0);
  const skew = useRef(0);
  const alerted = useRef(new Set<number>());

  useEffect(() => { document.body.classList.add('night'); return () => document.body.classList.remove('night'); }, []);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 10_000); return () => clearInterval(t); }, []);

  const board = useQuery({
    queryKey: ['kitchen'],
    enabled: allowed,
    queryFn: async () => { const r = await api<{ now: number; orders: Order[] }>('/api/kitchen/orders'); skew.current = r.now - Date.now(); return r; },
    refetchInterval: 30_000,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['kitchen'] });
  const live = useLive(allowed ? '/api/kitchen/stream' : null, {
    created: () => { if (soundRef.current) chimeNew(); refresh(); },
    updated: refresh,
  }, refresh);

  const advance = useMutation({
    mutationFn: (v: { id: number; to: Status }) => api<Order>(`/api/kitchen/orders/${v.id}`, { method: 'PATCH', body: { status: v.to } }),
    onSettled: refresh,
    onError: (e) => toast(e instanceof ApiError ? e.message : 'Could not update the order', 'err'),
  });

  const now = Date.now() + skew.current;
  void tick;
  const orders = board.data?.orders ?? [];
  const isLate = (o: Order) => (o.status === 'received' || o.status === 'preparing') && now - o.createdAt > LATE_MS;

  // Beep once per order when it crosses the 15-minute line.
  useEffect(() => {
    for (const o of orders) {
      if (isLate(o) && !alerted.current.has(o.id)) {
        alerted.current.add(o.id);
        if (soundRef.current) alarmLate();
      }
    }
  }); // runs every render, cheap

  if (loading) return <><Header staff night sub="Kitchen" /><p className="empty">Opening the kitchen…</p></>;
  if (!allowed)
    return <><Header staff night sub="Kitchen" /><main className="shell"><p className="banner" style={{ marginTop: 24 }}>Please <Link href="/login?next=/kitchen">sign in</Link> with a kitchen or admin account.</p></main></>;

  const lateCount = orders.filter(isLate).length;
  return (
    <>
      <Header staff night sub="Rasoi · kitchen screen" />
      <StaffBar me={me} />
      <main className="shell">
        <div className="k-top">
          <h2>Orders on the stove</h2>
          <span style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className={`live ${live ? '' : 'off'}`}><i />{live ? 'Live' : 'Reconnecting…'}</span>
            {lateCount > 0 && <span className="latetag">{lateCount} late</span>}
            <button className="btn small" onClick={() => { if (!sound) enableSound(); setSound(!sound); }} aria-pressed={sound}>
              {sound ? 'Sound on' : 'Turn sound on'}
            </button>
          </span>
        </div>
        {board.isError && <div className="banner" role="alert">{(board.error as Error).message}</div>}
        <div className="tabs" role="tablist" aria-label="Order stages">
          {STATUSES.map((s) => (
            <button key={s} role="tab" aria-selected={tab === s} onClick={() => setTab(s)}>
              {STATUS_LABEL[s].en} ({orders.filter((o) => o.status === s).length})
            </button>
          ))}
        </div>
        <div className="board">
          {STATUSES.map((s) => {
            const list = orders.filter((o) => o.status === s);
            const shown = s === 'served' ? [...list].reverse().slice(0, 15) : list;
            return (
              <section key={s} className={`col ${tab === s ? 'active' : ''}`} aria-label={STATUS_LABEL[s].en}>
                <div className="col-head"><h3>{STATUS_LABEL[s].en} <span className="hi" style={{ fontSize: '.9rem' }}>{STATUS_LABEL[s].hi}</span> · {list.length}</h3></div>
                <div className="col-body">
                  {board.isLoading && <p className="empty">Loading…</p>}
                  {!board.isLoading && shown.length === 0 && <p className="empty">Nothing here.</p>}
                  {shown.map((o) => (
                    <Ticket key={o.id} o={o} age={now - o.createdAt} late={isLate(o)}
                      busy={advance.isPending && advance.variables?.id === o.id}
                      onNext={() => NEXT[o.status] && advance.mutate({ id: o.id, to: NEXT[o.status]!.to })} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </>
  );
}
