import { PLANS, PLAN_ORDER, effectiveTier, type PlanTier } from '@/lib/plans';

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
  { id: 'online_payments', name: 'Paystack split payments', description: 'Accept card, transfer and USSD payments directly into your own Nigerian bank account via Paystack subaccounts.', group: 'sell', minTier: 'lite', toggle: true, tab: 'settings' },
  { id: 'businesscard', name: 'Business card', description: 'Opening hours, a call button, WhatsApp and directions, right at the top of your site.', group: 'grow', minTier: 'lite', toggle: true, tab: 'settings' },
  { id: 'coupons', name: 'Discount coupons', description: 'Percent or fixed-amount codes, with limits and expiry dates.', group: 'sell', minTier: 'lite', toggle: false, tab: 'coupons' },
  { id: 'variants', name: 'Sizes and colours', description: 'One product with many options, each with its own stock.', group: 'sell', minTier: 'pro', toggle: false, tab: 'products' },
  { id: 'shipping', name: 'Delivery zones', description: 'Different delivery fees for different states, plus store pickup.', group: 'sell', minTier: 'pro', toggle: false, tab: 'shipping' },
  { id: 'bookings', name: 'Bookings', description: 'Let customers reserve a time slot for a service.', group: 'sell', minTier: 'business', toggle: false, tab: 'bookings' },
  { id: 'memberships', name: 'Paid memberships', description: 'Charge members for VIP areas of your community.', group: 'sell', minTier: 'business', toggle: false, tab: 'memberships' },
  { id: 'adspace', name: 'Ads & ad space', description: 'Run promo banners on your own site or let businesses pay to put a banner on your site.', group: 'sell', minTier: 'lite', toggle: true, tab: 'adspace' },
  // Grow your audience
  { id: 'appinstall', name: 'Install as a phone app', description: 'Visitors can add your site to their home screen like an app.', group: 'grow', minTier: 'free', toggle: true },
  { id: 'push', name: 'Phone alerts', description: 'Get a notification on your phone for every new order, and let buyers follow their order.', group: 'grow', minTier: 'lite', toggle: true },
  { id: 'seo', name: 'Google search appearance', description: 'Choose the title and description people see on Google.', group: 'grow', minTier: 'free', toggle: false, tab: 'settings' },
  { id: 'domain', name: 'Your own domain', description: 'Use yourbrand.com instead of yourname.developa.me.', group: 'grow', minTier: 'lite', toggle: false, tab: 'domain' },
  { id: 'nobrand', name: 'No "Powered by" branding', description: 'A clean site that carries only your own brand name.', group: 'grow', minTier: 'lite', toggle: false, tab: 'settings' },
  // Talk to customers
  { id: 'chat', name: 'Chat with buyers', description: 'Buyers message you from your site and you reply from Admin.', group: 'talk', minTier: 'pro', toggle: true, tab: 'messages' },
  { id: 'reviews', name: 'Product reviews', description: 'Verified buyers can rate what they bought.', group: 'talk', minTier: 'lite', toggle: false },
  { id: 'receipts', name: 'Printable receipts', description: 'A receipt buyers can print or save as PDF.', group: 'talk', minTier: 'lite', toggle: false },
  // Look after your shop
  { id: 'lowstock', name: 'Low stock and daily summary', description: 'A morning email with orders, money and what is running out.', group: 'protect', minTier: 'pro', toggle: false, tab: 'settings' },
  { id: 'carts', name: 'Abandoned cart reminders', description: 'See and remind shoppers who left items behind.', group: 'protect', minTier: 'pro', toggle: false },
  { id: 'backup', name: 'Weekly backup', description: 'A copy of your products and orders emailed every week.', group: 'protect', minTier: 'pro', toggle: false, tab: 'settings' },
  { id: 'staff', name: 'Staff accounts', description: 'Give packers, support and managers the right level of access.', group: 'protect', minTier: 'business', toggle: false, tab: 'settings' },
  { id: 'priority', name: 'Priority support', description: 'Help on WhatsApp within 4 business hours.', group: 'protect', minTier: 'business', toggle: false, tab: 'plan' },

  // 50 Shareable Pro Plugins (Lite / Pro / Business / Corporate)
  // Checkout & Revenue
  { id: 'flash_sale', name: 'Flash sale countdown', description: 'Show a live urgency countdown timer on sale items or the storefront.', group: 'sell', minTier: 'lite', toggle: true, defaultOn: false },
  { id: 'bundles', name: 'Product bundles', description: 'Group 2 or 3 items together as one discounted pack.', group: 'sell', minTier: 'pro', toggle: true, defaultOn: false, tab: 'products' },
  { id: 'wholesale_tiers', name: 'Wholesale quantity pricing', description: 'Automatic lower unit prices when buyers order in bulk.', group: 'sell', minTier: 'pro', toggle: true, defaultOn: false, tab: 'products' },
  { id: 'checkout_upsell', name: 'Checkout order bump', description: 'Suggest a quick add-on item inside the checkout drawer.', group: 'sell', minTier: 'lite', toggle: true, defaultOn: false },
  { id: 'preorder', name: 'Pre-order & backorder', description: 'Accept orders for upcoming or out-of-stock items with a ship date.', group: 'sell', minTier: 'pro', toggle: true, defaultOn: false, tab: 'products' },
  { id: 'part_payment', name: 'Installment milestones', description: 'Accept a deposit up front and track the balance to completion.', group: 'sell', minTier: 'pro', toggle: true, defaultOn: false, tab: 'orders' },
  { id: 'tip_jar', name: 'Support / Tip jar', description: 'Optional tip box at checkout for creators and service providers.', group: 'sell', minTier: 'lite', toggle: true, defaultOn: false },
  { id: 'gift_vouchers', name: 'Gift vouchers & store credit', description: 'Issue redeemable store credit codes for refunds or gifts.', group: 'sell', minTier: 'pro', toggle: true, defaultOn: false, tab: 'coupons' },
  { id: 'min_order', name: 'Minimum order rule', description: 'Require a minimum cart total before delivery checkout.', group: 'sell', minTier: 'lite', toggle: true, defaultOn: false, tab: 'settings' },
  { id: 'quote_builder', name: 'Custom quote requests', description: 'Let buyers submit custom specs and receive a priced payment link.', group: 'sell', minTier: 'pro', toggle: true, defaultOn: false },

  // Growth & Pixels
  { id: 'buyer_affiliates', name: 'Store buyer affiliates', description: 'Let your buyers earn commission or discounts for referring friends.', group: 'grow', minTier: 'pro', toggle: true, defaultOn: false },
  { id: 'welcome_popup', name: 'First-visit coupon popup', description: 'Offer a welcome code in exchange for a visitor email or WhatsApp.', group: 'grow', minTier: 'lite', toggle: true, defaultOn: false },
  { id: 'stock_waitlist', name: 'Back-in-stock waitlist', description: 'Collect emails on sold-out items and notify shoppers when restocked.', group: 'grow', minTier: 'pro', toggle: true, defaultOn: false },
  { id: 'vip_discounts', name: 'VIP repeat-buyer rules', description: 'Automatically reward returning customers with 2+ paid orders.', group: 'grow', minTier: 'pro', toggle: true, defaultOn: false },
  { id: 'recent_toast', name: 'Recent order social proof', description: 'Show lightweight cached recent-order notifications to visitors.', group: 'grow', minTier: 'lite', toggle: true, defaultOn: false },
  { id: 'meta_ga4_pixel', name: 'Meta Pixel & GA4', description: 'Track page views and conversions with your Meta Pixel and GA4 ID.', group: 'grow', minTier: 'lite', toggle: true, defaultOn: false, tab: 'settings' },
  { id: 'tiktok_snap_pixel', name: 'TikTok & Snap Pixels', description: 'Track ad conversions from TikTok and Snapchat campaigns.', group: 'grow', minTier: 'pro', toggle: true, defaultOn: false, tab: 'settings' },
  { id: 'wa_broadcast_export', name: 'WhatsApp broadcast exporter', description: 'Export opted-in customer phone numbers cleanly for WhatsApp.', group: 'grow', minTier: 'lite', toggle: true, defaultOn: false, tab: 'customers' },
  { id: 'exit_intent', name: 'Exit-intent cart saver', description: 'Show a helpful reminder or discount when desktop shoppers leave.', group: 'grow', minTier: 'pro', toggle: true, defaultOn: false },
  { id: 'qr_flyer', name: 'Printable QR flyer maker', description: 'Generate a ready-to-print store poster with QR code and logo.', group: 'grow', minTier: 'lite', toggle: true, defaultOn: false },

  // Fulfilment & Ops
  { id: 'packing_slips', name: 'Packing slips & waybills', description: 'Print clean dispatch slips with address, phone and items.', group: 'protect', minTier: 'lite', toggle: true, defaultOn: false, tab: 'orders' },
  { id: 'sku_labels', name: 'SKU barcode labels', description: 'Print shelf and package labels for your products.', group: 'protect', minTier: 'pro', toggle: true, defaultOn: false, tab: 'products' },
  { id: 'multi_branch', name: 'Multi-branch pickup', description: 'Let buyers pick which store branch or hub to collect from.', group: 'protect', minTier: 'business', toggle: true, defaultOn: false, tab: 'shipping' },
  { id: 'rider_handoff', name: 'Rider dispatch link', description: 'Shareable one-time delivery link for riders with PIN confirmation.', group: 'protect', minTier: 'pro', toggle: true, defaultOn: false, tab: 'orders' },
  { id: 'auto_cancel_unpaid', name: 'Auto-cancel unpaid transfers', description: 'Release reserved stock if a bank transfer is not paid in time.', group: 'protect', minTier: 'pro', toggle: true, defaultOn: false, tab: 'settings' },
  { id: 'supplier_dir', name: 'Supplier directory', description: 'Keep private notes on which supplier stocks each item.', group: 'protect', minTier: 'pro', toggle: true, defaultOn: false },
  { id: 'expense_ledger', name: 'Expense & profit ledger', description: 'Log packaging, delivery and ad spend alongside sales.', group: 'protect', minTier: 'pro', toggle: true, defaultOn: false },
  { id: 'return_portal', name: 'Return & exchange requests', description: 'Let buyers request a return or exchange from order tracking.', group: 'protect', minTier: 'pro', toggle: true, defaultOn: false, tab: 'orders' },
  { id: 'scheduled_drops', name: 'Scheduled product drops', description: 'Set a future date and time for new collections to go live.', group: 'protect', minTier: 'pro', toggle: true, defaultOn: false, tab: 'products' },
  { id: 'stock_take', name: 'Inventory stock-take mode', description: 'Mobile checklist to count physical stock and reconcile numbers.', group: 'protect', minTier: 'business', toggle: true, defaultOn: false, tab: 'products' },

  // Content, Services & Controls
  { id: 'private_store', name: 'Passcode-protected store', description: 'Lock your storefront behind a single passcode for VIP or wholesale.', group: 'protect', minTier: 'pro', toggle: true, defaultOn: false, tab: 'settings' },
  { id: 'drip_courses', name: 'Drip course & content locker', description: 'Release PDFs or video links across modules for paid members.', group: 'sell', minTier: 'business', toggle: true, defaultOn: false, tab: 'memberships' },
  { id: 'event_tickets', name: 'Event ticketing & QR check-in', description: 'Sell event passes and verify buyer QR tickets at the door.', group: 'sell', minTier: 'pro', toggle: true, defaultOn: false },
  { id: 'portfolio_gallery', name: 'Portfolio & case studies', description: 'Showcase before/after galleries and client projects.', group: 'talk', minTier: 'lite', toggle: true, defaultOn: false },
  { id: 'menu_modifiers', name: 'Food & menu modifiers', description: 'Add extras, sides or spice levels for restaurant and food orders.', group: 'sell', minTier: 'lite', toggle: true, defaultOn: false, tab: 'products' },
  { id: 'testimonial_collector', name: 'Testimonial collector', description: 'Post-delivery link asking happy buyers for a quote and photo.', group: 'talk', minTier: 'lite', toggle: true, defaultOn: false },
  { id: 'custom_intake', name: 'Custom intake & measurement forms', description: 'Collect measurements, engraving text or notes per product.', group: 'talk', minTier: 'pro', toggle: true, defaultOn: false, tab: 'products' },
  { id: 'video_embeds', name: 'Product video embeds', description: 'Lazy-loaded YouTube, TikTok or Instagram reel clips on products.', group: 'talk', minTier: 'lite', toggle: true, defaultOn: false },
  { id: 'blog_scheduler', name: 'Blog & post scheduler', description: 'Draft articles ahead of time and publish automatically on schedule.', group: 'talk', minTier: 'pro', toggle: true, defaultOn: false, tab: 'community' },
  { id: 'community_badges', name: 'Community badges & points', description: 'Award Top Contributor and Verified Buyer badges in your forum.', group: 'talk', minTier: 'pro', toggle: true, defaultOn: false, tab: 'community' },

  // Insights, Compliance & Pro Controls
  { id: 'vat_calculator', name: 'VAT & service fee calculator', description: 'Add configurable tax % or packaging fee cleanly at checkout.', group: 'sell', minTier: 'pro', toggle: true, defaultOn: false, tab: 'settings' },
  { id: 'custom_emails', name: 'Custom order email templates', description: 'Edit the wording and sign-off on buyer confirmation emails.', group: 'talk', minTier: 'pro', toggle: true, defaultOn: false, tab: 'settings' },
  { id: 'dns_email_check', name: 'Email DNS health checker', description: 'Verify SPF/DKIM/DMARC records for your custom domain.', group: 'protect', minTier: 'pro', toggle: true, defaultOn: false, tab: 'domain' },
  { id: 'catalog_feed', name: 'Google & Meta Catalog XML feed', description: 'Cached /feed?format=xml link to sync products to Instagram & Google.', group: 'grow', minTier: 'pro', toggle: true, defaultOn: false },
  { id: 'order_webhook', name: 'Order webhook (Zapier / Sheets)', description: 'Send a signed JSON ping to your external URL when an order is paid.', group: 'protect', minTier: 'business', toggle: true, defaultOn: false, tab: 'settings' },
  { id: 'multisite_sync', name: 'Multi-site inventory sync', description: 'Share one master stock pool across multiple stores on your account.', group: 'protect', minTier: 'corporate', toggle: true, defaultOn: false },
  { id: 'staff_audit_log', name: 'Staff action audit log', description: 'Track which team member changed a price or approved an order.', group: 'protect', minTier: 'business', toggle: true, defaultOn: false, tab: 'settings' },
  { id: 'geo_notices', name: 'Geo-targeted currency & notices', description: 'Adapt currency previews and shipping notices by visitor country.', group: 'grow', minTier: 'pro', toggle: true, defaultOn: false },
  { id: 'weekly_pdf_digest', name: 'Weekly performance digest', description: 'Printable/downloadable weekly summary of sales and top items.', group: 'protect', minTier: 'pro', toggle: true, defaultOn: false },
  { id: 'coming_soon', name: 'Coming-soon waitlist mode', description: 'Display a launch countdown and email/WhatsApp waitlist while building.', group: 'grow', minTier: 'lite', toggle: true, defaultOn: false, tab: 'settings' },
];

const RANK: Record<PlanTier, number> = { free: 0, lite: 1, pro: 2, business: 3, corporate: 4 };

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
  for (const tier of PLAN_ORDER) {
    const p = PLANS[tier];
    check('online_payments', p.onlinePayments, tier);
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
