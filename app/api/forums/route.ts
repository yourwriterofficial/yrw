import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/forumServer';
import { FORUM_ACCENTS, normalizeForumSlug, validateForumSlug } from '@/lib/forums';
import { getTemplateById } from '@/lib/siteTemplates';

const allowedAccents = new Set<string>(FORUM_ACCENTS.map((a) => a.value));

const SITE_SELECT =
  'id, slug, name, description, owner_id, is_public, accent_color, member_count, thread_count, created_at, site_mode, template_id, hero_headline, hero_subheadline, currency, whatsapp_number, bank_name, bank_account_number, bank_account_name, payment_instructions';

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
      const enriched = (data || []).map((row) => ({
        ...row,
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
      .select(SITE_SELECT)
      .eq('is_public', true)
      .order('thread_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);

    if (mode === 'store' || mode === 'forum' || mode === 'both') {
      query = query.eq('site_mode', mode);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const enriched = (data || []).map((row) => ({
      ...row,
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

    const body = await request.json();
    const parsed = createForumSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
    }

    const slug = normalizeForumSlug(parsed.data.slug);
    const slugErr = validateForumSlug(slug);
    if (slugErr) {
      return NextResponse.json({ error: slugErr }, { status: 400 });
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

    return NextResponse.json({ forum: created }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create site';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
