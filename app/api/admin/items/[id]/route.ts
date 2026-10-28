import { handle, readJson, parseId } from '@/lib/server/http';
import { getDb } from '@/lib/server/db';
import { requireRole } from '@/lib/server/auth';
import { deleteItem, updateItem } from '@/lib/server/menu';
import { itemPatchSchema } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';
type Ctx = { params: { id: string } };
export const PATCH = handle(async (req, { params }: Ctx) => {
  await requireRole(['admin']);
  return updateItem(await getDb(), parseId(params.id), itemPatchSchema.parse(await readJson(req)));
});
export const DELETE = handle(async (_req, { params }: Ctx) => {
  await requireRole(['admin']);
  return deleteItem(await getDb(), parseId(params.id));
});
