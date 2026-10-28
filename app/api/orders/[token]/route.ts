import { handle } from '@/lib/server/http';
import { getDb } from '@/lib/server/db';
import { AppError } from '@/lib/server/errors';
import { getOrderByToken } from '@/lib/server/orders';

export const dynamic = 'force-dynamic';
export const GET = handle(async (_req, { params }: { params: { token: string } }) => {
  const o = await getOrderByToken(await getDb(), params.token);
  if (!o) throw new AppError(404, 'We could not find this order. Check the link.');
  return o;
});
