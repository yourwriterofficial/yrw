import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { sendSystemEmail } from '@/lib/emailService';

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify Admin rights
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();

    if (!profile || !profile.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { email, topic, department, level, price } = await request.json();
    if (!email || !topic || !department || !level || !price) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const numericPrice = Number(price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      return NextResponse.json({ error: 'Invalid price quoted' }, { status: 400 });
    }

    // 1. Check if user already exists
    let userId = '';
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Find user in auth or create a new user account
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
      const matchedUser = authUsers?.users.find(u => u.email?.toLowerCase() === email.trim().toLowerCase());
      
      if (matchedUser) {
        userId = matchedUser.id;
      } else {
        // Create user
        const { data: createdUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: email.trim().toLowerCase(),
          email_confirm: true,
          user_metadata: { full_name: email.split('@')[0] }
        });

        if (createErr || !createdUser.user) {
          throw new Error('Failed to auto-register guest user: ' + (createErr?.message || 'unknown'));
        }
        
        userId = createdUser.user.id;

        // Create profile
        const { error: profErr } = await supabaseAdmin.from('profiles').upsert({
          id: userId,
          full_name: email.split('@')[0],
          is_admin: false,
        });
        if (profErr) console.warn('Failed to upsert new profile:', profErr.message);
      }
    }

    // 2. Initialize Paystack Transaction
    const reference = `PROJ_${Date.now()}_${userId.slice(0, 8)}`;
    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        amount: numericPrice * 100,
        reference,
        callback_url: `${BASE_URL}/payment/callback?tx_ref=${reference}`,
        metadata: {
          type: 'project_material',
          userId,
          title: topic,
          department,
          level,
          price: numericPrice,
          addons: 'None',
          name: email.split('@')[0],
          guestCheckout: false,
          guestEmail: null,
        },
      }),
    });

    const data = await res.json();
    if (!data.status) {
      throw new Error(data.message || 'Paystack initialization failed');
    }

    const authUrl = data.data.authorization_url;

    // 3. Send Email Notification with Template
    const emailSubject = `Payment Link Generated: ${topic}`;
    const { emailShell } = await import('@/lib/emailTemplates');
    const emailHtml = emailShell(
      `<h2>Payment Link Prepared</h2>
       <p>Hello,</p>
       <p>An administrator has prepared a custom payment link for your research project topic. Please find the order and billing specification details below:</p>
       
       <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin: 24px 0;">
         <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
           <tr>
             <td style="padding: 6px 0; color: #6b7280; font-weight: 600; width: 120px;">Project Topic:</td>
             <td style="padding: 6px 0; color: #111827; font-weight: 700;">${topic}</td>
           </tr>
           <tr>
             <td style="padding: 6px 0; color: #6b7280; font-weight: 600;">Department:</td>
             <td style="padding: 6px 0; color: #111827; font-weight: 700;">${department}</td>
           </tr>
           <tr>
             <td style="padding: 6px 0; color: #6b7280; font-weight: 600;">Academic Level:</td>
             <td style="padding: 6px 0; color: #111827; font-weight: 700;">${level}</td>
           </tr>
           <tr style="border-top: 1px dashed #e5e7eb;">
             <td style="padding: 12px 0 6px 0; color: #6b7280; font-weight: 600;">Total Cost:</td>
             <td style="padding: 12px 0 6px 0; color: #10b981; font-weight: 900; font-size: 16px;">₦${numericPrice.toLocaleString()}</td>
           </tr>
         </table>
       </div>
       
       <p>To proceed, please click the secure payment link below. Once payment is completed successfully, your dashboard account will be provisioned automatically, and the writing pipeline will be activated.</p>`,
      'Pay & Activate Order',
      authUrl
    );
 
    await sendSystemEmail({
      to: email.trim().toLowerCase(),
      subject: emailSubject,
      html: emailHtml,
    });

    return NextResponse.json({ success: true, authorization_url: authUrl, reference });
  } catch (error: any) {
    console.error('Generate payment link error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
