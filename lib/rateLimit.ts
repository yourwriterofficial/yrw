/**
 * Minimal in-memory rate limiter. It lives in one server instance, so on serverless
 * hosting each instance counts separately: it stops casual spam and scripts, not a
 * determined attacker. Returns true when the caller is OVER the limit.
 */
const buckets = new Map<string, number[]>();

export function overLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > 5000) {
    Array.from(buckets.entries()).forEach(([k, v]) => {
      if (!v.some((t: number) => now - t < windowMs)) buckets.delete(k);
    });
  }
  return recent.length > max;
}

export function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}
