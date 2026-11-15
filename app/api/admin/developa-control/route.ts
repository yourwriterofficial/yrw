import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { requireAdmin } from '@/lib/adminAuth';
import { isMissingRelationError, supabaseAdmin } from '@/lib/forumServer';
import { forgetSiteState, writeAudit } from '@/lib/adminState';
import { PAID_TIERS, PLANS, PLAN_ORDER, type PlanTier } from '@/lib/plans';
import { notifyUser } from '@/lib/notify';

export const dynamic = 'force-dynamic';

const restrictionsSchema = z.object({
  no_online_payments: z.boolean().optional(),
  no_newsletters: z.boolean().optional(),
  no_custom_domain: z.boolean().optional(),
  no_new_products: z.boolean().optional(),
  hide_from_directory: z.boolean().optional(),
  product_cap: z.number().int().min(0).max(100000).nullable().optional(),
});

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('set_site_state'),
    site_id: z.string().uuid(),
    status: z.enum(['active', 'restricted', 'suspended', 'banned']),
    restrictions: restrictionsSchema.default({}),
    reason: z.string().trim().max(400).default(''),
    admin_note: z.string().trim().max(2000).default(''),
    notify_owner: z.boolean().default(true),
  }),
  z.object({
    action: z.literal('set_user_state'),
    user_id: z.string().uuid(),
    status: z.enum(['active', 'restricted', 'banned']),
    max_sites_override: z.number().int().min(0).max(1000).nullable().optional(),
    reason: z.string().trim().max(400).default(''),
    admin_note: z.string().trim().max(2000).default(''),
  }),
  z.object({
    action: z.literal('grant_plan'),
    site_id: z.string().uuid(),
    tier: z.enum(['free', 'lite', 'pro', 'business', 'corporate']),
    months: z.number().int().min(0).max(36).default(1),
    reason: z.string().trim().max(300).default(''),
  }),
]);

/** Every site's status, restrictions and notes, and every account's status. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const [sitesRes, usersRes] = await Promise.all([
    supabaseAdmin.from('site_admin_state').select('*'),
    supabaseAdmin.from('user_admin_state').select('*'),
  ]);
  const missing = isMissingRelationError(sitesRes.error) || isMissingRelationError(usersRes.error);
  return NextResponse.json({
    needs_update: missing,
    sites: Object.fromEntries((sitesRes.data || []).map((r) => [r.site_id, r])),
    users: Object.fromEntries((usersRes.data || []).map((r) => [r.user_id, r])),
  });
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request.' }, { status: 400 });
  const d = parsed.data;
  const admin = { admin_id: guard.userId, admin_email: guard.email };
  const NEEDS_DB = 'Admin controls need the latest database update first (run the platform_admin_controls migration).';

  if (d.action === 'set_site_state') {
    const { data: site } = await supabaseAdmin.from('forums').select('id, name, slug, owner_id').eq('id', d.site_id).maybeSingle();
    if (!site) return NextResponse.json({ error: 'Site not found.' }, { status: 404 });
    const { error } = await supabaseAdmin.from('site_admin_state').upsert({
      site_id: d.site_id,
      status: d.status,
      restrictions: d.restrictions,
      reason: xss(d.reason),
      admin_note: xss(d.admin_note),
      updated_by: guard.userId,
      updated_at: new Date().toISOString(),
    });
    if (error) return NextResponse.json({ error: isMissingRelationError(error) ? NEEDS_DB : 'Could not save.' }, { status: isMissingRelationError(error) ? 503 : 500 });
    forgetSiteState(d.site_id);
    await writeAudit({ ...admin, action: `site_${d.status}`, site_id: d.site_id, target_id: d.site_id, detail: { restrictions: d.restrictions, reason: d.reason, name: site.name } });
    if (d.notify_owner && site.owner_id && (d.status !== 'active' || Object.values(d.restrictions).some(Boolean))) {
      const headline = d.status === 'active' ? 'Some features on your site were limited' : `Your site "${site.name}" is now ${d.status}`;
      await notifyUser({ userId: site.owner_id, title: headline, message: d.reason || 'Contact developa.me support if you think this is a mistake.', type: 'admin_message', isAdminSent: true, link: `/developer/manage?site=${site.slug}` }).catch(() => undefined);
    }
    return NextResponse.json({ ok: true });
  }

  if (d.action === 'set_user_state') {
    const { error } = await supabaseAdmin.from('user_admin_state').upsert({
      user_id: d.user_id,
      status: d.status,
      max_sites_override: d.max_sites_override ?? null,
      reason: xss(d.reason),
      admin_note: xss(d.admin_note),
      updated_by: guard.userId,
      updated_at: new Date().toISOString(),
    });
    if (error) return NextResponse.json({ error: isMissingRelationError(error) ? NEEDS_DB : 'Could not save.' }, { status: isMissingRelationError(error) ? 503 : 500 });
    // A ban stops them signing in; lifting it lets them back in.
    const banDuration = d.status === 'banned' ? '876000h' : 'none';
    const ban = await supabaseAdmin.auth.admin.updateUserById(d.user_id, { ban_duration: banDuration });
    if (ban.error) console.warn('auth ban update failed:', ban.error.message);
    // Their sites follow the account: banned goes offline, lifting it brings them back.
    const { data: owned } = await supabaseAdmin.from('forums').select('id').eq('owner_id', d.user_id);
    const ids = (owned || []).map((s) => s.id as string);
    if (ids.length && (d.status === 'banned' || d.status === 'active')) {
      const rows = ids.map((id) => ({ site_id: id, status: d.status === 'banned' ? 'banned' : 'active', reason: d.status === 'banned' ? xss(d.reason) : '', updated_by: guard.userId, updated_at: new Date().toISOString() }));
      await supabaseAdmin.from('site_admin_state').upsert(rows, { onConflict: 'site_id', ignoreDuplicates: false });
      ids.forEach(forgetSiteState);
    }
    await writeAudit({ ...admin, action: `user_${d.status}`, target_type: 'user', target_id: d.user_id, detail: { reason: d.reason, sites: ids.length, max_sites_override: d.max_sites_override ?? null } });
    return NextResponse.json({ ok: true, auth_ban_applied: !ban.error });
  }

  // grant_plan
  const tier = d.tier as PlanTier;
  if (!PLAN_ORDER.includes(tier)) return NextResponse.json({ error: 'Unknown plan.' }, { status: 400 });
  const { data: site } = await supabaseAdmin.from('forums').select('id, name, plan_expires_at').eq('id', d.site_id).maybeSingle();
  if (!site) return NextResponse.json({ error: 'Site not found.' }, { status: 404 });
  const expires = tier === 'free' || d.months === 0 ? null : (() => {
    const base = site.plan_expires_at && new Date(site.plan_expires_at).getTime() > Date.now() ? new Date(site.plan_expires_at) : new Date();
    base.setMonth(base.getMonth() + d.months);
    return base.toISOString();
  })();
  const { error } = await supabaseAdmin.from('forums').update({
    plan_tier: tier,
    plan_expires_at: expires,
    hide_branding: PAID_TIERS.includes(tier) ? PLANS[tier].hideBranding : false,
    updated_at: new Date().toISOString(),
  }).eq('id', d.site_id);
  if (error) return NextResponse.json({ error: 'Could not change the plan.' }, { status: 500 });
  await writeAudit({ ...admin, action: 'grant_plan', site_id: d.site_id, target_id: d.site_id, detail: { tier, months: d.months, reason: d.reason, name: site.name } });
  return NextResponse.json({ ok: true });
}
