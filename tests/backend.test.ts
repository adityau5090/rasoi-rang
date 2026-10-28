import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type Db } from '@/lib/server/db';
import { ensureMenu, ensureUsers } from '@/lib/server/seed';
import { createItem, getMenu, updateItem } from '@/lib/server/menu';
import { advanceOrder, dayKey, getOrdersByTokens, placeOrder, priceLines, todayStats } from '@/lib/server/orders';
import { orderSchema } from '@/lib/server/validation';
import { authenticate, signSession, verifySession } from '@/lib/server/session';
import { rateLimit } from '@/lib/server/ratelimit';
import { AppError } from '@/lib/server/errors';

let db: Db;
const find = async (name: string) => (await getMenu(db)).categories.flatMap((c) => c.items).find((i) => i.name === name)!;
const line = async (name: string, label: string | undefined, qty: number) => {
  const it = await find(name);
  const v = label ? it.variants.find((x) => x.label === label)! : it.variants[0];
  return { itemId: it.id, variantId: v.id, qty };
};
const dineIn = (lines: Awaited<ReturnType<typeof line>>[], extra = {}) => orderSchema.parse({ type: 'dine_in', tableNumber: 5, lines, ...extra });
const rejects = async (p: Promise<unknown>) => { try { await p; } catch (e) { return e as AppError; } throw new Error('expected a rejection'); };

beforeAll(async () => { db = await createTestDb(); await ensureUsers(db); });
beforeEach(async () => {
  await db.exec('TRUNCATE order_items, orders, variants, items, categories, events, rate_hits RESTART IDENTITY CASCADE');
  await ensureMenu(db);
});

describe('server-side pricing', () => {
  it('computes the total from the menu and ignores any price the browser sends', async () => {
    const tampered = orderSchema.parse({
      type: 'dine_in', tableNumber: 3, totalPaise: 1, price: 1,
      lines: [{ ...(await line('Dal Baati Churma', 'Full', 2)), price: 1, unitPricePaise: 1 }],
    });
    const o = await placeOrder(db, tampered);
    expect(o.totalPaise).toBe(2 * 320_00);
    expect(o.items[0].unitPricePaise).toBe(320_00);
  });

  it('prices half and full plates differently', async () => {
    const half = await placeOrder(db, dineIn([await line('Laal Maas', 'Half', 1)]));
    const full = await placeOrder(db, dineIn([await line('Laal Maas', 'Full', 1)]));
    expect(half.totalPaise).toBe(320_00);
    expect(full.totalPaise).toBe(580_00);
  });

  it('merges duplicate lines and still enforces the per-dish cap', async () => {
    const l = await line('Bajra Roti', undefined, 3);
    expect((await priceLines(db, [l, l])).lines[0].qty).toBe(6);
    await rejects(priceLines(db, [await line('Bajra Roti', undefined, 15), await line('Bajra Roti', undefined, 15)]));
  });

  it('rejects sold-out dishes and reports which ones', async () => {
    const it = await find('Safed Maas');
    expect(it.available).toBe(false);
    const e = await rejects(priceLines(db, [{ itemId: it.id, variantId: it.variants[0].id, qty: 1 }]));
    expect(e).toBeInstanceOf(AppError);
    expect(e.status).toBe(409);
    expect(e.extra.code).toBe('SOLD_OUT');
    expect(e.extra.itemIds).toEqual([it.id]);
  });

  it('rejects a variant that does not belong to the item (id mix-up / tampering)', async () => {
    const a = await find('Bajra Roti');
    const b = await find('Laal Maas');
    const e = await rejects(priceLines(db, [{ itemId: a.id, variantId: b.variants[0].id, qty: 1 }]));
    expect(e.message).toMatch(/no longer on the menu/);
  });

  it('keeps old order totals when the menu price changes later', async () => {
    const o = await placeOrder(db, dineIn([await line('Ghevar', undefined, 1)]));
    const it = await find('Ghevar');
    await updateItem(db, it.id, { variants: [{ id: it.variants[0].id, label: '1 pc', pricePaise: 999_00 }] });
    expect((await todayStats(db)).orders.find((x) => x.id === o.id)!.totalPaise).toBe(120_00);
    expect((await placeOrder(db, dineIn([await line('Ghevar', undefined, 1)]))).totalPaise).toBe(999_00);
  });
});

