import { createClient as createServiceClient } from '@supabase/supabase-js';
import { planFor } from '@/lib/plans';

export type SiteRole = 'owner' | 'manager' | 'packer' | 'support';

export const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

type PgErrorLike = { code?: string; message?: string } | null | undefined;

/** Matches both raw Postgres (`42P01`) and PostgREST schema-cache (`PGRST205`) missing-table errors. */
export function isMissingRelationError(err: PgErrorLike): boolean {
  if (!err) return false;
  if (err.code === '42P01' || err.code === 'PGRST205') return true;
  const msg = err.message || '';
  return /relation .* does not exist/i.test(msg) || /Could not find the table .* in the schema cache/i.test(msg);
}

/** Matches both raw Postgres (`42703`) and PostgREST schema-cache (`PGRST204`) missing-column errors. */
export function isMissingColumnError(err: PgErrorLike): boolean {
  if (!err) return false;
  if (err.code === '42703' || err.code === 'PGRST204') return true;
  const msg = err.message || '';
  return /column .* does not exist/i.test(msg) || /Could not find the .* column .* in the schema cache/i.test(msg);
}

/**
 * Batch-resolves display names from `profiles` for a set of user IDs,
 * falling back to `'Member'` when no name is set.
 */
export async function resolveAuthorNames(userIds: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name')
    .in('id', unique);

  for (const row of data || []) {
    if (row.id) {
      map.set(row.id, (row.full_name || '').trim() || 'Member');
    }
  }
  return map;
}

/**
 * Columns added by migration 20261114010000. Reading them is tolerant: until that migration
 * is applied the query errors, and we simply get no extra data instead of breaking the page.
 */
export async function readExtendedSite(siteId: string) {
  const { data } = await supabaseAdmin
    .from('forums')
    .select('plan_expires_at, domain_verify_token, domain_checked_at, announcement, announcement_active')
    .eq('id', siteId)
    .maybeSingle();
  return (data as {
    plan_expires_at: string | null;
    domain_verify_token: string | null;
    domain_checked_at: string | null;
    announcement: string;
    announcement_active: boolean;
  } | null) ?? null;
}

/**
 * Columns added by migration 20261114030000 & 20261114040000. Tolerant: returns safe defaults
 * if those migrations are not applied yet.
 */
export async function readSiteTools(siteId: string) {
  const { data } = await supabaseAdmin
    .from('forums')
    .select('page_about, page_delivery, page_returns, page_contact_note, social_links, pickup_address, summary_email, verified, verified_at')
    .eq('id', siteId)
    .maybeSingle();
  const { data: gData } = await supabaseAdmin
    .from('forums')
    .select('weekly_backup_email')
    .eq('id', siteId)
    .maybeSingle();
  return {
    page_about: (data?.page_about as string) || '',
    page_delivery: (data?.page_delivery as string) || '',
    page_returns: (data?.page_returns as string) || '',
    page_contact_note: (data?.page_contact_note as string) || '',
    social_links: (data?.social_links as Record<string, string>) || {},
    pickup_address: (data?.pickup_address as string) || '',
    summary_email: typeof data?.summary_email === 'boolean' ? data.summary_email : true,
    verified: data?.verified === true,
    verified_at: (data?.verified_at as string | null) ?? null,
    weekly_backup_email: gData?.weekly_backup_email === true,
  };
}

/**
 * True when this account's email address has been confirmed. A staff invite is matched by email,
 * so without this an attacker could sign up with a victim's address (when email confirmation is
 * off, or via a provider that does not verify) and inherit their staff role.
 */
async function emailIsConfirmed(userId: string): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    return !!(data?.user?.email_confirmed_at || (data?.user as { confirmed_at?: string } | undefined)?.confirmed_at);
  } catch {
    return false;
  }
}

/**
 * Resolves the signed-in user and verifies they are the owner or an authorized staff member
 * for the site. Staff access requires the Business plan.
 */
