import { getDb } from '@/lib/server/db';
import { tokensSchema } from '@/lib/server/validation';
import { dbStream } from '@/lib/server/sse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60; // must be a literal for Vercel; streams close themselves after ~50s
/** One live stream for all of a customer's orders: /api/my-orders/stream?tokens=a,b,c */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('tokens') ?? '';
  const parsed = tokensSchema.safeParse({ tokens: raw.split(',').filter(Boolean) });
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid tokens' }, { status: 400 });
  return dbStream(req, await getDb(), parsed.data.tokens.map((t) => `order:${t}`), { map: (_c, p) => ['order', p] });
}
