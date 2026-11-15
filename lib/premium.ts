import { SITE_TEMPLATES, getTemplateById, type SiteTemplate } from '@/lib/siteTemplates';

/**
 * What "premium" means. A theme is premium when its price is above zero (default prices live in
 * lib/siteTemplates.ts; the founder can override them in the admin). Premium themes switch on extra
 * storefront and community features that free themes do not have. Free themes keep everything they had.
 */

export type ThemeTier = 'free' | 'plus' | 'pro' | 'signature';

export const TIER_LABEL: Record<ThemeTier, string> = { free: 'Free', plus: 'Plus', pro: 'Pro', signature: 'Signature' };

/** Plus: specialty looks. Pro: media and community layouts. Signature: the full premium experience. */
export function tierForPrice(price: number): ThemeTier {
  if (price <= 0) return 'free';
  if (price <= 4000) return 'plus';
  if (price <= 5000) return 'pro';
  return 'signature';
}

export interface Perk { id: string; label: string; detail: string; for: 'store' | 'forum' | 'both' }

export const PREMIUM_PERKS: Perk[] = [
  { id: 'rails', label: 'Best sellers and new arrivals', detail: 'Two ready-made rails that surface what is popular and what is fresh, with no setup.', for: 'store' },
  { id: 'wishlist', label: 'Wishlist hearts', detail: 'Shoppers save favourites on their phone and come back to them.', for: 'store' },
  { id: 'recent', label: 'Recently viewed', detail: 'Reminds visitors of items they looked at, so they finish the purchase.', for: 'store' },
  { id: 'cartbar', label: 'Sticky cart bar', detail: 'A floating bar with item count and total, so checkout is always one tap away.', for: 'store' },
  { id: 'trending', label: 'Trending now', detail: 'Automatically highlights the most discussed posts.', for: 'forum' },
  { id: 'whatsapp', label: 'Floating WhatsApp button', detail: 'One tap to chat with you from any page.', for: 'both' },
  { id: 'polish', label: 'Smooth reveal animations', detail: 'Sections fade in as visitors scroll, so the site feels finished.', for: 'both' },
  { id: 'totop', label: 'Back to top', detail: 'A quiet shortcut on long pages.', for: 'both' },
];

export function perksFor(t: Pick<SiteTemplate, 'site_mode'>): Perk[] {
  return PREMIUM_PERKS.filter((p) => (t.site_mode === 'forum' ? p.for !== 'store' : t.site_mode === 'store' ? p.for !== 'forum' : true));
}

export const isPremiumTemplate = (templateId?: string | null): boolean => (getTemplateById(templateId ?? '').price_ngn ?? 0) > 0;
export const premiumCount = () => SITE_TEMPLATES.filter((t) => (t.price_ngn ?? 0) > 0).length;
