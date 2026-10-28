import { handle } from '@/lib/server/http';
import { AppError } from '@/lib/server/errors';
import { currentUser } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';
export const GET = handle(async () => {
  const me = await currentUser();
  if (!me) throw new AppError(401, 'Not signed in');
  return me;
});
