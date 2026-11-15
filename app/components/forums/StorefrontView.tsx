'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { ShoppingCart, Search, Package, Calendar } from 'lucide-react';
import Button from '@/app/components/ui/Button';
import { type ForumSummary, type ProductVariant, type SiteOrder, type SiteProduct } from '@/lib/forums';
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
import { buildProductWaHref } from '@/app/components/forums/ProductDetailModal';
import { PremiumFloaters, PremiumRails, Reveal, WishHeart, useRecentlyViewed } from '@/app/components/forums/PremiumExtras';

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
  const [paymentMethod, setPaymentMethod] = useState<'manual_transfer' | 'pay_on_delivery'>('manual_transfer');
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
      if (active) await loadBookings();
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
      if (orderParam || trackParam === '1') {
        if (orderParam) setTrackInitialCode(orderParam.trim().toUpperCase());
        setTrackOpen(true);
      }
    })();
    return () => { active = false; };
  }, [visibleProducts]);

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

  return (
    <div className={`space-y-6 ${premium ? 'premium-skin' : ''}`} style={premium ? ({ '--skin-accent': site.accent_color || '#1a73e8' } as React.CSSProperties) : undefined}>
      <StorefrontHeroAndTrust
        site={site}
        layoutStyle={layoutStyle}
        categories={categories}
        selectedCategory={category}
        onSelectCategory={setCategory}
      />

      {showCard && <BusinessCard site={site} accent={site.accent_color || '#1a73e8'} />}

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
        <RevealIf on={premium}><div className={`grid gap-3.5 ${layoutStyle === 'temu' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : layoutStyle === 'shopify' ? 'grid-cols-2 lg:grid-cols-4 gap-y-8' : layoutStyle === 'classified' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
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
            return premium
              ? <div key={p.id} className="relative premium-card"><WishHeart slug={site.slug} productId={p.id} accent={site.accent_color || '#1a73e8'} />{card}</div>
              : card;
          })}
        </div></RevealIf>
      )}

      {premium && (
        <PremiumRails site={site} products={visibleProducts} currency={currency} accent={site.accent_color || '#1a73e8'} onOpen={openProduct} recentId={selectedProduct?.id} />
      )}
      {premium && !cartOpen && !selectedProduct && (
        <PremiumFloaters site={site} accent={site.accent_color || '#1a73e8'} currency={currency} cart={catalogue ? undefined : { count: cartCount, total: cartTotal }} onCart={() => setCartOpen(true)} />
      )}

      {selectedProduct && (
        <ProductDetailModal
          key={selectedProduct.id}
          site={site}
          product={selectedProduct}
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
