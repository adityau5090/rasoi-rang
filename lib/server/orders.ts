import crypto from 'node:crypto';
import { one, placeholders, type Db } from './db';
import { AppError } from './errors';
import { publishOrder } from './events';
import { STATUSES, type Order, type Stats, type Status } from '../shared';
import type { OrderInput } from './validation';

export function dayKey(at: number = Date.now(), tz = process.env.APP_TIMEZONE || 'Asia/Kolkata') {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

type PricedLine = { itemId: number; variantId: number; name: string; label: string; unitPaise: number; qty: number };

/**
 * THE source of truth for money. Takes only ids and quantities from the browser and reads
 * names and prices from the database. Also rejects dishes that are sold out or no longer exist.
 */
export async function priceLines(db: Db, lines: { itemId: number; variantId: number; qty: number }[]) {
  const merged = new Map<number, { itemId: number; variantId: number; qty: number }>();
  for (const l of lines) {
    const prev = merged.get(l.variantId);
    if (prev && prev.itemId !== l.itemId) throw new AppError(400, 'Your cart has an invalid item. Please refresh the menu.');
    merged.set(l.variantId, { ...l, qty: (prev?.qty ?? 0) + l.qty });
  }
  const priced: PricedLine[] = [];
  const soldOut: { id: number; name: string }[] = [];
  for (const l of merged.values()) {
    if (l.qty > 20) throw new AppError(400, 'You can order at most 20 of one dish');
    const r = await one<{ itemId: number; name: string; available: boolean; variantId: number; label: string; price: number }>(
      db,
      `SELECT i.id AS "itemId", i.name, i.available, v.id AS "variantId", v.label, v.price_paise AS price
       FROM variants v JOIN items i ON i.id = v.item_id WHERE v.id = $1 AND i.id = $2`,
      [l.variantId, l.itemId]);
    if (!r) throw new AppError(409, 'Some dishes in your cart are no longer on the menu. Please review your cart.', { code: 'MENU_CHANGED', itemIds: [l.itemId] });
    if (!r.available) soldOut.push({ id: r.itemId, name: r.name });
    priced.push({ itemId: r.itemId, variantId: r.variantId, name: r.name, label: r.label, unitPaise: r.price, qty: l.qty });
  }
  if (soldOut.length)
    throw new AppError(409, `Sorry, ${soldOut.map((s) => s.name).join(', ')} just sold out. Please remove it from your cart.`, {
      code: 'SOLD_OUT', itemIds: soldOut.map((s) => s.id),
    });
  const totalPaise = priced.reduce((s, l) => s + l.unitPaise * l.qty, 0);
  return { lines: priced, totalPaise };
}

type Row = {
  id: number; token: string; number: number; type: Order['type']; table_number: number | null; customer_name: string;
  note: string; status: Status; total_paise: number; created_at: number; updated_at: number;
};

/** Attaches line items to many orders with a single query. */
async function hydrate(db: Db, rows: Row[]): Promise<Order[]> {
  if (!rows.length) return [];
  const lines = await db.query<{ order_id: number; name: string; variantLabel: string; unitPricePaise: number; qty: number }>(
    `SELECT order_id, name, variant_label AS "variantLabel", unit_price_paise AS "unitPricePaise", qty
     FROM order_items WHERE order_id IN (${placeholders(rows.length)}) ORDER BY id`, rows.map((r) => r.id));
  return rows.map((r) => ({
    id: r.id, token: r.token, number: r.number, type: r.type, tableNumber: r.table_number, customerName: r.customer_name,
    note: r.note, status: r.status, totalPaise: r.total_paise, createdAt: Number(r.created_at), updatedAt: Number(r.updated_at),
    items: lines.filter((l) => l.order_id === r.id).map(({ order_id: _o, ...rest }) => rest),
  }));
}

export async function placeOrder(db: Db, input: OrderInput, now: number = Date.now()): Promise<Order> {
  const id = await db.tx(async (t) => {
    const { lines, totalPaise } = await priceLines(t, input.lines);
    const day = dayKey(now);
    await t.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`orders:${day}`]); // serialise numbering per day
    const number = (await t.query<{ n: number }>('SELECT COALESCE(MAX(number),0)+1 AS n FROM orders WHERE day=$1', [day]))[0].n;
    const token = crypto.randomBytes(16).toString('base64url'); // unguessable link for the customer
    const r = await t.query<{ id: number }>(
      `INSERT INTO orders (token,number,day,type,table_number,customer_name,note,status,total_paise,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'received',$8,$9,$9) RETURNING id`,
      [token, number, day, input.type, input.type === 'dine_in' ? input.tableNumber ?? null : null, input.customerName, input.note, totalPaise, now]);
    for (const l of lines)
      await t.query('INSERT INTO order_items (order_id,item_id,variant_id,name,variant_label,unit_price_paise,qty) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [r[0].id, l.itemId, l.variantId, l.name, l.label, l.unitPaise, l.qty]);
    return r[0].id;
  });
  const order = (await getOrderById(db, id))!;
  await publishOrder(db, 'created', order);
  return order;
}

