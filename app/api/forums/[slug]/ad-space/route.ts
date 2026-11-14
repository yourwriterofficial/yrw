import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import xss from 'xss';
import { supabaseAdmin } from '@/lib/forumServer';
import { effectiveTier, PLANS } from '@/lib/plans';
import { clientIp, overLimit } from '@/lib/rateLimit';
import { pluginOn } from '@/lib/plugins';
import { readPluginSettings } from '@/lib/pluginsServer';
import { sendSiteEmail } from '@/lib/siteMailer';
import { emailShell } from '@/lib/emailTemplates';
import { siteUrl } from '@/lib/siteUrl';

export const dynamic = 'force-dynamic';

async function siteWithPlan(slug: string) {
  const { data } = await supabaseAdmin
    .from('forums')
    .select('id, slug, name, owner_id, plan_tier, plan_expires_at, is_public, bank_name, bank_account_number, bank_account_name, payment_instructions, whatsapp_number')
    .eq('slug', slug.toLowerCase().trim())
    .maybeSingle();
  if (!data || !data.is_public) return null;
  if (!PLANS[effectiveTier(data.plan_tier, data.plan_expires_at)].adSpace) return null;
  if (!pluginOn('adspace', data.plan_tier, data.plan_expires_at, await readPluginSettings(data.id))) return null;
  return data;
}

/** Public: the slots a visitor can book, and the ads that are running right now. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const site = await siteWithPlan(slug);
  if (!site) return NextResponse.json({ enabled: false, slots: [], running: [] });
  const nowIso = new Date().toISOString();
  const [{ data: slots }, { data: running }] = await Promise.all([
    supabaseAdmin.from('site_ad_slots').select('id, name, placement, price_ngn, days, description').eq('site_id', site.id).eq('is_active', true).order('price_ngn'),
    supabaseAdmin.from('site_ad_bookings').select('id, slot_id, title, link_url, image_url, ends_at').eq('site_id', site.id).eq('status', 'approved').lte('starts_at', nowIso).gte('ends_at', nowIso),
  ]);
  const placementBySlot = new Map((slots || []).map((s) => [s.id as string, s.placement as string]));
  return NextResponse.json(
    {
      enabled: true,
      slots: slots || [],
      running: (running || []).map((r) => ({ ...r, placement: placementBySlot.get(r.slot_id as string) || 'banner' })),
    },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } }
  );
}

const bookingSchema = z.object({
  slot_id: z.string().uuid(),
  advertiser_name: z.string().trim().min(2).max(80),
  advertiser_email: z.string().trim().email().max(120),
  advertiser_phone: z.string().trim().max(30).optional().default(''),
  title: z.string().trim().min(2).max(100),
  link_url: z.string().trim().max(500).refine((v) => v === '' || /^https?:\/\//.test(v), 'Links must start with http:// or https://').optional().default(''),
  image_url: z.string().trim().max(600).refine((v) => v === '' || /^https:\/\//.test(v), 'Images must be https links').optional().default(''),
});

/** Public: an advertiser asks for a slot. The owner confirms payment and approves it. */
export async function POST(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (overLimit(`adbook:${clientIp(request)}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }
  const site = await siteWithPlan(slug);
  if (!site) return NextResponse.json({ error: 'This site is not selling ad space.' }, { status: 404 });
  const parsed = bookingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Check your details.' }, { status: 400 });
  const d = parsed.data;

  const { data: slot } = await supabaseAdmin.from('site_ad_slots').select('id, name, price_ngn, days').eq('id', d.slot_id).eq('site_id', site.id).eq('is_active', true).maybeSingle();
  if (!slot) return NextResponse.json({ error: 'That ad slot is not available.' }, { status: 404 });

  const reference = `AD-${randomBytes(4).toString('hex').toUpperCase()}`;
  const { error } = await supabaseAdmin.from('site_ad_bookings').insert({
    slot_id: slot.id,
    site_id: site.id,
    advertiser_name: xss(d.advertiser_name),
    advertiser_email: d.advertiser_email.toLowerCase(),
    advertiser_phone: xss(d.advertiser_phone),
    title: xss(d.title),
    link_url: d.link_url,
    image_url: d.image_url,
    reference,
  });
  if (error) return NextResponse.json({ error: 'Could not save your request. Please try again.' }, { status: 500 });

  // Tell the owner. A mail failure must not lose the booking.
  const { data: owner } = await supabaseAdmin.auth.admin.getUserById(site.owner_id);
  if (owner?.user?.email) {
    sendSiteEmail({
      to: owner.user.email,
      subject: `${site.name}: new ad request (${reference})`,
      html: emailShell(
        `<h2>New ad request</h2><p><strong>${xss(d.advertiser_name)}</strong> wants the <strong>${xss(slot.name)}</strong> slot for ${slot.days} days (₦${Number(slot.price_ngn).toLocaleString('en-NG')}).</p><p>Reference: <strong>${reference}</strong></p><p>Once they have paid you, approve it in your Admin under Ad space.</p>`,
        'Open Ad space',
        `${siteUrl()}/developer/manage?site=${encodeURIComponent(site.slug)}`,
        'developa'
      ),
    }).catch(() => undefined);
  }

  return NextResponse.json({
    ok: true,
    reference,
    amount: slot.price_ngn,
    pay_to: {
      bank_name: site.bank_name || '',
      account_number: site.bank_account_number || '',
      account_name: site.bank_account_name || '',
      instructions: site.payment_instructions || '',
      whatsapp: site.whatsapp_number || '',
    },
  }, { status: 201 });
}
