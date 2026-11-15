import { planFor, effectiveTier, PLANS } from '@/lib/plans';
import { canUseTheme } from '@/lib/themeCatalog';
import { getSiteState, isSiteBlocked } from '@/lib/adminState';
import { readPluginSettings } from '@/lib/pluginsServer';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import xss from 'xss';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { resolveAuthorNames, resolveUserSiteRole, requireSiteAccess, isPlatformAdmin, supabaseAdmin, readExtendedSite, type SiteRole, readSeo, readSiteTools } from '@/lib/forumServer';

const SITE_SELECT =
  'id, slug, name, description, owner_id, is_public, accent_color, member_count, thread_count, created_at, site_mode, template_id, hero_headline, hero_subheadline, currency, whatsapp_number, bank_name, bank_account_number, bank_account_name, payment_instructions, plan_tier, custom_domain, custom_domain_verified, hide_branding, logo_url';

const socialLinksSchema = z.object({
  instagram: z.string().trim().max(200).optional(),
  tiktok: z.string().trim().max(200).optional(),
  facebook: z.string().trim().max(200).optional(),
  x: z.string().trim().max(200).optional(),
  youtube: z.string().trim().max(200).optional(),
  website: z.string().trim().max(200).optional(),
}).optional();

function normalizeSocialUrl(platform: keyof NonNullable<z.infer<typeof socialLinksSchema>>, raw?: string): string {
  const val = (raw || '').trim();
  if (!val) return '';
  if (/^https:\/\//i.test(val)) {
    try {
      const u = new URL(val);
      return u.protocol === 'https:' ? u.toString() : '';
    } catch {
      return '';
    }
  }
  if (/^[a-z]+:/i.test(val) || /\s/.test(val)) return '';
  const handle = val.replace(/^@+/, '').replace(/^\/+/, '');
  if (!handle) return '';
  switch (platform) {
    case 'instagram': return `https://instagram.com/${handle}`;
    case 'tiktok': return `https://tiktok.com/@${handle}`;
    case 'facebook': return `https://facebook.com/${handle}`;
    case 'x': return `https://x.com/${handle}`;
    case 'youtube': return `https://youtube.com/@${handle}`;
    case 'website': return handle.includes('.') ? `https://${handle}` : '';
  }
}

const updateForumSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(300).optional(),
  is_public: z.boolean().optional(),
  site_mode: z.enum(['forum', 'store', 'both']).optional(),
  template_id: z.string().trim().max(50).optional(),
  announcement: z.string().trim().max(200).optional(),
  seo_title: z.string().trim().max(70).optional(),
  seo_description: z.string().trim().max(170).optional(),
  announcement_active: z.boolean().optional(),
  accent_color: z.string().trim().max(9).optional(),
  logo_url: z.string().trim().max(500).optional(),
  hide_branding: z.boolean().optional(),
  hero_headline: z.string().trim().max(160).optional(),
  hero_subheadline: z.string().trim().max(300).optional(),
  currency: z.enum(['NGN', 'USD', 'GBP']).optional(),
  whatsapp_number: z.string().trim().max(30).optional(),
  bank_name: z.string().trim().max(80).optional(),
  bank_account_number: z.string().trim().max(30).optional(),
  bank_account_name: z.string().trim().max(80).optional(),
  payment_instructions: z.string().trim().max(400).optional(),
  page_about: z.string().trim().max(3000).optional(),
  page_delivery: z.string().trim().max(3000).optional(),
  page_returns: z.string().trim().max(3000).optional(),
  page_contact_note: z.string().trim().max(3000).optional(),
  pickup_address: z.string().trim().max(400).optional(),
  summary_email: z.boolean().optional(),
  weekly_backup_email: z.boolean().optional(),
  social_links: socialLinksSchema,
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const normalized = slug.toLowerCase().trim();

    // The site lookup and the sign-in check do not depend on each other, so they run together.
    const [forumRes, authRes] = await Promise.all([
      supabaseAdmin.from('forums').select(SITE_SELECT).eq('slug', normalized).maybeSingle(),
      createServerClient().then((c) => c.auth.getUser()),
    ]);
    const { data: forum, error: forumErr } = forumRes;

    if (forumErr) throw forumErr;
    if (!forum) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    const user = authRes.data.user;
    const isOwner = !!user && forum.owner_id === user.id;

    const hasCatalog = forum.site_mode !== 'forum';
    const wantsThreads = forum.site_mode !== 'store';

    // The posts, products and membership lookups only depend on whether the viewer manages the catalogue.
    const startCatalog = (role: SiteRole | null) => {
      const canManage = role === 'owner' || role === 'manager';
      return Promise.all([
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
                // digital_url is the paid download. Only the owner gets it here; buyers get it from
                // their paid order (see the orders endpoint).
                .select(
                  canManage
                    ? 'id, site_id, title, description, category, product_type, price, compare_at_price, image_url, digital_url, stock_qty, is_active, sort_order, created_at'
                    : 'id, site_id, title, description, category, product_type, price, compare_at_price, image_url, stock_qty, is_active, sort_order, created_at'
                )
                .eq('site_id', forum.id)
                .order('sort_order', { ascending: true })
                .order('created_at', { ascending: false });
              if (!canManage) pq = pq.eq('is_active', true);
              return pq;
            })(),
        hasCatalog
          ? (() => {
              let vq = supabaseAdmin
                .from('site_product_variants')
                .select('id, site_id, product_id, label, options, price, stock_qty, sku, sort_order, is_active')
                .eq('site_id', forum.id)
                .order('sort_order', { ascending: true });
              if (!canManage) vq = vq.eq('is_active', true);
              return vq;
            })()
          : Promise.resolve({ data: null }),
        user && !role
          ? supabaseAdmin.from('forum_members').select('role').eq('forum_id', forum.id).eq('user_id', user.id).maybeSingle()
          : Promise.resolve({ data: null }),
        wantsThreads
          ? supabaseAdmin.from('forum_threads').select('id, is_members_only').eq('forum_id', forum.id)
          : Promise.resolve({ data: null }),
        wantsThreads && user && !role
          ? supabaseAdmin.from('site_memberships').select('id, expires_at').eq('site_id', forum.id).eq('user_id', user.id).eq('status', 'active').maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
    };

    // Anonymous visitors and the owner are known right away, so their catalogue queries start now, alongside the
    // lookups below. Anyone else (a signed-in buyer or staff member) needs the plan date first to work out their role.
    let myRole: SiteRole | null | undefined = !user ? null : isOwner ? 'owner' : undefined;
    let catalogPromise = myRole !== undefined ? startCatalog(myRole) : null;

    // Everything else needs only the site id, so it is fetched in one go instead of one query after another.
    const [adminState, extEarly, pluginSettings, payRowRes, seo, tools, extraProdRes, reviewsRes, shippingZonesRes, adRowsRes, modRes] = await Promise.all([
      getSiteState(forum.id),
      readExtendedSite(forum.id),
      readPluginSettings(forum.id),
      supabaseAdmin.from('forums').select('paystack_subaccount_code').eq('id', forum.id).maybeSingle(),
      readSeo(forum.id),
      readSiteTools(forum.id),
      hasCatalog
        ? supabaseAdmin.from('site_products').select('id, image_urls, variant_options, low_stock_at').eq('site_id', forum.id)
        : Promise.resolve({ data: null }),
      hasCatalog
        ? supabaseAdmin.from('site_reviews').select('product_id, rating').eq('site_id', forum.id).eq('is_visible', true)
        : Promise.resolve({ data: null }),
      hasCatalog
        ? supabaseAdmin.from('site_shipping_zones').select('id, name, states, fee, free_over, is_active').eq('site_id', forum.id).eq('is_active', true).order('created_at', { ascending: true })
        : Promise.resolve({ data: null }),
      supabaseAdmin
        .from('platform_site_ads')
        .select('*')
        .eq('is_active', true)
        .or(`target_site_id.is.null,target_site_id.eq.${forum.id}`),
      // Items the platform took down. If the table is not there yet the lookup just returns nothing.
      supabaseAdmin.from('site_moderation').select('item_type, item_id').eq('site_id', forum.id),
    ]);
    const removedIds = new Set((modRes.data || []).map((r) => r.item_id as string));

    if (isSiteBlocked(adminState) && !isOwner && !(await isPlatformAdmin())) {
      void catalogPromise?.catch(() => undefined);
      return NextResponse.json({ error: 'This site is not available right now.', unavailable: true }, { status: 404 });
    }
    if (myRole === undefined) {
      myRole = await resolveUserSiteRole(
        forum.id,
        forum.owner_id,
        forum.plan_tier,
        extEarly?.plan_expires_at,
        user?.id,
        user?.email
      );
      catalogPromise = startCatalog(myRole);
    }
    const canManageCatalog = myRole === 'owner' || myRole === 'manager';
    const [threadsRes, productsRes, variantsRes, memberRes, moRes, memShipRes] = await catalogPromise!;

    if (threadsRes.error) throw threadsRes.error;
    if (productsRes.error) throw productsRes.error;

    const isMember = !!myRole || !!memberRes.data;
    if (!forum.is_public && !isMember) {
      return NextResponse.json({ error: 'This site is private.' }, { status: 403 });
    }

    const threads = (threadsRes.data || []).filter((t) => isOwner || !removedIds.has(t.id));
    const namesPromise = resolveAuthorNames(threads.map((t) => t.author_id));

    const membersOnlyMap = new Map<string, boolean>();
    let hasActivePaidMembership = !!myRole;
    if (wantsThreads && threads.length > 0) {
      if (moRes.data) {
        for (const r of moRes.data as { id: string; is_members_only?: boolean }[]) {
          membersOnlyMap.set(r.id, !!r.is_members_only);
        }
      }
      if (memShipRes.data) {
        const exp = (memShipRes.data as { expires_at?: string | null }).expires_at;
        hasActivePaidMembership = !exp || new Date(exp).getTime() > Date.now();
      }
    }

    const names = await namesPromise;
    const enrichedThreads = threads.map((t) => {
      const isMembersOnly = membersOnlyMap.get(t.id) ?? false;
      const lockedForViewer = isMembersOnly && !hasActivePaidMembership;
      return {
        ...t,
        is_members_only: isMembersOnly,
        body: lockedForViewer ? 'Members-only discussion. Join a paid membership to read and reply.' : t.body,
        author_name: names.get(t.author_id) || 'Member',
      };
    });

    // New-migration data, read tolerantly so stores keep working before it is applied.
    const ext = extEarly;
    const prodExtraMap = new Map<string, { image_urls?: string[]; variant_options?: string[]; low_stock_at?: number }>();
    for (const row of (extraProdRes.data as { id: string; image_urls?: string[]; variant_options?: string[]; low_stock_at?: number }[] | null) || []) {
      prodExtraMap.set(row.id, row);
    }
    const variantsByProd = new Map<string, unknown[]>();
    for (const v of (variantsRes.data as { product_id: string }[] | null) || []) {
      const list = variantsByProd.get(v.product_id) || [];
      list.push(v);
      variantsByProd.set(v.product_id, list);
    }
    const ratingsByProd = new Map<string, { sum: number; count: number }>();
    for (const rv of (reviewsRes.data as { product_id: string; rating: number }[] | null) || []) {
      const prev = ratingsByProd.get(rv.product_id) || { sum: 0, count: 0 };
      prev.sum += Number(rv.rating) || 0;
      prev.count += 1;
      ratingsByProd.set(rv.product_id, prev);
    }

    const enrichedProducts = (productsRes.data || []).filter((p) => canManageCatalog || !removedIds.has((p as unknown as { id: string }).id)).map((p) => {
      const prod = p as unknown as { id: string; image_url?: string };
      const extra = prodExtraMap.get(prod.id);
      const urls = extra?.image_urls && extra.image_urls.length > 0
        ? extra.image_urls
        : prod.image_url ? [prod.image_url] : [];
      const rStat = ratingsByProd.get(prod.id);
      return {
        ...prod,
        image_urls: urls,
        admin_removed: removedIds.has(prod.id),
        variant_options: extra?.variant_options || [],
        variants: variantsByProd.get(prod.id) || [],
        low_stock_at: extra?.low_stock_at ?? 3,
        rating_count: rStat?.count || 0,
        rating_avg: rStat && rStat.count > 0 ? Math.round((rStat.sum / rStat.count) * 10) / 10 : undefined,
      };
    });

    const tier = effectiveTier((forum as Record<string, unknown>).plan_tier as string, ext?.plan_expires_at);
    // Platform ads reach the plans the admin aimed them at. Older ads (no plan list) keep the old rule: plans that do not hide platform ads.
    const nowIso = new Date().toISOString();
    const ads: unknown[] = (adRowsRes.data || [])
      .filter((a) => (!a.starts_at || a.starts_at <= nowIso) && (!a.ends_at || a.ends_at >= nowIso))
      .filter((a) => (Array.isArray(a.target_tiers) && a.target_tiers.length ? a.target_tiers.includes(tier) : !PLANS[tier].hidesPlatformAds))
      .map((a) => ({ id: a.id, title: a.title, body: a.body, link_url: a.link_url, image_url: a.image_url, placement: a.placement, target_site_id: a.target_site_id, starts_at: a.starts_at, ends_at: a.ends_at }));

    // Buyers only need to know whether online payment is ready, never the seller's subaccount code.
    const payRow = payRowRes.data;
    const enrichedForum = forum ? {
      ...forum,
      seo_title: seo.seo_title,
      seo_description: seo.seo_description,
      announcement: ext?.announcement ?? '',
      announcement_active: ext?.announcement_active ?? false,
      // The plan end date is for the owner and their staff only; visitors only need the effective plan below.
      ...(myRole ? { plan_expires_at: ext?.plan_expires_at ?? null } : {}),
      plan_effective: tier,
      plugins: pluginSettings,
      page_about: tools.page_about,
      page_delivery: tools.page_delivery,
      page_returns: tools.page_returns,
      page_contact_note: tools.page_contact_note,
      social_links: tools.social_links,
      pickup_address: tools.pickup_address,
      shipping_zones: PLANS[tier].shippingZones ? (shippingZonesRes.data || []) : [],
      summary_email: tools.summary_email,
      weekly_backup_email: tools.weekly_backup_email,
      verified: tools.verified,
      verified_at: tools.verified_at,
      ...(myRole ? { my_role: myRole } : {}),
      custom_domain: (forum as Record<string, unknown>).custom_domain ?? null,
      custom_domain_verified: (forum as Record<string, unknown>).custom_domain_verified ?? false,
      plan_tier: (forum as Record<string, unknown>).plan_tier ?? 'free',
      online_payments_ready: !!payRow?.paystack_subaccount_code,
      logo_url: (forum as Record<string, unknown>).logo_url ?? '',
      hide_branding: (forum as Record<string, unknown>).hide_branding ?? false,
    } : null;

    return NextResponse.json({
      forum: enrichedForum,
      threads: enrichedThreads,
      products: enrichedProducts,
      ads,
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
    const access = await requireSiteAccess(slug, ['owner', 'manager']);
    if ('error' in access) return access.error;
    const forum = access.site;
    const extra = forum;

    const body = await request.json().catch(() => null);
    const parsed = updateForumSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
    }

    // A manager runs the shop day to day, but must not be able to redirect the money or change what
    // the site is. These fields stay with the owner.
    const OWNER_ONLY = ['bank_name', 'bank_account_number', 'bank_account_name', 'payment_instructions', 'currency', 'is_public', 'site_mode', 'template_id', 'hide_branding'] as const;
    if (access.role !== 'owner') {
      // The settings form sends every field on each save, so only a field that really CHANGES is blocked.
      const { data: current } = await supabaseAdmin.from('forums').select(OWNER_ONLY.join(', ')).eq('id', forum.id).maybeSingle();
      const now = (current || {}) as unknown as Record<string, unknown>;
      const changed = OWNER_ONLY.filter((k) => {
        const incoming = (parsed.data as Record<string, unknown>)[k];
        if (incoming === undefined) return false;
        const normalised = typeof incoming === 'string' ? xss(incoming) : incoming;
        return String(normalised ?? '') !== String(now[k] ?? '');
      });
      if (changed.length > 0) {
        return NextResponse.json({ error: 'Only the site owner can change payment details, visibility and the site type.' }, { status: 403 });
      }
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
    if (parsed.data.template_id !== undefined) {
      const { data: current } = await supabaseAdmin.from('forums').select('template_id').eq('id', forum.id).maybeSingle();
      if (current?.template_id !== parsed.data.template_id) {
        const themeCheck = await canUseTheme(access.user.id, parsed.data.template_id);
        if (!themeCheck.ok) return NextResponse.json({ error: themeCheck.reason }, { status: 402 });
      }
      updates.template_id = parsed.data.template_id;
    }
    // Custom domains are managed through /domain (they must be DNS-verified), not here.
    if (parsed.data.hide_branding !== undefined) {
      const plan = planFor(forum.plan_tier, (extra as { plan_expires_at?: string | null } | null)?.plan_expires_at);
      if (parsed.data.hide_branding && !plan.hideBranding) {
        return NextResponse.json({ error: 'Removing the "Powered by Developa" badge needs the Pro plan.' }, { status: 403 });
      }
      updates.hide_branding = parsed.data.hide_branding;
    }
    if (parsed.data.accent_color !== undefined && /^#[0-9a-fA-F]{6}$/.test(parsed.data.accent_color)) updates.accent_color = parsed.data.accent_color;
    if (parsed.data.logo_url !== undefined) updates.logo_url = /^https:\/\//.test(parsed.data.logo_url) || parsed.data.logo_url === '' ? parsed.data.logo_url : undefined;
    if (parsed.data.seo_title !== undefined || parsed.data.seo_description !== undefined) {
      const seo: Record<string, string> = {};
      if (parsed.data.seo_title !== undefined) seo.seo_title = xss(parsed.data.seo_title);
      if (parsed.data.seo_description !== undefined) seo.seo_description = xss(parsed.data.seo_description);
      const { error: seoErr } = await supabaseAdmin.from('forums').update(seo).eq('id', forum.id);
      if (seoErr) return NextResponse.json({ error: 'Search appearance needs the latest database update first.' }, { status: 503 });
    }
    if (parsed.data.announcement !== undefined || parsed.data.announcement_active !== undefined) {
      const ann: Record<string, unknown> = {};
      if (parsed.data.announcement !== undefined) ann.announcement = xss(parsed.data.announcement);
      if (parsed.data.announcement_active !== undefined) ann.announcement_active = parsed.data.announcement_active;
      const { error: annErr } = await supabaseAdmin.from('forums').update(ann).eq('id', forum.id);
      if (annErr) return NextResponse.json({ error: 'The announcement bar needs the latest database update first.' }, { status: 503 });
    }
    if (parsed.data.currency !== undefined) updates.currency = parsed.data.currency;

    const toolUpdates: Record<string, unknown> = {};
    for (const k of ['page_about', 'page_delivery', 'page_returns', 'page_contact_note', 'pickup_address'] as const) {
      if (parsed.data[k] !== undefined) toolUpdates[k] = xss(parsed.data[k]!);
    }
    if (parsed.data.summary_email !== undefined) toolUpdates.summary_email = parsed.data.summary_email;
    if (parsed.data.weekly_backup_email !== undefined) toolUpdates.weekly_backup_email = parsed.data.weekly_backup_email;
    if (parsed.data.social_links !== undefined) {
      const cleanedLinks: Record<string, string> = {};
      for (const platform of ['instagram', 'tiktok', 'facebook', 'x', 'youtube', 'website'] as const) {
        const normalizedUrl = normalizeSocialUrl(platform, parsed.data.social_links[platform]);
        if (normalizedUrl) cleanedLinks[platform] = normalizedUrl;
      }
      toolUpdates.social_links = cleanedLinks;
    }
    if (Object.keys(toolUpdates).length > 0) {
      const { error: toolErr } = await supabaseAdmin.from('forums').update(toolUpdates).eq('id', forum.id);
      if (toolErr) {
        return NextResponse.json({ error: 'Store pages and social links need the latest database update first.' }, { status: 503 });
      }
    }

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
