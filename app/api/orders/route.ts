import { NextResponse } from 'next/server';
import { handle, readJson, clientIp } from '@/lib/server/http';
import { getDb } from '@/lib/server/db';
import { orderSchema } from '@/lib/server/validation';
import { placeOrder } from '@/lib/server/orders';
import { rateLimit } from '@/lib/server/ratelimit';

export const dynamic = 'force-dynamic';
export const POST = handle(async (req) => {
  const db = await getDb();
  await rateLimit(db, `order:${clientIp(req)}`, 15, 10 * 60_000);
  const input = orderSchema.parse(await readJson(req));
  const order = await placeOrder(db, input);
  return NextResponse.json({ token: order.token, order }, { status: 201 });
});
