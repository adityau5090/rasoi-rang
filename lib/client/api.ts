export class ApiError extends Error {
  constructor(message: string, public status: number, public fields: Record<string, string> = {}, public code?: string, public itemIds: number[] = []) {
    super(message);
  }
}

export async function api<T>(url: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your internet connection and try again.', 0);
  }
  let data: any = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) throw new ApiError(data?.error ?? 'Something went wrong. Please try again.', res.status, data?.fields ?? {}, data?.code, data?.itemIds ?? []);
  return data as T;
}
