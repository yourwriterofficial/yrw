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
  { id: 'catalogue', name: 'Showcase mode', description: 'Turn your shop into a showcase. Customers browse and tap to message you on WhatsApp to order, with no cart or checkout.', group: 'sell', minTier: 'free', toggle: true, defaultOn: false },
  { id: 'online_payments', name: 'Accept online payments', description: 'Let customers pay by card, bank transfer or USSD on your shop. The money goes straight into your own bank account.', group: 'sell', minTier: 'lite', toggle: true, tab: 'settings' },
  { id: 'businesscard', name: 'Business card', description: 'Show your opening hours, phone number, WhatsApp and directions at the top of your site.', group: 'grow', minTier: 'lite', toggle: true, tab: 'settings' },
  { id: 'coupons', name: 'Discount codes', description: 'Create codes you can share with customers. Choose how much is taken off, how many times it can be used and when it expires.', group: 'sell', minTier: 'lite', toggle: false, tab: 'coupons' },
  { id: 'variants', name: 'Sizes and colours', description: 'Sell one item in different sizes or colours, each with its own stock count.', group: 'sell', minTier: 'pro', toggle: false, tab: 'products' },
  { id: 'shipping', name: 'Delivery prices', description: 'Set a different delivery price for each state, and let customers pick up from you for free.', group: 'sell', minTier: 'pro', toggle: false, tab: 'shipping' },
  { id: 'bookings', name: 'Bookings', description: 'Let customers pick a day and time to book your service, like a haircut or a lesson.', group: 'sell', minTier: 'business', toggle: false, tab: 'bookings' },
  { id: 'memberships', name: 'Paid memberships', description: 'Charge a fee for access to a members-only area of your community.', group: 'sell', minTier: 'business', toggle: false, tab: 'memberships' },
  { id: 'adspace', name: 'Ads on your site', description: 'Show your own promo banners, or let other businesses pay you to advertise on your site.', group: 'sell', minTier: 'lite', toggle: true, tab: 'adspace' },
  // Grow your audience
  { id: 'appinstall', name: 'Install as a phone app', description: 'Let visitors save your site to their phone’s home screen so it opens like an app.', group: 'grow', minTier: 'free', toggle: true },
  { id: 'push', name: 'Phone alerts', description: 'Get an alert on your phone every time someone orders, and let customers follow their delivery.', group: 'grow', minTier: 'lite', toggle: true },
  { id: 'seo', name: 'Google search look', description: 'Choose the title and short description people see when they find your shop on Google.', group: 'grow', minTier: 'free', toggle: false, tab: 'settings' },
  { id: 'domain', name: 'Your own web address', description: 'Use your own address, like yourbrand.com, instead of yourname.developa.me.', group: 'grow', minTier: 'lite', toggle: false, tab: 'domain' },
  { id: 'nobrand', name: 'Remove “Powered by”', description: 'Hide the “Powered by Developa” label so your site shows only your brand.', group: 'grow', minTier: 'lite', toggle: false, tab: 'settings' },
  // Talk to customers
  { id: 'chat', name: 'Chat with customers', description: 'Let customers message you from your site and reply from your dashboard.', group: 'talk', minTier: 'pro', toggle: true, tab: 'messages' },
  { id: 'reviews', name: 'Customer reviews', description: 'Let customers who bought from you leave a star rating and a comment.', group: 'talk', minTier: 'lite', toggle: false },
  { id: 'receipts', name: 'Printable receipts', description: 'Give customers a receipt they can print or save after they order.', group: 'talk', minTier: 'lite', toggle: false },
  // Look after your shop
  { id: 'lowstock', name: 'Daily shop summary', description: 'Get a daily email with yesterday’s orders, money received and items running low.', group: 'protect', minTier: 'pro', toggle: false, tab: 'settings' },
  { id: 'carts', name: 'Unfinished order reminders', description: 'See shoppers who added items but did not finish ordering, and send them a reminder.', group: 'protect', minTier: 'pro', toggle: false },
  { id: 'bank_transfer', name: 'Pay by bank transfer', description: 'Let shoppers pay by bank transfer, then confirm each payment from your orders.', group: 'sell', minTier: 'pro', toggle: false, tab: 'orders' },
  { id: 'pay_on_delivery', name: 'Pay on delivery', description: 'Let shoppers choose to pay when their order arrives.', group: 'sell', minTier: 'pro', toggle: false, tab: 'orders' },
  { id: 'backup', name: 'Weekly backup', description: 'Get a weekly email with a copy of your products and orders, and download a full copy any time, so nothing is ever lost.', group: 'protect', minTier: 'corporate', toggle: false, tab: 'settings' },
  { id: 'staff', name: 'Helper logins', description: 'Give your helpers their own login with only the access you choose, so you never share your password.', group: 'protect', minTier: 'business', toggle: false, tab: 'settings' },
  { id: 'priority', name: 'Priority help', description: 'Get help from our team on WhatsApp within 4 working hours.', group: 'protect', minTier: 'business', toggle: false, tab: 'plan' },

  // 50 Shareable Pro Plugins (Lite / Pro / Business / Corporate)
  // Checkout & Revenue
  { id: 'flash_sale', name: 'Sale countdown', description: 'Show a ticking countdown on sale items to make shoppers buy now.', group: 'sell', minTier: 'lite', toggle: true, defaultOn: false },
  { id: 'bundles', name: 'Bundles', description: 'Sell two or three items together as one pack at a lower price.', group: 'sell', minTier: 'pro', toggle: true, defaultOn: false, tab: 'products' },
  { id: 'wholesale_tiers', name: 'Bulk-buy discounts', description: 'Automatically lower the price per item when someone buys many at once.', group: 'sell', minTier: 'pro', toggle: true, defaultOn: false, tab: 'products' },
  { id: 'checkout_upsell', name: 'Last-minute add-on', description: 'Suggest a small extra item to customers just before they pay.', group: 'sell', minTier: 'lite', toggle: true, defaultOn: false },
  { id: 'preorder', name: 'Pre-orders', description: 'Take orders for items that are sold out or not ready yet, and tell customers when they will ship.', group: 'sell', minTier: 'pro', toggle: true, defaultOn: false, tab: 'products' },
  { id: 'part_payment', name: 'Pay in parts', description: 'Let customers pay a deposit now and the rest later, and keep track of what is still owed.', group: 'sell', minTier: 'pro', toggle: true, defaultOn: false, tab: 'orders' },
  { id: 'tip_jar', name: 'Tips', description: 'Let customers add an optional tip when they pay.', group: 'sell', minTier: 'lite', toggle: true, defaultOn: false },
  { id: 'gift_vouchers', name: 'Gift codes', description: 'Create codes worth a set amount that customers can spend in your shop. Handy for gifts or refunds.', group: 'sell', minTier: 'pro', toggle: true, defaultOn: false, tab: 'coupons' },
  { id: 'min_order', name: 'Minimum order', description: 'Set the smallest order total you will deliver, so tiny orders do not cost you money.', group: 'sell', minTier: 'lite', toggle: true, defaultOn: false, tab: 'settings' },
  { id: 'quote_builder', name: 'Price quotes', description: 'Let customers describe what they want, then send them a price and a payment link.', group: 'sell', minTier: 'pro', toggle: true, defaultOn: false },

  // Growth & Pixels
  { id: 'buyer_affiliates', name: 'Customer referral rewards', description: 'Reward customers with a discount or commission when their friends buy from you.', group: 'grow', minTier: 'pro', toggle: true, defaultOn: false },
  { id: 'welcome_popup', name: 'Welcome discount', description: 'Greet first-time visitors with a discount code in return for their email or WhatsApp number.', group: 'grow', minTier: 'lite', toggle: true, defaultOn: false },
  { id: 'stock_waitlist', name: 'Back-in-stock alerts', description: 'Let customers sign up for sold-out items and tell them when it is back.', group: 'grow', minTier: 'pro', toggle: true, defaultOn: false },
  { id: 'vip_discounts', name: 'Loyal customer discounts', description: 'Automatically give a discount to customers who have already bought from you twice or more.', group: 'grow', minTier: 'pro', toggle: true, defaultOn: false },
  { id: 'recent_toast', name: '“Someone just bought” pop-ups', description: 'Show small pop-ups like “Ada just bought this” to build trust with new visitors.', group: 'grow', minTier: 'lite', toggle: true, defaultOn: false },
  { id: 'meta_ga4_pixel', name: 'Facebook & Google tracking', description: 'Connect your Facebook and Google Analytics accounts to see where customers come from and run better ads.', group: 'grow', minTier: 'lite', toggle: true, defaultOn: false, tab: 'settings' },
  { id: 'tiktok_snap_pixel', name: 'TikTok & Snapchat ad tracking', description: 'Connect your TikTok and Snapchat ad accounts so they can see who bought after clicking your ads.', group: 'grow', minTier: 'pro', toggle: true, defaultOn: false, tab: 'settings' },
  { id: 'wa_broadcast_export', name: 'WhatsApp contact list', description: 'Download the phone numbers of customers who agreed to hear from you, ready to message on WhatsApp.', group: 'grow', minTier: 'lite', toggle: true, defaultOn: false, tab: 'customers' },
  { id: 'exit_intent', name: 'Come-back reminder', description: 'When a shopper is about to leave with items in their cart, show a reminder or a discount.', group: 'grow', minTier: 'pro', toggle: true, defaultOn: false },
  { id: 'qr_flyer', name: 'Printable shop poster', description: 'Make a ready-to-print poster with your shop’s QR code and logo so people can scan and visit.', group: 'grow', minTier: 'lite', toggle: true, defaultOn: false },

  // Fulfilment & Ops
  { id: 'packing_slips', name: 'Packing slips', description: 'Print a slip for each order with the customer’s name, address, phone and items to pack.', group: 'protect', minTier: 'lite', toggle: true, defaultOn: false, tab: 'orders' },
  { id: 'sku_labels', name: 'Barcode labels', description: 'Print barcode labels for your shelves and parcels.', group: 'protect', minTier: 'pro', toggle: true, defaultOn: false, tab: 'products' },
  { id: 'multi_branch', name: 'Pick-up locations', description: 'If you have more than one shop or pick-up spot, let customers choose where to collect.', group: 'protect', minTier: 'business', toggle: true, defaultOn: false, tab: 'shipping' },
  { id: 'rider_handoff', name: 'Rider delivery link', description: 'Send your delivery rider a private link with the delivery details, confirmed with a PIN.', group: 'protect', minTier: 'pro', toggle: true, defaultOn: false, tab: 'orders' },
  { id: 'auto_cancel_unpaid', name: 'Cancel unpaid orders', description: 'Put the stock back on sale if a customer does not pay their bank transfer in time.', group: 'protect', minTier: 'pro', toggle: true, defaultOn: false, tab: 'settings' },
  { id: 'supplier_dir', name: 'Supplier notes', description: 'Keep private notes about who supplies each of your items.', group: 'protect', minTier: 'pro', toggle: true, defaultOn: false },
  { id: 'expense_ledger', name: 'Expenses & profit', description: 'Record what you spend on packaging, delivery and ads, and see your real profit.', group: 'protect', minTier: 'pro', toggle: true, defaultOn: false },
  { id: 'return_portal', name: 'Returns & exchanges', description: 'Let customers ask for a return or exchange from their order page.', group: 'protect', minTier: 'pro', toggle: true, defaultOn: false, tab: 'orders' },
  { id: 'scheduled_drops', name: 'Scheduled new arrivals', description: 'Choose a date and time for new items to appear in your shop by themselves.', group: 'protect', minTier: 'pro', toggle: true, defaultOn: false, tab: 'products' },
  { id: 'stock_take', name: 'Stock counting', description: 'Count your items on your phone and fix any stock numbers that do not match.', group: 'protect', minTier: 'business', toggle: true, defaultOn: false, tab: 'products' },

  // Content, Services & Controls
  { id: 'private_store', name: 'Password-protected shop', description: 'Hide your shop behind a password so only the people you give it to can shop.', group: 'protect', minTier: 'pro', toggle: true, defaultOn: false, tab: 'settings' },
  { id: 'drip_courses', name: 'Lessons for paying members', description: 'Release lessons, PDFs or videos to paying members one step at a time.', group: 'sell', minTier: 'business', toggle: true, defaultOn: false, tab: 'memberships' },
  { id: 'event_tickets', name: 'Event tickets', description: 'Sell tickets to your event and check people in at the door by scanning their QR code.', group: 'sell', minTier: 'pro', toggle: true, defaultOn: false },
  { id: 'portfolio_gallery', name: 'Portfolio gallery', description: 'Show off your past work with photo galleries and project stories.', group: 'talk', minTier: 'lite', toggle: true, defaultOn: false },
  { id: 'menu_modifiers', name: 'Food extras', description: 'Let customers choose extras, sides or spice level when ordering food.', group: 'sell', minTier: 'lite', toggle: true, defaultOn: false, tab: 'products' },
  { id: 'testimonial_collector', name: 'Ask for testimonials', description: 'Send customers a link after delivery asking for a short review and photo.', group: 'talk', minTier: 'lite', toggle: true, defaultOn: false },
  { id: 'custom_intake', name: 'Order details form', description: 'Ask customers for details like measurements or engraving text when they order.', group: 'talk', minTier: 'pro', toggle: true, defaultOn: false, tab: 'products' },
  { id: 'video_embeds', name: 'Product videos', description: 'Show YouTube, TikTok or Instagram videos on your product pages.', group: 'talk', minTier: 'lite', toggle: true, defaultOn: false },
  { id: 'blog_scheduler', name: 'Schedule posts', description: 'Write posts ahead of time and have them publish by themselves on the date you choose.', group: 'talk', minTier: 'pro', toggle: true, defaultOn: false, tab: 'community' },
  { id: 'community_badges', name: 'Badges & points', description: 'Give your community members badges and points, like Top Contributor.', group: 'talk', minTier: 'pro', toggle: true, defaultOn: false, tab: 'community' },

  // Insights, Compliance & Pro Controls
  { id: 'vat_calculator', name: 'Tax & extra fees', description: 'Add tax or a packaging fee to the total at checkout.', group: 'sell', minTier: 'pro', toggle: true, defaultOn: false, tab: 'settings' },
  { id: 'custom_emails', name: 'Your own order emails', description: 'Change the wording of the emails customers get after they order.', group: 'talk', minTier: 'pro', toggle: true, defaultOn: false, tab: 'settings' },
  { id: 'dns_email_check', name: 'Email delivery check', description: 'Check that your web address is set up so your emails do not land in spam.', group: 'protect', minTier: 'pro', toggle: true, defaultOn: false, tab: 'domain' },
  { id: 'catalog_feed', name: 'Product feed for Instagram & Google', description: 'Create a link that lets Instagram, Facebook and Google show your products automatically.', group: 'grow', minTier: 'pro', toggle: true, defaultOn: false },
  { id: 'order_webhook', name: 'Send orders to Google Sheets', description: 'Send every paid order to Google Sheets or Zapier automatically.', group: 'protect', minTier: 'business', toggle: true, defaultOn: false, tab: 'settings' },
  { id: 'multisite_sync', name: 'Shared stock across shops', description: 'Share one stock count across all the shops on your account.', group: 'protect', minTier: 'corporate', toggle: true, defaultOn: false },
  { id: 'staff_audit_log', name: 'Helper activity log', description: 'See which helper changed a price or approved an order, and when.', group: 'protect', minTier: 'business', toggle: true, defaultOn: false, tab: 'settings' },
  { id: 'geo_notices', name: 'Notices by visitor country', description: 'Show prices and delivery notes that match the visitor’s country.', group: 'grow', minTier: 'pro', toggle: true, defaultOn: false },
  { id: 'weekly_pdf_digest', name: 'Weekly sales report', description: 'Get a weekly summary of your sales and best-selling items that you can print or save.', group: 'protect', minTier: 'pro', toggle: true, defaultOn: false },
  { id: 'coming_soon', name: 'Coming-soon page', description: 'Show a launch countdown and collect emails or WhatsApp numbers while your shop is still being built.', group: 'grow', minTier: 'lite', toggle: true, defaultOn: false, tab: 'settings' },
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
    check('bank_transfer', p.bankTransfer, tier);
    check('pay_on_delivery', p.payOnDelivery, tier);
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
