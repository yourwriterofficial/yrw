import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

// Use Secret / Service Role key for backend logging bypassing RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
);

export interface SystemEmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface SendSystemEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  orderId?: string | number;
  attachments?: SystemEmailAttachment[];
  batchId?: string;
  fromName?: string;
  from?: string;
  replyTo?: string;
}

function normalizeBrevoKey(raw: string | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (trimmed.startsWith('xkeysib-')) return trimmed;
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded) as { api_key?: string };
    if (parsed?.api_key && parsed.api_key.startsWith('xkeysib-')) {
      return parsed.api_key.trim();
    }
  } catch {
    /* fallback to raw */
  }
  return trimmed;
}

function toBase64String(content: Buffer | string): string {
  if (Buffer.isBuffer(content)) {
    return content.toString('base64');
  }
  const str = String(content);
  if (str.startsWith('data:')) {
    const comma = str.indexOf(',');
    if (comma !== -1) return str.slice(comma + 1);
  }
  return Buffer.from(str, 'utf-8').toString('base64');
}

function parseSender(
  fromStr?: string,
  defaultName = 'YourResearchWriter',
  defaultEmail = 'noreply@yourresearchwriter.com.ng'
): { name: string; email: string } {
  if (!fromStr) return { name: defaultName, email: defaultEmail };
  const m = fromStr.match(/^\s*(?:"?([^"<]+)"?\s*)?<([^>\s]+)>\s*$/);
  if (m) {
    return { name: (m[1] || defaultName).trim(), email: m[2].trim() };
  }
  if (fromStr.includes('@')) {
    return { name: defaultName, email: fromStr.trim() };
  }
  return { name: defaultName, email: defaultEmail };
}

