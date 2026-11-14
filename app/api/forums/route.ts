import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { readExtendedSite, supabaseAdmin } from '@/lib/forumServer';
import { FORUM_ACCENTS, normalizeForumSlug, validateForumSlug } from '@/lib/forums';
import { planFor } from '@/lib/plans';
import { getTemplateById } from '@/lib/siteTemplates';
import { TRIAL_DAYS, TRIAL_TIER } from '@/lib/plans';
import { overLimit } from '@/lib/rateLimit';

const allowedAccents = new Set<string>(FORUM_ACCENTS.map((a) => a.value));

const SITE_SELECT =
  'id, slug, name, description, owner_id, is_public, accent_color, member_count, thread_count, created_at, site_mode, template_id, hero_headline, hero_subheadline, currency, whatsapp_number, bank_name, bank_account_number, bank_account_name, payment_instructions, plan_tier, custom_domain, custom_domain_verified, hide_branding, logo_url';

// The public directory never needs payment details; only a store's own page shows them at checkout.
const PUBLIC_LIST_SELECT =
  'id, slug, name, description, owner_id, is_public, accent_color, member_count, thread_count, created_at, site_mode, template_id, hero_headline, hero_subheadline, currency, whatsapp_number';

const MAX_SITES_PER_USER = 5;

async function readVerifiedMap(ids: string[]): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (ids.length === 0) return map;
  const { data, error } = await supabaseAdmin.from('forums').select('id, verified').in('id', ids);
  if (error || !data) return map;
  for (const row of data as { id: string; verified?: boolean }[]) {
    map.set(row.id, !!row.verified);
  }
  return map;
}

