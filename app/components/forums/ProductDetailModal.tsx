'use client';

import { useState, useEffect } from 'react';
import { X, ShoppingCart, MessageCircle, Share2, Check } from 'lucide-react';
import { formatMoney, type ForumSummary, type SiteProduct } from '@/lib/forums';
import { waLink } from '@/lib/phone';

export function buildProductShareUrl(slug: string, productId: string): string {
  if (typeof window === 'undefined') return `/forums/${slug}?product=${productId}`;
  const path = window.location.pathname.startsWith('/forums/') ? `/forums/${slug}` : window.location.pathname;
  return `${window.location.origin}${path}?product=${encodeURIComponent(productId)}`;
}

export function buildProductWaHref(site: ForumSummary, product: SiteProduct, priceOverride?: number): string | null {
  if (!site.whatsapp_number) return null;
  const currency = site.currency || 'NGN';
  const price = priceOverride ?? Number(product.price);
  const link = buildProductShareUrl(site.slug, product.id);
  const msg = `Hi ${site.name}, I want to ask about "${product.title}" (${formatMoney(price, currency)}): ${link}`;
  return waLink(site.whatsapp_number, msg);
}

export default function ProductDetailModal({
  site,
  product,
  onClose,
  onAddToCart,
}: {
  site: ForumSummary;
  product: SiteProduct;
  onClose: () => void;
  onAddToCart: (product: SiteProduct) => void;
}) {
  const [copied, setCopied] = useState(false);
  const currency = site.currency || 'NGN';
  const outOfStock = product.stock_qty !== null && product.stock_qty <= 0;
  const waHref = buildProductWaHref(site, product);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleShare = async () => {
    const url = buildProductShareUrl(site.slug, product.id);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback for non-clipboard contexts
      if (typeof navigator !== 'undefined' && 'share' in navigator) {
        navigator.share({ title: product.title, url }).catch(() => {});
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-modal-title"
    >
      <div
        className="w-full sm:max-w-2xl bg-primary border border-theme rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3.5 bg-primary/95 backdrop-blur border-b border-theme">
          <span className="text-xs text-secondary truncate">{product.category || 'General'}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close product details"
            className="w-10 h-10 rounded-full hover:bg-hover flex items-center justify-center text-secondary hover:text-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image_url}
              alt={product.title}
              className="w-full max-h-80 object-cover rounded-2xl border border-theme bg-secondary/20"
            />
          ) : null}

          <div className="space-y-2">
            <h2 id="product-modal-title" className="text-xl sm:text-2xl font-bold text-primary leading-snug">
              {product.title}
            </h2>
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-2xl font-black text-primary">{formatMoney(product.price, currency)}</span>
              {product.compare_at_price && Number(product.compare_at_price) > Number(product.price) && (
                <span className="text-sm text-secondary line-through">
                  {formatMoney(product.compare_at_price, currency)}
                </span>
              )}
              {product.stock_qty !== null && (
                <span className={`text-xs font-medium ${outOfStock ? 'text-danger' : 'text-secondary'}`}>
                  {outOfStock ? 'Out of stock' : `${product.stock_qty} in stock`}
                </span>
              )}
            </div>
            {product.description && (
              <p className="text-sm text-secondary whitespace-pre-line leading-relaxed pt-1">{product.description}</p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <button
              type="button"
              disabled={outOfStock}
              onClick={() => { onAddToCart(product); onClose(); }}
              className="flex-1 min-h-11 px-5 py-2.5 rounded-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-[var(--accent-foreground)] text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              {outOfStock ? 'Sold out' : 'Add to cart'}
            </button>

            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-11 px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center justify-center gap-2 transition"
              >
                <MessageCircle className="w-4 h-4" />
                Ask on WhatsApp
              </a>
            )}

            <button
              type="button"
              onClick={handleShare}
              className="min-h-11 px-4 py-2.5 rounded-full border border-theme hover:bg-hover text-primary text-sm font-medium flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-success" /> : <Share2 className="w-4 h-4" />}
              {copied ? 'Copied' : 'Share'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
