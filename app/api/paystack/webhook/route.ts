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

    // --- PROJECT MATERIAL (pay-first; order only created here, after payment) ---
    if (type === 'project_material') {
      const { userId, topicId, title, department, price, name, whatsapp } = metadata;
      console.log(`📦 Project material purchase by ${userId}: "${title}"`);

      if (!userId || !title) {
        return NextResponse.json({ error: 'Invalid project metadata' }, { status: 400 });
      }

      // Idempotency: if we've already logged this reference, don't create a duplicate order.
      const { data: existingTx } = await supabase.from('transactions').select('id').eq('reference', reference).maybeSingle();
      if (existingTx) {
        console.log('Project material already processed for reference', reference);
        return NextResponse.json({ received: true });
      }

      const { data: buyer } = await supabase.auth.admin.getUserById(userId);
      const email = buyer?.user?.email || '';
      const amount = Number(price) || 3000;

      // Optional pre-uploaded material for instant delivery
      let materialPath: string | null = null;
      if (topicId) {
        const { data: topic } = await supabase.from('project_topics').select('material_file_path').eq('id', topicId).single();
        materialPath = topic?.material_file_path || null;
      }
      const instant = !!materialPath;

      const orderStringId = `PRJ-${Math.floor(100000 + Math.random() * 900000)}`;
      const milestone = [{ name: 'Full Payment', percentage: 100, amount, paid: true, delivered: instant, paid_at: new Date().toISOString(), tx_ref: reference, trigger: 'Paid upfront' }];

      const orderRow: any = {
        order_id: orderStringId,
        client_id: userId,
        legal_name: name || email.split('@')[0],
        email,
        whatsapp_sync: whatsapp || null,
        client_phone: whatsapp || null,
        topic: `[PROJECT] ${title}`,
        service_tier: 'CUSTOM',
        financial_quote: amount,
        deadline: null,
        workflow_status: instant ? 'Completed' : 'Synthesis Active',
        corrections_status: 'None',
        vault_status: instant ? 'Secured in Vault' : 'Awaiting Material Upload',
        payment_structure_type: '60/40',
        payment_milestones: milestone,
        sixty_percent_paid: true,
        forty_percent_paid: true,
        work_submitted: instant,
        additional_info: `[PROJECT MATERIAL]\nDepartment: ${department || 'General'}\nScope: Chapters 4 & 5 only (as advertised).\nSource: ${topicId ? `Catalogue topic #${topicId}` : 'Custom request'}`,
      };

      const { data: inserted, error: insErr } = await supabase.from('orders').insert(orderRow).select().single();
      if (insErr) {
        console.error('❌ Project order insert failed:', insErr);
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }

      await supabase.from('transactions').insert({
        user_id: userId, amount, type: 'payment', reference, status: 'completed',
      });

      // Instant delivery if a pre-uploaded material exists
      if (instant && materialPath) {
        await supabase.from('final_deliverables').insert({
          order_id: orderStringId,
          file_path: materialPath,
          file_name: `${title} — Chapters 4-5.docx`,
        });
      }

      // Auto-invoice + notifications
      try {
        const { upsertInvoiceForOrder } = await import('@/lib/invoices');
        await upsertInvoiceForOrder(supabase, inserted, { autoGenerated: true });
      } catch (e) { console.warn('Project invoice failed:', e); }

      try {
        const { notifyUser } = await import('@/lib/notify');
        const { emailTemplates, emailShell } = await import('@/lib/emailTemplates');
        const buyerHtml = emailShell(
          `<h1>Payment Confirmed — Project Material</h1>
           <p>Hi ${name || 'there'},</p>
           <p>Thank you! Your payment of ₦${amount.toLocaleString()} for <strong>${title}</strong> is confirmed.</p>
           <p>Your material covers <strong>Chapters 4 &amp; 5</strong>. ${instant ? 'It is available in your Secure Vault now.' : 'Our team will place it in your Secure Vault shortly.'}</p>`,
          'Open Your Vault', `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/client?tab=vault`
        );
        await notifyUser({
          userId,
          title: instant ? 'Your project material is ready' : 'Project material purchased',
          message: instant
            ? `"${title}" (Chapters 4 & 5) is in your vault.`
            : `Payment confirmed for "${title}" (Chapters 4 & 5). We'll deliver it to your vault shortly.`,
          type: instant ? 'vault_delivery' : 'order_update',
          link: '/dashboard/client?tab=vault',
          orderDbId: inserted.id,
          emailHtml: buyerHtml,
          emailSubject: instant ? 'Your project material is ready' : 'Project material purchase confirmed',
        });

        const adminHtml = emailShell(
          `<h2>New Project Material Sale</h2>
           <p><strong>${name}</strong> (${email}) purchased a project material.</p>
           <p>Topic: <strong>${title}</strong><br/>Department: ${department || 'General'}<br/>Amount: ₦${amount.toLocaleString()}<br/>Order: ${orderStringId}</p>
           <p>${instant ? 'Delivered instantly from the pre-uploaded file.' : 'Action needed: upload the Chapters 4-5 material to this order\'s vault.'}</p>`,
          'Open in Admin', `${process.env.NEXT_PUBLIC_BASE_URL}/admin/orders?open=${orderStringId}`
        );
        await notifyAdmins({
          title: `Project sale: ${title}`,
          message: `${name} bought "${title}" (₦${amount.toLocaleString()}). ${instant ? 'Auto-delivered.' : 'Upload material to vault.'}`,
          type: 'order_update',
          link: `/admin/orders?open=${orderStringId}`,
          emailHtml: adminHtml,
          emailSubject: `Project sale: ${title}`,
        });
      } catch (e) { console.warn('Project notifications failed:', e); }

      console.log(`✅ Project material order ${orderStringId} created in ${Date.now() - startTime}ms`);
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