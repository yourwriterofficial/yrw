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
      const { userId, topicId, title, department, price, name, whatsapp, level, addons, customLocation, assignedWriter, guestCheckout, guestEmail } = metadata;
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
        additional_info: `[PROJECT MATERIAL]\nLevel: ${level || 'BSc'}\nDepartment: ${department || 'General'}\nScope: Chapters 1 to 5 (MS Word).\nAdd-ons: ${addons || 'None'}${customLocation ? `\nPreferred Location: ${customLocation}` : ''}${assignedWriter ? `\nAssigned Writer: ${assignedWriter}` : ''}\nSource: ${topicId ? `Catalogue topic #${topicId}` : 'Custom request'}\nNote: Ready-made material — similarity/AI levels not checked (as advertised).`,
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
            redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL}/auth/callback?next=${encodeURIComponent('/dashboard/client?tab=vault')}`,
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

      const paidMilestone = milestones[milestoneIndex];
      const amountPaid = paidMilestone?.amount || 0;
      const milestoneName = paidMilestone?.name || `Milestone #${milestoneIndex + 1}`;
      
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
      .select('id, email, legal_name, financial_quote, topic, order_id, service_tier')
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

      // Every milestone gets its own confirmation — not just the first/last —
      // and the copy always names the actual milestone paid (name/%/amount)
      // instead of assuming a fixed 60/40 split. Mirrors the same template
      // already used by the wallet-milestone and admin-milestone routes.
      const paidMilestone = milestones[milestoneIndex];
      if (paidMilestone) {
        const { emailTemplates } = await import('@/lib/emailTemplates');
        template = emailTemplates.milestonePaid(
          orderEmailData,
          { name: paidMilestone.name, amount: paidMilestone.amount, percentage: paidMilestone.percentage },
          allPaid
        );
        adminTemplate = {
          html: template.html,
          subject: `[PAID] Milestone: ${paidMilestone.name} - Order #${orderStringId}`,
        };
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