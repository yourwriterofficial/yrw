import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { notifyUser } from '@/lib/notify';
import { sendSystemEmail } from '@/lib/emailService';
import { emailTemplates, emailShell } from '@/lib/emailTemplates';
import { upsertInvoiceForOrder } from '@/lib/invoices';

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

/** Compile a milestones array (same shape the client uses) for an order. */
function compileMilestones(structure: '60/40' | 'CUSTOM', milestones: any[], total: number) {
  if (structure === 'CUSTOM') {
    return (milestones || []).map((m: any) => ({
      name: m.name,
      percentage: Number(m.percentage),
      amount: Math.round((Number(m.percentage) / 100) * total),
      paid: false, delivered: false, paid_at: null, tx_ref: null, trigger: m.trigger || '',
    }));
  }
  return [
    { name: 'Initial Deposit', percentage: 60, amount: Math.round(total * 0.6), paid: false, delivered: false, paid_at: null, tx_ref: null, trigger: 'Upon signing this agreement' },
    { name: 'Final Payment', percentage: 40, amount: Math.round(total * 0.4), paid: false, delivered: false, paid_at: null, tx_ref: null, trigger: 'Upon project completion' },
  ];
}

/**
 * Admin: create an order on behalf of a client. Works for an existing client
 * (matched by email) or a brand-new one (auto-creates the account + emails a
 * set-password link). The order is attached to the client's id so it shows in
 * their dashboard as their own.
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
    } = body;

    if (!name || !email || !topic || !deadline || !quote) {
      return NextResponse.json({ error: 'Missing required fields (name, email, topic, deadline, quote).' }, { status: 400 });
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
      // Fall back to scanning auth users (profiles.email may be null for some)
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: cleanEmail,
        email_confirm: true,
        user_metadata: { full_name: name },
      });
      if (createErr) {
        // Likely already registered — try to find them
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

    // 2. Build + insert the order
    const prefix = serviceTier === 'CUSTOM' ? 'CUST' : 'RW';
    const orderStringId = `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
    const structure = paymentStructure === 'CUSTOM' ? 'CUSTOM' : '60/40';
    const compiled = compileMilestones(structure, milestones || [], Number(quote));

    const orderRow: any = {
      order_id: orderStringId,
      client_id: clientId,
      legal_name: name,
      email: cleanEmail,
      whatsapp_sync: whatsapp || null,
      client_phone: whatsapp || null,
      client_company: company || null,
      client_address: address || null,
      topic,
      service_tier: serviceTier || 'CUSTOM',
      financial_quote: Number(quote),
      word_count: wordCount ? Number(wordCount) : null,
      deadline,
      workflow_status: 'Briefing Received',
      corrections_status: 'None',
      vault_status: 'Secured in Vault',
      payment_structure_type: structure,
      payment_milestones: compiled,
      additional_info: additionalInfo || null,
      sixty_percent_paid: false,
      forty_percent_paid: false,
      work_submitted: false,
    };

    const { data: inserted, error: insErr } = await admin.from('orders').insert(orderRow).select().single();
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    // 3. Auto-generate the invoice
    await upsertInvoiceForOrder(admin, inserted, { autoGenerated: true }).catch(() => {});

    // 4. Notify the client (order + invoice link)
    const invoiceTpl = emailTemplates.invoiceIssued({
      legal_name: name,
      invoice_number: orderStringId,
      total_amount: Number(quote),
      invoice_url: `${BASE}/invoice/${orderStringId}`,
      project_title: topic,
    });
    await notifyUser({
      userId: clientId,
      title: `New order created: ${orderStringId}`,
      message: `An order "${topic}" was set up for you. View your invoice and pay the deposit to begin.`,
      type: 'order_update',
      link: `/dashboard/client?preview=${orderStringId}`,
      orderDbId: inserted.id,
      emailHtml: invoiceTpl.html,
      emailSubject: invoiceTpl.subject,
    });

    // 5. New account → send a set-password (recovery) link
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

    return NextResponse.json({ success: true, orderId: orderStringId, clientId, isNewUser });
  } catch (err: any) {
    console.error('create-order error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
