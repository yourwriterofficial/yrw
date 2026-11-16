import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { createClient as createServerClient } from '@/lib/supabase/server';
import {
  isMissingRelationError,
  readExtendedSite,
  requireSiteAccess,
  resolveAuthorNames,
  resolveUserSiteRole,
  supabaseAdmin,
} from '@/lib/forumServer';
import { planFor } from '@/lib/plans';
import { sendSystemEmail } from '@/lib/emailService';
import { emailShell } from '@/lib/emailTemplates';
import { loadSiteBrand } from '@/lib/siteBrandServer';
import { siteUrl } from '@/lib/siteUrl';

const createTierSchema = z.object({
  action: z.literal('create_tier'),
  name: z.string().trim().min(2, 'Tier name is required').max(80),
  description: z.string().trim().max(400).optional().default(''),
  price: z.number().min(0).max(10_000_000),
  duration_days: z.number().int().min(1).max(3650).optional().default(30),
});

const joinSchema = z.object({
  action: z.literal('request_join'),
  tier_id: z.string().uuid(),
  payment_reference: z.string().trim().max(120).optional().default(''),
});

const patchSchema = z.union([
  z.object({ tier_id: z.string().uuid(), is_active: z.boolean() }),
  z.object({ id: z.string().uuid(), status: z.enum(['pending', 'active', 'expired', 'rejected']) }),
]);

