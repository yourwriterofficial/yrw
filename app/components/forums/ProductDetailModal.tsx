'use client';

import { useState, useEffect } from 'react';
import { X, ShoppingCart, MessageCircle, Share2, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMoney, type ForumSummary, type ProductVariant, type SiteProduct } from '@/lib/forums';
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

export function productImages(product: SiteProduct): string[] {
  const list = Array.isArray(product.image_urls) && product.image_urls.length > 0
    ? product.image_urls
    : product.image_url ? [product.image_url] : [];
  return Array.from(new Set(list.filter(Boolean)));
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
  onAddToCart: (product: SiteProduct, variant?: ProductVariant) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const activeVariants = (product.variants || []).filter((v) => v.is_active);
  const [selectedVariantId, setSelectedVariantId] = useState<string>(activeVariants[0]?.id || '');
  const selectedVariant = activeVariants.find((v) => v.id === selectedVariantId) || activeVariants[0];

  const images = productImages(product);
  const currency = site.currency || 'NGN';
  const effectivePrice = selectedVariant ? Number(selectedVariant.price) : Number(product.price);
  const effectiveStock = selectedVariant ? selectedVariant.stock_qty : product.stock_qty;
  const outOfStock = effectiveStock !== null && effectiveStock <= 0;
  const waHref = buildProductWaHref(site, product, effectivePrice);

  useEffect(() => {
    setPhotoIdx(0);
    const list = (product.variants || []).filter((v) => v.is_active);
    const firstInStock = list.find((v) => v.stock_qty === null || v.stock_qty > 0) || list[0];
    setSelectedVariantId(firstInStock?.id || '');
  }, [product]);

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
      if (typeof navigator !== 'undefined' && 'share' in navigator) {
        navigator.share({ title: product.title, url }).catch(() => {});
      }
    }
  };

  const activePhoto = images[photoIdx] || images[0] || '';

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
          {activePhoto && (
            <div className="space-y-2.5">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activePhoto}
                  alt={product.title}
                  className="w-full max-h-80 object-cover rounded-2xl border border-theme bg-secondary/20"
                />
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="Previous photo"
                      onClick={() => setPhotoIdx((i) => (i - 1 + images.length) % images.length)}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Next photo"
                      onClick={() => setPhotoIdx((i) => (i + 1) % images.length)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto g-scroll-x pb-1">
                  {images.map((url, idx) => (
                    <button
                      key={url + idx}
                      type="button"
                      onClick={() => setPhotoIdx(idx)}
                      className={`shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition cursor-pointer ${
                        idx === photoIdx ? 'border-accent' : 'border-theme opacity-70 hover:opacity-100'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <h2 id="product-modal-title" className="text-xl sm:text-2xl font-bold text-primary leading-snug">
              {product.title}
            </h2>
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-2xl font-black text-primary">{formatMoney(effectivePrice, currency)}</span>
              {!selectedVariant && product.compare_at_price && Number(product.compare_at_price) > Number(product.price) && (
                <span className="text-sm text-secondary line-through">
                  {formatMoney(product.compare_at_price, currency)}
                </span>
              )}
              {effectiveStock !== null && (
                <span className={`text-xs font-medium ${outOfStock ? 'text-danger' : 'text-secondary'}`}>
                  {outOfStock ? 'Sold out' : `${effectiveStock} in stock`}
                </span>
              )}
            </div>
            {activeVariants.length > 0 && (
              <div className="pt-2 space-y-2">
                <p className="text-xs font-medium text-secondary">
                  {(product.variant_options && product.variant_options.length > 0) ? product.variant_options.join(' / ') : 'Choose option'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {activeVariants.map((v) => {
                    const soldOut = v.stock_qty !== null && v.stock_qty <= 0;
                    const chosen = selectedVariant?.id === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVariantId(v.id)}
                        className={`min-h-10 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
                          chosen
                            ? 'bg-accent text-[var(--accent-foreground)] border-accent'
                            : soldOut
                            ? 'border-theme text-secondary opacity-55 line-through'
                            : 'border-theme bg-card text-primary hover:bg-hover'
                        }`}
                      >
                        {v.label}{soldOut ? ' (sold out)' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {product.description && (
              <p className="text-sm text-secondary whitespace-pre-line leading-relaxed pt-1">{product.description}</p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <button
              type="button"
              disabled={outOfStock}
              onClick={() => { onAddToCart(product, selectedVariant); onClose(); }}
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
