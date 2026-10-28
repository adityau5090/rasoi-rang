import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError } from './errors';

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new AppError(400, 'Request body must be valid JSON');
  }
}

export function parseId(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new AppError(404, 'Not found');
  return n;
}

export function clientIp(req: Request) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}

export function errorResponse(e: unknown) {
  if (e instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const i of e.issues) {
      const k = i.path.join('.') || '_';
      if (!fields[k]) fields[k] = i.message;
    }
    return NextResponse.json({ error: e.issues[0]?.message ?? 'Invalid input', code: 'VALIDATION', fields }, { status: 400 });
  }
  if (e instanceof AppError) return NextResponse.json({ error: e.message, ...e.extra }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: 'Something went wrong on our side. Please try again.' }, { status: 500 });
}

/** Wraps a route handler: JSON in/out and consistent error format. */
export function handle<C = unknown>(fn: (req: Request, ctx: C) => Promise<unknown>) {
  return async (req: Request, ctx: C) => {
    try {
      const out = await fn(req, ctx);
      return out instanceof Response ? out : NextResponse.json(out);
    } catch (e) {
      return errorResponse(e);
    }
  };
}
