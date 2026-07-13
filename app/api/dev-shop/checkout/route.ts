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
 * Pay-FIRST checkout for a dev shop script. No purchase row is written here —
 * it's only inserted by the Paystack webhook after payment is confirmed, so
 * unpaid attempts never grant access. Guests may check out without logging in
 * first — mirrors the /api/projects/checkout guest flow.
 *
 * Body: { productId: number, email?: string }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { productId, email: guestEmailInput } = await request.json();
    if (!productId) {
      return NextResponse.json({ error: 'Provide a product to purchase.' }, { status: 400 });
    }

    const { data: product, error: productErr } = await admin
      .from('dev_products')
      .select('id, title, price, is_active')
      .eq('id', productId)
      .single();
    if (productErr || !product || !product.is_active) {
      return NextResponse.json({ error: 'Script not found or unavailable.' }, { status: 404 });
    }

    let buyerId: string;
    let buyerEmail: string;
    let guestCheckout = false;

    if (user) {
      buyerId = user.id;
      buyerEmail = user.email!;
    } else {
      const emailInput = String(guestEmailInput || '').trim().toLowerCase();
      if (!emailInput || !EMAIL_RE.test(emailInput)) {
        return NextResponse.json({ error: 'A valid email is required to check out.' }, { status: 400 });
      }
      guestCheckout = true;
      buyerEmail = emailInput;

      const existing = await listAllAuthUsers(admin);
      const match = existing.find((u) => u.email.toLowerCase() === emailInput);
      if (match) {
        buyerId = match.id;
      } else {
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email: emailInput,
          password: emailInput,
          email_confirm: true,
          user_metadata: { full_name: emailInput.split('@')[0], password_is_email: true },
        });
        if (createErr || !created?.user) {
          return NextResponse.json({ error: 'Could not set up your account for checkout.' }, { status: 500 });
        }
        buyerId = created.user.id;
        await admin.from('profiles').upsert({ id: buyerId, full_name: emailInput.split('@')[0] });
      }
    }

    const total = Math.round(Number(product.price) || 0);
    const reference = `DEVSHOP_${Date.now()}_${buyerId.slice(0, 8)}`;
    const { data: profile } = await admin.from('profiles').select('full_name').eq('id', buyerId).single();

    // Wallet-first payment (logged-in users only)
    if (!guestCheckout) {
      const { data: wallet } = await admin.from('wallets').select('balance').eq('user_id', buyerId).single();
      const balance = Number(wallet?.balance) || 0;

      if (balance >= total && total > 0) {
        const { error: debitErr } = await admin.rpc('increment_wallet', { user_id: buyerId, add_amount: -total });
        if (debitErr) {
          return NextResponse.json({ error: 'Wallet debit failed: ' + debitErr.message }, { status: 500 });
        }

        await admin.from('transactions').insert({
          user_id: buyerId, amount: total, type: 'payment', reference, status: 'completed',
        });
        await creditReferralCommission(admin, { buyerId, amount: total, reference, note: `Dev shop: ${product.title}` });

        const { error: purchaseErr } = await admin.from('dev_product_purchases').insert({
          product_id: product.id, user_id: buyerId, amount_paid: total, reference,
        });
        if (purchaseErr) {
          return NextResponse.json({ error: purchaseErr.message }, { status: 500 });
        }

        try {
          const { notifyUser } = await import('@/lib/notify');
          const { emailShell } = await import('@/lib/emailTemplates');
          const buyerHtml = emailShell(
            `<h1>Purchase Confirmed — ${product.title}</h1>
             <p>Hi ${profile?.full_name || buyerEmail.split('@')[0] || 'there'},</p>
             <p>Thank you! Your payment of ₦${total.toLocaleString()} for <strong>${product.title}</strong> is confirmed via your wallet balance.</p>
             <p>Download it anytime from <strong>My Scripts</strong> in your dashboard.</p>`,
            'Go to My Scripts', `${BASE}/dashboard/client?tab=scripts`
          );
          await notifyUser({
            userId: buyerId,
            title: 'Script purchased',
            message: `"${product.title}" is ready to download in My Scripts.`,
            type: 'payment',
            link: '/dashboard/client?tab=scripts',
            emailHtml: buyerHtml,
            emailSubject: `Purchase confirmed: ${product.title}`,
          });
        } catch (e) { console.warn('Dev shop wallet-purchase notification failed:', e); }

        return NextResponse.json({ paid_via_wallet: true, reference, total });
      }
    }

    if (total <= 0) {
      return NextResponse.json({ error: 'This script is not priced for checkout.' }, { status: 400 });
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
          type: 'dev_product',
          userId: buyerId,
          productId: product.id,
          title: product.title,
          price: total,
          name: profile?.full_name || buyerEmail.split('@')[0] || 'Client',
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
    console.error('Dev shop checkout error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
