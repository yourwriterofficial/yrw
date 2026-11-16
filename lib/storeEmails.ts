import { sendSiteEmail as sendSystemEmail } from './siteMailer';
import { emailShell } from './emailTemplates';
import { formatMoney } from './forums';
import { siteUrl } from './siteUrl';
import { loadSiteBrand } from './siteBrandServer';

/**
 * Emails sent to the people who buy from a developa store. They are best effort:
 * callers fire them without waiting, because a mail failure must never block an order.
 */

interface StoreInfo {
  name: string;
  slug: string;
  currency?: string | null;
  whatsapp_number?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_account_name?: string | null;
  payment_instructions?: string | null;
}

interface OrderInfo {
  order_code: string;
  buyer_name: string;
  buyer_email: string;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  fulfillment_status: string;
  items: { title: string; qty: number; price: number }[];
  shipping_fee?: number;
  shipping_zone?: string;
  delivery_method?: string;
  delivery_state?: string;
}

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function itemsHtml(order: OrderInfo, currency: string) {
  const shipLine = order.delivery_method === 'pickup'
    ? '<p style="margin:6px 0"><strong>Method:</strong> Store pickup</p>'
    : Number(order.shipping_fee || 0) > 0
    ? `<p style="margin:6px 0"><strong>Delivery${order.shipping_zone ? ` (${esc(order.shipping_zone)})` : ''}:</strong> ${esc(formatMoney(Number(order.shipping_fee), currency))}</p>`
    : '';
  return `<ul style="padding-left:18px;margin:12px 0">${order.items
    .map((i) => `<li>${esc(i.qty)} × ${esc(i.title)} <span style="color:#71717a">(${esc(formatMoney(i.price, currency))})</span></li>`)
    .join('')}</ul>${shipLine}<p><strong>Total: ${esc(formatMoney(order.total_amount, currency))}</strong></p>`;
}

function contactLine(site: StoreInfo) {
  const wa = (site.whatsapp_number || '').replace(/\D/g, '');
  const num = wa.startsWith('0') ? '234' + wa.slice(1) : wa;
  return num.length >= 10
    ? `<p>Questions? Message ${esc(site.name)} on <a href="https://wa.me/${num}">WhatsApp</a>.</p>`
    : `<p>Questions? Reply to the store through its page.</p>`;
}

const storeLink = (site: StoreInfo) => `${siteUrl()}/forums/${site.slug}`;
const trackLink = (site: StoreInfo, order: OrderInfo) =>
  `${storeLink(site)}?order=${encodeURIComponent(order.order_code)}`;
const receiptLink = (site: StoreInfo, order: OrderInfo) =>
  `${siteUrl()}/receipt/${encodeURIComponent(order.order_code)}?slug=${encodeURIComponent(site.slug)}&email=${encodeURIComponent(order.buyer_email)}`;

async function send(order: OrderInfo, subject: string, body: string, site: StoreInfo) {
  const track = trackLink(site, order);
  const trackNote = `<p style="font-size:13px;margin-top:12px">Track this order any time: <a href="${esc(track)}">${esc(order.order_code)}</a></p>`;
  // Mail to a store's customers carries the store's own name, logo and colour.
  const brand = await loadSiteBrand(site);
  return sendSystemEmail({
    to: order.buyer_email,
    subject: `${site.name}: ${subject} (${order.order_code})`,
    html: emailShell(`${body}${trackNote}`, 'Track order', track, brand),
  });
}

/** Sent right after an order is placed. */
export async function emailOrderReceived(site: StoreInfo, order: OrderInfo) {
  const cur = site.currency || 'NGN';
  const payHow =
    order.payment_method === 'pay_on_delivery'
      ? '<p>You chose <strong>pay on delivery</strong>. Have the amount ready when your order arrives.</p>'
      : order.payment_status === 'proof_submitted'
      ? '<p>We have your payment details and the store will confirm your payment soon.</p>'
      : `<p>To pay by bank transfer, send <strong>${esc(formatMoney(order.total_amount, cur))}</strong> to:</p>
         <p style="background:#f4f4f5;padding:12px;border-radius:8px">${esc(site.bank_name)}<br/>${esc(site.bank_account_number)}<br/>${esc(site.bank_account_name)}<br/>Reference: <strong>${esc(order.order_code)}</strong></p>
         ${site.payment_instructions ? `<p>${esc(site.payment_instructions)}</p>` : ''}`;
  return send(order, 'we received your order', `<h2>Thanks, ${esc(order.buyer_name.split(' ')[0])}!</h2><p>We received your order <strong>${esc(order.order_code)}</strong> from ${esc(site.name)}.</p>${itemsHtml(order, cur)}${payHow}${contactLine(site)}`, site);
}

const FULFILMENT_TEXT: Record<string, [string, string]> = {
  processing: ['is being prepared', 'The store is getting your order ready.'],
  shipped: ['is on its way', 'Your order has been sent out.'],
  completed: ['was delivered', 'Your order is complete. Thank you for shopping with us.'],
  cancelled: ['was cancelled', 'This order has been cancelled. If you did not expect this, please contact the store.'],
};

/**
 * Sent when the store owner changes an order's payment or delivery status.
 * `downloads` are the digital items, included only once payment is confirmed.
 */
export async function emailOrderUpdate(
  site: StoreInfo,
  order: OrderInfo,
  change: { payment?: string; fulfillment?: string },
  downloads: { title: string; url: string }[] = []
) {
  const cur = site.currency || 'NGN';
  const first = esc(order.buyer_name.split(' ')[0]);

  if (change.payment === 'paid') {
    const dl = downloads.length
      ? `<p><strong>Your downloads</strong></p><ul style="padding-left:18px">${downloads.map((d) => `<li><a href="${esc(d.url)}">${esc(d.title)}</a></li>`).join('')}</ul>`
      : '';
    const rcpt = `<p><a href="${esc(receiptLink(site, order))}">View or print receipt (PDF)</a></p>`;
    return send(order, 'payment confirmed', `<h2>Payment confirmed</h2><p>Hi ${first}, ${esc(site.name)} confirmed your payment for order <strong>${esc(order.order_code)}</strong>. Thank you!</p>${itemsHtml(order, cur)}${dl}${rcpt}${contactLine(site)}`, site);
  }
  if (change.payment === 'rejected') {
    return send(order, 'we could not confirm your payment', `<h2>Payment not confirmed</h2><p>Hi ${first}, ${esc(site.name)} could not confirm the payment for order <strong>${esc(order.order_code)}</strong>. Please check the transfer and contact the store.</p>${contactLine(site)}`, site);
  }
  if (change.fulfillment && FULFILMENT_TEXT[change.fulfillment]) {
    const [verb, line] = FULFILMENT_TEXT[change.fulfillment];
    return send(order, `your order ${verb}`, `<h2>Your order ${verb}</h2><p>Hi ${first}, order <strong>${esc(order.order_code)}</strong>: ${line}</p>${itemsHtml(order, cur)}${contactLine(site)}`, site);
  }
}
