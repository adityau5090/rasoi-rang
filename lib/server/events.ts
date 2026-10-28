import type { Db } from './db';
import type { Order } from '../shared';

/**
 * Live updates go through a small `events` table instead of in-process memory.
 * Serverless functions are separate instances, so the only thing they share is the database.
 * Writers INSERT a row; each open SSE connection polls for rows newer than its cursor (see sse.ts).
 */
export async function publish(db: Db, channel: string, payload: unknown) {
  const now = Date.now();
  await db.query('INSERT INTO events (channel, payload, created_at) VALUES ($1, $2, $3)', [channel, JSON.stringify(payload), now]);
  if (Math.random() < 0.05) await db.query('DELETE FROM events WHERE created_at < $1', [now - 3600_000]); // keep the log tiny
}

export async function publishOrder(db: Db, kind: 'created' | 'updated', order: Order) {
  await publish(db, 'orders', { kind, order });          // kitchen + admin
  await publish(db, `order:${order.token}`, order);      // that customer only
}
export const publishMenu = (db: Db) => publish(db, 'menu', { at: Date.now() });
