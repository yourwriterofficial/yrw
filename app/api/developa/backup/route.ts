import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { runPlatformBackup } from '@/lib/platformBackup';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET || '';
  if (!secret) return false;
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || token.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(secret));
}

/** Called once a night by the Cloudflare timer. Sends one encrypted copy of the database to private Google Drive. */
export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const result = await runPlatformBackup();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Backup failed';
    console.error('Platform backup failed:', message);
    // A failed backup must be noticed: tell the team by email (never the data, only the reason).
    try {
      const { sendSystemEmail } = await import('@/lib/emailService');
      await sendSystemEmail({
        to: process.env.ERROR_ALERT_TO || 'support@developa.me',
        subject: '[Developa] Nightly backup FAILED',
        html: `<h2>The nightly backup did not finish</h2><p><strong>${message.replace(/</g, '&lt;')}</strong></p><p>Check the Google Drive folder "Developa Backups (private)" and the Vercel logs.</p>`,
      });
    } catch {
      // ignore
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
