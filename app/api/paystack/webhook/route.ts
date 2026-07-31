import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { notifyAdmins } from '@/lib/notify';
import { creditReferralCommission } from '@/lib/affiliate';
import { applyMilestonePayment, markMilestonePaid, allMilestonesPaid } from '@/lib/milestones';

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
    const rawAmountPaid = Number(payload.data.amount || 0) / 100;

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

      // Idempotency: prevent double-crediting on webhook retry
      const { data: dupTx } = await supabase.from('transactions').select('id').eq('reference', reference).maybeSingle();
      if (dupTx) {
        console.log('wallet_topup already processed for reference', reference);
        return NextResponse.json({ received: true });
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
      const { userId, topicId, title, department, price, name, whatsapp, level, addons, customLocation, guestCheckout, guestEmail } = metadata;
      console.log(`📦 Project material purchase by ${userId}: "${title}"`);

      if (!userId || !title) {
        return NextResponse.json({ error: 'Invalid project metadata' }, { status: 400 });
      }

      // Idempotency: if we've already logged this reference, don't create a duplicate order.
      const { data: existingTx } = await supabase.from('transactions').select('id').eq('reference', reference).maybeSingle();
      if (existingTx) {
        console.log('project material already processed for reference', reference);
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
        additional_info: `[PROJECT MATERIAL]\nLevel: ${level || 'BSc'}\nDepartment: ${department || 'General'}\nScope: Chapters 1 to 5 (MS Word).\nAdd-ons: ${addons || 'None'}${customLocation ? `\nPreferred Location: ${customLocation}` : ''}\nSource: ${topicId ? `Catalogue topic #${topicId}` : 'Custom request'}\nNote: Ready-made material — similarity/AI levels not checked (as advertised).`,
      };

      const { data: inserted, error: insErr } = await supabase.from('orders').insert(orderRow).select().single();
      if (insErr) {
        console.error('❌ Project order insert failed:', insErr);
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }

      await supabase.from('transactions').insert({
        user_id: userId, amount, type: 'payment', reference, status: 'completed',
      });
      await creditReferralCommission(supabase, { buyerId: userId, amount, reference, note: `Project material: ${title}` });

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

        if (guestCheckout && guestEmail) {
          // Guest never has a session — one email both confirms payment and
          // logs them straight into their new dashboard via a magic link.
          const { sendMagicLinkEmail } = await import('@/lib/magicLink');
          const introHtml = `
            <p>Thank you! Your payment of ₦${amount.toLocaleString()} for <strong>${title}</strong> is confirmed.</p>
            <p>Your material covers <strong>Chapters 1 to 5</strong>. ${instant ? 'It is available in your Secure Vault now.' : 'Our team will place it in your Secure Vault shortly.'}</p>
            <p><strong>Security Info:</strong> We have set up a client account for you. Your temporary password is set to your email address: <strong>${guestEmail}</strong>.</p>
            <p>Please click below to log in instantly (no password needed for this first session), and make sure to change your password under <strong>Profile Settings</strong>.</p>`;
          await sendMagicLinkEmail({
            email: guestEmail,
            name: name || guestEmail.split('@')[0],
            next: '/dashboard/client?tab=vault',
            title: 'Payment Confirmed — Project Material',
            introHtml,
          });
          // In-app + push only (no second email) — the magic-link email above already covers it.
          await notifyUser({
            userId,
            title: instant ? 'Your project material is ready' : 'Project material purchased',
            message: instant
              ? `"${title}" (Chapters 1 to 5) is in your vault.`
              : `Payment confirmed for "${title}" (Chapters 1 to 5). We'll deliver it to your vault shortly.`,
            type: instant ? 'vault_delivery' : 'order_update',
            link: '/dashboard/client?tab=vault',
            orderDbId: inserted.id,
          });
        } else {
          const buyerHtml = emailShell(
            `<h1>Payment Confirmed — Project Material</h1>
             <p>Hi ${name || 'there'},</p>
             <p>Thank you! Your payment of ₦${amount.toLocaleString()} for <strong>${title}</strong> is confirmed.</p>
             <p>Your material covers <strong>Chapters 1 to 5</strong>. ${instant ? 'It is available in your Secure Vault now.' : 'Our team will place it in your Secure Vault shortly.'}</p>`,
            'Open Your Vault', `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/client?tab=vault`
          );
          await notifyUser({
            userId,
            title: instant ? 'Your project material is ready' : 'Project material purchased',
            message: instant
              ? `"${title}" (Chapters 1 to 5) is in your vault.`
              : `Payment confirmed for "${title}" (Chapters 1 to 5). We'll deliver it to your vault shortly.`,
            type: instant ? 'vault_delivery' : 'order_update',
            link: '/dashboard/client?tab=vault',
            orderDbId: inserted.id,
            emailHtml: buyerHtml,
            emailSubject: instant ? 'Your project material is ready' : 'Project material purchase confirmed',
          });
        }

        const adminHtml = emailShell(
          `<h2>New Project Material Sale</h2>
           <p><strong>${name}</strong> (${email}) purchased a project material.</p>
           <p>Topic: <strong>${title}</strong><br/>Department: ${department || 'General'}<br/>Amount: ₦${amount.toLocaleString()}<br/>Order: ${orderStringId}</p>
           <p>${instant ? 'Delivered instantly from the pre-uploaded file.' : 'Action needed: upload the Chapters 4-5 material to this order\'s vault.'}</p>`,
          'Open in Admin', `${process.env.NEXT_PUBLIC_BASE_URL}/admin/orders?open=${orderStringId}`
        );
        await notifyAdmins({
          title: `Project Material Sale: ₦${amount.toLocaleString()}`,
          message: `${name} purchased project material "${title}" for ₦${amount.toLocaleString()}.`,
          type: 'payment',
          link: `/admin/orders?open=${orderStringId}`,
          emailHtml: adminHtml,
          emailSubject: `Project sale: ${title}`,
        });
      } catch (e) { console.warn('Project notifications failed:', e); }

      console.log(`✅ Project material order ${orderStringId} created in ${Date.now() - startTime}ms`);
      return NextResponse.json({ received: true });
    }

    // --- DEV SHOP SCRIPT PURCHASE ---
    if (type === 'dev_product') {
      const { userId, productId, title, price, name, guestCheckout, guestEmail } = metadata;
      console.log(`🛒 Dev shop purchase by ${userId}: "${title}"`);

      if (!userId || !productId) {
        return NextResponse.json({ error: 'Invalid dev product metadata' }, { status: 400 });
      }

      // Idempotency: prevent double-crediting on webhook retry
      const { data: existingTx } = await supabase.from('transactions').select('id').eq('reference', reference).maybeSingle();
      if (existingTx) {
        console.log('dev product purchase already processed for reference', reference);
        return NextResponse.json({ received: true });
      }

      const { data: buyer } = await supabase.auth.admin.getUserById(userId);
      const email = buyer?.user?.email || '';
      const amount = Number(price) || 0;

      await supabase.from('transactions').insert({
        user_id: userId, amount, type: 'payment', reference, status: 'completed',
      });
      await creditReferralCommission(supabase, { buyerId: userId, amount, reference, note: `Dev shop: ${title}` });

      const { error: purchaseErr } = await supabase.from('dev_product_purchases').insert({
        product_id: productId, user_id: userId, amount_paid: amount, reference,
      });
      if (purchaseErr) {
        console.error('❌ dev_product_purchases insert failed:', purchaseErr);
        return NextResponse.json({ error: purchaseErr.message }, { status: 500 });
      }

      try {
        const { notifyUser } = await import('@/lib/notify');
        const { emailShell } = await import('@/lib/emailTemplates');

        if (guestCheckout && guestEmail) {
          const { sendMagicLinkEmail } = await import('@/lib/magicLink');
          const introHtml = `
            <p>Thank you! Your payment of ₦${amount.toLocaleString()} for <strong>${title}</strong> is confirmed.</p>
            <p><strong>Security Info:</strong> We have set up a client account for you. Your temporary password is set to your email address: <strong>${guestEmail}</strong>.</p>
            <p>Please click below to log in instantly and download your script from <strong>My Scripts</strong>. Make sure to change your password under <strong>Profile Settings</strong>.</p>`;
          await sendMagicLinkEmail({
            email: guestEmail,
            name: name || guestEmail.split('@')[0],
            next: '/dashboard/client?tab=scripts',
            title: 'Purchase Confirmed — ' + title,
            introHtml,
          });
          await notifyUser({
            userId,
            title: 'Script purchased',
            message: `"${title}" is ready to download in My Scripts.`,
            type: 'payment',
            link: '/dashboard/client?tab=scripts',
          });
        } else {
          const buyerHtml = emailShell(
            `<h1>Purchase Confirmed — ${title}</h1>
             <p>Hi ${name || 'there'},</p>
             <p>Thank you! Your payment of ₦${amount.toLocaleString()} for <strong>${title}</strong> is confirmed.</p>
             <p>Download it anytime from <strong>My Scripts</strong> in your dashboard.</p>`,
            'Go to My Scripts', `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/client?tab=scripts`
          );
          await notifyUser({
            userId,
            title: 'Script purchased',
            message: `"${title}" is ready to download in My Scripts.`,
            type: 'payment',
            link: '/dashboard/client?tab=scripts',
            emailHtml: buyerHtml,
            emailSubject: `Purchase confirmed: ${title}`,
          });
        }

        const adminHtml = emailShell(
          `<h2>New Dev Shop Sale</h2>
           <p><strong>${name}</strong> (${email}) purchased a script.</p>
           <p>Script: <strong>${title}</strong><br/>Amount: ₦${amount.toLocaleString()}<br/>Reference: ${reference}</p>`,
          'Open Dev Shop', `${process.env.NEXT_PUBLIC_BASE_URL}/admin/dev-shop`
        );
        await notifyAdmins({
          title: `Dev Shop Sale: ₦${amount.toLocaleString()}`,
          message: `${name} purchased script "${title}" for ₦${amount.toLocaleString()}.`,
          type: 'payment',
          link: '/admin/dev-shop',
          emailHtml: adminHtml,
          emailSubject: `Dev shop sale: ${title}`,
        });
      } catch (e) { console.warn('Dev shop notifications failed:', e); }

      console.log(`✅ Dev product purchase processed in ${Date.now() - startTime}ms`);
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

      // Idempotency: don't double-log or double-apply on a Paystack webhook retry
      const { data: existingInvTx } = await supabase.from('transactions').select('id').eq('reference', reference).maybeSingle();
      if (existingInvTx) {
        console.log('custom invoice payment already processed for reference', reference);
        return NextResponse.json({ received: true });
      }

      const { data: invoiceData, error: invoiceErr } = await supabase
        .from('custom_invoices')
        .select('*')
        .eq('invoice_number', invoiceNumber)
        .single();

      if (invoiceErr || !invoiceData) {
        throw new Error(`Custom invoice ${invoiceNumber} not found.`);
      }

      // Same validation as order milestones — an empty `milestones` array made
      // `every()` vacuously true here too, flipping the invoice straight to PAID.
      const invCheck = applyMilestonePayment(invoiceData.milestones, milestoneIndex, {
        amountPaid: rawAmountPaid,
      });
      if (!invCheck.ok) {
        console.error(`❌ Invoice milestone payment rejected for ${invoiceNumber}: [${invCheck.code}] ${invCheck.reason}`);
        await supabase.from('transactions').insert({
          user_id: null,
          amount: rawAmountPaid,
          type: 'payment',
          reference,
          status: 'needs_review',
          notes: `UNAPPLIED (${invCheck.code}): ${invCheck.reason} — Invoice ${invoiceNumber}`,
        });
        await notifyAdmins({
          title: `⚠️ Invoice payment needs manual review: ${invoiceNumber}`,
          message: `₦${rawAmountPaid.toLocaleString()} was captured for invoice ${invoiceNumber} but could not be applied: ${invCheck.reason}`,
          type: 'payment',
          link: '/admin/invoices',
        }).catch(e => console.warn('Admin review alert failed', e));
        return NextResponse.json({ received: true, applied: false, reason: invCheck.code });
      }

      const invStamped = markMilestonePaid(invCheck.milestones, milestoneIndex, reference);
      const milestones = invStamped.milestones;
      const allPaid = invStamped.allPaid;
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

      const paidMilestone = milestones[milestoneIndex];
      const amountPaid = paidMilestone?.amount || 0;
      const milestoneName = paidMilestone?.name || `Milestone #${milestoneIndex + 1}`;

      // Custom invoices aren't always tied to a platform account — best-effort match
      // by email so the payment still shows attributed in admin's transactions log.
      let invoiceUserId: string | null = null;
      if (invoiceData.email) {
        const { data: matchedProfile } = await supabase
          .from('profiles')
          .select('id')
          .ilike('email', invoiceData.email)
          .maybeSingle();
        invoiceUserId = matchedProfile?.id || null;
      }
      await supabase.from('transactions').insert({
        user_id: invoiceUserId,
        amount: amountPaid,
        type: 'payment',
        reference,
        status: 'completed',
        notes: `Custom Invoice ${invoiceNumber} — ${milestoneName} (${invoiceData.client_name || invoiceData.email || 'Client'})`,
      });

      try {
        const { emailShell } = await import('@/lib/emailTemplates');

        // Client email
        if (invoiceData.email) {
          const clientHtml = emailShell(
            `<h2>Payment Confirmed</h2>
             <p>Hi ${invoiceData.client_name || 'there'},</p>
             <p>Your payment of <strong>₦${amountPaid.toLocaleString()}</strong> for milestone <strong>${milestoneName}</strong> on invoice <strong>${invoiceNumber}</strong> has been confirmed.</p>
             <p>Invoice status: <strong>${newStatus}</strong>${allPaid ? ' — all milestones have been cleared. Thank you!' : ' — remaining milestones are still outstanding.'}</p>`,
            'View Invoice', `${process.env.NEXT_PUBLIC_BASE_URL}/invoice/${invoiceNumber}`
          );
          const { sendSystemEmail } = await import('@/lib/emailService');
          await sendSystemEmail({
            to: invoiceData.email,
            subject: `Payment Confirmed: ${milestoneName} — Invoice #${invoiceNumber}`,
            html: clientHtml,
          }).catch(e => console.warn('Custom invoice client email failed:', e));
        }

        const adminHtml = emailShell(
          `<h2>Custom Invoice Payment Confirmed</h2>
           <p><strong>${invoiceData.client_name || 'Client'}</strong> (${invoiceData.email || 'No email'}) paid a custom invoice milestone.</p>
           <p>Invoice: <strong>${invoiceNumber}</strong><br/>
              Milestone: <strong>${milestoneName}</strong><br/>
              Amount Paid: <strong>₦${amountPaid.toLocaleString()}</strong><br/>
              Status: ${newStatus}
           </p>`,
          'Open Custom Invoices', `${process.env.NEXT_PUBLIC_BASE_URL}/admin/invoices`
        );
        await notifyAdmins({
          title: `Custom Invoice Paid: ₦${amountPaid.toLocaleString()}`,
          message: `${invoiceData.client_name || 'Client'} paid ₦${amountPaid.toLocaleString()} for milestone "${milestoneName}" of custom invoice ${invoiceNumber}.`,
          type: 'payment',
          link: `/admin/invoices`,
          emailHtml: adminHtml,
          emailSubject: `[PAID] Custom Invoice ${invoiceNumber} - Milestone: ${milestoneName}`,
        });
      } catch (e) {
        console.warn('Custom invoice payment notification failed:', e);
      }

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
      .select('id, email, legal_name, financial_quote, topic, order_id, service_tier, client_id')
      .eq('order_id', orderStringId)
      .single();

    if (orderError || !orderInfo) {
      throw new Error(`Order ${orderStringId} not found.`);
    }

    // Idempotency: Paystack retries webhooks on timeout/non-200, and this branch
    // (ADDON-/INDEX-/DEPOSIT/BALANCE) had no guard against double-logging a retry.
    const { data: existingOrderTx } = await supabase.from('transactions').select('id').eq('reference', tx_ref).maybeSingle();
    if (existingOrderTx) {
      console.log('order payment already processed for reference', tx_ref);
      return NextResponse.json({ received: true });
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
            await creditReferralCommission(supabase, {
              buyerId: orderDetails.client_id,
              amount: addonPayload.extra_addons[addonIndex].price,
              reference: tx_ref,
              note: `Add-on: ${orderStringId}`,
            });
          }

          const addon = addonPayload.extra_addons[addonIndex];
          const addonPrice = Number(addon.price) || 0;
          const addonName = addon.name || 'Add-on';
          
          try {
            const { data: orderInfo } = await supabase
              .from('orders')
              .select('legal_name, email, topic, order_id, service_tier, id, client_id')
              .eq('order_id', orderStringId)
              .single();

            const { emailShell } = await import('@/lib/emailTemplates');

            // Client notification
            const clientHtml = emailShell(
              `<h2>Add-on Activated</h2>
               <p>Hi ${orderInfo?.legal_name || 'there'},</p>
               <p>Your add-on <strong>${addonName}</strong> (₦${addonPrice.toLocaleString()}) has been paid and is now active on your order.</p>
               <p>Order: <strong>${orderStringId}</strong><br/>Topic: ${orderInfo?.topic || 'N/A'}</p>
               <p>Our team will incorporate this into your deliverable. You'll be notified when it's ready in your vault.</p>`,
              'View My Order', `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/client`
            );
            if (orderInfo?.client_id) {
              const { notifyUser } = await import('@/lib/notify');
              await notifyUser({
                userId: orderInfo.client_id,
                title: `Add-on confirmed: ${addonName}`,
                message: `Your ₦${addonPrice.toLocaleString()} add-on \"${addonName}\" is now active on order ${orderStringId}.`,
                type: 'payment',
                link: `/dashboard/client`,
                orderDbId: orderInfo.id,
                emailHtml: clientHtml,
                emailSubject: `Add-on Confirmed: ${addonName} — Order #${orderStringId}`,
              }).catch(e => console.warn('Client addon notification failed', e));
            }

            const adminHtml = emailShell(
              `<h2>Add-on Payment Confirmed</h2>
               <p><strong>${orderInfo?.legal_name || 'Client'}</strong> (${orderInfo?.email || 'No email'}) paid for an add-on.</p>
               <p>Order: <strong>${orderStringId}</strong><br/>
                  Topic: <strong>${orderInfo?.topic || 'N/A'}</strong><br/>
                  Add-on: <strong>${addonName}</strong><br/>
                  Amount Paid: <strong>₦${addonPrice.toLocaleString()}</strong><br/>
                  Reference: ${tx_ref}
               </p>`,
              'Open Order', `${process.env.NEXT_PUBLIC_BASE_URL}/admin/orders?open=${orderStringId}`
            );
            
            const SERVICE_TIERS: Record<string, string> = {
              ACADEMIC: 'Academic Writing',
              CONTENT: 'Content Writing',
              RESUME: 'Resume/CV Services',
              DEV: 'Software Development',
              CUSTOM: 'Custom Research/Writing'
            };
            const orderType = SERVICE_TIERS[orderInfo?.service_tier || ''] || 'Custom Order';

            await notifyAdmins({
              title: `${orderType} Add-on Paid: ₦${addonPrice.toLocaleString()}`,
              message: `${orderInfo?.legal_name || 'Client'} paid ₦${addonPrice.toLocaleString()} for add-on "${addonName}" on order ${orderStringId}.`,
              type: 'payment',
              link: `/admin/orders?open=${orderStringId}`,
              orderDbId: orderInfo?.id,
              emailHtml: adminHtml,
              emailSubject: `[PAID] Add-on: ${addonName} - Order #${orderStringId}`,
            });
          } catch (e) {
            console.warn('Addon payment notification failed:', e);
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

      // Validate before applying. Previously this branch trusted the reference
      // completely: an out-of-range index silently applied nothing while the
      // order was still updated, an empty milestones array made `every()`
      // vacuously true (marking the order fully paid), and the amount actually
      // charged was never compared against what the milestone was worth.
      const check = applyMilestonePayment(orderData.payment_milestones, milestoneIndex, {
        amountPaid: rawAmountPaid,
        reference: tx_ref,
      });

      if (!check.ok) {
        // A retry of an already-applied payment is expected traffic, not an
        // incident — ack it quietly. The tx_ref lives on the milestone itself,
        // so this guard also covers guest orders, which never get a
        // `transactions` row to key off.
        if (check.code === 'duplicate_reference') {
          console.log(`↩️  Milestone payment ${tx_ref} already applied to ${orderStringId}, ignoring retry.`);
          return NextResponse.json({ received: true, applied: false, reason: 'duplicate' });
        }

        // The money is real and already captured, so never 500 here — that would
        // make Paystack retry forever. Alert an admin to reconcile by hand.
        console.error(`❌ Milestone payment rejected for ${orderStringId}: [${check.code}] ${check.reason}`);
        // `transactions.user_id` is NOT NULL, so guests get no row — the admin
        // alert below is the durable record in that case.
        if (orderData.client_id) {
          const { error: logErr } = await supabase.from('transactions').insert({
            user_id: orderData.client_id,
            amount: rawAmountPaid,
            type: 'payment',
            reference: tx_ref,
            status: 'failed',
            notes: `UNAPPLIED (${check.code}): ${check.reason} — Order #${orderStringId}`,
          });
          if (logErr) console.error('Failed to log unapplied payment:', logErr.message);
        }
        await notifyAdmins({
          title: `⚠️ Payment needs manual review: ${orderStringId}`,
          message: `₦${rawAmountPaid.toLocaleString()} was captured for order ${orderStringId} but could not be applied automatically: ${check.reason}`,
          type: 'payment',
          link: `/admin/orders?open=${orderStringId}`,
          orderDbId: orderInfo.id,
        }).catch(e => console.warn('Admin review alert failed', e));
        return NextResponse.json({ received: true, applied: false, reason: check.code });
      }

      const stamped = markMilestonePaid(check.milestones, milestoneIndex, tx_ref);
      const { milestones, allPaid, firstPaid } = stamped;

      updates = {
        payment_milestones: milestones,
        sixty_percent_paid: firstPaid,
        forty_percent_paid: allPaid,
        // Paying is not delivering. Clearing the final milestone unlocks the
        // files but leaves completion to the admin, who marks it once the work
        // is actually handed over.
        workflow_status: firstPaid ? 'Synthesis Active' : 'Briefing Received',
      };

      // Every milestone gets its own confirmation — not just the first/last —
      // and the copy always names the actual milestone paid (name/%/amount)
      // instead of assuming a fixed 60/40 split. Mirrors the same template
      // already used by the wallet-milestone and admin-milestone routes.
      const paidMilestone = milestones[milestoneIndex];
      const { emailTemplates } = await import('@/lib/emailTemplates');
      template = emailTemplates.milestonePaid(
        orderEmailData,
        { name: paidMilestone.name, amount: paidMilestone.amount, percentage: paidMilestone.percentage ?? 0 },
        allPaid
      );
      adminTemplate = {
        html: template.html,
        subject: `[PAID] Milestone: ${paidMilestone.name} - Order #${orderStringId}`,
      };

      // `transactions.user_id` is NOT NULL, so guest orders cannot be logged
      // here. That is precisely why the retry guard above reads the milestone's
      // own tx_ref rather than this table.
      if (orderData.client_id) {
        const { error: logErr } = await supabase.from('transactions').insert({
          user_id: orderData.client_id,
          amount: paidMilestone.amount,
          type: 'payment',
          reference: tx_ref,
          status: 'completed',
          notes: `Milestone: ${paidMilestone.name} — Order #${orderStringId}`,
        });
        if (logErr) console.error('Failed to log milestone transaction:', logErr.message);
        await creditReferralCommission(supabase, {
          buyerId: orderData.client_id,
          amount: paidMilestone.amount,
          reference: tx_ref,
          note: `Milestone: ${orderStringId}`,
        });
      }
    } else if (paymentType === 'DEPOSIT') {
      updates = { sixty_percent_paid: true, workflow_status: 'Synthesis Active' };
      const { emailTemplates } = await import('@/lib/emailTemplates');
      template = emailTemplates.depositPaid(orderEmailData);
      adminTemplate = emailTemplates.adminDepositPaid(orderEmailData);
      if (orderInfo.client_id) {
        await supabase.from('transactions').insert({
          user_id: orderInfo.client_id, amount: rawAmountPaid, type: 'payment', reference: tx_ref, status: 'completed',
          notes: `Deposit — Order #${orderStringId}`,
        });
        await creditReferralCommission(supabase, { buyerId: orderInfo.client_id, amount: rawAmountPaid, reference: tx_ref, note: `Deposit: ${orderStringId}` });
      }
    } else if (paymentType === 'BALANCE') {
      // Balance cleared unlocks the files, but completion stays an admin call —
      // the panel already has an explicit "Mark as Completed" action for it.
      updates = { forty_percent_paid: true };
      const { emailTemplates } = await import('@/lib/emailTemplates');
      template = emailTemplates.balancePaid(orderEmailData);
      adminTemplate = emailTemplates.adminBalancePaid(orderEmailData);
      if (orderInfo.client_id) {
        await supabase.from('transactions').insert({
          user_id: orderInfo.client_id, amount: rawAmountPaid, type: 'payment', reference: tx_ref, status: 'completed',
          notes: `Balance — Order #${orderStringId}`,
        });
        await creditReferralCommission(supabase, { buyerId: orderInfo.client_id, amount: rawAmountPaid, reference: tx_ref, note: `Balance: ${orderStringId}` });
      }
    } else {
      console.warn(`Unknown payment type: ${paymentType}`);
      return NextResponse.json({ received: true });
    }

    // Update order directly in DB (bypassing the self-HTTP call that could silently fail)
    if (Object.keys(updates).length > 0) {
      const { error: updateErr } = await supabase
        .from('orders')
        .update(updates)
        .eq('order_id', orderStringId);
      if (updateErr) {
        // Throw so Paystack retries — order must be kept consistent
        throw new Error(`Order update failed for ${orderStringId}: ${updateErr.message}`);
      }
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
      const SERVICE_TIERS: Record<string, string> = {
        ACADEMIC: 'Academic Writing',
        CONTENT: 'Content Writing',
        RESUME: 'Resume/CV Services',
        DEV: 'Software Development',
        CUSTOM: 'Custom Research/Writing'
      };
      const orderType = SERVICE_TIERS[orderInfo.service_tier || ''] || 'Custom Order';
      const paymentLabel = paymentType === 'DEPOSIT' ? 'Deposit' : paymentType === 'BALANCE' ? 'Balance' : paymentType.startsWith('INDEX-') ? `Milestone #${paymentType.replace('INDEX-', '')}` : 'Milestone';

      await notifyAdmins({
        title: `${orderType} Payment: ₦${rawAmountPaid.toLocaleString()}`,
        message: `Received ₦${rawAmountPaid.toLocaleString()} (${paymentLabel}) from ${orderInfo.legal_name || 'Client'} for "${orderInfo.topic}" (${orderStringId}).`,
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