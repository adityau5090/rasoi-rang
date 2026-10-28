'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/client/api';
import { useCart } from '@/lib/client/cart';
import { addToken } from '@/lib/client/myOrders';
import Money from './Money';
import { inr, type Item, type Variant } from '@/lib/shared';

type Index = Map<number, { item: Item; variant: Variant }>;

export default function CartPanel({ index, onClose }: { index: Index; onClose: () => void }) {
  const cart = useCart();
  const router = useRouter();
  const qc = useQueryClient();
  const [type, setType] = useState<'dine_in' | 'takeaway'>('dine_in');
  const [table, setTable] = useState('');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');

  const rows = cart.lines.flatMap((l) => {
    const e = index.get(l.variantId);
    return e ? [{ ...l, e }] : [];
  });
  // Display-only estimate. The server recalculates from the menu and returns the real total.
  const estimate = rows.reduce((s, r) => s + r.e.variant.pricePaise * r.qty, 0);

  const place = useMutation({
    mutationFn: () =>
      api<{ token: string }>('/api/orders', {
        method: 'POST',
        body: {
          type,
          tableNumber: type === 'dine_in' && table.trim() !== '' ? Number(table) : undefined,
          customerName: name,
          note,
          lines: cart.lines.map(({ itemId, variantId, qty }) => ({ itemId, variantId, qty })),
        },
      }),
    onSuccess: (r) => {
      cart.clear();
      addToken(r.token); // remember it so it shows up under "My orders"
      router.push(`/order/${r.token}`);
    },
    onError: (e) => {
      if (e instanceof ApiError && (e.code === 'SOLD_OUT' || e.code === 'MENU_CHANGED')) qc.invalidateQueries({ queryKey: ['menu'] });
    },
  });
  const err = place.error instanceof ApiError ? place.error : place.error ? new ApiError('Something went wrong', 0) : null;
  const f = err?.fields ?? {};
  const generic = err && (!Object.keys(f).length || err.code === 'SOLD_OUT' || err.code === 'MENU_CHANGED' || err.status === 429 || err.status === 0);

  return (
    <div className="cart">
      <h2 data-cart-anchor>
        <span>Your thali{rows.length > 0 && <span className="badge small-badge">{cart.lines.reduce((n, l) => n + l.qty, 0)}</span>}</span>
        <button className="btn ghost small close-cart" onClick={onClose} aria-label="Close cart">Close</button>
      </h2>
      <div className="divider">✦</div>
      {rows.length === 0 ? (
        <p className="empty">Your plate is empty. Add a dish from the menu to begin.</p>
      ) : (
        <>
          {rows.map(({ itemId, variantId, qty, e }) => (
            <div className="cline" key={variantId}>
              <div>
                <b>{e.item.name}</b>
                {e.item.variants.length > 1 && <small> · {e.variant.label}</small>}
                <br /><small>{inr(e.variant.pricePaise)} each</small>
              </div>
              <div className="stepper" role="group" aria-label={`Quantity of ${e.item.name}`}>
                <button onClick={() => cart.setQty(variantId, qty - 1)} aria-label="Remove one">−</button>
                <span aria-live="polite">{qty}</span>
                <button onClick={() => cart.setQty(variantId, qty + 1)} aria-label="Add one" disabled={qty >= 20}>+</button>
              </div>
            </div>
          ))}
          <div className="total"><span>Total</span><span className="price"><Money paise={estimate} /></span></div>
          <p className="lbl" style={{ margin: '0 0 8px', fontWeight: 400, fontSize: '.85rem', color: 'var(--ink-soft)' }}>
            The kitchen confirms the final bill from the menu when you place the order.
          </p>

          <div className="seg" role="group" aria-label="Order type">
            <button type="button" aria-pressed={type === 'dine_in'} onClick={() => setType('dine_in')}>At my table</button>
            <button type="button" aria-pressed={type === 'takeaway'} onClick={() => setType('takeaway')}>Takeaway</button>
          </div>
          {type === 'dine_in' ? (
            <div className="field">
              <label htmlFor="table">Table number</label>
              <input id="table" className="input" inputMode="numeric" value={table} onChange={(e) => setTable(e.target.value.replace(/\D/g, '').slice(0, 2))}
                aria-invalid={!!f.tableNumber} aria-describedby="table-err" placeholder="e.g. 7" />
              {f.tableNumber && <p id="table-err" className="err">{f.tableNumber}</p>}
            </div>
          ) : (
            <div className="field">
              <label htmlFor="cname">Name for pickup</label>
              <input id="cname" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-invalid={!!f.customerName} placeholder="e.g. Arjun" />
              {f.customerName && <p className="err">{f.customerName}</p>}
            </div>
          )}
          <div className="field">
            <label htmlFor="note">Note for the kitchen (optional)</label>
            <textarea id="note" className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} aria-invalid={!!f.note} placeholder="Less spicy, no onion…" />
            {f.note && <p className="err">{f.note}</p>}
          </div>
          {generic && <div className="banner" role="alert">{err!.message}</div>}
          <button className="btn red block" disabled={place.isPending} onClick={() => place.mutate()}>
            {place.isPending ? 'Placing your order…' : `Place order · ${inr(estimate)}`}
          </button>
        </>
      )}
    </div>
  );
}
