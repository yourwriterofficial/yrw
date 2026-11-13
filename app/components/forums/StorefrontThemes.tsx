'use client';

import {
  ShoppingCart, Plus, Package, Download, Briefcase, Flame, ShieldCheck, Truck, Zap, Tag,
} from 'lucide-react';
import { formatMoney, type ForumSummary, type SiteProduct } from '@/lib/forums';
import type { StoreLayoutStyle } from '@/lib/siteTemplates';

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
  product,
  currency,
  layoutStyle,
  onAdd,
}: {
  product: SiteProduct;
  currency: string;
  layoutStyle: StoreLayoutStyle;
  onAdd: (p: SiteProduct) => void;
}) {
  const { label, Icon } = typeMeta(product.product_type);
  const pct = discountPercent(Number(product.price), product.compare_at_price ? Number(product.compare_at_price) : null);
  const outOfStock = product.stock_qty !== null && product.stock_qty <= 0;

  if (layoutStyle === 'jumia') {
    return (
      <div className="bg-card border border-theme hover:border-[#f68b1e]/60 rounded-xl overflow-hidden flex flex-col justify-between transition group">
        <div className="relative">
          {product.image_url ? (
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
        </div>
        <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-semibold text-secondary uppercase">{product.category}</p>
            <h3 className="font-bold text-sm text-primary line-clamp-2 leading-snug">{product.title}</h3>
          </div>
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
              className="w-full py-2 rounded-lg bg-[#f68b1e] hover:bg-[#e07b15] disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <ShoppingCart className="w-3.5 h-3.5" /> {outOfStock ? 'Out of Stock' : 'Add to Cart'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (layoutStyle === 'temu') {
    return (
      <div className="bg-card border border-theme hover:border-[#fb7701]/60 rounded-xl overflow-hidden flex flex-col justify-between transition">
        <div className="relative">
          {product.image_url ? (
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
        </div>
        <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-xs sm:text-sm text-primary line-clamp-2">{product.title}</h3>
            {product.stock_qty !== null && product.stock_qty > 0 && product.stock_qty <= 10 && (
              <p className="text-[10px] font-bold text-[#fb7701] mt-0.5 flex items-center gap-1">
                <Flame className="w-3 h-3" /> Almost sold out · {product.stock_qty} left
              </p>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
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
              className="px-2.5 py-1.5 rounded-full bg-[#fb7701] hover:bg-[#e56800] disabled:opacity-50 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" /> {outOfStock ? 'Sold' : 'Buy'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Standard clean card
  return (
    <div className="bg-card border border-theme rounded-2xl overflow-hidden flex flex-col justify-between">
      {product.image_url ? (
        <img src={product.image_url} alt={product.title} className="w-full h-44 object-cover bg-secondary/20" />
      ) : (
        <div className="w-full h-32 bg-secondary/20 flex items-center justify-center">
          <Icon className="w-8 h-8 text-secondary/40" />
        </div>
      )}
      <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-cyan-400 bg-cyan-500/10">
              <Icon className="w-3 h-3" /> {label}
            </span>
            <span className="text-[11px] text-secondary">{product.category}</span>
          </div>
          <h3 className="font-bold text-primary text-base leading-snug">{product.title}</h3>
          {product.description && <p className="text-xs text-secondary line-clamp-2">{product.description}</p>}
        </div>

        <div className="pt-3 border-t border-theme flex items-center justify-between gap-2">
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
            className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> {outOfStock ? 'Sold Out' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
