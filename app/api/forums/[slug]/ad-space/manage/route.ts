import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { requireSiteAccess, supabaseAdmin } from '@/lib/forumServer';
import { effectiveTier, PLANS } from '@/lib/plans';
import { sendSiteEmail } from '@/lib/siteMailer';
import { emailShell } from '@/lib/emailTemplates';

async function access(slug: string) {
  const a = await requireSiteAccess(slug, ['owner', 'manager']);
  if ('error' in a) return { error: a.error } as const;
  const planOk = PLANS[effectiveTier(a.site.plan_tier, (a.site as { plan_expires_at?: string | null }).plan_expires_at)].adSpace;
  if (!planOk) return { error: NextResponse.json({ error: 'Selling ad space is part of the Pro plan.' }, { status: 403 }) } as const;
  return { site: a.site } as const;
}

/** Owner: slots and bookings. Ends bookings that have run out as it reads. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const a = await access(slug);
  if ('error' in a) return a.error;
  const nowIso = new Date().toISOString();
  await supabaseAdmin.from('site_ad_bookings').update({ status: 'expired' }).eq('site_id', a.site.id).eq('status', 'approved').lt('ends_at', nowIso);
  const [{ data: slots, error }, { data: bookings }] = await Promise.all([
    supabaseAdmin.from('site_ad_slots').select('*').eq('site_id', a.site.id).order('created_at'),
    supabaseAdmin.from('site_ad_bookings').select('*').eq('site_id', a.site.id).order('created_at', { ascending: false }).limit(100),
  ]);
  return NextResponse.json({ slots: slots || [], bookings: bookings || [], needs_update: !!error });
}

const slotSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(60),
  placement: z.enum(['banner', 'sidebar', 'footer']),
  price_ngn: z.number().int().min(0).max(10_000_000),
  days: z.number().int().min(1).max(365),
  description: z.string().trim().max(200).optional().default(''),
  is_active: z.boolean().optional().default(true),
});

export async function PUT(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const a = await access(slug);
  if ('error' in a) return a.error;
  const parsed = slotSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Check the slot details.' }, { status: 400 });
  const { id, ...rest } = parsed.data;
  const row = { ...rest, name: xss(rest.name), description: xss(rest.description), site_id: a.site.id };
  if (id) {
    const { error } = await supabaseAdmin.from('site_ad_slots').update(row).eq('id', id).eq('site_id', a.site.id);
    if (error) return NextResponse.json({ error: 'Could not save the slot.' }, { status: 500 });
  } else {
    const { count } = await supabaseAdmin.from('site_ad_slots').select('id', { count: 'exact', head: true }).eq('site_id', a.site.id);
    if ((count ?? 0) >= 10) return NextResponse.json({ error: 'You can have up to 10 ad slots.' }, { status: 400 });
    const { error } = await supabaseAdmin.from('site_ad_slots').insert(row);
    if (error) return NextResponse.json({ error: 'Ad space needs the latest database update first.' }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const a = await access(slug);
  if ('error' in a) return a.error;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await supabaseAdmin.from('site_ad_slots').delete().eq('id', id).eq('site_id', a.site.id);
  return NextResponse.json({ ok: true });
}

const decideSchema = z.object({ id: z.string().uuid(), status: z.enum(['approved', 'rejected']) });

/** Approve (starts the run for the slot's number of days) or reject a booking. */
export async function PATCH(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const a = await access(slug);
  if ('error' in a) return a.error;
  const parsed = decideSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const { data: booking } = await supabaseAdmin.from('site_ad_bookings').select('*, site_ad_slots(name, days)').eq('id', parsed.data.id).eq('site_id', a.site.id).maybeSingle();
  if (!booking || booking.status !== 'pending') return NextResponse.json({ error: 'That request is no longer waiting.' }, { status: 409 });

  const days = (booking as { site_ad_slots?: { days?: number } }).site_ad_slots?.days ?? 30;
  const now = new Date();
  const update = parsed.data.status === 'approved'
    ? { status: 'approved', starts_at: now.toISOString(), ends_at: new Date(now.getTime() + days * 86_400_000).toISOString() }
    : { status: 'rejected' };
  await supabaseAdmin.from('site_ad_bookings').update(update).eq('id', booking.id).eq('status', 'pending');

  sendSiteEmail({
    to: booking.advertiser_email,
    subject: parsed.data.status === 'approved' ? `Your ad on ${a.site.name} is live` : `Your ad request on ${a.site.name}`,
    html: emailShell(
      parsed.data.status === 'approved'
        ? `<h2>Your ad is live</h2><p>"${xss(booking.title)}" will run on ${xss(a.site.name)} for ${days} days.</p>`
        : `<h2>Request not approved</h2><p>${xss(a.site.name)} could not take your ad "${xss(booking.title)}" this time. Contact the seller if you have questions.</p>`,
      'Visit the site',
      `https://${a.site.slug}.developa.me`,
      'developa'
    ),
  }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
