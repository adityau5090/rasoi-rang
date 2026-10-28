'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/client/api';
import { useMyOrders } from '@/lib/client/myOrders';
import { Mandala } from './Ornaments';
import type { Me } from '@/lib/shared';

/** Sticky top bar. It shrinks on scroll and draws a reading-progress line along its bottom edge. */
export function Header({ night = false, staff = false, sub }: { night?: boolean; staff?: boolean; sub?: string }) {
  const path = usePathname();
  const { active } = useMyOrders();
  return (
    <header className={`topbar ${night ? 'night-bar' : ''}`}>
      <div className="shell bar">
        <Link href="/" className="brand" aria-label="Rasoi Rang home">
          <Mandala size={42} />
          <span className="brand-t"><b className="hi">रसोई रंग</b><small>{sub ?? 'Rajasthani kitchen'}</small></span>
        </Link>
        {!staff && (
          <nav className="topnav" aria-label="Customer navigation">
            <Link href="/" aria-current={path === '/' ? 'page' : undefined}>Menu</Link>
            <Link href="/orders" aria-current={path === '/orders' ? 'page' : undefined} className="with-badge">
              My orders
              {active.length > 0 && <span className="dot-badge" aria-label={`${active.length} active orders`}>{active.length}</span>}
            </Link>
          </nav>
        )}
      </div>
      <div className="zigzag thin" />
      <div className="progress" aria-hidden="true" />
    </header>
  );
}

export function StaffBar({ me }: { me?: Me }) {
  const router = useRouter();
  const qc = useQueryClient();
  const out = async () => { await api('/api/auth/logout', { method: 'POST' }); qc.clear(); router.replace('/login'); };
  return (
    <div className="staffbar">
      <span>{me ? `Signed in as ${me.email} (${me.role})` : 'Staff area'}</span>
      <span style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {me?.role === 'admin' && <Link href="/admin">Admin</Link>}
        <Link href="/kitchen">Kitchen</Link>
        <Link href="/">Customer menu</Link>
        <button className="btn ghost small" onClick={out}>Sign out</button>
      </span>
    </div>
  );
}
