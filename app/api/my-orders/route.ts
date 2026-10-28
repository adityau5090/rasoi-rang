import { handle, readJson, clientIp } from '@/lib/server/http';
import { getDb } from '@/lib/server/db';
import { getOrdersByTokens } from '@/lib/server/orders';
import { tokensSchema } from '@/lib/server/validation';
import { rateLimit } from '@/lib/server/ratelimit';

export const dynamic = 'force-dynamic';
/** Returns the orders for the private tokens the browser remembers. Tokens are unguessable, so they act as the credential. */
export const POST = handle(async (req) => {
  const db = await getDb();
  await rateLimit(db, `mine:${clientIp(req)}`, 120, 60_000);
  const { tokens } = tokensSchema.parse(await readJson(req));
  return { orders: await getOrdersByTokens(db, tokens) };
});
