import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);

// Use Service Role for backend logging bypassing RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function sendSystemEmail(params: { to: string; subject: string; html: string; orderId?: string }) {
  const { to, subject, html, orderId } = params;

  // Always use your verified domain
  const senderEmail = 'YourResearchWriter <noreply@yourresearchwriter.com.ng>';

  const { data, error } = await resend.emails.send({
    from: senderEmail,
    to: [to],
    subject,
    html,
  });

  if (error) {
    console.error('Resend Transmission Error:', error);
    throw new Error(error.message);
  }

  // 2. Safely log the email in the database
  if (orderId) {
    try {
      // Look up the internal numeric ID first to prevent foreign key constraints failing
      const { data: orderData, error: lookupError } = await supabase
        .from('orders')
        .select('id')
        .eq('order_id', orderId)
        .single();

      if (orderData && !lookupError) {
        const { error: logError } = await supabase.from('email_logs').insert({
          order_id: orderData.id,
          recipient: to,
          subject,
          status: 'sent',
          sent_at: new Date().toISOString(),
        });
        
        if (logError) console.warn('Failed to log email:', logError.message);
      }
    } catch (dbErr) {
      console.warn('Database error during email logging:', dbErr);
      // We don't throw here to prevent failing the overall email success response
    }
  }

  return data;
}