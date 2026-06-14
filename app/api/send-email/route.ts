import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendSystemEmail } from '@/lib/emailService';
import type { SendEmailResponse } from '@/lib/types';

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
        { success: false, error: 'Validation failed', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { to, subject, html, orderId } = parsed.data;

    // Call the shared service
    const data = await sendSystemEmail({ to, subject, html, orderId });

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (err: any) {
    console.error('Email API Critical Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}