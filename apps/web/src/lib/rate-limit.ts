/**
 * Sliding-window in-memory rate limiter keyed by IP (or any string).
 *
 * Production note: the store lives in each instance's memory. With N instances
 * the effective limit is N × limit — move the store to Redis
 * (ZADD/ZREMRANGEBYSCORE) before scaling horizontally
 * (see Docs/tecnica/despliegue-produccion.md).
 */

type Entry = { ts: number[]; windowMs: number }; // timestamps (ms) + the key's window

const store = new Map<string, Entry>();

/**
 * Drops keys with no activity inside their OWN window. A fixed cutoff here used
 * to delete keys from long windows (e.g. 3 per hour) after 10 idle minutes,
 * silently resetting their limit.
 */
export function limpiarVencidos(ahora: number = Date.now()): void {
  for (const [key, e] of store) {
    if (e.ts.length === 0 || e.ts[e.ts.length - 1] < ahora - e.windowMs) store.delete(key);
  }
}

// Cleanup every 5 minutes to avoid unbounded memory growth.
if (typeof setInterval !== "undefined") {
  setInterval(() => limpiarVencidos(), 5 * 60 * 1000).unref?.();
}

/**
 * Check whether `key` (typically an IP) has exceeded `limit` requests
 * within the last `windowMs` milliseconds.
 *
 * Returns `{ allowed: true }` or `{ allowed: false, retryAfter: seconds }`.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: true } | { allowed: false; retryAfter: number } {
  const now    = Date.now();
  const cutoff = now - windowMs;

  let entry = store.get(key);
  if (!entry) {
    entry = { ts: [], windowMs };
    store.set(key, entry);
  }
  entry.windowMs = windowMs;
  const ts = entry.ts;

  // Drop timestamps outside the window (slide).
  while (ts.length > 0 && ts[0] < cutoff) ts.shift();

  if (ts.length >= limit) {
    const retryAfter = Math.ceil((ts[0] + windowMs - now) / 1000);
    return { allowed: false, retryAfter };
  }

  ts.push(now);
  return { allowed: true };
}
