'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import { formatMoney, type SiteOrder } from '@/lib/forums';

interface ReceiptSite {
  slug: string;
  name: string;
  logo_url?: string;
  currency?: string;
  whatsapp_number?: string;
  custom_domain?: string | null;
  custom_domain_verified?: boolean;
}

function OrderReceiptContent() {
  const { orderCode } = useParams<{ orderCode: string }>();
  const sp = useSearchParams();
  const [emailInput, setEmailInput] = useState(sp.get('email') || '');
  const slugParam = sp.get('slug') || '';
  const [loading, setLoading] = useState(!!sp.get('email'));
  const [error, setError] = useState('');
  const [site, setSite] = useState<ReceiptSite | null>(null);
  const [order, setOrder] = useState<SiteOrder | null>(null);
  const [downloads, setDownloads] = useState<{ title: string; url: string }[]>([]);

  const load = async (emailVal: string) => {
    if (!orderCode || !emailVal.trim()) return;
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ email: emailVal.trim().toLowerCase() });
      if (slugParam) qs.set('slug', slugParam);
      const res = await fetch(`/api/receipt/${encodeURIComponent(orderCode)}?${qs.toString()}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.order) {
        setError(data.error || 'Receipt not found.');
        setOrder(null);
      } else {
        setSite(data.site);
        setOrder(data.order);
        setDownloads(data.downloads || []);
      }
    } catch {
      setError('Could not load receipt.');
    }
    setLoading(false);
  };

  useEffect(() => {
    const emailFromUrl = sp.get('email');
    if (emailFromUrl) load(emailFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderCode]);

  if (loading) {
    return <div className="min-h-screen bg-primary text-primary flex items-center justify-center text-sm text-secondary">Loading receipt…</div>;
  }

  if (!order || !site) {
    return (
      <div className="min-h-screen bg-primary text-primary flex items-center justify-center p-4">
        <form
          onSubmit={(e) => { e.preventDefault(); load(emailInput); }}
          className="g-card p-6 w-full max-w-md space-y-4"
        >
          <h1 className="g-h3">Open receipt {orderCode}</h1>
          <p className="text-sm text-secondary">Confirm the email address used when placing this order.</p>
          <input
            type="email"
            required
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="you@example.com"
            aria-label="Order email address"
            className="input-box w-full text-sm"
          />
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          <button type="submit" className="w-full h-11 rounded-full bg-accent text-[var(--accent-foreground)] text-sm font-semibold">
            View receipt
          </button>
        </form>
      </div>
    );
  }

  const currency = site.currency || 'NGN';
  const discount = Number(order.discount_amount || 0);
  const shipping = Number(order.shipping_fee || 0);

  return (
    <div className="min-h-screen bg-primary text-primary py-8 px-4 print:bg-white print:text-black print:py-0">
      <style>{`@media print { @page { size: A4; margin: 14mm; } }`}</style>
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3 print:hidden">
          <a href={`/forums/${site.slug}`} className="text-sm text-accent hover:underline">Back to {site.name}</a>
          <button
            type="button"
            onClick={() => window.print()}
            className="h-10 px-5 rounded-full bg-accent text-[var(--accent-foreground)] text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Print or save as PDF
          </button>
        </div>

        <article className="g-card p-6 sm:p-8 space-y-6 print:border print:border-zinc-300 print:shadow-none print:rounded-none">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-theme pb-5">
            <div className="flex items-center gap-3">
              {site.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={site.logo_url} alt={site.name} className="w-12 h-12 rounded-xl object-cover border border-theme" />
              )}
              <div>
                <h1 className="text-xl font-bold">{site.name}</h1>
                <p className="text-xs text-secondary">{site.custom_domain && site.custom_domain_verified ? site.custom_domain : `${site.slug}.developa.me`}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-secondary">Receipt</p>
              <p className="font-mono font-bold text-base">{order.order_code}</p>
              <p className="text-xs text-secondary">{new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-secondary">Billed to</p>
              <p className="font-medium mt-0.5">{order.buyer_name}</p>
              <p className="text-secondary text-xs">{order.buyer_email}</p>
              {order.buyer_phone && <p className="text-secondary text-xs">{order.buyer_phone}</p>}
              {order.delivery_address && <p className="text-secondary text-xs mt-1">{order.delivery_address}</p>}
            </div>
            <div className="sm:text-right">
              <p className="text-xs text-secondary">Payment status</p>
              <p className="font-semibold mt-0.5 capitalize">{order.payment_status.replace('_', ' ')}</p>
              <p className="text-xs text-secondary mt-1">{order.payment_method === 'manual_transfer' ? 'Bank transfer' : 'Pay on delivery'}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="border-b border-theme text-xs text-secondary">
                <tr>
                  <th className="py-2 pr-3 font-medium">Item</th>
                  <th className="py-2 px-3 font-medium text-right">Qty</th>
                  <th className="py-2 px-3 font-medium text-right">Unit price</th>
                  <th className="py-2 pl-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme">
                {order.items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 pr-3">{it.title}</td>
                    <td className="py-2.5 px-3 text-right">{it.qty}</td>
                    <td className="py-2.5 px-3 text-right">{formatMoney(it.price, currency)}</td>
                    <td className="py-2.5 pl-3 text-right font-medium">{formatMoney(Number(it.price) * it.qty, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-theme pt-4 space-y-1.5 text-sm max-w-xs ml-auto">
            <div className="flex justify-between text-secondary">
              <span>Subtotal</span>
              <span>{formatMoney(order.subtotal, currency)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-success">
                <span>Discount{order.coupon_code ? ` (${order.coupon_code})` : ''}</span>
                <span>-{formatMoney(discount, currency)}</span>
              </div>
            )}
            {shipping > 0 && (
              <div className="flex justify-between text-secondary">
                <span>Delivery{order.shipping_zone ? ` (${order.shipping_zone})` : ''}</span>
                <span>{formatMoney(shipping, currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-2 border-t border-theme">
              <span>Total</span>
              <span>{formatMoney(order.total_amount, currency)}</span>
            </div>
          </div>

          {order.payment_status === 'paid' && downloads.length > 0 && (
            <div className="border-t border-theme pt-4 text-xs space-y-1">
              <p className="font-semibold">Digital downloads</p>
              {downloads.map((d, i) => (
                <p key={i}><a href={d.url} className="text-accent underline break-all">{d.title}: {d.url}</a></p>
              ))}
            </div>
          )}
        </article>
      </div>
    </div>
  );
}

export default function OrderReceiptPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-primary text-primary flex items-center justify-center text-sm text-secondary">Loading receipt…</div>}>
      <OrderReceiptContent />
    </Suspense>
  );
}