export async function sendSystemEmail(params: SendSystemEmailParams) {
  const { to, subject, html, text, orderId, attachments, batchId, fromName, from, replyTo } = params;

  const defaultSenderName = fromName || 'YourResearchWriter';
  const defaultSenderEmail = 'noreply@yourresearchwriter.com.ng';
  const parsedSender = parseSender(from, defaultSenderName, defaultSenderEmail);
  const senderEmailString = `${parsedSender.name} <${parsedSender.email}>`;

  let providerId: string | null = null;
  let deliveredVia: string | null = null;
  const errors: string[] = [];

  // 1. Primary: Resend
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  if (resendApiKey) {
    try {
      const resend = new Resend(resendApiKey);
      const resendPayload: Parameters<typeof resend.emails.send>[0] = {
        from: senderEmailString,
        to: [to],
        subject,
        html,
      };
      if (text) resendPayload.text = text;
      if (replyTo) resendPayload.replyTo = replyTo;
      if (attachments?.length) {
        resendPayload.attachments = attachments.map((a) => ({
          filename: a.filename,
          content: a.content,
        }));
      }

      const { data, error } = await resend.emails.send(resendPayload);
      if (!error && data?.id) {
        providerId = data.id;
        deliveredVia = 'resend';
      } else if (error) {
        console.warn('[Resend Transmission Error, trying fallbacks]:', error.message);
        errors.push(`Resend: ${error.message}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[Resend Dispatch Exception, trying fallbacks]:', msg);
      errors.push(`Resend exception: ${msg}`);
    }
  }

  // 2. Fallback: Brevo (Sendinblue)
  if (!deliveredVia) {
    const rawBrevoKey = process.env.BREVO_API_KEY || process.env.BREVO_MCP_API_KEY;
    const brevoKey = normalizeBrevoKey(rawBrevoKey);
    if (brevoKey) {
      try {
        const body: Record<string, unknown> = {
          sender: { name: parsedSender.name, email: parsedSender.email },
          to: [{ email: to }],
          subject,
          htmlContent: html,
        };
        if (text) body.textContent = text;
        if (replyTo) body.replyTo = { email: replyTo };
        if (attachments?.length) {
          body.attachment = attachments.map((a) => ({
            name: a.filename,
            content: toBase64String(a.content),
          }));
        }

        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': brevoKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15000),
        });

        if (res.ok) {
          const sent = (await res.json().catch(() => ({}))) as { messageId?: string };
          providerId = sent?.messageId || `brevo_${Date.now()}`;
          deliveredVia = 'brevo';
        } else {
          const errTxt = await res.text().catch(() => '');
          console.warn('[Brevo Transmission Error, trying next fallback]:', res.status, errTxt.slice(0, 160));
          errors.push(`Brevo ${res.status}: ${errTxt.slice(0, 160)}`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('[Brevo Dispatch Exception, trying next fallback]:', msg);
        errors.push(`Brevo exception: ${msg}`);
      }
    }
  }

  // 3. Fallback: Cloudflare Email Worker
  if (!deliveredVia) {
    const cfUrl = process.env.CLOUDFLARE_EMAIL_WORKER_URL?.trim();
    const sharedSecret = (process.env.EMAIL_INGEST_SECRET || process.env.MAIL_SECRET || '').trim();
    if (cfUrl) {
      try {
        const res = await fetch(cfUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(sharedSecret ? { 'x-email-secret': sharedSecret, Authorization: `Bearer ${sharedSecret}` } : {}),
          },
          body: JSON.stringify({
            from: senderEmailString,
            fromName: parsedSender.name,
            replyTo,
            to,
            subject,
            html,
            text,
            attachments: attachments?.map((a) => ({
              filename: a.filename,
              content: toBase64String(a.content),
              contentType: a.contentType,
            })),
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (res.ok) {
          const sent = (await res.json().catch(() => ({}))) as { ok?: boolean; success?: boolean; id?: string; via?: string };
          if (sent?.ok !== false && sent?.success !== false) {
            providerId = sent?.id || `cf_${Date.now()}`;
            deliveredVia = sent?.via || 'cloudflare_email';
          } else {
            errors.push('Cloudflare Email Worker returned false');
          }
        } else {
          const errTxt = await res.text().catch(() => '');
          errors.push(`Cloudflare Worker ${res.status}: ${errTxt.slice(0, 160)}`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Cloudflare Worker exception: ${msg}`);
      }
    }
  }

  // 4. Fallback: Google Apps Script Mailer Relay
  if (!deliveredVia) {
    const gasUrl = (process.env.GOOGLE_APPS_SCRIPT_MAIL_URL || process.env.GOOGLE_APPS_SCRIPT_URL || '').trim();
    const gasSecret = (process.env.MAIL_SECRET || process.env.EMAIL_INGEST_SECRET || '').trim();
    if (gasUrl) {
      try {
        const res = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          redirect: 'follow',
          body: JSON.stringify({
            ...(gasSecret ? { secret: gasSecret } : {}),
            to,
            subject,
            html,
            text,
            fromName: parsedSender.name,
            replyTo,
            attachments: attachments?.map((a) => ({
              filename: a.filename,
              content: toBase64String(a.content),
              contentType: a.contentType,
            })),
          }),
          signal: AbortSignal.timeout(20000),
        });

        const gasJson = res.ok ? ((await res.json().catch(() => null)) as { ok?: boolean; success?: boolean; error?: string } | null) : null;
        if (gasJson?.ok || gasJson?.success) {
          providerId = `apps_script_${Date.now()}`;
          deliveredVia = 'google_apps_script';
        } else {
          errors.push(`Apps Script ${res.status}: ${gasJson?.error || 'Failed'}`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Apps Script exception: ${msg}`);
      }
    }
  }

  if (!deliveredVia) {
    const finalErr = `All email providers failed: ${errors.join(' | ') || 'No email provider configured'}`;
    console.error('[sendSystemEmail Total Failure]', finalErr);
    // Log failure to DB before throwing
    try {
      await supabase.from('email_logs').insert({
        recipient: to,
        subject,
        status: 'failed',
        sent_at: new Date().toISOString(),
        body: html,
        batch_id: batchId || null,
        error_message: finalErr.slice(0, 500),
      });
    } catch {}
    throw new Error(finalErr);
  }

  // 5. Safely log the email in the database
  try {
    let dbOrderId: string | null = null;
    if (orderId) {
      const oidStr = String(orderId).trim();
      const { data: orderData } = await supabase
        .from('orders')
        .select('order_id')
        .eq('order_id', oidStr)
        .maybeSingle();
      dbOrderId = orderData?.order_id ?? null;
    }

    const { error: logError } = await supabase.from('email_logs').insert({
      order_id: dbOrderId,
      recipient: to,
      subject,
      status: 'sent',
      sent_at: new Date().toISOString(),
      body: html,
      batch_id: batchId || null,
    });

    if (logError) console.warn('Failed to log email:', logError.message);
  } catch (dbErr) {
    console.warn('Database error during email logging:', dbErr);
  }

  return { id: providerId, via: deliveredVia };
}
