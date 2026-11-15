'use client';

import { useEffect, useState } from 'react';
import ReportDialog from '@/app/components/forums/ReportDialog';
import { ShieldCheck, Truck, Clock, ChevronDown, Flag, Rss } from 'lucide-react';
import { formatPreviewCurrency, type PreviewCurrency } from '@/lib/storefrontTools';

const DEFAULT_FAQS = [
  { q: 'How do I pay for my order?', a: 'You can pay via bank transfer, Pay on Delivery (where available), or Paystack card/transfer when enabled by the store.' },
  { q: 'How long does delivery take?', a: 'Orders are usually processed within 24 hours. Delivery takes 1–3 working days depending on your state.' },
  { q: 'How do I track my order?', a: 'Use the "Track order" button at the top of the store with your order code and email address.' },
];

export function StorefrontCurrencyPreview({
  sampleNgn,
  currency,
  onChange,
}: {
  sampleNgn: number;
  currency: PreviewCurrency;
  onChange: (c: PreviewCurrency) => void;
}) {
  return (
    <div className="inline-flex items-center gap-2 text-xs text-secondary">
      <span>Preview currency:</span>
      <select
        aria-label="Preview currency"
        value={currency}
        onChange={(e) => onChange(e.target.value as PreviewCurrency)}
        className="px-2.5 py-1 rounded-lg border border-theme bg-card text-primary text-xs font-medium"
      >
        <option value="NGN">NGN (₦)</option>
        <option value="USD">USD ($)</option>
        <option value="GBP">GBP (£)</option>
        <option value="EUR">EUR (€)</option>
      </select>
      {currency !== 'NGN' && sampleNgn > 0 && (
        <span className="text-[11px] text-secondary">≈ {formatPreviewCurrency(sampleNgn, currency)} sample</span>
      )}
    </div>
  );
}

export function StorefrontTrustBar() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 py-3">
      <div className="p-3 rounded-xl border border-theme bg-card/60 flex items-center gap-2.5 text-xs">
        <ShieldCheck className="w-4 h-4 text-accent shrink-0" />
        <span className="text-secondary"><strong className="text-primary">Verified checkout</strong> · Clear order tracking</span>
      </div>
      <div className="p-3 rounded-xl border border-theme bg-card/60 flex items-center gap-2.5 text-xs">
        <Truck className="w-4 h-4 text-accent shrink-0" />
        <span className="text-secondary"><strong className="text-primary">Fast dispatch</strong> · Delivery or pickup</span>
      </div>
      <div className="p-3 rounded-xl border border-theme bg-card/60 flex items-center gap-2.5 text-xs">
        <Clock className="w-4 h-4 text-accent shrink-0" />
        <span className="text-secondary"><strong className="text-primary">Direct support</strong> · Chat or WhatsApp</span>
      </div>
    </div>
  );
}

export function StorefrontFaqAccordion() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <section className="pt-6 border-t border-theme space-y-3">
      <h3 className="text-sm font-bold text-primary">Frequently asked questions</h3>
      <div className="space-y-2">
        {DEFAULT_FAQS.map((item, i) => {
          const open = openIdx === i;
          return (
            <div key={item.q} className="rounded-xl border border-theme bg-card overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenIdx(open ? null : i)}
                className="w-full px-4 py-3 text-left text-xs font-semibold text-primary flex items-center justify-between gap-2 cursor-pointer"
              >
                <span>{item.q}</span>
                <ChevronDown className={`w-4 h-4 text-secondary transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>
              {open && <p className="px-4 pb-3 text-xs text-secondary leading-relaxed">{item.a}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function FlashSaleBanner({ label = 'Flash Sale Ending Soon' }: { label?: string }) {
  const [left, setLeft] = useState(3 * 3600 + 45 * 60);
  useEffect(() => {
    const id = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);
  const h = String(Math.floor(left / 3600)).padStart(2, '0');
  const m = String(Math.floor((left % 3600) / 60)).padStart(2, '0');
  const s = String(left % 60).padStart(2, '0');
  return (
    <div className="px-4 py-2 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-between text-xs font-semibold text-accent">
      <span>{label}</span>
      <span className="font-mono">{h}:{m}:{s}</span>
    </div>
  );
}

export function StorefrontSafetyLinks({ slug }: { slug: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-4 text-[11px] text-secondary">
      <a
        href={`/api/forums/${encodeURIComponent(slug)}/feed?format=rss`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 hover:text-primary"
      >
        <Rss className="w-3 h-3" /> Store RSS feed
      </a>
      <ReportDialog slug={slug} target={{ type: 'site' }} />
    </div>
  );
}