describe('input validation', () => {
  const base = { lines: [{ itemId: 1, variantId: 1, qty: 1 }] };
  it('requires a table number for dine-in and a name for takeaway', () => {
    expect(orderSchema.safeParse({ ...base, type: 'dine_in' }).success).toBe(false);
    expect(orderSchema.safeParse({ ...base, type: 'dine_in', tableNumber: 31 }).success).toBe(false);
    expect(orderSchema.safeParse({ ...base, type: 'takeaway' }).success).toBe(false);
    expect(orderSchema.safeParse({ ...base, type: 'takeaway', customerName: 'Asha' }).success).toBe(true);
  });
  it('rejects empty carts, bad quantities and unknown order types', () => {
    expect(orderSchema.safeParse({ type: 'dine_in', tableNumber: 1, lines: [] }).success).toBe(false);
    expect(orderSchema.safeParse({ ...base, type: 'dine_in', tableNumber: 1, lines: [{ itemId: 1, variantId: 1, qty: 0 }] }).success).toBe(false);
    expect(orderSchema.safeParse({ ...base, type: 'dine_in', tableNumber: 1, lines: [{ itemId: 1, variantId: 1, qty: 99 }] }).success).toBe(false);
    expect(orderSchema.safeParse({ ...base, type: 'delivery' }).success).toBe(false);
  });
  it('does not store a table number on takeaway orders', async () => {
    const o = await placeOrder(db, orderSchema.parse({ type: 'takeaway', tableNumber: 9, customerName: 'Asha', lines: [await line('Masala Chaas', undefined, 1)] }));
    expect(o.tableNumber).toBeNull();
  });
});

