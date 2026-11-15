import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { InboxNeedsUpdate } from '@/lib/inbox';

/** Shared by the inbox routes: only admins get in, and a missing table or a failure becomes a clear message. */
export async function adminOnly() {
  const g = await requireAdmin();
  return g.ok ? { ok: true as const, g } : { ok: false as const, res: NextResponse.json({ error: g.error }, { status: g.status }) };
}

export function failure(err: unknown, fallback: string) {
  if (err instanceof InboxNeedsUpdate) return NextResponse.json({ error: err.message, needs_update: true }, { status: 503 });
  const message = err instanceof Error ? err.message : fallback;
  return NextResponse.json({ error: message || fallback }, { status: 500 });
}
