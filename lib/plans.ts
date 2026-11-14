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
  maxProductPhotos: number;   // 1 on Starter, 6 on Pro/Business
  customDomain: boolean;
  hideBranding: boolean;
  coupons: boolean;
  hidesPlatformAds: boolean;  // the founder's ads are not shown on this site
  variants: boolean;
  reviews: boolean;
  shippingZones: boolean;
  receipts: boolean;
  lowStockAlerts: boolean;
  abandonedCarts: boolean;
  refundsLog: boolean;
  customerExport: boolean;
  bulkImport: boolean;
  staffAccounts: boolean;
  deeperAnalytics: boolean;
  newsletterLimitPerMonth: number;
  scheduledBackup: boolean;
  paidMemberships: boolean;
  bookings: boolean;
  prioritySupport: boolean;
  maxSites: number;           // how many sites one account can run
  adSpace: boolean;           // sell banner space on your own site
  directMessages: boolean;    // buyers can chat with the seller inside the site
  pushNotifications: boolean; // phone alerts for new orders and order updates
  appInstall: boolean;        // each site can be installed on a phone like an app
  highlights: string[];
}

export const PLANS: Record<PlanTier, PlanDefinition> = {
  free: {
    tier: 'free',
    name: 'Starter',
    priceNgn: 0,
    maxProducts: 10,
    maxProductPhotos: 1,
    customDomain: false,
    hideBranding: false,
    coupons: false,
    hidesPlatformAds: false,
    variants: false,
    reviews: false,
    shippingZones: false,
    receipts: false,
    lowStockAlerts: false,
    abandonedCarts: false,
    refundsLog: false,
    customerExport: false,
    bulkImport: false,
    staffAccounts: false,
    deeperAnalytics: false,
    newsletterLimitPerMonth: 0,
    scheduledBackup: false,
    paidMemberships: false,
    bookings: false,
    prioritySupport: false,
    maxSites: 1,
    adSpace: false,
    directMessages: false,
    pushNotifications: false,
    appInstall: true,
    highlights: ['1 site on your own yourname.developa.me address', 'Up to 10 products', 'Orders by bank transfer or pay on delivery', 'Installable as a phone app'],
  },
  pro: {
    tier: 'pro',
    name: 'Pro',
    priceNgn: 7500,
    maxProducts: null,
    maxProductPhotos: 6,
    customDomain: true,
    hideBranding: true,
    coupons: true,
    hidesPlatformAds: true,
    variants: true,
    reviews: true,
    shippingZones: true,
    receipts: true,
    lowStockAlerts: true,
    abandonedCarts: true,
    refundsLog: true,
    customerExport: true,
    bulkImport: true,
    staffAccounts: false,
    deeperAnalytics: true,
    newsletterLimitPerMonth: 1000,
    scheduledBackup: true,
    paidMemberships: false,
    bookings: false,
    prioritySupport: false,
    maxSites: 4,
    adSpace: true,
    directMessages: true,
    pushNotifications: true,
    appInstall: true,
    highlights: ['Up to 4 sites on one account', 'Your own domain (yourbrand.com)', 'Unlimited products & variants', 'Sell ad space, chat with buyers, push alerts', 'No "Powered by Developa" and no platform ads'],
  },
  business: {
    tier: 'business',
    name: 'Business',
    priceNgn: 20000,
    maxProducts: null,
    maxProductPhotos: 6,
    customDomain: true,
    hideBranding: true,
    coupons: true,
    hidesPlatformAds: true,
    variants: true,
    reviews: true,
    shippingZones: true,
    receipts: true,
    lowStockAlerts: true,
    abandonedCarts: true,
    refundsLog: true,
    customerExport: true,
    bulkImport: true,
    staffAccounts: true,
    deeperAnalytics: true,
    newsletterLimitPerMonth: 5000,
    scheduledBackup: true,
    paidMemberships: true,
    bookings: true,
    prioritySupport: true,
    maxSites: 8,
    adSpace: true,
    directMessages: true,
    pushNotifications: true,
    appInstall: true,
    highlights: ['Up to 8 sites on one account', 'Everything in Pro', 'Staff accounts with roles', 'Paid memberships & booking slots', 'Priority support on WhatsApp'],
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

/** Longer plans cost less per month. Prices are set here and nowhere else. */
export interface BillingPeriod { months: number; label: string; discountPct: number }
export const BILLING_PERIODS: BillingPeriod[] = [
  { months: 1, label: 'Monthly', discountPct: 0 },
  { months: 6, label: '6 months', discountPct: 10 },
  { months: 12, label: '1 year', discountPct: 20 },
];

/** Total to pay for a paid plan over a number of months, with the period discount applied. */
export function priceForPeriod(tier: PlanTier, months: number): number {
  const base = PLANS[tier].priceNgn;
  const period = BILLING_PERIODS.find((p) => p.months === months) ?? BILLING_PERIODS[0];
  return Math.round((base * period.months * (100 - period.discountPct)) / 100 / 100) * 100;
}

/** Everyone's first site starts with the Pro plan free for a few days. */
export const TRIAL_DAYS = 3;
export const TRIAL_TIER: PlanTier = 'pro';

/** Free sites that nobody signs in to are removed. Owners are warned twice first. */
export const PRUNE_AFTER_MONTHS = 6;
export const PRUNE_WARN_DAYS: [number, number] = [30, 7];
export const PRUNE_NOTICE = `Free sites with no sign-in or orders for ${PRUNE_AFTER_MONTHS} months are deleted. We email you twice before that, and signing in or upgrading keeps your site.`;
