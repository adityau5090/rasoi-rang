import { NextResponse } from 'next/server';
import { handle, readJson } from '@/lib/server/http';
import { getDb } from '@/lib/server/db';
import { requireRole } from '@/lib/server/auth';
import { createItem } from '@/lib/server/menu';
import { itemSchema } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';
export const POST = handle(async (req) => {
  await requireRole(['admin']);
  const id = await createItem(await getDb(), itemSchema.parse(await readJson(req)));
  return NextResponse.json({ id }, { status: 201 });
});
