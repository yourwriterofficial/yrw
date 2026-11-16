/**
 * Plans for sites built on developa.me. This is the one place that says what each plan
 * includes, so the owner dashboard, the founder panel and the API checks never disagree.
 * To change a price or a limit, change it here.
 */
export type PlanTier = 'free' | 'lite' | 'pro' | 'business' | 'corporate';

/** Extra customer emails, bought separately and kept until used. Prices are in naira. Change them here. */
export interface EmailPack { id: string; emails: number; priceNgn: number }
export const EMAIL_PACKS: EmailPack[] = [
  // About N14 to N30 an email. Our cost is roughly N1 to N2 an email plus the Paystack fee, so every pack keeps about 84% to 88%.
  { id: 'e100', emails: 100, priceNgn: 3000 },
  { id: 'e500', emails: 500, priceNgn: 11000 },
  { id: 'e2000', emails: 2000, priceNgn: 36000 },
  { id: 'e10000', emails: 10000, priceNgn: 140000 },
];

export const PLAN_ORDER: PlanTier[] = ['free', 'lite', 'pro', 'business', 'corporate'];
export const PAID_TIERS: PlanTier[] = ['lite', 'pro', 'business', 'corporate'];

export interface PlanDefinition {
  tier: PlanTier;
  name: string;
  priceNgn: number;           // per month
  maxProducts: number | null; // null = unlimited
  maxProductPhotos: number;   // 1 on Starter, 3 on Lite, 6 on Pro/Business, 10 on Corporate
  customDomain: boolean;
  hideBranding: boolean;
  coupons: boolean;
  maxCoupons: number | null;  // null = unlimited
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
  maxStaff: number;
  deeperAnalytics: boolean;
  /** Customer emails (newsletters) included each month. Never unlimited and never above 50: more are bought as packs (EMAIL_PACKS). */
  newsletterLimitPerMonth: number;
  scheduledBackup: boolean;
  paidMemberships: boolean;
  bookings: boolean;
  prioritySupport: boolean;
  maxSites: number;           // how many sites one account can run
  adSpace: boolean;           // sell banner space or place house ads on your own site
  houseAds: boolean;          // run your own promo banners on your own site(s)
  onlinePayments: boolean;    // Paystack subaccount split payments directly to seller's bank
  bankTransfer: boolean;      // shoppers can pay by bank transfer and the seller confirms it (Pro and above)
  payOnDelivery: boolean;     // shoppers can choose to pay when the order arrives (Pro and above)
  splitFeePct: number;        // platform fee % taken on split transactions
  directMessages: boolean;    // buyers can chat with the seller inside the site
  pushNotifications: boolean; // phone alerts for new orders and order updates
  appInstall: boolean;        // each site can be installed on a phone like an app
  /** Premium themes included with the plan, so the owner does not buy them one by one. */
  includedThemes: 'none' | 'plus' | 'all';
  businessCard: boolean;      // opening hours, call button and map link shown on the site
  catalogueMode: boolean;     // show items as an advertised catalogue: buyers contact you instead of using a cart
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
    maxCoupons: 1,
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
    maxStaff: 0,
    deeperAnalytics: false,
    newsletterLimitPerMonth: 10,
    scheduledBackup: false,
    paidMemberships: false,
    bookings: false,
    prioritySupport: false,
    maxSites: 1,
    adSpace: false,
    houseAds: false,
    onlinePayments: false,
    bankTransfer: false,
    payOnDelivery: false,
    splitFeePct: 0,
    directMessages: false,
    pushNotifications: false,
    appInstall: true,
    includedThemes: 'none',
    businessCard: false,
    catalogueMode: true,
    highlights: ['1 site on yourname.developa.me', 'Up to 10 products with 1 photo each', '10 free themes', 'WhatsApp ordering & catalogue mode', 'Installable as a phone app', '10 customer emails a month (buy more any time)'],
  },
  lite: {
    tier: 'lite',
    name: 'Student / Lite',
    priceNgn: 2000,
    maxProducts: 50,
    maxProductPhotos: 3,
    customDomain: true,
    hideBranding: true,
    coupons: true,
    maxCoupons: 5,
    hidesPlatformAds: false,
    variants: false,
    reviews: true,
    shippingZones: false,
    receipts: true,
    lowStockAlerts: false,
    abandonedCarts: false,
    refundsLog: false,
    customerExport: false,
    bulkImport: false,
    staffAccounts: false,
    maxStaff: 0,
    deeperAnalytics: false,
    newsletterLimitPerMonth: 20,
    scheduledBackup: false,
    paidMemberships: false,
    bookings: false,
    prioritySupport: false,
    maxSites: 2,
    adSpace: true,
    houseAds: true,
    onlinePayments: true,
    bankTransfer: false,
    payOnDelivery: false,
    splitFeePct: 3,
    directMessages: false,
    pushNotifications: true,
    appInstall: true,
    includedThemes: 'none',
    businessCard: true,
    catalogueMode: true,
    highlights: ['Up to 2 sites on one account', 'Custom domain (yourbrand.com)', 'Up to 50 products (3 photos each)', 'Get paid online straight to your bank (we keep 3%)', 'Run house ads on your own site & sell ad slots', 'Reviews, receipts, business card & phone alerts', '20 customer emails a month (buy more any time)'],
  },
  pro: {
    tier: 'pro',
    name: 'Pro',
    priceNgn: 6000,
    maxProducts: null,
    maxProductPhotos: 6,
    customDomain: true,
    hideBranding: true,
    coupons: true,
    maxCoupons: null,
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
    maxStaff: 0,
    deeperAnalytics: true,
    newsletterLimitPerMonth: 30,
    scheduledBackup: false,
    paidMemberships: false,
    bookings: false,
    prioritySupport: false,
    maxSites: 4,
    adSpace: true,
    houseAds: true,
    onlinePayments: true,
    bankTransfer: true,
    payOnDelivery: true,
    splitFeePct: 2,
    directMessages: true,
    pushNotifications: true,
    appInstall: true,
    includedThemes: 'plus',
    businessCard: true,
    catalogueMode: true,
    highlights: ['Up to 4 sites on one account', 'Unlimited products & 6 photos each', 'Get paid online straight to your bank (we keep 2%)', 'Bank transfer and pay on delivery for your shoppers', 'Every Plus-tier premium theme included', 'Variants, delivery zones, coupons & abandoned carts', 'Run house ads, chat with buyers & no platform ads', '30 customer emails a month (buy more any time)'],
  },
  business: {
    tier: 'business',
    name: 'Business',
    priceNgn: 18000,
    maxProducts: null,
    maxProductPhotos: 6,
    customDomain: true,
    hideBranding: true,
    coupons: true,
    maxCoupons: null,
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
    maxStaff: 3,
    deeperAnalytics: true,
    newsletterLimitPerMonth: 40,
    scheduledBackup: false,
    paidMemberships: true,
    bookings: true,
    prioritySupport: true,
    maxSites: 8,
    adSpace: true,
    houseAds: true,
    onlinePayments: true,
    bankTransfer: true,
    payOnDelivery: true,
    splitFeePct: 1,
    directMessages: true,
    pushNotifications: true,
    appInstall: true,
    includedThemes: 'all',
    businessCard: true,
    catalogueMode: true,
    highlights: ['Up to 8 sites on one account', 'Everything in Pro, and we keep only 1% of online payments', 'Every premium theme included (incl. Signature)', 'Up to 3 staff accounts with roles', 'Paid memberships & booking slots', '40 customer emails a month & priority WhatsApp support'],
  },
  corporate: {
    tier: 'corporate',
    name: 'Corporate',
    priceNgn: 45000,
    maxProducts: null,
    maxProductPhotos: 10,
    customDomain: true,
    hideBranding: true,
    coupons: true,
    maxCoupons: null,
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
    maxStaff: 15,
    deeperAnalytics: true,
    newsletterLimitPerMonth: 50,
    scheduledBackup: true,
    paidMemberships: true,
    bookings: true,
    prioritySupport: true,
    maxSites: 25,
    adSpace: true,
    houseAds: true,
    onlinePayments: true,
    bankTransfer: true,
    payOnDelivery: true,
    splitFeePct: 0.5,
    directMessages: true,
    pushNotifications: true,
    appInstall: true,
    includedThemes: 'all',
    businessCard: true,
    catalogueMode: true,
    highlights: ['Up to 25 sites for agencies & branches', 'Everything in Business, and we keep only 0.5% of online payments', 'Up to 10 photos per product & 15 staff accounts', '50 customer emails a month (buy more any time)', 'Weekly store backups by email and one-click downloads', 'Full white-label & priority support'],
  },
};

/** A paid plan that has run out is treated as Starter until it is renewed. */
export function effectiveTier(tier: string | null | undefined, expiresAt?: string | null): PlanTier {
  const t = (PLAN_ORDER.includes(tier as PlanTier) ? tier : 'free') as PlanTier;
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
