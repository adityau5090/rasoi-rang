import { NextResponse } from 'next/server';
import { handle, readJson, clientIp } from '@/lib/server/http';
import { getDb } from '@/lib/server/db';
import { AppError } from '@/lib/server/errors';
import { COOKIE, authenticate, signSession } from '@/lib/server/session';
import { loginSchema } from '@/lib/server/validation';
import { rateLimit } from '@/lib/server/ratelimit';

export const dynamic = 'force-dynamic';
export const POST = handle(async (req) => {
  const db = await getDb();
  await rateLimit(db, `login:${clientIp(req)}`, 10, 60_000);
  const { email, password } = loginSchema.parse(await readJson(req));
  const me = await authenticate(db, email, password);
  if (!me) throw new AppError(401, 'Wrong email or password');
  const res = NextResponse.json(me);
  res.cookies.set(COOKIE, await signSession(me), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 12 * 3600,
  });
  return res;
});
