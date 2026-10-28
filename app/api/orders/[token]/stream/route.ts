import { getDb } from '@/lib/server/db';
import { getOrderByToken } from '@/lib/server/orders';
import { dbStream } from '@/lib/server/sse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60; // must be a literal for Vercel; streams close themselves after ~50s
export async function GET(req: Request, { params }: { params: { token: string } }) {
  const db = await getDb();
  if (!(await getOrderByToken(db, params.token))) return Response.json({ error: 'Order not found' }, { status: 404 });
  return dbStream(req, db, [`order:${params.token}`], {
    // current state first, so a reconnecting page is never stale
    initial: async () => { const o = await getOrderByToken(db, params.token); return o ? [['order', o]] : []; },
    map: (_c, p) => ['order', p],
  });
}
