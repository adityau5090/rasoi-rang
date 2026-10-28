import { handle } from '@/lib/server/http';
import { getDb } from '@/lib/server/db';
import { getMenu } from '@/lib/server/menu';

export const dynamic = 'force-dynamic';
export const GET = handle(async () => getMenu(await getDb()));
