import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

/**
 * DISABLED — superseded by app/api/admin/update-order/route.ts.
 *
 * This function duplicated the order-status emails that the Next.js route
 * already sends through lib/emailTemplates.ts, with three defects:
 *   1. Bare `<p>` bodies with no branded template at all.
 *   2. `from: noreply@yourresearchwriter.com` — the verified Resend domain is
 *      `yourresearchwriter.com.ng`, so Resend rejected every send and it fell
 *      through to the Apps Script fallback, delivering the unstyled version.
 *   3. It logged `email_logs.order_id = String(record.id)` (the bigint PK)
 *      when that column is an FK to `orders.order_id` (the "RW-…" string),
 *      so the log insert always violated the constraint.
 *
 * Left in place rather than deleted so the deployed endpoint keeps returning
 * 200 to any still-attached database webhook instead of erroring. Detach the
 * webhook in the Supabase dashboard, then this file can be removed entirely.
 */
const DISABLED = true;

Deno.serve(async (req) => {
  if (DISABLED) return new Response('disabled: handled by /api/admin/update-order', { status: 200 });

  const payload = await req.json();
  const { old_record, record, type } = payload;

  if (type !== 'UPDATE') return new Response('ignore', { status: 200 });

  const oldStatus = old_record.workflow_status;
  const newStatus = record.workflow_status;
  if (oldStatus === newStatus) return new Response('no change', { status: 200 });

  let subject = '', html = '';
  switch (newStatus) {
    case 'Quote Sent':
      subject = `Quote Ready for ${record.order_id}`;
      html = `<p>Your quote is ready. <a href="${Deno.env.get('APP_URL')}/dashboard/client">Log in</a> to pay.</p>`;
      break;
    case 'Synthesis Active':
      subject = `Work Started on ${record.order_id}`;
      html = `<p>We have started working on your order.</p>`;
      break;
    case 'Work Submitted':
      subject = `Draft Ready for ${record.order_id}`;
      html = `<p>Pay the balance to unlock your file.</p>`;
      break;
    case 'Completed':
      subject = `Order ${record.order_id} Completed`;
      html = `<p>Your order is complete. Thank you.</p>`;
      break;
    default: return new Response('no email', { status: 200 });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('Resend API key not configured');
    }
    await resend.emails.send({
      from: 'Research Writer <noreply@yourresearchwriter.com>',
      to: record.email,
      subject,
      html,
    });
  } catch (resendError: any) {
    console.warn("Resend failed, trying fallback to Apps Script:", resendError.message);
    const appsScriptUrl = Deno.env.get('GOOGLE_APPS_SCRIPT_URL');
    if (appsScriptUrl) {
      const fallbackResponse = await fetch(appsScriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: record.email, subject, html }),
      });
      if (!fallbackResponse.ok) {
        const fallbackText = await fallbackResponse.text();
        throw new Error(`Both Resend and Apps Script fallback failed. Apps Script error: ${fallbackText}`, { cause: resendError });
      }
    } else {
      throw resendError;
    }
  }

  // Log successfully dispatched email to database
  try {
    await supabase.from('email_logs').insert({
      order_id: String(record.id),
      recipient: record.email,
      subject,
      status: 'sent',
      sent_at: new Date().toISOString(),
      body: html,
    });
  } catch (dbErr: any) {
    console.warn('Failed to insert email log in edge function:', dbErr.message);
  }

  return new Response('email sent', { status: 200 });
});