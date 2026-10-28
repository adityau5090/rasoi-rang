export {}; // makes this file a module so function names do not clash
// Loads .env.local if present, then resets the database in DATABASE_URL (or the local dev DB) and seeds demo data.
import { loadEnv } from './loadenv';
console.log(loadEnv());

async function main() {
  const { getDb } = await import('../lib/server/db');
  const { resetAndSeed } = await import('../lib/server/seed');
  const db = await getDb();
  await resetAndSeed(db);
  console.log('Seeded demo data.\n  admin@rasoi.test   / admin123\n  kitchen@rasoi.test / kitchen123');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