export async function requireSiteAccess(slug: string, allowedRoles: SiteRole[] = ['owner', 'manager']) {
  const { createClient: createServerClient } = await import('@/lib/supabase/server');
  const { NextResponse } = await import('next/server');
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Please sign in.' }, { status: 401 }) } as const;

  const { data: site } = await supabaseAdmin
    .from('forums')
    .select('id, slug, owner_id, name, plan_tier, custom_domain, custom_domain_verified, hide_branding')
    .eq('slug', slug.toLowerCase().trim())
    .maybeSingle();

  if (!site) return { error: NextResponse.json({ error: 'Site not found' }, { status: 404 }) } as const;
  const ext = await readExtendedSite(site.id);
  const fullSite = { ...site, ...(ext || {}) };

  if (site.owner_id === user.id) {
    return { user, role: 'owner' as SiteRole, site: fullSite } as const;
  }

  const plan = planFor(site.plan_tier, ext?.plan_expires_at);
  if (!plan.staffAccounts) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) } as const;
  }

  // Look up staff membership by user_id or invited email (tolerant if migration not applied).
  const userEmail = (user.email || '').toLowerCase().trim();
  let staffRow: { id: string; role: string; user_id: string | null } | null = null;
  const { data: byUid } = await supabaseAdmin
    .from('site_staff')
    .select('id, role, user_id')
    .eq('site_id', site.id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (byUid) {
    staffRow = byUid;
  } else if (userEmail && (await emailIsConfirmed(user.id))) {
    const { data: byEmail } = await supabaseAdmin
      .from('site_staff')
      .select('id, role, user_id')
      .eq('site_id', site.id)
      .eq('email', userEmail)
      .maybeSingle();
    if (byEmail) {
      staffRow = byEmail;
      if (!byEmail.user_id) {
        await supabaseAdmin.from('site_staff').update({ user_id: user.id }).eq('id', byEmail.id);
      }
    }
  }

  const staffRole = staffRow?.role as SiteRole | undefined;
  if (!staffRole || !allowedRoles.includes(staffRole)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) } as const;
  }

  return { user, role: staffRole, site: fullSite } as const;
}

/** Resolves a signed-in user's role on a site (`owner`, staff role, or null) without HTTP responses. */
export async function resolveUserSiteRole(
  siteId: string,
  ownerId: string,
  planTier: string | null | undefined,
  planExpiresAt: string | null | undefined,
  userId: string | undefined,
  userEmail: string | undefined
): Promise<SiteRole | null> {
  if (!userId) return null;
  if (ownerId === userId) return 'owner';
  if (!planFor(planTier, planExpiresAt).staffAccounts) return null;

  const { data: byUid } = await supabaseAdmin
    .from('site_staff')
    .select('id, role')
    .eq('site_id', siteId)
    .eq('user_id', userId)
    .maybeSingle();
  if (byUid?.role) return byUid.role as SiteRole;

  const email = (userEmail || '').toLowerCase().trim();
  if (!email || !(await emailIsConfirmed(userId))) return null;
  const { data: byEmail } = await supabaseAdmin
    .from('site_staff')
    .select('id, role, user_id')
    .eq('site_id', siteId)
    .eq('email', email)
    .maybeSingle();
  if (byEmail?.role) {
    if (!byEmail.user_id) {
      await supabaseAdmin.from('site_staff').update({ user_id: userId }).eq('id', byEmail.id);
    }
    return byEmail.role as SiteRole;
  }
  return null;
}

/** Resolves the signed-in user and the site they OWN, or an error response. Pass `allowedRoles` to let staff in too. */
export async function requireOwnedSite(slug: string, allowedRoles: SiteRole[] = ['owner']) {
  return requireSiteAccess(slug, allowedRoles);
}

/** True when the signed-in user is a platform admin (the founder side). */
export async function isPlatformAdmin(): Promise<boolean> {
  const { createClient: createServerClient } = await import('@/lib/supabase/server');
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabaseAdmin.from('profiles').select('is_admin').eq('id', user.id).single();
  return profile?.is_admin === true;
}

/** Download links for the digital items in an order. Only call this once the order is paid. */
export async function downloadsForOrder(
  siteId: string,
  items: { product_id?: string | number }[] | null | undefined
): Promise<{ title: string; url: string }[]> {
  const ids = (items || []).map((i) => i.product_id).filter(Boolean) as (string | number)[];
  if (ids.length === 0) return [];
  const { data } = await supabaseAdmin
    .from('site_products')
    .select('id, title, product_type, digital_url')
    .eq('site_id', siteId)
    .in('id', ids);
  return (data || [])
    .filter((p) => p.product_type === 'digital' && p.digital_url)
    .map((p) => ({ title: p.title as string, url: p.digital_url as string }));
}

/** Search-appearance columns from migration 20261114020000. Tolerant: returns blanks until it is applied. */
export async function readSeo(siteId: string): Promise<{ seo_title: string; seo_description: string }> {
  const { data } = await supabaseAdmin.from('forums').select('seo_title, seo_description').eq('id', siteId).maybeSingle();
  return { seo_title: (data?.seo_title as string) || '', seo_description: (data?.seo_description as string) || '' };
}

/**
 * Changes stock by `delta` (negative to take stock, positive to give it back) on either a
 * product variant (when `variantId` is provided) or the parent product.
 * Unlimited stock (`null`) is left alone. Uses an atomic conditional update so two buyers
 * can never both take the last item.
 */
