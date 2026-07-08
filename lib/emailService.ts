import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);

// Use Service Role for backend logging bypassing RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function sendSystemEmail(params: {
  to: string;
  subject: string;
  html: string;
  orderId?: string;
  attachments?: { filename: string; content: Buffer | string }[];
  batchId?: string;
}) {
  const { to, subject, html, orderId, attachments, batchId } = params;

  // Always use your verified domain
  const senderEmail = 'YourResearchWriter <noreply@yourresearchwriter.com.ng>';

  const { data, error } = await resend.emails.send({
    from: senderEmail,
    to: [to],
    subject,
    html,
    ...(attachments?.length
      ? { attachments: attachments.map(a => ({ filename: a.filename, content: a.content })) }
      : {}),
  });

  if (error) {
    console.error('Resend Transmission Error:', error);
    throw new Error(error.message);
  }

  // 2. Safely log the email in the database
  try {
    // email_logs.order_id is a FK to orders.order_id (the human-readable
    // string id, e.g. "RW-483920") — NOT orders.id (the bigint PK). Confirm
    // the order exists so we never violate the FK; fall back to null.
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

  return data;
}