describe('order lifecycle', () => {
  it('moves one step at a time: Received → Preparing → Ready → Served', async () => {
    const o = await placeOrder(db, dineIn([await line('Missi Roti', undefined, 2)]));
    expect(o.status).toBe('received');
    expect((await rejects(advanceOrder(db, o.id, 'ready'))).message).toMatch(/cannot jump/);
    expect((await advanceOrder(db, o.id, 'preparing')).status).toBe('preparing');
    expect((await advanceOrder(db, o.id, 'ready')).status).toBe('ready');
    expect((await advanceOrder(db, o.id, 'served')).status).toBe('served');
    await rejects(advanceOrder(db, o.id, 'preparing'));
    expect((await rejects(advanceOrder(db, 9999, 'preparing'))).message).toMatch(/not found/);
  });

  it('numbers orders per day and gives each a long unguessable token', async () => {
    const a = await placeOrder(db, dineIn([await line('Missi Roti', undefined, 1)]));
    const b = await placeOrder(db, dineIn([await line('Missi Roti', undefined, 1)]));
    const yesterday = await placeOrder(db, dineIn([await line('Missi Roti', undefined, 1)]), Date.now() - 36 * 3600_000);
    expect([a.number, b.number]).toEqual([1, 2]);
    expect(yesterday.number).toBe(1);
    expect(a.token).not.toBe(b.token);
    expect(a.token.length).toBeGreaterThanOrEqual(20);
  });

  it('gives unique numbers even when orders arrive at the same moment', async () => {
    const l = await line('Missi Roti', undefined, 1);
    const orders = await Promise.all(Array.from({ length: 6 }, () => placeOrder(db, dineIn([l]))));
    expect(orders.map((o) => o.number).sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('live events (what the SSE streams read)', () => {
  it('records created and updated events for kitchen and for the customer, in order', async () => {
    const o = await placeOrder(db, dineIn([await line('Missi Roti', undefined, 1)]));
    await advanceOrder(db, o.id, 'preparing');
    const kitchen = await db.query<{ id: number; payload: { kind: string; order: { status: string } } }>("SELECT id, payload FROM events WHERE channel='orders' ORDER BY id");
    expect(kitchen.map((e) => e.payload.kind)).toEqual(['created', 'updated']);
    const mine = await db.query<{ payload: { status: string } }>('SELECT payload FROM events WHERE channel=$1 ORDER BY id', [`order:${o.token}`]);
    expect(mine.map((e) => e.payload.status)).toEqual(['received', 'preparing']);
    // replay from a cursor (what Last-Event-ID does after a reconnect) returns only newer events
    const after = await db.query('SELECT id FROM events WHERE channel=$1 AND id > $2', ['orders', kitchen[0].id]);
    expect(after).toHaveLength(1);
  });
  it('publishes a menu event when stock changes', async () => {
    const it = await find('Ghevar');
    await updateItem(db, it.id, { available: false });
    expect(await db.query("SELECT 1 FROM events WHERE channel='menu'")).not.toHaveLength(0);
  });
});

describe('my orders (customer history)', () => {
  it('returns only the orders whose tokens are supplied, newest first, and ignores unknown tokens', async () => {
    const l = await line('Missi Roti', undefined, 1);
    const a = await placeOrder(db, dineIn([l]));
    const b = await placeOrder(db, dineIn([l]));
    await placeOrder(db, dineIn([l])); // someone else's order
    const mine = await getOrdersByTokens(db, [a.token, b.token, 'not-a-real-token-123456']);
    expect(mine.map((o) => o.id)).toEqual([b.id, a.id]);
    expect(mine[0].items.length).toBeGreaterThan(0);
    expect(await getOrdersByTokens(db, [])).toEqual([]);
  });
});

describe('admin stats', () => {
  it("counts only today's orders in revenue", async () => {
    await placeOrder(db, dineIn([await line('Ghevar', undefined, 2)])); // 240
    await placeOrder(db, dineIn([await line('Masala Chaas', undefined, 1)])); // 40
    await placeOrder(db, dineIn([await line('Ghevar', undefined, 5)]), Date.now() - 36 * 3600_000); // yesterday
    const s = await todayStats(db);
    expect(s.day).toBe(dayKey());
    expect(s.orderCount).toBe(2);
    expect(s.revenuePaise).toBe(280_00);
    expect(s.avgPaise).toBe(140_00);
    expect(s.byStatus.received).toBe(2);
  });
});

describe('menu management', () => {
  it('keeps variant ids stable on edit so open carts stay valid', async () => {
    const it = await find('Dal Baati Churma');
    const [half, full] = it.variants;
    await updateItem(db, it.id, { variants: [{ id: half.id, label: 'Half', pricePaise: 200_00 }, { id: full.id, label: 'Full', pricePaise: 350_00 }, { label: 'Family', pricePaise: 800_00 }] });
    const after = await find('Dal Baati Churma');
    expect(after.variants.map((v) => v.id).slice(0, 2)).toEqual([half.id, full.id]);
    expect(after.variants).toHaveLength(3);
  });
  it('can create a new dish with sizes', async () => {
    const cat = (await getMenu(db)).categories[0];
    const id = await createItem(db, { categoryId: cat.id, name: 'Test Thali', description: '', veg: true, available: true, variants: [{ label: 'Half', pricePaise: 100_00 }] });
    expect((await find('Test Thali')).id).toBe(id);
  });
});

describe('auth and rate limiting', () => {
  it('accepts correct credentials only', async () => {
    expect((await authenticate(db, 'admin@rasoi.test', 'admin123'))?.role).toBe('admin');
    expect(await authenticate(db, 'admin@rasoi.test', 'nope')).toBeNull();
    expect(await authenticate(db, 'ghost@rasoi.test', 'admin123')).toBeNull();
  });
  it('rejects tampered or garbage session tokens', async () => {
    const t = await signSession({ id: 1, email: 'a@b.c', role: 'kitchen' });
    expect((await verifySession(t))?.role).toBe('kitchen');
    expect(await verifySession(t.slice(0, -3) + 'abc')).toBeNull();
    expect(await verifySession('garbage')).toBeNull();
    expect(await verifySession(undefined)).toBeNull();
  });
  it('blocks the 4th attempt inside the window (stored in the database)', async () => {
    for (let i = 0; i < 3; i++) await rateLimit(db, 'login:1.2.3.4', 3, 60_000);
    expect((await rejects(rateLimit(db, 'login:1.2.3.4', 3, 60_000))).status).toBe(429);
    await rateLimit(db, 'login:9.9.9.9', 3, 60_000); // other IPs unaffected
  });
});
