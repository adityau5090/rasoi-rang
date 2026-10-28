import type { Db } from './db';
import { placeholders } from './db';

const POLL_MS = Number(process.env.SSE_POLL_MS) || 1000;
/** Streams close themselves before the serverless time limit; EventSource reconnects at once and resumes via Last-Event-ID. */
const LIFETIME_MS = 50_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const frame = (event: string, data: unknown, id?: number) =>
  `${id ? `id: ${id}\n` : ''}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

type Opts = {
  /** Frames to send right after connecting (e.g. the order's current state). */
  initial?: () => Promise<[event: string, data: unknown][]>;
  /** Turns a stored event into an SSE event name and payload. */
  map: (channel: string, payload: any) => [event: string, data: unknown];
};

/**
 * Server-Sent Events backed by the events table. Works on any host, serverless included.
 * Every frame carries the event id, so after a reconnect the browser sends Last-Event-ID
 * and the server replays what was missed: nothing is lost between the 50-second windows.
 */
export function dbStream(req: Request, db: Db, channels: string[], opts: Opts) {
  const enc = new TextEncoder();
  const last = Number(req.headers.get('last-event-id'));
  let closed = false;
  const stream = new ReadableStream({
    start(controller) {
      const close = () => { if (!closed) { closed = true; try { controller.close(); } catch { /* already closed */ } } };
      const write = (s: string) => { if (!closed) try { controller.enqueue(enc.encode(s)); } catch { closed = true; } };
      req.signal.addEventListener('abort', close);
      write('retry: 1000\n\n');
      (async () => {
        try {
          let cursor = Number.isInteger(last) && last > 0
            ? last
            : (await db.query<{ m: number }>('SELECT COALESCE(MAX(id),0)::int AS m FROM events'))[0].m;
          for (const [e, d] of (await opts.initial?.()) ?? []) write(frame(e, d));
          const sql = `SELECT id, channel, payload FROM events WHERE id > $1 AND channel IN (${placeholders(channels.length, 2)}) ORDER BY id`;
          const t0 = Date.now();
          let lastWrite = t0;
          while (!closed && Date.now() - t0 < LIFETIME_MS) {
            const rows = await db.query<{ id: number; channel: string; payload: unknown }>(sql, [cursor, ...channels]);
            for (const r of rows) {
              cursor = r.id;
              const [e, d] = opts.map(r.channel, r.payload);
              write(frame(e, d, r.id));
              lastWrite = Date.now();
            }
            if (Date.now() - lastWrite > 15_000) { write(': ping\n\n'); lastWrite = Date.now(); }
            await sleep(POLL_MS);
          }
        } catch (e) {
          console.error('SSE stream error', e);
        }
        close();
      })();
    },
    cancel() { closed = true; },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
