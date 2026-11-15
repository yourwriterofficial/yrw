import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { runDueAnnouncements } from '@/lib/announcements';

export const dynamic = 'force-dynamic';

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET || '';
  if (!secret) return false;
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || token.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(secret));
}

/**
 * Sends scheduled announcements that are due. Called on a timer (the same Cloudflare Worker that reconciles payments
 * can call this every few minutes). Claiming each announcement first means calling it twice never sends twice.
 */
export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sent = await runDueAnnouncements();
  return NextResponse.json({ ok: true, sent });
}
