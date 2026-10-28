import { handle } from '@/lib/server/http';
import { getDb } from '@/lib/server/db';
import { requireRole } from '@/lib/server/auth';
import { todayStats } from '@/lib/server/orders';

export const dynamic = 'force-dynamic';
export const GET = handle(async () => {
  await requireRole(['admin']);
  return todayStats(await getDb());
});
