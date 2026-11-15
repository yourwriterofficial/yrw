import { PLANS, effectiveTier, type PlanTier } from '@/lib/plans';

/**
 * Plugins are the features a site owner can look at and switch on or off from one place.
 * Each one says which plan includes it. Whether a plan allows it is decided by the plan flags
 * in lib/plans.ts, so there is only one source of truth for what costs what.
 */

export type PluginGroup = 'sell' | 'grow' | 'talk' | 'protect';

export interface PluginDef {
  id: string;
  name: string;
  description: string;
  group: PluginGroup;
  minTier: PlanTier;
  /** True when the owner can switch it off. False means it is simply part of the plan. */
  toggle: boolean;
  /** For switchable plugins: is it on until the owner says otherwise? Default true. */
  defaultOn?: boolean;
  /** The Admin tab that manages it, when there is one. */
  tab?: string;
}

export const PLUGIN_GROUPS: { key: PluginGroup; label: string }[] = [
  { key: 'sell', label: 'Sell more' },
  { key: 'grow', label: 'Grow your audience' },
  { key: 'talk', label: 'Talk to customers' },
  { key: 'protect', label: 'Look after your shop' },
];

export const PLUGINS: PluginDef[] = [
  // Sell more
  { id: 'catalogue', name: 'Advertise mode', description: 'Show your items as a catalogue. Visitors tap to order on WhatsApp instead of using a cart. Ideal if you take orders by chat.', group: 'sell', minTier: 'free', toggle: true, defaultOn: false },
  { id: 'businesscard', name: 'Business card', description: 'Opening hours, a call button, WhatsApp and directions, right at the top of your site.', group: 'grow', minTier: 'pro', toggle: true, tab: 'settings' },
  { id: 'coupons', name: 'Discount coupons', description: 'Percent or fixed-amount codes, with limits and expiry dates.', group: 'sell', minTier: 'pro', toggle: false, tab: 'coupons' },
  { id: 'variants', name: 'Sizes and colours', description: 'One product with many options, each with its own stock.', group: 'sell', minTier: 'pro', toggle: false, tab: 'products' },
  { id: 'shipping', name: 'Delivery zones', description: 'Different delivery fees for different states, plus store pickup.', group: 'sell', minTier: 'pro', toggle: false, tab: 'shipping' },
  { id: 'bookings', name: 'Bookings', description: 'Let customers reserve a time slot for a service.', group: 'sell', minTier: 'business', toggle: false, tab: 'bookings' },
  { id: 'memberships', name: 'Paid memberships', description: 'Charge members for VIP areas of your community.', group: 'sell', minTier: 'business', toggle: false, tab: 'memberships' },
  { id: 'adspace', name: 'Sell ad space', description: 'Let businesses pay to put a banner on your site. You approve each one.', group: 'sell', minTier: 'pro', toggle: true, tab: 'adspace' },
  // Grow your audience
  { id: 'appinstall', name: 'Install as a phone app', description: 'Visitors can add your site to their home screen like an app.', group: 'grow', minTier: 'free', toggle: true },
  { id: 'push', name: 'Phone alerts', description: 'Get a notification on your phone for every new order, and let buyers follow their order.', group: 'grow', minTier: 'pro', toggle: true },
  { id: 'seo', name: 'Google search appearance', description: 'Choose the title and description people see on Google.', group: 'grow', minTier: 'free', toggle: false, tab: 'settings' },
  { id: 'domain', name: 'Your own domain', description: 'Use yourbrand.com instead of yourname.developa.me.', group: 'grow', minTier: 'pro', toggle: false, tab: 'domain' },
  { id: 'nobrand', name: 'No "Powered by" and no platform ads', description: 'A clean site that is entirely yours.', group: 'grow', minTier: 'pro', toggle: false, tab: 'settings' },
  // Talk to customers
  { id: 'chat', name: 'Chat with buyers', description: 'Buyers message you from your site and you reply from Admin.', group: 'talk', minTier: 'pro', toggle: true, tab: 'messages' },
  { id: 'reviews', name: 'Product reviews', description: 'Verified buyers can rate what they bought.', group: 'talk', minTier: 'pro', toggle: false },
  { id: 'receipts', name: 'Printable receipts', description: 'A receipt buyers can print or save as PDF.', group: 'talk', minTier: 'pro', toggle: false },
  // Look after your shop
  { id: 'lowstock', name: 'Low stock and daily summary', description: 'A morning email with orders, money and what is running out.', group: 'protect', minTier: 'pro', toggle: false, tab: 'settings' },
  { id: 'carts', name: 'Abandoned cart reminders', description: 'See and remind shoppers who left items behind.', group: 'protect', minTier: 'pro', toggle: false },
  { id: 'backup', name: 'Weekly backup', description: 'A copy of your products and orders emailed every week.', group: 'protect', minTier: 'pro', toggle: false, tab: 'settings' },
  { id: 'staff', name: 'Staff accounts', description: 'Give packers, support and managers the right level of access.', group: 'protect', minTier: 'business', toggle: false, tab: 'settings' },
  { id: 'priority', name: 'Priority support', description: 'Help on WhatsApp within 4 business hours.', group: 'protect', minTier: 'business', toggle: false, tab: 'plan' },
];

const RANK: Record<PlanTier, number> = { free: 0, pro: 1, business: 2 };

/** Does this plan include the plugin? */
export function planIncludes(plugin: PluginDef, tier: PlanTier): boolean {
  return RANK[tier] >= RANK[plugin.minTier];
}

/** Included in the plan and not switched off by the owner. `settings` is the site's stored switches. */
export function pluginOn(id: string, planTier: string | null | undefined, expiresAt: string | null | undefined, settings?: Record<string, unknown> | null): boolean {
  const def = PLUGINS.find((p) => p.id === id);
  if (!def) return false;
  if (!planIncludes(def, effectiveTier(planTier, expiresAt))) return false;
  if (!def.toggle) return true;
  return def.defaultOn === false ? settings?.[id] === true : settings?.[id] !== false;
}

/** Guards against a plugin list that has drifted from the plan flags. */
export function pluginMatchesPlan(): string[] {
  const problems: string[] = [];
  const check = (id: string, flag: boolean, tier: PlanTier) => {
    const def = PLUGINS.find((p) => p.id === id);
    if (def && planIncludes(def, tier) !== flag) problems.push(`${id} on ${tier}`);
  };
  for (const tier of ['free', 'pro', 'business'] as PlanTier[]) {
    const p = PLANS[tier];
    check('adspace', p.adSpace, tier);
    check('chat', p.directMessages, tier);
    check('push', p.pushNotifications, tier);
    check('appinstall', p.appInstall, tier);
    check('coupons', p.coupons, tier);
    check('variants', p.variants, tier);
    check('shipping', p.shippingZones, tier);
    check('reviews', p.reviews, tier);
    check('receipts', p.receipts, tier);
    check('carts', p.abandonedCarts, tier);
    check('backup', p.scheduledBackup, tier);
    check('staff', p.staffAccounts, tier);
    check('bookings', p.bookings, tier);
    check('memberships', p.paidMemberships, tier);
    check('priority', p.prioritySupport, tier);
    check('domain', p.customDomain, tier);
    check('nobrand', p.hideBranding, tier);
    check('businesscard', p.businessCard, tier);
    check('catalogue', p.catalogueMode, tier);
  }
  return problems;
}
