import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { notifyUser } from '@/lib/notify';
import { sendSystemEmail } from '@/lib/emailService';
import { emailTemplates, emailShell } from '@/lib/emailTemplates';
import { upsertInvoiceForOrder } from '@/lib/invoices';

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

/** Compile a milestones array (same shape the client uses) for an order. */
function compileMilestones(structure: '60/40' | 'CUSTOM', milestones: any[], total: number, markPaid = false) {
  if (structure === 'CUSTOM') {
    return (milestones || []).map((m: any) => ({
      name: m.name,
      percentage: Number(m.percentage),
      amount: Math.round((Number(m.percentage) / 100) * total),
      paid: markPaid,
      delivered: false,
      paid_at: markPaid ? new Date().toISOString() : null,
      tx_ref: markPaid ? 'PAID_OUTSIDE_PLATFORM' : null,
      trigger: m.trigger || '',
    }));
  }
  return [
    { name: 'Initial Deposit', percentage: 60, amount: Math.round(total * 0.6), paid: markPaid, delivered: false, paid_at: markPaid ? new Date().toISOString() : null, tx_ref: markPaid ? 'PAID_OUTSIDE_PLATFORM' : null, trigger: 'Upon signing this agreement' },
    { name: 'Final Payment', percentage: 40, amount: Math.round(total * 0.4), paid: markPaid, delivered: false, paid_at: markPaid ? new Date().toISOString() : null, tx_ref: markPaid ? 'PAID_OUTSIDE_PLATFORM' : null, trigger: 'Upon project completion' },
  ];
}

