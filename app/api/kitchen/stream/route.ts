import { getDb } from '@/lib/server/db';
import { currentUser } from '@/lib/server/auth';
import { dbStream } from '@/lib/server/sse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60; // must be a literal for Vercel; streams close themselves after ~50s
export async function GET(req: Request) {
  if (!(await currentUser())) return Response.json({ error: 'Please sign in to continue' }, { status: 401 });
  return dbStream(req, await getDb(), ['orders'], { map: (_c, p) => [p.kind, p.order] });
}
