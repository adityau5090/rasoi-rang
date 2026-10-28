export function timeAgo(ts: number, now = Date.now()) {
  const m = Math.max(0, Math.floor((now - ts) / 60_000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
export const clock = (ts: number) => new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
