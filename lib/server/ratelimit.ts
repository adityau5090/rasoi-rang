import type { Db } from './db';
import { AppError } from './errors';

/** Sliding-window limiter stored in Postgres, so it holds across serverless instances. */
export async function rateLimit(db: Db, key: string, max: number, windowMs: number) {
  const now = Date.now();
  const [{ n }] = await db.query<{ n: number }>('SELECT COUNT(*)::int AS n FROM rate_hits WHERE rkey=$1 AND hit_at > $2', [key, now - windowMs]);
  if (n >= max) throw new AppError(429, 'Too many attempts. Please wait a minute and try again.');
  await db.query('INSERT INTO rate_hits (rkey, hit_at) VALUES ($1, $2)', [key, now]);
  if (Math.random() < 0.02) await db.query('DELETE FROM rate_hits WHERE hit_at < $1', [now - 3600_000]);
}
