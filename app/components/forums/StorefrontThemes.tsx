'use client';

import { useState } from 'react';
import {
  ShoppingCart, Plus, Package, Download, Briefcase, Flame, ShieldCheck, Truck, Zap, Tag, MessageCircle, Share2, Check, Star,
} from 'lucide-react';
import { formatMoney, type ForumSummary, type SiteProduct } from '@/lib/forums';
import type { StoreLayoutStyle } from '@/lib/siteTemplates';
import { buildProductShareUrl, buildProductWaHref } from '@/app/components/forums/ProductDetailModal';

function discountPercent(price: number, compareAt: number | null): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

function typeMeta(t: SiteProduct['product_type']) {
  if (t === 'digital') return { label: 'Digital', Icon: Download };
  if (t === 'service') return { label: 'Service', Icon: Briefcase };
  return { label: 'Physical', Icon: Package };
}

export function StorefrontHeroAndTrust({
  site,
  layoutStyle,
  categories,
  selectedCategory,
  onSelectCategory,
}: {
  site: ForumSummary;
  layoutStyle: StoreLayoutStyle;
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (c: string) => void;
}) {
  if (layoutStyle === 'jumia') {
    return (
      <div className="space-y-3">
        {/* Jumia-style top orange flash banner */}
        <div className="rounded-xl bg-[#f68b1e] text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
          <span className="flex items-center gap-1.5 uppercase tracking-wide">
            <Zap className="w-4 h-4 fill-white" /> Flash Sales · Official {site.name} Store
          </span>
          <span className="font-mono bg-black/20 px-2.5 py-0.5 rounded">PAY ON DELIVERY & TRANSFER</span>
        </div>

        {/* Jumia-style Category Sidebar + Hero Deal Banner */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          <aside className="bg-card border border-theme rounded-xl p-3 space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-secondary px-2 pb-1">Categories</p>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => onSelectCategory(cat)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center justify-between ${
                  selectedCategory === cat
                    ? 'bg-[#f68b1e]/15 text-[#f68b1e] font-bold'
                    : 'text-secondary hover:bg-primary hover:text-primary'
                }`}
              >
                <span>{cat}</span>
                <Tag className="w-3 h-3 opacity-50" />
              </button>
            ))}
          </aside>

          <div className="lg:col-span-3 rounded-xl bg-gradient-to-br from-[#f68b1e] via-[#e67812] to-[#b85305] text-white p-6 sm:p-8 flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <span className="inline-block px-2.5 py-0.5 rounded bg-black/25 text-[10px] font-bold uppercase tracking-wider">
                Top Deals Today
              </span>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                {site.hero_headline || site.name}
              </h2>
              {site.hero_subheadline && (
                <p className="text-sm text-white/90 max-w-xl">{site.hero_subheadline}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-4 text-xs font-semibold text-white/95 pt-2">
              <span className="flex items-center gap-1.5"><Truck className="w-4 h-4" /> Fast Delivery</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> Verified Store</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (layoutStyle === 'temu') {
    return (
      <div className="space-y-3">
        {/* Temu-style vibrant deal strip */}
        <div className="rounded-xl bg-gradient-to-r from-[#fb7701] to-[#ff3b30] text-white p-5 sm:p-6 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider bg-black/20 px-2.5 py-1 rounded-full">
              <Flame className="w-3.5 h-3.5 fill-yellow-300 text-yellow-300" /> Lightning Deals
            </span>
            <span className="text-[11px] font-bold">Limited Stock · Direct Deals</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            {site.hero_headline || site.name}
          </h2>
          {site.hero_subheadline && (
            <p className="text-xs sm:text-sm text-white/90 max-w-2xl">{site.hero_subheadline}</p>
          )}
        </div>

        {/* Temu-style trust bar */}
        <div className="grid grid-cols-3 gap-2 text-center bg-card border border-theme rounded-xl p-2.5 text-[11px] font-semibold text-secondary">
          <span className="flex items-center justify-center gap-1 text-emerald-400"><ShieldCheck className="w-3.5 h-3.5" /> Buyer Protection</span>
          <span className="flex items-center justify-center gap-1 text-[#fb7701]"><Zap className="w-3.5 h-3.5" /> Flash Discounts</span>
          <span className="flex items-center justify-center gap-1 text-cyan-400"><Truck className="w-3.5 h-3.5" /> Fast Dispatch</span>
        </div>
      </div>
    );
  }

  // Standard clean layout
  if (!site.hero_headline && !site.hero_subheadline) return null;
  return (
    <div
      className="rounded-2xl border border-theme p-6 sm:p-8 bg-card space-y-2"
      style={{ borderLeftWidth: 4, borderLeftColor: site.accent_color || '#06b6d4' }}
    >
      <h2 className="text-xl sm:text-2xl font-black tracking-tight text-primary">
        {site.hero_headline || site.name}
      </h2>
      {site.hero_subheadline && (
        <p className="text-sm text-secondary max-w-2xl">{site.hero_subheadline}</p>
      )}
    </div>
  );
}

export function StoreProductCard({
  site,
  product,
  currency,
  layoutStyle,
  onAdd,
  onOpen,
  catalogue = false,
}: {
  site: ForumSummary;
  product: SiteProduct;
  currency: string;
  layoutStyle: StoreLayoutStyle;
  onAdd: (p: SiteProduct) => void;
  onOpen: (p: SiteProduct) => void;
  /** Advertise mode: the button sends the buyer to WhatsApp instead of the cart. */
  catalogue?: boolean;
}) {
  const cta = (label: string) => (catalogue ? 'Order on WhatsApp' : label);
  const [copied, setCopied] = useState(false);
  const { label, Icon } = typeMeta(product.product_type);
  const pct = discountPercent(Number(product.price), product.compare_at_price ? Number(product.compare_at_price) : null);
  const outOfStock = product.stock_qty !== null && product.stock_qty <= 0;
  const lowStock = product.stock_qty !== null && product.stock_qty > 0 && product.stock_qty <= 3;
  const waHref = buildProductWaHref(site, product);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = buildProductShareUrl(site.slug, product.id);
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: product.title, text: `Check out ${product.title} on ${site.name}`, url });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const ratingChip = (product.rating_count || 0) > 0 ? (
    <p className="inline-flex items-center gap-1 text-[11px] text-secondary mt-1">
      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
      <span className="font-semibold text-primary">{Number(product.rating_avg || 0).toFixed(1)}</span>
      <span>({product.rating_count})</span>
    </p>
  ) : null;

  const quickActions = (
    <div className="flex items-center gap-2 pt-1.5">
      {waHref && (
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-h-9 px-2.5 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-semibold inline-flex items-center justify-center gap-1 transition truncate"
        >
          <MessageCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Ask on WhatsApp</span>
        </a>
      )}
      <button
        type="button"
        onClick={handleShare}
        aria-label={`Share ${product.title}`}
        className="min-h-9 px-2.5 py-1.5 rounded-lg border border-theme hover:bg-hover text-secondary hover:text-primary text-[11px] font-medium inline-flex items-center justify-center gap-1 transition cursor-pointer shrink-0"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Share2 className="w-3.5 h-3.5" />}
        <span>{copied ? 'Copied' : 'Share'}</span>
      </button>
    </div>
  );

  if (layoutStyle === 'jumia') {
    return (
      <div className="bg-card border border-theme hover:border-[#f68b1e]/60 rounded-xl overflow-hidden flex flex-col justify-between transition group">
        <button type="button" onClick={() => onOpen(product)} className="relative text-left w-full cursor-pointer">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt={product.title} className="w-full h-40 object-cover bg-secondary/20" />
          ) : (
            <div className="w-full h-36 bg-secondary/20 flex items-center justify-center">
              <Icon className="w-8 h-8 text-secondary/40" />
            </div>
          )}
          {pct && (
            <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-[#feefde] text-[#f68b1e] text-[11px] font-black">
              -{pct}%
            </span>
          )}
          {lowStock && (
            <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-amber-500/90 text-white text-[10px] font-bold">
              Only {product.stock_qty} left
            </span>
          )}
        </button>
        <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
          <button type="button" onClick={() => onOpen(product)} className="text-left w-full cursor-pointer">
            <p className="text-[10px] font-semibold text-secondary uppercase">{product.category}</p>
            <h3 className="font-bold text-sm text-primary line-clamp-2 leading-snug hover:text-[#f68b1e] transition-colors">{product.title}</h3>
            {ratingChip}
          </button>
          <div className="space-y-2 pt-1">
            <div>
              <p className="text-base font-black text-primary">{formatMoney(product.price, currency)}</p>
              {product.compare_at_price && product.compare_at_price > product.price && (
                <p className="text-[11px] text-secondary line-through">{formatMoney(product.compare_at_price, currency)}</p>
              )}
            </div>
            <button
              type="button"
              disabled={outOfStock}
              onClick={() => onAdd(product)}
              className="w-full min-h-10 py-2 rounded-lg bg-[#f68b1e] hover:bg-[#e07b15] disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <ShoppingCart className="w-3.5 h-3.5" /> {outOfStock ? 'Out of Stock' : cta('Add to Cart')}
            </button>
            {quickActions}
          </div>
        </div>
      </div>
    );
  }

  if (layoutStyle === 'temu') {
    return (
      <div className="bg-card border border-theme hover:border-[#fb7701]/60 rounded-xl overflow-hidden flex flex-col justify-between transition">
        <button type="button" onClick={() => onOpen(product)} className="relative text-left w-full cursor-pointer">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt={product.title} className="w-full h-40 object-cover bg-secondary/20" />
          ) : (
            <div className="w-full h-32 bg-secondary/20 flex items-center justify-center">
              <Icon className="w-8 h-8 text-secondary/40" />
            </div>
          )}
          {pct && (
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-[#fb7701] text-white text-[10px] font-black">
              -{pct}% OFF
            </span>
          )}
        </button>
        <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
          <button type="button" onClick={() => onOpen(product)} className="text-left w-full cursor-pointer">
            <h3 className="font-bold text-xs sm:text-sm text-primary line-clamp-2 hover:text-[#fb7701] transition-colors">{product.title}</h3>
            {ratingChip}
            {product.stock_qty !== null && product.stock_qty > 0 && product.stock_qty <= 10 && (
              <p className="text-[10px] font-bold text-[#fb7701] mt-0.5 flex items-center gap-1">
                <Flame className="w-3 h-3" /> Almost sold out · {product.stock_qty} left
              </p>
            )}
          </button>
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-sm font-black text-[#fb7701]">{formatMoney(product.price, currency)}</span>
                {product.compare_at_price && product.compare_at_price > product.price && (
                  <span className="text-[10px] text-secondary line-through ml-1.5">
                    {formatMoney(product.compare_at_price, currency)}
                  </span>
                )}
              </div>
              <button
                type="button"
                disabled={outOfStock}
                onClick={() => onAdd(product)}
                className="min-h-9 px-2.5 py-1.5 rounded-full bg-[#fb7701] hover:bg-[#e56800] disabled:opacity-50 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> {outOfStock ? 'Sold' : cta('Buy')}
              </button>
            </div>
            {quickActions}
          </div>
        </div>
      </div>
    );
  }

  if (layoutStyle === 'portfolio') {
    const forService = product.product_type === 'service';
    return (
      <div className="group bg-card border border-theme rounded-3xl overflow-hidden flex flex-col">
        <button type="button" onClick={() => onOpen(product)} className="relative text-left w-full cursor-pointer">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt={product.title} className="w-full aspect-[4/3] object-cover bg-secondary/20 group-hover:scale-[1.02] transition-transform duration-300" />
          ) : (
            <div className="w-full aspect-[4/3] flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${site.accent_color || '#1a56db'}33, ${site.accent_color || '#1a56db'}0d)` }}>
              <Icon className="w-10 h-10 text-secondary/50" />
            </div>
          )}
          {product.category && (
            <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-card/90 text-[11px] font-medium text-primary backdrop-blur">{product.category}</span>
          )}
        </button>
        <div className="p-4 sm:p-5 flex-1 flex flex-col gap-3">
          <button type="button" onClick={() => onOpen(product)} className="text-left cursor-pointer">
            <h3 className="font-medium text-primary text-base sm:text-lg leading-snug">{product.title}</h3>
            {product.description && <p className="text-sm text-secondary line-clamp-2 mt-1">{product.description}</p>}
            {ratingChip}
          </button>
          <div className="mt-auto flex items-center justify-between gap-2">
            <span className="text-primary font-medium">{forService ? 'From ' : ''}{formatMoney(product.price, currency)}</span>
            <button
              type="button"
              disabled={outOfStock}
              onClick={() => onAdd(product)}
              className="min-h-10 px-5 rounded-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-[var(--accent-foreground)] text-sm font-medium cursor-pointer"
            >
              {outOfStock ? 'Unavailable' : cta(forService ? 'Book' : 'Buy')}
            </button>
          </div>
          {quickActions}
        </div>
      </div>
    );
  }

  if (layoutStyle === 'classified') {
    return (
      <div className="bg-card border border-theme rounded-2xl overflow-hidden flex flex-col">
        <button type="button" onClick={() => onOpen(product)} className="relative text-left w-full cursor-pointer">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt={product.title} className="w-full h-44 object-cover bg-secondary/20" />
          ) : (
            <div className="w-full h-36 bg-secondary/20 flex items-center justify-center">
              <Icon className="w-8 h-8 text-secondary/40" />
            </div>
          )}
          {outOfStock && <span className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-black/70 text-white text-[11px] font-semibold">Sold</span>}
        </button>
        <div className="p-4 flex-1 flex flex-col gap-2">
          <button type="button" onClick={() => onOpen(product)} className="text-left cursor-pointer">
            <p className="text-xs text-secondary">{product.category}</p>
            <h3 className="font-medium text-primary leading-snug line-clamp-2">{product.title}</h3>
          </button>
          <p className="text-lg font-semibold text-primary">{formatMoney(product.price, currency)}</p>
          <div className="mt-auto flex items-center gap-2 pt-1">
            {waHref ? (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex-1 min-h-10 px-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4" /> Contact seller
              </a>
            ) : null}
            <button
              type="button"
              disabled={outOfStock}
              onClick={() => onAdd(product)}
              className="min-h-10 px-4 rounded-full border border-theme hover:bg-hover disabled:opacity-50 text-xs font-semibold cursor-pointer"
            >
              {outOfStock ? 'Sold' : cta('Buy now')}
            </button>
            <button type="button" onClick={handleShare} aria-label={`Share ${product.title}`} className="min-h-10 w-10 rounded-full border border-theme hover:bg-hover inline-flex items-center justify-center cursor-pointer">
              {copied ? <Check className="w-4 h-4 text-success" /> : <Share2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (layoutStyle === 'shopify') {
    return (
      <div className="group flex flex-col">
        <button type="button" onClick={() => onOpen(product)} className="relative block w-full cursor-pointer overflow-hidden bg-secondary/20">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt={product.title} className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full aspect-square flex items-center justify-center"><Icon className="w-10 h-10 text-secondary/40" /></div>
          )}
          {pct && <span className="absolute top-2 left-2 px-2.5 py-1 bg-primary text-primary text-[11px] font-medium border border-theme rounded-full">Sale</span>}
          {outOfStock && <span className="absolute top-2 right-2 px-2.5 py-1 bg-primary text-secondary text-[11px] font-medium border border-theme rounded-full">Sold out</span>}
        </button>
        <button type="button" onClick={() => onOpen(product)} className="text-center mt-3 cursor-pointer">
          <h3 className="text-sm text-primary group-hover:underline underline-offset-4">{product.title}</h3>
          <p className="text-sm text-secondary mt-1">
            {formatMoney(product.price, currency)}
            {product.compare_at_price && product.compare_at_price > product.price && (
              <span className="line-through ml-2 text-xs">{formatMoney(product.compare_at_price, currency)}</span>
            )}
          </p>
        </button>
        <button
          type="button"
          disabled={outOfStock}
          onClick={() => onAdd(product)}
          className="mt-3 w-full min-h-11 border border-[var(--text-primary)] text-primary hover:bg-[var(--text-primary)] hover:text-[var(--bg-primary)] disabled:opacity-40 text-sm transition cursor-pointer"
        >
          {outOfStock ? 'Sold out' : cta('Add to cart')}
        </button>
      </div>
    );
  }

  if (layoutStyle === 'selar') {
    return (
      <div className="bg-card border border-theme rounded-2xl overflow-hidden flex flex-col shadow-sm hover:shadow-md transition">
        <button type="button" onClick={() => onOpen(product)} className="relative block w-full cursor-pointer">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt={product.title} className="w-full aspect-[16/10] object-cover bg-secondary/20" />
          ) : (
            <div className="w-full aspect-[16/10] flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${site.accent_color || '#2563eb'}40, ${site.accent_color || '#2563eb'}10)` }}>
              <Icon className="w-10 h-10 text-secondary/50" />
            </div>
          )}
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-card/95 text-[11px] font-medium text-primary">
            <Icon className="w-3 h-3" /> {product.product_type === 'digital' ? 'Instant access' : label}
          </span>
          {pct && <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-accent text-[var(--accent-foreground)] text-[11px] font-semibold">{pct}% off</span>}
        </button>
        <div className="p-4 flex flex-col gap-2 flex-1">
          <button type="button" onClick={() => onOpen(product)} className="text-left cursor-pointer">
            <h3 className="font-semibold text-primary leading-snug">{product.title}</h3>
            {product.description && <p className="text-sm text-secondary line-clamp-2 mt-1">{product.description}</p>}
            {ratingChip}
          </button>
          <div className="mt-auto pt-2">
            <p className="mb-2">
              <span className="text-xl font-bold text-primary">{formatMoney(product.price, currency)}</span>
              {product.compare_at_price && product.compare_at_price > product.price && (
                <span className="text-sm text-secondary line-through ml-2">{formatMoney(product.compare_at_price, currency)}</span>
              )}
            </p>
            <button
              type="button"
              disabled={outOfStock}
              onClick={() => onAdd(product)}
              className="w-full min-h-11 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-50 text-[var(--accent-foreground)] text-sm font-semibold cursor-pointer"
            >
              {outOfStock ? 'Unavailable' : cta(product.product_type === 'digital' ? 'Get it now' : 'Buy now')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Standard clean card
  return (
    <div className="bg-card border border-theme rounded-2xl overflow-hidden flex flex-col justify-between">
      <button type="button" onClick={() => onOpen(product)} className="text-left w-full cursor-pointer">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt={product.title} className="w-full h-44 object-cover bg-secondary/20" />
        ) : (
          <div className="w-full h-32 bg-secondary/20 flex items-center justify-center">
            <Icon className="w-8 h-8 text-secondary/40" />
          </div>
        )}
      </button>
      <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
        <button type="button" onClick={() => onOpen(product)} className="space-y-1.5 text-left w-full cursor-pointer">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-cyan-400 bg-cyan-500/10">
              <Icon className="w-3 h-3" /> {label}
            </span>
            <span className="text-[11px] text-secondary">{product.category}</span>
          </div>
          <h3 className="font-bold text-primary text-base leading-snug hover:text-accent transition-colors">{product.title}</h3>
          {ratingChip}
          {product.description && <p className="text-xs text-secondary line-clamp-2">{product.description}</p>}
        </button>

        <div className="pt-3 border-t border-theme space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-base font-black text-primary">{formatMoney(product.price, currency)}</span>
              {product.compare_at_price && product.compare_at_price > product.price && (
                <span className="text-xs text-secondary line-through ml-2">
                  {formatMoney(product.compare_at_price, currency)}
                </span>
              )}
            </div>
            <button
              type="button"
              disabled={outOfStock}
              onClick={() => onAdd(product)}
              className="min-h-9 px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> {outOfStock ? 'Sold Out' : cta('Add')}
            </button>
          </div>
          {quickActions}
        </div>
      </div>
    </div>
  );
}
