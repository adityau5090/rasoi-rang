import { handle, readJson, parseId } from '@/lib/server/http';
import { getDb } from '@/lib/server/db';
import { requireRole } from '@/lib/server/auth';
import { deleteCategory, renameCategory } from '@/lib/server/menu';
import { categorySchema } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';
type Ctx = { params: { id: string } };
export const PATCH = handle(async (req, { params }: Ctx) => {
  await requireRole(['admin']);
  const { name } = categorySchema.parse(await readJson(req));
  return renameCategory(await getDb(), parseId(params.id), name);
});
export const DELETE = handle(async (_req, { params }: Ctx) => {
  await requireRole(['admin']);
  return deleteCategory(await getDb(), parseId(params.id));
});
