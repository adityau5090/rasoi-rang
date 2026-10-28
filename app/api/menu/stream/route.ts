import { getDb } from '@/lib/server/db';
import { dbStream } from '@/lib/server/sse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60; // must be a literal for Vercel; streams close themselves after ~50s
export async function GET(req: Request) {
  return dbStream(req, await getDb(), ['menu'], { map: (_c, p) => ['menu', p] });
}
