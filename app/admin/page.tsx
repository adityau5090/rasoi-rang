'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/client/api';
import { useLive } from '@/lib/client/useLive';
import { useRequireRole } from '@/lib/client/useMe';
import { useToast } from '@/components/Toast';
import { Header, StaffBar } from '@/components/Chrome';
import { inr, STATUSES, STATUS_LABEL, type Category, type Item, type Menu, type Stats } from '@/lib/shared';

/* ───────── Today ───────── */
function Today() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['stats'], queryFn: () => api<Stats>('/api/admin/stats'), refetchInterval: 60_000 });
  const refresh = () => qc.invalidateQueries({ queryKey: ['stats'] });
  const live = useLive('/api/kitchen/stream', { created: refresh, updated: refresh }, refresh);
  if (q.isLoading) return <p className="empty">Counting the day’s orders…</p>;
  if (q.isError) return <div className="banner" role="alert">{(q.error as Error).message}</div>;
  const s = q.data!;
  return (
    <>
      <p><span className={`live ${live ? '' : 'off'}`}><i />{live ? 'Live' : 'Reconnecting…'}</span> · {s.day}</p>
      <div className="cards">
        <div className="stat"><div className="n">{inr(s.revenuePaise)}</div>Revenue today</div>
        <div className="stat"><div className="n">{s.orderCount}</div>Orders</div>
        <div className="stat"><div className="n">{inr(s.avgPaise)}</div>Average order</div>
        <div className="stat"><div className="n">{s.byStatus.received + s.byStatus.preparing + s.byStatus.ready}</div>Still open</div>
      </div>
      <div className="panel scroll-x">
        <table className="grid">
          <thead><tr><th>#</th><th>Time</th><th>For</th><th>Dishes</th><th>Status</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
          <tbody>
            {s.orders.length === 0 && <tr><td colSpan={6} className="empty">No orders yet today.</td></tr>}
            {s.orders.map((o) => (
              <tr key={o.id}>
                <td><b>{o.number}</b></td>
                <td>{new Date(o.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
                <td>{o.type === 'dine_in' ? `Table ${o.tableNumber}` : `Takeaway · ${o.customerName}`}</td>
                <td>{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</td>
                <td><span className={`pill ${o.status}`}>{STATUS_LABEL[o.status].en}</span></td>
                <td style={{ textAlign: 'right' }}>{inr(o.totalPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ───────── Menu management ───────── */
type Draft = { id?: number; categoryId: number; name: string; description: string; veg: boolean; available: boolean; variants: { id?: number; label: string; price: string }[] };
const toDraft = (i: Item): Draft => ({ ...i, variants: i.variants.map((v) => ({ id: v.id, label: v.label, price: String(v.pricePaise / 100) })) });

function ItemModal({ draft, cats, onClose }: { draft: Draft; cats: Category[]; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [d, setD] = useState<Draft>(draft);
  const save = useMutation({
    mutationFn: () => {
      const body = {
        categoryId: d.categoryId, name: d.name, description: d.description, veg: d.veg, available: d.available,
        variants: d.variants.map((v) => {
          const n = parseFloat(v.price);
          return { id: v.id, label: v.label, pricePaise: Number.isFinite(n) ? Math.round(n * 100) : null };
        }),
      };
      return d.id ? api(`/api/admin/items/${d.id}`, { method: 'PATCH', body }) : api('/api/admin/items', { method: 'POST', body });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['menu'] }); toast(d.id ? 'Dish updated' : 'Dish added'); onClose(); },
  });
  const e = save.error instanceof ApiError ? save.error : null;
  const f = e?.fields ?? {};
  const setV = (i: number, patch: Partial<Draft['variants'][number]>) => setD({ ...d, variants: d.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) });
  return (
    <div className="modal-bg" role="dialog" aria-modal="true" aria-label={d.id ? 'Edit dish' : 'Add dish'}>
      <form className="modal" onSubmit={(ev) => { ev.preventDefault(); save.mutate(); }} noValidate>
        <h2 style={{ color: 'var(--sindoor-deep)', marginBottom: 12 }}>{d.id ? 'Edit dish' : 'Add a dish'}</h2>
        {e && !Object.keys(f).length && <div className="banner" role="alert">{e.message}</div>}
        <div className="field">
          <label htmlFor="cat">Category</label>
          <select id="cat" className="input" value={d.categoryId} onChange={(x) => setD({ ...d, categoryId: Number(x.target.value) })}>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {f.categoryId && <p className="err">{f.categoryId}</p>}
        </div>
        <div className="field">
          <label htmlFor="nm">Dish name</label>
          <input id="nm" className="input" value={d.name} onChange={(x) => setD({ ...d, name: x.target.value })} aria-invalid={!!f.name} />
          {f.name && <p className="err">{f.name}</p>}
        </div>
        <div className="field">
          <label htmlFor="ds">Description</label>
          <textarea id="ds" className="input" value={d.description} onChange={(x) => setD({ ...d, description: x.target.value })} aria-invalid={!!f.description} />
          {f.description && <p className="err">{f.description}</p>}
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 12 }}>
          <label><input type="checkbox" checked={d.veg} onChange={(x) => setD({ ...d, veg: x.target.checked })} /> Vegetarian</label>
          <label><input type="checkbox" checked={d.available} onChange={(x) => setD({ ...d, available: x.target.checked })} /> Available to order</label>
        </div>
        <p className="lbl" style={{ marginBottom: 6 }}>Sizes and prices (₹)</p>
        {d.variants.map((v, i) => (
          <div key={i} className="vrow">
            <div>
              <input className="input" aria-label={`Size ${i + 1} name`} placeholder="Half / Full / Regular" value={v.label} onChange={(x) => setV(i, { label: x.target.value })} aria-invalid={!!f[`variants.${i}.label`]} />
              {f[`variants.${i}.label`] && <p className="err">{f[`variants.${i}.label`]}</p>}
            </div>
            <div>
              <input className="input" aria-label={`Size ${i + 1} price in rupees`} inputMode="decimal" placeholder="₹" value={v.price} onChange={(x) => setV(i, { price: x.target.value })} aria-invalid={!!f[`variants.${i}.pricePaise`]} />
              {f[`variants.${i}.pricePaise`] && <p className="err">{f[`variants.${i}.pricePaise`]}</p>}
            </div>
            <button type="button" className="btn ghost small" aria-label={`Remove size ${i + 1}`} disabled={d.variants.length === 1} onClick={() => setD({ ...d, variants: d.variants.filter((_, j) => j !== i) })}>✕</button>
          </div>
        ))}
        {f.variants && <p className="err">{f.variants}</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '4px 0 16px' }}>
          <button type="button" className="btn small" disabled={d.variants.length >= 4} onClick={() => setD({ ...d, variants: [...d.variants, { label: '', price: '' }] })}>Add a size</button>
          <button type="button" className="btn small teal" onClick={() => setD({ ...d, variants: [{ label: 'Half', price: d.variants[0]?.price ?? '' }, { label: 'Full', price: '' }] })}>Use Half and Full</button>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn red" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save dish'}</button>
        </div>
      </form>
    </div>
  );
}

function CategoryHead({ c }: { c: Category }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(c.name);
  const inv = () => qc.invalidateQueries({ queryKey: ['menu'] });
  const rename = useMutation({ mutationFn: () => api(`/api/admin/categories/${c.id}`, { method: 'PATCH', body: { name } }), onSuccess: () => { inv(); setEdit(false); } });
  const del = useMutation({ mutationFn: () => api(`/api/admin/categories/${c.id}`, { method: 'DELETE' }), onSuccess: () => { inv(); toast('Category deleted'); }, onError: (e) => toast((e as Error).message, 'err') });
  const err = rename.error instanceof ApiError ? rename.error.fields.name || rename.error.message : null;
  return edit ? (
    <form onSubmit={(e) => { e.preventDefault(); rename.mutate(); }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'start' }}>
      <div><input className="input" aria-label="Category name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!err} />{err && <p className="err">{err}</p>}</div>
      <button className="btn small" disabled={rename.isPending}>Save</button>
      <button type="button" className="btn ghost small" onClick={() => { setEdit(false); setName(c.name); }}>Cancel</button>
    </form>
  ) : (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <h3 style={{ fontSize: '1.4rem', color: 'var(--sindoor-deep)' }}>{c.name}</h3>
      <button className="btn ghost small" onClick={() => setEdit(true)}>Rename</button>
      <button className="btn ghost small" onClick={() => { if (confirm(`Delete "${c.name}" and all ${c.items.length} dishes in it?`)) del.mutate(); }}>Delete</button>
    </div>
  );
}

function MenuManager() {
  const qc = useQueryClient();
  const toast = useToast();
  const menu = useQuery({ queryKey: ['menu'], queryFn: () => api<Menu>('/api/menu') });
  const [editing, setEditing] = useState<Draft | null>(null);
  const [newCat, setNewCat] = useState('');
  const inv = () => qc.invalidateQueries({ queryKey: ['menu'] });
  const addCat = useMutation({ mutationFn: () => api('/api/admin/categories', { method: 'POST', body: { name: newCat } }), onSuccess: () => { setNewCat(''); inv(); toast('Category added'); } });
  const toggle = useMutation({
    mutationFn: (i: Item) => api(`/api/admin/items/${i.id}`, { method: 'PATCH', body: { available: !i.available } }),
    onSuccess: (_r, i) => { inv(); toast(i.available ? `${i.name} marked sold out. It leaves open carts now.` : `${i.name} is back on the menu`); },
    onError: (e) => toast((e as Error).message, 'err'),
  });
  const del = useMutation({ mutationFn: (i: Item) => api(`/api/admin/items/${i.id}`, { method: 'DELETE' }), onSuccess: inv, onError: (e) => toast((e as Error).message, 'err') });
  const catErr = addCat.error instanceof ApiError ? addCat.error.fields.name || addCat.error.message : null;

  if (menu.isLoading) return <p className="empty">Loading the menu…</p>;
  if (menu.isError) return <div className="banner" role="alert">{(menu.error as Error).message}</div>;
  const cats = menu.data!.categories;
  return (
    <>
      <form className="panel" onSubmit={(e) => { e.preventDefault(); addCat.mutate(); }} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'start' }}>
        <div style={{ flex: '1 1 220px' }}>
          <input className="input" aria-label="New category name" placeholder="New category, e.g. Thali" value={newCat} onChange={(e) => setNewCat(e.target.value)} aria-invalid={!!catErr} />
          {catErr && <p className="err">{catErr}</p>}
        </div>
        <button className="btn" disabled={addCat.isPending}>Add category</button>
      </form>
      {cats.length === 0 && <p className="empty">No categories yet. Add one above, then add dishes to it.</p>}
      {cats.map((c) => (
        <section className="panel" key={c.id}>
          <CategoryHead c={c} />
          {c.items.length === 0 && <p className="empty">No dishes in this category.</p>}
          {c.items.map((i) => (
            <div className="menu-row" key={i.id}>
              <div className="info">
                <b>{i.name}</b> {!i.veg && <span className="pill" style={{ background: '#f6d2cf' }}>Non-veg</span>}
                <br /><small>{i.variants.map((v) => `${v.label} ${inr(v.pricePaise)}`).join(' · ')}</small>
              </div>
              <div className="acts">
                <span className="lbl" id={`av-${i.id}`}>{i.available ? 'Available' : 'Sold out'}</span>
                <button role="switch" aria-checked={i.available} aria-labelledby={`av-${i.id}`} className="switch" disabled={toggle.isPending} onClick={() => toggle.mutate(i)} />
                <button className="btn small" onClick={() => setEditing(toDraft(i))}>Edit</button>
                <button className="btn ghost small" onClick={() => { if (confirm(`Delete ${i.name}?`)) del.mutate(i); }}>Delete</button>
              </div>
            </div>
          ))}
          <p style={{ marginBottom: 0 }}>
            <button className="btn teal small" onClick={() => setEditing({ categoryId: c.id, name: '', description: '', veg: true, available: true, variants: [{ label: 'Regular', price: '' }] })}>Add a dish to {c.name}</button>
          </p>
        </section>
      ))}
      {editing && <ItemModal draft={editing} cats={cats} onClose={() => setEditing(null)} />}
    </>
  );
}

export default function Admin() {
  const { me, allowed, loading } = useRequireRole(['admin'], '/admin');
  const [tab, setTab] = useState<'today' | 'menu'>('today');
  if (loading) return <><Header staff sub="Admin" /><p className="empty">Opening the ledger…</p></>;
  if (!allowed)
    return <><Header staff sub="Admin" /><main className="shell"><p className="banner" style={{ marginTop: 24 }}>This area is for admin accounts. <Link href="/login?next=/admin">Sign in as admin</Link>.</p></main></>;
  return (
    <>
      <Header staff sub="Admin · hisaab-kitaab" />
      <StaffBar me={me} />
      <main className="shell">
        <div className="admin-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'today'} onClick={() => setTab('today')}>Today</button>
          <button role="tab" aria-selected={tab === 'menu'} onClick={() => setTab('menu')}>Menu</button>
        </div>
        {tab === 'today' ? <Today /> : <MenuManager />}
      </main>
    </>
  );
}
