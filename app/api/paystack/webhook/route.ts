import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { notifyAdmins } from '@/lib/notify';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const startTime = Date.now();
  console.log('🔔 Webhook received at', new Date().toISOString());
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-paystack-signature');
    console.log('Raw body length:', rawBody.length);
    console.log('Signature present:', !!signature);

    // Verify signature
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
      .update(rawBody)
      .digest('hex');

    if (hash !== signature) {
      console.error('❌ Invalid Paystack Signature');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('✅ Signature verified');

    const payload = JSON.parse(rawBody);
    console.log('Event type:', payload.event);
    if (payload.event !== 'charge.success') {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const { reference, metadata } = payload.data;
    console.log('Reference:', reference);
    console.log('Full metadata:', JSON.stringify(metadata, null, 2));

    const { type } = metadata || {};

    // --- WALLET TOP-UP ---
    if (type === 'wallet_topup') {
      const { userId, amount } = metadata;
      console.log(`💰 Wallet top-up for user ${userId}, amount ${amount}`);

      if (!userId || !amount) {
        console.error('❌ Missing userId or amount in metadata');
        return NextResponse.json({ error: 'Invalid metadata' }, { status: 400 });
      }

      const numericAmount = Number(amount);
      if (isNaN(numericAmount) || numericAmount <= 0) {
        console.error('❌ Invalid amount:', amount);
        return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
      }

      const { error: rpcError, data: rpcData } = await supabase.rpc('increment_wallet', {
        user_id: userId,
        add_amount: numericAmount,
      });

      if (rpcError) {
        console.error('❌ RPC error:', rpcError);
        return NextResponse.json({ error: `RPC failed: ${rpcError.message}` }, { status: 500 });
      }
      console.log('✅ Wallet updated, RPC returned:', rpcData);

      const { error: txError, data: txData } = await supabase.from('transactions').insert({
        user_id: userId,
        amount: numericAmount,
        type: 'deposit',
        reference,
        status: 'completed',
      }).select();

      if (txError) {
        console.error('❌ Transaction insert error:', txError);
      } else {
        console.log('✅ Transaction logged:', txData);
      }

      // Notify admin of wallet topup
      try {
        const { data: userProfile } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
        const { data: userData } = await supabase.auth.getUser(); // Try to get user from auth if needed or auth.admin
        const { data: adminUserData } = await supabase.auth.admin.getUserById(userId);
        if (userProfile && adminUserData?.user) {
          const { emailTemplates } = await import('@/lib/emailTemplates');
          const adminMailData = emailTemplates.adminWalletTopup({
            email: adminUserData.user.email || '',
            full_name: userProfile.full_name || 'Client',
            amount: numericAmount,
            reference
          });
          await notifyAdmins({
            title: `Wallet Top-up: ${userProfile.full_name}`,
            message: `${userProfile.full_name} (${adminUserData.user.email}) topped up ₦${numericAmount.toLocaleString()}.`,
            type: 'payment',
            emailHtml: adminMailData.html,
            emailSubject: adminMailData.subject,
          });
          console.log('✅ Admins notified of wallet top-up');
        }
      } catch (e) {
        console.warn('Admin wallet topup notification failed:', e);
      }

      console.log(`✅ Wallet top-up processed successfully in ${Date.now() - startTime}ms`);
      return NextResponse.json({ received: true });
    }

    // --- CUSTOM INVOICE PAYMENT ---
    if (reference && reference.startsWith('CUSTINV_')) {
      console.log('Processing custom invoice payment...');
      const parts = reference.split('_');
      const invoiceNumber = parts[1];
      const milestoneType = parts[2]; // INDEX-0, INDEX-1, etc.
      
      if (!invoiceNumber || !milestoneType || !milestoneType.startsWith('INDEX-')) {
        console.error('Invalid custom invoice reference format:', reference);
        return NextResponse.json({ error: 'Invalid reference format' }, { status: 400 });
      }
      
      const milestoneIndex = parseInt(milestoneType.replace('INDEX-', ''), 10);
      
      const { data: invoiceData, error: invoiceErr } = await supabase
        .from('custom_invoices')
        .select('*')
        .eq('invoice_number', invoiceNumber)
        .single();
        
      if (invoiceErr || !invoiceData) {
        throw new Error(`Custom invoice ${invoiceNumber} not found.`);
      }
      
      const milestones = invoiceData.milestones || [];
      if (milestones[milestoneIndex]) {
        milestones[milestoneIndex].paid = true;
        milestones[milestoneIndex].paid_at = new Date().toISOString();
        milestones[milestoneIndex].tx_ref = reference;
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
        .eq('invoice_number', invoiceNumber)
        .throwOnError();
        
      console.log(`✅ Custom invoice milestone updated successfully. Invoice Status: ${newStatus}`);
      return NextResponse.json({ received: true });
    }

    // --- ORDER PAYMENT (existing logic) ---
    console.log('Processing order payment...');
    const tx_ref = reference;
    const parts = tx_ref.split('_');
    const orderStringId = parts[1];
    const paymentType = parts[2];

    if (!orderStringId || !paymentType) {
      console.error('Invalid payment reference format:', tx_ref);
      return NextResponse.json({ error: 'Invalid reference format' }, { status: 400 });
    }

    await supabase
      .from('invoices')
      .update({ status: 'PAID', paid_at: new Date().toISOString() })
      .eq('flutterwave_transaction_ref', tx_ref)
      .throwOnError();

    const { data: orderInfo, error: orderError } = await supabase
      .from('orders')
      .select('id, email, legal_name, financial_quote, topic, order_id')
      .eq('order_id', orderStringId)
      .single();

    if (orderError || !orderInfo) {
      throw new Error(`Order ${orderStringId} not found.`);
    }

    const orderEmailData = {
      order_id: orderInfo.order_id,
      legal_name: orderInfo.legal_name,
      email: orderInfo.email,
      topic: orderInfo.topic,
      financial_quote: orderInfo.financial_quote,
    };

    let updates: any = {};
    let template = null;
    let adminTemplate = null;
    
    if (paymentType.startsWith('ADDON-')) {
      const addonId = paymentType.replace('ADDON-', '');
      const { data: orderDetails, error: fetchOrderError } = await supabase
        .from('orders')
        .select('additional_info, client_id')
        .eq('order_id', orderStringId)
        .single();
        
      if (fetchOrderError || !orderDetails) {
        throw new Error(`Order ${orderStringId} not found for addon payment.`);
      }
      
      let addonPayload: any = {};
      try {
        addonPayload = JSON.parse(orderDetails.additional_info || '{}');
      } catch {}
      
      if (addonPayload.extra_addons && Array.isArray(addonPayload.extra_addons)) {
        const addonIndex = addonPayload.extra_addons.findIndex((a: any) => a.id === addonId);
        if (addonIndex !== -1) {
          addonPayload.extra_addons[addonIndex].status = 'PAID';
          
          await supabase
            .from('orders')
            .update({ additional_info: JSON.stringify(addonPayload) })
            .eq('order_id', orderStringId)
            .throwOnError();
            
          // Log to transactions table
          if (orderDetails.client_id) {
            await supabase.from('transactions').insert({
              user_id: orderDetails.client_id,
              amount: addonPayload.extra_addons[addonIndex].price,
              type: 'payment',
              reference: tx_ref,
              status: 'completed',
            });
          }
        }
      }
      return NextResponse.json({ received: true });
    } else if (paymentType.startsWith('INDEX-')) {
      const milestoneIndex = parseInt(paymentType.replace('INDEX-', ''), 10);
      const { data: orderData, error: fetchError } = await supabase
        .from('orders')
        .select('payment_milestones, client_id')
        .eq('order_id', orderStringId)
        .single();
        
      if (fetchError || !orderData) {
        throw new Error(`Order ${orderStringId} not found for milestone update.`);
      }
      
      const milestones = orderData.payment_milestones || [];
      if (milestones[milestoneIndex]) {
        milestones[milestoneIndex].paid = true;
        milestones[milestoneIndex].paid_at = new Date().toISOString();
        milestones[milestoneIndex].tx_ref = tx_ref;
      }
      
      const allPaid = milestones.every((m: any) => m.paid);
      const firstPaid = milestones[0]?.paid;
      
      updates = {
        payment_milestones: milestones,
        sixty_percent_paid: firstPaid || false,
        forty_percent_paid: allPaid || false,
        workflow_status: allPaid ? 'Completed' : (firstPaid ? 'Synthesis Active' : 'Briefing Received')
      };
      
      const { emailTemplates } = await import('@/lib/emailTemplates');
      if (allPaid) {
        template = emailTemplates.balancePaid(orderEmailData);
        adminTemplate = emailTemplates.adminBalancePaid(orderEmailData);
      } else if (milestoneIndex === 0) {
        template = emailTemplates.depositPaid(orderEmailData);
        adminTemplate = emailTemplates.adminDepositPaid(orderEmailData);
      }
      
      // Log to transactions table
      if (orderData.client_id && milestones[milestoneIndex]) {
        await supabase.from('transactions').insert({
          user_id: orderData.client_id,
          amount: milestones[milestoneIndex].amount,
          type: 'payment',
          reference: tx_ref,
          status: 'completed',
        });
      }
    } else if (paymentType === 'DEPOSIT') {
      updates = { sixty_percent_paid: true, workflow_status: 'Synthesis Active' };
      const { emailTemplates } = await import('@/lib/emailTemplates');
      template = emailTemplates.depositPaid(orderEmailData);
      adminTemplate = emailTemplates.adminDepositPaid(orderEmailData);
    } else if (paymentType === 'BALANCE') {
      updates = { forty_percent_paid: true, workflow_status: 'Completed' };
      const { emailTemplates } = await import('@/lib/emailTemplates');
      template = emailTemplates.balancePaid(orderEmailData);
      adminTemplate = emailTemplates.adminBalancePaid(orderEmailData);
    } else {
      console.warn(`Unknown payment type: ${paymentType}`);
      return NextResponse.json({ received: true });
    }

    const updateRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/admin/update-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: orderStringId, updates }),
    });
    if (!updateRes.ok) {
      console.error('Central update API failed:', await updateRes.text());
    }

    if (template) {
      const { sendSystemEmail } = await import('@/lib/emailService');
      await sendSystemEmail({
        to: orderInfo.email,
        subject: template.subject,
        html: template.html,
        orderId: orderStringId,
      }).catch(e => console.warn('Client email failed', e));
    }

    if (adminTemplate) {
      await notifyAdmins({
        title: `Payment Confirmed: ${orderStringId}`,
        message: `Payment received for order "${orderInfo.topic}" (${orderStringId}). Status: ${updates.workflow_status || 'Paid'}.`,
        type: 'payment',
        link: `/admin/orders?open=${orderStringId}`,
        orderDbId: orderInfo.id,
        emailHtml: adminTemplate.html,
        emailSubject: adminTemplate.subject,
      }).catch(e => console.warn('Admin payment notification failed', e));
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}