export async function adjustStock(
  siteId: string,
  productId: string | number,
  delta: number,
  variantId?: string | null
): Promise<boolean> {
  if (variantId) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const { data: row } = await supabaseAdmin
        .from('site_product_variants')
        .select('stock_qty')
        .eq('id', variantId)
        .eq('product_id', productId)
        .eq('site_id', siteId)
        .maybeSingle();
      if (!row) return false;
      if (row.stock_qty === null) return true;
      const next = Number(row.stock_qty) + delta;
      if (next < 0) return false;
      const { data: updated } = await supabaseAdmin
        .from('site_products')
        .update({ stock_qty: next })
        .eq('id', productId)
        .eq('site_id', siteId)
        .eq('stock_qty', row.stock_qty)
        .select('id');
      if (updated && updated.length > 0) {
        if (delta < 0) maybeAlertLowStock(siteId, productId, next).catch(() => {});
        return true;
      }
    }
    return false;
  }

  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: row } = await supabaseAdmin
      .from('site_products')
      .select('stock_qty')
      .eq('id', productId)
      .eq('site_id', siteId)
      .maybeSingle();
    if (!row) return false;
    if (row.stock_qty === null) return true;
    const next = Number(row.stock_qty) + delta;
    if (next < 0) return false;
    const { data: updated } = await supabaseAdmin
      .from('site_products')
      .update({ stock_qty: next })
      .eq('id', productId)
      .eq('site_id', siteId)
      .eq('stock_qty', row.stock_qty)
      .select('id');
    if (updated && updated.length > 0) {
      if (delta < 0) maybeAlertLowStock(siteId, productId, next).catch(() => {});
      return true;
    }
  }
  return false;
}

async function maybeAlertLowStock(siteId: string, productId: string | number, currentQty: number) {
  const { data: prod } = await supabaseAdmin
    .from('site_products')
    .select('id, title, low_stock_at, low_stock_alerted_at')
    .eq('id', productId)
    .eq('site_id', siteId)
    .maybeSingle();
  if (!prod) return;
  const threshold = Number((prod as { low_stock_at?: number }).low_stock_at ?? 3);
  if (currentQty > threshold) return;
  const lastAlert = (prod as { low_stock_alerted_at?: string | null }).low_stock_alerted_at;
  if (lastAlert && Date.now() - new Date(lastAlert).getTime() < 24 * 60 * 60 * 1000) return;

  const { data: site } = await supabaseAdmin
    .from('forums')
    .select('id, slug, name, owner_id, plan_tier')
    .eq('id', siteId)
    .maybeSingle();
  if (!site) return;

  const [ext, tools] = await Promise.all([readExtendedSite(siteId), readSiteTools(siteId)]);
  const plan = planFor(site.plan_tier, ext?.plan_expires_at);
  if (!plan.lowStockAlerts || !tools.summary_email) return;

  const { data: ownerData } = await supabaseAdmin.auth.admin.getUserById(site.owner_id);
  const to = ownerData?.user?.email;
  if (!to) return;

  const { sendSystemEmail } = await import('@/lib/emailService');
  const { emailShell } = await import('@/lib/emailTemplates');
  const { siteUrl } = await import('@/lib/siteUrl');
  const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const url = `${siteUrl()}/developer/manage?slug=${encodeURIComponent(site.slug)}&tab=products`;
  const sent = await sendSystemEmail({
    to,
    subject: `${site.name}: low stock on "${prod.title}" (${currentQty} left)`,
    html: emailShell(
      `<h2>Low stock alert</h2><p><strong>${esc(prod.title)}</strong> on <strong>${esc(site.name)}</strong> now has <strong>${currentQty}</strong> left in stock.</p>`,
      'Update inventory',
      url,
      'developa'
    ),
  }).catch(() => false);
  if (sent) {
    await supabaseAdmin
      .from('site_products')
      .update({ low_stock_alerted_at: new Date().toISOString() })
      .eq('id', productId);
  }
}

/** Takes stock for every item (variant or product), or none: rolls back on failure. */
export async function reserveStock(
  siteId: string,
  items: { product_id: string | number; variant_id?: string | null; qty: number; title?: string }[]
) {
  const taken: { product_id: string | number; variant_id?: string | null; qty: number }[] = [];
  for (const it of items) {
    const ok = await adjustStock(siteId, it.product_id, -it.qty, it.variant_id);
    if (!ok) {
      for (const t of taken) await adjustStock(siteId, t.product_id, t.qty, t.variant_id);
      return { ok: false as const, title: it.title };
    }
    taken.push({ product_id: it.product_id, variant_id: it.variant_id, qty: it.qty });
  }
  return { ok: true as const };
}

export async function releaseStock(
  siteId: string,
  items: { product_id: string | number; variant_id?: string | null; qty: number }[]
) {
  for (const it of items) await adjustStock(siteId, it.product_id, it.qty, it.variant_id);
}
