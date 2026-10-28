import { cookies } from 'next/headers';
import { AppError } from './errors';
import { COOKIE, verifySession } from './session';
import type { Me } from '../shared';

export async function currentUser(): Promise<Me | null> {
  return verifySession(cookies().get(COOKIE)?.value);
}

export async function requireRole(roles: Me['role'][]): Promise<Me> {
  const me = await currentUser();
  if (!me) throw new AppError(401, 'Please sign in to continue');
  if (!roles.includes(me.role)) throw new AppError(403, 'Your account cannot do this');
  return me;
}
