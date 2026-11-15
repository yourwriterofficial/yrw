/**
 * Several parts of one page often ask for the same data (for example the top and bottom ad slots).
 * This lets them share one request: anyone asking for the same address within a few seconds gets the same
 * answer. Browser only, GET only.
 */
const pending = new Map<string, { at: number; promise: Promise<unknown> }>();

export function sharedJson<T = unknown>(url: string, ttlMs = 8000): Promise<T | null> {
  const hit = pending.get(url);
  if (hit && Date.now() - hit.at < ttlMs) return hit.promise as Promise<T | null>;
  const promise = fetch(url)
    .then((r) => (r.ok ? (r.json() as Promise<T>) : null))
    .catch(() => null);
  pending.set(url, { at: Date.now(), promise });
  return promise;
}
