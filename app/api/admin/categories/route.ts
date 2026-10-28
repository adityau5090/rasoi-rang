import { NextResponse } from 'next/server';
import { handle, readJson } from '@/lib/server/http';
import { getDb } from '@/lib/server/db';
import { requireRole } from '@/lib/server/auth';
import { createCategory } from '@/lib/server/menu';
import { categorySchema } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';
export const POST = handle(async (req) => {
  await requireRole(['admin']);
  const { name } = categorySchema.parse(await readJson(req));
  return NextResponse.json(await createCategory(await getDb(), name), { status: 201 });
});
