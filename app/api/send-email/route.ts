import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { SendEmailResponse } from '@/lib/types';

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const emailRequestSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  html: z.string().min(1),
  orderId: z.string().optional(),
});

export async function POST(request: Request): Promise<NextResponse<SendEmailResponse>> {
  try {
    const body = await request.json();
    const parsed = emailRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { to, subject, html, orderId } = parsed.data;

    const senderEmail = process.env.NODE_ENV === 'production'
      ? 'YourWriterOfficial <noreply@yourwriterofficial.com>'
      : 'YourWriterOfficial <onboarding@resend.dev>';

    const { data, error } = await resend.emails.send({
      from: senderEmail,
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error('Resend Transmission Error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (orderId) {
      const { error: logError } = await supabase.from('email_logs').insert({
        order_id: orderId.replace('RW-', ''),
        recipient: to,
        subject,
        status: 'sent',
        sent_at: new Date().toISOString(),
      });
      if (logError) console.warn('Failed to log email:', logError.message);
    }

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (err: any) {
    console.error('Email API Critical Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}