import { supabaseAdmin, isMissingRelationError } from '@/lib/forumServer';
import { SITE_TEMPLATES as ALL_TEMPLATES } from '@/lib/siteTemplates';
import { SITE_TEMPLATES, templateGroup, type TemplateGroup } from '@/lib/siteTemplates';

/**
 * What each theme costs right now. A theme's default price lives in code (lib/siteTemplates.ts);
 * the founder can override the price, or switch a theme off, from the admin. Server only.
 */

export interface ThemeEntry {
  id: string;
  label: string;
  tagline: string;
  group: TemplateGroup;
  price_ngn: number;
  default_price_ngn: number;
  is_premium: boolean;
  is_active: boolean;
  /** Only set when a signed-in user was asked about. */
  owned?: boolean;
  /** A bank-transfer request for this theme is waiting for the founder. */
  pending?: boolean;
}

interface CatalogRow { template_id: string; price_ngn: number; is_active: boolean }

async function overrides(): Promise<Map<string, CatalogRow>> {
  const { data, error } = await supabaseAdmin.from('theme_catalog').select('template_id, price_ngn, is_active');
  if (error) {
    if (!isMissingRelationError(error)) console.warn('theme_catalog read failed:', error.message);
    return new Map();
  }
  return new Map((data || []).map((r) => [r.template_id as string, r as CatalogRow]));
}

export async function loadCatalog(userId?: string | null): Promise<ThemeEntry[]> {
  const rows = await overrides();
  let owned = new Set<string>();
  let pending = new Set<string>();
  if (userId) {
    const { data } = await supabaseAdmin.from('theme_purchases').select('template_id, status').eq('user_id', userId);
    owned = new Set((data || []).filter((r) => r.status === 'paid').map((r) => r.template_id as string));
    pending = new Set((data || []).filter((r) => r.status === 'pending').map((r) => r.template_id as string));
  }
  return SITE_TEMPLATES.map((t) => {
    const o = rows.get(t.id);
    const price = o ? o.price_ngn : t.price_ngn ?? 0;
    return {
      id: t.id,
      label: t.label,
      tagline: t.tagline,
      group: templateGroup(t),
      price_ngn: price,
      default_price_ngn: t.price_ngn ?? 0,
      is_premium: price > 0,
      is_active: o ? o.is_active : true,
      ...(userId ? { owned: price === 0 || owned.has(t.id), pending: pending.has(t.id) } : {}),
    };
  });
}

/** Can this person use this theme? Free themes always; paid ones once the founder has confirmed payment. */
export async function canUseTheme(userId: string, templateId: string): Promise<{ ok: boolean; reason?: string; price?: number }> {
  if (!ALL_TEMPLATES.some((t) => t.id === templateId)) return { ok: true };   // unknown ids fall back to the default theme
  const { data: profile } = await supabaseAdmin.from('profiles').select('is_admin').eq('id', userId).maybeSingle();
  if (profile?.is_admin === true) return { ok: true };
  const entry = (await loadCatalog(userId)).find((t) => t.id === templateId);
  if (!entry) return { ok: false, reason: 'That theme does not exist.' };
  if (!entry.is_active) return { ok: false, reason: 'That theme is not available right now.' };
  if (entry.price_ngn > 0 && !entry.owned) {
    return { ok: false, reason: `This is a premium theme (₦${entry.price_ngn.toLocaleString('en-NG')}). Buy it first, then use it.`, price: entry.price_ngn };
  }
  return { ok: true };
}
