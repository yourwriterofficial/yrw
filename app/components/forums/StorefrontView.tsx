'use client';

import { useState, useMemo } from 'react';
import {
  ShoppingCart, Plus, Minus, Trash2, Search,
  CheckCircle2, Copy, Check, X, Landmark, Truck, MessageCircle,
} from 'lucide-react';
import Button from '@/app/components/ui/Button';
import { formatMoney, type ForumSummary, type SiteOrder, type SiteProduct } from '@/lib/forums';
import { getTemplateById } from '@/lib/siteTemplates';
import { StorefrontHeroAndTrust, StoreProductCard } from '@/app/components/forums/StorefrontThemes';

interface CartEntry {
  product: SiteProduct;
  qty: number;
}

export default function StorefrontView({
  site,
  products,
}: {
  site: ForumSummary;
  products: SiteProduct[];
}) {
  const currency = site.currency || 'NGN';
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  // Checkout state
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'manual_transfer' | 'pay_on_delivery'>('manual_transfer');
  const [paymentRef, setPaymentRef] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [placedOrder, setPlacedOrder] = useState<SiteOrder | null>(null);
  const [copiedAcct, setCopiedAcct] = useState(false);

  const visibleProducts = useMemo(() => products.filter((p) => p.is_active), [products]);

  const categories = useMemo(() => {
    const set = new Set<string>(['All']);
    for (const p of visibleProducts) set.add(p.category || 'General');
    return Array.from(set);
  }, [visibleProducts]);

  const filtered = useMemo(() => {
    return visibleProducts.filter((p) => {
      if (category !== 'All' && (p.category || 'General') !== category) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [visibleProducts, category, search]);

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const cartTotal = cart.reduce((sum, item) => sum + Number(item.product.price) * item.qty, 0);

  const addToCart = (product: SiteProduct) => {
    setPlacedOrder(null);
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) => (i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { product, qty: 1 }];
    });
    setCartOpen(true);
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.product.id === productId ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0)
    );
  };

  const handleCopyAccount = async () => {
    if (!site.bank_account_number) return;
    await navigator.clipboard.writeText(site.bank_account_number).catch(() => {});
    setCopiedAcct(true);
    setTimeout(() => setCopiedAcct(false), 1800);
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
          delivery_address: deliveryAddress,
          notes,
          payment_method: paymentMethod,
          payment_reference: paymentRef,
          payment_proof_note: proofNote,
          items: cart.map((c) => ({ product_id: c.product.id, qty: c.qty })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCheckoutError(data.error || 'Could not place order.');
        return;
      }
      setPlacedOrder(data.order);
      setCart([]);
      setPaymentRef('');
      setProofNote('');
    } catch {
      setCheckoutError('Network error while placing order.');
    } finally {
      setSubmitting(false);
    }
  };

  const hasBank = !!(site.bank_name && site.bank_account_number);
  const layoutStyle = getTemplateById(site.template_id).layout_style;

  return (
    <div className="space-y-6">
      <StorefrontHeroAndTrust
        site={site}
        layoutStyle={layoutStyle}
        categories={categories}
        selectedCategory={category}
        onSelectCategory={setCategory}
      />

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
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400'
                  : 'border-theme bg-card text-secondary hover:text-primary'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-card border border-theme text-xs text-primary focus:outline-none focus:border-cyan-500"
            />
          </div>
          <Button
            variant="primary"
            onClick={() => setCartOpen(true)}
            icon={<ShoppingCart className="w-4 h-4" />}
          >
            Cart ({cartCount})
          </Button>
        </div>
      </div>

      {/* Product Grid */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-theme rounded-2xl p-10 text-center text-sm text-secondary">
          No products found. {visibleProducts.length === 0 ? 'The store owner has not added products yet.' : ''}
        </div>
      ) : (
        <div className={`grid gap-3.5 ${layoutStyle === 'temu' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
          {filtered.map((p) => (
            <StoreProductCard
              key={p.id}
              product={p}
              currency={currency}
              layoutStyle={layoutStyle}
              onAdd={addToCart}
            />
          ))}
        </div>
      )}

      {/* Cart & Checkout Slide-over Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-primary border-l border-theme h-full overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-theme pb-3">
              <h3 className="font-black text-lg flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-cyan-400" />
                {placedOrder ? 'Order Placed' : `Your Cart (${cartCount})`}
              </h3>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="p-1.5 rounded-lg hover:bg-card text-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {placedOrder ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4" /> Order Confirmed: {placedOrder.order_code}
                  </div>
                  <p className="text-xs text-secondary">
                    Total: <strong className="text-primary">{formatMoney(placedOrder.total_amount, currency)}</strong> · Status:{' '}
                    <span className="font-mono">{placedOrder.payment_status}</span>
                  </p>
                </div>

                {placedOrder.payment_method === 'manual_transfer' && hasBank && (
                  <div className="p-4 rounded-xl bg-card border border-theme space-y-1.5 text-xs">
                    <p className="font-bold text-primary">Bank Transfer Details</p>
                    <p>Bank: <strong>{site.bank_name}</strong></p>
                    <p>Account: <strong className="font-mono">{site.bank_account_number}</strong></p>
                    {site.bank_account_name && <p>Name: <strong>{site.bank_account_name}</strong></p>}
                  </div>
                )}

                {site.whatsapp_number && (
                  <a
                    href={`https://wa.me/${site.whatsapp_number.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                      `Hi ${site.name}, I just placed order ${placedOrder.order_code} (${formatMoney(placedOrder.total_amount, currency)}).`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="w-4 h-4" /> Send Receipt on WhatsApp
                  </a>
                )}

                <Button variant="secondary" onClick={() => { setPlacedOrder(null); setCartOpen(false); }}>
                  Continue Shopping
                </Button>
              </div>
            ) : cart.length === 0 ? (
              <p className="text-sm text-secondary py-10 text-center">Your cart is empty. Add items to check out.</p>
            ) : (
              <>
                <div className="space-y-2.5">
                  {cart.map(({ product, qty }) => (
                    <div key={product.id} className="p-3 rounded-xl bg-card border border-theme flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate">{product.title}</p>
                        <p className="text-xs text-secondary">{formatMoney(product.price, currency)} each</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button type="button" onClick={() => updateQty(product.id, -1)} className="p-1 rounded bg-primary border border-theme">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold w-5 text-center">{qty}</span>
                        <button type="button" onClick={() => updateQty(product.id, 1)} className="p-1 rounded bg-primary border border-theme">
                          <Plus className="w-3 h-3" />
                        </button>
                        <button type="button" onClick={() => updateQty(product.id, -qty)} className="p-1 text-danger ml-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between font-black text-base pt-2 border-t border-theme">
                  <span>Total</span>
                  <span>{formatMoney(cartTotal, currency)}</span>
                </div>

                <form onSubmit={handleCheckout} className="space-y-3 pt-2 border-t border-theme">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-secondary">Customer & Delivery</h4>
                  <input
                    type="text"
                    required
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="Your Full Name"
                    className="w-full px-3 py-2 rounded-xl bg-card border border-theme text-xs"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="email"
                      required
                      value={buyerEmail}
                      onChange={(e) => setBuyerEmail(e.target.value)}
                      placeholder="Email Address"
                      className="w-full px-3 py-2 rounded-xl bg-card border border-theme text-xs"
                    />
                    <input
                      type="tel"
                      required
                      value={buyerPhone}
                      onChange={(e) => setBuyerPhone(e.target.value)}
                      placeholder="Phone / WhatsApp"
                      className="w-full px-3 py-2 rounded-xl bg-card border border-theme text-xs"
                    />
                  </div>
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Delivery Address (for physical items)"
                    className="w-full px-3 py-2 rounded-xl bg-card border border-theme text-xs"
                  />
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Order note / brief (optional)"
                    className="w-full px-3 py-2 rounded-xl bg-card border border-theme text-xs"
                  />

                  <h4 className="text-xs font-bold uppercase tracking-wider text-secondary pt-2">Payment Method</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('manual_transfer')}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 ${
                        paymentMethod === 'manual_transfer' ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400' : 'border-theme bg-card text-secondary'
                      }`}
                    >
                      <Landmark className="w-3.5 h-3.5" /> Bank Transfer
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('pay_on_delivery')}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 ${
                        paymentMethod === 'pay_on_delivery' ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400' : 'border-theme bg-card text-secondary'
                      }`}
                    >
                      <Truck className="w-3.5 h-3.5" /> Pay on Delivery
                    </button>
                  </div>

                  {paymentMethod === 'manual_transfer' && (
                    <div className="p-3.5 rounded-xl bg-card border border-theme space-y-2 text-xs">
                      {hasBank ? (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-primary">{site.bank_name}</span>
                            <button type="button" onClick={handleCopyAccount} className="text-cyan-400 flex items-center gap-1 font-mono">
                              {copiedAcct ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              {site.bank_account_number}
                            </button>
                          </div>
                          {site.bank_account_name && <p className="text-secondary">Account Name: {site.bank_account_name}</p>}
                          {site.payment_instructions && <p className="text-secondary">{site.payment_instructions}</p>}
                        </>
                      ) : (
                        <p className="text-secondary">Store owner has not added bank details yet — you can still place the order and confirm via WhatsApp.</p>
                      )}
                      <input
                        type="text"
                        value={paymentRef}
                        onChange={(e) => setPaymentRef(e.target.value)}
                        placeholder="Transfer Reference / Sender Name (optional)"
                        className="w-full px-3 py-2 rounded-lg bg-primary border border-theme text-xs"
                      />
                      <input
                        type="text"
                        value={proofNote}
                        onChange={(e) => setProofNote(e.target.value)}
                        placeholder="Payment note (e.g. Sent from GTB at 2:15pm)"
                        className="w-full px-3 py-2 rounded-lg bg-primary border border-theme text-xs"
                      />
                    </div>
                  )}

                  {checkoutError && <p className="text-xs text-danger">{checkoutError}</p>}
                  <Button type="submit" variant="primary" disabled={submitting}>
                    {submitting ? 'Placing Order...' : `Place Order (${formatMoney(cartTotal, currency)})`}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
