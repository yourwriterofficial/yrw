import type { SiteSocialLinks } from '@/lib/forums';
import type { SiteRole } from '@/lib/forumServer';

export interface Site {
  id: string;
  slug: string;
  name: string;
  description: string;
  owner_id: string;
  is_public: boolean;
  accent_color: string;
  member_count: number;
  thread_count: number;
  site_mode: 'forum' | 'store' | 'both';
  currency: 'NGN' | 'USD' | 'GBP';
  whatsapp_number?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_name?: string;
  payment_instructions?: string;
  hero_headline?: string;
  hero_subheadline?: string;
  plan_tier: 'free' | 'pro' | 'business';
  plan_expires_at?: string | null;
  custom_domain?: string | null;
  custom_domain_verified?: boolean;
  hide_branding?: boolean;
  logo_url?: string;
  announcement?: string;
  announcement_active?: boolean;
  seo_title?: string;
  seo_description?: string;
  page_about?: string;
  page_delivery?: string;
  page_returns?: string;
  page_contact_note?: string;
  social_links?: SiteSocialLinks;
  pickup_address?: string;
  summary_email?: boolean;
  weekly_backup_email?: boolean;
  verified?: boolean;
  my_role?: SiteRole;
}

/** Founder's WhatsApp, used for upgrade requests. */
export const FOUNDER_WA = '2348121443666';

export async function jsonFetch<T = Record<string, unknown>>(
  url: string,
  init?: { method?: string; body?: unknown }
): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  try {
    const res = await fetch(url, {
      method: init?.method || 'GET',
      headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'Could not reach the server. Check your connection.' } as T & { error?: string } };
  }
}

export const storeUrl = (slug: string, origin = '') => `${origin}/forums/${slug}`;
