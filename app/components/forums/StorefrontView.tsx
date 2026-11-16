'use client';

import { useState, useMemo, useEffect, useCallback, Fragment } from 'react';
import { ShoppingCart, Search, Package, Calendar, ArrowUp } from 'lucide-react';
import Button from '@/app/components/ui/Button';
import { formatMoney, type ForumSummary, type ProductVariant, type SiteOrder, type SiteProduct } from '@/lib/forums';
import { getTemplateById } from '@/lib/siteTemplates';
import { computeShipping } from '@/lib/shipping';
import { planFor } from '@/lib/plans';
import { StorefrontHeroAndTrust, StoreProductCard } from '@/app/components/forums/StorefrontThemes';
import ProductDetailModal from '@/app/components/forums/ProductDetailModal';
import OrderTrackingModal from '@/app/components/forums/OrderTrackingModal';
import StorefrontBookingModal, { type PublicBookingService, type TakenSlot } from '@/app/components/forums/StorefrontBookingModal';
import StorefrontCheckoutDrawer, { type StorefrontCartEntry } from '@/app/components/forums/StorefrontCheckoutDrawer';

import { isPremiumTemplate } from '@/lib/premium';
import { pluginOn } from '@/lib/plugins';
import BusinessCard from '@/app/components/forums/BusinessCard';
import { skinFor } from '@/lib/themeSkins';
import { parseLayout, type SectionKey } from '@/lib/sectionOrder';
import { buildProductWaHref } from '@/app/components/forums/ProductDetailModal';
import { PremiumFloaters, PremiumRails, Reveal, WishHeart, useRecentlyViewed } from '@/app/components/forums/PremiumExtras';
import { StorefrontTrustBar, StorefrontFaqAccordion, StorefrontSafetyLinks, FlashSaleBanner, StorefrontCurrencyPreview } from '@/app/components/forums/StorefrontExtras';
import type { PreviewCurrency } from '@/lib/storefrontTools';

/** Fades content in on scroll for premium themes; free themes render it as is. */
function RevealIf({ on, children }: { on: boolean; children: React.ReactNode }) {
  return on ? <Reveal>{children}</Reveal> : <>{children}</>;
}

