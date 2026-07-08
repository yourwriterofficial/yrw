import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

const invoiceRequestSchema = z.object({
  orderId: z.string().min(5),
  amount: z.number().positive(),
  email: z.string().email(),
  name: z.string().min(1),
  type: z.string().min(3),
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = invoiceRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
    }

    const { orderId, amount, email, name, type } = parsed.data;

    const authSupabase = await createServerClient();
    const { data: { user } } = await authSupabase.auth.getUser();

    // 1. Verify order or custom invoice exists
    const isCustomInvoice = orderId.startsWith('INV-');
    let orderData = null;
    let tx_ref = '';

    if (isCustomInvoice) {
      const { data: customInvoice, error: custErr } = await supabase
        .from('custom_invoices')
        .select('*')
        .eq('invoice_number', orderId)
        .single();
      
      if (custErr || !customInvoice) {
        return NextResponse.json({ error: 'Custom invoice not found' }, { status: 404 });
      }
      orderData = customInvoice;
      tx_ref = `CUSTINV_${orderId}_${type}_${Date.now()}`;
    } else {
      // Verify order exists
      const { data: dbOrder, error: lookupError } = await supabase
        .from('orders')
        .select('*')
        .eq('order_id', orderId)
        .single();

      if (lookupError || !dbOrder) {
        return NextResponse.json({ error: 'Order not found in database' }, { status: 404 });
      }
      
      orderData = dbOrder;
      tx_ref = `INV_${orderId}_${type}_${Date.now()}`;
    }

    // 2. Check if user is logged in and has sufficient wallet balance
    if (user) {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', user.id)
        .single();
      
      const balance = Number(wallet?.balance) || 0;
      if (balance >= amount) {
        // 1. Debit wallet
        const { error: debitErr } = await supabase.rpc('increment_wallet', { user_id: user.id, add_amount: -amount });
        if (debitErr) {
          return NextResponse.json({ error: 'Wallet debit failed: ' + debitErr.message }, { status: 500 });
        }

        // 2. Insert transaction
        await supabase.from('transactions').insert({
          user_id: user.id,
          amount,
          type: 'payment',
          reference: tx_ref,
          status: 'completed',
        });

        // 3. Process updates and notifications
        const { notifyUser, notifyAdmins } = await import('@/lib/notify');
        const { emailTemplates, emailShell } = await import('@/lib/emailTemplates');

        if (isCustomInvoice) {
          // Custom invoice milestone update
          const milestoneIndex = parseInt(type.replace('INDEX-', ''), 10);
          const milestones = orderData.milestones || [];
          if (milestones[milestoneIndex]) {
            milestones[milestoneIndex].paid = true;
            milestones[milestoneIndex].paid_at = new Date().toISOString();
            milestones[milestoneIndex].tx_ref = tx_ref;
          }
          
          const allPaid = milestones.every((m: any) => m.paid);
          const anyPaid = milestones.some((m: any) => m.paid);
          const newStatus = allPaid ? 'PAID' : (anyPaid ? 'PARTIALLY_PAID' : 'PENDING');
          
          await supabase
            .from('custom_invoices')
            .update({
              milestones,
              status: newStatus,
              updated_at: new Date().toISOString()
            })
            .eq('invoice_number', orderId);

          const paidMilestone = milestones[milestoneIndex];
          const milestoneName = paidMilestone?.name || `Milestone #${milestoneIndex + 1}`;

          if (orderData.email) {
            const clientHtml = emailShell(
              `<h2>Payment Confirmed</h2>
               <p>Hi ${orderData.client_name || 'there'},</p>
               <p>Your payment of <strong>₦${amount.toLocaleString()}</strong> for milestone <strong>${milestoneName}</strong> on invoice <strong>${orderId}</strong> has been confirmed via your wallet balance.</p>
               <p>Invoice status: <strong>${newStatus}</strong>${allPaid ? ' — all milestones have been cleared. Thank you!' : ' — remaining milestones are still outstanding.'}</p>`,
              'View Invoice', `${process.env.NEXT_PUBLIC_BASE_URL}/invoice/${orderId}`
            );
            const { sendSystemEmail } = await import('@/lib/emailService');
            await sendSystemEmail({
              to: orderData.email,
              subject: `Payment Confirmed: ${milestoneName} — Invoice #${orderId}`,
              html: clientHtml,
            }).catch(e => console.warn('Custom invoice email failed:', e));
          }

          // In-app for user (if user profile matching email exists)
          const { data: matchedProfile } = await supabase.from('profiles').select('id').eq('email', orderData.email.toLowerCase().trim()).maybeSingle();
          if (matchedProfile?.id) {
            await notifyUser({
              userId: matchedProfile.id,
              title: `Milestone Paid: ${milestoneName}`,
              message: `Your payment of ₦${amount.toLocaleString()} for "${milestoneName}" was paid using your wallet balance.`,
              type: 'payment',
              link: `/dashboard/client`,
            });
          }

          // Admin notification
          const adminHtml = emailShell(
            `<h2>Custom Invoice Payment Confirmed</h2>
             <p><strong>${orderData.client_name || 'Client'}</strong> (${orderData.email || 'No email'}) paid a custom invoice milestone via wallet balance.</p>
             <p>Invoice: <strong>${orderId}</strong><br/>
                Milestone: <strong>${milestoneName}</strong><br/>
                Amount Paid: <strong>₦${amount.toLocaleString()}</strong><br/>
                Reference: ${tx_ref}
             </p>`,
            'Open Invoice', `${process.env.NEXT_PUBLIC_BASE_URL}/invoice/${orderId}`
          );
          await notifyAdmins({
            title: `Custom Invoice Milestone Paid: ₦${amount.toLocaleString()}`,
            message: `${orderData.client_name || 'Client'} paid ₦${amount.toLocaleString()} for milestone "${milestoneName}" on invoice ${orderId} (Wallet).`,
            type: 'payment',
            link: `/invoice/${orderId}`,
            emailHtml: adminHtml,
            emailSubject: `[PAID] Custom Invoice Milestone: ${milestoneName} - Invoice #${orderId}`,
          });

        } else {
          // Standard order milestone update
          let milestoneIndex = 0;
          if (type.startsWith('INDEX-')) {
            milestoneIndex = parseInt(type.replace('INDEX-', ''), 10);
          } else if (type === 'BALANCE') {
            milestoneIndex = 1;
          }

          const milestones = orderData.payment_milestones || [];
          if (milestones[milestoneIndex]) {
            milestones[milestoneIndex].paid = true;
            milestones[milestoneIndex].paid_at = new Date().toISOString();
            milestones[milestoneIndex].tx_ref = tx_ref;
          }

          const allPaid = milestones.every((m: any) => m.paid);
          const firstPaid = milestones[0]?.paid;

          const updates = {
            payment_milestones: milestones,
            sixty_percent_paid: firstPaid || false,
            forty_percent_paid: allPaid || false,
            workflow_status: allPaid ? 'Completed' : (firstPaid ? 'Synthesis Active' : 'Briefing Received')
          };

          await supabase.from('orders').update(updates).eq('order_id', orderId);

          const paidMilestone = milestones[milestoneIndex];
          const milestoneName = paidMilestone?.name || `Milestone #${milestoneIndex + 1}`;

          const orderEmailData = {
            order_id: orderData.order_id,
            legal_name: orderData.legal_name,
            email: orderData.email,
            topic: orderData.topic,
            financial_quote: orderData.financial_quote,
          };

          const isFullyPaid = updates.forty_percent_paid;
          const template = emailTemplates.milestonePaid(
            orderEmailData,
            { name: milestoneName, amount: amount, percentage: paidMilestone?.percentage || 50 },
            isFullyPaid
          );

          if (orderData.client_id) {
            await notifyUser({
              userId: orderData.client_id,
              title: `Payment Confirmed: ${milestoneName}`,
              message: isFullyPaid
                ? `All milestones on ${orderData.order_id} are paid — files unlocked.`
                : `Your "${milestoneName}" payment on ${orderData.order_id} is confirmed (Wallet).`,
              type: 'payment',
              link: `/dashboard/client`,
              orderDbId: orderData.id,
              emailHtml: template.html,
              emailSubject: template.subject,
            });

            await notifyAdmins({
              title: `Milestone Paid (Wallet): ${orderData.order_id}`,
              message: `${orderData.legal_name} paid milestone "${milestoneName}" (₦${amount.toLocaleString()}) for order "${orderData.topic}" (Wallet).`,
              type: 'payment',
              link: `/admin/orders?open=${orderData.order_id}`,
              orderDbId: orderData.id,
              emailHtml: template.html,
              emailSubject: `[PAID] Milestone: ${milestoneName} - Order #${orderId}`,
            });
          }
        }

        return NextResponse.json({ paid_via_wallet: true, tx_ref });
      }
    }

    // 3. Fallback: Call Paystack API to initialize transaction
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reference: tx_ref,
        amount: amount * 100,
        email: email,
        callback_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment/callback?tx_ref=${tx_ref}`,
        metadata: {
          custom_fields: [
            { display_name: "Client Name", variable_name: "client_name", value: name },
            { display_name: "Order ID", variable_name: "order_id", value: orderId },
            { display_name: "Invoice Type", variable_name: "invoice_type", value: type }
          ]
        }
      }),
    });

    const paystackData = await response.json();

    if (paystackData.status === true) {
      if (!isCustomInvoice && orderData) {
        await supabase.from('invoices').insert({
          order_id: orderData.id,
          amount,
          type: (type === 'DEPOSIT' || type === 'BALANCE') ? type : 'DEPOSIT',
          flutterwave_transaction_ref: tx_ref, 
          status: 'PENDING',
        });
      }

      return NextResponse.json({ link: paystackData.data.authorization_url, tx_ref });
    } else {
      throw new Error(paystackData.message || 'Paystack API Error');
    }
  } catch (err: any) {
    console.error('Invoice Generation Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}