export const RESERVED_FORUM_SLUGS = new Set([
  'www', 'api', 'app', 'admin', 'auth', 'shop', 'forum', 'forums',
  'mail', 'cdn', 'static', 'assets', 'staging', 'dev', 'developa',
  'support', 'billing', 'docs', 'status', 'blog', 'help', 'dashboard',
  'login', 'register', 'order', 'scripts', 'developer', 'projects', 'create',
]);

export const FORUM_SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;

export const FORUM_ACCENTS = [
  { label: 'Cyan', value: '#06b6d4' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Rose', value: '#f43f5e' },
] as const;

import type { ProductType, SiteMode } from '@/lib/siteTemplates';

export interface ForumSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  owner_id: string;
  is_public: boolean;
  accent_color: string;
  member_count: number;
  thread_count: number;
  created_at: string;
  site_mode?: SiteMode;
  template_id?: string;
  hero_headline?: string;
  hero_subheadline?: string;
  currency?: string;
  whatsapp_number?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_name?: string;
  payment_instructions?: string;
  custom_domain?: string | null;
  custom_domain_verified?: boolean;
  plan_tier?: 'free' | 'pro' | 'business';
  logo_url?: string;
  hide_branding?: boolean;
}

export interface SiteProduct {
  id: string;
  site_id: string;
  title: string;
  description: string;
  category: string;
  product_type: ProductType;
  price: number;
  compare_at_price: number | null;
  image_url: string;
  digital_url: string;
  stock_qty: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface SiteOrderItem {
  product_id: string;
  title: string;
  product_type: ProductType;
  price: number;
  qty: number;
}

export interface SiteOrder {
  id: string;
  order_code: string;
  site_id: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  delivery_address: string;
  notes: string;
  items: SiteOrderItem[];
  subtotal: number;
  total_amount: number;
  payment_method: 'manual_transfer' | 'pay_on_delivery';
  payment_reference: string;
  payment_proof_note: string;
  payment_status: 'pending' | 'proof_submitted' | 'paid' | 'rejected';
  fulfillment_status: 'pending' | 'processing' | 'shipped' | 'completed' | 'cancelled';
  created_at: string;
}

export function formatMoney(amount: number, currency = 'NGN'): string {
  const num = Number(amount || 0);
  if (currency === 'USD') return `$${num.toLocaleString()}`;
  if (currency === 'GBP') return `£${num.toLocaleString()}`;
  return `₦${num.toLocaleString()}`;
}

export interface ForumThread {
  id: string;
  forum_id: string;
  author_id: string;
  author_name?: string;
  title: string;
  body: string;
  is_pinned: boolean;
  is_locked: boolean;
  reply_count: number;
  last_activity_at: string;
  created_at: string;
}

export interface ForumPost {
  id: string;
  thread_id: string;
  forum_id: string;
  author_id: string;
  author_name?: string;
  body: string;
  created_at: string;
}

/**
 * Normalizes a user-supplied forum handle into a valid subdomain candidate.
 */
export function normalizeForumSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 32);
}

export function validateForumSlug(slug: string): string | null {
  if (!FORUM_SLUG_REGEX.test(slug)) {
    return 'Use 3–32 lowercase letters, numbers, or hyphens (cannot start or end with a hyphen).';
  }
  if (RESERVED_FORUM_SLUGS.has(slug)) {
    return `"${slug}" is a reserved subdomain.`;
  }
  return null;
}

/**
 * Extracts `[name]` from `[name].developa.me` or `[name].developa.local`.
 * Returns null for the apex domain (`developa.me`), `www.developa.me`, or unrelated hosts.
 */
export function extractDevelopaSubdomain(hostHeader: string): string | null {
  const host = hostHeader.split(':')[0].toLowerCase().trim();
  for (const base of ['developa.me', 'developa.local']) {
    const suffix = `.${base}`;
    if (host.endsWith(suffix)) {
      const sub = host.slice(0, -suffix.length);
      if (!sub || sub === 'www' || sub.includes('.')) return null;
      return sub;
    }
  }
  return null;
}

/**
 * Builds the canonical URL for a forum: `https://[slug].developa.me` in production
 * on developa.me, or `/forums/[slug]` when browsing on localhost / main domain.
 */
export function getForumHref(slug: string, currentHost?: string): string {
  if (currentHost) {
    const host = currentHost.split(':')[0].toLowerCase();
    if (host === 'developa.me' || host.endsWith('.developa.me')) {
      return `https://${slug}.developa.me`;
    }
    if (host === 'developa.local' || host.endsWith('.developa.local')) {
      const port = currentHost.includes(':') ? `:${currentHost.split(':')[1]}` : '';
      return `http://${slug}.developa.local${port}`;
    }
  }
  return `/forums/${slug}`;
}

export function isCreateSubdomain(hostHeader: string): boolean {
  const host = hostHeader.split(':')[0].toLowerCase().trim();
  return host === 'create.developa.me' || host === 'create.developa.local';
}

export function validateCustomDomain(domain: string): string | null {
  const d = domain.toLowerCase().trim();
  if (!d) return 'Domain cannot be empty.';
  if (d.includes('developa.me') || d.includes('developa.local') || d.includes('yourresearchwriter')) {
    return 'Cannot use developa.me or platform internal domains as a custom domain.';
  }
  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/;
  if (!domainRegex.test(d)) {
    return 'Invalid domain format (e.g. mystore.com or shop.mybrand.ng).';
  }
  return null;
}
