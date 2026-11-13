import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { resolveAuthorNames, supabaseAdmin } from '@/lib/forumServer';

const SITE_SELECT =
  'id, slug, name, description, owner_id, is_public, accent_color, member_count, thread_count, created_at, site_mode, template_id, hero_headline, hero_subheadline, currency, whatsapp_number, bank_name, bank_account_number, bank_account_name, payment_instructions';

const updateForumSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(300).optional(),
  is_public: z.boolean().optional(),
  site_mode: z.enum(['forum', 'store', 'both']).optional(),
  template_id: z.string().trim().max(50).optional(),
  custom_domain: z.union([z.string().trim().max(120), z.null()]).optional(),
  hide_branding: z.boolean().optional(),
  hero_headline: z.string().trim().max(160).optional(),
  hero_subheadline: z.string().trim().max(300).optional(),
  currency: z.enum(['NGN', 'USD', 'GBP']).optional(),
  whatsapp_number: z.string().trim().max(30).optional(),
  bank_name: z.string().trim().max(80).optional(),
  bank_account_number: z.string().trim().max(30).optional(),
  bank_account_name: z.string().trim().max(80).optional(),
  payment_instructions: z.string().trim().max(400).optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const normalized = slug.toLowerCase().trim();

    const { data: forum, error: forumErr } = await supabaseAdmin
      .from('forums')
      .select(SITE_SELECT)
      .eq('slug', normalized)
      .maybeSingle();

    if (forumErr) throw forumErr;
    if (!forum) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    const isOwner = !!user && forum.owner_id === user.id;
    let isMember = isOwner;

    if (user && !isOwner) {
      const { data: memberRow } = await supabaseAdmin
        .from('forum_members')
        .select('role')
        .eq('forum_id', forum.id)
        .eq('user_id', user.id)
        .maybeSingle();
      isMember = !!memberRow;
    }

    if (!forum.is_public && !isMember) {
      return NextResponse.json({ error: 'This site is private.' }, { status: 403 });
    }

    const [threadsRes, productsRes] = await Promise.all([
      forum.site_mode === 'store'
        ? Promise.resolve({ data: [], error: null })
        : supabaseAdmin
            .from('forum_threads')
            .select('id, forum_id, author_id, title, body, is_pinned, is_locked, reply_count, last_activity_at, created_at')
            .eq('forum_id', forum.id)
            .order('is_pinned', { ascending: false })
            .order('last_activity_at', { ascending: false })
            .limit(50),
      forum.site_mode === 'forum'
        ? Promise.resolve({ data: [], error: null })
        : (() => {
            let pq = supabaseAdmin
              .from('site_products')
              .select('id, site_id, title, description, category, product_type, price, compare_at_price, image_url, digital_url, stock_qty, is_active, sort_order, created_at')
              .eq('site_id', forum.id)
              .order('sort_order', { ascending: true })
              .order('created_at', { ascending: false });
            if (!isOwner) pq = pq.eq('is_active', true);
            return pq;
          })(),
    ]);

    if (threadsRes.error) throw threadsRes.error;
    if (productsRes.error) throw productsRes.error;

    const threads = threadsRes.data || [];
    const names = await resolveAuthorNames(threads.map((t) => t.author_id));
    const enrichedThreads = threads.map((t) => ({
      ...t,
      author_name: names.get(t.author_id) || 'Member',
    }));

    const enrichedForum = forum ? {
      ...forum,
      custom_domain: (forum as Record<string, unknown>).custom_domain ?? null,
      custom_domain_verified: (forum as Record<string, unknown>).custom_domain_verified ?? false,
      plan_tier: (forum as Record<string, unknown>).plan_tier ?? 'free',
      logo_url: (forum as Record<string, unknown>).logo_url ?? '',
      hide_branding: (forum as Record<string, unknown>).hide_branding ?? false,
    } : null;

    return NextResponse.json({
      forum: enrichedForum,
      threads: enrichedThreads,
      products: productsRes.data || [],
      isMember,
      isOwner,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load site';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: forum } = await supabaseAdmin
      .from('forums')
      .select('id, owner_id')
      .eq('slug', slug.toLowerCase().trim())
      .maybeSingle();

    if (!forum) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }
    if (forum.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateForumSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const textFields = [
      'name',
      'description',
      'hero_headline',
      'hero_subheadline',
      'whatsapp_number',
      'bank_name',
      'bank_account_number',
      'bank_account_name',
      'payment_instructions',
    ] as const;

    for (const field of textFields) {
      const val = parsed.data[field];
      if (val !== undefined) updates[field] = xss(val);
    }
    if (parsed.data.is_public !== undefined) updates.is_public = parsed.data.is_public;
    if (parsed.data.site_mode !== undefined) updates.site_mode = parsed.data.site_mode;
    if (parsed.data.template_id !== undefined) updates.template_id = parsed.data.template_id;
    if (parsed.data.custom_domain !== undefined) {
      updates.custom_domain = parsed.data.custom_domain ? parsed.data.custom_domain.toLowerCase().trim() : null;
    }
    if (parsed.data.hide_branding !== undefined) updates.hide_branding = parsed.data.hide_branding;
    if (parsed.data.currency !== undefined) updates.currency = parsed.data.currency;

    const { data: updated, error } = await supabaseAdmin
      .from('forums')
      .update(updates)
      .eq('id', forum.id)
      .select(SITE_SELECT)
      .single();

    if (error) throw error;
    return NextResponse.json({ forum: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update site';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