/**
 * Admin: create an order on behalf of a client. Works for an existing client
 * (matched by email) or a brand-new one. Supports prepaid catalog order linking,
 * automatic copy of vault materials, and optional client notifications.
 */
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const admin = guard.admin;

  try {
    const body = await request.json();
    const {
      name, email, whatsapp, company, address,
      topic, serviceTier, quote, deadline, wordCount,
      paymentStructure, milestones, additionalInfo,
      isCatalogOrder, markPaid, triggerNotification = true
    } = body;

    if (!name || !email || !topic || !quote) {
      return NextResponse.json({ error: 'Missing required fields (name, email, topic, quote).' }, { status: 400 });
    }
    const cleanEmail = String(email).toLowerCase().trim();

    // 1. Resolve or create the client account
    let clientId: string | null = null;
    let isNewUser = false;

    // Look for an existing profile by email
    const { data: existingProfile } = await admin.from('profiles').select('id').eq('email', cleanEmail).maybeSingle();
    if (existingProfile?.id) {
      clientId = existingProfile.id;
    } else {
      // Fall back to scanning auth users
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: cleanEmail,
        email_confirm: true,
        user_metadata: { full_name: name },
      });
      if (createErr) {
        // Likely already registered
        const { data: list } = await admin.auth.admin.listUsers();
        const match = list?.users?.find(u => u.email?.toLowerCase() === cleanEmail);
        if (match) clientId = match.id;
        else return NextResponse.json({ error: `Could not create client: ${createErr.message}` }, { status: 500 });
      } else {
        clientId = created.user?.id ?? null;
        isNewUser = true;
      }
    }

    if (!clientId) return NextResponse.json({ error: 'Failed to resolve client account' }, { status: 500 });

    // Keep the profile's contact fields fresh
    await admin.from('profiles').update({
      full_name: name,
      whatsapp: whatsapp || null,
      company_name: company || null,
      address: address || null,
    }).eq('id', clientId);

    // 2. Resolve matching ready-made project topic file if applicable
    let catalogTopicMatched = null;
    if (isCatalogOrder) {
      // Search by exact title or substring
      const { data: matchedTopics } = await admin
        .from('project_topics')
        .select('*')
        .or(`title.ilike.%${topic}%,title.eq.${topic}`)
        .eq('is_active', true)
        .limit(1);
      
      if (matchedTopics && matchedTopics.length > 0) {
        catalogTopicMatched = matchedTopics[0];
      }
    }

    // 3. Build + insert the order
    const prefix = isCatalogOrder ? 'PRJ' : (serviceTier === 'CUSTOM' ? 'CUST' : 'RW');
    const orderStringId = `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
    const structure = paymentStructure === 'CUSTOM' ? 'CUSTOM' : '60/40';
    const compiled = compileMilestones(structure, milestones || [], Number(quote), !!markPaid);

    const hasMaterialFile = !!catalogTopicMatched?.material_file_path;
    const finalTopic = isCatalogOrder ? (topic.startsWith('[PROJECT]') ? topic : `[PROJECT] ${topic}`) : topic;

    const orderRow: any = {
      order_id: orderStringId,
      client_id: clientId,
      legal_name: name,
      email: cleanEmail,
      whatsapp_sync: whatsapp || null,
      client_phone: whatsapp || null,
      client_company: company || null,
      client_address: address || null,
      topic: finalTopic,
      service_tier: serviceTier || 'CUSTOM',
      financial_quote: Number(quote),
      word_count: wordCount ? Number(wordCount) : null,
      deadline: deadline || null,
      workflow_status: (markPaid && hasMaterialFile) ? 'Completed' : 'Briefing Received',
      corrections_status: 'None',
      vault_status: (markPaid && hasMaterialFile) ? 'Secured in Vault' : 'Awaiting Material Upload',
      payment_structure_type: structure,
      payment_milestones: compiled,
      additional_info: additionalInfo || null,
      sixty_percent_paid: !!markPaid,
      forty_percent_paid: !!markPaid,
      work_submitted: (markPaid && hasMaterialFile),
    };

    const { data: inserted, error: insErr } = await admin.from('orders').insert(orderRow).select().single();
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    // If fully paid and matching material file exists, copy it to deliverables instantly
    if (markPaid && catalogTopicMatched && catalogTopicMatched.material_file_path) {
      await admin.from('final_deliverables').insert({
        order_id: orderStringId,
        file_path: catalogTopicMatched.material_file_path,
        file_name: `${catalogTopicMatched.title} — Chapters 4-5.docx`,
      });
    }

    // 4. Auto-generate the invoice
    await upsertInvoiceForOrder(admin, inserted, { autoGenerated: true }).catch(() => {});

    // 5. Optionally notify the client
    if (triggerNotification) {
      const invoiceTpl = emailTemplates.invoiceIssued({
        legal_name: name,
        invoice_number: orderStringId,
        total_amount: Number(quote),
        invoice_url: `${BASE}/invoice/${orderStringId}`,
        project_title: finalTopic,
      });

      let alertMessage = `An order "${finalTopic}" was set up for you. View your invoice and pay the deposit to begin.`;
      if (markPaid) {
        alertMessage = `Your prepaid order "${finalTopic}" has been created and marked as paid. Check your vault/dashboard.`;
      }

      await notifyUser({
        userId: clientId,
        title: markPaid ? `Prepaid Order Active: ${orderStringId}` : `New order created: ${orderStringId}`,
        message: alertMessage,
        type: 'order_update',
        link: `/dashboard/client?preview=${orderStringId}`,
        orderDbId: inserted.id,
        emailHtml: markPaid ? emailShell(
          `<h1>Order setup confirmed</h1>
           <p>Hi ${name},</p>
           <p>An order has been set up for you: <strong>${finalTopic}</strong> (Order ID: ${orderStringId}).</p>
           <p>This order has been marked as <strong>Fully Paid</strong>. ${hasMaterialFile ? 'The deliverable material is ready in your Secure Vault now!' : 'Our writing desk will upload the material to your vault shortly.'}</p>`,
          'Access Your Dashboard', `${BASE}/dashboard/client`
        ) : invoiceTpl.html,
        emailSubject: markPaid ? `Prepaid Order Activated — ID: ${orderStringId}` : invoiceTpl.subject,
      });

      // 6. New account → send a set-password (recovery) link
      if (isNewUser) {
        try {
          const { data: linkData } = await admin.auth.admin.generateLink({
            type: 'recovery',
            email: cleanEmail,
            options: { redirectTo: `${BASE}/update-password` },
          });
          const link = linkData?.properties?.action_link;
          if (link) {
            const html = emailShell(
              `<h1>Welcome to YourResearchWriter</h1>
               <p>Hi ${name},</p>
               <p>An account has been created for you so you can track your order <strong>${orderStringId}</strong>, view your invoice, and pay securely.</p>
               <p>Set your password to log in:</p>`,
              'Set Your Password', link
            );
            await sendSystemEmail({ to: cleanEmail, subject: 'Set up your YourResearchWriter account', html });
          }
        } catch (e) {
          console.warn('Invite link email failed (non-fatal):', e);
        }
      }
    }

    return NextResponse.json({ success: true, orderId: orderStringId, clientId, isNewUser });
  } catch (err: any) {
    console.error('create-order error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
