'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/client/api';
import { useLive } from '@/lib/client/useLive';
import { useCart } from '@/lib/client/cart';
import { flyToCart } from '@/lib/client/fly';
import { useToast } from '@/components/Toast';
import { Header } from '@/components/Chrome';
import { Hero } from '@/components/Hero';
import ActiveOrders from '@/components/ActiveOrders';
import Reveal from '@/components/Reveal';
import Money from '@/components/Money';
import CartPanel from '@/components/CartPanel';
import { inr, type Item, type Menu, type Variant } from '@/lib/shared';

const TONES = ['#0b5c5b', '#7c1d12', '#26327a', '#8a2a55', '#6b4a0b'];

function Dish({ item, i }: { item: Item; i: number }) {
  const cart = useCart();
  const [vi, setVi] = useState(0);
  const v = item.variants[Math.min(vi, item.variants.length - 1)];
  const qty = cart.lines.find((l) => l.variantId === v.id)?.qty ?? 0;
  const add = (el: HTMLElement) => { cart.add(item.id, v.id); flyToCart(el); };
  return (
    <Reveal i={i}>
      <article className={`dish ${item.available ? '' : 'out'}`}>
        <div className="window" aria-hidden="true" style={{ ['--tone' as string]: TONES[item.id % TONES.length] }}>{item.name.charAt(0)}</div>
        <div>
          {!item.available && <span className="soldout">Sold out</span>}
          <h3>
            <span className={`vegmark ${item.veg ? '' : 'non'}`} role="img" aria-label={item.veg ? 'Vegetarian' : 'Non-vegetarian'} />
            {item.name}
          </h3>
          {item.description && <p>{item.description}</p>}
          {item.variants.length > 1 && (
            <div className="sizes" role="group" aria-label={`Size of ${item.name}`}>
              {item.variants.map((x, k) => (
                <button key={x.id} aria-pressed={k === vi} onClick={() => setVi(k)}>{x.label} · {inr(x.pricePaise)}</button>
              ))}
            </div>
          )}
          <div className="buyrow">
            <span className="price">
              {inr(v.pricePaise)}
              {item.variants.length === 1 && <small style={{ fontFamily: 'var(--body)', fontSize: '.85rem', color: 'var(--ink-soft)' }}> / {v.label}</small>}
            </span>
            {!item.available ? null : qty > 0 ? (
              <div className="stepper" role="group" aria-label={`Quantity of ${item.name}`}>
                <button onClick={() => cart.setQty(v.id, qty - 1)} aria-label="Remove one">−</button>
                <span key={qty} className="qty-pop">{qty}</span>
                <button onClick={(e) => add(e.currentTarget)} aria-label="Add one" disabled={qty >= 20}>+</button>
              </div>
            ) : (
              <button className="btn small" onClick={(e) => add(e.currentTarget)}>Add to thali</button>
            )}
          </div>
        </div>
      </article>
    </Reveal>
  );
}

function Skeletons() {
  return <>{[0, 1, 2, 3].map((k) => <div key={k} className="dish skel-card" aria-hidden="true"><div className="skel" style={{ width: 64, height: 84, borderRadius: 32 }} /><div style={{ display: 'grid', gap: 10 }}><div className="skel" style={{ height: 22, width: '55%' }} /><div className="skel" style={{ height: 14 }} /><div className="skel" style={{ height: 14, width: '80%' }} /><div className="skel" style={{ height: 38, width: '40%' }} /></div></div>)}</>;
}

