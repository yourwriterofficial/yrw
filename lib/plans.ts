/**
 * Plans for sites built on developa.me. This is the one place that says what each plan
 * includes, so the owner dashboard, the founder panel and the API checks never disagree.
 * To change a price or a limit, change it here.
 */
export type PlanTier = 'free' | 'pro' | 'business';

export interface PlanDefinition {
  tier: PlanTier;
  name: string;
  priceNgn: number;           // per month
  maxProducts: number | null; // null = unlimited
  customDomain: boolean;
  hideBranding: boolean;
  coupons: boolean;
  hidesPlatformAds: boolean;  // the founder's ads are not shown on this site
  highlights: string[];
}

export const PLANS: Record<PlanTier, PlanDefinition> = {
  free: {
    tier: 'free',
    name: 'Starter',
    priceNgn: 0,
    maxProducts: 10,
    customDomain: false,
    hideBranding: false,
    coupons: false,
    hidesPlatformAds: false,
    highlights: ['Your own yourname.developa.me address', 'Up to 10 products', 'Orders by bank transfer or pay on delivery', 'Community forum'],
  },
  pro: {
    tier: 'pro',
    name: 'Pro',
    priceNgn: 7500,
    maxProducts: null,
    customDomain: true,
    hideBranding: true,
    coupons: true,
    hidesPlatformAds: true,
    highlights: ['Your own domain (yourbrand.com)', 'Unlimited products', 'Discount coupons', 'No "Powered by Developa" and no platform ads'],
  },
  business: {
    tier: 'business',
    name: 'Business',
    priceNgn: 20000,
    maxProducts: null,
    customDomain: true,
    hideBranding: true,
    coupons: true,
    hidesPlatformAds: true,
    highlights: ['Everything in Pro', 'Priority support on WhatsApp', 'Help setting up your store'],
  },
};

/** A paid plan that has run out is treated as Starter until it is renewed. */
export function effectiveTier(tier: string | null | undefined, expiresAt?: string | null): PlanTier {
  const t = (tier === 'pro' || tier === 'business' ? tier : 'free') as PlanTier;
  if (t === 'free') return 'free';
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) return 'free';
  return t;
}

export function planFor(tier: string | null | undefined, expiresAt?: string | null): PlanDefinition {
  return PLANS[effectiveTier(tier, expiresAt)];
}

export function daysLeft(expiresAt?: string | null): number | null {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
}

/** Where owners point their domain. Set NEXT_PUBLIC_DEVELOPA_CNAME if you use a different target. */
export const CNAME_TARGET = process.env.NEXT_PUBLIC_DEVELOPA_CNAME || 'cname.developa.me';
export const VERIFY_TXT_PREFIX = '_developa-verify';

/** Normalises what an owner typed ("https://www.Shop.com/") into a bare hostname, or null if it is not one. */
export function normalizeDomain(input: string): string | null {
  let d = (input || '').trim().toLowerCase();
  d = d.replace(/^[a-z]+:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '').replace(/\.$/, '');
  if (!/^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/.test(d)) return null;
  if (d.length > 120) return null;
  const blocked = ['developa.me', 'developa.local', 'yourresearchwriter.com.ng', 'vercel.app', 'localhost'];
  if (blocked.some((b) => d === b || d.endsWith('.' + b))) return null;
  return d;
}
