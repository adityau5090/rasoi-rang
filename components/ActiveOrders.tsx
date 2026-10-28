'use client';
import Link from 'next/link';
import { useMyOrders } from '@/lib/client/myOrders';
import { STATUS_LABEL } from '@/lib/shared';
import OrderProgress from './OrderProgress';

/** Strip of the customer's open orders, shown at the top of the menu. Updates live. */
export default function ActiveOrders() {
  const { active } = useMyOrders();
  if (!active.length) return null;
  return (
    <section className="active-strip" aria-label="Your active orders">
      <div className="strip-head">
        <span className="live"><i />Your orders, live</span>
        <Link href="/orders">All my orders</Link>
      </div>
      <div className="strip-row">
        {active.map((o) => (
          <Link key={o.token} href={`/order/${o.token}`} className="mini-order">
            <span className="mo-no hi">#{o.number}</span>
            <span className="mo-body">
              <b>{o.type === 'dine_in' ? `Table ${o.tableNumber}` : 'Takeaway'} · {STATUS_LABEL[o.status].en}</b>
              <OrderProgress status={o.status} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
