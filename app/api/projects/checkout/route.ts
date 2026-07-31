import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { listAllAuthUsers } from '@/lib/adminAuth';
import { creditReferralCommission } from '@/lib/affiliate';

const admin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Pay-FIRST checkout for a project material. No order is created here — the
 * order is only written by the Paystack webhook after payment is confirmed, so
 * unpaid attempts never persist. Guests may check out without logging in first —
 * they supply an email, we resolve/create the matching account, and the webhook
 * emails them a magic link to log in to the dashboard where their order lands.
 *
 * Body: { topicId?, customTitle?, department?, level?, addonIds?: number[], email? }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    const body = await request.json();
    const {
      topicId,
      customTitle,
      department,
      level,
      addonIds,
      addonWords,
      addonFeatures,
      customLocation,
      email: guestEmailInput,
    } = body;

    let buyerId: string;
    let buyerEmail: string;
    let guestCheckout = false;

    if (user) {
      buyerId = user.id;
      buyerEmail = user.email!;
    } else {
      const email = String(guestEmailInput || '').trim().toLowerCase();
      if (!email || !EMAIL_RE.test(email)) {
        return NextResponse.json({ error: 'A valid email is required to check out.' }, { status: 400 });
      }
      guestCheckout = true;
      buyerEmail = email;

      const existing = await listAllAuthUsers(admin);
      const match = existing.find((u) => u.email.toLowerCase() === email);
      if (match) {
        buyerId = match.id;
      } else {
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email,
          password: email,
          email_confirm: true,
          user_metadata: { full_name: email.split('@')[0], password_is_email: true },
        });
        if (createErr || !created?.user) {
          return NextResponse.json({ error: 'Could not set up your account for checkout.' }, { status: 500 });
        }
        buyerId = created.user.id;
        await admin.from('profiles').upsert({ id: buyerId, full_name: email.split('@')[0] });
      }
    }

    // Fetch pricing settings (global level prices & department price overrides)
    const { data: settingsData } = await admin.from('project_settings').select('*');
    let levelPrices: Record<string, number> = { OND: 4999, HND: 5999, BSc: 5999, MSc: 4500, PhD: 10000 };
    let deptPrices: Record<string, number> = {};

    if (settingsData) {
      settingsData.forEach(s => {
        if (s.key === 'level_prices') levelPrices = s.value;
        if (s.key === 'department_prices') deptPrices = s.value;
      });
    }

    const getTopicPrice = (lvl: string, deptName: string) => {
      const deptPrice = deptPrices[deptName];
      if (deptPrice !== undefined && Number(deptPrice) > 0) return Number(deptPrice);
      return levelPrices[lvl] || levelPrices.BSc || 3999;
    };

    let title = '';
    let basePrice = levelPrices.BSc;
    let dept = department || 'General';
    let topicRef: string | null = null;
    let lvl = (level && levelPrices[level]) ? level : 'BSc';

    let materialPath: string | null = null;

    if (topicId) {
      const { data: topic, error } = await admin
        .from('project_topics')
        .select('id, title, department, price, level, is_active, material_file_path')
        .eq('id', topicId)
        .single();
      if (error || !topic || !topic.is_active) {
        return NextResponse.json({ error: 'Topic not found or unavailable.' }, { status: 404 });
      }
      title = topic.title;
      basePrice = Number(topic.price) || getTopicPrice(topic.level, topic.department);
      dept = topic.department;
      lvl = topic.level || 'BSc';
      topicRef = String(topic.id);
      materialPath = topic.material_file_path || null;
    } else if (customTitle && String(customTitle).trim().length >= 5) {
      title = String(customTitle).trim();
      basePrice = getTopicPrice(lvl, dept);
    } else {
      return NextResponse.json({ error: 'Provide a topic to purchase.' }, { status: 400 });
    }

    // Resolve selected add-ons (server-side price authority)
    let addonTotal = 0;
    let addonDescriptions: string[] = [];
    if (Array.isArray(addonIds) && addonIds.length) {
      const { data: addons } = await admin
        .from('project_addons')
        .select('*')
        .in('id', addonIds)
        .eq('is_active', true);

      (addons || []).forEach(a => {
        let addonPrice = Number(a.price) || 0;
        let details = '';

        if (a.price_type === 'per_word') {
          const words = Number(addonWords?.[a.id]) || 1000;
          addonPrice = (Number(a.price) || 0) * words;
          details += ` (${words.toLocaleString()} words @ ₦${a.price}/word = ₦${addonPrice.toLocaleString()})`;
        } else {
          details += ` (₦${addonPrice.toLocaleString()})`;
        }

        // Add sub-features pricing
        if (Array.isArray(a.features) && a.features.length && Array.isArray(addonFeatures?.[a.id])) {
          const selectedFeats = addonFeatures[a.id];
          const subFeats: string[] = [];
          a.features.forEach((f: any) => {
            if (selectedFeats.includes(f.name)) {
              addonPrice += Number(f.price) || 0;
              subFeats.push(`${f.name} (+₦${(Number(f.price) || 0).toLocaleString()})`);
            }
          });
          if (subFeats.length) {
            details += ` [Features: ${subFeats.join(', ')}]`;
          }
        }

        // Add location changer text
        if (a.is_location_changer && customLocation) {
          details += ` [Change Location to: "${customLocation}"]`;
        }

        addonTotal += addonPrice;
        addonDescriptions.push(`${a.name}${details}`);
      });
    }

    const total = Math.round(basePrice + addonTotal);

    const { data: profile } = await admin.from('profiles').select('full_name, whatsapp').eq('id', buyerId).single();
    const reference = `PROJ_${Date.now()}_${buyerId.slice(0, 8)}`;
    const instant = !!materialPath;

    // Check if buyer has enough wallet balance (only for logged in users)
    if (!guestCheckout) {
      const { data: wallet } = await admin
        .from('wallets')
        .select('balance')
        .eq('user_id', buyerId)
        .single();
      
      const balance = Number(wallet?.balance) || 0;
      if (balance >= total) {
        // 1. Debit wallet
        const { error: debitErr } = await admin.rpc('increment_wallet', { user_id: buyerId, add_amount: -total });
        if (debitErr) {
          return NextResponse.json({ error: 'Wallet debit failed: ' + debitErr.message }, { status: 500 });
        }

        // 2. Insert transaction
        await admin.from('transactions').insert({
          user_id: buyerId,
          amount: total,
          type: 'payment',
          reference,
          status: 'completed',
        });
        await creditReferralCommission(admin, { buyerId, amount: total, reference, note: `Project material: ${title}` });

        // 3. Create the order
        const orderStringId = `PRJ-${Math.floor(100000 + Math.random() * 900000)}`;
        const milestone = [{ name: 'Full Payment', percentage: 100, amount: total, paid: true, delivered: instant, paid_at: new Date().toISOString(), tx_ref: reference, trigger: 'Paid upfront' }];
        const orderRow: any = {
          order_id: orderStringId,
          client_id: buyerId,
          legal_name: profile?.full_name || buyerEmail.split('@')[0] || 'Client',
          email: buyerEmail,
          whatsapp_sync: profile?.whatsapp || null,
          client_phone: profile?.whatsapp || null,
          topic: `[PROJECT] ${title}`,
          service_tier: 'CUSTOM',
          financial_quote: total,
          deadline: null,
          workflow_status: instant ? 'Completed' : 'Synthesis Active',
          corrections_status: 'None',
          vault_status: instant ? 'Secured in Vault' : 'Awaiting Material Upload',
          payment_structure_type: '60/40',
          payment_milestones: milestone,
          sixty_percent_paid: true,
          forty_percent_paid: true,
          work_submitted: instant,
          additional_info: `[PROJECT MATERIAL]\nLevel: ${lvl}\nDepartment: ${dept}\nScope: Chapters 1 to 5 (MS Word).\nAdd-ons: ${addonDescriptions.length ? addonDescriptions.join(', ') : 'None'}${customLocation ? `\nPreferred Location: ${customLocation}` : ''}\nSource: ${topicId ? `Catalogue topic #${topicId}` : 'Custom request'}\nNote: Ready-made material — similarity/AI levels not checked (as advertised).`,
        };

        const { data: inserted, error: insErr } = await admin.from('orders').insert(orderRow).select().single();
        if (insErr) {
          console.error('❌ Direct project order insert failed:', insErr);
          return NextResponse.json({ error: insErr.message }, { status: 500 });
        }

        // 4. Instant delivery if a pre-uploaded material exists
        if (instant && materialPath) {
          await admin.from('final_deliverables').insert({
            order_id: orderStringId,
            file_path: materialPath,
            file_name: `${title} — Chapters 4-5.docx`,
          });
        }

        // 5. Auto-invoice
        try {
          const { upsertInvoiceForOrder } = await import('@/lib/invoices');
          await upsertInvoiceForOrder(admin, inserted, { autoGenerated: true });
        } catch (e) { console.warn('Project invoice failed:', e); }

        // 6. Notify user
        try {
          const { notifyUser } = await import('@/lib/notify');
          const { emailShell } = await import('@/lib/emailTemplates');
          
          const buyerHtml = emailShell(
            `<h1>Payment Confirmed — Project Material</h1>
             <p>Hi ${profile?.full_name || buyerEmail.split('@')[0] || 'there'},</p>
             <p>Thank you! Your payment of ₦${total.toLocaleString()} for <strong>${title}</strong> is confirmed via your wallet balance.</p>
             <p>Your material covers <strong>Chapters 1 to 5</strong>. ${instant ? 'It is available in your Secure Vault now.' : 'Our team will place it in your Secure Vault shortly.'}</p>`,
            'Open Your Vault', `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/client?tab=vault`
          );

          await notifyUser({
            userId: buyerId,
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
        } catch (e) { console.warn('Direct notification trigger failed:', e); }

        return NextResponse.json({ paid_via_wallet: true, reference, total, orderStringId });
      }
    }

    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: buyerEmail,
        amount: total * 100,
        reference,
        callback_url: `${BASE}/payment/callback?tx_ref=${reference}`,
        metadata: {
          type: 'project_material',
          userId: buyerId,
          topicId: topicRef,
          title,
          department: dept,
          level: lvl,
          price: total,
          basePrice,
          addons: addonDescriptions.length ? addonDescriptions.join(', ') : 'None',
          customLocation: customLocation || null,
          name: profile?.full_name || buyerEmail.split('@')[0] || 'Client',
          whatsapp: profile?.whatsapp || null,
          guestCheckout,
          guestEmail: guestCheckout ? buyerEmail : null,
        },
      }),
    });

    const data = await res.json();
    if (!data.status) {
      return NextResponse.json({ error: data.message || 'Payment init failed' }, { status: 400 });
    }
    return NextResponse.json({ authorization_url: data.data.authorization_url, reference, total });
  } catch (err: any) {
    console.error('Project checkout error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
