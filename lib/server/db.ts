import { Pool, types } from 'pg';

// Postgres returns BIGINT as strings by default; our epoch-millisecond columns need to be numbers.
types.setTypeParser(20, (v: string) => parseInt(v, 10));

/** Tiny async DB interface so the same code runs on Neon/Supabase (pg) and in-memory Postgres (PGlite) for tests. */
export interface Db {
  query<T = any>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
}
export async function one<T = any>(db: Db, sql: string, params: unknown[] = []): Promise<T | undefined> {
  return (await db.query<T>(sql, params))[0];
}
/** "$1,$2,$3" starting at `from`, for IN (...) lists. */
export const placeholders = (n: number, from = 1) => Array.from({ length: n }, (_, i) => `$${i + from}`).join(',');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','kitchen'))
);
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS items (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  veg BOOLEAN NOT NULL DEFAULT TRUE,
  available BOOLEAN NOT NULL DEFAULT TRUE,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS variants (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  price_paise INTEGER NOT NULL CHECK (price_paise > 0),
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  number INTEGER NOT NULL,
  day TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('dine_in','takeaway')),
  table_number INTEGER,
  customer_name TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','preparing','ready','served')),
  total_paise INTEGER NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  UNIQUE (day, number)
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
-- Order lines are SNAPSHOTS (name/label/price at order time): later menu edits never change history.
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id INTEGER,
  variant_id INTEGER,
  name TEXT NOT NULL,
  variant_label TEXT NOT NULL,
  unit_price_paise INTEGER NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0)
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
-- Live-update log. Every serverless instance can read it, which is what makes SSE work on Vercel.
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  channel TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_channel_id ON events(channel, id);
CREATE TABLE IF NOT EXISTS rate_hits (
  rkey TEXT NOT NULL,
  hit_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_hits ON rate_hits(rkey, hit_at);
`;

function fromPool(pool: Pool): Db {
  const wrap = (q: { query: (s: string, p?: unknown[]) => Promise<{ rows: any[] }> }, inTx: Db | null): Db => {
    const self: Db = {
      query: async (sql, params = []) => (await q.query(sql, params)).rows,
      exec: async (sql) => { await q.query(sql); },
      tx: async (fn) => {
        if (inTx) return fn(self);
        const c = await pool.connect();
        try {
          await c.query('BEGIN');
          const r = await fn(wrap(c, self));
          await c.query('COMMIT');
          return r;
        } catch (e) {
          try { await c.query('ROLLBACK'); } catch { /* connection already broken */ }
          throw e;
        } finally { c.release(); }
      },
    };
    return self;
  };
  return wrap(pool, null);
}

async function createPglite(dataDir?: string): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  const pg: any = dataDir ? new PGlite(dataDir) : new PGlite();
  await pg.waitReady;
  const wrap = (q: any, inTx: boolean): Db => {
    const self: Db = {
      query: async (sql, params = []) => (await q.query(sql, params)).rows,
      exec: async (sql) => { await q.exec(sql); },
      tx: (fn) => (inTx ? fn(self) : pg.transaction((t: any) => fn(wrap(t, true)))),
    };
    return self;
  };
  return wrap(pg, false);
}

export async function initSchema(db: Db) {
  await db.tx(async (t) => {
    await t.query('SELECT pg_advisory_xact_lock(7331)'); // several cold starts at once must not race
    await t.exec(SCHEMA);
  });
}

/** Fresh in-memory Postgres with the schema. Used by the automated tests. */
export async function createTestDb(): Promise<Db> {
  const db = await createPglite();
  await initSchema(db);
  return db;
}

async function connect(): Promise<Db> {
  let url = process.env.DATABASE_URL;
  if (url) {
    url = url.trim();
    // Neon's copy-paste string may include channel_binding=require, which node-postgres does not use. Drop it.
    const u = new URL(url); u.searchParams.delete('channel_binding'); url = u.toString();
    let ssl: { rejectUnauthorized: boolean } | undefined;
    if (process.env.PG_SSL_NO_VERIFY === 'true') {
      // Needed for some Supabase pooler certificates. pg lets sslmode in the URL override options, so strip it.
      const x = new URL(url); x.searchParams.delete('sslmode'); url = x.toString();
      ssl = { rejectUnauthorized: false };
    }
    return fromPool(new Pool({ connectionString: url, ssl, max: Number(process.env.PG_POOL_MAX) || 3, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 10_000 }));
  }
  if (process.env.NODE_ENV === 'production') throw new Error('DATABASE_URL is not set. Add your Neon/Supabase connection string in the hosting dashboard.');
  return createPglite('./data/pglite'); // zero-setup local development
}

const g = globalThis as unknown as { __rrDb?: Promise<Db> };

/** One shared connection pool per server instance (survives Next.js hot reloads). */
export function getDb(): Promise<Db> {
  if (!g.__rrDb) {
    g.__rrDb = (async () => {
      const db = await connect();
      await initSchema(db);
      // Seed demo data when asked (AUTO_SEED=true). On a local machine with no DATABASE_URL and no explicit setting,
      // seed by default so a fresh checkout shows a menu straight away.
      const flag = process.env.AUTO_SEED;
      const local = !process.env.DATABASE_URL && process.env.NODE_ENV !== 'production';
      if (flag === 'true' || (!flag && local)) await (await import('./seed')).seedIfEmpty(db);
      return db;
    })().catch((e) => { g.__rrDb = undefined; throw e; });
  }
  return g.__rrDb;
}
