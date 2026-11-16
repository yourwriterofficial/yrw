import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwnedSite, supabaseAdmin } from '@/lib/forumServer';
import { PLANS, effectiveTier } from '@/lib/plans';
import { pluginOn } from '@/lib/plugins';
import { readPluginSettings } from '@/lib/pluginsServer';
import { createSubaccount, listNigerianBanks, paystackErrorResponse, resolveBankAccount } from '@/lib/paystack';

export const dynamic = 'force-dynamic';

const subaccountSchema = z.object({
  bank_code: z.string().trim().min(2).max(20),
  account_number: z.string().trim().regex(/^\d{10}$/, 'Enter a 10-digit Nigerian account number.'),
});

/** Owner: check current Paystack subaccount & list Nigerian banks. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const owned = await requireOwnedSite(slug);
  if ('error' in owned) return owned.error;

  const tier = effectiveTier(owned.site.plan_tier, owned.site.plan_expires_at);
  const { data: siteRow } = await supabaseAdmin
    .from('forums')
    .select('paystack_subaccount_code, paystack_bank_code, paystack_account_name, paystack_split_fee_pct')
    .eq('id', owned.site.id)
    .maybeSingle();

  const banks = PLANS[tier].onlinePayments ? await listNigerianBanks().catch(() => []) : [];
  return NextResponse.json({
    eligible: PLANS[tier].onlinePayments,
    split_fee_pct: PLANS[tier].splitFeePct,
    subaccount_code: siteRow?.paystack_subaccount_code || null,
    bank_code: siteRow?.paystack_bank_code || null,
    account_name: siteRow?.paystack_account_name || null,
    banks,
  });
}

/** Owner: verify bank account and register a Paystack split subaccount. */
export async function POST(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const owned = await requireOwnedSite(slug);
    if ('error' in owned) return owned.error;

    const tier = effectiveTier(owned.site.plan_tier, owned.site.plan_expires_at);
    const settings = await readPluginSettings(owned.site.id);
    if (!PLANS[tier].onlinePayments) {
      return NextResponse.json({ error: 'Receiving online payments is not part of your current plan. Open Plans to add it.' }, { status: 403 });
    }
    // Connecting a bank is how an owner asks to receive payments, so the feature is switched on for them here.
    if (!pluginOn('online_payments', owned.site.plan_tier, owned.site.plan_expires_at, settings)) {
      await supabaseAdmin.from('forums').update({ plugins: { ...settings, online_payments: true } }).eq('id', owned.site.id);
    }

    const body = await request.json().catch(() => null);
    const parsed = subaccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid bank details.' }, { status: 400 });
    }

    const resolved = await resolveBankAccount(parsed.data.account_number, parsed.data.bank_code);
    const feePct = PLANS[tier].splitFeePct;
    const sub = await createSubaccount({
      businessName: `${owned.site.name} (${owned.site.slug})`,
      settlementBank: parsed.data.bank_code,
      accountNumber: parsed.data.account_number,
      percentageCharge: feePct,
      description: `Developa split payouts for ${owned.site.slug}.developa.me`,
    });

    await supabaseAdmin
      .from('forums')
      .update({
        paystack_subaccount_code: sub.subaccount_code,
        paystack_bank_code: parsed.data.bank_code,
        paystack_account_name: resolved.account_name,
        paystack_split_fee_pct: feePct,
        updated_at: new Date().toISOString(),
      })
      .eq('id', owned.site.id);

    return NextResponse.json({
      subaccount_code: sub.subaccount_code,
      account_name: resolved.account_name,
      split_fee_pct: feePct,
    });
  } catch (err: unknown) {
    return paystackErrorResponse(err, 'Could not connect your bank account. Please try again.');
  }
}