const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const { data: site } = await supabaseAdmin
      .from('forums')
      .select('id, slug, name, owner_id, plan_tier, currency')
      .eq('slug', slug.toLowerCase().trim())
      .maybeSingle();

    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

    const { data: tiersData, error: tiersErr } = await supabaseAdmin
      .from('site_membership_tiers')
      .select('id, site_id, name, description, price, duration_days, is_active, created_at')
      .eq('site_id', site.id)
      .order('price', { ascending: true });

    if (tiersErr) {
      if (isMissingRelationError(tiersErr)) {
        return NextResponse.json({ tiers: [], myMembership: null, memberships: [], tableMissing: true });
      }
      throw tiersErr;
    }

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    const ext = await readExtendedSite(site.id);
    const myRole = await resolveUserSiteRole(
      site.id,
      site.owner_id,
      site.plan_tier,
      ext?.plan_expires_at,
      user?.id,
      user?.email
    );
    const canManage = myRole === 'owner' || myRole === 'manager';

    let myMembership: Record<string, unknown> | null = null;
    if (user) {
      const { data: ownRow } = await supabaseAdmin
        .from('site_memberships')
        .select('id, tier_id, status, payment_reference, expires_at, created_at')
        .eq('site_id', site.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      myMembership = ownRow || null;
    }

    let memberships: unknown[] = [];
    if (canManage) {
      const { data: allRows } = await supabaseAdmin
        .from('site_memberships')
        .select('id, site_id, tier_id, user_id, email, status, payment_reference, expires_at, created_at')
        .eq('site_id', site.id)
        .order('created_at', { ascending: false })
        .limit(200);
      const names = await resolveAuthorNames((allRows || []).map((m) => m.user_id));
      memberships = (allRows || []).map((m) => ({
        ...m,
        member_name: names.get(m.user_id) || m.email || 'Member',
      }));
    }

    const tiers = canManage ? tiersData || [] : (tiersData || []).filter((t) => t.is_active);
    return NextResponse.json({ tiers, myMembership, memberships });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load memberships' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const raw = await request.json().catch(() => null);

    if (raw?.action === 'create_tier') {
      const access = await requireSiteAccess(slug, ['owner', 'manager']);
      if ('error' in access) return access.error;
      const plan = planFor(access.site.plan_tier, access.site.plan_expires_at);
      if (!plan.paidMemberships) {
        return NextResponse.json({ error: 'Paid memberships are available on the Business plan.' }, { status: 403 });
      }
      const parsed = createTierSchema.safeParse(raw);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid tier' }, { status: 400 });
      }
      const { data, error } = await supabaseAdmin
        .from('site_membership_tiers')
        .insert({
          site_id: access.site.id,
          name: xss(parsed.data.name),
          description: xss(parsed.data.description),
          price: parsed.data.price,
          duration_days: parsed.data.duration_days,
          is_active: true,
        })
        .select('*')
        .single();
      if (error) {
        if (isMissingRelationError(error)) {
          return NextResponse.json({ error: 'This is not available right now. Please try again in a few minutes.' }, { status: 503 });
        }
        throw error;
      }
      return NextResponse.json({ tier: data }, { status: 201 });
    }

    const parsed = joinSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Choose a valid membership tier.' }, { status: 400 });
    }

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in to join a membership tier.' }, { status: 401 });

    const { data: site } = await supabaseAdmin
      .from('forums')
      .select('id, slug, name, owner_id, plan_tier')
      .eq('slug', slug.toLowerCase().trim())
      .maybeSingle();
    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

    const { data: tier } = await supabaseAdmin
      .from('site_membership_tiers')
      .select('id, name, price, duration_days, is_active')
      .eq('id', parsed.data.tier_id)
      .eq('site_id', site.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!tier) return NextResponse.json({ error: 'Membership tier not found.' }, { status: 404 });

    const isFree = Number(tier.price) <= 0;
    const ref = parsed.data.payment_reference.trim();
    if (!isFree && ref.length < 2) {
      return NextResponse.json({ error: 'Enter your transfer reference or sender name.' }, { status: 400 });
    }

    const expiresAt = isFree
      ? new Date(Date.now() + Number(tier.duration_days || 30) * 86400_000).toISOString()
      : null;

    const { data: membership, error } = await supabaseAdmin
      .from('site_memberships')
      .insert({
        site_id: site.id,
        tier_id: tier.id,
        user_id: user.id,
        email: (user.email || '').toLowerCase(),
        status: isFree ? 'active' : 'pending',
        payment_reference: xss(ref),
        expires_at: expiresAt,
      })
      .select('*')
      .single();

    if (error) {
      if (isMissingRelationError(error)) {
        return NextResponse.json({ error: 'This is not available right now. Please try again in a few minutes.' }, { status: 503 });
      }
      throw error;
    }

    if (isFree) {
      await supabaseAdmin
        .from('forum_members')
        .upsert({ forum_id: site.id, user_id: user.id, role: 'member' }, { onConflict: 'forum_id,user_id', ignoreDuplicates: true });
    } else {
      try {
        const { notifyUser } = await import('@/lib/notify');
        await notifyUser({
          userId: site.owner_id,
          title: `New membership payment to check on ${site.name}`,
          message: `${user.email || 'A member'} submitted reference "${ref}" for ${tier.name}.`,
          type: 'order_update',
          link: `/developer/manage?site=${site.slug}`,
        });
      } catch {
        // Non-blocking notification
      }
    }

    return NextResponse.json({ membership }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Membership request failed' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const access = await requireSiteAccess(slug, ['owner', 'manager']);
    if ('error' in access) return access.error;

    const raw = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid update' }, { status: 400 });

    if ('tier_id' in parsed.data) {
      const { data, error } = await supabaseAdmin
        .from('site_membership_tiers')
        .update({ is_active: parsed.data.is_active })
        .eq('id', parsed.data.tier_id)
        .eq('site_id', access.site.id)
        .select('*')
        .single();
      if (error) throw error;
      return NextResponse.json({ tier: data });
    }

    const { data: current } = await supabaseAdmin
      .from('site_memberships')
      .select('id, tier_id, user_id, email')
      .eq('id', parsed.data.id)
      .eq('site_id', access.site.id)
      .maybeSingle();

    if (!current) return NextResponse.json({ error: 'Membership not found' }, { status: 404 });

    let expiresAt: string | undefined;
    if (parsed.data.status === 'active') {
      const { data: tier } = await supabaseAdmin
        .from('site_membership_tiers')
        .select('duration_days')
        .eq('id', current.tier_id)
        .maybeSingle();
      const days = Number(tier?.duration_days || 30);
      expiresAt = new Date(Date.now() + days * 86400_000).toISOString();

      await supabaseAdmin
        .from('forum_members')
        .upsert({ forum_id: access.site.id, user_id: current.user_id, role: 'member' }, { onConflict: 'forum_id,user_id', ignoreDuplicates: true });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('site_memberships')
      .update({
        status: parsed.data.status,
        ...(expiresAt ? { expires_at: expiresAt } : {}),
      })
      .eq('id', current.id)
      .select('*')
      .single();

    if (error) throw error;

    if (current.email && (parsed.data.status === 'active' || parsed.data.status === 'rejected')) {
      const link = `${siteUrl()}/forums/${access.site.slug}`;
      sendSystemEmail({
        to: current.email,
        subject: `${access.site.name}: your membership is ${parsed.data.status}`,
        html: emailShell(
          parsed.data.status === 'active'
            ? `<p>Your membership in <strong>${esc(access.site.name)}</strong> is now active.</p>`
            : `<p>Your membership payment on <strong>${esc(access.site.name)}</strong> could not be confirmed.</p>`,
          `Open ${access.site.name}`,
          link,
          await loadSiteBrand(access.site)
        ),
      }).catch(() => {});
    }

    return NextResponse.json({ membership: updated });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update membership' }, { status: 500 });
  }
}