const createForumSchema = z.object({
  slug: z.string().min(3).max(32),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  description: z.string().trim().max(300).optional().default(''),
  is_public: z.boolean().optional().default(true),
  accent_color: z.string().optional(),
  template_id: z.string().optional().default('retail-store'),
  site_mode: z.enum(['forum', 'store', 'both']).optional(),
  currency: z.enum(['NGN', 'USD', 'GBP']).optional().default('NGN'),
  whatsapp_number: z.string().trim().max(30).optional().default(''),
  bank_name: z.string().trim().max(80).optional().default(''),
  bank_account_number: z.string().trim().max(30).optional().default(''),
  bank_account_name: z.string().trim().max(80).optional().default(''),
  payment_instructions: z.string().trim().max(400).optional().default(''),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('q') || '').trim();
    const mode = searchParams.get('mode');
    const mineOnly = searchParams.get('mine') === '1' || searchParams.get('mine') === 'true';

    if (mineOnly) {
      const supabase = await createServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ forums: [] });
      }
      const { data, error } = await supabaseAdmin
        .from('forums')
        .select(SITE_SELECT)
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const owned = (data || []).map((r) => ({ ...r, _role: 'owner' as string }));
      const ownedIds = new Set(owned.map((r) => r.id));

      // Include stores/communities where the user is an invited Business-plan staff member
      const userEmail = (user.email || '').toLowerCase().trim();
      const staffFilter = userEmail ? `user_id.eq.${user.id},email.eq.${userEmail}` : `user_id.eq.${user.id}`;
      const { data: staffRows } = await supabaseAdmin
        .from('site_staff')
        .select('site_id, role')
        .or(staffFilter);

      const extraStaff: typeof owned = [];
      if (staffRows && staffRows.length > 0) {
        const roleBySite = new Map<string, string>();
        for (const sr of staffRows) {
          if (!ownedIds.has(sr.site_id)) roleBySite.set(sr.site_id, sr.role);
        }
        const extraIds = Array.from(roleBySite.keys());
        if (extraIds.length > 0) {
          const { data: sharedSites } = await supabaseAdmin
            .from('forums')
            .select(SITE_SELECT)
            .in('id', extraIds);
          for (const row of sharedSites || []) {
            const ext = await readExtendedSite(row.id);
            if (planFor((row as { plan_tier?: string }).plan_tier, ext?.plan_expires_at).staffAccounts) {
              extraStaff.push({ ...row, _role: roleBySite.get(row.id) || 'support' });
            }
          }
        }
      }

      const combined = [...owned, ...extraStaff];
      const verifiedMap = await readVerifiedMap(combined.map((r) => r.id));
      const enriched = combined.map((row) => ({
        ...row,
        my_role: row._role,
        verified: verifiedMap.get(row.id) ?? false,
        custom_domain: (row as Record<string, unknown>).custom_domain ?? null,
        custom_domain_verified: (row as Record<string, unknown>).custom_domain_verified ?? false,
        plan_tier: (row as Record<string, unknown>).plan_tier ?? 'free',
        logo_url: (row as Record<string, unknown>).logo_url ?? '',
        hide_branding: (row as Record<string, unknown>).hide_branding ?? false,
      }));
      return NextResponse.json({ forums: enriched });
    }

    let query = supabaseAdmin
      .from('forums')
      .select(PUBLIC_LIST_SELECT)
      .eq('is_public', true)
      .order('thread_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);

    if (mode === 'store' || mode === 'forum' || mode === 'both') {
      query = query.eq('site_mode', mode);
    }

    // Strip characters that mean something inside a PostgREST filter string, so a search
    // box can never add extra conditions to the query.
    const safeSearch = search.replace(/[,()%*\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (safeSearch) {
      query = query.or(`name.ilike.%${safeSearch}%,slug.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const verifiedMap = await readVerifiedMap((data || []).map((r) => r.id));
    const enriched = (data || []).map((row) => ({
      ...row,
      verified: verifiedMap.get(row.id) ?? false,
      custom_domain: (row as Record<string, unknown>).custom_domain ?? null,
      custom_domain_verified: (row as Record<string, unknown>).custom_domain_verified ?? false,
      plan_tier: (row as Record<string, unknown>).plan_tier ?? 'free',
      logo_url: (row as Record<string, unknown>).logo_url ?? '',
      hide_branding: (row as Record<string, unknown>).hide_branding ?? false,
    }));

    return NextResponse.json(
      { forums: enriched },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load sites';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Please sign in to launch your site.' }, { status: 401 });
    }

    if (overLimit(`site-create:${user.id}`, 5, 60 * 60 * 1000)) {
      return NextResponse.json({ error: 'You are creating sites too quickly. Please try again later.' }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const parsed = createForumSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
    }

    const slug = normalizeForumSlug(parsed.data.slug);
    const slugErr = validateForumSlug(slug);
    if (slugErr) {
      return NextResponse.json({ error: slugErr }, { status: 400 });
    }

    const { count: owned } = await supabaseAdmin
      .from('forums')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id);
    if ((owned ?? 0) >= MAX_SITES_PER_USER) {
      return NextResponse.json({ error: `You can run up to ${MAX_SITES_PER_USER} sites per account.` }, { status: 403 });
    }

    const { data: existing } = await supabaseAdmin
      .from('forums')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: `${slug}.developa.me is already taken.` }, { status: 409 });
    }

    const template = getTemplateById(parsed.data.template_id);
    const siteMode = parsed.data.site_mode || template.site_mode;
    const accent = parsed.data.accent_color && allowedAccents.has(parsed.data.accent_color)
      ? parsed.data.accent_color
      : template.accent_color;

    const { data: created, error: insertErr } = await supabaseAdmin
      .from('forums')
      .insert({
        slug,
        name: xss(parsed.data.name),
        description: xss(parsed.data.description || ''),
        owner_id: user.id,
        is_public: parsed.data.is_public,
        accent_color: accent,
        site_mode: siteMode,
        template_id: template.id,
        hero_headline: template.hero_headline,
        hero_subheadline: template.hero_subheadline,
        currency: parsed.data.currency,
        whatsapp_number: xss(parsed.data.whatsapp_number),
        bank_name: xss(parsed.data.bank_name),
        bank_account_number: xss(parsed.data.bank_account_number),
        bank_account_name: xss(parsed.data.bank_account_name),
        payment_instructions: xss(parsed.data.payment_instructions),
      })
      .select(SITE_SELECT)
      .single();

    if (insertErr || !created) {
      throw insertErr || new Error('Could not create site');
    }

    await supabaseAdmin
      .from('forum_members')
      .upsert({ forum_id: created.id, user_id: user.id, role: 'owner' }, { onConflict: 'forum_id,user_id' });

    // Seed starter products from chosen template
    if (siteMode !== 'forum' && template.sample_products.length > 0) {
      const productRows = template.sample_products.map((p, idx) => ({
        site_id: created.id,
        title: p.title,
        description: p.description,
        category: p.category,
        product_type: p.product_type,
        price: p.price,
        compare_at_price: p.compare_at_price ?? null,
        stock_qty: p.stock_qty ?? null,
        is_active: true,
        sort_order: (idx + 1) * 10,
      }));
      await supabaseAdmin.from('site_products').insert(productRows);
    }

    // Seed welcome thread if template includes one
    if (siteMode !== 'store' && template.sample_thread) {
      await supabaseAdmin.from('forum_threads').insert({
        forum_id: created.id,
        author_id: user.id,
        title: template.sample_thread.title,
        body: template.sample_thread.body,
        is_pinned: true,
      });
    }

    // First site: Pro free for a few days. It lapses on its own (effectiveTier), so nothing has to clean it up.
    let trialDays = 0;
    try {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(user.id);
      const used = (u?.user?.app_metadata as { developa_trial_used?: boolean } | undefined)?.developa_trial_used;
      if (!used) {
        const expires = new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString();
        const { error: trialErr } = await supabaseAdmin
          .from('forums')
          .update({ plan_tier: TRIAL_TIER, plan_expires_at: expires })
          .eq('id', created.id);
        if (!trialErr) {
          trialDays = TRIAL_DAYS;
          await supabaseAdmin.auth.admin.updateUserById(user.id, { app_metadata: { ...(u?.user?.app_metadata || {}), developa_trial_used: true } });
        }
      }
    } catch {
      // A failed trial must never stop the site being created.
    }

    return NextResponse.json({ forum: created, trial_days: trialDays }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create site';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
