import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { isMissingRelationError, readExtendedSite, requireSiteAccess, supabaseAdmin } from '@/lib/forumServer';
import { planFor } from '@/lib/plans';
import { overLimit, clientIp } from '@/lib/rateLimit';
import { vapidPublicKey } from '@/lib/sitePush';

const subscribeSchema = z.object({
  endpoint: z.string().trim().url().max(1000),
  keys: z.object({
    p256dh: z.string().trim().min(1).max(200),
    auth: z.string().trim().min(1).max(100),
  }),
  audience: z.enum(['owner', 'buyer']),
});

const unsubscribeSchema = z.object({ endpoint: z.string().trim().url().max(1000) });

const PRO_ONLY = 'Phone alerts are a Pro feature. Upgrade this site to turn them on.';

export async function GET() {
  return NextResponse.json({ vapidPublicKey: vapidPublicKey() });
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    if (overLimit(`site-push:${clientIp(request)}`, 20, 10 * 60 * 1000)) {
      return NextResponse.json({ error: 'Too many tries. Please wait a few minutes.' }, { status: 429 });
    }

    const parsed = subscribeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Could not read this phone alert request.' }, { status: 400 });
    const { endpoint, keys, audience } = parsed.data;

    let siteId: string;
    let planTier: string | null;
    let planExpiresAt: string | null | undefined;
    let userId: string;
    let buyerEmail: string | null = null;

    if (audience === 'owner') {
      const access = await requireSiteAccess(slug, ['owner', 'manager', 'packer']);
      if ('error' in access) return access.error;
      siteId = access.site.id;
      planTier = access.site.plan_tier;
      planExpiresAt = (access.site as { plan_expires_at?: string | null }).plan_expires_at;
      userId = access.user.id;
    } else {
      const supabase = await createServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
      const { data: site } = await supabaseAdmin
        .from('forums')
        .select('id, plan_tier')
        .eq('slug', slug.toLowerCase().trim())
        .maybeSingle();
      if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });
      siteId = site.id;
      planTier = site.plan_tier;
      planExpiresAt = (await readExtendedSite(site.id))?.plan_expires_at;
      userId = user.id;
      buyerEmail = (user.email || '').toLowerCase().trim() || null;
    }

    if (!planFor(planTier, planExpiresAt).pushNotifications) {
      return NextResponse.json({ error: PRO_ONLY }, { status: 403 });
    }

    const { error } = await supabaseAdmin.from('site_push_subscriptions').upsert(
      { site_id: siteId, audience, user_id: userId, buyer_email: buyerEmail, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      { onConflict: 'site_id,endpoint' }
    );
    if (error) {
      if (isMissingRelationError(error)) {
        return NextResponse.json({ error: 'Phone alerts are not ready yet. Please try again soon.' }, { status: 503 });
      }
      throw error;
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Could not turn on phone alerts.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const parsed = unsubscribeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Could not read this request.' }, { status: 400 });

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });

    const { data: site } = await supabaseAdmin
      .from('forums')
      .select('id')
      .eq('slug', slug.toLowerCase().trim())
      .maybeSingle();
    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

    const { error } = await supabaseAdmin
      .from('site_push_subscriptions')
      .delete()
      .eq('site_id', site.id)
      .eq('endpoint', parsed.data.endpoint)
      .eq('user_id', user.id);
    if (error && !isMissingRelationError(error)) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Could not turn off phone alerts.' }, { status: 500 });
  }
}
