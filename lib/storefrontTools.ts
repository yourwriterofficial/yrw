/**
 * Pure client/server helpers for Developa storefront & owner tools.
 * Keeps heavy formatting, currency previews, tax/wholesale math,
 * and printable slip generation out of UI components and off the server.
 */

export type PreviewCurrency = 'NGN' | 'USD' | 'GBP' | 'EUR';

const APPROX_RATES: Record<PreviewCurrency, number> = {
  NGN: 1,
  USD: 1 / 1600,
  GBP: 1 / 2050,
  EUR: 1 / 1750,
};

const SYMBOLS: Record<PreviewCurrency, string> = {
  NGN: '₦',
  USD: '$',
  GBP: '£',
  EUR: '€',
};

export function formatPreviewCurrency(amountNgn: number, target: PreviewCurrency): string {
  const converted = amountNgn * (APPROX_RATES[target] ?? 1);
  if (target === 'NGN') return `₦${Math.round(converted).toLocaleString('en-NG')}`;
  return `${SYMBOLS[target]}${converted.toFixed(2)}`;
}

export function wholesaleUnitPrice(basePrice: number, qty: number, tiers?: { min_qty: number; unit_price: number }[]): number {
  if (!tiers || tiers.length === 0) return basePrice;
  const matched = [...tiers]
    .filter((t) => qty >= t.min_qty && t.unit_price > 0)
    .sort((a, b) => b.min_qty - a.min_qty)[0];
  return matched ? matched.unit_price : basePrice;
}

export function computeTaxAndFee(subtotal: number, taxPct = 0, serviceFeeNgn = 0): { tax: number; fee: number; total: number } {
  const tax = taxPct > 0 ? Math.round(((subtotal * taxPct) / 100) * 100) / 100 : 0;
  const fee = serviceFeeNgn > 0 ? serviceFeeNgn : 0;
  return { tax, fee, total: subtotal + tax + fee };
}

export function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function openPrintWindow(title: string, bodyHtml: string): void {
  if (typeof window === 'undefined') return;
  const w = window.open('', '_blank', 'width=820,height=720');
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #111; max-width: 720px; margin: 0 auto; }
    h1, h2, h3 { margin: 0 0 8px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; font-size: 13px; }
    .muted { color: #555; font-size: 12px; }
    @media print { button { display: none; } }
  </style></head><body>${bodyHtml}<div style="margin-top:24px"><button onclick="window.print()">Print / Save PDF</button></div></body></html>`);
  w.document.close();
}

export function buildPackingSlipHtml(p: {
  siteName: string;
  orderCode: string;
  buyerName: string;
  buyerPhone: string;
  deliveryAddress: string;
  items: { title: string; qty: number; variant?: string }[];
}): string {
  const rows = p.items
    .map(
      (i) =>
        `<tr><td>${escapeHtml(i.title)}${i.variant ? ` (${escapeHtml(i.variant)})` : ''}</td><td>${i.qty}</td></tr>`
    )
    .join('');
  return `
    <h2>${escapeHtml(p.siteName)} — Packing Slip</h2>
    <p class="muted">Order: <strong>${escapeHtml(p.orderCode)}</strong></p>
    <p><strong>Deliver to:</strong> ${escapeHtml(p.buyerName)} (${escapeHtml(p.buyerPhone)})<br/>${escapeHtml(p.deliveryAddress || 'Store Pickup')}</p>
    <table><thead><tr><th>Item</th><th>Qty</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="muted">Thank you for your order.</p>
  `;
}

export function formatWhatsAppBroadcastList(phones: string[]): string {
  const cleaned = phones
    .map((p) => p.replace(/[^\d+]/g, ''))
    .filter((p) => p.length >= 10);
  return Array.from(new Set(cleaned)).join('\n');
}
