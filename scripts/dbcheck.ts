export {}; // makes this file a module so function names do not clash
// Checks that the app can reach its database and shows what is in it. Run: npm run db:check
import { loadEnv } from './loadenv';
console.log(loadEnv());

async function main() {
  const url = process.env.DATABASE_URL;
  if (url) {
    const u = new URL(url);
    console.log(`Connecting to ${u.hostname} as ${decodeURIComponent(u.username)} ...`);
  } else {
    console.log('DATABASE_URL is empty, so this is the local built-in database (./data/pglite). Neon is NOT being used.\nFix: open .env.local and make sure the line reads DATABASE_URL=postgresql://... (no spaces, not commented out).');
  }
  const { getDb } = await import('../lib/server/db');
  const db = await getDb();
  const [{ v }] = await db.query<{ v: string }>('SELECT version() AS v');
  console.log('Connected. Server:', v.split(',')[0]);
  for (const t of ['users', 'categories', 'items', 'variants', 'orders']) {
    const [{ n }] = await db.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM ${t}`);
    console.log(`  ${t.padEnd(11)} ${n}`);
  }
  console.log('Tables exist. If the counts are 0, run: npm run seed');
  process.exit(0);
}
main().catch((e) => { console.error('\nCould not connect:', e.message); process.exit(1); });
