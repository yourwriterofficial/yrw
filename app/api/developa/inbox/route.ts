import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/forumServer';
import { effectiveTier } from '@/lib/plans';
import { getSiteState } from '@/lib/adminState';

export const dynamic = 'force-dynamic';

/**
 * The signed-in site owner's inbox: announcements from developa.me that apply to at least one of their sites
 * (everyone, their plan, a named site, or sites under a restriction), plus the status of each of their sites.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const { data: sites } = await supabaseAdmin.from('forums').select('id, name, slug, plan_tier, plan_expires_at').eq('owner_id', user.id);
  const mine = sites || [];
  if (mine.length === 0) return NextResponse.json({ announcements: [], sites: [] });

  const states = await Promise.all(mine.map((s) => getSiteState(s.id as string)));
  const tiers = new Set(mine.map((s) => effectiveTier(s.plan_tier, s.plan_expires_at)));
  const ids = new Set(mine.map((s) => s.id as string));
  const statuses = new Set(states.map((s) => s.status));

  const { data, error } = await supabaseAdmin
    .from('platform_announcements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) return NextResponse.json({ announcements: [], sites: [], needs_update: true });

  const now = Date.now();
  const announcements = (data || [])
    .filter((a) => !a.expires_at || new Date(a.expires_at).getTime() > now)
    // Scheduled and cancelled ones are not in the inbox, and only announcements meant for the inbox show here.
    .filter((a) => (a.status ?? 'sent') === 'sent' && (!Array.isArray(a.channels) || a.channels.includes('inbox')))
    .filter((a) => {
      const aud = (a.audience || { type: 'all' }) as { type: string; tiers?: string[]; site_ids?: string[]; status?: string };
      if (aud.type === 'all') return true;
      if (aud.type === 'tiers') return (aud.tiers || []).some((t) => tiers.has(t as never));
      if (aud.type === 'sites') return (aud.site_ids || []).some((i) => ids.has(i));
      if (aud.type === 'status') return aud.status ? statuses.has(aud.status as never) : false;
      return false;
    })
    .slice(0, 20)
    .map((a) => ({ id: a.id, title: a.title, body: a.body, level: a.level, pinned: a.pinned, created_at: a.created_at }));

  return NextResponse.json({
    announcements,
    sites: mine.map((s, i) => ({ slug: s.slug, name: s.name, status: states[i].status, reason: states[i].reason, restrictions: states[i].restrictions })),
  });
}