export default function Home() {
  const qc = useQueryClient();
  const toast = useToast();
  const cart = useCart();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const navRef = useRef<HTMLElement>(null);

  const menu = useQuery({ queryKey: ['menu'], queryFn: () => api<Menu>('/api/menu') });
  const refresh = () => qc.invalidateQueries({ queryKey: ['menu'] });
  const live = useLive('/api/menu/stream', { menu: refresh }, refresh); // menu edits and stock changes arrive instantly

  const index = useMemo(() => {
    const m = new Map<number, { item: Item; variant: Variant }>();
    menu.data?.categories.forEach((c) => c.items.forEach((i) => i.variants.forEach((v) => m.set(v.id, { item: i, variant: v }))));
    return m;
  }, [menu.data]);

  // Dishes that go out of stock (or get deleted) vanish from open carts, with a notice.
  useEffect(() => {
    if (!menu.data || !cart.ready) return;
    const gone = cart.lines.filter((l) => { const e = index.get(l.variantId); return !e || !e.item.available; });
    if (!gone.length) return;
    const names = [...new Set(gone.map((l) => index.get(l.variantId)?.item.name ?? 'A dish'))];
    toast(`${names.join(', ')} just ran out, so we removed it from your cart.`, 'warn');
    cart.removeMany(gone.map((l) => l.variantId));
  }, [menu.data, cart.lines, cart.ready, index]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filtering
  const needle = q.trim().toLowerCase();
  const cats = useMemo(() => (menu.data?.categories ?? [])
    .map((c) => ({ ...c, items: c.items.filter((i) => (!vegOnly || i.veg) && (!needle || `${i.name} ${i.description}`.toLowerCase().includes(needle))) }))
    .filter((c) => c.items.length), [menu.data, vegOnly, needle]);

  // Scroll-spy: highlight the category chip for the section currently on screen.
  useEffect(() => {
    const els = cats.map((c) => document.getElementById(`cat-${c.id}`)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) setActiveCat(Number(vis.target.id.replace('cat-', '')));
    }, { rootMargin: '-30% 0px -60% 0px' });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [cats]);
  useEffect(() => { // keep the active chip in view inside the horizontal nav (without scrolling the page)
    const nav = navRef.current; const chip = nav?.querySelector<HTMLElement>('[aria-current="true"]');
    if (nav && chip) nav.scrollTo({ left: chip.offsetLeft - nav.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' });
  }, [activeCat]);

  const count = cart.lines.reduce((s, l) => s + l.qty, 0);
  const estimate = cart.lines.reduce((s, l) => s + (index.get(l.variantId)?.variant.pricePaise ?? 0) * l.qty, 0);
  const closeCart = useCallback(() => setOpen(false), []);

  return (
    <>
      <Header />
      <Hero />
      <nav className="catnav" aria-label="Menu sections" ref={navRef}>
        {cats.map((c) => <a key={c.id} href={`#cat-${c.id}`} aria-current={activeCat === c.id ? 'true' : undefined}>{c.name}</a>)}
      </nav>
      <main className="shell" id="menu">
        <ActiveOrders />
        <div className="menu-layout">
          <section aria-label="Menu">
            <div className="toolbar">
              <label className="search">
                <span className="sr">Search dishes</span>
                <input className="input" type="search" placeholder="Search dishes, e.g. kachori" value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
              <button className="vegtoggle" aria-pressed={vegOnly} onClick={() => setVegOnly(!vegOnly)}><span className="vegmark" /> Veg only</button>
            </div>
            {menu.isLoading && <Skeletons />}
            {menu.isError && (
              <div className="banner" role="alert">We could not load the menu. <button className="btn small" onClick={refresh}>Try again</button></div>
            )}
            {menu.data && !cats.length && <p className="empty">{needle || vegOnly ? 'No dishes match your search.' : 'The menu is empty. Staff: sign in as admin and add dishes under Admin → Menu (or run the seed script to load the demo menu).'}</p>}
            {cats.map((c) => (
              <div key={c.id}>
                <h2 className="cat-title" id={`cat-${c.id}`}>{c.name}</h2>
                <div className="divider">✦</div>
                {c.items.map((i, k) => <Dish key={i.id} item={i} i={k} />)}
              </div>
            ))}
          </section>
          <aside className={`cart-wrap ${open ? 'open' : ''}`} aria-label="Cart">
            <CartPanel index={index} onClose={closeCart} />
          </aside>
        </div>
      </main>
      {open && <div className="backdrop" onClick={closeCart} />}
      {count > 0 && !open && (
        <div className="cartbar">
          <button className="btn red" onClick={() => setOpen(true)} data-cart-anchor>
            <span key={count} className="badge bump">{count}</span>
            <span>View thali</span>
            <span className="sum"><Money paise={estimate} /></span>
          </button>
        </div>
      )}
      <footer className="foot">
        <span className={`live ${live ? '' : 'off'}`}><i />{live ? 'Menu is live' : 'Reconnecting…'}</span> ·{' '}
        <Link href="/orders">My orders</Link> · <Link href="/login">Staff login</Link>
      </footer>
    </>
  );
}
