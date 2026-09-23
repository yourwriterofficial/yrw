import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { sendSystemEmail } from '@/lib/emailService';
import { getUserBankDetails } from '@/lib/bankDetails';
import { createManualPaymentRequest } from '@/lib/manualPayments';

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

    // 2. Resolve Bank Details and Create Order
    const reference = `ORD_${Date.now()}_${userId.slice(0, 8)}`;
    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const bankDetails = await getUserBankDetails(userId);
    const orderStringId = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;

    const milestone = [
      {
        name: 'Full Payment',
        percentage: 100,
        amount: numericPrice,
        paid: false,
        delivered: false,
        trigger: 'Manual Bank Transfer',
      },
    ];

    await supabaseAdmin.from('orders').insert({
      order_id: orderStringId,
      client_id: userId,
      legal_name: email.split('@')[0],
      email: email.trim().toLowerCase(),
      topic,
      service_tier: level,
      financial_quote: numericPrice,
      workflow_status: 'Pending Bank Transfer',
      vault_status: 'Locked Until Payment Verified',
      payment_structure_type: '60/40',
      payment_milestones: milestone,
      sixty_percent_paid: false,
      forty_percent_paid: false,
      additional_info: `[ADMIN CUSTOM ORDER]\nDepartment: ${department}\nLevel: ${level}\nReference: ${reference}`,
    });

    await createManualPaymentRequest({
      reference,
      userId,
      orderId: orderStringId,
      paymentType: 'ORDER_DEPOSIT',
      amount: numericPrice,
      bankDetails,
      notes: `Admin prepared order: ${topic}`,
    });

    const invoiceUrl = `${BASE_URL}/invoice/${orderStringId}`;

    // 3. Send Email Notification with Bank Transfer Details
    const emailSubject = `Bank Transfer Invoice Prepared: ${topic}`;
    const { emailShell } = await import('@/lib/emailTemplates');
    const emailHtml = emailShell(
      `<h2>Payment Details Prepared</h2>
       <p>Hello,</p>
       <p>An administrator has prepared custom bank transfer details for your research project topic. Please review the billing information below:</p>
       
       <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin: 24px 0;">
         <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
           <tr>
             <td style="padding: 6px 0; color: #6b7280; font-weight: 600; width: 140px;">Project Topic:</td>
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
             <td style="padding: 12px 0 6px 0; color: #6b7280; font-weight: 600;">Amount Due:</td>
             <td style="padding: 12px 0 6px 0; color: #10b981; font-weight: 900; font-size: 16px;">₦${numericPrice.toLocaleString()}</td>
           </tr>
           <tr style="border-top: 1px dashed #e5e7eb;">
             <td style="padding: 12px 0 6px 0; color: #6b7280; font-weight: 600;">Bank Name:</td>
             <td style="padding: 12px 0 6px 0; color: #111827; font-weight: 700;">${bankDetails.bank_name}</td>
           </tr>
           <tr>
             <td style="padding: 6px 0; color: #6b7280; font-weight: 600;">Account Number:</td>
             <td style="padding: 6px 0; color: #111827; font-weight: 900; font-size: 15px;">${bankDetails.account_number}</td>
           </tr>
           <tr>
             <td style="padding: 6px 0; color: #6b7280; font-weight: 600;">Account Name:</td>
             <td style="padding: 6px 0; color: #111827; font-weight: 700;">${bankDetails.account_name}</td>
           </tr>
           <tr>
             <td style="padding: 6px 0; color: #6b7280; font-weight: 600;">Payment Reference:</td>
             <td style="padding: 6px 0; color: #6366f1; font-weight: 700;">${reference}</td>
           </tr>
         </table>
       </div>
       
       <p>Please make the bank transfer of <strong>₦${numericPrice.toLocaleString()}</strong> using the reference code above in your transfer narration. After transferring, click below to view your invoice or notify support on WhatsApp.</p>`,
      'View Invoice & Payment Details',
      invoiceUrl
    );
 
    await sendSystemEmail({
      to: email.trim().toLowerCase(),
      subject: emailSubject,
      html: emailHtml,
    });

    return NextResponse.json({ success: true, authorization_url: invoiceUrl, reference, bankDetails });
  } catch (error: any) {
    console.error('Generate payment link error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
