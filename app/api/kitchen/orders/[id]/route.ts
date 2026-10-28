import { handle, readJson, parseId } from '@/lib/server/http';
import { getDb } from '@/lib/server/db';
import { requireRole } from '@/lib/server/auth';
import { advanceOrder } from '@/lib/server/orders';
import { statusSchema } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';
export const PATCH = handle(async (req, { params }: { params: { id: string } }) => {
  await requireRole(['kitchen', 'admin']);
  const { status } = statusSchema.parse(await readJson(req));
  return advanceOrder(await getDb(), parseId(params.id), status);
});
