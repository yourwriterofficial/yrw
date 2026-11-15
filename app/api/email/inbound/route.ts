import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import xss from 'xss';
import { createClient } from '@supabase/supabase-js';
import { notifyAdmins } from '@/lib/notify';
import { ingestInbound, InboxNeedsUpdate } from '@/lib/inbox';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
);

/**
 * Every email sent to a developa.me or yourresearchwriter.com.ng address arrives here from the Cloudflare email worker.
 * It is filed into the shared support inbox (/admin/inbox), under the brand of the address it was sent to.
 * Until the inbox migration is applied it falls back to the old behaviour: a log line and an alert to the admins.
 */
export async function POST(req: NextRequest) {
  const expectedSecret = (process.env.EMAIL_INGEST_SECRET || process.env.MAIL_SECRET || '').trim();
  // The secret is only accepted in a header. A secret in the address ends up in logs and browser history.
  const headerSecret = req.headers.get('x-email-secret');
  const bearerSecret = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const providedSecret = (headerSecret || bearerSecret || '').trim();

  // Fails closed when no secret is configured, and compares in constant time.
  const a = Buffer.from(providedSecret);
  const b = Buffer.from(expectedSecret);
  if (!expectedSecret || a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();

    try {
      const result = await ingestInbound(body);
      return NextResponse.json({ message: 'Inbound email filed in the shared inbox', ...result });
    } catch (err) {
      if (!(err instanceof InboxNeedsUpdate)) throw err;
      console.warn('[Inbound Email] Shared inbox tables are not there yet; using the old alert instead.');
    }

    // Old behaviour, kept so no email is lost before the migration is applied.
    const to = String(body.to || '').trim();
    const from = String(body.from || '').trim();
    const fromName = String(body.fromName || body.from_name || '').trim();
    const subject = String(body.subject || '(No Subject)').trim();
    const text = String(body.text || body.body_text || '').trim();
    const html = String(body.html || body.body_html || '').trim();
    const rawBody = String(body.rawBody || '').trim();

    const displaySender = fromName ? `${fromName} <${from}>` : from;
    const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const bodyContent = html || text || rawBody || '(Empty body)';

    try {
      await supabase.from('email_logs').insert({
        recipient: to || 'inbox@yourresearchwriter.com.ng',
        subject: `[Inbound] ${subject} (from ${displaySender})`,
        status: 'received',
        sent_at: new Date().toISOString(),
        body: bodyContent.slice(0, 5000),
      });
    } catch (logErr) {
      console.warn('[Inbound Email] Failed to log in database:', logErr);
    }

    await notifyAdmins({
      title: `New Email: ${fromName || from}`,
      message: `${subject}\n${(text || bodyContent).slice(0, 160)}`,
      type: 'admin_message',
      emailSubject: `[Inbound Email] ${subject}`,
      emailHtml: `
        <div style="font-family: sans-serif; line-height: 1.5; color: #1e293b;">
          <h2 style="margin: 0 0 12px 0; color: #0f172a;">New Inbound Email Received</h2>
          <p><strong>From:</strong> ${esc(displaySender)}</p>
          <p><strong>To:</strong> ${esc(to)}</p>
          <p><strong>Subject:</strong> ${esc(subject)}</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
            ${html ? xss(html) : `<pre style="white-space: pre-wrap; margin: 0;">${esc(text || bodyContent)}</pre>`}
          </div>
        </div>
      `,
    }).catch((notifyErr) => {
      console.warn('[Inbound Email] Admin alert failed (non-fatal):', notifyErr);
    });

    return NextResponse.json({ success: true, message: 'Inbound email processed' });
  } catch (err: unknown) {
    console.error('[Inbound Email Processing Error]', err);
    return NextResponse.json({ error: 'Failed to process inbound email' }, { status: 500 });
  }
}