export async function getOrderById(db: Db, id: number): Promise<Order | null> {
  return (await hydrate(db, await db.query<Row>('SELECT * FROM orders WHERE id=$1', [id])))[0] ?? null;
}
export async function getOrderByToken(db: Db, token: string): Promise<Order | null> {
  return (await hydrate(db, await db.query<Row>('SELECT * FROM orders WHERE token=$1', [token])))[0] ?? null;
}

/** A customer's own orders (newest first). Unknown tokens are silently ignored. */
export async function getOrdersByTokens(db: Db, tokens: string[]): Promise<Order[]> {
  const uniq = [...new Set(tokens)].slice(0, 20);
  if (!uniq.length) return [];
  return hydrate(db, await db.query<Row>(`SELECT * FROM orders WHERE token IN (${placeholders(uniq.length)}) ORDER BY created_at DESC`, uniq));
}

/** Orders move exactly one step forward: Received → Preparing → Ready → Served. */
export async function advanceOrder(db: Db, id: number, to: Status, now: number = Date.now()): Promise<Order> {
  const cur = await one<{ status: Status }>(db, 'SELECT status FROM orders WHERE id=$1', [id]);
  if (!cur) throw new AppError(404, 'Order not found');
  if (STATUSES.indexOf(to) !== STATUSES.indexOf(cur.status) + 1)
    throw new AppError(409, `This order is already "${cur.status}" and cannot jump to "${to}". Refresh the board.`, { code: 'BAD_TRANSITION' });
  // compare-and-set so two kitchen screens cannot both win
  const r = await db.query('UPDATE orders SET status=$1, updated_at=$2 WHERE id=$3 AND status=$4 RETURNING id', [to, now, id, cur.status]);
  if (!r.length) throw new AppError(409, 'Another screen just updated this order. Refresh the board.', { code: 'BAD_TRANSITION' });
  const order = (await getOrderById(db, id))!;
  await publishOrder(db, 'updated', order);
  return order;
}

/** Kitchen board: everything still open plus today's served orders. */
export async function kitchenBoard(db: Db, now: number = Date.now()): Promise<Order[]> {
  return hydrate(db, await db.query<Row>(`SELECT * FROM orders WHERE status <> 'served' OR day = $1 ORDER BY created_at ASC`, [dayKey(now)]));
}

export async function todayStats(db: Db, now: number = Date.now()): Promise<Stats> {
  const day = dayKey(now);
  const orders = await hydrate(db, await db.query<Row>('SELECT * FROM orders WHERE day=$1 ORDER BY created_at DESC', [day]));
  const revenuePaise = orders.reduce((s, o) => s + o.totalPaise, 0);
  const byStatus = { received: 0, preparing: 0, ready: 0, served: 0 } as Record<Status, number>;
  for (const o of orders) byStatus[o.status]++;
  return { day, revenuePaise, orderCount: orders.length, avgPaise: orders.length ? Math.round(revenuePaise / orders.length) : 0, byStatus, orders };
}