export default function StorefrontView({
  site,
  products,
}: {
  site: ForumSummary;
  products: SiteProduct[];
}) {
  const currency = site.currency || 'NGN';
  const premium = isPremiumTemplate(site.template_id);
  // Advertise mode: items are shown as a catalogue and buyers are sent to WhatsApp instead of a cart.
  const catalogue = !!site.whatsapp_number && pluginOn('catalogue', 'free', null, site.plugins);
  const showCard = pluginOn('businesscard', site.plan_tier, null, site.plugins);
  const recentlyViewed = useRecentlyViewed(site.slug);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState<'featured' | 'price_asc' | 'price_desc' | 'newest'>('featured');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [cart, setCart] = useState<StorefrontCartEntry[]>([]);
  const [cartReady, setCartReady] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState('');

  // Checkout state
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'pickup'>('delivery');
  const [deliveryState, setDeliveryState] = useState('Lagos');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'manual_transfer' | 'pay_on_delivery' | 'paystack'>('manual_transfer');
  const [previewCurrency, setPreviewCurrency] = useState<PreviewCurrency>('NGN');
  const canPayOnline = (Boolean(site.online_payments_ready) || Boolean(site.paystack_subaccount_code)) && pluginOn('online_payments', site.plan_tier, site.plan_expires_at, site.plugins);
  // When the store can take online payments, that is the default, so shoppers land on the payment step rather than an unpaid order.
  useEffect(() => { if (canPayOnline) setPaymentMethod((m) => (m === 'manual_transfer' ? 'paystack' : m)); }, [canPayOnline]);
  const [paymentRef, setPaymentRef] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [placedOrder, setPlacedOrder] = useState<SiteOrder | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<SiteProduct | null>(null);
  const [trackOpen, setTrackOpen] = useState(false);
  const [trackInitialCode, setTrackInitialCode] = useState('');
  const [bookingServices, setBookingServices] = useState<PublicBookingService[]>([]);
  const [takenSlots, setTakenSlots] = useState<TakenSlot[]>([]);
  const [bookingOpen, setBookingOpen] = useState(false);

  const visibleProducts = useMemo(() => products.filter((p) => p.is_active), [products]);

  const loadBookings = useCallback(async () => {
    try {
      const res = await fetch(`/api/forums/${encodeURIComponent(site.slug)}/bookings`);
      if (!res.ok) return;
      const data = await res.json();
      const svcs = Array.isArray(data.services)
        ? (data.services as (PublicBookingService & { is_active?: boolean })[]).filter((s) => s.is_active !== false)
        : [];
      setBookingServices(svcs);
      setTakenSlots(Array.isArray(data.takenSlots) ? data.takenSlots : []);
    } catch {
      // Tolerant if bookings migration is not yet applied
    }
  }, [site.slug]);

  useEffect(() => {
    let active = true;
    (async () => {
      await Promise.resolve();
      // Bookings only exist on plans that include them, so other sites skip the request.
      if (active && pluginOn('bookings', (site as unknown as { plan_effective?: string }).plan_effective || site.plan_tier || 'free', null, site.plugins)) await loadBookings();
    })();
    return () => { active = false; };
  }, [loadBookings]);

  useEffect(() => {
    let active = true;
    (async () => {
      await Promise.resolve();
      if (!active) return;
      const params = new URLSearchParams(window.location.search);
      const pid = params.get('product');
      if (pid && visibleProducts.length > 0) {
        const match = visibleProducts.find((p) => p.id === pid);
        if (match) setSelectedProduct(match);
      }
      const orderParam = params.get('order');
      const trackParam = params.get('track');
      const catParam = params.get('category');
      if (catParam) setCategory(catParam);
      if (orderParam || trackParam === '1') {
        if (orderParam) setTrackInitialCode(orderParam.trim().toUpperCase());
        setTrackOpen(true);
      }
      // Restore saved cart from localStorage
      try {
        const raw = localStorage.getItem(`developa_cart_${site.slug}`);
        if (raw && visibleProducts.length > 0) {
          const saved = JSON.parse(raw) as { productId: string; variantId?: string; qty: number }[];
          if (Array.isArray(saved)) {
            const restored: StorefrontCartEntry[] = [];
            for (const s of saved) {
              const p = visibleProducts.find((x) => x.id === s.productId);
              if (!p) continue;
              const v = s.variantId ? (p.variants || []).find((vx) => vx.id === s.variantId && vx.is_active) : undefined;
              const qty = Math.max(1, Math.min(99, Number(s.qty) || 1));
              restored.push({ key: v ? `${p.id}::${v.id}` : p.id, product: p, variant: v, qty });
            }
            if (restored.length > 0) setCart(restored);
          }
        }
      } catch {}
      setCartReady(true);
    })();
    return () => { active = false; };
  }, [visibleProducts, site.slug]);

  useEffect(() => {
    if (!cartReady) return;
    try {
      const compact = cart.map((c) => ({ productId: c.product.id, variantId: c.variant?.id, qty: c.qty }));
      localStorage.setItem(`developa_cart_${site.slug}`, JSON.stringify(compact));
    } catch {}
  }, [cart, cartReady, site.slug]);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 360);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>(['All']);
    for (const p of visibleProducts) set.add(p.category || 'General');
    return Array.from(set);
  }, [visibleProducts]);

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of visibleProducts) m.set(p.category || 'General', (m.get(p.category || 'General') || 0) + 1);
    return m;
  }, [visibleProducts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = visibleProducts.filter((p) => {
      if (category !== 'All' && (p.category || 'General') !== category) return false;
      if (inStockOnly && p.stock_qty !== null && p.stock_qty <= 0) return false;
      if (!q) return true;
      return [p.title, p.description || '', p.category || ''].some((v) => v.toLowerCase().includes(q));
    });
    if (sort === 'price_asc') return [...list].sort((a, b) => Number(a.price) - Number(b.price));
    if (sort === 'price_desc') return [...list].sort((a, b) => Number(b.price) - Number(a.price));
    if (sort === 'newest') return [...list].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return list;
  }, [visibleProducts, category, search, sort, inStockOnly]);

  const clearFilters = () => { setCategory('All'); setSearch(''); setSort('featured'); setInStockOnly(false); };

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const cartTotal = cart.reduce(
    (sum, item) => sum + Number(item.variant ? item.variant.price : item.product.price) * item.qty,
    0
  );
  // The discount shown here is a preview; the server recalculates it when the order is placed.
  const discount = coupon ? Math.min(coupon.discount, cartTotal) : 0;
  const plan = planFor(site.plan_tier);
  const zones = useMemo(() => site.shipping_zones || [], [site.shipping_zones]);
  const hasPhysical = cart.some((c) => c.product.product_type === 'physical');
  const shippingCalc = useMemo(() => {
    if (!plan.shippingZones || !hasPhysical) return { fee: 0, zoneName: '', freeDeliveryApplied: false };
    return computeShipping({
      deliveryMethod: deliveryMethod === 'pickup' && site.pickup_address ? 'pickup' : 'delivery',
      state: deliveryState,
      subtotalAfterDiscount: Math.max(0, cartTotal - discount),
      zones,
    });
  }, [plan.shippingZones, hasPhysical, deliveryMethod, site.pickup_address, deliveryState, cartTotal, discount, zones]);
  const payable = Math.max(0, cartTotal - discount + shippingCalc.fee);

  useEffect(() => {
    if (!plan.abandonedCarts || !cartOpen || placedOrder || cart.length === 0) return;
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail.trim());
    const phoneOk = buyerPhone.trim().length >= 7;
    if (!emailOk && !phoneOk) return;
    const timer = setTimeout(() => {
      fetch(`/api/forums/${encodeURIComponent(site.slug)}/carts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailOk ? buyerEmail.trim().toLowerCase() : '',
          phone: buyerPhone.trim(),
          buyer_name: buyerName.trim(),
          items: cart.map((c) => ({
            product_id: c.product.id,
            title: c.variant ? `${c.product.title} (${c.variant.label})` : c.product.title,
            qty: c.qty,
            price: Number(c.variant ? c.variant.price : c.product.price),
          })),
          total: payable,
        }),
      }).catch(() => {});
    }, 1200);
    return () => clearTimeout(timer);
  }, [plan.abandonedCarts, cartOpen, placedOrder, cart, buyerEmail, buyerPhone, buyerName, payable, site.slug]);

  const applyCoupon = async () => {
    setCouponMsg('');
    if (!couponInput.trim()) return;
    try {
      const res = await fetch(`/api/forums/${encodeURIComponent(site.slug)}/coupons/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponInput, subtotal: cartTotal }),
      });
      const data = await res.json();
      if (data.valid) { setCoupon({ code: data.code, discount: data.discount }); setCouponMsg(''); }
      else { setCoupon(null); setCouponMsg(data.message || 'That code is not valid.'); }
    } catch { setCouponMsg('Could not check the code. Try again.'); }
  };

  const openProduct = (p: SiteProduct) => { setSelectedProduct(p); recentlyViewed.push(p.id); };

  const addToCart = (product: SiteProduct, variant?: ProductVariant) => {
    if (catalogue) {
      const href = buildProductWaHref(site, product);
      if (href) window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!variant && (product.variants || []).some((v) => v.is_active)) {
      setSelectedProduct(product);
      return;
    }
    const key = `${product.id}:${variant?.id || ''}`;
    setPlacedOrder(null);
    setCart((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) => (i.key === key ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { key, product, variant, qty: 1 }];
    });
    setCartOpen(true);
  };

  const updateQty = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.key === key ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0)
    );
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError('');
    setSubmitting(true);
    try {
      const res = await fetch(`/api/forums/${encodeURIComponent(site.slug)}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyer_name: buyerName,
          buyer_email: buyerEmail,
          buyer_phone: buyerPhone,
          delivery_method: deliveryMethod,
          delivery_state: deliveryState,
          delivery_address: deliveryAddress,
          notes,
          payment_method: paymentMethod,
          payment_reference: paymentRef,
          payment_proof_note: proofNote,
          marketing_consent: marketingConsent,
          items: cart.map((c) => ({
            product_id: c.product.id,
            ...(c.variant ? { variant_id: c.variant.id } : {}),
            qty: c.qty,
          })),
          coupon_code: coupon?.code || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCheckoutError(data.error || 'Could not place order.');
        return;
      }
      setPlacedOrder(data.order);
      setCart([]);
      setCoupon(null);
      setCouponInput('');
      setPaymentRef('');
      setProofNote('');
      setMarketingConsent(false);

      if (paymentMethod === 'paystack' && data.order?.order_code) {
        const payRes = await fetch('/api/developa/pay/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'store_order',
            slug: site.slug,
            order_code: data.order.order_code,
            buyer_email: buyerEmail.trim(),
          }),
        });
        const payData = await payRes.json().catch(() => ({}));
        if (payRes.ok && payData.authorization_url) {
          window.location.href = payData.authorization_url;
          return;
        }
        setCheckoutError(payData.error || 'Order saved, but online payment could not start. You can pay via transfer.');
      }
    } catch {
      setCheckoutError('Network error while placing order.');
    } finally {
      setSubmitting(false);
    }
  };

  const layoutStyle = getTemplateById(site.template_id).layout_style;
  const jsonLd = useMemo(() => {
    const fallbackOrigin = (process.env.NEXT_PUBLIC_SITE_URL || 'https://developa.me').replace(/\/$/, '');
    const storeUrl =
      site.custom_domain && site.custom_domain_verified
        ? `https://${site.custom_domain}`
        : `${fallbackOrigin}/forums/${site.slug}`;
    return JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Store',
      name: site.name,
      description: site.description || '',
      url: storeUrl,
      ...(site.logo_url ? { image: site.logo_url } : {}),
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: `${site.name} Catalog`,
        itemListElement: visibleProducts.slice(0, 30).map((p) => ({
          '@type': 'Product',
          name: p.title,
          description: p.description || '',
          ...(p.image_url ? { image: p.image_url } : {}),
          offers: {
            '@type': 'Offer',
            price: Number(p.price),
            priceCurrency: currency,
            availability:
              p.stock_qty === null || p.stock_qty > 0
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
            url: `${storeUrl}?product=${encodeURIComponent(p.id)}`,
          },
        })),
      },
    }).replace(/</g, '\\u003c');
  }, [site.slug, site.name, site.description, site.logo_url, site.custom_domain, site.custom_domain_verified, visibleProducts, currency]);

  // The home page parts, drawn in the order the owner chose (see lib/sectionOrder.ts).
  const layout = parseLayout((site.plugins as Record<string, unknown> | undefined)?._cfg_layout);
  const blocks: Record<SectionKey, React.ReactNode> = {
    hero: (
      <StorefrontHeroAndTrust
        site={site}
        layoutStyle={layoutStyle}
        categories={categories}
        selectedCategory={category}
        onSelectCategory={setCategory}
      />
    ),
    contact: (
      <>
      {showCard && <BusinessCard site={site} accent={site.accent_color || '#1a73e8'} />}
      </>
    ),
    shop: (
      <>
      {/* Search, Category Filter & Cart Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {layoutStyle !== 'jumia' && categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                category === cat
                  ? 'bg-accent/15 border-accent/40 text-accent'
                  : 'border-theme bg-card text-secondary hover:text-primary'
              }`}
            >
              {cat}{cat !== 'All' && categoryCounts.get(cat) ? <span className="opacity-60"> {categoryCounts.get(cat)}</span> : null}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[140px] sm:w-56">
            <Search className="w-3.5 h-3.5 text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-card border border-theme text-xs text-primary focus:outline-none focus:border-accent"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            aria-label="Sort products"
            className="py-2 pl-3 pr-2 rounded-xl bg-card border border-theme text-xs text-primary focus:outline-none focus:border-accent"
          >
            <option value="featured">Featured</option>
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
          <label className="hidden md:flex items-center gap-1.5 text-xs text-secondary whitespace-nowrap">
            <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="w-3.5 h-3.5" /> In stock
          </label>
          <StorefrontCurrencyPreview sampleNgn={cartTotal > 0 ? cartTotal : 10000} currency={previewCurrency} onChange={setPreviewCurrency} />
          {bookingServices.length > 0 && (
            <Button
              variant="secondary"
              onClick={() => setBookingOpen(true)}
              icon={<Calendar className="w-4 h-4" />}
            >
              Book slot
            </Button>
          )}
          {!catalogue && (
            <Button
              variant="ghost"
              onClick={() => setTrackOpen(true)}
              icon={<Package className="w-4 h-4" />}
            >
              Track order
            </Button>
          )}
          {!catalogue && (
            <Button
              variant="primary"
              onClick={() => setCartOpen(true)}
              icon={<ShoppingCart className="w-4 h-4" />}
            >
              Cart ({cartCount})
            </Button>
          )}
        </div>
      </div>

      {/* Product Grid */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-theme rounded-2xl p-10 text-center text-sm text-secondary">
          {visibleProducts.length === 0 ? (
            'The store owner has not added products yet.'
          ) : (
            <>
              No products match your search.{' '}
              <button type="button" onClick={clearFilters} className="text-accent font-medium hover:underline">Clear filters</button>
            </>
          )}
        </div>
      ) : (
        <RevealIf on><div className={`grid gap-3.5 ${layoutStyle === 'temu' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : layoutStyle === 'jumia' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5' : layoutStyle === 'shopify' ? 'grid-cols-2 lg:grid-cols-4 gap-y-8' : layoutStyle === 'classified' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
          {filtered.map((p) => {
            const card = (
              <StoreProductCard
                key={p.id}
                site={site}
                product={p}
                currency={currency}
                layoutStyle={layoutStyle}
                onAdd={addToCart}
                onOpen={openProduct}
                catalogue={catalogue}
              />
            );
            // Every theme gets the modern card; the wishlist heart stays a premium extra.
            return (
              <div key={p.id} className="relative premium-card">
                {<WishHeart slug={site.slug} productId={p.id} accent={site.accent_color || '#1a73e8'} />}
                {card}
              </div>
            );
          })}
        </div></RevealIf>
      )}
      </>
    ),
    flash: (
      <>
      {pluginOn('flash_sale', site.plan_tier, null, site.plugins) && (
        <FlashSaleBanner />
      )}
      </>
    ),
    rails: (
      <>
      {premium && (
        <PremiumRails site={site} products={visibleProducts} currency={currency} accent={site.accent_color || '#1a73e8'} onOpen={openProduct} recentId={selectedProduct?.id} />
      )}
      </>
    ),
    trust: (
      <>
      <StorefrontTrustBar />
      <StorefrontFaqAccordion />
      <StorefrontSafetyLinks slug={site.slug} />
      </>
    ),
  };


  return (
    <div className="space-y-6 premium-skin" data-skin={skinFor(site.template_id)} style={{ '--skin-accent': site.accent_color || '#1a73e8' } as React.CSSProperties}>
      {layout.order.filter((k) => !layout.hidden.has(k)).map((k) => <Fragment key={k}>{blocks[k]}</Fragment>)}
      {premium && !cartOpen && !selectedProduct && (
        <PremiumFloaters site={site} accent={site.accent_color || '#1a73e8'} currency={currency} cart={catalogue ? undefined : { count: cartCount, total: cartTotal }} onCart={() => setCartOpen(true)} />
      )}

      {selectedProduct && (
        <ProductDetailModal
          key={selectedProduct.id}
          site={site}
          product={selectedProduct}
          relatedProducts={visibleProducts.filter((p) => p.id !== selectedProduct.id && (p.category || 'General') === (selectedProduct.category || 'General')).slice(0, 3)}
          onSelectProduct={(p) => setSelectedProduct(p)}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={addToCart}
        />
      )}

      {trackOpen && (
        <OrderTrackingModal
          site={site}
          initialCode={trackInitialCode}
          onClose={() => setTrackOpen(false)}
        />
      )}

      {bookingOpen && bookingServices.length > 0 && (
        <StorefrontBookingModal
          site={site}
          services={bookingServices}
          takenSlots={takenSlots}
          onClose={() => setBookingOpen(false)}
          onBooked={loadBookings}
        />
      )}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      {!catalogue && cartCount > 0 && !cartOpen && (
        <div className="sm:hidden fixed bottom-4 inset-x-4 z-40">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="w-full h-12 px-5 rounded-full bg-accent text-[var(--accent-foreground)] shadow-lg flex items-center justify-between text-sm font-semibold"
          >
            <span className="inline-flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              {cartCount} {cartCount === 1 ? 'item' : 'items'}
            </span>
            <span>{formatMoney(cartTotal, currency)} · View cart</span>
          </button>
        </div>
      )}

      {showTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top"
          className={`fixed right-4 z-30 w-10 h-10 rounded-full bg-card border border-theme shadow-md flex items-center justify-center text-secondary hover:text-primary transition ${!catalogue && cartCount > 0 ? 'bottom-20 sm:bottom-6' : 'bottom-6'}`}
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      )}

      {cartOpen && (
        <StorefrontCheckoutDrawer
          site={site}
          currency={currency}
          cart={cart}
          cartCount={cartCount}
          placedOrder={placedOrder}
          onClose={() => setCartOpen(false)}
          onContinueShopping={() => { setPlacedOrder(null); setCartOpen(false); }}
          onUpdateQty={updateQty}
          couponInput={couponInput}
          setCouponInput={setCouponInput}
          applyCoupon={applyCoupon}
          couponMsg={couponMsg}
          coupon={coupon}
          discount={discount}
          hasPhysical={hasPhysical}
          showShippingZones={plan.shippingZones}
          hasZones={zones.length > 0}
          shippingCalc={shippingCalc}
          payable={payable}
          deliveryMethod={deliveryMethod}
          setDeliveryMethod={setDeliveryMethod}
          deliveryState={deliveryState}
          setDeliveryState={setDeliveryState}
          deliveryAddress={deliveryAddress}
          setDeliveryAddress={setDeliveryAddress}
          buyerName={buyerName}
          setBuyerName={setBuyerName}
          buyerEmail={buyerEmail}
          setBuyerEmail={setBuyerEmail}
          buyerPhone={buyerPhone}
          setBuyerPhone={setBuyerPhone}
          notes={notes}
          setNotes={setNotes}
          abandonedCartsEnabled={plan.abandonedCarts}
          canPayOnline={canPayOnline}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          paymentRef={paymentRef}
          setPaymentRef={setPaymentRef}
          proofNote={proofNote}
          setProofNote={setProofNote}
          marketingConsent={marketingConsent}
          setMarketingConsent={setMarketingConsent}
          checkoutError={checkoutError}
          submitting={submitting}
          onSubmit={handleCheckout}
        />
      )}
    </div>
  );
}
