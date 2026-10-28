import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { one, type Db } from './db';
import type { Me } from '../shared';

export const COOKIE = 'rr_session';
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

function secret() {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 32) return new TextEncoder().encode(s);
  if (process.env.NODE_ENV === 'production') throw new Error('AUTH_SECRET must be set (32+ characters) in production');
  return new TextEncoder().encode('dev-only-secret-do-not-use-in-production!!');
}

export async function signSession(u: Me) {
  return new SignJWT({ email: u.email, role: u.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(u.id))
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(secret());
}

export async function verifySession(token?: string | null): Promise<Me | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    const role = payload.role;
    if ((role !== 'admin' && role !== 'kitchen') || !payload.sub) return null;
    return { id: Number(payload.sub), email: String(payload.email), role };
  } catch {
    return null;
  }
}

/** Returns the user if email+password match, otherwise null (same timing either way). */
export async function authenticate(db: Db, email: string, password: string): Promise<Me | null> {
  const u = await one<{ id: number; email: string; password_hash: string; role: Me['role'] }>(db, 'SELECT id, email, password_hash, role FROM users WHERE email=$1', [email]);
  const ok = bcrypt.compareSync(password, u?.password_hash ?? DUMMY_HASH);
  return u && ok ? { id: u.id, email: u.email, role: u.role } : null;
}
