import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

Deno.serve(async (req) => {
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
  return new Response('email sent', { status: 200 });
});